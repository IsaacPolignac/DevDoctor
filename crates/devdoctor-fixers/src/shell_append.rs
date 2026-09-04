//! Appends one line to a startup file (e.g. the rustup or Homebrew initialisation line) and
//! verifies that the expected directory then appears in a fresh login shell's PATH.

use crate::util::{record_before_state, syntax_check_content, validate_shell_change, PathExpectation};
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, LineChange, LineChangeKind, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::shell::all_known_startup_files;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const ID: &str = "shell.append_line";

pub struct AppendLineFixer;

struct Plan {
    file: PathBuf,
    line: String,
    expect_dir: Option<String>,
    comment: String,
}

fn plan(issue: &Issue, ctx: &SystemContext) -> Result<Plan> {
    let a = issue.metadata.get("append").ok_or_else(|| Error::FixUnavailable("issue has no append instruction".into()))?;
    let file = a.get("file").and_then(|f| f.as_str()).map(PathBuf::from).ok_or_else(|| Error::FixUnavailable("no file".into()))?;
    let line = a.get("line").and_then(|l| l.as_str()).map(str::to_string).ok_or_else(|| Error::FixUnavailable("no line".into()))?;
    if line.contains('\n') || line.trim().is_empty() {
        return Err(Error::Invalid("the line to append must be a single non-empty line".into()));
    }
    if !all_known_startup_files(&ctx.home).iter().any(|(p, _)| p == &file) {
        return Err(Error::UnsafePath(format!("{} is not a shell startup file", file.display())));
    }
    Ok(Plan {
        file,
        line,
        expect_dir: a.get("expect_path_dir").and_then(|d| d.as_str()).map(str::to_string),
        comment: a.get("comment").and_then(|c| c.as_str()).unwrap_or("Added by DevDoctor").to_string(),
    })
}

fn new_content(original: &str, p: &Plan) -> String {
    let mut out = original.to_string();
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
    if !out.is_empty() {
        out.push('\n');
    }
    out.push_str(&format!("# {} (added by DevDoctor)\n{}\n", p.comment, p.line));
    out
}

impl Fixer for AppendLineFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Add a line to a startup file"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.metadata.get("append").and_then(|a| a.get("line")).is_some()
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let p = plan(issue, ctx)?;
        let original = fs_util::read_to_string_opt(&p.file)?.unwrap_or_default();
        if original.lines().any(|l| l.trim() == p.line.trim()) {
            return Err(Error::FixUnavailable(format!(
                "{} already contains that line; open a new terminal or re-run the scan",
                ctx.display_path(&p.file)
            )));
        }
        let updated = new_content(&original, &p);
        let name = p.file.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
        if let Ok(check) = syntax_check_content(ctx, &name, updated.as_bytes()) {
            if !check.passed {
                return Err(Error::Validation(format!("the resulting file would not parse: {}", check.detail)));
            }
        }
        let first_new_line = original.lines().count() as u32 + 1;
        let mut preview = FixPreview::new(
            ID,
            issue,
            format!("Add `{}` to {}", p.line, ctx.display_path(&p.file)),
            format!(
                "Appends one line at the end of {} so that every new terminal runs it.{}",
                ctx.display_path(&p.file),
                if original.is_empty() { " The file will be created." } else { "" }
            ),
        );
        preview.operations.push(format!("{}: append `{}`", ctx.display_path(&p.file), p.line));
        preview.files_modified.push(FileChange::new(
            p.file.clone(),
            original,
            updated,
            vec![LineChange { line: first_new_line, kind: LineChangeKind::Added, before: None, after: Some(p.line.clone()) }],
        ));
        preview.backup_created = true;
        preview.risk = RiskLevel::Low;
        preview.reversible = true;
        preview.batch_safe = false;
        preview.notes.push("Existing lines are not modified. Open a new terminal window afterwards to see the effect.".into());
        preview.validations.push("The modified file passes the shell's syntax check.".into());
        if let Some(d) = &p.expect_dir {
            preview.validations.push(format!(
                "A fresh login shell now has {} in PATH and every other directory keeps its order; otherwise the file is restored.",
                ctx.display_path(std::path::Path::new(d))
            ));
        }
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let p = plan(issue, ctx)?;
        record_before_state(ctx, tx, p.expect_dir.as_deref());
        let original = fs_util::read_to_string_opt(&p.file)?.unwrap_or_default();
        tx.write_file(&p.file, new_content(&original, &p).as_bytes())?;
        ctx.invalidate_shell_analysis();
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let p = plan(issue, ctx)?;
        Ok(validate_shell_change(
            ctx,
            tx,
            match p.expect_dir {
                Some(d) => PathExpectation::Added(d),
                None => PathExpectation::Unchanged,
            },
        ))
    }
}
