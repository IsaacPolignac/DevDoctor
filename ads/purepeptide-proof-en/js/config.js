// Facts and on-screen copy (ENGLISH). Every value is quoted from purepeptide.care (?lang=en, checked 2026-09-25).
(function () {
  const PP = (window.PP = window.PP || {});
  PP.cfg = {
    url: "purepeptide.care",
    lab: "Janoshik Analytical", // independent third-party lab named on the site
    heroPurity: "99.0", // product page « Verified · HPLC purity 99.0% »
    minPurity: "99", // « HPLC ≥ 99% purity »
    countries: "10", // « Shipping to 10 countries »
    shipping: "24 h", // « Your order ships within 24 hours »
    offers: ["2 vials · 5% off", "3+ vials · 8% off", "Free shipping over $200"], // shop + cart, applied automatically
    tagline: "Purity, proven.", // site hero H1
    legal: "For laboratory research use only · Not for human or veterinary consumption · 21+",
    catalog: [
      { name: "BPC-157 / TB-500", img: "assets/vials/bpc157-tb500-10.png" },
      { name: "GHK-Cu", img: "assets/vials/ghk-cu-50.png" },
      { name: "CJC-1295 / Ipamorelin", img: "assets/vials/cjc-1295-ipa-10.png" },
      { name: "Selank", img: "assets/vials/selank-10.png" },
      { name: "Semax", img: "assets/vials/semax-10.png" },
      { name: "IGF-1 LR3", img: "assets/vials/igf-1-lr3-1.png" },
    ],
    heroVial: "assets/vials/hero.png",
    fakeShelf: "assets/img/fake_shelf.png", // AI still (generic unlabeled vials, no brand) — pain section only
    siteTest: { src: "assets/site-test/site_test.mp4", w: 1920, h: 1200, cssScale: 1.3334, at: 31.4, dur: 14.2 },
  };
})();
