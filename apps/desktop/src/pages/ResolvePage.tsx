import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useNav } from "../lib/nav";
import type { CommandResolution } from "../lib/types";
import { shortenHome } from "../lib/format";
import { Button, Card, ErrorBox, KeyValue, PageHeader, Pill } from "../components/Basics";
import { t } from "../lib/i18n";

const COMMON = ["python", "python3", "pip", "pip3", "node", "npm", "pnpm", "git", "ruby", "java", "cargo", "rustc", "claude", "codex", "gemini", "ollama", "docker", "brew", "uv"];

export function ResolvePage({ initial }: { initial?: string }) {
  const { home } = useNav();
  const [name, setName] = useState(initial ?? "python3");
  const [query, setQuery] = useState(initial ?? "python3");
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
    <div className="page">
      <PageHeader title={t("Which command runs?")} subtitle={t("Type a command to see exactly which program starts when you use it in a terminal, and which other copies are hiding further down PATH.")} />
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setQuery(name.trim()); }}>
        <input className="text mono" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("command name")} style={{ width: 260 }} />
        <Button variant="primary" icon="search" onClick={() => setQuery(name.trim())}>{t("Look up")}</Button>
      </form>
      <div className="list-inline" style={{ marginBottom: 16 }}>{COMMON.map((c) => <Button key={c} size="small" variant={c === query ? "primary" : "default"} onClick={() => { setName(c); setQuery(c); }}>{c}</Button>)}</div>
      <ErrorBox error={error} />
      {loading && <p className="muted">{t("Looking up…")}</p>}
      {result && !loading && (
        <div className="grid cols-2">
          <Card title={<>{t("When you type ")}<span className="inline-code">{result.command}</span></>}>
            {result.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
            {result.active ? (
              <KeyValue rows={[
                [t("Program that runs"), <span className="mono selectable">{shortenHome(result.active.path, home)}</span>],
                [t("Really located at"), result.active.real_path ? <span className="mono selectable">{shortenHome(result.active.real_path, home)}</span> : t("(same place)")],
                [t("Version"), result.active.version ?? "unknown"],
                [t("Installed by"), t("{origin} (PATH position {position})", { origin: result.active.origin_label, position: result.active.path_position })],
                [t("Interpreter"), result.active.shebang ? <span className="mono">{result.active.shebang}</span> : "—"],
              ]} />
            ) : <p className="muted">{t("Nothing with this name is in your PATH.")}</p>}
            {result.conflict && <div className="notice" style={{ marginTop: 10 }}>{result.conflict}</div>}
          </Card>
          <Card title={t("Who wins, and who is hidden")}>
            {result.precedence.length === 0 ? <p className="muted">—</p> : (
              <ol className="section-list">{result.precedence.map((p, i) => <li key={p.position}>{p.origin_label} {i === 0 && <Pill tone="green">{t("wins")}</Pill>} <span className="mono muted small">{shortenHome(p.path, home)}</span></li>)}</ol>
            )}
            <h3>{t("Other copies in PATH")}</h3>
            {result.others.length === 0 ? <p className="muted small">{t("No other program with this name.")}</p> : (
              <ul className="section-list">{result.others.map((o) => <li key={o.path}><span className="mono selectable">{shortenHome(o.path, home)}</span> {o.version ? `— ${o.version}` : ""} <span className="muted small">[{o.origin_label}{t(", position ")}{o.path_position}]</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
