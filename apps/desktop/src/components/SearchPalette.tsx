import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { SearchResults } from "../lib/types";
import { useNav, ALL_PAGES, type PageId } from "../lib/nav";
import { SEVERITY_PLAIN } from "../lib/plain";
import { Pill } from "./Basics";
import { Icon, type IconName } from "./Icons";
import { t } from "../lib/i18n";

interface Item { key: string; label: string; hint: string; icon: IconName; run: () => void }

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
    const t = setTimeout(() => { api.search(q).then((r) => { if (!cancelled) { setResults(r); setActive(0); } }).catch(() => {}); }, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const items: Item[] = [];
  if (!query.trim()) {
    for (const p of ALL_PAGES) items.push({ key: `page:${p.id}`, label: p.label, hint: p.blurb, icon: p.icon, run: () => navigate(p.id) });
  } else if (results) {
    for (const p of results.pages) { const page = ALL_PAGES.find((x) => x.id === p.id); items.push({ key: `page:${p.id}`, label: p.label, hint: "page", icon: page?.icon ?? "home", run: () => navigate(p.id as PageId) }); }
    for (const c of results.commands) items.push({ key: `cmd:${c}`, label: `Which ${c} runs?`, hint: "command", icon: "search", run: () => navigate("resolve", { command: c }) });
    for (const p of results.ports) items.push({ key: `port:${p.port}`, label: `Port ${p.port} — ${p.dev_process?.label ?? p.process_name ?? "unknown"}`, hint: "port", icon: "network", run: () => navigate("ports", { port: p.port }) });
    for (const i of results.issues) items.push({ key: `issue:${i.id}`, label: i.title, hint: i.severity, icon: "alert", run: () => navigate("issue", { issueId: i.id }) });
    for (const d of results.detectors) items.push({ key: `det:${d.id}`, label: d.name, hint: `check · ${d.id}`, icon: "shield", run: () => navigate("settings") });
  }
  const choose = (i: Item) => { i.run(); onClose(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && items[active]) choose(items[active]);
  };
  const sev = (h: string) => (h in SEVERITY_PLAIN ? SEVERITY_PLAIN[h as keyof typeof SEVERITY_PLAIN] : null);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet palette glass-strong" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
          <Icon name="search" size={18} className="faint" />
          <input ref={input} placeholder={t("Search issues, commands, ports, pages… try “python”, “port 3000”, “zshrc”")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="hairline" style={{ margin: "4px 0" }} />
        <div className="results">
          {items.length === 0 && query && results && <div className="muted" style={{ padding: 10 }}>{t("No matches.")}</div>}
          {items.map((it, idx) => {
            const s = sev(it.hint);
            return (
              <button key={it.key} className={`result ${idx === active ? "active" : ""}`} onClick={() => choose(it)} onMouseEnter={() => setActive(idx)}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><Icon name={it.icon} size={16} className="faint" /><span className="truncate">{it.label}</span></span>
                <span className="muted small nowrap">{s ? <Pill tone={s.tone}>{s.label}</Pill> : it.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
