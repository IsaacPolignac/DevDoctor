import { useState } from "react";
import { Icon } from "./Icons";
import { Popover, usePrefs, type Appearance, type Glass } from "./Basics";

export function Toolbar({ title, status, scanning, onScan, inspector, onToggleInspector, sidebarHidden, onToggleSidebar, onSearch }: { title: string; status?: string | null; scanning: boolean; onScan: () => void; inspector: boolean | null; onToggleInspector: () => void; sidebarHidden: boolean; onToggleSidebar: () => void; onSearch: () => void }) {
  const { appearance, setAppearance, glass, setGlass } = usePrefs();
  const [menu, setMenu] = useState(false);
  const appearanceIcon = appearance === "light" ? "sun" : appearance === "dark" ? "moon" : "half-circle";
  const item = (label: string, active: boolean, icon: "sun" | "moon" | "half-circle" | undefined, onClick: () => void) => (
    <button className="pi" onClick={() => { onClick(); setMenu(false); }}>{icon && <Icon name={icon} />}<span>{label}</span>{active && <Icon name="check" className="chk" size={12} />}</button>
  );
  return (
    <div className="toolbar" data-tauri-drag-region>
      {sidebarHidden && <button className="tb-btn" onClick={onToggleSidebar} title="Show sidebar"><Icon name="sidebar-left" /></button>}
      <span className="ttl" data-tauri-drag-region>{title}</span>
      <div className="spacer" data-tauri-drag-region />
      {status && <span className="status">{status}</span>}
      <div className="tb-group">
        <button className="tb-btn" onClick={onSearch} title="Search (⌘K)"><Icon name="search" /></button>
        <button className="tb-btn" onClick={onScan} disabled={scanning} title="Run a new diagnostic scan (⌘R)"><Icon name="refresh" /></button>
        <div style={{ position: "relative" }}>
          <button className="tb-btn" onClick={() => setMenu((m) => !m)} title="Appearance and Liquid Glass"><Icon name={appearanceIcon} /><Icon name="chevron-down" className="chev" /></button>
          <Popover open={menu} onClose={() => setMenu(false)}>
            <div className="ph">Appearance</div>
            {(["system", "light", "dark"] as Appearance[]).map((a) => item(a === "system" ? "System" : a === "light" ? "Light" : "Dark", appearance === a, a === "system" ? "half-circle" : a === "light" ? "sun" : "moon", () => setAppearance(a)))}
            <div className="sep" />
            <div className="ph">Liquid Glass</div>
            {(["clear", "tinted"] as Glass[]).map((g) => item(g === "clear" ? "Clear" : "Tinted", glass === g, undefined, () => setGlass(g)))}
          </Popover>
        </div>
        {inspector !== null && <button className="tb-btn" onClick={onToggleInspector} title={inspector ? "Hide Inspector (⌥⌘I)" : "Show Inspector (⌥⌘I)"}><Icon name="sidebar-right" /></button>}
      </div>
    </div>
  );
}
