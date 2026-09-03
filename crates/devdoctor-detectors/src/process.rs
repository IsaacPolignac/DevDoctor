//! Stale development process detection.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::processes::dev_processes;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::units::{format_age_secs, format_bytes};
use devdoctor_core::Result;
use serde_json::json;

pub const ID: &str = "process.dev.stale";

pub struct StaleDevProcessDetector;

impl Detector for StaleDevProcessDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ID,
            name: "Stale development processes",
            category: Category::Processes,
            description: "Dev servers and scripts whose terminal is gone or whose project directory no longer exists.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let processes = ctx.platform.processes()?;
        let ports = ctx.platform.listening_ports().unwrap_or_default();
        let devs = dev_processes(ctx, &processes, &ports);
        let mut issues = Vec::new();
        for p in devs {
            let Some(reason) = p.stale_reason.clone() else { continue };
            let confidence = if p.cwd_missing { Confidence::Confirmed } else { Confidence::Likely };
            let severity = if p.memory_bytes.is_some_and(|m| m > 1_000_000_000) { Severity::Medium } else { Severity::Low };
            let where_ = p.project_path.as_ref().map(|pp| format!(" in {}", ctx.display_path(pp))).unwrap_or_default();
            let mut b = IssueBuilder::new(
                ID,
                Category::Processes,
                format!("{}:{}", p.pid, p.run_time_secs.map(|s| chrono::Utc::now().timestamp() as u64 - s).unwrap_or(0)),
                format!("Stale {} ({}){}", p.label, p.name, where_),
            )
            .severity(severity)
            .confidence(confidence)
            .description(format!(
                "Process {} (pid {}) has been running for {} and {}.",
                p.name,
                p.pid,
                p.run_time_secs.map(|s| format_age_secs(s).replace(" ago", "")).unwrap_or_else(|| "an unknown time".into()),
                reason
            ))
            .impact(format!(
                "It holds {} of memory{} and will keep running until you log out.",
                p.memory_bytes.map(format_bytes).unwrap_or_else(|| "some".into()),
                if p.ports.is_empty() {
                    String::new()
                } else {
                    format!(" and occupies port(s) {}", p.ports.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(", "))
                }
            ))
            .evidence(format!("command: {}", p.command))
            .evidence(format!("parent pid: {}", p.parent_pid.map(|x| x.to_string()).unwrap_or_else(|| "?".into())))
            .current_state(format!("pid {} running", p.pid))
            .recommended_action(if p.stoppable {
                "Stop the process (SIGTERM). If it belongs to a project you still work on, restart it from that project's terminal."
                    .to_string()
            } else {
                format!("Stop the process manually ({}).", p.not_stoppable_reason.clone().unwrap_or_default())
            });
            if let Some(cwd) = &p.cwd {
                b = b.evidence(format!("working directory: {}{}", ctx.display_path(cwd), if p.cwd_missing { " (missing)" } else { "" }));
            }
            if p.stoppable {
                b = b.fixer("process.stop_user_dev_process");
            }
            issues.push(b.metadata(json!({ "pid": p.pid, "name": p.name, "command": p.command, "cwd": p.cwd, "project_path": p.project_path, "ports": p.ports, "stoppable": p.stoppable, "run_time_secs": p.run_time_secs })).build());
        }
        Ok(issues)
    }
}
