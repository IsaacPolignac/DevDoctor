//! Python detectors: multiple interpreters and pip/python mismatches.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::python;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;
use std::collections::BTreeSet;

pub const MULTIPLE_ID: &str = "python.interpreter.multiple";
pub const PIP_MISMATCH_ID: &str = "python.pip.mismatch";

pub struct PythonMultipleInterpretersDetector;

impl Detector for PythonMultipleInterpretersDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: MULTIPLE_ID,
            name: "Python interpreters",
            category: Category::Runtimes,
            description: "Several Python installations, and `python` vs `python3` resolving to different interpreters.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = python::inventory(ctx);
        let mut issues = Vec::new();
        if let Some(text) = &inv.python_python3_mismatch {
            let py = inv.python.as_ref();
            let py3 = inv.python3.as_ref();
            let mut b = IssueBuilder::new(MULTIPLE_ID, Category::Runtimes, "python_vs_python3", "`python` and `python3` run different interpreters")
                .severity(Severity::Medium)
                .confidence(Confidence::Confirmed)
                .description(format!("{text}."))
                .impact("Scripts, Makefiles and tools that call `python` use a different interpreter (and different installed packages) than the ones calling `python3`. Packages you install for one are missing from the other.")
                .affected_command("python")
                .affected_command("python3")
                .recommended_action("Decide which installation you want and make its bin directory come first in PATH for both names, or add `alias python=python3` to ~/.zshrc if you only use python3. Version managers (pyenv, uv) can pin one interpreter for both names.");
            if let Some(p) = py {
                b = b.evidence(format!(
                    "python → {} ({}, {})",
                    p.path.display(),
                    p.version.clone().unwrap_or_else(|| "version unknown".into()),
                    p.origin_label
                ));
            }
            if let Some(p) = py3 {
                b = b.evidence(format!(
                    "python3 → {} ({}, {})",
                    p.path.display(),
                    p.version.clone().unwrap_or_else(|| "version unknown".into()),
                    p.origin_label
                ));
            }
            if let Some(alias) = &inv.python_alias {
                b = b.evidence(format!("Your shell also defines an alias: python={alias}"));
            }
            issues.push(b.metadata(json!({ "python": py, "python3": py3 })).build());
        }
        let sources: BTreeSet<&str> = inv.installations.iter().map(|i| i.label.as_str()).collect();
        if sources.len() >= 2 {
            let mut b = IssueBuilder::new(MULTIPLE_ID, Category::Runtimes, "installations", format!("{} Python installations from {} different sources", inv.installations.len(), sources.len()))
                .severity(Severity::Info)
                .confidence(Confidence::Confirmed)
                .description(format!("Python is installed through {}. Each installation has its own packages; which one runs depends on PATH order.", sources.iter().copied().collect::<Vec<_>>().join(", ")))
                .impact("Not a problem by itself, but it is the usual root cause of `pip` installing into the wrong place and of `python` behaving differently between terminals and editors.")
                .recommended_action("Keep the installations you actively use and uninstall the rest (for Homebrew: `brew uninstall python@3.x`; for pyenv: `pyenv uninstall <version>`). Use the Command Resolution page to see which one wins.");
            for i in &inv.installations {
                b = b.evidence(format!(
                    "{}{} — {} ({})",
                    i.version.clone().map(|v| format!("Python {v} ")).unwrap_or_default(),
                    if i.active { "[active]" } else { "" },
                    ctx.display_path(&i.binary),
                    i.label
                ));
            }
            issues.push(b.metadata(json!({ "installations": inv.installations })).build());
        }
        Ok(issues)
    }
}

pub struct PipMismatchDetector;

impl Detector for PipMismatchDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: PIP_MISMATCH_ID,
            name: "pip / python mismatch",
            category: Category::Runtimes,
            description: "`pip` installs packages into a different Python than the interpreter you run.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = python::inventory(ctx);
        let mut issues = Vec::new();
        for m in &inv.pip_mismatches {
            let py_ver = m.python_version.clone().unwrap_or_else(|| "unknown version".into());
            let pip_ver = m.pip_python_version.clone().unwrap_or_else(|| "unknown version".into());
            issues.push(
                IssueBuilder::new(PIP_MISMATCH_ID, Category::Runtimes, &m.pip_command, format!("`{}` installs into a different Python than `{}`", m.pip_command, m.python_command))
                    .severity(Severity::High)
                    .confidence(Confidence::Confirmed)
                    .description(format!(
                        "`{}` resolves to {} (Python {py_ver}), but `{}` is a script whose interpreter is {} (Python {pip_ver}). Packages installed with `{}` land in the second environment and are invisible to the first.",
                        m.python_command,
                        ctx.display_path(m.python_real_path.as_deref().unwrap_or(&m.python_path)),
                        m.pip_command,
                        ctx.display_path(&m.pip_interpreter),
                        m.pip_command
                    ))
                    .impact("`pip install X` succeeds, then `import X` fails. This is one of the most common broken-Python symptoms on macOS.")
                    .evidence(format!("{} → {}", m.python_command, ctx.display_path(&m.python_path)))
                    .evidence(format!("{} → {} (shebang: {})", m.pip_command, ctx.display_path(&m.pip_path), m.pip_interpreter.display()))
                    .affected_command(m.pip_command.clone())
                    .affected_command(m.python_command.clone())
                    .affected_file(m.pip_path.clone(), None, None)
                    .current_state(format!("{} → Python {py_ver}; {} → Python {pip_ver}", m.python_command, m.pip_command))
                    .recommended_action(format!(
                        "Use `{} -m pip install ...` so pip always targets the interpreter you run, or reorder PATH so that the directory of {} comes before {}.",
                        m.python_command,
                        ctx.display_path(m.python_path.parent().unwrap_or(&m.python_path)),
                        ctx.display_path(m.pip_path.parent().unwrap_or(&m.pip_path))
                    ))
                    .metadata(json!(m))
                    .build(),
            );
        }
        Ok(issues)
    }
}
