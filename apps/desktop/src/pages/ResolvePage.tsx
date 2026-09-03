import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useNav } from "../lib/nav";
import type { CommandResolution } from "../lib/types";
import { shortenHome } from "../lib/format";
import { Card, ErrorBox, KeyValue } from "../components/Basics";

const COMMON = ["python", "python3", "pip", "pip3", "node", "npm", "pnpm", "git", "ruby", "java", "cargo", "rustc", "claude", "codex", "gemini", "ollama", "docker", "brew", "uv"];

export function ResolvePage({ initial }: { initial?: string }) {
  const { home } = useNav();
  const [name, setName] = useState(initial ?? "python");
  const [query, setQuery] = useState(initial ?? "python");
  const [result, setResult] = useState<CommandResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (initial) { setName(initial); setQuery(initial); } }, [initial]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.resolve(query).then((r) => { if (!cancelled) { setResult(r); setLoading(false); } }).catch((e) => { if (!cancelled) { setError(errorMessage(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [query]);
  return (
    <div>
      <h1>Command resolution</h1>
      <p className="muted">Which executable runs when you type a command, and which alternatives are hidden further down PATH.</p>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setQuery(name.trim()); }}>
        <input className="text mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="command name" />
        <button className="btn primary" type="submit">Inspect</button>
      </form>
      <div className="list-inline" style={{ marginBottom: 14 }}>{COMMON.map((c) => <button key={c} className="btn small" onClick={() => { setName(c); setQuery(c); }}>{c}</button>)}</div>
      <ErrorBox error={error} />
      {loading && <p className="muted">Resolving…</p>}
      {result && !loading && (
        <div className="grid cols-2">
          <Card title={`Active: ${result.command}`}>
            {result.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
            {result.active ? (
              <KeyValue rows={[
                ["Executable", <span className="mono">{shortenHome(result.active.path, home)}</span>],
                ["Resolves to", result.active.real_path ? <span className="mono">{shortenHome(result.active.real_path, home)}</span> : "(not a symlink)"],
                ["Version", result.active.version ?? "unknown"],
                ["Origin", `${result.active.origin_label} (PATH position ${result.active.path_position})`],
                ["Shebang", result.active.shebang ? <span className="mono">{result.active.shebang}</span> : "—"],
              ]} />
            ) : <p className="muted">Not found in PATH.</p>}
            {result.conflict && <div className="notice" style={{ marginTop: 10 }}>{result.conflict}</div>}
          </Card>
          <Card title="PATH precedence">
            {result.precedence.length === 0 ? <p className="muted">—</p> : (
              <ol className="section-list">{result.precedence.map((p) => <li key={p.position}>{p.origin_label} <span className="mono muted">{shortenHome(p.path, home)}</span></li>)}</ol>
            )}
            <h3>Other installations</h3>
            {result.others.length === 0 ? <p className="muted">No other executable with this name in PATH.</p> : (
              <ul className="section-list">{result.others.map((o) => <li key={o.path}><span className="mono">{shortenHome(o.path, home)}</span> {o.version ? `— ${o.version}` : ""} <span className="muted">[{o.origin_label}, position {o.path_position}]</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
