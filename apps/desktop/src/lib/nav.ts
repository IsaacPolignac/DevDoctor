import { createContext, useContext } from "react";
import type { IconName } from "../components/Icons";

export type PageId =
  | "overview" | "problems" | "issue" | "shell" | "path" | "resolve" | "runtimes" | "packages" | "processes" | "ports"
  | "storage" | "localai" | "services" | "tools" | "git" | "ssh" | "history" | "changes" | "settings";

export interface NavPage { id: PageId; label: string; icon: IconName; blurb: string }
export interface NavGroup { label: string; pages: NavPage[] }

export const NAV: NavGroup[] = [
  { label: "", pages: [
    { id: "overview", label: "Home", icon: "home", blurb: "Health of your development environment at a glance." },
    { id: "problems", label: "Issues", icon: "alert", blurb: "Everything DevDoctor found, explained in plain words." },
  ] },
  { label: "Understand", pages: [
    { id: "shell", label: "Terminal setup", icon: "terminal", blurb: "The files your terminal runs at startup and what they change." },
    { id: "path", label: "PATH", icon: "path", blurb: "The folders your terminal searches for commands, in order." },
    { id: "resolve", label: "Which command runs?", icon: "search", blurb: "See which python, node or git actually runs when you type it." },
    { id: "runtimes", label: "Languages", icon: "chip", blurb: "Node.js, Python and Rust installations found on this Mac." },
    { id: "packages", label: "Package managers", icon: "box", blurb: "Homebrew, npm, pip and friends." },
  ] },
  { label: "Activity", pages: [
    { id: "processes", label: "Running programs", icon: "activity", blurb: "Development servers and tools running right now." },
    { id: "ports", label: "Ports", icon: "network", blurb: "Which programs occupy which network ports." },
    { id: "services", label: "Startup items", icon: "gear", blurb: "Programs macOS starts for you at login." },
  ] },
  { label: "Storage & tools", pages: [
    { id: "storage", label: "Disk space", icon: "drive", blurb: "Caches, dependencies and models taking space." },
    { id: "localai", label: "Local AI", icon: "sparkles", blurb: "Ollama and other locally stored AI models." },
    { id: "tools", label: "Developer tools", icon: "wrench", blurb: "Claude Code, Codex, Docker, editors and how they were installed." },
    { id: "git", label: "Git", icon: "git", blurb: "Your global Git identity and settings." },
    { id: "ssh", label: "SSH keys", icon: "key", blurb: "Keys, permissions and configuration. Never their contents." },
  ] },
  { label: "History", pages: [
    { id: "changes", label: "What changed", icon: "diff", blurb: "Differences between snapshots of your setup." },
    { id: "history", label: "Fixes & scans", icon: "clock", blurb: "Everything DevDoctor changed, with undo." },
    { id: "settings", label: "Settings", icon: "sliders", blurb: "Preferences, detectors and diagnostic export." },
  ] },
];

export const ALL_PAGES: NavPage[] = NAV.flatMap((g) => g.pages);
export const pageById = (id: PageId): NavPage | undefined => ALL_PAGES.find((p) => p.id === id);

export interface NavParams { issueId?: string; command?: string; port?: number }
export interface NavContextValue { page: PageId; params: NavParams; navigate: (page: PageId, params?: NavParams) => void; home: string }
export const NavContext = createContext<NavContextValue>({ page: "overview", params: {}, navigate: () => {}, home: "" });
export const useNav = () => useContext(NavContext);
