import type { ScanProgress } from "../lib/types";
import { relativeDate } from "../lib/format";
import { Icon } from "./Icons";

export function StatusBar({ scanning, progress, lastScanAt, mode }: { scanning: boolean; progress: ScanProgress | null; lastScanAt?: string | null; mode?: string | null }) {
  const total = progress && "total" in progress ? progress.total : 0;
  const index = progress && "index" in progress ? progress.index + (progress.event === "detector_finished" ? 1 : 0) : 0;
  const pct = total ? Math.max(4, Math.round((index / total) * 100)) : 4;
  const name = progress && "name" in progress ? progress.name : null;
  return (
    <div className="statusbar">
      {scanning ? (<><span className="spinner" /><span>{name ? `Checking ${name.toLowerCase()}…` : `Starting ${mode ?? "quick"} scan…`}</span></>) : (
        <><Icon name="check-circle-fill" className="ok" /><span>{lastScanAt ? "Scan complete" : "No scan yet"}</span></>
      )}
      <span className="spacer" />
      {scanning ? <div className="progress"><div style={{ width: `${pct}%` }} /></div> : lastScanAt ? <span>Last checked {relativeDate(lastScanAt)}</span> : <span>Press ⌘R to scan</span>}
    </div>
  );
}
