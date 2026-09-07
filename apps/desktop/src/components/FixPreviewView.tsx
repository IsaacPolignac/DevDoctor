import type { FixPreview } from "../lib/types";
import { formatBytes, shortenHome } from "../lib/format";
import { useNav } from "../lib/nav";
import { DiffView } from "./DiffView";
import { Disclosure, Pill, usePrefs } from "./Basics";
import { Icon } from "./Icons";
import { t } from "../lib/i18n";

function localizedRiskLabel(risk: string): string {
  if (risk === "low") return t("Low risk");
  if (risk === "medium") return t("Medium risk");
  if (risk === "high") return t("High risk");
  return t("{risk} risk", { risk: risk.charAt(0).toUpperCase() + risk.slice(1) });
}

/** Everything the user must see before a fix is applied, plain words first. */
export function FixPreviewView({ preview, compact }: { preview: FixPreview; compact?: boolean }) {
  const { home } = useNav();
  const { technical } = usePrefs();
  const facts = (
    <div className="list-inline" style={{ margin: "10px 0" }}>
      <Pill tone={preview.reversible ? "green" : "orange"}><Icon name={preview.reversible ? "undo" : "alert"} size={11} />{preview.reversible ? t("Can be undone") : t("Cannot be undone")}</Pill>
      <Pill tone={preview.backup_created ? "green" : "gray"}><Icon name="shield" size={11} />{preview.backup_created ? t("Backup first") : t("No files changed")}</Pill>
      <Pill tone={preview.risk === "low" ? "green" : preview.risk === "medium" ? "orange" : "red"}>{localizedRiskLabel(preview.risk)}</Pill>
      {preview.estimated_disk_space_recovered > 0 && <Pill tone="blue">{t("Frees ")}{formatBytes(preview.estimated_disk_space_recovered)}</Pill>}
    </div>
  );
  const details = (
    <>
      {preview.operations.length > 0 && (
        <>
          <h3>{t("Step by step")}</h3>
          <ol className="section-list">{preview.operations.map((o, i) => <li key={i} className="mono selectable">{shortenHome(o, home)}</li>)}</ol>
        </>
      )}
      {preview.files_modified.map((f) => (
        <div key={f.path}>
          <h3>{t("Changes to ")}{shortenHome(f.path, home)}</h3>
          <DiffView diff={f.diff} />
        </div>
      ))}
      {preview.directories_deleted.length > 0 && (
        <>
          <h3>{t("Folders deleted")}</h3>
          <ul className="section-list">{preview.directories_deleted.map((d) => <li key={d.path} className="mono">{shortenHome(d.path, home)} — {formatBytes(d.bytes)}, {d.entries} {t(" items")}</li>)}</ul>
        </>
      )}
      {preview.commands_executed.length > 0 && (
        <>
          <h3>{t("Commands run")}</h3>
          <ul className="section-list">{preview.commands_executed.map((c, i) => <li key={i}><span className="mono">{c.program} {c.args.join(" ")}</span> — {c.description}</li>)}</ul>
        </>
      )}
      {preview.processes_stopped.length > 0 && (
        <>
          <h3>{t("Programs stopped")}</h3>
          <ul className="section-list">{preview.processes_stopped.map((p) => <li key={p.pid}>{p.name} {t(" (pid ")}{p.pid}) <span className="mono muted small">{p.command}</span></li>)}</ul>
        </>
      )}
      {preview.validations.length > 0 && (
        <>
          <h3>{t("Checked right after (undone automatically if a check fails)")}</h3>
          <ul className="section-list">{preview.validations.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </>
  );
  return (
    <div>
      {!compact && <p className="strong" style={{ fontSize: 14 }}>{preview.title}</p>}
      <p>{preview.summary}</p>
      {facts}
      {preview.notes.length > 0 && <ul className="section-list">{preview.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {technical ? details : <Disclosure label={t("Show exactly what changes")}>{details}</Disclosure>}
    </div>
  );
}
