import { useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useNav } from "../lib/nav";
import { formatBytes, shortenHome } from "../lib/format";
import { Card, DataTable, ErrorBox, KeyValue, Loading, PageHeader, Pill, Term } from "../components/Basics";
import { t } from "../lib/i18n";

export function PackagesPage({ refreshKey }: { refreshKey: number }) {
  const { home } = useNav();
  const [withSizes, setWithSizes] = useState(false);
  const r = useAsync(() => api.packages(withSizes), [refreshKey, withSizes]);
  if (r.loading && !r.data) return <Loading what="package managers" />;
  if (r.error || !r.data) return <ErrorBox error={r.error} />;
  const { managers, homebrew } = r.data;
  return (
    <div className="page">
      <PageHeader title={t("Package managers")} subtitle={<>{t("The tools that install software for you, and where they keep it. A ")}<Term k="package manager">{t("package manager")}</Term>'s <Term k="cache">{t("cache")}</Term> {t(" can always be cleared safely.")}</>} actions={<label className="check small"><input type="checkbox" checked={withSizes} onChange={(e) => setWithSizes(e.target.checked)} /> {t(" measure cache sizes")}</label>} />
      <DataTable
        columns={[
          { key: "name", label: t("Manager"), render: (m) => <b>{m.name}</b> },
          { key: "installed", label: "", render: (m) => (m.installed ? <Pill tone="green">{t("installed")}</Pill> : <Pill>{t("not installed")}</Pill>) },
          { key: "version", label: t("Version"), render: (m) => <span className="truncate" style={{ maxWidth: 220, display: "inline-block" }} title={m.version}>{m.version ?? ""}</span> },
          { key: "package_count", label: t("Packages"), className: "num", render: (m) => (m.package_count != null ? String(m.package_count) : "") },
          { key: "location", label: t("Location"), render: (m) => (m.location ? <span className="mono selectable">{shortenHome(m.location, home)}</span> : "") },
          { key: "cache", label: t("Cache"), render: (m) => (m.cache_path ? <span className="mono selectable">{shortenHome(m.cache_path, home)}{m.cache_size != null ? ` · ${formatBytes(m.cache_size)}` : ""}</span> : "") },
        ]}
        rows={managers}
        rowKey={(m) => m.id}
      />
      <h2>{t("Homebrew")}</h2>
      {!homebrew.installed ? <Card><p className="muted">{t("Homebrew is not installed.")}</p></Card> : (
        <div className="grid cols-2">
          <Card>
            <KeyValue rows={[[t("Version"), homebrew.version ?? "?"], [t("Installed at"), <span className="mono">{homebrew.prefix}</span>], [t("Expected on this Mac"), <span className="mono">{homebrew.expected_prefix}</span>], [t("Second installation"), homebrew.other_prefix ? <span className="mono">{homebrew.other_prefix}</span> : "none"], [t("brew in PATH"), homebrew.in_path ? "yes" : "no"], [t("Formulae"), String(homebrew.formulae.length)], [t("Casks (apps)"), String(homebrew.casks.length)], [t("Cache"), <span className="mono">{shortenHome(homebrew.cache_dir, home)}{homebrew.cache_size ? ` · ${formatBytes(homebrew.cache_size.allocated)}` : ""}</span>]]} />
          </Card>
          <Card>
            <h3>{t("Broken links")}</h3>
            {homebrew.broken_links.length === 0 ? <p className="muted small">{t("None.")}</p> : <ul className="section-list">{homebrew.broken_links.slice(0, 20).map((b) => <li key={b.link} className="mono">{b.link} → {b.target}</li>)}</ul>}
            <h3>{t("Several versions installed")}</h3>
            {homebrew.versioned_duplicates.length === 0 ? <p className="muted small">{t("None.")}</p> : <ul className="section-list">{homebrew.versioned_duplicates.map((g) => <li key={g[0]}>{g.join(", ")}</li>)}</ul>}
          </Card>
        </div>
      )}
      {homebrew.installed && (
        <>
          <h2>{t("Installed formulae")}</h2>
          <DataTable columns={[{ key: "name", label: t("Formula") }, { key: "versions", label: t("Versions"), render: (f) => f.versions.join(", ") }, { key: "linked", label: t("Linked"), render: (f) => (f.linked ? "yes" : "no") }]} rows={homebrew.formulae} rowKey={(f) => f.name} />
        </>
      )}
    </div>
  );
}
