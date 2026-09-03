import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { SearchResults } from "../lib/types";
import { useNav, type PageId } from "../lib/nav";
import { SeverityBadge } from "./Basics";

interface Item { key: string; label: string; hint: string; run: () => void }

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { navigate } = useNav();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.search(q).then((r) => { if (!cancelled) { setResults(r); setActive(0); } }).catch(() => {});
    }, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const items: Item[] = [];
  if (results) {
    for (const p of results.pages) items.push({ key: `page:${p.id}`, label: p.label, hint: "page", run: () => navigate(p.id as PageId) });
    for (const c of results.commands) items.push({ key: `cmd:${c}`, label: `Which ${c} runs?`, hint: "command resolution", run: () => navigate("resolve", { command: c }) });
    for (const p of results.ports) items.push({ key: `port:${p.port}`, label: `Port ${p.port} — ${p.dev_process?.label ?? p.process_name ?? "unknown"}`, hint: "port", run: () => navigate("ports", { port: p.port }) });
    for (const i of results.issues) items.push({ key: `issue:${i.id}`, label: i.title, hint: i.severity, run: () => navigate("issue", { issueId: i.id }) });
    for (const d of results.detectors) items.push({ key: `det:${d.id}`, label: d.name, hint: `detector ${d.id}`, run: () => navigate("settings") });
  }
  const choose = (i: Item) => { i.run(); onClose(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && items[active]) choose(items[active]);
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <input ref={input} placeholder="Search issues, commands, ports, pages… (python, port 3000, zshrc, node_modules)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="results">
          {items.length === 0 && query && results && <div className="muted" style={{ padding: 8 }}>No matches.</div>}
          {items.map((it, idx) => (
            <button key={it.key} className={`result ${idx === active ? "active" : ""}`} onClick={() => choose(it)} onMouseEnter={() => setActive(idx)}>
              <span>{it.label}</span>
              <span className="muted small">{["critical", "high", "medium", "low", "info"].includes(it.hint) ? <SeverityBadge severity={it.hint as "low"} /> : it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
