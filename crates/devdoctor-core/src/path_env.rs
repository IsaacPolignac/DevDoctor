//! The effective `PATH`: captured from a fresh login shell, attributed to the configuration
//! that produced it, and explained entry by entry.

use crate::command::CommandSpec;
use crate::context::SystemContext;
use crate::fs_util;
use crate::shell::{normalize_key, PathOp, ShellKind};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Variables captured from the login shell for static expansion. Only non-secret, path-like
/// variables are included (never the whole environment).
pub const CAPTURED_VARS: &[&str] = &[
    "HOME",
    "USER",
    "SHELL",
    "ZDOTDIR",
    "NVM_DIR",
    "PYENV_ROOT",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "VOLTA_HOME",
    "PNPM_HOME",
    "BUN_INSTALL",
    "DENO_INSTALL",
    "GOPATH",
    "GOROOT",
    "HOMEBREW_PREFIX",
    "HOMEBREW_CELLAR",
    "HOMEBREW_REPOSITORY",
    "ASDF_DIR",
    "ASDF_DATA_DIR",
    "MISE_DATA_DIR",
    "FNM_DIR",
    "N_PREFIX",
    "NODENV_ROOT",
    "RBENV_ROOT",
    "JENV_ROOT",
    "SDKMAN_DIR",
    "JAVA_HOME",
    "ANDROID_HOME",
    "ANDROID_SDK_ROOT",
    "FLUTTER_ROOT",
    "PIPX_HOME",
    "PIPX_BIN_DIR",
    "UV_TOOL_BIN_DIR",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "CONDA_PREFIX",
    "CONDA_EXE",
    "OLLAMA_MODELS",
    "HF_HOME",
    "HUGGINGFACE_HUB_CACHE",
    "NPM_CONFIG_PREFIX",
    "DOCKER_HOST",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum PathSource {
    /// Captured from a fresh `$SHELL -l -i` session: what a new terminal window sees.
    LoginShell { shell: String },
    /// The DevDoctor process environment (fallback when the shell could not be run).
    ProcessEnvironment,
    /// Explicit override (tests, `--path`).
    Override,
    /// Windows: the machine PATH followed by the user PATH, read from the registry through
    /// PowerShell. This is what a newly opened terminal sees.
    Registry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectivePath {
    pub raw: String,
    pub entries: Vec<String>,
    pub source: PathSource,
    pub captured_at: DateTime<Utc>,
}

impl EffectivePath {
    pub fn parse(raw: &str, source: PathSource) -> Self {
        let entries = crate::sys::split_path_list(raw);
        Self { raw: raw.to_string(), entries, source, captured_at: Utc::now() }
    }

    pub fn dedup_order(&self) -> Vec<String> {
        crate::shell::dedup_order(&self.entries)
    }

    /// Directories that appear more than once, with their 1-based positions.
    pub fn duplicates(&self) -> Vec<(String, Vec<usize>)> {
        let mut positions: BTreeMap<String, Vec<usize>> = BTreeMap::new();
        let mut order: Vec<String> = Vec::new();
        for (i, e) in self.entries.iter().enumerate() {
            let key = normalize_key(e);
            let entry = positions.entry(key.clone()).or_default();
            if entry.is_empty() {
                order.push(key);
            }
            entry.push(i + 1);
        }
        order.into_iter().filter_map(|k| positions.get(&k).filter(|v| v.len() > 1).map(|v| (k.clone(), v.clone()))).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellCapture {
    pub path: EffectivePath,
    pub aliases: BTreeMap<String, String>,
    pub functions: Vec<String>,
    pub vars: BTreeMap<String, String>,
    /// Names (never values) of the environment variables exported by the login shell.
    pub env_names: Vec<String>,
    pub duration_ms: u64,
    pub warnings: Vec<String>,
    /// What the shell printed to stderr while starting (errors from startup files), redacted
    /// and capped. Empty when the shell started silently.
    #[serde(default)]
    pub stderr_lines: Vec<String>,
}

/// Maximum number of stderr lines kept from a login shell start.
pub const MAX_STDERR_LINES: usize = 40;

/// Builds the command that starts the user's login shell in the controlled environment DevDoctor
/// uses for every observation: minimal PATH, `TERM=dumb`, no inherited secrets. Used by the PATH
/// capture, the startup profiler and fix validation so they all see the same shell.
pub fn login_shell_spec(ctx: &SystemContext, args: &[&str]) -> CommandSpec {
    let mut spec = CommandSpec::new(ctx.shell_path.to_string_lossy().into_owned())
        .args(args.iter().map(|a| a.to_string()))
        .clear_env()
        .env("HOME", ctx.home.to_string_lossy().into_owned())
        .env("USER", ctx.user.clone())
        .env("LOGNAME", ctx.user.clone())
        .env("SHELL", ctx.shell_path.to_string_lossy().into_owned())
        .env("TERM", "dumb")
        .env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
        .env("DEVDOCTOR", "1")
        .env("LANG", ctx.env.get("LANG").unwrap_or("en_US.UTF-8").to_string())
        .timeout_ms(ctx.options.shell_timeout_ms);
    for passthrough in ["TMPDIR", "ZDOTDIR", "XDG_CONFIG_HOME"] {
        if let Some(v) = ctx.env.get(passthrough) {
            spec = spec.env(passthrough, v.to_string());
        }
    }
    spec
}

/// Keeps the meaningful stderr lines of a shell start: trimmed, non-empty, secrets redacted,
/// capped at [`MAX_STDERR_LINES`].
pub fn collect_stderr_lines(stderr: &str) -> Vec<String> {
    stderr.lines().map(str::trim).filter(|l| !l.is_empty()).take(MAX_STDERR_LINES).map(crate::redact::redact_text).collect()
}

const MARK_PATH: &str = "__DD_PATH__=";
const MARK_VAR: &str = "__DD_VAR__";
const MARK_ALIAS: &str = "__DD_ALIAS__";
const MARK_FN: &str = "__DD_FN__";
const MARK_ENV: &str = "__DD_ENV__";

fn capture_script(shell: ShellKind) -> String {
    let vars = CAPTURED_VARS.join(" ");
    match shell {
        ShellKind::Zsh => format!(
            "print -r -- \"{MARK_PATH}$PATH\"\n\
             for v in {vars}; do print -r -- \"{MARK_VAR}${{v}}=${{(P)v}}\"; done\n\
             alias | while IFS= read -r l; do print -r -- \"{MARK_ALIAS}$l\"; done\n\
             print -rl -- ${{(k)functions}} | while IFS= read -r l; do print -r -- \"{MARK_FN}$l\"; done\n\
             env | while IFS= read -r l; do print -r -- \"{MARK_ENV}${{l%%=*}}\"; done\n"
        ),
        _ => format!(
            "printf '{MARK_PATH}%s\\n' \"$PATH\"\n\
             for v in {vars}; do printf '{MARK_VAR}%s=%s\\n' \"$v\" \"${{!v}}\"; done\n\
             alias -p 2>/dev/null | while IFS= read -r l; do printf '{MARK_ALIAS}%s\\n' \"${{l#alias }}\"; done\n\
             declare -F 2>/dev/null | while IFS= read -r l; do printf '{MARK_FN}%s\\n' \"${{l#declare -f }}\"; done\n\
             env | while IFS= read -r l; do printf '{MARK_ENV}%s\\n' \"${{l%%=*}}\"; done\n"
        ),
    }
}

/// Parses the marker lines produced by the capture script.
pub struct CaptureOutput {
    pub path: EffectivePath,
    pub vars: BTreeMap<String, String>,
    pub aliases: BTreeMap<String, String>,
    pub functions: Vec<String>,
    pub env_names: Vec<String>,
}

pub fn parse_capture_output(stdout: &str, shell_name: &str) -> CaptureOutput {
    let mut path: Option<String> = None;
    let mut vars = BTreeMap::new();
    let mut aliases = BTreeMap::new();
    let mut functions = Vec::new();
    let mut env_names: Vec<String> = Vec::new();
    for line in stdout.lines() {
        if let Some(p) = line.strip_prefix(MARK_PATH) {
            // The last PATH line wins (some rc files print things but cannot forge the marker).
            path = Some(p.to_string());
        } else if let Some(v) = line.strip_prefix(MARK_VAR) {
            if let Some((k, val)) = v.split_once('=') {
                if !val.is_empty() {
                    vars.insert(k.to_string(), val.to_string());
                }
            }
        } else if let Some(a) = line.strip_prefix(MARK_ALIAS) {
            if let Some((k, val)) = a.split_once('=') {
                aliases.insert(k.trim().to_string(), val.trim().to_string());
            }
        } else if let Some(f) = line.strip_prefix(MARK_FN) {
            if !f.trim().is_empty() {
                functions.push(f.trim().to_string());
            }
        } else if let Some(e) = line.strip_prefix(MARK_ENV) {
            let name = e.trim();
            if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') && !env_names.iter().any(|n| n == name) {
                env_names.push(name.to_string());
            }
        }
    }
    let effective = EffectivePath::parse(path.as_deref().unwrap_or(""), PathSource::LoginShell { shell: shell_name.to_string() });
    CaptureOutput { path: effective, vars, aliases, functions, env_names }
}

fn seed_vars_from_env(ctx: &SystemContext) -> BTreeMap<String, String> {
    let mut vars = BTreeMap::new();
    for name in CAPTURED_VARS {
        if let Some(v) = ctx.env.get(name) {
            vars.insert(name.to_string(), v.to_string());
        }
    }
    vars.insert("HOME".into(), ctx.home.to_string_lossy().into_owned());
    vars.insert("USER".into(), ctx.user.clone());
    vars
}

/// Captures PATH, aliases, functions and selected variables from a fresh login shell.
/// Never fails: falls back to the process environment with a warning.
pub fn capture_shell(ctx: &SystemContext) -> ShellCapture {
    let start = std::time::Instant::now();
    if let Some(raw) = &ctx.options.path_override {
        return ShellCapture {
            path: EffectivePath::parse(raw, PathSource::Override),
            aliases: BTreeMap::new(),
            functions: Vec::new(),
            vars: seed_vars_from_env(ctx),
            env_names: ctx.env.names(),
            duration_ms: 0,
            warnings: Vec::new(),
            stderr_lines: Vec::new(),
        };
    }
    let fallback = |warning: String| ShellCapture {
        path: EffectivePath::parse(ctx.env.get("PATH").unwrap_or(""), PathSource::ProcessEnvironment),
        aliases: BTreeMap::new(),
        functions: Vec::new(),
        vars: seed_vars_from_env(ctx),
        env_names: ctx.env.names(),
        duration_ms: start.elapsed().as_millis() as u64,
        warnings: vec![warning],
        stderr_lines: Vec::new(),
    };
    if !ctx.options.capture_shell {
        return fallback("shell capture disabled; using the DevDoctor process PATH".into());
    }
    if cfg!(windows) {
        return match capture_registry_path(ctx) {
            Ok(path) => ShellCapture {
                path,
                aliases: BTreeMap::new(),
                functions: Vec::new(),
                vars: seed_vars_from_env(ctx),
                env_names: ctx.env.names(),
                duration_ms: start.elapsed().as_millis() as u64,
                warnings: Vec::new(),
                stderr_lines: Vec::new(),
            },
            Err(reason) => fallback(format!("could not read PATH from the registry ({reason}); using the process PATH")),
        };
    }
    if !matches!(ctx.shell, ShellKind::Zsh | ShellKind::Bash) {
        return fallback(format!("unsupported login shell {}; using the process PATH", ctx.shell_path.display()));
    }
    let script = capture_script(ctx.shell);
    let spec = login_shell_spec(ctx, &["-l", "-i", "-c", &script]);
    match ctx.run(&spec) {
        Ok(out) if !out.timed_out => {
            let CaptureOutput { path, vars, aliases, functions, env_names } = parse_capture_output(&out.stdout, ctx.shell.name());
            let mut warnings = Vec::new();
            if path.entries.is_empty() {
                return fallback("login shell did not report a PATH; using the process PATH".into());
            }
            let stderr_lines = collect_stderr_lines(&out.stderr);
            if let Some(first) = stderr_lines.first() {
                warnings.push(format!("shell startup printed to stderr: {first}"));
            }
            let mut all_vars = seed_vars_from_env(ctx);
            all_vars.extend(vars);
            ShellCapture {
                path,
                aliases,
                functions,
                vars: all_vars,
                env_names,
                duration_ms: start.elapsed().as_millis() as u64,
                warnings,
                stderr_lines,
            }
        }
        Ok(_) => fallback(format!("login shell timed out after {} ms; using the process PATH", ctx.options.shell_timeout_ms)),
        Err(e) => fallback(format!("could not run the login shell: {e}")),
    }
}

/// Reads the PATH a new Windows terminal receives: the machine value then the user value, as
/// stored in the registry (expanded). Runs Windows PowerShell without a profile.
pub fn capture_registry_path(ctx: &SystemContext) -> std::result::Result<EffectivePath, String> {
    const MARK: &str = "__DD_PATH__=";
    let script = format!(
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
         $m = [Environment]::GetEnvironmentVariable('Path', 'Machine'); \
         $u = [Environment]::GetEnvironmentVariable('Path', 'User'); \
         Write-Output ('{MARK}' + (@($m, $u) | Where-Object {{ $_ }} | ForEach-Object {{ $_.Trim(';') }}) -join ';')"
    );
    let spec = CommandSpec::new(crate::sys::default_shell_path().to_string_lossy().into_owned())
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .timeout_ms(ctx.options.shell_timeout_ms);
    let out = ctx.run(&spec).map_err(|e| e.to_string())?;
    if out.timed_out {
        return Err(format!("PowerShell timed out after {} ms", ctx.options.shell_timeout_ms));
    }
    let line = out.stdout.lines().rev().find_map(|l| l.strip_prefix(MARK)).ok_or_else(|| {
        let err = out.stderr.lines().next().unwrap_or("no output").trim().to_string();
        format!("PowerShell did not report a PATH: {err}")
    })?;
    let path = EffectivePath::parse(line.trim(), PathSource::Registry);
    if path.entries.is_empty() {
        return Err("the registry PATH is empty".into());
    }
    Ok(path)
}

/// System PATH entries with the file that declares them (`/etc/paths`, `/etc/paths.d/<name>`
/// or `launchd` for the built-in defaults). Empty on Windows, where the system PATH lives in
/// the registry and is already part of the capture.
pub fn system_path_sources() -> Vec<(String, String)> {
    let mut entries: Vec<(String, String)> = Vec::new();
    if cfg!(windows) {
        return entries;
    }
    let mut push = |e: &str, source: &str| {
        let e = e.trim();
        if !e.is_empty() && !entries.iter().any(|(x, _)| x == e) {
            entries.push((e.to_string(), source.to_string()));
        }
    };
    if let Ok(content) = std::fs::read_to_string("/etc/paths") {
        for line in content.lines() {
            push(line, "/etc/paths");
        }
    }
    for file in fs_util::list_dir(Path::new("/etc/paths.d")) {
        if let Ok(content) = std::fs::read_to_string(&file) {
            for line in content.lines() {
                push(line, &file.display().to_string());
            }
        }
    }
    for e in ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
        push(e, "launchd");
    }
    entries
}

/// PATH before any user file runs on macOS: `/etc/paths` and `/etc/paths.d/*` as assembled by
/// `path_helper`, followed by the launchd defaults not already present. Empty on Windows.
pub fn system_path_entries() -> Vec<String> {
    let mut entries: Vec<String> = Vec::new();
    if cfg!(windows) {
        return entries;
    }
    let mut push = |e: &str| {
        let e = e.trim();
        if !e.is_empty() && !entries.iter().any(|x| x == e) {
            entries.push(e.to_string());
        }
    };
    if let Ok(content) = std::fs::read_to_string("/etc/paths") {
        for line in content.lines() {
            push(line);
        }
    }
    for file in fs_util::list_dir(Path::new("/etc/paths.d")) {
        if let Ok(content) = std::fs::read_to_string(&file) {
            for line in content.lines() {
                push(line);
            }
        }
    }
    for e in ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
        push(e);
    }
    entries
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PathOrigin {
    Homebrew,
    Macports,
    Nvm,
    Fnm,
    Volta,
    Asdf,
    Mise,
    Pyenv,
    Rbenv,
    Conda,
    PythonOrg,
    Uv,
    Pipx,
    Npm,
    Pnpm,
    Bun,
    Deno,
    Cargo,
    Go,
    Java,
    Docker,
    Xcode,
    Editor,
    ClaudeCode,
    UserLocalBin,
    /// A regular file in /usr/local/bin that no package manager owns (e.g. the nodejs.org pkg).
    Installer,
    System,
    Manual,
    Unknown,
}

impl PathOrigin {
    pub fn label(&self) -> &'static str {
        match self {
            PathOrigin::Homebrew => "Homebrew",
            PathOrigin::Macports => "MacPorts",
            PathOrigin::Nvm => "nvm",
            PathOrigin::Fnm => "fnm",
            PathOrigin::Volta => "Volta",
            PathOrigin::Asdf => "asdf",
            PathOrigin::Mise => "mise",
            PathOrigin::Pyenv => "pyenv",
            PathOrigin::Rbenv => "rbenv",
            PathOrigin::Conda => "conda",
            PathOrigin::PythonOrg => "python.org installer",
            PathOrigin::Uv => "uv",
            PathOrigin::Pipx => "pipx",
            PathOrigin::Npm => "npm",
            PathOrigin::Pnpm => "pnpm",
            PathOrigin::Bun => "Bun",
            PathOrigin::Deno => "Deno",
            PathOrigin::Cargo => "Cargo / rustup",
            PathOrigin::Go => "Go",
            PathOrigin::Java => "Java",
            PathOrigin::Docker => "Docker",
            PathOrigin::Xcode => "Xcode / Command Line Tools",
            PathOrigin::Editor => "Editor",
            PathOrigin::ClaudeCode => "Claude Code",
            PathOrigin::UserLocalBin => "User local bin (~/.local/bin)",
            PathOrigin::Installer => "Installer package (/usr/local/bin)",
            PathOrigin::System => "System",
            PathOrigin::Manual => "User configuration",
            PathOrigin::Unknown => "Unknown",
        }
    }
}

/// Guesses where a PATH directory comes from based on its location.
pub fn classify_origin(dir: &Path, home: &Path, brew_prefix: Option<&Path>) -> PathOrigin {
    let s = dir.to_string_lossy();
    let home_s = home.to_string_lossy();
    let rel = s.strip_prefix(home_s.as_ref()).unwrap_or("");
    if let Some(prefix) = brew_prefix {
        let p = prefix.to_string_lossy();
        if (s.starts_with(&format!("{p}/bin"))
            || s.starts_with(&format!("{p}/sbin"))
            || s.starts_with(&format!("{p}/opt"))
            || s.starts_with(&format!("{p}/Cellar")))
            && !(p == "/usr/local" && !Path::new("/usr/local/Homebrew").exists())
        {
            return PathOrigin::Homebrew;
        }
    }
    if s.starts_with("/opt/homebrew")
        || s.starts_with("/usr/local/Homebrew")
        || s.starts_with("/usr/local/Cellar")
        || s.starts_with("/usr/local/opt")
    {
        return PathOrigin::Homebrew;
    }
    if s.starts_with("/opt/local") {
        return PathOrigin::Macports;
    }
    if rel.contains("/.nvm/") {
        return PathOrigin::Nvm;
    }
    if s.contains("fnm_multishells") || rel.contains("/.fnm/") || s.contains("/fnm/") {
        return PathOrigin::Fnm;
    }
    if rel.contains("/.volta/") {
        return PathOrigin::Volta;
    }
    if rel.contains("/.asdf/") {
        return PathOrigin::Asdf;
    }
    if s.contains("/mise/") {
        return PathOrigin::Mise;
    }
    if rel.contains("/.pyenv/") {
        return PathOrigin::Pyenv;
    }
    if rel.contains("/.rbenv/") {
        return PathOrigin::Rbenv;
    }
    if s.contains("conda") || s.contains("miniforge") || s.contains("mambaforge") {
        return PathOrigin::Conda;
    }
    if s.starts_with("/Library/Frameworks/Python.framework") {
        return PathOrigin::PythonOrg;
    }
    if rel.contains("/.cargo/") || rel.contains("/.rustup/") {
        return PathOrigin::Cargo;
    }
    if rel.contains("/go/bin") || s.starts_with("/usr/local/go") {
        return PathOrigin::Go;
    }
    if rel.contains("/.jenv/") || rel.contains("/.sdkman/") || s.contains("/JavaVirtualMachines/") {
        return PathOrigin::Java;
    }
    if rel.contains("/.npm-global") || rel.contains("/.npm/") || s.contains("/lib/node_modules/") {
        return PathOrigin::Npm;
    }
    if rel.contains("/Library/pnpm") || rel.contains("/.pnpm") || s.contains("/pnpm/") {
        return PathOrigin::Pnpm;
    }
    if rel.contains("/.bun/") {
        return PathOrigin::Bun;
    }
    if rel.contains("/.deno/") {
        return PathOrigin::Deno;
    }
    if s.contains("Docker.app") || rel.contains("/.docker/") || rel.contains("/.orbstack/") {
        return PathOrigin::Docker;
    }
    if s.contains("Xcode.app") || s.starts_with("/Library/Developer") || s.starts_with("/Applications/Xcode") {
        return PathOrigin::Xcode;
    }
    if s.contains("Visual Studio Code.app")
        || s.contains("Cursor.app")
        || rel.contains("/.cursor/")
        || rel.contains("/.vscode/")
        || s.contains("JetBrains")
    {
        return PathOrigin::Editor;
    }
    if rel.contains("/.claude/") {
        return PathOrigin::ClaudeCode;
    }
    if rel == "/.local/bin" {
        return PathOrigin::UserLocalBin;
    }
    if s.starts_with("/usr/bin")
        || s.starts_with("/bin")
        || s.starts_with("/usr/sbin")
        || s.starts_with("/sbin")
        || s.starts_with("/System/")
        || s.starts_with("/Library/Apple")
        || s.contains("cryptexd")
        || s.starts_with("/usr/local/bin")
        || s.starts_with("/usr/local/sbin")
    {
        return PathOrigin::System;
    }
    if !rel.is_empty() {
        return PathOrigin::Manual;
    }
    PathOrigin::Unknown
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathAttribution {
    pub file: PathBuf,
    pub line: u32,
    pub statement: String,
    pub op: PathOp,
    pub conditional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathEntry {
    /// 1-based position in PATH.
    pub position: usize,
    pub raw: String,
    pub exists: bool,
    pub is_dir: bool,
    pub is_duplicate: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duplicate_of: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executables: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub writable: Option<bool>,
    pub origin: PathOrigin,
    pub origin_label: String,
    /// Configuration statements that add this directory (empty when unknown/opaque).
    pub sources: Vec<PathAttribution>,
    /// Non-file source such as `/etc/paths` or `eval "$(brew shellenv)"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_hint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suspicious: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathReport {
    pub source: PathSource,
    pub raw: String,
    pub entries: Vec<PathEntry>,
    pub duplicate_count: usize,
    pub missing_count: usize,
    pub warnings: Vec<String>,
    pub capture_duration_ms: u64,
}

fn count_executables(dir: &Path) -> Option<u32> {
    let rd = std::fs::read_dir(dir).ok()?;
    let mut n = 0u32;
    for entry in rd.flatten() {
        let p = entry.path();
        if fs_util::is_executable_file(&p) {
            n += 1;
        }
    }
    Some(n)
}

fn opaque_hint(key: &str, ctx: &SystemContext) -> Option<String> {
    let analysis = ctx.shell_analysis();
    let home = ctx.home.to_string_lossy().into_owned();
    for e in &analysis.evals {
        let cmd = e.command.as_str();
        if cmd.contains("brew shellenv")
            && (key.ends_with("/bin") || key.ends_with("/sbin"))
            && ctx.brew_prefix().is_some_and(|p| key.starts_with(&p.to_string_lossy().into_owned()))
        {
            return Some(format!("eval \"$({cmd})\" in {}:{}", ctx.display_path(&e.file), e.line));
        }
        if cmd.contains("pyenv init") && key.contains("/.pyenv/shims") {
            return Some(format!("eval \"$({cmd})\" in {}:{}", ctx.display_path(&e.file), e.line));
        }
        if cmd.contains("rbenv init") && key.contains("/.rbenv/shims") {
            return Some(format!("eval \"$({cmd})\" in {}:{}", ctx.display_path(&e.file), e.line));
        }
        if cmd.contains("fnm env") && key.contains("fnm") {
            return Some(format!("eval \"$({cmd})\" in {}:{}", ctx.display_path(&e.file), e.line));
        }
        if cmd.contains("mise activate") && key.contains("mise") {
            return Some(format!("eval \"$({cmd})\" in {}:{}", ctx.display_path(&e.file), e.line));
        }
    }
    for s in &analysis.sources {
        let target = s.expanded.as_ref().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
        if target.ends_with("nvm.sh") && key.contains("/.nvm/versions/node/") {
            return Some(format!("nvm ({} sourced in {}:{})", ctx.display_path(Path::new(&target)), ctx.display_path(&s.file), s.line));
        }
        if target.ends_with(".cargo/env") && key == format!("{home}/.cargo/bin") {
            return Some(format!("{} sourced in {}:{}", ctx.display_path(Path::new(&target)), ctx.display_path(&s.file), s.line));
        }
    }
    None
}

/// Builds the PATH explorer report.
pub fn build_path_report(ctx: &SystemContext) -> PathReport {
    let capture = ctx.shell_capture();
    let analysis = ctx.shell_analysis();
    let brew_prefix = ctx.brew_prefix();
    let system_sources = system_path_sources();
    let mut seen: BTreeMap<String, usize> = BTreeMap::new();
    let mut entries = Vec::new();
    for (i, raw) in capture.path.entries.iter().enumerate() {
        let position = i + 1;
        let key = normalize_key(raw);
        let dir = PathBuf::from(&key);
        let meta = std::fs::metadata(&dir).ok();
        let exists = meta.is_some();
        let is_dir = meta.as_ref().is_some_and(|m| m.is_dir());
        let duplicate_of = seen.get(&key).copied();
        if duplicate_of.is_none() {
            seen.insert(key.clone(), position);
        }
        let mut sources = Vec::new();
        for m in &analysis.mutations {
            for c in m.added_dirs() {
                if c.expanded.as_ref().is_some_and(|p| p.to_string_lossy() == key) {
                    sources.push(PathAttribution {
                        file: m.file.clone(),
                        line: m.line,
                        statement: m.raw.clone(),
                        op: m.op,
                        conditional: !m.is_effective(),
                    });
                }
            }
        }
        let mut source_hint = None;
        if sources.is_empty() {
            if let Some((_, file)) = system_sources.iter().find(|(e, _)| normalize_key(e) == key) {
                source_hint =
                    Some(if file == "launchd" { "system default (launchd)".to_string() } else { format!("system default ({file})") });
            } else {
                source_hint = opaque_hint(&key, ctx);
            }
        }
        let origin = if raw.is_empty() { PathOrigin::Unknown } else { classify_origin(&dir, &ctx.home, brew_prefix.as_deref()) };
        let suspicious = if raw.is_empty() {
            Some("empty entry: the current directory is searched for commands".to_string())
        } else if !crate::sys::is_absolute_entry(raw) {
            Some("relative entry: resolves differently depending on the current directory".to_string())
        } else if !exists {
            None
        } else if !is_dir {
            Some("not a directory".to_string())
        } else {
            let world_writable = meta.as_ref().is_some_and(crate::sys::is_world_writable);
            if world_writable && !key.starts_with("/private/tmp") {
                Some("world-writable directory in PATH".to_string())
            } else {
                None
            }
        };
        entries.push(PathEntry {
            position,
            raw: raw.clone(),
            exists,
            is_dir,
            is_duplicate: duplicate_of.is_some(),
            duplicate_of,
            executables: if is_dir { count_executables(&dir) } else { None },
            writable: if exists { fs_util::is_writable(&dir) } else { None },
            origin,
            origin_label: origin.label().to_string(),
            sources,
            source_hint,
            suspicious,
        });
    }
    let duplicate_count = entries.iter().filter(|e| e.is_duplicate).count();
    let missing_count = entries.iter().filter(|e| !e.exists && !e.raw.is_empty()).count();
    PathReport {
        source: capture.path.source.clone(),
        raw: capture.path.raw.clone(),
        entries,
        duplicate_count,
        missing_count,
        warnings: capture.warnings.clone(),
        capture_duration_ms: capture.duration_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_capture_markers() {
        let out = "some noise\n__DD_PATH__=/a:/b:/a\n__DD_VAR__NVM_DIR=/h/.nvm\n__DD_VAR__EMPTY=\n__DD_ALIAS__ll='ls -la'\n__DD_FN__nvm\n__DD_ENV__HOME\n__DD_ENV__OPENAI_API_KEY\n";
        let CaptureOutput { path, vars, aliases, functions: fns, env_names } = parse_capture_output(out, "zsh");
        assert_eq!(env_names, vec!["HOME", "OPENAI_API_KEY"]);
        assert_eq!(path.entries, vec!["/a", "/b", "/a"]);
        assert_eq!(path.duplicates(), vec![("/a".to_string(), vec![1, 3])]);
        assert_eq!(vars.get("NVM_DIR").map(String::as_str), Some("/h/.nvm"));
        assert!(!vars.contains_key("EMPTY"));
        assert_eq!(aliases.get("ll").map(String::as_str), Some("'ls -la'"));
        assert_eq!(fns, vec!["nvm"]);
    }

    #[test]
    fn classifies_common_origins() {
        let home = Path::new("/Users/me");
        let brew = Path::new("/opt/homebrew");
        assert_eq!(classify_origin(Path::new("/opt/homebrew/bin"), home, Some(brew)), PathOrigin::Homebrew);
        assert_eq!(classify_origin(Path::new("/Users/me/.nvm/versions/node/v22.4.1/bin"), home, Some(brew)), PathOrigin::Nvm);
        assert_eq!(classify_origin(Path::new("/Users/me/.cargo/bin"), home, Some(brew)), PathOrigin::Cargo);
        assert_eq!(classify_origin(Path::new("/usr/bin"), home, Some(brew)), PathOrigin::System);
        assert_eq!(classify_origin(Path::new("/Users/me/.local/bin"), home, Some(brew)), PathOrigin::UserLocalBin);
        assert_eq!(classify_origin(Path::new("/Users/me/bin"), home, Some(brew)), PathOrigin::Manual);
        assert_eq!(classify_origin(Path::new("/Users/me/.pyenv/shims"), home, Some(brew)), PathOrigin::Pyenv);
    }

    #[test]
    fn stderr_lines_are_trimmed_redacted_and_capped() {
        let text = "\n/Users/me/.zshrc:12: command not found: pyenv\n  \nexport TOKEN=abc123\n";
        let lines = collect_stderr_lines(text);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "/Users/me/.zshrc:12: command not found: pyenv");
        assert!(!lines[1].contains("abc123"));
        let many: String = (0..100).map(|i| format!("line {i}\n")).collect();
        assert_eq!(collect_stderr_lines(&many).len(), MAX_STDERR_LINES);
    }

    #[test]
    fn capture_script_is_shell_specific() {
        assert!(capture_script(ShellKind::Zsh).contains("(P)v"));
        assert!(capture_script(ShellKind::Bash).contains("${!v}"));
    }
}
