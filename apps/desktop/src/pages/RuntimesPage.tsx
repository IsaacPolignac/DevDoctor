import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading, PageHeader, Pill } from "../components/Basics";
import { t } from "../lib/i18n";

export function RuntimesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const r = useAsync(() => api.runtimes(), [refreshKey]);
  if (r.loading && !r.data) return <Loading what="languages" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { node, python, rust } = r.data;
  const active = (a: boolean) => (a ? <Pill tone="green">{t("in use")}</Pill> : null);
  return (
    <div className="page">
      <PageHeader title={t("Languages")} subtitle={t("Every copy of Node.js, Python and Rust found on this Mac, and which one your terminal actually uses. Several copies are normal; surprises happen when tools disagree about which one to use.")} />
      <h2>{t("Node.js")}</h2>
      {node.npm_mismatch && <div className="notice">{t("npm belongs to a different Node than the one that runs (")}{shortenHome(node.npm_mismatch.npm_prefix, home)} {t(" vs ")}{shortenHome(node.npm_mismatch.node_prefix, home)}{t("). See Issues.")}</div>}
      <Card>
        <KeyValue rows={[["node", node.active_node ? <span className="mono selectable">{shortenHome(node.active_node.path, home)} · {node.active_node.version ?? ""}</span> : t("not found")], ["npm", node.active_npm ? <span className="mono selectable">{shortenHome(node.active_npm.path, home)} · {node.active_npm.version ?? ""}</span> : t("not found")], [t("Version managers"), node.managers.join(", ") || t("none detected")]]} />
      </Card>
      <div style={{ height: 10 }} />
      <DataTable columns={[{ key: "active", label: "", width: "70px", render: (i) => active(i.active) }, { key: "version", label: t("Version"), render: (i) => (i.version ? `v${i.version}` : "?") }, { key: "label", label: t("Installed by") }, { key: "binary", label: t("Location"), render: (i) => <span className="mono selectable">{shortenHome(i.binary, home)}</span> }]} rows={node.installations} rowKey={(i) => i.binary} empty={t("No Node.js installation found.")} />
      <h2>{t("Python")}</h2>
      {python.python_python3_mismatch && <div className="notice">{python.python_python3_mismatch}</div>}
      {python.pip_mismatches.map((m) => <div key={m.pip_command} className="notice">{m.pip_command} {t(" installs packages for ")}{shortenHome(m.pip_interpreter, home)} {t(" while ")}{m.python_command} {t(" runs ")}{shortenHome(m.python_real_path ?? m.python_path, home)}{t(". See Issues.")}</div>)}
      <Card>
        <KeyValue rows={[["python", python.python ? <span className="mono selectable">{shortenHome(python.python.path, home)} · {python.python.version ?? ""}</span> : t("not found")], ["python3", python.python3 ? <span className="mono selectable">{shortenHome(python.python3.path, home)} · {python.python3.version ?? ""}</span> : t("not found")], ["pip3", python.pip3 ? <span className="mono selectable">{shortenHome(python.pip3.path, home)} · {python.pip3.version ?? ""}</span> : t("not found")], [t("Alias"), python.python_alias ? <span className="mono">python={python.python_alias}</span> : "—"]]} />
      </Card>
      <div style={{ height: 10 }} />
      <DataTable columns={[{ key: "active", label: "", width: "70px", render: (i) => active(i.active) }, { key: "version", label: t("Version"), render: (i) => i.version ?? "?" }, { key: "label", label: t("Installed by") }, { key: "binary", label: t("Location"), render: (i) => <span className="mono selectable">{shortenHome(i.binary, home)}</span> }]} rows={python.installations} rowKey={(i) => i.binary} empty={t("No Python installation found.")} />
      {python.broken_links.length > 0 && <Card title={t("Broken Homebrew Python links")}><ul className="section-list">{python.broken_links.map((b) => <li key={b} className="mono">{b}</li>)}</ul></Card>}
      <h2>{t("Rust")}</h2>
      <Card>
        <KeyValue rows={[["rustup", rust.rustup_installed ? t("installed ({path})", { path: shortenHome(rust.rustup_home, home) }) : t("not installed")], ["cargo", rust.cargo ? <span className="mono selectable">{shortenHome(rust.cargo.path, home)} · {rust.cargo.version ?? ""}</span> : t("not found")], ["rustc", rust.rustc ? <span className="mono">{rust.rustc.version ?? shortenHome(rust.rustc.path, home)}</span> : t("not found")], [t("~/.cargo/bin in PATH"), rust.cargo_bin_in_path ? t("yes") : t("no")], [t("Default toolchain"), rust.default_toolchain ?? "—"], [t("Toolchains"), rust.toolchains.map((t) => t.name).join(", ") || "—"], [t("Installed with cargo install"), rust.installed_crates.length ? rust.installed_crates.map((c) => `${c.name} ${c.version}`).join(", ") : "—"]]} />
        {rust.notes.map((n, i) => <div key={i} className="notice">{n}</div>)}
      </Card>
    </div>
  );
}
