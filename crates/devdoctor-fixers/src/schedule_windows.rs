//! Installs or removes the daily-snapshot task on Windows through `schtasks` (Task Scheduler,
//! current user, no elevation). Both directions are explicit commands recorded on the
//! transaction; a schedule is undone with `devdoctor snapshot unschedule` rather than a rollback.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FixPreview, Fixer, PlannedCommand, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::schedule::{self, TASK_NAME};
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const INSTALL_ID: &str = "schedule.snapshot_agent.install";
pub const REMOVE_ID: &str = "schedule.snapshot_agent.remove";

fn schtasks(args: &[String]) -> CommandSpec {
    CommandSpec::new(schedule::schtasks_path().to_string_lossy().into_owned()).args(args.iter().cloned()).timeout_ms(15_000)
}

struct Plan {
    program: PathBuf,
    data_dir: Option<PathBuf>,
    hour: u8,
    minute: u8,
}

fn plan(issue: &Issue) -> Result<Plan> {
    let m = &issue.metadata;
    let program =
        m.get("program").and_then(|p| p.as_str()).map(PathBuf::from).ok_or_else(|| Error::FixUnavailable("no program on issue".into()))?;
    if !fs_util::is_executable_file(&program) {
        return Err(Error::FixUnavailable(format!("{} is not an executable file", program.display())));
    }
    let hour = m.get("hour").and_then(|h| h.as_u64()).unwrap_or(12) as u8;
    let minute = m.get("minute").and_then(|h| h.as_u64()).unwrap_or(0) as u8;
    if hour > 23 || minute > 59 {
        return Err(Error::Invalid(format!("{hour:02}:{minute:02} is not a valid time of day")));
    }
    Ok(Plan { program, data_dir: m.get("data_dir").and_then(|d| d.as_str()).map(PathBuf::from), hour, minute })
}

fn create_args(p: &Plan) -> Vec<String> {
    vec![
        "/Create".into(),
        "/F".into(),
        "/SC".into(),
        "DAILY".into(),
        "/ST".into(),
        format!("{:02}:{:02}", p.hour, p.minute),
        "/TN".into(),
        TASK_NAME.into(),
        "/TR".into(),
        schedule::task_command_line(&p.program, p.data_dir.as_deref()),
    ]
}

fn delete_args() -> Vec<String> {
    vec!["/Delete".into(), "/F".into(), "/TN".into(), TASK_NAME.into()]
}

pub struct InstallSnapshotTaskFixer;

impl Fixer for InstallSnapshotTaskFixer {
    fn id(&self) -> &'static str {
        INSTALL_ID
    }

    fn name(&self) -> &'static str {
        "Take a snapshot every day"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "manual.schedule.install"
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let p = plan(issue)?;
        let log = schedule::log_path(&ctx.dirs);
        let args = create_args(&p);
        let mut preview = FixPreview::new(
            INSTALL_ID,
            issue,
            format!("Take a snapshot every day at {:02}:{:02}", p.hour, p.minute),
            format!(
                "Task Scheduler will run `devdoctor snapshot create` every day at {:02}:{:02} under your account (missed runs start as soon as the PC is back on), so \"what changed since yesterday\" always has a reference point. Snapshots record metadata only and take about a second.",
                p.hour, p.minute
            ),
        );
        let existing = schedule::task_status(ctx);
        preview.operations.push(format!(
            "schtasks {} ({} the task \"{TASK_NAME}\")",
            args.join(" "),
            if existing.is_some() { "replace" } else { "create" }
        ));
        preview.commands_executed.push(PlannedCommand {
            program: "schtasks".into(),
            args,
            description: "Register the daily task with Task Scheduler (current user, no administrator rights)".into(),
        });
        preview.risk = RiskLevel::Low;
        preview.reversible = false;
        preview.batch_safe = false;
        preview.notes.push(format!(
            "Command: {} snapshot create --label scheduled. Output goes to {}.",
            ctx.display_path(&p.program),
            ctx.display_path(&log)
        ));
        preview.notes.push("Remove it at any time with `devdoctor snapshot unschedule` (or the switch in Settings).".into());
        if p.program.components().any(|c| c.as_os_str() == "target") {
            preview.notes.push(
                "The command points into a build directory; if you rebuild or move DevDoctor, run `devdoctor snapshot schedule` again."
                    .into(),
            );
        }
        preview.validations.push(format!("Task Scheduler lists \"{TASK_NAME}\" as enabled."));
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let p = plan(issue)?;
        std::fs::create_dir_all(&ctx.dirs.logs_dir).map_err(|e| Error::io(&ctx.dirs.logs_dir, e))?;
        tx.run_command(&schtasks(&create_args(&p)), "register the daily task")?;
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        let loaded = schedule::is_loaded(ctx);
        report.check(
            "task registered",
            loaded,
            if loaded { "schtasks /Query lists the task as enabled" } else { "Task Scheduler does not list the task" },
        );
        Ok(report)
    }
}

pub struct RemoveSnapshotTaskFixer;

impl Fixer for RemoveSnapshotTaskFixer {
    fn id(&self) -> &'static str {
        REMOVE_ID
    }

    fn name(&self) -> &'static str {
        "Stop taking daily snapshots"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "manual.schedule.remove"
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        if schedule::task_status(ctx).is_none() {
            return Err(Error::FixUnavailable("no daily snapshot is scheduled".into()));
        }
        let args = delete_args();
        let mut preview = FixPreview::new(
            REMOVE_ID,
            issue,
            "Stop taking daily snapshots",
            "Deletes the DevDoctor task from Task Scheduler. Snapshots already taken are kept.",
        );
        preview.operations.push(format!("schtasks {}", args.join(" ")));
        preview.commands_executed.push(PlannedCommand { program: "schtasks".into(), args, description: "Delete the task".into() });
        preview.risk = RiskLevel::Low;
        preview.reversible = false;
        preview.validations.push("Task Scheduler no longer lists the task.".into());
        Ok(preview)
    }

    fn apply(&self, _issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        if schedule::task_status(ctx).is_some() {
            tx.run_command(&schtasks(&delete_args()), "delete the task")?;
        }
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        let exists = schedule::task_status(ctx).is_some();
        report.check("task removed", !exists, if exists { "Task Scheduler still lists the task" } else { "task removed" });
        Ok(report)
    }
}
