import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { formatDate } from "../lib/format";
import { Card, ConfirmDialog, ErrorBox, Loading } from "../components/Basics";

export function ChangesPage({ refreshKey }: { refreshKey: number }) {
  const snaps = useAsync(() => api.snapshots(100), [refreshKey]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const diff = useAsync(() => api.changes(from || null, to || null), [from, to, refreshKey]);
  const [creating, setCreating] = useState(false);
  const [baseline, setBaseline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    try { await api.createSnapshot(baseline ? "baseline" : "manual", null, false); setCreating(false); snaps.reload(); diff.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  if (snaps.loading && !snaps.data) return <Loading what="snapshots" />;
  const list = snaps.data ?? [];
  const hasBaseline = list.some((s) => s.kind === "baseline");
  return (
    <div>
      <h1>What changed</h1>
      <p className="muted">DevDoctor records a snapshot after every scan (PATH, startup file hashes, packages, runtimes, services, ports, tools, models). Comparing two snapshots shows exactly what changed. DevDoctor cannot know what happened before it was installed.</p>
      <ErrorBox error={snaps.error ?? error} />
      <div className="filters">
        <span>Compare</span>
        <select className="text" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">previous snapshot</option>
          {hasBaseline && <option value="baseline">baseline</option>}
          {list.map((s) => <option key={s.id} value={s.id}>{formatDate(s.created_at)} · {s.kind}{s.label ? ` · ${s.label}` : ""}</option>)}
        </select>
        <span>with</span>
        <select className="text" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">latest snapshot</option>
          {list.map((s) => <option key={s.id} value={s.id}>{formatDate(s.created_at)} · {s.kind}{s.label ? ` · ${s.label}` : ""}</option>)}
        </select>
        <button className="btn" onClick={() => { setBaseline(!hasBaseline); setCreating(true); }}>{hasBaseline ? "Create snapshot…" : "Create baseline snapshot…"}</button>
      </div>
      {diff.loading ? <Loading what="changes" /> : diff.error ? <ErrorBox error={diff.error} /> : !diff.data ? (
        <Card><p className="muted">Not enough snapshots to compare yet. Run a scan later (DevDoctor snapshots after each scan) or create a snapshot now.</p></Card>
      ) : (
        <>
          <Card title={`Between ${formatDate(diff.data.from_at)} and ${formatDate(diff.data.to_at)}`}>
            {diff.data.changes.length === 0 ? <p className="muted">No changes detected.</p> : <ul className="section-list">{diff.data.headline.map((h, i) => <li key={i}><strong>{h}</strong></li>)}</ul>}
          </Card>
          {diff.data.categories.map((c) => (
            <div key={c.category}>
              <h2>{c.label} <span className="muted" style={{ fontWeight: 400 }}>{[c.added ? `+${c.added}` : "", c.removed ? `-${c.removed}` : "", c.changed ? `~${c.changed}` : ""].filter(Boolean).join(" ")}</span></h2>
              <ul className="section-list">{diff.data!.changes.filter((ch) => ch.category === c.category).map((ch) => <li key={`${ch.category}:${ch.key}`}><span className={`badge ${ch.kind === "added" ? "ok" : ch.kind === "removed" ? "high" : "low"}`}>{ch.kind}</span> {ch.description}</li>)}</ul>
            </div>
          ))}
        </>
      )}
      <h2>Snapshots</h2>
      {list.length === 0 ? <p className="muted">None yet.</p> : (
        <table className="data"><thead><tr><th>When</th><th>Kind</th><th>Label</th><th>Items</th><th>Id</th></tr></thead><tbody>{list.map((s) => <tr key={s.id}><td>{formatDate(s.created_at)}</td><td>{s.kind}</td><td>{s.label ?? ""}</td><td className="num">{Object.values(s.summary.counts).reduce((a, b) => a + b, 0)}</td><td className="mono muted small">{s.id}</td></tr>)}</tbody></table>
      )}
      {creating && (
        <ConfirmDialog title={baseline ? "Create baseline snapshot" : "Create snapshot"} confirmLabel="Create" busy={busy} onConfirm={create} onCancel={() => setCreating(false)}>
          <p>A snapshot stores metadata only: PATH entries, hashes of your startup files, installed package names and versions, runtime versions, startup services, listening ports and environment variable <em>names</em>. No file contents and no secret values are stored.</p>
          {baseline && <p>The baseline is the reference used by "What changed since baseline".</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
