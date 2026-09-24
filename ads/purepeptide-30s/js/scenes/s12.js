// s12 — S1 HOOK (0.00–2.50) + S2 HERO VIAL (2.50–6.00).
// One hero vial is built once at its S2 pose (centre 540,1000, height 780 -> top 610). During S1 the
// rack-focus wrapper shows it at the brief's "height 900, blur 24, opacity 35 %" and 2.00–2.50 lands it
// exactly on the S2 pose. Two cameras: the S1 headline camera (0–2.5) and the S2 camera (2.5–6.0) on `cam`,
// which stays at scale 1 until 2.50 so the landing is exact. Every visual state is a pure function of time.
PP.scene("s12", function (tl, root, cam) {
  const cfg = PP.cfg;
  const C = PP.C;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // ------------------------------------------------------------------ geometry
  const VIAL_H = 780;
  const vs = VIAL_H / PP.VIAL_VB.h; // px per viewBox unit
  const vialW = PP.VIAL_VB.w * vs;
  const vialLeft = 540 - vialW / 2;
  const vialTop = 1000 - VIAL_H / 2; // 610
  const FLOOR_Y = 1392;
  const S1_SCALE = 900 / VIAL_H; // brief S1: height 900

  // ------------------------------------------------------------------ layers
  // cam (S2 camera) > zoom (5.60 zoom-through) > [reflection float, floor, rack > float > vial, callouts float]
  //                 > logo, headline A, headline B
  // cam1 (S1 camera, above) > headline H1, scan line
  cam.classList.add("s12-cam");
  const zoom = PP.el("div", "s12-layer s12-zoom", cam);
  const reflFloat = PP.el("div", "s12-layer s12-reflfloat", zoom);
  const floor = PP.el("div", "s12-floor", zoom);
  const rack = PP.el("div", "s12-layer s12-rack", zoom);
  const float = PP.el("div", "s12-layer s12-float", rack);
  const callFloat = PP.el("div", "s12-layer s12-callfloat", zoom);
  const cam1 = PP.el("div", "s12-layer s12-cam1", root);

  // ------------------------------------------------------------------ hero vial + reflection
  const vial = PP.vial(float, { height: VIAL_H, product: cfg.coaProduct, hero: true });
  // S1 layers the H1 over the out-of-focus vial on purpose (brief S1 layout).
  if (vial.svg) vial.svg.querySelectorAll("text, tspan").forEach((n) => n.setAttribute("data-layout-allow-overlap", ""));
  vial.el.style.left = vialLeft + "px";
  vial.el.style.top = vialTop + "px";

  // mirror about the floor plane: reflection box top = 2*floor - vial box bottom
  const refl = PP.vialReflection(reflFloat, { height: VIAL_H, product: cfg.coaProduct, hero: true, fade: 220, opacity: 0.15 });
  refl.el.style.left = vialLeft + "px";
  refl.el.style.top = 2 * FLOOR_Y - (vialTop + VIAL_H) + "px";

  // ------------------------------------------------------------------ S1 headline
  const h1 = PP.headline(cam1, ["What’s really", "in your *vial?*"], "h1");
  h1.el.classList.add("s12-h1");
  const vialWord = h1.words[h1.words.length - 1];
  const wordLine = h1.words.map((w) => h1.lines.indexOf(w.parentNode));
  const LINE_CY = [825, 935]; // centres of the two 110 px line boxes (block 770 -> 990)

  const scan = PP.el("div", "s12-scan", cam1);
  PP.scanLine(scan, "h", 840);

  // ------------------------------------------------------------------ S2 logo + headlines
  const logoWrap = PP.el("div", "s12-logo", cam);
  const logo = PP.logo(logoWrap, { height: 44 });
  let capOff = 0;
  if (!logo.isImage) {
    // put the cap top of "P" on y 300 (the wordmark box has line-height 1)
    const fs = logo.fontSize;
    capOff = 0.137 * fs;
    try {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `600 ${fs}px "Inter Tight"`;
      const m = ctx.measureText("P");
      if (m.fontBoundingBoxAscent && m.actualBoundingBoxAscent) {
        const base = (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        capOff = base - m.actualBoundingBoxAscent;
      }
    } catch (e) {
      /* keep the estimate */
    }
  }
  logoWrap.style.top = (300 - capOff).toFixed(2) + "px";

  const hA = PP.headline(cam, ["We don’t ask for trust."], "h3");
  hA.el.classList.add("s12-h3");
  const hB = PP.headline(cam, ["We publish the *proof.*"], "h3");
  hB.el.classList.add("s12-h3");

  // ------------------------------------------------------------------ callouts
  const callSvg = PP.svg("svg", { width: 1080, height: 1920, viewBox: "0 0 1080 1920", class: "s12-callsvg" }, callFloat);
  function callout(side, dotX, dotY, endX, textX, lines) {
    const y = dotY + 0.5; // crisp 1 px hairline
    const path = PP.svg("path", { d: `M${dotX} ${y} L${endX} ${y}`, fill: "none", stroke: C.muted, "stroke-width": 1, "stroke-opacity": 0.85 }, callSvg);
    const dot = PP.el("div", "s12-dot", callFloat, { style: `left:${dotX}px;top:${dotY + 0.5}px` });
    const box = PP.el("div", "s12-call mono s12-call-" + side, callFloat);
    // first text line is vertically centred on the leader (cap centre ≈ 14 px below the 27.5 px line top)
    box.style.top = dotY - 14 + "px";
    if (side === "l") box.style.right = 1080 - textX + "px";
    else box.style.left = textX + "px";
    let chars = [];
    lines.forEach((t) => {
      const ln = PP.el("div", "s12-cl", box);
      chars = chars.concat(PP.chars(ln, t));
    });
    return { path, dot, box, chars };
  }
  // left: powder cake (y≈1320); right: label (y≈1000). Text stays clear of the glass (397 -> 683).
  const cL = callout("l", 440, 1320, 336, 320, ["LYOPHILIZED", "POWDER"]);
  const cR = callout("r", 656, 1000, 760, 776, ["BATCH", cfg.batch]);

  // Brief text-in + an opacity gate. The shared mask (.pp-ln) has 0.18em bottom padding for descenders,
  // so a word parked at yPercent 100 (blurred) peeks through it before its reveal; each word stays at
  // opacity 0 until its own start and fades up over its first 0.12 s (invisible inside the mask reveal).
  function wordsInGated(words, at) {
    tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out", stagger: 0.06 }, at);
    PP.wordsIn(tl, words, at);
  }

  // ================================================================== S1 — HOOK (0.00–2.50)
  PP.camera(tl, cam1, 0, 2.5);

  // Word mask reveal. The first word is already in motion on frame 0: it starts at t=0 from the state
  // expo.out would have reached 0.05 s in, and finishes on the tail of the same curve (no negative
  // timeline positions: GSAP would shift every child of the master timeline).
  const D = 0.55;
  const PRE = 0.05;
  const expoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const e0 = expoOut(PRE / D);
  const tailEase = (p) => (expoOut(PRE / D + p * (1 - PRE / D)) - e0) / (1 - e0);
  tl.fromTo(
    h1.words[0],
    { yPercent: 100 * (1 - e0), filter: `blur(${(10 * (1 - e0)).toFixed(2)}px)` },
    { yPercent: 0, filter: "blur(0px)", duration: D - PRE, ease: tailEase },
    0,
  );
  wordsInGated(h1.words.slice(1), 0.06 - PRE); // keeps the 0.06 s stagger of the original start

  // Scan line 0.80–1.60 (y 700 -> 1080, power1.inOut) + per-line accent glow as it passes,
  // + a small glow flare on "vial?" with its 1.50 pulse. One seek-safe driver: v = time.
  const quadInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
  const glowCss = (k) =>
    k > 0.003
      ? `0 0 ${(4 + 6 * k).toFixed(1)}px rgba(127,231,255,${(0.55 * k).toFixed(3)}), 0 0 ${(14 + 22 * k).toFixed(1)}px rgba(127,231,255,${(0.45 * k).toFixed(3)})`
      : "none";
  PP.drive(
    tl,
    (t) => {
      const p = clamp((t - 0.8) / 0.8, 0, 1);
      const y = 700 + 380 * quadInOut(p);
      const env = p <= 0 || p >= 1 ? 0 : Math.min(1, p / 0.12, (1 - p) / 0.15);
      scan.style.transform = `translateY(${(y - 700).toFixed(2)}px)`;
      scan.style.opacity = env.toFixed(3);
      const g = LINE_CY.map((cy) => (env > 0 ? Math.exp(-Math.pow((y - cy) / 58, 2)) * Math.min(1, env * 1.4) : 0));
      const pulse = t > 1.5 && t < 1.85 ? Math.sin((Math.PI * (t - 1.5)) / 0.35) : 0;
      h1.words.forEach((w, i) => {
        let k = g[wordLine[i]];
        if (w === vialWord) k = Math.max(k, 0.7 * pulse);
        w.style.textShadow = glowCss(k);
      });
      // masks are only needed during the reveal; afterwards the glow must not be clipped by them
      const ov = t >= 0.76 ? "visible" : "hidden";
      h1.lines.forEach((l) => (l.style.overflow = ov));
    },
    0,
    2.5,
    0,
    2.5,
    "none",
  );

  // 1.50 "vial?" pulse 1 -> 1.06 -> 1 (0.3 s)
  tl.fromTo(vialWord, { scale: 1 }, { scale: 1.06, duration: 0.15, ease: "power2.out" }, 1.5);
  tl.fromTo(vialWord, { scale: 1.06 }, { scale: 1, duration: 0.15, ease: "power2.inOut", immediateRender: false }, 1.65);

  // 2.00–2.50 rack focus: headline out (power2.in)...
  tl.fromTo(
    h1.el,
    { scale: 1, filter: "blur(0px)", opacity: 1 },
    { scale: 1.12, filter: "blur(18px)", opacity: 0, duration: 0.5, ease: "power2.in", immediateRender: false },
    2.0,
  );
  // ...vial in (expo.out), landing exactly on its S2 pose at 2.50. Before that a slow constant
  // drift (1.175 -> 1.154) so the out-of-focus vial is never frozen (parallax against the H1 push-in).
  tl.fromTo(
    rack,
    { scale: 1.175, filter: "blur(24px)", opacity: 0.35 },
    { scale: S1_SCALE, filter: "blur(24px)", opacity: 0.35, duration: 2.0, ease: "none" },
    0,
  );
  // scale lands on expo.out (brief); focus + opacity follow power2.out, the mirror of the headline's
  // power2.in, so focus transfers between the planes instead of the sharp white label sitting under a
  // still-sharp white headline for ~6 frames (see deviations).
  tl.fromTo(rack, { scale: S1_SCALE }, { scale: 1, duration: 0.5, ease: "expo.out", immediateRender: false }, 2.0);
  tl.fromTo(
    rack,
    { filter: "blur(24px)", opacity: 0.35 },
    { filter: "blur(0px)", opacity: 1, duration: 0.5, ease: "power2.out", immediateRender: false },
    2.0,
  );

  // ================================================================== S2 — HERO VIAL (2.50–6.00)
  PP.camera(tl, cam, 2.5, 6.0);

  // floor hairline reveals from its centre as the vial lands; reflection fades in under it
  tl.fromTo(floor, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: "power2.inOut" }, 2.3);
  tl.fromTo(reflFloat, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 2.4);

  // float: 2 s sine period from 2.50. The vial hovers between its resting pose (0) and 12 px up
  // (±6 px about 6 px) so it never sinks through the floor; the reflection moves in mirror.
  PP.drive(
    tl,
    (t) => {
      const off = -6 * (1 - Math.cos(Math.PI * (t - 2.5)));
      const s = `translateY(${off.toFixed(3)}px)`;
      float.style.transform = s;
      callFloat.style.transform = s;
      reflFloat.style.transform = `translateY(${(-off).toFixed(3)}px)`;
    },
    2.5,
    6.0,
    2.5,
    3.5,
    "none",
  );

  // 2.60–3.60 specular sweep: 140 px band, screen x 300 -> 780 (measured at the vial's mid-height)
  if (vial.sweepRect) {
    const tan12 = Math.tan((12 * Math.PI) / 180);
    const bandW = 140 / vs;
    const xAt = (X) => (X - vialLeft) / vs - bandW / 2 + tan12 * (PP.VIAL_VB.h / 2);
    tl.fromTo(vial.sweepRect, { attr: { x: xAt(300) } }, { attr: { x: xAt(780) }, duration: 1.0, ease: "power2.inOut" }, 2.6);
    tl.fromTo(vial.sweep, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.inOut" }, 2.6);
    tl.fromTo(vial.sweep, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "sine.inOut", immediateRender: false }, 3.1);
  }

  // 2.70–3.20 logo slides down 12 px + fades in
  tl.fromTo(logoWrap, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, 2.7);

  // headline A in 2.90, out 4.10; headline B in 4.30, holds to 5.60
  wordsInGated(hA.words, 2.9);
  PP.textOut(tl, hA.words, 4.1);
  wordsInGated(hB.words, 4.3);

  // 3.40 / 3.55 callout leaders draw out from the vial, dots land first, labels type on right after
  PP.popIn(tl, cL.dot, 3.4, { from: 0.3 });
  PP.draw(tl, cL.path, 3.4, 0.3);
  PP.typeOn(tl, cL.chars, 3.7);
  PP.popIn(tl, cR.dot, 3.55, { from: 0.3 });
  PP.draw(tl, cR.path, 3.55, 0.3);
  PP.typeOn(tl, cR.chars, 3.85);

  // ================================================================== 5.60–6.00 ZOOM-THROUGH (hand-off #2)
  PP.textOut(tl, logoWrap, 5.6);
  PP.textOut(tl, hB.words, 5.6);
  tl.fromTo(
    zoom,
    { scale: 1, filter: "blur(0px)", opacity: 1 },
    { scale: 2.6, filter: "blur(14px)", opacity: 0, duration: 0.4, ease: "power2.in", immediateRender: false },
    5.6,
  );
});
