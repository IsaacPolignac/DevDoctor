//! Homebrew detectors.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::homebrew::{self, HomebrewOptions};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;

pub const HEALTH_ID: &str = "homebrew.health";
pub const DOCTOR_ID: &str = "homebrew.doctor";

pub struct HomebrewHealthDetector;

impl Detector for HomebrewHealthDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: HEALTH_ID,
            name: "Homebrew health",
            category: Category::PackageManagers,
            description: "Installation prefix, PATH visibility, broken links and duplicated versioned formulae.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = homebrew::inventory(ctx, HomebrewOptions::default());
        let mut issues = Vec::new();
        if !inv.installed {
            return Ok(issues);
        }
        let prefix = inv.prefix.clone().unwrap_or_default();
        if let Some(other) = &inv.other_prefix {
            issues.push(
                IssueBuilder::new(HEALTH_ID, Category::PackageManagers, "dual_prefix", "Two Homebrew installations found (Apple Silicon and Intel)")
                    .severity(Severity::Medium)
                    .confidence(Confidence::Confirmed)
                    .description(format!("Homebrew is installed under {} and also under {}. The second one is the prefix used by the other CPU architecture (typically left over from a Migration Assistant transfer or a Rosetta terminal).", prefix.display(), other.display()))
                    .impact("Formulae from the wrong prefix run under Rosetta, `brew` behaves differently depending on which terminal you open, and PATH order decides which `python`, `node` or `git` you get.")
                    .evidence(format!("{}/bin/brew exists", prefix.display()))
                    .evidence(format!("{}/bin/brew exists", other.display()))
                    .recommended_action(format!("Keep {} (the native prefix for this Mac). Reinstall the formulae you need there, then uninstall the other Homebrew with the official uninstall script targeting {}. DevDoctor does not do this automatically.", prefix.display(), other.display()))
                    .metadata(json!({ "prefix": prefix, "other_prefix": other }))
                    .build(),
            );
        }
        if inv.other_prefix.is_none() && ctx.os.arch == "arm64" && prefix == std::path::Path::new("/usr/local") {
            issues.push(
                IssueBuilder::new(HEALTH_ID, Category::PackageManagers, "intel_prefix", "Homebrew is the Intel build, running under Rosetta")
                    .severity(Severity::Medium)
                    .confidence(Confidence::Confirmed)
                    .description("Homebrew lives under /usr/local, the prefix of the Intel build. This Mac has an Apple Silicon processor, where Homebrew's native prefix is /opt/homebrew. Everything installed with this Homebrew runs through Rosetta translation, typically after a Migration Assistant transfer from an Intel Mac.")
                    .impact("Formulae run slower, some no longer receive Intel bottles and must be compiled, and native tools (Node, Python, Rust) end up as x86_64 builds that cannot load Apple Silicon libraries.")
                    .evidence("/usr/local/bin/brew exists and /opt/homebrew does not")
                    .evidence(format!("architecture: {}", ctx.os.arch))
                    .recommended_action("Install the native Homebrew (the official install script puts it in /opt/homebrew), reinstall the formulae you use (`brew bundle dump` on the old one, `brew bundle` on the new one), then remove the Intel installation with Homebrew's uninstall script. DevDoctor does not do this automatically.")
                    .metadata(json!({ "prefix": prefix, "expected_prefix": inv.expected_prefix }))
                    .build(),
            );
        }
        if !inv.in_path {
            let profile = match ctx.shell {
                devdoctor_core::shell::ShellKind::Bash => ctx.home.join(".bash_profile"),
                _ => ctx.home.join(".zprofile"),
            };
            issues.push(
                IssueBuilder::new(HEALTH_ID, Category::PackageManagers, "not_in_path", "Homebrew is installed but `brew` is not in PATH")
                    .fixer("shell.append_line")
                    .metadata(json!({ "prefix": prefix, "append": { "file": profile, "line": format!("eval \"$({}/bin/brew shellenv)\"", prefix.display()), "expect_path_dir": prefix.join("bin"), "comment": "Homebrew" } }))
                    .severity(Severity::High)
                    .confidence(Confidence::Confirmed)
                    .description(format!(
                        "{}/bin is not part of the PATH of a fresh login shell, so `brew` and every formula it installed are not found.",
                        prefix.display()
                    ))
                    .impact("`command not found` for brew and for tools installed with it.")
                    .evidence(format!("{}/bin/brew exists", prefix.display()))
                    .evidence("`brew` not found in the login shell PATH")
                    .affected_command("brew")
                    .recommended_action(format!(
                        "Add `eval \"$({}/bin/brew shellenv)\"` to ~/.zprofile (this is what the Homebrew installer prints at the end).",
                        prefix.display()
                    ))
                    .build(),
            );
        }
        if !inv.broken_links.is_empty() {
            let mut b = IssueBuilder::new(HEALTH_ID, Category::PackageManagers, "broken_links", format!("{} broken symlinks in Homebrew's bin/opt directories", inv.broken_links.len()))
                .severity(Severity::Medium)
                .confidence(Confidence::Confirmed)
                .description(format!("Some symlinks under {} point to files that no longer exist, usually because a formula version was deleted by hand or an upgrade was interrupted.", prefix.display()))
                .impact("Commands fail with 'No such file or directory' even though they appear in PATH.")
                .recommended_action("Run `brew doctor` and `brew cleanup`, then reinstall the affected formula (`brew reinstall <formula>`), or remove the dead links with `brew unlink <formula>`.")
                .metadata(json!({ "broken_links": inv.broken_links }));
            for l in inv.broken_links.iter().take(15) {
                b = b.evidence(format!("{} → {} (missing)", l.link.display(), l.target.display())).affected_file(
                    l.link.clone(),
                    None,
                    None,
                );
            }
            issues.push(b.build());
        }
        for group in &inv.versioned_duplicates {
            let base = group[0].split('@').next().unwrap_or(&group[0]).to_string();
            issues.push(
                IssueBuilder::new(HEALTH_ID, Category::PackageManagers, format!("versions:{base}"), format!("Homebrew has several versions of {base} installed: {}", group.join(", ")))
                    .severity(Severity::Info)
                    .confidence(Confidence::Confirmed)
                    .description(format!("Formulae {} are all installed. Only one of them is linked into {}/bin; the others take disk space and can confuse PATH-based lookups.", group.join(", "), prefix.display()))
                    .impact("Mostly disk usage and confusion; harmless if you rely on both versions on purpose.")
                    .recommended_action(format!("If you do not need the older versions, remove them with `brew uninstall <formula>` (check `brew uses --installed {}` first).", group[0]))
                    .metadata(json!({ "formulae": group }))
                    .build(),
            );
        }
        Ok(issues)
    }
}

pub struct HomebrewDoctorDetector;

impl Detector for HomebrewDoctorDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: DOCTOR_ID,
            name: "brew doctor",
            category: Category::PackageManagers,
            description: "Runs `brew doctor` (slow) and reports each warning.",
            modes: &[],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = homebrew::inventory(ctx, HomebrewOptions { with_version: false, with_cache_size: false, with_doctor: true });
        let Some(doctor) = inv.doctor else { return Ok(Vec::new()) };
        let mut issues = Vec::new();
        if let Some(err) = &doctor.error {
            tracing::warn!(error = %err, "brew doctor did not complete");
            return Err(devdoctor_core::Error::other(format!("brew doctor did not complete: {err}")));
        }
        for warning in &doctor.warnings {
            let first = warning.lines().next().unwrap_or(warning).trim();
            let mut title = first.to_string();
            if title.len() > 90 {
                title.truncate(87);
                title.push_str("...");
            }
            issues.push(
                IssueBuilder::new(DOCTOR_ID, Category::PackageManagers, first, format!("brew doctor: {title}"))
                    .severity(Severity::Low)
                    .confidence(Confidence::Likely)
                    .description("Reported by `brew doctor`. Homebrew's own advice: these warnings are just used to help maintainers with debugging if you file an issue; if everything works you can ignore them.")
                    .impact("Depends on the warning; typically affects `brew install` reliability rather than your shell.")
                    .technical(warning.clone())
                    .evidence(format!("brew doctor output ({} ms)", doctor.duration_ms))
                    .recommended_action("Follow the instructions in the technical details, then re-run `brew doctor`.")
                    .build(),
            );
        }
        Ok(issues)
    }
}
