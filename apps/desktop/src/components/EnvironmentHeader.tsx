import type { Overview } from "../lib/types";
import { formatBytes } from "../lib/format";
import { Icon, type IconName } from "./Icons";
import { Logo } from "./Logo";
import { Sparkline } from "./Basics";
import { t } from "../lib/i18n";

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
    ? { tone: "orange", icon: "triangle-fill" as IconName, text: attention === 1 ? t("1 action recommended") : t("{n} actions recommended", { n: attention }) }
    : recommendations > 0
      ? { tone: "blue", icon: "info-circle-fill" as IconName, text: recommendations === 1 ? t("1 recommendation") : t("{n} recommendations", { n: recommendations }) }
      : { tone: "green", icon: "check-circle-fill" as IconName, text: h ? t("Everything looks healthy") : t("Not checked yet") };
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Logo size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title2" style={{ fontSize: 17 }}>{t("Developer Environment")}</div>
          <div className="subheadline secondary" style={{ marginTop: 3 }}>{sys.os.name} {sys.os.version} · {sys.os.arch === "arm64" ? t("Apple silicon") : t("Intel")} · {sys.shell} · {sys.user}</div>
        </div>
        <span className={`capsule ${capsule.tone}`}><Icon name={capsule.icon} />{capsule.text}</span>
      </div>
      <div className="divider" />
      <div className="metrics">
        <Metric value={h ? String(h.checks_total) : "—"} label={t("Checks")} icon="checklist" />
        <Metric value={String(attention)} label={t("Need attention")} icon="triangle" tint="var(--orange)" />
        <Metric value={String(recommendations)} label={recommendations === 1 ? t("Recommendation") : t("Recommendations")} icon="info" tint="var(--blue)" />
        <Metric value={reclaimable != null ? formatBytes(reclaimable) : "—"} label={t("Reclaimable")} icon="internaldrive" />
        {trend.length >= 2 && (
          <div className="metric" title={t("Health score of your last {n} checks: {scores}", { n: trend.length, scores: trend.join(" → ") })}>
            <div style={{ width: 84, height: 26, flex: "none" }}><Sparkline values={trend} /></div>
            <div><div className="v">{trend[trend.length - 1]}{trend[trend.length - 1] > trend[0] ? " ↑" : trend[trend.length - 1] < trend[0] ? " ↓" : ""}</div><div className="l">{t("Health, last ")}{trend.length} {t(" checks")}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
