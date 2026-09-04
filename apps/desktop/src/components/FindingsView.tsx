import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useNav } from "../lib/nav";
import type { DetectorMeta, FixPreview, Issue, Transaction } from "../lib/types";
import { LEVELS, plainFixLabel, type Finding, type Level } from "../lib/plain";
import { shortenHome } from "../lib/format";
import { Button, DataTable, Disclosure, Empty, ErrorBox, GroupBox, Loading, Sheet, usePrefs, useToast } from "./Basics";
import { DiffView } from "./DiffView";
import { Icon } from "./Icons";

export type ResultFilter = "all" | "attention" | "recommendation" | "healthy";

/** The results table of the native prototype: severity glyph, Area, Finding, Source. */
export function FindingsTable({ findings, selected, onSelect, empty }: { findings: Finding[]; selected: string | null; onSelect: (f: Finding) => void; empty?: string }) {
  return (
    <DataTable<Finding>
      columns={[
        { key: "level", label: "", width: "28px", className: "icon-cell", render: (f) => <Icon name={LEVELS[f.level].icon} className="sev" title={LEVELS[f.level].title} style={{ color: LEVELS[f.level].color }} /> },
        { key: "area", label: "Area", width: "120px", render: (f) => <span style={{ fontWeight: 500 }}>{f.area}</span> },
        { key: "title", label: "Finding", render: (f) => f.title },
        { key: "source", label: "Source", width: "200px", render: (f) => <span className="secondary">{f.source}</span> },
      ]}
      rows={findings}
      rowKey={(f) => f.key}
      selectedKey={selected}
      onRowClick={onSelect}
      empty={empty ?? "No results."}
    />
  );
}

/** Repair preview sheet, after the prototype: header, finding title, "Changes" group box, rollback note, Cancel / Apply. */
export function RepairSheet({ issue, onClose, onApplied }: { issue: Issue; onClose: () => void; onApplied: (tx: Transaction) => void }) {
  const { home } = useNav();
  const { technical } = usePrefs();
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.previewFix(issue.id).then((p) => { if (!cancelled) setPreview(p); }).catch((e) => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [issue.id]);
  const apply = async () => {
    setBusy(true);
    setError(null);
    try { onApplied(await api.applyFix(issue.id)); } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  const irreversible = preview ? !preview.reversible : false;
  return (
    <Sheet title="Preview Repair" caption="Review the exact changes before applying them." icon="wrench-screwdriver" onClose={busy ? () => {} : onClose} wide={technical}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><span className="spacer" /><Button variant={irreversible ? "destructive-primary" : "prominent"} onClick={apply} disabled={busy || !preview}>{busy ? "Applying…" : irreversible ? "Apply (cannot be undone)" : "Apply Repair"}</Button></>}>
      <div className="title3">{preview?.title ?? issue.title}</div>
      <ErrorBox error={error} />
      {!preview && !error && <Loading what="repair plan" />}
      {preview && (
        <>
          <p className="subheadline secondary" style={{ margin: "6px 0 14px" }}>{preview.summary}</p>
          <GroupBox title="Changes">
            {preview.operations.length === 0 && <p className="secondary caption">Nothing would change.</p>}
            {preview.operations.map((o, i) => <div key={i} className="check-line"><Icon name="check-circle-fill" /><span className="mono selectable">{shortenHome(o, home)}</span></div>)}
            {preview.directories_deleted.map((d) => <div key={d.path} className="check-line"><Icon name="check-circle-fill" /><span>Delete {shortenHome(d.path, home)}</span></div>)}
          </GroupBox>
          {preview.notes.length > 0 && <ul className="section-list caption secondary">{preview.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {preview.files_modified.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Disclosure label="Exact file changes" defaultOpen={technical}>
                {preview.files_modified.map((f) => <div key={f.path}><div className="caption secondary mono">{shortenHome(f.path, home)}</div><DiffView diff={f.diff} /></div>)}
              </Disclosure>
            </div>
          )}
          {preview.validations.length > 0 && (
            <GroupBox title="Verified right after applying">
              {preview.validations.map((v, i) => <div key={i} className="check-line"><Icon name="check-circle-fill" style={{ color: "var(--label-3)" }} /><span>{v}</span></div>)}
            </GroupBox>
          )}
          <div className="inspector note" style={{ padding: 0, border: 0, background: "none" }}>
            <Icon name={preview.reversible ? "uturn-circle" : "triangle"} />
            <span>{preview.reversible ? "A rollback point will be created automatically. You can undo this repair from Fixes & scans." : "This repair cannot be undone automatically: nothing is backed up because files are deleted or a program is stopped."}</span>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Right-hand inspector for the selected finding. */
export function FindingInspector({ finding, onRepair, onIgnore, onOpen }: { finding: Finding | null; onRepair: (issue: Issue) => void; onIgnore: (issue: Issue) => void; onOpen: (issue: Issue) => void }) {
  const { home } = useNav();
  const { technical } = usePrefs();
  const [plan, setPlan] = useState<{ id: string; ops: string[] } | null>(null);
  const issue = finding?.issue ?? null;
  useEffect(() => {
    if (!issue || !issue.fixer_available) { setPlan(null); return; }
    let cancelled = false;
    api.previewFix(issue.id).then((p) => { if (!cancelled) setPlan({ id: issue.id, ops: p.operations }); }).catch(() => { if (!cancelled) setPlan({ id: issue.id, ops: [] }); });
    return () => { cancelled = true; };
  }, [issue?.id, issue?.fixer_available]);
  if (!finding) return <div className="inspector"><Empty icon="sidebar-right" title="No Result Selected">Select a row to review the evidence and repair plan.</Empty></div>;
  const lvl = LEVELS[finding.level];
  return (
    <div className="inspector">
      <div className="sev" style={{ color: lvl.color }}><Icon name={lvl.icon} />{lvl.title}</div>
      <div className="ititle">{finding.title}</div>
      <div className="isummary">{finding.summary}</div>
      {issue?.impact && <><h3>Why it matters</h3><div className="subheadline">{issue.impact}</div></>}
      {issue && issue.evidence.length > 0 && (
        <>
          <h3>Evidence</h3>
          {issue.evidence.slice(0, technical ? 20 : 6).map((e, i) => <div key={i} className="evidence"><Icon name="chevron" /><span className="mono selectable">{shortenHome(e, home)}</span></div>)}
        </>
      )}
      {issue && (
        <>
          <h3>Proposed repair</h3>
          {issue.fixer_available ? (
            plan && plan.id === issue.id ? (plan.ops.length ? plan.ops.map((o, i) => <div key={i} className="check-line"><Icon name="check" /><span className="selectable">{shortenHome(o, home)}</span></div>) : <div className="subheadline secondary">Nothing would change right now; run a new scan.</div>) : <Loading what="plan" />
          ) : (
            <div className="subheadline">{issue.recommended_action}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
            {issue.fixer_available && <Button variant="prominent" size="large" className="capsule-btn" full onClick={() => onRepair(issue)}>{issue.batch_safe ? "Preview Repair…" : plainFixLabel(issue.reversible, false).replace("Fix", "Preview Repair")}</Button>}
            <Button variant="plain" full onClick={() => onOpen(issue)}>Full details</Button>
            <Button variant="plain" full onClick={() => onIgnore(issue)}>Ignore for Now</Button>
          </div>
          <div className="note"><Icon name="lock-shield" /><span>No changes are made without confirmation. Every repair that edits files creates a rollback point.</span></div>
        </>
      )}
      {!issue && (
        <>
          <h3>What this means</h3>
          <div className="subheadline">This check ran and found nothing to report. Nothing to do.</div>
          <div className="note"><Icon name="check-circle-fill" style={{ color: "var(--green)" }} /><span>Healthy checks are listed so you can see what was verified, not only what went wrong.</span></div>
        </>
      )}
    </div>
  );
}

/** Table + selection + repair flow shared by Home and Issues. */
export function useFindings(findings: Finding[]) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<Issue | null>(null);
  useEffect(() => {
    if (findings.length === 0) { setSelectedKey(null); return; }
    if (!selectedKey || !findings.some((f) => f.key === selectedKey)) setSelectedKey(findings[0].key);
  }, [findings, selectedKey]);
  const selected = useMemo(() => findings.find((f) => f.key === selectedKey) ?? null, [findings, selectedKey]);
  return { selected, selectedKey, setSelectedKey, repairing, setRepairing };
}

export function useRepairActions(refresh: () => void) {
  const toast = useToast();
  const { navigate } = useNav();
  const applied = (tx: Transaction) => {
    const undoable = tx.operations.length > 0 && tx.operations.every((o) => o.kind === "file_write" || o.kind === "file_delete");
    toast.push({ title: "Repair applied", body: tx.title, tone: "green", action: undoable ? { label: "Undo", onClick: () => api.rollback(tx.id, false).then(() => { toast.push({ title: "Rollback complete", tone: "green" }); refresh(); }).catch((e) => toast.push({ title: "Could not roll back", body: errorMessage(e), tone: "red" })) } : undefined });
    refresh();
  };
  const ignore = (issue: Issue) => api.ignore(issue.id).then(() => { toast.push({ title: "Ignored", body: issue.title }); refresh(); }).catch((e) => toast.push({ title: "Could not ignore", body: errorMessage(e), tone: "red" }));
  const open = (issue: Issue) => navigate("issue", { issueId: issue.id });
  return { applied, ignore, open };
}

export function detectorName(detectors: DetectorMeta[], id: string): string | undefined {
  return detectors.find((d) => d.id === id)?.name;
}

export function filterByLevel(findings: Finding[], filter: ResultFilter): Finding[] {
  if (filter === "all") return findings;
  return findings.filter((f) => f.level === (filter as Level));
}
