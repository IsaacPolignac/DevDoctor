//! Global Git configuration (read-only; credentials and tokens are never read).

use crate::context::SystemContext;
use crate::fs_util;
use crate::resolve::{resolve_command, Executable};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitConfigValue {
    pub key: String,
    pub value: String,
    pub file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitReport {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git: Option<Executable>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gh: Option<Executable>,
    pub gh_config_present: bool,
    pub config_files: Vec<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    pub credential_helpers: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpg_sign: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpg_format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signing_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excludes_file: Option<PathBuf>,
    pub excludes_file_exists: bool,
    pub alias_count: usize,
    pub include_ifs: Vec<String>,
    pub findings: Vec<String>,
}

/// Minimal parser for git's INI dialect: returns (section.key, value) pairs in order.
pub fn parse_gitconfig(content: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut section = String::new();
    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            let inner = &line[1..line.len() - 1];
            section = match inner.split_once(char::is_whitespace) {
                Some((name, sub)) => format!("{}.{}", name.trim().to_ascii_lowercase(), sub.trim().trim_matches('"')),
                None => inner.trim().to_ascii_lowercase(),
            };
            continue;
        }
        let (k, v) = match line.split_once('=') {
            Some((k, v)) => (k.trim().to_ascii_lowercase(), v.trim().trim_matches('"').to_string()),
            None => (line.to_ascii_lowercase(), "true".to_string()),
        };
        out.push((format!("{section}.{k}"), v));
    }
    out
}

pub fn report(ctx: &SystemContext) -> GitReport {
    let home = &ctx.home;
    let git = resolve_command(ctx, "git", true).ok().and_then(|r| r.active);
    let gh = resolve_command(ctx, "gh", true).ok().and_then(|r| r.active);
    let gh_config_present = home.join(".config/gh/hosts.yml").exists();
    let candidates = [home.join(".gitconfig"), home.join(".config/git/config")];
    let mut config_files = Vec::new();
    let mut values: Vec<GitConfigValue> = Vec::new();
    for file in candidates {
        if let Ok(Some(content)) = fs_util::read_to_string_opt(&file) {
            config_files.push(file.clone());
            for (k, v) in parse_gitconfig(&content) {
                values.push(GitConfigValue { key: k, value: v, file: file.clone() });
            }
        }
    }
    let get = |key: &str| values.iter().rev().find(|v| v.key == key).map(|v| v.value.clone());
    let mut findings = Vec::new();
    let user_name = get("user.name");
    let user_email = get("user.email");
    if git.is_some() && user_name.is_none() {
        findings.push("user.name is not set globally; commits will use a generated identity.".into());
    }
    if git.is_some() && user_email.is_none() {
        findings.push("user.email is not set globally.".into());
    }
    let credential_helpers: Vec<String> = values.iter().filter(|v| v.key == "credential.helper").map(|v| v.value.clone()).collect();
    let mut seen: BTreeMap<String, usize> = BTreeMap::new();
    for v in &values {
        if matches!(v.key.as_str(), "user.name" | "user.email" | "init.defaultbranch" | "core.editor") {
            *seen.entry(v.key.clone()).or_default() += 1;
        }
    }
    for (k, n) in seen {
        if n > 1 {
            findings.push(format!("{k} is defined {n} times; the last definition wins."));
        }
    }
    let excludes_file = get("core.excludesfile").map(|p| fs_util::expand_home(&p, home));
    let excludes_file_exists = excludes_file.as_ref().is_some_and(|p| p.exists());
    if excludes_file.is_some() && !excludes_file_exists {
        findings.push("core.excludesfile points to a file that does not exist.".into());
    }
    let signing_key = get("user.signingkey");
    let gpg_format = get("gpg.format");
    if gpg_format.as_deref() == Some("ssh") {
        if let Some(key) = &signing_key {
            if key.starts_with('/') || key.starts_with('~') {
                let p = fs_util::expand_home(key, home);
                if !p.exists() {
                    findings.push(format!("SSH signing key {} does not exist.", ctx.display_path(&p)));
                }
            }
        }
    }
    let include_ifs: Vec<String> =
        values.iter().filter(|v| v.key.starts_with("includeif.")).map(|v| format!("{} = {}", v.key, v.value)).collect();
    GitReport {
        git,
        gh,
        gh_config_present,
        config_files,
        user_name,
        user_email,
        default_branch: get("init.defaultbranch"),
        credential_helpers,
        gpg_sign: get("commit.gpgsign").map(|v| v == "true"),
        gpg_format,
        signing_key,
        excludes_file,
        excludes_file_exists,
        alias_count: values.iter().filter(|v| v.key.starts_with("alias.")).count(),
        include_ifs,
        findings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_gitconfig() {
        let c = "[user]\n\tname = Jane\n\temail = jane@example.com\n[init]\n\tdefaultBranch = main\n[includeIf \"gitdir:~/work/\"]\n\tpath = ~/.gitconfig-work\n[alias]\n\tco = checkout\n";
        let v = parse_gitconfig(c);
        assert!(v.contains(&("user.name".into(), "Jane".into())));
        assert!(v.contains(&("init.defaultbranch".into(), "main".into())));
        assert!(v.iter().any(|(k, _)| k == "includeif.gitdir:~/work/.path"));
        assert!(v.contains(&("alias.co".into(), "checkout".into())));
    }
}
