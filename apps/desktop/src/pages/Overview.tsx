import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { BatchFixResult, FixPreview, Issue, IssueRecord, ScanMode } from "../lib/types";
import { GROUPS, severityGroup } from "../lib/plain";
import { formatBytes, formatDate, formatMs, relativeDate } from "../lib/format";
import { Button, Card, ConfirmDialog, ErrorBox, HealthRing, Loading, Sparkline, Term, useToast } from "../components/Basics";
import { IssueCardList } from "../components/IssueCard";
import { FixPreviewView } from "../components/FixPreviewView";
import { Icon } from "../components/Icons";

function headline(score: number, problems: number, warnings: number): [string, string] {
  if (problems === 0 && warnings === 0) return ["Your setup looks healthy", "Nothing needs your attention. DevDoctor checks again whenever you open it."];
  if (problems === 0) return ["Almost perfect", `${warnings} small thing${warnings > 1 ? "s" : ""} worth a look, nothing urgent.`];
  if (score >= 60) return [`${problems} thing${problems > 1 ? "s" : ""} to fix`, "Some checks found problems that can cause errors in your terminal."];
  return ["Your setup needs care", `${problems} problem${problems > 1 ? "s" : ""} found. Start with the ones marked “Needs attention”.`];
}

export function Onboarding({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="onboarding glass-strong">
      <h1>Welcome to DevDoctor</h1>
      <p className="muted" style={{ fontSize: 14, maxWidth: 640 }}>DevDoctor looks at how your Mac is set up for development and explains, in plain words, what is broken, why it matters and how to fix it. It never changes anything without showing you first.</p>
      <div className="promises">
        <div className="promise glass"><Icon name="eye" className="icon" /><div className="p-title">Understand first</div><div className="muted small">Every finding comes with what was seen and why it matters.</div></div>
        <div className="promise glass"><Icon name="shield" className="icon" /><div className="p-title">Preview before any change</div><div className="muted small">Files are backed up, changes are verified, and most fixes can be undone.</div></div>
        <div className="promise glass"><Icon name="lock" className="icon" /><div className="p-title">Stays on your Mac</div><div className="muted small">No account, no cloud, no telemetry. Secrets are never shown or stored.</div></div>
      </div>
      <div className="btn-row">
        <Button variant="primary" size="large" icon="play" onClick={onStart}>Run first check</Button>
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
      </div>
    </div>
  );
}

export function OverviewPage({ refreshKey, onScan, onboarding, onOnboardingDone }: { refreshKey: number; onScan: (mode: ScanMode) => void; onboarding: boolean; onOnboardingDone: () => void }) {
  const { navigate } = useNav();
  const toast = useToast();
  const ov = useAsync(() => api.overview(), [refreshKey]);
  const scans = useAsync(() => api.scans(20), [refreshKey]);
  const [safe, setSafe] = useState<{ records: IssueRecord[]; previews: { id: string; preview: FixPreview | null; error?: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchFixResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<{ issue: Issue; preview: FixPreview | null; error?: string } | null>(null);

  const openSafe = async () => {
    setError(null);
    try {
      const records = await api.safeFixes();
      const previews = await Promise.all(records.map(async (r) => {
        try { return { id: r.issue.id, preview: await api.previewFix(r.issue.id) }; } catch (e) { return { id: r.issue.id, preview: null, error: errorMessage(e) }; }
      }));
      setSafe({ records, previews });
    } catch (e) { setError(errorMessage(e)); }
  };
  const applySafe = async () => {
    if (!safe) return;
    setBusy(true);
    try {
      const res = await api.applySafeFixes(safe.previews.filter((p) => p.preview).map((p) => p.id));
      setBatchResult(res);
      setSafe(null);
      toast.push({ title: `${res.filter((r) => r.ok).length} of ${res.length} safe fixes applied`, tone: "green" });
      ov.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const startFix = async (issue: Issue) => {
    setFixing({ issue, preview: null });
    try { setFixing({ issue, preview: await api.previewFix(issue.id) }); } catch (e) { setFixing({ issue, preview: null, error: errorMessage(e) }); }
  };
  const applyOne = async () => {
    if (!fixing) return;
    setBusy(true);
    try {
      const tx = await api.applyFix(fixing.issue.id);
      toast.push({ title: "Fixed", body: tx.title, tone: "green", action: tx.operations.every((o) => o.kind === "file_write" || o.kind === "file_delete") ? { label: "Undo", onClick: () => api.rollback(tx.id, false).then(() => { toast.push({ title: "Undone", tone: "green" }); ov.reload(); }).catch((e) => toast.push({ title: "Could not undo", body: errorMessage(e), tone: "red" })) } : undefined });
      setFixing(null);
      ov.reload();
    } catch (e) { toast.push({ title: "Fix failed, nothing changed", body: errorMessage(e), tone: "red" }); setFixing(null); } finally { setBusy(false); }
  };
  const createBaseline = async () => {
    setBusy(true);
    try { await api.createSnapshot("baseline", "Initial environment snapshot", false); toast.push({ title: "Baseline snapshot created", body: "Future scans will show what changed since now.", tone: "green" }); ov.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  if (ov.loading && !ov.data) return <Loading what="overview" />;
  if (ov.error) return <ErrorBox error={ov.error} />;
  const o = ov.data!;
  const h = o.health;
  const scores = (scans.data ?? []).map((s) => s.health_score ?? 0).reverse();
  const grouped = GROUPS.map((g) => ({ ...g, issues: o.top_issues.filter((i) => severityGroup(i.severity) === g.id) }));
  const [title, sub] = h ? headline(h.score, o.issues.problems, o.issues.warnings) : ["", ""];

  return (
    <div className="page">
      {onboarding && <Onboarding onStart={() => { onOnboardingDone(); onScan("quick"); }} onSkip={onOnboardingDone} />}
      <ErrorBox error={error} />
      {o.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      {!h && !onboarding && (
        <Card>
          <p style={{ fontSize: 15 }}>No check yet. A quick check takes about a second and changes nothing.</p>
          <Button variant="primary" size="large" icon="play" onClick={() => onScan("quick")}>Check my environment</Button>
        </Card>
      )}
      {h && (
        <div className="hero glass-strong">
          <HealthRing score={h.score} />
          <div>
            <div className="headline">{title}</div>
            <div className="sub">{sub}</div>
            <div className="list-inline" style={{ marginTop: 12 }}>
              <span className="small muted">{h.checks_passed} of {h.checks_total} checks passed · last check {relativeDate(o.last_scan?.started_at)}{o.last_scan ? ` (${formatMs(o.last_scan.duration_ms)})` : ""}</span>
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <Button variant="primary" icon="refresh" onClick={() => onScan("quick")}>Check again</Button>
              {o.issues.batch_safe > 0 && <Button icon="check" onClick={openSafe}>Fix {o.issues.batch_safe} safe issue{o.issues.batch_safe > 1 ? "s" : ""}…</Button>}
              <Button variant="ghost" onClick={() => onScan("deep")}>Deep check</Button>
              <Button variant="ghost" onClick={() => onScan("storage")}>Disk space check</Button>
            </div>
          </div>
        </div>
      )}
      {batchResult && (
        <Card title="Safe fixes applied" actions={<Button size="small" variant="ghost" onClick={() => setBatchResult(null)}>Dismiss</Button>}>
          <ul className="section-list">{batchResult.map((r) => <li key={r.issue_id}>{r.ok ? "✓" : "✗"} {r.title}{r.error && <span className="muted"> — {r.error}</span>}</li>)}</ul>
        </Card>
      )}
      {h && (
        <>
          {grouped.filter((g) => g.issues.length > 0).map((g) => (
            <div key={g.id}>
              <h2>{g.title} <span className="muted" style={{ fontWeight: 400 }}>· {g.blurb}</span></h2>
              <IssueCardList issues={g.issues} onFix={startFix} />
            </div>
          ))}
          {o.issues.total === 0 && <Card><p><Icon name="check" size={14} /> No open issues. Everything DevDoctor checks looks fine.</p></Card>}
          {o.issues.total > o.top_issues.length && <p><Button size="small" onClick={() => navigate("problems")}>See all {o.issues.total} issues</Button></p>}
          <h2>Around your setup</h2>
          <div className="grid cols-3">
            <Card title="Health over time">
              {scores.length >= 2 ? <Sparkline values={scores} /> : <p className="muted small">Run a few checks to see a trend.</p>}
              <p className="tiny faint">{scores.length} check{scores.length === 1 ? "" : "s"} recorded</p>
            </Card>
            <Card title={<><Term k="snapshot">Since last snapshot</Term></>}>
              {o.recent_changes && o.recent_changes.changes.length > 0 ? (
                <><ul className="section-list">{o.recent_changes.headline.map((l, i) => <li key={i}>{l}</li>)}</ul><Button size="small" onClick={() => navigate("changes")}>Details</Button></>
              ) : (
                <p className="muted small">{o.baseline ? "No changes between the two most recent snapshots." : "Create a baseline to track what changes on your Mac over time."}</p>
              )}
              {!o.baseline && <Button size="small" onClick={createBaseline} disabled={busy}>Create baseline</Button>}
              {o.baseline && <p className="tiny faint">Baseline from {formatDate(o.baseline.created_at)}</p>}
            </Card>
            <Card title="Disk space">
              {o.storage_total_bytes != null ? (
                <><div className="stat"><div className="value">{formatBytes(o.storage_total_bytes)}</div><div className="label">used by developer tools · measured {relativeDate(o.storage_scanned_at)}</div></div><Button size="small" onClick={() => navigate("storage")} className="" >Open</Button></>
              ) : (
                <><p className="muted small">Not measured yet. Caches and old dependencies often take tens of gigabytes.</p><Button size="small" onClick={() => navigate("storage")}>Measure</Button></>
              )}
            </Card>
          </div>
          {o.recent_transactions.length > 0 && (
            <>
              <h2>Recent fixes</h2>
              <div className="list glass-strong">
                {o.recent_transactions.map((t) => (
                  <div key={t.id} className="row clickable" onClick={() => navigate("history")}>
                    <div className="grow"><div className="row-title">{t.title}</div><div className="row-sub">{formatDate(t.created_at)}</div></div>
                    <span className={`pill ${t.status === "applied" ? "green" : t.status === "rolled_back" ? "blue" : "red"}`}>{t.status === "applied" ? "Applied" : t.status === "rolled_back" ? "Undone" : "Failed"}</span>
                    <Icon name="chevron" className="chev" />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {safe && (
        <ConfirmDialog title={`Fix ${safe.previews.filter((p) => p.preview).length} safe issue${safe.previews.filter((p) => p.preview).length > 1 ? "s" : ""}`} confirmLabel="Fix them all" busy={busy} onConfirm={applySafe} onCancel={() => setSafe(null)}>
          <p className="muted">Only fixes that can be undone, are low-risk and are based on verified findings are included. Each one is backed up and checked; anything that fails is rolled back on its own.</p>
          {safe.previews.map((p) => (
            <div key={p.id} className="card glass" style={{ marginBottom: 8 }}>
              {p.preview ? <FixPreviewView preview={p.preview} compact /> : <div className="notice">{p.error}</div>}
            </div>
          ))}
        </ConfirmDialog>
      )}
      {fixing && (
        <ConfirmDialog title={fixing.preview?.title ?? fixing.issue.title} confirmLabel={fixing.preview?.reversible ? "Apply fix" : "Apply (cannot be undone)"} danger={fixing.preview ? !fixing.preview.reversible : false} busy={busy || !fixing.preview} onConfirm={applyOne} onCancel={() => setFixing(null)}>
          {fixing.preview ? <FixPreviewView preview={fixing.preview} compact /> : fixing.error ? <div className="notice">{fixing.error}</div> : <Loading what="preview" />}
        </ConfirmDialog>
      )}
    </div>
  );
}
