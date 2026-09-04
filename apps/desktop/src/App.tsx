import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage, onScanProgress } from "./lib/api";
import { NAV, NavContext, pageById, type NavParams, type PageId } from "./lib/nav";
import type { DetectorMeta, ScanMode, ScanProgress } from "./lib/types";
import { formatMs, relativeDate } from "./lib/format";
import { Button, PrefsContext, Switch, ToastProvider, useToast } from "./components/Basics";
import { Icon } from "./components/Icons";
import { SearchPalette } from "./components/SearchPalette";
import { ScanOverlay } from "./components/ScanOverlay";
import { IssueDetailView } from "./components/IssueDetailView";
import { OverviewPage } from "./pages/Overview";
import { ProblemsPage } from "./pages/Problems";
import { ShellPage } from "./pages/ShellPage";
import { PathPage } from "./pages/PathPage";
import { ResolvePage } from "./pages/ResolvePage";
import { RuntimesPage } from "./pages/RuntimesPage";
import { PackagesPage } from "./pages/PackagesPage";
import { ProcessesPage } from "./pages/ProcessesPage";
import { PortsPage } from "./pages/PortsPage";
import { StoragePage } from "./pages/StoragePage";
import { LocalAiPage } from "./pages/LocalAiPage";
import { ChangesPage } from "./pages/ChangesPage";
import { GitPage, HistoryPage, ServicesPage, SettingsPage, SshPage, ToolsPage } from "./pages/MiscPages";

const inTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
if (!inTauri) document.documentElement.classList.add("no-tauri");

function Shell() {
  const toast = useToast();
  const [page, setPage] = useState<PageId>("overview");
  const [params, setParams] = useState<NavParams>({});
  const [home, setHome] = useState("");
  const [palette, setPalette] = useState(false);
  const [scanning, setScanning] = useState<ScanMode | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [detectors, setDetectors] = useState<DetectorMeta[]>([]);
  const [lastScanText, setLastScanText] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [issueCount, setIssueCount] = useState<number | null>(null);
  const [technical, setTechnicalState] = useState(false);
  const [autoScan, setAutoScanState] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const navigate = useCallback((p: PageId, prm: NavParams = {}) => { setPage(p); setParams(prm); }, []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    api.system().then((s) => setHome(s.home)).catch(() => {});
    api.detectors().then(setDetectors).catch(() => {});
    api.settings().then((s) => {
      setTechnicalState(Boolean(s.technical_details));
      setAutoScanState(s.auto_scan_on_launch !== false);
      setOnboarding(!s.onboarding_done);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, []);
  useEffect(() => { api.issues(false).then((r) => setIssueCount(r.length)).catch(() => {}); }, [refreshKey]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onScanProgress((p) => setProgress(p)).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  const runScan = useCallback(async (mode: ScanMode) => {
    if (scanning) return;
    setScanning(mode);
    setProgress(null);
    try {
      const report = await api.runScan(mode);
      const n = report.issues.length;
      setLastScanText(`Checked ${relativeDate(report.finished_at)} · health ${report.health.score} · ${formatMs(report.duration_ms)}`);
      toast.push({ title: n === 0 ? "All clear" : `${n} issue${n > 1 ? "s" : ""} found`, body: `${report.health.checks_passed} of ${report.health.checks_total} checks passed${report.detectors_failed ? ` · ${report.detectors_failed} check(s) could not run` : ""}`, tone: n === 0 ? "green" : undefined });
      refresh();
    } catch (e) {
      toast.push({ title: "The check could not run", body: errorMessage(e), tone: "red" });
    } finally {
      setScanning(null);
      setProgress(null);
    }
  }, [scanning, toast, refresh]);

  // Auto-check on launch when the last check is older than an hour.
  useEffect(() => {
    if (!settingsLoaded || !autoScan || onboarding) return;
    api.overview().then((o) => {
      const last = o.last_scan ? new Date(o.last_scan.started_at).getTime() : 0;
      if (Date.now() - last > 3600_000) runScan("quick");
      else setLastScanText(`Checked ${relativeDate(o.last_scan?.started_at)} · health ${o.health?.score ?? "?"}`);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") { e.preventDefault(); runScan("quick"); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runScan]);

  const setTechnical = (v: boolean) => { setTechnicalState(v); api.setSetting("technical_details", v).catch(() => {}); };
  const setAutoScan = (v: boolean) => { setAutoScanState(v); api.setSetting("auto_scan_on_launch", v).catch(() => {}); };
  const finishOnboarding = () => { setOnboarding(false); api.setSetting("onboarding_done", true).catch(() => {}); };
  const prefs = useMemo(() => ({ technical, setTechnical }), [technical]);
  const current = page === "issue" ? pageById("problems") : pageById(page);

  const content = (() => {
    switch (page) {
      case "overview": return <OverviewPage refreshKey={refreshKey} onScan={runScan} onboarding={onboarding} onOnboardingDone={finishOnboarding} />;
      case "problems": return <ProblemsPage refreshKey={refreshKey} onChanged={refresh} />;
      case "issue": return params.issueId ? <IssueDetailView issueId={params.issueId} onChanged={refresh} /> : <ProblemsPage refreshKey={refreshKey} onChanged={refresh} />;
      case "shell": return <ShellPage refreshKey={refreshKey} />;
      case "path": return <PathPage refreshKey={refreshKey} />;
      case "resolve": return <ResolvePage initial={params.command} />;
      case "runtimes": return <RuntimesPage refreshKey={refreshKey} />;
      case "packages": return <PackagesPage refreshKey={refreshKey} />;
      case "processes": return <ProcessesPage refreshKey={refreshKey} />;
      case "ports": return <PortsPage refreshKey={refreshKey} highlight={params.port} />;
      case "storage": return <StoragePage refreshKey={refreshKey} />;
      case "localai": return <LocalAiPage refreshKey={refreshKey} />;
      case "services": return <ServicesPage refreshKey={refreshKey} />;
      case "tools": return <ToolsPage refreshKey={refreshKey} />;
      case "git": return <GitPage refreshKey={refreshKey} />;
      case "ssh": return <SshPage refreshKey={refreshKey} />;
      case "history": return <HistoryPage refreshKey={refreshKey} />;
      case "changes": return <ChangesPage refreshKey={refreshKey} />;
      case "settings": return <SettingsPage autoScan={autoScan} onAutoScan={setAutoScan} />;
    }
  })();

  return (
    <PrefsContext.Provider value={prefs}>
      <NavContext.Provider value={{ page, params, navigate, home }}>
        <div className="window">
          <nav className="sidebar glass" data-tauri-drag-region>
            <div className="brand" data-tauri-drag-region>
              <div className="name">DevDoctor</div>
              <div className="tag">Find what broke your dev setup</div>
            </div>
            {NAV.map((group) => (
              <div key={group.label || "main"}>
                {group.label && <div className="nav-group">{group.label}</div>}
                {group.pages.map((p) => (
                  <button key={p.id} className={`nav-item ${page === p.id || (page === "issue" && p.id === "problems") ? "active" : ""}`} onClick={() => navigate(p.id)} title={p.blurb}>
                    <Icon name={p.icon} className="icon" />
                    <span>{p.label}</span>
                    {p.id === "problems" && issueCount != null && issueCount > 0 && <span className="count">{issueCount}</span>}
                  </button>
                ))}
              </div>
            ))}
            <div className="sidebar-footer">
              <Switch on={technical} onChange={setTechnical} label={<span className="small">Technical details</span>} />
            </div>
          </nav>
          <div className="main">
            <div className="toolbar" data-tauri-drag-region>
              <span className="title" data-tauri-drag-region>{page === "issue" ? "Issue" : current?.label}</span>
              <div className="spacer" data-tauri-drag-region />
              {lastScanText && !scanning && <span className="muted small nowrap">{lastScanText}</span>}
              <Button icon="search" onClick={() => setPalette(true)} title="Search (⌘K)">Search</Button>
              <Button variant="primary" icon="refresh" onClick={() => runScan("quick")} disabled={!!scanning} title="Quick check (⌘R)">{scanning ? "Checking…" : "Check now"}</Button>
            </div>
            <div className="content">{content}</div>
          </div>
        </div>
        {palette && <SearchPalette onClose={() => setPalette(false)} />}
        {scanning && <ScanOverlay progress={progress} detectors={detectors} mode={scanning} />}
      </NavContext.Provider>
    </PrefsContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
