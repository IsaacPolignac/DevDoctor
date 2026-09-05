//! DevDoctor fixers. Every fixer produces an exact preview without touching the machine and
//! applies changes only through the transaction builder (backups, validation, rollback).

use devdoctor_core::fixer::{Fixer, FixerRegistry};
use std::sync::Arc;

pub mod cache;
pub mod ollama;
pub mod process_stop;
pub mod schedule;
pub mod schedule_windows;
pub mod shell_append;
pub mod shell_line;
pub mod shell_path;
pub mod shell_restore;
pub mod shell_source;
pub mod storage;
pub mod symlink;
pub mod util;

/// Every fixer available on this OS. PATH statement fixers edit POSIX startup files, so they
/// are not offered on Windows (where PATH lives in the registry); the launchd agent fixers are
/// replaced by their Task Scheduler counterparts there.
pub fn all_fixers() -> Vec<Arc<dyn Fixer>> {
    let mut fixers: Vec<Arc<dyn Fixer>> = Vec::new();
    if !cfg!(windows) {
        fixers.push(Arc::new(shell_path::RemoveDuplicateFixer));
        fixers.push(Arc::new(shell_path::RemoveMissingDirectoryFixer));
    }
    fixers.extend([
        Arc::new(shell_restore::RestoreBackupFixer) as Arc<dyn Fixer>,
        Arc::new(shell_source::CommentOutMissingSourceFixer),
        Arc::new(shell_source::RemoveDuplicateSourceFixer),
        Arc::new(shell_append::AppendLineFixer),
        Arc::new(shell_line::CommentOutLineFixer),
        Arc::new(symlink::RemoveDanglingSymlinksFixer),
    ]);
    if cfg!(windows) {
        fixers.push(Arc::new(schedule_windows::InstallSnapshotTaskFixer));
        fixers.push(Arc::new(schedule_windows::RemoveSnapshotTaskFixer));
    } else {
        fixers.push(Arc::new(schedule::InstallSnapshotAgentFixer));
        fixers.push(Arc::new(schedule::RemoveSnapshotAgentFixer));
    }
    fixers.push(Arc::new(process_stop::StopProcessFixer));
    if cfg!(target_os = "macos") {
        fixers.push(Arc::new(cache::ClearHomebrewCacheFixer));
    }
    fixers.extend([
        Arc::new(cache::ClearNpmCacheFixer) as Arc<dyn Fixer>,
        Arc::new(cache::ClearPipCacheFixer),
        Arc::new(cache::ClearUvCacheFixer),
        Arc::new(storage::DeleteNodeModulesFixer),
        Arc::new(storage::DeleteVenvFixer),
        Arc::new(ollama::RemoveOllamaModelFixer),
    ]);
    fixers
}

pub fn registry() -> FixerRegistry {
    let mut r = FixerRegistry::new();
    for f in all_fixers() {
        r.register(f);
    }
    r
}
