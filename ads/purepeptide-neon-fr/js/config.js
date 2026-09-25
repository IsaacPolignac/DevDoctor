// Facts and on-screen copy (French). Every value comes from purepeptide.care (FR, captured 2026-09-24) or the
// original brief; nothing is invented. Plain-language copy for prospects who don't know the technical terms.
(function () {
  const PP = (window.PP = window.PP || {});
  PP.cfg = {
    url: "purepeptide.care",
    lab: "Janoshik Analytical", // « Chaque lot est analysé par Janoshik Analytical, un laboratoire tiers indépendant »
    heroProduct: "BPC-157 / TB-500",
    heroPurity: "99.0", // product page: « Vérifié · Pureté HPLC 99.0% »
    minPurity: "99", // home trust bar: « Pureté HPLC ≥ 99 % »
    countries: "10", // « Livraison vers 10 pays »
    shipping: "24 h", // « Expédition sous 24 h »
    tagline: "La pureté, prouvée.",
    legal: "Réservé à un usage de recherche · Non destiné à la consommation humaine ou animale · 21+",
    catalog: [
      { name: "BPC-157 / TB-500", img: "assets/vials/bpc157-tb500-10.png" },
      { name: "GHK-Cu", img: "assets/vials/ghk-cu-50.png" },
      { name: "CJC-1295 / Ipamorelin", img: "assets/vials/cjc-1295-ipa-10.png" },
      { name: "Selank", img: "assets/vials/selank-10.png" },
      { name: "Semax", img: "assets/vials/semax-10.png" },
      { name: "IGF-1 LR3", img: "assets/vials/igf-1-lr3-1.png" },
    ],
    heroVial: "assets/vials/hero.png",
    // desktop product page capture (assets/site/d-product.jpg, 1440 x 900 css px @2x)
    dProduct: { src: "assets/site/d-product.jpg", cssW: 1440, cssH: 900, purityLine: [765, 368, 468, 27], h1: [765, 310, 468, 45] },
  };
})();
