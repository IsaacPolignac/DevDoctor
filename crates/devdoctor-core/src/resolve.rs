//! Command resolution explorer: which executable runs when the user types a command, and which
//! other candidates exist further down the PATH.

use crate::command::CommandSpec;
use crate::context::SystemContext;
use crate::fs_util;
use crate::path_env::{classify_origin, PathOrigin};
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Executable {
    pub path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub real_path: Option<PathBuf>,
    pub is_symlink: bool,
    /// 1-based position of the containing directory in PATH.
    pub path_position: usize,
    pub directory: PathBuf,
    pub origin: PathOrigin,
    pub origin_label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shebang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecedenceEntry {
    pub position: usize,
    pub origin_label: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResolution {
    pub command: String,
    /// Alias definition from the login shell, if the command is aliased.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    /// True when the login shell defines a function with this name (e.g. `nvm`).
    pub shell_function: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<Executable>,
    pub others: Vec<Executable>,
    pub precedence: Vec<PrecedenceEntry>,
    pub notes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conflict: Option<String>,
}

/// Validates a command name: a single word without path separators.
pub fn validate_command_name(name: &str) -> Result<()> {
    if name.is_empty() || name.len() > 128 || name.contains('/') || name.contains(char::is_whitespace) || name.starts_with('-') {
        return Err(Error::invalid(format!("`{name}` is not a valid command name")));
    }
    Ok(())
}

/// All executables named `name` along the PATH entries, in precedence order.
pub fn find_in_path(entries: &[String], name: &str) -> Vec<(usize, PathBuf)> {
    let mut found = Vec::new();
    for (i, dir) in entries.iter().enumerate() {
        if dir.is_empty() {
            continue;
        }
        let candidate = Path::new(dir).join(name);
        if fs_util::is_executable_file(&candidate) {
            found.push((i + 1, candidate));
        }
    }
    found
}

pub fn read_shebang(path: &Path) -> Option<String> {
    use std::io::Read;
    let mut f = std::fs::File::open(path).ok()?;
    let mut buf = [0u8; 256];
    let n = f.read(&mut buf).ok()?;
    let head = &buf[..n];
    if !head.starts_with(b"#!") {
        return None;
    }
    let line = head.split(|b| *b == b'\n').next()?;
    Some(String::from_utf8_lossy(&line[2..]).trim().to_string())
}

/// Version flags for well-known commands. Unknown commands get `--version` with a short timeout.
fn version_args(name: &str) -> Vec<&'static str> {
    match name {
        "java" | "javac" => vec!["-version"],
        "go" => vec!["version"],
        "brew" | "node" | "npm" | "npx" | "pnpm" | "yarn" | "bun" | "deno" | "git" | "gh" | "ruby" | "gem" | "cargo" | "rustc"
        | "rustup" | "docker" | "ollama" | "claude" | "codex" | "gemini" | "opencode" | "aider" | "uv" | "uvx" | "pipx" | "pyenv"
        | "nvm" | "fnm" | "volta" | "asdf" | "mise" | "code" | "cursor" | "zsh" | "bash" | "fish" | "tmux" | "vim" | "nvim" | "make"
        | "cmake" | "swift" | "xcodebuild" | "conda" | "poetry" | "php" | "composer" | "perl" | "kubectl" | "helm" | "terraform"
        | "aws" | "gcloud" => vec!["--version"],
        n if n.starts_with("python") || n.starts_with("pip") => vec!["--version"],
        _ => vec!["--version"],
    }
}

/// Runs the executable with its version flag and returns the first meaningful output line.
pub fn version_of(ctx: &SystemContext, path: &Path) -> Option<String> {
    let key = path.to_path_buf();
    ctx.versions.get_or_insert_with(&key, || {
        let name = path.file_name()?.to_string_lossy().into_owned();
        let spec = CommandSpec::new(path.to_string_lossy().into_owned())
            .args(version_args(&name))
            .env("PATH", ctx.effective_path().raw.clone())
            .timeout_ms(4_000);
        let out = ctx.run(&spec).ok()?;
        if out.timed_out {
            return None;
        }
        let text = if out.stdout.trim().is_empty() { out.stderr } else { out.stdout };
        let line = text.lines().map(str::trim).find(|l| !l.is_empty())?;
        let mut line = line.to_string();
        if line.len() > 120 {
            line.truncate(120);
        }
        Some(line)
    })
}

fn executable_at(ctx: &SystemContext, position: usize, path: PathBuf, with_version: bool) -> Executable {
    let is_symlink = fs_util::is_symlink(&path);
    let real_path = std::fs::canonicalize(&path).ok().filter(|r| r != &path);
    let dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    // Classify on the real path when it is a symlink into a manager's tree (e.g. Homebrew Cellar).
    let classify_target = real_path.clone().unwrap_or_else(|| path.clone());
    let mut origin = classify_origin(&dir, &ctx.home, ctx.brew_prefix().as_deref());
    if origin == PathOrigin::System || origin == PathOrigin::Manual || origin == PathOrigin::UserLocalBin || origin == PathOrigin::Unknown {
        let by_target = classify_origin(&classify_target, &ctx.home, ctx.brew_prefix().as_deref());
        if by_target != PathOrigin::System && by_target != PathOrigin::Unknown && by_target != PathOrigin::Manual {
            origin = by_target;
        }
    }
    if origin == PathOrigin::System && dir == Path::new("/usr/local/bin") && !is_symlink {
        origin = PathOrigin::Installer;
    }
    let shebang = read_shebang(&path);
    if let Some(sb) = &shebang {
        if origin == PathOrigin::UserLocalBin || origin == PathOrigin::Manual {
            if sb.contains("/.local/pipx/") || sb.contains("/pipx/venvs/") {
                origin = PathOrigin::Pipx;
            } else if sb.contains("/uv/") || sb.contains("/.local/share/uv/") {
                origin = PathOrigin::Uv;
            } else if sb.contains("node") && sb.contains("/.claude/") {
                origin = PathOrigin::ClaudeCode;
            }
        }
    }
    if origin == PathOrigin::UserLocalBin && real_path.as_ref().is_some_and(|r| r.to_string_lossy().contains("/.claude/")) {
        origin = PathOrigin::ClaudeCode;
    }
    Executable {
        version: if with_version { version_of(ctx, &path) } else { None },
        real_path,
        is_symlink,
        path_position: position,
        directory: dir,
        origin,
        origin_label: origin.label().to_string(),
        shebang,
        path,
    }
}

/// Resolves a command name the way the user's login shell would (aliases and functions aside).
pub fn resolve_command(ctx: &SystemContext, name: &str, with_versions: bool) -> Result<CommandResolution> {
    validate_command_name(name)?;
    let capture = ctx.shell_capture();
    let found = find_in_path(&capture.path.entries, name);
    let mut executables: Vec<Executable> = found.into_iter().map(|(pos, p)| executable_at(ctx, pos, p, with_versions)).collect();
    let mut notes = Vec::new();
    let alias = capture.aliases.get(name).cloned();
    if let Some(a) = &alias {
        notes.push(format!("`{name}` is an alias in your shell: {name}={a}. The alias runs instead of the executable below."));
    }
    let shell_function = capture.functions.iter().any(|f| f == name);
    if shell_function {
        notes.push(format!("`{name}` is defined as a shell function; it takes precedence over any executable."));
    }
    let active = if executables.is_empty() { None } else { Some(executables.remove(0)) };
    let mut precedence: Vec<PrecedenceEntry> = Vec::new();
    for e in active.iter().chain(executables.iter()) {
        if !precedence.iter().any(|p| p.origin_label == e.origin_label) {
            precedence.push(PrecedenceEntry { position: e.path_position, origin_label: e.origin_label.clone(), path: e.directory.clone() });
        }
    }
    let mut conflict = None;
    if let Some(a) = &active {
        let distinct_targets: Vec<&Executable> =
            executables.iter().filter(|o| o.real_path.as_ref().or(Some(&o.path)) != a.real_path.as_ref().or(Some(&a.path))).collect();
        if !distinct_targets.is_empty() {
            let versions: Vec<String> = std::iter::once(a)
                .chain(distinct_targets.iter().copied())
                .filter_map(|e| e.version.clone())
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .collect();
            if versions.len() > 1 {
                conflict = Some(format!(
                    "{} installations with different versions are reachable: {}. `{name}` runs the one from {} because it comes first in PATH.",
                    distinct_targets.len() + 1,
                    versions.join(", "),
                    a.origin_label
                ));
            } else {
                notes.push(format!("{} other installation(s) of `{name}` exist further down PATH.", distinct_targets.len()));
            }
        }
        // Symlinks that point nowhere.
        if a.is_symlink && a.real_path.is_none() {
            notes.push(format!("{} is a broken symbolic link.", a.path.display()));
        }
    } else if !shell_function && alias.is_none() {
        notes.push(format!("`{name}` was not found in PATH."));
    }
    Ok(CommandResolution { command: name.to_string(), alias, shell_function, active, others: executables, precedence, notes, conflict })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_names() {
        assert!(validate_command_name("python3").is_ok());
        assert!(validate_command_name("../x").is_err());
        assert!(validate_command_name("a b").is_err());
        assert!(validate_command_name("").is_err());
    }

    #[test]
    fn finds_executables_in_order() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a");
        let b = dir.path().join("b");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        for d in [&a, &b] {
            let p = d.join("tool");
            std::fs::write(&p, "#!/bin/sh\necho hi\n").unwrap();
            std::fs::set_permissions(&p, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        }
        std::fs::write(b.join("notexec"), "x").unwrap();
        let entries = vec![b.to_string_lossy().into_owned(), a.to_string_lossy().into_owned()];
        let found = find_in_path(&entries, "tool");
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].0, 1);
        assert!(found[0].1.starts_with(&b));
        assert!(find_in_path(&entries, "notexec").is_empty());
        assert_eq!(read_shebang(&a.join("tool")).as_deref(), Some("/bin/sh"));
    }
}
