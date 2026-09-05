import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage, inTauri, onScanProgress } from "./lib/api";
import { NavContext, SECTIONS, sectionOf, type NavParams, type PageId } from "./lib/nav";
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
import { activeLanguage, adoptStoredLanguage, t } from "./lib/i18n";

if (!inTauri) document.documentElement.classList.add("no-tauri");
// The window is opaque with a regular title bar outside macOS: no traffic-light inset, no glass.
const platform = navigator.userAgent.includes("Windows") ? "windows" : navigator.userAgent.includes("Mac") ? "macos" : "linux";
document.documentElement.classList.add(`platform-${platform}`);
document.documentElement.lang = activeLanguage;

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
      adoptStoredLanguage(s.language);
      setAutoScanState(s.auto_scan_on_launch !== false);
      setOnboarding(!s.onboarding_done);
      const a = (s.appearance as Appearance) ?? "system";
      const g = (s.glass as Glass) ?? "clear";
      setAppearanceState(a);
      setGlassState(g);
      setInspectorState(s.inspector !== false);
      applyAppearance(a, g);
      api.setWindowTheme(a).catch(() => {});
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
      toast.push({ title: n === 0 ? t("Scan complete — all clear") : (n === 1 ? t("Scan complete — 1 finding") : t("Scan complete — {n} findings", { n })), body: t("{passed} of {total} checks passed", { passed: report.health.checks_passed, total: report.health.checks_total }) + (report.detectors_failed ? t(" · {n} check(s) could not run", { n: report.detectors_failed }) : ""), tone: n === 0 ? "green" : undefined });
      refresh();
    } catch (e) {
      toast.push({ title: t("The scan could not run"), body: errorMessage(e), tone: "red" });
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
  const setAppearance = (v: Appearance) => { setAppearanceState(v); applyAppearance(v, glass); api.setWindowTheme(v).catch(() => {}); api.setSetting("appearance", v).catch(() => {}); };
  const setGlass = (v: Glass) => { setGlassState(v); applyAppearance(appearance, v); api.setSetting("glass", v).catch(() => {}); };
  const toggleInspector = () => { setInspectorState((i) => { api.setSetting("inspector", !i).catch(() => {}); return !i; }); };
  const finishOnboarding = () => { setOnboarding(false); api.setSetting("onboarding_done", true).catch(() => {}); };
  const prefs = useMemo(() => ({ technical, setTechnical, appearance, setAppearance, glass, setGlass }), [technical, appearance, glass]);
  const hasInspector = page === "overview" || page === "problems";
  const section = sectionOf(page);
  const tabs = section.pages.length > 1 ? { options: section.pages, value: page === "issue" ? "problems" : page, onChange: (id: string) => navigate(id as PageId) } : null;

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
              <button className="icon-btn" onClick={() => setSidebarHidden(true)} title={t("Hide sidebar")}><Icon name="sidebar-left" /></button>
            </div>
            <div className="sidebar-list">
              {SECTIONS.map((group) => (
                <div key={group.group}>
                  <div className="side-section">{group.group}</div>
                  {group.items.map((sec) => (
                    <button key={sec.id} className={`side-row ${section.id === sec.id ? "active" : ""}`} onClick={() => navigate(sec.pages[0].id)}>
                      <Icon name={sec.icon} className="icon" size={16} />
                      <span className="label">{sec.label}</span>
                      {sec.id === "problems" && issueCount != null && issueCount > 0 && <span className="badge">{issueCount}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="sidebar-foot">
              <Icon name="lock-shield" className="icon" />
              <div><div className="t">{t("Local by default")}</div><div className="s">{t("Nothing leaves this Mac")}</div></div>
            </div>
          </nav>
          <div className="main">
            <Toolbar title={page === "issue" ? t("Problem") : section.label} status={null} tabs={tabs} scanning={!!scanning} onScan={() => runScan("quick")} inspector={hasInspector ? inspector : null} onToggleInspector={toggleInspector} sidebarHidden={sidebarHidden} onToggleSidebar={() => setSidebarHidden(false)} onSearch={() => setPalette(true)} />
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
