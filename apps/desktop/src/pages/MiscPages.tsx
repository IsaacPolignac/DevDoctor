import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, formatDate, formatMs, shortenHome } from "../lib/format";
import { Button, Card, DataTable, ErrorBox, KeyValue, Loading, PageHeader, PathLink, Pill, Segmented, StatusPill, Switch, Term, usePrefs, type Appearance, type Glass } from "../components/Basics";
import { Logo } from "../components/Logo";
import { TransactionView } from "../components/TransactionView";

export function ServicesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.services(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="startup items" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const rows = r.data.filter((s) => s.origin !== "apple");
  return (
    <div className="page">
      <PageHeader title="Startup items" subtitle={<>Programs macOS starts for you at login, described by <Term k="launch agent">launch agents</Term>. Apple's own are hidden. Turning items off is not automated yet; issues list the exact command.</>} />
      <DataTable
        columns={[
          { key: "label", label: "Item", render: (s) => <><b>{s.label}</b><div className="muted small mono">{shortenHome(s.plist_path, home)}</div></> },
          { key: "origin", label: "From", render: (s) => ({ homebrew_services: "brew services", developer: "developer tool", third_party: "other app", apple: "Apple" } as Record<string, string>)[s.origin] ?? s.origin },
          { key: "login", label: "At login", render: (s) => (s.run_at_load ? <Pill tone="blue">yes</Pill> : <Pill>no</Pill>) },
          { key: "state", label: "Now", render: (s) => (s.running_pid ? <Pill tone="green">running · pid {s.running_pid}</Pill> : s.loaded === true ? <Pill>loaded</Pill> : s.loaded === false ? <Pill>not loaded</Pill> : <Pill>—</Pill>) },
          { key: "target", label: "Starts", render: (s) => (s.target_exists === false ? <Pill tone="red">missing: {s.program}</Pill> : <span className="mono selectable">{s.program ? shortenHome(s.program, home) : ""}</span>) },
          { key: "actions", label: "", render: (s) => <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(s.plist_path).catch(() => {})} /> },
        ]}
        rows={rows}
        rowKey={(s) => s.plist_path}
        empty="No third-party startup items."
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
    <div className="page">
      <PageHeader title="Developer tools" subtitle="AI coding agents, editors, containers and Git tooling found on this Mac, with how each was installed. Only local files are inspected; nothing is sent anywhere." actions={<label className="check small"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> measure disk usage</label>} />
      <DataTable
        columns={[
          { key: "name", label: "Tool", render: (t) => <b>{t.name}</b> },
          { key: "installed", label: "", render: (t) => (t.installed ? <Pill tone="green">installed</Pill> : <Pill>not found</Pill>) },
          { key: "version", label: "Version", render: (t) => t.version ?? "" },
          { key: "binary", label: "Location", render: (t) => <span className="mono selectable">{t.binary ? shortenHome(t.binary, home) : t.app_bundle ?? ""}</span> },
          { key: "install_method", label: "Installed by", render: (t) => t.install_method ?? "" },
          { key: "config", label: "Settings", render: (t) => t.config_paths.map((c) => <div key={c}><PathLink path={c} /></div>) },
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
  if (r.loading && !r.data) return <Loading what="Git settings" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const g = r.data;
  return (
    <div className="page">
      <PageHeader title="Git" subtitle="Your global Git identity and settings. Passwords and tokens are never read." />
      <div className="grid cols-2">
        <Card title="Global configuration">
          <KeyValue rows={[
            ["git", g.git ? <span className="mono selectable">{shortenHome(g.git.path, home)} · {g.git.version ?? ""}</span> : "not found"],
            ["GitHub CLI", g.gh ? <span className="mono selectable">{shortenHome(g.gh.path, home)} · {g.gh.version ?? ""}{g.gh_config_present ? " · signed in" : ""}</span> : "not found"],
            ["Config files", g.config_files.length ? g.config_files.map((f) => <div key={f}><PathLink path={f} /></div>) : "none"],
            ["Name", g.user_name ?? <Pill tone="orange">not set</Pill>], ["Email", g.user_email ?? <Pill tone="orange">not set</Pill>],
            ["Default branch", g.default_branch ?? "(not set — Git uses master)"],
            ["Credential helper", g.credential_helpers.join(", ") || "(none in global config)"],
            ["Commit signing", g.gpg_sign ? `on (${g.gpg_format ?? "gpg"})${g.signing_key ? ` · key ${g.signing_key}` : ""}` : "off"],
            ["Global ignore file", g.excludes_file ? <span className="mono">{shortenHome(g.excludes_file, home)}{g.excludes_file_exists ? "" : " (missing)"}</span> : "—"],
            ["Aliases", String(g.alias_count)], ["Conditional includes", g.include_ifs.join("; ") || "—"],
          ]} />
        </Card>
        <Card title="Findings">{g.findings.length === 0 ? <p className="muted">Nothing unusual.</p> : <ul className="section-list">{g.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
      </div>
    </div>
  );
}

export function SshPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.ssh(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="SSH information" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const s = r.data;
  return (
    <div className="page">
      <PageHeader title="SSH keys" subtitle="Key files, their permissions and your SSH configuration. DevDoctor never reads the contents of a private key." />
      <div className="grid cols-2">
        <Card title="Status">
          <KeyValue rows={[["~/.ssh folder", s.ssh_dir_exists ? `present (permissions ${s.ssh_dir_mode?.toString(8) ?? "?"})` : "missing"], ["Agent", `${s.agent_status.replace("_", " ")} · ${s.agent_identities} key${s.agent_identities === 1 ? "" : "s"} loaded`], ["Config", s.config_exists ? `${s.hosts.length} host entries` : "no ~/.ssh/config"], ["Known hosts", `${s.known_hosts_entries} entries`]]} />
        </Card>
        <Card title="Findings">{s.findings.length === 0 ? <p className="muted">Nothing unusual.</p> : <ul className="section-list">{s.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
      </div>
      <h2>Keys</h2>
      <DataTable columns={[{ key: "name", label: "Key", render: (k) => <span className="mono">{k.name}</span> }, { key: "key_type", label: "Type", render: (k) => k.key_type ?? "" }, { key: "comment", label: "Comment", render: (k) => k.comment ?? "" }, { key: "mode", label: "Permissions", render: (k) => (k.mode_ok ? <Pill tone="green">{k.mode.toString(8)} ok</Pill> : <Pill tone="red">{k.mode.toString(8)} too open</Pill>) }, { key: "pub", label: "Public key", render: (k) => (k.has_public_key ? "yes" : "no") }]} rows={s.keys} rowKey={(k) => k.path} empty="No private keys found in ~/.ssh." />
      <h2>Hosts</h2>
      <DataTable columns={[{ key: "patterns", label: "Host", render: (h) => h.patterns.join(" ") }, { key: "hostname", label: "Connects to", render: (h) => h.hostname ?? "" }, { key: "user", label: "User", render: (h) => h.user ?? "" }, { key: "identity", label: "Key", render: (h) => h.identity_files.map((f) => <div key={f}>{h.missing_identity_files.includes(f) ? <Pill tone="red">{shortenHome(f, home)} missing</Pill> : <span className="mono">{shortenHome(f, home)}</span>}</div>) }, { key: "line", label: "Line", className: "num", render: (h) => String(h.line) }]} rows={s.hosts} rowKey={(h) => `${h.line}`} empty="No host entries." />
    </div>
  );
}

export function HistoryPage({ refreshKey }: { refreshKey: number }) {
  const txs = useAsync(() => api.transactions(100), [refreshKey]);
  const scans = useAsync(() => api.scans(30), [refreshKey]);
  if ((txs.loading && !txs.data) || (scans.loading && !scans.data)) return <Loading what="history" />;
  return (
    <div className="page">
      <PageHeader title="Fixes & scans" subtitle={<>Everything DevDoctor changed on this Mac, as <Term k="transaction">transactions</Term> with their <Term k="backup">backups</Term>. Fixes that only edited files can be undone here.</>} />
      <ErrorBox error={txs.error} />
      {(txs.data ?? []).length === 0 && <Card><p className="muted">No fixes applied yet.</p></Card>}
      {(txs.data ?? []).map((t) => (
        <Card key={t.id} title={<span className="list-inline"><StatusPill status={t.status} /><span className="muted small">{formatDate(t.created_at)}</span><span className="mono faint tiny">{t.id}</span></span>}>
          <TransactionView tx={t} onChanged={txs.reload} />
        </Card>
      ))}
      <h2>Checks</h2>
      <ErrorBox error={scans.error} />
      <DataTable columns={[{ key: "started_at", label: "When", render: (s) => formatDate(s.started_at) }, { key: "mode", label: "Type", render: (s) => ({ quick: "quick", deep: "deep", storage: "disk space" } as Record<string, string>)[s.mode] ?? s.mode }, { key: "health_score", label: "Health", className: "num", render: (s) => (s.health_score != null ? String(s.health_score) : "") }, { key: "issue_count", label: "Issues", className: "num", render: (s) => String(s.issue_count) }, { key: "detectors", label: "Checks", render: (s) => `${s.detectors_run}${s.detectors_failed ? ` (${s.detectors_failed} failed)` : ""}` }, { key: "duration_ms", label: "Took", render: (s) => formatMs(s.duration_ms) }]} rows={scans.data ?? []} rowKey={(s) => s.id} empty="No checks yet." />
    </div>
  );
}

export function SettingsPage({ autoScan, onAutoScan }: { autoScan: boolean; onAutoScan: (v: boolean) => void }) {
  const { technical, setTechnical, appearance, setAppearance, glass, setGlass } = usePrefs();
  const sys = useAsync(() => api.system(), []);
  const detectors = useAsync(() => api.detectors(), []);
  const [report, setReport] = useState<string | null>(null);
  const [included, setIncluded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const exportReport = async () => {
    try { const r = await api.exportReport(); setIncluded(r.included); setReport(JSON.stringify(r, null, 2)); } catch (e) { setError(errorMessage(e)); }
  };
  return (
    <div className="page">
      <div className="grid cols-2">
        <Card title="Appearance">
          <div className="switch-row"><span>Theme<div className="secondary caption">Applies to the window, the sidebar glass and the title bar.</div></span><Segmented value={appearance} onChange={(v) => setAppearance(v as Appearance)} options={[{ id: "system", label: "System" }, { id: "light", label: "Day" }, { id: "dark", label: "Night" }]} /></div>
          <div className="hairline" />
          <div className="switch-row"><span>Liquid Glass<div className="secondary caption">Tinted adds a hint of the accent colour to glass controls.</div></span><Segmented value={glass} onChange={(v) => setGlass(v as Glass)} options={[{ id: "clear", label: "Clear" }, { id: "tinted", label: "Tinted" }]} /></div>
        </Card>
        <Card title="Preferences">
          <Switch on={autoScan} onChange={onAutoScan} label={<span>Check automatically when DevDoctor opens<div className="muted small">Runs a quick check if the last one is older than an hour.</div></span>} />
          <div className="hairline" />
          <Switch on={technical} onChange={setTechnical} label={<span>Show technical details<div className="muted small">Detector ids, raw severities, evidence and diffs shown by default.</div></span>} />
        </Card>
        <Card title="About">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><Logo size={48} /><div><div className="title3">DevDoctor</div><div className="secondary caption">Find what broke your development environment.</div></div></div>
          {sys.data && <KeyValue rows={[["Version", sys.data.devdoctor_version], ["Data folder", <span className="mono selectable">{sys.data.data_dir}</span>], ["User", sys.data.user], ["Shell", `${sys.data.shell} (${sys.data.shell_path})`], ["macOS", `${sys.data.os.version} ${sys.data.os.build ?? ""} · ${sys.data.os.arch}`]]} />}
          <p className="muted small" style={{ marginTop: 10 }}>Everything runs on this Mac. No account, no telemetry, no network. Backups of every modified file live in the data folder.</p>
        </Card>
      </div>
      <h2>Diagnostic report</h2>
      <Card>
        <p className="small">Create a report to share when asking for help. Home paths are shortened, your username is replaced and anything that looks like a secret is removed.</p>
        <Button icon="shield" onClick={exportReport}>Create report</Button>
        <ErrorBox error={error} />
        {report && (
          <>
            <p className="small">Included: {included.join("; ")}.</p>
            <textarea className="report selectable" readOnly value={report} />
            <Button size="small" onClick={() => navigator.clipboard.writeText(report).catch(() => {})}>Copy to clipboard</Button>
          </>
        )}
      </Card>
      <h2>Checks DevDoctor runs</h2>
      <DataTable columns={[{ key: "name", label: "Check", render: (d) => <><b>{d.name}</b>{technical && <div className="mono muted small">{d.id}</div>}</> }, { key: "category", label: "Area" }, { key: "modes", label: "Runs in", render: (d) => (d.modes.length ? d.modes.map((m) => ({ quick: "quick check", deep: "deep check", storage: "disk space check" } as Record<string, string>)[m]).join(", ") : "deep check only") }, { key: "description", label: "What it looks for" }]} rows={detectors.data ?? []} rowKey={(d) => d.id} />
    </div>
  );
}
