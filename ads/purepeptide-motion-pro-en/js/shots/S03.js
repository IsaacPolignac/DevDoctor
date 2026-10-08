// S03 · "We measure it" · f216–f306 (7.20–10.20) · AI plate hero.mp4 (#v-hero, media 0 → 3.0 s, 1:1). The plate carries its own
// slow push-in on black (vial 348 → 450 px wide, decelerating to a stop by ≈ f296). Light only — no type, no site (SHOTS §S03).
// Two passes of light over the vial, each inside a container masked by a soft luma matte of the plate (assets/fx/make_s03_matte.py →
// s03_matte_a.png = plate frame 7 ≈ f223, s03_matte_b.png = plate frame 46 ≈ f272; matte = max(0.75·silhouette, smoothstep(luma, 12,
// 120)) blurred 6 / 3 px, faded to 0 over the top 48 / bottom 90 px), screen blend, so a band never meets a frame edge with a hard line:
//   1. the S02 band carry (§0.9): the 105° band (220 px) is ON the vial's left side on the cut frame f216 (core at the vial's left edge
//      at label height, on the cap's centre-left above: the light leads the cut), already at speed (sine.out — the SoftTop band was at
//      full speed on the glass at f216), its trailing edge clear of the vial's right edge at the base by f234 (clear at label height
//      by ≈ f225). Fastest frame = f216 (48 px/f).
//   2. MEASURE: a level line of light (2 px core + 220 px halo), cap → base over f266–f278, its centre on the label's centre
//      (y 668.5 at plate frame 46: blue stripes 410–419 / 918–927) on f272 = VO.w('L03', 6) "measure". Ease power1.inOut
//      (= quadratic in GSAP; DEVIATION from the contract's expo.inOut: expo puts the line on the label for ONE frame = a flicker,
//      and so does GSAP's cubic power2; the quadratic keeps the same window, the same centre frame and the same fastest frame f272
//      (217 px/f) and the line reads on the label for 3 f: f271 y 470, f272 y 668, f273 y 867). The halo stretches with the speed
//      like a 180° shutter (scaleY 1 + 0.5·px-per-frame/220 → 1.49× at the peak, opacity ∝ 1/√stretch); over the glass rows (the
//      neck / shoulder y 200–410 and the base below 927) a 12 px fractalNoise feDisplacementMap (±6 px, html/S03.html #s03-shimmer)
//      refracts the line; straight on the cap, the crimp and the label. 3 f fade-in at the cap; the matte's bottom fade dissolves
//      it at the base (f274 y 1028 at ≈ 50 %, gone by f275).
//   3. the plate never freezes: a 2D push 1.000 → 1.025 power2.in f270–f298 takes over as the plate's own push dies (≈ f296), then
//      push-in continuity (§0.9): scale → ×1.22 expo.in f298–f306 about the cap (953, 140); S04 lands 1.15 → 1.00 expo.out.
// "print" (f243 = VO.w('L03', 3)): nothing — the plate's own push (restraint, BRIEF §5).
// Sound (BRIEF §7; 2D, fastest frames stated here): SWEEP2 ends on f216 = the carry band's fastest frame (glass_tick A5 on f216) ·
// MEASURE band_rise ending f272, light_sweep peak f272 = the pass's fastest frame (power1.inOut midpoint), glass_tick A6 f272 ·
// CUT2 f306 (glass_tick D6). No other sound frames in this shot.
PP.shot("S03", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S03"), T1 = PP.OUT("S03");
  const q = (s) => root.querySelector(s), qa = (s) => Array.from(root.querySelectorAll(s));
  const CX = 640; // the matte containers start at stage x 640 (the vial column 640–1280)
  // dE/du of a GSAP ease by central difference (one-sided at the ends)
  const slope = (E, u) => {
    const h = 1 / 240, a = Math.max(0, u - h), b = Math.min(1, u + h);
    return (E(b) - E(a)) / (b - a);
  };

  // ---- 1. the band carry f216–f234 (the light band carries the cut, §0.9) -----------------------------------------
  // Band centre in stage x at label height (y 540 = the box's rotation centre; at stage y the band sits (540 − y)·tan 15° to the
  // right). f216: core 20 px inside the vial's left edge (772 at plate frame 7) → 827; the cap (y 130) sees it at 937, centre-left.
  // f234: trailing edge (centre − 110 px) clear of the vial's right edge (1133) at the matte's base (y ≈ 980, lean −118) → 1380.
  const bx = q(".s03-bx");
  const X0 = 827, X1 = 1380, NX = 18;
  const EX = gsap.parseEase("sine.out");
  const setX = (u) => {
    const x = X0 + (X1 - X0) * EX(u);
    const vpx = (slope(EX, u) * (X1 - X0)) / NX; // px per frame: 48 at f216 → 0 at f234
    const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch across the travel (1.11 → 1.00)
    bx.style.opacity = u < 1 ? (1 / Math.sqrt(s)).toFixed(3) : "0";
    bx.style.transform = `translateX(${(x - CX).toFixed(2)}px) rotate(15deg) scaleX(${s.toFixed(4)})`;
  };
  PP.drive(tl, setX, 0, 1, f(216), f(234) - f(216), "none");

  // ---- 2. MEASURE f266–f278: the vertical measuring pass, centre on "measure" ----------------------------------
  const by = qa(".s03-by"); // two copies (glass rows through the shimmer filter, label rows plain), one setter
  const tM = PP.word("S03", "L03", 6, "S03 measure"); // f272 (VO.w('L03', 6) = 9.05 s → frame-snapped 9.0667)
  const tA = PP.clamp(tM - 6 * F, T0, tM, "S03 measure start"), tB = PP.clamp(tM + 6 * F, tM, T1 - F, "S03 measure end");
  const Y0 = 18, Y1 = 1319; // cap top (y 17 at plate frame 46) → past the base; midpoint 668.5 = the label centre
  const E = gsap.parseEase("power1.inOut"); // quadratic (GSAP power1); power2 is cubic
  const NF = Math.max(1, Math.round((tB - tA) / F)); // 12 f
  const setY = (u) => {
    const y = Y0 + (Y1 - Y0) * E(u);
    const vpx = (slope(E, u) * (Y1 - Y0)) / NF; // px per frame (217 at the peak, u 0.5 = f272; 2× the average)
    const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch of the halo: 1 → 1.49 at the peak
    const on = u > 0 && u < 1;
    const op = on ? Math.min(1, u / 0.25) / Math.sqrt(s) : 0; // 3 f fade-in at the cap, energy spread over the stretch
    const tf = `translateY(${y.toFixed(2)}px) scaleY(${s.toFixed(4)})`;
    for (const el of by) {
      el.style.opacity = op.toFixed(3);
      el.style.transform = tf;
    }
  };
  PP.drive(tl, setY, 0, 1, tA, tB - tA, "none");

  // ---- 3. the plate never freezes + push-in continuity into S04 (§0.9) ------------------------------------------
  const v = document.getElementById("v-hero");
  if (v) {
    tl.set(v, { transformOrigin: "953px 140px" }, T0); // about the cap: the push dives toward S04's cap macro
    PP.vmove(tl, v, f(270), f(298), { s: 1 }, { s: 1.025 }, "power2.in"); // 0 → 0.18 %/f as the plate's own push dies
    PP.vmove(tl, v, f(298), f(306), { s: 1.025 }, { s: 1.025 * 1.22 }, "expo.in"); // ×1.22 at the cut (f305 ≈ ×1.09)
  } else console.warn("[S03] #v-hero missing: no push-in continuity");
});
