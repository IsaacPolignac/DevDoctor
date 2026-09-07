//! Startup-time detectors: a slow login shell, and messages the shell prints to stderr while it
//! starts (the "my terminal shows an error every time I open it" problem).

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::path_env::PathSource;
use devdoctor_core::startup::{self, StartupRating, OK_MS, SLOW_MS};
use devdoctor_core::Result;
use regex::Regex;
use serde_json::json;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const SLOW_ID: &str = "shell.startup.slow";
pub const ERRORS_ID: &str = "shell.startup.errors";

pub struct StartupSlowDetector;

impl Detector for StartupSlowDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: SLOW_ID,
            name: "Terminal startup time",
            category: Category::Shell,
            description: "Measures how long a new login shell takes to start and, for zsh, which startup lines are responsible.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        if !matches!(capture.path.source, PathSource::LoginShell { .. }) {
            return Ok(Vec::new());
        }
        // The PATH capture already is a complete login shell start; only slow shells pay for a
        // confirmation run and a trace.
        let first = capture.duration_ms;
        if first < OK_MS {
            return Ok(Vec::new());
        }
        let again = startup::measure(ctx, 1).into_iter().next().unwrap_or(first);
        let startup_ms = first.min(again);
        if startup_ms < OK_MS {
            return Ok(Vec::new());
        }
        let rating = StartupRating::of(startup_ms);
        let (traced, hotspots) = match startup::trace_attribution(ctx) {
            Ok((_, a)) => (true, a.hotspots),
            Err(e) => {
                tracing::info!(error = %e, "startup trace unavailable");
                (false, Vec::new())
            }
        };
        let seconds = startup_ms as f64 / 1000.0;
        let mut b = IssueBuilder::new(SLOW_ID, Category::Shell, "login_shell", format!("A new terminal takes {seconds:.1} s to start"))
            .severity(if startup_ms >= SLOW_MS { Severity::Medium } else { Severity::Low })
            .confidence(Confidence::Confirmed)
            .description(format!(
                "A fresh login {} took {startup_ms} ms to become usable (best of two starts). Under {} ms feels instant; above {} ms every new tab or window waits noticeably.{}",
                ctx.shell.name(),
                startup::FAST_MS,
                OK_MS,
                if traced { " DevDoctor traced one start line by line to see where the time goes." } else { "" }
            ))
            .impact("Every terminal window, every editor terminal and every tool that starts a login shell pays this delay.")
            .evidence(format!("login shell start: {first} ms (while capturing PATH), {again} ms (second measurement)"))
            .metadata(json!({
                "startup_ms": startup_ms,
                "samples_ms": [first, again],
                "rating": rating,
                "traced": traced,
                "hotspots": hotspots,
            }));
        let mut hints: Vec<String> = Vec::new();
        for h in hotspots.iter().take(5) {
            b = b
                .evidence(format!(
                    "{}:{} — {} — {} ms ({}%)",
                    ctx.display_path(&h.file),
                    h.line,
                    h.statement,
                    h.inclusive_ms,
                    h.share_percent
                ))
                .affected_file(h.file.clone(), Some(h.line), Some(h.statement.clone()));
            if let Some(hint) = &h.hint {
                if !hints.contains(hint) {
                    hints.push(hint.clone());
                }
            }
        }
        let action = if !hints.is_empty() {
            hints.join(" ")
        } else if traced {
            "The slowest statements are listed in the evidence; move rarely needed tool initialisations into functions you call on demand, or remove the ones you no longer use.".to_string()
        } else {
            "Run `devdoctor startup` to see which lines of your startup files are slow.".to_string()
        };
        b = b.recommended_action(action);
        Ok(vec![b.build()])
    }
}

pub struct StartupErrorsDetector;

impl Detector for StartupErrorsDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ERRORS_ID,
            name: "Errors printed at terminal startup",
            category: Category::Shell,
            description: "Messages your startup files print each time a terminal opens: command not found, missing files, insecure completion directories.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        if !matches!(capture.path.source, PathSource::LoginShell { .. }) {
            return Ok(Vec::new());
        }
        Ok(issues_from_stderr(ctx, &capture.stderr_lines))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageKind {
    CommandNotFound(String),
    MissingFile,
    PermissionDenied,
    SyntaxError,
    InsecureCompinit,
    Other,
}

impl MessageKind {
    fn id(&self) -> &'static str {
        match self {
            MessageKind::CommandNotFound(_) => "command_not_found",
            MessageKind::MissingFile => "missing_file",
            MessageKind::PermissionDenied => "permission_denied",
            MessageKind::SyntaxError => "syntax_error",
            MessageKind::InsecureCompinit => "insecure_compinit",
            MessageKind::Other => "other",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartupMessage {
    pub file: Option<PathBuf>,
    pub line: Option<u32>,
    pub message: String,
    pub kind: MessageKind,
}

fn zsh_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^(?P<file>/[^:\n]+?):(?:(?P<builtin>[A-Za-z_.\-]+):)?(?P<line>\d+): (?P<msg>.+)$").expect("static regex")
    })
}

fn bash_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(?:-?bash: )?(?P<file>/[^:\n]+?): line (?P<line>\d+): (?P<msg>.+)$").expect("static regex"))
}

pub fn classify(message: &str) -> MessageKind {
    let m = message.trim();
    let lower = m.to_ascii_lowercase();
    if let Some(rest) = m.strip_prefix("command not found: ") {
        return MessageKind::CommandNotFound(rest.split_whitespace().next().unwrap_or(rest).to_string());
    }
    if let Some(pos) = m.find(": command not found") {
        let name = m[..pos].rsplit(':').next().unwrap_or("").trim();
        if !name.is_empty() {
            return MessageKind::CommandNotFound(name.to_string());
        }
    }
    if lower.contains("insecure directories") || lower.contains("compaudit") {
        MessageKind::InsecureCompinit
    } else if lower.contains("parse error") || lower.contains("syntax error") || lower.contains("unmatched") {
        MessageKind::SyntaxError
    } else if lower.contains("no such file or directory") {
        MessageKind::MissingFile
    } else if lower.contains("permission denied") || lower.contains("operation not permitted") {
        MessageKind::PermissionDenied
    } else {
        MessageKind::Other
    }
}

/// Parses one stderr line into a located (file, line) message when the shell formatted it so.
pub fn parse_message(line: &str) -> StartupMessage {
    let line = line.trim();
    if let Some(c) = zsh_regex().captures(line) {
        let msg = c["msg"].to_string();
        return StartupMessage { file: Some(PathBuf::from(&c["file"])), line: c["line"].parse().ok(), kind: classify(&msg), message: msg };
    }
    if let Some(c) = bash_regex().captures(line) {
        let msg = c["msg"].to_string();
        return StartupMessage { file: Some(PathBuf::from(&c["file"])), line: c["line"].parse().ok(), kind: classify(&msg), message: msg };
    }
    StartupMessage { file: None, line: None, kind: classify(line), message: line.to_string() }
}

/// Directories where a tool's binary may live even when it is not in the login shell PATH.
fn candidate_dirs(ctx: &SystemContext) -> Vec<PathBuf> {
    let h = &ctx.home;
    vec![
        h.join(".pyenv/bin"),
        h.join(".rbenv/bin"),
        h.join(".cargo/bin"),
        h.join(".local/bin"),
        h.join(".bun/bin"),
        h.join(".deno/bin"),
        h.join("go/bin"),
        h.join(".volta/bin"),
        h.join(".npm-global/bin"),
        h.join("Library/pnpm"),
        h.join(".sdkman/candidates"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/opt/local/bin"),
    ]
}

fn locate_command(ctx: &SystemContext, name: &str) -> Option<PathBuf> {
    if devdoctor_core::resolve::validate_command_name(name).is_err() {
        return None;
    }
    if let Some(p) = ctx.find_program(name) {
        return Some(p);
    }
    candidate_dirs(ctx).into_iter().map(|d| d.join(name)).find(|p| devdoctor_core::fs_util::is_executable_file(p))
}

/// Turns the stderr lines of a login shell start into issues. Public so tests and the CLI can
/// feed it captured output.
pub fn issues_from_stderr(ctx: &SystemContext, lines: &[String]) -> Vec<Issue> {
    if lines.is_empty() {
        return Vec::new();
    }
    let analysis = ctx.shell_analysis();
    let mut issues = Vec::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();
    let mut other: Vec<String> = Vec::new();
    let mut compinit: Vec<String> = Vec::new();
    for raw in lines {
        let msg = parse_message(raw);
        match (&msg.file, msg.line, &msg.kind) {
            // Syntax errors are owned by the syntax detector, which runs `zsh -n` per file.
            (_, _, MessageKind::SyntaxError) => continue,
            (_, _, MessageKind::InsecureCompinit) => {
                compinit.push(raw.clone());
                continue;
            }
            (Some(file), Some(line), kind) => {
                let key = format!("{}:{line}:{}", file.display(), kind.id());
                if !seen.insert(key) {
                    continue;
                }
                // A missing `source` target is reported (with a fix) by the source detector.
                if *kind == MessageKind::MissingFile
                    && analysis.sources.iter().any(|s| &s.file == file && s.line == line && s.exists == Some(false))
                {
                    continue;
                }
                issues.push(located_issue(ctx, &analysis, file, line, &msg));
            }
            _ => other.push(raw.clone()),
        }
    }
    if !compinit.is_empty() {
        issues.push(
            IssueBuilder::new(ERRORS_ID, Category::Shell, "compinit_insecure", "zsh warns about insecure completion directories at every start")
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description("zsh's completion system (compinit) refuses directories that are writable by other users, and prints a warning each time a terminal opens. This usually happens after Homebrew installs completion files under a group-writable directory.")
                .impact("A warning on every new terminal, and completions from those directories are skipped.")
                .evidence(compinit.join(" "))
                .recommended_action("Run `compaudit` to list the directories, then `compaudit | xargs chmod g-w,o-w` to tighten their permissions (this only changes permissions on the listed directories).")
                .metadata(json!({ "kind": "insecure_compinit", "messages": compinit }))
                .build(),
        );
    }
    if !other.is_empty() {
        let mut b = IssueBuilder::new(ERRORS_ID, Category::Shell, "unlocated", format!("Your terminal prints {} message{} at startup", other.len(), if other.len() == 1 { "" } else { "s" }))
            .severity(Severity::Low)
            .confidence(Confidence::Confirmed)
            .description("Something in your startup files writes to the error output every time a terminal opens. The shell did not say which file or line, so the text is reproduced below.")
            .impact("Noise before your prompt; if the message comes from a tool, that tool may not be initialised correctly.")
            .recommended_action("Search your startup files (`devdoctor shell` lists them) for the tool named in the message, then fix or remove the line that produces it.")
            .metadata(json!({ "kind": "other", "messages": other }));
        for l in other.iter().take(10) {
            b = b.evidence(l.clone());
        }
        issues.push(b.build());
    }
    issues
}

fn located_issue(
    ctx: &SystemContext,
    analysis: &devdoctor_core::shell::ShellAnalysis,
    file: &Path,
    line: u32,
    msg: &StartupMessage,
) -> Issue {
    let file_display = ctx.display_path(file);
    let statement = analysis.file(file).and_then(|f| f.statements.iter().find(|s| s.line <= line && line <= s.end_line).cloned());
    let raw = statement.as_ref().map(|s| s.raw.clone()).or_else(|| {
        analysis.file(file).and_then(|f| f.content.as_ref()).and_then(|c| c.lines().nth(line as usize - 1)).map(|l| l.trim().to_string())
    });
    let exclusive = statement.as_ref().is_some_and(|s| s.exclusive_line && !s.conditional && !s.in_function);
    let mut metadata = json!({
        "file": file,
        "line": line,
        "raw": raw,
        "exclusive_line": exclusive,
        "message": msg.message,
        "kind": msg.kind.id(),
        "fixable": false,
    });
    let mut evidence: Vec<String> = vec![format!("printed at startup: {}", msg.message)];
    let mut commands: Vec<String> = Vec::new();
    let mut fixer: Option<&str> = None;
    let (title, severity, description, impact, action) = match &msg.kind {
        MessageKind::CommandNotFound(cmd) => {
            commands.push(cmd.clone());
            metadata["command"] = json!(cmd);
            let title = format!("{file_display}:{line} runs `{cmd}`, which is not installed");
            let impact = format!("Whatever line {line} was supposed to set up ({cmd}'s PATH entries, completions or environment) is missing in every terminal, and the error is printed before your prompt.");
            match locate_command(ctx, cmd) {
                Some(path) => {
                    let dir = path.parent().map(|p| ctx.display_path(p)).unwrap_or_default();
                    evidence.push(format!("{} exists", ctx.display_path(&path)));
                    (
                        title,
                        Severity::Medium,
                        format!("Line {line} of {file_display} calls `{cmd}` but, at that point of the startup, the shell cannot find it. The program exists at {} — the directory {dir} is added to PATH later, or not at all.", ctx.display_path(&path)),
                        impact,
                        format!("Add {dir} to PATH before line {line} (for example in ~/.zprofile, or move the PATH line above it). DevDoctor does not reorder startup files automatically."),
                    )
                }
                None => {
                    evidence.push(format!("`{cmd}` not found in PATH or in common tool directories"));
                    let action = if exclusive {
                        fixer = Some("shell.line.comment_out");
                        metadata["fixable"] = json!(true);
                        format!("If you no longer use {cmd}, disable line {line} of {file_display}: DevDoctor can comment it out (the file is backed up and the change can be undone). Otherwise reinstall {cmd}.")
                    } else {
                        format!("If you no longer use {cmd}, remove its initialisation from line {line} of {file_display} (the statement shares its line or block with other commands, so DevDoctor leaves the edit to you). Otherwise reinstall {cmd}.")
                    };
                    (
                        title,
                        Severity::Medium,
                        format!("Line {line} of {file_display} calls `{cmd}`, but `{cmd}` is not installed anywhere DevDoctor looked (PATH, Homebrew, ~/.local/bin, common tool directories). The tool was probably uninstalled and its startup line stayed behind."),
                        impact,
                        action,
                    )
                }
            }
        }
        MessageKind::MissingFile => (
            format!("{file_display}:{line} refers to a file that does not exist"),
            Severity::Low,
            format!(
                "Line {line} of {file_display} reads or runs a file that is missing; the shell prints `{}` each time a terminal opens.",
                msg.message
            ),
            "Noise at startup, and whatever the file provided is missing.".to_string(),
            format!("Fix the path on line {line} of {file_display}, recreate the file, or remove the line."),
        ),
        MessageKind::PermissionDenied => (
            format!("{file_display}:{line} is not allowed to run what it calls"),
            Severity::Medium,
            format!("Line {line} of {file_display} fails with `{}`.", msg.message),
            "The tool that line initialises does not work in your terminal.".to_string(),
            format!("Check the permissions of the file named in the message (`ls -l`), or reinstall the tool that installed line {line}."),
        ),
        _ => (
            format!("{file_display}:{line} prints an error at startup"),
            Severity::Low,
            format!("Line {line} of {file_display} prints `{}` each time a terminal opens.", msg.message),
            "Noise before your prompt; the line probably does not do what it was meant to.".to_string(),
            format!("Open {file_display} at line {line} and fix or remove the statement."),
        ),
    };
    let mut b = IssueBuilder::new(ERRORS_ID, Category::Shell, format!("{}:{line}:{}", file.display(), msg.kind.id()), title)
        .severity(severity)
        .confidence(Confidence::Confirmed)
        .description(description)
        .impact(impact)
        .recommended_action(action)
        .affected_file(file.to_path_buf(), Some(line), raw.clone())
        .metadata(metadata);
    for e in evidence {
        b = b.evidence(e);
    }
    for c in commands {
        b = b.affected_command(c);
    }
    if let Some(r) = raw {
        b = b.current_state(r);
    }
    if let Some(f) = fixer {
        b = b.fixer(f);
    }
    b.build()
}

// These tests exercise POSIX shell behaviour (login shells, `:`-separated PATH, rc files).
#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn parses_zsh_and_bash_formats() {
        let m = parse_message("/Users/me/.zshrc:12: command not found: pyenv");
        assert_eq!(m.file.as_deref(), Some(Path::new("/Users/me/.zshrc")));
        assert_eq!(m.line, Some(12));
        assert_eq!(m.kind, MessageKind::CommandNotFound("pyenv".into()));
        let s = parse_message("/Users/me/.zshrc:source:3: no such file or directory: /Users/me/.x");
        assert_eq!(s.line, Some(3));
        assert_eq!(s.kind, MessageKind::MissingFile);
        let b = parse_message("-bash: /Users/me/.bashrc: line 7: rbenv: command not found");
        assert_eq!(b.line, Some(7));
        assert_eq!(b.kind, MessageKind::CommandNotFound("rbenv".into()));
        let c = parse_message("zsh compinit: insecure directories, run compaudit for list.");
        assert_eq!(c.kind, MessageKind::InsecureCompinit);
        assert!(c.file.is_none());
    }
}
