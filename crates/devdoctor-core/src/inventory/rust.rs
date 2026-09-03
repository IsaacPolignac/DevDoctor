//! Rust toolchain inventory: rustup, cargo, toolchains and `cargo install`ed crates.

use crate::context::SystemContext;
use crate::fs_util::{self, DirSize};
use crate::resolve::{resolve_command, Executable};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustToolchain {
    pub name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CargoInstall {
    pub name: String,
    pub version: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustInventory {
    pub rustup_installed: bool,
    pub rustup_home: PathBuf,
    pub cargo_home: PathBuf,
    pub cargo_bin_in_path: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cargo: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rustc: Option<Executable>,
    pub toolchains: Vec<RustToolchain>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_toolchain: Option<String>,
    pub installed_crates: Vec<CargoInstall>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_size: Option<DirSize>,
    pub notes: Vec<String>,
}

/// Parses `$CARGO_HOME/.crates.toml`.
pub fn parse_crates_toml(content: &str) -> Vec<CargoInstall> {
    let mut out = Vec::new();
    let mut in_v1 = false;
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_v1 = line == "[v1]";
            continue;
        }
        if !in_v1 || !line.starts_with('"') {
            continue;
        }
        let Some(end) = line[1..].find('"') else { continue };
        let spec = &line[1..=end];
        let mut parts = spec.splitn(3, ' ');
        let (Some(name), Some(version)) = (parts.next(), parts.next()) else { continue };
        let source = parts.next().unwrap_or("").trim_matches(|c| c == '(' || c == ')').to_string();
        out.push(CargoInstall { name: name.to_string(), version: version.to_string(), source });
    }
    out
}

pub fn inventory(ctx: &SystemContext, with_cache_size: bool) -> RustInventory {
    let vars = &ctx.shell_capture().vars;
    let rustup_home = vars.get("RUSTUP_HOME").map(PathBuf::from).unwrap_or_else(|| ctx.home.join(".rustup"));
    let cargo_home = vars.get("CARGO_HOME").map(PathBuf::from).unwrap_or_else(|| ctx.home.join(".cargo"));
    let cargo_bin = cargo_home.join("bin");
    let cargo_bin_in_path = ctx.effective_path().entries.iter().any(|e| crate::shell::normalize_key(e) == cargo_bin.to_string_lossy());
    let cargo = resolve_command(ctx, "cargo", true).ok().and_then(|r| r.active);
    let rustc = resolve_command(ctx, "rustc", true).ok().and_then(|r| r.active);
    let toolchains: Vec<RustToolchain> = fs_util::list_dir(&rustup_home.join("toolchains"))
        .into_iter()
        .filter(|p| p.is_dir())
        .map(|p| RustToolchain { name: p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), path: p })
        .collect();
    let default_toolchain = fs_util::read_to_string_opt(&rustup_home.join("settings.toml")).ok().flatten().and_then(|s| {
        s.lines().find_map(|l| {
            l.trim().strip_prefix("default_toolchain").map(|r| r.trim_start_matches([' ', '=']).trim_matches('"').to_string())
        })
    });
    let installed_crates =
        fs_util::read_to_string_opt(&cargo_home.join(".crates.toml")).ok().flatten().map(|c| parse_crates_toml(&c)).unwrap_or_default();
    let mut notes = Vec::new();
    let rustup_installed = rustup_home.join("toolchains").exists() || cargo_bin.join("rustup").exists();
    if rustup_installed && !cargo_bin_in_path && cargo.is_some() {
        notes.push(format!("cargo resolves outside {} (rustup's bin directory is not in PATH).", cargo_bin.display()));
    }
    if rustup_installed && !cargo_bin_in_path && cargo.is_none() {
        notes.push(format!("rustup is installed but {} is not in PATH; cargo and rustc are not reachable.", cargo_bin.display()));
    }
    let cache_size = if with_cache_size {
        let mut total = fs_util::dir_size(&cargo_home.join("registry"));
        total.add(fs_util::dir_size(&cargo_home.join("git")));
        Some(total)
    } else {
        None
    };
    RustInventory {
        rustup_installed,
        rustup_home,
        cargo_home,
        cargo_bin_in_path,
        cargo,
        rustc,
        toolchains,
        default_toolchain,
        installed_crates,
        cache_size,
        notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_crates_toml() {
        let content = "[v1]\n\"cargo-edit 0.11.9 (registry+https://github.com/rust-lang/crates.io-index)\" = [\"cargo-add\"]\n\"ripgrep 14.1.0 (registry+https://github.com/rust-lang/crates.io-index)\" = [\"rg\"]\n";
        let c = parse_crates_toml(content);
        assert_eq!(c.len(), 2);
        assert_eq!(c[1].name, "ripgrep");
        assert_eq!(c[1].version, "14.1.0");
    }
}
