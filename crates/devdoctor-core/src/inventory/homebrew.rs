//! Homebrew inventory built from the filesystem (fast) with optional `brew` invocations.

use crate::command::CommandSpec;
use crate::context::SystemContext;
use crate::fs_util::{self, DirSize};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrewFormula {
    pub name: String,
    pub versions: Vec<String>,
    pub linked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrewCask {
    pub name: String,
    pub versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokenLink {
    pub link: PathBuf,
    pub target: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrewDoctorResult {
    pub ok: bool,
    pub warnings: Vec<String>,
    pub duration_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomebrewInventory {
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<PathBuf>,
    /// The prefix Homebrew uses for this CPU architecture.
    pub expected_prefix: PathBuf,
    /// A second Homebrew installation under the other architecture's prefix.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub other_prefix: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brew_binary: Option<PathBuf>,
    pub in_path: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub formulae: Vec<BrewFormula>,
    pub casks: Vec<BrewCask>,
    pub broken_links: Vec<BrokenLink>,
    pub cache_dir: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_size: Option<DirSize>,
    /// Formulae installed in several versions (e.g. `python@3.11` and `python@3.12`).
    pub versioned_duplicates: Vec<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doctor: Option<BrewDoctorResult>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct HomebrewOptions {
    pub with_version: bool,
    pub with_cache_size: bool,
    pub with_doctor: bool,
}

fn list_versions(dir: &Path) -> Vec<(String, Vec<String>)> {
    fs_util::list_dir(dir)
        .into_iter()
        .filter(|p| p.is_dir() && !p.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')))
        .map(|p| {
            let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let versions = fs_util::list_dir(&p)
                .into_iter()
                .filter(|v| v.is_dir())
                .map(|v| v.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default())
                .collect();
            (name, versions)
        })
        .collect()
}

fn broken_links_in(dir: &Path) -> Vec<BrokenLink> {
    let mut out = Vec::new();
    for entry in fs_util::list_dir(dir) {
        if !fs_util::is_symlink(&entry) {
            continue;
        }
        let target = std::fs::read_link(&entry).unwrap_or_default();
        if std::fs::metadata(&entry).is_err() {
            out.push(BrokenLink { link: entry, target });
        }
    }
    out
}

pub fn cache_dir(ctx: &SystemContext) -> PathBuf {
    if let Some(c) = ctx.env.get("HOMEBREW_CACHE") {
        return PathBuf::from(c);
    }
    ctx.home.join("Library/Caches/Homebrew")
}

pub fn inventory(ctx: &SystemContext, opts: HomebrewOptions) -> HomebrewInventory {
    let expected_prefix = if ctx.os.arch == "arm64" { PathBuf::from("/opt/homebrew") } else { PathBuf::from("/usr/local") };
    let prefix = ctx.brew_prefix();
    let other_candidate =
        if expected_prefix == Path::new("/opt/homebrew") { PathBuf::from("/usr/local") } else { PathBuf::from("/opt/homebrew") };
    let other_prefix = if other_candidate.join("bin/brew").exists() && prefix.as_deref() != Some(other_candidate.as_path()) {
        Some(other_candidate)
    } else {
        None
    };
    let brew_binary = prefix.as_ref().map(|p| p.join("bin/brew"));
    let in_path = ctx.find_program("brew").is_some() && ctx.effective_path().entries.iter().any(|e| Path::new(e).join("brew").exists());
    let cache = cache_dir(ctx);
    let mut inv = HomebrewInventory {
        installed: prefix.is_some(),
        prefix: prefix.clone(),
        expected_prefix,
        other_prefix,
        brew_binary: brew_binary.clone(),
        in_path,
        version: None,
        formulae: Vec::new(),
        casks: Vec::new(),
        broken_links: Vec::new(),
        cache_dir: cache.clone(),
        cache_size: None,
        versioned_duplicates: Vec::new(),
        doctor: None,
    };
    let Some(prefix) = prefix else { return inv };
    let cellar = ctx.env.get("HOMEBREW_CELLAR").map(PathBuf::from).unwrap_or_else(|| prefix.join("Cellar"));
    inv.formulae = list_versions(&cellar)
        .into_iter()
        .map(|(name, versions)| BrewFormula { linked: prefix.join("opt").join(&name).exists(), name, versions })
        .collect();
    inv.casks = list_versions(&prefix.join("Caskroom")).into_iter().map(|(name, versions)| BrewCask { name, versions }).collect();
    for dir in ["bin", "sbin", "opt"] {
        inv.broken_links.extend(broken_links_in(&prefix.join(dir)));
    }
    // python@3.11 + python@3.12, node + node@20, postgresql@14 + postgresql@16 ...
    let mut by_base: std::collections::BTreeMap<String, Vec<String>> = std::collections::BTreeMap::new();
    for f in &inv.formulae {
        let base = f.name.split('@').next().unwrap_or(&f.name).to_string();
        by_base.entry(base).or_default().push(f.name.clone());
    }
    inv.versioned_duplicates = by_base.into_values().filter(|v| v.len() > 1).collect();
    if opts.with_cache_size {
        inv.cache_size = Some(fs_util::dir_size(&cache));
    }
    if let Some(bin) = &brew_binary {
        if opts.with_version {
            let spec = CommandSpec::new(bin.to_string_lossy().into_owned())
                .arg("--version")
                .env("HOMEBREW_NO_AUTO_UPDATE", "1")
                .env("HOMEBREW_NO_ANALYTICS", "1")
                .timeout_ms(8_000);
            if let Ok(out) = ctx.run(&spec) {
                inv.version = out.stdout.lines().next().map(|l| l.trim().to_string());
            }
        }
        if opts.with_doctor {
            inv.doctor = Some(run_doctor(ctx, bin));
        }
    }
    inv
}

pub fn run_doctor(ctx: &SystemContext, brew: &Path) -> BrewDoctorResult {
    let spec = CommandSpec::new(brew.to_string_lossy().into_owned())
        .arg("doctor")
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_ANALYTICS", "1")
        .env("HOMEBREW_NO_COLOR", "1")
        .env("PATH", ctx.effective_path().raw.clone())
        .timeout_ms(90_000);
    match ctx.run(&spec) {
        Ok(out) if !out.timed_out => {
            let text = format!("{}\n{}", out.stdout, out.stderr);
            let warnings = parse_doctor_output(&text);
            BrewDoctorResult { ok: warnings.is_empty() && out.exit_code == Some(0), warnings, duration_ms: out.duration_ms, error: None }
        }
        Ok(out) => {
            BrewDoctorResult { ok: false, warnings: Vec::new(), duration_ms: out.duration_ms, error: Some("brew doctor timed out".into()) }
        }
        Err(e) => BrewDoctorResult { ok: false, warnings: Vec::new(), duration_ms: 0, error: Some(e.to_string()) },
    }
}

/// Splits `brew doctor` output into individual warnings.
pub fn parse_doctor_output(text: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    let mut current: Option<String> = None;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("Warning: ") {
            if let Some(w) = current.take() {
                warnings.push(w.trim().to_string());
            }
            current = Some(rest.to_string());
        } else if let Some(w) = current.as_mut() {
            if line.trim().is_empty() {
                warnings.push(w.trim().to_string());
                current = None;
            } else {
                w.push('\n');
                w.push_str(line);
            }
        }
    }
    if let Some(w) = current.take() {
        warnings.push(w.trim().to_string());
    }
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_doctor_warnings() {
        let text = "Please note that these warnings are just used to help the Homebrew maintainers\n\nWarning: Some installed formulae are deprecated or disabled.\nYou should find replacements for the following formulae:\n  openssl@1.1\n\nWarning: Unbrewed dylibs were found in /usr/local/lib.\n";
        let w = parse_doctor_output(text);
        assert_eq!(w.len(), 2);
        assert!(w[0].starts_with("Some installed formulae"));
        assert!(w[0].contains("openssl@1.1"));
    }

    #[test]
    fn ready_to_brew_has_no_warnings() {
        assert!(parse_doctor_output("Your system is ready to brew.\n").is_empty());
    }
}
