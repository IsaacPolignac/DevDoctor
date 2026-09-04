// Plain-language layer: turns engine vocabulary into words a beginner understands.
import type { Category, Confidence, Severity } from "./types";

export type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray" | "purple";

export const SEVERITY_PLAIN: Record<Severity, { label: string; tone: Tone; hint: string }> = {
  critical: { label: "Fix now", tone: "red", hint: "Severity: critical. This is breaking things right now." },
  high: { label: "Needs attention", tone: "red", hint: "Severity: high. Very likely causing errors or failures." },
  medium: { label: "Should fix", tone: "orange", hint: "Severity: medium. Causes confusion or will bite you soon." },
  low: { label: "Worth a look", tone: "yellow", hint: "Severity: low. Harmless most of the time, but untidy." },
  info: { label: "Good to know", tone: "gray", hint: "Severity: info. Nothing is wrong; this is context." },
};

export const CONFIDENCE_PLAIN: Record<Confidence, { label: string; tone: Tone; hint: string }> = {
  confirmed: { label: "Verified", tone: "green", hint: "DevDoctor observed this directly on your Mac." },
  likely: { label: "Probable", tone: "blue", hint: "Strong signals, but not a direct observation." },
  possible: { label: "Possible", tone: "gray", hint: "A plausible interpretation that could not be verified." },
};

export type Group = "attention" | "should" | "look" | "note";
export const GROUPS: { id: Group; title: string; blurb: string; tone: Tone }[] = [
  { id: "attention", title: "Needs attention", blurb: "These are likely breaking commands or tools right now.", tone: "red" },
  { id: "should", title: "Should fix", blurb: "Not urgent, but they cause confusion and surprises.", tone: "orange" },
  { id: "look", title: "Worth a look", blurb: "Small things that keep your setup tidy.", tone: "yellow" },
  { id: "note", title: "Good to know", blurb: "Facts about your setup. Nothing to fix.", tone: "gray" },
];

export function severityGroup(s: Severity): Group {
  if (s === "critical" || s === "high") return "attention";
  if (s === "medium") return "should";
  if (s === "low") return "look";
  return "note";
}

export const CATEGORY_PLAIN: Record<Category, string> = {
  shell: "Terminal setup",
  runtimes: "Languages & runtimes",
  package_managers: "Package managers",
  processes: "Running programs",
  ports: "Network ports",
  ai_tools: "Local AI",
  disk: "Disk space",
  git: "Git",
  ssh: "SSH keys",
  containers: "Containers",
  environment: "Environment variables",
  services: "Startup items",
};

export const GLOSSARY: Record<string, string> = {
  PATH: "The ordered list of folders your terminal searches when you type a command. The first folder that contains the command wins.",
  "startup file": "A file such as ~/.zshrc that your terminal runs every time it opens. Installers often add lines to it.",
  "login shell": "A brand-new terminal session, started the way a new Terminal window is. DevDoctor uses one to see exactly what you would see.",
  cache: "Files a tool keeps so it does not have to download them again. Safe to delete; the tool re-downloads what it needs.",
  node_modules: "The folder where a JavaScript project keeps its dependencies. It can be rebuilt with npm install, pnpm install or yarn.",
  "virtual environment": "A private Python installation for one project (.venv). It can be recreated from the project's requirements.",
  snapshot: "A lightweight record of your setup (installed packages, PATH, startup files, services) used to show what changed later.",
  "launch agent": "A small configuration file that tells macOS to start a program when you log in.",
  port: "A numbered door on your Mac that a server program listens on, such as 3000 for a web app.",
  "package manager": "A tool that installs software for you: Homebrew, npm, pip, cargo...",
  transaction: "A recorded change with backups, so it can be undone.",
  backup: "A copy of a file taken before DevDoctor changes it, stored in DevDoctor's own folder.",
  symlink: "A shortcut file that points to another file or folder.",
};

export function plainFixLabel(reversible: boolean, batchSafe: boolean): string {
  if (batchSafe) return "Fix safely";
  if (reversible) return "Fix (can be undone)";
  return "Fix…";
}
