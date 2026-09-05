// TypeScript mirrors of the JSON produced by the Rust core. Keep in sync with
// crates/devdoctor-core and crates/devdoctor.

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "possible" | "likely" | "confirmed";
export type Category =
  | "shell" | "runtimes" | "package_managers" | "processes" | "ports" | "ai_tools"
  | "disk" | "git" | "ssh" | "containers" | "environment" | "services";
export type ScanMode = "quick" | "deep" | "storage";

export const CATEGORY_LABELS: Record<Category, string> = {
  shell: "Shell", runtimes: "Runtimes", package_managers: "Package Managers", processes: "Processes",
  ports: "Ports", ai_tools: "AI Tools", disk: "Disk", git: "Git", ssh: "SSH", containers: "Containers",
  environment: "Environment", services: "Services",
};
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export interface AffectedFile { path: string; line?: number; excerpt?: string }

export interface Issue {
  id: string; fingerprint: string; detector_id: string; category: Category; title: string;
  description: string; impact: string; technical_description: string; severity: Severity;
  confidence: Confidence; evidence: string[]; affected_files: AffectedFile[]; affected_commands: string[];
  current_state?: string; recommended_action: string; fixer_id?: string; fixer_available: boolean;
  reversible: boolean; batch_safe: boolean; created_at: string; metadata: unknown;
}

export interface IssueRecord { issue: Issue; first_seen_at: string; last_seen_at: string; resolved_at?: string; ignored: boolean }

export interface DetectorRun { id: string; name: string; category: Category; duration_ms: number; status: string; issues: number; error?: string }
export interface DetectorMeta { id: string; name: string; category: Category; description: string; modes: ScanMode[] }

export interface Contribution { issue_id: string; title: string; category: Category; severity: Severity; confidence: Confidence; penalty: number }
export interface CategoryHealth { category: Category; label: string; issues: number; problems: number; warnings: number; max_severity?: Severity; penalty: number; capped: boolean; checks_run: number }
export interface HealthScore {
  score: number; problems: number; warnings: number; notes: number; checks_passed: number; checks_total: number;
  contributions: Contribution[]; categories: CategoryHealth[]; explanation: string;
}

export interface ScanReport {
  id: string; mode: ScanMode; started_at: string; finished_at: string; duration_ms: number; issues: Issue[];
  ignored: Issue[]; detector_runs: DetectorRun[]; detectors_run: number; detectors_failed: number; health: HealthScore; warnings: string[];
}
export interface ScanSummary { id: string; mode: string; started_at: string; finished_at: string; duration_ms: number; detectors_run: number; detectors_failed: number; issue_count: number; health_score?: number }

export type ScanProgress =
  | { event: "started"; total: number; mode: ScanMode }
  | { event: "detector_started"; index: number; total: number; id: string; name: string }
  | { event: "detector_finished"; index: number; total: number; id: string; name: string; issues: number; duration_ms: number; failed: boolean }
  | { event: "finished"; issues: number; duration_ms: number };

export interface LineChange { line: number; kind: "removed" | "added" | "changed"; before?: string; after?: string }
export interface FileChange { path: string; before: string; after: string; diff: string; line_changes: LineChange[] }
export interface DirDeletion { path: string; bytes: number; entries: number }
export interface PlannedCommand { program: string; args: string[]; description: string }
export interface ProcessRef { pid: number; name: string; command: string }
export interface FixPreview {
  fixer_id: string; issue_id: string; title: string; summary: string; operations: string[]; files_modified: FileChange[];
  files_deleted: string[]; directories_deleted: DirDeletion[]; commands_executed: PlannedCommand[]; processes_stopped: ProcessRef[];
  services_stopped: string[]; estimated_disk_space_recovered: number; backup_created: boolean; risk: "low" | "medium" | "high";
  reversible: boolean; requires_confirmation: boolean; batch_safe: boolean; notes: string[]; validations: string[];
}

export interface ValidationCheck { name: string; passed: boolean; detail: string }
export interface ValidationReport { checks: ValidationCheck[] }
export type Operation =
  | { kind: "file_write"; path: string; before_sha256?: string; after_sha256: string; backup_id?: string; created: boolean }
  | { kind: "file_delete"; path: string; backup_id: string }
  | { kind: "dir_delete"; path: string; bytes: number; entries: number }
  | { kind: "process_stop"; pid: number; name: string; force: boolean }
  | { kind: "command"; program: string; args: string[]; exit_code?: number; description: string }
  | { kind: "symlink_delete"; path: string; target: string };
export interface BackupRecord { id: string; transaction_id?: string; original_path: string; stored_path: string; sha256: string; size: number; mode?: number; created_at: string }
export interface Transaction {
  id: string; issue_id?: string; fixer_id: string; title: string; status: "pending" | "applied" | "failed" | "rolled_back" | "rollback_failed";
  created_at: string; completed_at?: string; operations: Operation[]; backups: BackupRecord[]; preview?: FixPreview;
  validation?: ValidationReport; error?: string; disk_space_recovered: number; notes: string[];
}

export interface IssueDetail { record: IssueRecord; fixer_name?: string; preview?: FixPreview; preview_error?: string; transactions: Transaction[] }

export type PathSource = { kind: "login_shell"; shell: string } | { kind: "process_environment" } | { kind: "override" } | { kind: "registry" };
export interface PathAttribution { file: string; line: number; statement: string; op: string; conditional: boolean }
export interface PathEntry {
  position: number; raw: string; exists: boolean; is_dir: boolean; is_duplicate: boolean; duplicate_of?: number; executables?: number;
  writable?: boolean; origin: string; origin_label: string; sources: PathAttribution[]; source_hint?: string; suspicious?: string;
}
export interface PathReport { source: PathSource; raw: string; entries: PathEntry[]; duplicate_count: number; missing_count: number; warnings: string[]; capture_duration_ms: number }

export interface Executable { path: string; real_path?: string; is_symlink: boolean; path_position: number; directory: string; origin: string; origin_label: string; version?: string; shebang?: string }
export interface CommandResolution { command: string; alias?: string; shell_function: boolean; active?: Executable; others: Executable[]; precedence: { position: number; origin_label: string; path: string }[]; notes: string[]; conflict?: string }

export interface ShellConfigFile { path: string; role: string; exists: boolean; warnings: { line: number; message: string }[]; sha256?: string; size: number; mtime?: number; statement_count: number }
export interface PathMutation { file: string; line: number; end_line: number; op: string; components: { raw: string; text: string; expanded?: string; exists?: boolean; is_path_ref: boolean }[]; conditional: boolean; in_function: boolean; exclusive_line: boolean; raw: string; rewritable: boolean }
export interface SourceRef { file: string; line: number; raw: string; target_raw: string; expanded?: string; exists?: boolean; guarded: boolean; conditional: boolean; in_function: boolean }
export interface ShellReport {
  shell: string; shell_path: string; files: ShellConfigFile[]; mutations: PathMutation[]; sources: SourceRef[];
  aliases: { file: string; line: number; name: string; value_raw: string }[]; evals: { file: string; line: number; command: string; conditional: boolean }[];
  path_source: PathSource; capture_warnings: string[]; capture_duration_ms: number; shell_functions: number; shell_aliases: number;
}

export interface DevProcess {
  pid: number; parent_pid?: number; name: string; kind: string; kind_label: string; label: string; command: string; cwd?: string; project_path?: string;
  cpu_percent?: number; memory_bytes?: number; run_time_secs?: number; ports: number[]; orphaned: boolean; cwd_missing: boolean; stale: boolean; stale_reason?: string; owned_by_user: boolean;
  stoppable: boolean; not_stoppable_reason?: string;
}
export interface PortEntry { port: number; pid?: number; process_name?: string; address: string; local_only?: boolean; dev_process?: DevProcess; common_dev_port: boolean }

export interface StorageCategory { id: string; label: string; kind: string; paths: string[]; exists: boolean; bytes: number; files: number; recreatable: boolean; description: string; scan_ms: number }
export interface NodeModulesDir { path: string; project_path: string; project_name: string; bytes: number; files: number; package_manager?: string; last_activity?: string; last_activity_secs_ago?: number; recreate_command: string }
export interface VenvDir { path: string; project_path: string; bytes: number; python_version?: string; interpreter?: string; broken: boolean; last_activity_secs_ago?: number }
export interface BuildDir { path: string; project_path: string; tool: string; bytes: number }
export interface StorageReport {
  generated_at: string; duration_ms: number; categories: StorageCategory[]; total_bytes: number; node_modules: NodeModulesDir[]; node_modules_bytes: number;
  venvs: VenvDir[]; venvs_bytes: number; build_dirs: BuildDir[]; build_bytes: number; roots_scanned: string[]; projects_scanned: boolean;
}
export type StorageProgress = { event: "category"; id: string; label: string; index: number; total: number } | { event: "projects"; root: string } | { event: "finished"; duration_ms: number };

export interface OllamaModel { name: string; manifest_path: string; size: number; modified_at?: string; modified_secs_ago?: number; family?: string; parameter_size?: string; quantization?: string }
export interface OllamaInventory { installed: boolean; binary?: string; app_bundle_present: boolean; models_dir: string; models: OllamaModel[]; total_bytes: number; blob_bytes: number; orphan_blob_bytes: number; orphan_blobs: number; running: boolean }
export interface ModelEntry { name: string; path: string; bytes: number; last_used_secs_ago?: number; kind: string }
export interface LocalAiSource { id: string; label: string; root: string; present: boolean; bytes: number; models: ModelEntry[]; description: string }
export interface LocalAiReport { ollama: OllamaInventory; sources: LocalAiSource[]; total_bytes: number; duration_ms: number }

export interface NodeInstallation { source: string; label: string; binary: string; prefix: string; version?: string; active: boolean }
export interface NodeInventory { installations: NodeInstallation[]; active_node?: Executable; active_npm?: Executable; active_node_prefix?: string; active_npm_prefix?: string; npm_mismatch?: { node_prefix: string; npm_prefix: string; node_version?: string; npm_version?: string; npm_owner_node_version?: string }; managers: string[]; notes: string[] }
export interface PythonInstallation { source: string; label: string; binary: string; version?: string; active: boolean }
export interface PipMismatch { pip_command: string; pip_path: string; pip_interpreter: string; python_command: string; python_path: string; python_real_path?: string; python_version?: string; pip_python_version?: string }
export interface PythonInventory { installations: PythonInstallation[]; python?: Executable; python3?: Executable; pip?: Executable; pip3?: Executable; python_alias?: string; pip_mismatches: PipMismatch[]; python_python3_mismatch?: string; broken_links: string[]; notes: string[] }
export interface RustInventory { rustup_installed: boolean; rustup_home: string; cargo_home: string; cargo_bin_in_path: boolean; cargo?: Executable; rustc?: Executable; toolchains: { name: string; path: string }[]; default_toolchain?: string; installed_crates: { name: string; version: string; source: string }[]; notes: string[] }
export interface RuntimesReport { node: NodeInventory; python: PythonInventory; rust: RustInventory }

export interface PackageManager { id: string; name: string; installed: boolean; version?: string; binary?: string; location?: string; package_count?: number; cache_path?: string; cache_size?: number; notes: string[] }
export interface HomebrewInventory { installed: boolean; prefix?: string; expected_prefix: string; other_prefix?: string; brew_binary?: string; in_path: boolean; version?: string; formulae: { name: string; versions: string[]; linked: boolean }[]; casks: { name: string; versions: string[] }[]; broken_links: { link: string; target: string }[]; cache_dir: string; cache_size?: { allocated: number; files: number }; versioned_duplicates: string[][] }
export interface PackagesReport { managers: PackageManager[]; homebrew: HomebrewInventory }

export interface DevTool { id: string; name: string; installed: boolean; version?: string; binary?: string; install_method?: string; app_bundle?: string; config_paths: string[]; data_paths: string[]; disk_usage?: number; notes: string[] }
export interface ServiceInfo { label: string; kind: string; origin: string; plist_path: string; program?: string; program_arguments: string[]; run_at_load: boolean; keep_alive: boolean; loaded?: boolean; running_pid?: number; last_exit_status?: number; target_exists?: boolean; working_directory?: string }
export interface GitReport { git?: Executable; gh?: Executable; gh_config_present: boolean; config_files: string[]; user_name?: string; user_email?: string; default_branch?: string; credential_helpers: string[]; gpg_sign?: boolean; gpg_format?: string; signing_key?: string; excludes_file?: string; excludes_file_exists: boolean; alias_count: number; include_ifs: string[]; findings: string[] }
export interface SshReport { ssh_dir: string; ssh_dir_exists: boolean; ssh_dir_mode?: number; keys: { path: string; name: string; mode: number; mode_ok: boolean; has_public_key: boolean; key_type?: string; comment?: string }[]; config_path: string; config_exists: boolean; config_mode?: number; hosts: { patterns: string[]; line: number; hostname?: string; user?: string; identity_files: string[]; missing_identity_files: string[] }[]; duplicate_hosts: string[]; known_hosts_entries: number; agent_status: string; agent_identities: number; findings: string[] }

export interface SnapshotSummary { id: string; kind: string; label?: string; created_at: string; summary: { counts: Record<string, number>; path_entries?: number; storage_bytes?: number } }
export interface Change { category: string; key: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown; description: string }
export interface SnapshotDiff { from_id: string; to_id: string; from_at: string; to_at: string; changes: Change[]; categories: { category: string; label: string; added: number; removed: number; changed: number }[]; headline: string[] }

export interface SystemSummary { os: { name: string; version: string; build?: string; arch: string; rosetta?: boolean }; shell: string; shell_path: string; user: string; home: string; devdoctor_version: string; data_dir: string }
export interface Overview {
  system: SystemSummary; health?: HealthScore; last_scan?: ScanSummary;
  issues: { total: number; problems: number; warnings: number; notes: number; fixable: number; batch_safe: number; ignored: number };
  top_issues: Issue[]; baseline?: SnapshotSummary; latest_snapshot?: SnapshotSummary; recent_changes?: SnapshotDiff;
  storage_total_bytes?: number; storage_scanned_at?: string; recent_transactions: Transaction[]; detector_count: number; path_source?: PathSource; warnings: string[];
}
export interface SearchResults { issues: Issue[]; commands: string[]; pages: { id: string; label: string }[]; ports: PortEntry[]; detectors: DetectorMeta[] }
export interface DiagnosticReport { generated_at: string; devdoctor_version: string; sanitized: boolean; included: string[]; [key: string]: unknown }
export interface BatchFixResult { issue_id: string; title: string; ok: boolean; transaction?: Transaction; error?: string }

export type StartupRating = "fast" | "ok" | "slow" | "very_slow";
export interface StartupHotspot { file: string; line: number; statement: string; inclusive_ms: number; share_percent: number; hint?: string }
export interface StartupSource { name: string; display: string; kind: "file" | "function" | "eval"; self_ms: number; lines: number }
export interface StartupProfile {
  shell: string; measured_at: string; samples_ms: number[]; median_ms: number; min_ms: number; max_ms: number; rating: StartupRating;
  traced: boolean; trace_total_ms?: number; trace_lines: number; hotspots: StartupHotspot[]; sources: StartupSource[]; stderr_lines: string[]; notes: string[];
}

export interface TrackedFileDiff { path: string; kind: "created" | "modified" | "deleted"; diff: string; lines_added: number; lines_removed: number }
export interface DirectoryChanges { dir: string; added: string[]; removed: string[] }
export interface VersionChange { command: string; before?: string; after?: string; path?: string }
export interface SnapshotSchedule {
  installed: boolean; loaded: boolean; plist_path: string; program?: string; program_exists: boolean; hour?: number; minute?: number;
  last_run?: string; log_path: string; available_program?: string; notes: string[];
}

export interface RunRecord {
  id: string; command: string[]; label: string; cwd?: string; started_at: string; finished_at: string; duration_ms: number; exit_code?: number;
  before_snapshot_id: string; after_snapshot_id: string; diff: SnapshotDiff; file_diffs: TrackedFileDiff[]; directory_changes: DirectoryChanges[];
  version_changes: VersionChange[]; headline: string[];
}
