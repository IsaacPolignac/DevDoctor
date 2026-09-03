//! Secret redaction. DevDoctor scans developer machines that are full of credentials; anything
//! that is displayed, logged or exported passes through these helpers.

use regex::Regex;
use std::path::Path;
use std::sync::OnceLock;

/// Substrings that mark an environment variable (or config key) as sensitive.
pub const SENSITIVE_MARKERS: &[&str] =
    &["TOKEN", "KEY", "SECRET", "PASSWORD", "PASSWD", "AUTH", "COOKIE", "CREDENTIAL", "PRIVATE", "SIGNING"];

/// Names that contain a marker but are known to be harmless.
const SAFE_NAMES: &[&str] = &["SSH_AUTH_SOCK", "GPG_TTY", "TERM_SESSION_ID"];

pub const REDACTED: &str = "<redacted>";

/// Returns true when a variable name looks like it holds a secret. False positives are
/// acceptable: hiding a harmless value is cheaper than leaking a real one.
pub fn is_sensitive_name(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();
    if SAFE_NAMES.contains(&upper.as_str()) {
        return false;
    }
    SENSITIVE_MARKERS.iter().any(|m| upper.contains(m))
}

fn patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        vec![
            // NAME=value where NAME looks sensitive (env-style assignments, command lines).
            Regex::new(r#"(?i)\b([A-Z0-9_\-]*(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|AUTH|COOKIE|CREDENTIAL)[A-Z0-9_\-]*)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)"#)
                .expect("static regex"),
            // --password value / --token value style flags.
            Regex::new(r#"(?i)(--?(?:token|password|passwd|secret|api-?key|access-?key|auth)\s+)(\S+)"#)
                .expect("static regex"),
            // Well known token shapes.
            Regex::new(r#"\b(sk-[A-Za-z0-9_\-]{8,}|sk-ant-[A-Za-z0-9_\-]{8,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9\-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{30,}|hf_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{30,})\b"#)
                .expect("static regex"),
        ]
    })
}

/// Redacts likely secrets inside free-form text (command lines, log lines, config excerpts).
pub fn redact_text(input: &str) -> String {
    let mut out = input.to_string();
    let p = patterns();
    out = p[0].replace_all(&out, |c: &regex::Captures| format!("{}{}{REDACTED}", &c[1], &c[2])).into_owned();
    out = p[1].replace_all(&out, |c: &regex::Captures| format!("{}{REDACTED}", &c[1])).into_owned();
    out = p[2].replace_all(&out, REDACTED).into_owned();
    out
}

/// Replaces the home directory prefix with `~` for display and exports.
pub fn shorten_home(text: &str, home: &Path) -> String {
    let home_str = home.to_string_lossy();
    if home_str.is_empty() || home_str == "/" {
        return text.to_string();
    }
    text.replace(home_str.as_ref(), "~")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_sensitive_names() {
        assert!(is_sensitive_name("OPENAI_API_KEY"));
        assert!(is_sensitive_name("npm_token"));
        assert!(is_sensitive_name("DB_PASSWORD"));
        assert!(!is_sensitive_name("PATH"));
        assert!(!is_sensitive_name("SSH_AUTH_SOCK"));
    }

    #[test]
    fn redacts_assignments_and_tokens() {
        let s = "OPENAI_API_KEY=sk-abcdefghijklmnop node server.js --password hunter2";
        let r = redact_text(s);
        assert!(!r.contains("sk-abcdefghijklmnop"));
        assert!(!r.contains("hunter2"));
        assert!(r.contains("OPENAI_API_KEY=<redacted>"));
        assert!(r.contains("node server.js"));
    }

    #[test]
    fn leaves_plain_text_alone() {
        let s = "node /Users/me/project/index.js --port 3000";
        assert_eq!(redact_text(s), s);
    }

    #[test]
    fn shortens_home() {
        assert_eq!(shorten_home("/Users/me/.zshrc", Path::new("/Users/me")), "~/.zshrc");
    }
}
