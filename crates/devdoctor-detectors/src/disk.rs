//! Developer storage detectors (run in Storage/Deep scans).

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::fs_util;
use devdoctor_core::inventory::{homebrew, ollama};
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::units::{format_age_secs, format_bytes};
use devdoctor_core::Result;
use serde_json::json;
use std::path::{Path, PathBuf};

pub const HOMEBREW_ID: &str = "disk.homebrew.cache";
pub const NPM_ID: &str = "disk.npm.cache";
pub const PIP_ID: &str = "disk.pip.cache";
pub const OLLAMA_ID: &str = "disk.ollama.models";
pub const UV_ID: &str = "disk.uv.cache";
pub const VENV_BROKEN_ID: &str = "disk.venv.broken";
pub const NODE_MODULES_STALE_ID: &str = "disk.node_modules.stale";

const NOTICE_BYTES: u64 = 500_000_000;
const LOW_BYTES: u64 = 2_000_000_000;
const MEDIUM_BYTES: u64 = 10_000_000_000;

fn severity_for(bytes: u64) -> Option<Severity> {
    if bytes >= MEDIUM_BYTES {
        Some(Severity::Medium)
    } else if bytes >= LOW_BYTES {
        Some(Severity::Low)
    } else if bytes >= NOTICE_BYTES {
        Some(Severity::Info)
    } else {
        None
    }
}

fn cache_issue(
    ctx: &SystemContext,
    id: &'static str,
    label: &str,
    path: &Path,
    fixer: Option<&str>,
    manual_command: &str,
    note: &str,
) -> Option<Issue> {
    if !path.exists() {
        return None;
    }
    let size = fs_util::dir_size(path);
    let severity = severity_for(size.allocated)?;
    let mut b = IssueBuilder::new(id, Category::Disk, path.display().to_string(), format!("{label} uses {}", format_bytes(size.allocated)))
        .severity(severity)
        .confidence(Confidence::Confirmed)
        .description(format!("{} contains {} in {} files. {note}", ctx.display_path(path), format_bytes(size.allocated), size.files))
        .impact("Disk space only. Caches are recreated automatically when needed; clearing one never uninstalls a package.")
        .evidence(format!("{} — {} allocated, {} files", ctx.display_path(path), format_bytes(size.allocated), size.files))
        .affected_file(path.to_path_buf(), None, None)
        .current_state(format!("{} in {}", format_bytes(size.allocated), ctx.display_path(path)))
        .recommended_action(format!(
            "Clear the cache{}. Equivalent manual command: `{manual_command}`.",
            if fixer.is_some() { " with DevDoctor (preview shows exactly which directories are removed)" } else { "" }
        ))
        .metadata(json!({ "path": path, "bytes": size.allocated, "files": size.files }));
    if let Some(f) = fixer {
        b = b.fixer(f);
    }
    Some(b.build())
}

pub struct HomebrewCacheDetector;

impl Detector for HomebrewCacheDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: HOMEBREW_ID,
            name: "Homebrew cache size",
            category: Category::Disk,
            description: "Size of the Homebrew download cache.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let path = homebrew::cache_dir(ctx);
        Ok(cache_issue(
            ctx,
            HOMEBREW_ID,
            "Homebrew cache",
            &path,
            Some("cache.clear_homebrew"),
            "brew cleanup -s --prune=all",
            "It holds downloaded bottles and installers that Homebrew keeps after installing.",
        )
        .into_iter()
        .collect())
    }
}

pub struct NpmCacheDetector;

impl Detector for NpmCacheDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: NPM_ID,
            name: "npm cache size",
            category: Category::Disk,
            description: "Size of npm's content-addressed cache.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let path = ctx.home.join(".npm/_cacache");
        Ok(cache_issue(
            ctx,
            NPM_ID,
            "npm cache",
            &path,
            Some("cache.clear_npm"),
            "npm cache clean --force",
            "npm keeps every package tarball it ever downloaded.",
        )
        .into_iter()
        .collect())
    }
}

pub struct PipCacheDetector;

impl Detector for PipCacheDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: PIP_ID,
            name: "pip cache size",
            category: Category::Disk,
            description: "Size of pip's wheel/HTTP cache.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let path: PathBuf = [ctx.home.join("Library/Caches/pip"), ctx.home.join(".cache/pip")]
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or_else(|| ctx.home.join("Library/Caches/pip"));
        Ok(cache_issue(
            ctx,
            PIP_ID,
            "pip cache",
            &path,
            Some("cache.clear_pip"),
            "pip cache purge",
            "pip keeps downloaded wheels and built packages.",
        )
        .into_iter()
        .collect())
    }
}

pub struct OllamaModelsDetector;

impl Detector for OllamaModelsDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: OLLAMA_ID,
            name: "Ollama models",
            category: Category::AiTools,
            description: "Disk used by Ollama models, including models not used for a long time.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = ollama::inventory(ctx);
        let mut issues = Vec::new();
        if inv.models.is_empty() {
            return Ok(issues);
        }
        const STALE_SECS: u64 = 60 * 86_400;
        let stale: Vec<_> = inv.models.iter().filter(|m| m.modified_secs_ago.is_some_and(|s| s > STALE_SECS)).collect();
        let stale_bytes: u64 = stale.iter().map(|m| m.size).sum();
        if let Some(severity) = severity_for(inv.total_bytes) {
            let mut b = IssueBuilder::new(OLLAMA_ID, Category::AiTools, "total", format!("Ollama models use {} ({} models)", format_bytes(inv.total_bytes), inv.models.len()))
                .severity(if stale_bytes >= LOW_BYTES { severity } else { Severity::Info })
                .confidence(Confidence::Confirmed)
                .description(format!("{} models are stored in {}. {} of them ({}) have not been modified for more than 60 days.", inv.models.len(), ctx.display_path(&inv.models_dir), stale.len(), format_bytes(stale_bytes)))
                .impact("Disk space. Models can be pulled again with `ollama pull <model>`.")
                .recommended_action("Review the models on the Local AI page and remove the ones you no longer use (`ollama rm <model>`).")
                .metadata(json!({ "models_dir": inv.models_dir, "total_bytes": inv.total_bytes, "models": inv.models.iter().map(|m| json!({ "name": m.name, "size": m.size, "modified_secs_ago": m.modified_secs_ago })).collect::<Vec<_>>() }));
            for m in inv.models.iter().take(12) {
                b = b.evidence(format!(
                    "{} — {}{}",
                    m.name,
                    format_bytes(m.size),
                    m.modified_secs_ago.map(|s| format!(", modified {}", format_age_secs(s))).unwrap_or_default()
                ));
            }
            issues.push(b.build());
        }
        if inv.orphan_blob_bytes >= NOTICE_BYTES {
            issues.push(
                IssueBuilder::new(OLLAMA_ID, Category::AiTools, "orphan_blobs", format!("Ollama has {} of blobs not used by any model", format_bytes(inv.orphan_blob_bytes)))
                    .severity(Severity::Low)
                    .confidence(Confidence::Likely)
                    .description(format!("{} blob files in {} are not referenced by any model manifest, typically left by interrupted downloads.", inv.orphan_blobs, ctx.display_path(&inv.models_dir.join("blobs"))))
                    .impact("Disk space only.")
                    .recommended_action("Run `ollama rm` on a model and re-pull it, or stop Ollama and delete the unreferenced blobs manually. Recent Ollama versions prune orphans on startup.")
                    .metadata(json!({ "orphan_blob_bytes": inv.orphan_blob_bytes, "orphan_blobs": inv.orphan_blobs }))
                    .build(),
            );
        }
        Ok(issues)
    }
}

pub struct UvCacheDetector;

impl Detector for UvCacheDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: UV_ID,
            name: "uv cache size",
            category: Category::Disk,
            description: "Size of uv's package and build cache.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let path: PathBuf = [ctx.home.join("Library/Caches/uv"), ctx.home.join(".cache/uv")]
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or_else(|| ctx.home.join(".cache/uv"));
        Ok(cache_issue(
            ctx,
            UV_ID,
            "uv cache",
            &path,
            Some("cache.clear_uv"),
            "uv cache clean",
            "uv keeps downloaded wheels, built packages and Python source distributions.",
        )
        .into_iter()
        .collect())
    }
}

pub struct BrokenVenvDetector;

impl Detector for BrokenVenvDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: VENV_BROKEN_ID,
            name: "Broken virtual environments",
            category: Category::Disk,
            description: "Python virtualenvs whose interpreter no longer exists (Python was upgraded or removed).",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let report = ctx.storage_report(&mut |_| {});
        let mut issues = Vec::new();
        for v in report.venvs.iter().filter(|v| v.broken) {
            issues.push(
                IssueBuilder::new(VENV_BROKEN_ID, Category::Disk, v.path.display().to_string(), format!("Broken virtual environment in {}", ctx.display_path(&v.project_path)))
                    .severity(Severity::Low)
                    .confidence(Confidence::Confirmed)
                    .description(format!(
                        "{} was created with {}, which no longer exists. Every command in this environment fails with 'bad interpreter' or 'No such file or directory'.",
                        ctx.display_path(&v.path),
                        v.interpreter.as_ref().map(|i| i.display().to_string()).unwrap_or_else(|| "a Python that is gone".into())
                    ))
                    .impact(format!("The environment cannot be used or repaired in place; it only takes {}.", format_bytes(v.bytes)))
                    .evidence(format!("pyvenv.cfg points to a missing interpreter{}", v.python_version.as_ref().map(|p| format!(" (Python {p})")).unwrap_or_default()))
                    .affected_file(v.path.join("pyvenv.cfg"), None, None)
                    .recommended_action(format!("Delete the environment and recreate it from the project: `cd {} && python3 -m venv {}` (or `uv venv`), then reinstall dependencies.", ctx.display_path(&v.project_path), v.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()))
                    .fixer("storage.delete_venv")
                    .metadata(json!({ "path": v.path, "project_path": v.project_path, "bytes": v.bytes, "python_version": v.python_version, "broken": true }))
                    .build(),
            );
        }
        Ok(issues)
    }
}

pub struct StaleNodeModulesDetector;

impl Detector for StaleNodeModulesDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: NODE_MODULES_STALE_ID,
            name: "node_modules of inactive projects",
            category: Category::Disk,
            description: "Large node_modules folders in projects untouched for six months or more.",
            modes: &[ScanMode::Storage],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        const STALE_SECS: u64 = 180 * 86_400;
        let report = ctx.storage_report(&mut |_| {});
        let mut issues = Vec::new();
        for nm in report.node_modules.iter().filter(|n| n.bytes >= NOTICE_BYTES && n.last_activity_secs_ago.is_some_and(|s| s > STALE_SECS))
        {
            let age = nm.last_activity_secs_ago.map(format_age_secs).unwrap_or_default();
            issues.push(
                IssueBuilder::new(NODE_MODULES_STALE_ID, Category::Disk, nm.path.display().to_string(), format!("{} of node_modules in {} (last activity {age})", format_bytes(nm.bytes), nm.project_name))
                    .severity(if nm.bytes >= LOW_BYTES { Severity::Low } else { Severity::Info })
                    .confidence(Confidence::Likely)
                    .description(format!("{} contains {} in {} files, and the project has not been touched since {age}.", ctx.display_path(&nm.path), format_bytes(nm.bytes), nm.files))
                    .impact(format!("Disk space only. Dependencies come back with `{}` whenever you work on the project again.", nm.recreate_command))
                    .evidence(format!("project: {}", ctx.display_path(&nm.project_path)))
                    .evidence(format!("newest file activity outside node_modules: {age}"))
                    .affected_file(nm.path.clone(), None, None)
                    .recommended_action(format!("Delete {} if you are done with the project for now; run `{}` to restore it later.", ctx.display_path(&nm.path), nm.recreate_command))
                    .fixer("storage.delete_node_modules")
                    .metadata(json!({ "path": nm.path, "project_path": nm.project_path, "recreate_command": nm.recreate_command, "bytes": nm.bytes, "last_activity_secs_ago": nm.last_activity_secs_ago }))
                    .build(),
            );
        }
        Ok(issues)
    }
}
