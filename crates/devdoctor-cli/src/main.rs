//! `devdoctor` — the command line interface. All diagnostics come from the shared
//! `devdoctor` facade; this file only parses arguments and renders results.

mod output;

use chrono::{Duration, Utc};
use clap::{Args, CommandFactory, Parser, Subcommand};
use devdoctor::devdoctor_core::context::ContextOptions;
use devdoctor::devdoctor_core::detector::ScanMode;
use devdoctor::devdoctor_core::engine::{ScanProgress, ScanReport};
use devdoctor::devdoctor_core::fixer::FixPreview;
use devdoctor::devdoctor_core::issue::Severity;
use devdoctor::devdoctor_core::paths::DevDoctorDirs;
use devdoctor::devdoctor_core::snapshot::{ChangeKind, SnapshotDiff};
use devdoctor::devdoctor_core::startup::StartupProfile;
use devdoctor::devdoctor_core::tracking::{display_command, RunRecord};
use devdoctor::devdoctor_core::transaction::Transaction;
use devdoctor::devdoctor_core::units::format_age_secs;
use devdoctor::{DevDoctor, OpenOptions};
use output::*;
use std::io::{IsTerminal, Write};
use std::path::PathBuf;
use std::process::ExitCode;

const EXIT_OK: u8 = 0;
const EXIT_ERROR: u8 = 1;
const EXIT_PROBLEMS: u8 = 2;
const EXIT_ABORTED: u8 = 3;

#[derive(Parser)]
#[command(name = "devdoctor", version, about = "Find what broke your development environment. Understand it. Fix it safely.", long_about = None)]
struct Cli {
    /// Print machine-readable JSON instead of text.
    #[arg(long, global = true)]
    json: bool,
    /// DevDoctor data directory (database, backups, logs). Defaults to ~/Library/Application Support/DevDoctor on macOS and %LOCALAPPDATA%\DevDoctor on Windows.
    #[arg(long, global = true, value_name = "DIR", env = "DEVDOCTOR_HOME")]
    data_dir: Option<PathBuf>,
    /// Do not start a login shell to capture PATH; use this process's PATH instead.
    #[arg(long, global = true)]
    no_shell: bool,
    /// Show log output on stderr (-v info, -vv debug).
    #[arg(short, long, global = true, action = clap::ArgAction::Count)]
    verbose: u8,
    #[command(subcommand)]
    command: Command,
}

#[derive(Args)]
struct Confirm {
    /// Skip the confirmation prompt.
    #[arg(short = 'y', long)]
    yes: bool,
}

#[derive(Subcommand)]
enum Command {
    /// Run a scan (quick by default) and list issues.
    Scan {
        /// Run every detector, including slow ones (brew doctor, storage).
        #[arg(long)]
        deep: bool,
        /// Run the developer storage detectors only.
        #[arg(long)]
        storage: bool,
        /// Exit with status 2 when an issue of this severity or higher exists (info, low, medium, high, critical).
        #[arg(long, value_name = "SEVERITY")]
        fail_on: Option<String>,
        /// Print one JSON object per progress event on stderr (used by the desktop app).
        #[arg(long)]
        progress: bool,
    },
    /// Quick scan with a health summary; exits 2 when problems are found.
    Doctor,
    /// List open issues from the last scans.
    Issues {
        /// Include ignored issues.
        #[arg(long)]
        all: bool,
    },
    /// Show one issue in detail, including the fix preview.
    Issue { id: String },
    /// Apply the fix for an issue (with preview and confirmation).
    Fix {
        id: String,
        /// Show the preview only; change nothing.
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Apply every fix that is safe, reversible and confirmed.
    FixSafe {
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Hide an issue from future results.
    Ignore {
        id: String,
        #[arg(long)]
        reason: Option<String>,
    },
    /// Stop ignoring an issue.
    Unignore { id: String },
    /// Undo a transaction from its backups.
    Rollback {
        id: String,
        /// Restore even if the files changed after the fix.
        #[arg(long)]
        force: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Explain every PATH entry (origin, duplicates, missing directories).
    Path,
    /// Show shell startup files, PATH statements, sources and aliases.
    Shell,
    /// Explain which executable runs for a command and which alternatives exist.
    Resolve { command: String },
    /// List development-related processes.
    Processes,
    /// List listening ports and the dev processes behind them.
    Ports,
    /// Stop a development process (SIGTERM, with confirmation).
    Stop {
        pid: u32,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Measure developer storage (caches, models, node_modules, virtualenvs).
    Storage {
        /// Skip walking project folders (node_modules, virtualenvs, build directories).
        #[arg(long)]
        no_projects: bool,
    },
    /// Local AI models and caches (Ollama, Hugging Face, MLX, LM Studio).
    Ai,
    /// Node.js, Python and Rust installations, and whether node/npm and python/pip agree.
    Runtimes,
    /// Remove re-creatable developer data found by the last storage scan (preview, confirmation).
    Clean {
        #[command(subcommand)]
        target: CleanCmd,
    },
    /// Installed developer tools and how they were installed.
    Tools,
    /// Package managers and Homebrew inventory.
    Packages,
    /// Startup services (launch agents, brew services).
    Services,
    /// Global Git configuration summary.
    Git,
    /// SSH keys, config and agent status (metadata only).
    Ssh,
    /// Environment snapshots.
    Snapshot {
        #[command(subcommand)]
        action: SnapshotCmd,
    },
    /// What changed between snapshots (default: the two most recent).
    Changes {
        /// Snapshot id, "baseline", or a duration such as 24h or 7d.
        #[arg(long)]
        since: Option<String>,
        /// Compare up to this snapshot id (default: latest).
        #[arg(long)]
        to: Option<String>,
    },
    /// Fix history (transactions), recorded runs and past scans.
    History,
    /// Export a sanitized diagnostic report (JSON by default, or Markdown to paste in a bug report).
    Report {
        /// Print a Markdown summary instead of JSON.
        #[arg(long)]
        markdown: bool,
    },
    /// Run a command (an installer, `brew install`, `curl ... | sh`) and report exactly what it changed.
    Run {
        /// The command and its arguments. Put `--` before it if it starts with a dash.
        #[arg(trailing_var_arg = true, allow_hyphen_values = true, required = true, num_args = 1..)]
        command: Vec<String>,
    },
    /// Watch your environment live: prints every change as it happens (install things in
    /// another terminal), and saves a summary when you press Ctrl-C.
    Watch {
        /// Seconds between two checks.
        #[arg(long, default_value_t = 5)]
        interval: u64,
    },
    /// Recorded runs (`devdoctor run`) and what each one changed.
    Runs {
        /// Show one run in detail (id or unique prefix).
        id: Option<String>,
    },
    /// Measure terminal startup time and find the slow lines in your startup files.
    Startup {
        /// Number of complete shell starts to time.
        #[arg(long, default_value_t = 3)]
        samples: usize,
        /// Skip the line-level trace (zsh only).
        #[arg(long)]
        no_trace: bool,
    },
    /// Print shell completions (zsh, bash, fish, elvish, powershell).
    Completions { shell: clap_complete::Shell },
    /// List available detectors.
    Detectors,
    /// Print the last scan report (used by the desktop app at launch).
    #[command(hide = true)]
    LastReport,
    /// Write sanitized JSON fixtures for the desktop UI's browser demo mode (development).
    #[command(hide = true)]
    DemoExport {
        /// Output directory (default: apps/desktop/src/demo).
        dir: Option<PathBuf>,
    },
}

#[derive(Subcommand)]
enum CleanCmd {
    /// Delete a project's node_modules folder found by the last `devdoctor storage` scan.
    NodeModules {
        path: PathBuf,
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Delete a Python virtual environment found by the last storage scan.
    Venv {
        path: PathBuf,
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Remove an Ollama model with `ollama rm`.
    OllamaModel {
        name: String,
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
}

#[derive(Subcommand)]
enum SnapshotCmd {
    /// List snapshots.
    List,
    /// Create a snapshot of the current environment.
    Create {
        #[arg(long)]
        label: Option<String>,
        /// Mark it as the baseline used by `changes --since baseline`.
        #[arg(long)]
        baseline: bool,
        /// Include a developer storage scan (slower).
        #[arg(long)]
        with_storage: bool,
    },
    /// Show the items of a snapshot.
    Show { id: String },
    /// Take a snapshot automatically every day (a user LaunchAgent; no sudo).
    Schedule {
        /// Hour of the day (0-23).
        #[arg(long, default_value_t = 12)]
        hour: u8,
        /// Minute (0-59).
        #[arg(long, default_value_t = 0)]
        minute: u8,
        /// Show what would be installed; change nothing.
        #[arg(long)]
        dry_run: bool,
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Remove the daily snapshot agent.
    Unschedule {
        #[command(flatten)]
        confirm: Confirm,
    },
    /// Whether daily snapshots are scheduled, and when they last ran.
    Status,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli) {
        Ok(code) => ExitCode::from(code),
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::from(EXIT_ERROR)
        }
    }
}

fn open(cli: &Cli) -> Result<DevDoctor, devdoctor::devdoctor_core::Error> {
    let dirs = cli.data_dir.as_ref().map(|d| DevDoctorDirs::in_dir(d));
    let stderr_level = match cli.verbose {
        0 => None,
        1 => Some("info"),
        _ => Some("debug"),
    };
    let resolved = match &dirs {
        Some(d) => d.clone(),
        None => DevDoctorDirs::resolve()?,
    };
    let _ = devdoctor::devdoctor_core::logging::init(&resolved, stderr_level).map(std::mem::forget);
    DevDoctor::open(OpenOptions { dirs, context: ContextOptions { capture_shell: !cli.no_shell, ..Default::default() } })
}

fn confirm(prompt: &str, yes: bool) -> Result<bool, devdoctor::devdoctor_core::Error> {
    if yes {
        return Ok(true);
    }
    if !std::io::stdin().is_terminal() {
        eprintln!("Refusing to modify the machine without confirmation in a non-interactive session. Re-run with --yes.");
        return Ok(false);
    }
    print!("{prompt} [y/N] ");
    let _ = std::io::stdout().flush();
    let mut answer = String::new();
    std::io::stdin().read_line(&mut answer).map_err(|e| devdoctor::devdoctor_core::Error::io("stdin", e))?;
    Ok(matches!(answer.trim().to_ascii_lowercase().as_str(), "y" | "yes"))
}

fn run(cli: Cli) -> Result<u8, devdoctor::devdoctor_core::Error> {
    let json = cli.json;
    if let Command::Completions { shell } = &cli.command {
        let mut cmd = Cli::command();
        clap_complete::generate(*shell, &mut cmd, "devdoctor", &mut std::io::stdout());
        return Ok(EXIT_OK);
    }
    let app = open(&cli)?;
    match &cli.command {
        Command::Scan { deep, storage, fail_on, progress } => {
            let mode = if *deep {
                ScanMode::Deep
            } else if *storage {
                ScanMode::Storage
            } else {
                ScanMode::Quick
            };
            let report = if *progress { run_scan_with_json_progress(&app, mode)? } else { run_scan(&app, mode, json)? };
            if json {
                print_json(&report);
            } else {
                print_scan(&report);
            }
            if let Some(threshold) = fail_on {
                let sev = Severity::parse(threshold)
                    .ok_or_else(|| devdoctor::devdoctor_core::Error::invalid(format!("unknown severity `{threshold}`")))?;
                if report.issues.iter().any(|i| i.severity >= sev) {
                    return Ok(EXIT_PROBLEMS);
                }
            }
            Ok(EXIT_OK)
        }
        Command::Doctor => {
            let report = run_scan(&app, ScanMode::Quick, json)?;
            if json {
                print_json(&report);
            } else {
                print_scan(&report);
            }
            Ok(if report.health.problems > 0 { EXIT_PROBLEMS } else { EXIT_OK })
        }
        Command::Issues { all } => {
            let records = app.issues(*all)?;
            if json {
                print_json(&records);
            } else if records.is_empty() {
                println!("No open issues. Run `devdoctor scan` to check again.");
            } else {
                let mut rows = vec![vec!["ID".into(), "SEV".into(), "CONF".into(), "CATEGORY".into(), "TITLE".into(), "FIX".into()]];
                for r in &records {
                    let mut line = issue_line(&r.issue);
                    if r.ignored {
                        line[4] = format!("(ignored) {}", line[4]);
                    }
                    rows.push(line);
                }
                print!("{}", table(&rows));
                println!("\n{} issue(s). Use `devdoctor issue <id>` for details.", records.len());
            }
            Ok(EXIT_OK)
        }
        Command::Issue { id } => {
            let detail = app.issue_detail(id, true)?;
            if json {
                print_json(&detail);
            } else {
                print_issue_detail(&app, &detail);
            }
            Ok(EXIT_OK)
        }
        Command::Fix { id, dry_run, confirm: c } => {
            let record = app.issue(id)?;
            let preview = app.preview_fix(&record.issue.id)?;
            if json && *dry_run {
                print_json(&preview);
                return Ok(EXIT_OK);
            }
            if !json {
                print_preview(&app, &preview);
            }
            if *dry_run {
                return Ok(EXIT_OK);
            }
            if !confirm("Apply this fix?", c.yes)? {
                if !json {
                    println!("Aborted; nothing changed.");
                }
                return Ok(EXIT_ABORTED);
            }
            let tx = app.apply_fix(&record.issue.id)?;
            if json {
                print_json(&tx);
            } else {
                print_transaction(&app, &tx);
                println!("\nUndo with: devdoctor rollback {}", tx.id);
            }
            Ok(EXIT_OK)
        }
        Command::FixSafe { dry_run, confirm: c } => {
            let candidates = app.batch_safe_issues()?;
            if candidates.is_empty() {
                if json {
                    print_json(&Vec::<Transaction>::new());
                } else {
                    println!("No safe fixes available.");
                }
                return Ok(EXIT_OK);
            }
            let mut previews = Vec::new();
            for r in &candidates {
                match app.preview_fix(&r.issue.id) {
                    Ok(p) => previews.push((r.issue.clone(), p)),
                    Err(e) => eprintln!("skipping {}: {e}", r.issue.id),
                }
            }
            if !json {
                for (issue, p) in &previews {
                    println!("{}", subheading(&format!("{} — {}", issue.id, issue.title)));
                    print_preview(&app, p);
                }
            } else if *dry_run {
                print_json(&previews.iter().map(|(_, p)| p).collect::<Vec<_>>());
                return Ok(EXIT_OK);
            }
            if *dry_run {
                return Ok(EXIT_OK);
            }
            if !confirm(&format!("Apply these {} safe fix(es)?", previews.len()), c.yes)? {
                return Ok(EXIT_ABORTED);
            }
            let mut results = Vec::new();
            for (issue, _) in &previews {
                match app.apply_fix(&issue.id) {
                    Ok(tx) => {
                        if !json {
                            println!("applied {}: {} ({})", issue.id, tx.title, tx.id);
                        }
                        results.push(serde_json::json!({ "issue_id": issue.id, "ok": true, "transaction": tx }));
                    }
                    Err(e) => {
                        if !json {
                            println!("failed {}: {e}", issue.id);
                        }
                        results.push(serde_json::json!({ "issue_id": issue.id, "ok": false, "error": e.to_string() }));
                    }
                }
            }
            if json {
                print_json(&results);
            }
            Ok(EXIT_OK)
        }
        Command::Ignore { id, reason } => {
            app.ignore_issue(id, reason.as_deref())?;
            if !json {
                println!("Issue {id} will be hidden from future scans. Undo with `devdoctor unignore {id}`.");
            }
            Ok(EXIT_OK)
        }
        Command::Unignore { id } => {
            app.unignore_issue(id)?;
            if !json {
                println!("Issue {id} is visible again.");
            }
            Ok(EXIT_OK)
        }
        Command::Rollback { id, force, confirm: c } => {
            let tx = app.transaction(id)?;
            if !json {
                print_transaction(&app, &tx);
                if !tx.can_rollback() {
                    println!("\nThis transaction cannot be rolled back (status {}, reversible: {}).", tx.status.as_str(), tx.reversible());
                    return Ok(EXIT_ERROR);
                }
            }
            if !confirm("Restore the files from their backups?", c.yes)? {
                return Ok(EXIT_ABORTED);
            }
            let result = app.rollback(&tx.id, *force)?;
            if json {
                print_json(&result);
            } else {
                println!("Rolled back {} — {} file(s) restored.", result.id, result.backups.len());
            }
            Ok(EXIT_OK)
        }
        Command::Path => {
            let report = app.path_report();
            if json {
                print_json(&report);
            } else {
                print_path(&app, &report);
            }
            Ok(EXIT_OK)
        }
        Command::Shell => {
            let report = app.shell_report();
            if json {
                print_json(&report);
            } else {
                print_shell(&app, &report);
            }
            Ok(EXIT_OK)
        }
        Command::Resolve { command } => {
            let res = app.resolve(command)?;
            if json {
                print_json(&res);
            } else {
                println!("{}", heading(&format!("Command: {}", res.command)));
                for n in &res.notes {
                    println!("note: {n}");
                }
                match &res.active {
                    Some(a) => {
                        println!("Active:\n  {}{}", a.path.display(), a.version.as_ref().map(|v| format!("\n  {v}")).unwrap_or_default());
                        if let Some(r) = &a.real_path {
                            println!("  → {}", r.display());
                        }
                        println!("  origin: {} (PATH position {})", a.origin_label, a.path_position);
                    }
                    None => println!("Not found in PATH."),
                }
                if !res.others.is_empty() {
                    println!("\nOther installations:");
                    for o in &res.others {
                        println!(
                            "  {}{}  [{}, PATH position {}]",
                            o.path.display(),
                            o.version.as_ref().map(|v| format!("  ({v})")).unwrap_or_default(),
                            o.origin_label,
                            o.path_position
                        );
                    }
                }
                if !res.precedence.is_empty() {
                    println!("\nPATH precedence:");
                    for (i, p) in res.precedence.iter().enumerate() {
                        println!("  {}  {}  ({})", i + 1, p.origin_label, p.path.display());
                    }
                }
                if let Some(c) = &res.conflict {
                    println!("\nPotential conflict:\n{}", wrap(c, 2, 90));
                }
            }
            Ok(EXIT_OK)
        }
        Command::Processes => {
            let procs = app.processes()?;
            if json {
                print_json(&procs);
            } else {
                let mut rows = vec![vec![
                    "PID".into(),
                    "NAME".into(),
                    "KIND".into(),
                    "MEM".into(),
                    "AGE".into(),
                    "PORTS".into(),
                    "PROJECT".into(),
                    "FLAGS".into(),
                ]];
                for p in &procs {
                    let mut flags = Vec::new();
                    if p.stale {
                        flags.push("stale");
                    } else if p.orphaned {
                        flags.push("no terminal");
                    }
                    if p.cwd_missing {
                        flags.push("cwd missing");
                    }
                    if !p.stoppable {
                        flags.push("protected");
                    }
                    rows.push(vec![
                        p.pid.to_string(),
                        truncate(&p.label, 28),
                        p.kind_label.clone(),
                        p.memory_bytes.map(bytes).unwrap_or_default(),
                        p.run_time_secs.map(|s| format_age_secs(s).replace(" ago", "")).unwrap_or_default(),
                        p.ports.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(","),
                        p.project_path.as_ref().map(|x| app.ctx.display_path(x)).unwrap_or_default(),
                        flags.join(", "),
                    ]);
                }
                print!("{}", table(&rows));
                println!("\n{} developer process(es). Stop one with `devdoctor stop <pid>`.", procs.len());
            }
            Ok(EXIT_OK)
        }
        Command::Ports => {
            let ports = app.ports()?;
            if json {
                print_json(&ports);
            } else {
                let mut rows = vec![vec!["PORT".into(), "PID".into(), "PROCESS".into(), "BIND".into(), "PROJECT".into(), "NOTE".into()]];
                for p in &ports {
                    rows.push(vec![
                        p.port.to_string(),
                        p.pid.map(|x| x.to_string()).unwrap_or_default(),
                        p.dev_process.as_ref().map(|d| d.label.clone()).or(p.process_name.clone()).unwrap_or_default(),
                        format!("{}{}", p.address, if p.local_only == Some(false) { " (exposed)" } else { "" }),
                        p.dev_process.as_ref().and_then(|d| d.project_path.as_ref()).map(|x| app.ctx.display_path(x)).unwrap_or_default(),
                        if p.dev_process.as_ref().is_some_and(|d| d.stale) { "stale?".into() } else { String::new() },
                    ]);
                }
                print!("{}", table(&rows));
            }
            Ok(EXIT_OK)
        }
        Command::Stop { pid, confirm: c } => {
            let preview = app.preview_stop_process(*pid)?;
            if !json {
                print_preview(&app, &preview);
            }
            if preview.is_noop() {
                return Ok(EXIT_OK);
            }
            if !confirm("Stop this process?", c.yes)? {
                return Ok(EXIT_ABORTED);
            }
            let tx = app.stop_process(*pid)?;
            if json {
                print_json(&tx);
            } else {
                print_transaction(&app, &tx);
            }
            Ok(EXIT_OK)
        }
        Command::Storage { no_projects } => {
            let quiet = json;
            let report = app.storage(!*no_projects, &mut |p| {
                if !quiet {
                    if let devdoctor::devdoctor_core::inventory::storage::StorageProgress::Category { label, index, total, .. } = &p {
                        eprint!("\r  measuring {label:<28} ({}/{})   ", index + 1, total);
                    }
                    if let devdoctor::devdoctor_core::inventory::storage::StorageProgress::Projects { root } = &p {
                        eprint!("\r  scanning projects in {:<40}", root.display());
                    }
                }
            })?;
            if !quiet {
                eprintln!("\r{:60}\r", "");
            }
            if json {
                print_json(&report);
            } else {
                println!("{}", heading("Developer storage"));
                let mut rows = vec![vec!["CATEGORY".into(), "SIZE".into(), "FILES".into(), "RECREATABLE".into(), "PATH".into()]];
                for c in report.categories.iter().filter(|c| c.exists) {
                    rows.push(vec![
                        c.label.clone(),
                        bytes(c.bytes),
                        c.files.to_string(),
                        if c.recreatable { "yes".into() } else { "no".into() },
                        c.paths.iter().map(|p| app.ctx.display_path(p)).collect::<Vec<_>>().join(", "),
                    ]);
                }
                if report.projects_scanned {
                    rows.push(vec![
                        "node_modules".into(),
                        bytes(report.node_modules_bytes),
                        String::new(),
                        "yes".into(),
                        format!("{} directories", report.node_modules.len()),
                    ]);
                    rows.push(vec![
                        "Python environments".into(),
                        bytes(report.venvs_bytes),
                        String::new(),
                        "yes".into(),
                        format!("{} virtualenvs", report.venvs.len()),
                    ]);
                    rows.push(vec![
                        "Build directories".into(),
                        bytes(report.build_bytes),
                        String::new(),
                        "yes".into(),
                        format!("{} directories", report.build_dirs.len()),
                    ]);
                }
                print!("{}", table(&rows));
                println!("\nTotal developer storage: {} (measured in {})", bytes(report.total_bytes), ms(report.duration_ms));
                if !report.node_modules.is_empty() {
                    println!("{}", subheading("Largest node_modules"));
                    for nm in report.node_modules.iter().take(15) {
                        println!(
                            "  {:>9}  {}  {}{}",
                            bytes(nm.bytes),
                            app.ctx.display_path(&nm.project_path),
                            nm.package_manager.clone().unwrap_or_default(),
                            nm.last_activity_secs_ago.map(|s| format!("  (last activity {})", format_age_secs(s))).unwrap_or_default()
                        );
                    }
                }
                if !report.venvs.is_empty() {
                    println!("{}", subheading("Python environments"));
                    for v in report.venvs.iter().take(15) {
                        println!(
                            "  {:>9}  {}{}",
                            bytes(v.bytes),
                            app.ctx.display_path(&v.path),
                            if v.broken { "  (broken: interpreter missing)" } else { "" }
                        );
                    }
                }
            }
            Ok(EXIT_OK)
        }
        Command::Ai => {
            let report = app.local_ai();
            if json {
                print_json(&report);
            } else {
                println!("{}", heading("Local AI"));
                let o = &report.ollama;
                println!("Ollama: {}{}", if o.installed { "installed" } else { "not found" }, if o.running { " (running)" } else { "" });
                if !o.models.is_empty() {
                    println!("  {} models, {} in {}", o.models.len(), bytes(o.total_bytes), app.ctx.display_path(&o.models_dir));
                    for m in &o.models {
                        println!(
                            "    {:>9}  {}{}",
                            bytes(m.size),
                            m.name,
                            m.modified_secs_ago.map(|s| format!("  (modified {})", format_age_secs(s))).unwrap_or_default()
                        );
                    }
                }
                for s in &report.sources {
                    if !s.present {
                        continue;
                    }
                    println!("\n{}: {} ({})", s.label, bytes(s.bytes), app.ctx.display_path(&s.root));
                    for m in s.models.iter().take(20) {
                        println!("    {:>9}  {}", bytes(m.bytes), m.name);
                    }
                }
                println!("\nTotal: {}", bytes(report.total_bytes));
            }
            Ok(EXIT_OK)
        }
        Command::Runtimes => {
            let r = app.runtimes();
            if json {
                print_json(&r);
            } else {
                println!("{}", heading("Node.js"));
                for i in &r.node.installations {
                    println!(
                        "  {}{:<22} {:<10} {}",
                        if i.active { "* " } else { "  " },
                        i.label,
                        i.version.clone().unwrap_or_default(),
                        i.binary.display()
                    );
                }
                if let Some(m) = &r.node.npm_mismatch {
                    println!("  npm mismatch: node in {} but npm in {}", m.node_prefix.display(), m.npm_prefix.display());
                }
                println!("{}", heading("Python"));
                for i in &r.python.installations {
                    println!(
                        "  {}{:<22} {:<10} {}",
                        if i.active { "* " } else { "  " },
                        i.label,
                        i.version.clone().unwrap_or_default(),
                        i.binary.display()
                    );
                }
                for m in &r.python.pip_mismatches {
                    println!(
                        "  pip mismatch: {} installs into {} but {} is {}",
                        m.pip_command,
                        m.pip_interpreter.display(),
                        m.python_command,
                        m.python_path.display()
                    );
                }
                println!("{}", heading("Rust"));
                println!(
                    "  rustup: {}   cargo in PATH: {}   default toolchain: {}",
                    if r.rust.rustup_installed { "installed" } else { "not found" },
                    if r.rust.cargo_bin_in_path { "yes" } else { "no" },
                    r.rust.default_toolchain.clone().unwrap_or_else(|| "-".into())
                );
                println!("  (* = active in a fresh login shell)");
            }
            Ok(EXIT_OK)
        }
        Command::Clean { target } => {
            let (preview, dry_run, yes, prompt): (FixPreview, bool, bool, &str) = match target {
                CleanCmd::NodeModules { path, dry_run, confirm } => {
                    (app.preview_delete_node_modules(path)?, *dry_run, confirm.yes, "Delete this node_modules folder?")
                }
                CleanCmd::Venv { path, dry_run, confirm } => {
                    (app.preview_delete_venv(path)?, *dry_run, confirm.yes, "Delete this virtual environment?")
                }
                CleanCmd::OllamaModel { name, dry_run, confirm } => {
                    (app.preview_remove_ollama_model(name)?, *dry_run, confirm.yes, "Remove this Ollama model?")
                }
            };
            if json && dry_run {
                print_json(&preview);
                return Ok(EXIT_OK);
            }
            if !json {
                print_preview(&app, &preview);
            }
            if dry_run {
                return Ok(EXIT_OK);
            }
            if !confirm(prompt, yes)? {
                return Ok(EXIT_ABORTED);
            }
            let tx = match target {
                CleanCmd::NodeModules { path, .. } => app.delete_node_modules(path)?,
                CleanCmd::Venv { path, .. } => app.delete_venv(path)?,
                CleanCmd::OllamaModel { name, .. } => app.remove_ollama_model(name)?,
            };
            if json {
                print_json(&tx);
            } else {
                print_transaction(&app, &tx);
            }
            Ok(EXIT_OK)
        }
        Command::Tools => {
            let tools = app.tools(false);
            if json {
                print_json(&tools);
            } else {
                let mut rows =
                    vec![vec!["TOOL".into(), "STATUS".into(), "VERSION".into(), "BINARY".into(), "INSTALLED VIA".into(), "CONFIG".into()]];
                for t in &tools {
                    rows.push(vec![
                        t.name.clone(),
                        if t.installed { "installed".into() } else { "-".into() },
                        t.version.clone().unwrap_or_default(),
                        t.binary
                            .as_ref()
                            .map(|b| app.ctx.display_path(b))
                            .or(t.app_bundle.as_ref().map(|b| b.display().to_string()))
                            .unwrap_or_default(),
                        t.install_method.clone().unwrap_or_default(),
                        t.config_paths.first().map(|c| app.ctx.display_path(c)).unwrap_or_default(),
                    ]);
                }
                print!("{}", table(&rows));
            }
            Ok(EXIT_OK)
        }
        Command::Packages => {
            let report = app.packages(false);
            if json {
                print_json(&report);
            } else {
                let mut rows =
                    vec![vec!["MANAGER".into(), "STATUS".into(), "VERSION".into(), "PACKAGES".into(), "LOCATION".into(), "CACHE".into()]];
                for m in &report.managers {
                    rows.push(vec![
                        m.name.clone(),
                        if m.installed { "installed".into() } else { "-".into() },
                        m.version.clone().unwrap_or_default(),
                        m.package_count.map(|c| c.to_string()).unwrap_or_default(),
                        m.location.as_ref().map(|l| app.ctx.display_path(l)).unwrap_or_default(),
                        m.cache_path.as_ref().map(|l| app.ctx.display_path(l)).unwrap_or_default(),
                    ]);
                }
                print!("{}", table(&rows));
                let b = &report.homebrew;
                if b.installed {
                    println!(
                        "\nHomebrew {} at {} — {} formulae, {} casks{}",
                        b.version.clone().unwrap_or_default(),
                        b.prefix.as_ref().map(|p| p.display().to_string()).unwrap_or_default(),
                        b.formulae.len(),
                        b.casks.len(),
                        if b.broken_links.is_empty() { String::new() } else { format!(", {} broken links", b.broken_links.len()) }
                    );
                }
            }
            Ok(EXIT_OK)
        }
        Command::Services => {
            let services = app.services()?;
            if json {
                print_json(&services);
            } else {
                let mut rows = vec![vec!["LABEL".into(), "KIND".into(), "ORIGIN".into(), "LOGIN".into(), "STATE".into(), "TARGET".into()]];
                for s in services.iter().filter(|s| s.origin != devdoctor::devdoctor_core::platform::ServiceOrigin::Apple) {
                    rows.push(vec![
                        truncate(&s.label, 45),
                        format!("{:?}", s.kind).to_ascii_lowercase(),
                        format!("{:?}", s.origin).to_ascii_lowercase(),
                        if s.run_at_load { "yes".into() } else { "no".into() },
                        match (s.running_pid, s.loaded) {
                            (Some(pid), _) => format!("running ({pid})"),
                            (None, Some(true)) => "loaded".into(),
                            (None, Some(false)) => "not loaded".into(),
                            (None, None) => "?".into(),
                        },
                        match s.target_exists {
                            Some(false) => "MISSING".into(),
                            _ => s.program.as_ref().map(|p| app.ctx.display_path(p)).unwrap_or_default(),
                        },
                    ]);
                }
                print!("{}", table(&rows));
            }
            Ok(EXIT_OK)
        }
        Command::Git => {
            let g = app.git();
            if json {
                print_json(&g);
            } else {
                println!("{}", heading("Git"));
                println!(
                    "git:      {}",
                    g.git
                        .as_ref()
                        .map(|e| format!("{} ({})", e.path.display(), e.version.clone().unwrap_or_default()))
                        .unwrap_or_else(|| "not found".into())
                );
                println!(
                    "gh:       {}",
                    g.gh.as_ref()
                        .map(|e| format!(
                            "{} ({}){}",
                            e.path.display(),
                            e.version.clone().unwrap_or_default(),
                            if g.gh_config_present { ", configured" } else { "" }
                        ))
                        .unwrap_or_else(|| "not found".into())
                );
                println!("name:     {}", g.user_name.clone().unwrap_or_else(|| "(not set)".into()));
                println!("email:    {}", g.user_email.clone().unwrap_or_else(|| "(not set)".into()));
                println!("branch:   {}", g.default_branch.clone().unwrap_or_else(|| "(default: master)".into()));
                println!(
                    "helpers:  {}",
                    if g.credential_helpers.is_empty() { "(none in global config)".into() } else { g.credential_helpers.join(", ") }
                );
                println!(
                    "signing:  {}",
                    match (g.gpg_sign, &g.gpg_format) {
                        (Some(true), Some(f)) => format!("enabled ({f})"),
                        (Some(true), None) => "enabled (gpg)".into(),
                        _ => "disabled".into(),
                    }
                );
                for f in &g.findings {
                    println!("finding:  {f}");
                }
            }
            Ok(EXIT_OK)
        }
        Command::Ssh => {
            let s = app.ssh();
            if json {
                print_json(&s);
            } else {
                println!("{}", heading("SSH"));
                println!(
                    "~/.ssh: {} (mode {})",
                    if s.ssh_dir_exists { "present" } else { "missing" },
                    s.ssh_dir_mode.map(|m| format!("{m:o}")).unwrap_or_else(|| "-".into())
                );
                println!("agent:  {} ({} identities)", s.agent_status, s.agent_identities);
                println!("config: {} hosts, {} known_hosts entries", s.hosts.len(), s.known_hosts_entries);
                for k in &s.keys {
                    println!(
                        "key:    {}  mode {:o}{}  {}",
                        k.name,
                        k.mode,
                        if k.mode_ok { "" } else { " (INSECURE)" },
                        k.key_type.clone().unwrap_or_default()
                    );
                }
                for f in &s.findings {
                    println!("finding: {f}");
                }
            }
            Ok(EXIT_OK)
        }
        Command::Snapshot { action } => match action {
            SnapshotCmd::List => {
                let snaps = app.snapshots(50)?;
                if json {
                    print_json(&snaps);
                } else if snaps.is_empty() {
                    println!("No snapshots yet. Create one with `devdoctor snapshot create --baseline`.");
                } else {
                    let mut rows = vec![vec!["ID".into(), "KIND".into(), "CREATED".into(), "LABEL".into(), "ITEMS".into()]];
                    for s in &snaps {
                        rows.push(vec![
                            s.id.clone(),
                            s.kind.clone(),
                            s.created_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string(),
                            s.label.clone().unwrap_or_default(),
                            s.summary.counts.values().sum::<usize>().to_string(),
                        ]);
                    }
                    print!("{}", table(&rows));
                }
                Ok(EXIT_OK)
            }
            SnapshotCmd::Create { label, baseline, with_storage } => {
                let snap = app.create_snapshot(if *baseline { "baseline" } else { "manual" }, label.clone(), *with_storage)?;
                if json {
                    print_json(&snap);
                } else {
                    println!("Created {} snapshot {} with {} items.", snap.kind, snap.id, snap.items.len());
                }
                Ok(EXIT_OK)
            }
            SnapshotCmd::Status => {
                let st = app.snapshot_schedule();
                if json {
                    print_json(&st);
                } else {
                    print_schedule(&app, &st);
                }
                Ok(EXIT_OK)
            }
            SnapshotCmd::Schedule { hour, minute, dry_run, confirm: c } => {
                let preview = app.preview_schedule_snapshots(*hour, *minute)?;
                if json && *dry_run {
                    print_json(&preview);
                    return Ok(EXIT_OK);
                }
                if !json {
                    print_preview(&app, &preview);
                }
                if *dry_run {
                    return Ok(EXIT_OK);
                }
                if !confirm("Install the daily snapshot agent?", c.yes)? {
                    return Ok(EXIT_ABORTED);
                }
                let tx = app.schedule_snapshots(*hour, *minute)?;
                if json {
                    print_json(&tx);
                } else {
                    print_transaction(&app, &tx);
                    println!("\nDaily snapshots are scheduled. Check with `devdoctor snapshot status`, remove with `devdoctor snapshot unschedule`.");
                }
                Ok(EXIT_OK)
            }
            SnapshotCmd::Unschedule { confirm: c } => {
                let preview = app.preview_unschedule_snapshots()?;
                if !json {
                    print_preview(&app, &preview);
                }
                if !confirm("Remove the daily snapshot agent?", c.yes)? {
                    return Ok(EXIT_ABORTED);
                }
                let tx = app.unschedule_snapshots()?;
                if json {
                    print_json(&tx);
                } else {
                    print_transaction(&app, &tx);
                }
                Ok(EXIT_OK)
            }
            SnapshotCmd::Show { id } => {
                let snap = app.snapshot(id)?;
                if json {
                    print_json(&snap);
                } else {
                    println!(
                        "{}",
                        heading(&format!(
                            "Snapshot {} ({}, {})",
                            snap.id,
                            snap.kind,
                            snap.created_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M")
                        ))
                    );
                    for (cat, n) in &snap.summary.counts {
                        println!("  {:<18} {}", devdoctor::devdoctor_core::snapshot::category_label(cat), n);
                    }
                }
                Ok(EXIT_OK)
            }
        },
        Command::Changes { since, to } => {
            let diff = match since.as_deref() {
                Some(s) if s.ends_with('h') || s.ends_with('d') => {
                    let n: i64 = s[..s.len() - 1]
                        .parse()
                        .map_err(|_| devdoctor::devdoctor_core::Error::invalid(format!("invalid duration `{s}`")))?;
                    let dur = if s.ends_with('h') { Duration::hours(n) } else { Duration::days(n) };
                    app.changes_since(Utc::now() - dur)?
                }
                other => app.changes(other, to.as_deref())?,
            };
            if json {
                print_json(&diff);
            } else {
                match diff {
                    None => println!("Not enough snapshots to compare. DevDoctor records a snapshot after each scan; run `devdoctor scan` again later, or create a baseline with `devdoctor snapshot create --baseline`."),
                    Some(d) => {
                        println!("{}", heading(&format!("Changes between {} and {}", d.from_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"), d.to_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"))));
                        if d.changes.is_empty() {
                            println!("No changes detected.");
                        }
                        for h in &d.headline {
                            println!("  • {h}");
                        }
                        print_snapshot_diff(&d);
                    }
                }
            }
            Ok(EXIT_OK)
        }
        Command::History => {
            let txs = app.transactions(50)?;
            let scans = app.scans(20)?;
            let runs = app.runs(20)?;
            if json {
                print_json(&serde_json::json!({ "transactions": txs, "runs": runs, "scans": scans }));
            } else {
                println!("{}", heading("Fix history"));
                if txs.is_empty() {
                    println!("No fixes applied yet.");
                }
                for t in &txs {
                    println!(
                        "{}  {}  {}  {}{}",
                        t.created_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"),
                        t.id,
                        t.status.as_str(),
                        t.title,
                        if t.disk_space_recovered > 0 { format!("  (recovered {})", bytes(t.disk_space_recovered)) } else { String::new() }
                    );
                }
                if !runs.is_empty() {
                    println!("{}", heading("Recorded runs"));
                    for r in &runs {
                        println!(
                            "{}  {}  {}  {}",
                            r.started_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"),
                            r.id,
                            truncate(&r.label, 50),
                            if r.headline.is_empty() { "no tracked change".to_string() } else { r.headline.join("; ") }
                        );
                    }
                }
                println!("{}", heading("Scans"));
                for s in &scans {
                    println!(
                        "{}  {}  {:<7} {} issues, {} detectors ({} failed), health {}",
                        s.started_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"),
                        s.id,
                        s.mode,
                        s.issue_count,
                        s.detectors_run,
                        s.detectors_failed,
                        s.health_score.map(|h| h.to_string()).unwrap_or_default()
                    );
                }
            }
            Ok(EXIT_OK)
        }
        Command::Report { markdown } => {
            if *markdown {
                print!("{}", app.markdown_report()?);
                return Ok(EXIT_OK);
            }
            let report = app.diagnostic_report()?;
            if !json {
                eprintln!("Included in this report: {}", report.included.join("; "));
                eprintln!("Home paths are shortened, the username is replaced and likely secrets are redacted.");
            }
            print_json(&report);
            Ok(EXIT_OK)
        }
        Command::Run { command } => {
            let display = display_command(command);
            if !json {
                eprintln!("Recording your environment before running {display} ...");
            }
            let t0 = std::time::Instant::now();
            let state = app.begin_tracking(&display)?;
            if !json {
                eprintln!("  snapshot {} recorded in {}\n", state.before.id, ms(t0.elapsed().as_millis() as u64));
            }
            let cwd = std::env::current_dir().ok();
            let status = match run_foreground(command) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("error: could not start `{}`: {e}", command[0]);
                    return Ok(EXIT_ERROR);
                }
            };
            if !json {
                eprintln!("\nRecording your environment after the command ...");
            }
            let record = app.finish_tracking(state, command.clone(), cwd, status.code())?;
            if json {
                print_json(&record);
            } else {
                print_run(&app, &record);
            }
            Ok(match status.code() {
                Some(c) if (0..=255).contains(&c) => c as u8,
                _ => EXIT_ERROR,
            })
        }
        Command::Watch { interval } => {
            let interval = (*interval).clamp(1, 3600);
            eprintln!("Watching your environment every {interval} s. Install or change things in another terminal; press Ctrl-C to stop and save a summary.");
            let state = app.begin_tracking("devdoctor watch")?;
            eprintln!("  reference snapshot {} recorded\n", state.before.id);
            let mut last = state.before.clone();
            let cwd = std::env::current_dir().ok();
            install_stop_handler();
            while !stop_requested() {
                for _ in 0..(interval * 10) {
                    if stop_requested() {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                if stop_requested() {
                    break;
                }
                let now = app.snapshot_now(true);
                let diff = app.diff_snapshots(&last, &now);
                if !diff.changes.is_empty() {
                    let stamp = chrono::Local::now().format("%H:%M:%S");
                    for c in &diff.changes {
                        println!(
                            "{stamp}  {} {}",
                            match c.kind {
                                ChangeKind::Added => "+",
                                ChangeKind::Removed => "-",
                                ChangeKind::Changed => "~",
                            },
                            c.description
                        );
                    }
                }
                last = now;
            }
            restore_stop_handler();
            eprintln!("\nStopping; recording what changed since the watch started ...");
            let record = app.finish_tracking(state, vec!["devdoctor".into(), "watch".into()], cwd, None)?;
            if json {
                print_json(&record);
            } else {
                print_run(&app, &record);
            }
            Ok(EXIT_OK)
        }
        Command::Runs { id } => {
            if let Some(id) = id {
                let r = app.run_record(id)?;
                if json {
                    print_json(&r);
                } else {
                    print_run(&app, &r);
                }
                return Ok(EXIT_OK);
            }
            let runs = app.runs(50)?;
            if json {
                print_json(&runs);
            } else if runs.is_empty() {
                println!("No recorded runs. Wrap an installer with `devdoctor run <command...>` to record exactly what it changes.");
            } else {
                let mut rows = vec![vec!["WHEN".into(), "ID".into(), "EXIT".into(), "COMMAND".into(), "WHAT CHANGED".into()]];
                for r in &runs {
                    rows.push(vec![
                        r.started_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string(),
                        r.id.clone(),
                        r.exit_code.map(|c| c.to_string()).unwrap_or_else(|| "signal".into()),
                        truncate(&r.label, 40),
                        if r.headline.is_empty() { "nothing tracked".to_string() } else { r.headline.join("; ") },
                    ]);
                }
                print!("{}", table(&rows));
                println!("\nDetails: devdoctor runs <id>");
            }
            Ok(EXIT_OK)
        }
        Command::Startup { samples, no_trace } => {
            if !json {
                eprintln!("Starting your login shell {} time(s){} ...", samples, if *no_trace { "" } else { " and tracing one start" });
            }
            let profile = app.startup_profile(*samples, !*no_trace);
            if json {
                print_json(&profile);
            } else {
                print_startup(&app, &profile);
            }
            Ok(EXIT_OK)
        }
        Command::Completions { .. } => Ok(EXIT_OK),
        Command::DemoExport { dir } => {
            let dir = dir.clone().unwrap_or_else(|| PathBuf::from("apps/desktop/src/demo"));
            let files = app.export_demo(&dir)?;
            if json {
                print_json(&files);
            } else {
                println!("Wrote {} fixture files to {}", files.len(), dir.display());
            }
            Ok(EXIT_OK)
        }
        Command::LastReport => {
            let report = app.last_report()?;
            if json {
                print_json(&report);
            } else {
                match report {
                    Some(r) => print_scan(&r),
                    None => println!("No scan yet."),
                }
            }
            Ok(EXIT_OK)
        }
        Command::Detectors => {
            let detectors = app.detectors();
            if json {
                print_json(&detectors);
            } else {
                let mut rows = vec![vec!["ID".into(), "CATEGORY".into(), "MODES".into(), "DESCRIPTION".into()]];
                for d in &detectors {
                    rows.push(vec![
                        d.id.to_string(),
                        d.category.label().to_string(),
                        if d.modes.is_empty() { "deep".into() } else { d.modes.iter().map(|m| m.as_str()).collect::<Vec<_>>().join(",") },
                        d.description.to_string(),
                    ]);
                }
                print!("{}", table(&rows));
            }
            Ok(EXIT_OK)
        }
    }
}

fn run_scan(app: &DevDoctor, mode: ScanMode, quiet: bool) -> Result<ScanReport, devdoctor::devdoctor_core::Error> {
    let stderr_tty = std::io::stderr().is_terminal();
    app.scan(mode, &mut |p| {
        if quiet || !stderr_tty {
            return;
        }
        match p {
            ScanProgress::Started { total, mode } => eprintln!("Running {} scan ({} detectors)...", mode.as_str(), total),
            ScanProgress::DetectorFinished { name, issues, duration_ms, failed, .. } => {
                eprintln!("  {} {:<38} {:>3} issue(s)  {}", if failed { "x" } else { "✓" }, name, issues, ms(duration_ms));
            }
            _ => {}
        }
    })
}

/// Runs the user's command in the foreground with inherited stdin/stdout/stderr. Ctrl-C reaches
/// the command (it is in the foreground process group) but not DevDoctor, so the "after"
/// snapshot is still recorded when an installer is interrupted.
#[cfg(unix)]
fn run_foreground(command: &[String]) -> std::io::Result<std::process::ExitStatus> {
    extern "C" fn on_sigint(_: libc::c_int) {}
    let handler: extern "C" fn(libc::c_int) = on_sigint;
    // SAFETY: installing an empty, async-signal-safe handler for SIGINT and restoring the
    // previous disposition afterwards. Handlers (unlike SIG_IGN) are reset on exec, so the child
    // keeps the default Ctrl-C behaviour.
    let previous = unsafe { libc::signal(libc::SIGINT, handler as libc::sighandler_t) };
    let status = std::process::Command::new(&command[0]).args(&command[1..]).status();
    // SAFETY: restoring the disposition captured above.
    unsafe {
        libc::signal(libc::SIGINT, previous);
    }
    status
}

/// Windows: a console control handler that swallows Ctrl-C in DevDoctor only. Handler routines
/// are per process (unlike the "ignore" flag, which children inherit), so the installer still
/// receives Ctrl-C. `npm`, `pip` and friends are `.cmd` scripts on Windows; they are launched
/// through `cmd.exe /C` because `CreateProcess` only resolves `.exe` files.
#[cfg(windows)]
fn run_foreground(command: &[String]) -> std::io::Result<std::process::ExitStatus> {
    use windows_sys::Win32::System::Console::SetConsoleCtrlHandler;
    unsafe extern "system" fn swallow(_: u32) -> i32 {
        1
    }
    // SAFETY: registering a handler that only returns TRUE; removed before returning.
    unsafe {
        SetConsoleCtrlHandler(Some(swallow), 1);
    }
    let status = windows_command(command).status();
    // SAFETY: removing the handler registered above.
    unsafe {
        SetConsoleCtrlHandler(Some(swallow), 0);
    }
    status
}

#[cfg(windows)]
fn windows_command(command: &[String]) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let program = &command[0];
    let resolved = std::env::var_os("PATH").and_then(|p| {
        std::env::split_paths(&p).flat_map(|d| devdoctor::devdoctor_core::sys::command_candidates(&d, program)).find(|c| c.is_file())
    });
    let is_script = resolved
        .as_ref()
        .and_then(|p| p.extension())
        .map(|e| {
            let e = e.to_string_lossy().to_ascii_lowercase();
            e == "cmd" || e == "bat"
        })
        .unwrap_or(false);
    if let (true, Some(script)) = (is_script, resolved) {
        let quote = |a: &str| if a.contains(' ') && !a.starts_with('"') { format!("\"{a}\"") } else { a.to_string() };
        let mut line = quote(&script.to_string_lossy());
        for a in &command[1..] {
            line.push(' ');
            line.push_str(&quote(a));
        }
        let mut c = std::process::Command::new("cmd.exe");
        c.arg("/C");
        c.raw_arg(format!("\"{line}\""));
        return c;
    }
    let mut c = std::process::Command::new(program);
    c.args(&command[1..]);
    c
}

static STOP: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(unix)]
extern "C" fn on_stop_signal(_: libc::c_int) {
    STOP.store(true, std::sync::atomic::Ordering::SeqCst);
}

/// Turns Ctrl-C into a flag so `devdoctor watch` can finish its summary before exiting.
#[cfg(unix)]
fn install_stop_handler() {
    STOP.store(false, std::sync::atomic::Ordering::SeqCst);
    let handler: extern "C" fn(libc::c_int) = on_stop_signal;
    // SAFETY: the handler only stores to an atomic, which is async-signal-safe.
    unsafe {
        libc::signal(libc::SIGINT, handler as libc::sighandler_t);
        libc::signal(libc::SIGTERM, handler as libc::sighandler_t);
    }
}

#[cfg(unix)]
fn restore_stop_handler() {
    // SAFETY: restoring the default dispositions.
    unsafe {
        libc::signal(libc::SIGINT, libc::SIG_DFL);
        libc::signal(libc::SIGTERM, libc::SIG_DFL);
    }
}

#[cfg(windows)]
unsafe extern "system" fn on_console_ctrl(_: u32) -> i32 {
    STOP.store(true, std::sync::atomic::Ordering::SeqCst);
    1
}

#[cfg(windows)]
fn install_stop_handler() {
    STOP.store(false, std::sync::atomic::Ordering::SeqCst);
    // SAFETY: the handler only stores to an atomic.
    unsafe {
        windows_sys::Win32::System::Console::SetConsoleCtrlHandler(Some(on_console_ctrl), 1);
    }
}

#[cfg(windows)]
fn restore_stop_handler() {
    // SAFETY: removing the handler registered by `install_stop_handler`.
    unsafe {
        windows_sys::Win32::System::Console::SetConsoleCtrlHandler(Some(on_console_ctrl), 0);
    }
}

fn stop_requested() -> bool {
    STOP.load(std::sync::atomic::Ordering::SeqCst)
}

fn print_schedule(app: &DevDoctor, st: &devdoctor::devdoctor_core::schedule::SnapshotSchedule) {
    println!("{}", heading("Daily snapshots"));
    if st.installed {
        println!(
            "scheduled: yes, every day at {:02}:{:02}   active in {}: {}",
            st.hour.unwrap_or(0),
            st.minute.unwrap_or(0),
            devdoctor::devdoctor_core::schedule::scheduler_name(),
            if st.loaded { "yes" } else { "no" }
        );
        println!(
            "command:   {}{}",
            st.program.as_ref().map(|p| app.ctx.display_path(p)).unwrap_or_else(|| "?".into()),
            if st.program_exists { "" } else { "   (MISSING)" }
        );
        println!("{:<10} {}", if cfg!(windows) { "task:" } else { "agent:" }, app.ctx.display_path(&st.plist_path));
        println!(
            "last run:  {}",
            st.last_run
                .map(|t| t.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|| "never (or no output yet)".into())
        );
        println!("log:       {}", app.ctx.display_path(&st.log_path));
    } else {
        println!("scheduled: no. Enable with `devdoctor snapshot schedule [--hour 12 --minute 0]`.");
        match &st.available_program {
            Some(p) => println!("command:   {} would be used", app.ctx.display_path(p)),
            None => println!("command:   no `devdoctor` binary found in PATH; install the CLI first"),
        }
    }
    for n in &st.notes {
        println!("note: {n}");
    }
}

fn print_snapshot_diff(d: &SnapshotDiff) {
    let mut current = String::new();
    for c in &d.changes {
        if c.category != current {
            current = c.category.clone();
            println!("{}", subheading(devdoctor::devdoctor_core::snapshot::category_label(&current)));
        }
        println!(
            "  {} {}",
            match c.kind {
                ChangeKind::Added => "+",
                ChangeKind::Removed => "-",
                ChangeKind::Changed => "~",
            },
            c.description
        );
    }
}

fn print_run(app: &DevDoctor, r: &RunRecord) {
    println!("{}", heading(&format!("What `{}` changed", r.label)));
    println!(
        "exit status: {}   duration: {}   run id: {}",
        r.exit_code.map(|c| c.to_string()).unwrap_or_else(|| "terminated by a signal".into()),
        ms(r.duration_ms),
        r.id
    );
    if !r.changed_anything() {
        println!("\nNothing changed among what DevDoctor tracks: PATH, startup files, packages, runtimes, startup services, listening ports and the watched folders.");
        return;
    }
    println!();
    for h in &r.headline {
        println!("  • {h}");
    }
    print_snapshot_diff(&r.diff);
    for f in &r.file_diffs {
        println!("{}", subheading(&format!("{} ({})", app.ctx.display_path(&f.path), format!("{:?}", f.kind).to_ascii_lowercase())));
        println!("{}", f.diff.trim_end());
    }
    for d in &r.directory_changes {
        println!("{}", subheading(&format!("Folder {}", app.ctx.display_path(&d.dir))));
        for a in &d.added {
            println!("  + {a}");
        }
        for x in &d.removed {
            println!("  - {x}");
        }
    }
    if !r.version_changes.is_empty() {
        println!("{}", subheading("Version changes"));
        for v in &r.version_changes {
            println!(
                "  {}: {} → {}{}",
                v.command,
                v.before.clone().unwrap_or_else(|| "?".into()),
                v.after.clone().unwrap_or_else(|| "?".into()),
                v.path.as_ref().map(|p| format!("  ({p})")).unwrap_or_default()
            );
        }
    }
    println!("\nSaved as run {}. Undoing is up to the installer; DevDoctor recorded what it did (`devdoctor runs {}`).", r.id, r.id);
}

fn print_startup(app: &DevDoctor, p: &StartupProfile) {
    println!("{}", heading(&format!("Terminal startup: {} ms ({})", p.median_ms, p.rating.label())));
    if p.samples_ms.is_empty() {
        println!("The login shell could not be timed.");
    } else {
        println!(
            "{} complete {} start(s): {} ms — median {} ms, best {} ms, worst {} ms",
            p.samples_ms.len(),
            p.shell,
            p.samples_ms.iter().map(|s| s.to_string()).collect::<Vec<_>>().join(", "),
            p.median_ms,
            p.min_ms,
            p.max_ms
        );
    }
    println!("Under 150 ms feels instant; above 500 ms every new tab or window waits; above 1.5 s it hurts.");
    for n in &p.notes {
        println!("note: {n}");
    }
    if p.traced {
        println!(
            "{}",
            subheading(&format!("Slowest startup lines (one traced start: {} ms, {} lines)", p.trace_total_ms.unwrap_or(0), p.trace_lines))
        );
        let mut rows = vec![vec!["MS".into(), "SHARE".into(), "WHERE".into(), "STATEMENT".into()]];
        for h in &p.hotspots {
            rows.push(vec![
                h.inclusive_ms.to_string(),
                format!("{}%", h.share_percent),
                format!("{}:{}", app.ctx.display_path(&h.file), h.line),
                truncate(&h.statement, 60),
            ]);
        }
        print!("{}", table(&rows));
        let mut printed = Vec::new();
        for h in p.hotspots.iter().filter(|h| h.hint.is_some()) {
            let hint = h.hint.clone().unwrap_or_default();
            if printed.contains(&hint) {
                continue;
            }
            printed.push(hint.clone());
            println!("\n→ {}:{}", app.ctx.display_path(&h.file), h.line);
            print!("{}", wrap(&hint, 2, 90));
        }
        println!("{}", subheading("Time spent per file or function (self time)"));
        let mut rows = vec![vec!["MS".into(), "KIND".into(), "LINES".into(), "SOURCE".into()]];
        for s in &p.sources {
            rows.push(vec![
                s.self_ms.to_string(),
                format!("{:?}", s.kind).to_ascii_lowercase(),
                s.lines.to_string(),
                truncate(&s.display, 70),
            ]);
        }
        print!("{}", table(&rows));
    }
    if !p.stderr_lines.is_empty() {
        println!("{}", subheading("Printed at startup (stderr)"));
        for l in &p.stderr_lines {
            println!("  {l}");
        }
    }
}

/// Scan with machine-readable progress: one JSON object per event on stderr, so a graphical
/// front end can show which detector is running while the report is being produced.
fn run_scan_with_json_progress(app: &DevDoctor, mode: ScanMode) -> Result<ScanReport, devdoctor::devdoctor_core::Error> {
    app.scan(mode, &mut |p| {
        if let Ok(line) = serde_json::to_string(&p) {
            eprintln!("{line}");
        }
    })
}

fn print_scan(report: &ScanReport) {
    let h = &report.health;
    println!("{}", heading(&format!("Development Environment Health: {} / 100", h.score)));
    println!(
        "{} problem(s), {} warning(s), {} note(s), {} of {} checks passed — scan took {}",
        h.problems,
        h.warnings,
        h.notes,
        h.checks_passed,
        h.checks_total,
        ms(report.duration_ms)
    );
    for w in &report.warnings {
        println!("warning: {w}");
    }
    if report.detectors_failed > 0 {
        println!("\n{} detector(s) failed:", report.detectors_failed);
        for r in report.detector_runs.iter().filter(|r| r.status == "failed") {
            println!("  {}: {}", r.id, r.error.clone().unwrap_or_default());
        }
    }
    if report.issues.is_empty() {
        println!("\nNo issues found.");
        return;
    }
    let mut rows = vec![vec!["ID".into(), "SEV".into(), "CONF".into(), "CATEGORY".into(), "TITLE".into(), "FIX".into()]];
    for i in &report.issues {
        rows.push(issue_line(i));
    }
    println!();
    print!("{}", table(&rows));
    println!("\nDetails: devdoctor issue <id>   Fix: devdoctor fix <id>   Safe batch: devdoctor fix-safe --dry-run");
    if !report.ignored.is_empty() {
        println!("{} ignored issue(s) hidden.", report.ignored.len());
    }
}

fn print_issue_detail(app: &DevDoctor, detail: &devdoctor::IssueDetail) {
    let i = &detail.record.issue;
    println!("{}", heading(&i.title));
    println!(
        "id: {}   severity: {}   confidence: {}   category: {}   detector: {}",
        i.id,
        i.severity,
        i.confidence,
        i.category.label(),
        i.detector_id
    );
    println!(
        "first seen: {}   last seen: {}{}",
        detail.record.first_seen_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"),
        detail.record.last_seen_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"),
        if detail.record.ignored { "   (ignored)" } else { "" }
    );
    println!("{}", subheading("What was found"));
    print!("{}", wrap(&i.description, 2, 90));
    if !i.impact.is_empty() {
        println!("{}", subheading("Why it matters"));
        print!("{}", wrap(&i.impact, 2, 90));
    }
    if !i.evidence.is_empty() {
        println!("{}", subheading("Evidence"));
        for e in &i.evidence {
            println!("  - {e}");
        }
    }
    if !i.affected_files.is_empty() {
        println!("{}", subheading("Affected files"));
        for f in &i.affected_files {
            println!(
                "  {}{}{}",
                app.ctx.display_path(&f.path),
                f.line.map(|l| format!(":{l}")).unwrap_or_default(),
                f.excerpt.as_ref().map(|e| format!("    {e}")).unwrap_or_default()
            );
        }
    }
    if !i.affected_commands.is_empty() {
        println!("{}", subheading("Affected commands"));
        println!("  {}", i.affected_commands.join(", "));
    }
    if let Some(s) = &i.current_state {
        println!("{}", subheading("Current state"));
        print!("{}", wrap(s, 2, 120));
    }
    if !i.technical_description.is_empty() {
        println!("{}", subheading("Technical details"));
        for line in i.technical_description.lines() {
            println!("  {line}");
        }
    }
    println!("{}", subheading("Recommended action"));
    print!("{}", wrap(&i.recommended_action, 2, 90));
    println!(
        "\nautomatic fix: {}   reversible: {}   safe for batch: {}",
        if i.fixer_available { detail.fixer_name.clone().unwrap_or_else(|| "yes".into()) } else { "no".into() },
        i.reversible,
        i.batch_safe
    );
    if let Some(p) = &detail.preview {
        println!("{}", subheading("Fix preview"));
        print_preview(app, p);
        println!("Apply with: devdoctor fix {}", i.id);
    }
    if let Some(e) = &detail.preview_error {
        println!("\nfix preview unavailable: {e}");
    }
    if !detail.transactions.is_empty() {
        println!("{}", subheading("Fix history for this issue"));
        for t in &detail.transactions {
            println!("  {}  {}  {}", t.created_at.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M"), t.id, t.status.as_str());
        }
    }
}

fn print_preview(app: &DevDoctor, p: &FixPreview) {
    println!("{}", p.title);
    print!("{}", wrap(&p.summary, 2, 90));
    if !p.operations.is_empty() {
        println!("\nPlanned operations:");
        for (i, op) in p.operations.iter().enumerate() {
            println!("  {}. {op}", i + 1);
        }
    }
    for f in &p.files_modified {
        println!("\n{}", f.diff.trim_end());
    }
    if !p.directories_deleted.is_empty() {
        println!("\nDirectories deleted:");
        for d in &p.directories_deleted {
            println!("  {}  ({}, {} entries)", app.ctx.display_path(&d.path), bytes(d.bytes), d.entries);
        }
    }
    if !p.commands_executed.is_empty() {
        println!("\nCommands executed:");
        for c in &p.commands_executed {
            println!("  {} {}  — {}", c.program, c.args.join(" "), c.description);
        }
    }
    if !p.processes_stopped.is_empty() {
        println!("\nProcesses stopped:");
        for pr in &p.processes_stopped {
            println!("  pid {} {}  {}", pr.pid, pr.name, truncate(&pr.command, 80));
        }
    }
    println!(
        "\nrisk: {}   reversible: {}   backup: {}   estimated space recovered: {}",
        p.risk.as_str(),
        if p.reversible { "yes" } else { "no" },
        if p.backup_created { "yes" } else { "no" },
        bytes(p.estimated_disk_space_recovered)
    );
    for n in &p.notes {
        println!("note: {n}");
    }
    if !p.validations.is_empty() {
        println!("Validated after applying (automatic rollback on failure):");
        for v in &p.validations {
            println!("  - {v}");
        }
    }
}

fn print_transaction(app: &DevDoctor, t: &Transaction) {
    println!("{}", heading(&format!("Transaction {} — {}", t.id, t.status.as_str())));
    println!("{}", t.title);
    for op in &t.operations {
        println!("  - {}", op.describe(&app.ctx.home));
    }
    if let Some(v) = &t.validation {
        for c in &v.checks {
            println!("  [{}] {}: {}", if c.passed { "ok" } else { "FAIL" }, c.name, c.detail);
        }
    }
    for n in &t.notes {
        println!("  note: {n}");
    }
    if let Some(e) = &t.error {
        println!("  error: {e}");
    }
}

fn print_path(app: &DevDoctor, report: &devdoctor::devdoctor_core::path_env::PathReport) {
    println!("{}", heading("PATH"));
    println!(
        "source: {}   duplicates: {}   missing: {}",
        match &report.source {
            devdoctor::devdoctor_core::path_env::PathSource::LoginShell { shell } =>
                format!("fresh {shell} login shell ({})", ms(report.capture_duration_ms)),
            devdoctor::devdoctor_core::path_env::PathSource::ProcessEnvironment => "process environment".into(),
            devdoctor::devdoctor_core::path_env::PathSource::Override => "override".into(),
            devdoctor::devdoctor_core::path_env::PathSource::Registry => "Windows registry (machine + user PATH)".into(),
        },
        report.duplicate_count,
        report.missing_count
    );
    for w in &report.warnings {
        println!("warning: {w}");
    }
    let mut rows = vec![vec!["#".into(), "DIRECTORY".into(), "ORIGIN".into(), "EXEC".into(), "STATUS".into(), "SOURCE".into()]];
    for e in &report.entries {
        let mut status = Vec::new();
        if e.is_duplicate {
            status.push(format!("DUPLICATE of #{}", e.duplicate_of.unwrap_or(0)));
        }
        if !e.exists {
            status.push("MISSING".into());
        }
        if let Some(s) = &e.suspicious {
            status.push(s.clone());
        }
        let source = e
            .sources
            .first()
            .map(|s| format!("{}:{}", app.ctx.display_path(&s.file), s.line))
            .or(e.source_hint.clone())
            .unwrap_or_default();
        rows.push(vec![
            e.position.to_string(),
            app.ctx.display_path(std::path::Path::new(&e.raw)),
            e.origin_label.clone(),
            e.executables.map(|n| n.to_string()).unwrap_or_default(),
            status.join(", "),
            source,
        ]);
    }
    print!("{}", table(&rows));
}

fn print_shell(app: &DevDoctor, r: &devdoctor::ShellReport) {
    println!("{}", heading(&format!("Shell: {} ({})", r.shell.name(), r.shell_path.display())));
    println!(
        "{} aliases and {} functions defined in the login shell; PATH captured in {}",
        r.shell_aliases,
        r.shell_functions,
        ms(r.capture_duration_ms)
    );
    for w in &r.capture_warnings {
        println!("warning: {w}");
    }
    println!("{}", subheading("Startup files (load order)"));
    for f in &r.files {
        println!(
            "  {:<22} {}{}",
            app.ctx.display_path(&f.path),
            if f.exists { format!("{} statements, {} bytes", f.statement_count, f.size) } else { "(absent)".into() },
            if f.warnings.is_empty() { String::new() } else { format!(", {} parser warning(s)", f.warnings.len()) }
        );
    }
    println!("{}", subheading("PATH statements"));
    for m in &r.mutations {
        println!(
            "  {}:{:<4} {:<8} {}{}",
            app.ctx.display_path(&m.file),
            m.line,
            format!("{:?}", m.op).to_ascii_lowercase(),
            m.raw,
            if m.is_effective() { "" } else { "   (conditional)" }
        );
    }
    println!("{}", subheading("Sourced files"));
    for s in &r.sources {
        println!(
            "  {}:{:<4} {}{}",
            app.ctx.display_path(&s.file),
            s.line,
            s.expanded.as_ref().map(|p| app.ctx.display_path(p)).unwrap_or(s.target_raw.clone()),
            match s.exists {
                Some(false) => "   (MISSING)",
                _ => "",
            }
        );
    }
    println!("{}", subheading("Tool initialisations (eval)"));
    for e in &r.evals {
        println!("  {}:{:<4} {}", app.ctx.display_path(&e.file), e.line, e.command);
    }
    println!("{}", subheading("Aliases defined in files"));
    for a in &r.aliases {
        println!("  {}:{:<4} {}={}", app.ctx.display_path(&a.file), a.line, a.name, a.value_raw);
    }
}
