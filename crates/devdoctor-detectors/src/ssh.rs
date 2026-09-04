//! SSH detectors: unsafe permissions and broken configuration. Metadata only; key contents are
//! never read.

use devdoctor_core::context::SystemContext;
use devdoctor_core::detector::{Detector, DetectorMeta, ScanMode};
use devdoctor_core::inventory::ssh;
use devdoctor_core::issue::{Category, Confidence, Issue, IssueBuilder, Severity};
use devdoctor_core::Result;
use serde_json::json;

pub const PERMISSIONS_ID: &str = "ssh.permissions";
pub const CONFIG_ID: &str = "ssh.config";

pub struct SshPermissionsDetector;

impl Detector for SshPermissionsDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: PERMISSIONS_ID,
            name: "SSH file permissions",
            category: Category::Ssh,
            description: "Private keys or ~/.ssh readable by other users (ssh refuses such keys).",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let report = ssh::report(ctx);
        let mut issues = Vec::new();
        if let Some(mode) = report.ssh_dir_mode {
            if report.ssh_dir_exists && mode & 0o077 != 0 {
                issues.push(
                    IssueBuilder::new(PERMISSIONS_ID, Category::Ssh, "dir", "~/.ssh is accessible by other users")
                        .severity(Severity::Medium)
                        .confidence(Confidence::Confirmed)
                        .description(format!("~/.ssh has permissions {mode:o}. OpenSSH expects 700 and may ignore keys or config stored in a directory that other users can read."))
                        .impact("Authentication failures that are hard to diagnose, and other local users can list your key files.")
                        .evidence(format!("mode {mode:o} on {}", ctx.display_path(&report.ssh_dir)))
                        .affected_file(report.ssh_dir.clone(), None, None)
                        .recommended_action("Run `chmod 700 ~/.ssh`. DevDoctor does not change SSH files itself.")
                        .metadata(json!({ "path": report.ssh_dir, "mode": mode }))
                        .build(),
                );
            }
        }
        for key in report.keys.iter().filter(|k| !k.mode_ok) {
            issues.push(
                IssueBuilder::new(PERMISSIONS_ID, Category::Ssh, &key.name, format!("Private key {} is readable by other users", key.name))
                    .severity(Severity::High)
                    .confidence(Confidence::Confirmed)
                    .description(format!("~/.ssh/{} has permissions {:o}. OpenSSH refuses to use private keys that are readable by group or others ('Permissions are too open').", key.name, key.mode))
                    .impact("`ssh`, `git push` and anything using this key fails, and the key material is exposed to other local users.")
                    .evidence(format!("mode {:o} on ~/.ssh/{}", key.mode, key.name))
                    .affected_file(key.path.clone(), None, None)
                    .recommended_action(format!("Run `chmod 600 ~/.ssh/{}`. DevDoctor does not change SSH files itself.", key.name))
                    .metadata(json!({ "path": key.path, "mode": key.mode }))
                    .build(),
            );
        }
        Ok(issues)
    }
}

pub struct SshConfigDetector;

impl Detector for SshConfigDetector {
    fn meta(&self) -> DetectorMeta {
        DetectorMeta {
            id: CONFIG_ID,
            name: "SSH configuration",
            category: Category::Ssh,
            description: "~/.ssh/config entries that reference missing identity files or duplicate hosts.",
            modes: &[ScanMode::Quick],
        }
    }

    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>> {
        let report = ssh::report(ctx);
        let mut issues = Vec::new();
        for host in &report.hosts {
            for missing in &host.missing_identity_files {
                let pattern = host.patterns.join(" ");
                issues.push(
                    IssueBuilder::new(CONFIG_ID, Category::Ssh, format!("identity:{pattern}:{}", missing.display()), format!("Host `{pattern}` uses an SSH key that does not exist"))
                        .severity(Severity::Medium)
                        .confidence(Confidence::Confirmed)
                        .description(format!("~/.ssh/config line {} sets IdentityFile {} for `{pattern}`, but that file is missing.", host.line, ctx.display_path(missing)))
                        .impact("Connections to this host fall back to other keys or fail with 'Permission denied (publickey)'.")
                        .evidence(format!("~/.ssh/config:{} IdentityFile {}", host.line, ctx.display_path(missing)))
                        .affected_file(report.config_path.clone(), Some(host.line), None)
                        .recommended_action("Point IdentityFile at an existing key (see the SSH page for the keys found) or generate a new key with `ssh-keygen -t ed25519`.")
                        .metadata(json!({ "host": pattern, "line": host.line, "identity_file": missing }))
                        .build(),
                );
            }
        }
        for dup in &report.duplicate_hosts {
            issues.push(
                IssueBuilder::new(CONFIG_ID, Category::Ssh, format!("duplicate:{dup}"), format!("Host `{dup}` is declared more than once in ~/.ssh/config"))
                    .severity(Severity::Low)
                    .confidence(Confidence::Confirmed)
                    .description("OpenSSH uses the first value of each option it finds; later blocks for the same host are partly or completely ignored.")
                    .impact("Changes made in the second block silently have no effect.")
                    .affected_file(report.config_path.clone(), None, None)
                    .recommended_action(format!("Merge the `Host {dup}` blocks into one."))
                    .metadata(json!({ "host": dup }))
                    .build(),
            );
        }
        Ok(issues)
    }
}
