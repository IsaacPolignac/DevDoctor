import type { DetectorMeta, ScanProgress } from "../lib/types";
import { Icon } from "./Icons";

/** Live view of a running scan: one line per check, in plain words. */
export function ScanOverlay({ progress, detectors, mode }: { progress: ScanProgress | null; detectors: DetectorMeta[]; mode: string }) {
  const total = progress && "total" in progress ? progress.total : detectors.length;
  const index = progress && "index" in progress ? progress.index + (progress.event === "detector_finished" ? 1 : 0) : 0;
  const pct = total ? Math.round((index / total) * 100) : 5;
  const current = progress && "name" in progress ? progress.name : null;
  const currentId = progress && "id" in progress ? progress.id : null;
  const order = detectors.filter((d) => mode === "deep" || (mode === "storage" ? d.modes.includes("storage") : d.modes.includes("quick")));
  const currentIdx = order.findIndex((d) => d.id === currentId);
  return (
    <div className="backdrop">
      <div className="sheet glass-strong" style={{ width: "min(560px, 92vw)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="spinner" /> Checking your environment</h2>
        <p className="muted">{current ? `Now: ${current}` : "Starting a fresh terminal session to see exactly what you see…"}</p>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="scan-list">
          {order.map((d, i) => {
            const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "";
            return (
              <div key={d.id} className={`item ${state}`}>
                {state === "done" ? <Icon name="check" size={13} /> : state === "active" ? <span className="spinner" /> : <span style={{ width: 13 }} />}
                <span>{d.name}</span>
              </div>
            );
          })}
        </div>
        <p className="tiny faint" style={{ marginTop: 10 }}>Nothing is modified during a check.</p>
      </div>
    </div>
  );
}
