//! Operating-system primitives behind one portable interface. Every function here has a Unix
//! and a Windows implementation with the same signature; nothing else in the engine touches
//! `std::os::unix` or `std::os::windows` directly, so a platform port is a matter of filling in
//! this file and a `Platform` adapter.

use std::fs::Metadata;
use std::path::{Path, PathBuf};

/// Separator between PATH entries (`:` on Unix, `;` on Windows).
pub const PATH_LIST_SEPARATOR: char = if cfg!(windows) { ';' } else { ':' };

/// Splits a PATH-like string into its entries. Empty entries are kept: they mean "the current
/// directory" to the shell and DevDoctor reports them.
pub fn split_path_list(raw: &str) -> Vec<String> {
    if raw.is_empty() {
        return Vec::new();
    }
    #[cfg(windows)]
    {
        // Handles the quoted `"c:\some;dir"` form that Windows allows.
        std::env::split_paths(raw).map(|p| p.to_string_lossy().into_owned()).collect()
    }
    #[cfg(not(windows))]
    {
        raw.split(':').map(str::to_string).collect()
    }
}

pub fn join_path_list(entries: &[String]) -> String {
    entries.join(&PATH_LIST_SEPARATOR.to_string())
}

/// Whether a raw PATH entry is absolute for this OS. A leading `~` counts because the shell
/// expands it before the entry is used.
pub fn is_absolute_entry(raw: &str) -> bool {
    raw.starts_with('~') || Path::new(raw).is_absolute()
}

/// Whether two PATH entries name the same directory once normalised. Windows paths are
/// case-insensitive.
pub fn fold_case(entry: &str) -> String {
    if cfg!(windows) {
        entry.to_ascii_lowercase()
    } else {
        entry.to_string()
    }
}

/// Unix permission bits (`0o7777` mask). `None` on Windows, where they do not exist.
pub fn mode_of(meta: &Metadata) -> Option<u32> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        Some(meta.permissions().mode() & 0o7777)
    }
    #[cfg(not(unix))]
    {
        let _ = meta;
        None
    }
}

/// Applies Unix permission bits. A no-op on Windows.
pub fn set_mode(path: &Path, mode: u32) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode));
    }
    #[cfg(not(unix))]
    {
        let _ = (path, mode);
    }
}

/// Modification time in seconds since the Unix epoch (0 when unavailable).
pub fn mtime_secs(meta: &Metadata) -> i64 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        meta.mtime()
    }
    #[cfg(not(unix))]
    {
        meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or(0)
    }
}

/// Bytes actually allocated on disk for one entry (`st_blocks * 512` on Unix, what `du`
/// reports). Windows does not expose allocation sizes through std, so the logical size is used.
pub fn allocated_bytes(meta: &Metadata) -> u64 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        meta.blocks() * 512
    }
    #[cfg(not(unix))]
    {
        meta.len()
    }
}

/// `(device, inode, link count)` so that hard links are counted once. Windows reports
/// `(0, 0, 1)`: std does not expose file ids on stable and hard links are rare there.
pub fn file_identity(meta: &Metadata) -> (u64, u64, u64) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        (meta.dev(), meta.ino(), meta.nlink())
    }
    #[cfg(not(unix))]
    {
        let _ = meta;
        (0, 0, 1)
    }
}

/// Whether the current user may write into `path`. `None` when it cannot be determined.
pub fn is_writable(path: &Path) -> Option<bool> {
    #[cfg(unix)]
    {
        let c = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).ok()?;
        // SAFETY: access(2) with a valid NUL-terminated path; no memory is retained.
        let rc = unsafe { libc::access(c.as_ptr(), libc::W_OK) };
        Some(rc == 0)
    }
    #[cfg(not(unix))]
    {
        let meta = std::fs::metadata(path).ok()?;
        Some(!meta.permissions().readonly())
    }
}

/// Whether every user may write into the directory (Unix `o+w`). Always false on Windows,
/// where ACLs replace mode bits.
pub fn is_world_writable(meta: &Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.permissions().mode() & 0o002 != 0
    }
    #[cfg(not(unix))]
    {
        let _ = meta;
        false
    }
}

/// Executable extensions recognised by the Windows command interpreter (`PATHEXT`), lower-case
/// with the leading dot.
#[cfg(windows)]
pub fn executable_extensions() -> Vec<String> {
    std::env::var("PATHEXT")
        .ok()
        .map(|v| v.split(';').filter(|s| !s.is_empty()).map(|s| s.to_ascii_lowercase()).collect::<Vec<_>>())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| [".com", ".exe", ".bat", ".cmd"].iter().map(|s| s.to_string()).collect())
}

/// Whether `path` is a regular file the current user can execute.
pub fn is_executable_file(path: &Path) -> bool {
    let Ok(meta) = std::fs::metadata(path) else { return false };
    if !meta.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy().to_ascii_lowercase())).unwrap_or_default();
        executable_extensions().contains(&ext)
    }
}

/// File names a command may have inside a directory: the bare name on Unix; on Windows the
/// name with every `PATHEXT` extension (`node` → `node.exe`, `node.cmd`, ...), plus the bare
/// name when it already carries an extension.
pub fn command_candidates(dir: &Path, name: &str) -> Vec<PathBuf> {
    #[cfg(unix)]
    {
        vec![dir.join(name)]
    }
    #[cfg(not(unix))]
    {
        let mut v = Vec::new();
        if Path::new(name).extension().is_some() {
            v.push(dir.join(name));
        }
        for ext in executable_extensions() {
            v.push(dir.join(format!("{name}{ext}")));
        }
        v
    }
}

/// Creates a symbolic link (`link` → `target`). On Windows the link kind follows the target.
pub fn symlink(target: &Path, link: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link)
    }
    #[cfg(windows)]
    {
        let resolved = if target.is_absolute() {
            target.to_path_buf()
        } else {
            link.parent().map(|p| p.join(target)).unwrap_or_else(|| target.to_path_buf())
        };
        if resolved.is_dir() {
            std::os::windows::fs::symlink_dir(target, link)
        } else {
            std::os::windows::fs::symlink_file(target, link)
        }
    }
}

/// Directories searched for programs after PATH: the usual system and user locations for
/// this OS.
pub fn well_known_bin_dirs(home: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if cfg!(windows) {
        for var in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "SystemRoot"] {
            let Some(base) = std::env::var_os(var).map(PathBuf::from) else { continue };
            match var {
                "LOCALAPPDATA" => {
                    dirs.push(base.join("Microsoft").join("WindowsApps"));
                    dirs.push(base.join("Programs").join("Git").join("cmd"));
                }
                "SystemRoot" => {
                    dirs.push(base.join("System32"));
                    dirs.push(base.join("System32").join("WindowsPowerShell").join("v1.0"));
                }
                _ => {
                    dirs.push(base.join("Git").join("cmd"));
                    dirs.push(base.join("nodejs"));
                    dirs.push(base.join("PowerShell").join("7"));
                }
            }
        }
    } else {
        for d in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
            dirs.push(PathBuf::from(d));
        }
    }
    dirs.push(home.join(".local").join("bin"));
    dirs.push(home.join(".cargo").join("bin"));
    dirs
}

/// The interpreter a new terminal runs when `SHELL` is not set.
pub fn default_shell_path() -> PathBuf {
    if cfg!(windows) {
        std::env::var_os("SystemRoot")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe")
    } else {
        PathBuf::from("/bin/zsh")
    }
}

/// `%LOCALAPPDATA%` (Windows) or `None`.
pub fn local_app_data() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    } else {
        None
    }
}

/// Short name of the operating system family DevDoctor is running on, for messages.
pub fn os_label() -> &'static str {
    if cfg!(target_os = "macos") {
        "this Mac"
    } else if cfg!(windows) {
        "this PC"
    } else {
        "this machine"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_and_keeps_empty_entries() {
        let sep = PATH_LIST_SEPARATOR;
        let raw = format!("/a{sep}{sep}/b");
        assert_eq!(split_path_list(&raw), vec!["/a".to_string(), String::new(), "/b".to_string()]);
        assert!(split_path_list("").is_empty());
    }

    #[test]
    fn absolute_entries() {
        assert!(is_absolute_entry("~/bin"));
        assert!(!is_absolute_entry("bin"));
        assert!(!is_absolute_entry("./bin"));
        if cfg!(windows) {
            assert!(is_absolute_entry(r"C:\Windows"));
        } else {
            assert!(is_absolute_entry("/usr/bin"));
        }
    }

    #[test]
    fn executable_detection() {
        let dir = tempfile::tempdir().unwrap();
        let name = if cfg!(windows) { "tool.exe" } else { "tool" };
        let p = dir.path().join(name);
        std::fs::write(&p, "x").unwrap();
        set_mode(&p, 0o755);
        assert!(is_executable_file(&p));
        let plain = dir.path().join("notes.txt");
        std::fs::write(&plain, "x").unwrap();
        set_mode(&plain, 0o644);
        assert!(!is_executable_file(&plain));
        assert!(command_candidates(dir.path(), "tool").iter().any(|c| c == &p));
    }
}
