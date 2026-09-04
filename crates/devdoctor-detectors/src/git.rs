//! Git configuration detectors (global config only; never credentials).

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::git;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;

pub const ID: &str = "git.identity";

pub struct GitIdentityDetector;

impl Detector for GitIdentityDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ID,
            name: "Git identity and global config",
            category: Category::Git,
            description: "Missing user.name / user.email and dangling paths in the global Git configuration.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let report = git::report(ctx);
        let mut issues = Vec::new();
        if report.git.is_none() {
            return Ok(issues);
        }
        let config = report.config_files.first().cloned().unwrap_or_else(|| ctx.home.join(".gitconfig"));
        if report.user_name.is_none() || report.user_email.is_none() {
            let missing: Vec<&str> = [("user.name", report.user_name.is_none()), ("user.email", report.user_email.is_none())]
                .iter()
                .filter(|(_, m)| *m)
                .map(|(k, _)| *k)
                .collect();
            issues.push(
                IssueBuilder::new(ID, Category::Git, "identity", format!("Git identity is incomplete: {} not set", missing.join(" and ")))
                    .severity(Severity::Low)
                    .confidence(Confidence::Confirmed)
                    .description("Git needs a name and an email for every commit. Without a global setting, Git guesses one from the machine name or refuses to commit.")
                    .impact("Commits attributed to a wrong or ugly identity, and pushes rejected by forges that verify emails.")
                    .evidence(format!("{} has no {}", ctx.display_path(&config), missing.join("/")))
                    .affected_file(config.clone(), None, None)
                    .recommended_action("Run `git config --global user.name \"Your Name\"` and `git config --global user.email you@example.com`.")
                    .metadata(json!({ "missing": missing }))
                    .build(),
            );
        }
        if let Some(excludes) = &report.excludes_file {
            if !report.excludes_file_exists {
                issues.push(
                    IssueBuilder::new(ID, Category::Git, "excludes", "Global gitignore file is missing")
                        .severity(Severity::Low)
                        .confidence(Confidence::Confirmed)
                        .description(format!("core.excludesfile points to {} which does not exist.", ctx.display_path(excludes)))
                        .impact("Files you expect to be ignored everywhere (.DS_Store, editor folders) show up as untracked.")
                        .evidence(format!("core.excludesfile = {}", ctx.display_path(excludes)))
                        .affected_file(config.clone(), None, None)
                        .recommended_action(format!("Create {} (for example with `.DS_Store` in it) or remove the setting with `git config --global --unset core.excludesfile`.", ctx.display_path(excludes)))
                        .metadata(json!({ "excludes_file": excludes }))
                        .build(),
                );
            }
        }
        Ok(issues)
    }
}
