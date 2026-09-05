CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    exit_code INTEGER,
    before_snapshot_id TEXT,
    after_snapshot_id TEXT,
    run_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
