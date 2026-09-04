import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import type { DetectorMeta, Issue } from "../lib/types";
import { findingFromIssue, healthyFinding, type Finding } from "../lib/plain";
import { Button, ErrorBox, Loading, PageHeader, Segmented } from "../components/Basics";
import { EnvironmentHeader } from "../components/EnvironmentHeader";
import { FindingInspector, FindingsTable, RepairSheet, detectorName, filterByLevel, useFindings, useRepairActions, type ResultFilter } from "../components/FindingsView";
import { Icon } from "../components/Icons";
import { Logo } from "../components/Logo";

export function Onboarding({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="card onboarding" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Logo size={44} /><div className="title2">Welcome to DevDoctor</div></div>
      <p className="subheadline secondary" style={{ maxWidth: 640 }}>DevDoctor looks at how your Mac is set up for development and explains, in plain words, what is broken, why it matters and how to fix it. It never changes anything without showing you first.</p>
      <div className="promises">
        <div className="promise"><Icon name="eye" className="icon" /><div className="p-title">Understand first</div><div className="p-body">Every finding comes with what was seen and why it matters.</div></div>
        <div className="promise"><Icon name="lock-shield" className="icon" /><div className="p-title">Preview before any change</div><div className="p-body">Files are backed up, changes are verified, and most repairs can be undone.</div></div>
        <div className="promise"><Icon name="lock" className="icon" /><div className="p-title">Stays on your Mac</div><div className="p-body">No account, no cloud, no telemetry. Secrets are never shown or stored.</div></div>
      </div>
      <div className="btn-row">
        <Button variant="prominent" size="large" className="capsule-btn" icon="play" onClick={onStart}>Run first scan</Button>
        <Button variant="plain" onClick={onSkip}>Skip for now</Button>
      </div>
    </div>
  );
}

export function OverviewPage({ refreshKey, refresh, detectors, inspector, onboarding, onOnboardingDone, onScan }: { refreshKey: number; refresh: () => void; detectors: DetectorMeta[]; inspector: boolean; onboarding: boolean; onOnboardingDone: () => void; onScan: () => void }) {
  const ov = useAsync(() => api.overview(), [refreshKey]);
  const report = useAsync(() => api.lastReport(), [refreshKey]);
  const issues = useAsync(() => api.issues(false), [refreshKey]);
  const storage = useAsync(() => api.lastStorage(), [refreshKey]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const findings: Finding[] = useMemo(() => {
    const open = (issues.data ?? []).map((r) => findingFromIssue(r.issue, detectorName(detectors, r.issue.detector_id)));
    const reported = new Set(open.map((f) => f.detectorId));
    const healthy = (report.data?.detector_runs ?? []).filter((r) => r.status === "ok" && !reported.has(r.id)).map((r) => healthyFinding(r, r.category));
    const order = { attention: 0, recommendation: 1, healthy: 2 };
    return [...open, ...healthy].sort((a, b) => order[a.level] - order[b.level]);
  }, [issues.data, report.data, detectors]);
  const visible = useMemo(() => filterByLevel(findings, filter), [findings, filter]);
  const { selected, selectedKey, setSelectedKey, repairing, setRepairing } = useFindings(visible);
  const actions = useRepairActions(refresh);
  if (ov.loading && !ov.data) return <Loading what="overview" />;
  if (ov.error || !ov.data) return <ErrorBox error={ov.error} />;
  const o = ov.data;
  const reclaimable = storage.data ? storage.data.categories.filter((c) => c.recreatable).reduce((a, c) => a + c.bytes, 0) + storage.data.node_modules_bytes : null;
  const counts = { attention: findings.filter((f) => f.level === "attention").length, recommendation: findings.filter((f) => f.level === "recommendation").length, healthy: findings.filter((f) => f.level === "healthy").length };
  return (
    <>
      <div className="content">
        {onboarding && <Onboarding onStart={() => { onOnboardingDone(); onScan(); }} onSkip={onOnboardingDone} />}
        <EnvironmentHeader overview={o} reclaimable={reclaimable} />
        {!o.health && !onboarding && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="subheadline">No scan yet. A quick scan takes about a second and changes nothing.</p>
            <Button variant="prominent" className="capsule-btn" icon="play" onClick={onScan}>Run Scan</Button>
          </div>
        )}
        {o.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
        <PageHeader title="Results" subtitle="Select a row to review the evidence and repair plan." actions={
          <Segmented value={filter} onChange={(v) => setFilter(v as ResultFilter)} options={[{ id: "all", label: "All" }, { id: "attention", label: `Needs Attention${counts.attention ? ` · ${counts.attention}` : ""}` }, { id: "recommendation", label: `Recommendations${counts.recommendation ? ` · ${counts.recommendation}` : ""}` }, { id: "healthy", label: `Healthy${counts.healthy ? ` · ${counts.healthy}` : ""}` }]} />
        } />
        <FindingsTable findings={visible} selected={selectedKey} onSelect={(f) => setSelectedKey(f.key)} empty={o.health ? "No results for this filter." : "Run a scan to see results."} />
        {o.issues.batch_safe > 0 && <p className="caption secondary" style={{ marginTop: 10 }}><Icon name="check-circle-fill" size={12} style={{ color: "var(--green)", verticalAlign: -2 }} /> {o.issues.batch_safe} finding{o.issues.batch_safe > 1 ? "s" : ""} can be repaired safely: select {o.issues.batch_safe > 1 ? "one" : "it"} and use Preview Repair.</p>}
      </div>
      {inspector && <FindingInspector finding={selected} onRepair={(issue: Issue) => setRepairing(issue)} onIgnore={actions.ignore} onOpen={actions.open} />}
      {repairing && <RepairSheet issue={repairing} onClose={() => setRepairing(null)} onApplied={(tx) => { setRepairing(null); actions.applied(tx); }} />}
    </>
  );
}
