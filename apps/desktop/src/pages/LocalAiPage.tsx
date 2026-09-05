import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, OllamaModel } from "../lib/types";
import { formatAgo, formatBytes, shortenHome } from "../lib/format";
import { Button, Card, ConfirmDialog, DataTable, ErrorBox, Loading, PageHeader, Pill, useToast } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";
import { t } from "../lib/i18n";

function RemoveModelDialog({ model, onDone, onCancel }: { model: OllamaModel; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const preview = useAsync(() => api.previewRemoveOllamaModel(model.name), [model.name]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try { await api.removeOllamaModel(model.name); toast.push({ title: t("Removed {name}", { name: model.name }), tone: "green" }); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={t("Remove {name}?", { name: model.name })} confirmLabel={t("Remove model")} danger busy={busy || !preview.data} onConfirm={run} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data as FixPreview} compact /> : <Loading what="preview" />}
    </ConfirmDialog>
  );
}

export function LocalAiPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.localAi(), [refreshKey]);
  const [removing, setRemoving] = useState<OllamaModel | null>(null);
  if (r.loading && !r.data) return <Loading what="local AI models" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const o = d.ollama;
  return (
    <div className="page">
      <PageHeader title={t("Local AI")} subtitle={t("Models stored on this Mac by Ollama, Hugging Face libraries, MLX, LM Studio and llama.cpp. {size} in total. Models can always be downloaded again.", { size: formatBytes(d.total_bytes) })} />
      <h2>{t("Ollama ")}{o.running && <Pill tone="green">{t("running")}</Pill>}</h2>
      {!o.installed ? <Card><p className="muted">{t("Ollama is not installed.")}</p></Card> : (
        <>
          <p className="muted small">{o.models.length} {t(" models · ")}{formatBytes(o.total_bytes)} {t(" in ")}<span className="mono">{shortenHome(o.models_dir, home)}</span>{o.orphan_blobs > 0 ? t(" · {size} in {n} leftover files", { size: formatBytes(o.orphan_blob_bytes), n: o.orphan_blobs }) : ""} <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(o.models_dir).catch(() => {})} /></p>
          <DataTable
            columns={[
              { key: "name", label: t("Model"), render: (m) => <><b>{m.name}</b><div className="muted small">{[m.family, m.parameter_size, m.quantization].filter(Boolean).join(" · ")}</div></> },
              { key: "size", label: t("Size"), className: "num", render: (m) => formatBytes(m.size) },
              { key: "modified", label: t("Last changed"), render: (m) => formatAgo(m.modified_secs_ago) },
              { key: "actions", label: "", render: (m) => <Button size="small" variant="destructive" onClick={() => setRemoving(m)}>{t("Remove…")}</Button> },
            ]}
            rows={o.models}
            rowKey={(m) => m.name}
            empty={t("No models downloaded.")}
          />
        </>
      )}
      {d.sources.map((s) => (
        <div key={s.id}>
          <h2>{s.label} <span className="muted" style={{ fontWeight: 400 }}>{s.present ? formatBytes(s.bytes) : t("not present")}</span></h2>
          <p className="muted small">{s.description} <span className="mono">{shortenHome(s.root, home)}</span>{s.present && <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(s.root).catch(() => {})} />}</p>
          {s.present && <DataTable columns={[{ key: "name", label: t("Repository / file") }, { key: "bytes", label: t("Size"), className: "num", render: (m) => formatBytes(m.bytes) }, { key: "used", label: t("Last used"), render: (m) => formatAgo(m.last_used_secs_ago) }, { key: "actions", label: "", render: (m) => <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(m.path).catch(() => {})} /> }]} rows={s.models} rowKey={(m) => m.path} empty={t("No models found here.")} />}
        </div>
      ))}
      <p className="muted small">{t("Removing Hugging Face, MLX or LM Studio models is not automated yet; use the folder button and the tool's own commands.")}</p>
      {removing && <RemoveModelDialog model={removing} onDone={() => { setRemoving(null); r.reload(); }} onCancel={() => setRemoving(null)} />}
    </div>
  );
}
