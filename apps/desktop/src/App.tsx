import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, onScanProgress } from "./lib/api";
import { NAV, NavContext, type NavParams, type PageId } from "./lib/nav";
import type { ScanMode, ScanProgress } from "./lib/types";
import { formatMs } from "./lib/format";
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

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [params, setParams] = useState<NavParams>({});
  const [home, setHome] = useState("");
  const [palette, setPalette] = useState(false);
  const [scanning, setScanning] = useState<ScanMode | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [lastScanMessage, setLastScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [issueCount, setIssueCount] = useState<number | null>(null);

  const navigate = useCallback((p: PageId, prm: NavParams = {}) => { setPage(p); setParams(prm); }, []);

  useEffect(() => { api.system().then((s) => setHome(s.home)).catch(() => {}); }, []);
  useEffect(() => { api.issues(false).then((r) => setIssueCount(r.length)).catch(() => {}); }, [refreshKey]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onScanProgress((p) => setProgress(p)).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runScan = async (mode: ScanMode) => {
    if (scanning) return;
    setScanning(mode);
    setScanError(null);
    setLastScanMessage(null);
    try {
      const report = await api.runScan(mode);
      setLastScanMessage(`${mode} scan: ${report.issues.length} issue(s), health ${report.health.score}, ${formatMs(report.duration_ms)}${report.detectors_failed ? `, ${report.detectors_failed} detector(s) failed` : ""}`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setScanError(errorMessage(e));
    } finally {
      setScanning(null);
      setProgress(null);
    }
  };

  const progressText = progress
    ? progress.event === "detector_started" || progress.event === "detector_finished"
      ? `${progress.name} (${progress.index + 1}/${progress.total})`
      : progress.event === "started" ? `starting ${progress.mode} scan…` : ""
    : "";
  const progressPct = progress && (progress.event === "detector_started" || progress.event === "detector_finished") ? Math.round(((progress.index + (progress.event === "detector_finished" ? 1 : 0)) / progress.total) * 100) : scanning ? 5 : 0;

  const content = (() => {
    switch (page) {
      case "overview": return <OverviewPage refreshKey={refreshKey} onScan={runScan} />;
      case "problems": return <ProblemsPage refreshKey={refreshKey} />;
      case "issue": return params.issueId ? <IssueDetailView issueId={params.issueId} /> : <ProblemsPage refreshKey={refreshKey} />;
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
      case "settings": return <SettingsPage />;
    }
  })();

  return (
    <NavContext.Provider value={{ page, params, navigate, home }}>
      <div className="layout">
        <nav className="sidebar">
          <div className="brand">DevDoctor<span>Find what broke your dev environment</span></div>
          {NAV.map((group) => (
            <div key={group.label || "main"}>
              {group.label && <div className="nav-group">{group.label}</div>}
              {group.pages.map((p) => (
                <button key={p.id} className={`nav-item ${page === p.id || (page === "issue" && p.id === "problems") ? "active" : ""}`} onClick={() => navigate(p.id)}>
                  <span>{p.label}</span>
                  {p.id === "problems" && issueCount != null && issueCount > 0 && <span className="count">{issueCount}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="main">
          <div className="topbar">
            <button className="btn" onClick={() => setPalette(true)} title="Search (⌘K)">Search ⌘K</button>
            <div className="spacer" />
            {scanning ? (
              <div style={{ minWidth: 280 }}>
                <div className="muted small">{progressText || `${scanning} scan…`}</div>
                <div className="progress"><div style={{ width: `${progressPct}%` }} /></div>
              </div>
            ) : (
              <>
                {scanError && <span className="badge failed" title={scanError}>scan failed</span>}
                {lastScanMessage && <span className="muted small">{lastScanMessage}</span>}
                <button className="btn primary" onClick={() => runScan("quick")}>Quick Scan</button>
                <button className="btn" onClick={() => runScan("deep")}>Deep Scan</button>
              </>
            )}
          </div>
          <div className="content">
            {scanError && <div className="error">{scanError}</div>}
            {content}
          </div>
        </div>
      </div>
      {palette && <SearchPalette onClose={() => setPalette(false)} />}
    </NavContext.Provider>
  );
}
