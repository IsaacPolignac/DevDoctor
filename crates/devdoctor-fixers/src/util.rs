//! Helpers shared by fixers.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::ValidationCheck;
use std::path::Path;

/// Runs the shell parser in check mode on a file and returns a validation check.
pub fn syntax_check(ctx: &SystemContext, path: &Path) -> ValidationCheck {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let program = if name.contains("bash") || name == ".profile" { "/bin/bash" } else { "/bin/zsh" };
    let spec = CommandSpec::new(program).arg("-n").arg(path.to_string_lossy().into_owned()).timeout_ms(5_000);
    match ctx.run(&spec) {
        Ok(out) if out.success() => {
            ValidationCheck { name: format!("{} -n {}", program, ctx.display_path(path)), passed: true, detail: "syntax OK".into() }
        }
        Ok(out) => ValidationCheck {
            name: format!("{} -n {}", program, ctx.display_path(path)),
            passed: false,
            detail: out.stderr.trim().to_string(),
        },
        Err(e) => ValidationCheck { name: format!("{} -n {}", program, ctx.display_path(path)), passed: false, detail: e.to_string() },
    }
}

/// Syntax-checks content that is not on disk yet (written to a private temporary file).
pub fn syntax_check_content(ctx: &SystemContext, file_name: &str, content: &[u8]) -> Result<ValidationCheck, devdoctor_core::Error> {
    let dir = tempfile::tempdir().map_err(|e| devdoctor_core::Error::io("tempdir", e))?;
    let path = dir.path().join(file_name);
    std::fs::write(&path, content).map_err(|e| devdoctor_core::Error::io(&path, e))?;
    Ok(syntax_check(ctx, &path))
}

pub fn count_dir(entries: &[String], dir: &str) -> usize {
    let key = devdoctor_core::shell::normalize_key(dir);
    entries.iter().filter(|e| devdoctor_core::shell::normalize_key(e) == key).count()
}

use devdoctor_core::fixer::ValidationReport;
use devdoctor_core::path_env::PathSource;
use devdoctor_core::transaction::TxBuilder;
use serde_json::json;

/// What the fresh login shell's PATH must look like after a shell-file fix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathExpectation {
    /// Same directories in the same order.
    Unchanged,
    /// `dir` no longer present; everything else unchanged.
    Removed(String),
    /// `dir` appears fewer times; de-duplicated order unchanged.
    Reduced(String),
    /// `dir` now present; every other directory keeps its relative order.
    Added(String),
}

/// Records the pre-fix PATH state on the transaction (used by [`validate_shell_change`]).
pub fn record_before_state(ctx: &SystemContext, tx: &mut TxBuilder<'_>, dir: Option<&str>) {
    let capture = ctx.shell_capture();
    tx.set_state(json!({
        "dir": dir,
        "before_dedup": capture.path.dedup_order(),
        "before_count": dir.map(|d| count_dir(&capture.path.entries, d)).unwrap_or(0),
        "login_shell": matches!(capture.path.source, PathSource::LoginShell { .. }),
    }));
}

/// Syntax-checks every written file, restarts a login shell and compares its PATH with the
/// expectation. Skips the PATH comparison when the pre-fix PATH did not come from a login shell.
pub fn validate_shell_change(ctx: &SystemContext, tx: &TxBuilder<'_>, expectation: PathExpectation) -> ValidationReport {
    let mut report = ValidationReport::ok();
    for op in &tx.transaction().operations {
        if let devdoctor_core::transaction::Operation::FileWrite { path, .. } = op {
            report.checks.push(syntax_check(ctx, path));
        }
    }
    let state = tx.state().clone();
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
    let key = |d: &str| devdoctor_core::shell::normalize_key(d);
    let after_dedup = after.path.dedup_order();
    match &expectation {
        PathExpectation::Unchanged | PathExpectation::Reduced(_) => {
            let same = after_dedup == before;
            report.check(
                "PATH order preserved",
                same,
                if same {
                    format!("{} directories in the same order", after_dedup.len())
                } else {
                    format!("expected {} but got {}", before.join(":"), after_dedup.join(":"))
                },
            );
        }
        PathExpectation::Removed(dir) => {
            let expected: Vec<String> = before.iter().filter(|e| key(e) != key(dir)).cloned().collect();
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
            let count = count_dir(&after.path.entries, dir);
            report.check("directory removed from PATH", count == 0, format!("{dir} appears {count} times"));
        }
        PathExpectation::Added(dir) => {
            let rest: Vec<String> = after_dedup.iter().filter(|e| key(e) != key(dir)).cloned().collect();
            let same = rest == before;
            report.check(
                "other PATH entries preserved",
                same,
                if same {
                    format!("{} directories kept their order", rest.len())
                } else {
                    format!("expected {} but got {}", before.join(":"), rest.join(":"))
                },
            );
            let present = after.path.entries.iter().any(|e| key(e) == key(dir));
            report.check(
                "directory now in PATH",
                present,
                if present { format!("{dir} is in PATH") } else { format!("{dir} is still missing from the login shell PATH") },
            );
        }
    }
    if let PathExpectation::Reduced(dir) = &expectation {
        let count = count_dir(&after.path.entries, dir);
        report.check("duplicate count reduced", count < before_count, format!("{dir} appeared {before_count} times, now {count}"));
    }
    report
}

/// Comments out lines `line..=end_line` (1-based) of `content`, adding an explanatory comment
/// above them. Returns the new content and the line changes for the preview.
pub fn comment_out_lines(content: &str, line: u32, end_line: u32, note: &str) -> Option<(String, Vec<devdoctor_core::fixer::LineChange>)> {
    use devdoctor_core::fixer::{LineChange, LineChangeKind};
    let had_newline = content.ends_with('\n');
    let mut lines: Vec<String> = content.split('\n').map(|s| s.to_string()).collect();
    if had_newline {
        lines.pop();
    }
    let start = line.checked_sub(1)? as usize;
    let end = end_line.checked_sub(1)? as usize;
    if end >= lines.len() || start > end {
        return None;
    }
    let mut changes = Vec::new();
    let mut replacement = vec![format!("# {note}")];
    for (offset, original) in lines[start..=end].iter().enumerate() {
        let commented = format!("# {original}");
        changes.push(LineChange {
            line: (start + offset + 1) as u32,
            kind: LineChangeKind::Changed,
            before: Some(original.clone()),
            after: Some(commented.clone()),
        });
        replacement.push(commented);
    }
    lines.splice(start..=end, replacement);
    let mut out = lines.join("\n");
    if had_newline || out.is_empty() {
        out.push('\n');
    }
    Some((out, changes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comments_out_a_range() {
        let (out, changes) = comment_out_lines("a\nsource x\nb\n", 2, 2, "disabled by DevDoctor").unwrap();
        assert_eq!(out, "a\n# disabled by DevDoctor\n# source x\nb\n");
        assert_eq!(changes.len(), 1);
        assert!(comment_out_lines("a\n", 5, 5, "x").is_none());
    }
}
