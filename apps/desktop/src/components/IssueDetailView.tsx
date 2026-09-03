import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { Transaction } from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";
import { formatDate, shortenHome } from "../lib/format";
import { ConfidenceBadge, ConfirmDialog, ErrorBox, KeyValue, Loading, PathLink, SeverityBadge, StatusBadge } from "./Basics";
import { FixPreviewView } from "./FixPreviewView";
import { TransactionView } from "./TransactionView";

export function IssueDetailView({ issueId }: { issueId: string }) {
  const { navigate, home } = useNav();
  const detail = useAsync(() => api.issue(issueId, true), [issueId]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (detail.loading) return <Loading what="issue" />;
  if (detail.error || !detail.data) return <ErrorBox error={detail.error ?? "Issue not found"} />;
  const { record, preview, preview_error, fixer_name, transactions } = detail.data;
  const issue = record.issue;

  const apply = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const tx = await api.applyFix(issue.id);
      setResult(tx);
      setConfirming(false);
      detail.reload();
    } catch (e) {
      setActionError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };
  const toggleIgnore = async () => {
    try {
      if (record.ignored) await api.unignore(issue.id);
      else await api.ignore(issue.id);
      detail.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button className="btn small" onClick={() => navigate("problems")}>← Problems</button>
        <span className="muted small">detector {issue.detector_id} · id {issue.id}</span>
      </div>
      <h1>{issue.title}</h1>
      <div className="list-inline" style={{ margin: "6px 0 14px" }}>
        <SeverityBadge severity={issue.severity} />
        <ConfidenceBadge confidence={issue.confidence} />
        <span className="badge">{CATEGORY_LABELS[issue.category]}</span>
        {record.ignored && <span className="badge">ignored</span>}
        {record.resolved_at && <span className="badge ok">resolved {formatDate(record.resolved_at)}</span>}
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>What was found</h3>
          <p>{issue.description}</p>
          {issue.impact && (<><h3>Why it matters</h3><p>{issue.impact}</p></>)}
          <h3>Recommended action</h3>
          <p>{issue.recommended_action}</p>
        </div>
        <div className="card">
          <h3>Why DevDoctor believes this</h3>
          {issue.evidence.length === 0 ? <p className="muted">No additional evidence recorded.</p> : <ul className="section-list">{issue.evidence.map((e, i) => <li key={i} className="mono">{shortenHome(e, home)}</li>)}</ul>}
          {issue.affected_files.length > 0 && (
            <>
              <h3>Affected files</h3>
              <ul className="section-list">{issue.affected_files.map((f, i) => <li key={i}><PathLink path={f.path} line={f.line} />{f.excerpt && <div className="mono muted">{f.excerpt}</div>}</li>)}</ul>
            </>
          )}
          {issue.affected_commands.length > 0 && (
            <>
              <h3>Affected commands</h3>
              <div className="list-inline">{issue.affected_commands.map((c) => <button key={c} className="btn small" onClick={() => navigate("resolve", { command: c })}>{c}</button>)}</div>
            </>
          )}
          <h3>Details</h3>
          <KeyValue rows={[["First seen", formatDate(record.first_seen_at)], ["Last seen", formatDate(record.last_seen_at)], ["Automatic fix", issue.fixer_available ? fixer_name ?? "available" : "not available"], ["Reversible", issue.reversible ? "yes" : "no"], ["Safe for batch fix", issue.batch_safe ? "yes" : "no"]]} />
        </div>
      </div>
      {issue.current_state && (<><h2>Current state</h2><pre>{shortenHome(issue.current_state, home)}</pre></>)}
      {issue.technical_description && (<><h2>Technical details</h2><pre>{shortenHome(issue.technical_description, home)}</pre></>)}

      <h2>Fix</h2>
      <ErrorBox error={actionError} />
      {result && (
        <div className="success-box">
          <strong>Fix applied.</strong> Transaction {result.id} — undo from Fix history.
          <TransactionView tx={result} onChanged={() => { setResult(null); detail.reload(); }} />
        </div>
      )}
      {!issue.fixer_available && <p className="muted">No automatic fix for this issue. Follow the recommended action above.</p>}
      {preview_error && <div className="notice">Fix preview unavailable: {preview_error}</div>}
      {preview && (
        <div className="card">
          <FixPreviewView preview={preview} />
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setConfirming(true)} disabled={record.resolved_at != null}>Fix…</button>
            <button className="btn" onClick={toggleIgnore}>{record.ignored ? "Stop ignoring" : "Ignore"}</button>
          </div>
        </div>
      )}
      {!preview && (
        <div className="btn-row"><button className="btn" onClick={toggleIgnore}>{record.ignored ? "Stop ignoring" : "Ignore this issue"}</button></div>
      )}
      {confirming && preview && (
        <ConfirmDialog title={preview.title} confirmLabel={preview.reversible ? "Apply fix (backup + rollback available)" : "Apply (not reversible)"} danger={!preview.reversible} busy={busy} onConfirm={apply} onCancel={() => setConfirming(false)}>
          <FixPreviewView preview={preview} />
        </ConfirmDialog>
      )}
      {transactions.length > 0 && (
        <>
          <h2>Fix history for this issue</h2>
          {transactions.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 8 }}>
              <div className="list-inline"><StatusBadge status={t.status} /> <span className="muted">{formatDate(t.created_at)}</span> <span className="mono">{t.id}</span></div>
              <TransactionView tx={t} onChanged={detail.reload} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
