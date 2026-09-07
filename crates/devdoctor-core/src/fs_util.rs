//! Filesystem helpers with the safety rules DevDoctor relies on:
//! atomic writes, symlink-aware deletion and disk-usage measurement.

use crate::sys;
use crate::{Error, Result};
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

pub fn read_to_string_opt(path: &Path) -> Result<Option<String>> {
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(Error::io(path, e)),
    }
}

pub fn read_bytes(path: &Path) -> Result<Vec<u8>> {
    std::fs::read(path).map_err(|e| Error::io(path, e))
}

pub fn sha256_file(path: &Path) -> Result<String> {
    Ok(crate::ids::sha256_hex(&read_bytes(path)?))
}

pub fn file_mode(path: &Path) -> Option<u32> {
    std::fs::symlink_metadata(path).ok().and_then(|m| sys::mode_of(&m))
}

pub fn is_symlink(path: &Path) -> bool {
    std::fs::symlink_metadata(path).map(|m| m.file_type().is_symlink()).unwrap_or(false)
}

/// Writes `data` to `path` atomically (temp file + rename in the same directory), preserving the
/// permission bits of an existing file. The parent directory must exist.
pub fn atomic_write(path: &Path, data: &[u8], mode: Option<u32>) -> Result<()> {
    let parent = path.parent().ok_or_else(|| Error::UnsafePath(format!("{} has no parent", path.display())))?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| Error::UnsafePath(format!("{} has no file name", path.display())))?;
    let tmp = parent.join(format!(".{file_name}.devdoctor-{}.tmp", std::process::id()));
    {
        use std::io::Write;
        let mut f = std::fs::File::create(&tmp).map_err(|e| Error::io(&tmp, e))?;
        f.write_all(data).map_err(|e| Error::io(&tmp, e))?;
        f.sync_all().map_err(|e| Error::io(&tmp, e))?;
    }
    if let Some(mode) = mode.or_else(|| file_mode(path)) {
        sys::set_mode(&tmp, mode);
    }
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        Error::io(path, e)
    })
}

/// Expands a leading `~` or `$HOME`/`${HOME}` prefix.
pub fn expand_home(raw: &str, home: &Path) -> PathBuf {
    let home_s = home.to_string_lossy();
    if raw == "~" {
        return home.to_path_buf();
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        return home.join(rest);
    }
    let replaced = raw.replace("${HOME}", &home_s).replace("$HOME", &home_s);
    PathBuf::from(replaced)
}

/// `~`-shortened display form of a path.
pub fn display_path(path: &Path, home: &Path) -> String {
    match path.strip_prefix(home) {
        Ok(rest) if rest.as_os_str().is_empty() => "~".to_string(),
        Ok(rest) => format!("~/{}", rest.display()),
        Err(_) => path.display().to_string(),
    }
}

/// Normalises a path lexically (removes `.` and resolves `..` without touching the filesystem)
/// and strips trailing slashes. Used to compare PATH entries.
pub fn normalize_lexical(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// True when `path` lexically starts with `root` (no filesystem access).
pub fn starts_with_lexical(path: &Path, root: &Path) -> bool {
    normalize_lexical(path).starts_with(normalize_lexical(root))
}

/// Resolves the *parent* of `path` (which may not exist yet) and checks that the resolved
/// location is inside `root`. This catches symlinked parents that would escape the allowed
/// area during a mutation.
pub fn resolved_within(path: &Path, root: &Path) -> Result<bool> {
    let root_canon = std::fs::canonicalize(root).map_err(|e| Error::io(root, e))?;
    let parent = path.parent().ok_or_else(|| Error::UnsafePath(path.display().to_string()))?;
    let parent_canon = match std::fs::canonicalize(parent) {
        Ok(p) => p,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(starts_with_lexical(path, root)),
        Err(e) => return Err(Error::io(parent, e)),
    };
    Ok(parent_canon.starts_with(&root_canon))
}

/// Deletes a directory tree without following the root symlink (a symlinked root is refused).
pub fn remove_dir_all_no_follow(path: &Path) -> Result<()> {
    let meta = std::fs::symlink_metadata(path).map_err(|e| Error::io(path, e))?;
    if meta.file_type().is_symlink() {
        return Err(Error::UnsafePath(format!("{} is a symbolic link; refusing to delete through it", path.display())));
    }
    if !meta.is_dir() {
        return Err(Error::UnsafePath(format!("{} is not a directory", path.display())));
    }
    std::fs::remove_dir_all(path).map_err(|e| Error::io(path, e))
}

#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct DirSize {
    /// Bytes actually allocated on disk (what `du` reports); sparse files count what they use.
    pub allocated: u64,
    /// Sum of logical file sizes.
    pub logical: u64,
    pub files: u64,
    pub dirs: u64,
}

impl DirSize {
    pub fn add(&mut self, other: DirSize) {
        self.allocated += other.allocated;
        self.logical += other.logical;
        self.files += other.files;
        self.dirs += other.dirs;
    }
}

#[derive(Clone, Copy, Debug)]
struct FileMeta {
    allocated: u64,
    logical: u64,
    is_dir: bool,
    dev: u64,
    ino: u64,
    nlink: u64,
}

/// Measures a directory tree in parallel. Symlinks are not followed and hard links are counted
/// once (important for pnpm stores and Homebrew's Cellar).
pub fn dir_size(path: &Path) -> DirSize {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return DirSize::default(),
    };
    if !meta.is_dir() {
        return DirSize { allocated: sys::allocated_bytes(&meta), logical: meta.len(), files: 1, dirs: 0 };
    }
    let walk = jwalk::WalkDirGeneric::<((), Option<FileMeta>)>::new(path).skip_hidden(false).follow_links(false).process_read_dir(
        |_depth, _path, _state, children| {
            for child in children.iter_mut().flatten() {
                if let Ok(md) = child.metadata() {
                    let (dev, ino, nlink) = sys::file_identity(&md);
                    child.client_state =
                        Some(FileMeta { allocated: sys::allocated_bytes(&md), logical: md.len(), is_dir: md.is_dir(), dev, ino, nlink });
                }
            }
        },
    );
    let mut total = DirSize::default();
    let mut seen_links: HashSet<(u64, u64)> = HashSet::new();
    for entry in walk.into_iter().flatten() {
        let Some(m) = entry.client_state else { continue };
        if m.is_dir {
            if entry.depth > 0 {
                total.dirs += 1;
            }
            total.allocated += m.allocated;
            continue;
        }
        if m.nlink > 1 && !seen_links.insert((m.dev, m.ino)) {
            continue;
        }
        total.files += 1;
        total.allocated += m.allocated;
        total.logical += m.logical;
    }
    total
}

/// Most recent modification time (seconds since epoch) among a directory's direct children and
/// the directory itself. Cheap proxy for "last project activity".
pub fn latest_mtime_shallow(path: &Path) -> Option<i64> {
    let mut latest = std::fs::symlink_metadata(path).ok().map(|m| sys::mtime_secs(&m));
    if let Ok(rd) = std::fs::read_dir(path) {
        for entry in rd.flatten() {
            if let Ok(md) = entry.metadata() {
                let t = sys::mtime_secs(&md);
                if latest.is_none_or(|l| t > l) {
                    latest = Some(t);
                }
            }
        }
    }
    latest
}

pub fn list_dir(path: &Path) -> Vec<PathBuf> {
    match std::fs::read_dir(path) {
        Ok(rd) => {
            let mut v: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
            v.sort();
            v
        }
        Err(_) => Vec::new(),
    }
}

/// Whether the current user may write into `path`. `None` when it cannot be determined.
pub fn is_writable(path: &Path) -> Option<bool> {
    sys::is_writable(path)
}

/// Whether `path` is a regular file the current user can execute (mode bits on Unix, `PATHEXT`
/// on Windows).
pub fn is_executable_file(path: &Path) -> bool {
    sys::is_executable_file(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(unix)]
    fn atomic_write_preserves_mode() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("f.txt");
        std::fs::write(&p, "a").unwrap();
        sys::set_mode(&p, 0o600);
        atomic_write(&p, b"bb", None).unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "bb");
        assert_eq!(file_mode(&p).unwrap(), 0o600);
        assert!(std::fs::read_dir(dir.path()).unwrap().count() == 1, "temp file cleaned up");
    }

    #[test]
    fn expands_home_forms() {
        let home = Path::new("/Users/me");
        assert_eq!(expand_home("~/.cargo/bin", home), PathBuf::from("/Users/me/.cargo/bin"));
        assert_eq!(expand_home("$HOME/.local/bin", home), PathBuf::from("/Users/me/.local/bin"));
        assert_eq!(expand_home("${HOME}/bin", home), PathBuf::from("/Users/me/bin"));
        assert_eq!(expand_home("/usr/bin", home), PathBuf::from("/usr/bin"));
    }

    #[test]
    fn normalizes_lexically() {
        assert_eq!(normalize_lexical(Path::new("/opt/homebrew/bin/")), PathBuf::from("/opt/homebrew/bin"));
        assert_eq!(normalize_lexical(Path::new("/opt/./homebrew/../homebrew/bin")), PathBuf::from("/opt/homebrew/bin"));
    }

    #[test]
    fn refuses_to_delete_through_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        std::fs::create_dir(&real).unwrap();
        std::fs::write(real.join("keep.txt"), "x").unwrap();
        let link = dir.path().join("link");
        if sys::symlink(&real, &link).is_err() {
            return; // symlink creation needs a privilege on some Windows setups
        }
        assert!(remove_dir_all_no_follow(&link).is_err());
        assert!(real.join("keep.txt").exists());
    }

    #[test]
    fn measures_directory_size() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.bin"), vec![0u8; 10_000]).unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub").join("b.bin"), vec![1u8; 5_000]).unwrap();
        std::fs::hard_link(dir.path().join("a.bin"), dir.path().join("a-link.bin")).unwrap();
        let size = dir_size(dir.path());
        if cfg!(unix) {
            assert_eq!(size.files, 2, "hard link counted once");
            assert_eq!(size.logical, 15_000);
        } else {
            // Windows exposes no stable file identity through std, so hard links count twice.
            assert_eq!(size.files, 3);
            assert_eq!(size.logical, 25_000);
        }
        assert!(size.allocated >= 15_000);
        assert_eq!(size.dirs, 1);
    }
}
