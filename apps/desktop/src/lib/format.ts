import { intlLocale, t } from "./i18n";
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1000) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let v = bytes;
  let i = -1;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function formatAgo(secs: number | null | undefined): string {
  if (secs == null) return "";
  if (secs < 60) return t("just now");
  if (secs < 3600) return t("{n} min ago", { n: Math.floor(secs / 60) });
  if (secs < 86400) return t("{n} h ago", { n: Math.floor(secs / 3600) });
  if (secs < 30 * 86400) return t("{n} days ago", { n: Math.floor(secs / 86400) });
  if (secs < 365 * 86400) return t("{n} months ago", { n: Math.floor(secs / (30 * 86400)) });
  return t("{n} years ago", { n: Math.floor(secs / (365 * 86400)) });
}

export function formatDuration(secs: number | null | undefined): string {
  return formatAgo(secs).replace(t(" ago"), "").replace(" ago", "");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(intlLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return formatAgo(Math.max(0, Math.floor((Date.now() - t) / 1000)));
}

export function shortenHome(path: string, home?: string): string {
  if (home && path.startsWith(home)) return "~" + path.slice(home.length);
  return path;
}

export function severityLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
