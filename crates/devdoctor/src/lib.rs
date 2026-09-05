//! The DevDoctor application facade shared by the CLI and the desktop app.
//!
//! Everything a user interface needs is exposed here as plain functions returning serialisable
//! data; no diagnostic logic lives in the CLI or in the Tauri layer.

use chrono::{DateTime, Utc};
use devdoctor_core::backup::BackupStore;
use devdoctor_core::command::RealRunner;
use devdoctor_core::context::{ContextOptions, SystemContext};
use devdoctor_core::db::{Database, IssueRecord, ScanSummary};
use devdoctor_core::detector::{DetectorMeta, ScanMode};
use devdoctor_core::engine::{ScanEngine, ScanProgress, ScanReport};
use devdoctor_core::fixer::{FixPreview, FixerRegistry};
use devdoctor_core::health::HealthScore;
use devdoctor_core::inventory::{git, homebrew, localai, node, processes, python, rust, ssh, storage, tools};
use devdoctor_core::issue::{Category, Issue, IssueBuilder, Severity};
use devdoctor_core::path_env::{build_path_report, PathReport, PathSource};
use devdoctor_core::paths::DevDoctorDirs;
use devdoctor_core::platform::{ListeningPort, OsInfo, Platform, ServiceInfo};
use devdoctor_core::resolve::{resolve_command, CommandResolution};
use devdoctor_core::schedule::{self, SnapshotSchedule};
use devdoctor_core::shell::{AliasDef, EvalRef, PathMutation, ShellConfigFile, ShellKind, SourceRef};
use devdoctor_core::snapshot::{self, Snapshot, SnapshotDiff, SnapshotOptions, SnapshotSummary};
use devdoctor_core::startup::{self, StartupProfile};
use devdoctor_core::tracking::{self, RunRecord, TrackingState};
use devdoctor_core::transaction::{MutationPolicy, Transaction, TransactionManager};
use devdoctor_core::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub use devdoctor_core;
pub use devdoctor_core::engine::ScanProgress as Progress;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Default)]
pub struct OpenOptions {
    pub dirs: Option<DevDoctorDirs>,
    pub context: ContextOptions,
}

pub struct DevDoctor {
    pub ctx: Arc<SystemContext>,
    pub db: Arc<Database>,
    pub dirs: DevDoctorDirs,
    engine: ScanEngine,
    fixers: FixerRegistry,
    tx: TransactionManager,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSummary {
    pub os: OsInfo,
    pub shell: String,
    pub shell_path: PathBuf,
    pub user: String,
    pub home: PathBuf,
    pub devdoctor_version: String,
    pub data_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueCounts {
    pub total: usize,
    pub problems: usize,
    pub warnings: usize,
    pub notes: usize,
    pub fixable: usize,
    pub batch_safe: usize,
    pub ignored: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Overview {
    pub system: SystemSummary,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health: Option<HealthScore>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_scan: Option<ScanSummary>,
    pub issues: IssueCounts,
    pub top_issues: Vec<Issue>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub baseline: Option<SnapshotSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_snapshot: Option<SnapshotSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recent_changes: Option<SnapshotDiff>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_total_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_scanned_at: Option<DateTime<Utc>>,
    pub recent_transactions: Vec<Transaction>,
    pub detector_count: usize,
    pub path_source: Option<PathSource>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueDetail {
    pub record: IssueRecord,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fixer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<FixPreview>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_error: Option<String>,
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellReport {
    pub shell: ShellKind,
    pub shell_path: PathBuf,
    pub files: Vec<ShellConfigFile>,
    pub mutations: Vec<PathMutation>,
    pub sources: Vec<SourceRef>,
    pub aliases: Vec<AliasDef>,
    pub evals: Vec<EvalRef>,
    pub path_source: PathSource,
    pub capture_warnings: Vec<String>,
    pub capture_duration_ms: u64,
    pub shell_functions: usize,
    pub shell_aliases: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortEntry {
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    pub address: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_only: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dev_process: Option<processes::DevProcess>,
    pub common_dev_port: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimesReport {
    pub node: node::NodeInventory,
    pub python: python::PythonInventory,
    pub rust: rust::RustInventory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackagesReport {
    pub managers: Vec<tools::PackageManager>,
    pub homebrew: homebrew::HomebrewInventory,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResults {
    pub issues: Vec<Issue>,
    pub commands: Vec<String>,
    pub pages: Vec<SearchPage>,
    pub ports: Vec<PortEntry>,
    pub detectors: Vec<DetectorMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPage {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub generated_at: DateTime<Utc>,
    pub devdoctor_version: String,
    pub sanitized: bool,
    pub included: Vec<String>,
    pub system: Value,
    pub last_scan: Option<Value>,
    pub path: Value,
    pub shell: Value,
    pub runtimes: Value,
    pub packages: Value,
    pub tools: Value,
    pub services: Value,
}

pub const PAGES: &[(&str, &str)] = &[
    ("overview", "Overview"),
    ("problems", "Problems"),
    ("shell", "Shell"),
    ("path", "PATH"),
    ("resolve", "Command resolution"),
    ("runtimes", "Runtimes"),
    ("packages", "Packages"),
    ("processes", "Processes"),
    ("ports", "Ports"),
    ("storage", "Storage"),
    ("localai", "Local AI"),
    ("services", "Services"),
    ("tools", "Developer tools"),
    ("git", "Git"),
    ("ssh", "SSH"),
    ("history", "History"),
    ("changes", "What changed"),
    ("settings", "Settings"),
];

/// The adapter for the operating system DevDoctor was built for.
#[cfg(target_os = "macos")]
fn real_platform(runner: Arc<dyn devdoctor_core::command::CommandRunner>) -> Arc<dyn Platform> {
    Arc::new(devdoctor_platform_macos::MacosPlatform::new(runner))
}

#[cfg(windows)]
fn real_platform(runner: Arc<dyn devdoctor_core::command::CommandRunner>) -> Arc<dyn Platform> {
    Arc::new(devdoctor_platform_windows::WindowsPlatform::new(runner))
}

#[cfg(not(any(target_os = "macos", windows)))]
compile_error!("DevDoctor currently supports macOS and Windows; a Linux adapter is planned (see docs/DECISIONS.md)");

impl DevDoctor {
    /// Opens DevDoctor for the current user with the real platform adapter.
    pub fn open(opts: OpenOptions) -> Result<Self> {
        let dirs = match opts.dirs {
            Some(d) => d,
            None => DevDoctorDirs::resolve()?,
        };
        dirs.ensure()?;
        let runner: Arc<dyn devdoctor_core::command::CommandRunner> = Arc::new(RealRunner);
        let platform = real_platform(runner.clone());
        let ctx = SystemContext::detect(platform, runner, dirs.clone(), opts.context)?;
        let db = Database::open(&dirs.db_path)?;
        Ok(Self::assemble(ctx, db, dirs))
    }

    /// Builds an instance around a prepared context and database (tests).
    pub fn assemble(ctx: SystemContext, db: Database, dirs: DevDoctorDirs) -> Self {
        let ctx = Arc::new(ctx);
        let db = Arc::new(db);
        let mut engine = ScanEngine::new();
        devdoctor_detectors::register_all(&mut engine);
        let fixers = devdoctor_fixers::registry();
        let policy = MutationPolicy::for_context(&ctx);
        let tx = TransactionManager::new(db.clone(), BackupStore::new(dirs.backups_dir.clone()), policy);
        Self { ctx, db, dirs, engine, fixers, tx }
    }

    pub fn detectors(&self) -> Vec<DetectorMeta> {
        self.engine.detectors().iter().map(|d| d.meta()).collect()
    }

    pub fn system(&self) -> SystemSummary {
        SystemSummary {
            os: self.ctx.os.clone(),
            shell: self.ctx.shell.name().to_string(),
            shell_path: self.ctx.shell_path.clone(),
            user: self.ctx.user.clone(),
            home: self.ctx.home.clone(),
            devdoctor_version: VERSION.to_string(),
            data_dir: self.dirs.data_dir.clone(),
        }
    }

    // ----- scanning -----

    pub fn scan(&self, mode: ScanMode, progress: &mut dyn FnMut(ScanProgress)) -> Result<ScanReport> {
        // Always start from fresh shell state so consecutive scans see edits, and re-measure
        // storage when the scan includes storage detectors.
        self.ctx.refresh_shell_capture();
        if mode != ScanMode::Quick {
            self.ctx.invalidate_storage_report();
        }
        let ignored: HashSet<String> = self.db.ignored_issues()?.into_iter().map(|i| i.issue_id).collect();
        let report = self.engine.run(&self.ctx, mode, &self.fixers, &ignored, progress);
        self.db.insert_scan(&report)?;
        if let Err(e) = self.record_snapshot_after_scan(mode) {
            tracing::warn!(error = %e, "could not record post-scan snapshot");
        }
        Ok(report)
    }

    fn record_snapshot_after_scan(&self, mode: ScanMode) -> Result<Option<Snapshot>> {
        if let Some(measured) = self.ctx.cached_storage_report() {
            self.db.set_setting("last_storage_report", &serde_json::to_value(measured.as_ref())?)?;
        }
        let storage = if mode != ScanMode::Quick { self.last_storage_report()? } else { None };
        let snapshot = snapshot::collect(
            &self.ctx,
            &SnapshotOptions { kind: "scan", label: None, storage: storage.as_ref(), quick: mode == ScanMode::Quick },
        );
        if let Some(latest_id) = self.db.latest_snapshot_id(None)? {
            if let Some(latest) = self.db.snapshot(&latest_id)? {
                if latest.content_hash() == snapshot.content_hash() {
                    return Ok(None);
                }
            }
        }
        self.db.insert_snapshot(&snapshot)?;
        Ok(Some(snapshot))
    }

    pub fn last_report(&self) -> Result<Option<ScanReport>> {
        self.db.latest_scan_report()
    }

    pub fn scans(&self, limit: usize) -> Result<Vec<ScanSummary>> {
        self.db.list_scans(limit)
    }

    // ----- issues -----

    pub fn issues(&self, include_ignored: bool) -> Result<Vec<IssueRecord>> {
        let mut records = self.db.open_issues()?;
        if !include_ignored {
            records.retain(|r| !r.ignored);
        }
        records.sort_by(|a, b| {
            b.issue
                .severity
                .cmp(&a.issue.severity)
                .then(b.issue.confidence.cmp(&a.issue.confidence))
                .then(a.issue.title.cmp(&b.issue.title))
        });
        Ok(records)
    }

    pub fn issue(&self, id: &str) -> Result<IssueRecord> {
        self.db.issue(id)?.ok_or_else(|| Error::NotFound(format!("issue {id}")))
    }

    pub fn issue_detail(&self, id: &str, with_preview: bool) -> Result<IssueDetail> {
        let record = self.issue(id)?;
        let fixer = self.fixers.for_issue(&record.issue);
        let (preview, preview_error) = match (&fixer, with_preview) {
            (Some(f), true) => match f.preview(&record.issue, &self.ctx) {
                Ok(p) => (Some(p), None),
                Err(e) => (None, Some(e.to_string())),
            },
            _ => (None, None),
        };
        let transactions =
            self.db.list_transactions(200)?.into_iter().filter(|t| t.issue_id.as_deref() == Some(record.issue.id.as_str())).collect();
        Ok(IssueDetail { fixer_name: fixer.map(|f| f.name().to_string()), record, preview, preview_error, transactions })
    }

    pub fn preview_fix(&self, id: &str) -> Result<FixPreview> {
        let record = self.issue(id)?;
        let fixer = self
            .fixers
            .for_issue(&record.issue)
            .ok_or_else(|| Error::FixUnavailable(format!("no fixer handles `{}`", record.issue.title)))?;
        fixer.preview(&record.issue, &self.ctx)
    }

    pub fn apply_fix(&self, id: &str) -> Result<Transaction> {
        let record = self.issue(id)?;
        let fixer = self
            .fixers
            .for_issue(&record.issue)
            .ok_or_else(|| Error::FixUnavailable(format!("no fixer handles `{}`", record.issue.title)))?;
        let tx = self.tx.apply(fixer.as_ref(), &record.issue, &self.ctx)?;
        self.ctx.refresh_shell_capture();
        Ok(tx)
    }

    /// Issues eligible for "Fix safe issues".
    pub fn batch_safe_issues(&self) -> Result<Vec<IssueRecord>> {
        Ok(self.issues(false)?.into_iter().filter(|r| r.issue.batch_safe && r.issue.fixer_available).collect())
    }

    pub fn rollback(&self, tx_id: &str, force: bool) -> Result<Transaction> {
        let tx = self.tx.rollback(tx_id, force)?;
        self.ctx.refresh_shell_capture();
        Ok(tx)
    }

    pub fn ignore_issue(&self, id: &str, reason: Option<&str>) -> Result<()> {
        let record = self.issue(id)?;
        self.db.ignore_issue(&record.issue.id, reason)
    }

    pub fn unignore_issue(&self, id: &str) -> Result<()> {
        let record = self.issue(id)?;
        self.db.unignore_issue(&record.issue.id)
    }

    pub fn transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        self.db.list_transactions(limit)
    }

    pub fn transaction(&self, id: &str) -> Result<Transaction> {
        self.db.transaction(id)?.ok_or_else(|| Error::NotFound(format!("transaction {id}")))
    }

    // ----- explorers -----

    pub fn path_report(&self) -> PathReport {
        build_path_report(&self.ctx)
    }

    pub fn resolve(&self, name: &str) -> Result<CommandResolution> {
        resolve_command(&self.ctx, name, true)
    }

    pub fn shell_report(&self) -> ShellReport {
        let capture = self.ctx.shell_capture();
        let analysis = self.ctx.shell_analysis();
        ShellReport {
            shell: self.ctx.shell,
            shell_path: self.ctx.shell_path.clone(),
            files: analysis.files.clone(),
            mutations: analysis.mutations.clone(),
            sources: analysis.sources.clone(),
            aliases: analysis.aliases.clone(),
            evals: analysis.evals.clone(),
            path_source: capture.path.source.clone(),
            capture_warnings: capture.warnings.clone(),
            capture_duration_ms: capture.duration_ms,
            shell_functions: capture.functions.len(),
            shell_aliases: capture.aliases.len(),
        }
    }

    pub fn shell_file_content(&self, path: &Path) -> Result<String> {
        let allowed: Vec<PathBuf> = devdoctor_core::shell::all_known_startup_files(&self.ctx.home).into_iter().map(|(p, _)| p).collect();
        if !allowed.iter().any(|p| p == path) {
            return Err(Error::Invalid("only shell startup files can be displayed".into()));
        }
        Ok(devdoctor_core::fs_util::read_to_string_opt(path)?.unwrap_or_default())
    }

    pub fn processes(&self) -> Result<Vec<processes::DevProcess>> {
        let procs = self.ctx.platform.processes()?;
        let ports = self.ctx.platform.listening_ports().unwrap_or_default();
        Ok(processes::dev_processes(&self.ctx, &procs, &ports))
    }

    pub fn ports(&self) -> Result<Vec<PortEntry>> {
        let ports: Vec<ListeningPort> = self.ctx.platform.listening_ports()?;
        let procs = self.ctx.platform.processes()?;
        let devs = processes::dev_processes(&self.ctx, &procs, &ports);
        let mut out: Vec<PortEntry> = Vec::new();
        for p in ports {
            if out.iter().any(|e| e.port == p.port && e.pid == p.pid) {
                continue;
            }
            out.push(PortEntry {
                port: p.port,
                pid: p.pid,
                process_name: p.process_name.clone(),
                address: p.address.clone(),
                local_only: p.local_only,
                dev_process: p.pid.and_then(|pid| devs.iter().find(|d| d.pid == pid).cloned()),
                common_dev_port: devdoctor_detectors::port::is_common_dev_port(p.port),
            });
        }
        out.sort_by_key(|e| e.port);
        Ok(out)
    }

    /// Stops a process from the Processes/Ports pages. Goes through the same fixer and
    /// transaction machinery as issue fixes.
    pub fn stop_process(&self, pid: u32) -> Result<Transaction> {
        let devs = self.processes()?;
        let p = devs
            .into_iter()
            .find(|d| d.pid == pid)
            .ok_or_else(|| Error::NotFound(format!("developer process {pid} (only classified developer processes can be stopped)")))?;
        if !p.stoppable {
            return Err(Error::Invalid(p.not_stoppable_reason.unwrap_or_else(|| "process cannot be stopped".into())));
        }
        let issue = IssueBuilder::new(
            "manual.process.stop",
            Category::Processes,
            format!("{}:{}", p.pid, p.run_time_secs.unwrap_or(0)),
            format!("Stop {} (pid {})", p.name, p.pid),
        )
        .severity(Severity::Info)
        .description("Requested from the Processes page.")
        .metadata(json!({ "pid": p.pid, "name": p.name, "command": p.command, "stoppable": true }))
        .fixer("process.stop_user_dev_process")
        .build();
        let fixer = self.fixers.by_id("process.stop_user_dev_process").ok_or_else(|| Error::FixUnavailable("stop fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &issue, &self.ctx)
    }

    pub fn preview_stop_process(&self, pid: u32) -> Result<FixPreview> {
        let devs = self.processes()?;
        let p = devs.into_iter().find(|d| d.pid == pid).ok_or_else(|| Error::NotFound(format!("developer process {pid}")))?;
        let issue =
            IssueBuilder::new("manual.process.stop", Category::Processes, p.pid.to_string(), format!("Stop {} (pid {})", p.name, p.pid))
                .metadata(json!({ "pid": p.pid, "name": p.name, "command": p.command, "stoppable": p.stoppable }))
                .build();
        let fixer = self.fixers.by_id("process.stop_user_dev_process").ok_or_else(|| Error::FixUnavailable("stop fixer missing".into()))?;
        fixer.preview(&issue, &self.ctx)
    }

    pub fn storage(&self, scan_projects: bool, progress: &mut dyn FnMut(storage::StorageProgress)) -> Result<storage::StorageReport> {
        let report = storage::scan(&self.ctx, &storage::StorageOptions { scan_projects, ..Default::default() }, progress);
        self.db.set_setting("last_storage_report", &serde_json::to_value(&report)?)?;
        if scan_projects {
            self.ctx.set_storage_report(report.clone());
        }
        Ok(report)
    }

    pub fn last_storage_report(&self) -> Result<Option<storage::StorageReport>> {
        match self.db.get_setting("last_storage_report")? {
            Some(v) => Ok(serde_json::from_value(v).ok()),
            None => Ok(None),
        }
    }

    fn node_modules_issue(&self, path: &Path) -> Result<Issue> {
        let report = self.last_storage_report()?.ok_or_else(|| Error::Invalid("run a storage scan first".into()))?;
        let nm =
            report.node_modules.iter().find(|n| n.path == path).ok_or_else(|| {
                Error::NotFound(format!("{} is not a node_modules directory found by the last storage scan", path.display()))
            })?;
        Ok(IssueBuilder::new(
            "storage.node_modules",
            Category::Disk,
            nm.path.display().to_string(),
            format!("Delete node_modules of {}", nm.project_name),
        )
        .severity(Severity::Info)
        .metadata(json!({ "path": nm.path, "project_path": nm.project_path, "recreate_command": nm.recreate_command, "bytes": nm.bytes }))
        .fixer("storage.delete_node_modules")
        .build())
    }

    pub fn preview_delete_node_modules(&self, path: &Path) -> Result<FixPreview> {
        let issue = self.node_modules_issue(path)?;
        let fixer = self.fixers.by_id("storage.delete_node_modules").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        fixer.preview(&issue, &self.ctx)
    }

    pub fn delete_node_modules(&self, path: &Path) -> Result<Transaction> {
        let issue = self.node_modules_issue(path)?;
        let fixer = self.fixers.by_id("storage.delete_node_modules").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &issue, &self.ctx)
    }

    fn venv_issue(&self, path: &Path) -> Result<Issue> {
        let report = self.last_storage_report()?.ok_or_else(|| Error::Invalid("run a storage scan first".into()))?;
        let venv =
            report.venvs.iter().find(|v| v.path == path).ok_or_else(|| {
                Error::NotFound(format!("{} is not a virtual environment found by the last storage scan", path.display()))
            })?;
        Ok(IssueBuilder::new("storage.venv", Category::Disk, venv.path.display().to_string(), format!("Delete virtual environment {}", self.ctx.display_path(&venv.path)))
            .severity(Severity::Info)
            .metadata(json!({ "path": venv.path, "project_path": venv.project_path, "bytes": venv.bytes, "python_version": venv.python_version, "broken": venv.broken }))
            .fixer("storage.delete_venv")
            .build())
    }

    pub fn preview_delete_venv(&self, path: &Path) -> Result<FixPreview> {
        let issue = self.venv_issue(path)?;
        let fixer = self.fixers.by_id("storage.delete_venv").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        fixer.preview(&issue, &self.ctx)
    }

    pub fn delete_venv(&self, path: &Path) -> Result<Transaction> {
        let issue = self.venv_issue(path)?;
        let fixer = self.fixers.by_id("storage.delete_venv").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &issue, &self.ctx)
    }

    pub fn local_ai(&self) -> localai::LocalAiReport {
        localai::report(&self.ctx)
    }

    fn ollama_issue(&self, model: &str) -> Issue {
        IssueBuilder::new("ai.ollama.model", Category::AiTools, model, format!("Remove Ollama model {model}"))
            .severity(Severity::Info)
            .metadata(json!({ "model": model }))
            .fixer("ai.ollama.remove_model")
            .build()
    }

    pub fn preview_remove_ollama_model(&self, model: &str) -> Result<FixPreview> {
        let fixer = self.fixers.by_id("ai.ollama.remove_model").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        fixer.preview(&self.ollama_issue(model), &self.ctx)
    }

    pub fn remove_ollama_model(&self, model: &str) -> Result<Transaction> {
        let fixer = self.fixers.by_id("ai.ollama.remove_model").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &self.ollama_issue(model), &self.ctx)
    }

    pub fn runtimes(&self) -> RuntimesReport {
        RuntimesReport { node: node::inventory(&self.ctx), python: python::inventory(&self.ctx), rust: rust::inventory(&self.ctx, false) }
    }

    pub fn packages(&self, with_sizes: bool) -> PackagesReport {
        PackagesReport {
            managers: tools::package_managers(&self.ctx, with_sizes),
            homebrew: homebrew::inventory(
                &self.ctx,
                homebrew::HomebrewOptions { with_version: true, with_cache_size: with_sizes, with_doctor: false },
            ),
        }
    }

    pub fn tools(&self, with_sizes: bool) -> Vec<tools::DevTool> {
        tools::inventory(&self.ctx, with_sizes)
    }

    pub fn services(&self) -> Result<Vec<ServiceInfo>> {
        self.ctx.platform.services()
    }

    pub fn git(&self) -> git::GitReport {
        git::report(&self.ctx)
    }

    pub fn ssh(&self) -> ssh::SshReport {
        ssh::report(&self.ctx)
    }

    pub fn reveal(&self, path: &Path) -> Result<()> {
        if !path.exists() {
            return Err(Error::NotFound(path.display().to_string()));
        }
        self.ctx.platform.reveal_in_file_manager(path)
    }

    // ----- snapshots -----

    pub fn snapshots(&self, limit: usize) -> Result<Vec<SnapshotSummary>> {
        self.db.list_snapshots(limit)
    }

    pub fn snapshot(&self, id: &str) -> Result<Snapshot> {
        self.db.snapshot(id)?.ok_or_else(|| Error::NotFound(format!("snapshot {id}")))
    }

    pub fn baseline(&self) -> Result<Option<SnapshotSummary>> {
        Ok(self.db.list_snapshots(500)?.into_iter().rfind(|s| s.kind == "baseline"))
    }

    pub fn create_snapshot(&self, kind: &str, label: Option<String>, with_storage: bool) -> Result<Snapshot> {
        self.ctx.refresh_shell_capture();
        let storage = if with_storage { Some(self.storage(true, &mut |_| {})?) } else { self.last_storage_report()? };
        let snap = snapshot::collect(&self.ctx, &SnapshotOptions { kind, label, storage: storage.as_ref(), quick: false });
        self.db.insert_snapshot(&snap)?;
        Ok(snap)
    }

    /// Changes between two snapshots. Defaults: `from` = the snapshot before `to`,
    /// `to` = the latest snapshot. `from = "baseline"` compares against the baseline.
    pub fn changes(&self, from: Option<&str>, to: Option<&str>) -> Result<Option<SnapshotDiff>> {
        let to_id = match to {
            Some(t) => t.to_string(),
            None => match self.db.latest_snapshot_id(None)? {
                Some(id) => id,
                None => return Ok(None),
            },
        };
        let to_snap = self.snapshot(&to_id)?;
        let from_id = match from {
            Some("baseline") => match self.baseline()? {
                Some(b) => b.id,
                None => return Err(Error::NotFound("no baseline snapshot; create one with `devdoctor snapshot create --baseline`".into())),
            },
            Some(f) => f.to_string(),
            None => match self.db.snapshot_ids_before(&to_snap.id, 1)?.into_iter().next() {
                Some(id) => id,
                None => return Ok(None),
            },
        };
        if from_id == to_snap.id {
            return Ok(None);
        }
        let from_snap = self.snapshot(&from_id)?;
        Ok(Some(snapshot::diff(&from_snap, &to_snap)))
    }

    /// Changes since a point in time (compares the newest snapshot before `since` with the latest).
    pub fn changes_since(&self, since: DateTime<Utc>) -> Result<Option<SnapshotDiff>> {
        let snaps = self.db.list_snapshots(1000)?;
        let latest = match snaps.first() {
            Some(s) => s.id.clone(),
            None => return Ok(None),
        };
        let from = snaps.iter().find(|s| s.created_at <= since).map(|s| s.id.clone());
        match from {
            Some(f) if f != latest => self.changes(Some(&f), Some(&latest)),
            _ => Ok(None),
        }
    }

    // ----- startup profile -----

    /// Measures how long a new login shell takes to start (`samples` full starts) and, for zsh,
    /// traces one start to attribute the time to startup-file lines.
    pub fn startup_profile(&self, samples: usize, with_trace: bool) -> StartupProfile {
        self.ctx.refresh_shell_capture();
        startup::profile(&self.ctx, samples, with_trace)
    }

    // ----- install tracking (`devdoctor run`) -----

    /// Records the environment right before a command the user is about to run. The "before"
    /// snapshot is persisted immediately so it survives even if the command never returns.
    pub fn begin_tracking(&self, label: &str) -> Result<TrackingState> {
        let state = tracking::begin(&self.ctx, label, None);
        self.db.insert_snapshot(&state.before)?;
        Ok(state)
    }

    /// Records the environment after the command, stores the "after" snapshot and the run record
    /// (snapshot diff, startup-file diffs, new files, version changes).
    pub fn finish_tracking(
        &self,
        state: TrackingState,
        command: Vec<String>,
        cwd: Option<PathBuf>,
        exit_code: Option<i32>,
    ) -> Result<RunRecord> {
        let (after, record) = tracking::finish(&self.ctx, state, command, cwd, exit_code, None);
        self.db.insert_snapshot(&after)?;
        self.db.insert_run(&record)?;
        Ok(record)
    }

    pub fn runs(&self, limit: usize) -> Result<Vec<RunRecord>> {
        self.db.list_runs(limit)
    }

    /// A snapshot of the environment right now, not persisted (used by `devdoctor watch`).
    pub fn snapshot_now(&self, quick: bool) -> Snapshot {
        self.ctx.refresh_shell_capture();
        snapshot::collect(&self.ctx, &SnapshotOptions { kind: "watch", label: None, storage: None, quick })
    }

    pub fn diff_snapshots(&self, from: &Snapshot, to: &Snapshot) -> SnapshotDiff {
        snapshot::diff(from, to)
    }

    // ----- scheduled snapshots (launchd on macOS, Task Scheduler on Windows) -----

    pub fn snapshot_schedule(&self) -> SnapshotSchedule {
        schedule::status(&self.ctx)
    }

    fn schedule_issue(&self, hour: u8, minute: u8) -> Result<Issue> {
        let program = schedule::cli_binary(&self.ctx).ok_or_else(|| {
            Error::Invalid(
                format!("the `devdoctor` command line tool was not found in PATH; install it (for example `cargo install --path crates/devdoctor-cli`) so {} has a stable command to run", schedule::scheduler_name()),
            )
        })?;
        Ok(IssueBuilder::new("manual.schedule.install", Category::Services, "snapshot_agent", "Take a snapshot every day")
            .severity(Severity::Info)
            .description("Requested from the snapshot settings.")
            .metadata(json!({ "program": program, "hour": hour, "minute": minute, "data_dir": schedule::custom_data_dir(&self.ctx) }))
            .fixer("schedule.snapshot_agent.install")
            .build())
    }

    fn unschedule_issue(&self) -> Issue {
        IssueBuilder::new("manual.schedule.remove", Category::Services, "snapshot_agent", "Stop taking daily snapshots")
            .severity(Severity::Info)
            .description("Requested from the snapshot settings.")
            .fixer("schedule.snapshot_agent.remove")
            .build()
    }

    pub fn preview_schedule_snapshots(&self, hour: u8, minute: u8) -> Result<FixPreview> {
        let issue = self.schedule_issue(hour, minute)?;
        let fixer = self.fixers.by_id("schedule.snapshot_agent.install").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        fixer.preview(&issue, &self.ctx)
    }

    /// Installs (or rewrites) the LaunchAgent that takes a snapshot every day at `hour:minute`.
    pub fn schedule_snapshots(&self, hour: u8, minute: u8) -> Result<Transaction> {
        let issue = self.schedule_issue(hour, minute)?;
        let fixer = self.fixers.by_id("schedule.snapshot_agent.install").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &issue, &self.ctx)
    }

    pub fn preview_unschedule_snapshots(&self) -> Result<FixPreview> {
        let fixer = self.fixers.by_id("schedule.snapshot_agent.remove").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        fixer.preview(&self.unschedule_issue(), &self.ctx)
    }

    pub fn unschedule_snapshots(&self) -> Result<Transaction> {
        let fixer = self.fixers.by_id("schedule.snapshot_agent.remove").ok_or_else(|| Error::FixUnavailable("fixer missing".into()))?;
        self.tx.apply(fixer.as_ref(), &self.unschedule_issue(), &self.ctx)
    }

    pub fn run_record(&self, id: &str) -> Result<RunRecord> {
        self.db.run(id)?.ok_or_else(|| Error::NotFound(format!("run {id}")))
    }

    // ----- overview & search -----

    pub fn overview(&self) -> Result<Overview> {
        let last = self.db.latest_scan_report()?;
        let records = self.issues(true)?;
        let active: Vec<&IssueRecord> = records.iter().filter(|r| !r.ignored).collect();
        let counts = IssueCounts {
            total: active.len(),
            problems: active.iter().filter(|r| r.issue.is_problem()).count(),
            warnings: active.iter().filter(|r| r.issue.is_warning()).count(),
            notes: active.iter().filter(|r| r.issue.severity == Severity::Info).count(),
            fixable: active.iter().filter(|r| r.issue.fixer_available).count(),
            batch_safe: active.iter().filter(|r| r.issue.batch_safe).count(),
            ignored: records.iter().filter(|r| r.ignored).count(),
        };
        let top_issues: Vec<Issue> = active.iter().take(5).map(|r| r.issue.clone()).collect();
        let storage = self.last_storage_report()?;
        let recent_changes = self.changes(None, None).ok().flatten();
        Ok(Overview {
            system: self.system(),
            health: last.as_ref().map(|r| r.health.clone()),
            last_scan: self.db.latest_scan()?,
            issues: counts,
            top_issues,
            baseline: self.baseline()?,
            latest_snapshot: self.db.list_snapshots(1)?.into_iter().next(),
            recent_changes,
            storage_total_bytes: storage.as_ref().map(|s| s.total_bytes),
            storage_scanned_at: storage.as_ref().map(|s| s.generated_at),
            recent_transactions: self.db.list_transactions(5)?,
            detector_count: self.engine.detectors().len(),
            path_source: last.as_ref().map(|_| self.ctx.shell_capture().path.source.clone()),
            warnings: last.map(|r| r.warnings).unwrap_or_default(),
        })
    }

    pub fn search(&self, query: &str) -> Result<SearchResults> {
        let q = query.trim().to_ascii_lowercase();
        if q.is_empty() {
            return Ok(SearchResults {
                issues: Vec::new(),
                commands: Vec::new(),
                pages: Vec::new(),
                ports: Vec::new(),
                detectors: Vec::new(),
            });
        }
        let issues: Vec<Issue> = self
            .issues(false)?
            .into_iter()
            .map(|r| r.issue)
            .filter(|i| {
                i.title.to_ascii_lowercase().contains(&q)
                    || i.description.to_ascii_lowercase().contains(&q)
                    || i.detector_id.contains(&q)
                    || i.id.starts_with(&q)
                    || i.affected_commands.iter().any(|c| c.contains(&q))
            })
            .take(20)
            .collect();
        let known_commands = [
            "python", "python3", "pip", "pip3", "node", "npm", "npx", "pnpm", "yarn", "bun", "git", "gh", "ruby", "gem", "java", "cargo",
            "rustc", "rustup", "go", "claude", "codex", "gemini", "opencode", "aider", "ollama", "docker", "brew", "uv", "uvx", "pipx",
            "code", "cursor",
        ];
        let mut commands: Vec<String> = known_commands.iter().filter(|c| c.contains(q.as_str())).map(|c| c.to_string()).collect();
        if commands.is_empty() && devdoctor_core::resolve::validate_command_name(&q).is_ok() && self.ctx.find_program(&q).is_some() {
            commands.push(q.clone());
        }
        let pages: Vec<SearchPage> = PAGES
            .iter()
            .filter(|(id, label)| {
                id.contains(q.as_str())
                    || label.to_ascii_lowercase().contains(&q)
                    || (q.contains("zshrc") && *id == "shell")
                    || (q.contains("node_modules") && *id == "storage")
                    || (q.contains("change") && *id == "changes")
            })
            .map(|(id, label)| SearchPage { id: id.to_string(), label: label.to_string() })
            .collect();
        let port_query: Option<u16> = q.trim_start_matches("port").trim().parse().ok();
        let ports = match port_query {
            Some(p) => self.ports().unwrap_or_default().into_iter().filter(|e| e.port == p).collect(),
            None => Vec::new(),
        };
        let detectors: Vec<DetectorMeta> =
            self.detectors().into_iter().filter(|d| d.id.contains(q.as_str()) || d.name.to_ascii_lowercase().contains(&q)).collect();
        Ok(SearchResults { issues, commands, pages, ports, detectors })
    }

    // ----- settings -----

    /// User settings with defaults applied. Keys: `auto_scan_on_launch` (bool),
    /// `technical_details` (bool), `onboarding_done` (bool).
    pub fn settings(&self) -> Result<serde_json::Map<String, Value>> {
        let mut map = self.db.all_settings()?;
        map.remove("last_storage_report");
        for (key, default) in [("auto_scan_on_launch", json!(true)), ("technical_details", json!(false)), ("onboarding_done", json!(false))]
        {
            map.entry(key).or_insert(default);
        }
        Ok(map)
    }

    pub fn set_setting(&self, key: &str, value: Value) -> Result<()> {
        if key == "last_storage_report" {
            return Err(Error::Invalid("reserved setting".into()));
        }
        self.db.set_setting(key, &value)
    }

    // ----- export -----

    /// Writes sanitized JSON fixtures of every view the desktop app renders, so the frontend
    /// can run in a plain browser (design work, screenshots) without the Rust backend.
    pub fn export_demo(&self, dir: &Path) -> Result<Vec<PathBuf>> {
        std::fs::create_dir_all(dir).map_err(|e| Error::io(dir, e))?;
        let home = self.ctx.home.clone();
        let user = self.ctx.user.clone();
        let mut written = Vec::new();
        let mut write = |name: &str, value: Value| -> Result<()> {
            let mut v = value;
            sanitize_value(&mut v, &home, &user);
            let path = dir.join(format!("{name}.json"));
            std::fs::write(&path, serde_json::to_string_pretty(&v)?).map_err(|e| Error::io(&path, e))?;
            written.push(path);
            Ok(())
        };
        write("system", serde_json::to_value(self.system())?)?;
        write("overview", serde_json::to_value(self.overview()?)?)?;
        write("last_report", serde_json::to_value(self.last_report()?)?)?;
        write("issues", serde_json::to_value(self.issues(true)?)?)?;
        write("path", serde_json::to_value(self.path_report())?)?;
        write("shell", serde_json::to_value(self.shell_report())?)?;
        write("processes", serde_json::to_value(self.processes()?)?)?;
        write("ports", serde_json::to_value(self.ports()?)?)?;
        write("storage", serde_json::to_value(self.last_storage_report()?)?)?;
        write("localai", serde_json::to_value(self.local_ai())?)?;
        write("runtimes", serde_json::to_value(self.runtimes())?)?;
        write("packages", serde_json::to_value(self.packages(false))?)?;
        write("tools", serde_json::to_value(self.tools(false))?)?;
        write("services", serde_json::to_value(self.services()?)?)?;
        write("git", serde_json::to_value(self.git())?)?;
        write("ssh", serde_json::to_value(self.ssh())?)?;
        write("snapshots", serde_json::to_value(self.snapshots(50)?)?)?;
        write("changes", serde_json::to_value(self.changes(None, None)?)?)?;
        write("transactions", serde_json::to_value(self.transactions(100)?)?)?;
        write("scans", serde_json::to_value(self.scans(30)?)?)?;
        write("detectors", serde_json::to_value(self.detectors())?)?;
        write("settings", Value::Object(self.settings()?))?;
        let mut resolutions = serde_json::Map::new();
        for cmd in ["python", "python3", "pip3", "node", "npm", "git", "cargo", "claude", "brew", "docker"] {
            if let Ok(r) = self.resolve(cmd) {
                resolutions.insert(cmd.to_string(), serde_json::to_value(r)?);
            }
        }
        write("resolve", Value::Object(resolutions))?;
        let mut previews = serde_json::Map::new();
        for record in self.issues(false)? {
            if record.issue.fixer_available {
                if let Ok(p) = self.preview_fix(&record.issue.id) {
                    previews.insert(record.issue.id.clone(), serde_json::to_value(p)?);
                }
            }
        }
        write("previews", Value::Object(previews))?;
        write("startup", serde_json::to_value(self.startup_profile(3, true))?)?;
        write("runs", serde_json::to_value(self.runs(20)?)?)?;
        write("schedule", serde_json::to_value(self.snapshot_schedule())?)?;
        Ok(written)
    }

    /// A Markdown summary of the machine and its open issues, ready to paste into a bug report,
    /// a forum post or a chat. Sanitised like the JSON report: home paths become `~`, the
    /// username is replaced and likely secrets are redacted.
    pub fn markdown_report(&self) -> Result<String> {
        let home = self.ctx.home.clone();
        let user = self.ctx.user.clone();
        let clean = |text: &str| -> String {
            let mut v = Value::String(text.to_string());
            sanitize_value(&mut v, &home, &user);
            v.as_str().unwrap_or_default().to_string()
        };
        let system = self.system();
        let last = self.db.latest_scan()?;
        let issues = self.issues(false)?;
        let path = self.path_report();
        let runtimes = self.runtimes();
        let tools = self.tools(false);
        let mut md = String::new();
        let _ = writeln!(md, "## DevDoctor report");
        let _ = writeln!(md);
        let _ = writeln!(
            md,
            "- DevDoctor {} · {} {} ({}{}) · shell: {}",
            system.devdoctor_version,
            system.os.name,
            system.os.version,
            system.os.arch,
            if system.os.rosetta == Some(true) { ", under Rosetta" } else { "" },
            system.shell
        );
        let _ = writeln!(md, "- Generated: {}", Utc::now().format("%Y-%m-%d %H:%M UTC"));
        match &last {
            Some(scan) => {
                let _ = writeln!(
                    md,
                    "- Last scan: {} scan, {} open issue{}, health {}/100, {} checks run",
                    scan.mode,
                    issues.len(),
                    if issues.len() == 1 { "" } else { "s" },
                    scan.health_score.map(|h| h.to_string()).unwrap_or_else(|| "?".into()),
                    scan.detectors_run
                );
            }
            None => {
                let _ = writeln!(md, "- No scan recorded yet (run `devdoctor scan`)");
            }
        }
        let _ = writeln!(md);
        let _ = writeln!(md, "### Open issues");
        let _ = writeln!(md);
        if issues.is_empty() {
            let _ = writeln!(md, "None.");
        } else {
            let _ = writeln!(md, "| Severity | Confidence | Issue | Detector | Auto-fix |");
            let _ = writeln!(md, "| --- | --- | --- | --- | --- |");
            for r in &issues {
                let i = &r.issue;
                let _ = writeln!(
                    md,
                    "| {} | {} | {} | `{}` | {} |",
                    i.severity,
                    i.confidence,
                    clean(&i.title).replace('|', "\\|"),
                    i.detector_id,
                    if i.fixer_available {
                        if i.batch_safe {
                            "yes (safe)"
                        } else {
                            "yes"
                        }
                    } else {
                        "no"
                    }
                );
            }
            let problems: Vec<&IssueRecord> = issues.iter().filter(|r| r.issue.is_problem()).collect();
            if !problems.is_empty() {
                let _ = writeln!(md);
                let _ = writeln!(md, "#### Details of the problems");
                for r in problems {
                    let i = &r.issue;
                    let _ = writeln!(md);
                    let _ = writeln!(md, "**{}** (`{}`, id `{}`)", clean(&i.title), i.detector_id, i.id);
                    let _ = writeln!(md);
                    let _ = writeln!(md, "{}", clean(&i.description));
                    if !i.evidence.is_empty() {
                        let _ = writeln!(md);
                        for e in i.evidence.iter().take(6) {
                            let _ = writeln!(md, "- {}", clean(e));
                        }
                    }
                }
            }
        }
        let _ = writeln!(md);
        let _ =
            writeln!(md, "### PATH ({} entries, {} duplicate, {} missing)", path.entries.len(), path.duplicate_count, path.missing_count);
        let _ = writeln!(md);
        for e in &path.entries {
            let mut flags = Vec::new();
            if e.is_duplicate {
                flags.push("duplicate".to_string());
            }
            if !e.exists {
                flags.push("missing".to_string());
            }
            if let Some(s) = &e.suspicious {
                flags.push(s.clone());
            }
            let source = e
                .sources
                .first()
                .map(|s| format!("{}:{}", self.ctx.display_path(&s.file), s.line))
                .or_else(|| e.source_hint.clone())
                .unwrap_or_default();
            let _ = writeln!(
                md,
                "{}. `{}` — {}{}{}",
                e.position,
                clean(&e.raw),
                e.origin_label,
                if source.is_empty() { String::new() } else { format!(" — {}", clean(&source)) },
                if flags.is_empty() { String::new() } else { format!(" — **{}**", flags.join(", ")) }
            );
        }
        let _ = writeln!(md);
        let _ = writeln!(md, "### Runtimes");
        let _ = writeln!(md);
        let exe = |name: &str, x: &Option<devdoctor_core::resolve::Executable>| match x {
            Some(x) => format!(
                "- {name}: `{}` ({}{})",
                clean(&x.path.display().to_string()),
                x.origin_label,
                x.version.as_ref().map(|v| format!(", {v}")).unwrap_or_default()
            ),
            None => format!("- {name}: not found"),
        };
        let _ = writeln!(md, "{}", exe("node", &runtimes.node.active_node));
        let _ = writeln!(md, "{}", exe("npm", &runtimes.node.active_npm));
        let _ = writeln!(md, "{}", exe("python3", &runtimes.python.python3));
        let _ = writeln!(md, "{}", exe("pip3", &runtimes.python.pip3));
        let _ = writeln!(md, "{}", exe("cargo", &runtimes.rust.cargo));
        if runtimes.node.installations.len() > 1 {
            let _ = writeln!(
                md,
                "- Node.js installations: {}",
                runtimes
                    .node
                    .installations
                    .iter()
                    .map(|i| format!("{} ({})", i.label, i.version.clone().unwrap_or_default()))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        if runtimes.python.installations.len() > 1 {
            let _ = writeln!(
                md,
                "- Python installations: {}",
                runtimes
                    .python
                    .installations
                    .iter()
                    .map(|i| format!("{} ({})", i.label, i.version.clone().unwrap_or_default()))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        let installed: Vec<&tools::DevTool> = tools.iter().filter(|t| t.installed).collect();
        if !installed.is_empty() {
            let _ = writeln!(md);
            let _ = writeln!(md, "### Developer tools");
            let _ = writeln!(md);
            for t in installed {
                let _ = writeln!(
                    md,
                    "- {}{}{}",
                    t.name,
                    t.version.as_ref().map(|v| format!(" {v}")).unwrap_or_default(),
                    t.install_method.as_ref().map(|m| format!(" (via {m})")).unwrap_or_default()
                );
            }
        }
        let _ = writeln!(md);
        let _ = writeln!(md, "_Home paths shortened, username replaced and likely secrets redacted by DevDoctor. Generated with `devdoctor report --markdown`._");
        Ok(md)
    }

    /// A sanitized diagnostic report: home paths become `~`, the username is replaced, likely
    /// secrets are redacted.
    pub fn diagnostic_report(&self) -> Result<DiagnosticReport> {
        let mut report = DiagnosticReport {
            generated_at: Utc::now(),
            devdoctor_version: VERSION.to_string(),
            sanitized: true,
            included: vec![
                "system information (OS version, architecture, shell)".into(),
                "last scan results (issues, detector timings)".into(),
                "PATH entries and their origins".into(),
                "shell startup files (statements only, no file contents)".into(),
                "runtime, package manager and tool versions".into(),
                "startup services".into(),
            ],
            system: serde_json::to_value(self.system())?,
            last_scan: self.db.latest_scan_report()?.map(serde_json::to_value).transpose()?,
            path: serde_json::to_value(self.path_report())?,
            shell: serde_json::to_value(self.shell_report())?,
            runtimes: serde_json::to_value(self.runtimes())?,
            packages: serde_json::to_value(self.packages(false))?,
            tools: serde_json::to_value(self.tools(false))?,
            services: serde_json::to_value(self.services().unwrap_or_default())?,
        };
        let home = self.ctx.home.clone();
        let user = self.ctx.user.clone();
        for v in [
            &mut report.system,
            &mut report.path,
            &mut report.shell,
            &mut report.runtimes,
            &mut report.packages,
            &mut report.tools,
            &mut report.services,
        ] {
            sanitize_value(v, &home, &user);
        }
        if let Some(v) = report.last_scan.as_mut() {
            sanitize_value(v, &home, &user);
        }
        Ok(report)
    }
}

/// Sanitizes free text inside a JSON value: home paths become `~`, the username (as a path
/// component or a whole word) becomes `<user>`, e-mail addresses become `<email>`, likely
/// secrets are redacted.
pub fn sanitize_value(v: &mut Value, home: &Path, user: &str) {
    match v {
        Value::String(s) => {
            let mut out = devdoctor_core::redact::shorten_home(s, home);
            if !user.is_empty() && user.len() > 1 {
                out = out.replace(&format!("/Users/{user}"), "/Users/<user>").replace(&format!("/home/{user}"), "/home/<user>");
            }
            out = redact_emails(&out);
            if user.len() >= 3 {
                out = replace_word(&out, user, "<user>");
            }
            *s = devdoctor_core::redact::redact_text(&out);
        }
        Value::Array(a) => a.iter_mut().for_each(|x| sanitize_value(x, home, user)),
        Value::Object(o) => o.values_mut().for_each(|x| sanitize_value(x, home, user)),
        _ => {}
    }
}

/// Replaces whole-word occurrences of `word` (letters, digits and `_` count as word characters).
fn replace_word(text: &str, word: &str, replacement: &str) -> String {
    let is_word = |c: char| c.is_alphanumeric() || c == '_';
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(pos) = rest.find(word) {
        let before_ok = rest[..pos].chars().next_back().is_none_or(|c| !is_word(c));
        let after_ok = rest[pos + word.len()..].chars().next().is_none_or(|c| !is_word(c));
        out.push_str(&rest[..pos]);
        if before_ok && after_ok {
            out.push_str(replacement);
        } else {
            out.push_str(word);
        }
        rest = &rest[pos + word.len()..];
    }
    out.push_str(rest);
    out
}

fn redact_emails(text: &str) -> String {
    static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| regex::Regex::new(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}").expect("static regex"));
    re.replace_all(text, "<email>").into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use devdoctor_core::command::MockRunner;
    use devdoctor_core::platform::FakePlatform;

    fn app(home: &Path, path: &str) -> DevDoctor {
        let runner = Arc::new(MockRunner::new());
        runner.respond("zsh", devdoctor_core::command::CommandOutput::ok(""));
        let ctx = SystemContext::for_test(home, Arc::new(FakePlatform::new()), runner, path);
        let dirs = DevDoctorDirs::in_dir(&home.join(".devdoctor"));
        dirs.ensure().unwrap();
        DevDoctor::assemble(ctx, Database::open_in_memory().unwrap(), dirs)
    }

    #[test]
    fn scan_fix_rollback_vertical_slice() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path();
        let bin_a = home.join("a-bin");
        let bin_b = home.join("b-bin");
        std::fs::create_dir_all(&bin_a).unwrap();
        std::fs::create_dir_all(&bin_b).unwrap();
        let zshrc = home.join(".zshrc");
        let original = format!(
            "export PATH=\"{a}:$PATH\"\nexport PATH=\"{b}:$PATH\"\nexport PATH=\"{a}:$PATH\"\n",
            a = bin_a.display(),
            b = bin_b.display()
        );
        std::fs::write(&zshrc, &original).unwrap();
        let path = format!("{a}:{b}:{a}:/usr/bin:/bin", a = bin_a.display(), b = bin_b.display());
        let app = app(home, &path);

        let report = app.scan(ScanMode::Quick, &mut |_| {}).unwrap();
        let dup = report.issues.iter().find(|i| i.detector_id == "shell.path.duplicate").expect("duplicate detected");
        assert!(dup.fixer_available, "fix should be available: {:?}", dup.recommended_action);
        assert!(dup.reversible);
        assert!(dup.batch_safe);

        let preview = app.preview_fix(&dup.id).unwrap();
        assert_eq!(preview.files_modified.len(), 1);
        assert!(preview.files_modified[0].diff.contains(&format!("-export PATH=\"{}:$PATH\"", bin_a.display())));
        assert_eq!(std::fs::read_to_string(&zshrc).unwrap(), original, "preview must not modify the file");

        let tx = app.apply_fix(&dup.id).unwrap();
        assert_eq!(tx.status, devdoctor_core::transaction::TxStatus::Applied);
        assert_eq!(tx.backups.len(), 1);
        let fixed = std::fs::read_to_string(&zshrc).unwrap();
        assert_eq!(fixed, format!("export PATH=\"{b}:$PATH\"\nexport PATH=\"{a}:$PATH\"\n", a = bin_a.display(), b = bin_b.display()));
        assert!(app.issue(&dup.id).unwrap().resolved_at.is_some());

        let history = app.transactions(10).unwrap();
        assert_eq!(history.len(), 1);
        let rolled = app.rollback(&tx.id, false).unwrap();
        assert_eq!(rolled.status, devdoctor_core::transaction::TxStatus::RolledBack);
        assert_eq!(std::fs::read_to_string(&zshrc).unwrap(), original);
    }

    #[test]
    fn snapshots_and_changes() {
        let dir = tempfile::tempdir().unwrap();
        let app = app(dir.path(), "/usr/bin:/bin");
        let base = app.create_snapshot("baseline", Some("first".into()), false).unwrap();
        assert!(app.baseline().unwrap().is_some());
        std::fs::write(dir.path().join(".zshrc"), "export FOO=1\n").unwrap();
        app.ctx.refresh_shell_capture();
        let second = app.create_snapshot("manual", None, false).unwrap();
        let diff = app.changes(Some(&base.id), Some(&second.id)).unwrap().unwrap();
        assert!(diff.changes.iter().any(|c| c.category == "shell_file" && c.key == "~/.zshrc"));
        let overview = app.overview().unwrap();
        assert!(overview.baseline.is_some());
    }

    #[test]
    fn tracks_a_run_and_renders_markdown() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path();
        std::fs::write(home.join(".zshrc"), "export A=1\n").unwrap();
        let app = app(home, "/usr/bin:/bin");
        let state = app.begin_tracking("fake install").unwrap();
        std::fs::write(home.join(".zshrc"), "export A=1\nexport PATH=\"$HOME/.newtool/bin:$PATH\"\n").unwrap();
        std::fs::create_dir_all(home.join(".newtool/bin")).unwrap();
        let record = app.finish_tracking(state, vec!["sh".into(), "install.sh".into()], None, Some(0)).unwrap();
        assert!(record.changed_anything());
        assert_eq!(record.file_diffs.len(), 1);
        let listed = app.runs(10).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(app.run_record(&record.id[..8]).unwrap().id, record.id);
        assert_eq!(app.snapshots(10).unwrap().iter().filter(|s| s.kind.starts_with("run_")).count(), 2);

        let md = app.markdown_report().unwrap();
        assert!(md.starts_with("## DevDoctor report"));
        assert!(md.contains("### PATH"));
        assert!(!md.contains(&home.display().to_string()), "home paths are shortened in the Markdown report");
    }

    #[test]
    fn sanitizes_reports() {
        let mut v = json!({
            "path": "/Users/jane/.zshrc",
            "token": "OPENAI_API_KEY=sk-abcdefghijklmnop",
            "user": "jane",
            "cmd": "LOGNAME=jane node /tmp/x-jane-y/app.js --name janet",
            "email": "jane.doe@example.com",
        });
        sanitize_value(&mut v, Path::new("/Users/jane"), "jane");
        assert_eq!(v["path"], "~/.zshrc");
        assert!(!v["token"].as_str().unwrap().contains("sk-abcdefghijklmnop"));
        assert_eq!(v["user"], "<user>");
        assert_eq!(v["cmd"], "LOGNAME=<user> node /tmp/x-<user>-y/app.js --name janet", "whole words only");
        assert_eq!(v["email"], "<email>");
    }
}
