//! AI coding tools: installation health of Claude Code.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::node;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::resolve::resolve_command;
use devdoctor_core::Result;
use serde_json::json;
use std::path::PathBuf;

pub const CLAUDE_DUP_ID: &str = "ai.claude_code.duplicate_install";
const NPM_PACKAGE: &str = "@anthropic-ai/claude-code";

pub struct ClaudeCodeDuplicateInstallDetector;

/// Every `lib/node_modules/@anthropic-ai/claude-code` under known npm global roots.
fn npm_installs(ctx: &SystemContext, inv: &node::NodeInventory) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = inv.installations.iter().map(|i| i.prefix.clone()).collect();
    roots.extend(inv.active_npm_prefix.clone());
    roots.push(ctx.home.join(".npm-global"));
    roots.push(PathBuf::from("/usr/local"));
    roots.push(PathBuf::from("/opt/homebrew"));
    let mut found: Vec<PathBuf> = Vec::new();
    for root in roots {
        let dir = root.join("lib/node_modules").join(NPM_PACKAGE);
        if dir.is_dir() && !found.contains(&dir) {
            found.push(dir);
        }
    }
    found
}

impl Detector for ClaudeCodeDuplicateInstallDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: CLAUDE_DUP_ID,
            name: "Claude Code installed more than once",
            category: Category::AiTools,
            description:
                "Claude Code present both as the native install (~/.local/bin/claude) and as the npm package, or in several Node versions.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let native_bin = ctx.home.join(".local/bin/claude");
        let native = native_bin.exists() || ctx.home.join(".local/share/claude/versions").is_dir();
        let inv = node::inventory(ctx);
        let npm = npm_installs(ctx, &inv);
        if npm.is_empty() || (!native && npm.len() < 2) {
            return Ok(Vec::new());
        }
        let active = resolve_command(ctx, "claude", false).ok().and_then(|r| r.active);
        let runs = active
            .as_ref()
            .map(|a| format!("`claude` currently runs {} ({}).", ctx.display_path(&a.path), a.origin_label))
            .unwrap_or_else(|| "`claude` is not found in the login shell PATH at all.".to_string());
        let npm_list: Vec<String> = npm.iter().map(|p| ctx.display_path(p)).collect();
        let issue = if native {
            IssueBuilder::new(CLAUDE_DUP_ID, Category::AiTools, "native_and_npm", "Claude Code is installed twice: native installer and npm")
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!(
                    "The native Claude Code install exists ({}) and the npm package {NPM_PACKAGE} is installed too ({}). {runs} The two copies update independently and whichever comes first in PATH wins, which is often the older one.",
                    ctx.display_path(&native_bin),
                    npm_list.join(", ")
                ))
                .impact("Confusing version numbers, updates that seem not to apply, and a second copy of a large package on disk.")
                .evidence(format!("{} exists", ctx.display_path(&native_bin)))
                .affected_command("claude")
                .recommended_action(format!(
                    "Keep the native install (it updates itself) and remove the npm copy: `npm uninstall -g {NPM_PACKAGE}`, run with the Node version that installed it. Then open a new terminal and check `which claude` points to ~/.local/bin/claude."
                ))
                .metadata(json!({ "native": native_bin, "npm": npm, "active": active.as_ref().map(|a| a.path.clone()) }))
        } else {
            IssueBuilder::new(CLAUDE_DUP_ID, Category::AiTools, "npm_multiple", format!("Claude Code is installed in {} Node versions", npm.len()))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!("{NPM_PACKAGE} is installed under {}. {runs} Only the copy of the active Node version is reachable; the others are stale duplicates.", npm_list.join(", ")))
                .impact("Which `claude` you get depends on the Node version selected in that terminal, and old copies take disk space.")
                .affected_command("claude")
                .recommended_action(format!("Switch to the native installer (`curl -fsSL https://claude.ai/install.sh | bash`, which does not depend on Node), then `npm uninstall -g {NPM_PACKAGE}` in each Node version."))
                .metadata(json!({ "npm": npm, "active": active.as_ref().map(|a| a.path.clone()) }))
        };
        let mut issue = issue;
        for p in &npm_list {
            issue = issue.evidence(format!("{p} exists"));
        }
        Ok(vec![issue.build()])
    }
}
