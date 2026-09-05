import type { Overview } from "../lib/types";
import { formatBytes } from "../lib/format";
import { Icon, type IconName } from "./Icons";
import { Logo } from "./Logo";
import { Sparkline } from "./Basics";

function Metric({ value, label, icon, tint }: { value: string; label: string; icon: IconName; tint?: string }) {
  return (
    <div className="metric">
      <Icon name={icon} style={tint ? { color: tint } : undefined} />
      <div><div className="v">{value}</div><div className="l">{label}</div></div>
    </div>
  );
}

export function EnvironmentHeader({ overview, reclaimable, trend = [] }: { overview: Overview; reclaimable: number | null; trend?: number[] }) {
  const h = overview.health;
  const sys = overview.system;
  const attention = overview.issues.problems;
  const recommendations = overview.issues.warnings + overview.issues.notes;
  const capsule = attention > 0
    ? { tone: "orange", icon: "triangle-fill" as IconName, text: `${attention} action${attention > 1 ? "s" : ""} recommended` }
    : recommendations > 0
      ? { tone: "blue", icon: "info-circle-fill" as IconName, text: `${recommendations} recommendation${recommendations > 1 ? "s" : ""}` }
      : { tone: "green", icon: "check-circle-fill" as IconName, text: h ? "Everything looks healthy" : "Not checked yet" };
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Logo size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title2" style={{ fontSize: 17 }}>Developer Environment</div>
          <div className="subheadline secondary" style={{ marginTop: 3 }}>{sys.os.name} {sys.os.version} · {sys.os.arch === "arm64" ? "Apple silicon" : "Intel"} · {sys.shell} · {sys.user}</div>
        </div>
        <span className={`capsule ${capsule.tone}`}><Icon name={capsule.icon} />{capsule.text}</span>
      </div>
      <div className="divider" />
      <div className="metrics">
        <Metric value={h ? String(h.checks_total) : "—"} label="Checks" icon="checklist" />
        <Metric value={String(attention)} label="Need attention" icon="triangle" tint="var(--orange)" />
        <Metric value={String(recommendations)} label={recommendations === 1 ? "Recommendation" : "Recommendations"} icon="info" tint="var(--blue)" />
        <Metric value={reclaimable != null ? formatBytes(reclaimable) : "—"} label="Reclaimable" icon="internaldrive" />
        {trend.length >= 2 && (
          <div className="metric" title={`Health score of your last ${trend.length} checks: ${trend.join(" → ")}`}>
            <div style={{ width: 84, height: 26, flex: "none" }}><Sparkline values={trend} /></div>
            <div><div className="v">{trend[trend.length - 1]}{trend[trend.length - 1] > trend[0] ? " ↑" : trend[trend.length - 1] < trend[0] ? " ↓" : ""}</div><div className="l">Health, last {trend.length} checks</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
