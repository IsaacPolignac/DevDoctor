//! Transactions: every fix is recorded, backed up, validated and reversible when possible.
//!
//! Lifecycle: preview → create transaction → apply through [`TxBuilder`] → validate → commit.
//! If `apply` fails or validation fails, all file operations are rolled back automatically.

use crate::backup::{BackupRecord, BackupStore};
use crate::command::{CommandOutput, CommandSpec};
use crate::context::SystemContext;
use crate::db::Database;
use crate::fixer::{FixPreview, Fixer, ValidationReport};
use crate::fs_util::{self, DirSize};
use crate::ids::{random_id, sha256_hex};
use crate::issue::Issue;
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxStatus {
    Pending,
    Applied,
    Failed,
    RolledBack,
    RollbackFailed,
}

impl TxStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TxStatus::Pending => "pending",
            TxStatus::Applied => "applied",
            TxStatus::Failed => "failed",
            TxStatus::RolledBack => "rolled_back",
            TxStatus::RollbackFailed => "rollback_failed",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum Operation {
    FileWrite {
        path: PathBuf,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        before_sha256: Option<String>,
        after_sha256: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        backup_id: Option<String>,
        created: bool,
    },
    FileDelete {
        path: PathBuf,
        backup_id: String,
    },
    DirDelete {
        path: PathBuf,
        bytes: u64,
        entries: u64,
    },
    ProcessStop {
        pid: u32,
        name: String,
        force: bool,
    },
    Command {
        program: String,
        args: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        exit_code: Option<i32>,
        description: String,
    },
    /// A symbolic link removed (the link itself, never its target). Undone by recreating the
    /// link with the recorded target.
    SymlinkDelete {
        path: PathBuf,
        target: PathBuf,
    },
}

impl Operation {
    pub fn kind(&self) -> &'static str {
        match self {
            Operation::FileWrite { .. } => "file_write",
            Operation::FileDelete { .. } => "file_delete",
            Operation::DirDelete { .. } => "dir_delete",
            Operation::ProcessStop { .. } => "process_stop",
            Operation::Command { .. } => "command",
            Operation::SymlinkDelete { .. } => "symlink_delete",
        }
    }

    pub fn reversible(&self) -> bool {
        matches!(self, Operation::FileWrite { .. } | Operation::FileDelete { .. } | Operation::SymlinkDelete { .. })
    }

    pub fn describe(&self, home: &Path) -> String {
        match self {
            Operation::FileWrite { path, created, .. } => {
                if *created {
                    format!("Created {}", fs_util::display_path(path, home))
                } else {
                    format!("Modified {} (backup created)", fs_util::display_path(path, home))
                }
            }
            Operation::FileDelete { path, .. } => format!("Deleted file {} (backup created)", fs_util::display_path(path, home)),
            Operation::DirDelete { path, bytes, .. } => {
                format!("Deleted directory {} ({})", fs_util::display_path(path, home), crate::units::format_bytes(*bytes))
            }
            Operation::ProcessStop { pid, name, force } => {
                format!("Stopped process {name} (pid {pid}){}", if *force { " with SIGKILL" } else { "" })
            }
            Operation::Command { program, args, exit_code, .. } => {
                format!("Ran {} {} (exit {})", program, args.join(" "), exit_code.map(|c| c.to_string()).unwrap_or_else(|| "?".into()))
            }
            Operation::SymlinkDelete { path, target } => {
                format!("Removed broken link {} (pointed to {})", fs_util::display_path(path, home), fs_util::display_path(target, home))
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issue_id: Option<String>,
    pub fixer_id: String,
    pub title: String,
    pub status: TxStatus,
    pub created_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    pub operations: Vec<Operation>,
    pub backups: Vec<BackupRecord>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<FixPreview>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation: Option<ValidationReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub disk_space_recovered: u64,
    pub notes: Vec<String>,
    /// Free-form state a fixer records during `apply` for use in `validate` (e.g. the PATH
    /// order observed before the change).
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub state: serde_json::Value,
}

impl Transaction {
    pub fn new(issue: &Issue, fixer_id: &str, preview: FixPreview) -> Self {
        Self {
            id: random_id("tx_"),
            issue_id: Some(issue.id.clone()),
            fixer_id: fixer_id.to_string(),
            title: preview.title.clone(),
            status: TxStatus::Pending,
            created_at: Utc::now(),
            completed_at: None,
            operations: Vec::new(),
            backups: Vec::new(),
            preview: Some(preview),
            validation: None,
            error: None,
            disk_space_recovered: 0,
            notes: Vec::new(),
            state: serde_json::Value::Null,
        }
    }

    /// True when every recorded operation can be undone from backups.
    pub fn reversible(&self) -> bool {
        !self.operations.is_empty() && self.operations.iter().all(Operation::reversible)
    }

    pub fn can_rollback(&self) -> bool {
        self.status == TxStatus::Applied && self.reversible()
    }
}

/// Where fixers may write or delete. Everything else is refused before touching the disk.
#[derive(Debug, Clone)]
pub struct MutationPolicy {
    pub allowed_roots: Vec<PathBuf>,
    /// Never written or deleted (exact path or anything below it).
    pub forbidden: Vec<PathBuf>,
    /// Never deleted as a whole (subdirectories may be).
    pub protected_dirs: Vec<PathBuf>,
}

impl MutationPolicy {
    pub fn for_context(ctx: &SystemContext) -> Self {
        // Both the spelled and the canonical form of every root are kept: on macOS the home
        // directory may live behind a symlink (e.g. /var -> /private/var for temporary homes).
        let mut homes = vec![ctx.home.clone()];
        if let Ok(canon) = std::fs::canonicalize(&ctx.home) {
            if !homes.contains(&canon) {
                homes.push(canon);
            }
        }
        let mut forbidden = Vec::new();
        let mut protected_dirs = Vec::new();
        for home in &homes {
            forbidden.extend([home.join(".ssh"), home.join(".gnupg"), home.join("Library/Keychains")]);
            protected_dirs.extend([
                home.clone(),
                home.join("Library"),
                home.join("Documents"),
                home.join("Desktop"),
                home.join("Downloads"),
                home.join("Pictures"),
                home.join("Movies"),
                home.join("Music"),
                home.join("Applications"),
                home.join("Library/Application Support"),
                home.join("Library/Caches"),
                home.join("Library/Containers"),
            ]);
        }
        forbidden.push(ctx.dirs.data_dir.clone());
        if let Ok(canon) = std::fs::canonicalize(&ctx.dirs.data_dir) {
            forbidden.push(canon);
        }
        Self { allowed_roots: homes, forbidden, protected_dirs }
    }

    fn check_common(&self, path: &Path) -> Result<()> {
        if !path.is_absolute() {
            return Err(Error::UnsafePath(format!("{} is not absolute", path.display())));
        }
        if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(Error::UnsafePath(format!("{} contains `..`", path.display())));
        }
        if !self.allowed_roots.iter().any(|r| fs_util::starts_with_lexical(path, r)) {
            return Err(Error::UnsafePath(format!("{} is outside the directories DevDoctor may modify", path.display())));
        }
        if self.forbidden.iter().any(|f| fs_util::starts_with_lexical(path, f)) {
            return Err(Error::UnsafePath(format!("{} is protected and never modified by DevDoctor", path.display())));
        }
        Ok(())
    }

    /// Validates a write target. Symlinks are resolved so that a symlinked `~/.zshrc` (dotfiles
    /// repositories) is edited in place instead of being replaced by a regular file.
    pub fn check_write(&self, path: &Path) -> Result<PathBuf> {
        self.check_common(path)?;
        let target = match std::fs::canonicalize(path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => path.to_path_buf(),
            Err(e) => return Err(Error::io(path, e)),
        };
        if target != path {
            self.check_common(&target)?;
        }
        if target.exists() && !target.is_file() {
            return Err(Error::UnsafePath(format!("{} is not a regular file", target.display())));
        }
        for root in &self.allowed_roots {
            if fs_util::starts_with_lexical(&target, root) && !fs_util::resolved_within(&target, root)? {
                return Err(Error::UnsafePath(format!("{} resolves outside {}", target.display(), root.display())));
            }
        }
        Ok(target)
    }

    pub fn check_delete_dir(&self, path: &Path) -> Result<()> {
        self.check_common(path)?;
        let normalized = fs_util::normalize_lexical(path);
        if self.protected_dirs.iter().any(|p| fs_util::normalize_lexical(p) == normalized) {
            return Err(Error::UnsafePath(format!("{} is a protected directory", path.display())));
        }
        if fs_util::is_symlink(path) {
            return Err(Error::UnsafePath(format!("{} is a symbolic link", path.display())));
        }
        for root in &self.allowed_roots {
            if fs_util::starts_with_lexical(path, root) && !fs_util::resolved_within(path, root)? {
                return Err(Error::UnsafePath(format!("{} resolves outside {}", path.display(), root.display())));
            }
        }
        Ok(())
    }

    pub fn check_delete_file(&self, path: &Path) -> Result<()> {
        self.check_common(path)?;
        if fs_util::is_symlink(path) {
            return Err(Error::UnsafePath(format!("{} is a symbolic link", path.display())));
        }
        Ok(())
    }

    /// Validates the removal of a symbolic link itself. The link must be inside an allowed root
    /// and must currently be a symlink; its target is never touched.
    pub fn check_delete_symlink(&self, path: &Path) -> Result<()> {
        self.check_common(path)?;
        if !fs_util::is_symlink(path) {
            return Err(Error::UnsafePath(format!("{} is not a symbolic link", path.display())));
        }
        Ok(())
    }
}

/// The only way a fixer can change the machine. Records every operation.
pub struct TxBuilder<'a> {
    tx: Transaction,
    backups: &'a BackupStore,
    policy: &'a MutationPolicy,
    ctx: &'a SystemContext,
}

impl<'a> TxBuilder<'a> {
    pub fn new(tx: Transaction, backups: &'a BackupStore, policy: &'a MutationPolicy, ctx: &'a SystemContext) -> Self {
        Self { tx, backups, policy, ctx }
    }

    pub fn transaction(&self) -> &Transaction {
        &self.tx
    }

    pub fn into_transaction(self) -> Transaction {
        self.tx
    }

    pub fn note(&mut self, note: impl Into<String>) {
        self.tx.notes.push(note.into());
    }

    pub fn set_state(&mut self, state: serde_json::Value) {
        self.tx.state = state;
    }

    pub fn state(&self) -> &serde_json::Value {
        &self.tx.state
    }

    /// Writes a file (creating a backup first when it exists).
    pub fn write_file(&mut self, path: &Path, content: &[u8]) -> Result<()> {
        let target = self.policy.check_write(path)?;
        let existed = target.exists();
        let (before_sha256, backup_id) = if existed {
            let record = self.backups.create(&target, Some(&self.tx.id))?;
            let ids = (Some(record.sha256.clone()), Some(record.id.clone()));
            self.tx.backups.push(record);
            ids
        } else {
            (None, None)
        };
        fs_util::atomic_write(&target, content, None)?;
        tracing::info!(tx = %self.tx.id, path = %target.display(), "file written");
        self.tx.operations.push(Operation::FileWrite {
            path: target,
            before_sha256,
            after_sha256: sha256_hex(content),
            backup_id,
            created: !existed,
        });
        Ok(())
    }

    pub fn delete_file(&mut self, path: &Path) -> Result<()> {
        self.policy.check_delete_file(path)?;
        let record = self.backups.create(path, Some(&self.tx.id))?;
        std::fs::remove_file(path).map_err(|e| Error::io(path, e))?;
        tracing::info!(tx = %self.tx.id, path = %path.display(), "file deleted");
        self.tx.operations.push(Operation::FileDelete { path: path.to_path_buf(), backup_id: record.id.clone() });
        self.tx.backups.push(record);
        Ok(())
    }

    /// Removes a symbolic link (only the link). Reversible: rollback recreates it with the same
    /// target. The target itself is never read, followed or modified.
    pub fn delete_symlink(&mut self, path: &Path) -> Result<PathBuf> {
        self.policy.check_delete_symlink(path)?;
        let target = std::fs::read_link(path).map_err(|e| Error::io(path, e))?;
        std::fs::remove_file(path).map_err(|e| Error::io(path, e))?;
        tracing::info!(tx = %self.tx.id, path = %path.display(), target = %target.display(), "symlink removed");
        self.tx.operations.push(Operation::SymlinkDelete { path: path.to_path_buf(), target: target.clone() });
        Ok(target)
    }

    /// Deletes a directory tree. Not reversible; callers must have shown a preview.
    pub fn delete_dir(&mut self, path: &Path) -> Result<DirSize> {
        self.policy.check_delete_dir(path)?;
        let size = fs_util::dir_size(path);
        fs_util::remove_dir_all_no_follow(path)?;
        tracing::info!(tx = %self.tx.id, path = %path.display(), bytes = size.allocated, "directory deleted");
        self.tx.operations.push(Operation::DirDelete { path: path.to_path_buf(), bytes: size.allocated, entries: size.files + size.dirs });
        self.tx.disk_space_recovered += size.allocated;
        Ok(size)
    }

    /// Deletes the *contents* of a directory (keeps the directory itself). Not reversible.
    pub fn clear_dir(&mut self, path: &Path, keep: &[&str]) -> Result<DirSize> {
        self.policy.check_delete_dir(path)?;
        let mut total = DirSize::default();
        for entry in fs_util::list_dir(path) {
            let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if keep.contains(&name.as_str()) {
                continue;
            }
            let meta = std::fs::symlink_metadata(&entry).map_err(|e| Error::io(&entry, e))?;
            if meta.is_dir() && !meta.file_type().is_symlink() {
                let size = fs_util::dir_size(&entry);
                fs_util::remove_dir_all_no_follow(&entry)?;
                self.tx.operations.push(Operation::DirDelete {
                    path: entry.clone(),
                    bytes: size.allocated,
                    entries: size.files + size.dirs,
                });
                total.add(size);
            } else {
                let bytes = crate::sys::allocated_bytes(&meta);
                std::fs::remove_file(&entry).map_err(|e| Error::io(&entry, e))?;
                self.tx.operations.push(Operation::DirDelete { path: entry.clone(), bytes, entries: 1 });
                total.allocated += bytes;
                total.files += 1;
            }
        }
        self.tx.disk_space_recovered += total.allocated;
        tracing::info!(tx = %self.tx.id, path = %path.display(), bytes = total.allocated, "directory cleared");
        Ok(total)
    }

    pub fn stop_process(&mut self, pid: u32, name: &str, force: bool) -> Result<()> {
        self.ctx.platform.stop_process(pid, force)?;
        tracing::info!(tx = %self.tx.id, pid, name, force, "process stopped");
        self.tx.operations.push(Operation::ProcessStop { pid, name: name.to_string(), force });
        Ok(())
    }

    pub fn run_command(&mut self, spec: &CommandSpec, description: &str) -> Result<CommandOutput> {
        let out = self.ctx.run(spec)?;
        tracing::info!(tx = %self.tx.id, command = %spec.display(), exit = ?out.exit_code, "command executed");
        self.tx.operations.push(Operation::Command {
            program: spec.program.clone(),
            args: spec.args.clone(),
            exit_code: out.exit_code,
            description: description.to_string(),
        });
        if !out.success() {
            return Err(Error::Command {
                program: spec.program_name(),
                reason: if out.timed_out { "timed out".into() } else { crate::redact::redact_text(out.stderr.trim()) },
            });
        }
        Ok(out)
    }

    pub fn context(&self) -> &SystemContext {
        self.ctx
    }
}

/// Undoes file operations in reverse order. Returns human-readable errors for anything that
/// could not be undone.
fn undo_operations(tx: &Transaction, store: &BackupStore, force: bool) -> Vec<String> {
    let mut errors = Vec::new();
    for op in tx.operations.iter().rev() {
        match op {
            Operation::FileWrite { path, after_sha256, backup_id, created, .. } => {
                let current = fs_util::sha256_file(path).ok();
                if !force && current.as_deref().is_some_and(|c| c != after_sha256) {
                    errors.push(format!("{} changed since the fix was applied; use force to restore anyway", path.display()));
                    continue;
                }
                match backup_id {
                    Some(id) => match tx.backups.iter().find(|b| &b.id == id) {
                        Some(record) => {
                            if let Err(e) = store.restore(record) {
                                errors.push(format!("could not restore {}: {e}", path.display()));
                            }
                        }
                        None => errors.push(format!("backup {id} not found for {}", path.display())),
                    },
                    None if *created => {
                        if let Err(e) = std::fs::remove_file(path) {
                            if e.kind() != std::io::ErrorKind::NotFound {
                                errors.push(format!("could not remove {}: {e}", path.display()));
                            }
                        }
                    }
                    None => errors.push(format!("no backup recorded for {}", path.display())),
                }
            }
            Operation::FileDelete { path, backup_id } => match tx.backups.iter().find(|b| &b.id == backup_id) {
                Some(record) => {
                    if let Err(e) = store.restore(record) {
                        errors.push(format!("could not restore {}: {e}", path.display()));
                    }
                }
                None => errors.push(format!("backup {backup_id} not found for {}", path.display())),
            },
            Operation::DirDelete { path, .. } => errors.push(format!("deleted directory {} cannot be restored", path.display())),
            Operation::ProcessStop { .. } => {}
            Operation::Command { program, .. } => errors.push(format!("command `{program}` cannot be undone")),
            Operation::SymlinkDelete { path, target } => {
                if std::fs::symlink_metadata(path).is_ok() {
                    if !force {
                        errors.push(format!("{} exists again; use force to replace it", path.display()));
                        continue;
                    }
                    if let Err(e) = std::fs::remove_file(path) {
                        errors.push(format!("could not replace {}: {e}", path.display()));
                        continue;
                    }
                }
                if let Err(e) = crate::sys::symlink(target, path) {
                    errors.push(format!("could not recreate link {}: {e}", path.display()));
                }
            }
        }
    }
    errors
}

pub struct TransactionManager {
    db: Arc<Database>,
    backups: BackupStore,
    policy: MutationPolicy,
}

impl TransactionManager {
    pub fn new(db: Arc<Database>, backups: BackupStore, policy: MutationPolicy) -> Self {
        Self { db, backups, policy }
    }

    pub fn backups(&self) -> &BackupStore {
        &self.backups
    }

    pub fn policy(&self) -> &MutationPolicy {
        &self.policy
    }

    /// Applies a fix as a transaction. Any failure during apply or validation rolls the file
    /// changes back automatically and returns an error describing what happened.
    pub fn apply(&self, fixer: &dyn Fixer, issue: &Issue, ctx: &SystemContext) -> Result<Transaction> {
        let preview = fixer.preview(issue, ctx)?;
        if preview.is_noop() {
            return Err(Error::FixUnavailable("nothing to change; the problem may already be resolved. Run a new scan.".into()));
        }
        let tx = Transaction::new(issue, fixer.id(), preview);
        self.db.save_transaction(&tx)?;
        tracing::info!(tx = %tx.id, fixer = fixer.id(), issue = %issue.id, "transaction started");
        let mut builder = TxBuilder::new(tx, &self.backups, &self.policy, ctx);
        if let Err(e) = fixer.apply(issue, ctx, &mut builder) {
            let mut tx = builder.into_transaction();
            let undo_errors = undo_operations(&tx, &self.backups, true);
            tx.status = if undo_errors.is_empty() { TxStatus::Failed } else { TxStatus::RollbackFailed };
            tx.error = Some(format!("apply failed: {e}"));
            tx.notes.extend(undo_errors.iter().map(|u| format!("rollback: {u}")));
            tx.completed_at = Some(Utc::now());
            self.db.save_transaction(&tx)?;
            tracing::warn!(tx = %tx.id, error = %e, "fix failed; changes rolled back");
            return Err(Error::Other(format!("{e} (changes were rolled back, transaction {})", tx.id)));
        }
        let validation = match fixer.validate(issue, ctx, &builder) {
            Ok(v) => v,
            Err(e) => {
                let mut report = ValidationReport::ok();
                report.check("validation", false, e.to_string());
                report
            }
        };
        let mut tx = builder.into_transaction();
        tx.validation = Some(validation.clone());
        if !validation.passed() {
            let failures: Vec<String> = validation.failures().iter().map(|c| format!("{}: {}", c.name, c.detail)).collect();
            let undo_errors = undo_operations(&tx, &self.backups, true);
            tx.status = if undo_errors.is_empty() { TxStatus::Failed } else { TxStatus::RollbackFailed };
            tx.error = Some(format!("validation failed: {}", failures.join("; ")));
            tx.notes.extend(undo_errors.iter().map(|u| format!("rollback: {u}")));
            tx.completed_at = Some(Utc::now());
            self.db.save_transaction(&tx)?;
            tracing::warn!(tx = %tx.id, "validation failed; changes rolled back");
            return Err(Error::Validation(format!("{} (changes were rolled back, transaction {})", failures.join("; "), tx.id)));
        }
        tx.status = TxStatus::Applied;
        tx.completed_at = Some(Utc::now());
        self.db.save_transaction(&tx)?;
        self.db.resolve_issue(&issue.id)?;
        tracing::info!(tx = %tx.id, "transaction applied");
        Ok(tx)
    }

    /// Rolls back an applied transaction from its backups.
    pub fn rollback(&self, id: &str, force: bool) -> Result<Transaction> {
        let mut tx = self.db.transaction(id)?.ok_or_else(|| Error::NotFound(format!("transaction {id}")))?;
        if tx.status != TxStatus::Applied {
            return Err(Error::Invalid(format!("transaction {} is {} and cannot be rolled back", tx.id, tx.status.as_str())));
        }
        if !tx.reversible() {
            return Err(Error::Invalid(format!(
                "transaction {} contains operations that cannot be undone (deleted directories, stopped processes or commands)",
                tx.id
            )));
        }
        let errors = undo_operations(&tx, &self.backups, force);
        if errors.is_empty() {
            tx.status = TxStatus::RolledBack;
        } else {
            tx.status = TxStatus::RollbackFailed;
            tx.error = Some(errors.join("; "));
        }
        tx.completed_at = Some(Utc::now());
        self.db.save_transaction(&tx)?;
        if errors.is_empty() {
            Ok(tx)
        } else {
            Err(Error::Other(format!("rollback incomplete: {}", errors.join("; "))))
        }
    }
}
