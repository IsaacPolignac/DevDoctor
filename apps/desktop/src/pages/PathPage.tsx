import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import { DataTable, ErrorBox, Loading, PageHeader, PathLink, Pill, Term } from "../components/Basics";
import { t } from "../lib/i18n";

export function PathPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.pathReport(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="PATH" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const source = d.source.kind === "login_shell" ? t("a fresh {shell} login shell ({duration})", { shell: d.source.shell, duration: formatMs(d.capture_duration_ms) }) : d.source.kind === "process_environment" ? t("DevDoctor's own environment (the login shell could not be started)") : d.source.kind === "registry" ? t("the Windows registry (system PATH, then user PATH), what a new terminal sees") : t("an override");
  return (
    <div className="page">
      <PageHeader title={t("PATH")} subtitle={<>{t("When you type a command, your terminal looks through these folders ")}<b>{t("in this order")}</b> {t(" and runs the first match. Captured from ")}{source}. {d.duplicate_count} {t(" duplicate")}{d.duplicate_count === 1 ? "" : "s"}, {d.missing_count} {t(" missing folder")}{d.missing_count === 1 ? "" : "s"}. <Term k="PATH">{t("What is PATH?")}</Term></>} />
      {d.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      <DataTable
        columns={[
          { key: "position", label: "#", width: "44px", className: "num", render: (e) => String(e.position) },
          { key: "raw", label: t("Folder"), render: (e) => <span className="mono selectable">{e.raw === "" ? <em>{t("(empty)")}</em> : shortenHome(e.raw, home)}</span> },
          { key: "origin_label", label: t("Comes from") },
          { key: "executables", label: t("Commands"), className: "num", render: (e) => (e.executables != null ? String(e.executables) : "") },
          { key: "status", label: t("Status"), render: (e) => (
            <span className="list-inline">
              {e.is_duplicate && <Pill tone="yellow">{t("duplicate of #")}{e.duplicate_of}</Pill>}
              {!e.exists && e.raw !== "" && <Pill tone="orange">{t("missing")}</Pill>}
              {e.suspicious && <Pill tone="red">{e.suspicious}</Pill>}
              {!e.is_duplicate && e.exists && !e.suspicious && <Pill tone="green">{t("ok")}</Pill>}
            </span>
          ) },
          { key: "source", label: t("Set by"), render: (e) => (e.sources.length ? e.sources.map((s) => <div key={`${s.file}:${s.line}`}><PathLink path={s.file} line={s.line} />{s.conditional && <span className="muted small"> {t(" (only sometimes)")}</span>}</div>) : <span className="muted small">{e.source_hint ?? t("unknown")}</span>) },
        ]}
        rows={d.entries}
        rowKey={(e) => String(e.position)}
      />
      <p className="muted small">{t("Duplicates and missing folders that DevDoctor can fix safely appear under Issues. Nothing is removed from PATH without your confirmation.")}</p>
    </div>
  );
}
