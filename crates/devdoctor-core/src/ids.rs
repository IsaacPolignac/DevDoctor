//! Identifier helpers.
//!
//! Issue ids are *stable*: the same problem detected in two different scans produces the same
//! id, which is what allows `devdoctor fix <id>` and the ignore list to work across scans.

use sha2::{Digest, Sha256};

/// A stable 12-character hexadecimal id derived from a namespace (usually the detector id) and
/// a fingerprint describing the specific finding.
pub fn stable_id(namespace: &str, fingerprint: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update(b"\0");
    hasher.update(fingerprint.as_bytes());
    let digest = hasher.finalize();
    hex::encode(&digest[..6])
}

/// A random, prefixed id (e.g. `tx_3f9a...`) for transactions, snapshots and backups.
pub fn random_id(prefix: &str) -> String {
    let uuid = uuid::Uuid::new_v4().simple().to_string();
    format!("{prefix}{}", &uuid[..12])
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_ids_are_deterministic() {
        assert_eq!(stable_id("a", "b"), stable_id("a", "b"));
        assert_ne!(stable_id("a", "b"), stable_id("a", "c"));
        assert_eq!(stable_id("x", "y").len(), 12);
    }

    #[test]
    fn random_ids_carry_prefix() {
        let id = random_id("tx_");
        assert!(id.starts_with("tx_"));
        assert_eq!(id.len(), 15);
    }
}
