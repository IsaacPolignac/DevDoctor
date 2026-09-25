// s5 — BRAND (44.30 → 60.00). Six-vial line-up slams (44.50…45.75), « PAS DE PROMESSES. » (46.53) /
// « DES PREUVES. » (47.83) + flash #3 (48.00), symbol + typed wordmark (49.53), tagline (50.83 / 51.72),
// CTA pop (53.00) + cursor click (54.00), legal line (52.40 → 60.00), living hold to 60.00.
PP.scene("s5", function (tl, root, cam) {
  const F = PP.F;
  const E = (tag, cls, parent, attrs) => PP.el(tag, cls, parent, attrs);
  // show/hide by opacity at a hard-cut time (seek-safe: fromTo + immediateRender:false)
  const cutIn = (el, at) => tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: F / 2, ease: "none", immediateRender: false }, at - F / 2);
  const cutOut = (el, at) => tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: F / 2, ease: "none", immediateRender: false }, at - F / 2);

  // ------------------------------------------------------------------ LINE-UP (44.30 → 49.20)
  const lineup = E("div", "s5-full", cam);
  const spot = E("div", "s5-spot", lineup);
  const floor = E("div", "s5-floor", lineup);
  const horizon = E("div", "s5-horizon", lineup);
  const row = E("div", "s5-row", lineup);

  // 44.30: black stage is already opaque (#s5 background). Floor + horizon line open from the centre.
  tl.fromTo(horizon, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.32, ease: "expo.out", immediateRender: false }, 44.3);
  tl.fromTo([spot, floor], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 44.3);
  gsap.set([horizon, spot, floor], { opacity: 0 });

  // camera dolly (sideways, left → right as the vials land) + gentle push
  tl.fromTo(row, { x: 110, scale: 1 }, { x: -110, scale: 1.035, duration: 49.2 - 44.3, ease: "none", immediateRender: false }, 44.3);
  gsap.set(row, { x: 110 });

  const FLOOR = 820,
    VH = 520,
    GAP = 280;
  const POPS = [44.5, 44.75, 45.0, 45.25, 45.5, 45.75];
  const vials = [];
  PP.cfg.catalog.forEach((p, i) => {
    const at = POPS[i];
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
    const cap = E("div", "s5-burst", unit);
    Object.assign(cap.style, { left: cx - 110 + "px", top: FLOOR - VH - 80 + "px", width: "220px", height: "220px" });
    const ripple = E("div", "s5-ripple", unit);
    Object.assign(ripple.style, { left: cx - 230 + "px", top: FLOOR - 40 + "px", width: "460px", height: "80px" });
    gsap.set([v.el, refl, back, streak, burst, cap, ripple], { opacity: 0 });

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
    tl.fromTo(cap, { opacity: 0.9, scale: 0.3, rotation: 0 }, { opacity: 0, scale: 1.2, rotation: 25, duration: 0.3, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(ripple, { opacity: 0.9, scale: 0.15 }, { opacity: 0, scale: 1.1, duration: 0.55, ease: "power3.out", immediateRender: false }, at);
    // camera jolt on each impact
    tl.fromTo(cam, { y: 7 }, { y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }, at);
    // glass sheen once the line is complete (staggered left → right)
    PP.drive(tl, (x) => sheen.style.setProperty("--p", x.toFixed(1) + "%"), -40, 140, 45.98 + i * 0.07, 0.5, "power1.inOut");
    vials.push({ v, back });
  });
  // HARD CUT 46.53: line-up goes dark and soft behind the manifesto (cut at the frame of the slam)
  const dim = E("div", "s5-dim", lineup);
  gsap.set(dim, { opacity: 0 });
  cutIn(dim, 46.53);
  tl.fromTo(row, { filter: "blur(0px)" }, { filter: "blur(9px)", duration: F / 2, ease: "none", immediateRender: false }, 46.53 - F / 2);
  tl.fromTo(lineup, { scale: 1 }, { scale: 1.12, duration: F / 2, ease: "none", immediateRender: false }, 46.53 - F / 2);
  tl.fromTo(lineup, { scale: 1.12 }, { scale: 1.16, duration: 49.2 - 46.53, ease: "none", immediateRender: false }, 46.53);
  cutOut(lineup, 49.2);

  // ------------------------------------------------------------------ MANIFESTO (46.53 → 49.20)
  const mf = E("div", "s5-mf", cam);
  const l1 = E("div", "mf s5-line", mf, { text: "Pas de promesses." });
  const l2 = E("div", "mf s5-line", mf);
  l2.appendChild(document.createTextNode("Des "));
  E("span", "grad", l2, { text: "preuves." });
  gsap.set([l1, l2], { opacity: 0 });
  const slam = (el, at) => {
    cutIn(el, at);
    tl.fromTo(el, { scale: 1.38, filter: "blur(10px)" }, { scale: 1, filter: "blur(0px)", duration: 0.3, ease: "expo.out", immediateRender: false }, at - F / 2);
  };
  slam(l1, 46.53);
  slam(l2, 47.83);
  // line 1 nudges up a touch when line 2 lands (weight)
  tl.fromTo(l1, { y: 0 }, { y: -6, duration: 0.25, ease: "power3.out", immediateRender: false }, 47.83);
  // FLASH #3 at 48.00 + punch
  PP.flashRing(tl, PP.layers.fx, 48.0, { x: 960, y: 540 });
  tl.fromTo(mf, { scale: 1.08 }, { scale: 1, duration: 0.45, ease: "expo.out", immediateRender: false }, 48.0);
  tl.fromTo(l2.lastChild, { filter: "drop-shadow(0 0 60px rgba(46,230,201,1)) brightness(1.6)" }, { filter: "drop-shadow(0 0 30px rgba(46,230,201,0.35)) brightness(1)", duration: 0.6, ease: "power2.out", immediateRender: false }, 48.0);
  cutOut(mf, 49.2);

  // ------------------------------------------------------------------ END CARD (49.20 → 60.00)
  const endglow = E("div", "s5-endglow", cam);
  gsap.set(endglow, { opacity: 0 });
  tl.fromTo(endglow, { opacity: 0 }, { opacity: 0.7, duration: 1.2, ease: "power2.out", immediateRender: false }, 49.3);
  tl.fromTo(endglow, { opacity: 0.7, scaleX: 1 }, { opacity: 1, scaleX: 1.08, duration: 1.5, ease: "sine.inOut", repeat: 3, yoyo: true, immediateRender: false }, 54.0);

  const card = E("div", "s5-card", cam);
  // slow push over the hold
  tl.fromTo(card, { scale: 1 }, { scale: 1.04, duration: 6, ease: "power1.inOut", immediateRender: false }, 54.0);

  // symbol (pops 49.30 → 49.50)
  const symglow = E("div", "s5-symglow", card);
  const symRow = E("div", "s5-center", card);
  symRow.style.top = "178px";
  const sym = PP.symbol(symRow, 170);
  gsap.set([sym.el, symglow], { opacity: 0 });
  tl.fromTo(sym.el, { opacity: 0, scale: 0.55, y: 18 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(2.2)", immediateRender: false }, 49.3);
  tl.fromTo(symglow, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, 49.3);
  tl.fromTo(symglow, { opacity: 1 }, { opacity: 0.55, duration: 1.6, ease: "sine.inOut", repeat: 5, yoyo: true, immediateRender: false }, 50.2);

  // typed wordmark (49.53 → 50.08) with sheen, second sheen pass at 56.5
  const wmRow = E("div", "s5-center", card);
  wmRow.style.top = "400px";
  const wm = PP.typedWordmark(tl, wmRow, 980, 49.53);
  PP.drive(tl, (x) => wm.sheen.style.setProperty("--p", x.toFixed(1) + "%"), -40, 140, 56.5, 1.1, "power1.inOut");

  // tagline « LA PURETÉ, » (50.83 / 50.90) « PROUVÉE. » (51.72 pop, gradient, underline drawn)
  const tagRow = E("div", "s5-center", card);
  tagRow.style.top = "568px";
  const tag = E("div", "mf s5-tag", tagRow);
  const wLa = E("span", "pp-w", tag, { text: "La" });
  tag.appendChild(document.createTextNode(" "));
  const wPur = E("span", "pp-w", tag, { text: "pureté," });
  tag.appendChild(document.createTextNode(" "));
  const wProWrap = E("span", "pp-w s5-under", tag);
  const wPro = E("span", "grad", wProWrap, { text: "prouvée." });
  gsap.set([wLa, wPur, wProWrap], { opacity: 0 });
  PP.wordIn(tl, wLa, 50.83 - 0.06, { rise: 18, blur: 8, dur: 0.45 });
  PP.wordIn(tl, wPur, 50.9 - 0.06, { rise: 18, blur: 8, dur: 0.45 });
  tl.fromTo(wProWrap, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, 51.72 - F);
  tl.fromTo(wProWrap, { scale: 1.45, y: 0 }, { scale: 1, y: 0, duration: 0.42, ease: "back.out(2.4)", immediateRender: false }, 51.72 - F);
  tl.fromTo(wPro, { filter: "brightness(2)" }, { filter: "brightness(1)", duration: 0.45, ease: "power2.out", immediateRender: false }, 51.72);
  // underline (gradient stroke, drawn)
  const uw = wProWrap.offsetWidth * 0.94;
  const us = PP.svg("svg", { width: uw, height: 14, viewBox: `0 0 ${uw} 14` }, wProWrap);
  const gid = PP.uid("s5g");
  const lg = PP.svg("linearGradient", { id: gid, x1: "0", y1: "0", x2: "1", y2: "0" }, PP.svg("defs", {}, us));
  PP.svg("stop", { offset: "0", "stop-color": "#5AA8FF" }, lg);
  PP.svg("stop", { offset: "0.45", "stop-color": "#38BDF8" }, lg);
  PP.svg("stop", { offset: "1", "stop-color": "#2EE6C9" }, lg);
  const upath = PP.svg("path", { d: `M4 8 Q ${uw * 0.5} 3 ${uw - 4} 7`, fill: "none", stroke: `url(#${gid})`, "stroke-width": 7, "stroke-linecap": "round" }, us);
  us.style.filter = "drop-shadow(0 0 10px rgba(46,230,201,0.6))";
  gsap.set(upath, { drawSVG: "0%" });
  PP.draw(tl, upath, 51.86, 0.38, { ease: "power3.out" });

  // CTA pill (pop 53.00)
  const ctaRow = E("div", "s5-center", card);
  ctaRow.style.top = "772px";
  const cta = E("div", "s5-cta", ctaRow);
  const fill = E("div", "s5-cta-fill", cta);
  const ring = E("div", "s5-cta-ring", cta);
  E("span", "", cta, { text: "Testez vous-même" });
  E("span", "s5-arrow", cta, { text: "→" });
  const url = E("span", "s5-url", cta, { text: PP.cfg.url });
  gsap.set(cta, { opacity: 0 });
  tl.fromTo(cta, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, 53.0 - F);
  tl.fromTo(cta, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "back.out(2.2)", immediateRender: false }, 53.0 - F);
  tl.fromTo(ring, { opacity: 0.9, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.06, scaleY: 1.5, duration: 0.5, ease: "power2.out", immediateRender: false }, 53.0);

  // cursor glides in 53.30 → 53.90, clicks 54.00 on the URL; button lights 1 frame before
  const ctaW = cta.offsetWidth,
    ctaH = cta.offsetHeight;
  const tipX = 960 + ctaW / 2 - url.offsetWidth * 0.42 - 56,
    tipY = 772 + ctaH * 0.58;
  const cur = PP.cursor(card, 1640, 1140);
  gsap.set(cur.el, { opacity: 0 });
  tl.fromTo(cur.el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none", immediateRender: false }, 53.3);
  tl.fromTo(cur.el, { x: 1640, y: 1140 }, { x: tipX, y: tipY, duration: 0.6, ease: "power3.out", immediateRender: false }, 53.3);
  cur.click(tl, 54.0);
  tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: F / 2, ease: "none", immediateRender: false }, 54.0 - F - F / 2);
  tl.fromTo(fill, { opacity: 1 }, { opacity: 0.22, duration: 0.8, ease: "power2.out", immediateRender: false }, 54.05);
  tl.fromTo(cta, { scale: 1 }, { scale: 0.965, duration: 0.07, ease: "power2.out", immediateRender: false }, 54.0);
  tl.fromTo(cta, { scale: 0.965 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, 54.07);
  tl.fromTo(ring, { opacity: 1, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.08, scaleY: 1.7, duration: 0.7, ease: "power2.out", immediateRender: false }, 54.0);
  tl.fromTo(ring, { opacity: 0.7, scaleX: 1, scaleY: 1 }, { opacity: 0, scaleX: 1.05, scaleY: 1.45, duration: 0.8, ease: "power2.out", immediateRender: false }, 54.25);
  // cursor drifts off so the card holds clean
  tl.fromTo(cur.el, { x: tipX, y: tipY, opacity: 1 }, { x: tipX + 150, y: tipY + 190, opacity: 0, duration: 0.7, ease: "power2.in", immediateRender: false }, 55.3);
  // idle glow breathing on the button during the hold
  tl.fromTo(fill, { opacity: 0.22 }, { opacity: 0.4, duration: 1.4, ease: "sine.inOut", repeat: 3, yoyo: true, immediateRender: false }, 54.9);

  // legal line — outside the push (stays inside title-safe), 52.40 → 60.00
  const legal = E("div", "s5-legal", cam, { text: PP.fr(PP.cfg.legal) });
  gsap.set(legal, { opacity: 0 });
  tl.fromTo(legal, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, 52.4);
});
