//! The scan engine: runs detectors in isolation, measures them and assembles the report.

use crate::context::SystemContext;
use crate::detector::{Detector, ScanMode};
use crate::fixer::FixerRegistry;
use crate::health::{self, HealthScore};
use crate::ids::random_id;
use crate::issue::{Category, Issue};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectorRun {
    pub id: String,
    pub name: String,
    pub category: Category,
    pub duration_ms: u64,
    /// "ok" or "failed"
    pub status: String,
    pub issues: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanReport {
    pub id: String,
    pub mode: ScanMode,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub issues: Vec<Issue>,
    /// Issues that were found but are on the ignore list.
    pub ignored: Vec<Issue>,
    pub detector_runs: Vec<DetectorRun>,
    pub detectors_run: usize,
    pub detectors_failed: usize,
    pub health: HealthScore,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "event")]
pub enum ScanProgress {
    Started { total: usize, mode: ScanMode },
    DetectorStarted { index: usize, total: usize, id: String, name: String },
    DetectorFinished { index: usize, total: usize, id: String, name: String, issues: usize, duration_ms: u64, failed: bool },
    Finished { issues: usize, duration_ms: u64 },
}

#[derive(Default)]
pub struct ScanEngine {
    detectors: Vec<Arc<dyn Detector>>,
}

impl ScanEngine {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, detector: Arc<dyn Detector>) {
        self.detectors.push(detector);
    }

    pub fn detectors(&self) -> &[Arc<dyn Detector>] {
        &self.detectors
    }

    pub fn detectors_for(&self, mode: ScanMode) -> Vec<Arc<dyn Detector>> {
        self.detectors.iter().filter(|d| mode.selects(d.meta().modes)).cloned().collect()
    }

    /// Runs a scan. Detector panics and errors are captured and reported as detector failures.
    pub fn run(
        &self,
        ctx: &SystemContext,
        mode: ScanMode,
        fixers: &FixerRegistry,
        ignored_ids: &HashSet<String>,
        progress: &mut dyn FnMut(ScanProgress),
    ) -> ScanReport {
        let started_at = Utc::now();
        let start = Instant::now();
        let detectors = self.detectors_for(mode);
        let total = detectors.len();
        progress(ScanProgress::Started { total, mode });
        let mut issues: Vec<Issue> = Vec::new();
        let mut runs = Vec::new();
        for (index, detector) in detectors.iter().enumerate() {
            let meta = detector.meta();
            progress(ScanProgress::DetectorStarted { index, total, id: meta.id.to_string(), name: meta.name.to_string() });
            let t = Instant::now();
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| detector.scan(ctx)));
            let duration_ms = t.elapsed().as_millis() as u64;
            let (status, count, error) = match result {
                Ok(Ok(found)) => {
                    let n = found.len();
                    issues.extend(found);
                    ("ok", n, None)
                }
                Ok(Err(e)) => {
                    tracing::warn!(detector = meta.id, error = %e, "detector failed");
                    ("failed", 0, Some(e.to_string()))
                }
                Err(panic) => {
                    let msg = panic
                        .downcast_ref::<String>()
                        .cloned()
                        .or_else(|| panic.downcast_ref::<&str>().map(|s| s.to_string()))
                        .unwrap_or_else(|| "panic".into());
                    tracing::error!(detector = meta.id, panic = %msg, "detector panicked");
                    ("failed", 0, Some(format!("internal error: {msg}")))
                }
            };
            tracing::debug!(detector = meta.id, duration_ms, issues = count, "detector finished");
            progress(ScanProgress::DetectorFinished {
                index,
                total,
                id: meta.id.to_string(),
                name: meta.name.to_string(),
                issues: count,
                duration_ms,
                failed: status == "failed",
            });
            runs.push(DetectorRun {
                id: meta.id.to_string(),
                name: meta.name.to_string(),
                category: meta.category,
                duration_ms,
                status: status.to_string(),
                issues: count,
                error,
            });
        }
        // Annotate with fixer availability, de-duplicate ids, split ignored.
        let mut seen = HashSet::new();
        issues.retain(|i| seen.insert(i.id.clone()));
        for issue in &mut issues {
            fixers.annotate(issue);
        }
        issues.sort_by(|a, b| {
            b.severity.cmp(&a.severity).then(b.confidence.cmp(&a.confidence)).then(a.category.cmp(&b.category)).then(a.title.cmp(&b.title))
        });
        let (ignored, active): (Vec<Issue>, Vec<Issue>) = issues.into_iter().partition(|i| ignored_ids.contains(&i.id));
        let health = health::compute(&active, &runs);
        let duration_ms = start.elapsed().as_millis() as u64;
        progress(ScanProgress::Finished { issues: active.len(), duration_ms });
        let capture = ctx.shell_capture();
        ScanReport {
            id: random_id("scan_"),
            mode,
            started_at,
            finished_at: Utc::now(),
            duration_ms,
            issues: active,
            ignored,
            detectors_failed: runs.iter().filter(|r| r.status == "failed").count(),
            detectors_run: runs.len(),
            detector_runs: runs,
            health,
            warnings: capture.warnings.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::MockRunner;
    use crate::detector::DetectorMeta;
    use crate::issue::{IssueBuilder, Severity};
    use crate::platform::FakePlatform;

    struct Good;
    impl Detector for Good {
        fn meta(&self) -> DetectorMeta {
            DetectorMeta { id: "test.good", name: "Good", category: Category::Shell, description: "", modes: &[ScanMode::Quick] }
        }
        fn scan(&self, _ctx: &SystemContext) -> crate::Result<Vec<Issue>> {
            Ok(vec![IssueBuilder::new("test.good", Category::Shell, "x", "found").severity(Severity::Low).build()])
        }
    }

    struct Panics;
    impl Detector for Panics {
        fn meta(&self) -> DetectorMeta {
            DetectorMeta { id: "test.panic", name: "Panics", category: Category::Disk, description: "", modes: &[ScanMode::Quick] }
        }
        fn scan(&self, _ctx: &SystemContext) -> crate::Result<Vec<Issue>> {
            panic!("boom");
        }
    }

    struct Fails;
    impl Detector for Fails {
        fn meta(&self) -> DetectorMeta {
            DetectorMeta { id: "test.fail", name: "Fails", category: Category::Disk, description: "", modes: &[ScanMode::Storage] }
        }
        fn scan(&self, _ctx: &SystemContext) -> crate::Result<Vec<Issue>> {
            Err(crate::Error::other("nope"))
        }
    }

    #[test]
    fn isolates_failures_and_respects_modes() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = SystemContext::for_test(dir.path(), Arc::new(FakePlatform::new()), Arc::new(MockRunner::new()), "/usr/bin");
        let mut engine = ScanEngine::new();
        engine.register(Arc::new(Good));
        engine.register(Arc::new(Panics));
        engine.register(Arc::new(Fails));
        let fixers = FixerRegistry::new();
        let mut events = 0;
        let report = engine.run(&ctx, ScanMode::Quick, &fixers, &HashSet::new(), &mut |_| events += 1);
        assert_eq!(report.detectors_run, 2, "storage-only detector skipped in quick mode");
        assert_eq!(report.detectors_failed, 1);
        assert_eq!(report.issues.len(), 1);
        assert!(events >= 4);
        let deep = engine.run(&ctx, ScanMode::Deep, &fixers, &HashSet::new(), &mut |_| {});
        assert_eq!(deep.detectors_run, 3);
        assert_eq!(deep.detectors_failed, 2);
        let ignored: HashSet<String> = deep.issues.iter().map(|i| i.id.clone()).collect();
        let filtered = engine.run(&ctx, ScanMode::Quick, &fixers, &ignored, &mut |_| {});
        assert!(filtered.issues.is_empty());
        assert_eq!(filtered.ignored.len(), 1);
        assert_eq!(filtered.health.score, 100);
    }
}
