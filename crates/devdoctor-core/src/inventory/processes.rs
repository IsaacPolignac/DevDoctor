//! Classification of development-related processes and their safety rules.

use crate::context::SystemContext;
use crate::platform::{ListeningPort, ProcessInfo};
use crate::redact::redact_text;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DevProcessKind {
    Node,
    Python,
    Ruby,
    Java,
    Go,
    Rust,
    Ollama,
    Docker,
    Browser,
    Database,
    EditorTooling,
    Other,
}

impl DevProcessKind {
    pub fn label(&self) -> &'static str {
        match self {
            DevProcessKind::Node => "Node.js",
            DevProcessKind::Python => "Python",
            DevProcessKind::Ruby => "Ruby",
            DevProcessKind::Java => "Java",
            DevProcessKind::Go => "Go",
            DevProcessKind::Rust => "Rust",
            DevProcessKind::Ollama => "Ollama",
            DevProcessKind::Docker => "Docker",
            DevProcessKind::Browser => "Browser automation",
            DevProcessKind::Database => "Database",
            DevProcessKind::EditorTooling => "Editor tooling",
            DevProcessKind::Other => "Developer tool",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevProcess {
    pub pid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_pid: Option<u32>,
    pub name: String,
    pub kind: DevProcessKind,
    pub kind_label: String,
    /// Short human label such as "vite dev server" or "next dev".
    pub label: String,
    pub command: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub run_time_secs: Option<u64>,
    pub ports: Vec<u16>,
    /// Parent is launchd: the terminal or IDE that started it is gone.
    pub orphaned: bool,
    /// Working directory no longer exists.
    pub cwd_missing: bool,
    /// Looks abandoned: a dev server/script whose project directory is gone, or whose terminal
    /// is gone and that has been running for more than an hour. Daemons (databases, Docker,
    /// Ollama, editor tooling) are never considered stale because launchd is their normal parent.
    pub stale: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stale_reason: Option<String>,
    pub owned_by_user: bool,
    /// Whether DevDoctor allows stopping this process.
    pub stoppable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub not_stoppable_reason: Option<String>,
}

const PROTECTED_NAMES: &[&str] = &[
    "launchd",
    "kernel_task",
    "WindowServer",
    "loginwindow",
    "Finder",
    "Dock",
    "SystemUIServer",
    "Terminal",
    "iTerm2",
    "sshd",
    "coreaudiod",
    "mds",
    "mds_stores",
    "cfprefsd",
    "distnoted",
    "securityd",
    "opendirectoryd",
    "configd",
    "syslogd",
    "notifyd",
    "devdoctor",
    "DevDoctor",
    "Claude",
    "claude",
    "codex",
    "gemini",
    "opencode",
];

const DEV_SERVER_MARKERS: &[(&str, &str)] = &[
    ("vite", "vite dev server"),
    ("next dev", "next dev server"),
    ("next-server", "next.js server"),
    ("next start", "next.js server"),
    ("webpack", "webpack"),
    ("nodemon", "nodemon"),
    ("ts-node", "ts-node"),
    ("tsx ", "tsx"),
    ("nuxt", "nuxt"),
    ("astro", "astro"),
    ("remix", "remix"),
    ("react-scripts", "react-scripts"),
    ("expo", "expo"),
    ("metro", "metro bundler"),
    ("storybook", "storybook"),
    ("esbuild", "esbuild"),
    ("turbo", "turborepo"),
    ("jest", "jest"),
    ("vitest", "vitest"),
    ("playwright", "playwright"),
    ("uvicorn", "uvicorn"),
    ("gunicorn", "gunicorn"),
    ("flask", "flask"),
    ("manage.py runserver", "django dev server"),
    ("streamlit", "streamlit"),
    ("jupyter", "jupyter"),
    ("fastapi", "fastapi"),
    ("http.server", "python http.server"),
    ("rails server", "rails server"),
    ("puma", "puma"),
];

fn classify(name: &str, command: &str) -> Option<(DevProcessKind, String)> {
    let lower = command.to_ascii_lowercase();
    let lname = name.to_ascii_lowercase();
    let base = Path::new(name).file_name().map(|n| n.to_string_lossy().to_ascii_lowercase()).unwrap_or(lname.clone());
    let server_label = DEV_SERVER_MARKERS.iter().find(|(m, _)| lower.contains(m)).map(|(_, l)| l.to_string());
    if base == "ollama" || lower.contains("ollama runner") || lower.contains("/ollama ") {
        return Some((
            DevProcessKind::Ollama,
            if lower.contains("runner") { "ollama model runner".into() } else { "ollama server".into() },
        ));
    }
    if base.starts_with("com.docker")
        || base == "docker"
        || base == "dockerd"
        || base == "containerd"
        || lower.contains("docker.app")
        || base.contains("orbstack")
    {
        return Some((DevProcessKind::Docker, "docker".into()));
    }
    if lower.contains("ms-playwright")
        || lower.contains("chrome-for-testing")
        || lower.contains("puppeteer")
        || (lower.contains("--remote-debugging-port") && (lower.contains("chrom") || lower.contains("chrome")))
        || lower.contains("--headless")
    {
        return Some((DevProcessKind::Browser, "automated browser".into()));
    }
    if base == "postgres"
        || base == "postmaster"
        || base.starts_with("redis-server")
        || base == "mysqld"
        || base == "mariadbd"
        || base == "mongod"
        || base == "memcached"
        || base == "influxd"
        || base == "clickhouse"
        || base == "etcd"
    {
        return Some((DevProcessKind::Database, base.clone()));
    }
    if lower.contains("tsserver")
        || lower.contains("typescript-language-server")
        || base == "rust-analyzer"
        || base == "gopls"
        || lower.contains("pyright")
        || lower.contains("eslint_d")
        || lower.contains("prettierd")
        || lower.contains("copilot")
        || lower.contains("language-server")
        || lower.contains("lsp")
    {
        return Some((DevProcessKind::EditorTooling, "language server".into()));
    }
    if base == "node" || base.starts_with("node") && base.len() <= 6 || base == "bun" || base == "deno" {
        return Some((DevProcessKind::Node, server_label.unwrap_or_else(|| format!("{base} process"))));
    }
    if base.starts_with("python") || base == "uvicorn" || base == "gunicorn" || base == "jupyter" || base == "streamlit" {
        return Some((DevProcessKind::Python, server_label.unwrap_or_else(|| "python process".into())));
    }
    if base == "ruby" || base == "puma" || base == "rails" {
        return Some((DevProcessKind::Ruby, server_label.unwrap_or_else(|| "ruby process".into())));
    }
    if base == "java" || base == "gradle" || base.contains("kotlin") {
        return Some((DevProcessKind::Java, "java process".into()));
    }
    if base == "cargo" || base == "rustc" || lower.contains("/target/debug/") || lower.contains("/target/release/") {
        return Some((DevProcessKind::Rust, "rust build or binary".into()));
    }
    if base == "go" || lower.contains("/go-build") {
        return Some((DevProcessKind::Go, "go process".into()));
    }
    if let Some(label) = server_label {
        return Some((DevProcessKind::Other, label));
    }
    None
}

fn project_root(cwd: &Path) -> Option<PathBuf> {
    let markers = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "Gemfile", ".git", "requirements.txt"];
    let mut cur = Some(cwd);
    let mut depth = 0;
    while let Some(dir) = cur {
        if markers.iter().any(|m| dir.join(m).exists()) {
            return Some(dir.to_path_buf());
        }
        cur = dir.parent();
        depth += 1;
        if depth > 6 {
            break;
        }
    }
    None
}

/// Classifies developer-related processes and attaches listening ports.
pub fn dev_processes(ctx: &SystemContext, processes: &[ProcessInfo], ports: &[ListeningPort]) -> Vec<DevProcess> {
    let uid = ctx.platform.current_uid();
    let mut out = Vec::new();
    for p in processes {
        let command = redact_text(&p.command_line());
        let Some((kind, label)) = classify(&p.name, &command) else { continue };
        let owned = p.user_id.is_none_or(|u| u == uid);
        let base = Path::new(&p.name).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(p.name.clone());
        let protected = PROTECTED_NAMES.iter().any(|n| n.eq_ignore_ascii_case(&base));
        let (stoppable, reason) = if !owned {
            (false, Some("owned by another user".to_string()))
        } else if protected {
            (false, Some("protected system or DevDoctor process".to_string()))
        } else if p.pid <= 1 || p.pid == std::process::id() {
            (false, Some("core process".to_string()))
        } else {
            (true, None)
        };
        let cwd_missing = p.cwd.as_ref().is_some_and(|c| !c.exists());
        let orphaned = p.parent_pid == Some(1);
        let server_like = matches!(
            kind,
            DevProcessKind::Node | DevProcessKind::Python | DevProcessKind::Ruby | DevProcessKind::Other | DevProcessKind::Browser
        );
        let stale_reason = if !server_like {
            None
        } else if cwd_missing {
            Some(format!("its working directory {} no longer exists", ctx.display_path(p.cwd.as_deref().unwrap_or(Path::new("")))))
        } else if orphaned && p.run_time_secs.is_some_and(|s| s > 3600) {
            Some("its parent process is launchd, meaning the terminal or editor that started it has been closed, and it has been running for more than an hour".to_string())
        } else {
            None
        };
        let project_path = p.cwd.as_deref().and_then(project_root).or_else(|| {
            // Look for a project path inside the command line (e.g. node /Users/me/app/server.js).
            command
                .split_whitespace()
                .filter(|a| a.starts_with('/'))
                .filter_map(|a| project_root(Path::new(a).parent().unwrap_or(Path::new(a))))
                .next()
        });
        let proc_ports: Vec<u16> = ports
            .iter()
            .filter(|port| port.pid == Some(p.pid))
            .map(|port| port.port)
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect();
        out.push(DevProcess {
            pid: p.pid,
            parent_pid: p.parent_pid,
            name: base,
            kind,
            kind_label: kind.label().to_string(),
            label,
            command,
            cwd: p.cwd.clone(),
            project_path,
            cpu_percent: p.cpu_percent,
            memory_bytes: p.memory_bytes,
            run_time_secs: p.run_time_secs,
            ports: proc_ports,
            orphaned,
            cwd_missing,
            stale: stale_reason.is_some(),
            stale_reason,
            owned_by_user: owned,
            stoppable,
            not_stoppable_reason: reason,
        });
    }
    out.sort_by_key(|p| std::cmp::Reverse(p.memory_bytes.unwrap_or(0)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_common_processes() {
        assert_eq!(classify("node", "node /app/node_modules/.bin/vite --port 5173").map(|c| c.1).as_deref(), Some("vite dev server"));
        assert_eq!(
            classify("ollama", "/Applications/Ollama.app/Contents/Resources/ollama serve").map(|c| c.0),
            Some(DevProcessKind::Ollama)
        );
        assert_eq!(classify("postgres", "postgres -D /opt/homebrew/var/postgresql@16").map(|c| c.0), Some(DevProcessKind::Database));
        assert_eq!(
            classify("Chromium", "/Users/me/Library/Caches/ms-playwright/chromium-1140/chrome --headless").map(|c| c.0),
            Some(DevProcessKind::Browser)
        );
        assert!(classify("Finder", "/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder").is_none());
        assert_eq!(classify("python3.12", "python3.12 -m uvicorn app:app --reload").map(|c| c.1).as_deref(), Some("uvicorn"));
    }
}
