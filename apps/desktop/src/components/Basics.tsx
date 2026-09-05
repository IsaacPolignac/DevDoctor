import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Confidence, Severity } from "../lib/types";
import { CONFIDENCE_PLAIN, GLOSSARY, SEVERITY_PLAIN, type Tone } from "../lib/plain";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { api } from "../lib/api";
import { Icon, type IconName } from "./Icons";
import { t } from "../lib/i18n";

/* ---------- preferences ---------- */
export type Appearance = "system" | "light" | "dark";
export type Glass = "clear" | "tinted";
export interface Prefs {
  technical: boolean; setTechnical: (v: boolean) => void;
  appearance: Appearance; setAppearance: (v: Appearance) => void;
  glass: Glass; setGlass: (v: Glass) => void;
}
export const PrefsContext = createContext<Prefs>({ technical: false, setTechnical: () => {}, appearance: "system", setAppearance: () => {}, glass: "clear", setGlass: () => {} });
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
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.tone === "green" && <Icon name="check-circle-fill" style={{ color: "var(--green)" }} />}
            {toast.tone === "red" && <Icon name="triangle-fill" style={{ color: "var(--orange)" }} />}
            <div>
              <div className="t-title">{toast.title}</div>
              {toast.body && <div className="t-body">{toast.body}</div>}
            </div>
            {toast.action && <button className="btn small" onClick={() => { toast.action?.onClick(); setToasts((all) => all.filter((x) => x.id !== toast.id)); }}>{toast.action.label}</button>}
            <button className="icon-btn" onClick={() => setToasts((all) => all.filter((x) => x.id !== toast.id))} title={t("Dismiss")}><Icon name="x" size={12} /></button>
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
  return <Pill tone={p.tone} title={p.hint}>{technical ? severity : p.label}</Pill>;
}

export function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const { technical } = usePrefs();
  const p = CONFIDENCE_PLAIN[confidence];
  return <Pill tone={p.tone} title={p.hint}>{technical ? confidence : p.label}</Pill>;
}

export function StatusPill({ status }: { status: string }) {
  const tone: Tone = status === "applied" ? "green" : status === "rolled_back" ? "blue" : status.includes("fail") ? "red" : "gray";
  const label = status === "applied" ? t("Applied") : status === "rolled_back" ? t("Undone") : status === "failed" ? t("Failed (rolled back)") : status.replace("_", " ");
  return <Pill tone={tone}>{label}</Pill>;
}

type Variant = "default" | "primary" | "prominent" | "ghost" | "plain" | "destructive" | "destructive-primary";
export function Button({ variant = "default", size, icon, onClick, disabled, children, title, className, full }: { variant?: Variant; size?: "small" | "large"; icon?: IconName; onClick?: () => void; disabled?: boolean; children?: ReactNode; title?: string; className?: string; full?: boolean }) {
  const cls = ["btn", (variant === "primary" || variant === "prominent") ? "prominent" : "", (variant === "ghost" || variant === "plain") ? "plain" : "", variant === "destructive" ? "destructive" : "", variant === "destructive-primary" ? t("destructive prominent") : "", size ?? "", full ? "full" : "", className ?? ""].filter(Boolean).join(" ");
  return <button className={cls} onClick={onClick} disabled={disabled} title={title}>{icon && <Icon name={icon} size={size === "small" ? 12 : 14} />}{children}</button>;
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`card ${className ?? ""}`}>
      {(title || actions) && <div className="card-title"><span>{title}</span>{actions}</div>}
      {children}
    </div>
  );
}

export function GroupBox({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return <div className="groupbox">{title && <div className="gb-title">{title}</div>}{children}</div>;
}

/** Section header: headline + caption, actions on the right (the prototype's "Results" header). */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="section-head">
      <div><div className="h">{title}</div>{subtitle && <div className="c">{subtitle}</div>}</div>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  );
}

export function Empty({ children, icon, title }: { children?: ReactNode; icon?: IconName; title?: string }) {
  return <div className="empty">{icon && <Icon name={icon} className="icon" />}{title && <div className="t">{title}</div>}<div className="subheadline">{children}</div></div>;
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

export function Loading({ what }: { what?: string }) {
  return <p className="secondary" style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="spinner" /> {t(" Loading")}{what ? ` ${what}` : ""}…</p>;
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
          <div className="v">{v ?? <span className="secondary">—</span>}</div>
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
      <button className="icon-btn" style={{ width: 20, height: 20, verticalAlign: "middle" }} title={t("Reveal in Finder")} onClick={() => api.reveal(path).catch(() => {})}><Icon name="folder" size={12} /></button>
    </span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="inline-code selectable">{children}</span>;
}

export function Disclosure({ label, children, defaultOpen }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary><Icon name="chevron" size={11} />{label}</summary>
      <div className="dbody">{children}</div>
    </details>
  );
}

export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const text = GLOSSARY[k];
  if (!text) return <>{children ?? t(k)}</>;
  return <span className="term">{children ?? t(k)}<span className="tip">{t(text)}</span></span>;
}

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; className?: string; width?: string }

export function DataTable<T>({ columns, rows, rowKey, onRowClick, selectedKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; selectedKey?: string | null; empty?: ReactNode }) {
  if (rows.length === 0) return <div className="table-wrap"><Empty>{empty ?? t("Nothing to show.")}</Empty></div>;
  return (
    <div className="table-wrap">
      <div style={{ overflowX: "auto" }}>
        <table className="data">
          <thead><tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} className={`${onRowClick ? "clickable" : ""} ${selectedKey === k ? "selected" : ""}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                  {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A native-style sheet: header with icon, scrolling body, footer with actions. */
export function Sheet({ title, caption, icon, children, onClose, footer, wide }: { title: ReactNode; caption?: ReactNode; icon?: IconName; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={`sheet ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sh-head">{icon && <Icon name={icon} />}<div><div className="h">{title}</div>{caption && <div className="c">{caption}</div>}</div></div>
        <div className="sh-body">{children}</div>
        {footer && <div className="sh-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, caption, icon, children, confirmLabel, danger, busy, onConfirm, onCancel, wide }: { title: ReactNode; caption?: ReactNode; icon?: IconName; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void; wide?: boolean }) {
  return (
    <Sheet title={title} caption={caption} icon={icon ?? "wrench-screwdriver"} wide={wide} onClose={busy ? () => {} : onCancel} footer={<>
      <Button onClick={onCancel} disabled={busy}>{t("Cancel")}</Button>
      <span className="spacer" />
      <Button variant={danger ? "destructive-primary" : "prominent"} onClick={onConfirm} disabled={busy}>{busy ? t("Working…") : confirmLabel}</Button>
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

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220, h = 40, pad = 3;
  const min = Math.min(...values, 0), max = Math.max(...values, 100);
  const pts = values.map((v, i) => `${pad + (i / (values.length - 1)) * (w - 2 * pad)},${h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad)}`).join(" ");
  return <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** Small popover menu anchored to its parent (position: relative). */
export function Popover({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onDown = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="popover" onMouseDown={(e) => e.stopPropagation()}>{children}</div>;
}
