//! Fixture-based tests: each fixture is installed as the `.zshrc` of a temporary home and the
//! detectors are run against it with a fake platform and a mocked command runner.

use devdoctor_core::command::{CommandOutput, MockRunner};
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::Detector;
use devdoctor_core::issue::{Confidence, Severity};
use devdoctor_core::platform::FakePlatform;
use devdoctor_detectors::{shell_path, shell_source, shell_syntax};
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn fixture(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/shell").join(name);
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("fixture {name}: {e}"))
}

struct Env {
    _dir: tempfile::TempDir,
    home: PathBuf,
}

fn home_with(files: &[(&str, &str)]) -> Env {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().to_path_buf();
    for (name, fixture_name) in files {
        std::fs::write(home.join(name), fixture(fixture_name)).unwrap();
    }
    Env { _dir: dir, home }
}

fn context(env: &Env, path: &str) -> SystemContext {
    let runner = MockRunner::new();
    // `zsh -n` is mocked: syntax checks pass unless a test overrides it.
    runner.respond("zsh", CommandOutput::ok(""));
    let expanded = path.replace("$HOME", &env.home.to_string_lossy());
    SystemContext::for_test(&env.home, Arc::new(FakePlatform::new()), Arc::new(runner), &expanded)
}

#[test]
fn valid_zshrc_produces_no_shell_issues() {
    let env = home_with(&[(".zshrc", "valid.zshrc")]);
    std::fs::create_dir_all(env.home.join(".local/bin")).unwrap();
    let ctx = context(&env, "$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin");
    for d in [
        Box::new(shell_path::PathDuplicateDetector) as Box<dyn Detector>,
        Box::new(shell_path::PathMissingDirectoryDetector),
        Box::new(shell_source::SourceMissingFileDetector),
        Box::new(shell_source::SourceRecursiveDetector),
        Box::new(shell_source::SourceDuplicateDetector),
    ] {
        let issues = d.scan(&ctx).unwrap();
        assert!(issues.is_empty(), "{} reported {:?}", d.meta().id, issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    }
}

#[test]
fn duplicate_path_is_detected_and_fixable() {
    let env = home_with(&[(".zshrc", "duplicate-path.zshrc")]);
    std::fs::create_dir_all(env.home.join(".local/bin")).unwrap();
    std::fs::create_dir_all(env.home.join(".pyenv/shims")).unwrap();
    let ctx = context(&env, "/opt/homebrew/bin:$HOME/.pyenv/shims:/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.local/bin");
    let issues = shell_path::PathDuplicateDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 2, "{:?}", issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    let brew = issues.iter().find(|i| i.fingerprint == "/opt/homebrew/bin").expect("homebrew duplicate");
    assert_eq!(brew.severity, Severity::Low);
    assert_eq!(brew.confidence, Confidence::Confirmed);
    assert_eq!(brew.fixer_id.as_deref(), Some("shell.path.remove_duplicate"));
    assert!(brew.evidence.iter().any(|e| e.contains(".zshrc:2")));
    assert!(brew.recommended_action.contains(".zshrc:2"), "removes the first prepend: {}", brew.recommended_action);
    assert!(brew.recommended_action.contains("Keep") && brew.recommended_action.contains(".zshrc:4"));
    let local = issues.iter().find(|i| i.fingerprint.ends_with("/.local/bin")).expect("local bin duplicate");
    assert!(local.recommended_action.contains(".zshrc:6"), "second append is redundant: {}", local.recommended_action);
}

#[test]
fn missing_directory_and_missing_source_are_detected() {
    let env = home_with(&[(".zshrc", "missing-command.zshrc")]);
    let ctx = context(&env, "$HOME/.nonexistent-tool/bin:/usr/bin:/bin");
    let missing = shell_path::PathMissingDirectoryDetector.scan(&ctx).unwrap();
    assert_eq!(missing.len(), 1);
    assert_eq!(missing[0].fixer_id.as_deref(), Some("shell.path.remove_missing_directory"));
    assert!(missing[0].affected_files.iter().any(|f| f.line == Some(2)));

    let sources = shell_source::SourceMissingFileDetector.scan(&ctx).unwrap();
    assert_eq!(sources.len(), 1, "guarded source must not be reported");
    assert_eq!(sources[0].severity, Severity::Medium);
    assert!(sources[0].title.contains("removed-tool/init.sh"));
}

#[test]
fn recursive_sourcing_is_detected() {
    let env = home_with(&[(".zshrc", "recursive-source.zshrc"), (".zprofile", "recursive-source.zprofile")]);
    let ctx = context(&env, "/usr/bin:/bin");
    let issues = shell_source::SourceRecursiveDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 1, "{:?}", issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    assert_eq!(issues[0].severity, Severity::High);
}

#[test]
fn conditional_statements_are_not_removed() {
    let env = home_with(&[(".zshrc", "conditional-and-functions.zshrc")]);
    std::fs::create_dir_all(env.home.join(".cargo/bin")).unwrap();
    let ctx = context(&env, "/usr/local/go/bin:$HOME/.cargo/bin:$HOME/.cargo/bin:/usr/bin");
    let issues = shell_path::PathDuplicateDetector.scan(&ctx).unwrap();
    let cargo = issues.iter().find(|i| i.fingerprint.ends_with("/.cargo/bin")).expect("cargo duplicate");
    // The conditional prepend (line 2) is blocked; the unconditional one (line 7) is the keeper.
    assert!(cargo.fixer_id.is_none(), "no safe removal exists: {}", cargo.recommended_action);
    assert!(cargo.recommended_action.contains("cannot be simplified") || cargo.recommended_action.contains("could not find"));
}

#[test]
fn syntax_errors_are_reported_from_the_shell_parser() {
    let env = home_with(&[(".zshrc", "malformed-export.zshrc")]);
    let runner = MockRunner::new();
    let zshrc = env.home.join(".zshrc");
    runner.respond("zsh", CommandOutput::failed(1, format!("{}:2: unmatched \"\n", zshrc.display())));
    let ctx = SystemContext::for_test(&env.home, Arc::new(FakePlatform::new()), Arc::new(runner), "/usr/bin:/bin");
    let issues = shell_syntax::ShellSyntaxDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].severity, Severity::High);
    assert_eq!(issues[0].affected_files[0].line, Some(2));
    assert!(
        issues[0].evidence.iter().any(|e| e.contains("unterminated double quote")),
        "parser warning included: {:?}",
        issues[0].evidence
    );
}
