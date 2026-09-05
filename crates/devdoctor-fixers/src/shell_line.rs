//! Disables one startup-file line that calls a command which is no longer installed (reported
//! by the startup-errors detector). The line is commented out, never deleted; the file is backed
//! up; a fresh login shell must start without the error and with the same PATH.

use crate::util::{comment_out_lines, record_before_state, syntax_check_content, validate_shell_change, PathExpectation};
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::path_env::PathSource;
use devdoctor_core::shell::all_known_startup_files;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const ID: &str = "shell.line.comment_out";

pub struct CommentOutLineFixer;

struct Target {
    file: PathBuf,
    line: u32,
    raw: String,
    command: String,
    content: String,
}

/// Finds the statement again in the current file by its text (line numbers recorded at scan
/// time may have moved), and re-checks that the command is still missing.
fn target(issue: &Issue, ctx: &SystemContext) -> Result<Target> {
    let m = &issue.metadata;
    let file = m.get("file").and_then(|f| f.as_str()).map(PathBuf::from).ok_or_else(|| Error::FixUnavailable("no file on issue".into()))?;
    let raw = m
        .get("raw")
        .and_then(|r| r.as_str())
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .ok_or_else(|| Error::FixUnavailable("no statement text on issue".into()))?;
    let hint = m.get("line").and_then(|l| l.as_u64()).unwrap_or(0) as u32;
    let command = m.get("command").and_then(|c| c.as_str()).unwrap_or("").to_string();
    if !all_known_startup_files(&ctx.home).iter().any(|(p, _)| p == &file) {
        return Err(Error::UnsafePath(format!("{} is not a shell startup file", file.display())));
    }
    let content = fs_util::read_to_string_opt(&file)?
        .ok_or_else(|| Error::FixUnavailable(format!("{} no longer exists", ctx.display_path(&file))))?;
    let matches: Vec<u32> = content.lines().enumerate().filter(|(_, l)| l.trim() == raw).map(|(i, _)| i as u32 + 1).collect();
    let line = match matches.as_slice() {
        [] => return Err(Error::FixUnavailable(format!("{} no longer contains `{raw}`; run a new scan", ctx.display_path(&file)))),
        [only] => *only,
        many if many.contains(&hint) => hint,
        many => {
            return Err(Error::FixUnavailable(format!(
                "`{raw}` appears {} times in {}; edit the file by hand",
                many.len(),
                ctx.display_path(&file)
            )))
        }
    };
    if !command.is_empty() && ctx.find_program(&command).is_some() {
        return Err(Error::FixUnavailable(format!("`{command}` is installed again, so the line should work now; run a new scan")));
    }
    Ok(Target { file, line, raw: raw.to_string(), command, content })
}

impl Fixer for CommentOutLineFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Disable the line that calls a missing command"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.startup.errors"
            && issue.metadata.get("fixable").and_then(|v| v.as_bool()).unwrap_or(false)
            && issue.metadata.get("exclusive_line").and_then(|v| v.as_bool()).unwrap_or(false)
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let t = target(issue, ctx)?;
        let note = format!("DevDoctor: disabled because `{}` is not installed", t.command);
        let (after, changes) =
            comment_out_lines(&t.content, t.line, t.line, &note).ok_or_else(|| Error::FixUnavailable("line out of range".into()))?;
        let name = t.file.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
        if let Ok(check) = syntax_check_content(ctx, &name, after.as_bytes()) {
            if !check.passed {
                return Err(Error::Validation(format!("the rewritten {} would not parse: {}", ctx.display_path(&t.file), check.detail)));
            }
        }
        let title = format!("Disable line {} of {}", t.line, ctx.display_path(&t.file));
        let summary = format!(
            "`{}` is not installed, so this line fails and prints an error every time a terminal opens. Commenting it out removes the error without changing anything else.",
            t.command
        );
        let mut preview = FixPreview::new(ID, issue, title, summary);
        preview.operations.push(format!("{}:{}: comment out `{}`", ctx.display_path(&t.file), t.line, t.raw));
        preview.files_modified.push(FileChange::new(t.file.clone(), t.content.clone(), after, changes));
        preview.backup_created = true;
        preview.risk = RiskLevel::Low;
        preview.reversible = true;
        preview.batch_safe = true;
        preview.notes.push("The line is commented out, not deleted, so you can restore it by hand or with Undo.".into());
        preview.validations.push("The modified file passes the shell's syntax check.".into());
        preview.validations.push("A fresh login shell starts with the same PATH and no longer prints the error.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let preview = self.preview(issue, ctx)?;
        record_before_state(ctx, tx, None);
        for change in &preview.files_modified {
            tx.write_file(&change.path, change.after.as_bytes())?;
        }
        ctx.invalidate_shell_analysis();
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = validate_shell_change(ctx, tx, PathExpectation::Unchanged);
        let command = issue.metadata.get("command").and_then(|c| c.as_str()).unwrap_or("");
        let capture = ctx.shell_capture();
        if !command.is_empty() && matches!(capture.path.source, PathSource::LoginShell { .. }) {
            let still = capture
                .stderr_lines
                .iter()
                .find(|l| l.contains(&format!("command not found: {command}")) || l.contains(&format!("{command}: command not found")));
            report.check(
                "startup error gone",
                still.is_none(),
                match still {
                    None => format!("a fresh login shell no longer reports `{command}` as missing"),
                    Some(l) => format!("still printed at startup: {l}"),
                },
            );
        }
        Ok(report)
    }
}
