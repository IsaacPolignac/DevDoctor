// S07 · home live → product → add to cart · window f750–f849 (25.000–28.300 s) · iPhone rig + clean site · PAPER.
// SCENES §S07. The rig (PH) is global; every PH call below is added in time order (PH queries are pure functions of
// time built from the recorded calls).
//   f750  home live (s 0) under a circular bloom mask from the H1 centre · camera HOME (g 1.00→1.02, linear, f750–f796)
//   f755  "RESEARCH PEPTIDES" callout masks in; its teal leader draws f757–f769 to the site eyebrow (end tracked per frame);
//         leader retracts f780–f788, callout masks out f782–f790 (clears the column for L11 "Let" at f790)
//   f780  tap "Explore the catalog" (ring + press, highlight at f782) → f784–f796 Safari push → product at s 1000
//   f796  camera PROD (g 1.5, (201,352) → (1290,540), expo.inOut 22 f)
//   L11   "Let the cart / do the math." per-word blur-in on VO.w('L11', 1…6) → #type-math (stage level, handed to S08)
//   f826  tap "Add to cart · $84.99" (press, state f828: nav badge 0 → 1 with a pop) → f836–f848 push → cart1 at s 0
// OUT f849: rig at PROD, cart1 at s 0 (badge 1), #type-math fully visible (masked out f866–f874, done here: see below).
PP.scene("S07", function build(tl, root) {
  const F = PP.F, f = PP.f, C = PP.C;
  const $ = (s) => root.querySelector(s);
  const E = (n) => gsap.parseEase(n);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const fx = (x) => x.toFixed(2);
  const fr = (t) => Math.round(t * 30) / 30; // word-locked events snap to the frame grid
  const T0 = PP.IN("S07"), T1 = PP.OUT("S07");

  // canvas metrics (fonts are loaded before any build): baseline offset inside a line box of height lh
  const cv = document.createElement("canvas").getContext("2d");
  const metrics = (font, txt, ls) => {
    cv.font = font;
    cv.letterSpacing = (ls || 0).toFixed(3) + "px";
    const m = cv.measureText(txt);
    return { m, fa: m.fontBoundingBoxAscent, fd: m.fontBoundingBoxDescent };
  };
  const baseOff = (font, lh) => {
    const { fa, fd } = metrics(font, "H");
    return (lh - (fa + fd)) / 2 + fa;
  };

  // ================================================================== 1. home goes live: bloom from the H1 (f750–f764)
  // Mask on the home page layer (layer box = screen y 62…874, so the H1 centre (201,449) is (201,387) in layer px).
  // SCENES: radius 170 → 1000 pt, 14 f expo.out. The farthest layer corner is only 470 pt away, so with a 1000 pt target
  // the reveal would be over in ONE frame (expo.out passes 470 at 0.9 f). Same ease, same 14 f, end radius 520 pt
  // (just past the corner + feather): the bloom now reads over ~7 frames instead of popping.
  PH.show(tl, T0, "home", 0);
  const home = PH.layer("home");
  const BX = 201, BY = 449 - PH.TOP, R0 = 170, R1 = 520, SOFT = 1; // 2 pt soft edge = ±1 pt
  PP.drive(tl, (r) => {
    PP.maskCss(home, r >= R1 - 0.01 ? "none" : `radial-gradient(circle at ${BX}px ${BY}px, #000 ${fx(r - SOFT)}px, rgba(0,0,0,0) ${fx(r + SOFT)}px)`);
  }, R0, R1, T0, 14 * F, "expo.out");
  PH.cam(tl, T0, f(46), "HOME", "none");

  // Polish: bloom rim light. A soft teal glow band rides just inside the mask edge (screen-level, above the home layer,
  // below the iOS chrome) and decays as the circle opens, so the 4–5 frames of the reveal read as light spreading out from
  // the H1 on the DROP instead of a hard-edged cut. Fill only (site teal #16A48F is a fill colour), never text.
  const rim = PP.el("div", "s7-rim", PH.ps);
  rim.style.cssText = `position:absolute; left:0; top:${PH.TOP}px; width:402px; height:${874 - PH.TOP}px; z-index:4; pointer-events:none; opacity:0`;
  const eBloom = E("expo.out");
  PP.driveT(tl, (t) => {
    const u = clamp01((t - T0) / (14 * F));
    const r = R0 + (R1 - R0) * eBloom(u);
    const a = t < T0 || u >= 1 ? 0 : Math.pow(1 - u, 1.6); // full on the hit, gone by the end of the bloom
    if (a < 0.01) { rim.style.opacity = "0"; return; }
    rim.style.opacity = "1";
    const c = (k) => `rgba(22,164,143,${fx(k * a)})`;
    rim.style.background = `radial-gradient(circle at ${BX}px ${BY}px, rgba(22,164,143,0) ${fx(r - 26)}px, ${c(0.10)} ${fx(r - 10)}px, ${c(0.34)} ${fx(r - 2.5)}px, ${c(0.55)} ${fx(r - SOFT)}px, rgba(22,164,143,0) ${fx(r + SOFT)}px)`;
  }, T0 - F, T0 + 15 * F);

  // ================================================================== 2. category callout (f755–f790)
  // SCENES: in f758, hold to f792, out f792–f800. VO L11 "let" lands at f790 in the same left column (baseline 470, the
  // callout sits at 520): with the spec timing both are on screen together f790–f800. Shifted 3 f earlier in / 10 f
  // earlier out so the callout clears exactly as "Let" blurs in (a relay, not a pile-up), keeping a ≥ 25 f readable hold.
  const catFont = '600 34px "Inter"';
  const LS_CAT = 0.16 * 34;
  const cat = $(".s7-cat"), catLn = $(".s7-cat-ln");
  const catBase = 520;
  cat.style.top = fx(catBase - baseOff(catFont, 34)) + "px";
  const cm = metrics(catFont, "RESEARCH PEPTIDES", LS_CAT).m;
  const capH = metrics(catFont, "H").m.actualBoundingBoxAscent;
  const catRight = 160 + cm.actualBoundingBoxRight; // ink right edge (stage px)
  // exit locked to L11 "let": the mask-out (8 f power3.in) ends exactly as "Let" starts its blur-in
  const tLet = fr(PP.clamp(VO.w("L11", "let"), f(786), T1 - 12 * F, "S07 callout exit (L11 let)"));
  const tCatIn = f(755), tCatOut = tLet - 8 * F;
  PP.maskLine(tl, catLn, tCatIn);
  PP.maskLine(tl, catLn, tCatOut, { dir: "out" });

  // Leader: 2 px #0E7D6C, starts 24 px after the callout's ink, ends 10 px before the eyebrow's left edge (page (129, 404.5)
  // at s 0), endpoint tracked per frame through PH.stage (camera HOME) and through the Safari push (home x 0 → −120 pt,
  // iosPush, f784–f796). Draw f757–f769 expo.out; terminal dot pops f766 (6 f back.out(0.8)); retract f780–f788 power3.in
  // (the eyebrow leaves with the push: the line never points at empty paper).
  const ln = $(".s7-lead-ln"), dot = $(".s7-lead-dot");
  const xStart = catRight + 24;
  const tDraw = f(757), tDot = f(766), tPush1 = f(784), tRet = tCatOut - 2 * F;
  const eDraw = E("expo.out"), eDot = E("back.out(0.8)"), eRet = E("power3.in"), ePush = E("iosPush");
  const eyebrowAt = (t) => {
    const dx = -120 * ePush(clamp01((t - tPush1) / (12 * F)));
    return PH.stage(129 + dx, 404.5, t);
  };
  const capMid = catBase - capH / 2;
  PP.driveT(tl, (t) => {
    const e = eyebrowAt(t);
    const xEnd = e.x - 10, y = e.y;
    const p = eDraw(clamp01((t - tDraw) / (12 * F)));
    const q = eRet(clamp01((t - tRet) / (8 * F)));
    const tip = xStart + (xEnd - xStart) * p * (1 - q);
    const on = p > 0.001 && q < 0.999;
    ln.setAttribute("x1", fx(xStart));
    ln.setAttribute("x2", fx(tip));
    ln.setAttribute("y1", fx(y));
    ln.setAttribute("y2", fx(y));
    ln.style.opacity = on ? "1" : "0";
    const d = eDot(clamp01((t - tDot) / (6 * F))) * (1 - q);
    dot.setAttribute("cx", fx(tip));
    dot.setAttribute("cy", fx(y));
    dot.setAttribute("r", fx(Math.max(0, 4.5 * d)));
    dot.style.opacity = d > 0.01 && on ? "1" : "0";
  }, T0, f(800));
  if (Math.abs(capMid - eyebrowAt(tCatIn).y) > 3) console.warn(`[S07] callout cap centre ${capMid.toFixed(1)} vs leader y ${eyebrowAt(tCatIn).y.toFixed(1)}`);

  // PH.press covers the original control with a patch only 0.5 pt larger than its rect: the control's own anti-aliased rim
  // stays visible as a hairline around the 0.97 sprite. Local fix: widen the patch by 1.5 pt (radius follows).
  const widen = (pr, r, rad, d) => {
    Object.assign(pr.patch.style, { left: r[0] - d + "px", top: r[1] - d + "px", width: r[2] + 2 * d + "px", height: r[3] + 2 * d + "px", borderRadius: rad + d + "px" });
  };

  // ================================================================== 3–4. tap "Explore the catalog" → push → product
  const tTap1 = f(780);
  PH.tap(tl, tTap1, 201, 629, { white: true }); // navy button: white ring (SCENES §0.4) // page (201,567) at s 0; button (41,542,320,50)
  const p1 = PH.press(tl, tTap1, "home", [41, 542, 320, 50], { radius: 25 });
  widen(p1, [41, 542, 320, 50], 25, 1.5);
  tl.set(p1.sprite, { filter: "brightness(1)" }, 0);
  tl.set(p1.sprite, { filter: "brightness(0.9)" }, tTap1 + 2 * F); // state at f782: pressed highlight
  PH.push(tl, f(784), "home", "product", 1000); // arrives already at s 1000 (editorial ellipsis: skips the shop grid)

  // ================================================================== 5. camera PROD
  PH.cam(tl, f(796), 22 * F, "PROD", "expo.inOut");

  // ================================================================== 6. "Let the cart / do the math." → #type-math (stage level)
  // DM Sans 800 96 px, #16233F, x 140, baselines 470 / 576, "math." #0E7D6C. Lives under #stage (z 40) so it survives this
  // section's hide at f849; masked out f866–f874 (SCENES §S08.1).
  const PS = 96, BL = 0.841; // DM Sans: with line-height = font-size the baseline sits 0.841 em below the box top
  const PAD_T = 26, PAD_B = 62, PAD_X = 40;
  const stage = document.getElementById("stage");
  let tm = document.getElementById("type-math");
  if (tm) tm.remove();
  tm = PP.el("div", "layer", stage, { id: "type-math" });
  tm.style.cssText += ";z-index:40; opacity:0; pointer-events:none";
  const LINES = [["Let", "the", "cart"], ["do", "the", "math."]];
  const BASES = [470, 576];
  const words = [];
  const inners = LINES.map((ws, i) => {
    const m = PP.el("div", "tm-mask tm-l" + (i + 1), tm);
    m.style.cssText = `position:absolute; left:${140 - PAD_X}px; top:${fx(BASES[i] - BL * PS - PAD_T)}px; padding:${PAD_T}px ${PAD_X}px ${PAD_B}px; overflow:hidden; white-space:nowrap`;
    const inner = PP.el("div", "tm-in", m);
    inner.style.cssText = `height:${PS}px; font-family:var(--display); font-weight:800; font-size:${PS}px; line-height:${PS}px; letter-spacing:-0.02em; color:${C.pInk}`;
    ws.forEach((w, k) => {
      if (k) inner.appendChild(document.createTextNode(" "));
      const sp = PP.el("span", "pp-w", inner, { text: w });
      if (w === "math.") sp.style.color = C.h1Teal;
      words.push(sp);
    });
    return inner;
  });
  const tWords = words.map((_, i) => fr(PP.clamp(VO.w("L11", i + 1), T0 + 30 * F, T1 - 12 * F, `S07 L11 word ${i + 1}`)));
  words.forEach((w, i) => PP.blurIn(tl, [w], tWords[i], { stagger: 0 }));
  const tMathOut = f(866);
  tl.set(tm, { opacity: 0 }, 0);
  tl.set(tm, { opacity: 1 }, T0);
  inners.forEach((el) => tl.set(el, { yPercent: 0 }, 0));
  PP.maskLine(tl, inners, tMathOut, { dir: "out", stagger: 0 });
  tl.set(tm, { opacity: 0 }, f(874));

  // ================================================================== 7–8. tap "Add to cart · $84.99" → badge → push → cart1
  const tTap2 = f(826);
  PH.tap(tl, tTap2, 201, 531, { white: true }); // page (201,1469) at s 1000; button (20,1443,362,52)
  const p2 = PH.press(tl, tTap2, "product", [20, 1443, 362, 52], { radius: 26 });
  widen(p2, [20, 1443, 362, 52], 26, 1.5);
  tl.set(p2.sprite, { filter: "brightness(1)" }, 0);
  tl.set(p2.sprite, { filter: "brightness(0.9)" }, tTap2 + 2 * F);
  // f828: badge 0 → 1, pop. PH.navBadge pops a SQUARE 24×24 pt crop, which drags a slice of the bag icon with it (at
  // ×1.3 the bag's handle and rim ghost beside the real ones). Local fix: keep its nav swap, hide its square sprite and pop
  // a circle-clipped crop of the badge disc alone (Ø 16 pt, page (321,62,16,16)) about its centre.
  const tBadge = tTap2 + 2 * F;
  const nb = PH.navBadge(tl, tBadge, "cart1");
  nb.pop.style.visibility = "hidden";
  // Disc measured on clean/cart1.png (3x): Ø 12.7 pt centred (329.3, 69.7). Crop Ø 13.6 pt: the disc + its AA rim only —
  // a wider crop carries a white ring that, at ×1.3, bites the bag icon's top-right corner.
  const BD = 13.6, bx = 329.3, by = 69.7;
  const badge = PH.crop("cart1", { x: bx - BD / 2, y: by - BD / 2, w: BD, h: BD }, { parent: nb.alt, cls: "s7-badge-pop" });
  badge.style.cssText += `;left:${bx - BD / 2}px; top:${by - BD / 2 - PH.NAV_Y}px; border-radius:50%; transform-origin:50% 50%`;
  tl.set(badge, { scale: 1 }, 0);
  tl.fromTo(badge, { scale: 1 }, { scale: 1.3, duration: 3 * F, ease: "power2.out", immediateRender: false }, tBadge);
  tl.fromTo(badge, { scale: 1.3 }, { scale: 1, duration: 5 * F, ease: "back.out(0.8)", immediateRender: false }, tBadge + 3 * F);
  PH.push(tl, f(836), "product", "cart1", 0); // camera stays at PROD

  PP.S07 = {
    typeMath: tm, lines: inners, words, maskOut: [866, 874], // #type-math is already masked out f866–f874 by S07
    words_f: tWords.map(PP.toF), bloom: [750, 764], tapExplore: 780, push1: [784, 796], camProd: [796, 818],
    tapAdd: 826, badge: 828, push2: [836, 848],
  };
});
