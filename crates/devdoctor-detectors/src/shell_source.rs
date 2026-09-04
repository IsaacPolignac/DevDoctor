//! `source` / `.` statement detectors: missing files, recursion, duplicates.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;
use std::collections::{BTreeMap, HashSet};
use std::path::PathBuf;

pub const MISSING_ID: &str = "shell.source.missing_file";
pub const RECURSIVE_ID: &str = "shell.source.recursive";
pub const DUPLICATE_ID: &str = "shell.source.duplicate";

pub struct SourceMissingFileDetector;

impl Detector for SourceMissingFileDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: MISSING_ID,
            name: "Sourced files that do not exist",
            category: Category::Shell,
            description: "`source` statements in startup files pointing to files that are gone.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let analysis = ctx.shell_analysis();
        let mut issues = Vec::new();
        for s in &analysis.sources {
            if s.guarded || s.conditional || s.in_function || s.exists != Some(false) {
                continue;
            }
            let Some(target) = &s.expanded else { continue };
            let file_display = ctx.display_path(&s.file);
            let target_display = ctx.display_path(target);
            let tool_hint = tool_hint(target);
            let mut builder = IssueBuilder::new(MISSING_ID, Category::Shell, format!("{}:{}", s.file.display(), target.display()), format!("{file_display} sources a missing file: {target_display}"))
                .severity(Severity::Medium)
                .confidence(Confidence::Confirmed)
                .description(format!("Line {} of {file_display} runs `{}`, but {target_display} does not exist. Every new terminal prints an error such as `no such file or directory: {target_display}` before your prompt appears.", s.line, s.raw))
                .impact("The startup file continues after the error, but anything that file was supposed to configure (PATH entries, completions, functions) is silently missing.")
                .evidence(format!("{target_display} does not exist"))
                .evidence(format!("{file_display}:{} — {}", s.line, s.raw))
                .affected_file(s.file.clone(), Some(s.line), Some(s.raw.clone()))
                .current_state(s.raw.clone())
                .metadata(json!({ "file": s.file, "line": s.line, "target": target, "raw": s.raw, "exclusive_line": s.exclusive_line }));
            builder = match tool_hint {
                Some(hint) => builder.recommended_action(format!("{hint} Either reinstall the tool or disable line {} of {file_display} (DevDoctor can comment it out for you; the file is backed up first).", s.line)),
                None => builder.recommended_action(format!("Disable line {} of {file_display} (DevDoctor can comment it out, with a backup), or guard it with `[ -f {target_display} ] && source {target_display}` if the file only exists on some machines.", s.line)),
            };
            if s.exclusive_line {
                builder = builder.fixer("shell.source.comment_out");
            }
            issues.push(builder.build());
        }
        Ok(issues)
    }
}

fn tool_hint(target: &std::path::Path) -> Option<String> {
    let s = target.to_string_lossy();
    if s.contains("nvm.sh") {
        Some("This line belongs to nvm, which appears to be uninstalled.".into())
    } else if s.contains(".cargo/env") {
        Some("This line belongs to rustup/cargo, which appears to be uninstalled.".into())
    } else if s.contains("conda") {
        Some("This line belongs to conda, which appears to be uninstalled.".into())
    } else if s.contains("sdkman") {
        Some("This line belongs to SDKMAN, which appears to be uninstalled.".into())
    } else if s.contains("oh-my-zsh") || s.contains(".oh-my-zsh") {
        Some("This line belongs to oh-my-zsh, which appears to be missing.".into())
    } else if s.contains("google-cloud-sdk") {
        Some("This line belongs to the Google Cloud SDK, which appears to be uninstalled.".into())
    } else {
        None
    }
}

pub struct SourceRecursiveDetector;

impl Detector for SourceRecursiveDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: RECURSIVE_ID,
            name: "Recursive sourcing",
            category: Category::Shell,
            description: "Startup files that source each other in a loop.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let analysis = ctx.shell_analysis();
        let files: HashSet<PathBuf> = analysis.files.iter().filter(|f| f.exists).map(|f| f.path.clone()).collect();
        let mut edges: BTreeMap<PathBuf, Vec<(PathBuf, u32, String)>> = BTreeMap::new();
        for s in &analysis.sources {
            if s.in_function {
                continue;
            }
            if let Some(t) = &s.expanded {
                if files.contains(t) {
                    edges.entry(s.file.clone()).or_default().push((t.clone(), s.line, s.raw.clone()));
                }
            }
        }
        let mut issues = Vec::new();
        let mut reported: HashSet<Vec<PathBuf>> = HashSet::new();
        for start in edges.keys() {
            let mut stack = vec![(start.clone(), vec![start.clone()])];
            while let Some((node, path)) = stack.pop() {
                for (next, line, raw) in edges.get(&node).cloned().unwrap_or_default() {
                    if let Some(pos) = path.iter().position(|p| p == &next) {
                        let mut cycle: Vec<PathBuf> = path[pos..].to_vec();
                        cycle.push(next.clone());
                        let mut key = cycle.clone();
                        key.sort();
                        key.dedup();
                        if !reported.insert(key) {
                            continue;
                        }
                        let chain: Vec<String> = cycle.iter().map(|p| ctx.display_path(p)).collect();
                        issues.push(
                            IssueBuilder::new(RECURSIVE_ID, Category::Shell, chain.join(">"), format!("Startup files source each other in a loop: {}", chain.join(" → ")))
                                .severity(Severity::High)
                                .confidence(if cycle.iter().all(|c| files.contains(c)) { Confidence::Confirmed } else { Confidence::Likely })
                                .description(format!("{}:{} runs `{}`, which (directly or through other files) sources {} again.", ctx.display_path(&node), line, raw, ctx.display_path(&node)))
                                .impact("Depending on guards this either slows every shell start, doubles every PATH entry, or recurses until zsh aborts with an error.")
                                .evidence(format!("{}:{} — {}", ctx.display_path(&node), line, raw))
                                .affected_file(node.clone(), Some(line), Some(raw.clone()))
                                .recommended_action(format!("Remove the `source` on line {} of {} (zsh already reads these files in order: .zshenv, .zprofile, .zshrc, .zlogin).", line, ctx.display_path(&node)))
                                .metadata(json!({ "cycle": cycle, "file": node, "line": line }))
                                .build(),
                        );
                    } else if path.len() < 8 {
                        let mut next_path = path.clone();
                        next_path.push(next.clone());
                        stack.push((next, next_path));
                    }
                }
            }
        }
        Ok(issues)
    }
}

pub struct SourceDuplicateDetector;

impl Detector for SourceDuplicateDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: DUPLICATE_ID,
            name: "Duplicate source statements",
            category: Category::Shell,
            description: "The same file sourced more than once at startup (typically an installer appended its line twice).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let analysis = ctx.shell_analysis();
        let mut by_target: BTreeMap<PathBuf, Vec<(PathBuf, u32, String, bool)>> = BTreeMap::new();
        for s in &analysis.sources {
            if s.in_function || s.conditional {
                continue;
            }
            if let Some(t) = &s.expanded {
                by_target.entry(t.clone()).or_default().push((s.file.clone(), s.line, s.raw.clone(), s.exclusive_line));
            }
        }
        let mut issues = Vec::new();
        for (target, refs) in by_target {
            if refs.len() < 2 {
                continue;
            }
            let locations: Vec<String> = refs.iter().map(|(f, l, _, _)| format!("{}:{}", ctx.display_path(f), l)).collect();
            let mut builder = IssueBuilder::new(DUPLICATE_ID, Category::Shell, target.display().to_string(), format!("{} is sourced {} times at startup", ctx.display_path(&target), refs.len()))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!("{} is loaded by {}. Loading it once is enough.", ctx.display_path(&target), locations.join(" and ")))
                .impact("Slower shell startup and, for tools such as nvm or conda, duplicated PATH entries and double initialisation.")
                .recommended_action(format!("Keep the first statement and disable the other(s): {}. DevDoctor can comment them out with a backup.", locations[1..].join(", ")))
                .fixer("shell.source.remove_duplicate")
                .metadata(json!({ "target": target, "references": refs.iter().map(|(f, l, r, ex)| json!({ "file": f, "line": l, "raw": r, "exclusive_line": ex })).collect::<Vec<_>>() }));
            for (f, l, r, _) in &refs {
                builder =
                    builder.evidence(format!("{}:{} — {}", ctx.display_path(f), l, r)).affected_file(f.clone(), Some(*l), Some(r.clone()));
            }
            issues.push(builder.build());
        }
        Ok(issues)
    }
}
