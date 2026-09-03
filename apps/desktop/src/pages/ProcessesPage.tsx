import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { DevProcess, FixPreview } from "../lib/types";
import { formatBytes, formatDuration, shortenHome } from "../lib/format";
import { ConfirmDialog, DataTable, ErrorBox, Loading } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";

export function StopProcessDialog({ pid, onDone, onCancel }: { pid: number; onDone: () => void; onCancel: () => void }) {
  const preview = useAsync(() => api.previewStop(pid), [pid]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = async () => {
    setBusy(true);
    try { await api.stop(pid); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={`Stop process ${pid}`} confirmLabel="Stop process" danger busy={busy} onConfirm={stop} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data as FixPreview} /> : <p className="muted">Preparing preview…</p>}
    </ConfirmDialog>
  );
}

export function ProcessesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.processes(), [refreshKey]);
  const [stopping, setStopping] = useState<number | null>(null);
  if (r.loading && !r.data) return <Loading what="processes" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  return (
    <div>
      <h1>Processes</h1>
      <p className="muted">Development-related processes only (Node, Python, Ruby, Java, Rust, Go, Ollama, Docker, databases, automated browsers, editor tooling). <button className="btn small" onClick={r.reload}>refresh</button></p>
      <DataTable<DevProcess>
        columns={[
          { key: "pid", label: "PID", className: "num", render: (p) => String(p.pid) },
          { key: "label", label: "Process", render: (p) => <><strong>{p.label}</strong><div className="muted small">{p.kind_label} · {p.name}</div></> },
          { key: "memory", label: "Memory", className: "num", render: (p) => formatBytes(p.memory_bytes) },
          { key: "cpu", label: "CPU", className: "num", render: (p) => (p.cpu_percent != null ? `${p.cpu_percent.toFixed(0)}%` : "") },
          { key: "age", label: "Running for", render: (p) => formatDuration(p.run_time_secs) },
          { key: "ports", label: "Ports", render: (p) => p.ports.join(", ") },
          { key: "project", label: "Project", render: (p) => (p.project_path ? <span className="mono">{shortenHome(p.project_path, home)}</span> : p.cwd ? <span className="mono muted">{shortenHome(p.cwd, home)}</span> : "") },
          { key: "flags", label: "Flags", render: (p) => <span className="list-inline">{p.stale && <span className="badge low" title={p.stale_reason}>stale</span>}{p.cwd_missing && <span className="badge medium">directory missing</span>}{!p.stoppable && <span className="badge info" title={p.not_stoppable_reason}>protected</span>}</span> },
          { key: "actions", label: "", render: (p) => (
            <span className="btn-row">
              {p.project_path && <button className="btn small" onClick={() => api.reveal(p.project_path!).catch(() => {})}>folder</button>}
              {p.stoppable && <button className="btn small danger" onClick={() => setStopping(p.pid)}>stop…</button>}
            </span>
          ) },
        ]}
        rows={r.data}
        rowKey={(p) => String(p.pid)}
        empty="No development processes are running."
      />
      <details style={{ marginTop: 12 }}><summary className="muted small">Command lines</summary><pre>{r.data.map((p) => `${p.pid}\t${p.command}`).join("\n")}</pre></details>
      {stopping != null && <StopProcessDialog pid={stopping} onDone={() => { setStopping(null); r.reload(); }} onCancel={() => setStopping(null)} />}
    </div>
  );
}
