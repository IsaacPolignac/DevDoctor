import type { ScanProgress } from "../lib/types";
import { relativeDate } from "../lib/format";
import { Icon } from "./Icons";
import { t } from "../lib/i18n";

export function StatusBar({ scanning, progress, lastScanAt, mode }: { scanning: boolean; progress: ScanProgress | null; lastScanAt?: string | null; mode?: string | null }) {
  const total = progress && "total" in progress ? progress.total : 0;
  const index = progress && "index" in progress ? progress.index + (progress.event === "detector_finished" ? 1 : 0) : 0;
  const pct = total ? Math.max(4, Math.round((index / total) * 100)) : 4;
  const name = progress && "name" in progress ? progress.name : null;
  return (
    <div className="statusbar">
      {scanning ? (<><span className="spinner" /><span>{name ? t("Checking {name}…", { name: name.toLowerCase() }) : t("Starting {mode} scan…", { mode: t(mode ?? "quick") })}</span></>) : (
        <><Icon name="check-circle-fill" className="ok" /><span>{lastScanAt ? t("Scan complete") : t("No scan yet")}</span></>
      )}
      <span className="spacer" />
      {scanning ? <div className="progress"><div style={{ width: `${pct}%` }} /></div> : lastScanAt ? <span>{t("Last checked ")}{relativeDate(lastScanAt)}</span> : <span>{t("Press ⌘R to scan")}</span>}
    </div>
  );
}
