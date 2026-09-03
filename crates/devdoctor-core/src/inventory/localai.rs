//! Local AI ecosystems beyond Ollama: Hugging Face cache, MLX, LM Studio, llama.cpp.

use crate::context::SystemContext;
use crate::fs_util;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub name: String,
    pub path: PathBuf,
    pub bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_used_secs_ago: Option<u64>,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAiSource {
    pub id: String,
    pub label: String,
    pub root: PathBuf,
    pub present: bool,
    pub bytes: u64,
    pub models: Vec<ModelEntry>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAiReport {
    pub ollama: super::ollama::OllamaInventory,
    pub sources: Vec<LocalAiSource>,
    pub total_bytes: u64,
    pub duration_ms: u64,
}

fn secs_ago(path: &Path) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;
    let m = std::fs::metadata(path).ok()?;
    let now = chrono::Utc::now().timestamp();
    Some(now.saturating_sub(m.mtime()).max(0) as u64)
}

fn hf_repos(hub: &Path, kind: &str) -> Vec<ModelEntry> {
    let prefix = format!("{kind}--");
    fs_util::list_dir(hub)
        .into_iter()
        .filter(|p| p.is_dir() && p.file_name().is_some_and(|n| n.to_string_lossy().starts_with(&prefix)))
        .map(|p| {
            let dir_name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let name = dir_name.trim_start_matches(&prefix).replace("--", "/");
            let bytes = fs_util::dir_size(&p).allocated;
            ModelEntry {
                last_used_secs_ago: secs_ago(&p.join("refs")).or_else(|| secs_ago(&p)),
                name,
                path: p,
                bytes,
                kind: kind.to_string(),
            }
        })
        .collect()
}

fn model_files(root: &Path, depth: usize, out: &mut Vec<ModelEntry>) {
    if depth > 3 {
        return;
    }
    for entry in fs_util::list_dir(root) {
        if entry.is_dir() {
            model_files(&entry, depth + 1, out);
        } else if entry.extension().is_some_and(|e| {
            matches!(e.to_string_lossy().to_ascii_lowercase().as_str(), "gguf" | "safetensors" | "bin" | "pt" | "mlmodel" | "onnx")
        }) {
            let bytes = std::fs::metadata(&entry).map(|m| m.len()).unwrap_or(0);
            if bytes < 50_000_000 {
                continue;
            }
            let name = entry.strip_prefix(root).map(|r| r.to_string_lossy().into_owned()).unwrap_or_default();
            out.push(ModelEntry { name, last_used_secs_ago: secs_ago(&entry), path: entry, bytes, kind: "file".into() });
        }
    }
}

pub fn report(ctx: &SystemContext) -> LocalAiReport {
    let start = std::time::Instant::now();
    let home = &ctx.home;
    let vars = &ctx.shell_capture().vars;
    let ollama = super::ollama::inventory(ctx);
    let mut sources = Vec::new();

    let hf_home = vars.get("HF_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".cache/huggingface"));
    let hub = vars.get("HUGGINGFACE_HUB_CACHE").map(PathBuf::from).unwrap_or_else(|| hf_home.join("hub"));
    let mut hf_models = hf_repos(&hub, "models");
    hf_models.extend(hf_repos(&hub, "datasets"));
    hf_models.sort_by_key(|x| std::cmp::Reverse(x.bytes));
    let (mlx_models, hf_models): (Vec<ModelEntry>, Vec<ModelEntry>) =
        hf_models.into_iter().partition(|m| m.name.starts_with("mlx-community/") || m.name.to_ascii_lowercase().contains("mlx"));
    let hf_bytes = hf_models.iter().map(|m| m.bytes).sum::<u64>()
        + if hf_home.exists() {
            fs_util::dir_size(&hf_home)
                .allocated
                .saturating_sub(hf_models.iter().map(|m| m.bytes).sum::<u64>() + mlx_models.iter().map(|m| m.bytes).sum::<u64>())
        } else {
            0
        };
    sources.push(LocalAiSource {
        id: "huggingface".into(),
        label: "Hugging Face cache".into(),
        present: hub.exists(),
        root: hub.clone(),
        bytes: hf_bytes,
        models: hf_models,
        description: "Repositories downloaded by transformers, diffusers, sentence-transformers and the huggingface_hub CLI.".into(),
    });
    let mlx_bytes = mlx_models.iter().map(|m| m.bytes).sum::<u64>()
        + [home.join(".cache/mlx"), home.join(".mlx")].iter().map(|p| fs_util::dir_size(p).allocated).sum::<u64>();
    sources.push(LocalAiSource {
        id: "mlx".into(),
        label: "MLX models".into(),
        present: !mlx_models.is_empty() || home.join(".cache/mlx").exists(),
        root: hub.clone(),
        bytes: mlx_bytes,
        models: mlx_models,
        description: "MLX-community models (stored inside the Hugging Face cache) and MLX caches.".into(),
    });
    for (id, label, root, description) in [
        (
            "lmstudio",
            "LM Studio",
            [home.join(".lmstudio/models"), home.join(".cache/lm-studio/models")]
                .into_iter()
                .find(|p| p.exists())
                .unwrap_or_else(|| home.join(".lmstudio/models")),
            "Models downloaded through LM Studio.",
        ),
        ("llamacpp", "llama.cpp", home.join(".cache/llama.cpp"), "Models downloaded by llama.cpp's `-hf` option."),
    ] {
        let mut models = Vec::new();
        if root.exists() {
            model_files(&root, 0, &mut models);
        }
        models.sort_by_key(|x| std::cmp::Reverse(x.bytes));
        let bytes = if root.exists() { fs_util::dir_size(&root).allocated } else { 0 };
        sources.push(LocalAiSource {
            id: id.into(),
            label: label.into(),
            present: root.exists(),
            root,
            bytes,
            models,
            description: description.into(),
        });
    }
    let total_bytes = ollama.total_bytes + sources.iter().map(|s| s.bytes).sum::<u64>();
    LocalAiReport { ollama, sources, total_bytes, duration_ms: start.elapsed().as_millis() as u64 }
}
