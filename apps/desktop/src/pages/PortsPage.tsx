import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { Button, DataTable, ErrorBox, Loading, PageHeader, Pill, Term } from "../components/Basics";
import { StopProcessDialog } from "./ProcessesPage";
import { t } from "../lib/i18n";

export function PortsPage({ refreshKey, highlight }: { refreshKey: number; highlight?: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.ports(), [refreshKey]);
  const [stopping, setStopping] = useState<number | null>(null);
  if (r.loading && !r.data) return <Loading what="ports" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const rows = highlight ? [...r.data].sort((a, b) => (a.port === highlight ? -1 : b.port === highlight ? 1 : 0)) : r.data;
  return (
    <div className="page">
      <PageHeader title={t("Ports")} subtitle={<>A <Term k="port">{t("port")}</Term> {t(" can only be used by one program at a time; “address already in use” means something else already has it. Only programs you own are visible.")}</>} actions={<Button icon="refresh" onClick={r.reload}>{t("Refresh")}</Button>} />
      <DataTable
        columns={[
          { key: "port", label: t("Port"), className: "num", render: (p) => <b style={p.port === highlight ? { color: "var(--accent)" } : undefined}>{p.port}</b> },
          { key: "process", label: t("Used by"), render: (p) => (p.dev_process ? <><b>{p.dev_process.label}</b><div className="muted small">{p.dev_process.name} {t(" · pid ")}{p.pid}</div></> : <>{p.process_name ?? "?"}<div className="muted small">{t("pid ")}{p.pid ?? "?"}</div></>) },
          { key: "bind", label: t("Reachable from"), render: (p) => <span>{p.local_only === false ? <Pill tone="orange">{t("other computers too")}</Pill> : <Pill tone="green">{t("this Mac only")}</Pill>} <span className="mono muted small">{p.address}</span></span> },
          { key: "project", label: t("Project"), render: (p) => (p.dev_process?.project_path ? <span className="mono selectable">{shortenHome(p.dev_process.project_path, home)}</span> : "") },
          { key: "flags", label: "", render: (p) => <span className="list-inline">{p.common_dev_port && <Pill tone="blue">{t("dev port")}</Pill>}{p.dev_process?.stale && <Pill tone="yellow" title={p.dev_process.stale_reason}>{t("looks abandoned")}</Pill>}</span> },
          { key: "actions", label: "", render: (p) => (
            <span className="btn-row">
              {p.dev_process?.project_path && <Button size="small" icon="folder" onClick={() => api.reveal(p.dev_process!.project_path!).catch(() => {})}>{t("Project")}</Button>}
              {p.dev_process?.stoppable && <Button size="small" onClick={() => setStopping(p.dev_process!.pid)}>{t("Stop…")}</Button>}
            </span>
          ) },
        ]}
        rows={rows}
        rowKey={(p) => `${p.port}:${p.pid}:${p.address}`}
        empty={t("No program is listening on a TCP port.")}
      />
      {stopping != null && <StopProcessDialog pid={stopping} onDone={() => { setStopping(null); r.reload(); }} onCancel={() => setStopping(null)} />}
    </div>
  );
}
