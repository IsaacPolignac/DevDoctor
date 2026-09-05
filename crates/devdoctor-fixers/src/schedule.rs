//! Installs or removes the daily-snapshot LaunchAgent. The plist is written through the
//! transaction builder (backed up when it already exists) and launchd is told about it with
//! `launchctl`; both directions are explicit commands, so a schedule is undone with
//! `devdoctor snapshot unschedule` rather than a transaction rollback.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, PlannedCommand, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::schedule::{self, service_target, AGENT_LABEL};
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const INSTALL_ID: &str = "schedule.snapshot_agent.install";
pub const REMOVE_ID: &str = "schedule.snapshot_agent.remove";

fn launchctl(args: &[&str]) -> CommandSpec {
    CommandSpec::new("/bin/launchctl").args(args.iter().map(|a| a.to_string())).timeout_ms(10_000)
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

pub struct InstallSnapshotAgentFixer;

impl Fixer for InstallSnapshotAgentFixer {
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
        let plist_path = schedule::agent_plist_path(&ctx.home);
        let log = schedule::log_path(&ctx.dirs);
        let content = schedule::build_plist(&p.program, p.data_dir.as_deref(), p.hour, p.minute, &log);
        let before = fs_util::read_to_string_opt(&plist_path)?.unwrap_or_default();
        let uid = ctx.platform.current_uid();
        let target = service_target(uid);
        let mut preview = FixPreview::new(
            INSTALL_ID,
            issue,
            format!("Take a snapshot every day at {:02}:{:02}", p.hour, p.minute),
            format!(
                "macOS will run `devdoctor snapshot create` every day at {:02}:{:02} (or as soon as the Mac wakes up afterwards), so \"what changed since yesterday\" always has a reference point. Snapshots record metadata only and take about a second.",
                p.hour, p.minute
            ),
        );
        preview.operations.push(format!("{} {}", if before.is_empty() { "Create" } else { "Rewrite" }, ctx.display_path(&plist_path)));
        if schedule::is_loaded(ctx) {
            preview.operations.push(format!("launchctl bootout {target} (reload the existing agent)"));
            preview.commands_executed.push(PlannedCommand {
                program: "launchctl".into(),
                args: vec!["bootout".into(), target.clone()],
                description: "Unload the previous version of the agent".into(),
            });
        }
        preview.operations.push(format!("launchctl bootstrap gui/{uid} {}", ctx.display_path(&plist_path)));
        preview.commands_executed.push(PlannedCommand {
            program: "launchctl".into(),
            args: vec!["bootstrap".into(), format!("gui/{uid}"), plist_path.to_string_lossy().into_owned()],
            description: "Tell launchd about the agent so it runs without a new login".into(),
        });
        preview.files_modified.push(FileChange::new(plist_path.clone(), before.clone(), content, Vec::new()));
        preview.backup_created = !before.is_empty();
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
        preview.validations.push(format!("launchd reports {AGENT_LABEL} as loaded."));
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let preview = self.preview(issue, ctx)?;
        let plist_path = schedule::agent_plist_path(&ctx.home);
        if let Some(parent) = plist_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| Error::io(parent, e))?;
        }
        for change in &preview.files_modified {
            tx.write_file(&change.path, change.after.as_bytes())?;
        }
        let uid = ctx.platform.current_uid();
        if schedule::is_loaded(ctx) {
            tx.run_command(&launchctl(&["bootout", &service_target(uid)]), "unload the previous agent")?;
        }
        tx.run_command(&launchctl(&["bootstrap", &format!("gui/{uid}"), &plist_path.to_string_lossy()]), "load the agent")?;
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        let loaded = schedule::is_loaded(ctx);
        report.check(
            "agent loaded",
            loaded,
            if loaded {
                format!("launchctl print {} succeeds", service_target(ctx.platform.current_uid()))
            } else {
                "launchd does not list the agent".to_string()
            },
        );
        Ok(report)
    }
}

pub struct RemoveSnapshotAgentFixer;

impl Fixer for RemoveSnapshotAgentFixer {
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
        let plist_path = schedule::agent_plist_path(&ctx.home);
        let loaded = schedule::is_loaded(ctx);
        let exists = plist_path.exists();
        if !loaded && !exists {
            return Err(Error::FixUnavailable("no daily snapshot is scheduled".into()));
        }
        let target = service_target(ctx.platform.current_uid());
        let mut preview = FixPreview::new(
            REMOVE_ID,
            issue,
            "Stop taking daily snapshots",
            "Unloads the DevDoctor agent from launchd and removes its file. Snapshots already taken are kept.",
        );
        if loaded {
            preview.operations.push(format!("launchctl bootout {target}"));
            preview.commands_executed.push(PlannedCommand {
                program: "launchctl".into(),
                args: vec!["bootout".into(), target],
                description: "Unload the agent".into(),
            });
        }
        if exists {
            preview.operations.push(format!("Delete {}", ctx.display_path(&plist_path)));
            preview.files_deleted.push(plist_path);
            preview.backup_created = true;
        }
        preview.risk = RiskLevel::Low;
        preview.reversible = false;
        preview.validations.push("launchd no longer lists the agent and the file is gone.".into());
        Ok(preview)
    }

    fn apply(&self, _issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let plist_path = schedule::agent_plist_path(&ctx.home);
        if schedule::is_loaded(ctx) {
            tx.run_command(&launchctl(&["bootout", &service_target(ctx.platform.current_uid())]), "unload the agent")?;
        }
        if plist_path.exists() {
            tx.delete_file(&plist_path)?;
        }
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        let loaded = schedule::is_loaded(ctx);
        report.check("agent unloaded", !loaded, if loaded { "launchd still lists the agent" } else { "launchd no longer lists the agent" });
        let exists = schedule::agent_plist_path(&ctx.home).exists();
        report.check("agent file removed", !exists, if exists { "file still present" } else { "file removed" });
        Ok(report)
    }
}
