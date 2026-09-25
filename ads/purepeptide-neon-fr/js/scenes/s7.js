// s7 — clip 21.90 → 30.00 · VO L8 « PurePeptide. La pureté, prouvée. »
// 21.92–22.00 neon disc grows → FLASH #3 at 22.00 · 22.20 brand symbol pops · 22.36→22.91 wordmark typed ·
// 23.31/23.38 « La pureté, » · 24.31 « prouvée. » punch + neon underline · 24.60 legal · 25.00 CTA pill pops ·
// 25.20–25.80 cursor glides in · 25.90 click · 26–30 held end frame with life (push, sheen 27.5, halo breathing).
PP.scene("s7", function (tl, root, cam) {
  const F = PP.F;
  const C = PP.C;

  // camera: slow constant push (no fade to black, ends on a held frame)
  gsap.set(cam, { transformOrigin: "540px 900px" });
  tl.fromTo(cam, { scale: 0.985, y: 8 }, { scale: 1.0, y: 0, duration: 4.0, ease: "sine.out", immediateRender: false }, 22.0);
  tl.fromTo(cam, { scale: 1.0, y: 0 }, { scale: 1.04, y: -10, duration: 4.0, ease: "none", immediateRender: false }, 26.0);
  tl.set(cam, { scale: 0.985, y: 8 }, 0);

  // ---------------------------------------------------------------- background depth
  const glow = PP.el("div", "s7-glow", cam);
  const rnd = PP.rng(707);
  for (let i = 0; i < 14; i++) {
    const s = 6 + rnd() * 24;
    const b = PP.el("div", "s7-bokeh", cam);
    b.style.cssText = `left:${(rnd() * 1080).toFixed(0)}px;top:${(240 + rnd() * 1450).toFixed(0)}px;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;opacity:${(0.15 + rnd() * 0.35).toFixed(2)};filter:blur(${(s / 6).toFixed(1)}px)`;
    tl.fromTo(b, { y: 0 }, { y: -(90 + rnd() * 160), duration: 8, ease: "none", immediateRender: false }, 22.0);
    tl.fromTo(b, { opacity: 0 }, { opacity: b.style.opacity, duration: 0.6, ease: "none", immediateRender: false }, 22.1 + rnd() * 0.5);
    tl.set(b, { opacity: 0 }, 0);
  }
  tl.fromTo(glow, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.7, ease: "expo.out", immediateRender: false }, 22.0);
  tl.set(glow, { opacity: 0 }, 0);
  // halo breathing (deterministic yoyo)
  tl.fromTo(glow, { scale: 1 }, { scale: 1.08, duration: 1.0, ease: "sine.inOut", yoyo: true, repeat: 6, immediateRender: false }, 23.0);

  // ---------------------------------------------------------------- FLASH #3 (22.00)
  const disc = PP.el("div", "s7-disc", cam);
  tl.fromTo(disc, { scale: 0, opacity: 1 }, { scale: 1, duration: 0.08, ease: "expo.in", immediateRender: false }, 21.92);
  tl.fromTo(disc, { scale: 1, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 4 * F, ease: "power2.out", immediateRender: false }, 22.0);
  tl.set(disc, { scale: 0, opacity: 0 }, 0);
  PP.flashRing(tl, PP.layers.fx, 22.0, { x: 540, y: 820, target: disc });

  // ---------------------------------------------------------------- brand symbol (22.20)
  const SYM_Y = 612; // centre
  const symWrap = PP.el("div", "s7-sym", cam);
  const sym = PP.symbol(symWrap, 170);
  symWrap.style.cssText = `left:${540 - sym.width / 2}px;top:${SYM_Y - 85}px;width:${sym.width}px;height:170px`;
  const ringWrap = PP.el("div", "s7-sym-ring", cam);
  ringWrap.style.cssText = `left:390px;top:${SYM_Y - 150}px;width:300px;height:300px`;
  const mkRing = () => {
    const d = PP.el("div", "s7-ring-rot", ringWrap);
    return { d, svg: PP.svg("svg", { width: 300, height: 300, viewBox: "-150 -150 300 300" }, d) };
  };
  const rA = mkRing();
  const rB = mkRing();
  PP.svg("circle", { cx: 0, cy: 0, r: 132, fill: "none", stroke: "rgba(46,230,201,0.55)", "stroke-width": 1.6, "stroke-dasharray": "2 10", "stroke-linecap": "round" }, rA.svg);
  const ringB = PP.svg("circle", { cx: 0, cy: 0, r: 146, fill: "none", stroke: C.neon, "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.8, transform: "rotate(-90)" }, rB.svg);
  gsap.set(symWrap, { transformPerspective: 900 });
  tl.fromTo(symWrap, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, 22.2 - F);
  tl.set(symWrap, { opacity: 0 }, 0);
  tl.fromTo(symWrap, { scale: 0.2, rotation: -25, filter: "blur(12px)" }, { scale: 1, rotation: 0, filter: "blur(0px)", duration: 0.6, ease: "back.out(2.4)", immediateRender: false }, 22.2 - F);
  tl.fromTo(symWrap, { rotationY: 0, y: 0 }, { rotationY: 16, y: -8, duration: 3.8, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }, 22.4);
  tl.fromTo(ringWrap, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, 22.25);
  tl.set(ringWrap, { opacity: 0 }, 0);
  tl.fromTo(rA.d, { rotation: 0 }, { rotation: 90, duration: 7.8, ease: "none", immediateRender: false }, 22.2);
  PP.draw(tl, ringB, 22.25, 0.7, { ease: "expo.out" });
  tl.set(ringB, { drawSVG: "0%" }, 0);
  tl.fromTo(rB.d, { rotation: 0 }, { rotation: 120, duration: 7.8, ease: "none", immediateRender: false }, 22.2);

  // ---------------------------------------------------------------- typed wordmark (22.36 → 22.91)
  const WM_W = 760;
  const wmWrap = PP.el("div", "s7-wm", cam);
  wmWrap.style.cssText = `left:${540 - WM_W / 2}px;top:748px;width:${WM_W}px`;
  const wm = PP.typedWordmark(tl, wmWrap, WM_W, 22.36);
  // second sheen pass on the held frame (~27.5)
  PP.drive(tl, (v) => wm.sheen.style.setProperty("--p", v.toFixed(1) + "%"), -40, 140, 27.5, 0.9, "power1.inOut");

  // ---------------------------------------------------------------- tagline « La pureté, prouvée. »
  const tg = PP.headline(cam, ["La pureté,", "*prouvée.*"], "h1 s7-tag");
  tg.el.style.cssText = "position:absolute;left:0;right:0;top:878px";
  const [wLa, wPurete, wProuvee] = tg.words;
  PP.wordIn(tl, wLa, 23.31 - 0.08);
  PP.wordIn(tl, wPurete, 23.38 - 0.08);
  PP.wordIn(tl, wProuvee, 24.31 - 0.08, { blur: 10, rise: 0 });
  tl.fromTo(wProuvee, { scale: 1.45 }, { scale: 1, duration: 0.42, ease: "back.out(2.6)", immediateRender: false }, 24.31 - 0.08);
  tl.set(wProuvee, { scale: 1.45 }, 0);
  // neon underline stroke drawing under « prouvée. »
  const ul = PP.svg("svg", { width: 480, height: 40, viewBox: "0 0 480 40", class: "s7-ul" }, cam);
  ul.style.cssText = "left:300px;top:1088px";
  const ulPath = PP.svg("path", { d: "M8 26 C 120 12, 300 10, 472 20", fill: "none", stroke: "url(#s7-ulg)", "stroke-width": 7, "stroke-linecap": "round" }, ul);
  const defs = PP.svg("defs", {}, ul);
  const lg = PP.svg("linearGradient", { id: "s7-ulg", x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
  PP.svg("stop", { offset: "0", "stop-color": "#5AA8FF" }, lg);
  PP.svg("stop", { offset: "0.45", "stop-color": "#38BDF8" }, lg);
  PP.svg("stop", { offset: "1", "stop-color": "#2EE6C9" }, lg);
  PP.draw(tl, ulPath, 24.33, 0.38, { ease: "power3.out" });
  tl.set(ulPath, { drawSVG: "0%" }, 0);

  // ---------------------------------------------------------------- CTA « purepeptide.care » (25.00) + cursor click (25.90)
  const ctaWrap = PP.el("div", "s7-ctawrap", cam);
  const cta = PP.el("div", "s7-cta", ctaWrap);
  const ctaFill = PP.el("div", "s7-cta-fill", cta);
  PP.el("span", "s7-cta-txt", cta, { text: PP.cfg.url });
  const arrow = PP.svg("svg", { width: 44, height: 44, viewBox: "0 0 44 44", class: "s7-cta-arrow" }, cta);
  PP.svg("circle", { cx: 22, cy: 22, r: 21, fill: C.neon }, arrow);
  PP.svg("path", { d: "M13 22 H30 M23.5 15 L30.5 22 L23.5 29", fill: "none", stroke: C.bg, "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, arrow);
  tl.fromTo(ctaWrap, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, 25.0 - F);
  tl.set(ctaWrap, { opacity: 0 }, 0);
  tl.fromTo(ctaWrap, { scale: 0.4, y: 40, filter: "blur(10px)" }, { scale: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "back.out(2.2)", immediateRender: false }, 25.0 - F);
  // idle glow pulse before the click
  tl.fromTo(cta, { boxShadow: "0 0 0px rgba(46,230,201,0.0), 0 20px 50px rgba(0,0,0,0.55)" }, { boxShadow: "0 0 34px rgba(46,230,201,0.35), 0 20px 50px rgba(0,0,0,0.55)", duration: 0.5, ease: "sine.inOut", immediateRender: false }, 25.2);
  // lights 1 frame before the click, press, then settles half-lit
  const CLICK = 25.9;
  tl.fromTo(ctaFill, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, CLICK - F);
  tl.fromTo(ctaFill, { opacity: 1 }, { opacity: 0.45, duration: 0.7, ease: "power2.out", immediateRender: false }, CLICK + 0.15);
  tl.set(ctaFill, { opacity: 0 }, 0);
  tl.fromTo(cta, { boxShadow: "0 0 90px rgba(46,230,201,0.85), 0 20px 50px rgba(0,0,0,0.55)" }, { boxShadow: "0 0 40px rgba(46,230,201,0.4), 0 20px 50px rgba(0,0,0,0.55)", duration: 0.8, ease: "power2.out", immediateRender: false }, CLICK - F);
  tl.fromTo(cta, { scale: 1 }, { scale: 0.95, duration: 0.07, ease: "power2.out", immediateRender: false }, CLICK);
  tl.fromTo(cta, { scale: 0.95 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, CLICK + 0.07);
  const burst = PP.el("div", "s7-cta-burst", ctaWrap);
  tl.fromTo(burst, { scale: 1, opacity: 0.9 }, { scale: 1.35, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, CLICK);
  tl.set(burst, { opacity: 0 }, 0);
  tl.fromTo(arrow, { x: 0 }, { x: 8, duration: 0.6, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }, 26.4);

  const cur = PP.cursor(cam, 1140, 1760);
  cur.move(tl, 742, 1236, 25.2, 0.6, "power3.inOut");
  cur.click(tl, CLICK);
  cur.move(tl, 770, 1262, 26.4, 3.2, "sine.inOut");

  // ---------------------------------------------------------------- legal (24.60 → 30.00), outside the camera push
  const legal = PP.el("div", "s7-legal", root, { text: PP.fr(PP.cfg.legal) });
  tl.fromTo(legal, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, 24.6);
  tl.set(legal, { opacity: 0 }, 0);
});
