//! Backups of files before DevDoctor modifies them. Every backup is content-addressed (SHA-256)
//! and stored under the DevDoctor data directory; the database keeps the metadata.

use crate::fs_util;
use crate::ids::{random_id, sha256_hex};
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRecord {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    /// The file that was backed up (symlinks resolved).
    pub original_path: PathBuf,
    pub stored_path: PathBuf,
    pub sha256: String,
    pub size: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<u32>,
    pub created_at: DateTime<Utc>,
}

pub struct BackupStore {
    root: PathBuf,
}

impl BackupStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Copies `original` into the store. The original must be a regular file.
    pub fn create(&self, original: &Path, transaction_id: Option<&str>) -> Result<BackupRecord> {
        let meta = std::fs::metadata(original).map_err(|e| Error::io(original, e))?;
        if !meta.is_file() {
            return Err(Error::UnsafePath(format!("{} is not a regular file", original.display())));
        }
        let data = fs_util::read_bytes(original)?;
        let id = random_id("bk_");
        let dir = self.root.join(transaction_id.unwrap_or("manual"));
        std::fs::create_dir_all(&dir).map_err(|e| Error::io(&dir, e))?;
        let file_name = original.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "file".into());
        let stored = dir.join(format!("{id}-{file_name}"));
        std::fs::write(&stored, &data).map_err(|e| Error::io(&stored, e))?;
        let _ = std::fs::set_permissions(&stored, std::fs::Permissions::from_mode(0o600));
        let record = BackupRecord {
            id,
            transaction_id: transaction_id.map(str::to_string),
            original_path: original.to_path_buf(),
            stored_path: stored,
            sha256: sha256_hex(&data),
            size: data.len() as u64,
            mode: Some(meta.permissions().mode() & 0o7777),
            created_at: Utc::now(),
        };
        tracing::info!(path = %original.display(), backup = %record.id, "backup created");
        Ok(record)
    }

    /// Reads and verifies a backup's content.
    pub fn read(&self, record: &BackupRecord) -> Result<Vec<u8>> {
        let data = fs_util::read_bytes(&record.stored_path)?;
        if sha256_hex(&data) != record.sha256 {
            return Err(Error::Validation(format!("backup {} is corrupted (checksum mismatch)", record.id)));
        }
        Ok(data)
    }

    /// Restores the backup over its original path (atomically, preserving the saved mode).
    pub fn restore(&self, record: &BackupRecord) -> Result<()> {
        let data = self.read(record)?;
        if let Some(parent) = record.original_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| Error::io(parent, e))?;
        }
        fs_util::atomic_write(&record.original_path, &data, record.mode)?;
        tracing::info!(path = %record.original_path.display(), backup = %record.id, "backup restored");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let store = BackupStore::new(dir.path().join("backups"));
        let file = dir.path().join(".zshrc");
        std::fs::write(&file, "export A=1\n").unwrap();
        let rec = store.create(&file, Some("tx_test")).unwrap();
        assert!(rec.stored_path.exists());
        std::fs::write(&file, "broken").unwrap();
        store.restore(&rec).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "export A=1\n");
    }

    #[test]
    fn detects_corrupted_backup() {
        let dir = tempfile::tempdir().unwrap();
        let store = BackupStore::new(dir.path().join("backups"));
        let file = dir.path().join("f");
        std::fs::write(&file, "x").unwrap();
        let rec = store.create(&file, None).unwrap();
        std::fs::write(&rec.stored_path, "tampered").unwrap();
        assert!(store.read(&rec).is_err());
    }
}
