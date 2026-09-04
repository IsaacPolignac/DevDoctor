import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, OllamaModel } from "../lib/types";
import { formatAgo, formatBytes, shortenHome } from "../lib/format";
import { Button, Card, ConfirmDialog, DataTable, ErrorBox, Loading, PageHeader, Pill, useToast } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";

function RemoveModelDialog({ model, onDone, onCancel }: { model: OllamaModel; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const preview = useAsync(() => api.previewRemoveOllamaModel(model.name), [model.name]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try { await api.removeOllamaModel(model.name); toast.push({ title: `Removed ${model.name}`, tone: "green" }); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={`Remove ${model.name}?`} confirmLabel="Remove model" danger busy={busy || !preview.data} onConfirm={run} onCancel={onCancel}>
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
      <PageHeader title="Local AI" subtitle={`Models stored on this Mac by Ollama, Hugging Face libraries, MLX, LM Studio and llama.cpp. ${formatBytes(d.total_bytes)} in total. Models can always be downloaded again.`} />
      <h2>Ollama {o.running && <Pill tone="green">running</Pill>}</h2>
      {!o.installed ? <Card><p className="muted">Ollama is not installed.</p></Card> : (
        <>
          <p className="muted small">{o.models.length} models · {formatBytes(o.total_bytes)} in <span className="mono">{shortenHome(o.models_dir, home)}</span>{o.orphan_blobs > 0 ? ` · ${formatBytes(o.orphan_blob_bytes)} in ${o.orphan_blobs} leftover files` : ""} <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(o.models_dir).catch(() => {})} /></p>
          <DataTable
            columns={[
              { key: "name", label: "Model", render: (m) => <><b>{m.name}</b><div className="muted small">{[m.family, m.parameter_size, m.quantization].filter(Boolean).join(" · ")}</div></> },
              { key: "size", label: "Size", className: "num", render: (m) => formatBytes(m.size) },
              { key: "modified", label: "Last changed", render: (m) => formatAgo(m.modified_secs_ago) },
              { key: "actions", label: "", render: (m) => <Button size="small" variant="destructive" onClick={() => setRemoving(m)}>Remove…</Button> },
            ]}
            rows={o.models}
            rowKey={(m) => m.name}
            empty="No models downloaded."
          />
        </>
      )}
      {d.sources.map((s) => (
        <div key={s.id}>
          <h2>{s.label} <span className="muted" style={{ fontWeight: 400 }}>{s.present ? formatBytes(s.bytes) : "not present"}</span></h2>
          <p className="muted small">{s.description} <span className="mono">{shortenHome(s.root, home)}</span>{s.present && <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(s.root).catch(() => {})} />}</p>
          {s.present && <DataTable columns={[{ key: "name", label: "Repository / file" }, { key: "bytes", label: "Size", className: "num", render: (m) => formatBytes(m.bytes) }, { key: "used", label: "Last used", render: (m) => formatAgo(m.last_used_secs_ago) }, { key: "actions", label: "", render: (m) => <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(m.path).catch(() => {})} /> }]} rows={s.models} rowKey={(m) => m.path} empty="No models found here." />}
        </div>
      ))}
      <p className="muted small">Removing Hugging Face, MLX or LM Studio models is not automated yet; use the folder button and the tool's own commands.</p>
      {removing && <RemoveModelDialog model={removing} onDone={() => { setRemoving(null); r.reload(); }} onCancel={() => setRemoving(null)} />}
    </div>
  );
}
