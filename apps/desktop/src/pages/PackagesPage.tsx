import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading, PageHeader, Pill, Term } from "../components/Basics";

export function PackagesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const [withSizes, setWithSizes] = useState(false);
  const r = useAsync(() => api.packages(withSizes), [refreshKey, withSizes]);
  if (r.loading && !r.data) return <Loading what="package managers" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { managers, homebrew } = r.data;
  return (
    <div className="page">
      <PageHeader title="Package managers" subtitle={<>The tools that install software for you, and where they keep it. A <Term k="package manager">package manager</Term>'s <Term k="cache">cache</Term> can always be cleared safely.</>} actions={<label className="check small"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> measure cache sizes</label>} />
      <DataTable
        columns={[
          { key: "name", label: "Manager", render: (m) => <b>{m.name}</b> },
          { key: "installed", label: "", render: (m) => (m.installed ? <Pill tone="green">installed</Pill> : <Pill>not installed</Pill>) },
          { key: "version", label: "Version", render: (m) => <span className="truncate" style={{ maxWidth: 220, display: "inline-block" }} title={m.version}>{m.version ?? ""}</span> },
          { key: "package_count", label: "Packages", className: "num", render: (m) => (m.package_count != null ? String(m.package_count) : "") },
          { key: "location", label: "Location", render: (m) => (m.location ? <span className="mono selectable">{shortenHome(m.location, home)}</span> : "") },
          { key: "cache", label: "Cache", render: (m) => (m.cache_path ? <span className="mono selectable">{shortenHome(m.cache_path, home)}{m.cache_size != null ? ` · ${formatBytes(m.cache_size)}` : ""}</span> : "") },
        ]}
        rows={managers}
        rowKey={(m) => m.id}
      />
      <h2>Homebrew</h2>
      {!homebrew.installed ? <Card><p className="muted">Homebrew is not installed.</p></Card> : (
        <div className="grid cols-2">
          <Card>
            <KeyValue rows={[["Version", homebrew.version ?? "?"], ["Installed at", <span className="mono">{homebrew.prefix}</span>], ["Expected on this Mac", <span className="mono">{homebrew.expected_prefix}</span>], ["Second installation", homebrew.other_prefix ? <span className="mono">{homebrew.other_prefix}</span> : "none"], ["brew in PATH", homebrew.in_path ? "yes" : "no"], ["Formulae", String(homebrew.formulae.length)], ["Casks (apps)", String(homebrew.casks.length)], ["Cache", <span className="mono">{shortenHome(homebrew.cache_dir, home)}{homebrew.cache_size ? ` · ${formatBytes(homebrew.cache_size.allocated)}` : ""}</span>]]} />
          </Card>
          <Card>
            <h3>Broken links</h3>
            {homebrew.broken_links.length === 0 ? <p className="muted small">None.</p> : <ul className="section-list">{homebrew.broken_links.slice(0, 20).map((b) => <li key={b.link} className="mono">{b.link} → {b.target}</li>)}</ul>}
            <h3>Several versions installed</h3>
            {homebrew.versioned_duplicates.length === 0 ? <p className="muted small">None.</p> : <ul className="section-list">{homebrew.versioned_duplicates.map((g) => <li key={g[0]}>{g.join(", ")}</li>)}</ul>}
          </Card>
        </div>
      )}
      {homebrew.installed && (
        <>
          <h2>Installed formulae</h2>
          <DataTable columns={[{ key: "name", label: "Formula" }, { key: "versions", label: "Versions", render: (f) => f.versions.join(", ") }, { key: "linked", label: "Linked", render: (f) => (f.linked ? "yes" : "no") }]} rows={homebrew.formulae} rowKey={(f) => f.name} />
        </>
      )}
    </div>
  );
}
