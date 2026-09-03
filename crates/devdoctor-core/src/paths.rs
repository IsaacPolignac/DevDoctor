//! Locations of DevDoctor's own data: database, backups, logs.

use crate::{Error, Result};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, serde::Serialize)]
pub struct DevDoctorDirs {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub backups_dir: PathBuf,
    pub logs_dir: PathBuf,
}

impl DevDoctorDirs {
    /// Resolves the directories for the current user. `DEVDOCTOR_HOME` overrides everything,
    /// which is what tests and the CLI's `--home` flag use.
    pub fn resolve() -> Result<Self> {
        if let Ok(custom) = std::env::var("DEVDOCTOR_HOME") {
            if !custom.trim().is_empty() {
                return Ok(Self::in_dir(Path::new(&custom)));
            }
        }
        let home = dirs::home_dir().ok_or_else(|| Error::other("cannot determine home directory"))?;
        let data_dir = home.join("Library").join("Application Support").join("DevDoctor");
        let logs_dir = home.join("Library").join("Logs").join("DevDoctor");
        Ok(Self { db_path: data_dir.join("devdoctor.db"), backups_dir: data_dir.join("backups"), data_dir, logs_dir })
    }

    /// All directories under a single root (used for tests and custom homes).
    pub fn in_dir(root: &Path) -> Self {
        Self {
            data_dir: root.to_path_buf(),
            db_path: root.join("devdoctor.db"),
            backups_dir: root.join("backups"),
            logs_dir: root.join("logs"),
        }
    }

    pub fn ensure(&self) -> Result<()> {
        for dir in [&self.data_dir, &self.backups_dir, &self.logs_dir] {
            std::fs::create_dir_all(dir).map_err(|e| Error::io(dir.clone(), e))?;
        }
        Ok(())
    }
}
