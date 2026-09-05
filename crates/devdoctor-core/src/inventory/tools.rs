//! Developer tools (AI coding agents, editors, containers) and package managers.
//! Only local installation and configuration files are inspected; nothing is uploaded and
//! credential files are never read.

use crate::context::SystemContext;
use crate::fs_util;
use crate::inventory::{homebrew, node, python};
use crate::path_env::classify_origin;
use crate::resolve::{resolve_command, version_of};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevTool {
    pub id: String,
    pub name: String,
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_method: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_bundle: Option<PathBuf>,
    /// Configuration files/directories that exist.
    pub config_paths: Vec<PathBuf>,
    /// Data directories that exist (caches, extensions, models).
    pub data_paths: Vec<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disk_usage: Option<u64>,
    pub notes: Vec<String>,
}

struct ToolSpec {
    id: &'static str,
    name: &'static str,
    binaries: &'static [&'static str],
    /// macOS application bundles.
    apps: &'static [&'static str],
    /// Windows executables; `%VAR%` references are expanded from the environment.
    win_apps: &'static [&'static str],
    configs: &'static [&'static str],
    data: &'static [&'static str],
}

const TOOLS: &[ToolSpec] = &[
    ToolSpec {
        id: "claude-code",
        name: "Claude Code",
        binaries: &["claude"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.claude.json", "~/.claude/settings.json", "~/.claude/CLAUDE.md"],
        data: &["~/.claude"],
    },
    ToolSpec {
        id: "codex",
        name: "OpenAI Codex CLI",
        binaries: &["codex"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.codex/config.toml", "~/.codex/config.json"],
        data: &["~/.codex"],
    },
    ToolSpec {
        id: "gemini-cli",
        name: "Gemini CLI",
        binaries: &["gemini"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.gemini/settings.json"],
        data: &["~/.gemini"],
    },
    ToolSpec {
        id: "opencode",
        name: "OpenCode",
        binaries: &["opencode"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.config/opencode"],
        data: &["~/.local/share/opencode", "~/.opencode"],
    },
    ToolSpec {
        id: "aider",
        name: "Aider",
        binaries: &["aider"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.aider.conf.yml"],
        data: &["~/.aider"],
    },
    ToolSpec {
        id: "ollama",
        name: "Ollama",
        binaries: &["ollama"],
        apps: &["/Applications/Ollama.app"],
        win_apps: &["%LOCALAPPDATA%\\Programs\\Ollama\\ollama app.exe", "%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe"],
        configs: &[],
        data: &["~/.ollama"],
    },
    ToolSpec {
        id: "docker",
        name: "Docker",
        binaries: &["docker"],
        apps: &["/Applications/Docker.app", "/Applications/OrbStack.app"],
        win_apps: &["%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe"],
        configs: &["~/.docker/config.json", "~/.docker/daemon.json"],
        data: &["~/Library/Containers/com.docker.docker", "~/.orbstack"],
    },
    ToolSpec {
        id: "vscode",
        name: "Visual Studio Code",
        binaries: &["code"],
        apps: &["/Applications/Visual Studio Code.app"],
        win_apps: &["%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe", "%ProgramFiles%\\Microsoft VS Code\\Code.exe"],
        configs: &["~/Library/Application Support/Code/User/settings.json"],
        data: &["~/.vscode/extensions"],
    },
    ToolSpec {
        id: "cursor",
        name: "Cursor",
        binaries: &["cursor"],
        apps: &["/Applications/Cursor.app"],
        win_apps: &["%LOCALAPPDATA%\\Programs\\cursor\\Cursor.exe"],
        configs: &["~/Library/Application Support/Cursor/User/settings.json"],
        data: &["~/.cursor/extensions"],
    },
    ToolSpec {
        id: "git",
        name: "Git",
        binaries: &["git"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.gitconfig", "~/.config/git/config", "~/.gitignore_global"],
        data: &[],
    },
    ToolSpec {
        id: "gh",
        name: "GitHub CLI",
        binaries: &["gh"],
        apps: &[],
        win_apps: &[],
        configs: &["~/.config/gh/config.yml"],
        data: &["~/.config/gh"],
    },
];

fn expand(p: &str, home: &Path) -> PathBuf {
    fs_util::expand_home(p, home)
}

/// Expands `%VAR%` references from the DevDoctor environment (Windows application paths).
fn expand_percent(raw: &str, ctx: &SystemContext) -> PathBuf {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let var = &after[..end];
                match ctx.env.get(var) {
                    Some(v) => out.push_str(v),
                    None => out.push_str(&format!("%{var}%")),
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    PathBuf::from(out)
}

fn install_method(ctx: &SystemContext, binary: &Path) -> String {
    let real = std::fs::canonicalize(binary).unwrap_or(binary.to_path_buf());
    let origin = classify_origin(&real, &ctx.home, ctx.brew_prefix().as_deref());
    let s = real.to_string_lossy().replace('\\', "/");
    if s.contains("/lib/node_modules/") || s.contains("/.npm-global/") || s.contains("/AppData/Roaming/npm/") {
        return "npm global package".into();
    }
    if s.contains("/scoop/apps/") || s.contains("/scoop/shims/") {
        return "Scoop".into();
    }
    if s.to_ascii_lowercase().contains("/chocolatey/") {
        return "Chocolatey".into();
    }
    if s.contains("/Microsoft/WindowsApps/") {
        return "Microsoft Store / app execution alias".into();
    }
    if s.contains("/AppData/Local/Programs/") || s.contains("/Program Files") {
        return "installer".into();
    }
    if s.contains("/.local/share/uv/tools/") {
        return "uv tool".into();
    }
    if s.contains("/pipx/venvs/") {
        return "pipx".into();
    }
    if s.contains(".app/Contents/") {
        return "application bundle".into();
    }
    if s.contains("/.claude/") {
        return "native installer (~/.local/bin)".into();
    }
    match origin {
        crate::path_env::PathOrigin::Homebrew => "Homebrew".into(),
        crate::path_env::PathOrigin::Cargo => "cargo install".into(),
        crate::path_env::PathOrigin::System => "system".into(),
        crate::path_env::PathOrigin::UserLocalBin => "manual (~/.local/bin)".into(),
        other => other.label().to_string(),
    }
}

pub fn inventory(ctx: &SystemContext, with_sizes: bool) -> Vec<DevTool> {
    let home = &ctx.home;
    TOOLS
        .iter()
        .map(|spec| {
            let binary = spec.binaries.iter().find_map(|b| resolve_command(ctx, b, false).ok().and_then(|r| r.active).map(|e| e.path));
            let app_bundle = if cfg!(windows) {
                spec.win_apps.iter().map(|a| expand_percent(a, ctx)).find(|p| p.exists())
            } else {
                spec.apps.iter().map(PathBuf::from).find(|p| p.exists())
            };
            let config_paths: Vec<PathBuf> = spec.configs.iter().map(|c| expand(c, home)).filter(|p| p.exists()).collect();
            let data_paths: Vec<PathBuf> = spec.data.iter().map(|c| expand(c, home)).filter(|p| p.exists()).collect();
            let installed = binary.is_some() || app_bundle.is_some();
            let version = binary.as_ref().and_then(|b| version_of(ctx, b));
            let install_method =
                binary.as_ref().map(|b| install_method(ctx, b)).or_else(|| app_bundle.as_ref().map(|_| "application bundle".to_string()));
            let disk_usage = if with_sizes && !data_paths.is_empty() {
                Some(data_paths.iter().map(|p| fs_util::dir_size(p).allocated).sum())
            } else {
                None
            };
            let mut notes = Vec::new();
            if !installed && !config_paths.is_empty() {
                notes.push("Configuration is present but the tool is not installed (leftover files).".into());
            }
            DevTool {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                installed,
                version,
                binary,
                install_method,
                app_bundle,
                config_paths,
                data_paths,
                disk_usage,
                notes,
            }
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManager {
    pub id: String,
    pub name: String,
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_count: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_size: Option<u64>,
    pub notes: Vec<String>,
}

fn count_entries(dir: &Path, skip: &[&str]) -> Option<usize> {
    if !dir.is_dir() {
        return None;
    }
    Some(
        fs_util::list_dir(dir)
            .into_iter()
            .filter(|p| {
                let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                !name.starts_with('.') && !skip.contains(&name.as_str())
            })
            .count(),
    )
}

/// Global npm package directory for the active npm (honours `prefix` in ~/.npmrc).
pub fn npm_global_dir(ctx: &SystemContext, npm_binary: &Path) -> Option<PathBuf> {
    if let Some(p) = ctx.env.get("NPM_CONFIG_PREFIX") {
        return Some(node::global_node_modules(Path::new(p)));
    }
    if let Ok(Some(rc)) = fs_util::read_to_string_opt(&ctx.home.join(".npmrc")) {
        for line in rc.lines() {
            if let Some(v) = line.trim().strip_prefix("prefix") {
                let v = v.trim_start_matches([' ', '=']).trim();
                if !v.is_empty() {
                    return Some(node::global_node_modules(&fs_util::expand_home(v, &ctx.home)));
                }
            }
        }
    }
    if cfg!(windows) {
        if let Some(appdata) = ctx.env.get("APPDATA") {
            let roaming = Path::new(appdata).join("npm").join("node_modules");
            if roaming.exists() {
                return Some(roaming);
            }
        }
    }
    node::npm_owner_prefix(npm_binary).map(|p| node::global_node_modules(&p))
}

pub fn package_managers(ctx: &SystemContext, with_sizes: bool) -> Vec<PackageManager> {
    let home = &ctx.home;
    let size = |p: &Path| if with_sizes && p.exists() { Some(fs_util::dir_size(p).allocated) } else { None };
    let mut out = Vec::new();

    let brew = homebrew::inventory(ctx, homebrew::HomebrewOptions { with_version: true, with_cache_size: false, with_doctor: false });
    if cfg!(windows) {
        out.extend(windows_package_managers(ctx, with_sizes));
    }
    out.push(PackageManager {
        id: "homebrew".into(),
        name: "Homebrew".into(),
        installed: brew.installed,
        version: brew.version.clone(),
        binary: brew.brew_binary.clone(),
        location: brew.prefix.clone(),
        package_count: if brew.installed { Some(brew.formulae.len() + brew.casks.len()) } else { None },
        cache_path: Some(brew.cache_dir.clone()),
        cache_size: size(&brew.cache_dir),
        notes: vec![format!("{} formulae, {} casks", brew.formulae.len(), brew.casks.len())],
    });

    let npm = resolve_command(ctx, "npm", true).ok().and_then(|r| r.active);
    let npm_dir = npm.as_ref().and_then(|e| npm_global_dir(ctx, &e.path));
    let npm_cache = super::storage::npm_cache_dir(ctx);
    out.push(PackageManager {
        id: "npm".into(),
        name: "npm".into(),
        installed: npm.is_some(),
        version: npm.as_ref().and_then(|e| e.version.clone()),
        binary: npm.as_ref().map(|e| e.path.clone()),
        package_count: npm_dir.as_ref().and_then(|d| count_entries(d, &["npm", "corepack"])),
        location: npm_dir,
        cache_path: Some(npm_cache.clone()),
        cache_size: size(&npm_cache),
        notes: Vec::new(),
    });

    let pnpm = resolve_command(ctx, "pnpm", true).ok().and_then(|r| r.active);
    let pnpm_home = ctx
        .shell_capture()
        .vars
        .get("PNPM_HOME")
        .map(PathBuf::from)
        .or_else(|| crate::sys::local_app_data().map(|l| l.join("pnpm")))
        .unwrap_or_else(|| home.join("Library/pnpm"));
    let pnpm_store =
        [pnpm_home.join("store"), home.join("Library/pnpm/store"), home.join(".local/share/pnpm/store"), home.join(".pnpm-store")]
            .into_iter()
            .find(|p| p.exists());
    out.push(PackageManager {
        id: "pnpm".into(),
        name: "pnpm".into(),
        installed: pnpm.is_some(),
        version: pnpm.as_ref().and_then(|e| e.version.clone()),
        binary: pnpm.as_ref().map(|e| e.path.clone()),
        package_count: count_entries(&pnpm_home.join("global/5/node_modules"), &[]),
        location: if pnpm_home.exists() { Some(pnpm_home.clone()) } else { None },
        cache_size: pnpm_store.as_deref().and_then(size),
        cache_path: pnpm_store,
        notes: Vec::new(),
    });

    let yarn = resolve_command(ctx, "yarn", true).ok().and_then(|r| r.active);
    let yarn_cache = [
        home.join("Library/Caches/Yarn"),
        crate::sys::local_app_data().map(|l| l.join("Yarn").join("Cache")).unwrap_or_else(|| home.join(".cache/yarn")),
        home.join(".yarn/berry/cache"),
        home.join(".cache/yarn"),
    ]
    .into_iter()
    .find(|p| p.exists());
    out.push(PackageManager {
        id: "yarn".into(),
        name: "Yarn".into(),
        installed: yarn.is_some(),
        version: yarn.as_ref().and_then(|e| e.version.clone()),
        binary: yarn.as_ref().map(|e| e.path.clone()),
        location: None,
        package_count: None,
        cache_size: yarn_cache.as_deref().and_then(size),
        cache_path: yarn_cache,
        notes: Vec::new(),
    });

    let py = python::inventory(ctx);
    let pip = py.pip3.clone().or(py.pip.clone());
    let site_packages = pip.as_ref().and_then(|p| python::pip_interpreter(&p.path)).and_then(|interp| {
        let real = std::fs::canonicalize(&interp).unwrap_or(interp);
        let prefix = real.parent()?.parent()?.to_path_buf();
        fs_util::list_dir(&prefix.join("lib"))
            .into_iter()
            .find(|d| d.file_name().is_some_and(|n| n.to_string_lossy().starts_with("python3")))
            .map(|d| d.join("site-packages"))
    });
    let pip_cache = super::storage::pip_cache_dir(ctx);
    out.push(PackageManager {
        id: "pip".into(),
        name: "pip".into(),
        installed: pip.is_some(),
        version: pip.as_ref().and_then(|e| e.version.clone()),
        binary: pip.as_ref().map(|e| e.path.clone()),
        package_count: site_packages
            .as_ref()
            .map(|sp| fs_util::list_dir(sp).into_iter().filter(|p| p.extension().is_some_and(|e| e == "dist-info")).count()),
        location: site_packages,
        cache_size: size(&pip_cache),
        cache_path: Some(pip_cache),
        notes: Vec::new(),
    });

    let pipx = resolve_command(ctx, "pipx", true).ok().and_then(|r| r.active);
    let pipx_home = ctx.shell_capture().vars.get("PIPX_HOME").map(PathBuf::from).unwrap_or_else(|| {
        if home.join(".local/pipx").exists() {
            home.join(".local/pipx")
        } else {
            home.join(".local/share/pipx")
        }
    });
    out.push(PackageManager {
        id: "pipx".into(),
        name: "pipx".into(),
        installed: pipx.is_some(),
        version: pipx.as_ref().and_then(|e| e.version.clone()),
        binary: pipx.as_ref().map(|e| e.path.clone()),
        package_count: count_entries(&pipx_home.join("venvs"), &[]),
        location: if pipx_home.exists() { Some(pipx_home.clone()) } else { None },
        cache_path: None,
        cache_size: None,
        notes: Vec::new(),
    });

    let uv = resolve_command(ctx, "uv", true).ok().and_then(|r| r.active);
    let uv_cache = super::storage::uv_cache_candidates(ctx).into_iter().find(|p| p.exists());
    let uv_tools = home.join(".local/share/uv/tools");
    out.push(PackageManager {
        id: "uv".into(),
        name: "uv".into(),
        installed: uv.is_some(),
        version: uv.as_ref().and_then(|e| e.version.clone()),
        binary: uv.as_ref().map(|e| e.path.clone()),
        package_count: count_entries(&uv_tools, &[]),
        location: if uv_tools.exists() { Some(uv_tools) } else { None },
        cache_size: uv_cache.as_deref().and_then(size),
        cache_path: uv_cache,
        notes: vec!["Package count is the number of `uv tool` installs.".into()],
    });

    let cargo = resolve_command(ctx, "cargo", true).ok().and_then(|r| r.active);
    let cargo_home = ctx.shell_capture().vars.get("CARGO_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".cargo"));
    let crates =
        fs_util::read_to_string_opt(&cargo_home.join(".crates.toml")).ok().flatten().map(|c| super::rust::parse_crates_toml(&c).len());
    let cargo_cache = cargo_home.join("registry");
    out.push(PackageManager {
        id: "cargo".into(),
        name: "Cargo".into(),
        installed: cargo.is_some(),
        version: cargo.as_ref().and_then(|e| e.version.clone()),
        binary: cargo.as_ref().map(|e| e.path.clone()),
        package_count: crates,
        location: if cargo_home.exists() { Some(cargo_home.clone()) } else { None },
        cache_size: size(&cargo_cache),
        cache_path: Some(cargo_cache),
        notes: vec!["Package count is the number of `cargo install`ed binaries.".into()],
    });

    let gem = resolve_command(ctx, "gem", true).ok().and_then(|r| r.active);
    let gem_dir = fs_util::list_dir(&home.join(".gem/ruby")).into_iter().next().map(|d| d.join("gems"));
    out.push(PackageManager {
        id: "gem".into(),
        name: "RubyGems".into(),
        installed: gem.is_some(),
        version: gem.as_ref().and_then(|e| e.version.clone()),
        binary: gem.as_ref().map(|e| e.path.clone()),
        package_count: gem_dir.as_ref().and_then(|d| count_entries(d, &[])),
        location: gem_dir,
        cache_path: None,
        cache_size: None,
        notes: vec!["Package count covers user-installed gems under ~/.gem only.".into()],
    });

    out
}

/// winget, Scoop and Chocolatey (Windows only; the functions compile everywhere so the
/// inventory stays testable on every OS).
fn windows_package_managers(ctx: &SystemContext, with_sizes: bool) -> Vec<PackageManager> {
    let home = &ctx.home;
    let size = |p: &Path| if with_sizes && p.exists() { Some(fs_util::dir_size(p).allocated) } else { None };
    let mut out = Vec::new();

    let winget = resolve_command(ctx, "winget", true).ok().and_then(|r| r.active);
    out.push(PackageManager {
        id: "winget".into(),
        name: "winget".into(),
        installed: winget.is_some(),
        version: winget.as_ref().and_then(|e| e.version.clone()),
        binary: winget.as_ref().map(|e| e.path.clone()),
        location: None,
        package_count: None,
        cache_path: None,
        cache_size: None,
        notes: vec!["Windows Package Manager (App Installer).".into()],
    });

    let scoop_root = ctx.env.get("SCOOP").map(PathBuf::from).unwrap_or_else(|| home.join("scoop"));
    let scoop = resolve_command(ctx, "scoop", true).ok().and_then(|r| r.active);
    let scoop_cache = scoop_root.join("cache");
    out.push(PackageManager {
        id: "scoop".into(),
        name: "Scoop".into(),
        installed: scoop.is_some() || scoop_root.join("apps").is_dir(),
        version: scoop.as_ref().and_then(|e| e.version.clone()),
        binary: scoop.as_ref().map(|e| e.path.clone()),
        package_count: count_entries(&scoop_root.join("apps"), &["scoop"]),
        location: if scoop_root.exists() { Some(scoop_root.clone()) } else { None },
        cache_size: size(&scoop_cache),
        cache_path: if scoop_cache.exists() { Some(scoop_cache) } else { None },
        notes: Vec::new(),
    });

    let choco_root = ctx
        .env
        .get("ChocolateyInstall")
        .map(PathBuf::from)
        .or_else(|| ctx.env.get("ProgramData").map(|p| PathBuf::from(p).join("chocolatey")))
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData\chocolatey"));
    let choco = resolve_command(ctx, "choco", true).ok().and_then(|r| r.active);
    out.push(PackageManager {
        id: "chocolatey".into(),
        name: "Chocolatey".into(),
        installed: choco.is_some() || choco_root.join("lib").is_dir(),
        version: choco.as_ref().and_then(|e| e.version.clone()),
        binary: choco.as_ref().map(|e| e.path.clone()),
        package_count: count_entries(&choco_root.join("lib"), &["chocolatey"]),
        location: if choco_root.exists() { Some(choco_root.clone()) } else { None },
        cache_path: None,
        cache_size: None,
        notes: Vec::new(),
    });
    out
}
