import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, formatDate, formatMs, shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading, PathLink, StatusBadge } from "../components/Basics";
import { TransactionView } from "../components/TransactionView";

export function ServicesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.services(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="services" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const rows = r.data.filter((s) => s.origin !== "apple");
  return (
    <div>
      <h1>Startup services</h1>
      <p className="muted">Launch agents and Homebrew services. Apple's own agents are hidden. Disabling services is not automated in this version; the commands to do it are listed in the related issues.</p>
      <DataTable
        columns={[
          { key: "label", label: "Label", render: (s) => <><strong>{s.label}</strong><div className="muted small mono">{shortenHome(s.plist_path, home)}</div></> },
          { key: "origin", label: "Origin", render: (s) => s.origin.replace("_", " ") },
          { key: "kind", label: "Scope", render: (s) => s.kind.replace("_", " ") },
          { key: "login", label: "At login", render: (s) => (s.run_at_load ? "yes" : "no") },
          { key: "state", label: "State", render: (s) => (s.running_pid ? <span className="badge ok">running (pid {s.running_pid})</span> : s.loaded === true ? "loaded" : s.loaded === false ? "not loaded" : "—") },
          { key: "target", label: "Program", render: (s) => (s.target_exists === false ? <span className="badge high">missing: {s.program}</span> : <span className="mono">{s.program ? shortenHome(s.program, home) : ""}</span>) },
          { key: "actions", label: "", render: (s) => <button className="btn small" onClick={() => api.reveal(s.plist_path).catch(() => {})}>reveal</button> },
        ]}
        rows={rows}
        rowKey={(s) => s.plist_path}
        empty="No third-party launch agents or daemons."
      />
    </div>
  );
}

export function ToolsPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const [withSizes, setWithSizes] = useState(false);
  const r = useAsync(() => api.tools(withSizes), [refreshKey, withSizes]);
  if (r.loading && !r.data) return <Loading what="tools" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  return (
    <div>
      <h1>Developer tools</h1>
      <div className="filters"><label className="check"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> measure disk usage (slower)</label></div>
      <DataTable
        columns={[
          { key: "name", label: "Tool" },
          { key: "installed", label: "Status", render: (t) => (t.installed ? <span className="badge ok">installed</span> : <span className="muted">not found</span>) },
          { key: "version", label: "Version", render: (t) => t.version ?? "" },
          { key: "binary", label: "Location", render: (t) => <span className="mono">{t.binary ? shortenHome(t.binary, home) : t.app_bundle ?? ""}</span> },
          { key: "install_method", label: "Installed via", render: (t) => t.install_method ?? "" },
          { key: "config", label: "Configuration", render: (t) => t.config_paths.map((c) => <div key={c}><PathLink path={c} /></div>) },
          { key: "disk", label: "Disk", className: "num", render: (t) => (t.disk_usage != null ? formatBytes(t.disk_usage) : "") },
        ]}
        rows={r.data}
        rowKey={(t) => t.id}
      />
    </div>
  );
}

export function GitPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.git(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="git configuration" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const g = r.data;
  return (
    <div>
      <h1>Git</h1>
      <div className="grid cols-2">
        <Card title="Global configuration">
          <KeyValue rows={[
            ["git", g.git ? <span className="mono">{shortenHome(g.git.path, home)} — {g.git.version ?? ""}</span> : "not found"],
            ["GitHub CLI", g.gh ? <span className="mono">{shortenHome(g.gh.path, home)} — {g.gh.version ?? ""}{g.gh_config_present ? " (configured)" : ""}</span> : "not found"],
            ["Config files", g.config_files.length ? g.config_files.map((f) => <div key={f}><PathLink path={f} /></div>) : "none"],
            ["user.name", g.user_name ?? "(not set)"], ["user.email", g.user_email ?? "(not set)"],
            ["init.defaultBranch", g.default_branch ?? "(not set — git uses master)"],
            ["credential.helper", g.credential_helpers.join(", ") || "(none in global config)"],
            ["Commit signing", g.gpg_sign ? `enabled (${g.gpg_format ?? "gpg"})${g.signing_key ? ` — key ${g.signing_key}` : ""}` : "disabled"],
            ["core.excludesfile", g.excludes_file ? <span className="mono">{shortenHome(g.excludes_file, home)}{g.excludes_file_exists ? "" : " (missing)"}</span> : "—"],
            ["Aliases", String(g.alias_count)], ["includeIf", g.include_ifs.join("; ") || "—"],
          ]} />
        </Card>
        <Card title="Findings">{g.findings.length === 0 ? <p className="muted">Nothing unusual.</p> : <ul className="section-list">{g.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
      </div>
      <p className="muted small">Credentials and tokens are never read or displayed.</p>
    </div>
  );
}

export function SshPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.ssh(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="SSH metadata" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const s = r.data;
  return (
    <div>
      <h1>SSH</h1>
      <p className="muted">Metadata only: file names, permissions and configuration structure. Private key contents are never read.</p>
      <div className="grid cols-2">
        <Card title="Status">
          <KeyValue rows={[["~/.ssh", s.ssh_dir_exists ? `present (mode ${s.ssh_dir_mode?.toString(8) ?? "?"})` : "missing"], ["Agent", `${s.agent_status.replace("_", " ")} (${s.agent_identities} identities loaded)`], ["Config", s.config_exists ? `${s.hosts.length} host blocks (mode ${s.config_mode?.toString(8) ?? "?"})` : "no ~/.ssh/config"], ["known_hosts", `${s.known_hosts_entries} entries`]]} />
        </Card>
        <Card title="Findings">{s.findings.length === 0 ? <p className="muted">Nothing unusual.</p> : <ul className="section-list">{s.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
      </div>
      <h2>Keys</h2>
      <DataTable columns={[{ key: "name", label: "Key", render: (k) => <span className="mono">{k.name}</span> }, { key: "key_type", label: "Type", render: (k) => k.key_type ?? "" }, { key: "comment", label: "Comment", render: (k) => k.comment ?? "" }, { key: "mode", label: "Permissions", render: (k) => <span className={k.mode_ok ? "" : "badge high"}>{k.mode.toString(8)}{k.mode_ok ? "" : " (insecure)"}</span> }, { key: "pub", label: "Public key", render: (k) => (k.has_public_key ? "yes" : "no") }]} rows={s.keys} rowKey={(k) => k.path} empty="No private keys found in ~/.ssh." />
      <h2>Hosts</h2>
      <DataTable columns={[{ key: "patterns", label: "Host", render: (h) => h.patterns.join(" ") }, { key: "hostname", label: "HostName", render: (h) => h.hostname ?? "" }, { key: "user", label: "User", render: (h) => h.user ?? "" }, { key: "identity", label: "IdentityFile", render: (h) => h.identity_files.map((f) => <div key={f} className={`mono ${h.missing_identity_files.includes(f) ? "badge high" : ""}`}>{shortenHome(f, home)}</div>) }, { key: "line", label: "Line", className: "num", render: (h) => String(h.line) }]} rows={s.hosts} rowKey={(h) => `${h.line}`} empty="No host blocks." />
    </div>
  );
}

export function HistoryPage({ refreshKey }: { refreshKey: number }) {
  const txs = useAsync(() => api.transactions(100), [refreshKey]);
  const scans = useAsync(() => api.scans(30), [refreshKey]);
  if ((txs.loading && !txs.data) || (scans.loading && !scans.data)) return <Loading what="history" />;
  return (
    <div>
      <h1>Fix history</h1>
      <ErrorBox error={txs.error} />
      {(txs.data ?? []).length === 0 && <Card><p className="muted">No fixes applied yet. Every fix is recorded here with its backups and can be undone when reversible.</p></Card>}
      {(txs.data ?? []).map((t) => (
        <Card key={t.id}>
          <div className="list-inline" style={{ marginBottom: 6 }}><StatusBadge status={t.status} /><span className="muted">{formatDate(t.created_at)}</span><span className="mono muted small">{t.id}</span></div>
          <TransactionView tx={t} onChanged={txs.reload} />
        </Card>
      ))}
      <h2>Scans</h2>
      <ErrorBox error={scans.error} />
      <DataTable columns={[{ key: "started_at", label: "When", render: (s) => formatDate(s.started_at) }, { key: "mode", label: "Mode" }, { key: "health_score", label: "Health", className: "num", render: (s) => (s.health_score != null ? String(s.health_score) : "") }, { key: "issue_count", label: "Issues", className: "num", render: (s) => String(s.issue_count) }, { key: "detectors", label: "Detectors", render: (s) => `${s.detectors_run}${s.detectors_failed ? ` (${s.detectors_failed} failed)` : ""}` }, { key: "duration_ms", label: "Duration", render: (s) => formatMs(s.duration_ms) }]} rows={scans.data ?? []} rowKey={(s) => s.id} empty="No scans yet." />
    </div>
  );
}

export function SettingsPage() {
  const sys = useAsync(() => api.system(), []);
  const detectors = useAsync(() => api.detectors(), []);
  const [report, setReport] = useState<string | null>(null);
  const [included, setIncluded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const exportReport = async () => {
    try {
      const r = await api.exportReport();
      setIncluded(r.included);
      setReport(JSON.stringify(r, null, 2));
    } catch (e) { setError(errorMessage(e)); }
  };
  return (
    <div>
      <h1>Settings</h1>
      <div className="grid cols-2">
        <Card title="About">
          {sys.data && <KeyValue rows={[["Version", sys.data.devdoctor_version], ["Data directory", <span className="mono">{sys.data.data_dir}</span>], ["User", sys.data.user], ["Shell", `${sys.data.shell} (${sys.data.shell_path})`], ["macOS", `${sys.data.os.version} ${sys.data.os.build ?? ""} (${sys.data.os.arch})`]]} />}
          <p className="muted small" style={{ marginTop: 10 }}>Everything runs locally. No account, no telemetry, no network access. Backups of every modified file are stored in the data directory.</p>
        </Card>
        <Card title="Diagnostic report">
          <p className="small">Export a sanitized JSON report (home paths shortened, username replaced, likely secrets redacted) to share when asking for help.</p>
          <button className="btn" onClick={exportReport}>Generate report</button>
          <ErrorBox error={error} />
          {report && (
            <>
              <p className="small">Included: {included.join("; ")}.</p>
              <textarea className="report" readOnly value={report} />
              <button className="btn small" onClick={() => navigator.clipboard.writeText(report).catch(() => {})}>Copy to clipboard</button>
            </>
          )}
        </Card>
      </div>
      <h2>Detectors</h2>
      <DataTable columns={[{ key: "id", label: "Id", render: (d) => <span className="mono">{d.id}</span> }, { key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "modes", label: "Runs in", render: (d) => (d.modes.length ? d.modes.join(", ") : "deep only") }, { key: "description", label: "Description" }]} rows={detectors.data ?? []} rowKey={(d) => d.id} />
    </div>
  );
}
