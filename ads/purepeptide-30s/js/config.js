// Single source of truth for every brief variable. Values come from the
// <html data-composition-variables> declarations (overridable at render time with
// `npx hyperframes render --variables '{...}'`).
(function () {
  const PP = (window.PP = window.PP || {});
  const v = (window.__hyperframes && window.__hyperframes.getVariables && window.__hyperframes.getVariables()) || {};
  const pick = (k, d) => (v[k] !== undefined && v[k] !== null && v[k] !== "" ? String(v[k]) : d);

  PP.cfg = {
    logoUrl: pick("LOGO_URL", ""),
    vialUrls: pick("VIAL_URLS", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    coaProduct: pick("COA_PRODUCT", "BPC-157"),
    amount: pick("AMOUNT", "10 mg"),
    batch: pick("BATCH", "PP-2611-A"),
    purity: parseFloat(pick("PURITY", "99.3")),
    lab: pick("LAB", "INDEPENDENT LAB"),
    testDate: pick("TEST_DATE", "09/15/2026"),
    mExp: pick("M_EXP", "1419.5"),
    mObs: pick("M_OBS", "1419.6"),
    coaUrl: pick("COA_URL", "https://purepeptide.care/coa/PP-2611-A"),
    countries: pick("COUNTRIES", "30"),
    endCta: pick("END_CTA", "LAUNCHING DECEMBER 2026 · JOIN THE LIST"),
    catalog: ["BPC-157", "GHK-Cu", "CJC-1295 / Ipamorelin", "Selank", "Semax", "IGF-1 LR3"],
  };
})();
