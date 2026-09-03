import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, Loading, PathLink } from "../components/Basics";

export function ShellPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.shellReport(), [refreshKey]);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (r.loading && !r.data) return <Loading what="shell configuration" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const view = async (path: string) => {
    try { setFile({ path, content: await api.shellFile(path) }); } catch (e) { setError(errorMessage(e)); }
  };
  return (
    <div>
      <h1>Shell</h1>
      <p className="muted">{d.shell} ({d.shell_path}) · PATH captured from a fresh login shell in {formatMs(d.capture_duration_ms)} · {d.shell_aliases} aliases, {d.shell_functions} functions loaded</p>
      {d.capture_warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      <ErrorBox error={error} />
      <h2>Startup files (load order)</h2>
      <DataTable
        columns={[
          { key: "path", label: "File", render: (f) => <PathLink path={f.path} /> },
          { key: "role", label: "Role" },
          { key: "exists", label: "Status", render: (f) => (f.exists ? `${f.statement_count} statements, ${f.size} bytes` : <span className="muted">absent</span>) },
          { key: "warnings", label: "Parser warnings", render: (f) => (f.warnings.length ? f.warnings.map((w) => `line ${w.line}: ${w.message}`).join("; ") : "") },
          { key: "view", label: "", render: (f) => (f.exists ? <button className="btn small" onClick={() => view(f.path)}>view</button> : null) },
        ]}
        rows={d.files}
        rowKey={(f) => f.path}
      />
      {file && (
        <Card title={shortenHome(file.path, home)} actions={<button className="btn small" onClick={() => setFile(null)}>close</button>}>
          <pre>{file.content.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n")}</pre>
        </Card>
      )}
      <h2>PATH statements</h2>
      <DataTable
        columns={[
          { key: "where", label: "Where", render: (m) => <PathLink path={m.file} line={m.line} /> },
          { key: "op", label: "Effect", render: (m) => `${m.op}${m.conditional ? " (conditional)" : ""}${m.in_function ? " (in function)" : ""}` },
          { key: "raw", label: "Statement", render: (m) => <span className="mono">{m.raw}</span> },
          { key: "dirs", label: "Directories", render: (m) => m.components.filter((c) => !c.is_path_ref).map((c) => <div key={c.raw} className="mono">{c.expanded ? shortenHome(c.expanded, home) : c.raw}{c.exists === false ? <span className="badge medium" style={{ marginLeft: 6 }}>missing</span> : null}</div>) },
        ]}
        rows={d.mutations}
        rowKey={(m) => `${m.file}:${m.line}:${m.raw}`}
        empty="No PATH statements found in startup files."
      />
      <h2>Sourced files</h2>
      <DataTable
        columns={[
          { key: "where", label: "Where", render: (s) => <PathLink path={s.file} line={s.line} /> },
          { key: "target", label: "Target", render: (s) => <span className="mono">{s.expanded ? shortenHome(s.expanded, home) : s.target_raw}</span> },
          { key: "status", label: "Status", render: (s) => (s.exists === false ? <span className="badge medium">missing</span> : s.exists ? "exists" : "unresolved") },
          { key: "guard", label: "", render: (s) => [s.guarded ? "guarded" : "", s.conditional ? "conditional" : "", s.in_function ? "in function" : ""].filter(Boolean).join(", ") },
        ]}
        rows={d.sources}
        rowKey={(s) => `${s.file}:${s.line}`}
        empty="No source statements."
      />
      <h2>Tool initialisations (eval)</h2>
      <DataTable columns={[{ key: "where", label: "Where", render: (e) => <PathLink path={e.file} line={e.line} /> }, { key: "command", label: "Command", render: (e) => <span className="mono">{e.command}</span> }]} rows={d.evals} rowKey={(e) => `${e.file}:${e.line}`} empty="No eval statements." />
      <h2>Aliases defined in files</h2>
      <DataTable columns={[{ key: "where", label: "Where", render: (a) => <PathLink path={a.file} line={a.line} /> }, { key: "name", label: "Alias" }, { key: "value_raw", label: "Value", render: (a) => <span className="mono">{a.value_raw}</span> }]} rows={d.aliases} rowKey={(a) => `${a.file}:${a.line}:${a.name}`} empty="No aliases defined in startup files." />
    </div>
  );
}
