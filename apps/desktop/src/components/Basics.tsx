import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Confidence, Severity } from "../lib/types";
import { CONFIDENCE_PLAIN, GLOSSARY, SEVERITY_PLAIN, type Tone } from "../lib/plain";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { api } from "../lib/api";
import { Icon, type IconName } from "./Icons";

/* ---------- preferences ---------- */
export interface Prefs { technical: boolean; setTechnical: (v: boolean) => void }
export const PrefsContext = createContext<Prefs>({ technical: false, setTechnical: () => {} });
export const usePrefs = () => useContext(PrefsContext);

/* ---------- toasts ---------- */
export interface Toast { id: number; title: string; body?: string; tone?: Tone; action?: { label: string; onClick: () => void } }
interface ToastApi { push: (t: Omit<Toast, "id">) => void }
const ToastContext = createContext<ToastApi>({ push: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((all) => [...all, { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.action ? 9000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast glass-strong">
            {t.tone === "green" && <Icon name="check" size={16} className="" />}
            {t.tone === "red" && <Icon name="alert" size={16} />}
            <div>
              <div className="t-title">{t.title}</div>
              {t.body && <div className="t-body">{t.body}</div>}
            </div>
            {t.action && <button className="btn small" onClick={() => { t.action?.onClick(); setToasts((all) => all.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
            <button className="btn ghost small" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} title="Dismiss"><Icon name="x" size={12} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- primitives ---------- */
export function Pill({ tone, children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`pill ${tone ?? "gray"}`} title={title}>{children}</span>;
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const { technical } = usePrefs();
  const p = SEVERITY_PLAIN[severity];
  return <Pill tone={p.tone} title={p.hint}><span className="dot" />{technical ? severity : p.label}</Pill>;
}

export function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const { technical } = usePrefs();
  const p = CONFIDENCE_PLAIN[confidence];
  return <Pill tone={p.tone} title={p.hint}>{technical ? confidence : p.label}</Pill>;
}

export function StatusPill({ status }: { status: string }) {
  const tone: Tone = status === "applied" ? "green" : status === "rolled_back" ? "blue" : status.includes("fail") ? "red" : "gray";
  const label = status === "applied" ? "Applied" : status === "rolled_back" ? "Undone" : status === "failed" ? "Failed (rolled back)" : status.replace("_", " ");
  return <Pill tone={tone}>{label}</Pill>;
}

export function Button({ variant = "default", size, icon, onClick, disabled, children, title, className }: { variant?: "default" | "primary" | "ghost" | "destructive" | "destructive-primary"; size?: "small" | "large"; icon?: IconName; onClick?: () => void; disabled?: boolean; children?: ReactNode; title?: string; className?: string }) {
  const cls = ["btn", variant === "primary" ? "primary" : "", variant === "ghost" ? "ghost" : "", variant === "destructive" ? "destructive" : "", variant === "destructive-primary" ? "destructive primary" : "", size ?? "", className ?? ""].filter(Boolean).join(" ");
  return <button className={cls} onClick={onClick} disabled={disabled} title={title}>{icon && <Icon name={icon} size={size === "small" ? 13 : 15} />}{children}</button>;
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`card glass-strong ${className ?? ""}`}>
      {(title || actions) && <div className="card-title"><span>{title}</span>{actions}</div>}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1>{subtitle && <div className="subtitle">{subtitle}</div>}</div>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

export function Loading({ what }: { what?: string }) {
  return <p className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="spinner" /> Loading{what ? ` ${what}` : ""}…</p>;
}

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return <div className="stat"><div className="value">{value}</div><div className="label">{label}</div></div>;
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <div className="k">{k}</div>
          <div className="v">{v ?? <span className="muted">—</span>}</div>
        </div>
      ))}
    </div>
  );
}

export function PathLink({ path, line }: { path: string; line?: number }) {
  const { home } = useNav();
  return (
    <span className="mono selectable">
      {shortenHome(path, home)}{line != null ? `:${line}` : ""}{" "}
      <button className="btn ghost small" title="Reveal in Finder" onClick={() => api.reveal(path).catch(() => {})}><Icon name="folder" size={12} /></button>
    </span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="inline-code selectable">{children}</span>;
}

export function Disclosure({ label, children, defaultOpen }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary><Icon name="chevron" size={12} />{label}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

/** A glossary term with a hover explanation. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const text = GLOSSARY[k];
  if (!text) return <>{children ?? k}</>;
  return <span className="term">{children ?? k}<span className="tip glass-strong">{text}</span></span>;
}

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; className?: string; width?: string }

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; empty?: string }) {
  if (rows.length === 0) return <Empty>{empty ?? "Nothing to show."}</Empty>;
  return (
    <div className="table-wrap glass-strong">
      <table className="data">
        <thead><tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={onRowClick ? "clickable" : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sheet({ title, children, onClose, footer, wide }: { title: ReactNode; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet glass-strong" style={wide ? { width: "min(900px, 94vw)" } : undefined} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="actions">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onCancel }: { title: ReactNode; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Sheet title={title} onClose={busy ? () => {} : onCancel} footer={<>
      <Button onClick={onCancel} disabled={busy}>Not now</Button>
      <Button variant={danger ? "destructive-primary" : "primary"} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button>
    </>}>
      {children}
    </Sheet>
  );
}

export function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div className="segmented">{options.map((o) => <button key={o.id} className={o.id === value ? "active" : ""} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <div className="switch-row">
      {label && <span>{label}</span>}
      <button className={`switch ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
    </div>
  );
}

export function HealthRing({ score }: { score: number }) {
  const r = 50, c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--green)" : score >= 60 ? "var(--orange)" : "var(--red)";
  return (
    <div className="ring">
      <svg width="116" height="116" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r={r} stroke="rgba(127,127,127,0.18)" strokeWidth="10" fill="none" />
        <circle cx="58" cy="58" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="num">{score}<small>out of 100</small></div>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220, h = 44, pad = 3;
  const min = Math.min(...values, 0), max = Math.max(...values, 100);
  const pts = values.map((v, i) => `${pad + (i / (values.length - 1)) * (w - 2 * pad)},${h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad)}`).join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
