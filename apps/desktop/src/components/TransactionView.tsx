import { useState } from "react";
import type { Operation, Transaction } from "../lib/types";
import { api, errorMessage } from "../lib/api";
import { useNav } from "../lib/nav";
import { formatBytes, shortenHome } from "../lib/format";
import { ConfirmDialog, ErrorBox } from "./Basics";

function describe(op: Operation, home: string): string {
  switch (op.kind) {
    case "file_write": return `${op.created ? "Created" : "Modified"} ${shortenHome(op.path, home)}${op.backup_id ? " (backup created)" : ""}`;
    case "file_delete": return `Deleted file ${shortenHome(op.path, home)} (backup created)`;
    case "dir_delete": return `Deleted ${shortenHome(op.path, home)} (${formatBytes(op.bytes)})`;
    case "process_stop": return `Stopped ${op.name} (pid ${op.pid})${op.force ? " with SIGKILL" : ""}`;
    case "command": return `Ran ${op.program} ${op.args.join(" ")} (exit ${op.exit_code ?? "?"})`;
  }
}

export function TransactionView({ tx, onChanged }: { tx: Transaction; onChanged?: () => void }) {
  const { home } = useNav();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reversible = tx.operations.length > 0 && tx.operations.every((o) => o.kind === "file_write" || o.kind === "file_delete");
  const canRollback = tx.status === "applied" && reversible;
  const rollback = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.rollback(tx.id, false);
      setConfirm(false);
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p><strong>{tx.title}</strong></p>
      <ul className="section-list">{tx.operations.map((o, i) => <li key={i}>{describe(o, home)}</li>)}</ul>
      {tx.validation && (
        <ul className="section-list">{tx.validation.checks.map((c, i) => <li key={i}><span className={`badge ${c.passed ? "ok" : "failed"}`}>{c.passed ? "ok" : "failed"}</span> {c.name}: <span className="muted">{shortenHome(c.detail, home)}</span></li>)}</ul>
      )}
      {tx.notes.map((n, i) => <p key={i} className="muted small">{n}</p>)}
      {tx.error && <div className="error">{tx.error}</div>}
      {tx.disk_space_recovered > 0 && <p className="small">Recovered {formatBytes(tx.disk_space_recovered)}.</p>}
      <ErrorBox error={error} />
      {canRollback && <button className="btn small" onClick={() => setConfirm(true)}>Restore previous state…</button>}
      {confirm && (
        <ConfirmDialog title="Restore files from backup?" confirmLabel="Restore" busy={busy} onConfirm={rollback} onCancel={() => setConfirm(false)}>
          <p>DevDoctor will put back the {tx.backups.length} file(s) it backed up before this fix:</p>
          <ul className="section-list">{tx.backups.map((b) => <li key={b.id} className="mono">{shortenHome(b.original_path, home)}</li>)}</ul>
          <p className="muted">If a file changed after the fix, the restore is refused; use the CLI with <span className="inline-code">devdoctor rollback {tx.id} --force</span> to override.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
