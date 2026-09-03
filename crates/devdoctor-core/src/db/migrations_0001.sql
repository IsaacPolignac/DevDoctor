CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    detectors_run INTEGER NOT NULL,
    detectors_failed INTEGER NOT NULL,
    issue_count INTEGER NOT NULL,
    health_score INTEGER,
    report_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    detector_id TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence TEXT NOT NULL,
    title TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    resolved_at TEXT,
    issue_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_open ON issues(resolved_at);
CREATE INDEX IF NOT EXISTS idx_issues_detector ON issues(detector_id);

CREATE TABLE IF NOT EXISTS issue_occurrences (
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL,
    PRIMARY KEY (scan_id, issue_id)
);

CREATE TABLE IF NOT EXISTS ignored_issues (
    issue_id TEXT PRIMARY KEY,
    reason TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    issue_id TEXT,
    fixer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    tx_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    kind TEXT NOT NULL,
    op_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    original_path TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    mode INTEGER,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backups_path ON backups(original_path, created_at);

CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL,
    summary_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshot_items (
    snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    hash TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, category, key)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
