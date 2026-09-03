import { useEffect, useState } from "react";
import { api, errorMessage, onStorageProgress } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, NodeModulesDir, StorageReport } from "../lib/types";
import { formatAgo, formatBytes, formatMs, relativeDate, shortenHome } from "../lib/format";
import { Card, ConfirmDialog, DataTable, ErrorBox, Loading } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";

function DeleteNodeModulesDialog({ dir, onDone, onCancel }: { dir: NodeModulesDir; onDone: () => void; onCancel: () => void }) {
  const preview = useAsync(() => api.previewDeleteNodeModules(dir.path), [dir.path]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try { await api.deleteNodeModules(dir.path); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={`Delete node_modules of ${dir.project_name}`} confirmLabel="Delete node_modules (not reversible)" danger busy={busy} onConfirm={run} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data as FixPreview} /> : <p className="muted">Measuring…</p>}
    </ConfirmDialog>
  );
}

export function StoragePage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const last = useAsync(() => api.lastStorage(), [refreshKey]);
  const [report, setReport] = useState<StorageReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NodeModulesDir | null>(null);
  const [scanProjects, setScanProjects] = useState(true);
  useEffect(() => { if (last.data) setReport(last.data); }, [last.data]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onStorageProgress((p) => {
      if (p.event === "category") setProgress(`Measuring ${p.label} (${p.index + 1}/${p.total})`);
      else if (p.event === "projects") setProgress(`Scanning projects in ${shortenHome(p.root, home)}`);
      else setProgress("");
    }).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, [home]);
  const scan = async () => {
    setScanning(true);
    setError(null);
    try { setReport(await api.scanStorage(scanProjects)); } catch (e) { setError(errorMessage(e)); } finally { setScanning(false); setProgress(""); }
  };
  if (last.loading && !report) return <Loading what="storage" />;
  return (
    <div>
      <h1>Developer storage</h1>
      <p className="muted">Caches, model stores, dependency and build directories that belong to development tools. DevDoctor never scans your whole disk.</p>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button className="btn primary" onClick={scan} disabled={scanning}>{scanning ? "Scanning…" : report ? "Scan again" : "Scan storage"}</button>
        <label className="check"><input type="checkbox" checked={scanProjects} onChange={(e) => setScanProjects(e.target.checked)} disabled={scanning} /> include project folders (node_modules, virtualenvs, build directories)</label>
        {report && <span className="muted small">measured {relativeDate(report.generated_at)} in {formatMs(report.duration_ms)}</span>}
      </div>
      {scanning && <p className="muted">{progress || "Starting…"}</p>}
      <ErrorBox error={error} />
      {!report && !scanning && <Card><p className="muted">No measurement yet.</p></Card>}
      {report && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 12 }}>
            <Card><div className="stat"><div className="value">{formatBytes(report.total_bytes)}</div><div className="label">total developer storage</div></div></Card>
            <Card><div className="stat"><div className="value">{formatBytes(report.node_modules_bytes)}</div><div className="label">node_modules ({report.node_modules.length})</div></div></Card>
            <Card><div className="stat"><div className="value">{formatBytes(report.venvs_bytes)}</div><div className="label">Python environments ({report.venvs.length})</div></div></Card>
            <Card><div className="stat"><div className="value">{formatBytes(report.build_bytes)}</div><div className="label">build directories ({report.build_dirs.length})</div></div></Card>
          </div>
          <h2>Caches and model stores</h2>
          <DataTable
            columns={[
              { key: "label", label: "Category", render: (c) => <><strong>{c.label}</strong><div className="muted small">{c.description}</div></> },
              { key: "bytes", label: "Size", className: "num", render: (c) => formatBytes(c.bytes) },
              { key: "files", label: "Files", className: "num", render: (c) => String(c.files) },
              { key: "recreatable", label: "Recreatable", render: (c) => (c.recreatable ? "yes" : "no") },
              { key: "paths", label: "Location", render: (c) => c.paths.map((p) => <div key={p} className="mono">{shortenHome(p, home)} <button className="btn small" onClick={() => api.reveal(p).catch(() => {})}>reveal</button></div>) },
            ]}
            rows={report.categories.filter((c) => c.exists).sort((a, b) => b.bytes - a.bytes)}
            rowKey={(c) => c.id}
          />
          <p className="muted small">Cache cleanups with a preview are offered under Problems after a Storage or Deep scan.</p>
          {report.projects_scanned && (
            <>
              <h2>node_modules</h2>
              <p className="muted small">Scanned: {report.roots_scanned.map((r) => shortenHome(r, home)).join(", ")}</p>
              <DataTable
                columns={[
                  { key: "project", label: "Project", render: (n) => <><strong>{n.project_name}</strong><div className="mono muted small">{shortenHome(n.project_path, home)}</div></> },
                  { key: "bytes", label: "Size", className: "num", render: (n) => formatBytes(n.bytes) },
                  { key: "pm", label: "Manager", render: (n) => n.package_manager ?? "" },
                  { key: "activity", label: "Last activity", render: (n) => formatAgo(n.last_activity_secs_ago) },
                  { key: "actions", label: "", render: (n) => <span className="btn-row"><button className="btn small" onClick={() => api.reveal(n.project_path).catch(() => {})}>reveal</button><button className="btn small danger" onClick={() => setDeleting(n)}>delete…</button></span> },
                ]}
                rows={report.node_modules}
                rowKey={(n) => n.path}
                empty="No node_modules directories found in the scanned folders."
              />
              <h2>Python environments</h2>
              <DataTable
                columns={[
                  { key: "path", label: "Environment", render: (v) => <span className="mono">{shortenHome(v.path, home)}</span> },
                  { key: "bytes", label: "Size", className: "num", render: (v) => formatBytes(v.bytes) },
                  { key: "version", label: "Python", render: (v) => v.python_version ?? "" },
                  { key: "broken", label: "", render: (v) => (v.broken ? <span className="badge medium">interpreter missing</span> : null) },
                  { key: "actions", label: "", render: (v) => <button className="btn small" onClick={() => api.reveal(v.path).catch(() => {})}>reveal</button> },
                ]}
                rows={report.venvs}
                rowKey={(v) => v.path}
                empty="No virtual environments found."
              />
              <h2>Build directories</h2>
              <DataTable columns={[{ key: "path", label: "Directory", render: (b) => <span className="mono">{shortenHome(b.path, home)}</span> }, { key: "tool", label: "Tool" }, { key: "bytes", label: "Size", className: "num", render: (b) => formatBytes(b.bytes) }]} rows={report.build_dirs} rowKey={(b) => b.path} empty="No build directories found." />
            </>
          )}
        </>
      )}
      {deleting && <DeleteNodeModulesDialog dir={deleting} onDone={() => { setDeleting(null); scan(); }} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
