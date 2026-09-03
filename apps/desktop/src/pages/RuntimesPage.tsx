import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading } from "../components/Basics";

export function RuntimesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.runtimes(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="runtimes" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { node, python, rust } = r.data;
  return (
    <div>
      <h1>Runtimes</h1>
      <h2>Node.js</h2>
      {node.npm_mismatch && <div className="notice">npm belongs to a different Node installation ({shortenHome(node.npm_mismatch.npm_prefix, home)}) than node ({shortenHome(node.npm_mismatch.node_prefix, home)}). See Problems.</div>}
      <KeyValue rows={[["node", node.active_node ? <span className="mono">{shortenHome(node.active_node.path, home)} {node.active_node.version ?? ""}</span> : "not found"], ["npm", node.active_npm ? <span className="mono">{shortenHome(node.active_npm.path, home)} {node.active_npm.version ?? ""}</span> : "not found"], ["Version managers", node.managers.join(", ") || "none detected"]]} />
      <div style={{ height: 8 }} />
      <DataTable columns={[{ key: "active", label: "", width: "60px", render: (i) => (i.active ? <span className="badge ok">active</span> : null) }, { key: "version", label: "Version", render: (i) => (i.version ? `v${i.version}` : "?") }, { key: "label", label: "Installed via" }, { key: "binary", label: "Binary", render: (i) => <span className="mono">{shortenHome(i.binary, home)}</span> }]} rows={node.installations} rowKey={(i) => i.binary} empty="No Node.js installation found." />
      <h2>Python</h2>
      {python.python_python3_mismatch && <div className="notice">{python.python_python3_mismatch}</div>}
      {python.pip_mismatches.map((m) => <div key={m.pip_command} className="notice">{m.pip_command} installs into {shortenHome(m.pip_interpreter, home)} while {m.python_command} runs {shortenHome(m.python_real_path ?? m.python_path, home)}. See Problems.</div>)}
      <KeyValue rows={[["python", python.python ? <span className="mono">{shortenHome(python.python.path, home)} — {python.python.version ?? ""}</span> : "not found"], ["python3", python.python3 ? <span className="mono">{shortenHome(python.python3.path, home)} — {python.python3.version ?? ""}</span> : "not found"], ["pip3", python.pip3 ? <span className="mono">{shortenHome(python.pip3.path, home)} — {python.pip3.version ?? ""}</span> : "not found"], ["Alias", python.python_alias ? <span className="mono">python={python.python_alias}</span> : "—"]]} />
      <div style={{ height: 8 }} />
      <DataTable columns={[{ key: "active", label: "", width: "60px", render: (i) => (i.active ? <span className="badge ok">active</span> : null) }, { key: "version", label: "Version", render: (i) => i.version ?? "?" }, { key: "label", label: "Installed via" }, { key: "binary", label: "Binary", render: (i) => <span className="mono">{shortenHome(i.binary, home)}</span> }]} rows={python.installations} rowKey={(i) => i.binary} empty="No Python installation found." />
      {python.broken_links.length > 0 && <Card title="Broken Homebrew Python links"><ul className="section-list">{python.broken_links.map((b) => <li key={b} className="mono">{b}</li>)}</ul></Card>}
      <h2>Rust</h2>
      <KeyValue rows={[["rustup", rust.rustup_installed ? `installed (${shortenHome(rust.rustup_home, home)})` : "not installed"], ["cargo", rust.cargo ? <span className="mono">{shortenHome(rust.cargo.path, home)} — {rust.cargo.version ?? ""}</span> : "not found"], ["rustc", rust.rustc ? <span className="mono">{rust.rustc.version ?? shortenHome(rust.rustc.path, home)}</span> : "not found"], ["~/.cargo/bin in PATH", rust.cargo_bin_in_path ? "yes" : "no"], ["Default toolchain", rust.default_toolchain ?? "—"], ["Toolchains", rust.toolchains.map((t) => t.name).join(", ") || "—"], ["cargo install binaries", rust.installed_crates.length ? rust.installed_crates.map((c) => `${c.name} ${c.version}`).join(", ") : "—"]]} />
      {rust.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
    </div>
  );
}
