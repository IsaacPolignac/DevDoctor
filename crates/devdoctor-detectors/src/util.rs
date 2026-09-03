//! Small helpers shared by detectors.

use devdoctor_core::context::SystemContext;
use devdoctor_core::shell::PathMutation;
use std::path::Path;

pub fn display(ctx: &SystemContext, path: &Path) -> String {
    ctx.display_path(path)
}

/// "~/.zshrc:12" style location for a mutation.
pub fn location(ctx: &SystemContext, m: &PathMutation) -> String {
    format!("{}:{}", ctx.display_path(&m.file), m.line)
}

pub fn join_positions(positions: &[usize]) -> String {
    let strs: Vec<String> = positions.iter().map(|p| p.to_string()).collect();
    match strs.len() {
        0 => String::new(),
        1 => strs[0].clone(),
        n => format!("{} and {}", strs[..n - 1].join(", "), strs[n - 1]),
    }
}

pub fn times(n: usize) -> String {
    match n {
        1 => "once".into(),
        2 => "twice".into(),
        n => format!("{n} times"),
    }
}
