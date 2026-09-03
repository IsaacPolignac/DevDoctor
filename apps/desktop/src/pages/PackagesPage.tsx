import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading } from "../components/Basics";

export function PackagesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const [withSizes, setWithSizes] = useState(false);
  const r = useAsync(() => api.packages(withSizes), [refreshKey, withSizes]);
  if (r.loading && !r.data) return <Loading what="package managers" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { managers, homebrew } = r.data;
  return (
    <div>
      <h1>Packages</h1>
      <div className="filters"><label className="check"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> measure cache sizes (slower)</label></div>
      <DataTable
        columns={[
          { key: "name", label: "Manager" },
          { key: "installed", label: "Status", render: (m) => (m.installed ? <span className="badge ok">installed</span> : <span className="muted">—</span>) },
          { key: "version", label: "Version", render: (m) => m.version ?? "" },
          { key: "package_count", label: "Packages", className: "num", render: (m) => (m.package_count != null ? String(m.package_count) : "") },
          { key: "location", label: "Location", render: (m) => (m.location ? <span className="mono">{shortenHome(m.location, home)}</span> : "") },
          { key: "cache", label: "Cache", render: (m) => (m.cache_path ? <span className="mono">{shortenHome(m.cache_path, home)}{m.cache_size != null ? ` (${formatBytes(m.cache_size)})` : ""}</span> : "") },
        ]}
        rows={managers}
        rowKey={(m) => m.id}
      />
      <h2>Homebrew</h2>
      {!homebrew.installed ? <p className="muted">Homebrew is not installed.</p> : (
        <div className="grid cols-2">
          <Card>
            <KeyValue rows={[["Version", homebrew.version ?? "?"], ["Prefix", <span className="mono">{homebrew.prefix}</span>], ["Expected prefix for this Mac", <span className="mono">{homebrew.expected_prefix}</span>], ["Second installation", homebrew.other_prefix ? <span className="mono">{homebrew.other_prefix}</span> : "none"], ["brew in PATH", homebrew.in_path ? "yes" : "no"], ["Formulae", String(homebrew.formulae.length)], ["Casks", String(homebrew.casks.length)], ["Cache", <span className="mono">{shortenHome(homebrew.cache_dir, home)}{homebrew.cache_size ? ` (${formatBytes(homebrew.cache_size.allocated)})` : ""}</span>]]} />
          </Card>
          <Card>
            <h3>Broken links</h3>
            {homebrew.broken_links.length === 0 ? <p className="muted">None.</p> : <ul className="section-list">{homebrew.broken_links.slice(0, 20).map((b) => <li key={b.link} className="mono">{b.link} → {b.target}</li>)}</ul>}
            <h3>Several versions installed</h3>
            {homebrew.versioned_duplicates.length === 0 ? <p className="muted">None.</p> : <ul className="section-list">{homebrew.versioned_duplicates.map((g) => <li key={g[0]}>{g.join(", ")}</li>)}</ul>}
          </Card>
        </div>
      )}
      {homebrew.installed && (
        <>
          <h2>Formulae</h2>
          <DataTable columns={[{ key: "name", label: "Formula" }, { key: "versions", label: "Versions", render: (f) => f.versions.join(", ") }, { key: "linked", label: "Linked", render: (f) => (f.linked ? "yes" : "no") }]} rows={homebrew.formulae} rowKey={(f) => f.name} />
        </>
      )}
    </div>
  );
}
