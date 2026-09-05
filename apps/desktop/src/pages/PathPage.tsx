import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import { DataTable, ErrorBox, Loading, PageHeader, PathLink, Pill, Term } from "../components/Basics";

export function PathPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.pathReport(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="PATH" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const source = d.source.kind === "login_shell" ? `a fresh ${d.source.shell} login shell (${formatMs(d.capture_duration_ms)})` : d.source.kind === "process_environment" ? "DevDoctor's own environment (the login shell could not be started)" : d.source.kind === "registry" ? "the Windows registry (system PATH, then user PATH), what a new terminal sees" : "an override";
  return (
    <div className="page">
      <PageHeader title="PATH" subtitle={<>When you type a command, your terminal looks through these folders <b>in this order</b> and runs the first match. Captured from {source}. {d.duplicate_count} duplicate{d.duplicate_count === 1 ? "" : "s"}, {d.missing_count} missing folder{d.missing_count === 1 ? "" : "s"}. <Term k="PATH">What is PATH?</Term></>} />
      {d.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      <DataTable
        columns={[
          { key: "position", label: "#", width: "44px", className: "num", render: (e) => String(e.position) },
          { key: "raw", label: "Folder", render: (e) => <span className="mono selectable">{e.raw === "" ? <em>(empty)</em> : shortenHome(e.raw, home)}</span> },
          { key: "origin_label", label: "Comes from" },
          { key: "executables", label: "Commands", className: "num", render: (e) => (e.executables != null ? String(e.executables) : "") },
          { key: "status", label: "Status", render: (e) => (
            <span className="list-inline">
              {e.is_duplicate && <Pill tone="yellow">duplicate of #{e.duplicate_of}</Pill>}
              {!e.exists && e.raw !== "" && <Pill tone="orange">missing</Pill>}
              {e.suspicious && <Pill tone="red">{e.suspicious}</Pill>}
              {!e.is_duplicate && e.exists && !e.suspicious && <Pill tone="green">ok</Pill>}
            </span>
          ) },
          { key: "source", label: "Set by", render: (e) => (e.sources.length ? e.sources.map((s) => <div key={`${s.file}:${s.line}`}><PathLink path={s.file} line={s.line} />{s.conditional && <span className="muted small"> (only sometimes)</span>}</div>) : <span className="muted small">{e.source_hint ?? "unknown"}</span>) },
        ]}
        rows={d.entries}
        rowKey={(e) => String(e.position)}
      />
      <p className="muted small">Duplicates and missing folders that DevDoctor can fix safely appear under Issues. Nothing is removed from PATH without your confirmation.</p>
    </div>
  );
}
