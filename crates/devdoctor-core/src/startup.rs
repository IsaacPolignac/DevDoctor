//! Shell startup profiling: how long a new terminal takes to become usable, which startup
//! statements cost the most, and what the shell prints while starting.
//!
//! Timing uses the same controlled login shell as the PATH capture (see
//! [`crate::path_env::login_shell_spec`]). Attribution uses zsh's own `xtrace` with a timestamped
//! `PS4`, so every executed line carries its file, line number and start time; the time between
//! two consecutive trace lines is the cost of the first. Nothing is stored: the trace is parsed
//! in memory and only redacted summaries leave this module.

use crate::context::SystemContext;
use crate::path_env::{collect_stderr_lines, login_shell_spec};
use crate::redact::redact_text;
use crate::shell::{all_known_startup_files, ShellKind};
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Below this a new terminal feels instantaneous.
pub const FAST_MS: u64 = 150;
/// Below this most people do not notice the delay.
pub const OK_MS: u64 = 500;
/// Above this every new tab is a visible wait; above `VERY_SLOW_MS` it is painful.
pub const SLOW_MS: u64 = 1500;

/// The `PS4` prompt used for tracing: epoch microseconds, the current file or function, the line.
pub const TRACE_PS4: &str = "+%D{%s%6.} %N:%i> ";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StartupRating {
    Fast,
    Ok,
    Slow,
    VerySlow,
}

impl StartupRating {
    pub fn of(ms: u64) -> Self {
        if ms < FAST_MS {
            StartupRating::Fast
        } else if ms < OK_MS {
            StartupRating::Ok
        } else if ms < SLOW_MS {
            StartupRating::Slow
        } else {
            StartupRating::VerySlow
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            StartupRating::Fast => "fast",
            StartupRating::Ok => "acceptable",
            StartupRating::Slow => "slow",
            StartupRating::VerySlow => "very slow",
        }
    }
}

/// One statement of a user startup file with everything it triggered (sourced files, tool
/// initialisations, completions) attributed to it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hotspot {
    pub file: PathBuf,
    pub line: u32,
    /// The statement as written in the file (secrets redacted).
    pub statement: String,
    pub inclusive_ms: u64,
    /// Share of the traced startup time, in percent.
    pub share_percent: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    /// A user or system startup file.
    File,
    /// A shell function (completion system, plugin manager, tool wrapper).
    Function,
    /// Code produced by `eval "$(...)"`.
    Eval,
}

/// Time spent directly inside one file, function or eval block (not counting what it called).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCost {
    pub name: String,
    pub display: String,
    pub kind: SourceKind,
    pub self_ms: u64,
    pub lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupProfile {
    pub shell: String,
    pub measured_at: DateTime<Utc>,
    /// Wall-clock durations of complete login shell starts, in milliseconds.
    pub samples_ms: Vec<u64>,
    pub median_ms: u64,
    pub min_ms: u64,
    pub max_ms: u64,
    pub rating: StartupRating,
    /// Whether a line-level trace could be captured (zsh only).
    pub traced: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trace_total_ms: Option<u64>,
    pub trace_lines: usize,
    pub hotspots: Vec<Hotspot>,
    pub sources: Vec<SourceCost>,
    /// What the shell printed to stderr while starting (redacted).
    pub stderr_lines: Vec<String>,
    pub notes: Vec<String>,
}

fn median(values: &[u64]) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let mut v = values.to_vec();
    v.sort_unstable();
    let mid = v.len() / 2;
    if v.len() % 2 == 0 {
        (v[mid - 1] + v[mid]) / 2
    } else {
        v[mid]
    }
}

/// Starts the login shell `samples` times and returns each start's duration in milliseconds.
/// Timed-out starts are dropped. Returns an empty vector when the shell could not be run.
pub fn measure(ctx: &SystemContext, samples: usize) -> Vec<u64> {
    if !ctx.options.capture_shell || !matches!(ctx.shell, ShellKind::Zsh | ShellKind::Bash) {
        return Vec::new();
    }
    let spec = login_shell_spec(ctx, &["-l", "-i", "-c", "exit"]);
    let mut out = Vec::new();
    for _ in 0..samples.max(1) {
        match ctx.run(&spec) {
            Ok(o) if !o.timed_out => out.push(o.duration_ms),
            Ok(_) => tracing::warn!("login shell timed out while measuring startup time"),
            Err(e) => {
                tracing::warn!(error = %e, "could not start the login shell to measure startup time");
                break;
            }
        }
    }
    out
}

/// One line of a timestamped `xtrace`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraceEntry {
    pub ts_us: u64,
    /// File path, function name or `(eval)`.
    pub name: String,
    pub line: u32,
    pub command: String,
}

fn trace_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    // A marker can appear in the middle of a line when a command substitution's own trace
    // output interleaves with its parent's, so markers are located anywhere in the text.
    RE.get_or_init(|| Regex::new(r"\+(\d{13,19}) ([^\s>][^>\n]*?):(\d+)> ").expect("static regex"))
}

/// Parses the stderr of `zsh -x` run with [`TRACE_PS4`].
pub fn parse_zsh_trace(text: &str) -> Vec<TraceEntry> {
    let re = trace_regex();
    let matches: Vec<regex::Captures<'_>> = re.captures_iter(text).collect();
    let mut out = Vec::with_capacity(matches.len());
    for (i, cap) in matches.iter().enumerate() {
        let whole = cap.get(0).expect("group 0");
        let end = matches.get(i + 1).and_then(|n| n.get(0)).map(|m| m.start()).unwrap_or(text.len());
        let command = text[whole.end()..end].lines().next().unwrap_or("").trim().to_string();
        let ts_us = cap[1].parse::<u64>().unwrap_or(0);
        let line = cap[3].parse::<u32>().unwrap_or(0);
        if ts_us == 0 {
            continue;
        }
        out.push(TraceEntry { ts_us, name: cap[2].to_string(), line, command });
    }
    out
}

/// Runs the login shell with tracing enabled and returns the parsed trace. zsh only: bash's
/// `PS4` cannot carry sub-second timestamps on the bash 3.2 that ships with macOS.
pub fn trace(ctx: &SystemContext) -> Result<Vec<TraceEntry>> {
    if ctx.shell != ShellKind::Zsh {
        return Err(Error::Invalid(format!("line-level startup tracing is only available for zsh (your shell is {})", ctx.shell.name())));
    }
    if !ctx.options.capture_shell {
        return Err(Error::Invalid("shell capture is disabled".into()));
    }
    let spec =
        login_shell_spec(ctx, &["-l", "-i", "-x", "-c", "exit"]).env("PS4", TRACE_PS4).timeout_ms(ctx.options.shell_timeout_ms.max(20_000));
    let out = ctx.run(&spec)?;
    if out.timed_out {
        return Err(Error::CommandTimeout { program: spec.program_name(), timeout_ms: spec.timeout_ms });
    }
    let entries = parse_zsh_trace(&out.stderr);
    if entries.is_empty() {
        return Err(Error::Other("the traced shell produced no timestamped lines (a startup file may override PS4)".into()));
    }
    Ok(entries)
}

/// Known slow startup patterns and what to do about them.
pub fn hint_for(statement: &str) -> Option<&'static str> {
    let s = statement.to_ascii_lowercase();
    if s.contains("nvm.sh") || s.contains("nvm/nvm") || s.contains("load-nvmrc") {
        Some("nvm loads slowly by design (300–800 ms is common). fnm is a fast drop-in replacement, or nvm can be lazy-loaded from a small `nvm()` wrapper function.")
    } else if s.contains("compinit") {
        Some("compinit rebuilds the completion cache on most starts. Call it once, as `autoload -Uz compinit && compinit -C`, and let a plugin manager or a daily check refresh the dump file.")
    } else if s.contains("oh-my-zsh.sh") {
        Some("oh-my-zsh loads every plugin in `plugins=(...)` at startup. Trim the list; plugins such as `nvm`, `docker` or `kubectl` are the usual culprits.")
    } else if s.contains("conda") {
        Some("conda's shell hook is slow. Run `conda config --set auto_activate_base false` and initialise conda only in the shells that need it.")
    } else if s.contains("pyenv init") {
        Some("`pyenv init -` rehashes shims on every start; use `pyenv init - --no-rehash` (pyenv ≥ 2.3) or lazy-load pyenv.")
    } else if s.contains("rbenv init") {
        Some("`rbenv init -` can run with `--no-rehash`, or rbenv can be lazy-loaded.")
    } else if s.contains("sdkman") {
        Some("SDKMAN's init script is slow; set `sdkman_auto_env=false` in ~/.sdkman/etc/config or lazy-load it.")
    } else if s.contains("thefuck") {
        Some("`thefuck --alias` starts Python on every terminal. Replace it with the static alias it prints.")
    } else if s.contains("google-cloud-sdk") || s.contains("gcloud") {
        Some("The Google Cloud SDK completion script is heavy. Keep `path.zsh.inc` and load `completion.zsh.inc` lazily.")
    } else if s.contains("completion zsh") || s.contains("completion bash") {
        Some("Generating completions with `<tool> completion zsh` runs the tool on every start. Write the output once to a file in `fpath` instead.")
    } else if s.contains("antigen") || s.contains("zplug") || s.contains("zinit") || s.contains("zgen") {
        Some("Plugin managers can defer most plugins: zinit's `wait` (turbo) mode or zsh-defer load them after the prompt appears.")
    } else if s.contains("brew shellenv") {
        None
    } else if s.contains("kubectl") || s.contains("helm") || s.contains("docker completion") {
        Some("Kubernetes and Docker completion scripts are slow to generate; cache them in a file under `fpath`.")
    } else {
        None
    }
}

pub struct Attribution {
    pub total_ms: u64,
    pub hotspots: Vec<Hotspot>,
    pub sources: Vec<SourceCost>,
}

fn source_kind(name: &str) -> SourceKind {
    if name == "(eval)" || name.starts_with("(eval") {
        SourceKind::Eval
    } else if name.starts_with('/') || name.starts_with('~') || name.starts_with('.') {
        SourceKind::File
    } else {
        SourceKind::Function
    }
}

/// Attributes trace time to user startup statements (inclusive) and to files/functions (self).
///
/// `top_files` are the user's own startup files: a trace line inside one of them starts a new
/// top-level statement, and every following line (sourced files, functions, evals) counts
/// towards that statement until the next top-level line. `contents` provides the original text
/// of those files so the hotspot shows the line as written rather than the expanded command.
pub fn attribute(entries: &[TraceEntry], top_files: &[PathBuf], contents: &BTreeMap<PathBuf, String>, home: &Path) -> Attribution {
    if entries.len() < 2 {
        return Attribution { total_ms: 0, hotspots: Vec::new(), sources: Vec::new() };
    }
    let is_top = |name: &str| top_files.iter().any(|f| f.to_string_lossy() == name);
    let total_us = entries.last().map(|e| e.ts_us).unwrap_or(0).saturating_sub(entries[0].ts_us);
    let mut hot: BTreeMap<(String, u32), (u64, String)> = BTreeMap::new();
    let mut hot_order: Vec<(String, u32)> = Vec::new();
    let mut sources: BTreeMap<String, (u64, usize)> = BTreeMap::new();
    let mut current: Option<(String, u32)> = None;
    for (i, e) in entries.iter().enumerate() {
        let delta = entries.get(i + 1).map(|n| n.ts_us.saturating_sub(e.ts_us)).unwrap_or(0);
        let src = sources.entry(e.name.clone()).or_insert((0, 0));
        src.0 += delta;
        src.1 += 1;
        if is_top(&e.name) {
            let key = (e.name.clone(), e.line);
            if !hot.contains_key(&key) {
                hot_order.push(key.clone());
            }
            let slot = hot.entry(key.clone()).or_insert((0, e.command.clone()));
            slot.0 += delta;
            current = Some(key);
        } else if let Some(cur) = &current {
            if let Some(slot) = hot.get_mut(cur) {
                slot.0 += delta;
            }
        }
    }
    let mut hotspots: Vec<Hotspot> = hot_order
        .into_iter()
        .filter_map(|key| {
            let (us, traced_cmd) = hot.get(&key)?;
            let file = PathBuf::from(&key.0);
            let statement = contents
                .get(&file)
                .and_then(|c| c.lines().nth(key.1.saturating_sub(1) as usize))
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .unwrap_or_else(|| traced_cmd.clone());
            let statement = redact_text(&statement);
            let inclusive_ms = us / 1000;
            let share = (us * 100).checked_div(total_us).unwrap_or(0).min(100) as u8;
            Some(Hotspot {
                hint: hint_for(&statement).map(str::to_string),
                file,
                line: key.1,
                statement,
                inclusive_ms,
                share_percent: share,
            })
        })
        .collect();
    hotspots.sort_by(|a, b| b.inclusive_ms.cmp(&a.inclusive_ms).then(a.line.cmp(&b.line)));
    hotspots.truncate(12);
    let mut source_costs: Vec<SourceCost> = sources
        .into_iter()
        .map(|(name, (us, lines))| SourceCost {
            display: if name.starts_with('/') { crate::fs_util::display_path(Path::new(&name), home) } else { name.clone() },
            kind: source_kind(&name),
            self_ms: us / 1000,
            lines,
            name,
        })
        .collect();
    source_costs.sort_by(|a, b| b.self_ms.cmp(&a.self_ms).then(a.name.cmp(&b.name)));
    source_costs.truncate(12);
    Attribution { total_ms: total_us / 1000, hotspots, sources: source_costs }
}

/// Traces one login shell start and attributes its cost to the user's startup statements.
pub fn trace_attribution(ctx: &SystemContext) -> Result<(usize, Attribution)> {
    let entries = trace(ctx)?;
    let analysis = ctx.shell_analysis();
    let contents = analysis.contents();
    let top: Vec<PathBuf> = all_known_startup_files(&ctx.home).into_iter().map(|(p, _)| p).collect();
    let attribution = attribute(&entries, &top, &contents, &ctx.home);
    Ok((entries.len(), attribution))
}

/// Measures startup time (`samples` full starts) and, for zsh, traces one start to find the
/// costly statements. Never fails: problems are reported in `notes`.
pub fn profile(ctx: &SystemContext, samples: usize, with_trace: bool) -> StartupProfile {
    let mut notes = Vec::new();
    if !matches!(ctx.shell, ShellKind::Zsh | ShellKind::Bash | ShellKind::Sh) {
        let capture = ctx.shell_capture();
        return StartupProfile {
            shell: ctx.shell.name().to_string(),
            measured_at: Utc::now(),
            samples_ms: Vec::new(),
            median_ms: 0,
            min_ms: 0,
            max_ms: 0,
            rating: StartupRating::of(0),
            traced: false,
            trace_total_ms: None,
            trace_lines: 0,
            hotspots: Vec::new(),
            sources: Vec::new(),
            stderr_lines: capture.stderr_lines.clone(),
            notes: vec![format!(
                "Terminal startup profiling measures POSIX login shells (zsh, bash); it is not available for {} yet.",
                ctx.shell.name()
            )],
        };
    }
    let samples_ms = measure(ctx, samples);
    if samples_ms.is_empty() {
        notes.push("The login shell could not be started, so no timing is available.".to_string());
    }
    let median_ms = median(&samples_ms);
    let capture = ctx.shell_capture();
    let mut profile = StartupProfile {
        shell: ctx.shell.name().to_string(),
        measured_at: Utc::now(),
        median_ms,
        min_ms: samples_ms.iter().copied().min().unwrap_or(0),
        max_ms: samples_ms.iter().copied().max().unwrap_or(0),
        samples_ms,
        rating: StartupRating::of(median_ms),
        traced: false,
        trace_total_ms: None,
        trace_lines: 0,
        hotspots: Vec::new(),
        sources: Vec::new(),
        stderr_lines: capture.stderr_lines.clone(),
        notes: Vec::new(),
    };
    if with_trace {
        match trace_attribution(ctx) {
            Ok((lines, attribution)) => {
                profile.traced = true;
                profile.trace_total_ms = Some(attribution.total_ms);
                profile.trace_lines = lines;
                profile.hotspots = attribution.hotspots;
                profile.sources = attribution.sources;
            }
            Err(e) => notes.push(format!("Line-level attribution unavailable: {e}")),
        }
    }
    profile.notes = notes;
    profile
}

/// Re-reads the stderr of a fresh login shell start (used after fixes).
pub fn startup_stderr(ctx: &SystemContext) -> Vec<String> {
    let spec = login_shell_spec(ctx, &["-l", "-i", "-c", "exit"]);
    match ctx.run(&spec) {
        Ok(o) => collect_stderr_lines(&o.stderr),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACE: &str = "+1788531204693265 /etc/zprofile:6> [ -z en_US.UTF-8 ']'\n\
+1788531204697147 /Users/me/.zprofile:1> emulate sh\n\
+1788531204697687 /Users/me/.zshrc:5> source /Users/me/.nvm/nvm.sh\n\
+1788531204700000 /Users/me/.nvm/nvm.sh:1> nvm_is_zsh\n\
+1788531204900000 nvm_is_zsh:1> [ -n 5.9 ]\n\
+1788531205000000 /Users/me/.zshrc:8> eval $'export FOO=1'\n\
+1788531205000100 (eval):1> export FOO=1\n\
+1788531205010000 /Users/me/.zshrc:9> [[+1788531205015000 /Users/me/.zshrc:9> locale LC_CTYPE\n\
+1788531205020000 /Users/me/.zshrc:12> export OPENAI_API_KEY=sk-abcdefghijklmnop\n\
+1788531205020500 /Users/me/.zshrc:13> alias ll='ls -la'\n";

    #[test]
    fn parses_interleaved_trace_lines() {
        let entries = parse_zsh_trace(TRACE);
        assert_eq!(entries.len(), 11, "{entries:#?}");
        assert_eq!(entries[0].name, "/etc/zprofile");
        assert_eq!(entries[0].line, 6);
        assert_eq!(entries[0].command, "[ -z en_US.UTF-8 ']'");
        let interleaved: Vec<&TraceEntry> = entries.iter().filter(|e| e.line == 9).collect();
        assert_eq!(interleaved.len(), 2, "both markers on the glitched line are found");
        assert_eq!(interleaved[1].command, "locale LC_CTYPE");
    }

    #[test]
    fn attributes_inclusive_time_to_user_statements() {
        let entries = parse_zsh_trace(TRACE);
        let home = Path::new("/Users/me");
        let top = vec![home.join(".zshrc"), home.join(".zprofile")];
        let mut contents = BTreeMap::new();
        contents.insert(
            home.join(".zshrc"),
            "a\nb\nc\nd\n[ -s \"$NVM_DIR/nvm.sh\" ] && source \"$NVM_DIR/nvm.sh\"\nf\ng\neval \"$(foo)\"\n[[ x ]]\nj\nk\nexport OPENAI_API_KEY=sk-abcdefghijklmnop\nalias ll='ls -la'\n".to_string(),
        );
        let a = attribute(&entries, &top, &contents, home);
        assert_eq!(a.total_ms, 327);
        let nvm = &a.hotspots[0];
        assert_eq!(nvm.line, 5);
        assert_eq!(nvm.inclusive_ms, 302, "nvm.sh and its function count towards the source line");
        assert!(nvm.statement.contains("nvm.sh"));
        assert!(nvm.hint.is_some());
        assert!(nvm.share_percent >= 90);
        let secret = a.hotspots.iter().find(|h| h.line == 12).expect("line 12");
        assert!(!secret.statement.contains("sk-abcdefghijklmnop"), "{}", secret.statement);
        let nvm_src = a.sources.iter().find(|s| s.name.ends_with("nvm.sh")).expect("nvm.sh source");
        assert_eq!(nvm_src.kind, SourceKind::File);
        assert_eq!(nvm_src.self_ms, 200);
        let func = a.sources.iter().find(|s| s.name == "nvm_is_zsh").expect("function");
        assert_eq!(func.kind, SourceKind::Function);
        assert_eq!(func.self_ms, 100);
    }

    #[test]
    fn rating_thresholds() {
        assert_eq!(StartupRating::of(20), StartupRating::Fast);
        assert_eq!(StartupRating::of(300), StartupRating::Ok);
        assert_eq!(StartupRating::of(900), StartupRating::Slow);
        assert_eq!(StartupRating::of(3000), StartupRating::VerySlow);
        assert_eq!(median(&[5, 1, 9]), 5);
        assert_eq!(median(&[4, 2]), 3);
    }

    #[test]
    fn hints_cover_common_culprits() {
        assert!(hint_for("[ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\"").is_some());
        assert!(hint_for("autoload -Uz compinit && compinit").is_some());
        assert!(hint_for("export PATH=\"$HOME/bin:$PATH\"").is_none());
    }
}
