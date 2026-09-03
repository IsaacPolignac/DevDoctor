//! Environment snapshots and diffs ("What changed").
//!
//! A snapshot is a set of (category, key, value) items describing the environment at a point in
//! time. Snapshots are cheap metadata (hashes, versions, names, sizes); no file contents are
//! copied. Diffing two snapshots yields precise, explainable changes.

use crate::context::SystemContext;
use crate::ids::{random_id, sha256_hex};
use crate::inventory::{homebrew, node, ollama, python, storage::StorageReport, tools};
use crate::resolve::resolve_command;
use crate::units::format_bytes;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotItem {
    pub category: String,
    pub key: String,
    pub value: Value,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SnapshotSummaryData {
    pub counts: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path_entries: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    /// "baseline" | "scan" | "manual" | "pre_fix" | "post_fix"
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub summary: SnapshotSummaryData,
    pub items: Vec<SnapshotItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotSummary {
    pub id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub summary: SnapshotSummaryData,
}

impl Snapshot {
    /// Hash of all item hashes: identical environments produce identical content hashes.
    pub fn content_hash(&self) -> String {
        let mut joined = String::new();
        for item in &self.items {
            joined.push_str(&item.category);
            joined.push('\0');
            joined.push_str(&item.key);
            joined.push('\0');
            joined.push_str(&item.hash);
            joined.push('\n');
        }
        sha256_hex(joined.as_bytes())
    }
}

pub struct SnapshotOptions<'a> {
    pub kind: &'a str,
    pub label: Option<String>,
    pub storage: Option<&'a StorageReport>,
    /// Skip slower collectors (tool versions, package listings) for cheap per-scan snapshots.
    pub quick: bool,
}

fn item(category: &str, key: impl Into<String>, value: Value) -> SnapshotItem {
    let hash = sha256_hex(value.to_string().as_bytes());
    SnapshotItem { category: category.to_string(), key: key.into(), value, hash }
}

/// An item whose change detection ignores part of its value (e.g. versions that quick
/// snapshots do not collect).
fn item_hashed(category: &str, key: impl Into<String>, value: Value, hash_source: &Value) -> SnapshotItem {
    let hash = sha256_hex(hash_source.to_string().as_bytes());
    SnapshotItem { category: category.to_string(), key: key.into(), value, hash }
}

/// Categories that are only collected by some snapshots (storage scans, full snapshots).
/// A diff ignores them unless both snapshots collected them.
const OPTIONAL_CATEGORIES: &[&str] = &["storage", "tool"];

/// Bytes rounded to 100 MB buckets so tiny cache churn does not count as a change.
fn bucket_bytes(bytes: u64) -> u64 {
    const BUCKET: u64 = 100_000_000;
    (bytes / BUCKET) * BUCKET
}

pub fn collect(ctx: &SystemContext, opts: &SnapshotOptions<'_>) -> Snapshot {
    let mut items: Vec<SnapshotItem> = Vec::new();
    let capture = ctx.shell_capture();
    let analysis = ctx.shell_analysis();

    items.push(item("path", "PATH", json!(capture.path.entries)));
    for f in &analysis.files {
        if f.exists {
            items.push(item("shell_file", ctx.display_path(&f.path), json!({ "sha256": f.sha256, "size": f.size, "mtime": f.mtime })));
        }
    }
    let mut env_names = capture.env_names.clone();
    env_names.sort();
    for name in env_names {
        items.push(item("env_var", name, Value::Null));
    }

    let brew = homebrew::inventory(ctx, homebrew::HomebrewOptions::default());
    for f in &brew.formulae {
        items.push(item("brew_formula", &f.name, json!({ "versions": f.versions })));
    }
    for c in &brew.casks {
        items.push(item("brew_cask", &c.name, json!({ "versions": c.versions })));
    }

    if let Some(npm) = resolve_command(ctx, "npm", false).ok().and_then(|r| r.active) {
        if let Some(dir) = tools::npm_global_dir(ctx, &npm.path) {
            for pkg in npm_packages(&dir) {
                items.push(item("npm_global", &pkg.0, json!({ "version": pkg.1, "prefix": ctx.display_path(&dir) })));
            }
        }
    }
    let pipx_home = if ctx.home.join(".local/pipx").exists() { ctx.home.join(".local/pipx") } else { ctx.home.join(".local/share/pipx") };
    for venv in crate::fs_util::list_dir(&pipx_home.join("venvs")) {
        let name = venv.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let version = crate::fs_util::read_to_string_opt(&venv.join("pipx_metadata.json"))
            .ok()
            .flatten()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v.pointer("/main_package/package_version").and_then(|x| x.as_str()).map(|x| x.to_string()));
        items.push(item("pipx", name, json!({ "version": version })));
    }
    for tool in crate::fs_util::list_dir(&ctx.home.join(".local/share/uv/tools")) {
        let name = tool.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        items.push(item("uv_tool", name, Value::Null));
    }
    let cargo_home = capture.vars.get("CARGO_HOME").map(std::path::PathBuf::from).unwrap_or_else(|| ctx.home.join(".cargo"));
    if let Ok(Some(c)) = crate::fs_util::read_to_string_opt(&cargo_home.join(".crates.toml")) {
        for cr in crate::inventory::rust::parse_crates_toml(&c) {
            items.push(item("cargo_install", cr.name, json!({ "version": cr.version })));
        }
    }

    let node_inv = node::inventory(ctx);
    for inst in &node_inv.installations {
        items.push(item("node_install", ctx.display_path(&inst.binary), json!({ "version": inst.version, "source": inst.label })));
    }
    let py_inv = python::inventory(ctx);
    for inst in &py_inv.installations {
        items.push(item("python_install", ctx.display_path(&inst.binary), json!({ "version": inst.version, "source": inst.label })));
    }
    for cmd in [
        "node", "npm", "python", "python3", "pip", "pip3", "cargo", "rustc", "ruby", "java", "go", "git", "docker", "ollama", "claude",
        "codex", "gemini",
    ] {
        if let Ok(r) = resolve_command(ctx, cmd, !opts.quick) {
            if let Some(active) = r.active {
                let location =
                    json!({ "path": ctx.display_path(&active.path), "real_path": active.real_path.as_ref().map(|p| ctx.display_path(p)) });
                let mut value = location.clone();
                value["version"] = json!(active.version);
                items.push(item_hashed("runtime", cmd, value, &location));
            }
        }
    }

    if let Ok(services) = ctx.platform.services() {
        for s in services {
            if s.origin == crate::platform::ServiceOrigin::Apple {
                continue;
            }
            items.push(item(
                "service",
                &s.label,
                json!({ "plist": ctx.display_path(&s.plist_path), "program": s.program.as_ref().map(|p| ctx.display_path(p)), "run_at_load": s.run_at_load, "running": s.running_pid.is_some() }),
            ));
        }
    }
    if let Ok(ports) = ctx.platform.listening_ports() {
        let mut by_port: BTreeMap<u16, String> = BTreeMap::new();
        for p in ports {
            if p.port >= 1024 {
                by_port.entry(p.port).or_insert_with(|| p.process_name.clone().unwrap_or_else(|| "unknown".into()));
            }
        }
        for (port, name) in by_port {
            items.push(item("port", port.to_string(), json!({ "process": name })));
        }
    }
    if !opts.quick {
        for tool in tools::inventory(ctx, false) {
            if tool.installed {
                items.push(item(
                    "tool",
                    &tool.id,
                    json!({ "name": tool.name, "version": tool.version, "binary": tool.binary.as_ref().map(|b| ctx.display_path(b)) }),
                ));
            }
        }
    }
    let ollama_inv = ollama::inventory(ctx);
    for m in &ollama_inv.models {
        items.push(item("ollama_model", &m.name, json!({ "size": m.size })));
    }
    let mut storage_bytes = None;
    if let Some(storage) = opts.storage {
        for c in &storage.categories {
            if c.exists {
                items.push(item("storage", &c.id, json!({ "label": c.label, "bytes": bucket_bytes(c.bytes) })));
            }
        }
        items.push(item("storage", "node_modules", json!({ "label": "node_modules", "bytes": bucket_bytes(storage.node_modules_bytes) })));
        items.push(item("storage", "python_envs", json!({ "label": "Python environments", "bytes": bucket_bytes(storage.venvs_bytes) })));
        storage_bytes = Some(storage.total_bytes);
    }
    items.sort_by(|a, b| a.category.cmp(&b.category).then(a.key.cmp(&b.key)));
    items.dedup_by(|a, b| a.category == b.category && a.key == b.key);
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for i in &items {
        *counts.entry(i.category.clone()).or_default() += 1;
    }
    Snapshot {
        id: random_id("snap_"),
        kind: opts.kind.to_string(),
        label: opts.label.clone(),
        created_at: Utc::now(),
        summary: SnapshotSummaryData { counts, path_entries: Some(capture.path.entries.len()), storage_bytes },
        items,
    }
}

fn npm_packages(dir: &Path) -> Vec<(String, Option<String>)> {
    let mut out = Vec::new();
    for entry in crate::fs_util::list_dir(dir) {
        let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if name.starts_with('.') || name == "npm" || name == "corepack" {
            continue;
        }
        if name.starts_with('@') {
            for scoped in crate::fs_util::list_dir(&entry) {
                let sname = scoped.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                out.push((format!("{name}/{sname}"), package_version(&scoped)));
            }
        } else {
            out.push((name, package_version(&entry)));
        }
    }
    out
}

fn package_version(dir: &Path) -> Option<String> {
    let text = crate::fs_util::read_to_string_opt(&dir.join("package.json")).ok().flatten()?;
    serde_json::from_str::<Value>(&text).ok()?.get("version")?.as_str().map(|s| s.to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKind {
    Added,
    Removed,
    Changed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub category: String,
    pub key: String,
    pub kind: ChangeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<Value>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryChanges {
    pub category: String,
    pub label: String,
    pub added: usize,
    pub removed: usize,
    pub changed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotDiff {
    pub from_id: String,
    pub to_id: String,
    pub from_at: DateTime<Utc>,
    pub to_at: DateTime<Utc>,
    pub changes: Vec<Change>,
    pub categories: Vec<CategoryChanges>,
    /// Short lines such as "14 packages added" for the overview.
    pub headline: Vec<String>,
}

pub fn category_label(category: &str) -> &'static str {
    match category {
        "path" => "PATH",
        "shell_file" => "Shell configuration",
        "env_var" => "Environment variables",
        "brew_formula" => "Homebrew formulae",
        "brew_cask" => "Homebrew casks",
        "npm_global" => "npm global packages",
        "pipx" => "pipx packages",
        "uv_tool" => "uv tools",
        "cargo_install" => "Cargo binaries",
        "node_install" => "Node.js installations",
        "python_install" => "Python installations",
        "runtime" => "Command resolution",
        "service" => "Startup services",
        "port" => "Listening ports",
        "tool" => "Developer tools",
        "ollama_model" => "Ollama models",
        "storage" => "Developer storage",
        _ => "Other",
    }
}

fn describe(category: &str, key: &str, kind: ChangeKind, before: Option<&Value>, after: Option<&Value>) -> String {
    let s = |v: Option<&Value>, k: &str| {
        v.and_then(|v| v.get(k)).and_then(|x| x.as_str().map(|s| s.to_string()).or_else(|| x.as_u64().map(|n| n.to_string())))
    };
    match (category, kind) {
        ("path", ChangeKind::Changed) => {
            let b: Vec<String> = before
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let a: Vec<String> = after
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let added: Vec<&String> = a.iter().filter(|x| !b.contains(x)).collect();
            let removed: Vec<&String> = b.iter().filter(|x| !a.contains(x)).collect();
            let mut parts = Vec::new();
            if !added.is_empty() {
                parts.push(format!("added {}", added.iter().map(|x| x.as_str()).collect::<Vec<_>>().join(", ")));
            }
            if !removed.is_empty() {
                parts.push(format!("removed {}", removed.iter().map(|x| x.as_str()).collect::<Vec<_>>().join(", ")));
            }
            if parts.is_empty() {
                parts.push("order changed".into());
            }
            format!("PATH changed: {}", parts.join("; "))
        }
        ("shell_file", ChangeKind::Changed) => format!("{key} modified"),
        ("shell_file", ChangeKind::Added) => format!("{key} created"),
        ("shell_file", ChangeKind::Removed) => format!("{key} deleted"),
        ("env_var", ChangeKind::Added) => format!("Environment variable {key} added"),
        ("env_var", ChangeKind::Removed) => format!("Environment variable {key} removed"),
        ("brew_formula" | "brew_cask", ChangeKind::Added) => {
            format!("Homebrew: {key} installed{}", s(after, "versions").map(|v| format!(" ({v})")).unwrap_or_default())
        }
        ("brew_formula" | "brew_cask", ChangeKind::Removed) => format!("Homebrew: {key} uninstalled"),
        ("brew_formula" | "brew_cask", ChangeKind::Changed) => format!("Homebrew: {key} versions changed"),
        ("npm_global", ChangeKind::Added) => {
            format!("npm: {key}{} installed globally", s(after, "version").map(|v| format!("@{v}")).unwrap_or_default())
        }
        ("npm_global", ChangeKind::Removed) => format!("npm: {key} removed globally"),
        ("npm_global", ChangeKind::Changed) => {
            format!("npm: {key} updated {} → {}", s(before, "version").unwrap_or_default(), s(after, "version").unwrap_or_default())
        }
        ("pipx" | "uv_tool" | "cargo_install", ChangeKind::Added) => format!("{}: {key} installed", category_label(category)),
        ("pipx" | "uv_tool" | "cargo_install", ChangeKind::Removed) => format!("{}: {key} removed", category_label(category)),
        ("pipx" | "uv_tool" | "cargo_install", ChangeKind::Changed) => format!("{}: {key} updated", category_label(category)),
        ("node_install" | "python_install", ChangeKind::Added) => {
            format!("{} {} installed at {key}", s(after, "source").unwrap_or_default(), s(after, "version").unwrap_or_default())
        }
        ("node_install" | "python_install", ChangeKind::Removed) => format!("Installation removed: {key}"),
        ("runtime", ChangeKind::Changed) => format!(
            "`{key}` now resolves to {} ({})",
            s(after, "path").unwrap_or_default(),
            s(after, "version").unwrap_or_else(|| "unknown version".into())
        ),
        ("runtime", ChangeKind::Added) => format!("`{key}` is now available at {}", s(after, "path").unwrap_or_default()),
        ("runtime", ChangeKind::Removed) => format!("`{key}` is no longer found in PATH"),
        ("service", ChangeKind::Added) => format!("Startup service {key} added"),
        ("service", ChangeKind::Removed) => format!("Startup service {key} removed"),
        ("service", ChangeKind::Changed) => format!("Startup service {key} changed"),
        ("port", ChangeKind::Added) => format!("Port {key} now listened by {}", s(after, "process").unwrap_or_default()),
        ("port", ChangeKind::Removed) => format!("Port {key} no longer in use"),
        ("port", ChangeKind::Changed) => {
            format!("Port {key} now used by {} (was {})", s(after, "process").unwrap_or_default(), s(before, "process").unwrap_or_default())
        }
        ("tool", ChangeKind::Added) => format!("{} installed", s(after, "name").unwrap_or_else(|| key.to_string())),
        ("tool", ChangeKind::Removed) => format!("{} removed", s(before, "name").unwrap_or_else(|| key.to_string())),
        ("tool", ChangeKind::Changed) => {
            format!("{} updated to {}", s(after, "name").unwrap_or_else(|| key.to_string()), s(after, "version").unwrap_or_default())
        }
        ("ollama_model", ChangeKind::Added) => format!(
            "Ollama model {key} added ({})",
            after.and_then(|v| v.get("size")).and_then(|x| x.as_u64()).map(format_bytes).unwrap_or_default()
        ),
        ("ollama_model", ChangeKind::Removed) => format!("Ollama model {key} removed"),
        ("storage", _) => {
            let b = before.and_then(|v| v.get("bytes")).and_then(|x| x.as_u64()).unwrap_or(0);
            let a = after.and_then(|v| v.get("bytes")).and_then(|x| x.as_u64()).unwrap_or(0);
            let label = s(after, "label").or_else(|| s(before, "label")).unwrap_or_else(|| key.to_string());
            if a >= b {
                format!("{label}: +{}", format_bytes(a - b))
            } else {
                format!("{label}: -{}", format_bytes(b - a))
            }
        }
        (_, ChangeKind::Added) => format!("{key} added"),
        (_, ChangeKind::Removed) => format!("{key} removed"),
        (_, ChangeKind::Changed) => format!("{key} changed"),
    }
}

pub fn diff(from: &Snapshot, to: &Snapshot) -> SnapshotDiff {
    let mut before: BTreeMap<(String, String), &SnapshotItem> = BTreeMap::new();
    for i in &from.items {
        before.insert((i.category.clone(), i.key.clone()), i);
    }
    let mut after: BTreeMap<(String, String), &SnapshotItem> = BTreeMap::new();
    for i in &to.items {
        after.insert((i.category.clone(), i.key.clone()), i);
    }
    // Optional categories (storage, tools) only count when both snapshots collected them.
    let cats_before: std::collections::BTreeSet<&String> = from.items.iter().map(|i| &i.category).collect();
    let cats_after: std::collections::BTreeSet<&String> = to.items.iter().map(|i| &i.category).collect();
    let skip = |cat: &String| OPTIONAL_CATEGORIES.contains(&cat.as_str()) && !(cats_before.contains(cat) && cats_after.contains(cat));
    let mut changes = Vec::new();
    for (k, a) in &after {
        if skip(&k.0) {
            continue;
        }
        match before.get(k) {
            None => changes.push(Change {
                category: k.0.clone(),
                key: k.1.clone(),
                kind: ChangeKind::Added,
                before: None,
                after: Some(a.value.clone()),
                description: describe(&k.0, &k.1, ChangeKind::Added, None, Some(&a.value)),
            }),
            Some(b) if b.hash != a.hash => changes.push(Change {
                category: k.0.clone(),
                key: k.1.clone(),
                kind: ChangeKind::Changed,
                before: Some(b.value.clone()),
                after: Some(a.value.clone()),
                description: describe(&k.0, &k.1, ChangeKind::Changed, Some(&b.value), Some(&a.value)),
            }),
            _ => {}
        }
    }
    for (k, b) in &before {
        if skip(&k.0) {
            continue;
        }
        if !after.contains_key(k) {
            changes.push(Change {
                category: k.0.clone(),
                key: k.1.clone(),
                kind: ChangeKind::Removed,
                before: Some(b.value.clone()),
                after: None,
                description: describe(&k.0, &k.1, ChangeKind::Removed, Some(&b.value), None),
            });
        }
    }
    changes.sort_by(|a, b| a.category.cmp(&b.category).then(a.key.cmp(&b.key)));
    let mut cats: BTreeMap<String, CategoryChanges> = BTreeMap::new();
    for c in &changes {
        let e = cats.entry(c.category.clone()).or_insert_with(|| CategoryChanges {
            category: c.category.clone(),
            label: category_label(&c.category).to_string(),
            added: 0,
            removed: 0,
            changed: 0,
        });
        match c.kind {
            ChangeKind::Added => e.added += 1,
            ChangeKind::Removed => e.removed += 1,
            ChangeKind::Changed => e.changed += 1,
        }
    }
    let headline = headline(&changes);
    SnapshotDiff {
        from_id: from.id.clone(),
        to_id: to.id.clone(),
        from_at: from.created_at,
        to_at: to.created_at,
        changes,
        categories: cats.into_values().collect(),
        headline,
    }
}

fn headline(changes: &[Change]) -> Vec<String> {
    let mut lines = Vec::new();
    let count = |cats: &[&str], kind: ChangeKind| changes.iter().filter(|c| cats.contains(&c.category.as_str()) && c.kind == kind).count();
    let pkg_cats = ["brew_formula", "brew_cask", "npm_global", "pipx", "uv_tool", "cargo_install"];
    let plural = |n: usize, s: &str| if n == 1 { format!("1 {s}") } else { format!("{n} {s}s") };
    let added = count(&pkg_cats, ChangeKind::Added);
    let removed = count(&pkg_cats, ChangeKind::Removed);
    let updated = count(&pkg_cats, ChangeKind::Changed);
    if added > 0 {
        lines.push(format!("{} added", plural(added, "package")));
    }
    if removed > 0 {
        lines.push(format!("{} removed", plural(removed, "package")));
    }
    if updated > 0 {
        lines.push(format!("{} updated", plural(updated, "package")));
    }
    let shell = changes.iter().filter(|c| c.category == "shell_file" || c.category == "path").count();
    if shell > 0 {
        lines.push(plural(shell, "shell configuration change").to_string());
    }
    let runtimes =
        changes.iter().filter(|c| c.category == "runtime" || c.category == "node_install" || c.category == "python_install").count();
    if runtimes > 0 {
        lines.push(plural(runtimes, "runtime change").to_string());
    }
    let services_added = count(&["service"], ChangeKind::Added);
    if services_added > 0 {
        lines.push(format!("{} added", plural(services_added, "startup service")));
    }
    let ports_added = count(&["port"], ChangeKind::Added);
    if ports_added > 0 {
        lines.push(format!("{} added", plural(ports_added, "listening port")));
    }
    let models = count(&["ollama_model"], ChangeKind::Added);
    if models > 0 {
        lines.push(format!("{} added", plural(models, "Ollama model")));
    }
    let env = count(&["env_var"], ChangeKind::Added);
    if env > 0 {
        lines.push(format!("{} added", plural(env, "environment variable")));
    }
    let storage_delta: i128 = changes
        .iter()
        .filter(|c| c.category == "storage")
        .map(|c| {
            let a = c.after.as_ref().and_then(|v| v.get("bytes")).and_then(|x| x.as_u64()).unwrap_or(0) as i128;
            let b = c.before.as_ref().and_then(|v| v.get("bytes")).and_then(|x| x.as_u64()).unwrap_or(0) as i128;
            a - b
        })
        .sum();
    if storage_delta > 0 {
        lines.push(format!("{} of developer storage added", format_bytes(storage_delta as u64)));
    } else if storage_delta < 0 {
        lines.push(format!("{} of developer storage freed", format_bytes((-storage_delta) as u64)));
    }
    if lines.is_empty() && !changes.is_empty() {
        lines.push(plural(changes.len(), "change").to_string());
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(items: Vec<SnapshotItem>) -> Snapshot {
        Snapshot {
            id: random_id("snap_"),
            kind: "test".into(),
            label: None,
            created_at: Utc::now(),
            summary: SnapshotSummaryData::default(),
            items,
        }
    }

    #[test]
    fn diff_reports_added_removed_changed() {
        let a = snap(vec![
            item("brew_formula", "node", json!({"versions": ["22.4.1"]})),
            item("brew_formula", "wget", json!({"versions": ["1.24"]})),
            item("shell_file", "~/.zshrc", json!({"sha256": "aaa"})),
            item("path", "PATH", json!(["/a", "/b"])),
        ]);
        let b = snap(vec![
            item("brew_formula", "node", json!({"versions": ["22.4.1", "22.5.0"]})),
            item("brew_formula", "python@3.12", json!({"versions": ["3.12.4"]})),
            item("shell_file", "~/.zshrc", json!({"sha256": "bbb"})),
            item("path", "PATH", json!(["/a", "/b", "/c"])),
            item("storage", "npm_cache", json!({"bytes": 100})),
        ]);
        let d = diff(&a, &b);
        assert_eq!(d.changes.len(), 5, "storage is ignored because the first snapshot has none");
        assert!(d.changes.iter().any(|c| c.kind == ChangeKind::Added && c.key == "python@3.12"));
        assert!(d.changes.iter().any(|c| c.kind == ChangeKind::Removed && c.key == "wget"));
        assert!(d.changes.iter().any(|c| c.description == "~/.zshrc modified"));
        assert!(d.changes.iter().any(|c| c.description.contains("added /c")));
        assert!(d.headline.iter().any(|h| h == "1 package added"));
        assert!(d.headline.iter().any(|h| h == "1 package removed"));
    }

    #[test]
    fn content_hash_is_stable() {
        let a = snap(vec![item("env_var", "HOME", Value::Null)]);
        let b = snap(vec![item("env_var", "HOME", Value::Null)]);
        assert_eq!(a.content_hash(), b.content_hash());
    }
}
