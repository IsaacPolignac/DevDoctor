// Facts and on-screen copy (French). Every value here is taken from purepeptide.care (FR version,
// captured 2026-09-24) or from the brief; nothing is invented.
(function () {
  const PP = (window.PP = window.PP || {});
  PP.cfg = {
    url: "purepeptide.care",
    coaUrl: "https://purepeptide.care/coa/",
    lab: "Janoshik Analytical",
    heroProduct: "BPC-157 / TB-500",
    heroPurity: "99.0", // product page: « Vérifié · Pureté HPLC 99.0% »
    countries: "10", // « Livraison vers 10 pays »
    tagline: "La pureté, prouvée.", // site hero
    cta: "Explorer le catalogue",
    legal: "Réservé à un usage de recherche · Non destiné à la consommation humaine ou animale · 21+",
    // brief catalog (all present on the site; MT-2 and Retatrutide deliberately excluded)
    catalog: [
      { name: "BPC-157 / TB-500", img: "assets/vials/bpc157-tb500-10.png", amount: "10 mg" },
      { name: "GHK-Cu", img: "assets/vials/ghk-cu-50.png", amount: "50 mg" },
      { name: "CJC-1295 / Ipamorelin", img: "assets/vials/cjc-1295-ipa-10.png", amount: "10 mg" },
      { name: "Selank", img: "assets/vials/selank-10.png", amount: "10 mg" },
      { name: "Semax", img: "assets/vials/semax-10.png", amount: "10 mg" },
      { name: "IGF-1 LR3", img: "assets/vials/igf-1-lr3-1.png", amount: "1 mg" },
    ],
    heroVial: "assets/vials/hero.png",
    // site trust bar / stats (verbatim FR)
    trust: ["Pureté HPLC ≥ 99 %", "Testé par un laboratoire indépendant", "Livraison vers 10 pays", "Expédition sous 24 h", "Livraison en chaîne du froid", "Paiement sécurisé"],
  };
})();
