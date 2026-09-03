import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import type { Category, Severity } from "../lib/types";
import { CATEGORY_LABELS, SEVERITY_ORDER } from "../lib/types";
import { ErrorBox, Loading } from "../components/Basics";
import { IssueList } from "../components/IssueList";

export function ProblemsPage({ refreshKey }: { refreshKey: number }) {
  const [showIgnored, setShowIgnored] = useState(false);
  const [minSeverity, setMinSeverity] = useState<Severity>("info");
  const [category, setCategory] = useState<Category | "">("");
  const [onlyFixable, setOnlyFixable] = useState(false);
  const issues = useAsync(() => api.issues(true), [refreshKey]);
  if (issues.loading && !issues.data) return <Loading what="issues" />;
  if (issues.error) return <ErrorBox error={issues.error} />;
  const minIdx = SEVERITY_ORDER.indexOf(minSeverity);
  const rows = (issues.data ?? [])
    .filter((r) => showIgnored || !r.ignored)
    .filter((r) => SEVERITY_ORDER.indexOf(r.issue.severity) <= minIdx)
    .filter((r) => !category || r.issue.category === category)
    .filter((r) => !onlyFixable || r.issue.fixer_available)
    .map((r) => r.issue);
  const ignoredCount = (issues.data ?? []).filter((r) => r.ignored).length;
  return (
    <div>
      <h1>Problems</h1>
      <p className="muted">Open issues from the latest scans. Click an issue for evidence, impact and the fix preview.</p>
      <div className="filters">
        <select className="text" value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as Severity)}>
          {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s === "info" ? "all severities" : `${s} and above`}</option>)}
        </select>
        <select className="text" value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">all categories</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyFixable} onChange={(e) => setOnlyFixable(e.target.checked)} /> only with automatic fix</label>
        <label className="check"><input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} /> show ignored ({ignoredCount})</label>
        <span className="muted small">{rows.length} shown</span>
      </div>
      <IssueList issues={rows} empty="No issues match these filters." />
    </div>
  );
}
