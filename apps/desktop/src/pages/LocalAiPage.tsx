import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { FixPreview, OllamaModel } from "../lib/types";
import { formatAgo, formatBytes, shortenHome } from "../lib/format";
import { Card, ConfirmDialog, DataTable, ErrorBox, Loading } from "../components/Basics";
import { FixPreviewView } from "../components/FixPreviewView";

function RemoveModelDialog({ model, onDone, onCancel }: { model: OllamaModel; onDone: () => void; onCancel: () => void }) {
  const preview = useAsync(() => api.previewRemoveOllamaModel(model.name), [model.name]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    try { await api.removeOllamaModel(model.name); onDone(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return (
    <ConfirmDialog title={`Remove ${model.name}`} confirmLabel="Remove model (not reversible)" danger busy={busy} onConfirm={run} onCancel={onCancel}>
      <ErrorBox error={error ?? preview.error} />
      {preview.data ? <FixPreviewView preview={preview.data as FixPreview} /> : <p className="muted">Preparing…</p>}
    </ConfirmDialog>
  );
}

export function LocalAiPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.localAi(), [refreshKey]);
  const [removing, setRemoving] = useState<OllamaModel | null>(null);
  if (r.loading && !r.data) return <Loading what="local AI inventory" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const o = d.ollama;
  return (
    <div>
      <h1>Local AI</h1>
      <p className="muted">Models and caches from Ollama, Hugging Face, MLX, LM Studio and llama.cpp. Total {formatBytes(d.total_bytes)}.</p>
      <h2>Ollama {o.running && <span className="badge ok">running</span>}</h2>
      {!o.installed ? <Card><p className="muted">Ollama is not installed.</p></Card> : (
        <>
          <p className="muted small">{o.models.length} models · {formatBytes(o.total_bytes)} in <span className="mono">{shortenHome(o.models_dir, home)}</span>{o.orphan_blobs > 0 ? ` · ${formatBytes(o.orphan_blob_bytes)} in ${o.orphan_blobs} unreferenced blobs` : ""} <button className="btn small" onClick={() => api.reveal(o.models_dir).catch(() => {})}>reveal</button></p>
          <DataTable
            columns={[
              { key: "name", label: "Model", render: (m) => <><strong>{m.name}</strong><div className="muted small">{[m.family, m.parameter_size, m.quantization].filter(Boolean).join(" · ")}</div></> },
              { key: "size", label: "Size", className: "num", render: (m) => formatBytes(m.size) },
              { key: "modified", label: "Modified", render: (m) => formatAgo(m.modified_secs_ago) },
              { key: "actions", label: "", render: (m) => <button className="btn small danger" onClick={() => setRemoving(m)}>remove…</button> },
            ]}
            rows={o.models}
            rowKey={(m) => m.name}
            empty="No models pulled."
          />
        </>
      )}
      {d.sources.map((s) => (
        <div key={s.id}>
          <h2>{s.label} <span className="muted" style={{ fontWeight: 400 }}>{s.present ? formatBytes(s.bytes) : "not present"}</span></h2>
          <p className="muted small">{s.description} <span className="mono">{shortenHome(s.root, home)}</span>{s.present && <> <button className="btn small" onClick={() => api.reveal(s.root).catch(() => {})}>reveal</button></>}</p>
          {s.present && <DataTable columns={[{ key: "name", label: "Repository / file" }, { key: "bytes", label: "Size", className: "num", render: (m) => formatBytes(m.bytes) }, { key: "used", label: "Last used", render: (m) => formatAgo(m.last_used_secs_ago) }, { key: "actions", label: "", render: (m) => <button className="btn small" onClick={() => api.reveal(m.path).catch(() => {})}>reveal</button> }]} rows={s.models} rowKey={(m) => m.path} empty="No models found here." />}
        </div>
      ))}
      <p className="muted small">Removing Hugging Face, MLX or LM Studio models is not automated in this version; use the reveal button and the tool's own commands.</p>
      {removing && <RemoveModelDialog model={removing} onDone={() => { setRemoving(null); r.reload(); }} onCancel={() => setRemoving(null)} />}
    </div>
  );
}
