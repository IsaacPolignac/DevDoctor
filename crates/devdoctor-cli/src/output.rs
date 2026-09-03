//! Plain-text rendering helpers. No colours: the CLI must read well in logs and CI.

use devdoctor::devdoctor_core::issue::{Issue, Severity};
use devdoctor::devdoctor_core::units::{format_bytes, format_duration_ms};
use std::io::Write;

pub fn print_json<T: serde::Serialize>(value: &T) {
    let out = std::io::stdout();
    let mut lock = out.lock();
    let _ = serde_json::to_writer_pretty(&mut lock, value);
    let _ = writeln!(lock);
}

/// Renders rows as an aligned table. The first row is the header.
pub fn table(rows: &[Vec<String>]) -> String {
    if rows.is_empty() {
        return String::new();
    }
    let cols = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut widths = vec![0usize; cols];
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            widths[i] = widths[i].max(cell.chars().count().min(60));
        }
    }
    let mut out = String::new();
    for (ri, row) in rows.iter().enumerate() {
        let mut line = String::new();
        for (i, cell) in row.iter().enumerate() {
            let cell = truncate(cell, 60);
            if i + 1 == row.len() {
                line.push_str(&cell);
            } else {
                line.push_str(&format!("{:<width$}  ", cell, width = widths[i]));
            }
        }
        out.push_str(line.trim_end());
        out.push('\n');
        if ri == 0 {
            let underline: Vec<String> = widths.iter().map(|w| "-".repeat(*w)).collect();
            out.push_str(&underline.join("  "));
            out.push('\n');
        }
    }
    out
}

pub fn truncate(s: &str, max: usize) -> String {
    let count = s.chars().count();
    if count <= max {
        s.to_string()
    } else {
        let cut: String = s.chars().take(max.saturating_sub(1)).collect();
        format!("{cut}…")
    }
}

pub fn severity_tag(s: Severity) -> &'static str {
    match s {
        Severity::Critical => "CRIT",
        Severity::High => "HIGH",
        Severity::Medium => "MED ",
        Severity::Low => "LOW ",
        Severity::Info => "INFO",
    }
}

pub fn heading(text: &str) -> String {
    format!("\n{text}\n{}\n", "=".repeat(text.chars().count()))
}

pub fn subheading(text: &str) -> String {
    format!("\n{text}\n{}\n", "-".repeat(text.chars().count()))
}

pub fn bytes(b: u64) -> String {
    format_bytes(b)
}

pub fn ms(v: u64) -> String {
    format_duration_ms(v)
}

pub fn issue_line(issue: &Issue) -> Vec<String> {
    vec![
        issue.id.clone(),
        severity_tag(issue.severity).trim().to_string(),
        issue.confidence.as_str().to_string(),
        issue.category.label().to_string(),
        truncate(&issue.title, 70),
        if issue.fixer_available {
            if issue.batch_safe {
                "fix (safe)".into()
            } else {
                "fix".into()
            }
        } else {
            String::new()
        },
    ]
}

pub fn wrap(text: &str, indent: usize, width: usize) -> String {
    let pad = " ".repeat(indent);
    let mut out = String::new();
    for paragraph in text.split('\n') {
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            if line.chars().count() + word.chars().count() + 1 > width && !line.is_empty() {
                out.push_str(&pad);
                out.push_str(&line);
                out.push('\n');
                line.clear();
            }
            if !line.is_empty() {
                line.push(' ');
            }
            line.push_str(word);
        }
        out.push_str(&pad);
        out.push_str(&line);
        out.push('\n');
    }
    out
}
