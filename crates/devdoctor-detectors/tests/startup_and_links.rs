#![cfg(unix)]
//! Tests for the startup-error, dangling-link and Xcode Command Line Tools detectors.

use devdoctor_core::command::{CommandOutput, MockRunner};
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::Detector;
use devdoctor_core::issue::Severity;
use devdoctor_core::platform::FakePlatform;
use devdoctor_detectors::{macos, shell_path, shell_startup};
use std::sync::Arc;

fn ctx_with_zshrc(home: &std::path::Path, zshrc: &str, path: &str, runner: MockRunner) -> SystemContext {
    std::fs::write(home.join(".zshrc"), zshrc).unwrap();
    let expanded = path.replace("$HOME", &home.to_string_lossy());
    SystemContext::for_test(home, Arc::new(FakePlatform::new()), Arc::new(runner), &expanded)
}

#[test]
fn startup_errors_point_at_the_line_and_offer_a_fix_when_the_tool_is_gone() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    let ctx = ctx_with_zshrc(
        home,
        "export PATH=\"$HOME/bin:$PATH\"\neval \"$(pyenv init -)\"\nif true; then\n  eval \"$(rbenv init -)\"\nfi\nsource ~/.missing.zsh\n",
        "/usr/bin:/bin",
        MockRunner::new(),
    );
    let zshrc = home.join(".zshrc").display().to_string();
    let lines = vec![
        format!("{zshrc}:2: command not found: pyenv"),
        format!("{zshrc}:4: command not found: rbenv"),
        format!("{zshrc}:2: command not found: pyenv"),
        format!("{zshrc}:source:6: no such file or directory: {}/.missing.zsh", home.display()),
        "zsh compinit: insecure directories, run compaudit for list.".to_string(),
        "some tool printed this".to_string(),
    ];
    let issues = shell_startup::issues_from_stderr(&ctx, &lines);
    let titles: Vec<&str> = issues.iter().map(|i| i.title.as_str()).collect();
    let pyenv = issues.iter().find(|i| i.title.contains("`pyenv`")).unwrap_or_else(|| panic!("pyenv issue missing: {titles:?}"));
    assert_eq!(pyenv.severity, Severity::Medium);
    assert_eq!(pyenv.fixer_id.as_deref(), Some("shell.line.comment_out"), "exclusive top-level line is fixable");
    assert_eq!(pyenv.metadata["fixable"], true);
    assert_eq!(pyenv.metadata["raw"], "eval \"$(pyenv init -)\"");
    assert_eq!(pyenv.affected_files[0].line, Some(2));
    let rbenv = issues.iter().find(|i| i.title.contains("`rbenv`")).expect("rbenv issue");
    assert!(rbenv.fixer_id.is_none(), "a line inside an if block is not commented out automatically");
    assert_eq!(issues.iter().filter(|i| i.title.contains("`pyenv`")).count(), 1, "duplicate stderr lines are merged");
    assert!(
        !issues.iter().any(|i| i.title.contains("refers to a file")),
        "missing source targets belong to the source detector: {titles:?}"
    );
    assert!(issues.iter().any(|i| i.fingerprint == "compinit_insecure" && i.severity == Severity::Low));
    let other = issues.iter().find(|i| i.fingerprint == "unlocated").expect("unlocated messages grouped");
    assert!(other.evidence.iter().any(|e| e.contains("some tool printed this")));
}

#[test]
fn startup_error_for_a_tool_installed_elsewhere_recommends_path_not_removal() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    std::fs::create_dir_all(home.join(".pyenv/bin")).unwrap();
    let bin = home.join(".pyenv/bin/pyenv");
    std::fs::write(&bin, "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(&bin, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let ctx = ctx_with_zshrc(home, "eval \"$(pyenv init -)\"\n", "/usr/bin:/bin", MockRunner::new());
    let zshrc = home.join(".zshrc").display().to_string();
    let issues = shell_startup::issues_from_stderr(&ctx, &[format!("{zshrc}:1: command not found: pyenv")]);
    assert_eq!(issues.len(), 1);
    assert!(issues[0].fixer_id.is_none(), "never disable a line whose tool is merely not in PATH yet");
    assert!(issues[0].recommended_action.contains("before line 1"), "{}", issues[0].recommended_action);
    assert!(issues[0].evidence.iter().any(|e| e.contains(".pyenv/bin/pyenv exists")));
}

#[test]
fn dangling_links_in_home_path_directories_are_fixable() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    let bin = home.join(".local/bin");
    std::fs::create_dir_all(&bin).unwrap();
    std::os::unix::fs::symlink(home.join(".local/pipx/venvs/oldtool/bin/oldtool"), bin.join("oldtool")).unwrap();
    std::fs::write(bin.join("fine"), "#!/bin/sh\n").unwrap();
    let ctx = ctx_with_zshrc(home, "", "$HOME/.local/bin:/usr/bin:/bin", MockRunner::new());
    let issues = shell_path::PathDanglingSymlinkDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 1, "{:?}", issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    let i = &issues[0];
    assert_eq!(i.severity, Severity::Low);
    assert_eq!(i.fixer_id.as_deref(), Some("shell.path.remove_dangling_symlinks"));
    assert_eq!(i.metadata["in_home"], true);
    assert_eq!(i.metadata["links"].as_array().map(|a| a.len()), Some(1));
    assert!(i.evidence[0].contains("pipx package"), "{}", i.evidence[0]);
    assert_eq!(i.affected_commands, vec!["oldtool".to_string()]);
}

#[cfg(target_os = "macos")]
#[test]
fn xcode_command_line_tools_missing_or_broken() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    let runner = MockRunner::new();
    runner.respond("xcode-select", CommandOutput::failed(2, "xcode-select: error: unable to get active developer directory, use `sudo xcode-select --switch path/to/Xcode.app` to set one (or see `man xcode-select`)"));
    let ctx = ctx_with_zshrc(home, "", "/usr/bin:/bin", runner);
    let issues = macos::XcodeCltDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].fingerprint, "missing");
    assert!(issues[0].recommended_action.contains("xcode-select --install"));

    let runner = MockRunner::new();
    runner.respond("xcode-select", CommandOutput::ok("/Applications/Xcode-old.app/Contents/Developer\n"));
    let ctx = ctx_with_zshrc(home, "", "/usr/bin:/bin", runner);
    let issues = macos::XcodeCltDetector.scan(&ctx).unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].fingerprint, "broken");
    assert_eq!(issues[0].severity, Severity::High);

    let runner = MockRunner::new();
    runner.respond("xcode-select", CommandOutput::ok(format!("{}\n", home.display())));
    let ctx = ctx_with_zshrc(home, "", "/usr/bin:/bin", runner);
    assert!(macos::XcodeCltDetector.scan(&ctx).unwrap().is_empty(), "an existing developer directory is fine");
}
