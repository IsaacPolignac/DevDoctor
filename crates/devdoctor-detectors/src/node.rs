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

// ----- npm global prefix and stranded globals -----

use devdoctor_core::inventory::node::NodeSource;
use std::path::{Path, PathBuf};

pub const GLOBAL_PREFIX_ID: &str = "node.npm.global_prefix_not_writable";
pub const STRANDED_ID: &str = "node.npm.stranded_globals";

/// npm's global prefix: `NPM_CONFIG_PREFIX`, then `prefix=` in `~/.npmrc`, then the prefix of
/// the active npm.
fn npm_global_prefix(ctx: &SystemContext, inv: &node::NodeInventory) -> Option<PathBuf> {
    if let Some(p) = ctx.shell_capture().vars.get("NPM_CONFIG_PREFIX") {
        return Some(devdoctor_core::fs_util::expand_home(p, &ctx.home));
    }
    if let Ok(Some(rc)) = devdoctor_core::fs_util::read_to_string_opt(&ctx.home.join(".npmrc")) {
        for line in rc.lines() {
            let line = line.trim();
            if let Some(v) = line.strip_prefix("prefix=").or_else(|| line.strip_prefix("prefix =")) {
                let v = v.trim().trim_matches('"');
                if !v.is_empty() {
                    return Some(devdoctor_core::fs_util::expand_home(v, &ctx.home));
                }
            }
        }
    }
    inv.active_npm_prefix.clone()
}

pub struct NpmGlobalPrefixDetector;

impl Detector for NpmGlobalPrefixDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: GLOBAL_PREFIX_ID,
            name: "npm global install permissions",
            category: Category::Runtimes,
            description: "`npm install -g` writes into a directory you do not own (the classic EACCES error that people fix with sudo).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = node::inventory(ctx);
        let Some(prefix) = npm_global_prefix(ctx, &inv) else { return Ok(Vec::new()) };
        if devdoctor_core::fs_util::starts_with_lexical(&prefix, &ctx.home) {
            return Ok(Vec::new());
        }
        let lib = prefix.join("lib/node_modules");
        let bin = prefix.join("bin");
        let lib_writable = if lib.is_dir() {
            devdoctor_core::fs_util::is_writable(&lib)
        } else {
            prefix.join("lib").is_dir().then(|| devdoctor_core::fs_util::is_writable(&prefix.join("lib"))).flatten()
        };
        let bin_writable = if bin.is_dir() { devdoctor_core::fs_util::is_writable(&bin) } else { None };
        if lib_writable != Some(false) && bin_writable != Some(false) {
            return Ok(Vec::new());
        }
        let npm_path = inv.active_npm.as_ref().map(|e| ctx.display_path(&e.path)).unwrap_or_else(|| "npm".into());
        let mut b = IssueBuilder::new(GLOBAL_PREFIX_ID, Category::Runtimes, prefix.display().to_string(), format!("`npm install -g` writes into {}, which you cannot write to", prefix.display()))
            .severity(Severity::Medium)
            .confidence(Confidence::Confirmed)
            .description(format!(
                "npm's global prefix is {} (from {npm_path}). Global packages go to {} and their commands to {}, and your user account is not allowed to write there, so `npm install -g <package>` fails with `EACCES: permission denied`.",
                prefix.display(),
                lib.display(),
                bin.display()
            ))
            .impact("Global installs fail, or worse, get fixed with `sudo npm install -g`, which leaves root-owned files in your npm cache and home directory and breaks later installs.")
            .affected_command("npm")
            .recommended_action("Do not use sudo. Either install Node with a version manager that lives in your home folder (fnm, nvm, Volta), or point npm at a folder you own: `npm config set prefix ~/.npm-global`, then add `export PATH=\"$HOME/.npm-global/bin:$PATH\"` to your startup file.")
            .metadata(json!({ "prefix": prefix, "lib": lib, "bin": bin, "lib_writable": lib_writable, "bin_writable": bin_writable }));
        if lib_writable == Some(false) {
            b = b.evidence(format!("{} is not writable by {}", lib.display(), ctx.user));
        }
        if bin_writable == Some(false) {
            b = b.evidence(format!("{} is not writable by {}", bin.display(), ctx.user));
        }
        Ok(vec![b.build()])
    }
}

/// Global npm packages installed under a Node prefix (scoped packages as `@scope/name`).
fn global_packages(prefix: &Path) -> Vec<String> {
    let mut out = Vec::new();
    for entry in devdoctor_core::fs_util::list_dir(&prefix.join("lib/node_modules")) {
        let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if name.starts_with('.') || name == "npm" || name == "corepack" {
            continue;
        }
        if name.starts_with('@') {
            for scoped in devdoctor_core::fs_util::list_dir(&entry) {
                let s = scoped.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                if !s.starts_with('.') {
                    out.push(format!("{name}/{s}"));
                }
            }
        } else {
            out.push(name);
        }
    }
    out.sort();
    out
}

pub struct NpmStrandedGlobalsDetector;

impl Detector for NpmStrandedGlobalsDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: STRANDED_ID,
            name: "Global npm packages left in another Node version",
            category: Category::Runtimes,
            description: "After switching Node versions with nvm, fnm, asdf or mise, global packages (and their commands) stay behind in the old version.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let inv = node::inventory(ctx);
        let Some(active) = inv.installations.iter().find(|i| i.active) else { return Ok(Vec::new()) };
        let managed = |s: NodeSource| matches!(s, NodeSource::Nvm | NodeSource::Fnm | NodeSource::Asdf | NodeSource::Mise);
        if !managed(active.source) {
            return Ok(Vec::new());
        }
        let active_globals = global_packages(&active.prefix);
        let active_version = active.version.clone().unwrap_or_else(|| "the active version".into());
        let mut issues = Vec::new();
        for inst in inv.installations.iter().filter(|i| !i.active && i.source == active.source) {
            let stranded: Vec<String> = global_packages(&inst.prefix).into_iter().filter(|p| !active_globals.contains(p)).collect();
            if stranded.is_empty() {
                continue;
            }
            let version = inst
                .version
                .clone()
                .unwrap_or_else(|| inst.prefix.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
            let shown: Vec<String> = stranded.iter().take(8).cloned().collect();
            let more = stranded.len().saturating_sub(shown.len());
            let reinstall = match inst.source {
                NodeSource::Nvm => {
                    format!("`nvm reinstall-packages {}` (run while {active_version} is active)", version.trim_start_matches('v'))
                }
                _ => format!("`npm install -g {}`", stranded.join(" ")),
            };
            let mut b = IssueBuilder::new(STRANDED_ID, Category::Runtimes, inst.prefix.display().to_string(), format!("{} global npm package{} left behind in Node {version} ({})", stranded.len(), if stranded.len() == 1 { "" } else { "s" }, inst.label))
                .severity(Severity::Low)
                .confidence(Confidence::Confirmed)
                .description(format!(
                    "Global npm packages belong to the Node version they were installed with. {}{} were installed under {} (Node {version}), but the active Node is {active_version}, so their commands are missing from your terminal until they are installed again.",
                    shown.join(", "),
                    if more > 0 { format!(" and {more} more") } else { String::new() },
                    ctx.display_path(&inst.prefix)
                ))
                .impact("`command not found` for tools you installed with npm (CLIs such as claude, pnpm, typescript, vercel...) after a Node upgrade.")
                .evidence(format!("{}/lib/node_modules contains {}", ctx.display_path(&inst.prefix), shown.join(", ")))
                .evidence(format!("active Node: {} at {}", active_version, ctx.display_path(&active.prefix)))
                .recommended_action(format!("Reinstall them for the active version with {reinstall}, or uninstall the old Node version if you no longer need it."))
                .metadata(json!({ "prefix": inst.prefix, "version": version, "source": inst.source, "packages": stranded, "active_version": active_version, "active_prefix": active.prefix }));
            for p in &shown {
                b = b.affected_command(p.rsplit('/').next().unwrap_or(p).to_string());
            }
            issues.push(b.build());
        }
        Ok(issues)
    }
}
