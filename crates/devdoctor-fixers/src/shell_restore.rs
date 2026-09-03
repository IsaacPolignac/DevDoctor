//! Restore a startup file from a DevDoctor backup when it no longer parses.

use crate::util::{syntax_check, syntax_check_content};
use devdoctor_core::backup::{BackupRecord, BackupStore};
use devdoctor_core::context::SystemContext;
use devdoctor_core::db::Database;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const ID: &str = "shell.restore_backup";

pub struct RestoreBackupFixer;

fn issue_file(issue: &Issue) -> Option<PathBuf> {
    issue.metadata.get("file").and_then(|f| f.as_str()).map(PathBuf::from).or_else(|| issue.affected_files.first().map(|f| f.path.clone()))
}

/// The newest backup of the file whose content parses.
fn usable_backup(ctx: &SystemContext, file: &PathBuf) -> Result<Option<(BackupRecord, Vec<u8>)>> {
    let db = Database::open(&ctx.dirs.db_path)?;
    let store = BackupStore::new(ctx.dirs.backups_dir.clone());
    let target = std::fs::canonicalize(file).unwrap_or(file.clone());
    let mut records = db.backups_for_file(&target)?;
    records.extend(db.backups_for_file(file)?);
    let name = file.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    for rec in records {
        let Ok(content) = store.read(&rec) else { continue };
        match syntax_check_content(ctx, &name, &content) {
            Ok(check) if check.passed => return Ok(Some((rec, content))),
            _ => continue,
        }
    }
    Ok(None)
}

impl Fixer for RestoreBackupFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Restore file from DevDoctor backup"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.zsh.syntax"
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let file = issue_file(issue).ok_or_else(|| Error::FixUnavailable("no file recorded on the issue".into()))?;
        let Some((record, content)) = usable_backup(ctx, &file)? else {
            return Err(Error::FixUnavailable(format!(
                "DevDoctor has no backup of {} that parses correctly. Fix the file by hand.",
                ctx.display_path(&file)
            )));
        };
        let current = std::fs::read_to_string(&file).unwrap_or_default();
        let restored = String::from_utf8_lossy(&content).into_owned();
        let mut preview = FixPreview::new(
            ID,
            issue,
            format!("Restore {} from the backup taken {}", ctx.display_path(&file), record.created_at.format("%Y-%m-%d %H:%M")),
            format!("The current file does not parse. DevDoctor keeps a copy of {} from before it last modified the file; that copy parses and can be put back.", ctx.display_path(&file)),
        );
        preview.operations.push(format!("Back up the current (broken) {}", ctx.display_path(&file)));
        preview.operations.push(format!("Write the {} bytes of backup {} to {}", record.size, record.id, ctx.display_path(&file)));
        preview.files_modified.push(FileChange::new(file.clone(), current, restored, Vec::new()));
        preview.backup_created = true;
        preview.risk = RiskLevel::Medium;
        preview.reversible = true;
        preview.notes.push(format!(
            "Any edits made to the file after {} will be lost from the live file (they remain in the backup of the current version).",
            record.created_at.format("%Y-%m-%d %H:%M")
        ));
        preview.validations.push("The restored file passes the shell's syntax check.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let file = issue_file(issue).ok_or_else(|| Error::FixUnavailable("no file recorded on the issue".into()))?;
        let (record, content) = usable_backup(ctx, &file)?.ok_or_else(|| Error::FixUnavailable("no usable backup".into()))?;
        tx.note(format!("restored from backup {}", record.id));
        tx.write_file(&file, &content)?;
        ctx.invalidate_shell_analysis();
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        if let Some(file) = issue_file(issue) {
            report.checks.push(syntax_check(ctx, &file));
        }
        Ok(report)
    }
}
