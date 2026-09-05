#![cfg(unix)]
//! Tests for the npm global prefix, stranded globals and Claude Code duplicate detectors.

use devdoctor_core::command::MockRunner;
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::Detector;
use devdoctor_core::issue::Severity;
use devdoctor_core::platform::FakePlatform;
use devdoctor_detectors::{ai, node};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::sync::Arc;

fn ctx(home: &Path, path: &str) -> SystemContext {
    let expanded = path.replace("$HOME", &home.to_string_lossy());
    SystemContext::for_test(home, Arc::new(FakePlatform::new()), Arc::new(MockRunner::new()), &expanded)
}

fn executable(path: &Path) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, "#!/bin/sh\nexit 0\n").unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

#[test]
fn npm_prefix_outside_home_that_is_not_writable_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    // /usr/lib and /usr/bin exist on every Unix and are not writable by a normal user.
    std::fs::write(home.join(".npmrc"), "registry=https://registry.npmjs.org/\nprefix=/usr\n").unwrap();
    let c = ctx(home, "/usr/bin:/bin");
    let issues = node::NpmGlobalPrefixDetector.scan(&c).unwrap();
    if nix_is_root() {
        return; // root can write anywhere; nothing to assert
    }
    assert_eq!(issues.len(), 1, "{:?}", issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    assert_eq!(issues[0].severity, Severity::Medium);
    assert_eq!(issues[0].metadata["prefix"], "/usr");
    assert!(issues[0].recommended_action.contains("Do not use sudo"));

    // A prefix inside the home folder is never a problem.
    std::fs::write(home.join(".npmrc"), "prefix=~/.npm-global\n").unwrap();
    let c = ctx(home, "/usr/bin:/bin");
    assert!(node::NpmGlobalPrefixDetector.scan(&c).unwrap().is_empty());
}

fn nix_is_root() -> bool {
    // SAFETY: getuid has no preconditions.
    unsafe { libc_getuid() == 0 }
}

extern "C" {
    #[link_name = "getuid"]
    fn libc_getuid() -> u32;
}

#[test]
fn globals_left_in_an_inactive_nvm_version_are_reported() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    let nvm = home.join(".nvm");
    std::fs::create_dir_all(&nvm).unwrap();
    std::fs::write(nvm.join("nvm.sh"), "# nvm\n").unwrap();
    let old = nvm.join("versions/node/v20.11.0");
    let new = nvm.join("versions/node/v22.4.1");
    executable(&old.join("bin/node"));
    executable(&new.join("bin/node"));
    for pkg in ["typescript", "@anthropic-ai/claude-code", "npm", "corepack"] {
        std::fs::create_dir_all(old.join("lib/node_modules").join(pkg)).unwrap();
    }
    std::fs::create_dir_all(new.join("lib/node_modules/typescript")).unwrap();
    std::fs::create_dir_all(new.join("lib/node_modules/npm")).unwrap();
    let c = ctx(home, "$HOME/.nvm/versions/node/v22.4.1/bin:/usr/bin:/bin");
    let issues = node::NpmStrandedGlobalsDetector.scan(&c).unwrap();
    assert_eq!(issues.len(), 1, "{:?}", issues.iter().map(|i| &i.title).collect::<Vec<_>>());
    let i = &issues[0];
    assert_eq!(i.severity, Severity::Low);
    assert_eq!(
        i.metadata["packages"],
        serde_json::json!(["@anthropic-ai/claude-code"]),
        "typescript exists in both, npm/corepack are ignored"
    );
    assert!(i.recommended_action.contains("nvm reinstall-packages 20.11.0"), "{}", i.recommended_action);
    assert_eq!(i.affected_commands, vec!["claude-code".to_string()]);
}

#[test]
fn claude_code_native_plus_npm_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path();
    executable(&home.join(".local/bin/claude"));
    std::fs::create_dir_all(home.join(".npm-global/lib/node_modules/@anthropic-ai/claude-code")).unwrap();
    let c = ctx(home, "$HOME/.local/bin:/usr/bin:/bin");
    let issues = ai::ClaudeCodeDuplicateInstallDetector.scan(&c).unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].fingerprint, "native_and_npm");
    assert!(issues[0].description.contains("~/.local/bin/claude"), "{}", issues[0].description);
    assert!(issues[0].recommended_action.contains("npm uninstall -g @anthropic-ai/claude-code"));

    // Native only: nothing to report.
    std::fs::remove_dir_all(home.join(".npm-global")).unwrap();
    let c = ctx(home, "$HOME/.local/bin:/usr/bin:/bin");
    assert!(ai::ClaudeCodeDuplicateInstallDetector.scan(&c).unwrap().is_empty());
}
