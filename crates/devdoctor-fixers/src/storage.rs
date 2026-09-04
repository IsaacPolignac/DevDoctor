//! Delete a project's node_modules directory (never the project itself).

use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{DirDeletion, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::units::format_bytes;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const ID: &str = "storage.delete_node_modules";
pub const VENV_ID: &str = "storage.delete_venv";

pub struct DeleteNodeModulesFixer;

fn target(issue: &Issue) -> Result<PathBuf> {
    let p = issue
        .metadata
        .get("path")
        .and_then(|p| p.as_str())
        .map(PathBuf::from)
        .ok_or_else(|| Error::FixUnavailable("no path on issue".into()))?;
    if p.file_name().is_none_or(|n| n != "node_modules") {
        return Err(Error::UnsafePath(format!("{} is not a node_modules directory", p.display())));
    }
    Ok(p)
}

impl Fixer for DeleteNodeModulesFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Delete node_modules"
    }

    fn supports(&self, issue: &Issue) -> bool {
        matches!(issue.detector_id.as_str(), "storage.node_modules" | "disk.node_modules.stale") && issue.metadata.get("path").is_some()
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let path = target(issue)?;
        if !path.is_dir() {
            return Err(Error::FixUnavailable(format!("{} no longer exists", ctx.display_path(&path))));
        }
        let size = fs_util::dir_size(&path);
        let project = path.parent().map(|p| ctx.display_path(p)).unwrap_or_default();
        let recreate = issue.metadata.get("recreate_command").and_then(|c| c.as_str()).unwrap_or("npm install");
        let mut preview = FixPreview::new(
            ID,
            issue,
            format!("Delete node_modules of {project} ({})", format_bytes(size.allocated)),
            format!("Deletes {} only. The project's source code, package.json and lock file are untouched; run `{recreate}` in {project} to reinstall dependencies.", ctx.display_path(&path)),
        );
        preview.operations.push(format!("Delete directory {} ({} files)", ctx.display_path(&path), size.files));
        preview.directories_deleted.push(DirDeletion { path: path.clone(), bytes: size.allocated, entries: size.files + size.dirs });
        preview.estimated_disk_space_recovered = size.allocated;
        preview.risk = RiskLevel::Low;
        preview.reversible = false;
        preview.notes.push(format!("Dependencies can be recreated with `{recreate}`."));
        preview.notes.push(
            "Locally patched packages inside node_modules (patch-package without a patches folder, manual edits) would be lost.".into(),
        );
        preview.validations.push("The directory no longer exists and the project directory still does.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, _ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let path = target(issue)?;
        tx.delete_dir(&path)?;
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let path = target(issue)?;
        let mut report = ValidationReport::ok();
        report.check("node_modules removed", !path.exists(), ctx.display_path(&path));
        if let Some(project) = path.parent() {
            report.check("project intact", project.is_dir(), ctx.display_path(project));
        }
        Ok(report)
    }
}

pub struct DeleteVenvFixer;

fn venv_target(issue: &Issue) -> Result<PathBuf> {
    let p = issue
        .metadata
        .get("path")
        .and_then(|p| p.as_str())
        .map(PathBuf::from)
        .ok_or_else(|| Error::FixUnavailable("no path on issue".into()))?;
    if !p.join("pyvenv.cfg").is_file() {
        return Err(Error::UnsafePath(format!("{} is not a Python virtual environment (no pyvenv.cfg)", p.display())));
    }
    Ok(p)
}

impl Fixer for DeleteVenvFixer {
    fn id(&self) -> &'static str {
        VENV_ID
    }

    fn name(&self) -> &'static str {
        "Delete virtual environment"
    }

    fn supports(&self, issue: &Issue) -> bool {
        matches!(issue.detector_id.as_str(), "storage.venv" | "disk.venv.broken") && issue.metadata.get("path").is_some()
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let path = venv_target(issue)?;
        let size = fs_util::dir_size(&path);
        let project = path.parent().map(|p| ctx.display_path(p)).unwrap_or_default();
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let broken = issue.metadata.get("broken").and_then(|b| b.as_bool()).unwrap_or(false);
        let mut preview = FixPreview::new(
            VENV_ID,
            issue,
            format!("Delete virtual environment {} in {project} ({})", name, format_bytes(size.allocated)),
            format!("Deletes {} only. The project's code stays; recreate the environment with `python3 -m venv {name}` or `uv venv` and reinstall dependencies.", ctx.display_path(&path)),
        );
        preview.operations.push(format!("Delete directory {} ({} files)", ctx.display_path(&path), size.files));
        preview.directories_deleted.push(DirDeletion { path: path.clone(), bytes: size.allocated, entries: size.files + size.dirs });
        preview.estimated_disk_space_recovered = size.allocated;
        preview.risk = if broken { RiskLevel::Low } else { RiskLevel::Medium };
        preview.reversible = false;
        if broken {
            preview.notes.push("The environment is already unusable: its Python interpreter is gone.".into());
        } else {
            preview
                .notes
                .push("Packages installed only in this environment are removed; requirements.txt / pyproject.toml are not touched.".into());
        }
        preview.validations.push("The directory no longer exists and the project directory still does.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, _ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let path = venv_target(issue)?;
        tx.delete_dir(&path)?;
        Ok(())
    }

    fn validate(&self, issue: &Issue, ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let path = issue.metadata.get("path").and_then(|p| p.as_str()).map(PathBuf::from).unwrap_or_default();
        let mut report = ValidationReport::ok();
        report.check("environment removed", !path.exists(), ctx.display_path(&path));
        if let Some(project) = path.parent() {
            report.check("project intact", project.is_dir(), ctx.display_path(project));
        }
        Ok(report)
    }
}
