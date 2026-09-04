//! `devdoctor` — the command line interface. All diagnostics come from the shared
//! `devdoctor` facade; this file only parses arguments and renders results.

mod output;

use chrono::{Duration, Utc};
use clap::{Args, Parser, Subcommand};
use devdoctor::devdoctor_core::context::ContextOptions;
use devdoctor::devdoctor_core::detector::ScanMode;
use devdoctor::devdoctor_core::engine::{ScanProgress, ScanReport};
use devdoctor::devdoctor_core::fixer::FixPreview;
use devdoctor::devdoctor_core::issue::Severity;
use devdoctor::devdoctor_core::paths::DevDoctorDirs;
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
    /// DevDoctor data directory (database, backups, logs). Defaults to ~/Library/Application Support/DevDoctor.
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
    /// Fix history (transactions) and past scans.
    History,
    /// Export a sanitized diagnostic report as JSON.
    Report,
    /// List available detectors.
    Detectors,
    /// Write sanitized JSON fixtures for the desktop UI's browser demo mode (development).
    #[command(hide = true)]
    DemoExport {
        /// Output directory (default: apps/desktop/src/demo).
        dir: Option<PathBuf>,
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
    let app = open(&cli)?;
    match &cli.command {
        Command::Scan { deep, storage, fail_on } => {
            let mode = if *deep {
                ScanMode::Deep
            } else if *storage {
                ScanMode::Storage
            } else {
                ScanMode::Quick
            };
            let report = run_scan(&app, mode, json)?;
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
                        let mut current = String::new();
                        for c in &d.changes {
                            if c.category != current {
                                current = c.category.clone();
                                println!("{}", subheading(devdoctor::devdoctor_core::snapshot::category_label(&current)));
                            }
                            println!("  {} {}", match c.kind { devdoctor::devdoctor_core::snapshot::ChangeKind::Added => "+", devdoctor::devdoctor_core::snapshot::ChangeKind::Removed => "-", devdoctor::devdoctor_core::snapshot::ChangeKind::Changed => "~" }, c.description);
                        }
                    }
                }
            }
            Ok(EXIT_OK)
        }
        Command::History => {
            let txs = app.transactions(50)?;
            let scans = app.scans(20)?;
            if json {
                print_json(&serde_json::json!({ "transactions": txs, "scans": scans }));
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
        Command::Report => {
            let report = app.diagnostic_report()?;
            if !json {
                eprintln!("Included in this report: {}", report.included.join("; "));
                eprintln!("Home paths are shortened, the username is replaced and likely secrets are redacted.");
            }
            print_json(&report);
            Ok(EXIT_OK)
        }
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
