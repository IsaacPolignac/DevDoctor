import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import type { Transaction } from "../lib/types";
import { CATEGORY_PLAIN, plainFixLabel } from "../lib/plain";
import { formatDate, shortenHome } from "../lib/format";
import { Button, Card, ConfidencePill, ConfirmDialog, Disclosure, ErrorBox, KeyValue, Loading, PathLink, Pill, SeverityPill, StatusPill, usePrefs, useToast } from "./Basics";
import { FixPreviewView } from "./FixPreviewView";
import { TransactionView } from "./TransactionView";
import { Icon } from "./Icons";
import { t } from "../lib/i18n";

export function IssueDetailView({ issueId, onChanged }: { issueId: string; onChanged?: () => void }) {
  const { navigate, home } = useNav();
  const { technical } = usePrefs();
  const toast = useToast();
  const detail = useAsync(() => api.issue(issueId, true), [issueId]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (detail.loading) return <Loading what="issue" />;
  if (detail.error || !detail.data) return <ErrorBox error={detail.error ?? t("Issue not found")} />;
  const { record, preview, preview_error, fixer_name, transactions } = detail.data;
  const issue = record.issue;

  const apply = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const tx = await api.applyFix(issue.id);
      setResult(tx);
      setConfirming(false);
      toast.push({ title: t("Fixed"), body: tx.title, tone: "green", action: tx.operations.every((o) => o.kind === "file_write" || o.kind === "file_delete") ? { label: t("Undo"), onClick: () => api.rollback(tx.id, false).then(() => { toast.push({ title: t("Undone"), tone: "green" }); detail.reload(); onChanged?.(); }).catch((e) => toast.push({ title: t("Could not undo"), body: errorMessage(e), tone: "red" })) } : undefined });
      detail.reload();
      onChanged?.();
    } catch (e) {
      setActionError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };
  const toggleIgnore = async () => {
    try {
      if (record.ignored) await api.unignore(issue.id); else await api.ignore(issue.id);
      detail.reload();
      onChanged?.();
    } catch (e) { setActionError(errorMessage(e)); }
  };

  const technicalBlock = (
    <>
      {issue.evidence.length > 0 && (<><h3>{t("What DevDoctor observed")}</h3><ul className="section-list">{issue.evidence.map((e, i) => <li key={i} className="mono selectable">{shortenHome(e, home)}</li>)}</ul></>)}
      {issue.affected_files.length > 0 && (<><h3>{t("Files involved")}</h3><ul className="section-list">{issue.affected_files.map((f, i) => <li key={i}><PathLink path={f.path} line={f.line} />{f.excerpt && <div className="mono muted small selectable">{f.excerpt}</div>}</li>)}</ul></>)}
      {issue.current_state && (<><h3>{t("Current state")}</h3><pre className="selectable">{shortenHome(issue.current_state, home)}</pre></>)}
      {issue.technical_description && (<><h3>{t("Technical details")}</h3><pre className="selectable">{shortenHome(issue.technical_description, home)}</pre></>)}
      <h3>{t("Identity")}</h3>
      <KeyValue rows={[[t("Detector"), <span className="mono">{issue.detector_id}</span>], [t("Issue id"), <span className="mono">{issue.id}</span>], [t("First seen"), formatDate(record.first_seen_at)], [t("Last seen"), formatDate(record.last_seen_at)], [t("Automatic fix"), issue.fixer_available ? fixer_name ?? t("available") : t("not available")], [t("Can be undone"), issue.reversible ? t("yes") : t("no")], [t("Safe for batch fix"), issue.batch_safe ? t("yes") : t("no")]]} />
    </>
  );

  return (
    <div className="page">
      <div className="btn-row" style={{ margin: "8px 0 14px" }}>
        <Button variant="ghost" size="small" onClick={() => navigate("problems")}><Icon name="chevron" size={12} className="" /> {t(" Back to issues")}</Button>
      </div>
      <h1>{issue.title}</h1>
      <div className="list-inline" style={{ margin: "10px 0 18px" }}>
        <SeverityPill severity={issue.severity} />
        <ConfidencePill confidence={issue.confidence} />
        <Pill tone="gray">{t(CATEGORY_PLAIN[issue.category])}</Pill>
        {record.ignored && <Pill tone="gray">{t("ignored")}</Pill>}
        {record.resolved_at && <Pill tone="green">{t("resolved ")}{formatDate(record.resolved_at)}</Pill>}
      </div>
      <div className="grid cols-2">
        <Card title={t("What happened")}>
          <p>{issue.description}</p>
          {issue.impact && (<><h3>{t("Why it matters")}</h3><p>{issue.impact}</p></>)}
        </Card>
        <Card title={t("What to do")}>
          <p>{issue.recommended_action}</p>
          {issue.affected_commands.length > 0 && (
            <>
              <h3>{t("Commands involved")}</h3>
              <div className="list-inline">{issue.affected_commands.map((c) => <Button key={c} size="small" icon="search" onClick={() => navigate("resolve", { command: c })}>{c}</Button>)}</div>
            </>
          )}
        </Card>
      </div>

      <h2>{t("Fix")}</h2>
      <ErrorBox error={actionError} />
      {result && (
        <Card className="success-box" title={<><Icon name="check" size={16} /> {t(" Fixed")}</>}>
          <TransactionView tx={result} onChanged={() => { setResult(null); detail.reload(); onChanged?.(); }} />
        </Card>
      )}
      {!issue.fixer_available && !result && (
        <Card>
          <p><Icon name="info" size={14} /> {t(" This one needs a manual step. Follow \"What to do\" above; DevDoctor only automates changes it can preview, back up and verify.")}</p>
          <div className="btn-row" style={{ marginTop: 8 }}><Button size="small" onClick={toggleIgnore}>{record.ignored ? t("Stop ignoring") : t("Ignore this issue")}</Button></div>
        </Card>
      )}
      {preview_error && <div className="notice">{t("DevDoctor cannot apply the automatic fix right now: ")}{preview_error}</div>}
      {preview && !result && (
        <Card>
          <FixPreviewView preview={preview} />
          <div className="btn-row" style={{ marginTop: 14 }}>
            <Button variant="primary" icon="wrench" onClick={() => setConfirming(true)} disabled={record.resolved_at != null}>{plainFixLabel(preview.reversible, preview.batch_safe)}</Button>
            <Button onClick={toggleIgnore}>{record.ignored ? t("Stop ignoring") : t("Ignore")}</Button>
          </div>
        </Card>
      )}
      {confirming && preview && (
        <ConfirmDialog title={preview.title} confirmLabel={preview.reversible ? t("Apply fix") : t("Apply (cannot be undone)")} danger={!preview.reversible} busy={busy} onConfirm={apply} onCancel={() => setConfirming(false)}>
          <FixPreviewView preview={preview} compact />
        </ConfirmDialog>
      )}

      <h2>{t("Details")}</h2>
      {technical ? <Card>{technicalBlock}</Card> : <Card><Disclosure label={t("Show technical details")}>{technicalBlock}</Disclosure></Card>}

      {transactions.length > 0 && (
        <>
          <h2>{t("Fix history for this issue")}</h2>
          {transactions.map((t) => (
            <Card key={t.id} title={<span className="list-inline"><StatusPill status={t.status} /><span className="muted small">{formatDate(t.created_at)}</span></span>}>
              <TransactionView tx={t} onChanged={() => { detail.reload(); onChanged?.(); }} />
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
