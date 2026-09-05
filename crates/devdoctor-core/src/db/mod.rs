//! SQLite persistence. All queries live here so the rest of the engine stays storage-agnostic.

use crate::backup::BackupRecord;
use crate::engine::ScanReport;
use crate::issue::Issue;
use crate::snapshot::{Snapshot, SnapshotItem, SnapshotSummary};
use crate::tracking::RunRecord;
use crate::transaction::Transaction;
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MIGRATIONS: &[(i64, &str)] = &[(1, include_str!("migrations_0001.sql")), (2, include_str!("migrations_0002.sql"))];

pub struct Database {
    conn: Mutex<Connection>,
    path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub id: String,
    pub mode: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub detectors_run: u32,
    pub detectors_failed: u32,
    pub issue_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health_score: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoredIssue {
    pub issue_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueRecord {
    pub issue: Issue,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<DateTime<Utc>>,
    pub ignored: bool,
}

fn ts(t: &DateTime<Utc>) -> String {
    t.to_rfc3339()
}

fn parse_ts(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now())
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| Error::io(parent, e))?;
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        let db = Self { conn: Mutex::new(conn), path: path.to_path_buf() };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn: Mutex::new(conn), path: PathBuf::from(":memory:") };
        db.migrate()?;
        Ok(db)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);")?;
        for (version, sql) in MIGRATIONS {
            let applied: Option<i64> =
                conn.query_row("SELECT version FROM schema_migrations WHERE version = ?1", params![version], |r| r.get(0)).optional()?;
            if applied.is_none() {
                conn.execute_batch(sql)?;
                conn.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)", params![version, ts(&Utc::now())])?;
                tracing::info!(version, "applied database migration");
            }
        }
        Ok(())
    }

    // ----- scans -----

    pub fn insert_scan(&self, report: &ScanReport) -> Result<()> {
        let mut conn = self.conn.lock().expect("db lock");
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO scans (id, mode, started_at, finished_at, duration_ms, detectors_run, detectors_failed, issue_count, health_score, report_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                report.id,
                report.mode.as_str(),
                ts(&report.started_at),
                ts(&report.finished_at),
                report.duration_ms as i64,
                report.detectors_run as i64,
                report.detectors_failed as i64,
                report.issues.len() as i64,
                report.health.score as i64,
                serde_json::to_string(report)?,
            ],
        )?;
        let now = ts(&Utc::now());
        for issue in &report.issues {
            tx.execute(
                "INSERT INTO issues (id, fingerprint, detector_id, category, severity, confidence, title, first_seen_at, last_seen_at, resolved_at, issue_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, NULL, ?9)
                 ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, resolved_at = NULL, severity = excluded.severity,
                   confidence = excluded.confidence, title = excluded.title, issue_json = excluded.issue_json",
                params![
                    issue.id,
                    issue.fingerprint,
                    issue.detector_id,
                    issue.category.id(),
                    issue.severity.as_str(),
                    issue.confidence.as_str(),
                    issue.title,
                    now,
                    serde_json::to_string(issue)?,
                ],
            )?;
            tx.execute("INSERT OR IGNORE INTO issue_occurrences (scan_id, issue_id) VALUES (?1, ?2)", params![report.id, issue.id])?;
        }
        // Issues from detectors that ran in this scan but were not reported again are resolved.
        let ran: Vec<String> = report.detector_runs.iter().filter(|r| r.status == "ok").map(|r| r.id.clone()).collect();
        for detector_id in ran {
            let reported: Vec<String> = report.issues.iter().filter(|i| i.detector_id == detector_id).map(|i| i.id.clone()).collect();
            let mut stmt = tx.prepare("SELECT id FROM issues WHERE detector_id = ?1 AND resolved_at IS NULL")?;
            let open: Vec<String> = stmt.query_map(params![detector_id], |r| r.get(0))?.flatten().collect();
            drop(stmt);
            for id in open {
                if !reported.contains(&id) {
                    tx.execute("UPDATE issues SET resolved_at = ?1 WHERE id = ?2", params![now, id])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn list_scans(&self, limit: usize) -> Result<Vec<ScanSummary>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT id, mode, started_at, finished_at, duration_ms, detectors_run, detectors_failed, issue_count, health_score
             FROM scans ORDER BY started_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(ScanSummary {
                id: r.get(0)?,
                mode: r.get(1)?,
                started_at: parse_ts(&r.get::<_, String>(2)?),
                finished_at: parse_ts(&r.get::<_, String>(3)?),
                duration_ms: r.get::<_, i64>(4)? as u64,
                detectors_run: r.get::<_, i64>(5)? as u32,
                detectors_failed: r.get::<_, i64>(6)? as u32,
                issue_count: r.get::<_, i64>(7)? as u32,
                health_score: r.get::<_, Option<i64>>(8)?.map(|v| v as u32),
            })
        })?;
        Ok(rows.flatten().collect())
    }

    pub fn latest_scan(&self) -> Result<Option<ScanSummary>> {
        Ok(self.list_scans(1)?.into_iter().next())
    }

    pub fn scan_report(&self, id: &str) -> Result<Option<ScanReport>> {
        let conn = self.conn.lock().expect("db lock");
        let json: Option<String> = conn.query_row("SELECT report_json FROM scans WHERE id = ?1", params![id], |r| r.get(0)).optional()?;
        match json {
            Some(j) => Ok(Some(serde_json::from_str(&j)?)),
            None => Ok(None),
        }
    }

    pub fn latest_scan_report(&self) -> Result<Option<ScanReport>> {
        let conn = self.conn.lock().expect("db lock");
        let json: Option<String> =
            conn.query_row("SELECT report_json FROM scans ORDER BY started_at DESC LIMIT 1", [], |r| r.get(0)).optional()?;
        match json {
            Some(j) => Ok(Some(serde_json::from_str(&j)?)),
            None => Ok(None),
        }
    }

    // ----- issues -----

    /// Open issues (not resolved). Ignored issues are included with `ignored = true`.
    pub fn open_issues(&self) -> Result<Vec<IssueRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT i.issue_json, i.first_seen_at, i.last_seen_at, i.resolved_at, (g.issue_id IS NOT NULL)
             FROM issues i LEFT JOIN ignored_issues g ON g.issue_id = i.id
             WHERE i.resolved_at IS NULL ORDER BY i.last_seen_at DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, bool>(4)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows.flatten() {
            let issue: Issue = serde_json::from_str(&row.0)?;
            out.push(IssueRecord {
                issue,
                first_seen_at: parse_ts(&row.1),
                last_seen_at: parse_ts(&row.2),
                resolved_at: row.3.as_deref().map(parse_ts),
                ignored: row.4,
            });
        }
        Ok(out)
    }

    /// Finds an issue by full id or unique prefix.
    pub fn issue(&self, id_or_prefix: &str) -> Result<Option<IssueRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT i.issue_json, i.first_seen_at, i.last_seen_at, i.resolved_at, (g.issue_id IS NOT NULL)
             FROM issues i LEFT JOIN ignored_issues g ON g.issue_id = i.id
             WHERE i.id = ?1 OR i.id LIKE ?2 ORDER BY (i.id = ?1) DESC LIMIT 2",
        )?;
        let like = format!("{}%", id_or_prefix.replace('%', ""));
        let rows: Vec<(String, String, String, Option<String>, bool)> = stmt
            .query_map(params![id_or_prefix, like], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?
            .flatten()
            .collect();
        if rows.is_empty() {
            return Ok(None);
        }
        if rows.len() > 1 && id_or_prefix.len() < 12 {
            return Err(Error::invalid(format!("issue id prefix `{id_or_prefix}` is ambiguous")));
        }
        let row = &rows[0];
        Ok(Some(IssueRecord {
            issue: serde_json::from_str(&row.0)?,
            first_seen_at: parse_ts(&row.1),
            last_seen_at: parse_ts(&row.2),
            resolved_at: row.3.as_deref().map(parse_ts),
            ignored: row.4,
        }))
    }

    pub fn resolve_issue(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute("UPDATE issues SET resolved_at = ?1 WHERE id = ?2", params![ts(&Utc::now()), id])?;
        Ok(())
    }

    pub fn ignore_issue(&self, id: &str, reason: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "INSERT INTO ignored_issues (issue_id, reason, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(issue_id) DO UPDATE SET reason = excluded.reason",
            params![id, reason, ts(&Utc::now())],
        )?;
        Ok(())
    }

    pub fn unignore_issue(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute("DELETE FROM ignored_issues WHERE issue_id = ?1", params![id])?;
        Ok(())
    }

    pub fn ignored_issues(&self) -> Result<Vec<IgnoredIssue>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare("SELECT issue_id, reason, created_at FROM ignored_issues")?;
        let rows = stmt.query_map([], |r| {
            Ok(IgnoredIssue { issue_id: r.get(0)?, reason: r.get(1)?, created_at: parse_ts(&r.get::<_, String>(2)?) })
        })?;
        Ok(rows.flatten().collect())
    }

    // ----- transactions -----

    pub fn save_transaction(&self, tx: &Transaction) -> Result<()> {
        let mut conn = self.conn.lock().expect("db lock");
        let dbtx = conn.transaction()?;
        dbtx.execute(
            "INSERT INTO transactions (id, issue_id, fixer_id, title, status, created_at, completed_at, tx_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at, tx_json = excluded.tx_json",
            params![
                tx.id,
                tx.issue_id,
                tx.fixer_id,
                tx.title,
                tx.status.as_str(),
                ts(&tx.created_at),
                tx.completed_at.as_ref().map(ts),
                serde_json::to_string(tx)?,
            ],
        )?;
        dbtx.execute("DELETE FROM transaction_operations WHERE transaction_id = ?1", params![tx.id])?;
        for (seq, op) in tx.operations.iter().enumerate() {
            dbtx.execute(
                "INSERT INTO transaction_operations (transaction_id, seq, kind, op_json) VALUES (?1, ?2, ?3, ?4)",
                params![tx.id, seq as i64, op.kind(), serde_json::to_string(op)?],
            )?;
        }
        for b in &tx.backups {
            dbtx.execute(
                "INSERT OR IGNORE INTO backups (id, transaction_id, original_path, stored_path, sha256, size, mode, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    b.id,
                    b.transaction_id,
                    b.original_path.to_string_lossy(),
                    b.stored_path.to_string_lossy(),
                    b.sha256,
                    b.size as i64,
                    b.mode.map(|m| m as i64),
                    ts(&b.created_at),
                ],
            )?;
        }
        dbtx.commit()?;
        Ok(())
    }

    pub fn list_transactions(&self, limit: usize) -> Result<Vec<Transaction>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare("SELECT tx_json FROM transactions ORDER BY created_at DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit as i64], |r| r.get::<_, String>(0))?;
        let mut out = Vec::new();
        for json in rows.flatten() {
            out.push(serde_json::from_str(&json)?);
        }
        Ok(out)
    }

    pub fn transaction(&self, id_or_prefix: &str) -> Result<Option<Transaction>> {
        let conn = self.conn.lock().expect("db lock");
        let like = format!("{}%", id_or_prefix.replace('%', ""));
        let mut stmt = conn.prepare("SELECT tx_json FROM transactions WHERE id = ?1 OR id LIKE ?2 ORDER BY (id = ?1) DESC LIMIT 2")?;
        let rows: Vec<String> = stmt.query_map(params![id_or_prefix, like], |r| r.get(0))?.flatten().collect();
        match rows.len() {
            0 => Ok(None),
            1 => Ok(Some(serde_json::from_str(&rows[0])?)),
            _ => {
                let first: Transaction = serde_json::from_str(&rows[0])?;
                if first.id == id_or_prefix {
                    Ok(Some(first))
                } else {
                    Err(Error::invalid(format!("transaction id prefix `{id_or_prefix}` is ambiguous")))
                }
            }
        }
    }

    // ----- backups -----

    pub fn backups_for_file(&self, path: &Path) -> Result<Vec<BackupRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT id, transaction_id, original_path, stored_path, sha256, size, mode, created_at FROM backups WHERE original_path = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![path.to_string_lossy()], |r| {
            Ok(BackupRecord {
                id: r.get(0)?,
                transaction_id: r.get(1)?,
                original_path: PathBuf::from(r.get::<_, String>(2)?),
                stored_path: PathBuf::from(r.get::<_, String>(3)?),
                sha256: r.get(4)?,
                size: r.get::<_, i64>(5)? as u64,
                mode: r.get::<_, Option<i64>>(6)?.map(|m| m as u32),
                created_at: parse_ts(&r.get::<_, String>(7)?),
            })
        })?;
        Ok(rows.flatten().collect())
    }

    pub fn all_backups(&self) -> Result<Vec<BackupRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT id, transaction_id, original_path, stored_path, sha256, size, mode, created_at FROM backups ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(BackupRecord {
                id: r.get(0)?,
                transaction_id: r.get(1)?,
                original_path: PathBuf::from(r.get::<_, String>(2)?),
                stored_path: PathBuf::from(r.get::<_, String>(3)?),
                sha256: r.get(4)?,
                size: r.get::<_, i64>(5)? as u64,
                mode: r.get::<_, Option<i64>>(6)?.map(|m| m as u32),
                created_at: parse_ts(&r.get::<_, String>(7)?),
            })
        })?;
        Ok(rows.flatten().collect())
    }

    // ----- snapshots -----

    pub fn insert_snapshot(&self, snapshot: &Snapshot) -> Result<()> {
        let mut conn = self.conn.lock().expect("db lock");
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO snapshots (id, kind, label, created_at, summary_json) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![snapshot.id, snapshot.kind, snapshot.label, ts(&snapshot.created_at), serde_json::to_string(&snapshot.summary)?],
        )?;
        for item in &snapshot.items {
            tx.execute(
                "INSERT OR REPLACE INTO snapshot_items (snapshot_id, category, key, value_json, hash) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![snapshot.id, item.category, item.key, serde_json::to_string(&item.value)?, item.hash],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn list_snapshots(&self, limit: usize) -> Result<Vec<SnapshotSummary>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare("SELECT id, kind, label, created_at, summary_json FROM snapshots ORDER BY created_at DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })?;
        let mut out = Vec::new();
        for (id, kind, label, created_at, summary) in rows.flatten() {
            out.push(SnapshotSummary { id, kind, label, created_at: parse_ts(&created_at), summary: serde_json::from_str(&summary)? });
        }
        Ok(out)
    }

    pub fn snapshot(&self, id_or_prefix: &str) -> Result<Option<Snapshot>> {
        let conn = self.conn.lock().expect("db lock");
        let like = format!("{}%", id_or_prefix.replace('%', ""));
        let header: Option<(String, String, Option<String>, String, String)> = conn
            .query_row(
                "SELECT id, kind, label, created_at, summary_json FROM snapshots WHERE id = ?1 OR id LIKE ?2 ORDER BY (id = ?1) DESC LIMIT 1",
                params![id_or_prefix, like],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .optional()?;
        let Some((id, kind, label, created_at, summary)) = header else { return Ok(None) };
        let mut stmt =
            conn.prepare("SELECT category, key, value_json, hash FROM snapshot_items WHERE snapshot_id = ?1 ORDER BY category, key")?;
        let rows = stmt.query_map(params![id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?))
        })?;
        let mut items = Vec::new();
        for (category, key, value, hash) in rows.flatten() {
            items.push(SnapshotItem { category, key, value: serde_json::from_str(&value)?, hash });
        }
        Ok(Some(Snapshot { id, kind, label, created_at: parse_ts(&created_at), summary: serde_json::from_str(&summary)?, items }))
    }

    pub fn latest_snapshot_id(&self, kind: Option<&str>) -> Result<Option<String>> {
        let conn = self.conn.lock().expect("db lock");
        let id: Option<String> = match kind {
            Some(k) => conn
                .query_row("SELECT id FROM snapshots WHERE kind = ?1 ORDER BY created_at DESC LIMIT 1", params![k], |r| r.get(0))
                .optional()?,
            None => conn.query_row("SELECT id FROM snapshots ORDER BY created_at DESC LIMIT 1", [], |r| r.get(0)).optional()?,
        };
        Ok(id)
    }

    pub fn snapshot_ids_before(&self, snapshot_id: &str, limit: usize) -> Result<Vec<String>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare(
            "SELECT id FROM snapshots WHERE created_at < (SELECT created_at FROM snapshots WHERE id = ?1) ORDER BY created_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![snapshot_id, limit as i64], |r| r.get::<_, String>(0))?;
        Ok(rows.flatten().collect())
    }

    // ----- tracked runs -----

    pub fn insert_run(&self, run: &RunRecord) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "INSERT INTO runs (id, label, started_at, finished_at, exit_code, before_snapshot_id, after_snapshot_id, run_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                run.id,
                run.label,
                ts(&run.started_at),
                ts(&run.finished_at),
                run.exit_code,
                run.before_snapshot_id,
                run.after_snapshot_id,
                serde_json::to_string(run)?,
            ],
        )?;
        Ok(())
    }

    pub fn list_runs(&self, limit: usize) -> Result<Vec<RunRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare("SELECT run_json FROM runs ORDER BY started_at DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit as i64], |r| r.get::<_, String>(0))?;
        let mut out = Vec::new();
        for json in rows.flatten() {
            out.push(serde_json::from_str(&json)?);
        }
        Ok(out)
    }

    pub fn run(&self, id_or_prefix: &str) -> Result<Option<RunRecord>> {
        let conn = self.conn.lock().expect("db lock");
        let like = format!("{}%", id_or_prefix.replace('%', ""));
        let mut stmt = conn.prepare("SELECT run_json FROM runs WHERE id = ?1 OR id LIKE ?2 ORDER BY (id = ?1) DESC LIMIT 2")?;
        let rows: Vec<String> = stmt.query_map(params![id_or_prefix, like], |r| r.get(0))?.flatten().collect();
        match rows.len() {
            0 => Ok(None),
            1 => Ok(Some(serde_json::from_str(&rows[0])?)),
            _ => {
                let first: RunRecord = serde_json::from_str(&rows[0])?;
                if first.id == id_or_prefix {
                    Ok(Some(first))
                } else {
                    Err(Error::invalid(format!("run id prefix `{id_or_prefix}` is ambiguous")))
                }
            }
        }
    }

    // ----- settings -----

    pub fn get_setting(&self, key: &str) -> Result<Option<serde_json::Value>> {
        let conn = self.conn.lock().expect("db lock");
        let json: Option<String> =
            conn.query_row("SELECT value_json FROM settings WHERE key = ?1", params![key], |r| r.get(0)).optional()?;
        match json {
            Some(j) => Ok(Some(serde_json::from_str(&j)?)),
            None => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &serde_json::Value) -> Result<()> {
        let conn = self.conn.lock().expect("db lock");
        conn.execute(
            "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
            params![key, serde_json::to_string(value)?, ts(&Utc::now())],
        )?;
        Ok(())
    }

    pub fn all_settings(&self) -> Result<serde_json::Map<String, serde_json::Value>> {
        let conn = self.conn.lock().expect("db lock");
        let mut stmt = conn.prepare("SELECT key, value_json FROM settings")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        let mut map = serde_json::Map::new();
        for (k, v) in rows.flatten() {
            map.insert(k, serde_json::from_str(&v)?);
        }
        Ok(map)
    }
}
