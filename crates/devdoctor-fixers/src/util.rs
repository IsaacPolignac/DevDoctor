//! Helpers shared by fixers.

use devdoctor_core::command::CommandSpec;
use devdoctor_core::context::SystemContext;
use devdoctor_core::fixer::ValidationCheck;
use std::path::Path;

/// Runs the shell parser in check mode on a file and returns a validation check.
pub fn syntax_check(ctx: &SystemContext, path: &Path) -> ValidationCheck {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let program = if name.contains("bash") || name == ".profile" { "/bin/bash" } else { "/bin/zsh" };
    let spec = CommandSpec::new(program).arg("-n").arg(path.to_string_lossy().into_owned()).timeout_ms(5_000);
    match ctx.run(&spec) {
        Ok(out) if out.success() => {
            ValidationCheck { name: format!("{} -n {}", program, ctx.display_path(path)), passed: true, detail: "syntax OK".into() }
        }
        Ok(out) => ValidationCheck {
            name: format!("{} -n {}", program, ctx.display_path(path)),
            passed: false,
            detail: out.stderr.trim().to_string(),
        },
        Err(e) => ValidationCheck { name: format!("{} -n {}", program, ctx.display_path(path)), passed: false, detail: e.to_string() },
    }
}

/// Syntax-checks content that is not on disk yet (written to a private temporary file).
pub fn syntax_check_content(ctx: &SystemContext, file_name: &str, content: &[u8]) -> Result<ValidationCheck, devdoctor_core::Error> {
    let dir = tempfile::tempdir().map_err(|e| devdoctor_core::Error::io("tempdir", e))?;
    let path = dir.path().join(file_name);
    std::fs::write(&path, content).map_err(|e| devdoctor_core::Error::io(&path, e))?;
    Ok(syntax_check(ctx, &path))
}

pub fn count_dir(entries: &[String], dir: &str) -> usize {
    let key = devdoctor_core::shell::normalize_key(dir);
    entries.iter().filter(|e| devdoctor_core::shell::normalize_key(e) == key).count()
}
