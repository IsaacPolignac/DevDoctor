//! Stop a user-owned development process.

use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FixPreview, Fixer, ProcessRef, RiskLevel, ValidationReport};
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::time::{Duration, Instant};

pub const ID: &str = "process.stop_user_dev_process";

pub struct StopProcessFixer;

struct Target {
    pid: u32,
    name: String,
    command: String,
}

fn target(issue: &Issue) -> Result<Target> {
    let pid = issue.metadata.get("pid").and_then(|p| p.as_u64()).ok_or_else(|| Error::FixUnavailable("issue has no pid".into()))? as u32;
    Ok(Target {
        pid,
        name: issue.metadata.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
        command: issue.metadata.get("command").and_then(|n| n.as_str()).unwrap_or("").to_string(),
    })
}

/// Confirms the pid still belongs to the same program (pids are recycled).
fn verify_identity(ctx: &SystemContext, t: &Target) -> Result<Option<devdoctor_core::platform::ProcessInfo>> {
    let processes = ctx.platform.processes()?;
    let Some(p) = processes.into_iter().find(|p| p.pid == t.pid) else { return Ok(None) };
    let same_name = t.name.is_empty() || p.name.ends_with(&t.name) || t.name.ends_with(&p.name);
    let current_cmd = devdoctor_core::redact::redact_text(&p.command_line());
    let same_cmd = t.command.is_empty() || current_cmd == t.command;
    if !same_name || !same_cmd {
        return Err(Error::Validation(format!("pid {} now belongs to a different program ({}); refusing to stop it", t.pid, p.name)));
    }
    if p.user_id.is_some_and(|u| u != ctx.platform.current_uid()) {
        return Err(Error::UnsafePath(format!("pid {} is owned by another user", t.pid)));
    }
    Ok(Some(p))
}

impl Fixer for StopProcessFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Stop process"
    }

    fn supports(&self, issue: &Issue) -> bool {
        matches!(issue.detector_id.as_str(), "process.dev.stale" | "port.dev.occupied" | "manual.process.stop")
            && issue.metadata.get("stoppable").and_then(|s| s.as_bool()).unwrap_or(false)
            && issue.metadata.get("pid").is_some()
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let t = target(issue)?;
        let mut preview = FixPreview::new(
            ID,
            issue,
            format!("Stop {} (pid {})", t.name, t.pid),
            "Sends SIGTERM so the process can shut down cleanly. Nothing on disk is modified.".to_string(),
        );
        match verify_identity(ctx, &t)? {
            Some(p) => {
                preview.operations.push(format!("Send SIGTERM to pid {} ({})", p.pid, p.name));
                preview.operations.push("Wait up to 3 seconds for the process to exit".into());
                preview.processes_stopped.push(ProcessRef {
                    pid: p.pid,
                    name: p.name.clone(),
                    command: devdoctor_core::redact::redact_text(&p.command_line()),
                });
            }
            None => preview.notes.push(format!("Process {} has already exited; nothing to do.", t.pid)),
        }
        preview.risk = RiskLevel::Low;
        preview.reversible = false;
        preview.notes.push("Unsaved state inside the process (in-memory data, uncommitted work in a REPL) is lost.".into());
        preview.notes.push(
            "DevDoctor never sends SIGKILL automatically; if the process ignores SIGTERM, stop it manually with `kill -9 <pid>`.".into(),
        );
        preview.validations.push("The process is no longer running after 3 seconds.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let t = target(issue)?;
        let Some(p) = verify_identity(ctx, &t)? else {
            return Err(Error::FixUnavailable(format!("process {} has already exited", t.pid)));
        };
        tx.stop_process(p.pid, &p.name, false)?;
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(3) {
            if !ctx.platform.process_alive(p.pid) {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let t = target(issue)?;
        let mut report = ValidationReport::ok();
        let alive = ctx.platform.process_alive(t.pid);
        report.check(
            "process exited",
            !alive,
            if alive { format!("pid {} is still running after SIGTERM", t.pid) } else { format!("pid {} exited", t.pid) },
        );
        Ok(report)
    }
}
