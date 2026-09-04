import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage, onScanProgress } from "./lib/api";
import { NAV, NavContext, pageById, type NavParams, type PageId } from "./lib/nav";
import type { DetectorMeta, ScanMode, ScanProgress } from "./lib/types";
import { PrefsContext, ToastProvider, useToast, type Appearance, type Glass } from "./components/Basics";
import { Icon } from "./components/Icons";
import { Toolbar } from "./components/Toolbar";
import { StatusBar } from "./components/StatusBar";
import { SearchPalette } from "./components/SearchPalette";
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

const SIDEBAR_GROUPS: Record<string, string> = { "": "Diagnose", Understand: "Inspect", Activity: "Activity", "Storage & tools": "System", History: "History" };

function applyAppearance(appearance: Appearance, glass: Glass) {
  const root = document.documentElement;
  if (appearance === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", appearance);
  root.classList.toggle("tinted", glass === "tinted");
  const dark = appearance === "dark" || (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("system-dark", appearance === "system" && dark);
}

function Shell() {
  const toast = useToast();
  const [page, setPage] = useState<PageId>("overview");
  const [params, setParams] = useState<NavParams>({});
  const [home, setHome] = useState("");
  const [palette, setPalette] = useState(false);
  const [scanning, setScanning] = useState<ScanMode | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [detectors, setDetectors] = useState<DetectorMeta[]>([]);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [issueCount, setIssueCount] = useState<number | null>(null);
  const [technical, setTechnicalState] = useState(false);
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  const [glass, setGlassState] = useState<Glass>("clear");
  const [inspector, setInspectorState] = useState(true);
  const [sidebarHidden, setSidebarHidden] = useState(false);
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
      const a = (s.appearance as Appearance) ?? "system";
      const g = (s.glass as Glass) ?? "clear";
      setAppearanceState(a);
      setGlassState(g);
      setInspectorState(s.inspector !== false);
      applyAppearance(a, g);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setAppearanceState((a) => { setGlassState((g) => { applyAppearance(a, g); return g; }); return a; });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    api.issues(false).then((r) => setIssueCount(r.length)).catch(() => {});
    api.overview().then((o) => setLastScanAt(o.last_scan?.started_at ?? null)).catch(() => {});
  }, [refreshKey]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onScanProgress((p) => setProgress(p)).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  const runScan = useCallback(async (mode: ScanMode = "quick") => {
    if (scanning) return;
    setScanning(mode);
    setProgress(null);
    try {
      const report = await api.runScan(mode);
      const n = report.issues.length;
      toast.push({ title: n === 0 ? "Scan complete — all clear" : `Scan complete — ${n} finding${n > 1 ? "s" : ""}`, body: `${report.health.checks_passed} of ${report.health.checks_total} checks passed${report.detectors_failed ? ` · ${report.detectors_failed} check(s) could not run` : ""}`, tone: n === 0 ? "green" : undefined });
      refresh();
    } catch (e) {
      toast.push({ title: "The scan could not run", body: errorMessage(e), tone: "red" });
    } finally {
      setScanning(null);
      setProgress(null);
    }
  }, [scanning, toast, refresh]);

  useEffect(() => {
    if (!settingsLoaded || !autoScan || onboarding) return;
    api.overview().then((o) => {
      const last = o.last_scan ? new Date(o.last_scan.started_at).getTime() : 0;
      if (Date.now() - last > 3600_000) runScan("quick");
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if (mod && !e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); runScan("quick"); }
      if (mod && e.altKey && e.key.toLowerCase() === "i") { e.preventDefault(); toggleInspector(); }
      if (mod && !e.altKey && e.key.toLowerCase() === "s" && e.ctrlKey === false) { e.preventDefault(); setSidebarHidden((h) => !h); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runScan, inspector]);

  const setTechnical = (v: boolean) => { setTechnicalState(v); api.setSetting("technical_details", v).catch(() => {}); };
  const setAutoScan = (v: boolean) => { setAutoScanState(v); api.setSetting("auto_scan_on_launch", v).catch(() => {}); };
  const setAppearance = (v: Appearance) => { setAppearanceState(v); applyAppearance(v, glass); api.setSetting("appearance", v).catch(() => {}); };
  const setGlass = (v: Glass) => { setGlassState(v); applyAppearance(appearance, v); api.setSetting("glass", v).catch(() => {}); };
  const toggleInspector = () => { setInspectorState((i) => { api.setSetting("inspector", !i).catch(() => {}); return !i; }); };
  const finishOnboarding = () => { setOnboarding(false); api.setSetting("onboarding_done", true).catch(() => {}); };
  const prefs = useMemo(() => ({ technical, setTechnical, appearance, setAppearance, glass, setGlass }), [technical, appearance, glass]);
  const hasInspector = page === "overview" || page === "problems";
  const current = page === "issue" ? pageById("problems") : pageById(page);

  const content = (() => {
    switch (page) {
      case "overview": return <OverviewPage refreshKey={refreshKey} refresh={refresh} detectors={detectors} inspector={inspector} onboarding={onboarding} onOnboardingDone={finishOnboarding} onScan={() => runScan("quick")} />;
      case "problems": return <ProblemsPage refreshKey={refreshKey} refresh={refresh} detectors={detectors} inspector={inspector} />;
      case "issue": return <div className="content narrow">{params.issueId ? <IssueDetailView issueId={params.issueId} onChanged={refresh} /> : null}</div>;
      case "shell": return <div className="content narrow"><ShellPage refreshKey={refreshKey} /></div>;
      case "path": return <div className="content narrow"><PathPage refreshKey={refreshKey} /></div>;
      case "resolve": return <div className="content narrow"><ResolvePage initial={params.command} /></div>;
      case "runtimes": return <div className="content narrow"><RuntimesPage refreshKey={refreshKey} /></div>;
      case "packages": return <div className="content narrow"><PackagesPage refreshKey={refreshKey} /></div>;
      case "processes": return <div className="content narrow"><ProcessesPage refreshKey={refreshKey} /></div>;
      case "ports": return <div className="content narrow"><PortsPage refreshKey={refreshKey} highlight={params.port} /></div>;
      case "storage": return <div className="content narrow"><StoragePage refreshKey={refreshKey} /></div>;
      case "localai": return <div className="content narrow"><LocalAiPage refreshKey={refreshKey} /></div>;
      case "services": return <div className="content narrow"><ServicesPage refreshKey={refreshKey} /></div>;
      case "tools": return <div className="content narrow"><ToolsPage refreshKey={refreshKey} /></div>;
      case "git": return <div className="content narrow"><GitPage refreshKey={refreshKey} /></div>;
      case "ssh": return <div className="content narrow"><SshPage refreshKey={refreshKey} /></div>;
      case "history": return <div className="content narrow"><HistoryPage refreshKey={refreshKey} /></div>;
      case "changes": return <div className="content narrow"><ChangesPage refreshKey={refreshKey} /></div>;
      case "settings": return <div className="content narrow"><SettingsPage autoScan={autoScan} onAutoScan={setAutoScan} /></div>;
    }
  })();

  return (
    <PrefsContext.Provider value={prefs}>
      <NavContext.Provider value={{ page, params, navigate, home }}>
        <div className={`window ${sidebarHidden ? "sidebar-hidden" : ""}`}>
          <nav className="sidebar">
            <div className="sidebar-head" data-tauri-drag-region>
              <button className="icon-btn" onClick={() => setSidebarHidden(true)} title="Hide sidebar"><Icon name="sidebar-left" /></button>
            </div>
            <div className="sidebar-list">
              {NAV.map((group) => (
                <div key={group.label || "main"}>
                  <div className="side-section">{SIDEBAR_GROUPS[group.label] ?? group.label}</div>
                  {group.pages.map((p) => (
                    <button key={p.id} className={`side-row ${page === p.id || (page === "issue" && p.id === "problems") ? "active" : ""}`} onClick={() => navigate(p.id)} title={p.blurb}>
                      <Icon name={p.icon} className="icon" />
                      <span className="label">{p.label}</span>
                      {p.id === "problems" && issueCount != null && issueCount > 0 && <span className="badge">{issueCount}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="sidebar-foot">
              <Icon name="lock-shield" className="icon" />
              <div><div className="t">Local by default</div><div className="s">Nothing leaves this Mac</div></div>
            </div>
          </nav>
          <div className="main">
            <Toolbar title={page === "issue" ? "Issue" : current?.label ?? "DevDoctor"} status={null} scanning={!!scanning} onScan={() => runScan("quick")} inspector={hasInspector ? inspector : null} onToggleInspector={toggleInspector} sidebarHidden={sidebarHidden} onToggleSidebar={() => setSidebarHidden(false)} onSearch={() => setPalette(true)} />
            <div className={`body ${hasInspector && inspector ? "with-inspector" : ""}`}>{content}</div>
            <StatusBar scanning={!!scanning} progress={progress} lastScanAt={lastScanAt} mode={scanning} />
          </div>
        </div>
        {palette && <SearchPalette onClose={() => setPalette(false)} />}
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
