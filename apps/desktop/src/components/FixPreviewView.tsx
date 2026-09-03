import type { FixPreview } from "../lib/types";
import { formatBytes, shortenHome } from "../lib/format";
import { useNav } from "../lib/nav";
import { DiffView } from "./DiffView";

/** Everything the user must see before a fix is applied. Pure rendering of the backend preview. */
export function FixPreviewView({ preview }: { preview: FixPreview }) {
  const { home } = useNav();
  return (
    <div>
      <p><strong>{preview.title}</strong></p>
      <p>{preview.summary}</p>
      <div className="grid cols-4" style={{ margin: "10px 0" }}>
        <div className="stat"><div className="value" style={{ fontSize: 15 }}>{preview.risk}</div><div className="label">Risk</div></div>
        <div className="stat"><div className="value" style={{ fontSize: 15 }}>{preview.reversible ? "yes" : "no"}</div><div className="label">Reversible</div></div>
        <div className="stat"><div className="value" style={{ fontSize: 15 }}>{preview.backup_created ? "yes" : "no"}</div><div className="label">Backup created</div></div>
        <div className="stat"><div className="value" style={{ fontSize: 15 }}>{formatBytes(preview.estimated_disk_space_recovered)}</div><div className="label">Space recovered (est.)</div></div>
      </div>
      {preview.operations.length > 0 && (
        <>
          <h3>Planned operations</h3>
          <ol className="section-list">{preview.operations.map((o, i) => <li key={i} className="mono">{shortenHome(o, home)}</li>)}</ol>
        </>
      )}
      {preview.files_modified.map((f) => (
        <div key={f.path}>
          <h3>Changes to {shortenHome(f.path, home)}</h3>
          <DiffView diff={f.diff} />
        </div>
      ))}
      {preview.directories_deleted.length > 0 && (
        <>
          <h3>Directories deleted</h3>
          <ul className="section-list">{preview.directories_deleted.map((d) => <li key={d.path} className="mono">{shortenHome(d.path, home)} — {formatBytes(d.bytes)}, {d.entries} entries</li>)}</ul>
        </>
      )}
      {preview.files_deleted.length > 0 && (
        <>
          <h3>Files deleted</h3>
          <ul className="section-list">{preview.files_deleted.map((d) => <li key={d} className="mono">{shortenHome(d, home)}</li>)}</ul>
        </>
      )}
      {preview.commands_executed.length > 0 && (
        <>
          <h3>Commands executed</h3>
          <ul className="section-list">{preview.commands_executed.map((c, i) => <li key={i}><span className="mono">{c.program} {c.args.join(" ")}</span> — {c.description}</li>)}</ul>
        </>
      )}
      {preview.processes_stopped.length > 0 && (
        <>
          <h3>Processes stopped</h3>
          <ul className="section-list">{preview.processes_stopped.map((p) => <li key={p.pid}>pid {p.pid} {p.name} <span className="mono muted">{p.command}</span></li>)}</ul>
        </>
      )}
      {preview.notes.length > 0 && (
        <>
          <h3>Notes</h3>
          <ul className="section-list">{preview.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
      {preview.validations.length > 0 && (
        <>
          <h3>Validated after applying (automatic rollback on failure)</h3>
          <ul className="section-list">{preview.validations.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </div>
  );
}
