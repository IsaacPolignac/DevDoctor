//! Developer storage scanner: known cache/model locations plus dependency and build
//! directories found in likely project folders. Never a generic disk cleaner.

use crate::context::SystemContext;
use crate::fs_util::{self, DirSize};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageKind {
    Cache,
    Models,
    Dependencies,
    Build,
    Data,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageCategory {
    pub id: String,
    pub label: String,
    pub kind: StorageKind,
    pub paths: Vec<PathBuf>,
    pub exists: bool,
    pub bytes: u64,
    pub files: u64,
    /// Whether the content can be recreated automatically (caches, dependencies).
    pub recreatable: bool,
    pub description: String,
    pub scan_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeModulesDir {
    pub path: PathBuf,
    pub project_path: PathBuf,
    pub project_name: String,
    pub bytes: u64,
    pub files: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_manager: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_activity_secs_ago: Option<u64>,
    pub recreate_command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VenvDir {
    pub path: PathBuf,
    pub project_path: PathBuf,
    pub bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interpreter: Option<PathBuf>,
    /// The interpreter recorded in pyvenv.cfg no longer exists.
    pub broken: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_activity_secs_ago: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildDir {
    pub path: PathBuf,
    pub project_path: PathBuf,
    pub tool: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageReport {
    pub generated_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub categories: Vec<StorageCategory>,
    pub total_bytes: u64,
    pub node_modules: Vec<NodeModulesDir>,
    pub node_modules_bytes: u64,
    pub venvs: Vec<VenvDir>,
    pub venvs_bytes: u64,
    pub build_dirs: Vec<BuildDir>,
    pub build_bytes: u64,
    pub roots_scanned: Vec<PathBuf>,
    pub projects_scanned: bool,
}

#[derive(Debug, Clone)]
pub struct StorageOptions {
    /// Walk project folders for node_modules, virtualenvs and build directories.
    pub scan_projects: bool,
    pub max_depth: usize,
    pub extra_roots: Vec<PathBuf>,
}

impl Default for StorageOptions {
    fn default() -> Self {
        Self { scan_projects: true, max_depth: 6, extra_roots: Vec::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "event")]
pub enum StorageProgress {
    Category { id: String, label: String, index: usize, total: usize },
    Projects { root: PathBuf },
    Finished { duration_ms: u64 },
}

struct CategorySpec {
    id: &'static str,
    label: &'static str,
    kind: StorageKind,
    recreatable: bool,
    description: &'static str,
}

fn categories(ctx: &SystemContext) -> Vec<(CategorySpec, Vec<PathBuf>)> {
    let home = &ctx.home;
    let vars = &ctx.shell_capture().vars;
    let h = |p: &str| home.join(p);
    let existing = |paths: Vec<PathBuf>| -> Vec<PathBuf> { paths.into_iter().filter(|p| p.exists()).collect() };
    vec![
        (
            CategorySpec {
                id: "homebrew_cache",
                label: "Homebrew cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Downloaded bottles and API metadata. Clearing it does not uninstall packages.",
            },
            existing(vec![super::homebrew::cache_dir(ctx)]),
        ),
        (
            CategorySpec {
                id: "npm_cache",
                label: "npm cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Content-addressed package cache (~/.npm/_cacache). npm re-downloads packages when needed.",
            },
            existing(vec![h(".npm/_cacache")]),
        ),
        (
            CategorySpec {
                id: "pnpm_store",
                label: "pnpm store",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Global content-addressable store shared by pnpm projects via hard links.",
            },
            existing(vec![
                vars.get("PNPM_HOME").map(|p| PathBuf::from(p).join("store")).unwrap_or_else(|| h("Library/pnpm/store")),
                h(".local/share/pnpm/store"),
                h(".pnpm-store"),
            ]),
        ),
        (
            CategorySpec {
                id: "yarn_cache",
                label: "Yarn cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Yarn package cache.",
            },
            existing(vec![h("Library/Caches/Yarn"), h(".yarn/berry/cache"), h(".cache/yarn")]),
        ),
        (
            CategorySpec {
                id: "pip_cache",
                label: "pip cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Downloaded wheels and HTTP cache used by pip.",
            },
            existing(vec![h("Library/Caches/pip"), h(".cache/pip")]),
        ),
        (
            CategorySpec {
                id: "uv_cache",
                label: "uv cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "uv's package and build cache.",
            },
            existing(vec![h("Library/Caches/uv"), h(".cache/uv")]),
        ),
        (
            CategorySpec {
                id: "cargo_cache",
                label: "Cargo cache",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Crate registry downloads, extracted sources and git checkouts.",
            },
            existing(vec![
                vars.get("CARGO_HOME").map(|p| PathBuf::from(p).join("registry")).unwrap_or_else(|| h(".cargo/registry")),
                vars.get("CARGO_HOME").map(|p| PathBuf::from(p).join("git")).unwrap_or_else(|| h(".cargo/git")),
            ]),
        ),
        (
            CategorySpec {
                id: "docker",
                label: "Docker",
                kind: StorageKind::Data,
                recreatable: false,
                description:
                    "Docker Desktop virtual disk (images, containers, volumes). Manage it with `docker system prune` or Docker Desktop.",
            },
            existing(vec![h("Library/Containers/com.docker.docker/Data"), h(".orbstack")]),
        ),
        (
            CategorySpec {
                id: "ollama_models",
                label: "Ollama models",
                kind: StorageKind::Models,
                recreatable: false,
                description: "Models pulled with `ollama pull`. Remove individual models from the Local AI page.",
            },
            existing(vec![vars.get("OLLAMA_MODELS").map(PathBuf::from).unwrap_or_else(|| h(".ollama/models"))]),
        ),
        (
            CategorySpec {
                id: "huggingface",
                label: "Hugging Face cache",
                kind: StorageKind::Models,
                recreatable: false,
                description: "Models and datasets downloaded by transformers, diffusers, MLX and friends.",
            },
            existing(vec![vars.get("HF_HOME").map(PathBuf::from).unwrap_or_else(|| h(".cache/huggingface"))]),
        ),
        (
            CategorySpec {
                id: "mlx",
                label: "MLX cache",
                kind: StorageKind::Models,
                recreatable: false,
                description: "MLX-specific caches (most MLX models live in the Hugging Face cache).",
            },
            existing(vec![h(".cache/mlx"), h(".mlx")]),
        ),
        (
            CategorySpec {
                id: "lmstudio",
                label: "LM Studio models",
                kind: StorageKind::Models,
                recreatable: false,
                description: "Models downloaded through LM Studio.",
            },
            existing(vec![h(".lmstudio/models"), h(".cache/lm-studio/models")]),
        ),
        (
            CategorySpec {
                id: "playwright",
                label: "Playwright browsers",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Browser builds installed by `npx playwright install`.",
            },
            existing(vec![h("Library/Caches/ms-playwright")]),
        ),
        (
            CategorySpec {
                id: "puppeteer",
                label: "Puppeteer browsers",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Chromium builds downloaded by Puppeteer.",
            },
            existing(vec![h(".cache/puppeteer")]),
        ),
        (
            CategorySpec {
                id: "xcode",
                label: "Xcode caches",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "DerivedData, Xcode caches, simulator caches and device support files.",
            },
            existing(vec![
                h("Library/Developer/Xcode/DerivedData"),
                h("Library/Caches/com.apple.dt.Xcode"),
                h("Library/Developer/CoreSimulator/Caches"),
                h("Library/Developer/Xcode/iOS DeviceSupport"),
            ]),
        ),
        (
            CategorySpec {
                id: "gradle_maven",
                label: "Gradle / Maven caches",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "JVM dependency caches.",
            },
            existing(vec![h(".gradle/caches"), h(".m2/repository")]),
        ),
        (
            CategorySpec {
                id: "go_cache",
                label: "Go caches",
                kind: StorageKind::Cache,
                recreatable: true,
                description: "Go module and build caches.",
            },
            existing(vec![h("go/pkg/mod"), h("Library/Caches/go-build")]),
        ),
    ]
}

/// Likely project locations. Hidden folders and macOS system folders are excluded.
pub fn project_roots(home: &Path, extra: &[PathBuf]) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = extra.to_vec();
    for name in [
        "Projects",
        "projects",
        "Developer",
        "Code",
        "code",
        "dev",
        "Dev",
        "src",
        "work",
        "Work",
        "repos",
        "git",
        "github",
        "Sites",
        "Documents",
        "Desktop",
        "Downloads",
    ] {
        let p = home.join(name);
        if p.is_dir() && !roots.contains(&p) {
            roots.push(p);
        }
    }
    // Top-level home folders that look like projects.
    for p in fs_util::list_dir(home) {
        let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if !p.is_dir()
            || name.starts_with('.')
            || matches!(name.as_str(), "Library" | "Applications" | "Music" | "Movies" | "Pictures" | "Public")
        {
            continue;
        }
        if roots.contains(&p) {
            continue;
        }
        if ["package.json", ".git", "pyproject.toml", "Cargo.toml", "go.mod", "node_modules"].iter().any(|m| p.join(m).exists()) {
            roots.push(p);
        }
    }
    roots
}

fn package_manager_for(project: &Path) -> Option<String> {
    if project.join("pnpm-lock.yaml").exists() {
        Some("pnpm".into())
    } else if project.join("yarn.lock").exists() {
        Some("yarn".into())
    } else if project.join("bun.lockb").exists() || project.join("bun.lock").exists() {
        Some("bun".into())
    } else if project.join("package-lock.json").exists() || project.join("package.json").exists() {
        Some("npm".into())
    } else {
        None
    }
}

fn project_activity(project: &Path) -> Option<i64> {
    let mut latest: Option<i64> = None;
    let mut consider = |t: Option<i64>| {
        if let Some(t) = t {
            if latest.is_none_or(|l| t > l) {
                latest = Some(t);
            }
        }
    };
    if let Ok(rd) = std::fs::read_dir(project) {
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if matches!(name.as_str(), "node_modules" | ".git" | "target" | ".next" | "dist" | "build" | ".venv" | "venv") {
                continue;
            }
            use std::os::unix::fs::MetadataExt;
            consider(entry.metadata().ok().map(|m| m.mtime()));
        }
    }
    for marker in [".git/index", ".git/FETCH_HEAD", ".git/HEAD"] {
        use std::os::unix::fs::MetadataExt;
        consider(std::fs::metadata(project.join(marker)).ok().map(|m| m.mtime()));
    }
    latest
}

fn secs_ago(mtime: Option<i64>) -> Option<u64> {
    let now = Utc::now().timestamp();
    mtime.map(|t| now.saturating_sub(t).max(0) as u64)
}

fn parse_pyvenv_cfg(dir: &Path) -> (Option<String>, Option<PathBuf>) {
    let Ok(Some(content)) = fs_util::read_to_string_opt(&dir.join("pyvenv.cfg")) else { return (None, None) };
    let mut version = None;
    let mut home = None;
    for line in content.lines() {
        let Some((k, v)) = line.split_once('=') else { continue };
        match k.trim() {
            "version" | "version_info" => version = Some(v.trim().to_string()),
            "home" => home = Some(PathBuf::from(v.trim())),
            _ => {}
        }
    }
    (version, home)
}

struct ProjectWalk {
    node_modules: Vec<NodeModulesDir>,
    venvs: Vec<VenvDir>,
    build_dirs: Vec<BuildDir>,
    visited: HashSet<PathBuf>,
}

const SKIP_DIRS: &[&str] = &[
    "Library",
    ".git",
    ".Trash",
    "Applications",
    "node_modules",
    ".cache",
    ".npm",
    ".cargo",
    ".rustup",
    ".pnpm-store",
    "Photos Library.photoslibrary",
];

fn walk_projects(root: &Path, depth: usize, max_depth: usize, walk: &mut ProjectWalk) {
    if depth > max_depth {
        return;
    }
    let canonical = std::fs::canonicalize(root).unwrap_or(root.to_path_buf());
    if !walk.visited.insert(canonical) {
        return;
    }
    let Ok(rd) = std::fs::read_dir(root) else { return };
    let mut subdirs = Vec::new();
    for entry in rd.flatten() {
        let path = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if !ft.is_dir() || ft.is_symlink() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == "node_modules" {
            let project = root.to_path_buf();
            let size = fs_util::dir_size(&path);
            let pm = package_manager_for(&project);
            let activity = project_activity(&project);
            walk.node_modules.push(NodeModulesDir {
                path: path.clone(),
                project_name: project.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
                project_path: project,
                bytes: size.allocated,
                files: size.files,
                recreate_command: match pm.as_deref() {
                    Some("pnpm") => "pnpm install".into(),
                    Some("yarn") => "yarn install".into(),
                    Some("bun") => "bun install".into(),
                    _ => "npm install".into(),
                },
                package_manager: pm,
                last_activity: activity.and_then(|t| DateTime::<Utc>::from_timestamp(t, 0)),
                last_activity_secs_ago: secs_ago(activity),
            });
            continue;
        }
        if path.join("pyvenv.cfg").exists() {
            let (version, home) = parse_pyvenv_cfg(&path);
            let interpreter = home.as_ref().map(|h| h.join("python3"));
            let broken = home.as_ref().is_some_and(|h| !h.exists());
            let size = fs_util::dir_size(&path);
            walk.venvs.push(VenvDir {
                path: path.clone(),
                project_path: root.to_path_buf(),
                bytes: size.allocated,
                python_version: version,
                interpreter,
                broken,
                last_activity_secs_ago: secs_ago(project_activity(root)),
            });
            continue;
        }
        if name == "target" && path.join("CACHEDIR.TAG").exists() && root.join("Cargo.toml").exists() {
            let size = fs_util::dir_size(&path);
            walk.build_dirs.push(BuildDir {
                path: path.clone(),
                project_path: root.to_path_buf(),
                tool: "cargo".into(),
                bytes: size.allocated,
            });
            continue;
        }
        if matches!(name.as_str(), ".next" | ".nuxt" | ".turbo" | ".parcel-cache" | ".angular" | ".svelte-kit")
            && root.join("package.json").exists()
        {
            let size = fs_util::dir_size(&path);
            walk.build_dirs.push(BuildDir {
                path: path.clone(),
                project_path: root.to_path_buf(),
                tool: name.trim_start_matches('.').to_string(),
                bytes: size.allocated,
            });
            continue;
        }
        if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        subdirs.push(path);
    }
    for sub in subdirs {
        walk_projects(&sub, depth + 1, max_depth, walk);
    }
}

pub fn scan(ctx: &SystemContext, opts: &StorageOptions, progress: &mut dyn FnMut(StorageProgress)) -> StorageReport {
    let start = Instant::now();
    let specs = categories(ctx);
    let total = specs.len();
    let mut out_categories = Vec::new();
    for (index, (spec, paths)) in specs.into_iter().enumerate() {
        progress(StorageProgress::Category { id: spec.id.to_string(), label: spec.label.to_string(), index, total });
        let t = Instant::now();
        let mut size = DirSize::default();
        for p in &paths {
            size.add(fs_util::dir_size(p));
        }
        out_categories.push(StorageCategory {
            id: spec.id.to_string(),
            label: spec.label.to_string(),
            kind: spec.kind,
            exists: !paths.is_empty(),
            paths,
            bytes: size.allocated,
            files: size.files,
            recreatable: spec.recreatable,
            description: spec.description.to_string(),
            scan_ms: t.elapsed().as_millis() as u64,
        });
    }
    let mut walk = ProjectWalk { node_modules: Vec::new(), venvs: Vec::new(), build_dirs: Vec::new(), visited: HashSet::new() };
    let mut roots = Vec::new();
    if opts.scan_projects {
        roots = project_roots(&ctx.home, &opts.extra_roots);
        // Global virtualenv homes.
        for extra in
            [ctx.home.join(".virtualenvs"), ctx.home.join(".local/share/virtualenvs"), ctx.home.join("Library/Caches/pypoetry/virtualenvs")]
        {
            if extra.is_dir() {
                roots.push(extra);
            }
        }
        for root in &roots {
            progress(StorageProgress::Projects { root: root.clone() });
            walk_projects(root, 0, opts.max_depth, &mut walk);
        }
    }
    walk.node_modules.sort_by_key(|x| std::cmp::Reverse(x.bytes));
    walk.venvs.sort_by_key(|x| std::cmp::Reverse(x.bytes));
    walk.build_dirs.sort_by_key(|x| std::cmp::Reverse(x.bytes));
    let node_modules_bytes = walk.node_modules.iter().map(|n| n.bytes).sum();
    let venvs_bytes = walk.venvs.iter().map(|v| v.bytes).sum();
    let build_bytes = walk.build_dirs.iter().map(|b| b.bytes).sum();
    let total_bytes = out_categories.iter().map(|c| c.bytes).sum::<u64>() + node_modules_bytes + venvs_bytes + build_bytes;
    let duration_ms = start.elapsed().as_millis() as u64;
    progress(StorageProgress::Finished { duration_ms });
    StorageReport {
        generated_at: Utc::now(),
        duration_ms,
        categories: out_categories,
        total_bytes,
        node_modules: walk.node_modules,
        node_modules_bytes,
        venvs: walk.venvs,
        venvs_bytes,
        build_dirs: walk.build_dirs,
        build_bytes,
        roots_scanned: roots,
        projects_scanned: opts.scan_projects,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_node_modules_and_venvs() {
        let dir = tempfile::tempdir().unwrap();
        let proj = dir.path().join("Projects/app");
        std::fs::create_dir_all(proj.join("node_modules/pkg")).unwrap();
        std::fs::write(proj.join("package.json"), "{}").unwrap();
        std::fs::write(proj.join("pnpm-lock.yaml"), "").unwrap();
        std::fs::write(proj.join("node_modules/pkg/index.js"), vec![0u8; 4096]).unwrap();
        let venv = dir.path().join("Projects/py/.venv");
        std::fs::create_dir_all(venv.join("bin")).unwrap();
        std::fs::write(venv.join("pyvenv.cfg"), "home = /nonexistent/bin\nversion = 3.12.1\n").unwrap();
        let mut walk = ProjectWalk { node_modules: Vec::new(), venvs: Vec::new(), build_dirs: Vec::new(), visited: HashSet::new() };
        walk_projects(&dir.path().join("Projects"), 0, 4, &mut walk);
        assert_eq!(walk.node_modules.len(), 1);
        assert_eq!(walk.node_modules[0].package_manager.as_deref(), Some("pnpm"));
        assert_eq!(walk.node_modules[0].recreate_command, "pnpm install");
        assert!(walk.node_modules[0].bytes >= 4096);
        assert_eq!(walk.venvs.len(), 1);
        assert!(walk.venvs[0].broken);
        assert_eq!(walk.venvs[0].python_version.as_deref(), Some("3.12.1"));
    }
}
