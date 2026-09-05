import { useEffect, useState } from "react";
import { api, errorMessage, onStorageProgress } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, NodeModulesDir, StorageReport, VenvDir } from "../lib/types";
import { formatAgo, formatBytes, formatMs, relativeDate, shortenHome } from "../lib/format";
import { Button, Card, ConfirmDialog, DataTable, ErrorBox, Loading, PageHeader, Pill, Stat, Term, useToast } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";
import { t } from "../lib/i18n";

function DeleteDialog({ title, load, run, onDone, onCancel }: { title: string; load: () => Promise<FixPreview>; run: () => Promise<unknown>; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const preview = useAsync(load, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try { await run(); toast.push({ title: t("Deleted"), body: title, tone: "green" }); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={title} confirmLabel="Delete (cannot be undone)" danger busy={busy || !preview.data} onConfirm={go} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data} compact /> : <Loading what="preview" />}
    </ConfirmDialog>
  );
}

export function StoragePage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const last = useAsync(() => api.lastStorage(), [refreshKey]);
  const [report, setReport] = useState<StorageReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingNm, setDeletingNm] = useState<NodeModulesDir | null>(null);
  const [deletingVenv, setDeletingVenv] = useState<VenvDir | null>(null);
  const [scanProjects, setScanProjects] = useState(true);
  useEffect(() => { if (last.data) setReport(last.data); }, [last.data]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onStorageProgress((p) => {
      if (p.event === "category") setProgress(t("Measuring {label} ({index}/{total})", { label: p.label, index: p.index + 1, total: p.total }));
      else if (p.event === "projects") setProgress(t("Looking through {dir}", { dir: shortenHome(p.root, home) }));
      else setProgress("");
    }).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, [home]);
  const scan = async () => {
    setScanning(true);
    setError(null);
    try { setReport(await api.scanStorage(scanProjects)); } catch (e) { setError(errorMessage(e)); } finally { setScanning(false); setProgress(""); }
  };
  if (last.loading && !report) return <Loading what="disk usage" />;
  return (
    <div className="page">
      <PageHeader title={t("Disk space")} subtitle={<>{t("Space used by developer tools: ")}<Term k="cache">{t("caches")}</Term>{t(", downloaded models, ")}<Term k="node_modules">{t("node_modules")}</Term>, <Term k="virtual environment">{t("virtual environments")}</Term> {t(" and build folders. DevDoctor never looks at your personal files.")}</>} actions={<>
        <label className="check small"><input type="checkbox" checked={scanProjects} onChange={(e) => setScanProjects(e.target.checked)} disabled={scanning} /> {t(" include project folders")}</label>
        <Button variant="primary" icon={scanning ? undefined : "drive"} onClick={scan} disabled={scanning}>{scanning ? t("Measuring…") : report ? t("Measure again") : t("Measure")}</Button>
      </>} />
      {scanning && <p className="muted"><span className="spinner" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />{progress || t("Starting…")}</p>}
      <ErrorBox error={error} />
      {!report && !scanning && <Card><p className="muted">{t("Nothing measured yet. Measuring takes from a second to a minute depending on how many projects you have.")}</p></Card>}
      {report && (
        <>
          <p className="muted small">{t("Measured ")}{relativeDate(report.generated_at)} {t(" in ")}{formatMs(report.duration_ms)}.</p>
          <div className="grid cols-4" style={{ marginBottom: 14 }}>
            <Card><Stat value={formatBytes(report.total_bytes)} label={t("total developer storage")} /></Card>
            <Card><Stat value={formatBytes(report.node_modules_bytes)} label={`node_modules (${report.node_modules.length})`} /></Card>
            <Card><Stat value={formatBytes(report.venvs_bytes)} label={t("Python environments ({n})", { n: report.venvs.length })} /></Card>
            <Card><Stat value={formatBytes(report.build_bytes)} label={t("build folders ({n})", { n: report.build_dirs.length })} /></Card>
          </div>
          <h2>{t("Caches and model stores")}</h2>
          <DataTable
            columns={[
              { key: "label", label: t("What"), render: (c) => <><b>{c.label}</b><div className="muted small">{c.description}</div></> },
              { key: "bytes", label: t("Size"), className: "num", render: (c) => formatBytes(c.bytes) },
              { key: "files", label: t("Files"), className: "num", render: (c) => String(c.files) },
              { key: "recreatable", label: "", render: (c) => (c.recreatable ? <Pill tone="green">{t("safe to clear")}</Pill> : <Pill>{t("keeps data")}</Pill>) },
              { key: "paths", label: t("Where"), render: (c) => c.paths.map((p) => <div key={p} className="mono selectable">{shortenHome(p, home)} <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(p).catch(() => {})} /></div>) },
            ]}
            rows={report.categories.filter((c) => c.exists).sort((a, b) => b.bytes - a.bytes)}
            rowKey={(c) => c.id}
          />
          <p className="muted small">{t("Caches big enough to matter get an entry under Issues after a disk space check, with a one-click cleanup that shows exactly what is deleted.")}</p>
          {report.projects_scanned && (
            <>
              <h2>{t("node_modules by project")}</h2>
              <p className="muted small">{t("Looked in: ")}{report.roots_scanned.map((r) => shortenHome(r, home)).join(", ")}</p>
              <DataTable
                columns={[
                  { key: "project", label: t("Project"), render: (n) => <><b>{n.project_name}</b><div className="mono muted small">{shortenHome(n.project_path, home)}</div></> },
                  { key: "bytes", label: t("Size"), className: "num", render: (n) => formatBytes(n.bytes) },
                  { key: "pm", label: t("Rebuild with"), render: (n) => <span className="mono">{n.recreate_command}</span> },
                  { key: "activity", label: t("Last worked on"), render: (n) => formatAgo(n.last_activity_secs_ago) },
                  { key: "actions", label: "", render: (n) => <span className="btn-row"><Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(n.project_path).catch(() => {})} /><Button size="small" variant="destructive" onClick={() => setDeletingNm(n)}>{t("Delete…")}</Button></span> },
                ]}
                rows={report.node_modules}
                rowKey={(n) => n.path}
                empty={t("No node_modules folders found in the scanned folders.")}
              />
              <h2>{t("Python environments")}</h2>
              <DataTable
                columns={[
                  { key: "path", label: t("Environment"), render: (v) => <span className="mono selectable">{shortenHome(v.path, home)}</span> },
                  { key: "bytes", label: t("Size"), className: "num", render: (v) => formatBytes(v.bytes) },
                  { key: "version", label: t("Python"), render: (v) => v.python_version ?? "" },
                  { key: "broken", label: "", render: (v) => (v.broken ? <Pill tone="orange">{t("broken: Python is gone")}</Pill> : <Pill tone="green">{t("ok")}</Pill>) },
                  { key: "actions", label: "", render: (v) => <span className="btn-row"><Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(v.path).catch(() => {})} /><Button size="small" variant="destructive" onClick={() => setDeletingVenv(v)}>{t("Delete…")}</Button></span> },
                ]}
                rows={report.venvs}
                rowKey={(v) => v.path}
                empty={t("No virtual environments found.")}
              />
              <h2>{t("Build folders")}</h2>
              <DataTable columns={[{ key: "path", label: t("Folder"), render: (b) => <span className="mono selectable">{shortenHome(b.path, home)}</span> }, { key: "tool", label: t("Tool") }, { key: "bytes", label: t("Size"), className: "num", render: (b) => formatBytes(b.bytes) }]} rows={report.build_dirs} rowKey={(b) => b.path} empty={t("No build folders found.")} />
            </>
          )}
        </>
      )}
      {deletingNm && <DeleteDialog title={t("Delete node_modules of {project}", { project: deletingNm.project_name })} load={() => api.previewDeleteNodeModules(deletingNm.path)} run={() => api.deleteNodeModules(deletingNm.path)} onDone={() => { setDeletingNm(null); scan(); }} onCancel={() => setDeletingNm(null)} />}
      {deletingVenv && <DeleteDialog title={t("Delete {path}", { path: shortenHome(deletingVenv.path, home) })} load={() => api.previewDeleteVenv(deletingVenv.path)} run={() => api.deleteVenv(deletingVenv.path)} onDone={() => { setDeletingVenv(null); scan(); }} onCancel={() => setDeletingVenv(null)} />}
    </div>
  );
}
