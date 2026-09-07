//! Install tracking: record what a command (an installer, `brew install`, `curl | sh`) changed.
//!
//! `begin` records the environment right before the command: a full snapshot, the text of every
//! shell startup file and the names of the entries in a few directories installers like to
//! touch. `finish` records the same things afterwards and turns the two into a [`RunRecord`]:
//! the snapshot diff, unified diffs of the startup files (secrets redacted), new files and
//! applications, and runtime version changes. Nothing here mutates the machine.

use crate::context::SystemContext;
use crate::fixer::unified_diff;
use crate::fs_util;
use crate::ids::random_id;
use crate::inventory::storage::StorageReport;
use crate::redact::redact_text;
use crate::shell::all_known_startup_files;
use crate::snapshot::{self, Snapshot, SnapshotDiff, SnapshotOptions};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
}

/// A startup file the command touched, with a redacted unified diff.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedFileDiff {
    pub path: PathBuf,
    pub kind: FileChangeKind,
    pub diff: String,
    pub lines_added: usize,
    pub lines_removed: usize,
}

/// Entries that appeared in or disappeared from a watched directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryChanges {
    pub dir: PathBuf,
    pub added: Vec<String>,
    pub removed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionChange {
    pub command: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    /// The exact argument vector that was executed.
    pub command: Vec<String>,
    /// Display form of the command.
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub duration_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    pub before_snapshot_id: String,
    pub after_snapshot_id: String,
    pub diff: SnapshotDiff,
    pub file_diffs: Vec<TrackedFileDiff>,
    pub directory_changes: Vec<DirectoryChanges>,
    pub version_changes: Vec<VersionChange>,
    /// Short lines summarising the run, e.g. "2 packages added", "~/.zshrc modified (+3 lines)".
    pub headline: Vec<String>,
}

impl RunRecord {
    pub fn changed_anything(&self) -> bool {
        !self.diff.changes.is_empty()
            || !self.file_diffs.is_empty()
            || self.directory_changes.iter().any(|d| !d.added.is_empty() || !d.removed.is_empty())
            || !self.version_changes.is_empty()
    }
}

/// Everything captured before the command runs.
pub struct TrackingState {
    pub started_at: DateTime<Utc>,
    pub before: Snapshot,
    files: BTreeMap<PathBuf, Option<String>>,
    listings: BTreeMap<PathBuf, BTreeSet<String>>,
}

/// Directories whose entry names are compared before and after (names only, never contents).
pub fn watched_directories(ctx: &SystemContext) -> Vec<PathBuf> {
    let mut dirs = vec![ctx.home.clone(), ctx.home.join(".config"), ctx.home.join(".local/bin"), ctx.home.join(".cargo/bin")];
    if cfg!(windows) {
        let env = |name: &str| ctx.env.get(name).map(PathBuf::from);
        if let Some(appdata) = env("APPDATA") {
            dirs.push(appdata.join("npm"));
            dirs.push(appdata.join("Microsoft").join("Windows").join("Start Menu").join("Programs").join("Startup"));
        }
        if let Some(local) = env("LOCALAPPDATA") {
            dirs.push(local.join("Programs"));
            dirs.push(local.join("Microsoft").join("WindowsApps"));
        }
        for var in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(pf) = env(var) {
                dirs.push(pf);
            }
        }
        if let Some(pd) = env("ProgramData") {
            dirs.push(pd.join("chocolatey").join("lib"));
        }
        dirs.push(ctx.home.join("scoop").join("apps"));
    } else {
        dirs.push(ctx.home.join("Library/LaunchAgents"));
        dirs.push(ctx.home.join("Applications"));
        dirs.push(PathBuf::from("/Applications"));
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/Library/LaunchAgents"));
        dirs.push(PathBuf::from("/Library/LaunchDaemons"));
    }
    dirs
}

fn read_files(ctx: &SystemContext) -> BTreeMap<PathBuf, Option<String>> {
    let mut files = BTreeMap::new();
    for (path, _) in all_known_startup_files(&ctx.home) {
        let content = fs_util::read_to_string_opt(&path).ok().flatten();
        files.insert(path, content);
    }
    files
}

fn read_listings(ctx: &SystemContext) -> BTreeMap<PathBuf, BTreeSet<String>> {
    let mut out = BTreeMap::new();
    for dir in watched_directories(ctx) {
        if !dir.is_dir() {
            continue;
        }
        let names: BTreeSet<String> =
            fs_util::list_dir(&dir).into_iter().filter_map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned())).collect();
        out.insert(dir, names);
    }
    out
}

/// Records the environment before a command runs. The caller persists `state.before`.
pub fn begin(ctx: &SystemContext, label: &str, storage: Option<&StorageReport>) -> TrackingState {
    ctx.refresh_shell_capture();
    let before = snapshot::collect(ctx, &SnapshotOptions { kind: "run_before", label: Some(label.to_string()), storage, quick: false });
    TrackingState { started_at: Utc::now(), before, files: read_files(ctx), listings: read_listings(ctx) }
}

fn count_diff_lines(diff: &str) -> (usize, usize) {
    let mut added = 0;
    let mut removed = 0;
    for line in diff.lines() {
        if line.starts_with("+++") || line.starts_with("---") {
            continue;
        }
        if line.starts_with('+') {
            added += 1;
        } else if line.starts_with('-') {
            removed += 1;
        }
    }
    (added, removed)
}

fn file_diffs(
    ctx: &SystemContext,
    before: &BTreeMap<PathBuf, Option<String>>,
    after: &BTreeMap<PathBuf, Option<String>>,
) -> Vec<TrackedFileDiff> {
    let mut out = Vec::new();
    for (path, before_content) in before {
        let after_content = after.get(path).cloned().flatten();
        let kind = match (before_content, &after_content) {
            (None, None) => continue,
            (Some(b), Some(a)) if b == a => continue,
            (None, Some(_)) => FileChangeKind::Created,
            (Some(_), None) => FileChangeKind::Deleted,
            (Some(_), Some(_)) => FileChangeKind::Modified,
        };
        let b = before_content.clone().unwrap_or_default();
        let a = after_content.unwrap_or_default();
        // The diff header shows `~/.zshrc`, not the absolute home path, so records read well and
        // can be shared.
        let diff = redact_text(&unified_diff(Path::new(&ctx.display_path(path)), &b, &a));
        let (lines_added, lines_removed) = count_diff_lines(&diff);
        out.push(TrackedFileDiff { path: path.clone(), kind, diff, lines_added, lines_removed });
    }
    out
}

fn directory_changes(before: &BTreeMap<PathBuf, BTreeSet<String>>, after: &BTreeMap<PathBuf, BTreeSet<String>>) -> Vec<DirectoryChanges> {
    let mut out = Vec::new();
    let dirs: BTreeSet<&PathBuf> = before.keys().chain(after.keys()).collect();
    for dir in dirs {
        let empty = BTreeSet::new();
        let b = before.get(dir).unwrap_or(&empty);
        let a = after.get(dir).unwrap_or(&empty);
        let added: Vec<String> = a.difference(b).filter(|n| !n.starts_with(".DS_Store")).cloned().collect();
        let removed: Vec<String> = b.difference(a).filter(|n| !n.starts_with(".DS_Store")).cloned().collect();
        if !added.is_empty() || !removed.is_empty() {
            out.push(DirectoryChanges { dir: dir.clone(), added, removed });
        }
    }
    out
}

fn version_changes(before: &Snapshot, after: &Snapshot) -> Vec<VersionChange> {
    let versions = |s: &Snapshot| -> BTreeMap<String, (Option<String>, Option<String>)> {
        s.items
            .iter()
            .filter(|i| i.category == "runtime")
            .map(|i| {
                (
                    i.key.clone(),
                    (
                        i.value.get("version").and_then(|v| v.as_str()).map(str::to_string),
                        i.value.get("path").and_then(|v| v.as_str()).map(str::to_string),
                    ),
                )
            })
            .collect()
    };
    let b = versions(before);
    let a = versions(after);
    let mut out = Vec::new();
    for (cmd, (after_version, after_path)) in &a {
        let (before_version, _) = b.get(cmd).cloned().unwrap_or((None, None));
        if before_version.is_some() && after_version.is_some() && before_version != *after_version {
            out.push(VersionChange {
                command: cmd.clone(),
                before: before_version,
                after: after_version.clone(),
                path: after_path.clone(),
            });
        }
    }
    out
}

fn headline(
    ctx: &SystemContext,
    diff: &SnapshotDiff,
    files: &[TrackedFileDiff],
    dirs: &[DirectoryChanges],
    versions: &[VersionChange],
) -> Vec<String> {
    let mut lines: Vec<String> = diff.headline.iter().filter(|h| !h.contains("shell configuration change")).cloned().collect();
    for f in files {
        let name = ctx.display_path(&f.path);
        lines.push(match f.kind {
            FileChangeKind::Created => format!("{name} created (+{} lines)", f.lines_added),
            FileChangeKind::Deleted => format!("{name} deleted"),
            FileChangeKind::Modified => format!("{name} modified (+{} / -{} lines)", f.lines_added, f.lines_removed),
        });
    }
    for d in dirs {
        let dir = ctx.display_path(&d.dir);
        for name in d.added.iter().take(5) {
            lines.push(format!("new in {dir}: {name}"));
        }
        if d.added.len() > 5 {
            lines.push(format!("{} more new entries in {dir}", d.added.len() - 5));
        }
        for name in d.removed.iter().take(3) {
            lines.push(format!("removed from {dir}: {name}"));
        }
    }
    for v in versions {
        lines.push(format!(
            "{} {} → {}",
            v.command,
            v.before.clone().unwrap_or_else(|| "?".into()),
            v.after.clone().unwrap_or_else(|| "?".into())
        ));
    }
    lines
}

/// Records the environment after the command and builds the run record. Returns the "after"
/// snapshot as well so the caller can persist it.
pub fn finish(
    ctx: &SystemContext,
    state: TrackingState,
    command: Vec<String>,
    cwd: Option<PathBuf>,
    exit_code: Option<i32>,
    storage: Option<&StorageReport>,
) -> (Snapshot, RunRecord) {
    let label = display_command(&command);
    ctx.refresh_shell_capture();
    ctx.invalidate_shell_analysis();
    let after = snapshot::collect(ctx, &SnapshotOptions { kind: "run_after", label: Some(label.clone()), storage, quick: false });
    let diff = snapshot::diff(&state.before, &after);
    let files = file_diffs(ctx, &state.files, &read_files(ctx));
    let dirs = directory_changes(&state.listings, &read_listings(ctx));
    let versions = version_changes(&state.before, &after);
    let finished_at = Utc::now();
    let headline = headline(ctx, &diff, &files, &dirs, &versions);
    let record = RunRecord {
        id: random_id("run_"),
        label,
        command,
        cwd,
        started_at: state.started_at,
        finished_at,
        duration_ms: (finished_at - state.started_at).num_milliseconds().max(0) as u64,
        exit_code,
        before_snapshot_id: state.before.id.clone(),
        after_snapshot_id: after.id.clone(),
        diff,
        file_diffs: files,
        directory_changes: dirs,
        version_changes: versions,
        headline,
    };
    (after, record)
}

/// Shell-like display of an argument vector (arguments with spaces are quoted; secrets redacted).
pub fn display_command(command: &[String]) -> String {
    let joined: Vec<String> =
        command.iter().map(|a| if a.is_empty() || a.contains(char::is_whitespace) { format!("{a:?}") } else { a.clone() }).collect();
    redact_text(&joined.join(" "))
}

/// Root-relative display used by reports: a path under `home` becomes `~/...`.
pub fn display_dir(path: &Path, home: &Path) -> String {
    fs_util::display_path(path, home)
}

// These tests exercise POSIX shell behaviour (login shells, `:`-separated PATH, rc files).
#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::command::MockRunner;
    use crate::platform::FakePlatform;
    use std::sync::Arc;

    #[test]
    fn records_startup_file_and_directory_changes() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path();
        std::fs::write(home.join(".zshrc"), "export A=1\n").unwrap();
        std::fs::create_dir_all(home.join(".local/bin")).unwrap();
        let runner = Arc::new(MockRunner::new());
        let ctx = SystemContext::for_test(home, Arc::new(FakePlatform::new()), runner, "/usr/bin:/bin");
        let state = begin(&ctx, "fake installer", None);
        // The "installer" appends a line, creates a tool directory and a launcher.
        std::fs::write(home.join(".zshrc"), "export A=1\nexport PATH=\"$HOME/.tool/bin:$PATH\"\nexport TOOL_TOKEN=abc123secret\n").unwrap();
        std::fs::create_dir_all(home.join(".tool/bin")).unwrap();
        std::fs::write(home.join(".local/bin/tool"), "#!/bin/sh\n").unwrap();
        let (after, record) = finish(&ctx, state, vec!["sh".into(), "install.sh".into()], None, Some(0), None);
        assert_eq!(after.kind, "run_after");
        assert_eq!(record.label, "sh install.sh");
        assert!(record.changed_anything());
        assert_eq!(record.file_diffs.len(), 1);
        let d = &record.file_diffs[0];
        assert_eq!(d.kind, FileChangeKind::Modified);
        assert_eq!(d.lines_added, 2);
        assert!(d.diff.contains("+export PATH="));
        assert!(d.diff.contains("--- ~/.zshrc (before)"), "{}", d.diff);
        assert!(!d.diff.contains("abc123secret"), "secrets are redacted in stored diffs: {}", d.diff);
        let home_changes = record.directory_changes.iter().find(|c| c.dir == home).expect("home listing");
        assert_eq!(home_changes.added, vec![".tool".to_string()]);
        let bin_changes = record.directory_changes.iter().find(|c| c.dir == home.join(".local/bin")).expect("bin listing");
        assert_eq!(bin_changes.added, vec!["tool".to_string()]);
        assert!(record.headline.iter().any(|h| h.contains("~/.zshrc modified (+2 / -0 lines)")), "{:?}", record.headline);
        assert!(record.headline.iter().any(|h| h == "new in ~: .tool"), "{:?}", record.headline);
        assert!(record.diff.changes.iter().any(|c| c.category == "shell_file"));
    }

    #[test]
    fn display_command_quotes_and_redacts() {
        assert_eq!(display_command(&["brew".into(), "install".into(), "my tool".into()]), "brew install \"my tool\"");
        let shown = display_command(&["sh".into(), "-c".into(), "TOKEN=abcdef123 ./install".into()]);
        assert!(!shown.contains("abcdef123"));
    }
}
