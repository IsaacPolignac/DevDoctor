//! Cache clearing fixers. Clearing a cache never uninstalls packages.

use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{DirDeletion, FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::inventory::homebrew;
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::units::format_bytes;
use devdoctor_core::{Error, Result};
use std::path::{Path, PathBuf};

pub const HOMEBREW_ID: &str = "cache.clear_homebrew";
pub const NPM_ID: &str = "cache.clear_npm";

fn plan_clear(ctx: &SystemContext, dir: &Path, keep: &[&str]) -> Result<(Vec<DirDeletion>, u64)> {
    if !dir.exists() {
        return Err(Error::FixUnavailable(format!("{} does not exist", ctx.display_path(dir))));
    }
    let mut deletions = Vec::new();
    let mut total = 0u64;
    for entry in fs_util::list_dir(dir) {
        let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if keep.contains(&name.as_str()) {
            continue;
        }
        let size = fs_util::dir_size(&entry);
        total += size.allocated;
        deletions.push(DirDeletion { path: entry, bytes: size.allocated, entries: size.files + size.dirs });
    }
    deletions.sort_by_key(|x| std::cmp::Reverse(x.bytes));
    Ok((deletions, total))
}

fn cache_preview(
    fixer_id: &str,
    issue: &Issue,
    ctx: &SystemContext,
    label: &str,
    dir: &Path,
    keep: &[&str],
    notes: &[&str],
) -> Result<FixPreview> {
    let (deletions, total) = plan_clear(ctx, dir, keep)?;
    let mut preview = FixPreview::new(
        fixer_id,
        issue,
        format!("Clear the {label} ({})", format_bytes(total)),
        format!(
            "Deletes the contents of {}. {label} entries are re-downloaded on demand; installed packages are not affected.",
            ctx.display_path(dir)
        ),
    );
    for d in &deletions {
        preview.operations.push(format!("Delete {} ({})", ctx.display_path(&d.path), format_bytes(d.bytes)));
    }
    if !keep.is_empty() {
        preview.notes.push(format!("Kept: {}", keep.join(", ")));
    }
    preview.directories_deleted = deletions;
    preview.estimated_disk_space_recovered = total;
    preview.risk = RiskLevel::Low;
    preview.reversible = false;
    preview.backup_created = false;
    preview.requires_confirmation = true;
    preview.notes.extend(notes.iter().map(|n| n.to_string()));
    preview.validations.push(format!("{} still exists and is smaller than before.", ctx.display_path(dir)));
    Ok(preview)
}

pub struct ClearHomebrewCacheFixer;

impl Fixer for ClearHomebrewCacheFixer {
    fn id(&self) -> &'static str {
        HOMEBREW_ID
    }

    fn name(&self) -> &'static str {
        "Clear Homebrew cache"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "disk.homebrew.cache"
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        cache_preview(
            HOMEBREW_ID,
            issue,
            ctx,
            "Homebrew cache",
            &homebrew::cache_dir(ctx),
            &["api"],
            &[
                "Clearing the cache does not uninstall any formula or cask.",
                "The `api` folder (formula index) is kept so the next `brew` command stays fast.",
                "Equivalent manual command: brew cleanup -s --prune=all",
            ],
        )
    }

    fn apply(&self, _issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let dir = homebrew::cache_dir(ctx);
        tx.clear_dir(&dir, &["api"])?;
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let dir = homebrew::cache_dir(ctx);
        let mut report = ValidationReport::ok();
        report.check("cache directory exists", dir.exists(), ctx.display_path(&dir));
        report.check(
            "space recovered",
            tx.transaction().disk_space_recovered > 0 || fs_util::list_dir(&dir).len() <= 1,
            format_bytes(tx.transaction().disk_space_recovered),
        );
        Ok(report)
    }
}

pub struct ClearNpmCacheFixer;

fn npm_cache_dir(ctx: &SystemContext) -> PathBuf {
    ctx.home.join(".npm/_cacache")
}

impl Fixer for ClearNpmCacheFixer {
    fn id(&self) -> &'static str {
        NPM_ID
    }

    fn name(&self) -> &'static str {
        "Clear npm cache"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "disk.npm.cache"
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        false
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        cache_preview(
            NPM_ID,
            issue,
            ctx,
            "npm cache",
            &npm_cache_dir(ctx),
            &[],
            &[
                "Clearing the cache does not remove any installed package (global or per project).",
                "npm verifies and rebuilds its cache automatically.",
                "Equivalent manual command: npm cache clean --force",
            ],
        )
    }

    fn apply(&self, _issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        tx.clear_dir(&npm_cache_dir(ctx), &[])?;
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let dir = npm_cache_dir(ctx);
        let mut report = ValidationReport::ok();
        report.check("cache directory exists", dir.exists(), ctx.display_path(&dir));
        report.check(
            "cache emptied",
            fs_util::list_dir(&dir).is_empty(),
            format!("{} recovered", format_bytes(tx.transaction().disk_space_recovered)),
        );
        Ok(report)
    }
}
