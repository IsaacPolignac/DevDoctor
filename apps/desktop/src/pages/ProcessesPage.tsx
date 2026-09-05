import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { DevProcess, FixPreview } from "../lib/types";
import { formatBytes, formatDuration, shortenHome } from "../lib/format";
import { Button, ConfirmDialog, DataTable, Disclosure, ErrorBox, Loading, PageHeader, Pill, useToast } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";
import { t } from "../lib/i18n";

export function StopProcessDialog({ pid, onDone, onCancel }: { pid: number; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const preview = useAsync(() => api.previewStop(pid), [pid]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = async () => {
    setBusy(true);
    try { await api.stop(pid); toast.push({ title: t("Program stopped"), tone: "green" }); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={t("Stop this program?")} confirmLabel="Stop it" danger busy={busy} onConfirm={stop} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data as FixPreview} compact /> : <Loading what="preview" />}
    </ConfirmDialog>
  );
}

export function ProcessesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.processes(), [refreshKey]);
  const [stopping, setStopping] = useState<number | null>(null);
  if (r.loading && !r.data) return <Loading what="running programs" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  return (
    <div className="page">
      <PageHeader title={t("Running programs")} subtitle={t("Development servers, language runtimes, databases, Docker, Ollama, automated browsers and editor helpers running right now. System programs are never listed or touched.")} actions={<Button icon="refresh" onClick={r.reload}>{t("Refresh")}</Button>} />
      <DataTable<DevProcess>
        columns={[
          { key: "label", label: t("Program"), render: (p) => <><b>{p.label}</b><div className="muted small">{p.kind_label} · {p.name} {t(" · pid ")}{p.pid}</div></> },
          { key: "memory", label: t("Memory"), className: "num", render: (p) => formatBytes(p.memory_bytes) },
          { key: "age", label: t("Running for"), render: (p) => formatDuration(p.run_time_secs) },
          { key: "ports", label: t("Ports"), render: (p) => p.ports.join(", ") },
          { key: "project", label: t("Project"), render: (p) => (p.project_path ? <span className="mono selectable">{shortenHome(p.project_path, home)}</span> : p.cwd ? <span className="mono muted small">{shortenHome(p.cwd, home)}</span> : "") },
          { key: "flags", label: "", render: (p) => <span className="list-inline">{p.stale && <Pill tone="yellow" title={p.stale_reason}>{t("looks abandoned")}</Pill>}{p.cwd_missing && <Pill tone="orange">{t("folder gone")}</Pill>}{!p.stoppable && <Pill title={p.not_stoppable_reason}>{t("protected")}</Pill>}</span> },
          { key: "actions", label: "", render: (p) => (
            <span className="btn-row">
              {p.project_path && <Button size="small" icon="folder" onClick={() => api.reveal(p.project_path!).catch(() => {})}>{t("Folder")}</Button>}
              {p.stoppable && <Button size="small" onClick={() => setStopping(p.pid)}>{t("Stop…")}</Button>}
            </span>
          ) },
        ]}
        rows={r.data}
        rowKey={(p) => String(p.pid)}
        empty={t("No development programs are running.")}
      />
      <div style={{ marginTop: 12 }}><Disclosure label={t("Show full command lines")}><pre className="selectable">{r.data.map((p) => `${p.pid}\t${p.command}`).join("\n")}</pre></Disclosure></div>
      {stopping != null && <StopProcessDialog pid={stopping} onDone={() => { setStopping(null); r.reload(); }} onCancel={() => setStopping(null)} />}
    </div>
  );
}
