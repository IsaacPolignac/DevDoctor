//! Ollama models from the local manifest/blob store (no network, no daemon required).

use crate::context::SystemContext;
use crate::fs_util;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaLayer {
    pub digest: String,
    pub media_type: String,
    pub size: u64,
    pub present: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    /// Name as shown by `ollama list` (e.g. `llama3.1:8b`, `hf.co/org/model:Q4`).
    pub name: String,
    pub manifest_path: PathBuf,
    pub size: u64,
    pub layers: Vec<OllamaLayer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified_secs_ago: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameter_size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaInventory {
    pub installed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary: Option<PathBuf>,
    pub app_bundle_present: bool,
    pub models_dir: PathBuf,
    pub models: Vec<OllamaModel>,
    pub total_bytes: u64,
    pub blob_bytes: u64,
    /// Blobs not referenced by any manifest (left over from interrupted pulls or removals).
    pub orphan_blob_bytes: u64,
    pub orphan_blobs: usize,
    pub running: bool,
}

#[derive(Deserialize)]
struct Manifest {
    #[serde(default)]
    config: Option<ManifestLayer>,
    #[serde(default)]
    layers: Vec<ManifestLayer>,
}

#[derive(Deserialize)]
struct ManifestLayer {
    #[serde(rename = "mediaType", default)]
    media_type: String,
    #[serde(default)]
    digest: String,
    #[serde(default)]
    size: u64,
}

fn blob_path(models_dir: &Path, digest: &str) -> PathBuf {
    models_dir.join("blobs").join(digest.replace(':', "-"))
}

pub fn models_dir(ctx: &SystemContext) -> PathBuf {
    ctx.shell_capture()
        .vars
        .get("OLLAMA_MODELS")
        .map(PathBuf::from)
        .or_else(|| ctx.env.get("OLLAMA_MODELS").map(PathBuf::from))
        .unwrap_or_else(|| ctx.home.join(".ollama/models"))
}

/// Model name from the manifest path `manifests/<host>/<namespace>/<model>/<tag>`.
pub fn model_name(manifests_root: &Path, manifest: &Path) -> Option<String> {
    let rel = manifest.strip_prefix(manifests_root).ok()?;
    let parts: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
    if parts.len() < 4 {
        return None;
    }
    let host = &parts[0];
    let namespace = &parts[1];
    let model = parts[2..parts.len() - 1].join("/");
    let tag = &parts[parts.len() - 1];
    Some(if host == "registry.ollama.ai" && namespace == "library" {
        format!("{model}:{tag}")
    } else if host == "registry.ollama.ai" {
        format!("{namespace}/{model}:{tag}")
    } else {
        format!("{host}/{namespace}/{model}:{tag}")
    })
}

fn walk_manifests(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in fs_util::list_dir(dir) {
        if entry.is_dir() {
            walk_manifests(&entry, out);
        } else if entry.is_file() {
            out.push(entry);
        }
    }
}

fn read_model_config(models_dir: &Path, config: &ManifestLayer) -> (Option<String>, Option<String>, Option<String>) {
    let path = blob_path(models_dir, &config.digest);
    let Ok(Some(text)) = fs_util::read_to_string_opt(&path) else { return (None, None, None) };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { return (None, None, None) };
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).map(|x| x.to_string());
    (s("model_family").or_else(|| s("model_type")), s("parameter_size"), s("quantization_level"))
}

pub fn inventory(ctx: &SystemContext) -> OllamaInventory {
    let models_dir = models_dir(ctx);
    let binary = ctx.find_program("ollama").or_else(|| {
        let app = PathBuf::from("/Applications/Ollama.app/Contents/Resources/ollama");
        app.exists().then_some(app)
    });
    let app_bundle_present = Path::new("/Applications/Ollama.app").exists();
    let manifests_root = models_dir.join("manifests");
    let mut manifest_files = Vec::new();
    walk_manifests(&manifests_root, &mut manifest_files);
    let mut models = Vec::new();
    let mut referenced: HashSet<String> = HashSet::new();
    for path in manifest_files {
        let Ok(Some(text)) = fs_util::read_to_string_opt(&path) else { continue };
        let Ok(manifest) = serde_json::from_str::<Manifest>(&text) else { continue };
        let Some(name) = model_name(&manifests_root, &path) else { continue };
        let mut layers = Vec::new();
        let mut size = 0u64;
        for layer in manifest.layers.iter().chain(manifest.config.iter()) {
            let present = blob_path(&models_dir, &layer.digest).exists();
            referenced.insert(layer.digest.replace(':', "-"));
            size += layer.size;
            layers.push(OllamaLayer { digest: layer.digest.clone(), media_type: layer.media_type.clone(), size: layer.size, present });
        }
        let (family, parameter_size, quantization) =
            manifest.config.as_ref().map(|c| read_model_config(&models_dir, c)).unwrap_or((None, None, None));
        let mtime = std::fs::metadata(&path).ok().and_then(|m| m.modified().ok()).map(DateTime::<Utc>::from);
        let modified_secs_ago = mtime.map(|t| (Utc::now() - t).num_seconds().max(0) as u64);
        models.push(OllamaModel {
            name,
            manifest_path: path,
            size,
            layers,
            modified_at: mtime,
            modified_secs_ago,
            family,
            parameter_size,
            quantization,
        });
    }
    models.sort_by_key(|x| std::cmp::Reverse(x.size));
    let mut blob_bytes = 0u64;
    let mut orphan_blob_bytes = 0u64;
    let mut orphan_blobs = 0usize;
    for blob in fs_util::list_dir(&models_dir.join("blobs")) {
        let Ok(meta) = std::fs::metadata(&blob) else { continue };
        blob_bytes += meta.len();
        let name = blob.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if !referenced.contains(&name) {
            orphan_blob_bytes += meta.len();
            orphan_blobs += 1;
        }
    }
    let running = ctx
        .platform
        .processes()
        .map(|ps| ps.iter().any(|p| p.name == "ollama" || p.command.first().is_some_and(|c| c.ends_with("/ollama"))))
        .unwrap_or(false);
    OllamaInventory {
        installed: binary.is_some() || app_bundle_present || models_dir.exists(),
        binary,
        app_bundle_present,
        total_bytes: models.iter().map(|m| m.size).sum(),
        models_dir,
        models,
        blob_bytes,
        orphan_blob_bytes,
        orphan_blobs,
        running,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_model_names() {
        let root = Path::new("/m/manifests");
        assert_eq!(model_name(root, Path::new("/m/manifests/registry.ollama.ai/library/llama3.1/8b")).as_deref(), Some("llama3.1:8b"));
        assert_eq!(
            model_name(root, Path::new("/m/manifests/registry.ollama.ai/someone/custom/latest")).as_deref(),
            Some("someone/custom:latest")
        );
        assert_eq!(model_name(root, Path::new("/m/manifests/hf.co/org/model/Q4_K_M")).as_deref(), Some("hf.co/org/model:Q4_K_M"));
    }

    #[test]
    fn maps_blob_paths() {
        assert_eq!(blob_path(Path::new("/m"), "sha256:abc"), PathBuf::from("/m/blobs/sha256-abc"));
    }
}
