//! Node.js installations and the node/npm pairing.

use crate::context::SystemContext;
use crate::fs_util;
use crate::resolve::{resolve_command, version_of, Executable};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeSource {
    Homebrew,
    Nvm,
    Fnm,
    Volta,
    Asdf,
    Mise,
    /// Installed by the official pkg into /usr/local.
    PkgInstaller,
    System,
    Other,
}

impl NodeSource {
    pub fn label(&self) -> &'static str {
        match self {
            NodeSource::Homebrew => "Homebrew",
            NodeSource::Nvm => "nvm",
            NodeSource::Fnm => "fnm",
            NodeSource::Volta => "Volta",
            NodeSource::Asdf => "asdf",
            NodeSource::Mise => "mise",
            NodeSource::PkgInstaller => "nodejs.org installer",
            NodeSource::System => "system",
            NodeSource::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInstallation {
    pub source: NodeSource,
    pub label: String,
    pub binary: PathBuf,
    pub prefix: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NpmMismatch {
    pub node_prefix: PathBuf,
    pub npm_prefix: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub npm_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub npm_owner_node_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInventory {
    pub installations: Vec<NodeInstallation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_node: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_npm: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_node_prefix: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_npm_prefix: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub npm_mismatch: Option<NpmMismatch>,
    /// Version managers whose directories exist.
    pub managers: Vec<String>,
    pub notes: Vec<String>,
}

fn version_from_dir_name(name: &str) -> Option<String> {
    let v = name.trim_start_matches('v');
    if v.chars().next().is_some_and(|c| c.is_ascii_digit()) && v.contains('.') {
        Some(v.to_string())
    } else {
        None
    }
}

fn push_install(list: &mut Vec<NodeInstallation>, source: NodeSource, binary: PathBuf, version: Option<String>) {
    if !fs_util::is_executable_file(&binary) {
        return;
    }
    let real = std::fs::canonicalize(&binary).unwrap_or(binary.clone());
    if list.iter().any(|i| std::fs::canonicalize(&i.binary).map(|r| r == real).unwrap_or(false)) {
        return;
    }
    let prefix = real.parent().and_then(Path::parent).map(Path::to_path_buf).unwrap_or_default();
    list.push(NodeInstallation { label: source.label().to_string(), source, binary, prefix, version, active: false });
}

/// Prefix (directory containing `bin/` and `lib/`) of the node that owns an npm executable.
pub fn npm_owner_prefix(npm: &Path) -> Option<PathBuf> {
    let real = std::fs::canonicalize(npm).ok()?;
    // .../lib/node_modules/npm/bin/npm-cli.js
    let mut cur = real.as_path();
    while let Some(parent) = cur.parent() {
        if parent.ends_with("lib/node_modules") {
            return parent.parent().and_then(Path::parent).map(Path::to_path_buf);
        }
        cur = parent;
    }
    // A plain script in <prefix>/bin.
    real.parent().and_then(Path::parent).map(Path::to_path_buf)
}

pub fn inventory(ctx: &SystemContext) -> NodeInventory {
    let home = &ctx.home;
    let mut installs: Vec<NodeInstallation> = Vec::new();
    let mut managers = Vec::new();

    if let Some(prefix) = ctx.brew_prefix() {
        for entry in fs_util::list_dir(&prefix.join("Cellar")) {
            let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if name == "node" || name.starts_with("node@") {
                for ver in fs_util::list_dir(&entry) {
                    let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                    push_install(&mut installs, NodeSource::Homebrew, ver.join("bin/node"), version_from_dir_name(&vname));
                }
            }
        }
    }
    let nvm_dir = ctx.shell_capture().vars.get("NVM_DIR").map(PathBuf::from).unwrap_or_else(|| home.join(".nvm"));
    if nvm_dir.join("nvm.sh").exists() {
        managers.push("nvm".to_string());
        for ver in fs_util::list_dir(&nvm_dir.join("versions/node")) {
            let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            push_install(&mut installs, NodeSource::Nvm, ver.join("bin/node"), version_from_dir_name(&vname));
        }
    }
    for fnm_root in [home.join("Library/Application Support/fnm"), home.join(".fnm"), home.join(".local/share/fnm")] {
        if fnm_root.exists() {
            managers.push("fnm".to_string());
            for ver in fs_util::list_dir(&fnm_root.join("node-versions")) {
                let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                push_install(&mut installs, NodeSource::Fnm, ver.join("installation/bin/node"), version_from_dir_name(&vname));
            }
            break;
        }
    }
    let volta = ctx.shell_capture().vars.get("VOLTA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".volta"));
    if volta.exists() {
        managers.push("volta".to_string());
        for ver in fs_util::list_dir(&volta.join("tools/image/node")) {
            let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            push_install(&mut installs, NodeSource::Volta, ver.join("bin/node"), version_from_dir_name(&vname));
        }
    }
    let asdf = ctx.shell_capture().vars.get("ASDF_DATA_DIR").map(PathBuf::from).unwrap_or_else(|| home.join(".asdf"));
    if asdf.exists() {
        managers.push("asdf".to_string());
        for ver in fs_util::list_dir(&asdf.join("installs/nodejs")) {
            let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            push_install(&mut installs, NodeSource::Asdf, ver.join("bin/node"), version_from_dir_name(&vname));
        }
    }
    let mise = ctx.shell_capture().vars.get("MISE_DATA_DIR").map(PathBuf::from).unwrap_or_else(|| home.join(".local/share/mise"));
    if mise.exists() {
        managers.push("mise".to_string());
        for ver in fs_util::list_dir(&mise.join("installs/node")) {
            let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            push_install(&mut installs, NodeSource::Mise, ver.join("bin/node"), version_from_dir_name(&vname));
        }
    }
    // Official installer: /usr/local/bin/node as a real file (not a Homebrew symlink).
    let usr_local = PathBuf::from("/usr/local/bin/node");
    if usr_local.exists() && !fs_util::is_symlink(&usr_local) {
        push_install(&mut installs, NodeSource::PkgInstaller, usr_local, None);
    }
    // Anything else reachable from PATH.
    let resolution = resolve_command(ctx, "node", true).ok();
    if let Some(r) = &resolution {
        for exe in r.active.iter().chain(r.others.iter()) {
            push_install(
                &mut installs,
                NodeSource::Other,
                exe.path.clone(),
                exe.version.clone().map(|v| v.trim_start_matches('v').to_string()),
            );
        }
    }
    let active_node = resolution.as_ref().and_then(|r| r.active.clone());
    let active_real = active_node.as_ref().and_then(|e| std::fs::canonicalize(&e.path).ok());
    for inst in &mut installs {
        if let (Some(a), Ok(r)) = (&active_real, std::fs::canonicalize(&inst.binary)) {
            inst.active = &r == a;
        }
        if inst.version.is_none() && inst.active {
            inst.version = version_of(ctx, &inst.binary).map(|v| v.trim_start_matches('v').to_string());
        }
    }
    let npm_resolution = resolve_command(ctx, "npm", true).ok();
    let active_npm = npm_resolution.as_ref().and_then(|r| r.active.clone());
    let active_node_prefix = active_real.as_ref().and_then(|r| r.parent().and_then(Path::parent).map(Path::to_path_buf));
    let active_npm_prefix = active_npm.as_ref().and_then(|e| npm_owner_prefix(&e.path));
    let mut notes = Vec::new();
    let npm_mismatch = match (&active_node_prefix, &active_npm_prefix) {
        (Some(np), Some(mp)) if np != mp => {
            let owner_version =
                installs.iter().find(|i| std::fs::canonicalize(&i.prefix).ok().as_ref() == Some(mp)).and_then(|i| i.version.clone());
            Some(NpmMismatch {
                node_prefix: np.clone(),
                npm_prefix: mp.clone(),
                node_version: active_node.as_ref().and_then(|e| e.version.clone()),
                npm_version: active_npm.as_ref().and_then(|e| e.version.clone()),
                npm_owner_node_version: owner_version,
            })
        }
        _ => None,
    };
    if installs.is_empty() {
        notes.push("No Node.js installation found.".to_string());
    }
    installs.sort_by(|a, b| b.active.cmp(&a.active).then(a.label.cmp(&b.label)).then(b.version.cmp(&a.version)));
    NodeInventory { installations: installs, active_node, active_npm, active_node_prefix, active_npm_prefix, npm_mismatch, managers, notes }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_version_dirs() {
        assert_eq!(version_from_dir_name("v22.4.1").as_deref(), Some("22.4.1"));
        assert_eq!(version_from_dir_name("20.18.0").as_deref(), Some("20.18.0"));
        assert_eq!(version_from_dir_name("latest"), None);
    }

    #[test]
    fn finds_npm_owner_prefix() {
        let dir = tempfile::tempdir().unwrap();
        let prefix = dir.path().join("node-22");
        let cli = prefix.join("lib/node_modules/npm/bin/npm-cli.js");
        std::fs::create_dir_all(cli.parent().unwrap()).unwrap();
        std::fs::write(&cli, "#!/usr/bin/env node\n").unwrap();
        std::fs::create_dir_all(prefix.join("bin")).unwrap();
        std::os::unix::fs::symlink("../lib/node_modules/npm/bin/npm-cli.js", prefix.join("bin/npm")).unwrap();
        let owner = npm_owner_prefix(&prefix.join("bin/npm")).unwrap();
        assert_eq!(owner, std::fs::canonicalize(&prefix).unwrap());
    }
}
