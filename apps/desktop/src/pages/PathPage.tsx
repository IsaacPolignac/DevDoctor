import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatMs, shortenHome } from "../lib/format";
import { DataTable, ErrorBox, Loading, PathLink } from "../components/Basics";

export function PathPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.pathReport(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="PATH" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const d = r.data;
  const source = d.source.kind === "login_shell" ? `fresh ${d.source.shell} login shell (${formatMs(d.capture_duration_ms)})` : d.source.kind === "process_environment" ? "DevDoctor process environment (login shell capture unavailable)" : "override";
  return (
    <div>
      <h1>PATH</h1>
      <p className="muted">{d.entries.length} entries from a {source} · {d.duplicate_count} duplicate(s) · {d.missing_count} missing</p>
      {d.warnings.map((w, i) => <div key={i} className="notice">{w}</div>)}
      <DataTable
        columns={[
          { key: "position", label: "#", width: "40px", className: "num", render: (e) => String(e.position) },
          { key: "raw", label: "Directory", render: (e) => <span className="mono">{e.raw === "" ? <em>(empty)</em> : shortenHome(e.raw, home)}</span> },
          { key: "origin_label", label: "Likely origin" },
          { key: "executables", label: "Exec", className: "num", render: (e) => (e.executables != null ? String(e.executables) : "") },
          { key: "status", label: "Status", render: (e) => (
            <span className="list-inline">
              {e.is_duplicate && <span className="badge low">duplicate of #{e.duplicate_of}</span>}
              {!e.exists && e.raw !== "" && <span className="badge medium">missing</span>}
              {e.suspicious && <span className="badge high">{e.suspicious}</span>}
              {e.writable === false && e.exists && <span className="badge info">read-only</span>}
            </span>
          ) },
          { key: "source", label: "Set by", render: (e) => (e.sources.length ? e.sources.map((s) => <div key={`${s.file}:${s.line}`}><PathLink path={s.file} line={s.line} /> <span className="muted small">{s.op}{s.conditional ? ", conditional" : ""}</span></div>) : <span className="muted small">{e.source_hint ?? "unknown"}</span>) },
        ]}
        rows={d.entries}
        rowKey={(e) => String(e.position)}
      />
      <p className="muted small">Duplicates and missing directories with a safe automatic fix appear under Problems. DevDoctor never removes PATH entries on its own.</p>
    </div>
  );
}
