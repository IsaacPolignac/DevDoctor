import type { Issue } from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";
import { useNav } from "../lib/nav";
import { ConfidenceBadge, DataTable, SeverityBadge } from "./Basics";

export function IssueList({ issues, empty }: { issues: Issue[]; empty?: string }) {
  const { navigate } = useNav();
  return (
    <DataTable
      columns={[
        { key: "severity", label: "Severity", width: "90px", render: (i) => <SeverityBadge severity={i.severity} /> },
        { key: "confidence", label: "Confidence", width: "100px", render: (i) => <ConfidenceBadge confidence={i.confidence} /> },
        { key: "category", label: "Category", width: "130px", render: (i) => CATEGORY_LABELS[i.category] },
        { key: "title", label: "Issue", render: (i) => <span>{i.title}</span> },
        { key: "fix", label: "Fix", width: "90px", render: (i) => (i.fixer_available ? <span className={`badge ${i.batch_safe ? "ok" : ""}`}>{i.batch_safe ? "safe fix" : "fix"}</span> : <span className="muted">manual</span>) },
      ]}
      rows={issues}
      rowKey={(i) => i.id}
      onRowClick={(i) => navigate("issue", { issueId: i.id })}
      empty={empty ?? "No issues."}
    />
  );
}
