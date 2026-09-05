// Simple health dashboard: a score ring and one tile per area, after the macOS System Settings
// look. Clicking a tile filters the results table below.
import type { Category, HealthScore, Issue } from "../lib/types";
import { CATEGORY_PLAIN } from "../lib/plain";
import { Icon, type IconName } from "./Icons";
import { Tile, type TileColor } from "./Tile";
import { t } from "../lib/i18n";

const AREA: Record<Category, { icon: IconName; color: TileColor }> = {
  shell: { icon: "terminal", color: "graphite" },
  runtimes: { icon: "shippingbox", color: "purple" },
  package_managers: { icon: "box", color: "orange" },
  processes: { icon: "waveform", color: "green" },
  ports: { icon: "cable", color: "teal" },
  ai_tools: { icon: "cpu", color: "pink" },
  disk: { icon: "internaldrive", color: "indigo" },
  git: { icon: "git", color: "red" },
  ssh: { icon: "key", color: "yellow" },
  containers: { icon: "box", color: "blue" },
  environment: { icon: "sliders", color: "gray" },
  services: { icon: "gear", color: "gray" },
};

export function HealthRing({ score, size = 104 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--green)" : score >= 60 ? "var(--orange)" : "var(--red)";
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fill-2)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="num">{score}<small>/ 100</small></div>
    </div>
  );
}

export function Dashboard({ health, issues, selected, onSelect }: { health: HealthScore | undefined; issues: Issue[]; selected: Category | null; onSelect: (c: Category | null) => void }) {
  const cats = (health?.categories ?? []).filter((c) => c.checks_run > 0 || c.issues > 0);
  const label = !health ? t("Not checked yet") : health.problems === 0 && health.warnings === 0 ? t("Healthy") : health.problems === 0 ? t("Almost perfect") : t("Needs attention");
  const sub = !health ? t("Run a scan to see your score.") : t("{passed} of {total} checks passed", { passed: health.checks_passed, total: health.checks_total });
  return (
    <div className="card dashboard">
      <div className="dash-score">
        <HealthRing score={health?.score ?? 0} />
        <div><div className="headline">{label}</div><div className="caption secondary">{sub}</div></div>
      </div>
      <div className="dash-tiles">
        {cats.map((c) => {
          const meta = AREA[c.category];
          const count = issues.filter((i) => i.category === c.category).length;
          const attention = issues.some((i) => i.category === c.category && (i.severity === "critical" || i.severity === "high" || i.severity === "medium"));
          const active = selected === c.category;
          return (
            <button key={c.category} className={`dash-tile ${active ? "active" : ""}`} onClick={() => onSelect(active ? null : c.category)} title={`${c.checks_run === 1 ? t("1 check") : t("{n} checks", { n: c.checks_run })} · ${count === 1 ? t("1 finding") : t("{n} findings", { n: count })}`}>
              <Tile color={meta.color} icon={meta.icon} size={26} />
              <span className="dt-label">{t(CATEGORY_PLAIN[c.category])}</span>
              {count === 0 ? <Icon name="check-circle-fill" className="dt-ok" /> : <span className={`dt-count ${attention ? "warn" : ""}`}>{count}</span>}
            </button>
          );
        })}
        {cats.length === 0 && <div className="secondary caption">{t("Areas appear here after the first scan.")}</div>}
      </div>
    </div>
  );
}
