//! The system context: the single door through which detectors and fixers look at the machine.

use crate::command::{CommandOutput, CommandRunner, CommandSpec, VersionCache};
use crate::path_env::{capture_shell, EffectivePath, ShellCapture};
use crate::paths::DevDoctorDirs;
use crate::platform::{OsInfo, Platform};
use crate::redact::is_sensitive_name;
use crate::shell::{analyze, ShellAnalysis, ShellKind};
use crate::Result;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};

/// Environment variables of the DevDoctor process. Values of sensitive variables are never
/// displayed; `get` is only used for expansion logic.
#[derive(Debug, Clone, Default)]
pub struct EnvVars {
    vars: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVarDisplay {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub sensitive: bool,
}

impl EnvVars {
    pub fn from_process() -> Self {
        Self { vars: std::env::vars().collect() }
    }

    pub fn from_map(vars: BTreeMap<String, String>) -> Self {
        Self { vars }
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.vars.get(name).map(String::as_str)
    }

    pub fn names(&self) -> Vec<String> {
        self.vars.keys().cloned().collect()
    }

    /// Display-safe view: sensitive values are replaced by `None`.
    pub fn display(&self) -> Vec<EnvVarDisplay> {
        self.vars
            .iter()
            .map(|(k, v)| {
                let sensitive = is_sensitive_name(k);
                EnvVarDisplay { name: k.clone(), value: if sensitive { None } else { Some(v.clone()) }, sensitive }
            })
            .collect()
    }
}

#[derive(Debug, Clone)]
pub struct ContextOptions {
    /// Use this PATH instead of spawning a login shell (tests, `--path` flag).
    pub path_override: Option<String>,
    pub shell_timeout_ms: u64,
    /// When false, never spawn the user's shell; use the process environment.
    pub capture_shell: bool,
}

impl Default for ContextOptions {
    fn default() -> Self {
        Self { path_override: None, shell_timeout_ms: 8_000, capture_shell: true }
    }
}

pub struct SystemContext {
    pub home: PathBuf,
    pub user: String,
    pub shell: ShellKind,
    pub shell_path: PathBuf,
    pub os: OsInfo,
    pub env: EnvVars,
    pub dirs: DevDoctorDirs,
    pub platform: Arc<dyn Platform>,
    pub runner: Arc<dyn CommandRunner>,
    pub options: ContextOptions,
    pub versions: VersionCache,
    capture: RwLock<Option<Arc<ShellCapture>>>,
    shell_analysis: RwLock<Option<Arc<ShellAnalysis>>>,
    program_cache: Mutex<HashMap<String, Option<PathBuf>>>,
}

impl SystemContext {
    /// Builds a context for the current user.
    pub fn detect(
        platform: Arc<dyn Platform>,
        runner: Arc<dyn CommandRunner>,
        dirs: DevDoctorDirs,
        options: ContextOptions,
    ) -> Result<Self> {
        let env = EnvVars::from_process();
        let home = env
            .get("HOME")
            .map(PathBuf::from)
            .or_else(dirs::home_dir)
            .ok_or_else(|| crate::Error::other("cannot determine home directory"))?;
        let user = env.get("USER").or(env.get("LOGNAME")).unwrap_or("unknown").to_string();
        let shell_path = env.get("SHELL").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/bin/zsh"));
        let shell = ShellKind::from_path(&shell_path);
        let os = platform.os_info();
        Ok(Self {
            home,
            user,
            shell,
            shell_path,
            os,
            env,
            dirs,
            platform,
            runner,
            options,
            versions: VersionCache::default(),
            capture: RwLock::new(None),
            shell_analysis: RwLock::new(None),
            program_cache: Mutex::new(HashMap::new()),
        })
    }

    /// Context for tests: fake home, fake platform, mock runner, explicit PATH.
    pub fn for_test(home: &Path, platform: Arc<dyn Platform>, runner: Arc<dyn CommandRunner>, path: &str) -> Self {
        let mut vars = BTreeMap::new();
        vars.insert("HOME".to_string(), home.to_string_lossy().into_owned());
        vars.insert("USER".to_string(), "tester".to_string());
        vars.insert("SHELL".to_string(), "/bin/zsh".to_string());
        let os = platform.os_info();
        Self {
            home: home.to_path_buf(),
            user: "tester".into(),
            shell: ShellKind::Zsh,
            shell_path: PathBuf::from("/bin/zsh"),
            os,
            env: EnvVars::from_map(vars),
            dirs: DevDoctorDirs::in_dir(&home.join(".devdoctor")),
            platform,
            runner,
            options: ContextOptions { path_override: Some(path.to_string()), shell_timeout_ms: 1_000, capture_shell: false },
            versions: VersionCache::default(),
            capture: RwLock::new(None),
            shell_analysis: RwLock::new(None),
            program_cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn run(&self, spec: &CommandSpec) -> Result<CommandOutput> {
        self.runner.run(spec)
    }

    /// The shell capture (PATH, aliases, functions, selected variables) from a fresh login shell.
    pub fn shell_capture(&self) -> Arc<ShellCapture> {
        if let Some(c) = self.capture.read().expect("capture lock").as_ref() {
            return c.clone();
        }
        let capture = Arc::new(capture_shell(self));
        *self.capture.write().expect("capture lock") = Some(capture.clone());
        capture
    }

    /// Re-captures the shell state, bypassing the cache (used to validate fixes).
    pub fn refresh_shell_capture(&self) -> Arc<ShellCapture> {
        let capture = Arc::new(capture_shell(self));
        *self.capture.write().expect("capture lock") = Some(capture.clone());
        *self.shell_analysis.write().expect("analysis lock") = None;
        capture
    }

    pub fn effective_path(&self) -> EffectivePath {
        self.shell_capture().path.clone()
    }

    /// Static analysis of the user's startup files (cached per context).
    pub fn shell_analysis(&self) -> Arc<ShellAnalysis> {
        if let Some(a) = self.shell_analysis.read().expect("analysis lock").as_ref() {
            return a.clone();
        }
        let capture = self.shell_capture();
        let analysis = Arc::new(analyze(self.shell, &self.home, &capture.vars, crate::path_env::system_path_entries()));
        *self.shell_analysis.write().expect("analysis lock") = Some(analysis.clone());
        analysis
    }

    pub fn invalidate_shell_analysis(&self) {
        *self.shell_analysis.write().expect("analysis lock") = None;
    }

    /// Finds an executable by name in the effective PATH, then in well-known locations.
    pub fn find_program(&self, name: &str) -> Option<PathBuf> {
        if let Some(cached) = self.program_cache.lock().expect("program cache").get(name) {
            return cached.clone();
        }
        let mut candidates: Vec<PathBuf> = self.effective_path().entries.iter().map(|d| Path::new(d).join(name)).collect();
        for dir in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
            candidates.push(Path::new(dir).join(name));
        }
        candidates.push(self.home.join(".local/bin").join(name));
        candidates.push(self.home.join(".cargo/bin").join(name));
        let found = candidates.into_iter().find(|p| crate::fs_util::is_executable_file(p));
        self.program_cache.lock().expect("program cache").insert(name.to_string(), found.clone());
        found
    }

    /// Homebrew prefix: `HOMEBREW_PREFIX`, then the architecture default, then the other one.
    pub fn brew_prefix(&self) -> Option<PathBuf> {
        if let Some(p) = self.shell_capture().vars.get("HOMEBREW_PREFIX") {
            let pb = PathBuf::from(p);
            if pb.join("bin/brew").exists() {
                return Some(pb);
            }
        }
        let arm = PathBuf::from("/opt/homebrew");
        let intel = PathBuf::from("/usr/local");
        let prefer_arm = self.os.arch == "arm64";
        let order = if prefer_arm { [arm, intel] } else { [intel, arm] };
        order.into_iter().find(|p| p.join("bin/brew").exists())
    }

    pub fn display_path(&self, path: &Path) -> String {
        crate::fs_util::display_path(path, &self.home)
    }
}
