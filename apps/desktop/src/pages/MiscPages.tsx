import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, formatDate, formatMs, shortenHome } from "../lib/format";
import type { FixPreview } from "../lib/types";
import { Button, Card, ConfirmDialog, DataTable, ErrorBox, KeyValue, Loading, PageHeader, PathLink, Pill, Segmented, StatusPill, Switch, Term, usePrefs, useToast, type Appearance, type Glass } from "../components/Basics";
import { Logo } from "../components/Logo";
import { TransactionView } from "../components/TransactionView";
import { LANGUAGES, languageChoice, setLanguage, t, type Language } from "../lib/i18n";

export function ServicesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.services(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="startup items" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const rows = r.data.filter((s) => s.origin !== "apple");
  return (
    <div className="page">
      <PageHeader title={t("Startup items")} subtitle={<>{t("Programs macOS starts for you at login, described by ")}<Term k="launch agent">{t("launch agents")}</Term>{t(". Apple's own are hidden. Turning items off is not automated yet; issues list the exact command.")}</>} />
      <DataTable
        columns={[
          { key: "label", label: t("Item"), render: (s) => <><b>{s.label}</b><div className="muted small mono">{shortenHome(s.plist_path, home)}</div></> },
          { key: "origin", label: t("From"), render: (s) => ({ homebrew_services: "brew services", developer: "developer tool", third_party: "other app", apple: "Apple" } as Record<string, string>)[s.origin] ?? s.origin },
          { key: "login", label: t("At login"), render: (s) => (s.run_at_load ? <Pill tone="blue">{t("yes")}</Pill> : <Pill>{t("no")}</Pill>) },
          { key: "state", label: t("Now"), render: (s) => (s.running_pid ? <Pill tone="green">{t("running · pid ")}{s.running_pid}</Pill> : s.loaded === true ? <Pill>{t("loaded")}</Pill> : s.loaded === false ? <Pill>{t("not loaded")}</Pill> : <Pill>—</Pill>) },
          { key: "target", label: t("Starts"), render: (s) => (s.target_exists === false ? <Pill tone="red">{t("missing: ")}{s.program}</Pill> : <span className="mono selectable">{s.program ? shortenHome(s.program, home) : ""}</span>) },
          { key: "actions", label: "", render: (s) => <Button size="small" variant="ghost" icon="folder" onClick={() => api.reveal(s.plist_path).catch(() => {})} /> },
        ]}
        rows={rows}
        rowKey={(s) => s.plist_path}
        empty={t("No third-party startup items.")}
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
      <PageHeader title={t("Developer tools")} subtitle={t("AI coding agents, editors, containers and Git tooling found on this Mac, with how each was installed. Only local files are inspected; nothing is sent anywhere.")} actions={<label className="check small"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> {t(" measure disk usage")}</label>} />
      <DataTable
        columns={[
          { key: "name", label: t("Tool"), render: (t) => <b>{t.name}</b> },
          { key: "installed", label: "", render: (tool) => (tool.installed ? <Pill tone="green">{t("installed")}</Pill> : <Pill>{t("not found")}</Pill>) },
          { key: "version", label: t("Version"), render: (t) => t.version ?? "" },
          { key: "binary", label: t("Location"), render: (t) => <span className="mono selectable">{t.binary ? shortenHome(t.binary, home) : t.app_bundle ?? ""}</span> },
          { key: "install_method", label: t("Installed by"), render: (t) => t.install_method ?? "" },
          { key: "config", label: t("Settings"), render: (t) => t.config_paths.map((c) => <div key={c}><PathLink path={c} /></div>) },
          { key: "disk", label: t("Disk"), className: "num", render: (t) => (t.disk_usage != null ? formatBytes(t.disk_usage) : "") },
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
      <PageHeader title={t("Git")} subtitle={t("Your global Git identity and settings. Passwords and tokens are never read.")} />
      <div className="grid cols-2">
        <Card title={t("Global configuration")}>
          <KeyValue rows={[
            ["git", g.git ? <span className="mono selectable">{shortenHome(g.git.path, home)} · {g.git.version ?? ""}</span> : t("not found")],
            [t("GitHub CLI"), g.gh ? <span className="mono selectable">{shortenHome(g.gh.path, home)} · {g.gh.version ?? ""}{g.gh_config_present ? t(" · signed in") : ""}</span> : t("not found")],
            [t("Config files"), g.config_files.length ? g.config_files.map((f) => <div key={f}><PathLink path={f} /></div>) : "none"],
            [t("Name"), g.user_name ?? <Pill tone="orange">{t("not set")}</Pill>], [t("Email"), g.user_email ?? <Pill tone="orange">{t("not set")}</Pill>],
            [t("Default branch"), g.default_branch ?? t("(not set — Git uses master)")],
            [t("Credential helper"), g.credential_helpers.join(", ") || t("(none in global config)")],
            [t("Commit signing"), g.gpg_sign ? `on (${g.gpg_format ?? "gpg"})${g.signing_key ? ` · key ${g.signing_key}` : ""}` : "off"],
            [t("Global ignore file"), g.excludes_file ? <span className="mono">{shortenHome(g.excludes_file, home)}{g.excludes_file_exists ? "" : t(" (missing)")}</span> : "—"],
            [t("Aliases"), String(g.alias_count)], [t("Conditional includes"), g.include_ifs.join("; ") || "—"],
          ]} />
        </Card>
        <Card title={t("Findings")}>{g.findings.length === 0 ? <p className="muted">{t("Nothing unusual.")}</p> : <ul className="section-list">{g.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
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
      <PageHeader title={t("SSH keys")} subtitle={t("Key files, their permissions and your SSH configuration. DevDoctor never reads the contents of a private key.")} />
      <div className="grid cols-2">
        <Card title={t("Status")}>
          <KeyValue rows={[[t("~/.ssh folder"), s.ssh_dir_exists ? t("present (permissions {mode})", { mode: s.ssh_dir_mode?.toString(8) ?? "?" }) : t("missing")], [t("Agent"), `${t(s.agent_status.replace("_", " "))} · ${s.agent_identities === 1 ? t("1 key loaded") : t("{n} keys loaded", { n: s.agent_identities })}`], [t("Config"), s.config_exists ? `${s.hosts.length} host entries` : t("no ~/.ssh/config")], [t("Known hosts"), `${s.known_hosts_entries} entries`]]} />
        </Card>
        <Card title={t("Findings")}>{s.findings.length === 0 ? <p className="muted">{t("Nothing unusual.")}</p> : <ul className="section-list">{s.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}</Card>
      </div>
      <h2>{t("Keys")}</h2>
      <DataTable columns={[{ key: "name", label: t("Key"), render: (k) => <span className="mono">{k.name}</span> }, { key: "key_type", label: t("Type"), render: (k) => k.key_type ?? "" }, { key: "comment", label: t("Comment"), render: (k) => k.comment ?? "" }, { key: "mode", label: t("Permissions"), render: (k) => (k.mode_ok ? <Pill tone="green">{k.mode.toString(8)} {t(" ok")}</Pill> : <Pill tone="red">{k.mode.toString(8)} {t(" too open")}</Pill>) }, { key: "pub", label: t("Public key"), render: (k) => (k.has_public_key ? "yes" : "no") }]} rows={s.keys} rowKey={(k) => k.path} empty={t("No private keys found in ~/.ssh.")} />
      <h2>{t("Hosts")}</h2>
      <DataTable columns={[{ key: "patterns", label: t("Host"), render: (h) => h.patterns.join(" ") }, { key: "hostname", label: t("Connects to"), render: (h) => h.hostname ?? "" }, { key: "user", label: t("User"), render: (h) => h.user ?? "" }, { key: "identity", label: t("Key"), render: (h) => h.identity_files.map((f) => <div key={f}>{h.missing_identity_files.includes(f) ? <Pill tone="red">{shortenHome(f, home)} {t(" missing")}</Pill> : <span className="mono">{shortenHome(f, home)}</span>}</div>) }, { key: "line", label: t("Line"), className: "num", render: (h) => String(h.line) }]} rows={s.hosts} rowKey={(h) => `${h.line}`} empty={t("No host entries.")} />
    </div>
  );
}

export function HistoryPage({ refreshKey }: { refreshKey: number }) {
  const txs = useAsync(() => api.transactions(100), [refreshKey]);
  const scans = useAsync(() => api.scans(30), [refreshKey]);
  if ((txs.loading && !txs.data) || (scans.loading && !scans.data)) return <Loading what="history" />;
  return (
    <div className="page">
      <PageHeader title={t("Fixes & scans")} subtitle={<>{t("Everything DevDoctor changed on this Mac, as ")}<Term k="transaction">{t("transactions")}</Term> {t(" with their ")}<Term k="backup">{t("backups")}</Term>{t(". Fixes that only edited files can be undone here.")}</>} />
      <ErrorBox error={txs.error} />
      {(txs.data ?? []).length === 0 && <Card><p className="muted">{t("No fixes applied yet.")}</p></Card>}
      {(txs.data ?? []).map((t) => (
        <Card key={t.id} title={<span className="list-inline"><StatusPill status={t.status} /><span className="muted small">{formatDate(t.created_at)}</span><span className="mono faint tiny">{t.id}</span></span>}>
          <TransactionView tx={t} onChanged={txs.reload} />
        </Card>
      ))}
      <h2>{t("Checks")}</h2>
      <ErrorBox error={scans.error} />
      <DataTable columns={[{ key: "started_at", label: t("When"), render: (s) => formatDate(s.started_at) }, { key: "mode", label: t("Type"), render: (s) => ({ quick: "quick", deep: "deep", storage: "disk space" } as Record<string, string>)[s.mode] ?? s.mode }, { key: "health_score", label: t("Health"), className: "num", render: (s) => (s.health_score != null ? String(s.health_score) : "") }, { key: "issue_count", label: t("Issues"), className: "num", render: (s) => String(s.issue_count) }, { key: "detectors", label: t("Checks"), render: (s) => `${s.detectors_run}${s.detectors_failed ? ` (${s.detectors_failed} failed)` : ""}` }, { key: "duration_ms", label: t("Took"), render: (s) => formatMs(s.duration_ms) }]} rows={scans.data ?? []} rowKey={(s) => s.id} empty={t("No checks yet.")} />
    </div>
  );
}

function DailySnapshotCard() {
  const toast = useToast();
  const sched = useAsync(() => api.snapshotSchedule(), []);
  const [hour, setHour] = useState(12);
  const [dialog, setDialog] = useState<"on" | "off" | null>(null);
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = sched.data;
  const open = async (mode: "on" | "off") => {
    setError(null);
    try { setPreview(mode === "on" ? await api.previewScheduleSnapshots(hour, 0) : await api.previewUnscheduleSnapshots()); setDialog(mode); } catch (e) { setError(errorMessage(e)); }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      if (dialog === "on") await api.scheduleSnapshots(hour, 0); else await api.unscheduleSnapshots();
      toast.push({ title: dialog === "on" ? t("Daily snapshots scheduled") : t("Daily snapshots stopped"), tone: "green" });
      setDialog(null); sched.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const two = (n?: number) => String(n ?? 0).padStart(2, "0");
  return (
    <Card title={t("Daily snapshot")}>
      <p className="small">{t("\"What changed since yesterday\" needs a ")}<Term k="snapshot">{t("snapshot")}</Term> {t(" from yesterday. macOS can take one for you every day: a user ")}<Term k="launch agent">{t("launch agent")}</Term> {t(" runs the DevDoctor command line tool for about a second. No password, metadata only.")}</p>
      {s && (
        <>
          <div className="switch-row">
            <span>{t("Take a snapshot every day")}{s.installed && <div className="muted small">{t("At ")}{two(s.hour)}:{two(s.minute)} · {s.loaded ? t("active") : t("not loaded yet")}{s.last_run ? t(" · last run {date}", { date: formatDate(s.last_run) }) : ""}</div>}</span>
            <Switch on={s.installed} onChange={(v) => open(v ? "on" : "off")} />
          </div>
          {!s.installed && (
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="small">{t("Time of day")}</span>
              <select className="text" value={hour} onChange={(e) => setHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{two(h)}:00</option>)}</select>
              {!s.available_program && <span className="muted small">{t("The ")}<span className="inline-code">{t("devdoctor")}</span> {t(" command line tool was not found in PATH; install it first (see the README).")}</span>}
            </div>
          )}
          {s.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
        </>
      )}
      <ErrorBox error={sched.error ?? error} />
      {dialog && preview && (
        <ConfirmDialog title={preview.title} confirmLabel={dialog === "on" ? t("Schedule") : t("Stop")} busy={busy} onConfirm={confirm} onCancel={() => setDialog(null)}>
          <p>{preview.summary}</p>
          <ul className="section-list">{preview.operations.map((o, i) => <li key={i} className="mono small">{o}</li>)}</ul>
          {preview.notes.map((n, i) => <p key={i} className="muted small">{n}</p>)}
        </ConfirmDialog>
      )}
    </Card>
  );
}

export function SettingsPage({ autoScan, onAutoScan }: { autoScan: boolean; onAutoScan: (v: boolean) => void }) {
  const { technical, setTechnical, appearance, setAppearance, glass, setGlass } = usePrefs();
  const sys = useAsync(() => api.system(), []);
  const detectors = useAsync(() => api.detectors(), []);
  const [report, setReport] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [included, setIncluded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const exportReport = async () => {
    try { const r = await api.exportReport(); setIncluded(r.included); setMarkdown(null); setReport(JSON.stringify(r, null, 2)); } catch (e) { setError(errorMessage(e)); }
  };
  const exportMarkdown = async () => {
    try { const md = await api.exportMarkdownReport(); setReport(null); setMarkdown(md); } catch (e) { setError(errorMessage(e)); }
  };
  return (
    <div className="page">
      <div className="grid cols-2">
        <Card title={t("Language")}>
          <div className="switch-row"><span>{t("Interface language")}<div className="secondary caption">{t("System follows your OS languages. Findings and explanations produced by the diagnostic engine are shown in English in this version.")}</div></span><Segmented value={languageChoice} onChange={(v) => setLanguage(v as Language, (lang) => api.setSetting("language", lang))} options={LANGUAGES.map((l) => (l.id === "system" ? { ...l, label: t("System") } : l))} /></div>
        </Card>
        <Card title={t("Appearance")}>
          <div className="switch-row"><span>{t("Theme")}<div className="secondary caption">{t("Applies to the window, the sidebar glass and the title bar.")}</div></span><Segmented value={appearance} onChange={(v) => setAppearance(v as Appearance)} options={[{ id: "system", label: t("System") }, { id: "light", label: t("Day") }, { id: "dark", label: t("Night") }]} /></div>
          <div className="hairline" />
          <div className="switch-row"><span>{t("Liquid Glass")}<div className="secondary caption">{t("Tinted adds a hint of the accent colour to glass controls.")}</div></span><Segmented value={glass} onChange={(v) => setGlass(v as Glass)} options={[{ id: "clear", label: t("Clear") }, { id: "tinted", label: t("Tinted") }]} /></div>
        </Card>
        <Card title={t("Preferences")}>
          <Switch on={autoScan} onChange={onAutoScan} label={<span>{t("Check automatically when DevDoctor opens")}<div className="muted small">{t("Runs a quick check if the last one is older than an hour.")}</div></span>} />
          <div className="hairline" />
          <Switch on={technical} onChange={setTechnical} label={<span>{t("Show technical details")}<div className="muted small">{t("Detector ids, raw severities, evidence and diffs shown by default.")}</div></span>} />
        </Card>
        <DailySnapshotCard />
        <Card title={t("About")}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}><Logo size={48} /><div><div className="title3">{t("DevDoctor")}</div><div className="secondary caption">{t("Find what broke your development environment.")}</div></div></div>
          {sys.data && <KeyValue rows={[[t("Version"), sys.data.devdoctor_version], [t("Data folder"), <span className="mono selectable">{sys.data.data_dir}</span>], [t("User"), sys.data.user], [t("Shell"), `${sys.data.shell} (${sys.data.shell_path})`], ["macOS", `${sys.data.os.version} ${sys.data.os.build ?? ""} · ${sys.data.os.arch}`]]} />}
          <p className="muted small" style={{ marginTop: 10 }}>{t("Everything runs on this Mac. No account, no telemetry, no network. Backups of every modified file live in the data folder.")}</p>
        </Card>
      </div>
      <h2>{t("Diagnostic report")}</h2>
      <Card>
        <p className="small">{t("Create a report to share when asking for help. Home paths are shortened, your username is replaced and anything that looks like a secret is removed. The Markdown version is made to paste into a GitHub issue or a chat.")}</p>
        <div className="btn-row"><Button icon="diff" onClick={exportMarkdown}>{t("Markdown for a bug report")}</Button><Button icon="shield" onClick={exportReport}>{t("Full JSON report")}</Button></div>
        <ErrorBox error={error} />
        {markdown && (
          <>
            <textarea className="report selectable" readOnly value={markdown} />
            <Button size="small" onClick={() => navigator.clipboard.writeText(markdown).catch(() => {})}>{t("Copy to clipboard")}</Button>
          </>
        )}
        {report && (
          <>
            <p className="small">{t("Included: ")}{included.join("; ")}.</p>
            <textarea className="report selectable" readOnly value={report} />
            <Button size="small" onClick={() => navigator.clipboard.writeText(report).catch(() => {})}>{t("Copy to clipboard")}</Button>
          </>
        )}
      </Card>
      <h2>{t("Checks DevDoctor runs")}</h2>
      <DataTable columns={[{ key: "name", label: t("Check"), render: (d) => <><b>{d.name}</b>{technical && <div className="mono muted small">{d.id}</div>}</> }, { key: "category", label: t("Area") }, { key: "modes", label: t("Runs in"), render: (d) => (d.modes.length ? d.modes.map((m) => ({ quick: "quick check", deep: "deep check", storage: "disk space check" } as Record<string, string>)[m]).join(", ") : t("deep check only")) }, { key: "description", label: t("What it looks for") }]} rows={detectors.data ?? []} rowKey={(d) => d.id} />
    </div>
  );
}
