import { useState } from "react";
import type { Operation, Transaction } from "../lib/types";
import { api, errorMessage } from "../lib/api";
import { useNav } from "../lib/nav";
import { formatBytes, shortenHome } from "../lib/format";
import { Button, ConfirmDialog, ErrorBox, Pill, useToast } from "./Basics";
import { t } from "../lib/i18n";

function describe(op: Operation, home: string): string {
  switch (op.kind) {
    case "file_write": return `${op.created ? t("Created") : t("Edited")} ${shortenHome(op.path, home)}${op.backup_id ? t(" (backup kept)") : ""}`;
    case "file_delete": return t("Deleted file {path} (backup kept)", { path: shortenHome(op.path, home) });
    case "dir_delete": return t("Deleted {path} ({size})", { path: shortenHome(op.path, home), size: formatBytes(op.bytes) });
    case "process_stop": return t("Stopped {name} (pid {pid})", { name: op.name, pid: op.pid }) + (op.force ? t(" forcefully") : "");
    case "command": return t("Ran {command} (exit {code})", { command: `${op.program} ${op.args.join(" ")}`, code: op.exit_code ?? "?" });
    case "symlink_delete": return `Removed broken link ${shortenHome(op.path, home)} (pointed to ${shortenHome(op.target, home)})`;
  }
}

export function TransactionView({ tx, onChanged }: { tx: Transaction; onChanged?: () => void }) {
  const { home } = useNav();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reversible = tx.operations.length > 0 && tx.operations.every((o) => o.kind === "file_write" || o.kind === "file_delete" || o.kind === "symlink_delete");
  const canRollback = tx.status === "applied" && reversible;
  const rollback = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.rollback(tx.id, false);
      setConfirm(false);
      toast.push({ title: t("Previous state restored"), body: tx.title, tone: "green" });
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="strong">{tx.title}</p>
      <ul className="section-list">{tx.operations.map((o, i) => <li key={i}>{describe(o, home)}</li>)}</ul>
      {tx.validation && (
        <ul className="section-list">{tx.validation.checks.map((c, i) => <li key={i}><Pill tone={c.passed ? "green" : "red"}>{c.passed ? t("ok") : t("failed")}</Pill> {c.name} <span className="muted">— {shortenHome(c.detail, home)}</span></li>)}</ul>
      )}
      {tx.notes.map((n, i) => <p key={i} className="muted small">{n}</p>)}
      {tx.error && <div className="error">{tx.error}</div>}
      {tx.disk_space_recovered > 0 && <p className="small">{t("Freed ")}{formatBytes(tx.disk_space_recovered)}.</p>}
      <ErrorBox error={error} />
      {canRollback && <Button size="small" icon="undo" onClick={() => setConfirm(true)}>{t("Undo this fix")}</Button>}
      {confirm && (
        <ConfirmDialog title={t("Undo this fix?")} confirmLabel="Restore files" busy={busy} onConfirm={rollback} onCancel={() => setConfirm(false)}>
          {tx.backups.length > 0 && <><p>{t("DevDoctor puts back the ")}{tx.backups.length} {t(" file(s) it saved before this fix:")}</p>
          <ul className="section-list">{tx.backups.map((b) => <li key={b.id} className="mono">{shortenHome(b.original_path, home)}</li>)}</ul></>}
          {tx.operations.some((o) => o.kind === "symlink_delete") && <p>{t("The removed links are recreated with their original targets.")}</p>}
          <p className="muted small">{t("If a file changed after the fix, the restore is refused to protect your edits; the CLI can force it with ")}<span className="inline-code">devdoctor rollback {tx.id} --force</span>.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
