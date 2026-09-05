//! PATH detectors: duplicates, missing directories, suspicious entries.

use crate::util::{join_positions, location, times};
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::path_env::PathSource;
use devdoctor_core::shell::{normalize_key, plan_duplicate_removals, PathOp};
use devdoctor_core::Result;
use serde_json::json;
use std::path::{Path, PathBuf};

pub const DUPLICATE_ID: &str = "shell.path.duplicate";
pub const MISSING_ID: &str = "shell.path.missing_directory";
pub const SUSPICIOUS_ID: &str = "shell.path.suspicious_entry";

pub struct PathDuplicateDetector;

impl Detector for PathDuplicateDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: DUPLICATE_ID,
            name: "Duplicate PATH entries",
            category: Category::Shell,
            description: "Directories listed more than once in the PATH of a fresh login shell.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let analysis = ctx.shell_analysis();
        let mut issues = Vec::new();
        let source_note = match &capture.path.source {
            PathSource::LoginShell { shell } => format!("PATH captured from a fresh {shell} login shell"),
            PathSource::ProcessEnvironment => {
                "PATH taken from the DevDoctor process environment (login shell capture unavailable)".to_string()
            }
            PathSource::Override => "PATH provided explicitly".to_string(),
            PathSource::Registry => {
                "PATH read from the Windows registry (machine value, then user value), as a new terminal sees it".to_string()
            }
        };
        let registry = matches!(capture.path.source, PathSource::Registry);
        for (dir, positions) in capture.path.duplicates() {
            let plan = plan_duplicate_removals(&analysis.mutations, &analysis.initial_path, &dir);
            let display_dir = ctx.display_path(Path::new(&dir));
            let mut builder = IssueBuilder::new(DUPLICATE_ID, Category::Shell, &dir, format!("PATH contains {} {}", display_dir, times(positions.len())))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!(
                    "{} appears at positions {} of your PATH. Only the first occurrence matters: the shell stops at the first directory that contains a command.",
                    display_dir,
                    join_positions(&positions)
                ))
                .impact("Usually harmless, but it makes the environment harder to understand and debug, and it hides which configuration file really controls command precedence.")
                .technical(format!("Effective PATH ({}):\n{}", source_note, capture.path.entries.iter().enumerate().map(|(i, e)| format!("{:>2}  {}{}", i + 1, e, if normalize_key(e) == dir { "   <- duplicate" } else { "" })).collect::<Vec<_>>().join("\n")))
                .evidence(format!("{source_note}: {display_dir} is listed at positions {}", join_positions(&positions)))
                .current_state(format!("PATH={}", capture.path.raw))
                .affected_command("PATH");
            let mut attributed = 0;
            for m in &analysis.mutations {
                if m.added_dirs().any(|c| c.expanded.as_ref().is_some_and(|p| p.to_string_lossy() == dir)) {
                    attributed += 1;
                    let op = match m.op {
                        PathOp::Prepend => "prepends",
                        PathOp::Append => "appends",
                        PathOp::Set => "sets PATH including",
                        PathOp::Complex => "modifies PATH with",
                    };
                    let extra = if !m.is_effective() { " (inside a conditional block or function)" } else { "" };
                    builder = builder.evidence(format!("{} {op} {display_dir}{extra}: {}", location(ctx, m), m.raw)).affected_file(
                        m.file.clone(),
                        Some(m.line),
                        Some(m.raw.clone()),
                    );
                }
            }
            for e in &analysis.evals {
                if e.command.contains("brew shellenv")
                    && ctx.brew_prefix().is_some_and(|p| dir.starts_with(&p.to_string_lossy().into_owned()))
                {
                    builder = builder.evidence(format!(
                        "{}:{} runs eval \"$({})\", which also adds Homebrew directories to PATH",
                        ctx.display_path(&e.file),
                        e.line,
                        e.command
                    ));
                }
            }
            let removable: Vec<String> = plan
                .removals
                .iter()
                .map(|r| {
                    let m = &analysis.mutations[r.mutation_index];
                    format!("{} ({})", location(ctx, m), m.raw)
                })
                .collect();
            let keep_text = match (&plan.keep, plan.kept_by_initial_path) {
                (Some(k), _) => {
                    let m = &analysis.mutations[k.mutation_index];
                    format!("Keep {} — it is the statement that determines where {} sits in PATH.", location(ctx, m), display_dir)
                }
                (None, true) => format!(
                    "{display_dir} is already part of the system PATH (/etc/paths), so user statements that append it are redundant."
                ),
                (None, false) => String::new(),
            };
            let blocked_text: Vec<String> = plan
                .blocked
                .iter()
                .map(|b| {
                    let m = &analysis.mutations[b.mutation_index];
                    format!("{} cannot be edited automatically: {}", location(ctx, m), b.reason)
                })
                .collect();
            if !removable.is_empty() {
                builder = builder
                    .recommended_action(format!(
                        "Remove the redundant statement{}: {}. {} Removing it does not uninstall anything and does not change which commands run first.",
                        if removable.len() > 1 { "s" } else { "" },
                        removable.join("; "),
                        keep_text
                    ))
                    .fixer("shell.path.remove_duplicate");
            } else if registry {
                builder = builder.recommended_action(format!(
                    "Open Settings > System > About > Advanced system settings > Environment Variables and remove the repeated {display_dir} entry (it appears in both the system and the user Path, or twice in one of them). DevDoctor does not edit the Windows registry yet."
                ));
            } else if attributed == 0 {
                builder = builder.recommended_action(format!(
                    "DevDoctor could not find a plain statement in your startup files that adds {display_dir}. It is probably added by a tool initialisation (eval or sourced script) or by the system PATH plus a tool. Review the files listed under Shell to find the second source; no automatic fix is offered."
                ));
            } else {
                builder = builder.recommended_action(format!(
                    "The statements that add {display_dir} cannot be simplified safely by DevDoctor ({}). Review them manually.",
                    blocked_text.join("; ")
                ));
            }
            builder = builder.metadata(json!({
                "dir": dir,
                "positions": positions,
                "plan": plan,
                "path_source": capture.path.source,
            }));
            issues.push(builder.build());
        }
        Ok(issues)
    }
}

pub struct PathMissingDirectoryDetector;

impl Detector for PathMissingDirectoryDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: MISSING_ID,
            name: "Missing PATH directories",
            category: Category::Shell,
            description: "PATH entries that point to directories which do not exist.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let analysis = ctx.shell_analysis();
        let system_sources = devdoctor_core::path_env::system_path_sources();
        let mut issues = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for (i, raw) in capture.path.entries.iter().enumerate() {
            if raw.is_empty() || !raw.starts_with('/') {
                continue;
            }
            let key = normalize_key(raw);
            if !seen.insert(key.clone()) {
                continue;
            }
            if Path::new(&key).exists() {
                continue;
            }
            // Entries managed by macOS itself (cryptexes, /System) come and go with the OS; the
            // user cannot and should not touch them.
            if key.contains("com.apple.security.cryptexd") || key.starts_with("/System/") {
                continue;
            }
            let display_dir = ctx.display_path(Path::new(&key));
            if let Some((_, source)) = system_sources.iter().find(|(e, _)| normalize_key(e) == key) {
                if source == "launchd" || source == "/etc/paths" {
                    continue;
                }
                issues.push(
                    IssueBuilder::new(MISSING_ID, Category::Shell, &key, format!("System PATH entry does not exist: {display_dir}"))
                        .severity(Severity::Info)
                        .confidence(Confidence::Confirmed)
                        .description(format!("{source} adds {display_dir} to every user's PATH, but the directory does not exist. It was left behind by an installer whose package has since been removed."))
                        .impact("Harmless; every command lookup checks one dead directory.")
                        .evidence(format!("{key} does not exist"))
                        .evidence(format!("declared in {source}"))
                        .affected_file(PathBuf::from(source), None, None)
                        .current_state(format!("PATH position {}: {}", i + 1, raw))
                        .recommended_action(format!("Remove the file with administrator rights (`sudo rm {source}`) if the tool is gone. DevDoctor never modifies system files."))
                        .metadata(json!({ "dir": key, "position": i + 1, "removals": [], "system_source": source }))
                        .build(),
                );
                continue;
            }
            let mut builder = IssueBuilder::new(MISSING_ID, Category::Shell, &key, format!("PATH entry does not exist: {display_dir}"))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!("Position {} of your PATH points to {}, which does not exist on disk. The shell checks it on every command lookup and never finds anything there.", i + 1, display_dir))
                .impact("Harmless for correctness, but it usually means a tool was uninstalled or moved while its PATH line stayed behind, and it slows down every command lookup slightly.")
                .evidence(format!("{} does not exist", key))
                .current_state(format!("PATH position {}: {}", i + 1, raw))
                .affected_command("PATH");
            let mut removable = Vec::new();
            let mut blocked = Vec::new();
            for (mi, m) in analysis.mutations.iter().enumerate() {
                for (ci, c) in m.components.iter().enumerate() {
                    if c.expanded.as_ref().is_some_and(|p| p.to_string_lossy() == key) {
                        builder = builder.evidence(format!("{} adds it: {}", location(ctx, m), m.raw)).affected_file(
                            m.file.clone(),
                            Some(m.line),
                            Some(m.raw.clone()),
                        );
                        if m.is_effective() && m.rewritable {
                            removable.push(json!({ "mutation_index": mi, "component_index": ci }));
                        } else {
                            blocked.push(location(ctx, m));
                        }
                    }
                }
            }
            let nvm_hint = key.contains("/.nvm/versions/node/");
            if nvm_hint {
                builder = builder.recommended_action("This directory belongs to an nvm Node version that is no longer installed. Run `nvm ls` and set a valid default with `nvm alias default <version>`; nvm adds the directory itself at startup.".to_string());
            } else if !removable.is_empty() {
                builder = builder
                    .recommended_action(format!("Remove {display_dir} from the statement(s) that add it. If you reinstall the tool later, its installer will add the line again."))
                    .fixer("shell.path.remove_missing_directory");
            } else if !blocked.is_empty() {
                builder = builder.recommended_action(format!(
                    "The statement(s) adding {display_dir} ({}) cannot be edited automatically; edit them by hand.",
                    blocked.join(", ")
                ));
            } else if matches!(capture.path.source, PathSource::Registry) {
                builder = builder.recommended_action(format!("Remove {display_dir} from the Path variable (Settings > System > About > Advanced system settings > Environment Variables). It is listed in the user or the system Path but no longer exists; DevDoctor does not edit the Windows registry yet."));
            } else {
                builder = builder.recommended_action(format!("No startup file statement adds {display_dir} directly; it comes from a tool initialisation or the system PATH. Check the Shell page for eval/source lines."));
            }
            builder = builder.metadata(json!({ "dir": key, "position": i + 1, "removals": removable, "nvm": nvm_hint }));
            issues.push(builder.build());
        }
        Ok(issues)
    }
}

pub struct PathSuspiciousEntryDetector;

impl Detector for PathSuspiciousEntryDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: SUSPICIOUS_ID,
            name: "Suspicious PATH entries",
            category: Category::Shell,
            description: "Empty, relative or world-writable PATH entries that can make commands resolve unexpectedly.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let mut issues = Vec::new();
        for (i, raw) in capture.path.entries.iter().enumerate() {
            let position = i + 1;
            if raw.is_empty() || raw == "." {
                issues.push(
                    IssueBuilder::new(SUSPICIOUS_ID, Category::Shell, format!("cwd:{position}"), "PATH includes the current directory")
                        .severity(Severity::Medium)
                        .confidence(Confidence::Confirmed)
                        .description(format!("Position {position} of PATH is {} which means the current working directory is searched for commands.", if raw.is_empty() { "empty (a stray `:`)" } else { "`.`" }))
                        .impact("Any file named like a common command in the directory you are in can be executed instead of the real command. This is a classic security and debugging trap.")
                        .evidence(format!("PATH={}", capture.path.raw))
                        .recommended_action("Find the statement that leaves an empty component or `.` in PATH (often a trailing colon such as `PATH=$PATH:`) and remove it.")
                        .affected_command("PATH")
                        .build(),
                );
            } else if !raw.starts_with('/') && !raw.starts_with('~') {
                issues.push(
                    IssueBuilder::new(SUSPICIOUS_ID, Category::Shell, format!("relative:{raw}"), format!("Relative PATH entry: {raw}"))
                        .severity(Severity::Low)
                        .confidence(Confidence::Confirmed)
                        .description(format!(
                            "Position {position} of PATH is `{raw}`, a relative path. It resolves against whatever directory you are in."
                        ))
                        .impact("Commands may work in one project and fail in another, and untrusted directories can shadow real commands.")
                        .recommended_action("Replace the relative entry with an absolute path in the startup file that adds it.")
                        .affected_command("PATH")
                        .build(),
                );
            } else {
                let key = normalize_key(raw);
                if let Ok(meta) = std::fs::metadata(&key) {
                    if meta.is_dir()
                        && devdoctor_core::sys::is_world_writable(&meta)
                        && !key.starts_with("/private/tmp")
                        && !key.starts_with("/tmp")
                    {
                        issues.push(
                            IssueBuilder::new(
                                SUSPICIOUS_ID,
                                Category::Shell,
                                format!("world_writable:{key}"),
                                format!("World-writable directory in PATH: {}", ctx.display_path(Path::new(&key))),
                            )
                            .severity(Severity::Medium)
                            .confidence(Confidence::Confirmed)
                            .description(format!(
                                "{} is writable by every user on {} and is searched for commands at position {position}.",
                                ctx.display_path(Path::new(&key)),
                                devdoctor_core::sys::os_label()
                            ))
                            .impact("Any process running as another user could drop an executable there that shadows a real command.")
                            .evidence(format!("mode {:o}", devdoctor_core::sys::mode_of(&meta).unwrap_or(0)))
                            .recommended_action(format!("Tighten permissions (`chmod o-w {key}`) or remove the directory from PATH."))
                            .affected_command("PATH")
                            .build(),
                        );
                    }
                }
            }
        }
        Ok(issues)
    }
}

pub const DANGLING_ID: &str = "shell.path.dangling_symlinks";

/// Broken symbolic links inside PATH directories: a command that "exists" but cannot run.
pub struct PathDanglingSymlinkDetector;

fn is_system_dir(dir: &str) -> bool {
    dir.starts_with("/usr/bin")
        || dir.starts_with("/bin")
        || dir.starts_with("/usr/sbin")
        || dir.starts_with("/sbin")
        || dir.starts_with("/usr/libexec")
        || dir.starts_with("/System/")
        || dir.starts_with("/Library/Apple")
        || dir.contains("cryptexd")
        || dir.starts_with("/var/run/")
}

/// Guesses which tool left the dead link behind, from where the link pointed.
fn origin_hint(target: &Path) -> Option<&'static str> {
    let t = target.to_string_lossy();
    if t.contains("/pipx/") {
        Some("a pipx package that was removed")
    } else if t.contains("/.cargo/") {
        Some("a Cargo binary that was uninstalled")
    } else if t.contains("/node_modules/") {
        Some("an npm package that was removed")
    } else if t.contains("/Cellar/") || t.contains("/Caskroom/") {
        Some("a Homebrew formula that was uninstalled")
    } else if t.contains("/Applications/") {
        Some("an application that was deleted")
    } else if t.contains("/.local/share/uv/") || t.contains("/uv/tools/") {
        Some("a uv tool that was removed")
    } else if t.contains("/.nvm/") || t.contains("/.volta/") || t.contains("/fnm/") {
        Some("a Node.js version that was removed")
    } else if t.contains("/.pyenv/") || t.contains("/.rbenv/") {
        Some("a runtime version that was removed")
    } else {
        None
    }
}

impl Detector for PathDanglingSymlinkDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: DANGLING_ID,
            name: "Broken command links in PATH",
            category: Category::Shell,
            description: "Symbolic links in PATH directories whose target no longer exists (leftovers of uninstalled tools).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let brew_prefix = ctx.brew_prefix().map(|p| p.to_string_lossy().into_owned());
        let mut issues = Vec::new();
        for dir in capture.path.dedup_order() {
            if dir.is_empty() || is_system_dir(&dir) {
                continue;
            }
            // Homebrew's own directories are covered by the Homebrew health detector.
            if brew_prefix.as_ref().is_some_and(|p| dir.starts_with(p.as_str()) && p != "/usr/local") {
                continue;
            }
            let path = PathBuf::from(&dir);
            if !path.is_dir() {
                continue;
            }
            let mut dead: Vec<(PathBuf, PathBuf)> = Vec::new();
            for entry in devdoctor_core::fs_util::list_dir(&path) {
                if devdoctor_core::fs_util::is_symlink(&entry) && std::fs::metadata(&entry).is_err() {
                    let target = std::fs::read_link(&entry).unwrap_or_default();
                    dead.push((entry, target));
                }
            }
            if dead.is_empty() {
                continue;
            }
            let in_home = devdoctor_core::fs_util::starts_with_lexical(&path, &ctx.home);
            let display_dir = ctx.display_path(&path);
            let names: Vec<String> = dead.iter().filter_map(|(l, _)| l.file_name().map(|n| n.to_string_lossy().into_owned())).collect();
            let mut b = IssueBuilder::new(DANGLING_ID, Category::Shell, &dir, format!("{} broken command link{} in {display_dir}", dead.len(), if dead.len() == 1 { "" } else { "s" }))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!(
                    "{display_dir} is in your PATH and contains {} symbolic link{} whose target no longer exists ({}). Typing one of these commands gives `no such file or directory` instead of a clean `command not found`, and tools that check for the command believe it is installed.",
                    dead.len(),
                    if dead.len() == 1 { "" } else { "s" },
                    names.iter().take(6).cloned().collect::<Vec<_>>().join(", ")
                ))
                .impact("Confusing errors and false positives in installers that probe for existing commands. Harmless otherwise.")
                .recommended_action(if in_home {
                    "Remove the dead links (DevDoctor can do it; Undo recreates them) or reinstall the tools they belonged to.".to_string()
                } else {
                    format!("Remove the dead links by hand (they are outside your home folder, so DevDoctor only reports them): rm {}", dead.iter().map(|(l, _)| l.display().to_string()).collect::<Vec<_>>().join(" "))
                })
                .metadata(json!({
                    "dir": path,
                    "in_home": in_home,
                    "links": dead.iter().map(|(l, t)| json!({ "link": l, "target": t })).collect::<Vec<_>>(),
                }));
            for (link, target) in dead.iter().take(15) {
                let hint = origin_hint(target).map(|h| format!(" — {h}")).unwrap_or_default();
                b = b.evidence(format!("{} → {} (missing){hint}", ctx.display_path(link), ctx.display_path(target))).affected_file(
                    link.clone(),
                    None,
                    None,
                );
            }
            for (link, _) in &dead {
                if let Some(n) = link.file_name() {
                    b = b.affected_command(n.to_string_lossy().into_owned());
                }
            }
            if in_home {
                b = b.fixer("shell.path.remove_dangling_symlinks");
            }
            issues.push(b.build());
        }
        Ok(issues)
    }
}
