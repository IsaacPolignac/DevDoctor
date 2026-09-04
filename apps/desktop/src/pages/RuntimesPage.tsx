import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading, PageHeader, Pill } from "../components/Basics";

export function RuntimesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.runtimes(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="languages" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { node, python, rust } = r.data;
  const active = (a: boolean) => (a ? <Pill tone="green">in use</Pill> : null);
  return (
    <div className="page">
      <PageHeader title="Languages" subtitle="Every copy of Node.js, Python and Rust found on this Mac, and which one your terminal actually uses. Several copies are normal; surprises happen when tools disagree about which one to use." />
      <h2>Node.js</h2>
      {node.npm_mismatch && <div className="notice">npm belongs to a different Node than the one that runs ({shortenHome(node.npm_mismatch.npm_prefix, home)} vs {shortenHome(node.npm_mismatch.node_prefix, home)}). See Issues.</div>}
      <Card>
        <KeyValue rows={[["node", node.active_node ? <span className="mono selectable">{shortenHome(node.active_node.path, home)} · {node.active_node.version ?? ""}</span> : "not found"], ["npm", node.active_npm ? <span className="mono selectable">{shortenHome(node.active_npm.path, home)} · {node.active_npm.version ?? ""}</span> : "not found"], ["Version managers", node.managers.join(", ") || "none detected"]]} />
      </Card>
      <div style={{ height: 10 }} />
      <DataTable columns={[{ key: "active", label: "", width: "70px", render: (i) => active(i.active) }, { key: "version", label: "Version", render: (i) => (i.version ? `v${i.version}` : "?") }, { key: "label", label: "Installed by" }, { key: "binary", label: "Location", render: (i) => <span className="mono selectable">{shortenHome(i.binary, home)}</span> }]} rows={node.installations} rowKey={(i) => i.binary} empty="No Node.js installation found." />
      <h2>Python</h2>
      {python.python_python3_mismatch && <div className="notice">{python.python_python3_mismatch}</div>}
      {python.pip_mismatches.map((m) => <div key={m.pip_command} className="notice">{m.pip_command} installs packages for {shortenHome(m.pip_interpreter, home)} while {m.python_command} runs {shortenHome(m.python_real_path ?? m.python_path, home)}. See Issues.</div>)}
      <Card>
        <KeyValue rows={[["python", python.python ? <span className="mono selectable">{shortenHome(python.python.path, home)} · {python.python.version ?? ""}</span> : "not found"], ["python3", python.python3 ? <span className="mono selectable">{shortenHome(python.python3.path, home)} · {python.python3.version ?? ""}</span> : "not found"], ["pip3", python.pip3 ? <span className="mono selectable">{shortenHome(python.pip3.path, home)} · {python.pip3.version ?? ""}</span> : "not found"], ["Alias", python.python_alias ? <span className="mono">python={python.python_alias}</span> : "—"]]} />
      </Card>
      <div style={{ height: 10 }} />
      <DataTable columns={[{ key: "active", label: "", width: "70px", render: (i) => active(i.active) }, { key: "version", label: "Version", render: (i) => i.version ?? "?" }, { key: "label", label: "Installed by" }, { key: "binary", label: "Location", render: (i) => <span className="mono selectable">{shortenHome(i.binary, home)}</span> }]} rows={python.installations} rowKey={(i) => i.binary} empty="No Python installation found." />
      {python.broken_links.length > 0 && <Card title="Broken Homebrew Python links"><ul className="section-list">{python.broken_links.map((b) => <li key={b} className="mono">{b}</li>)}</ul></Card>}
      <h2>Rust</h2>
      <Card>
        <KeyValue rows={[["rustup", rust.rustup_installed ? `installed (${shortenHome(rust.rustup_home, home)})` : "not installed"], ["cargo", rust.cargo ? <span className="mono selectable">{shortenHome(rust.cargo.path, home)} · {rust.cargo.version ?? ""}</span> : "not found"], ["rustc", rust.rustc ? <span className="mono">{rust.rustc.version ?? shortenHome(rust.rustc.path, home)}</span> : "not found"], ["~/.cargo/bin in PATH", rust.cargo_bin_in_path ? "yes" : "no"], ["Default toolchain", rust.default_toolchain ?? "—"], ["Toolchains", rust.toolchains.map((t) => t.name).join(", ") || "—"], ["Installed with cargo install", rust.installed_crates.length ? rust.installed_crates.map((c) => `${c.name} ${c.version}`).join(", ") : "—"]]} />
        {rust.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
      </Card>
    </div>
  );
}
