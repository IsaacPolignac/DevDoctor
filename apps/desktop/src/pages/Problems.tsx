import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import type { Category, FixPreview, Issue } from "../lib/types";
import { CATEGORY_PLAIN, GROUPS, severityGroup, type Group } from "../lib/plain";
import { Button, ConfirmDialog, ErrorBox, Loading, PageHeader, Segmented, useToast } from "../components/Basics";
import { IssueCardList } from "../components/IssueCard";
import { FixPreviewView } from "../components/FixPreviewView";

export function ProblemsPage({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "fixable" | Group>("all");
  const [category, setCategory] = useState<Category | "">("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [fixing, setFixing] = useState<{ issue: Issue; preview: FixPreview | null; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const issues = useAsync(() => api.issues(true), [refreshKey]);
  if (issues.loading && !issues.data) return <Loading what="issues" />;
  if (issues.error) return <ErrorBox error={issues.error} />;
  const all = (issues.data ?? []).filter((r) => showIgnored || !r.ignored).map((r) => r.issue);
  const rows = all
    .filter((i) => (filter === "all" ? true : filter === "fixable" ? i.fixer_available : severityGroup(i.severity) === filter))
    .filter((i) => !category || i.category === category);
  const categories = Array.from(new Set(all.map((i) => i.category)));
  const ignoredCount = (issues.data ?? []).filter((r) => r.ignored).length;
  const startFix = async (issue: Issue) => {
    setFixing({ issue, preview: null });
    try { setFixing({ issue, preview: await api.previewFix(issue.id) }); } catch (e) { setFixing({ issue, preview: null, error: errorMessage(e) }); }
  };
  const applyOne = async () => {
    if (!fixing) return;
    setBusy(true);
    try {
      const tx = await api.applyFix(fixing.issue.id);
      toast.push({ title: "Fixed", body: tx.title, tone: "green" });
      setFixing(null);
      issues.reload();
      onChanged();
    } catch (e) { toast.push({ title: "Fix failed, nothing changed", body: errorMessage(e), tone: "red" }); setFixing(null); } finally { setBusy(false); }
  };
  const groups = GROUPS.map((g) => ({ ...g, issues: rows.filter((i) => severityGroup(i.severity) === g.id) }));
  return (
    <div className="page">
      <PageHeader title="Issues" subtitle="Everything DevDoctor found, sorted by how much it matters. Click an issue to see what happened, why, and exactly what a fix would change." />
      <div className="filters">
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[{ id: "all", label: `All (${all.length})` }, { id: "attention", label: "Needs attention" }, { id: "should", label: "Should fix" }, { id: "look", label: "Worth a look" }, { id: "note", label: "Good to know" }, { id: "fixable", label: "Has a fix" }]} />
        <select className="text" value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">Every area</option>
          {categories.map((c) => <option key={c} value={c}>{CATEGORY_PLAIN[c]}</option>)}
        </select>
        {ignoredCount > 0 && <label className="check small"><input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} /> show {ignoredCount} ignored</label>}
      </div>
      {rows.length === 0 && <div className="empty">{all.length === 0 ? "No open issues. Run a check from the Home page to look again." : "No issues match these filters."}</div>}
      {filter === "all" ? groups.filter((g) => g.issues.length > 0).map((g) => (
        <div key={g.id}>
          <h2>{g.title} <span className="muted" style={{ fontWeight: 400 }}>· {g.blurb}</span></h2>
          <IssueCardList issues={g.issues} onFix={startFix} />
        </div>
      )) : <div style={{ marginTop: 8 }}><IssueCardList issues={rows} onFix={startFix} /></div>}
      {fixing && (
        <ConfirmDialog title={fixing.preview?.title ?? fixing.issue.title} confirmLabel={fixing.preview?.reversible ? "Apply fix" : "Apply (cannot be undone)"} danger={fixing.preview ? !fixing.preview.reversible : false} busy={busy || !fixing.preview} onConfirm={applyOne} onCancel={() => setFixing(null)}>
          {fixing.preview ? <FixPreviewView preview={fixing.preview} compact /> : fixing.error ? <div className="notice">{fixing.error}</div> : <Loading what="preview" />}
          {!fixing.preview && fixing.error && <Button size="small" onClick={() => setFixing(null)}>Close</Button>}
        </ConfirmDialog>
      )}
    </div>
  );
}
