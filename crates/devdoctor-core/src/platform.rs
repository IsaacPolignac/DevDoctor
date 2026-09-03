//! Platform abstraction. macOS is implemented in `devdoctor-platform-macos`; the engine only
//! depends on this trait so other operating systems can be added later.

use crate::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub build: Option<String>,
    pub arch: String,
    /// Some(true) when the process runs under Rosetta translation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rosetta: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessInfo {
    pub pid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_pid: Option<u32>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exe: Option<PathBuf>,
    pub command: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub run_time_secs: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<u32>,
}

impl ProcessInfo {
    pub fn command_line(&self) -> String {
        if self.command.is_empty() {
            self.name.clone()
        } else {
            self.command.join(" ")
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListeningPort {
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    /// Bind address as reported by the OS (`127.0.0.1`, `*`, `::1`, ...).
    pub address: String,
    pub protocol: String,
    /// Some(true) when bound to a loopback address only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_only: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceKind {
    UserAgent,
    GlobalAgent,
    Daemon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceOrigin {
    HomebrewServices,
    Developer,
    ThirdParty,
    Apple,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub label: String,
    pub kind: ServiceKind,
    pub origin: ServiceOrigin,
    pub plist_path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program: Option<PathBuf>,
    pub program_arguments: Vec<String>,
    pub run_at_load: bool,
    pub keep_alive: bool,
    /// Whether launchd currently has the job loaded (None when unknown).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loaded: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub running_pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_exit_status: Option<i32>,
    /// Whether the executable the service starts exists on disk.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_exists: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub working_directory: Option<PathBuf>,
}

pub trait Platform: Send + Sync {
    fn os_info(&self) -> OsInfo;
    fn current_uid(&self) -> u32;
    fn processes(&self) -> Result<Vec<ProcessInfo>>;
    fn listening_ports(&self) -> Result<Vec<ListeningPort>>;
    fn services(&self) -> Result<Vec<ServiceInfo>>;
    fn process_alive(&self, pid: u32) -> bool;
    /// Sends SIGTERM (or SIGKILL when `force`). Callers are responsible for the safety policy.
    fn stop_process(&self, pid: u32, force: bool) -> Result<()>;
    fn reveal_in_file_manager(&self, path: &Path) -> Result<()>;
}

/// In-memory platform for tests.
#[derive(Default)]
pub struct FakePlatform {
    pub os: OsInfo,
    pub uid: u32,
    pub processes: Vec<ProcessInfo>,
    pub ports: Vec<ListeningPort>,
    pub services: Vec<ServiceInfo>,
    pub stopped: Mutex<Vec<(u32, bool)>>,
}

impl FakePlatform {
    pub fn new() -> Self {
        Self {
            os: OsInfo { name: "macOS".into(), version: "15.0".into(), build: None, arch: "arm64".into(), rosetta: Some(false) },
            uid: 501,
            ..Default::default()
        }
    }

    pub fn stopped_pids(&self) -> Vec<(u32, bool)> {
        self.stopped.lock().expect("lock").clone()
    }
}

impl Platform for FakePlatform {
    fn os_info(&self) -> OsInfo {
        self.os.clone()
    }

    fn current_uid(&self) -> u32 {
        self.uid
    }

    fn processes(&self) -> Result<Vec<ProcessInfo>> {
        Ok(self.processes.clone())
    }

    fn listening_ports(&self) -> Result<Vec<ListeningPort>> {
        Ok(self.ports.clone())
    }

    fn services(&self) -> Result<Vec<ServiceInfo>> {
        Ok(self.services.clone())
    }

    fn process_alive(&self, pid: u32) -> bool {
        let stopped = self.stopped.lock().expect("lock");
        self.processes.iter().any(|p| p.pid == pid) && !stopped.iter().any(|(p, _)| *p == pid)
    }

    fn stop_process(&self, pid: u32, force: bool) -> Result<()> {
        self.stopped.lock().expect("lock").push((pid, force));
        Ok(())
    }

    fn reveal_in_file_manager(&self, _path: &Path) -> Result<()> {
        Ok(())
    }
}
