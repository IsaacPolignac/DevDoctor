import type { Issue } from "../lib/types";
import { CATEGORY_PLAIN, SEVERITY_PLAIN, plainFixLabel } from "../lib/plain";
import { useNav } from "../lib/nav";
import { Button, ConfidencePill, Pill, SeverityPill, usePrefs } from "./Basics";
import { Icon } from "./Icons";

export function IssueCard({ issue, onFix }: { issue: Issue; onFix?: (issue: Issue) => void }) {
  const { navigate } = useNav();
  const { technical } = usePrefs();
  const tone = SEVERITY_PLAIN[issue.severity].tone;
  return (
    <div className="issue-card glass" onClick={() => navigate("issue", { issueId: issue.id })}>
      <div className={`bar ${tone}`} />
      <div style={{ minWidth: 0 }}>
        <div className="title">{issue.title}</div>
        <div className="desc truncate" title={issue.description}>{issue.description}</div>
        <div className="meta">
          <SeverityPill severity={issue.severity} />
          <ConfidencePill confidence={issue.confidence} />
          <Pill tone="gray">{CATEGORY_PLAIN[issue.category]}</Pill>
          {technical && <Pill tone="gray"><span className="mono">{issue.detector_id}</span></Pill>}
          {issue.fixer_available && issue.reversible && <Pill tone="green"><Icon name="undo" size={11} />can be undone</Pill>}
        </div>
      </div>
      <div className="btn-row" onClick={(e) => e.stopPropagation()}>
        {issue.fixer_available ? (
          <Button variant={issue.batch_safe ? "primary" : "default"} size="small" icon={issue.batch_safe ? "check" : "wrench"} onClick={() => (onFix ? onFix(issue) : navigate("issue", { issueId: issue.id }))}>{plainFixLabel(issue.reversible, issue.batch_safe)}</Button>
        ) : (
          <Button size="small" onClick={() => navigate("issue", { issueId: issue.id })}>Details</Button>
        )}
        <Icon name="chevron" size={14} className="faint" />
      </div>
    </div>
  );
}

export function IssueCardList({ issues, empty, onFix }: { issues: Issue[]; empty?: string; onFix?: (issue: Issue) => void }) {
  if (issues.length === 0) return <div className="empty">{empty ?? "Nothing here."}</div>;
  return <div>{issues.map((i) => <IssueCard key={i.id} issue={i} onFix={onFix} />)}</div>;
}
