import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import { Button, Card, DataTable, ErrorBox, Loading, PageHeader, PathLink, Pill, Term } from "../components/Basics";

export function ShellPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.shellReport(), [refreshKey]);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (r.loading && !r.data) return <Loading what="terminal setup" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const view = async (path: string) => { try { setFile({ path, content: await api.shellFile(path) }); } catch (e) { setError(errorMessage(e)); } };
  return (
    <div className="page">
      <PageHeader title="Terminal setup" subtitle={<>Your shell is <b>{d.shell}</b>. Each time a terminal opens it runs these <Term k="startup file">startup files</Term> in order; installers add lines to them, which is how setups get messy. DevDoctor read the result from a fresh <Term k="login shell">login shell</Term> in {formatMs(d.capture_duration_ms)}.</>} />
      {d.capture_warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      <ErrorBox error={error} />
      <h2>Startup files, in the order they run</h2>
      <DataTable
        columns={[
          { key: "path", label: "File", render: (f) => <PathLink path={f.path} /> },
          { key: "role", label: "Role", render: (f) => ({ env: "always (env)", profile: "at login", rc: "every terminal", login: "after login" } as Record<string, string>)[f.role] ?? f.role },
          { key: "exists", label: "Contents", render: (f) => (f.exists ? `${f.statement_count} statements · ${f.size} bytes` : <span className="muted">not present</span>) },
          { key: "warnings", label: "", render: (f) => (f.warnings.length ? <Pill tone="orange">{f.warnings.length} parser warning{f.warnings.length > 1 ? "s" : ""}</Pill> : null) },
          { key: "view", label: "", render: (f) => (f.exists ? <Button size="small" onClick={() => view(f.path)}>View</Button> : null) },
        ]}
        rows={d.files}
        rowKey={(f) => f.path}
      />
      {file && (
        <Card title={shortenHome(file.path, home)} actions={<Button size="small" variant="ghost" onClick={() => setFile(null)}>Close</Button>}>
          <pre className="selectable">{file.content.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n")}</pre>
        </Card>
      )}
      <h2>Lines that change <Term k="PATH">PATH</Term></h2>
      <DataTable
        columns={[
          { key: "where", label: "Where", render: (m) => <PathLink path={m.file} line={m.line} /> },
          { key: "op", label: "Effect", render: (m) => <span>{({ prepend: "adds in front", append: "adds at the end", set: "replaces PATH", complex: "complex" } as Record<string, string>)[m.op] ?? m.op}{m.conditional ? " (only sometimes)" : ""}{m.in_function ? " (inside a function)" : ""}</span> },
          { key: "dirs", label: "Folders", render: (m) => m.components.filter((c) => !c.is_path_ref).map((c) => <div key={c.raw} className="mono">{c.expanded ? shortenHome(c.expanded, home) : c.raw}{c.exists === false ? <Pill tone="orange">missing</Pill> : null}</div>) },
          { key: "raw", label: "Statement", render: (m) => <span className="mono selectable">{m.raw}</span> },
        ]}
        rows={d.mutations}
        rowKey={(m) => `${m.file}:${m.line}:${m.raw}`}
        empty="No PATH statements found in startup files."
      />
      <h2>Other files loaded at startup</h2>
      <DataTable
        columns={[
          { key: "where", label: "Where", render: (s) => <PathLink path={s.file} line={s.line} /> },
          { key: "target", label: "Loads", render: (s) => <span className="mono">{s.expanded ? shortenHome(s.expanded, home) : s.target_raw}</span> },
          { key: "status", label: "Status", render: (s) => (s.exists === false ? <Pill tone="orange">missing</Pill> : s.exists ? <Pill tone="green">exists</Pill> : <Pill>unknown</Pill>) },
          { key: "guard", label: "", render: (s) => [s.guarded ? "only if present" : "", s.conditional ? "conditional" : "", s.in_function ? "in function" : ""].filter(Boolean).join(", ") },
        ]}
        rows={d.sources}
        rowKey={(s) => `${s.file}:${s.line}`}
        empty="No files are loaded from the startup files."
      />
      <h2>Tools that set themselves up (eval)</h2>
      <DataTable columns={[{ key: "where", label: "Where", render: (e) => <PathLink path={e.file} line={e.line} /> }, { key: "command", label: "Command", render: (e) => <span className="mono">{e.command}</span> }]} rows={d.evals} rowKey={(e) => `${e.file}:${e.line}`} empty="No eval statements." />
      <h2>Aliases</h2>
      <p className="muted small">{d.shell_aliases} aliases and {d.shell_functions} functions are active in a new terminal. Listed below: the ones defined in your own files.</p>
      <DataTable columns={[{ key: "where", label: "Where", render: (a) => <PathLink path={a.file} line={a.line} /> }, { key: "name", label: "Alias" }, { key: "value_raw", label: "Runs", render: (a) => <span className="mono">{a.value_raw}</span> }]} rows={d.aliases} rowKey={(a) => `${a.file}:${a.line}:${a.name}`} empty="No aliases defined in startup files." />
    </div>
  );
}
