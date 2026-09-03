//! Tauri commands: thin wrappers around the shared `devdoctor` facade. No diagnostic logic
//! lives here; every command forwards to the same functions the CLI uses.

use devdoctor::devdoctor_core::detector::ScanMode;
use devdoctor::devdoctor_core::fixer::FixPreview;
use devdoctor::devdoctor_core::transaction::Transaction;
use devdoctor::{DevDoctor, OpenOptions};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    app: Arc<DevDoctor>,
}

type CmdResult<T> = Result<T, String>;

async fn blocking<T, F>(app: Arc<DevDoctor>, f: F) -> CmdResult<T>
where
    T: Send + 'static,
    F: FnOnce(&DevDoctor) -> devdoctor::devdoctor_core::Result<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || f(&app).map_err(|e| e.to_string())).await.map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct BatchFixResult {
    issue_id: String,
    title: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    transaction: Option<Transaction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
async fn get_overview(state: State<'_, AppState>) -> CmdResult<devdoctor::Overview> {
    blocking(state.app.clone(), |a| a.overview()).await
}

#[tauri::command]
async fn get_system(state: State<'_, AppState>) -> CmdResult<devdoctor::SystemSummary> {
    blocking(state.app.clone(), |a| Ok(a.system())).await
}

#[tauri::command]
async fn run_scan(state: State<'_, AppState>, handle: AppHandle, mode: String) -> CmdResult<devdoctor::devdoctor_core::engine::ScanReport> {
    let mode = ScanMode::parse(&mode).ok_or_else(|| format!("unknown scan mode `{mode}`"))?;
    blocking(state.app.clone(), move |a| {
        a.scan(mode, &mut |p| {
            let _ = handle.emit("scan-progress", &p);
        })
    })
    .await
}

#[tauri::command]
async fn get_last_report(state: State<'_, AppState>) -> CmdResult<Option<devdoctor::devdoctor_core::engine::ScanReport>> {
    blocking(state.app.clone(), |a| a.last_report()).await
}

#[tauri::command]
async fn list_issues(state: State<'_, AppState>, include_ignored: bool) -> CmdResult<Vec<devdoctor::devdoctor_core::db::IssueRecord>> {
    blocking(state.app.clone(), move |a| a.issues(include_ignored)).await
}

#[tauri::command]
async fn get_issue(state: State<'_, AppState>, id: String, with_preview: bool) -> CmdResult<devdoctor::IssueDetail> {
    blocking(state.app.clone(), move |a| a.issue_detail(&id, with_preview)).await
}

#[tauri::command]
async fn preview_fix(state: State<'_, AppState>, id: String) -> CmdResult<FixPreview> {
    blocking(state.app.clone(), move |a| a.preview_fix(&id)).await
}

#[tauri::command]
async fn apply_fix(state: State<'_, AppState>, id: String) -> CmdResult<Transaction> {
    blocking(state.app.clone(), move |a| a.apply_fix(&id)).await
}

#[tauri::command]
async fn list_safe_fixes(state: State<'_, AppState>) -> CmdResult<Vec<devdoctor::devdoctor_core::db::IssueRecord>> {
    blocking(state.app.clone(), |a| a.batch_safe_issues()).await
}

#[tauri::command]
async fn apply_safe_fixes(state: State<'_, AppState>, ids: Vec<String>) -> CmdResult<Vec<BatchFixResult>> {
    blocking(state.app.clone(), move |a| {
        let mut out = Vec::new();
        for id in ids {
            let title = a.issue(&id).map(|r| r.issue.title).unwrap_or_default();
            match a.apply_fix(&id) {
                Ok(tx) => out.push(BatchFixResult { issue_id: id, title, ok: true, transaction: Some(tx), error: None }),
                Err(e) => out.push(BatchFixResult { issue_id: id, title, ok: false, transaction: None, error: Some(e.to_string()) }),
            }
        }
        Ok(out)
    })
    .await
}

#[tauri::command]
async fn rollback_transaction(state: State<'_, AppState>, id: String, force: bool) -> CmdResult<Transaction> {
    blocking(state.app.clone(), move |a| a.rollback(&id, force)).await
}

#[tauri::command]
async fn ignore_issue(state: State<'_, AppState>, id: String, reason: Option<String>) -> CmdResult<()> {
    blocking(state.app.clone(), move |a| a.ignore_issue(&id, reason.as_deref())).await
}

#[tauri::command]
async fn unignore_issue(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    blocking(state.app.clone(), move |a| a.unignore_issue(&id)).await
}

#[tauri::command]
async fn list_transactions(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<Transaction>> {
    blocking(state.app.clone(), move |a| a.transactions(limit)).await
}

#[tauri::command]
async fn list_scans(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<devdoctor::devdoctor_core::db::ScanSummary>> {
    blocking(state.app.clone(), move |a| a.scans(limit)).await
}

#[tauri::command]
async fn get_path_report(state: State<'_, AppState>) -> CmdResult<devdoctor::devdoctor_core::path_env::PathReport> {
    blocking(state.app.clone(), |a| Ok(a.path_report())).await
}

#[tauri::command]
async fn resolve_command(state: State<'_, AppState>, name: String) -> CmdResult<devdoctor::devdoctor_core::resolve::CommandResolution> {
    blocking(state.app.clone(), move |a| a.resolve(&name)).await
}

#[tauri::command]
async fn get_shell_report(state: State<'_, AppState>) -> CmdResult<devdoctor::ShellReport> {
    blocking(state.app.clone(), |a| Ok(a.shell_report())).await
}

#[tauri::command]
async fn read_shell_file(state: State<'_, AppState>, path: String) -> CmdResult<String> {
    blocking(state.app.clone(), move |a| a.shell_file_content(&PathBuf::from(path))).await
}

#[tauri::command]
async fn list_processes(state: State<'_, AppState>) -> CmdResult<Vec<devdoctor::devdoctor_core::inventory::processes::DevProcess>> {
    blocking(state.app.clone(), |a| a.processes()).await
}

#[tauri::command]
async fn list_ports(state: State<'_, AppState>) -> CmdResult<Vec<devdoctor::PortEntry>> {
    blocking(state.app.clone(), |a| a.ports()).await
}

#[tauri::command]
async fn preview_stop_process(state: State<'_, AppState>, pid: u32) -> CmdResult<FixPreview> {
    blocking(state.app.clone(), move |a| a.preview_stop_process(pid)).await
}

#[tauri::command]
async fn stop_process(state: State<'_, AppState>, pid: u32) -> CmdResult<Transaction> {
    blocking(state.app.clone(), move |a| a.stop_process(pid)).await
}

#[tauri::command]
async fn scan_storage(
    state: State<'_, AppState>,
    handle: AppHandle,
    scan_projects: bool,
) -> CmdResult<devdoctor::devdoctor_core::inventory::storage::StorageReport> {
    blocking(state.app.clone(), move |a| {
        a.storage(scan_projects, &mut |p| {
            let _ = handle.emit("storage-progress", &p);
        })
    })
    .await
}

#[tauri::command]
async fn get_last_storage(state: State<'_, AppState>) -> CmdResult<Option<devdoctor::devdoctor_core::inventory::storage::StorageReport>> {
    blocking(state.app.clone(), |a| a.last_storage_report()).await
}

#[tauri::command]
async fn preview_delete_node_modules(state: State<'_, AppState>, path: String) -> CmdResult<FixPreview> {
    blocking(state.app.clone(), move |a| a.preview_delete_node_modules(&PathBuf::from(path))).await
}

#[tauri::command]
async fn delete_node_modules(state: State<'_, AppState>, path: String) -> CmdResult<Transaction> {
    blocking(state.app.clone(), move |a| a.delete_node_modules(&PathBuf::from(path))).await
}

#[tauri::command]
async fn get_local_ai(state: State<'_, AppState>) -> CmdResult<devdoctor::devdoctor_core::inventory::localai::LocalAiReport> {
    blocking(state.app.clone(), |a| Ok(a.local_ai())).await
}

#[tauri::command]
async fn preview_remove_ollama_model(state: State<'_, AppState>, model: String) -> CmdResult<FixPreview> {
    blocking(state.app.clone(), move |a| a.preview_remove_ollama_model(&model)).await
}

#[tauri::command]
async fn remove_ollama_model(state: State<'_, AppState>, model: String) -> CmdResult<Transaction> {
    blocking(state.app.clone(), move |a| a.remove_ollama_model(&model)).await
}

#[tauri::command]
async fn get_runtimes(state: State<'_, AppState>) -> CmdResult<devdoctor::RuntimesReport> {
    blocking(state.app.clone(), |a| Ok(a.runtimes())).await
}

#[tauri::command]
async fn get_packages(state: State<'_, AppState>, with_sizes: bool) -> CmdResult<devdoctor::PackagesReport> {
    blocking(state.app.clone(), move |a| Ok(a.packages(with_sizes))).await
}

#[tauri::command]
async fn get_tools(state: State<'_, AppState>, with_sizes: bool) -> CmdResult<Vec<devdoctor::devdoctor_core::inventory::tools::DevTool>> {
    blocking(state.app.clone(), move |a| Ok(a.tools(with_sizes))).await
}

#[tauri::command]
async fn get_services(state: State<'_, AppState>) -> CmdResult<Vec<devdoctor::devdoctor_core::platform::ServiceInfo>> {
    blocking(state.app.clone(), |a| a.services()).await
}

#[tauri::command]
async fn get_git(state: State<'_, AppState>) -> CmdResult<devdoctor::devdoctor_core::inventory::git::GitReport> {
    blocking(state.app.clone(), |a| Ok(a.git())).await
}

#[tauri::command]
async fn get_ssh(state: State<'_, AppState>) -> CmdResult<devdoctor::devdoctor_core::inventory::ssh::SshReport> {
    blocking(state.app.clone(), |a| Ok(a.ssh())).await
}

#[tauri::command]
async fn list_snapshots(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<devdoctor::devdoctor_core::snapshot::SnapshotSummary>> {
    blocking(state.app.clone(), move |a| a.snapshots(limit)).await
}

#[tauri::command]
async fn create_snapshot(
    state: State<'_, AppState>,
    kind: String,
    label: Option<String>,
    with_storage: bool,
) -> CmdResult<devdoctor::devdoctor_core::snapshot::SnapshotSummary> {
    blocking(state.app.clone(), move |a| {
        let snap = a.create_snapshot(&kind, label, with_storage)?;
        Ok(devdoctor::devdoctor_core::snapshot::SnapshotSummary {
            id: snap.id,
            kind: snap.kind,
            label: snap.label,
            created_at: snap.created_at,
            summary: snap.summary,
        })
    })
    .await
}

#[tauri::command]
async fn get_changes(
    state: State<'_, AppState>,
    from: Option<String>,
    to: Option<String>,
) -> CmdResult<Option<devdoctor::devdoctor_core::snapshot::SnapshotDiff>> {
    blocking(state.app.clone(), move |a| a.changes(from.as_deref(), to.as_deref())).await
}

#[tauri::command]
async fn search(state: State<'_, AppState>, query: String) -> CmdResult<devdoctor::SearchResults> {
    blocking(state.app.clone(), move |a| a.search(&query)).await
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> CmdResult<serde_json::Map<String, serde_json::Value>> {
    blocking(state.app.clone(), |a| a.settings()).await
}

#[tauri::command]
async fn set_setting(state: State<'_, AppState>, key: String, value: serde_json::Value) -> CmdResult<()> {
    blocking(state.app.clone(), move |a| a.set_setting(&key, value)).await
}

#[tauri::command]
async fn get_detectors(state: State<'_, AppState>) -> CmdResult<Vec<devdoctor::devdoctor_core::detector::DetectorMeta>> {
    blocking(state.app.clone(), |a| Ok(a.detectors())).await
}

#[tauri::command]
async fn reveal_path(state: State<'_, AppState>, path: String) -> CmdResult<()> {
    blocking(state.app.clone(), move |a| a.reveal(&PathBuf::from(path))).await
}

#[tauri::command]
async fn export_report(state: State<'_, AppState>) -> CmdResult<devdoctor::DiagnosticReport> {
    blocking(state.app.clone(), |a| a.diagnostic_report()).await
}

pub fn run() {
    let dirs = match devdoctor::devdoctor_core::paths::DevDoctorDirs::resolve() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("DevDoctor could not determine its data directory: {e}");
            std::process::exit(1);
        }
    };
    if let Some(guard) = devdoctor::devdoctor_core::logging::init(&dirs, None) {
        std::mem::forget(guard);
    }
    let app = match DevDoctor::open(OpenOptions::default()) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("DevDoctor could not start: {e}");
            std::process::exit(1);
        }
    };
    tauri::Builder::default()
        .manage(AppState { app: Arc::new(app) })
        .invoke_handler(tauri::generate_handler![
            get_overview,
            get_system,
            run_scan,
            get_last_report,
            list_issues,
            get_issue,
            preview_fix,
            apply_fix,
            list_safe_fixes,
            apply_safe_fixes,
            rollback_transaction,
            ignore_issue,
            unignore_issue,
            list_transactions,
            list_scans,
            get_path_report,
            resolve_command,
            get_shell_report,
            read_shell_file,
            list_processes,
            list_ports,
            preview_stop_process,
            stop_process,
            scan_storage,
            get_last_storage,
            preview_delete_node_modules,
            delete_node_modules,
            get_local_ai,
            preview_remove_ollama_model,
            remove_ollama_model,
            get_runtimes,
            get_packages,
            get_tools,
            get_services,
            get_git,
            get_ssh,
            list_snapshots,
            create_snapshot,
            get_changes,
            search,
            get_settings,
            set_setting,
            get_detectors,
            reveal_path,
            export_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DevDoctor");
}
