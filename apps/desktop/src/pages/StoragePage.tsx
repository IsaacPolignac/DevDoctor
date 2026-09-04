import { useEffect, useState } from "react";
import { api, errorMessage, onStorageProgress } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, NodeModulesDir, StorageReport, VenvDir } from "../lib/types";
import { formatAgo, formatBytes, formatMs, relativeDate, shortenHome } from "../lib/format";
import { Button, Card, ConfirmDialog, DataTable, ErrorBox, Loading, PageHeader, Pill, Stat, Term, useToast } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";

function DeleteDialog({ title, load, run, onDone, onCancel }: { title: string; load: () => Promise<FixPreview>; run: () => Promise<unknown>; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const preview = useAsync(load, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try { await run(); toast.push({ title: "Deleted", body: title, tone: "green" }); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
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
      if (p.event === "category") setProgress(`Measuring ${p.label} (${p.index + 1}/${p.total})`);
      else if (p.event === "projects") setProgress(`Looking through ${shortenHome(p.root, home)}`);
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
      <PageHeader title="Disk space" subtitle={<>Space used by developer tools: <Term k="cache">caches</Term>, downloaded models, <Term k="node_modules">node_modules</Term>, <Term k="virtual environment">virtual environments</Term> and build folders. DevDoctor never looks at your personal files.</>} actions={<>
        <label className="check small"><input type="checkbox" checked={scanProjects} onChange={(e) => setScanProjects(e.target.checked)} disabled={scanning} /> include project folders</label>
        <Button variant="primary" icon={scanning ? undefined : "drive"} onClick={scan} disabled={scanning}>{scanning ? "Measuring…" : report ? "Measure again" : "Measure"}</Button>
      </>} />
      {scanning && <p className="muted"><span className="spinner" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />{progress || "Starting…"}</p>}
      <ErrorBox error={error} />
      {!report && !scanning && <Card><p className="muted">Nothing measured yet. Measuring takes from a second to a minute depending on how many projects you have.</p></Card>}
      {report && (
        <>
          <p className="muted small">Measured {relativeDate(report.generated_at)} in {formatMs(report.duration_ms)}.</p>
          <div className="grid cols-4" style={{ marginBottom: 14 }}>
            <Card><Stat value={formatBytes(report.total_bytes)} label="total developer storage" /></Card>
            <Card><Stat value={formatBytes(report.node_modules_bytes)} label={`node_modules (${report.node_modules.length})`} /></Card>
            <Card><Stat value={formatBytes(report.venvs_bytes)} label={`Python environments (${report.venvs.length})`} /></Card>
            <Card><Stat value={formatBytes(report.build_bytes)} label={`build folders (${report.build_dirs.length})`} /></Card>
          </div>
          <h2>Caches and model stores</h2>
          <DataTable
            columns={[
              { key: "label", label: "What", render: (c) => <><b>{c.label}</b><div className="muted small">{c.description}</div></> },
              { key: "bytes", label: "Size", className: "num", render: (c) => formatBytes(c.bytes) },
              { key: "files", label: "Files", className: "num", render: (c) => String(c.files) },
              { key: "recreatable", label: "", render: (c) => (c.recreatable ? <Pill tone="green">safe to clear</Pill> : <Pill>keeps data</Pill>) },
              { key: "paths", label: "Where", render: (c) => c.paths.map((p) => <div key={p} className="mono selectable">{shortenHome(p, home)} <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(p).catch(() => {})} /></div>) },
            ]}
            rows={report.categories.filter((c) => c.exists).sort((a, b) => b.bytes - a.bytes)}
            rowKey={(c) => c.id}
          />
          <p className="muted small">Caches big enough to matter get an entry under Issues after a disk space check, with a one-click cleanup that shows exactly what is deleted.</p>
          {report.projects_scanned && (
            <>
              <h2>node_modules by project</h2>
              <p className="muted small">Looked in: {report.roots_scanned.map((r) => shortenHome(r, home)).join(", ")}</p>
              <DataTable
                columns={[
                  { key: "project", label: "Project", render: (n) => <><b>{n.project_name}</b><div className="mono muted small">{shortenHome(n.project_path, home)}</div></> },
                  { key: "bytes", label: "Size", className: "num", render: (n) => formatBytes(n.bytes) },
                  { key: "pm", label: "Rebuild with", render: (n) => <span className="mono">{n.recreate_command}</span> },
                  { key: "activity", label: "Last worked on", render: (n) => formatAgo(n.last_activity_secs_ago) },
                  { key: "actions", label: "", render: (n) => <span className="btn-row"><Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(n.project_path).catch(() => {})} /><Button size="small" variant="destructive" onClick={() => setDeletingNm(n)}>Delete…</Button></span> },
                ]}
                rows={report.node_modules}
                rowKey={(n) => n.path}
                empty="No node_modules folders found in the scanned folders."
              />
              <h2>Python environments</h2>
              <DataTable
                columns={[
                  { key: "path", label: "Environment", render: (v) => <span className="mono selectable">{shortenHome(v.path, home)}</span> },
                  { key: "bytes", label: "Size", className: "num", render: (v) => formatBytes(v.bytes) },
                  { key: "version", label: "Python", render: (v) => v.python_version ?? "" },
                  { key: "broken", label: "", render: (v) => (v.broken ? <Pill tone="orange">broken: Python is gone</Pill> : <Pill tone="green">ok</Pill>) },
                  { key: "actions", label: "", render: (v) => <span className="btn-row"><Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(v.path).catch(() => {})} /><Button size="small" variant="destructive" onClick={() => setDeletingVenv(v)}>Delete…</Button></span> },
                ]}
                rows={report.venvs}
                rowKey={(v) => v.path}
                empty="No virtual environments found."
              />
              <h2>Build folders</h2>
              <DataTable columns={[{ key: "path", label: "Folder", render: (b) => <span className="mono selectable">{shortenHome(b.path, home)}</span> }, { key: "tool", label: "Tool" }, { key: "bytes", label: "Size", className: "num", render: (b) => formatBytes(b.bytes) }]} rows={report.build_dirs} rowKey={(b) => b.path} empty="No build folders found." />
            </>
          )}
        </>
      )}
      {deletingNm && <DeleteDialog title={`Delete node_modules of ${deletingNm.project_name}`} load={() => api.previewDeleteNodeModules(deletingNm.path)} run={() => api.deleteNodeModules(deletingNm.path)} onDone={() => { setDeletingNm(null); scan(); }} onCancel={() => setDeletingNm(null)} />}
      {deletingVenv && <DeleteDialog title={`Delete ${shortenHome(deletingVenv.path, home)}`} load={() => api.previewDeleteVenv(deletingVenv.path)} run={() => api.deleteVenv(deletingVenv.path)} onDone={() => { setDeletingVenv(null); scan(); }} onCancel={() => setDeletingVenv(null)} />}
    </div>
  );
}
