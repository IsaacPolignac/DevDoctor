//! Fixer interface and fix previews.
//!
//! A fixer never touches the machine directly: `apply` receives a [`TxBuilder`] whose
//! primitives record every operation, create backups and make rollback possible.

use crate::context::SystemContext;
use crate::issue::Issue;
use crate::transaction::TxBuilder;
use crate::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskLevel::Low => "low",
            RiskLevel::Medium => "medium",
            RiskLevel::High => "high",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LineChangeKind {
    Removed,
    Added,
    Changed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineChange {
    /// 1-based line number in the *original* file.
    pub line: u32,
    pub kind: LineChangeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: PathBuf,
    pub before: String,
    pub after: String,
    /// Unified diff between `before` and `after`.
    pub diff: String,
    pub line_changes: Vec<LineChange>,
}

impl FileChange {
    pub fn new(path: PathBuf, before: String, after: String, line_changes: Vec<LineChange>) -> Self {
        let diff = unified_diff(&path, &before, &after);
        Self { path, before, after, diff, line_changes }
    }
}

pub fn unified_diff(path: &std::path::Path, before: &str, after: &str) -> String {
    let name = path.display().to_string();
    similar::TextDiff::from_lines(before, after)
        .unified_diff()
        .context_radius(2)
        .header(&format!("{name} (before)"), &format!("{name} (after)"))
        .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirDeletion {
    pub path: PathBuf,
    pub bytes: u64,
    pub entries: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedCommand {
    pub program: String,
    pub args: Vec<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRef {
    pub pid: u32,
    pub name: String,
    pub command: String,
}

/// Everything the user must see before a fix is applied.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixPreview {
    pub fixer_id: String,
    pub issue_id: String,
    pub title: String,
    pub summary: String,
    /// Ordered, human-readable list of the operations that will run.
    pub operations: Vec<String>,
    pub files_modified: Vec<FileChange>,
    pub files_deleted: Vec<PathBuf>,
    pub directories_deleted: Vec<DirDeletion>,
    pub commands_executed: Vec<PlannedCommand>,
    pub processes_stopped: Vec<ProcessRef>,
    pub services_stopped: Vec<String>,
    pub estimated_disk_space_recovered: u64,
    pub backup_created: bool,
    pub risk: RiskLevel,
    pub reversible: bool,
    pub requires_confirmation: bool,
    pub batch_safe: bool,
    /// Extra context, e.g. "Clearing the cache does not uninstall packages."
    pub notes: Vec<String>,
    /// What DevDoctor will verify after applying (rollback happens automatically on failure).
    pub validations: Vec<String>,
}

impl FixPreview {
    pub fn new(fixer_id: &str, issue: &Issue, title: impl Into<String>, summary: impl Into<String>) -> Self {
        Self {
            fixer_id: fixer_id.to_string(),
            issue_id: issue.id.clone(),
            title: title.into(),
            summary: summary.into(),
            operations: Vec::new(),
            files_modified: Vec::new(),
            files_deleted: Vec::new(),
            directories_deleted: Vec::new(),
            commands_executed: Vec::new(),
            processes_stopped: Vec::new(),
            services_stopped: Vec::new(),
            estimated_disk_space_recovered: 0,
            backup_created: false,
            risk: RiskLevel::Low,
            reversible: false,
            requires_confirmation: true,
            batch_safe: false,
            notes: Vec::new(),
            validations: Vec::new(),
        }
    }

    /// True when the fix would not change anything (e.g. the problem disappeared).
    pub fn is_noop(&self) -> bool {
        self.files_modified.is_empty()
            && self.files_deleted.is_empty()
            && self.directories_deleted.is_empty()
            && self.commands_executed.is_empty()
            && self.processes_stopped.is_empty()
            && self.services_stopped.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationCheck {
    pub name: String,
    pub passed: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationReport {
    pub checks: Vec<ValidationCheck>,
}

impl ValidationReport {
    pub fn ok() -> Self {
        Self::default()
    }

    pub fn check(&mut self, name: impl Into<String>, passed: bool, detail: impl Into<String>) {
        self.checks.push(ValidationCheck { name: name.into(), passed, detail: detail.into() });
    }

    pub fn passed(&self) -> bool {
        self.checks.iter().all(|c| c.passed)
    }

    pub fn failures(&self) -> Vec<&ValidationCheck> {
        self.checks.iter().filter(|c| !c.passed).collect()
    }
}

pub trait Fixer: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    /// Whether this fixer can handle the given issue.
    fn supports(&self, issue: &Issue) -> bool;
    /// Cheap static answer used to annotate issues after a scan.
    fn reversible(&self, issue: &Issue) -> bool;
    /// Eligible for "Fix safe issues".
    fn batch_safe(&self, _issue: &Issue) -> bool {
        false
    }
    /// Computes the exact changes without mutating anything.
    fn preview(&self, issue: &Issue, ctx: &SystemContext) -> Result<FixPreview>;
    /// Applies the fix through the transaction builder.
    fn apply(&self, issue: &Issue, ctx: &SystemContext, tx: &mut TxBuilder<'_>) -> Result<()>;
    /// Post-conditions verified after `apply`; any failed check triggers an automatic rollback.
    fn validate(&self, _issue: &Issue, _ctx: &SystemContext, _tx: &TxBuilder<'_>) -> Result<ValidationReport> {
        Ok(ValidationReport::ok())
    }
}

/// Registry of fixers, consulted by the engine to annotate issues and by the transaction
/// manager to apply fixes.
#[derive(Default)]
pub struct FixerRegistry {
    fixers: Vec<std::sync::Arc<dyn Fixer>>,
}

impl FixerRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, fixer: std::sync::Arc<dyn Fixer>) {
        self.fixers.push(fixer);
    }

    pub fn all(&self) -> &[std::sync::Arc<dyn Fixer>] {
        &self.fixers
    }

    pub fn by_id(&self, id: &str) -> Option<std::sync::Arc<dyn Fixer>> {
        self.fixers.iter().find(|f| f.id() == id).cloned()
    }

    /// The fixer for an issue: the one it names, when it supports the issue; otherwise the first
    /// registered fixer that supports it.
    pub fn for_issue(&self, issue: &Issue) -> Option<std::sync::Arc<dyn Fixer>> {
        if let Some(id) = &issue.fixer_id {
            if let Some(f) = self.by_id(id) {
                if f.supports(issue) {
                    return Some(f);
                }
            }
        }
        self.fixers.iter().find(|f| f.supports(issue)).cloned()
    }

    /// Fills `fixer_available`, `reversible` and `batch_safe` on an issue.
    pub fn annotate(&self, issue: &mut Issue) {
        match self.for_issue(issue) {
            Some(f) => {
                issue.fixer_id = Some(f.id().to_string());
                issue.fixer_available = true;
                issue.reversible = f.reversible(issue);
                issue.batch_safe = f.batch_safe(issue) && issue.confidence == crate::issue::Confidence::Confirmed;
            }
            None => {
                issue.fixer_available = false;
                issue.reversible = false;
                issue.batch_safe = false;
            }
        }
    }
}
