import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { BatchFixResult, FixPreview, IssueRecord } from "../lib/types";
import { formatBytes, formatDate, formatMs, relativeDate } from "../lib/format";
import { Card, ConfirmDialog, ErrorBox, Loading } from "../components/Basics";
import { IssueList } from "../components/IssueList";
import { FixPreviewView } from "../components/FixPreviewView";

function scoreClass(score: number) {
  return score >= 85 ? "good" : score >= 60 ? "mid" : "bad";
}

export function OverviewPage({ refreshKey, onScan }: { refreshKey: number; onScan: (mode: "quick" | "deep" | "storage") => void }) {
  const { navigate } = useNav();
  const ov = useAsync(() => api.overview(), [refreshKey]);
  const [safe, setSafe] = useState<{ records: IssueRecord[]; previews: { id: string; preview: FixPreview | null; error?: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchFixResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openSafe = async () => {
    setError(null);
    try {
      const records = await api.safeFixes();
      const previews = await Promise.all(records.map(async (r) => {
        try { return { id: r.issue.id, preview: await api.previewFix(r.issue.id) }; }
        catch (e) { return { id: r.issue.id, preview: null, error: errorMessage(e) }; }
      }));
      setSafe({ records, previews });
    } catch (e) { setError(errorMessage(e)); }
  };
  const applySafe = async () => {
    if (!safe) return;
    setBusy(true);
    try {
      const ids = safe.previews.filter((p) => p.preview).map((p) => p.id);
      const res = await api.applySafeFixes(ids);
      setBatchResult(res);
      setSafe(null);
      ov.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const createBaseline = async () => {
    setBusy(true);
    try { await api.createSnapshot("baseline", "Initial environment snapshot", false); ov.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  if (ov.loading && !ov.data) return <Loading what="overview" />;
  if (ov.error) return <ErrorBox error={ov.error} />;
  const o = ov.data!;
  const h = o.health;
  return (
    <div>
      <h1>Development Environment Health</h1>
      <p className="muted">{o.system.os.name} {o.system.os.version} · {o.system.os.arch}{o.system.os.rosetta ? " (Rosetta)" : ""} · {o.system.shell} · {o.detector_count} detectors</p>
      <ErrorBox error={error} />
      {o.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      {!h && (
        <Card>
          <p>No scan yet. A quick scan checks your shell, PATH, runtimes, package managers, processes, ports and services in about a second.</p>
          <div className="btn-row"><button className="btn primary" onClick={() => onScan("quick")}>Run Quick Scan</button></div>
        </Card>
      )}
      {h && (
        <div className="grid cols-4" style={{ marginBottom: 12 }}>
          <Card>
            <div className={`score ${scoreClass(h.score)}`}>{h.score}<span className="muted" style={{ fontSize: 16 }}> / 100</span></div>
            <div className="muted small" style={{ marginTop: 6 }}>Last scan {relativeDate(o.last_scan?.started_at)} ({o.last_scan ? formatMs(o.last_scan.duration_ms) : ""})</div>
          </Card>
          <Card><div className="stat"><div className="value">{o.issues.problems}</div><div className="label">problems (medium and above)</div></div></Card>
          <Card><div className="stat"><div className="value">{o.issues.warnings}</div><div className="label">warnings · {o.issues.notes} notes</div></div></Card>
          <Card><div className="stat"><div className="value">{h.checks_passed} / {h.checks_total}</div><div className="label">checks passed</div></div></Card>
        </div>
      )}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => onScan("quick")}>Quick Scan</button>
        <button className="btn" onClick={() => onScan("deep")}>Deep Scan</button>
        <button className="btn" onClick={() => onScan("storage")}>Storage Scan</button>
        {o.issues.batch_safe > 0 && <button className="btn" onClick={openSafe}>Fix safe issues ({o.issues.batch_safe})…</button>}
        {!o.baseline && <button className="btn" onClick={createBaseline} disabled={busy}>Create initial environment snapshot</button>}
      </div>
      {batchResult && (
        <Card title="Safe fixes applied">
          <ul className="section-list">{batchResult.map((r) => <li key={r.issue_id}>{r.ok ? "✓" : "✗"} {r.title} {r.error && <span className="muted">— {r.error}</span>}</li>)}</ul>
          <button className="btn small" onClick={() => setBatchResult(null)}>Dismiss</button>
        </Card>
      )}
      {h && (
        <div className="grid cols-2">
          <Card title="Categories">
            <table className="data">
              <thead><tr><th>Category</th><th>Checks</th><th>Issues</th><th>Worst</th><th>Penalty</th></tr></thead>
              <tbody>
                {h.categories.filter((c) => c.checks_run > 0 || c.issues > 0).map((c) => (
                  <tr key={c.category} className="clickable" onClick={() => navigate("problems")}>
                    <td>{c.label}</td><td className="num">{c.checks_run}</td><td className="num">{c.issues}</td><td>{c.max_severity ?? <span className="muted">—</span>}</td><td className="num">{c.penalty.toFixed(1)}{c.capped ? " (capped)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">{h.explanation}</p>
          </Card>
          <div className="grid" style={{ alignContent: "start" }}>
            <Card title="Since the previous snapshot">
              {o.recent_changes && o.recent_changes.changes.length > 0 ? (
                <>
                  <ul className="section-list">{o.recent_changes.headline.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  <button className="btn small" onClick={() => navigate("changes")}>View details</button>
                </>
              ) : (
                <p className="muted">{o.baseline ? "No changes detected between the two most recent snapshots." : "DevDoctor records a snapshot after every scan. Create a baseline to track what changes over time."}</p>
              )}
              {o.baseline && <p className="muted small">Baseline: {formatDate(o.baseline.created_at)}</p>}
            </Card>
            <Card title="Developer storage">
              {o.storage_total_bytes != null ? (
                <p><strong>{formatBytes(o.storage_total_bytes)}</strong> measured {relativeDate(o.storage_scanned_at)}. <button className="btn small" onClick={() => navigate("storage")}>Open</button></p>
              ) : (
                <p className="muted">Not measured yet. <button className="btn small" onClick={() => navigate("storage")}>Scan storage</button></p>
              )}
            </Card>
            <Card title="Recent fixes">
              {o.recent_transactions.length === 0 ? <p className="muted">No fixes applied yet.</p> : (
                <ul className="section-list">{o.recent_transactions.map((t) => <li key={t.id}>{formatDate(t.created_at)} — {t.title} <span className={`badge ${t.status}`}>{t.status.replace("_", " ")}</span></li>)}</ul>
              )}
              <button className="btn small" onClick={() => navigate("history")}>Fix history</button>
            </Card>
          </div>
        </div>
      )}
      {h && (
        <>
          <h2>Top issues</h2>
          <IssueList issues={o.top_issues} empty="No open issues. Everything DevDoctor checks looks fine." />
          {o.issues.total > o.top_issues.length && <p><button className="btn small" onClick={() => navigate("problems")}>All {o.issues.total} issues</button></p>}
        </>
      )}
      {safe && (
        <ConfirmDialog title={`Fix ${safe.previews.filter((p) => p.preview).length} safe issue(s)`} confirmLabel="Apply all" busy={busy} onConfirm={applySafe} onCancel={() => setSafe(null)}>
          <p className="muted">Only fixes that are reversible, low-risk and based on confirmed findings are included. Each one creates backups and is validated; a failed validation rolls that fix back automatically.</p>
          {safe.previews.map((p) => (
            <div key={p.id} className="card" style={{ marginBottom: 8 }}>
              {p.preview ? <FixPreviewView preview={p.preview} /> : <div className="notice">{p.error}</div>}
            </div>
          ))}
        </ConfirmDialog>
      )}
    </div>
  );
}
