import { createContext, useContext } from "react";

export type PageId =
  | "overview" | "problems" | "issue" | "shell" | "path" | "resolve" | "runtimes" | "packages" | "processes" | "ports"
  | "storage" | "localai" | "services" | "tools" | "git" | "ssh" | "history" | "changes" | "settings";

export interface NavGroup { label: string; pages: { id: PageId; label: string }[] }

export const NAV: NavGroup[] = [
  { label: "", pages: [{ id: "overview", label: "Overview" }, { id: "problems", label: "Problems" }] },
  { label: "Environment", pages: [{ id: "shell", label: "Shell" }, { id: "path", label: "PATH" }, { id: "resolve", label: "Command resolution" }, { id: "runtimes", label: "Runtimes" }, { id: "packages", label: "Packages" }] },
  { label: "Activity", pages: [{ id: "processes", label: "Processes" }, { id: "ports", label: "Ports" }, { id: "services", label: "Services" }] },
  { label: "Storage & tools", pages: [{ id: "storage", label: "Storage" }, { id: "localai", label: "Local AI" }, { id: "tools", label: "Developer tools" }, { id: "git", label: "Git" }, { id: "ssh", label: "SSH" }] },
  { label: "History", pages: [{ id: "changes", label: "What changed" }, { id: "history", label: "Fix history" }, { id: "settings", label: "Settings" }] },
];

export interface NavParams { issueId?: string; command?: string; port?: number }
export interface NavContextValue { page: PageId; params: NavParams; navigate: (page: PageId, params?: NavParams) => void; home: string }
export const NavContext = createContext<NavContextValue>({ page: "overview", params: {}, navigate: () => {}, home: "" });
export const useNav = () => useContext(NavContext);
