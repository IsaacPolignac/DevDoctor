// Browser demo mode: serves the sanitized fixtures written by `devdoctor demo-export` so the
// interface can be developed, reviewed and screenshotted in a plain browser. Mutations are
// simulated in memory. Never used inside the Tauri app.
import { demoEmit } from "./events";
import overview from "../demo/overview.json";
import system from "../demo/system.json";
import lastReport from "../demo/last_report.json";
import issues from "../demo/issues.json";
import path from "../demo/path.json";
import shell from "../demo/shell.json";
import processes from "../demo/processes.json";
import ports from "../demo/ports.json";
import storage from "../demo/storage.json";
import localai from "../demo/localai.json";
import runtimes from "../demo/runtimes.json";
import packages from "../demo/packages.json";
import tools from "../demo/tools.json";
import services from "../demo/services.json";
import git from "../demo/git.json";
import ssh from "../demo/ssh.json";
import snapshots from "../demo/snapshots.json";
import changes from "../demo/changes.json";
import transactions from "../demo/transactions.json";
import scans from "../demo/scans.json";
import detectors from "../demo/detectors.json";
import settings from "../demo/settings.json";
import resolve from "../demo/resolve.json";
import previews from "../demo/previews.json";
import type { DetectorRun, IssueRecord, Transaction } from "./types";

const state = {
  issues: issues as unknown as IssueRecord[],
  transactions: transactions as unknown as Transaction[],
  settings: { ...(settings as Record<string, unknown>) },
  report: lastReport as unknown as { detector_runs: DetectorRun[]; issues: unknown[]; health: { score: number; checks_passed: number; checks_total: number }; duration_ms: number; finished_at: string; detectors_failed: number } | null,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function fakeTransaction(issueId: string, title: string, reversible: boolean): Transaction {
  return {
    id: `tx_demo${Math.random().toString(16).slice(2, 10)}`,
    issue_id: issueId,
    fixer_id: "demo",
    title,
    status: "applied",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    operations: reversible ? [{ kind: "file_write", path: "~/.zshrc", after_sha256: "demo", backup_id: "bk_demo", created: false }] : [{ kind: "dir_delete", path: "~/Library/Caches/demo", bytes: 1200000000, entries: 4200 }],
    backups: reversible ? [{ id: "bk_demo", transaction_id: "tx_demo", original_path: "~/.zshrc", stored_path: "~/Library/Application Support/DevDoctor/backups/tx_demo/bk_demo-.zshrc", sha256: "demo", size: 1200, mode: 420, created_at: new Date().toISOString() }] : [],
    validation: { checks: [{ name: "zsh -n ~/.zshrc", passed: true, detail: "syntax OK" }, { name: "login shell restart", passed: true, detail: "fresh login shell started in 14 ms" }] },
    disk_space_recovered: reversible ? 0 : 1200000000,
    notes: [],
  };
}

export async function mockInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = (v: unknown) => clone(v) as T;
  switch (cmd) {
    case "get_overview": return r({ ...(overview as object), issues: { ...(overview as { issues: object }).issues, total: state.issues.filter((i) => !i.ignored).length } });
    case "get_system": return r(system);
    case "run_scan": {
      const runs = state.report?.detector_runs ?? [];
      demoEmit("scan-progress", { event: "started", total: runs.length, mode: args.mode });
      for (let i = 0; i < runs.length; i++) {
        demoEmit("scan-progress", { event: "detector_started", index: i, total: runs.length, id: runs[i].id, name: runs[i].name });
        await sleep(45);
        demoEmit("scan-progress", { event: "detector_finished", index: i, total: runs.length, id: runs[i].id, name: runs[i].name, issues: runs[i].issues, duration_ms: runs[i].duration_ms, failed: false });
      }
      demoEmit("scan-progress", { event: "finished", issues: state.issues.length, duration_ms: 900 });
      return r({ ...(state.report as object), issues: state.issues.map((i) => i.issue), finished_at: new Date().toISOString() });
    }
    case "get_last_report": return r(state.report);
    case "list_issues": return r(args.includeIgnored ? state.issues : state.issues.filter((i) => !i.ignored));
    case "get_issue": {
      const rec = state.issues.find((i) => i.issue.id === args.id);
      if (!rec) throw new Error(`issue ${args.id} not found`);
      const preview = (previews as Record<string, unknown>)[rec.issue.id];
      return r({ record: rec, fixer_name: rec.issue.fixer_available ? "Demo fixer" : undefined, preview: args.withPreview ? preview : undefined, transactions: state.transactions.filter((t) => t.issue_id === rec.issue.id) });
    }
    case "preview_fix": {
      const p = (previews as Record<string, unknown>)[String(args.id)];
      if (!p) throw new Error("no fix available for this issue in demo mode");
      await sleep(200);
      return r(p);
    }
    case "apply_fix": {
      await sleep(600);
      const rec = state.issues.find((i) => i.issue.id === args.id);
      if (!rec) throw new Error("issue not found");
      const tx = fakeTransaction(rec.issue.id, rec.issue.title, rec.issue.reversible);
      state.transactions.unshift(tx);
      state.issues = state.issues.filter((i) => i.issue.id !== args.id);
      return r(tx);
    }
    case "list_safe_fixes": return r(state.issues.filter((i) => !i.ignored && i.issue.batch_safe));
    case "apply_safe_fixes": {
      const out = [];
      for (const id of args.ids as string[]) {
        const rec = state.issues.find((i) => i.issue.id === id);
        if (!rec) continue;
        const tx = fakeTransaction(id, rec.issue.title, true);
        state.transactions.unshift(tx);
        state.issues = state.issues.filter((i) => i.issue.id !== id);
        out.push({ issue_id: id, title: rec.issue.title, ok: true, transaction: tx });
      }
      await sleep(500);
      return r(out);
    }
    case "rollback_transaction": {
      await sleep(400);
      const tx = state.transactions.find((t) => t.id === args.id);
      if (!tx) throw new Error("transaction not found");
      tx.status = "rolled_back";
      return r(tx);
    }
    case "ignore_issue": { const rec = state.issues.find((i) => i.issue.id === args.id); if (rec) rec.ignored = true; return r(null); }
    case "unignore_issue": { const rec = state.issues.find((i) => i.issue.id === args.id); if (rec) rec.ignored = false; return r(null); }
    case "list_transactions": return r(state.transactions);
    case "list_scans": return r(scans);
    case "get_path_report": return r(path);
    case "resolve_command": {
      const res = (resolve as Record<string, unknown>)[String(args.name)];
      if (!res) return r({ command: args.name, shell_function: false, others: [], precedence: [], notes: [`\`${args.name}\` was not found in PATH (demo data covers a few common commands only).`] });
      return r(res);
    }
    case "get_shell_report": return r(shell);
    case "read_shell_file": return r("# demo mode: file contents are not included in the fixtures\nexport PATH=\"$HOME/.local/bin:$PATH\"\n");
    case "list_processes": return r(processes);
    case "list_ports": return r(ports);
    case "preview_stop_process": return r({ fixer_id: "process.stop_user_dev_process", issue_id: "demo", title: `Stop process ${args.pid}`, summary: "Sends SIGTERM so the process can shut down cleanly. Nothing on disk is modified.", operations: [`Send SIGTERM to pid ${args.pid}`, "Wait up to 3 seconds for the process to exit"], files_modified: [], files_deleted: [], directories_deleted: [], commands_executed: [], processes_stopped: [{ pid: args.pid, name: "node", command: "node server.js" }], services_stopped: [], estimated_disk_space_recovered: 0, backup_created: false, risk: "low", reversible: false, requires_confirmation: true, batch_safe: false, notes: ["Unsaved state inside the process is lost."], validations: ["The process is no longer running after 3 seconds."] });
    case "stop_process": await sleep(500); return r(fakeTransaction("demo", `Stop process ${args.pid}`, false));
    case "scan_storage": {
      const cats = (storage as { categories: { id: string; label: string }[] } | null)?.categories ?? [];
      for (let i = 0; i < cats.length; i++) { demoEmit("storage-progress", { event: "category", id: cats[i].id, label: cats[i].label, index: i, total: cats.length }); await sleep(60); }
      demoEmit("storage-progress", { event: "finished", duration_ms: 800 });
      return r(storage);
    }
    case "get_last_storage": return r(storage);
    case "preview_delete_node_modules": case "preview_delete_venv": return r({ fixer_id: "demo", issue_id: "demo", title: `Delete ${args.path}`, summary: "Deletes the folder only; the project's code stays.", operations: [`Delete directory ${args.path}`], files_modified: [], files_deleted: [], directories_deleted: [{ path: args.path, bytes: 800000000, entries: 21000 }], commands_executed: [], processes_stopped: [], services_stopped: [], estimated_disk_space_recovered: 800000000, backup_created: false, risk: "low", reversible: false, requires_confirmation: true, batch_safe: false, notes: ["Dependencies can be recreated with npm install."], validations: ["The directory no longer exists and the project directory still does."] });
    case "delete_node_modules": case "delete_venv": await sleep(500); return r(fakeTransaction("demo", `Delete ${args.path}`, false));
    case "get_local_ai": return r(localai);
    case "preview_remove_ollama_model": return r({ fixer_id: "ai.ollama.remove_model", issue_id: "demo", title: `Remove Ollama model ${args.model}`, summary: `Runs \`ollama rm ${args.model}\`.`, operations: [`ollama rm ${args.model}`], files_modified: [], files_deleted: [], directories_deleted: [], commands_executed: [{ program: "ollama", args: ["rm", String(args.model)], description: "Remove the model with Ollama's own command" }], processes_stopped: [], services_stopped: [], estimated_disk_space_recovered: 4900000000, backup_created: false, risk: "medium", reversible: false, requires_confirmation: true, batch_safe: false, notes: [`The model can be downloaded again with \`ollama pull ${args.model}\`.`], validations: ["The model no longer appears in Ollama's local store."] });
    case "remove_ollama_model": await sleep(500); return r(fakeTransaction("demo", `Remove ${args.model}`, false));
    case "get_runtimes": return r(runtimes);
    case "get_packages": return r(packages);
    case "get_tools": return r(tools);
    case "get_services": return r(services);
    case "get_git": return r(git);
    case "get_ssh": return r(ssh);
    case "list_snapshots": return r(snapshots);
    case "create_snapshot": await sleep(300); return r({ id: `snap_demo${Date.now()}`, kind: args.kind, label: args.label, created_at: new Date().toISOString(), summary: { counts: { path: 1 } } });
    case "get_changes": return r(changes);
    case "search": {
      const q = String(args.query).toLowerCase();
      const pages = [["overview", "Overview"], ["problems", "Problems"], ["shell", "Shell"], ["path", "PATH Explorer"], ["resolve", "Command Resolution"], ["runtimes", "Runtimes"], ["packages", "Packages"], ["processes", "Processes"], ["ports", "Ports"], ["storage", "Developer Storage"], ["localai", "Local AI"], ["services", "Startup Items"], ["tools", "Developer Tools"], ["git", "Git"], ["ssh", "SSH"], ["history", "History"], ["changes", "What Changed"], ["settings", "Settings"]].filter(([id, l]) => id.includes(q) || l.toLowerCase().includes(q)).map(([id, label]) => ({ id, label }));
      const cmds = Object.keys(resolve as object).filter((c) => c.includes(q));
      const iss = state.issues.map((i) => i.issue).filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
      const prt = (ports as { port: number }[]).filter((p) => String(p.port) === q.replace("port", "").trim());
      return r({ issues: iss, commands: cmds, pages, ports: prt, detectors: (detectors as { id: string; name: string }[]).filter((d) => d.id.includes(q) || d.name.toLowerCase().includes(q)) });
    }
    case "get_settings": return r(state.settings);
    case "set_setting": state.settings[String(args.key)] = args.value; return r(null);
    case "get_detectors": return r(detectors);
    case "reveal_path": return r(null);
    case "set_window_theme": return r(null);
    case "export_report": return r({ generated_at: new Date().toISOString(), devdoctor_version: "0.1.0", sanitized: true, included: ["system information", "last scan results", "PATH", "shell startup files", "runtimes and tools", "startup services"], system, last_scan: state.report, path, shell, runtimes, packages, tools, services });
    default: throw new Error(`demo mode: unknown command ${cmd}`);
  }
}
