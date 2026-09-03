//! SSH metadata: key files, permissions, config sanity and agent status.
//! Private key contents are never read.

use crate::command::CommandSpec;
use crate::context::SystemContext;
use crate::fs_util;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKey {
    pub path: PathBuf,
    pub name: String,
    pub mode: u32,
    pub mode_ok: bool,
    pub has_public_key: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHost {
    pub patterns: Vec<String>,
    pub line: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    pub identity_files: Vec<PathBuf>,
    pub missing_identity_files: Vec<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshReport {
    pub ssh_dir: PathBuf,
    pub ssh_dir_exists: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_dir_mode: Option<u32>,
    pub keys: Vec<SshKey>,
    pub config_path: PathBuf,
    pub config_exists: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub config_mode: Option<u32>,
    pub hosts: Vec<SshHost>,
    pub duplicate_hosts: Vec<String>,
    pub known_hosts_entries: usize,
    /// "running" | "no_identities" | "not_running" | "unknown"
    pub agent_status: String,
    pub agent_identities: usize,
    pub findings: Vec<String>,
}

fn is_private_key_name(name: &str) -> bool {
    if name.ends_with(".pub")
        || name == "config"
        || name == "known_hosts"
        || name.starts_with("known_hosts")
        || name == "authorized_keys"
        || name == "environment"
        || name == "rc"
        || name.starts_with('.')
    {
        return false;
    }
    name.starts_with("id_")
        || name.ends_with(".pem")
        || name.ends_with(".key")
        || name.ends_with("_rsa")
        || name.ends_with("_ed25519")
        || name.ends_with("_ecdsa")
}

fn public_key_info(path: &Path) -> (Option<String>, Option<String>) {
    let Ok(Some(content)) = fs_util::read_to_string_opt(path) else { return (None, None) };
    let mut parts = content.split_whitespace();
    let key_type = parts.next().map(|s| s.to_string());
    let _key = parts.next();
    let comment = parts.next().map(|s| s.to_string());
    (key_type, comment)
}

/// Parses `~/.ssh/config` host blocks.
pub fn parse_ssh_config(content: &str, home: &Path) -> Vec<SshHost> {
    let mut hosts: Vec<SshHost> = Vec::new();
    for (idx, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = match line.split_once(|c: char| c.is_whitespace() || c == '=') {
            Some((k, v)) => (k.trim().to_ascii_lowercase(), v.trim().trim_start_matches('=').trim().to_string()),
            None => continue,
        };
        match key.as_str() {
            "host" => hosts.push(SshHost {
                patterns: value.split_whitespace().map(|s| s.to_string()).collect(),
                line: idx as u32 + 1,
                hostname: None,
                user: None,
                identity_files: Vec::new(),
                missing_identity_files: Vec::new(),
            }),
            "match" => hosts.push(SshHost {
                patterns: vec![format!("Match {value}")],
                line: idx as u32 + 1,
                hostname: None,
                user: None,
                identity_files: Vec::new(),
                missing_identity_files: Vec::new(),
            }),
            "hostname" => {
                if let Some(h) = hosts.last_mut() {
                    h.hostname = Some(value);
                }
            }
            "user" => {
                if let Some(h) = hosts.last_mut() {
                    h.user = Some(value);
                }
            }
            "identityfile" => {
                if let Some(h) = hosts.last_mut() {
                    let p = fs_util::expand_home(value.trim_matches('"'), home);
                    if !p.exists() && !value.contains('%') {
                        h.missing_identity_files.push(p.clone());
                    }
                    h.identity_files.push(p);
                }
            }
            _ => {}
        }
    }
    hosts
}

pub fn report(ctx: &SystemContext) -> SshReport {
    let ssh_dir = ctx.home.join(".ssh");
    let ssh_dir_mode = fs_util::file_mode(&ssh_dir);
    let mut findings = Vec::new();
    let mut keys = Vec::new();
    if let Some(mode) = ssh_dir_mode {
        if mode & 0o077 != 0 {
            findings.push(format!("~/.ssh has permissions {mode:o}; ssh expects 700 (group/other access must be removed)."));
        }
    }
    for entry in fs_util::list_dir(&ssh_dir) {
        let name = entry.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if !entry.is_file() || !is_private_key_name(&name) {
            continue;
        }
        let mode = fs_util::file_mode(&entry).unwrap_or(0);
        let mode_ok = mode & 0o077 == 0;
        if !mode_ok {
            findings
                .push(format!("Private key ~/.ssh/{name} has permissions {mode:o}; ssh refuses keys readable by others (expected 600)."));
        }
        let pub_path = entry.with_file_name(format!("{name}.pub"));
        let (key_type, comment) = if pub_path.exists() { public_key_info(&pub_path) } else { (None, None) };
        keys.push(SshKey { path: entry.clone(), name, mode, mode_ok, has_public_key: pub_path.exists(), key_type, comment });
    }
    let config_path = ssh_dir.join("config");
    let config_mode = fs_util::file_mode(&config_path);
    let mut hosts = Vec::new();
    let mut duplicate_hosts = Vec::new();
    if let Ok(Some(content)) = fs_util::read_to_string_opt(&config_path) {
        hosts = parse_ssh_config(&content, &ctx.home);
        let mut seen = std::collections::BTreeMap::new();
        for h in &hosts {
            for p in &h.patterns {
                if p.starts_with("Match ") || p == "*" {
                    continue;
                }
                *seen.entry(p.clone()).or_insert(0) += 1;
            }
        }
        duplicate_hosts = seen.into_iter().filter(|(_, n)| *n > 1).map(|(p, _)| p).collect();
        for d in &duplicate_hosts {
            findings
                .push(format!("Host `{d}` is declared more than once in ~/.ssh/config; only the first matching block's options apply."));
        }
        for h in &hosts {
            for m in &h.missing_identity_files {
                findings.push(format!(
                    "Host `{}` (line {}) references IdentityFile {} which does not exist.",
                    h.patterns.join(" "),
                    h.line,
                    ctx.display_path(m)
                ));
            }
        }
        if let Some(mode) = config_mode {
            if mode & 0o022 != 0 {
                findings.push(format!("~/.ssh/config is writable by others ({mode:o}); ssh may refuse to use it."));
            }
        }
    }
    let known_hosts_entries = fs_util::read_to_string_opt(&ssh_dir.join("known_hosts"))
        .ok()
        .flatten()
        .map(|c| c.lines().filter(|l| !l.trim().is_empty() && !l.starts_with('#')).count())
        .unwrap_or(0);
    let (agent_status, agent_identities) = match ctx.find_program("ssh-add") {
        Some(bin) => {
            let mut spec = CommandSpec::new(bin.to_string_lossy().into_owned()).arg("-l").timeout_ms(3_000);
            if let Some(sock) = ctx.env.get("SSH_AUTH_SOCK") {
                spec = spec.env("SSH_AUTH_SOCK", sock.to_string());
            }
            match ctx.run(&spec) {
                Ok(out) if out.exit_code == Some(0) => ("running".to_string(), out.stdout.lines().filter(|l| !l.trim().is_empty()).count()),
                Ok(out) if out.exit_code == Some(1) => ("no_identities".to_string(), 0),
                Ok(out) if out.exit_code == Some(2) => ("not_running".to_string(), 0),
                _ => ("unknown".to_string(), 0),
            }
        }
        None => ("unknown".to_string(), 0),
    };
    SshReport {
        ssh_dir_exists: ssh_dir.exists(),
        ssh_dir,
        ssh_dir_mode,
        keys,
        config_exists: config_path.exists(),
        config_path,
        config_mode,
        hosts,
        duplicate_hosts,
        known_hosts_entries,
        agent_status,
        agent_identities,
        findings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hosts() {
        let c = "Host github.com\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519\n\nHost work\n  IdentityFile ~/.ssh/missing_key\nHost github.com\n";
        let hosts = parse_ssh_config(c, Path::new("/nonexistent-home"));
        assert_eq!(hosts.len(), 3);
        assert_eq!(hosts[0].user.as_deref(), Some("git"));
        assert_eq!(hosts[1].missing_identity_files.len(), 1);
    }

    #[test]
    fn private_key_names() {
        assert!(is_private_key_name("id_ed25519"));
        assert!(!is_private_key_name("id_ed25519.pub"));
        assert!(!is_private_key_name("known_hosts"));
        assert!(is_private_key_name("deploy.pem"));
    }
}
