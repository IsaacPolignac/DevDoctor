//! Fixers for `source` statements: disable a line that sources a missing file, and disable
//! duplicated source statements. Lines are commented out (never deleted) so the user can see
//! what happened; the file is backed up first.

use crate::util::{comment_out_lines, record_before_state, syntax_check_content, validate_shell_change, PathExpectation};
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FileChange, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const COMMENT_OUT_ID: &str = "shell.source.comment_out";
pub const REMOVE_DUPLICATE_ID: &str = "shell.source.remove_duplicate";

struct Target {
    file: PathBuf,
    line: u32,
    raw: String,
}

/// Reads the file and verifies the recorded statement is still on the recorded line.
fn current_content(ctx: &SystemContext, t: &Target) -> Result<String> {
    let content = fs_util::read_to_string_opt(&t.file)?
        .ok_or_else(|| Error::FixUnavailable(format!("{} no longer exists", ctx.display_path(&t.file))))?;
    let actual = content.lines().nth(t.line as usize - 1).unwrap_or("").trim();
    if actual != t.raw.trim() {
        return Err(Error::FixUnavailable(format!(
            "{}:{} changed since the scan (expected `{}`, found `{}`); run a new scan",
            ctx.display_path(&t.file),
            t.line,
            t.raw.trim(),
            actual
        )));
    }
    if actual.trim_start().starts_with('#') {
        return Err(Error::FixUnavailable("the line is already commented out".into()));
    }
    Ok(content)
}

fn preview_comment(
    fixer_id: &str,
    issue: &Issue,
    ctx: &SystemContext,
    targets: &[Target],
    note: &str,
    title: String,
    summary: String,
) -> Result<FixPreview> {
    let mut preview = FixPreview::new(fixer_id, issue, title, summary);
    // Group by file, apply bottom-up so line numbers stay valid.
    let mut files: std::collections::BTreeMap<PathBuf, Vec<&Target>> = std::collections::BTreeMap::new();
    for t in targets {
        files.entry(t.file.clone()).or_default().push(t);
    }
    for (file, mut ts) in files {
        ts.sort_by_key(|t| std::cmp::Reverse(t.line));
        let original = current_content(ctx, ts[0])?;
        let mut content = original.clone();
        let mut all_changes = Vec::new();
        for t in ts {
            current_content(ctx, t)?;
            let (next, changes) =
                comment_out_lines(&content, t.line, t.line, note).ok_or_else(|| Error::FixUnavailable("line out of range".into()))?;
            content = next;
            all_changes.extend(changes);
            preview.operations.push(format!("{}:{}: comment out `{}`", ctx.display_path(&file), t.line, t.raw.trim()));
        }
        let name = file.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
        if let Ok(check) = syntax_check_content(ctx, &name, content.as_bytes()) {
            if !check.passed {
                return Err(Error::Validation(format!("the rewritten {} would not parse: {}", ctx.display_path(&file), check.detail)));
            }
        }
        all_changes.sort_by_key(|c| c.line);
        preview.files_modified.push(FileChange::new(file, original, content, all_changes));
    }
    preview.backup_created = true;
    preview.risk = RiskLevel::Low;
    preview.reversible = true;
    preview.batch_safe = true;
    preview
        .notes
        .push("The line is commented out, not deleted, so you can see what was disabled and restore it by hand at any time.".into());
    preview.validations.push("The modified file passes the shell's syntax check.".into());
    preview
        .validations
        .push("A fresh login shell starts and its PATH is unchanged; otherwise the backup is restored automatically.".into());
    Ok(preview)
}

fn apply_comment(ctx: &SystemContext, tx: &mut TxBuilder<'_>, preview: &FixPreview) -> Result<()> {
    record_before_state(ctx, tx, None);
    for change in &preview.files_modified {
        tx.write_file(&change.path, change.after.as_bytes())?;
    }
    ctx.invalidate_shell_analysis();
    Ok(())
}

pub struct CommentOutMissingSourceFixer;

/// Locates the statement again in the *current* files: line numbers recorded at scan time go
/// stale as soon as another fix edits the same file.
fn missing_target(issue: &Issue, ctx: &SystemContext) -> Result<Target> {
    let m = &issue.metadata;
    let file = m.get("file").and_then(|f| f.as_str()).map(PathBuf::from).ok_or_else(|| Error::FixUnavailable("no file on issue".into()))?;
    let target =
        m.get("target").and_then(|t| t.as_str()).map(PathBuf::from).ok_or_else(|| Error::FixUnavailable("no target on issue".into()))?;
    ctx.invalidate_shell_analysis();
    let analysis = ctx.shell_analysis();
    let found = analysis
        .sources
        .iter()
        .find(|s| s.file == file && s.expanded.as_ref() == Some(&target) && !s.guarded && !s.conditional && !s.in_function)
        .ok_or_else(|| {
            Error::FixUnavailable(format!("{} no longer sources {}; run a new scan", ctx.display_path(&file), ctx.display_path(&target)))
        })?;
    if !found.exclusive_line {
        return Err(Error::FixUnavailable("the statement shares its line with other commands; edit it by hand".into()));
    }
    Ok(Target { file, line: found.line, raw: found.raw.clone() })
}

impl Fixer for CommentOutMissingSourceFixer {
    fn id(&self) -> &'static str {
        COMMENT_OUT_ID
    }

    fn name(&self) -> &'static str {
        "Disable the line that sources a missing file"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.source.missing_file" && issue.metadata.get("exclusive_line").and_then(|v| v.as_bool()).unwrap_or(false)
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let t = missing_target(issue, ctx)?;
        let target = issue.metadata.get("target").and_then(|x| x.as_str()).unwrap_or("the file");
        if std::path::Path::new(target).exists() {
            return Err(Error::FixUnavailable(format!("{target} exists again; nothing to disable")));
        }
        let title = format!("Disable line {} of {}", t.line, ctx.display_path(&t.file));
        let summary = format!("The line tries to load {}, which does not exist, so every new terminal prints an error. Commenting it out removes the error without changing anything else.", ctx.display_path(std::path::Path::new(target)));
        preview_comment(COMMENT_OUT_ID, issue, ctx, &[t], "DevDoctor: disabled because the sourced file does not exist", title, summary)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let preview = self.preview(issue, ctx)?;
        apply_comment(ctx, tx, &preview)
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        Ok(validate_shell_change(ctx, tx, PathExpectation::Unchanged))
    }
}

pub struct RemoveDuplicateSourceFixer;

/// All but the first current, unconditional statement sourcing the target. Recomputed from the
/// files as they are now, so batch fixes editing the same file stay correct.
fn duplicate_targets(issue: &Issue, ctx: &SystemContext) -> Result<Vec<Target>> {
    let target = issue
        .metadata
        .get("target")
        .and_then(|t| t.as_str())
        .map(PathBuf::from)
        .ok_or_else(|| Error::FixUnavailable("no target on issue".into()))?;
    ctx.invalidate_shell_analysis();
    let analysis = ctx.shell_analysis();
    let refs: Vec<_> =
        analysis.sources.iter().filter(|s| s.expanded.as_ref() == Some(&target) && !s.conditional && !s.in_function).collect();
    if refs.len() < 2 {
        return Err(Error::FixUnavailable(format!("{} is no longer sourced more than once; run a new scan", ctx.display_path(&target))));
    }
    let targets: Vec<Target> = refs
        .iter()
        .skip(1)
        .filter(|s| s.exclusive_line)
        .map(|s| Target { file: s.file.clone(), line: s.line, raw: s.raw.clone() })
        .collect();
    if targets.is_empty() {
        return Err(Error::FixUnavailable("the duplicated statements share their lines with other commands; edit them by hand".into()));
    }
    Ok(targets)
}

impl Fixer for RemoveDuplicateSourceFixer {
    fn id(&self) -> &'static str {
        REMOVE_DUPLICATE_ID
    }

    fn name(&self) -> &'static str {
        "Disable duplicated source statements"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.source.duplicate"
            && issue
                .metadata
                .get("references")
                .and_then(|r| r.as_array())
                .is_some_and(|refs| refs.iter().skip(1).any(|r| r.get("exclusive_line").and_then(|v| v.as_bool()).unwrap_or(false)))
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let targets = duplicate_targets(issue, ctx)?;
        let target = issue.metadata.get("target").and_then(|x| x.as_str()).unwrap_or("the file");
        let title = format!("Disable {} duplicated source statement{}", targets.len(), if targets.len() == 1 { "" } else { "s" });
        let summary = format!(
            "{} is loaded more than once at startup. The first statement is kept; the later one{} commented out.",
            ctx.display_path(std::path::Path::new(target)),
            if targets.len() == 1 { " is" } else { "s are" }
        );
        preview_comment(
            REMOVE_DUPLICATE_ID,
            issue,
            ctx,
            &targets,
            "DevDoctor: disabled duplicate (the file is already sourced above)",
            title,
            summary,
        )
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let preview = self.preview(issue, ctx)?;
        apply_comment(ctx, tx, &preview)
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        Ok(validate_shell_change(ctx, tx, PathExpectation::Unchanged))
    }
}
