//! The issue model: the structured output of every detector.
//!
//! Everything the UI needs to explain a problem (what was found, why it matters, evidence,
//! affected files, recommended action, fix availability) lives here so that no explanatory
//! text has to be baked into frontend components.

use crate::ids::stable_id;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Low => "low",
            Severity::Medium => "medium",
            Severity::High => "high",
            Severity::Critical => "critical",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "info" => Some(Severity::Info),
            "low" => Some(Severity::Low),
            "medium" => Some(Severity::Medium),
            "high" => Some(Severity::High),
            "critical" => Some(Severity::Critical),
            _ => None,
        }
    }

    pub fn all() -> [Severity; 5] {
        [Severity::Info, Severity::Low, Severity::Medium, Severity::High, Severity::Critical]
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    /// A plausible interpretation; DevDoctor could not verify it.
    Possible,
    /// Strong signals but not a direct observation.
    Likely,
    /// Directly observed.
    Confirmed,
}

impl Confidence {
    pub fn as_str(&self) -> &'static str {
        match self {
            Confidence::Possible => "possible",
            Confidence::Likely => "likely",
            Confidence::Confirmed => "confirmed",
        }
    }
}

impl std::fmt::Display for Confidence {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Category {
    Shell,
    Runtimes,
    PackageManagers,
    Processes,
    Ports,
    AiTools,
    Disk,
    Git,
    Ssh,
    Containers,
    Environment,
    Services,
}

impl Category {
    pub fn label(&self) -> &'static str {
        match self {
            Category::Shell => "Shell",
            Category::Runtimes => "Runtimes",
            Category::PackageManagers => "Package Managers",
            Category::Processes => "Processes",
            Category::Ports => "Ports",
            Category::AiTools => "AI Tools",
            Category::Disk => "Disk",
            Category::Git => "Git",
            Category::Ssh => "SSH",
            Category::Containers => "Containers",
            Category::Environment => "Environment",
            Category::Services => "Services",
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Category::Shell => "shell",
            Category::Runtimes => "runtimes",
            Category::PackageManagers => "package_managers",
            Category::Processes => "processes",
            Category::Ports => "ports",
            Category::AiTools => "ai_tools",
            Category::Disk => "disk",
            Category::Git => "git",
            Category::Ssh => "ssh",
            Category::Containers => "containers",
            Category::Environment => "environment",
            Category::Services => "services",
        }
    }

    pub fn all() -> [Category; 12] {
        [
            Category::Shell,
            Category::Runtimes,
            Category::PackageManagers,
            Category::Processes,
            Category::Ports,
            Category::AiTools,
            Category::Disk,
            Category::Git,
            Category::Ssh,
            Category::Containers,
            Category::Environment,
            Category::Services,
        ]
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AffectedFile {
    pub path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    /// Stable id derived from `detector_id` and `fingerprint`.
    pub id: String,
    pub fingerprint: String,
    pub detector_id: String,
    pub category: Category,
    pub title: String,
    /// Plain-language explanation of what was found.
    pub description: String,
    /// Why it matters to the developer.
    pub impact: String,
    /// Technical details for people who want them.
    pub technical_description: String,
    pub severity: Severity,
    pub confidence: Confidence,
    /// Why DevDoctor believes the problem exists: concrete observations.
    pub evidence: Vec<String>,
    pub affected_files: Vec<AffectedFile>,
    pub affected_commands: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_state: Option<String>,
    pub recommended_action: String,
    /// Id of the fixer that can handle this issue, if any.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fixer_id: Option<String>,
    pub fixer_available: bool,
    /// Whether the recommended automatic fix can be undone by DevDoctor.
    pub reversible: bool,
    /// Eligible for "Fix safe issues": safe, reversible and high-confidence.
    pub batch_safe: bool,
    pub created_at: DateTime<Utc>,
    /// Detector-specific structured data (consumed by fixers and the UI).
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl Issue {
    pub fn is_problem(&self) -> bool {
        self.severity >= Severity::Medium
    }

    pub fn is_warning(&self) -> bool {
        self.severity == Severity::Low
    }
}

/// Builder used by detectors. Sensible defaults keep detector code short.
pub struct IssueBuilder {
    issue: Issue,
}

impl IssueBuilder {
    pub fn new(detector_id: &str, category: Category, fingerprint: impl Into<String>, title: impl Into<String>) -> Self {
        let fingerprint = fingerprint.into();
        Self {
            issue: Issue {
                id: stable_id(detector_id, &fingerprint),
                fingerprint,
                detector_id: detector_id.to_string(),
                category,
                title: title.into(),
                description: String::new(),
                impact: String::new(),
                technical_description: String::new(),
                severity: Severity::Low,
                confidence: Confidence::Likely,
                evidence: Vec::new(),
                affected_files: Vec::new(),
                affected_commands: Vec::new(),
                current_state: None,
                recommended_action: String::new(),
                fixer_id: None,
                fixer_available: false,
                reversible: false,
                batch_safe: false,
                created_at: Utc::now(),
                metadata: serde_json::Value::Null,
            },
        }
    }

    pub fn description(mut self, text: impl Into<String>) -> Self {
        self.issue.description = text.into();
        self
    }

    pub fn impact(mut self, text: impl Into<String>) -> Self {
        self.issue.impact = text.into();
        self
    }

    pub fn technical(mut self, text: impl Into<String>) -> Self {
        self.issue.technical_description = text.into();
        self
    }

    pub fn severity(mut self, severity: Severity) -> Self {
        self.issue.severity = severity;
        self
    }

    pub fn confidence(mut self, confidence: Confidence) -> Self {
        self.issue.confidence = confidence;
        self
    }

    pub fn evidence(mut self, line: impl Into<String>) -> Self {
        self.issue.evidence.push(line.into());
        self
    }

    pub fn affected_file(mut self, path: impl Into<PathBuf>, line: Option<u32>, excerpt: Option<String>) -> Self {
        self.issue.affected_files.push(AffectedFile { path: path.into(), line, excerpt });
        self
    }

    pub fn affected_command(mut self, cmd: impl Into<String>) -> Self {
        self.issue.affected_commands.push(cmd.into());
        self
    }

    pub fn current_state(mut self, text: impl Into<String>) -> Self {
        self.issue.current_state = Some(text.into());
        self
    }

    pub fn recommended_action(mut self, text: impl Into<String>) -> Self {
        self.issue.recommended_action = text.into();
        self
    }

    /// Declares which fixer can handle the issue. Availability, reversibility and batch safety
    /// are confirmed by the engine against the fixer registry after the scan.
    pub fn fixer(mut self, fixer_id: &str) -> Self {
        self.issue.fixer_id = Some(fixer_id.to_string());
        self
    }

    pub fn metadata(mut self, value: serde_json::Value) -> Self {
        self.issue.metadata = value;
        self
    }

    pub fn build(self) -> Issue {
        self.issue
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn severity_ordering_and_parsing() {
        assert!(Severity::Critical > Severity::High);
        assert!(Severity::Low > Severity::Info);
        assert_eq!(Severity::parse("HIGH"), Some(Severity::High));
        assert_eq!(serde_json::to_string(&Severity::Medium).unwrap(), "\"medium\"");
    }

    #[test]
    fn builder_produces_stable_ids() {
        let a = IssueBuilder::new("shell.path.duplicate", Category::Shell, "/opt/homebrew/bin", "dup").build();
        let b = IssueBuilder::new("shell.path.duplicate", Category::Shell, "/opt/homebrew/bin", "dup again").build();
        assert_eq!(a.id, b.id);
        assert_eq!(a.category, Category::Shell);
    }
}
