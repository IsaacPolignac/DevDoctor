//! macOS developer tooling: the Xcode Command Line Tools that `git`, `clang`, `make` and
//! Homebrew depend on.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;
use std::path::Path;

pub const CLT_ID: &str = "macos.xcode_clt";
const XCODE_SELECT: &str = "/usr/bin/xcode-select";
const CLT_DIR: &str = "/Library/Developer/CommandLineTools";

pub struct XcodeCltDetector;

impl Detector for XcodeCltDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: CLT_ID,
            name: "Xcode Command Line Tools",
            category: Category::Runtimes,
            description: "git, clang, make and Homebrew need the Command Line Tools; checks they are installed and that xcode-select points to an existing directory.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        if !Path::new(XCODE_SELECT).exists() {
            return Ok(Vec::new());
        }
        let out = match ctx.run(&CommandSpec::new(XCODE_SELECT).arg("-p").timeout_ms(5_000)) {
            Ok(o) => o,
            Err(e) => {
                tracing::warn!(error = %e, "xcode-select could not run");
                return Ok(Vec::new());
            }
        };
        let uses_system_git = ctx.find_program("git").is_some_and(|p| p == Path::new("/usr/bin/git"));
        let mut issues = Vec::new();
        if out.success() {
            let dir = out.stdout.trim().to_string();
            if !dir.is_empty() && Path::new(&dir).exists() {
                return Ok(issues);
            }
            let clt_present = Path::new(CLT_DIR).exists();
            issues.push(
                IssueBuilder::new(CLT_ID, Category::Runtimes, "broken", "The developer tools directory no longer exists")
                    .severity(Severity::High)
                    .confidence(Confidence::Confirmed)
                    .description(format!(
                        "`xcode-select -p` says the active developer directory is {dir}, but that directory does not exist. This happens after an Xcode.app is deleted or renamed, or after a macOS upgrade removed the Command Line Tools."
                    ))
                    .impact("`git`, `clang`, `make`, `swift` and anything that calls `xcrun` fail with `xcrun: error: invalid active developer path`. Homebrew cannot build formulae.")
                    .evidence(format!("xcode-select -p → {dir}"))
                    .evidence(format!("{dir} does not exist"))
                    .evidence(if clt_present { format!("{CLT_DIR} exists") } else { format!("{CLT_DIR} does not exist either") })
                    .affected_command("git")
                    .affected_command("clang")
                    .affected_command("make")
                    .recommended_action(if clt_present {
                        format!("Point the tools at the Command Line Tools with `sudo xcode-select --switch {CLT_DIR}` (DevDoctor never runs sudo itself), or select an installed Xcode with `sudo xcode-select --switch /Applications/Xcode.app`.")
                    } else {
                        "Run `xcode-select --install` (macOS shows a dialog and downloads the tools; no password is needed), or install Xcode from the App Store.".to_string()
                    })
                    .metadata(json!({ "developer_dir": dir, "clt_present": clt_present }))
                    .build(),
            );
            return Ok(issues);
        }
        let stderr = out.stderr.lines().next().unwrap_or("").trim().to_string();
        issues.push(
            IssueBuilder::new(CLT_ID, Category::Runtimes, "missing", "Xcode Command Line Tools are not installed")
                .severity(if uses_system_git { Severity::High } else { Severity::Medium })
                .confidence(Confidence::Confirmed)
                .description(format!(
                    "`xcode-select -p` reports no active developer directory{}. macOS ships `git`, `clang` and `make` as small launchers that need the Command Line Tools to do anything.",
                    if uses_system_git { ", and `git` currently resolves to the system launcher /usr/bin/git" } else { "" }
                ))
                .impact("`git` opens an install dialog or fails, native extensions (npm, pip, gems) cannot compile, and Homebrew refuses to build formulae.")
                .evidence(if stderr.is_empty() { "xcode-select -p exited with an error".to_string() } else { format!("xcode-select -p: {stderr}") })
                .affected_command("git")
                .affected_command("clang")
                .affected_command("make")
                .recommended_action("Run `xcode-select --install` in a terminal: macOS downloads and installs the tools (a few hundred MB, no password needed). Homebrew and most language toolchains depend on them.")
                .metadata(json!({ "stderr": stderr }))
                .build(),
        );
        Ok(issues)
    }
}
