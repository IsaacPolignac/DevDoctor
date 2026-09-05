//! Removes broken symbolic links from PATH directories inside the home folder. Only the links
//! are removed (their targets are already gone); rollback recreates them with the same target.

use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::{FixPreview, Fixer, RiskLevel, ValidationReport};
use devdoctor_core::fs_util;
use devdoctor_core::issue::Issue;
use devdoctor_core::transaction::TxBuilder;
use devdoctor_core::{Error, Result};
use std::path::PathBuf;

pub const ID: &str = "shell.path.remove_dangling_symlinks";

pub struct RemoveDanglingSymlinksFixer;

struct Link {
    link: PathBuf,
    target: PathBuf,
}

/// Links recorded on the issue that are still dangling right now.
fn current_links(issue: &Issue, ctx: &SystemContext) -> Result<(Vec<Link>, Vec<String>)> {
    let list = issue
        .metadata
        .get("links")
        .and_then(|l| l.as_array())
        .ok_or_else(|| Error::FixUnavailable("no links recorded on the issue".into()))?;
    let mut links = Vec::new();
    let mut notes = Vec::new();
    for item in list {
        let Some(link) = item.get("link").and_then(|p| p.as_str()).map(PathBuf::from) else { continue };
        if !fs_util::starts_with_lexical(&link, &ctx.home) {
            notes.push(format!("{} is outside your home folder and is left alone", link.display()));
            continue;
        }
        if !fs_util::is_symlink(&link) {
            notes.push(format!("{} is no longer a symbolic link; skipped", ctx.display_path(&link)));
            continue;
        }
        if std::fs::metadata(&link).is_ok() {
            notes.push(format!("{} points to an existing file again; kept", ctx.display_path(&link)));
            continue;
        }
        let target = std::fs::read_link(&link).unwrap_or_default();
        links.push(Link { link, target });
    }
    Ok((links, notes))
}

impl Fixer for RemoveDanglingSymlinksFixer {
    fn id(&self) -> &'static str {
        ID
    }

    fn name(&self) -> &'static str {
        "Remove broken command links"
    }

    fn supports(&self, issue: &Issue) -> bool {
        issue.detector_id == "shell.path.dangling_symlinks" && issue.metadata.get("in_home").and_then(|v| v.as_bool()).unwrap_or(false)
    }

    fn reversible(&self, _issue: &Issue) -> bool {
        true
    }

    fn batch_safe(&self, _issue: &Issue) -> bool {
        true
    }

    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview> {
        let (links, notes) = current_links(issue, ctx)?;
        let dir = issue.metadata.get("dir").and_then(|d| d.as_str()).map(PathBuf::from).unwrap_or_default();
        let title =
            format!("Remove {} broken link{} from {}", links.len(), if links.len() == 1 { "" } else { "s" }, ctx.display_path(&dir));
        let summary = "These links point to programs that were uninstalled. Removing the links makes the shell say `command not found` instead of `no such file or directory`, and stops tools from believing the programs are still installed. Nothing else is touched.".to_string();
        let mut preview = FixPreview::new(ID, issue, title, summary);
        for l in &links {
            preview.operations.push(format!("remove link {} → {}", ctx.display_path(&l.link), ctx.display_path(&l.target)));
            preview.files_deleted.push(l.link.clone());
        }
        preview.notes.extend(notes);
        preview.notes.push("Undo recreates the links with their original targets.".into());
        preview.risk = RiskLevel::Low;
        preview.reversible = true;
        preview.batch_safe = true;
        preview.backup_created = false;
        preview.validations.push("None of the removed links exists any more.".into());
        Ok(preview)
    }

    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()> {
        let (links, _) = current_links(issue, ctx)?;
        for l in &links {
            tx.delete_symlink(&l.link)?;
        }
        Ok(())
    }

    fn validate(&self, _issue: &Issue, ctx: &SystemContext, tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        let mut report = ValidationReport::ok();
        for op in &tx.transaction().operations {
            if let devdoctor_core::transaction::Operation::SymlinkDelete { path, .. } = op {
                let gone = std::fs::symlink_metadata(path).is_err();
                report.check(
                    format!("{} removed", ctx.display_path(path)),
                    gone,
                    if gone { "link no longer exists" } else { "link still present" },
                );
            }
        }
        Ok(report)
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use devdoctor_core::backup::BackupStore;
    use devdoctor_core::command::MockRunner;
    use devdoctor_core::db::Database;
    use devdoctor_core::issue::{Category, IssueBuilder};
    use devdoctor_core::platform::FakePlatform;
    use devdoctor_core::transaction::{MutationPolicy, TransactionManager, TxStatus};
    use serde_json::json;
    use std::sync::Arc;

    #[test]
    fn removes_and_restores_dangling_links() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path();
        let bin = home.join(".local/bin");
        std::fs::create_dir_all(&bin).unwrap();
        let dead = bin.join("oldtool");
        std::os::unix::fs::symlink(home.join("gone/oldtool"), &dead).unwrap();
        let alive_target = bin.join("real");
        std::fs::write(&alive_target, "#!/bin/sh\n").unwrap();
        let alive = bin.join("alias-to-real");
        std::os::unix::fs::symlink(&alive_target, &alive).unwrap();
        let ctx = SystemContext::for_test(home, Arc::new(FakePlatform::new()), Arc::new(MockRunner::new()), "/usr/bin");
        let issue = IssueBuilder::new("shell.path.dangling_symlinks", Category::Shell, bin.display().to_string(), "broken links")
            .metadata(json!({ "dir": bin, "in_home": true, "links": [{ "link": dead, "target": home.join("gone/oldtool") }, { "link": alive, "target": alive_target }] }))
            .build();
        let fixer = RemoveDanglingSymlinksFixer;
        assert!(fixer.supports(&issue));
        let preview = fixer.preview(&issue, &ctx).unwrap();
        assert_eq!(preview.files_deleted, vec![dead.clone()], "only the dangling link is planned: {:?}", preview.notes);
        assert!(fs_util::is_symlink(&dead), "preview must not touch the disk");

        let db = Arc::new(Database::open_in_memory().unwrap());
        let store = BackupStore::new(home.join(".devdoctor/backups"));
        let manager = TransactionManager::new(db, store, MutationPolicy::for_context(&ctx));
        let tx = manager.apply(&fixer, &issue, &ctx).unwrap();
        assert_eq!(tx.status, TxStatus::Applied);
        assert!(tx.reversible());
        assert!(std::fs::symlink_metadata(&dead).is_err());
        assert!(fs_util::is_symlink(&alive), "healthy links are kept");

        let rolled = manager.rollback(&tx.id, false).unwrap();
        assert_eq!(rolled.status, TxStatus::RolledBack);
        assert!(fs_util::is_symlink(&dead));
        assert_eq!(std::fs::read_link(&dead).unwrap(), home.join("gone/oldtool"));
    }
}
