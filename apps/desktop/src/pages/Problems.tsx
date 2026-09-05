import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import type { DetectorMeta, Issue } from "../lib/types";
import { findingFromIssue, healthyFinding, type Finding } from "../lib/plain";
import { ErrorBox, Loading, PageHeader, Segmented } from "../components/Basics";
import { FindingInspector, FindingsTable, RepairSheet, detectorName, filterByLevel, useFindings, useRepairActions, type ResultFilter } from "../components/FindingsView";
import { t } from "../lib/i18n";

export function ProblemsPage({ refreshKey, refresh, detectors, inspector }: { refreshKey: number; refresh: () => void; detectors: DetectorMeta[]; inspector: boolean }) {
  const issues = useAsync(() => api.issues(true), [refreshKey]);
  const report = useAsync(() => api.lastReport(), [refreshKey]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [area, setArea] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const findings: Finding[] = useMemo(() => {
    const open = (issues.data ?? []).filter((r) => showIgnored || !r.ignored).map((r) => findingFromIssue(r.issue, detectorName(detectors, r.issue.detector_id)));
    const reported = new Set((issues.data ?? []).map((r) => r.issue.detector_id));
    const healthy = (report.data?.detector_runs ?? []).filter((r) => r.status === "ok" && !reported.has(r.id)).map((r) => healthyFinding(r, r.category));
    const order = { attention: 0, recommendation: 1, healthy: 2 };
    return [...open, ...healthy].sort((a, b) => order[a.level] - order[b.level]);
  }, [issues.data, report.data, detectors, showIgnored]);
  const areas = useMemo(() => Array.from(new Set(findings.map((f) => f.area))).sort(), [findings]);
  const visible = useMemo(() => filterByLevel(findings, filter).filter((f) => !area || f.area === area), [findings, filter, area]);
  const { selected, selectedKey, setSelectedKey, repairing, setRepairing } = useFindings(visible);
  const actions = useRepairActions(refresh);
  const ignoredCount = (issues.data ?? []).filter((r) => r.ignored).length;
  if (issues.loading && !issues.data) return <Loading what="problems" />;
  if (issues.error) return <ErrorBox error={issues.error} />;
  return (
    <>
      <div className="content">
        <PageHeader title={t("All results")} subtitle={t("Every check from the latest scans, including the ones that passed. Select a row to see evidence and the repair plan.")} actions={<>
          <select className="text" value={area} onChange={(e) => setArea(e.target.value)}><option value="">{t("All areas")}</option>{areas.map((a) => <option key={a} value={a}>{t(a)}</option>)}</select>
          {ignoredCount > 0 && <label className="check"><input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} /> {t(" show ")}{ignoredCount} {t(" ignored")}</label>}
          <Segmented value={filter} onChange={(v) => setFilter(v as ResultFilter)} options={[{ id: "all", label: t("All") }, { id: "attention", label: t("Needs Attention") }, { id: "recommendation", label: t("Recommendations") }, { id: "healthy", label: t("Healthy") }]} />
        </>} />
        <FindingsTable findings={visible} selected={selectedKey} onSelect={(f) => setSelectedKey(f.key)} empty={t("No results match these filters.")} />
      </div>
      {inspector && <FindingInspector finding={selected} onRepair={(issue: Issue) => setRepairing(issue)} onIgnore={actions.ignore} onOpen={actions.open} />}
      {repairing && <RepairSheet issue={repairing} onClose={() => setRepairing(null)} onApplied={(tx) => { setRepairing(null); actions.applied(tx); }} />}
    </>
  );
}
