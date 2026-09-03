//! Safe PATH fixers: remove redundant duplicate statements and dead directories.

use crate::util::{count_dir, syntax_check, syntax_check_content};
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::issue::Issue;
use devdoctor_core::path_env::PathSource;
use devdoctor_core::shell::{apply_removals, plan_duplicate_removals, FileEdit, Removal};
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use serde_json::json;

pub const REMOVE_DUPLICATE_ID: &str = "shell.path.remove_duplicate";
pub const REMOVE_MISSING_ID: &str = "shell.path.remove_missing_directory";

fn issue_dir(issue: &Issue) -> Result<String> {
    issue
        .metadata
        .get("dir")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| Error::FixUnavailable("issue has no directory information".into()))
}

/// Recomputes the edits against the files as they are *now* (not as they were at scan time).
fn duplicate_edits(ctx: &SystemContext, dir: &str) -> Result<(Vec<FileEdit>, Vec<String>, Vec<String>)> {
    ctx.invalidate_shell_analysis();
    let analysis = ctx.shell_analysis();
    let plan = plan_duplicate_removals(&analysis.mutations, &analysis.initial_path, dir);
    if plan.removals.is_empty() {
        return Err(Error::FixUnavailable(format!(
            "no redundant statement adding {dir} can be removed safely (the files may have changed since the scan)"
        )));
    }
    let (edits, skipped) = apply_removals(&analysis.contents(), &analysis.mutations, &plan.removals);
    let mut notes = Vec::new();
    if let Some(keep) = &plan.keep {
        let m = &analysis.mutations[keep.mutation_index];
        notes.push(format!(
            "Kept {}:{} — it determines where {} sits in PATH.",
            ctx.display_path(&m.file),
            m.line,
            ctx.display_path(std::path::Path::new(dir))
        ));
    } else if plan.kept_by_initial_path {
        notes.push(format!("{} stays in PATH through the system default (/etc/paths).", ctx.display_path(std::path::Path::new(dir))));
    }
    Ok((edits, skipped, notes))
}

fn missing_edits(ctx: &SystemContext, dir: &str) -> Result<(Vec<FileEdit>, Vec<String>)> {
    ctx.invalidate_shell_analysis();
    let analysis = ctx.shell_analysis();
    let key = devdoctor_core::shell::normalize_key(dir);
    let mut removals = Vec::new();
    for (mi, m) in analysis.mutations.iter().enumerate() {
        if !m.is_effective() || !m.rewritable {
            continue;
        }
        for (ci, c) in m.components.iter().enumerate() {
            if c.expanded.as_ref().is_some_and(|p| p.to_string_lossy() == key) {
                removals.push(Removal { mutation_index: mi, component_index: ci });
            }
        }
    }
    if removals.is_empty() {
        return Err(Error::FixUnavailable(format!(
            "no statement adding {dir} can be edited automatically (the files may have changed since the scan)"
        )));
    }
    Ok(apply_removals(&analysis.contents(), &analysis.mutations, &removals))
}

fn preview_from_edits(
    fixer_id: &str,
    issue: &Issue,
    ctx: &SystemContext,
    edits: &[FileEdit],
    skipped: &[String],
    title: String,
    summary: String,
) -> FixPreview {
    let mut preview = FixPreview::new(fixer_id, issue, title, summary);
    for edit in edits {
        for change in &edit.line_changes {
            let loc = format!("{}:{}", ctx.display_path(&edit.path), change.line);
            match change.kind {
                devdoctor_core::fixer::LineChangeKind::Removed => {
                    preview.operations.push(format!("{loc}: remove `{}`", change.before.clone().unwrap_or_default().trim()))
                }
                devdoctor_core::fixer::LineChangeKind::Changed => preview.operations.push(format!(
                    "{loc}: change `{}` to `{}`",
                    change.before.clone().unwrap_or_default().trim(),
                    change.after.clone().unwrap_or_default().trim()
                )),
                devdoctor_core::fixer::LineChangeKind::Added => {
                    preview.operations.push(format!("{loc}: add `{}`", change.after.clone().unwrap_or_default().trim()))
                }
            }
        }
        preview.files_modified.push(FileChange::new(
            edit.path.clone(),
            edit.original.clone(),
            edit.updated.clone(),
            edit.line_changes.clone(),
        ));
    }
    for s in skipped {
        preview.notes.push(format!("Skipped: {s}"));
    }
    preview.backup_created = true;
    preview.risk = RiskLevel::Low;
    preview.reversible = true;
    preview.batch_safe = true;
    preview
        .notes
        .push("Removing a PATH statement never uninstalls software; it only stops the shell from listing the directory again.".into());
    preview.validations.push("Each modified file passes the shell's own syntax check (zsh -n / bash -n).".into());
    preview.validations.push("A fresh login shell is started and its PATH is compared with the current one; if the set or order of directories changed unexpectedly, the files are restored from backup automatically.".into());
    preview
}

fn record_before_state(ctx: &SystemContext, tx: &mut TxBuilder<'_>, dir: &str) {
    let capture = ctx.shell_capture();
    tx.set_state(json!({
        "dir": dir,
        "before_dedup": capture.path.dedup_order(),
        "before_count": count_dir(&capture.path.entries, dir),
        "login_shell": matches!(capture.path.source, PathSource::LoginShell { .. }),
    }));
}

fn validate_path_change(ctx: &SystemContext, tx: &TxBuilder<'_>, expect_removed: bool) -> ValidationReport {
    let mut report = ValidationReport::ok();
    for op in &tx.transaction().operations {
        if let devdoctor_core::transaction::Operation::FileWrite { path, .. } = op {
            report.checks.push(syntax_check(ctx, path));
        }
    }
    let state = tx.state().clone();
    let dir = state.get("dir").and_then(|d| d.as_str()).unwrap_or("");
    let before: Vec<String> = state.get("before_dedup").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default();
    let before_count = state.get("before_count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let was_login_shell = state.get("login_shell").and_then(|v| v.as_bool()).unwrap_or(false);
    if !was_login_shell {
        report.check("PATH re-verification", true, "skipped: the original PATH did not come from a login shell capture");
        return report;
    }
    let after = ctx.refresh_shell_capture();
    if !matches!(after.path.source, PathSource::LoginShell { .. }) {
        report.check(
            "login shell restart",
            false,
            format!("could not capture PATH from a fresh login shell after the change: {}", after.warnings.join("; ")),
        );
        return report;
    }
    report.check("login shell restart", true, format!("fresh login shell started in {} ms", after.duration_ms));
    let after_dedup = after.path.dedup_order();
    let expected: Vec<String> = if expect_removed {
        before.iter().filter(|e| devdoctor_core::shell::normalize_key(e) != devdoctor_core::shell::normalize_key(dir)).cloned().collect()
    } else {
        before.clone()
    };
    let same = after_dedup == expected;
    report.check(
        "PATH order preserved",
        same,
        if same {
            format!("{} directories in the same order", after_dedup.len())
        } else {
            format!("expected {} but got {}", expected.join(":"), after_dedup.join(":"))
        },
    );
    let after_count = count_dir(&after.path.entries, dir);
    if expect_removed {
        report.check("directory removed from PATH", after_count == 0, format!("{dir} appears {after_count} times"));
    } else {
        report.check(
            "duplicate count reduced",
            after_count < before_count,
            format!("{dir} appeared {before_count} times, now {after_count}"),
        );
    }
    report
}

pub struct RemoveDuplicateFixer;

impl Fixer for RemoveDuplicateFixer {
    fn id(&self) -> &'static str {
        REMOVE_DUPLICATE_ID
    }

    fn name(&self) -> &'static str {
        "Remove redundant PATH statements"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.path.duplicate"
            && issue.metadata.pointer("/plan/removals").and_then(|r| r.as_array()).is_some_and(|r| !r.is_empty())
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let dir = issue_dir(issue)?;
        let (edits, skipped, notes) = duplicate_edits(ctx, &dir)?;
        let n: usize = edits.iter().map(|e| e.line_changes.len()).sum();
        let files: Vec<String> = edits.iter().map(|e| ctx.display_path(&e.path)).collect();
        let mut preview = preview_from_edits(
            REMOVE_DUPLICATE_ID,
            issue,
            ctx,
            &edits,
            &skipped,
            format!("Remove {} redundant PATH statement{} from {}", n, if n == 1 { "" } else { "s" }, files.join(", ")),
            format!("{} is added to PATH more than once. The statement{} below only re-add{} a directory that is already there; removing {} keeps PATH order unchanged.", ctx.display_path(std::path::Path::new(&dir)), if n == 1 { "" } else { "s" }, if n == 1 { "s" } else { "" }, if n == 1 { "it" } else { "them" }),
        );
        preview.notes.extend(notes);
        for edit in &edits {
            let name = edit.path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
            if let Ok(check) = syntax_check_content(ctx, &name, edit.updated.as_bytes()) {
                if !check.passed {
                    return Err(Error::Validation(format!(
                        "the rewritten {} would not parse: {}",
                        ctx.display_path(&edit.path),
                        check.detail
                    )));
                }
            }
        }
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let dir = issue_dir(issue)?;
        record_before_state(ctx, tx, &dir);
        let (edits, _skipped, notes) = duplicate_edits(ctx, &dir)?;
        for n in notes {
            tx.note(n);
        }
        for edit in &edits {
            tx.write_file(&edit.path, edit.updated.as_bytes())?;
        }
        ctx.invalidate_shell_analysis();
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        Ok(validate_path_change(ctx, tx, false))
    }
}

pub struct RemoveMissingDirectoryFixer;

impl Fixer for RemoveMissingDirectoryFixer {
    fn id(&self) -> &'static str {
        REMOVE_MISSING_ID
    }

    fn name(&self) -> &'static str {
        "Remove non-existent directory from PATH"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.path.missing_directory"
            && issue.metadata.get("removals").and_then(|r| r.as_array()).is_some_and(|r| !r.is_empty())
            && !issue.metadata.get("nvm").and_then(|v| v.as_bool()).unwrap_or(false)
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let dir = issue_dir(issue)?;
        if std::path::Path::new(&dir).exists() {
            return Err(Error::FixUnavailable(format!("{dir} exists again; nothing to remove")));
        }
        let (edits, skipped) = missing_edits(ctx, &dir)?;
        let n: usize = edits.iter().map(|e| e.line_changes.len()).sum();
        let files: Vec<String> = edits.iter().map(|e| ctx.display_path(&e.path)).collect();
        let mut preview = preview_from_edits(
            REMOVE_MISSING_ID,
            issue,
            ctx,
            &edits,
            &skipped,
            format!("Remove {} from PATH ({} statement{} in {})", ctx.display_path(std::path::Path::new(&dir)), n, if n == 1 { "" } else { "s" }, files.join(", ")),
            format!("{} does not exist, so listing it in PATH has no effect. The change removes only that directory from the statement(s); other directories on the same line are kept.", ctx.display_path(std::path::Path::new(&dir))),
        );
        preview.notes.push("If you reinstall the tool that owned this directory, its installer will add the line again.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let dir = issue_dir(issue)?;
        record_before_state(ctx, tx, &dir);
        let (edits, _skipped) = missing_edits(ctx, &dir)?;
        for edit in &edits {
            tx.write_file(&edit.path, edit.updated.as_bytes())?;
        }
        ctx.invalidate_shell_analysis();
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        Ok(validate_path_change(ctx, tx, true))
    }
}
