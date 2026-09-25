// s5 — BRAND (47.30 → 60.00, ENGLISH). Six-vial line-up slams (47.50…48.75), « NO PROMISES. » (49.50) /
// « JUST » (50.39) « PROOF. » (50.75 slam) + flash (51.00), hard cut to black 51.35 (music dip = the silence),
// SONIC LOGO 52.40: symbol pop + glass glint (tink HF peak 52.43–52.45) + typed wordmark 52.40 → 52.95,
// « PURITY, » (53.60) « PROVEN. » (53.86 pop + underline), legal 54.40, CTA 55.00, cursor click 56.00,
// living hold to 60.00 (slow push, second sheen + glint 58.00). Everything on screen at 59.97.
PP.scene("s5", function (tl, root, cam) {
  const F = PP.F;
  const E = (tag, cls, parent, attrs) => PP.el(tag, cls, parent, attrs);
  const T = {
    OPEN: 47.3,
    POPS: [47.5, 47.75, 48.0, 48.25, 48.5, 48.75],
    SHEEN: 48.98,
    NO: 49.5, // « NO PROMISES. » slam (VO « No » 49.50)
    JUST: 50.39, // « JUST » (VO 50.39)
    PROOF: 50.75, // « PROOF. » slam (VO 50.75)
    FLASH: 51.0,
    BLACK: 51.35, // hard cut to black — hold through the music dip
    LOGO: 52.4, // sonic logo (click 52.40, glass tink peak 52.43–52.45)
    PURITY: 53.6,
    PROVEN: 53.86,
    LEGAL: 54.4,
    CTA: 55.0,
    CLICK: 56.0,
    SHEEN2: 58.0,
  };
  // show/hide by opacity at a hard-cut time (seek-safe: fromTo + immediateRender:false)
  const cutIn = (el, at) => tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: F / 2, ease: "none", immediateRender: false }, at - F / 2);
  const cutOut = (el, at) => tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: F / 2, ease: "none", immediateRender: false }, at - F / 2);
  // text metrics from canvas (the clip may be hidden while the timeline is built)
  const ctx = document.createElement("canvas").getContext("2d");
  const mw = (txt, font) => {
    ctx.font = font;
    return ctx.measureText(txt).width;
  };

  // ------------------------------------------------------------------ LINE-UP (47.30 → 51.35)
  const lineup = E("div", "s5-full", cam);
  const spot = E("div", "s5-spot", lineup);
  const floor = E("div", "s5-floor", lineup);
  const horizon = E("div", "s5-horizon", lineup);
  const row = E("div", "s5-row", lineup);

  // 47.30 (whoosh out of the offer): black stage already opaque (#s5 background). Floor + horizon open from the centre.
  gsap.set([horizon, spot, floor], { opacity: 0 });
  tl.fromTo(horizon, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.32, ease: "expo.out", immediateRender: false }, T.OPEN);
  tl.fromTo([spot, floor], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, T.OPEN);

  // camera dolly (sideways, left → right as the vials land) + gentle push, until the cut to black
  gsap.set(row, { x: 110 });
  tl.fromTo(row, { x: 110, scale: 1 }, { x: -110, scale: 1.035, duration: T.BLACK - T.OPEN, ease: "none", immediateRender: false }, T.OPEN);

  const FLOOR = 820,
    VH = 520,
    GAP = 280;
  PP.cfg.catalog.forEach((p, i) => {
    const at = T.POPS[i];
    const cx = 960 + (i - 2.5) * GAP;
    const unit = E("div", "s5-full", row);
    // backlight (rim / halo behind the glass)
    const back = E("div", "s5-back", unit);
    Object.assign(back.style, { left: cx - 210 + "px", top: FLOOR - VH - 60 + "px", width: "420px", height: VH + 120 + "px" });
    // reflection on the glossy floor
    const vw = VH * PP.VIAL_RATIO;
    const refl = E("div", "s5-refl", unit);
    Object.assign(refl.style, { left: cx - vw / 2 + "px", top: FLOOR + "px", width: vw + "px", height: VH * 0.62 + "px" });
    const rimg = E("img", "", refl, { src: p.img, alt: "" });
    rimg.style.height = VH + "px";
    // the vial
    const v = PP.vial(unit, p.img, VH);
    v.el.classList.add("s5-v");
    Object.assign(v.el.style, { left: cx - vw / 2 + "px", top: FLOOR - VH + "px" });
    const sheen = E("div", "s5-sheen", v.el);
    sheen.style.webkitMaskImage = sheen.style.maskImage = `url("${p.img}")`;
    // impact flare pieces
    const streak = E("div", "s5-streak", unit);
    Object.assign(streak.style, { left: cx - 360 + "px", top: FLOOR - 2 + "px", width: "720px" });
    const burst = E("div", "s5-burst", unit);
    Object.assign(burst.style, { left: cx - 170 + "px", top: FLOOR - 170 + "px", width: "340px", height: "340px" });
    const capb = E("div", "s5-burst", unit);
    Object.assign(capb.style, { left: cx - 110 + "px", top: FLOOR - VH - 80 + "px", width: "220px", height: "220px" });
    const ripple = E("div", "s5-ripple", unit);
    Object.assign(ripple.style, { left: cx - 230 + "px", top: FLOOR - 40 + "px", width: "460px", height: "80px" });
    gsap.set([v.el, refl, back, streak, burst, capb, ripple], { opacity: 0 });

    // SLAM: fall 4 frames (accelerating), land exactly on the pop, squash + settle
    const fall = 4 * F;
    tl.fromTo(v.el, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, at - fall);
    tl.fromTo(v.el, { y: -260, scaleY: 1.12, scaleX: 0.94 }, { y: 0, scaleY: 1.12, scaleX: 0.94, duration: fall, ease: "power3.in", immediateRender: false }, at - fall);
    tl.fromTo(v.el, { scaleY: 0.93, scaleX: 1.05 }, { scaleY: 1, scaleX: 1, duration: 0.32, ease: "elastic.out(1, 0.45)", immediateRender: false }, at);
    tl.fromTo(refl, { opacity: 0, y: 260 }, { opacity: 1, y: 0, duration: fall, ease: "power3.in", immediateRender: false }, at - fall);
    // impact light
    tl.fromTo(v.el, { filter: "brightness(1.9)" }, { filter: "brightness(1)", duration: 0.35, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(back, { opacity: 1.6, scale: 0.6 }, { opacity: 0.75, scale: 1, duration: 0.5, ease: "expo.out", immediateRender: false }, at);
    tl.fromTo(streak, { opacity: 1, scaleX: 0.15 }, { opacity: 0, scaleX: 1.25, duration: 0.42, ease: "power3.out", immediateRender: false }, at);
    tl.fromTo(burst, { opacity: 1, scale: 0.4 }, { opacity: 0, scale: 1.3, duration: 0.4, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(capb, { opacity: 0.9, scale: 0.3, rotation: 0 }, { opacity: 0, scale: 1.2, rotation: 25, duration: 0.3, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(ripple, { opacity: 0.9, scale: 0.15 }, { opacity: 0, scale: 1.1, duration: 0.55, ease: "power3.out", immediateRender: false }, at);
    // camera jolt on each impact
    tl.fromTo(cam, { y: 7 }, { y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }, at);
    // glass sheen once the line is complete (staggered left → right)
    PP.drive(tl, (x) => sheen.style.setProperty("--p", x.toFixed(1) + "%"), -40, 140, T.SHEEN + i * 0.07, 0.5, "power1.inOut");
  });

  // HARD CUT 49.50: the line-up goes dark and soft behind the manifesto (cut on the slam frame);
  // second framing jump on the « PROOF. » slam (50.75).
  const dim = E("div", "s5-dim", lineup);
  gsap.set(dim, { opacity: 0 });
  cutIn(dim, T.NO);
  tl.fromTo(row, { filter: "blur(0px)" }, { filter: "blur(9px)", duration: F / 2, ease: "none", immediateRender: false }, T.NO - F / 2);
  tl.fromTo(lineup, { scale: 1 }, { scale: 1.12, duration: F / 2, ease: "none", immediateRender: false }, T.NO - F / 2);
  tl.fromTo(lineup, { scale: 1.12 }, { scale: 1.15, duration: T.PROOF - T.NO, ease: "none", immediateRender: false }, T.NO);
  tl.fromTo(lineup, { scale: 1.15 }, { scale: 1.21, duration: F / 2, ease: "none", immediateRender: false }, T.PROOF - F / 2);
  tl.fromTo(lineup, { scale: 1.21 }, { scale: 1.23, duration: T.BLACK - T.PROOF, ease: "none", immediateRender: false }, T.PROOF);
  cutOut(lineup, T.BLACK);

  // ------------------------------------------------------------------ MANIFESTO (49.50 → 51.35)
  const mf = E("div", "s5-mf", cam);
  const l1 = E("div", "mf s5-line", mf, { text: "No promises." });
  const l2 = E("div", "mf s5-line", mf);
  const wJust = E("span", "s5-word", l2, { text: "Just" });
  l2.appendChild(document.createTextNode(" "));
  const wProof = E("span", "s5-word grad", l2, { text: "proof." });
  gsap.set([l1, wJust, wProof], { opacity: 0 });
  const slam = (el, at, o) => {
    cutIn(el, at);
    tl.fromTo(el, { scale: o.scale, filter: `blur(${o.blur}px)` }, { scale: 1, filter: "blur(0px)", duration: o.dur, ease: "expo.out", immediateRender: false }, at - F / 2);
  };
  slam(l1, T.NO, { scale: 1.38, blur: 10, dur: 0.3 });
  // « JUST » arrives with the voice, lighter; « PROOF. » is the slam
  slam(wJust, T.JUST - 0.03, { scale: 1.22, blur: 7, dur: 0.28 });
  gsap.set(wProof, { transformOrigin: "8% 58%" });
  slam(wProof, T.PROOF, { scale: 1.45, blur: 12, dur: 0.32 });
  // camera jolts on the two slams
  tl.fromTo(cam, { y: 9 }, { y: 0, duration: 0.22, ease: "power2.out", immediateRender: false }, T.NO);
  tl.fromTo(cam, { y: 11 }, { y: 0, duration: 0.22, ease: "power2.out", immediateRender: false }, T.PROOF);
  // line 1 nudges up a touch when « PROOF. » lands (weight)
  tl.fromTo(l1, { y: 0 }, { y: -6, duration: 0.25, ease: "power3.out", immediateRender: false }, T.PROOF);
  // FLASH at 51.00 + punch; « PROOF. » glows in the bloom
  const fxw = E("div", "s5-fxw", PP.layers.fx);
  PP.flashRing(tl, fxw, T.FLASH, { x: 960, y: 540 });
  cutOut(fxw, T.BLACK);
  tl.fromTo(mf, { scale: 1.08 }, { scale: 1, duration: 0.45, ease: "expo.out", immediateRender: false }, T.FLASH);
  tl.fromTo(wProof, { filter: "drop-shadow(0 0 60px rgba(46,230,201,1)) brightness(1.6)" }, { filter: "drop-shadow(0 0 30px rgba(46,230,201,0.35)) brightness(1)", duration: 0.6, ease: "power2.out", immediateRender: false }, T.FLASH);
  cutOut(mf, T.BLACK);

  // ------------------------------------------------------------------ BLACK (51.35 → 52.40) — the silence
  // Only a faint floor glow creeps in under the black, then blooms with the logo.
  const endglow = E("div", "s5-endglow", cam);
  gsap.set(endglow, { opacity: 0 });
  tl.fromTo(endglow, { opacity: 0 }, { opacity: 0.3, duration: 0.65, ease: "sine.in", immediateRender: false }, T.BLACK + 0.4);
  tl.fromTo(endglow, { opacity: 0.3 }, { opacity: 0.8, duration: 1.2, ease: "power2.out", immediateRender: false }, T.LOGO);
  tl.fromTo(endglow, { opacity: 0.8, scaleX: 1 }, { opacity: 1, scaleX: 1.08, duration: 1.4, ease: "sine.inOut", repeat: 3, yoyo: true, immediateRender: false }, 54.4);

  // ------------------------------------------------------------------ END CARD (52.40 → 60.00)
  const card = E("div", "s5-card", cam);
  // one slow, continuous push from the logo to the last frame (the hold keeps moving)
  tl.fromTo(card, { scale: 1 }, { scale: 1.045, duration: 60 - T.LOGO, ease: "none", immediateRender: false }, T.LOGO);

  // symbol — pops on the sonic-logo click (52.40)
  const SYM_H = 170,
    SYM_TOP = 178;
  const symglow = E("div", "s5-symglow", card);
  const symRow = E("div", "s5-center", card);
  symRow.style.top = SYM_TOP + "px";
  const sym = PP.symbol(symRow, SYM_H);
  gsap.set([sym.el, symglow], { opacity: 0 });
  tl.fromTo(sym.el, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, T.LOGO - F);
  tl.fromTo(sym.el, { scale: 0.58, y: 16 }, { scale: 1, y: 0, duration: 0.45, ease: "back.out(2.2)", immediateRender: false }, T.LOGO - F);
  tl.fromTo(sym.el, { filter: "brightness(2.4) drop-shadow(0 0 26px rgba(46,230,201,0.9))" }, { filter: "brightness(1) drop-shadow(0 0 0px rgba(46,230,201,0))", duration: 0.7, ease: "power2.out", immediateRender: false }, T.LOGO);
  tl.fromTo(symglow, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, T.LOGO);
  tl.fromTo(symglow, { opacity: 1 }, { opacity: 0.55, duration: 1.6, ease: "sine.inOut", repeat: 3, yoyo: true, immediateRender: false }, 53.2);

  // GLASS GLINT on the symbol's upper-right vertex — born with the click, peaks on the tink (52.43–52.47)
  const gx = 960 - SYM_H / PP.SYMBOL_RATIO / 2 + 0.96 * (SYM_H / PP.SYMBOL_RATIO),
    gy = SYM_TOP + 0.278 * SYM_H;
  const mkGlint = (big) => {
    const g = E("div", "s5-glint", card);
    Object.assign(g.style, { left: gx + "px", top: gy + "px" });
    E("i", "gh", g);
    E("i", "gv", g);
    E("i", "gd", g);
    E("i", "gd gd2", g);
    E("i", "gc", g);
    if (big) E("i", "gcore", g);
    gsap.set(g, { opacity: 0 });
    return g;
  };
  const glint = mkGlint(true);
  tl.fromTo(glint, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, T.LOGO - F);
  tl.fromTo(glint, { scale: 0.15, rotation: -12 }, { scale: 1.1, rotation: 0, duration: 0.07, ease: "power2.out", immediateRender: false }, T.LOGO - F);
  tl.fromTo(glint, { scale: 1.1, rotation: 0 }, { scale: 0.45, rotation: 32, duration: 0.55, ease: "power2.in", immediateRender: false }, 52.47);
  tl.fromTo(glint, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power2.in", immediateRender: false }, 52.5);
  // anamorphic streak through the symbol
  const astreak = E("div", "s5-astreak", card);
  astreak.style.top = gy - 2 + "px";
  astreak.style.left = gx - 800 + "px";
  gsap.set(astreak, { opacity: 0 });
  tl.fromTo(astreak, { opacity: 0.95, scaleX: 0.12 }, { opacity: 0, scaleX: 1, duration: 0.55, ease: "power3.out", immediateRender: false }, T.LOGO);
  // echo glint with the second sheen (58.00)
  const glint2 = mkGlint(false);
  tl.fromTo(glint2, { opacity: 0, scale: 0.2, rotation: 0 }, { opacity: 0.85, scale: 0.72, rotation: 14, duration: 0.14, ease: "power2.out", immediateRender: false }, T.SHEEN2 + 0.04);
  tl.fromTo(glint2, { opacity: 0.85, scale: 0.72, rotation: 14 }, { opacity: 0, scale: 0.3, rotation: 40, duration: 0.5, ease: "power2.in", immediateRender: false }, T.SHEEN2 + 0.18);

  // typed wordmark 52.40 → 52.95 with sheen; second sheen pass at 58.00
  const wmRow = E("div", "s5-center", card);
  wmRow.style.top = "400px";
  const wm = PP.typedWordmark(tl, wmRow, 980, T.LOGO);
  PP.drive(tl, (x) => wm.sheen.style.setProperty("--p", x.toFixed(1) + "%"), -40, 140, T.SHEEN2, 1.1, "power1.inOut");

  // tagline « PURITY, » (53.60) « PROVEN. » (53.86 pop, gradient, underline drawn)
  const TAG_PX = 124;
  const tagRow = E("div", "s5-center", card);
  tagRow.style.top = "566px";
  const tag = E("div", "mf s5-tag", tagRow);
  tag.style.fontSize = TAG_PX + "px";
  const wPur = E("span", "pp-w", tag, { text: "Purity," });
  tag.appendChild(document.createTextNode(" "));
  const wProWrap = E("span", "pp-w s5-under", tag);
  const wPro = E("span", "grad", wProWrap, { text: "proven." });
  gsap.set([wPur, wProWrap], { opacity: 0 });
  PP.wordIn(tl, wPur, T.PURITY - 0.06, { rise: 18, blur: 8, dur: 0.45 });
  gsap.set(wProWrap, { transformOrigin: "6% 60%" });
  tl.fromTo(wProWrap, { opacity: 0 }, { opacity: 1, duration: F / 2, ease: "none", immediateRender: false }, T.PROVEN - F / 2);
  tl.fromTo(wProWrap, { scale: 1.4, y: 0 }, { scale: 1, y: 0, duration: 0.42, ease: "back.out(2.4)", immediateRender: false }, T.PROVEN - F / 2);
  tl.fromTo(wPro, { filter: "brightness(2)" }, { filter: "brightness(1)", duration: 0.45, ease: "power2.out", immediateRender: false }, T.PROVEN);
  // underline (gradient stroke, drawn) — width from canvas metrics
  const proW = mw("PROVEN.", `400 ${TAG_PX}px Anton`) + TAG_PX * 0.03;
  const uw = Math.round(proW * 0.94);
  const us = PP.svg("svg", { width: uw, height: 14, viewBox: `0 0 ${uw} 14` }, wProWrap);
  const gid = PP.uid("s5g");
  const lg = PP.svg("linearGradient", { id: gid, x1: "0", y1: "0", x2: "1", y2: "0" }, PP.svg("defs", {}, us));
  PP.svg("stop", { offset: "0", "stop-color": "#5AA8FF" }, lg);
  PP.svg("stop", { offset: "0.45", "stop-color": "#38BDF8" }, lg);
  PP.svg("stop", { offset: "1", "stop-color": "#2EE6C9" }, lg);
  const upath = PP.svg("path", { d: `M4 8 Q ${uw * 0.5} 3 ${uw - 4} 7`, fill: "none", stroke: `url(#${gid})`, "stroke-width": 7, "stroke-linecap": "round" }, us);
  us.style.filter = "drop-shadow(0 0 10px rgba(46,230,201,0.6))";
  gsap.set(upath, { drawSVG: "0%" });
  PP.draw(tl, upath, T.PROVEN + 0.14, 0.38, { ease: "power3.out" });

  // legal line — outside the push (stays inside title-safe), 54.40 → 60.00
  const legal = E("div", "s5-legal", cam, { text: PP.cfg.legal });
  gsap.set(legal, { opacity: 0 });
  tl.fromTo(legal, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, T.LEGAL);

  // CTA pill (pop 55.00)
  const CTA_TOP = 772;
  const ctaRow = E("div", "s5-center", card);
  ctaRow.style.top = CTA_TOP + "px";
  const cta = E("div", "s5-cta", ctaRow);
  const fill = E("div", "s5-cta-fill", cta);
  const ring = E("div", "s5-cta-ring", cta);
  const csh = E("div", "s5-cta-sheen", cta);
  const TXT = "Check the tests",
    URL_TXT = PP.cfg.url;
  E("span", "", cta, { text: TXT });
  E("span", "s5-arrow", cta, { text: "→" });
  E("span", "s5-url", cta, { text: URL_TXT });
  gsap.set(cta, { opacity: 0 });
  tl.fromTo(cta, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, T.CTA - F);
  tl.fromTo(cta, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "back.out(2.2)", immediateRender: false }, T.CTA - F);
  tl.fromTo(ring, { opacity: 0.9, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.06, scaleY: 1.5, duration: 0.5, ease: "power2.out", immediateRender: false }, T.CTA);

  // cursor glides in 55.35 → 55.90, clicks 56.00 on the URL; button lights 1 frame before
  const wTxt = mw(TXT, '600 40px Inter, "PP Symbols"'),
    wArr = mw("→", '700 40px Inter, "PP Symbols"'),
    wUrl = mw(URL_TXT, '700 40px Inter, "PP Symbols"');
  const ctaW = 56 * 2 + wTxt + 26 + wArr + 26 + wUrl,
    ctaH = 24 + 48 + 26;
  const tipX = Math.round(960 - ctaW / 2 + 56 + wTxt + 26 + wArr + 26 + wUrl * 0.5),
    tipY = Math.round(CTA_TOP + ctaH * 0.6);
  const cur = PP.cursor(card, 1640, 1140);
  gsap.set(cur.el, { opacity: 0 });
  tl.fromTo(cur.el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none", immediateRender: false }, 55.35);
  tl.fromTo(cur.el, { x: 1640, y: 1140 }, { x: tipX, y: tipY, duration: 0.55, ease: "power3.out", immediateRender: false }, 55.35);
  cur.click(tl, T.CLICK);
  tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: F / 2, ease: "none", immediateRender: false }, T.CLICK - F - F / 2);
  tl.fromTo(fill, { opacity: 1 }, { opacity: 0.22, duration: 0.8, ease: "power2.out", immediateRender: false }, T.CLICK + 0.05);
  tl.fromTo(cta, { scale: 1 }, { scale: 0.965, duration: 0.07, ease: "power2.out", immediateRender: false }, T.CLICK);
  tl.fromTo(cta, { scale: 0.965 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, T.CLICK + 0.07);
  tl.fromTo(ring, { opacity: 1, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.08, scaleY: 1.7, duration: 0.7, ease: "power2.out", immediateRender: false }, T.CLICK);
  tl.fromTo(ring, { opacity: 0.7, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.05, scaleY: 1.45, duration: 0.8, ease: "power2.out", immediateRender: false }, T.CLICK + 0.25);
  // cursor drifts off so the card holds clean
  tl.fromTo(cur.el, { x: tipX, y: tipY, opacity: 1 }, { x: tipX + 150, y: tipY + 190, opacity: 0, duration: 0.7, ease: "power2.in", immediateRender: false }, 57.1);
  // idle glow breathing on the button during the hold + a light sheen across it (58.30)
  tl.fromTo(fill, { opacity: 0.22 }, { opacity: 0.4, duration: 1.4, ease: "sine.inOut", repeat: 1, yoyo: true, immediateRender: false }, 57.0);
  PP.drive(tl, (x) => csh.style.setProperty("--p", x.toFixed(1) + "%"), -30, 130, T.SHEEN2 + 0.3, 0.9, "power1.inOut");
});
