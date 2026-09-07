//! Syntax check of startup files using the shell's own parser (`zsh -n` / `bash -n`).

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::shell::ShellKind;
use devdoctor_core::Result;
use serde_json::json;
use std::path::Path;

pub const ID: &str = "shell.zsh.syntax";

pub struct ShellSyntaxDetector;

/// Parses `file:line: message` diagnostics.
pub fn parse_diagnostics(stderr: &str, file: &Path) -> Vec<(Option<u32>, String)> {
    let name = file.to_string_lossy();
    let mut out = Vec::new();
    for line in stderr.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let rest = line.strip_prefix(name.as_ref()).and_then(|r| r.strip_prefix(':')).unwrap_or(line);
        let (line_no, message) = match rest.split_once(':') {
            Some((n, m)) if n.trim().parse::<u32>().is_ok() => (n.trim().parse::<u32>().ok(), m.trim().to_string()),
            _ => (None, rest.trim().to_string()),
        };
        out.push((line_no, message));
    }
    out
}

impl Detector for ShellSyntaxDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ID,
            name: "Shell configuration syntax",
            category: Category::Shell,
            description: "Runs the shell's parser in check mode on every startup file.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let analysis = ctx.shell_analysis();
        let (program, shell_name) = match ctx.shell {
            ShellKind::Bash => ("/bin/bash", "bash"),
            _ => ("/bin/zsh", "zsh"),
        };
        let mut issues = Vec::new();
        for file in analysis.files.iter().filter(|f| f.exists) {
            let spec = CommandSpec::new(program).arg("-n").arg(file.path.to_string_lossy().into_owned()).timeout_ms(5_000);
            let out = match ctx.run(&spec) {
                Ok(o) => o,
                Err(e) => {
                    tracing::warn!(file = %file.path.display(), error = %e, "syntax check could not run");
                    continue;
                }
            };
            if out.success() {
                continue;
            }
            let diagnostics = parse_diagnostics(&out.stderr, &file.path);
            let first_line = diagnostics.iter().find_map(|(l, _)| *l);
            let messages: Vec<String> = diagnostics
                .iter()
                .map(|(l, m)| match l {
                    Some(l) => format!("line {l}: {m}"),
                    None => m.clone(),
                })
                .collect();
            let excerpt = first_line.and_then(|l| file.content.as_ref().and_then(|c| c.lines().nth(l as usize - 1).map(|s| s.to_string())));
            let mut builder = IssueBuilder::new(ID, Category::Shell, file.path.display().to_string(), format!("Syntax error in {}", ctx.display_path(&file.path)))
                .severity(Severity::High)
                .confidence(Confidence::Confirmed)
                .description(format!("`{shell_name} -n` refuses to parse {}. {shell_name} stops reading the file at the error, so everything after it (aliases, PATH changes, tool initialisation) is skipped in every new terminal.", ctx.display_path(&file.path)))
                .impact("Commands go missing, PATH is incomplete and each new shell prints an error.")
                .technical(format!("{} -n {}\n{}", program, file.path.display(), out.stderr.trim()))
                .affected_file(file.path.clone(), first_line, excerpt.clone())
                .current_state(excerpt.unwrap_or_default())
                .recommended_action(match first_line {
                    Some(l) => format!("Open {} at line {l} and fix the reported problem ({}). If DevDoctor has a backup of this file, it can restore it.", ctx.display_path(&file.path), messages.first().cloned().unwrap_or_default()),
                    None => format!("Fix the syntax problem reported by {shell_name}: {}", messages.join("; ")),
                })
                .fixer("shell.restore_backup")
                .metadata(json!({ "file": file.path, "line": first_line, "diagnostics": messages, "shell": shell_name }));
            for m in &messages {
                builder = builder.evidence(format!("{shell_name} -n: {m}"));
            }
            for w in &file.warnings {
                builder = builder.evidence(format!("DevDoctor parser: line {}: {}", w.line, w.message));
            }
            issues.push(builder.build());
        }
        Ok(issues)
    }
}

// These tests exercise POSIX shell behaviour (login shells, `:`-separated PATH, rc files).
#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn parses_zsh_diagnostics() {
        let d = parse_diagnostics("/Users/me/.zshrc:12: parse error near `fi'\n", Path::new("/Users/me/.zshrc"));
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].0, Some(12));
        assert!(d[0].1.contains("parse error"));
    }
}
