//! Environment-level detectors: aliases that shadow runtime commands and variables that point to
//! directories which no longer exist.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;
use std::path::Path;

pub const ALIAS_ID: &str = "shell.alias.shadow";
pub const ENV_MISSING_ID: &str = "env.var.missing_path";

const SHADOW_WATCH: &[&str] = &[
    "python", "python3", "pip", "pip3", "node", "npm", "npx", "yarn", "pnpm", "cargo", "docker", "brew", "git", "ssh", "curl", "code",
    "claude",
];

pub struct AliasShadowDetector;

impl Detector for AliasShadowDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ALIAS_ID,
            name: "Aliases shadowing commands",
            category: Category::Shell,
            description: "Shell aliases that replace common developer commands (python, pip, node, git...).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let analysis = ctx.shell_analysis();
        let mut issues = Vec::new();
        for name in SHADOW_WATCH {
            let Some(value) = capture.aliases.get(*name) else { continue };
            let defined = analysis.aliases.iter().find(|a| &a.name == name);
            let mut b = IssueBuilder::new(ALIAS_ID, Category::Shell, *name, format!("`{name}` is an alias for {value}"))
                .severity(Severity::Info)
                .confidence(Confidence::Confirmed)
                .description(format!("Typing `{name}` in your terminal runs {value} instead of the `{name}` executable found in PATH. Scripts, editors and other programs are not affected: aliases only exist in interactive shells."))
                .impact("Not a problem by itself, but it explains why the terminal and other tools can behave differently for the same command.")
                .evidence(format!("alias {name}={value} (reported by the login shell)"))
                .affected_command(*name)
                .recommended_action(format!("Nothing to do if this is intentional. To see what really runs without the alias, type `command {name}`."));
            if let Some(def) = defined {
                b = b.evidence(format!("defined in {}:{}", ctx.display_path(&def.file), def.line)).affected_file(
                    def.file.clone(),
                    Some(def.line),
                    Some(format!("alias {}={}", def.name, def.value_raw)),
                );
            }
            issues.push(b.metadata(json!({ "name": name, "value": value })).build());
        }
        Ok(issues)
    }
}

pub struct EnvVarMissingPathDetector;

impl Detector for EnvVarMissingPathDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: ENV_MISSING_ID,
            name: "Environment variables pointing nowhere",
            category: Category::Environment,
            description: "Tool variables (NVM_DIR, PYENV_ROOT, JAVA_HOME, ANDROID_HOME...) that point to directories which do not exist.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let capture = ctx.shell_capture();
        let analysis = ctx.shell_analysis();
        let mut issues = Vec::new();
        for (name, value) in &capture.vars {
            if matches!(
                name.as_str(),
                "HOME"
                    | "USER"
                    | "SHELL"
                    | "ZDOTDIR"
                    | "HOMEBREW_PREFIX"
                    | "HOMEBREW_CELLAR"
                    | "HOMEBREW_REPOSITORY"
                    | "CONDA_EXE"
                    | "DOCKER_HOST"
            ) {
                continue;
            }
            if !value.starts_with('/') || Path::new(value).exists() {
                continue;
            }
            let setter = analysis.assignments.iter().find(|a| &a.name == name);
            let mut b = IssueBuilder::new(ENV_MISSING_ID, Category::Environment, name, format!("{name} points to a directory that does not exist"))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!("{name} is set to {} but that path does not exist. The tool that reads this variable was probably uninstalled or moved, and its setting stayed behind.", ctx.display_path(Path::new(value))))
                .impact("Tools that honour the variable fail or silently fall back to defaults; the startup line that sets it is dead weight.")
                .evidence(format!("{name}={}", ctx.display_path(Path::new(value))))
                .evidence(format!("{value} does not exist"))
                .recommended_action(if setter.is_some() { "Remove the export from your startup file if the tool is gone, or reinstall the tool." } else { "Find where the variable is exported (a sourced script or launchd) and remove it if the tool is gone." });
            if let Some(s) = setter {
                b = b.evidence(format!("set in {}:{} — {}={}", ctx.display_path(&s.file), s.line, s.name, s.value_raw)).affected_file(
                    s.file.clone(),
                    Some(s.line),
                    Some(format!("{}={}", s.name, s.value_raw)),
                );
            }
            issues.push(b.metadata(json!({ "name": name, "value": value })).build());
        }
        Ok(issues)
    }
}
