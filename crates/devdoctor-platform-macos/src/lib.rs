//! macOS implementation of [`devdoctor_core::platform::Platform`].

use chrono::{DateTime, Utc};
use devdoctor_core::command::{CommandRunner, CommandSpec};
use devdoctor_core::fs_util;
use devdoctor_core::platform::{ListeningPort, OsInfo, Platform, ProcessInfo, ServiceInfo, ServiceKind, ServiceOrigin};
use devdoctor_core::{Error, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

pub struct MacosPlatform {
    runner: Arc<dyn CommandRunner>,
    os_info: OnceLock<OsInfo>,
    system: Mutex<System>,
}

impl MacosPlatform {
    pub fn new(runner: Arc<dyn CommandRunner>) -> Self {
        Self { runner, os_info: OnceLock::new(), system: Mutex::new(System::new()) }
    }

    fn sysctl(&self, name: &str) -> Option<String> {
        let out = self.runner.run(&CommandSpec::new("/usr/sbin/sysctl").args(["-n", name]).timeout_ms(2_000)).ok()?;
        out.success().then(|| out.stdout.trim().to_string())
    }

    fn sw_vers(&self, flag: &str) -> Option<String> {
        let out = self.runner.run(&CommandSpec::new("/usr/bin/sw_vers").arg(flag).timeout_ms(2_000)).ok()?;
        out.success().then(|| out.stdout.trim().to_string())
    }

    fn launchctl_list(&self) -> HashMap<String, (Option<u32>, Option<i32>)> {
        let mut map = HashMap::new();
        let Ok(out) = self.runner.run(&CommandSpec::new("/bin/launchctl").arg("list").timeout_ms(5_000)) else { return map };
        for line in out.stdout.lines().skip(1) {
            let mut parts = line.split('\t');
            let (Some(pid), Some(status), Some(label)) = (parts.next(), parts.next(), parts.next()) else { continue };
            let pid = pid.trim().parse::<u32>().ok();
            let status = status.trim().parse::<i32>().ok();
            map.insert(label.trim().to_string(), (pid, status));
        }
        map
    }
}

fn service_origin(label: &str, program: Option<&Path>, args: &[String]) -> ServiceOrigin {
    if label.starts_with("homebrew.mxcl.") || label.starts_with("homebrew.") {
        return ServiceOrigin::HomebrewServices;
    }
    if label.starts_with("com.apple.") {
        return ServiceOrigin::Apple;
    }
    let haystack = format!(
        "{} {} {}",
        label.to_ascii_lowercase(),
        program.map(|p| p.to_string_lossy().to_ascii_lowercase()).unwrap_or_default(),
        args.join(" ").to_ascii_lowercase()
    );
    const DEV_MARKERS: &[&str] = &[
        "ollama",
        "docker",
        "orbstack",
        "postgres",
        "redis",
        "mysql",
        "mariadb",
        "mongo",
        "nginx",
        "node",
        "python",
        "jetbrains",
        "vscode",
        "code",
        "cursor",
        "ngrok",
        "tailscale",
        "colima",
        "lima",
        "minikube",
        "kubernetes",
        "elasticsearch",
        "rabbitmq",
        "kafka",
        "grafana",
        "prometheus",
        "vagrant",
        "virtualbox",
        "homebrew",
        "cargo",
        "rust",
        "pyenv",
        "nvm",
        "syncthing",
        "gpg",
        "ssh",
        "git",
        "github",
        "gitlab",
        "claude",
        "openai",
        "codex",
        "gemini",
        "lmstudio",
        "lm-studio",
    ];
    if DEV_MARKERS.iter().any(|m| haystack.contains(m)) {
        ServiceOrigin::Developer
    } else {
        ServiceOrigin::ThirdParty
    }
}

/// Parses `lsof -nP -iTCP -sTCP:LISTEN -F pcn` output.
pub fn parse_lsof(output: &str) -> Vec<ListeningPort> {
    let mut ports = Vec::new();
    let mut pid: Option<u32> = None;
    let mut command: Option<String> = None;
    for line in output.lines() {
        let Some(tag) = line.chars().next() else { continue };
        let value = &line[1..];
        match tag {
            'p' => {
                pid = value.trim().parse().ok();
                command = None;
            }
            'c' => command = Some(value.trim().to_string()),
            'n' => {
                let name = value.trim();
                let Some(idx) = name.rfind(':') else { continue };
                let (addr, port) = name.split_at(idx);
                let Ok(port) = port[1..].parse::<u16>() else { continue };
                let addr = addr.trim_matches(|c| c == '[' || c == ']').to_string();
                let local_only = Some(addr == "127.0.0.1" || addr == "::1" || addr == "localhost" || addr.starts_with("127."));
                if ports.iter().any(|p: &ListeningPort| p.port == port && p.pid == pid && p.address == addr) {
                    continue;
                }
                ports.push(ListeningPort { port, pid, process_name: command.clone(), address: addr, protocol: "tcp".into(), local_only });
            }
            _ => {}
        }
    }
    ports.sort_by_key(|p| (p.port, p.pid));
    ports
}

fn read_service_plist(path: &Path, kind: ServiceKind) -> Option<ServiceInfo> {
    let value: plist::Value = plist::from_file(path).ok()?;
    let dict = value.as_dictionary()?;
    let label = dict
        .get("Label")
        .and_then(|v| v.as_string())
        .map(|s| s.to_string())
        .unwrap_or_else(|| path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default());
    let program_arguments: Vec<String> = dict
        .get("ProgramArguments")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_string().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let program =
        dict.get("Program").and_then(|v| v.as_string()).map(PathBuf::from).or_else(|| program_arguments.first().map(PathBuf::from));
    let run_at_load = dict.get("RunAtLoad").and_then(|v| v.as_boolean()).unwrap_or(false);
    let keep_alive = match dict.get("KeepAlive") {
        Some(plist::Value::Boolean(b)) => *b,
        Some(plist::Value::Dictionary(_)) => true,
        _ => false,
    };
    let target_exists = program.as_ref().filter(|p| p.is_absolute()).map(|p| p.exists());
    let working_directory = dict.get("WorkingDirectory").and_then(|v| v.as_string()).map(PathBuf::from);
    let origin = service_origin(&label, program.as_deref(), &program_arguments);
    Some(ServiceInfo {
        label,
        kind,
        origin,
        plist_path: path.to_path_buf(),
        program,
        program_arguments,
        run_at_load,
        keep_alive,
        loaded: None,
        running_pid: None,
        last_exit_status: None,
        target_exists,
        working_directory,
    })
}

impl Platform for MacosPlatform {
    fn os_info(&self) -> OsInfo {
        self.os_info
            .get_or_init(|| {
                let apple_silicon = self.sysctl("hw.optional.arm64").as_deref() == Some("1");
                let translated = self.sysctl("sysctl.proc_translated").as_deref() == Some("1");
                OsInfo {
                    name: "macOS".into(),
                    version: self.sw_vers("-productVersion").unwrap_or_else(|| System::os_version().unwrap_or_default()),
                    build: self.sw_vers("-buildVersion"),
                    arch: if apple_silicon { "arm64".into() } else { std::env::consts::ARCH.replace("aarch64", "arm64") },
                    rosetta: Some(translated),
                }
            })
            .clone()
    }

    fn current_uid(&self) -> u32 {
        // SAFETY: getuid has no preconditions.
        unsafe { libc::getuid() }
    }

    fn processes(&self) -> Result<Vec<ProcessInfo>> {
        let mut sys = self.system.lock().map_err(|_| Error::other("process table lock poisoned"))?;
        let kind = ProcessRefreshKind::nothing()
            .with_cmd(UpdateKind::Always)
            .with_cwd(UpdateKind::Always)
            .with_exe(UpdateKind::Always)
            .with_user(UpdateKind::Always)
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
                user_id: p.user_id().map(|u| **u),
            });
        }
        out.sort_by_key(|p| p.pid);
        Ok(out)
    }

    fn listening_ports(&self) -> Result<Vec<ListeningPort>> {
        let spec = CommandSpec::new("/usr/sbin/lsof").args(["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcn"]).timeout_ms(15_000);
        let out = self.runner.run(&spec)?;
        if out.timed_out {
            return Err(Error::CommandTimeout { program: "lsof".into(), timeout_ms: 15_000 });
        }
        // lsof exits 1 when it finds nothing; that is not an error for us.
        Ok(parse_lsof(&out.stdout))
    }

    fn services(&self) -> Result<Vec<ServiceInfo>> {
        let home = std::env::var("HOME").map(PathBuf::from).unwrap_or_default();
        let dirs = [
            (home.join("Library/LaunchAgents"), ServiceKind::UserAgent),
            (PathBuf::from("/Library/LaunchAgents"), ServiceKind::GlobalAgent),
            (PathBuf::from("/Library/LaunchDaemons"), ServiceKind::Daemon),
        ];
        let running = self.launchctl_list();
        let mut out = Vec::new();
        for (dir, kind) in dirs {
            for entry in fs_util::list_dir(&dir) {
                if entry.extension().is_none_or(|e| e != "plist") {
                    continue;
                }
                if let Some(mut svc) = read_service_plist(&entry, kind) {
                    if kind != ServiceKind::Daemon {
                        match running.get(&svc.label) {
                            Some((pid, status)) => {
                                svc.loaded = Some(true);
                                svc.running_pid = *pid;
                                svc.last_exit_status = *status;
                            }
                            None => svc.loaded = Some(false),
                        }
                    }
                    out.push(svc);
                }
            }
        }
        out.sort_by(|a, b| a.label.cmp(&b.label));
        Ok(out)
    }

    fn process_alive(&self, pid: u32) -> bool {
        // SAFETY: kill with signal 0 only checks for existence/permission.
        let rc = unsafe { libc::kill(pid as libc::pid_t, 0) };
        if rc == 0 {
            return true;
        }
        std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
    }

    fn stop_process(&self, pid: u32, force: bool) -> Result<()> {
        if pid <= 1 {
            return Err(Error::Invalid("refusing to signal pid 0/1".into()));
        }
        let sig = if force { libc::SIGKILL } else { libc::SIGTERM };
        // SAFETY: sending a signal to a pid; the caller enforces the safety policy.
        let rc = unsafe { libc::kill(pid as libc::pid_t, sig) };
        if rc != 0 {
            let err = std::io::Error::last_os_error();
            return Err(Error::Other(format!("could not stop process {pid}: {err}")));
        }
        Ok(())
    }

    fn reveal_in_file_manager(&self, path: &Path) -> Result<()> {
        let out =
            self.runner.run(&CommandSpec::new("/usr/bin/open").arg("-R").arg(path.to_string_lossy().into_owned()).timeout_ms(5_000))?;
        if !out.success() {
            return Err(Error::Other(format!("open -R failed: {}", out.stderr.trim())));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lsof_output() {
        let out = "p123\ncnode\nn*:3000\nn127.0.0.1:3000\np456\ncpostgres\nn127.0.0.1:5432\nn[::1]:5432\n";
        let ports = parse_lsof(out);
        assert_eq!(ports.len(), 4);
        assert_eq!(ports[0].port, 3000);
        assert_eq!(ports[0].pid, Some(123));
        assert_eq!(ports[0].process_name.as_deref(), Some("node"));
        assert_eq!(ports[0].local_only, Some(false));
        assert!(ports.iter().any(|p| p.port == 5432 && p.address == "::1" && p.local_only == Some(true)));
    }

    #[test]
    fn classifies_service_origins() {
        assert_eq!(service_origin("homebrew.mxcl.postgresql@16", None, &[]), ServiceOrigin::HomebrewServices);
        assert_eq!(service_origin("com.apple.foo", None, &[]), ServiceOrigin::Apple);
        assert_eq!(
            service_origin("com.example.agent", Some(Path::new("/Applications/Ollama.app/Contents/MacOS/Ollama")), &[]),
            ServiceOrigin::Developer
        );
        assert_eq!(service_origin("com.adobe.updater", Some(Path::new("/Library/Adobe/updater")), &[]), ServiceOrigin::ThirdParty);
    }
}
