import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import type { StartupProfile } from "../lib/types";
import { Button, Card, DataTable, ErrorBox, Loading, PageHeader, PathLink, Pill, Stat, Term } from "../components/Basics";

const RATING: Record<StartupProfile["rating"], { label: string; tone: "green" | "blue" | "orange" | "red" }> = {
  fast: { label: "instant", tone: "green" }, ok: { label: "fine", tone: "blue" }, slow: { label: "slow", tone: "orange" }, very_slow: { label: "very slow", tone: "red" },
};

function StartupSection() {
  const { home } = useNav();
  const [profile, setProfile] = useState<StartupProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const measure = async () => {
    setBusy(true); setError(null);
    try { setProfile(await api.startupProfile(3, true)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const h3 = { fontSize: 13, fontWeight: 600, margin: "16px 0 6px" } as const;
  return (
    <Card title="Startup time" actions={<Button icon={profile ? "refresh" : "play"} onClick={measure} disabled={busy}>{busy ? "Measuring…" : profile ? "Measure again" : "Measure"}</Button>}>
      <ErrorBox error={error} />
      {!profile ? (
        <p className="muted small" style={{ margin: 0 }}>How long does a new terminal take to become usable? DevDoctor starts your <Term k="login shell">login shell</Term> three times and, for zsh, traces one start line by line to show which lines of your startup files cost the most. Nothing is changed.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
            <Stat value={<>{profile.median_ms} ms <Pill tone={RATING[profile.rating].tone}>{RATING[profile.rating].label}</Pill></>} label="typical start" />
            <Stat value={`${profile.min_ms}–${profile.max_ms} ms`} label={`${profile.samples_ms.length} complete starts`} />
            {profile.traced && <Stat value={String(profile.trace_lines)} label="lines traced" />}
          </div>
          <p className="muted small">Under 150 ms feels instant; above 500 ms every new tab waits; above 1.5 s it hurts.</p>
          {profile.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
          {profile.traced && (
            <>
              <div style={h3}>Slowest lines of your startup files</div>
              <DataTable
                columns={[
                  { key: "ms", label: "Time", className: "num", render: (h) => `${h.inclusive_ms} ms` },
                  { key: "share", label: "Share", className: "num", render: (h) => `${h.share_percent}%` },
                  { key: "where", label: "Where", render: (h) => <PathLink path={h.file} line={h.line} /> },
                  { key: "statement", label: "Statement", render: (h) => <><span className="mono selectable">{h.statement}</span>{h.hint && <div className="muted small" style={{ marginTop: 4 }}>{h.hint}</div>}</> },
                ]}
                rows={profile.hotspots}
                rowKey={(h) => `${h.file}:${h.line}`}
                empty="No lines of your own startup files were traced."
              />
              <div style={h3}>Time spent per file or function</div>
              <DataTable
                columns={[
                  { key: "ms", label: "Own time", className: "num", render: (s) => `${s.self_ms} ms` },
                  { key: "kind", label: "Kind", render: (s) => s.kind },
                  { key: "lines", label: "Lines run", className: "num", render: (s) => String(s.lines) },
                  { key: "display", label: "Source", render: (s) => <span className="mono">{shortenHome(s.display, home)}</span> },
                ]}
                rows={profile.sources}
                rowKey={(s) => s.name}
              />
            </>
          )}
          {profile.stderr_lines.length > 0 && (<><div style={h3}>Printed when a terminal opens</div><pre className="selectable">{profile.stderr_lines.join("\n")}</pre></>)}
        </>
      )}
    </Card>
  );
}

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
      <StartupSection />
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
