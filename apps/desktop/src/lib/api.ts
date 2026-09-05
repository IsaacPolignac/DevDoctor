import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { demoListen } from "./events";

export const inTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";

/** In the Tauri app every call goes to the Rust backend; in a plain browser the demo fixtures answer. */
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (inTauri) return tauriInvoke<T>(cmd, args);
  const { mockInvoke } = await import("./demo");
  return mockInvoke<T>(cmd, args ?? {});
}
import type {
  BatchFixResult, CommandResolution, DetectorMeta, DevProcess, DevTool, DiagnosticReport, FixPreview, GitReport, IssueDetail, IssueRecord,
  LocalAiReport, Overview, PackagesReport, PathReport, PortEntry, RunRecord, RuntimesReport, ScanMode, ScanProgress, ScanReport, ScanSummary,
  SearchResults, ServiceInfo, ShellReport, SnapshotDiff, SnapshotSchedule, SnapshotSummary, SshReport, StartupProfile, StorageProgress, StorageReport,
  SystemSummary, Transaction,
} from "./types";

export const api = {
  overview: () => invoke<Overview>("get_overview"),
  system: () => invoke<SystemSummary>("get_system"),
  runScan: (mode: ScanMode) => invoke<ScanReport>("run_scan", { mode }),
  lastReport: () => invoke<ScanReport | null>("get_last_report"),
  issues: (includeIgnored: boolean) => invoke<IssueRecord[]>("list_issues", { includeIgnored }),
  issue: (id: string, withPreview: boolean) => invoke<IssueDetail>("get_issue", { id, withPreview }),
  previewFix: (id: string) => invoke<FixPreview>("preview_fix", { id }),
  applyFix: (id: string) => invoke<Transaction>("apply_fix", { id }),
  safeFixes: () => invoke<IssueRecord[]>("list_safe_fixes"),
  applySafeFixes: (ids: string[]) => invoke<BatchFixResult[]>("apply_safe_fixes", { ids }),
  rollback: (id: string, force: boolean) => invoke<Transaction>("rollback_transaction", { id, force }),
  ignore: (id: string, reason?: string) => invoke<void>("ignore_issue", { id, reason: reason ?? null }),
  unignore: (id: string) => invoke<void>("unignore_issue", { id }),
  transactions: (limit = 100) => invoke<Transaction[]>("list_transactions", { limit }),
  scans: (limit = 30) => invoke<ScanSummary[]>("list_scans", { limit }),
  pathReport: () => invoke<PathReport>("get_path_report"),
  resolve: (name: string) => invoke<CommandResolution>("resolve_command", { name }),
  shellReport: () => invoke<ShellReport>("get_shell_report"),
  shellFile: (path: string) => invoke<string>("read_shell_file", { path }),
  processes: () => invoke<DevProcess[]>("list_processes"),
  ports: () => invoke<PortEntry[]>("list_ports"),
  previewStop: (pid: number) => invoke<FixPreview>("preview_stop_process", { pid }),
  stop: (pid: number) => invoke<Transaction>("stop_process", { pid }),
  scanStorage: (scanProjects: boolean) => invoke<StorageReport>("scan_storage", { scanProjects }),
  lastStorage: () => invoke<StorageReport | null>("get_last_storage"),
  previewDeleteNodeModules: (path: string) => invoke<FixPreview>("preview_delete_node_modules", { path }),
  deleteNodeModules: (path: string) => invoke<Transaction>("delete_node_modules", { path }),
  previewDeleteVenv: (path: string) => invoke<FixPreview>("preview_delete_venv", { path }),
  deleteVenv: (path: string) => invoke<Transaction>("delete_venv", { path }),
  localAi: () => invoke<LocalAiReport>("get_local_ai"),
  previewRemoveOllamaModel: (model: string) => invoke<FixPreview>("preview_remove_ollama_model", { model }),
  removeOllamaModel: (model: string) => invoke<Transaction>("remove_ollama_model", { model }),
  runtimes: () => invoke<RuntimesReport>("get_runtimes"),
  packages: (withSizes: boolean) => invoke<PackagesReport>("get_packages", { withSizes }),
  tools: (withSizes: boolean) => invoke<DevTool[]>("get_tools", { withSizes }),
  services: () => invoke<ServiceInfo[]>("get_services"),
  git: () => invoke<GitReport>("get_git"),
  ssh: () => invoke<SshReport>("get_ssh"),
  snapshots: (limit = 50) => invoke<SnapshotSummary[]>("list_snapshots", { limit }),
  createSnapshot: (kind: string, label: string | null, withStorage: boolean) => invoke<SnapshotSummary>("create_snapshot", { kind, label, withStorage }),
  changes: (from: string | null, to: string | null) => invoke<SnapshotDiff | null>("get_changes", { from, to }),
  search: (query: string) => invoke<SearchResults>("search", { query }),
  settings: () => invoke<Record<string, unknown>>("get_settings"),
  setSetting: (key: string, value: unknown) => invoke<void>("set_setting", { key, value }),
  detectors: () => invoke<DetectorMeta[]>("get_detectors"),
  reveal: (path: string) => invoke<void>("reveal_path", { path }),
  setWindowTheme: (theme: "system" | "light" | "dark") => (inTauri ? invoke<void>("set_window_theme", { theme }) : Promise.resolve()),
  exportReport: () => invoke<DiagnosticReport>("export_report"),
  exportMarkdownReport: () => invoke<string>("export_markdown_report"),
  startupProfile: (samples: number, withTrace: boolean) => invoke<StartupProfile>("get_startup_profile", { samples, withTrace }),
  runs: (limit = 50) => invoke<RunRecord[]>("list_runs", { limit }),
  snapshotSchedule: () => invoke<SnapshotSchedule>("get_snapshot_schedule"),
  previewScheduleSnapshots: (hour: number, minute: number) => invoke<FixPreview>("preview_schedule_snapshots", { hour, minute }),
  scheduleSnapshots: (hour: number, minute: number) => invoke<Transaction>("schedule_snapshots", { hour, minute }),
  previewUnscheduleSnapshots: () => invoke<FixPreview>("preview_unschedule_snapshots"),
  unscheduleSnapshots: () => invoke<Transaction>("unschedule_snapshots"),
};

export function onScanProgress(cb: (p: ScanProgress) => void): Promise<UnlistenFn> {
  if (!inTauri) return Promise.resolve(demoListen("scan-progress", (p) => cb(p as ScanProgress)));
  return listen<ScanProgress>("scan-progress", (e) => cb(e.payload));
}

export function onStorageProgress(cb: (p: StorageProgress) => void): Promise<UnlistenFn> {
  if (!inTauri) return Promise.resolve(demoListen("storage-progress", (p) => cb(p as StorageProgress)));
  return listen<StorageProgress>("storage-progress", (e) => cb(e.payload));
}

export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
