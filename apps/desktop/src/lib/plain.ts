// Plain-language layer: turns engine vocabulary into what a beginner reads on screen.
import type { Category, Confidence, DetectorRun, Issue, Severity } from "./types";

export type Tone = "red" | "orange" | "yellow" | "green" | "blue" | "gray" | "purple";

export const SEVERITY_PLAIN: Record<Severity, { label: string; tone: Tone; hint: string }> = {
  critical: { label: "Fix now", tone: "red", hint: "Severity: critical. This is breaking things right now." },
  high: { label: "Needs attention", tone: "orange", hint: "Severity: high. Very likely causing errors or failures." },
  medium: { label: "Needs attention", tone: "orange", hint: "Severity: medium. Causes confusion or will bite you soon." },
  low: { label: "Recommendation", tone: "blue", hint: "Severity: low. Harmless most of the time, but untidy." },
  info: { label: "Good to know", tone: "gray", hint: "Severity: info. Nothing is wrong; this is context." },
};

export const CONFIDENCE_PLAIN: Record<Confidence, { label: string; tone: Tone; hint: string }> = {
  confirmed: { label: "Verified", tone: "green", hint: "DevDoctor observed this directly on your Mac." },
  likely: { label: "Probable", tone: "blue", hint: "Strong signals, but not a direct observation." },
  possible: { label: "Possible", tone: "gray", hint: "A plausible interpretation that could not be verified." },
};

/** The three levels the results table works with, as in the native prototype. */
export type Level = "attention" | "recommendation" | "healthy";
export const LEVELS: Record<Level, { title: string; tone: Tone; icon: "triangle-fill" | "info-circle-fill" | "check-circle-fill"; color: string }> = {
  attention: { title: "Attention", tone: "orange", icon: "triangle-fill", color: "var(--orange)" },
  recommendation: { title: "Recommendation", tone: "blue", icon: "info-circle-fill", color: "var(--blue)" },
  healthy: { title: "Healthy", tone: "green", icon: "check-circle-fill", color: "var(--green)" },
};

export function levelOf(severity: Severity): Level {
  return severity === "critical" || severity === "high" || severity === "medium" ? "attention" : "recommendation";
}

export const CATEGORY_PLAIN: Record<Category, string> = {
  shell: "Shell", runtimes: "Runtimes", package_managers: "Packages", processes: "Processes", ports: "Ports", ai_tools: "Local AI",
  disk: "Storage", git: "Git", ssh: "SSH", containers: "Containers", environment: "Environment", services: "Startup",
};

/** Short "Area" names for the results table, derived from the detector id. */
export function areaOf(detectorId: string, category: Category): string {
  const [head, second] = detectorId.split(".");
  if (head === "shell" && second === "path") return "PATH";
  if (head === "shell" && second === "alias") return "Aliases";
  if (head === "shell" && second === "startup") return "Terminal";
  if (head === "shell") return "Shell";
  if (head === "macos") return "macOS";
  if (head === "ai") return "AI tools";
  if (head === "python") return "Python";
  if (head === "node") return "Node.js";
  if (head === "rust") return "Rust";
  if (head === "homebrew") return "Homebrew";
  if (head === "process") return "Processes";
  if (head === "port") return "Ports";
  if (head === "disk" && second === "ollama") return "Ollama";
  if (head === "disk") return "Storage";
  if (head === "service") return "Startup";
  if (head === "ssh") return "SSH";
  if (head === "git") return "Git";
  if (head === "env") return "Environment";
  return CATEGORY_PLAIN[category];
}

/** Colored tile per area, System Settings style. */
export const AREA_STYLE: Record<string, { color: import("../components/Tile").TileColor; icon: import("../components/Icons").IconName }> = {
  PATH: { color: "graphite", icon: "path" }, Shell: { color: "graphite", icon: "terminal" }, Aliases: { color: "graphite", icon: "terminal" },
  Python: { color: "blue", icon: "chip" }, "Node.js": { color: "green", icon: "shippingbox" }, Rust: { color: "orange", icon: "gear" },
  Homebrew: { color: "orange", icon: "box" }, Processes: { color: "green", icon: "waveform" }, Ports: { color: "teal", icon: "cable" },
  Storage: { color: "indigo", icon: "internaldrive" }, Ollama: { color: "pink", icon: "cpu" }, Startup: { color: "gray", icon: "gear" },
  SSH: { color: "yellow", icon: "key" }, Git: { color: "red", icon: "git" }, Environment: { color: "purple", icon: "sliders" },
  Terminal: { color: "graphite", icon: "terminal" }, macOS: { color: "gray", icon: "wrench-screwdriver" }, "AI tools": { color: "pink", icon: "cpu" },
};
export function areaStyle(area: string): { color: import("../components/Tile").TileColor; icon: import("../components/Icons").IconName } {
  return AREA_STYLE[area] ?? { color: "gray", icon: "info" };
}

/** What a passed check means, in one sentence, keyed by detector id. */
export const HEALTHY: Record<string, string> = {
  "shell.zsh.syntax": "Startup files parse correctly",
  "shell.path.duplicate": "PATH has no duplicate entries",
  "shell.path.missing_directory": "Every PATH entry exists",
  "shell.path.suspicious_entry": "No empty, relative or world-writable PATH entry",
  "shell.path.dangling_symlinks": "No broken command links in PATH",
  "shell.startup.errors": "Nothing prints an error when a terminal opens",
  "shell.startup.slow": "New terminals start quickly",
  "macos.xcode_clt": "Xcode Command Line Tools are installed",
  "shell.source.missing_file": "Every sourced file exists",
  "shell.source.recursive": "Startup files do not source each other in a loop",
  "shell.source.duplicate": "No file is sourced twice at startup",
  "shell.alias.shadow": "No alias replaces a developer command",
  "env.var.missing_path": "Tool variables point to existing folders",
  "python.interpreter.multiple": "python and python3 agree",
  "python.pip.mismatch": "pip installs into the Python you run",
  "node.multiple_installations": "One Node.js installation method",
  "node.npm.mismatch": "npm belongs to the active Node.js",
  "node.npm.global_prefix_not_writable": "npm can install global packages without sudo",
  "node.npm.stranded_globals": "Global npm packages follow the active Node.js version",
  "ai.claude_code.duplicate_install": "Claude Code is installed once",
  "rust.cargo_bin.not_in_path": "Rust tools are reachable",
  "homebrew.health": "Homebrew installation is healthy",
  "homebrew.doctor": "brew doctor reports no warnings",
  "process.dev.stale": "No abandoned development process",
  "port.dev.occupied": "No stale development server holds a port",
  "disk.homebrew.cache": "Homebrew cache is small",
  "disk.npm.cache": "npm cache is small",
  "disk.pip.cache": "pip cache is small",
  "disk.uv.cache": "uv cache is small",
  "disk.ollama.models": "Ollama models take little space",
  "disk.venv.broken": "Virtual environments are usable",
  "disk.node_modules.stale": "No large node_modules in inactive projects",
  "service.brew.running": "No Homebrew service starts at login",
  "service.launchagent.broken": "Startup items point to existing programs",
  "ssh.permissions": "SSH files have safe permissions",
  "ssh.config": "SSH configuration is consistent",
  "git.identity": "Git identity is configured",
};

export interface Finding {
  key: string;
  level: Level;
  category: Category;
  area: string;
  title: string;
  source: string;
  summary: string;
  issue?: Issue;
  detectorId: string;
}

export function findingFromIssue(issue: Issue, detectorName: string | undefined): Finding {
  return {
    key: issue.id,
    level: levelOf(issue.severity),
    category: issue.category,
    area: areaOf(issue.detector_id, issue.category),
    title: issue.title,
    source: detectorName ?? issue.detector_id,
    summary: issue.description,
    issue,
    detectorId: issue.detector_id,
  };
}

export function healthyFinding(run: DetectorRun, category: Category): Finding {
  return {
    key: `ok:${run.id}`,
    level: "healthy",
    category,
    area: areaOf(run.id, category),
    title: HEALTHY[run.id] ?? `${run.name}: nothing found`,
    source: run.name,
    summary: `The "${run.name}" check ran in ${run.duration_ms} ms and found nothing to report.`,
    detectorId: run.id,
  };
}

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
  run: "A command you wrapped with `devdoctor run` in the terminal. DevDoctor took a snapshot before and after, so everything the command changed is recorded.",
  backup: "A copy of a file taken before DevDoctor changes it, stored in DevDoctor's own folder.",
};

export function plainFixLabel(reversible: boolean, batchSafe: boolean): string {
  if (batchSafe) return "Fix safely";
  if (reversible) return "Fix (can be undone)";
  return "Fix…";
}
