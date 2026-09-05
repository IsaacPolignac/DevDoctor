//! Scheduled snapshots: a user LaunchAgent on macOS, a per-user Task Scheduler task on Windows.
//! Both run `devdoctor snapshot create` once a day, so "what changed since yesterday" always
//! has an answer even when neither the app nor the CLI was used that day.
//!
//! This module only *describes* the agent (plist text, paths, current status). Installing and
//! removing it are fixers that go through the transaction machinery like every other change.

use crate::command::CommandSpec;
use crate::context::SystemContext;
use crate::paths::DevDoctorDirs;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const AGENT_LABEL: &str = "dev.devdoctor.snapshot";
pub const SNAPSHOT_LABEL: &str = "scheduled";
/// Name of the Windows Task Scheduler task (created in the root task folder, current user).
pub const TASK_NAME: &str = "DevDoctor Daily Snapshot";

/// The scheduler in charge on this OS, for messages.
pub fn scheduler_name() -> &'static str {
    if cfg!(windows) {
        "Task Scheduler"
    } else {
        "launchd"
    }
}

/// Where the schedule is stored: the LaunchAgent plist on macOS; on Windows a pseudo-path
/// naming the Task Scheduler entry (tasks live in the scheduler's own store).
pub fn agent_plist_path(home: &Path) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(format!("Task Scheduler\\{TASK_NAME}"))
    } else {
        home.join("Library/LaunchAgents").join(format!("{AGENT_LABEL}.plist"))
    }
}

/// `schtasks.exe` from the Windows system directory.
pub fn schtasks_path() -> PathBuf {
    std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("System32").join("schtasks.exe")
}

/// The `/TR` command line of the Windows task.
pub fn task_command_line(program: &Path, data_dir: Option<&Path>) -> String {
    let mut s = format!("\"{}\"", program.to_string_lossy());
    if let Some(d) = data_dir {
        s.push_str(&format!(" --data-dir \"{}\"", d.to_string_lossy()));
    }
    s.push_str(&format!(" snapshot create --label {SNAPSHOT_LABEL}"));
    s
}

/// Parses the XML printed by `schtasks /Query /TN <name> /XML ONE`: the program, the daily
/// start time and whether the task is enabled. The output is UTF-16 on some systems; NUL bytes
/// left by a lossy decode are ignored.
pub fn parse_task_xml(xml: &str) -> Option<(PathBuf, u8, u8, bool)> {
    let xml: String = xml.chars().filter(|c| *c != '\u{0}' && *c != '\u{feff}').collect();
    let between = |open: &str, close: &str| -> Option<String> { xml.split(open).nth(1)?.split(close).next().map(|s| s.trim().to_string()) };
    let command = between("<Command>", "</Command>")?;
    let program = PathBuf::from(command.trim_matches('"').replace("&amp;", "&").replace("&quot;", "\""));
    let start = between("<StartBoundary>", "</StartBoundary>")?;
    let time = start.split('T').nth(1)?;
    let mut parts = time.split(':');
    let hour: u8 = parts.next()?.parse().ok()?;
    let minute: u8 = parts.next()?.parse().ok()?;
    let enabled = between("<Enabled>", "</Enabled>").map(|e| e.eq_ignore_ascii_case("true")).unwrap_or(true);
    Some((program, hour, minute, enabled))
}

/// Queries the Windows task. `None` when it does not exist (or `schtasks` failed).
pub fn task_status(ctx: &SystemContext) -> Option<(PathBuf, u8, u8, bool)> {
    let spec = CommandSpec::new(schtasks_path().to_string_lossy().into_owned())
        .args(["/Query", "/TN", TASK_NAME, "/XML", "ONE"])
        .timeout_ms(10_000);
    let out = ctx.run(&spec).ok()?;
    if !out.success() {
        return None;
    }
    parse_task_xml(&out.stdout)
}

pub fn log_path(dirs: &DevDoctorDirs) -> PathBuf {
    dirs.logs_dir.join("scheduled-snapshot.log")
}

/// The `devdoctor` command line binary to run from the agent: the current executable when it is
/// the CLI itself, otherwise the first `devdoctor` found in PATH (the desktop app relies on this).
pub fn cli_binary(ctx: &SystemContext) -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        if exe.file_name().is_some_and(|n| n == "devdoctor") {
            return std::fs::canonicalize(&exe).ok().or(Some(exe));
        }
    }
    ctx.find_program("devdoctor").and_then(|p| std::fs::canonicalize(&p).ok().or(Some(p)))
}

/// The data directory to pass to the scheduled command when it is not the default one.
pub fn custom_data_dir(ctx: &SystemContext) -> Option<PathBuf> {
    let default = DevDoctorDirs::default_data_dir(&ctx.home);
    if ctx.dirs.data_dir == default {
        None
    } else {
        Some(ctx.dirs.data_dir.clone())
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// The LaunchAgent property list. `StartCalendarInterval` fires at the given wall-clock time and
/// launchd runs a missed job as soon as the Mac wakes up.
pub fn build_plist(program: &Path, data_dir: Option<&Path>, hour: u8, minute: u8, log: &Path) -> String {
    let mut args: Vec<String> = vec![program.to_string_lossy().into_owned()];
    if let Some(d) = data_dir {
        args.push("--data-dir".into());
        args.push(d.to_string_lossy().into_owned());
    }
    args.extend(["snapshot", "create", "--label", SNAPSHOT_LABEL].map(str::to_string));
    let args_xml: String = args.iter().map(|a| format!("\t\t<string>{}</string>\n", xml_escape(a))).collect();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n\
<dict>\n\
\t<key>Label</key>\n\
\t<string>{label}</string>\n\
\t<key>Comment</key>\n\
\t<string>DevDoctor: daily environment snapshot (installed by `devdoctor snapshot schedule`; remove with `devdoctor snapshot unschedule`)</string>\n\
\t<key>ProgramArguments</key>\n\
\t<array>\n{args_xml}\t</array>\n\
\t<key>StartCalendarInterval</key>\n\
\t<dict>\n\
\t\t<key>Hour</key>\n\
\t\t<integer>{hour}</integer>\n\
\t\t<key>Minute</key>\n\
\t\t<integer>{minute}</integer>\n\
\t</dict>\n\
\t<key>RunAtLoad</key>\n\
\t<false/>\n\
\t<key>StandardOutPath</key>\n\
\t<string>{log}</string>\n\
\t<key>StandardErrorPath</key>\n\
\t<string>{log}</string>\n\
\t<key>EnvironmentVariables</key>\n\
\t<dict>\n\
\t\t<key>PATH</key>\n\
\t\t<string>/usr/bin:/bin:/usr/sbin:/sbin</string>\n\
\t</dict>\n\
\t<key>ProcessType</key>\n\
\t<string>Background</string>\n\
\t<key>LowPriorityIO</key>\n\
\t<true/>\n\
</dict>\n\
</plist>\n",
        label = AGENT_LABEL,
        log = xml_escape(&log.to_string_lossy()),
    )
}

/// Extracts the program and the scheduled time from a plist written by [`build_plist`].
pub fn parse_plist(xml: &str) -> Option<(PathBuf, u8, u8)> {
    let program = xml.split("<array>").nth(1)?.split("<string>").nth(1)?.split("</string>").next()?.trim();
    let int_after = |key: &str| -> Option<u8> {
        xml.split(&format!("<key>{key}</key>")).nth(1)?.split("<integer>").nth(1)?.split("</integer>").next()?.trim().parse().ok()
    };
    Some((
        PathBuf::from(program.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")),
        int_after("Hour")?,
        int_after("Minute")?,
    ))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotSchedule {
    /// The plist exists in ~/Library/LaunchAgents.
    pub installed: bool,
    /// launchd currently knows the agent.
    pub loaded: bool,
    pub plist_path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program: Option<PathBuf>,
    pub program_exists: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hour: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minute: Option<u8>,
    /// When the agent last wrote to its log (approximates the last scheduled run).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run: Option<DateTime<Utc>>,
    pub log_path: PathBuf,
    /// The `devdoctor` binary a new schedule would use, when one can be found.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub available_program: Option<PathBuf>,
    pub notes: Vec<String>,
}

pub fn service_target(uid: u32) -> String {
    format!("gui/{uid}/{AGENT_LABEL}")
}

/// Whether the schedule is active: launchd has the agent loaded (`launchctl print` succeeds)
/// on macOS; the task exists and is enabled on Windows.
pub fn is_loaded(ctx: &SystemContext) -> bool {
    if cfg!(windows) {
        return task_status(ctx).is_some_and(|(_, _, _, enabled)| enabled);
    }
    let target = service_target(ctx.platform.current_uid());
    ctx.run(&CommandSpec::new("/bin/launchctl").args(["print", &target]).timeout_ms(5_000)).map(|o| o.success()).unwrap_or(false)
}

pub fn status(ctx: &SystemContext) -> SnapshotSchedule {
    if cfg!(windows) {
        return status_windows(ctx);
    }
    let plist_path = agent_plist_path(&ctx.home);
    let log = log_path(&ctx.dirs);
    let mut notes = Vec::new();
    let content = crate::fs_util::read_to_string_opt(&plist_path).ok().flatten();
    let installed = content.is_some();
    let parsed = content.as_deref().and_then(parse_plist);
    let program = parsed.as_ref().map(|(p, _, _)| p.clone());
    let program_exists = program.as_ref().is_some_and(|p| p.exists());
    if installed && !program_exists {
        notes.push(
            "The scheduled command no longer exists; re-run `devdoctor snapshot schedule` after moving or reinstalling DevDoctor.".into(),
        );
    }
    let loaded = if installed { is_loaded(ctx) } else { false };
    if installed && !loaded {
        notes.push("The agent file exists but launchd has not loaded it (it loads at your next login, or run `devdoctor snapshot schedule` again).".into());
    }
    let last_run = std::fs::metadata(&log).ok().and_then(|m| m.modified().ok()).map(DateTime::<Utc>::from);
    let available_program = cli_binary(ctx);
    if let Some(p) = &available_program {
        if p.components().any(|c| c.as_os_str() == "target") {
            notes.push(format!("{} is a build directory binary; install the CLI (`cargo install --path crates/devdoctor-cli`) before scheduling so the path stays valid.", crate::fs_util::display_path(p, &ctx.home)));
        }
    }
    SnapshotSchedule {
        installed,
        loaded,
        plist_path,
        program,
        program_exists,
        hour: parsed.as_ref().map(|(_, h, _)| *h),
        minute: parsed.as_ref().map(|(_, _, m)| *m),
        last_run,
        log_path: log,
        available_program,
        notes,
    }
}

fn status_windows(ctx: &SystemContext) -> SnapshotSchedule {
    let plist_path = agent_plist_path(&ctx.home);
    let log = log_path(&ctx.dirs);
    let mut notes = Vec::new();
    let task = task_status(ctx);
    let installed = task.is_some();
    let program = task.as_ref().map(|(p, _, _, _)| p.clone());
    let program_exists = program.as_ref().is_some_and(|p| p.exists());
    if installed && !program_exists {
        notes.push(
            "The scheduled command no longer exists; re-run `devdoctor snapshot schedule` after moving or reinstalling DevDoctor.".into(),
        );
    }
    let loaded = task.as_ref().is_some_and(|(_, _, _, enabled)| *enabled);
    if installed && !loaded {
        notes.push("The task exists but is disabled in Task Scheduler; run `devdoctor snapshot schedule` again to re-enable it.".into());
    }
    let last_run = std::fs::metadata(&log).ok().and_then(|m| m.modified().ok()).map(DateTime::<Utc>::from);
    let available_program = cli_binary(ctx);
    if let Some(p) = &available_program {
        if p.components().any(|c| c.as_os_str() == "target") {
            notes.push(format!("{} is a build directory binary; install the CLI (`cargo install --path crates/devdoctor-cli`) before scheduling so the path stays valid.", crate::fs_util::display_path(p, &ctx.home)));
        }
    }
    SnapshotSchedule {
        installed,
        loaded,
        plist_path,
        program,
        program_exists,
        hour: task.as_ref().map(|(_, h, _, _)| *h),
        minute: task.as_ref().map(|(_, _, m, _)| *m),
        last_run,
        log_path: log,
        available_program,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_xml_round_trips_program_and_time() {
        let xml = "\u{feff}<?xml version=\"1.0\" encoding=\"UTF-16\"?>\n<Task version=\"1.2\">\n  <Triggers>\n    <CalendarTrigger>\n      <StartBoundary>2026-09-05T07:30:00</StartBoundary>\n      <Enabled>true</Enabled>\n    </CalendarTrigger>\n  </Triggers>\n  <Settings><Enabled>true</Enabled></Settings>\n  <Actions>\n    <Exec>\n      <Command>\"C:\\Users\\me\\.cargo\\bin\\devdoctor.exe\"</Command>\n      <Arguments>snapshot create --label scheduled</Arguments>\n    </Exec>\n  </Actions>\n</Task>";
        let (program, hour, minute, enabled) = parse_task_xml(xml).unwrap();
        assert_eq!(program, PathBuf::from("C:\\Users\\me\\.cargo\\bin\\devdoctor.exe"));
        assert_eq!((hour, minute), (7, 30));
        assert!(enabled);
        // Lossy UTF-16 decode leaves NULs between characters; they must not break parsing.
        let nul: String = xml.chars().flat_map(|c| [c, '\u{0}']).collect();
        assert_eq!(parse_task_xml(&nul).map(|t| (t.1, t.2)), Some((7, 30)));
        assert_eq!(
            task_command_line(Path::new("C:\\dd\\devdoctor.exe"), None),
            "\"C:\\dd\\devdoctor.exe\" snapshot create --label scheduled"
        );
    }

    #[test]
    fn plist_round_trips_program_and_time() {
        let xml = build_plist(
            Path::new("/Users/me/.cargo/bin/devdoctor"),
            Some(Path::new("/Users/me/data & more")),
            7,
            30,
            Path::new("/Users/me/Library/Logs/DevDoctor/x.log"),
        );
        assert!(xml.contains("<string>--data-dir</string>"));
        assert!(xml.contains("data &amp; more"));
        let (program, hour, minute) = parse_plist(&xml).expect("parses");
        assert_eq!(program, PathBuf::from("/Users/me/.cargo/bin/devdoctor"));
        assert_eq!((hour, minute), (7, 30));
        assert!(xml.contains("<key>RunAtLoad</key>\n\t<false/>"));
    }
}
