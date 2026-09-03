//! Detector interface.

use crate::context::SystemContext;
use crate::issue::{Category, Issue};
use crate::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanMode {
    /// Fast checks: shell, PATH, runtimes, processes, ports, package managers, services.
    Quick,
    /// Everything, including slower checks such as `brew doctor` and storage measurement.
    Deep,
    /// Developer storage only.
    Storage,
}

impl ScanMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            ScanMode::Quick => "quick",
            ScanMode::Deep => "deep",
            ScanMode::Storage => "storage",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "quick" => Some(ScanMode::Quick),
            "deep" => Some(ScanMode::Deep),
            "storage" => Some(ScanMode::Storage),
            _ => None,
        }
    }

    /// Whether a detector tagged with `tags` runs in this mode. Deep runs everything.
    pub fn selects(&self, tags: &[ScanMode]) -> bool {
        match self {
            ScanMode::Deep => true,
            other => tags.contains(other),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DetectorMeta {
    pub id: &'static str,
    pub name: &'static str,
    pub category: Category,
    pub description: &'static str,
    /// Scan modes in which the detector runs (Deep always runs everything).
    pub modes: &'static [ScanMode],
}

/// A detector inspects the machine through the [`SystemContext`] and reports issues.
/// Detectors must never mutate anything. A failing detector must not break the scan: the engine
/// isolates failures and reports them separately from environment issues.
pub trait Detector: Send + Sync {
    fn meta(&self) -> DetectorMeta;
    fn scan(&self, ctx: &SystemContext) -> Result<Vec<Issue>>;
}
