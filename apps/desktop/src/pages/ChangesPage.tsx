import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { formatDate } from "../lib/format";
import { Button, Card, ConfirmDialog, ErrorBox, Loading, PageHeader, Pill, Term, useToast } from "../components/Basics";

export function ChangesPage({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const snaps = useAsync(() => api.snapshots(100), [refreshKey]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const diff = useAsync(() => api.changes(from || null, to || null), [from, to, refreshKey]);
  const [creating, setCreating] = useState(false);
  const [baseline, setBaseline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    try { await api.createSnapshot(baseline ? "baseline" : "manual", null, false); toast.push({ title: baseline ? "Baseline created" : "Snapshot created", tone: "green" }); setCreating(false); snaps.reload(); diff.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  if (snaps.loading && !snaps.data) return <Loading what="snapshots" />;
  const list = snaps.data ?? [];
  const hasBaseline = list.some((s) => s.kind === "baseline");
  const label = (s: (typeof list)[number]) => `${formatDate(s.created_at)} · ${s.kind}${s.label ? ` · ${s.label}` : ""}`;
  return (
    <div className="page">
      <PageHeader title="What changed" subtitle={<>DevDoctor takes a <Term k="snapshot">snapshot</Term> of your setup after every check. Comparing two of them shows exactly what was installed, removed or edited in between. It cannot know what happened before it was installed.</>} actions={<Button icon="diff" onClick={() => { setBaseline(!hasBaseline); setCreating(true); }}>{hasBaseline ? "Take snapshot" : "Create baseline"}</Button>} />
      <ErrorBox error={snaps.error ?? error} />
      <div className="filters">
        <span>Compare</span>
        <select className="text" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">the previous snapshot</option>
          {hasBaseline && <option value="baseline">the baseline</option>}
          {list.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
        <span>with</span>
        <select className="text" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">the latest snapshot</option>
          {list.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
      </div>
      {diff.loading ? <Loading what="changes" /> : diff.error ? <ErrorBox error={diff.error} /> : !diff.data ? (
        <Card><p className="muted">Not enough snapshots to compare yet. Run a check later, or take a snapshot now.</p></Card>
      ) : (
        <>
          <Card title={`Between ${formatDate(diff.data.from_at)} and ${formatDate(diff.data.to_at)}`}>
            {diff.data.changes.length === 0 ? <p className="muted">No changes detected.</p> : <ul className="section-list">{diff.data.headline.map((h, i) => <li key={i}><b>{h}</b></li>)}</ul>}
          </Card>
          {diff.data.categories.map((c) => (
            <div key={c.category}>
              <h2>{c.label} <span className="muted" style={{ fontWeight: 400 }}>{[c.added ? `+${c.added}` : "", c.removed ? `−${c.removed}` : "", c.changed ? `~${c.changed}` : ""].filter(Boolean).join(" ")}</span></h2>
              <div className="list glass-strong">{diff.data!.changes.filter((ch) => ch.category === c.category).map((ch) => <div key={`${ch.category}:${ch.key}`} className="row"><Pill tone={ch.kind === "added" ? "green" : ch.kind === "removed" ? "red" : "blue"}>{ch.kind}</Pill><span className="grow selectable">{ch.description}</span></div>)}</div>
            </div>
          ))}
        </>
      )}
      <h2>Snapshots</h2>
      {list.length === 0 ? <p className="muted">None yet.</p> : (
        <div className="list glass-strong">{list.map((s) => <div key={s.id} className="row"><div className="grow"><div className="row-title">{formatDate(s.created_at)} {s.kind === "baseline" && <Pill tone="blue">baseline</Pill>}</div><div className="row-sub">{s.kind}{s.label ? ` · ${s.label}` : ""} · {Object.values(s.summary.counts).reduce((a, b) => a + b, 0)} items</div></div><span className="mono faint tiny">{s.id}</span></div>)}</div>
      )}
      {creating && (
        <ConfirmDialog title={baseline ? "Create baseline snapshot" : "Take a snapshot"} confirmLabel="Create" busy={busy} onConfirm={create} onCancel={() => setCreating(false)}>
          <p>A snapshot records only metadata: PATH, hashes of your startup files, package names and versions, runtime versions, startup items, listening ports and environment variable <em>names</em>. No file contents and no secret values.</p>
          {baseline && <p>The baseline is the reference for "what changed since I set things up".</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
