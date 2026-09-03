//! Startup services: Homebrew services and developer launch agents.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::platform::{ServiceKind, ServiceOrigin};
use devdoctor_core::Result;
use serde_json::json;

pub const BREW_ID: &str = "service.brew.running";
pub const BROKEN_ID: &str = "service.launchagent.broken";

pub struct BrewServiceDetector;

impl Detector for BrewServiceDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: BREW_ID,
            name: "Homebrew services",
            category: Category::Services,
            description: "Services registered with `brew services` that start at login.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let services = ctx.platform.services()?;
        let mut issues = Vec::new();
        for s in services.iter().filter(|s| s.origin == ServiceOrigin::HomebrewServices) {
            let formula = s.label.trim_start_matches("homebrew.mxcl.").to_string();
            if s.target_exists == Some(false) {
                issues.push(
                    IssueBuilder::new(BREW_ID, Category::Services, format!("broken:{}", s.label), format!("Homebrew service {formula} points to a program that no longer exists"))
                        .severity(Severity::Medium)
                        .confidence(Confidence::Confirmed)
                        .description(format!("{} starts {} at login, but that file is missing (the formula was probably uninstalled without `brew services stop`).", ctx.display_path(&s.plist_path), s.program.as_ref().map(|p| p.display().to_string()).unwrap_or_default()))
                        .impact("launchd retries the job at every login and logs errors; the service itself never runs.")
                        .evidence(format!("{} exists", ctx.display_path(&s.plist_path)))
                        .evidence(format!("{} is missing", s.program.as_ref().map(|p| p.display().to_string()).unwrap_or_default()))
                        .affected_file(s.plist_path.clone(), None, None)
                        .recommended_action(format!("Run `brew services stop {formula}` (removes the launch agent) or delete {} and run `launchctl bootout gui/$(id -u) {}`.", ctx.display_path(&s.plist_path), ctx.display_path(&s.plist_path)))
                        .metadata(json!(s))
                        .build(),
                );
                continue;
            }
            let running = s.running_pid.is_some();
            if s.run_at_load || s.keep_alive || running {
                issues.push(
                    IssueBuilder::new(BREW_ID, Category::Services, s.label.clone(), format!("{formula} starts at login{}", if running { format!(" and is running (pid {})", s.running_pid.unwrap_or(0)) } else if s.loaded == Some(false) { " but is not loaded right now".into() } else { String::new() }))
                        .severity(Severity::Info)
                        .confidence(Confidence::Confirmed)
                        .description(format!("`brew services` registered {formula} through {}.", ctx.display_path(&s.plist_path)))
                        .impact("Informational: background services use memory and ports even when you are not working on the project that needs them.")
                        .evidence(format!("RunAtLoad={} KeepAlive={} pid={}", s.run_at_load, s.keep_alive, s.running_pid.map(|p| p.to_string()).unwrap_or_else(|| "-".into())))
                        .affected_file(s.plist_path.clone(), None, None)
                        .recommended_action(format!("If you no longer need it at login: `brew services stop {formula}`. To run it only when needed: `brew services run {formula}`."))
                        .metadata(json!(s))
                        .build(),
                );
            }
        }
        Ok(issues)
    }
}

pub struct BrokenLaunchAgentDetector;

impl Detector for BrokenLaunchAgentDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: BROKEN_ID,
            name: "Broken launch agents",
            category: Category::Services,
            description: "User launch agents whose program is missing or that keep failing.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let services = ctx.platform.services()?;
        let mut issues = Vec::new();
        for s in services
            .iter()
            .filter(|s| s.origin != ServiceOrigin::HomebrewServices && s.origin != ServiceOrigin::Apple && s.kind != ServiceKind::Daemon)
        {
            if s.target_exists == Some(false) {
                issues.push(
                    IssueBuilder::new(BROKEN_ID, Category::Services, format!("missing:{}", s.label), format!("Launch agent {} points to a missing program", s.label))
                        .severity(Severity::Medium)
                        .confidence(Confidence::Confirmed)
                        .description(format!("{} would start {} at login, but that file does not exist. The application was probably uninstalled by dragging it to the Trash.", ctx.display_path(&s.plist_path), s.program.as_ref().map(|p| p.display().to_string()).unwrap_or_default()))
                        .impact("launchd retries and logs errors at every login; nothing useful runs.")
                        .evidence(format!("{} is missing", s.program.as_ref().map(|p| p.display().to_string()).unwrap_or_default()))
                        .affected_file(s.plist_path.clone(), None, None)
                        .recommended_action(format!("Unload and delete the agent: `launchctl bootout gui/$(id -u) {}` then remove the file.", ctx.display_path(&s.plist_path)))
                        .metadata(json!(s))
                        .build(),
                );
            } else if s.keep_alive && s.running_pid.is_none() && s.last_exit_status.is_some_and(|c| c != 0) {
                issues.push(
                    IssueBuilder::new(
                        BROKEN_ID,
                        Category::Services,
                        format!("failing:{}", s.label),
                        format!("Launch agent {} keeps failing (exit status {})", s.label, s.last_exit_status.unwrap_or(0)),
                    )
                    .severity(Severity::Low)
                    .confidence(Confidence::Likely)
                    .description(format!(
                        "{} is configured with KeepAlive and its last run exited with status {}. launchd keeps restarting it.",
                        ctx.display_path(&s.plist_path),
                        s.last_exit_status.unwrap_or(0)
                    ))
                    .impact("Wasted CPU and log noise; whatever the agent was supposed to do is not happening.")
                    .affected_file(s.plist_path.clone(), None, None)
                    .recommended_action("Check the agent's logs (see StandardErrorPath in the plist) or unload it if the tool is gone.")
                    .metadata(json!(s))
                    .build(),
                );
            }
        }
        Ok(issues)
    }
}
