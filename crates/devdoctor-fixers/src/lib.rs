//! DevDoctor fixers. Every fixer produces an exact preview without touching the machine and
//! applies changes only through the transaction builder (backups, validation, rollback).

use devdoctor_core::fixer::{Fixer, FixerRegistry};
use std::sync::Arc;

pub mod cache;
pub mod ollama;
pub mod process_stop;
pub mod shell_path;
pub mod shell_restore;
pub mod storage;
pub mod util;

pub fn all_fixers() -> Vec<Arc<dyn Fixer>> {
    vec![
        Arc::new(shell_path::RemoveDuplicateFixer),
        Arc::new(shell_path::RemoveMissingDirectoryFixer),
        Arc::new(shell_restore::RestoreBackupFixer),
        Arc::new(process_stop::StopProcessFixer),
        Arc::new(cache::ClearHomebrewCacheFixer),
        Arc::new(cache::ClearNpmCacheFixer),
        Arc::new(storage::DeleteNodeModulesFixer),
        Arc::new(ollama::RemoveOllamaModelFixer),
    ]
}

pub fn registry() -> FixerRegistry {
    let mut r = FixerRegistry::new();
    for f in all_fixers() {
        r.register(f);
    }
    r
}
