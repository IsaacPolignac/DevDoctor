// Facts and on-screen copy (French). Every value comes from purepeptide.care (FR, checked 2026-09-25) or the brief.
(function () {
  const PP = (window.PP = window.PP || {});
  PP.cfg = {
    url: "purepeptide.care",
    lab: "Janoshik Analytical",
    heroPurity: "99.0", // product page « Vérifié · Pureté HPLC 99.0% »
    minPurity: "99", // « Pureté HPLC ≥ 99 % »
    countries: "10",
    shipping: "24 h",
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
    fakeShelf: "assets/img/fake_shelf.png", // AI still (ElevenLabs · Seedream 5 Pro): generic unlabeled vials, no brand
    // real site test recording (tools/record_site.cjs): 1920x1200 (1440x900 css @1.333), 30 fps, 426 frames
    siteTest: { src: "assets/site-test/site_test.mp4", w: 1920, h: 1200, cssScale: 1.3334, at: 30.4, dur: 14.2 },
  };
})();
