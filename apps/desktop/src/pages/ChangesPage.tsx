import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatDate, shortenHome } from "../lib/format";
import { Button, Card, ConfirmDialog, Disclosure, ErrorBox, Loading, PageHeader, Pill, Term, useToast } from "../components/Basics";
import { DiffView } from "../components/DiffView";
import { t } from "../lib/i18n";

function localizedChangeKind(kind: string): string {
  if (kind === "added") return t("added");
  if (kind === "removed") return t("removed");
  if (kind === "changed") return t("changed");
  if (kind === "modified") return t("modified");
  return kind.replaceAll("_", " ");
}

function localizedSnapshotKind(kind: string): string {
  if (kind === "baseline") return t("baseline");
  if (kind === "scan") return t("scan");
  if (kind === "manual") return t("manual");
  if (kind === "pre_fix") return t("before repair");
  if (kind === "post_fix") return t("after repair");
  if (kind === "run_before") return t("before recorded run");
  if (kind === "run_after") return t("after recorded run");
  if (kind === "watch") return t("watch");
  return kind.replaceAll("_", " ");
}

export function ChangesPage({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const { home } = useNav();
  const snaps = useAsync(() => api.snapshots(100), [refreshKey]);
  const runs = useAsync(() => api.runs(50), [refreshKey]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const diff = useAsync(() => api.changes(from || null, to || null), [from, to, refreshKey]);
  const [creating, setCreating] = useState(false);
  const [baseline, setBaseline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    try { await api.createSnapshot(baseline ? "baseline" : "manual", null, false); toast.push({ title: baseline ? t("Baseline created") : t("Snapshot created"), tone: "green" }); setCreating(false); snaps.reload(); diff.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  if (snaps.loading && !snaps.data) return <Loading what="snapshots" />;
  const list = snaps.data ?? [];
  const hasBaseline = list.some((s) => s.kind === "baseline");
  const label = (s: (typeof list)[number]) => `${formatDate(s.created_at)} · ${localizedSnapshotKind(s.kind)}${s.label ? ` · ${s.label}` : ""}`;
  return (
    <div className="page">
      <PageHeader title={t("What changed")} subtitle={<>{t("DevDoctor takes a ")}<Term k="snapshot">{t("snapshot")}</Term> {t(" of your setup after every check. Comparing two of them shows exactly what was installed, removed or edited in between. It cannot know what happened before it was installed.")}</>} actions={<Button icon="diff" onClick={() => { setBaseline(!hasBaseline); setCreating(true); }}>{hasBaseline ? t("Take snapshot") : t("Create baseline")}</Button>} />
      <ErrorBox error={snaps.error ?? error} />
      <div className="filters">
        <span>{t("Compare")}</span>
        <select className="text" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">{t("the previous snapshot")}</option>
          {hasBaseline && <option value="baseline">{t("the baseline")}</option>}
          {list.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
        <span>{t("with")}</span>
        <select className="text" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{t("the latest snapshot")}</option>
          {list.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
      </div>
      {diff.loading ? <Loading what="changes" /> : diff.error ? <ErrorBox error={diff.error} /> : !diff.data ? (
        <Card><p className="muted">{t("Not enough snapshots to compare yet. Run a check later, or take a snapshot now.")}</p></Card>
      ) : (
        <>
          <Card title={t("Between {from} and {to}", { from: formatDate(diff.data.from_at), to: formatDate(diff.data.to_at) })}>
            {diff.data.changes.length === 0 ? <p className="muted">{t("No changes detected.")}</p> : <ul className="section-list">{diff.data.headline.map((h, i) => <li key={i}><b>{h}</b></li>)}</ul>}
          </Card>
          {diff.data.categories.map((c) => (
            <div key={c.category}>
              <h2>{c.label} <span className="muted" style={{ fontWeight: 400 }}>{[c.added ? `+${c.added}` : "", c.removed ? `−${c.removed}` : "", c.changed ? `~${c.changed}` : ""].filter(Boolean).join(" ")}</span></h2>
              <div className="list glass-strong">{diff.data!.changes.filter((ch) => ch.category === c.category).map((ch) => <div key={`${ch.category}:${ch.key}`} className="row"><Pill tone={ch.kind === "added" ? "green" : ch.kind === "removed" ? "red" : "blue"}>{localizedChangeKind(ch.kind)}</Pill><span className="grow selectable">{ch.description}</span></div>)}</div>
            </div>
          ))}
        </>
      )}
      <h2>{t("Recorded installs")}</h2>
      <p className="muted small">{t("Wrap an installer in your terminal — ")}<span className="inline-code">devdoctor run brew install something</span> {t(" — and DevDoctor records exactly what that ")}<Term k="run">{t("run")}</Term> {t(" changed: startup files, PATH, packages, new folders and applications.")}</p>
      <ErrorBox error={runs.error} />
      {(runs.data ?? []).length === 0 ? <Card><p className="muted">{t("No recorded installs yet.")}</p></Card> : (runs.data ?? []).map((r) => (
        <Card key={r.id} title={<span className="list-inline"><span className="mono">{r.label}</span><span className="muted small">{formatDate(r.started_at)}</span><Pill tone={r.exit_code === 0 ? "green" : "red"}>{r.exit_code == null ? t("interrupted") : t("exit {code}", { code: r.exit_code })}</Pill></span>}>
          {r.headline.length === 0 ? <p className="muted">{t("Nothing DevDoctor tracks changed.")}</p> : <ul className="section-list">{r.headline.map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {r.file_diffs.map((f) => <Disclosure key={f.path} label={`${shortenHome(f.path, home)} · ${localizedChangeKind(f.kind)}`}><DiffView diff={f.diff} /></Disclosure>)}
          {r.diff.changes.length > 0 && (
            <Disclosure label={r.diff.changes.length === 1 ? t("1 tracked change") : t("{n} tracked changes", { n: r.diff.changes.length })}>
              <div className="list">{r.diff.changes.map((ch) => <div key={`${ch.category}:${ch.key}`} className="row"><Pill tone={ch.kind === "added" ? "green" : ch.kind === "removed" ? "red" : "blue"}>{localizedChangeKind(ch.kind)}</Pill><span className="grow selectable">{ch.description}</span></div>)}</div>
            </Disclosure>
          )}
          <div className="mono faint tiny" style={{ marginTop: 8 }}>{r.id}</div>
        </Card>
      ))}
      <h2>{t("Snapshots")}</h2>
      {list.length === 0 ? <p className="muted">{t("None yet.")}</p> : (
        <div className="list glass-strong">{list.map((s) => <div key={s.id} className="row"><div className="grow"><div className="row-title">{formatDate(s.created_at)} {s.kind === "baseline" && <Pill tone="blue">{t("baseline")}</Pill>}</div><div className="row-sub">{localizedSnapshotKind(s.kind)}{s.label ? ` · ${s.label}` : ""} · {Object.values(s.summary.counts).reduce((a, b) => a + b, 0)} {t(" items")}</div></div><span className="mono faint tiny">{s.id}</span></div>)}</div>
      )}
      {creating && (
        <ConfirmDialog title={baseline ? t("Create baseline snapshot") : t("Take a snapshot")} confirmLabel="Create" busy={busy} onConfirm={create} onCancel={() => setCreating(false)}>
          <p>{t("A snapshot records only metadata: PATH, hashes of your startup files, package names and versions, runtime versions, startup items, listening ports and environment variable ")}<em>{t("names")}</em>{t(". No file contents and no secret values.")}</p>
          {baseline && <p>{t("The baseline is the reference for \"what changed since I set things up\".")}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
