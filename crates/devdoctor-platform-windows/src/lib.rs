//! Windows implementation of [`Platform`]. Processes come from `sysinfo`; listening ports
//! from `netstat -ano`; startup entries from the per-user `Run` registry key and the Startup
//! folder; processes are stopped with `taskkill`. Nothing here needs administrator rights.
//!
//! The parsers are plain functions over command output so they are unit-tested on every OS.

use chrono::{DateTime, Utc};
use devdoctor_core::command::{CommandRunner, CommandSpec};
use devdoctor_core::platform::{ListeningPort, OsInfo, Platform, ProcessInfo, ServiceInfo, ServiceKind, ServiceOrigin};
use devdoctor_core::{Error, Result};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

pub struct WindowsPlatform {
    runner: Arc<dyn CommandRunner>,
    system: Mutex<System>,
    os_info: OnceLock<OsInfo>,
}

impl WindowsPlatform {
    pub fn new(runner: Arc<dyn CommandRunner>) -> Self {
        Self { runner, system: Mutex::new(System::new()), os_info: OnceLock::new() }
    }

    fn system_dir(&self) -> PathBuf {
        std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("System32")
    }

    fn system_command(&self, exe: &str) -> CommandSpec {
        CommandSpec::new(self.system_dir().join(exe).to_string_lossy().into_owned())
    }

    /// Process names by pid, used to label ports (`netstat` only reports pids).
    fn process_names(&self) -> std::collections::HashMap<u32, String> {
        let mut names = std::collections::HashMap::new();
        if let Ok(mut sys) = self.system.lock() {
            sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
            for (pid, p) in sys.processes() {
                names.insert(pid.as_u32(), p.name().to_string_lossy().into_owned());
            }
        }
        names
    }
}

/// Parses `netstat -ano -p TCP` (and the IPv6 variant) output into listening ports.
pub fn parse_netstat(text: &str) -> Vec<ListeningPort> {
    let mut out = Vec::new();
    for line in text.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        // Proto  Local Address  Foreign Address  State  PID
        if cols.len() < 5 || !cols[0].eq_ignore_ascii_case("TCP") || !cols[3].eq_ignore_ascii_case("LISTENING") {
            continue;
        }
        let Some((address, port)) = split_host_port(cols[1]) else { continue };
        let Ok(port) = port.parse::<u16>() else { continue };
        let pid = cols[4].parse::<u32>().ok().filter(|p| *p != 0);
        let local_only = Some(address == "127.0.0.1" || address == "::1" || address.starts_with("127."));
        out.push(ListeningPort { port, pid, process_name: None, address, protocol: "tcp".into(), local_only });
    }
    out.sort_by_key(|p| (p.port, p.address.clone()));
    out.dedup_by(|a, b| a.port == b.port && a.address == b.address && a.pid == b.pid);
    out
}

/// `0.0.0.0:135` → (`0.0.0.0`, `135`); `[::1]:5173` → (`::1`, `5173`).
fn split_host_port(s: &str) -> Option<(String, &str)> {
    let idx = s.rfind(':')?;
    let (host, port) = (&s[..idx], &s[idx + 1..]);
    let host = host.trim_start_matches('[').trim_end_matches(']');
    Some((host.to_string(), port))
}

/// Parses `reg query HKCU\...\Run` output: one `    <name>    REG_SZ    <command>` line per entry.
pub fn parse_reg_run_key(text: &str, key_path: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim_start();
        if trimmed.is_empty() || !line.starts_with(char::is_whitespace) {
            continue;
        }
        let Some(pos) = trimmed.find("    REG_") else { continue };
        let name = trimmed[..pos].trim().to_string();
        let rest = trimmed[pos..].trim_start();
        let mut parts = rest.splitn(2, "    ");
        let _kind = parts.next();
        let command = parts.next().unwrap_or("").trim().to_string();
        if name.is_empty() || name == "(Default)" || command.is_empty() {
            continue;
        }
        let _ = key_path;
        out.push((name, command));
    }
    out
}

/// The executable at the start of a Windows command line (`"C:\Program Files\x.exe" /flag`,
/// `C:\Program Files\x.exe /flag` or `x.exe`).
pub fn program_of_command_line(cmd: &str) -> (PathBuf, Vec<String>) {
    let cmd = cmd.trim();
    if let Some(rest) = cmd.strip_prefix('"') {
        if let Some(end) = rest.find('"') {
            let program = &rest[..end];
            let args = rest[end + 1..].split_whitespace().map(str::to_string).collect();
            return (PathBuf::from(program), args);
        }
    }
    let lower = cmd.to_ascii_lowercase();
    if let Some(idx) = lower.find(".exe") {
        let program = &cmd[..idx + 4];
        let args = cmd[idx + 4..].split_whitespace().map(str::to_string).collect();
        return (PathBuf::from(program), args);
    }
    let mut it = cmd.split_whitespace();
    let program = it.next().unwrap_or_default();
    (PathBuf::from(program), it.map(str::to_string).collect())
}

const DEV_MARKERS: &[&str] = &[
    "docker",
    "orbstack",
    "podman",
    "ollama",
    "lm studio",
    "lmstudio",
    "postgres",
    "mysql",
    "mariadb",
    "redis",
    "mongo",
    "node",
    "nvm",
    "python",
    "conda",
    "jetbrains",
    "toolbox",
    "visual studio",
    "vscode",
    "code.exe",
    "cursor",
    "github",
    "git",
    "wsl",
    "vagrant",
    "virtualbox",
    "vmware",
    "unity hub",
    "android",
    "flutter",
    "dotnet",
    "rancher",
    "minikube",
    "kubernetes",
    "ngrok",
    "tailscale",
];

fn service_origin(program: &Path, name: &str) -> ServiceOrigin {
    let hay = format!("{} {}", program.to_string_lossy(), name).to_ascii_lowercase();
    if hay.contains("microsoft") && !hay.contains("visual studio") && !hay.contains("vscode") && !hay.contains("code.exe") {
        return ServiceOrigin::Apple;
    }
    if DEV_MARKERS.iter().any(|m| hay.contains(m)) {
        ServiceOrigin::Developer
    } else {
        ServiceOrigin::ThirdParty
    }
}

fn startup_entry(name: String, command: String, source: PathBuf) -> ServiceInfo {
    let (program, args) = program_of_command_line(&command);
    let expanded = expand_env(&program.to_string_lossy());
    let target_exists = if expanded.is_absolute() { Some(expanded.exists()) } else { None };
    let mut program_arguments = vec![expanded.to_string_lossy().into_owned()];
    program_arguments.extend(args);
    let origin = service_origin(&expanded, &name);
    ServiceInfo {
        origin,
        label: name,
        kind: ServiceKind::UserAgent,
        plist_path: source,
        program: Some(expanded),
        program_arguments,
        run_at_load: true,
        keep_alive: false,
        loaded: Some(true),
        running_pid: None,
        last_exit_status: None,
        target_exists,
        working_directory: None,
    }
}

/// Expands `%VAR%` references using the process environment.
pub fn expand_env(raw: &str) -> PathBuf {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let var = &after[..end];
                match std::env::var(var) {
                    Ok(v) => out.push_str(&v),
                    Err(_) => {
                        out.push('%');
                        out.push_str(var);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    PathBuf::from(out)
}

impl Platform for WindowsPlatform {
    fn os_info(&self) -> OsInfo {
        self.os_info
            .get_or_init(|| OsInfo {
                name: System::name().unwrap_or_else(|| "Windows".into()),
                version: System::os_version().unwrap_or_default(),
                build: System::kernel_version(),
                arch: std::env::consts::ARCH.replace("aarch64", "arm64"),
                rosetta: None,
            })
            .clone()
    }

    /// Windows has no numeric user id; every process the adapter can see belongs to the
    /// current session's user or is a system process that `taskkill` refuses anyway.
    fn current_uid(&self) -> u32 {
        0
    }

    fn processes(&self) -> Result<Vec<ProcessInfo>> {
        let mut sys = self.system.lock().map_err(|_| Error::other("process table lock poisoned"))?;
        // User lookups are slow on Windows and not needed: ownership is enforced by the OS.
        let kind = ProcessRefreshKind::nothing()
            .with_cmd(UpdateKind::Always)
            .with_cwd(UpdateKind::Always)
            .with_exe(UpdateKind::Always)
            .with_memory()
            .with_cpu();
        sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
        let mut out = Vec::new();
        for (pid, p) in sys.processes() {
            let started = p.start_time();
            out.push(ProcessInfo {
                pid: pid.as_u32(),
                parent_pid: p.parent().map(|pp| pp.as_u32()),
                name: p.name().to_string_lossy().into_owned(),
                exe: p.exe().map(Path::to_path_buf),
                command: p.cmd().iter().map(|c| c.to_string_lossy().into_owned()).collect(),
                cwd: p.cwd().map(Path::to_path_buf),
                cpu_percent: Some(p.cpu_usage()),
                memory_bytes: Some(p.memory()),
                started_at: if started > 0 { DateTime::<Utc>::from_timestamp(started as i64, 0) } else { None },
                run_time_secs: Some(p.run_time()),
                user_id: None,
            });
        }
        out.sort_by_key(|p| p.pid);
        Ok(out)
    }

    fn listening_ports(&self) -> Result<Vec<ListeningPort>> {
        let spec = self.system_command("netstat.exe").args(["-ano", "-p", "TCP"]).timeout_ms(15_000);
        let out = self.runner.run(&spec)?;
        if out.timed_out {
            return Err(Error::CommandTimeout { program: "netstat".into(), timeout_ms: 15_000 });
        }
        let mut ports = parse_netstat(&out.stdout);
        let spec6 = self.system_command("netstat.exe").args(["-ano", "-p", "TCPv6"]).timeout_ms(15_000);
        if let Ok(out6) = self.runner.run(&spec6) {
            ports.extend(parse_netstat(&out6.stdout));
        }
        let names = self.process_names();
        for p in &mut ports {
            p.process_name = p.pid.and_then(|pid| names.get(&pid).cloned());
        }
        ports.sort_by_key(|p| (p.port, p.address.clone()));
        Ok(ports)
    }

    fn services(&self) -> Result<Vec<ServiceInfo>> {
        let mut out = Vec::new();
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        let spec = self.system_command("reg.exe").args(["query", key]).timeout_ms(10_000);
        if let Ok(o) = self.runner.run(&spec) {
            for (name, command) in parse_reg_run_key(&o.stdout, key) {
                let source = PathBuf::from(format!(r"{key}\{name}"));
                out.push(startup_entry(name, command, source));
            }
        }
        if let Some(appdata) = std::env::var_os("APPDATA").map(PathBuf::from) {
            let startup = appdata.join(r"Microsoft\Windows\Start Menu\Programs\Startup");
            if let Ok(rd) = std::fs::read_dir(&startup) {
                for entry in rd.flatten() {
                    let path = entry.path();
                    let name = path.file_stem().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                    if name.is_empty() || name.eq_ignore_ascii_case("desktop") {
                        continue;
                    }
                    let mut info = startup_entry(name, path.to_string_lossy().into_owned(), path.clone());
                    info.target_exists = Some(path.exists());
                    out.push(info);
                }
            }
        }
        out.sort_by_key(|s| s.label.to_ascii_lowercase());
        Ok(out)
    }

    fn process_alive(&self, pid: u32) -> bool {
        let Ok(mut sys) = self.system.lock() else { return false };
        let target = Pid::from_u32(pid);
        sys.refresh_processes_specifics(ProcessesToUpdate::Some(&[target]), true, ProcessRefreshKind::nothing());
        sys.process(target).is_some()
    }

    /// `taskkill` without `/F` asks the process to close (WM_CLOSE / console control); with
    /// `/F` it terminates it, the equivalent of SIGKILL.
    fn stop_process(&self, pid: u32, force: bool) -> Result<()> {
        if pid <= 4 {
            return Err(Error::Invalid("refusing to stop a system process".into()));
        }
        let mut args = vec!["/PID".to_string(), pid.to_string()];
        if force {
            args.push("/F".into());
        }
        let out = self.runner.run(&self.system_command("taskkill.exe").args(args).timeout_ms(10_000))?;
        if !out.success() {
            let detail = out.stderr.trim();
            let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
            return Err(Error::Other(format!("could not stop process {pid}: {detail}")));
        }
        Ok(())
    }

    fn reveal_in_file_manager(&self, path: &Path) -> Result<()> {
        // explorer.exe returns a non-zero code even when it succeeds; only a failed spawn counts.
        let arg = format!("/select,{}", path.to_string_lossy());
        let exe = std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("explorer.exe");
        self.runner.run(&CommandSpec::new(exe.to_string_lossy().into_owned()).arg(arg).timeout_ms(5_000))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NETSTAT: &str = "\nActive Connections\n\n  Proto  Local Address          Foreign Address        State           PID\n  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1180\n  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       23412\n  TCP    192.168.1.20:50213     52.97.1.1:443          ESTABLISHED     8812\n  TCP    [::1]:8080             [::]:0                 LISTENING       23412\n";

    #[test]
    fn parses_netstat_listeners() {
        let ports = parse_netstat(NETSTAT);
        assert_eq!(ports.len(), 3);
        assert_eq!(ports[0].port, 135);
        assert_eq!(ports[0].address, "0.0.0.0");
        assert_eq!(ports[0].local_only, Some(false));
        assert_eq!(ports[1].port, 5173);
        assert_eq!(ports[1].pid, Some(23412));
        assert_eq!(ports[1].local_only, Some(true));
        assert_eq!(ports[2].address, "::1");
        assert_eq!(ports[2].local_only, Some(true));
    }

    const REG: &str = "\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\n    OneDrive    REG_SZ    \"C:\\Users\\me\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe\" /background\n    Docker Desktop    REG_SZ    C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe -Autostart\n    ollama    REG_EXPAND_SZ    %LOCALAPPDATA%\\Programs\\Ollama\\ollama app.exe\n";

    #[test]
    fn parses_run_key_entries() {
        let entries = parse_reg_run_key(REG, "HKCU");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].0, "OneDrive");
        assert_eq!(entries[1].0, "Docker Desktop");
        let (program, args) = program_of_command_line(&entries[0].1);
        assert_eq!(program, PathBuf::from(r"C:\Users\me\AppData\Local\Microsoft\OneDrive\OneDrive.exe"));
        assert_eq!(args, vec!["/background".to_string()]);
        let (program, args) = program_of_command_line(&entries[1].1);
        assert_eq!(program, PathBuf::from(r"C:\Program Files\Docker\Docker\Docker Desktop.exe"));
        assert_eq!(args, vec!["-Autostart".to_string()]);
        let (program, _) = program_of_command_line(&entries[2].1);
        assert_eq!(program, PathBuf::from(r"%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"));
    }

    #[test]
    fn classifies_startup_origin() {
        assert_eq!(
            service_origin(Path::new(r"C:\Program Files\Docker\Docker\Docker Desktop.exe"), "Docker Desktop"),
            ServiceOrigin::Developer
        );
        assert_eq!(
            service_origin(Path::new(r"C:\Users\me\AppData\Local\Microsoft\OneDrive\OneDrive.exe"), "OneDrive"),
            ServiceOrigin::Apple
        );
        assert_eq!(service_origin(Path::new(r"C:\Program Files\Spotify\Spotify.exe"), "Spotify"), ServiceOrigin::ThirdParty);
    }

    #[test]
    fn expands_percent_variables() {
        std::env::set_var("DD_TEST_ROOT", "X:\\root");
        assert_eq!(expand_env("%DD_TEST_ROOT%\\bin\\tool.exe"), PathBuf::from("X:\\root\\bin\\tool.exe"));
        assert_eq!(expand_env("%DD_MISSING%\\a"), PathBuf::from("%DD_MISSING%\\a"));
        assert_eq!(expand_env("plain"), PathBuf::from("plain"));
    }
}
