import { createContext, useContext } from "react";
import type { IconName } from "../components/Icons";
import type { TileColor } from "../components/Tile";
import { t } from "./i18n";

export type PageId =
  | "overview" | "problems" | "issue" | "shell" | "path" | "resolve" | "runtimes" | "packages" | "processes" | "ports"
  | "storage" | "localai" | "services" | "tools" | "git" | "ssh" | "history" | "changes" | "settings";

export interface NavPage { id: PageId; label: string; icon: IconName; blurb: string }
export interface NavGroup { label: string; pages: NavPage[] }

export const NAV: NavGroup[] = [
  { label: "", pages: [
    { id: "overview", label: t("Overview"), icon: "grid", blurb: t("Health of your development environment at a glance.") },
    { id: "problems", label: t("Problems"), icon: "triangle", blurb: t("Everything DevDoctor found, explained in plain words.") },
  ] },
  { label: t("Understand"), pages: [
    { id: "shell", label: t("Shell"), icon: "terminal", blurb: t("The files your terminal runs at startup and what they change.") },
    { id: "path", label: t("PATH Explorer"), icon: "path", blurb: t("The folders your terminal searches for commands, in order.") },
    { id: "resolve", label: t("Command Resolution"), icon: "search", blurb: t("See which python, node or git actually runs when you type it.") },
    { id: "runtimes", label: t("Runtimes"), icon: "shippingbox", blurb: t("Node.js, Python and Rust installations found on this Mac.") },
    { id: "packages", label: t("Packages"), icon: "box", blurb: t("Homebrew, npm, pip and friends.") },
  ] },
  { label: t("Activity"), pages: [
    { id: "processes", label: t("Processes"), icon: "waveform", blurb: t("Development servers and tools running right now.") },
    { id: "ports", label: t("Ports"), icon: "cable", blurb: t("Which programs occupy which network ports.") },
    { id: "services", label: t("Startup Items"), icon: "gear", blurb: t("Programs macOS starts for you at login.") },
  ] },
  { label: t("Storage & tools"), pages: [
    { id: "storage", label: t("Developer Storage"), icon: "internaldrive", blurb: t("Caches, dependencies and models taking space.") },
    { id: "localai", label: t("Local AI"), icon: "cpu", blurb: t("Ollama and other locally stored AI models.") },
    { id: "tools", label: t("Developer Tools"), icon: "wrench", blurb: t("Claude Code, Codex, Docker, editors and how they were installed.") },
    { id: "git", label: t("Git"), icon: "git", blurb: t("Your global Git identity and settings.") },
    { id: "ssh", label: t("SSH"), icon: "key", blurb: t("Keys, permissions and configuration. Never their contents.") },
  ] },
  { label: t("History"), pages: [
    { id: "changes", label: t("What Changed"), icon: "diff", blurb: t("Differences between snapshots of your setup.") },
    { id: "history", label: t("History"), icon: "clock-arrow", blurb: t("Everything DevDoctor changed, with undo.") },
    { id: "settings", label: t("Settings"), icon: "sliders", blurb: t("Preferences, detectors and diagnostic export.") },
  ] },
];

export const ALL_PAGES: NavPage[] = NAV.flatMap((g) => g.pages);

/** Sidebar entries: nine sections, some of which group several pages as tabs. */
export interface Section { id: string; label: string; icon: IconName; color: TileColor; pages: { id: PageId; label: string }[] }
export const SECTIONS: { group: string; items: Section[] }[] = [
  { group: t("Diagnose"), items: [
    { id: "overview", label: t("Overview"), icon: "grid", color: "blue", pages: [{ id: "overview", label: t("Overview") }] },
    { id: "problems", label: t("Problems"), icon: "triangle", color: "orange", pages: [{ id: "problems", label: t("Problems") }] },
  ] },
  { group: t("Inspect"), items: [
    { id: "shellpath", label: t("Shell & PATH"), icon: "terminal", color: "graphite", pages: [{ id: "shell", label: t("Startup Files") }, { id: "path", label: t("PATH") }, { id: "resolve", label: t("Command Lookup") }] },
    { id: "runtimes", label: t("Runtimes & Tools"), icon: "shippingbox", color: "purple", pages: [{ id: "runtimes", label: t("Runtimes") }, { id: "packages", label: t("Packages") }, { id: "tools", label: t("Developer Tools") }, { id: "git", label: t("Git") }, { id: "ssh", label: t("SSH") }] },
    { id: "activity", label: t("Activity"), icon: "waveform", color: "green", pages: [{ id: "processes", label: t("Processes") }, { id: "ports", label: t("Ports") }, { id: "services", label: t("Startup Items") }] },
  ] },
  { group: t("System"), items: [
    { id: "storage", label: t("Developer Storage"), icon: "internaldrive", color: "indigo", pages: [{ id: "storage", label: t("Developer Storage") }] },
    { id: "localai", label: t("Local AI"), icon: "cpu", color: "pink", pages: [{ id: "localai", label: t("Local AI") }] },
  ] },
  { group: t("History"), items: [
    { id: "history", label: t("History"), icon: "clock-arrow", color: "gray", pages: [{ id: "history", label: t("Fixes & Scans") }, { id: "changes", label: t("What Changed") }] },
    { id: "settings", label: t("Settings"), icon: "gear", color: "gray", pages: [{ id: "settings", label: t("Settings") }] },
  ] },
];
export const ALL_SECTIONS: Section[] = SECTIONS.flatMap((g) => g.items);
export function sectionOf(page: PageId): Section {
  const p = page === "issue" ? "problems" : page;
  return ALL_SECTIONS.find((s) => s.pages.some((x) => x.id === p)) ?? ALL_SECTIONS[0];
}
export const pageById = (id: PageId): NavPage | undefined => ALL_PAGES.find((p) => p.id === id);

export interface NavParams { issueId?: string; command?: string; port?: number }
export interface NavContextValue { page: PageId; params: NavParams; navigate: (page: PageId, params?: NavParams) => void; home: string }
export const NavContext = createContext<NavContextValue>({ page: "overview", params: {}, navigate: () => {}, home: "" });
export const useNav = () => useContext(NavContext);
