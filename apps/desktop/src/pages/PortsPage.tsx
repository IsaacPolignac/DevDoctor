import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { DataTable, ErrorBox, Loading } from "../components/Basics";
import { StopProcessDialog } from "./ProcessesPage";

export function PortsPage({ refreshKey, highlight }: { refreshKey: number; highlight?: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.ports(), [refreshKey]);
  const [stopping, setStopping] = useState<number | null>(null);
  if (r.loading && !r.data) return <Loading what="ports" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const rows = highlight ? [...r.data].sort((a, b) => (a.port === highlight ? -1 : b.port === highlight ? 1 : 0)) : r.data;
  return (
    <div>
      <h1>Ports</h1>
      <p className="muted">TCP ports in LISTEN state (from lsof). Only processes you own are visible without administrator rights. <button className="btn small" onClick={r.reload}>refresh</button></p>
      <DataTable
        columns={[
          { key: "port", label: "Port", className: "num", render: (p) => <strong>{p.port}</strong> },
          { key: "process", label: "Process", render: (p) => (p.dev_process ? <><strong>{p.dev_process.label}</strong><div className="muted small">{p.dev_process.name} · pid {p.pid}</div></> : <>{p.process_name ?? "?"}<div className="muted small">pid {p.pid ?? "?"}</div></>) },
          { key: "bind", label: "Bound to", render: (p) => <span className="mono">{p.address}{p.local_only === false ? <span className="badge medium" style={{ marginLeft: 6 }}>exposed on network</span> : ""}</span> },
          { key: "project", label: "Project", render: (p) => (p.dev_process?.project_path ? <span className="mono">{shortenHome(p.dev_process.project_path, home)}</span> : "") },
          { key: "flags", label: "", render: (p) => <span className="list-inline">{p.common_dev_port && <span className="badge info">dev port</span>}{p.dev_process?.stale && <span className="badge low" title={p.dev_process.stale_reason}>stale</span>}</span> },
          { key: "actions", label: "", render: (p) => (
            <span className="btn-row">
              {p.dev_process?.project_path && <button className="btn small" onClick={() => api.reveal(p.dev_process!.project_path!).catch(() => {})}>project</button>}
              {p.dev_process?.stoppable && <button className="btn small danger" onClick={() => setStopping(p.dev_process!.pid)}>stop…</button>}
            </span>
          ) },
        ]}
        rows={rows}
        rowKey={(p) => `${p.port}:${p.pid}:${p.address}`}
        empty="No listening TCP ports found."
      />
      {stopping != null && <StopProcessDialog pid={stopping} onDone={() => { setStopping(null); r.reload(); }} onCancel={() => setStopping(null)} />}
    </div>
  );
}
