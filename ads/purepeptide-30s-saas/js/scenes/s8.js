// s8 — END CARD (23.80–30.00). VO L7 « PurePeptide, la pureté, prouvée. »
// 23.92 a soft brand bloom (radial mask + gradient ring) opens from the logo point (540, 334) over s67's exit.
// 24.00 the official symbol pops centred (shimmer), then 24.05–24.65 the lock-up slides left into its centred
// position while the official wordmark wipes in left → right beside it (horizontal lock-up, as in the site
// header); one light sweep crosses the wordmark (24.50–25.20).
// 24.40 the hero vial rises into place (float + contact shadow). Tagline « La pureté, prouvée. » word by word on
// L7 words 2–4; 26.20 chime = a light shine across « prouvée. ». 26.40 CTA row (navy pill + URL), legal fully
// visible from 27.00, 28.00–30.00 hold with camera push + vial float. Last frame (29.967) complete.
// Every visual state is a pure function of timeline time (fromTo / PP.drive, no callbacks).
(function () {
  const PP = window.PP;

  PP.scene("s8", function (tl, root, cam) {
    const el = PP.el;
    const px = (n) => n + "px";
    const place = (e, x, y, w, h) => {
      e.style.left = px(x);
      e.style.top = px(y);
      if (w != null) e.style.width = px(w);
      if (h != null) e.style.height = px(h);
      return e;
    };
    const setMask = (e, m) => {
      e.style.webkitMaskImage = m;
      e.style.maskImage = m;
    };

    // ------------------------------------------------------------------ timing (absolute seconds)
    const L7 = PP.VO.find((l) => l.id === "L7");
    const LEAD = 0.08; // same lead as PP.voHeadline
    const T_BLOOM = 23.92,
      D_BLOOM = 0.55;
    const T_PANEL_OUT = 24.3; // s67 is gone at 24.20: let the global background back in
    const T_SYM = 24.0; // shimmer
    const T_WIPE = 24.05,
      D_WIPE = 0.55; // wordmark mask wipe 24.05 → 24.60
    const T_WM_SWEEP = 24.5,
      D_WM_SWEEP = 0.7;
    const T_VIAL = 24.4,
      D_VIAL = 1.0;
    const T_WORD = [L7.words[1].t0 - LEAD, L7.words[2].t0 - LEAD, L7.words[3].t0 - LEAD]; // la, pureté, prouvée
    const T_CHIME = 26.2;
    const T_CTA = 26.4,
      T_URL = 26.55;
    const T_LEGAL = 26.72,
      D_LEGAL = 0.26; // fully visible from 26.98
    const T_VIAL_SWEEP = 27.3,
      D_VIAL_SWEEP = 0.9;
    const END = 30;

    // ------------------------------------------------------------------ layout (scene px, camera at rest)
    const CX = 540;
    // horizontal lock-up: symbol + wordmark (as in the site header)
    const SYM_H = 120,
      SYM_W = SYM_H / PP.SYMBOL_RATIO;
    const WM_W = 640,
      WM_H = WM_W * PP.WORDMARK_RATIO;
    const GAP = 30;
    const LOCK_W = SYM_W + GAP + WM_W;
    const LX = CX - LOCK_W / 2;
    const LY = 334; // lock-up centre line (symbol 274 → 394)
    // tagline
    const TAG_TOP = 425; // glyphs ≈ 438 (caps) → 505 (descenders)
    // hero vial (hero.png 1024 x 1536, vial occupies cols 196..829, rows 6..1525)
    const VH = 610,
      K = VH / 1519,
      IW = 1024 * K,
      IH = 1536 * K;
    const VT = 552,
      VB = VT + VH;
    const IX = CX - 512.5 * K,
      IY = VT - 6 * K;
    const VCY = VT + VH * 0.52;
    // CTA row + legal
    const CTA_Y = 1237; // pill 1195 → 1279
    const LEGAL_TOP = 1313; // 2 lines → 1375

    // ------------------------------------------------------------------ transition: bloom over s67
    const trans = el("div", "s8-trans");
    root.insertBefore(trans, cam);
    const panel = el("div", "s8-panel", trans);
    el("div", "s8-panel-core", panel);
    const ringSvg = PP.svg("svg", { class: "s8-ring", width: 1080, height: 1920, viewBox: "0 0 1080 1920" }, trans);
    const rg = PP.uid("s8rg");
    const rdefs = PP.svg("defs", {}, ringSvg);
    const rlg = PP.svg("linearGradient", { id: rg, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 1080, y2: 1920 }, rdefs);
    PP.svg("stop", { offset: "0", "stop-color": PP.C.navy }, rlg);
    PP.svg("stop", { offset: "0.55", "stop-color": PP.C.blue }, rlg);
    PP.svg("stop", { offset: "1", "stop-color": PP.C.teal }, rlg);
    const BX = CX,
      BY = LY,
      FEATHER = 170; // bloom opens from the symbol's pop point
    const ring = PP.svg("circle", { cx: BX, cy: BY, r: 0, fill: "none", stroke: `url(#${rg})`, "stroke-width": 3 }, ringSvg);
    PP.drive(
      tl,
      (r) => {
        setMask(panel, `radial-gradient(circle at ${BX}px ${BY}px, #000 ${r.toFixed(1)}px, rgba(0,0,0,0) ${(r + FEATHER).toFixed(1)}px)`);
        ring.setAttribute("r", Math.max(0, r + FEATHER * 0.6).toFixed(1));
      },
      -FEATHER,
      1900,
      T_BLOOM,
      D_BLOOM,
      "power3.out"
    );
    tl.fromTo(ringSvg, { opacity: 0 }, { opacity: 0.85, duration: 0.08, ease: "none" }, T_BLOOM);
    tl.fromTo(ringSvg, { opacity: 0.85 }, { opacity: 0, duration: 0.4, ease: "power2.in", immediateRender: false }, T_BLOOM + 0.12);
    tl.fromTo(panel, { opacity: 1 }, { opacity: 0, duration: 0.7, ease: "power1.inOut", immediateRender: false }, T_PANEL_OUT);

    // ------------------------------------------------------------------ stage (camera push lives on `cam`)
    const stage = el("div", "s8-stage", cam);

    // soft light behind the vial
    const halo = place(el("div", "s8-halo", stage), CX - 430, VCY - 430, 860, 860);
    const halo2 = place(el("div", "s8-halo teal", stage), CX - 60, VCY - 40, 520, 520);
    const hair = place(el("div", "s8-hair", stage), CX - 330, VCY - 330, 660, 660);

    // ---- lock-up
    const lock = place(el("div", "s8-lock", stage), LX, LY - SYM_H / 2, LOCK_W, SYM_H);
    const LOCK_OFF = CX - (LX + SYM_W / 2); // symbol pops centred, then the lock-up slides into place
    const symGlow = place(el("div", "s8-symglow", lock), SYM_W / 2 - 130, SYM_H / 2 - 130, 260, 260);
    const symPing = place(el("div", "s8-ping", lock), SYM_W / 2 - 90, SYM_H / 2 - 90, 180, 180);
    const symWrap = place(el("div", "s8-sym", lock), 0, 0, SYM_W, SYM_H);
    PP.symbol(symWrap, SYM_H);
    const wm = place(el("div", "s8-wm", lock), SYM_W + GAP, (SYM_H - WM_H) / 2, WM_W, WM_H);
    const wmInner = el("div", "s8-wm-in", wm);
    PP.logo(wmInner, { width: WM_W });
    // light sweep, masked by the wordmark's own shapes
    const wmShine = el("div", "s8-wm-shine", wm);
    setMask(wmShine, 'url("assets/brand/brand-wordmark.svg")');
    const wmBand = el("div", "s8-band", wmShine);

    // ---- tagline « La pureté, prouvée. » (word 1 of L7, « PurePeptide », is the logo)
    const head = place(el("div", "s8-head", stage), 0, TAG_TOP);
    const h = PP.headline(head, ["La pureté, *prouvée.*"], "h2");
    const proof = h.words[2];
    proof.classList.add("s8-proof");

    // ---- hero vial
    const vrig = el("div", "s8-vrig", stage);
    const shadow = place(el("div", "s8-shadow", vrig), CX - 170, VB - 26, 340, 52);
    const shadowIn = el("i", "", shadow);
    const vfloat = el("div", "s8-vfloat", vrig);
    const vial = place(el("div", "s8-vial", vfloat), IX, IY, IW, IH);
    el("img", "", vial, { src: PP.cfg.heroVial, alt: "" });
    const vShine = el("div", "s8-vshine", vial);
    setMask(vShine, 'url("' + PP.cfg.heroVial + '")');
    const vBand = el("div", "s8-band v", vShine);

    // ---- CTA row: navy pill (site primary button) + URL
    const cta = place(el("div", "s8-cta", stage), 0, CTA_Y - 42, 1080, 84);
    const btn = el("div", "s8-btn", cta);
    el("span", "s8-btn-t", btn, { text: PP.cfg.cta });
    const arrow = el("span", "s8-btn-a", btn, { text: "→" });
    const url = el("div", "s8-url", cta);
    el("i", "s8-url-dot", url);
    el("span", "", url, { text: PP.cfg.url });

    // ---- legal (mandatory, ≥ 20 px, 2 centred lines)
    const legal = place(el("div", "s8-legal", stage), 0, LEGAL_TOP, 1080);
    const parts = PP.cfg.legal.split(" · ");
    el("div", "", legal, { text: parts[0] });
    el("div", "", legal, { text: parts.slice(1).join(" · ") });

    // ================================================================== motion
    // camera: slow push for the whole card (keeps the hold alive, text stays in the safe zone)
    tl.fromTo(cam, { scale: 1 }, { scale: 1.015, duration: END - T_SYM, ease: "none", immediateRender: false }, T_SYM);

    // light behind the vial
    tl.fromTo([halo, halo2], { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, T_VIAL - 0.1);
    tl.fromTo(hair, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1.4, ease: "expo.out" }, T_VIAL + 0.1);
    tl.fromTo(hair, { rotation: 0 }, { rotation: 18, duration: END - T_VIAL, ease: "none", immediateRender: false }, T_VIAL);

    // symbol pop (24.00, shimmer)
    tl.fromTo(symWrap, { scale: 0.35, rotation: -14, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(2.2)" }, T_SYM);
    tl.fromTo(symGlow, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.55, duration: 0.3, ease: "power2.out" }, T_SYM);
    tl.fromTo(symGlow, { opacity: 0.55 }, { opacity: 0, duration: 0.7, ease: "power1.in", immediateRender: false }, T_SYM + 0.3);
    tl.fromTo(symPing, { scale: 0.55 }, { scale: 1.7, duration: 0.85, ease: "power2.out" }, T_SYM + 0.04);
    tl.fromTo(symPing, { opacity: 0 }, { opacity: 0.9, duration: 0.05, ease: "none" }, T_SYM + 0.04);
    tl.fromTo(symPing, { opacity: 0.9 }, { opacity: 0, duration: 0.75, ease: "power2.out", immediateRender: false }, T_SYM + 0.1);

    // lock-up slides left from "symbol centred" to "lock-up centred" while the wordmark wipes in
    tl.fromTo(lock, { x: LOCK_OFF }, { x: 0, duration: 0.6, ease: "power3.inOut" }, T_WIPE);
    // wordmark: soft-edged mask wipe left → right + a small slide
    const WF = 22; // feather, % of the wordmark width
    PP.drive(
      tl,
      (p) => {
        const e = -WF + p * (100 + WF);
        setMask(wm, `linear-gradient(90deg, #000 ${e.toFixed(2)}%, rgba(0,0,0,0) ${(e + WF).toFixed(2)}%)`);
      },
      0,
      1,
      T_WIPE,
      D_WIPE,
      "power2.inOut"
    );
    tl.fromTo(wmInner, { x: -26 }, { x: 0, duration: D_WIPE + 0.2, ease: "power3.out" }, T_WIPE);
    // one light sweep across the wordmark
    tl.fromTo(wmBand, { xPercent: -100 }, { xPercent: 360, duration: D_WM_SWEEP, ease: "power2.inOut" }, T_WM_SWEEP);

    // hero vial rises into place
    tl.fromTo(vial, { y: 110, scale: 0.9, opacity: 0, filter: "blur(10px)" }, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: D_VIAL, ease: "expo.out" }, T_VIAL);
    tl.fromTo(shadow, { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: D_VIAL, ease: "expo.out" }, T_VIAL + 0.1);
    // gentle float (finite sine legs) + shadow breathing in counter-phase
    const F0 = T_VIAL + 0.7,
      FL = (END - F0) / 2;
    tl.fromTo(vfloat, { y: 0 }, { y: -9, duration: FL, ease: "sine.inOut", immediateRender: false }, F0);
    tl.fromTo(vfloat, { y: -9 }, { y: -2, duration: FL, ease: "sine.inOut", immediateRender: false }, F0 + FL);
    tl.fromTo(shadowIn, { scale: 1 }, { scale: 0.9, duration: FL, ease: "sine.inOut", immediateRender: false }, F0);
    tl.fromTo(shadowIn, { scale: 0.9 }, { scale: 0.975, duration: FL, ease: "sine.inOut", immediateRender: false }, F0 + FL);
    // one light sweep across the vial
    tl.fromTo(vBand, { xPercent: -130 }, { xPercent: 300, duration: D_VIAL_SWEEP, ease: "power2.inOut" }, T_VIAL_SWEEP);

    // tagline words on L7 (la · pureté · prouvée)
    h.words.forEach((w, i) => PP.wordIn(tl, w, T_WORD[i], { dur: 0.6 }));
    // 26.20 chime: a light shine across « prouvée. » (gradient text + moving highlight layer)
    PP.drive(
      tl,
      (p) => {
        proof.style.backgroundPosition = `${(100 - p * 100).toFixed(2)}% 0%, 0% 0%`;
      },
      0,
      1,
      T_CHIME,
      0.5,
      "power1.inOut"
    );

    // CTA row
    tl.fromTo(btn, { scale: 0.72, y: 26, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.9)" }, T_CTA);
    tl.fromTo(url, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, T_URL);
    // arrow nudges on the beat during the hold
    [27.5, 28.5, 29.5].forEach((t) => {
      tl.fromTo(arrow, { x: 0 }, { x: 7, duration: 0.18, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo(arrow, { x: 7 }, { x: 0, duration: 0.3, ease: "power2.inOut", immediateRender: false }, t + 0.18);
    });

    // legal
    tl.fromTo(legal, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D_LEGAL, ease: "power2.out" }, T_LEGAL);
  });
})();
