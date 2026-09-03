//! Explainable health score.
//!
//! Every open issue subtracts `severity weight × confidence factor` points from 100. The
//! deduction per category is capped so one noisy area cannot zero the score alone. All
//! contributions are returned so the UI can show exactly how the number was computed.

use crate::engine::DetectorRun;
use crate::issue::{Category, Confidence, Issue, Severity};
use serde::{Deserialize, Serialize};

pub const CATEGORY_CAP: f64 = 40.0;

pub fn severity_weight(s: Severity) -> f64 {
    match s {
        Severity::Info => 0.0,
        Severity::Low => 2.0,
        Severity::Medium => 6.0,
        Severity::High => 12.0,
        Severity::Critical => 25.0,
    }
}

pub fn confidence_factor(c: Confidence) -> f64 {
    match c {
        Confidence::Confirmed => 1.0,
        Confidence::Likely => 0.6,
        Confidence::Possible => 0.3,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contribution {
    pub issue_id: String,
    pub title: String,
    pub category: Category,
    pub severity: Severity,
    pub confidence: Confidence,
    pub penalty: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryHealth {
    pub category: Category,
    pub label: String,
    pub issues: usize,
    pub problems: usize,
    pub warnings: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_severity: Option<Severity>,
    pub penalty: f64,
    pub capped: bool,
    pub checks_run: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthScore {
    pub score: u32,
    /// Issues with severity medium or above.
    pub problems: usize,
    /// Issues with severity low.
    pub warnings: usize,
    /// Informational findings.
    pub notes: usize,
    pub checks_passed: usize,
    pub checks_total: usize,
    pub contributions: Vec<Contribution>,
    pub categories: Vec<CategoryHealth>,
    pub explanation: String,
}

pub fn compute(issues: &[Issue], detector_runs: &[DetectorRun]) -> HealthScore {
    let mut contributions = Vec::new();
    let mut categories: Vec<CategoryHealth> = Category::all()
        .iter()
        .map(|c| CategoryHealth {
            category: *c,
            label: c.label().to_string(),
            issues: 0,
            problems: 0,
            warnings: 0,
            max_severity: None,
            penalty: 0.0,
            capped: false,
            checks_run: detector_runs.iter().filter(|r| r.category == *c).count(),
        })
        .collect();
    for issue in issues {
        let penalty = severity_weight(issue.severity) * confidence_factor(issue.confidence);
        contributions.push(Contribution {
            issue_id: issue.id.clone(),
            title: issue.title.clone(),
            category: issue.category,
            severity: issue.severity,
            confidence: issue.confidence,
            penalty,
        });
        if let Some(cat) = categories.iter_mut().find(|c| c.category == issue.category) {
            cat.issues += 1;
            if issue.is_problem() {
                cat.problems += 1;
            } else if issue.is_warning() {
                cat.warnings += 1;
            }
            cat.penalty += penalty;
            if cat.max_severity.is_none_or(|m| issue.severity > m) {
                cat.max_severity = Some(issue.severity);
            }
        }
    }
    let mut total = 0.0;
    for cat in &mut categories {
        if cat.penalty > CATEGORY_CAP {
            cat.penalty = CATEGORY_CAP;
            cat.capped = true;
        }
        total += cat.penalty;
    }
    let score = (100.0 - total).round().clamp(0.0, 100.0) as u32;
    let problems = issues.iter().filter(|i| i.is_problem()).count();
    let warnings = issues.iter().filter(|i| i.is_warning()).count();
    let notes = issues.iter().filter(|i| i.severity == Severity::Info).count();
    let checks_total = detector_runs.iter().filter(|r| r.status == "ok").count();
    let checks_passed = detector_runs
        .iter()
        .filter(|r| r.status == "ok" && !issues.iter().any(|i| i.detector_id == r.id && i.severity >= Severity::Low))
        .count();
    contributions.sort_by(|a, b| b.penalty.partial_cmp(&a.penalty).unwrap_or(std::cmp::Ordering::Equal));
    let explanation = if issues.is_empty() {
        "No issues found; every check passed.".to_string()
    } else {
        format!(
            "Start at 100. Each issue subtracts its severity weight (critical 25, high 12, medium 6, low 2, info 0) multiplied by a confidence factor (confirmed 1.0, likely 0.6, possible 0.3); deductions are capped at {CATEGORY_CAP:.0} per category. Total deduction: {total:.1}."
        )
    };
    HealthScore { score, problems, warnings, notes, checks_passed, checks_total, contributions, categories, explanation }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::issue::IssueBuilder;

    fn run(id: &str, category: Category) -> DetectorRun {
        DetectorRun { id: id.into(), name: id.into(), category, duration_ms: 1, status: "ok".into(), issues: 0, error: None }
    }

    #[test]
    fn perfect_score_without_issues() {
        let h = compute(&[], &[run("a", Category::Shell)]);
        assert_eq!(h.score, 100);
        assert_eq!(h.checks_passed, 1);
    }

    #[test]
    fn deductions_follow_severity_and_confidence() {
        let issues = vec![
            IssueBuilder::new("d", Category::Shell, "1", "x").severity(Severity::High).confidence(Confidence::Confirmed).build(),
            IssueBuilder::new("d", Category::Runtimes, "2", "y").severity(Severity::Medium).confidence(Confidence::Possible).build(),
            IssueBuilder::new("d", Category::Disk, "3", "z").severity(Severity::Info).confidence(Confidence::Confirmed).build(),
        ];
        let h = compute(&issues, &[run("d", Category::Shell)]);
        // 12 + 6*0.3 = 13.8 -> 86
        assert_eq!(h.score, 86);
        assert_eq!(h.problems, 2);
        assert_eq!(h.notes, 1);
        assert_eq!(h.checks_passed, 0);
    }

    #[test]
    fn category_cap_limits_damage() {
        let issues: Vec<Issue> = (0..10)
            .map(|i| {
                IssueBuilder::new("d", Category::Shell, i.to_string(), "x")
                    .severity(Severity::Critical)
                    .confidence(Confidence::Confirmed)
                    .build()
            })
            .collect();
        let h = compute(&issues, &[]);
        assert_eq!(h.score, 60);
        assert!(h.categories.iter().find(|c| c.category == Category::Shell).unwrap().capped);
    }
}
