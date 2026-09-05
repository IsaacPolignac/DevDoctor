//! Python installations and the python/pip pairing.

use crate::context::SystemContext;
use crate::fs_util;
use crate::resolve::{read_shebang, resolve_command, version_of, Executable};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PythonSource {
    System,
    Homebrew,
    Pyenv,
    Uv,
    Conda,
    PythonOrg,
    Other,
}

impl PythonSource {
    pub fn label(&self) -> &'static str {
        match self {
            PythonSource::System => "macOS / Command Line Tools",
            PythonSource::Homebrew => "Homebrew",
            PythonSource::Pyenv => "pyenv",
            PythonSource::Uv => "uv",
            PythonSource::Conda => "conda",
            PythonSource::PythonOrg => "python.org installer",
            PythonSource::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonInstallation {
    pub source: PythonSource,
    pub label: String,
    pub binary: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipMismatch {
    pub pip_command: String,
    pub pip_path: PathBuf,
    pub pip_interpreter: PathBuf,
    pub python_command: String,
    pub python_path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python_real_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pip_python_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonInventory {
    pub installations: Vec<PythonInstallation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python3: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pip: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pip3: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python_alias: Option<String>,
    pub pip_mismatches: Vec<PipMismatch>,
    /// `python` and `python3` resolve to different interpreters.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub python_python3_mismatch: Option<String>,
    pub broken_links: Vec<PathBuf>,
    pub notes: Vec<String>,
}

fn version_from_path(path: &Path) -> Option<String> {
    let s = path.to_string_lossy().replace('\\', "/");
    // /opt/homebrew/Cellar/python@3.12/3.12.4/... , ~/.pyenv/versions/3.11.9/..., uv cpython-3.12.4-...,
    // C:\\Users\\me\\AppData\\Local\\Programs\\Python\\Python312\\python.exe
    for part in s.split('/') {
        if let Some(digits) = part.strip_prefix("Python").filter(|d| d.len() >= 2 && d.chars().all(|c| c.is_ascii_digit())) {
            return Some(format!("{}.{}", &digits[..1], &digits[1..]));
        }
        if let Some(rest) = part.strip_prefix("cpython-") {
            let v: String = rest.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
            if v.contains('.') {
                return Some(v);
            }
        }
        if part.chars().next().is_some_and(|c| c.is_ascii_digit())
            && part.matches('.').count() >= 2
            && part.chars().all(|c| c.is_ascii_digit() || c == '.')
        {
            return Some(part.to_string());
        }
    }
    None
}

fn push_install(list: &mut Vec<PythonInstallation>, source: PythonSource, binary: PathBuf, version: Option<String>) {
    if !fs_util::is_executable_file(&binary) {
        return;
    }
    let real = std::fs::canonicalize(&binary).unwrap_or(binary.clone());
    if list.iter().any(|i| std::fs::canonicalize(&i.binary).map(|r| r == real).unwrap_or(false)) {
        return;
    }
    list.push(PythonInstallation { label: source.label().to_string(), source, binary, version, active: false });
}

/// The interpreter a pip script uses, from its shebang.
pub fn pip_interpreter(pip: &Path) -> Option<PathBuf> {
    let shebang = read_shebang(pip)?;
    let mut parts = shebang.split_whitespace();
    let first = parts.next()?;
    if first.ends_with("/env") {
        // `#!/usr/bin/env python3` -> cannot know statically
        return None;
    }
    Some(PathBuf::from(first))
}

pub fn inventory(ctx: &SystemContext) -> PythonInventory {
    let home = &ctx.home;
    let mut installs = Vec::new();
    let mut broken_links = Vec::new();
    let mut notes = Vec::new();

    if let Some(prefix) = ctx.brew_prefix() {
        for entry in fs_util::list_dir(&prefix.join("Cellar")) {
            let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if name == "python" || name.starts_with("python@") {
                for ver in fs_util::list_dir(&entry) {
                    let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                    let short: String = vname.split('.').take(2).collect::<Vec<_>>().join(".");
                    let bin = ver.join(format!("bin/python{short}"));
                    let bin = if bin.exists() { bin } else { ver.join("bin/python3") };
                    push_install(&mut installs, PythonSource::Homebrew, bin, Some(vname));
                }
            }
        }
        for entry in fs_util::list_dir(&prefix.join("bin")) {
            let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if (name.starts_with("python") || name.starts_with("pip")) && fs_util::is_symlink(&entry) && std::fs::metadata(&entry).is_err()
            {
                broken_links.push(entry);
            }
        }
    }
    let pyenv_root = ctx.shell_capture().vars.get("PYENV_ROOT").map(PathBuf::from).unwrap_or_else(|| home.join(".pyenv"));
    for ver in fs_util::list_dir(&pyenv_root.join("versions")) {
        let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        push_install(&mut installs, PythonSource::Pyenv, ver.join("bin/python3"), Some(vname));
    }
    let uv_pythons = ctx
        .shell_capture()
        .vars
        .get("XDG_DATA_HOME")
        .map(|x| PathBuf::from(x).join("uv/python"))
        .unwrap_or_else(|| home.join(".local/share/uv/python"));
    for ver in fs_util::list_dir(&uv_pythons) {
        let bin = ver.join("bin/python3");
        push_install(&mut installs, PythonSource::Uv, bin.clone(), version_from_path(&ver));
    }
    for conda in ["miniconda3", "anaconda3", "miniforge3", "mambaforge", ".miniconda3", "opt/miniconda3", "opt/anaconda3"] {
        let root = home.join(conda);
        if root.join("bin/python").exists() {
            push_install(&mut installs, PythonSource::Conda, root.join("bin/python"), None);
            for env in fs_util::list_dir(&root.join("envs")) {
                push_install(&mut installs, PythonSource::Conda, env.join("bin/python"), None);
            }
        }
    }
    for ver in fs_util::list_dir(Path::new("/Library/Frameworks/Python.framework/Versions")) {
        let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if vname == "Current" {
            continue;
        }
        push_install(&mut installs, PythonSource::PythonOrg, ver.join("bin/python3"), Some(vname));
    }
    if cfg!(windows) {
        // python.org installer (per-user and all-users), pyenv-win, uv and conda on Windows.
        let mut roots: Vec<PathBuf> = Vec::new();
        if let Some(local) = crate::sys::local_app_data() {
            roots.push(local.join("Programs").join("Python"));
        }
        for var in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(pf) = ctx.env.get(var) {
                roots.push(PathBuf::from(pf));
            }
        }
        for root in roots {
            for dir in fs_util::list_dir(&root) {
                let name = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                if name.starts_with("Python") && dir.join("python.exe").exists() {
                    push_install(&mut installs, PythonSource::PythonOrg, dir.join("python.exe"), version_from_path(&dir));
                }
            }
        }
        for ver in fs_util::list_dir(&pyenv_root.join("pyenv-win").join("versions")) {
            let vname = ver.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            push_install(&mut installs, PythonSource::Pyenv, ver.join("python.exe"), Some(vname));
        }
        if let Some(appdata) = ctx.env.get("APPDATA") {
            for ver in fs_util::list_dir(&Path::new(appdata).join("uv").join("python")) {
                push_install(&mut installs, PythonSource::Uv, ver.join("python.exe"), version_from_path(&ver));
            }
        }
        let mut conda_roots = vec![home.join("miniconda3"), home.join("anaconda3"), home.join("miniforge3")];
        if let Some(local) = crate::sys::local_app_data() {
            conda_roots.push(local.join("miniconda3"));
            conda_roots.push(local.join("anaconda3"));
        }
        for root in conda_roots {
            if root.join("python.exe").exists() {
                push_install(&mut installs, PythonSource::Conda, root.join("python.exe"), None);
                for env in fs_util::list_dir(&root.join("envs")) {
                    push_install(&mut installs, PythonSource::Conda, env.join("python.exe"), None);
                }
            }
        }
    } else {
        push_install(&mut installs, PythonSource::System, PathBuf::from("/usr/bin/python3"), None);
    }

    let python = resolve_command(ctx, "python", true).ok();
    let python3 = resolve_command(ctx, "python3", true).ok();
    let pip = resolve_command(ctx, "pip", true).ok();
    let pip3 = resolve_command(ctx, "pip3", true).ok();
    let python_alias = python.as_ref().and_then(|r| r.alias.clone());
    if cfg!(windows) {
        for (cmd, res) in [("python", &python), ("python3", &python3)] {
            if let Some(active) = res.as_ref().and_then(|r| r.active.as_ref()) {
                let s = active.path.to_string_lossy();
                let stub = s.contains("WindowsApps") && std::fs::metadata(&active.path).map(|m| m.len() == 0).unwrap_or(false);
                if stub {
                    notes.push(format!("`{cmd}` resolves to the Microsoft Store app execution alias ({s}), not to an installed interpreter: running it opens the Store. Install Python or disable the alias in Settings > Apps > Advanced app settings > App execution aliases."));
                }
            }
        }
    }

    for r in [&python, &python3] {
        if let Some(active) = r.as_ref().and_then(|r| r.active.as_ref()) {
            push_install(
                &mut installs,
                PythonSource::Other,
                active.path.clone(),
                active.version.clone().map(|v| v.trim_start_matches("Python ").to_string()),
            );
        }
    }
    let active_real: Vec<PathBuf> = [&python, &python3]
        .iter()
        .filter_map(|r| r.as_ref().and_then(|r| r.active.as_ref()).and_then(|e| std::fs::canonicalize(&e.path).ok()))
        .collect();
    for inst in &mut installs {
        if let Ok(real) = std::fs::canonicalize(&inst.binary) {
            inst.active = active_real.iter().any(|a| a == &real);
        }
        if inst.version.is_none() && inst.active {
            inst.version = version_of(ctx, &inst.binary).map(|v| v.trim_start_matches("Python ").to_string());
        }
    }

    let mut pip_mismatches = Vec::new();
    for (pip_cmd, pip_res, py_cmd, py_res) in [("pip3", &pip3, "python3", &python3), ("pip", &pip, "python", &python)] {
        let (Some(pip_exe), Some(py_exe)) =
            (pip_res.as_ref().and_then(|r| r.active.as_ref()), py_res.as_ref().and_then(|r| r.active.as_ref()))
        else {
            continue;
        };
        let Some(interp) = pip_interpreter(&pip_exe.path) else { continue };
        let interp_real = std::fs::canonicalize(&interp).unwrap_or(interp.clone());
        let py_real = std::fs::canonicalize(&py_exe.path).ok();
        let same = py_real.as_ref().is_some_and(|p| p == &interp_real)
            || same_installation(&interp_real, py_real.as_deref().unwrap_or(&py_exe.path));
        if !same {
            let pip_python_version = version_from_path(&interp_real)
                .or_else(|| version_of(ctx, &interp_real).map(|v| v.trim_start_matches("Python ").to_string()));
            pip_mismatches.push(PipMismatch {
                pip_command: pip_cmd.to_string(),
                pip_path: pip_exe.path.clone(),
                pip_interpreter: interp_real,
                python_command: py_cmd.to_string(),
                python_path: py_exe.path.clone(),
                python_real_path: py_real,
                python_version: py_exe.version.clone().map(|v| v.trim_start_matches("Python ").to_string()),
                pip_python_version,
            });
        }
    }
    let python_python3_mismatch = match (python.as_ref().and_then(|r| r.active.as_ref()), python3.as_ref().and_then(|r| r.active.as_ref()))
    {
        (Some(p), Some(p3)) => {
            let pr = std::fs::canonicalize(&p.path).unwrap_or(p.path.clone());
            let p3r = std::fs::canonicalize(&p3.path).unwrap_or(p3.path.clone());
            if pr != p3r && !same_installation(&pr, &p3r) {
                Some(format!(
                    "`python` runs {} ({}) while `python3` runs {} ({})",
                    pr.display(),
                    p.version.clone().unwrap_or_else(|| "unknown version".into()),
                    p3r.display(),
                    p3.version.clone().unwrap_or_else(|| "unknown version".into())
                ))
            } else {
                None
            }
        }
        _ => None,
    };
    if installs.is_empty() {
        notes.push("No Python installation found.".into());
    }
    installs.sort_by(|a, b| b.active.cmp(&a.active).then(a.label.cmp(&b.label)).then(b.version.cmp(&a.version)));
    PythonInventory {
        installations: installs,
        python: python.and_then(|r| r.active),
        python3: python3.and_then(|r| r.active),
        pip: pip.and_then(|r| r.active),
        pip3: pip3.and_then(|r| r.active),
        python_alias,
        pip_mismatches,
        python_python3_mismatch,
        broken_links,
        notes,
    }
}

/// Two interpreter paths that belong to the same installation (e.g. `python3.12` and
/// `python3` inside one framework or Cellar directory).
fn same_installation(a: &Path, b: &Path) -> bool {
    let (Some(pa), Some(pb)) = (a.parent(), b.parent()) else { return false };
    pa == pb && version_from_path(a) == version_from_path(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_versions_from_paths() {
        assert_eq!(version_from_path(Path::new("/opt/homebrew/Cellar/python@3.12/3.12.4/bin/python3.12")).as_deref(), Some("3.12.4"));
        assert_eq!(version_from_path(Path::new("/Users/me/.pyenv/versions/3.11.9/bin/python3")).as_deref(), Some("3.11.9"));
        assert_eq!(
            version_from_path(Path::new("/Users/me/.local/share/uv/python/cpython-3.13.1-macos-aarch64-none/bin/python3")).as_deref(),
            Some("3.13.1")
        );
        assert_eq!(version_from_path(Path::new("/usr/bin/python3")), None);
    }

    #[test]
    fn reads_pip_interpreter_from_shebang() {
        let dir = tempfile::tempdir().unwrap();
        let pip = dir.path().join("pip3");
        std::fs::write(&pip, "#!/opt/homebrew/opt/python@3.11/bin/python3.11\n# -*- coding: utf-8 -*-\n").unwrap();
        assert_eq!(pip_interpreter(&pip), Some(PathBuf::from("/opt/homebrew/opt/python@3.11/bin/python3.11")));
        let env_pip = dir.path().join("pip");
        std::fs::write(&env_pip, "#!/usr/bin/env python3\n").unwrap();
        assert_eq!(pip_interpreter(&env_pip), None);
    }
}
