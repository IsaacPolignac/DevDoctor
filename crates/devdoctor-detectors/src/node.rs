//! Node.js detectors: multiple installations and node/npm pairing.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::node;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;
use std::collections::BTreeSet;

pub const MULTIPLE_ID: &str = "node.multiple_installations";
pub const NPM_MISMATCH_ID: &str = "node.npm.mismatch";

pub struct NodeMultipleInstallationsDetector;

impl Detector for NodeMultipleInstallationsDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: MULTIPLE_ID,
            name: "Node.js installations",
            category: Category::Runtimes,
            description: "Node.js installed through several tools (Homebrew, nvm, fnm, Volta, installer...).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = node::inventory(ctx);
        let sources: BTreeSet<&str> = inv.installations.iter().map(|i| i.label.as_str()).collect();
        if sources.len() < 2 {
            return Ok(Vec::new());
        }
        let active = inv.installations.iter().find(|i| i.active);
        let mut b = IssueBuilder::new(MULTIPLE_ID, Category::Runtimes, "sources", format!("Node.js is installed through {} different tools", sources.len()))
            .severity(Severity::Low)
            .confidence(Confidence::Confirmed)
            .description(format!(
                "Node.js installations were found from {}. `node` currently runs {}.",
                sources.iter().copied().collect::<Vec<_>>().join(", "),
                active.map(|a| format!("{} from {}", a.version.clone().map(|v| format!("v{v}")).unwrap_or_else(|| "an unknown version".into()), a.label)).unwrap_or_else(|| "none of them (node is not in PATH)".into())
            ))
            .impact("Global npm packages, `npx` caches and the `npm` binary are tied to one installation. Switching versions with one tool while another tool's node is first in PATH leads to confusing 'command not found' and version errors.")
            .affected_command("node")
            .affected_command("npm")
            .recommended_action("Choose one way to install Node (a version manager such as nvm/fnm/Volta, or Homebrew) and uninstall the others. Then check the Command Resolution page: `node` and `npm` should come from the same directory.");
        for i in &inv.installations {
            b = b.evidence(format!(
                "Node {}{} — {} ({})",
                i.version.clone().map(|v| format!("v{v}")).unwrap_or_else(|| "?".into()),
                if i.active { " [active]" } else { "" },
                ctx.display_path(&i.binary),
                i.label
            ));
        }
        Ok(vec![b.metadata(json!({ "installations": inv.installations, "managers": inv.managers })).build()])
    }
}

pub struct NpmMismatchDetector;

impl Detector for NpmMismatchDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: NPM_MISMATCH_ID,
            name: "npm / node mismatch",
            category: Category::Runtimes,
            description: "`npm` belongs to a different Node installation than `node`.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = node::inventory(ctx);
        let Some(m) = &inv.npm_mismatch else { return Ok(Vec::new()) };
        let node_exe = inv.active_node.as_ref();
        let npm_exe = inv.active_npm.as_ref();
        let issue = IssueBuilder::new(NPM_MISMATCH_ID, Category::Runtimes, "active", "`npm` belongs to a different Node installation than `node`")
            .severity(Severity::High)
            .confidence(Confidence::Confirmed)
            .description(format!(
                "`node` resolves to {} ({}), installed under {}. `npm` resolves to {} and belongs to the Node installation under {}{}.",
                node_exe.map(|e| ctx.display_path(&e.path)).unwrap_or_default(),
                node_exe.and_then(|e| e.version.clone()).unwrap_or_else(|| "version unknown".into()),
                ctx.display_path(&m.node_prefix),
                npm_exe.map(|e| ctx.display_path(&e.path)).unwrap_or_default(),
                ctx.display_path(&m.npm_prefix),
                m.npm_owner_node_version.as_ref().map(|v| format!(" (Node v{v})")).unwrap_or_default()
            ))
            .impact("Global packages get installed into one Node's directory while another Node runs them; native modules compile against the wrong version; `npm` may crash with syntax errors after a Node upgrade.")
            .evidence(format!("node → {}", node_exe.map(|e| e.path.display().to_string()).unwrap_or_default()))
            .evidence(format!("npm → {} (owner prefix {})", npm_exe.map(|e| e.path.display().to_string()).unwrap_or_default(), m.npm_prefix.display()))
            .affected_command("node")
            .affected_command("npm")
            .current_state(format!("node prefix: {}; npm prefix: {}", m.node_prefix.display(), m.npm_prefix.display()))
            .recommended_action(format!(
                "Make sure {}/bin comes before {}/bin in PATH (check the PATH page), or uninstall the Node installation you do not use. With nvm run `nvm use --default <version>`; with Homebrew run `brew unlink node && brew link node`.",
                ctx.display_path(&m.node_prefix),
                ctx.display_path(&m.npm_prefix)
            ))
            .metadata(json!(m))
            .build();
        Ok(vec![issue])
    }
}
