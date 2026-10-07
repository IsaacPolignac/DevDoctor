// S03 · "We measure it" · f216–f306 (7.20–10.20) · plate hero.mp4 (#v-hero, 1:1; its own push 1.00 → 1.30 about (953, 551),
// decelerating). Light only — no type, no site (SHOTS §S03). Two passes of light over the vial, each inside a container masked by
// a soft luma matte of the plate (assets/fx/s03_matte_a.png = plate frame 8 ≈ f225, s03_matte_b.png = plate frame 45 ≈ f272;
// matte = max(0.55·silhouette, smoothstep(luma, 12, 120)), blurred 6 / 3 px), screen blend, so the band never reaches the frame edge:
//   1. the S02 band carry (§0.9): the 105° band enters the vial's left edge ON the cut frame f216, already at speed (sine.out —
//      the SoftTop band was at full speed on the glass at f216), and is fully off the vial's right edge by f234.
//   2. MEASURE: a level line of light (3 px core + 220 px halo, peak 75 %), cap → base over f266–f278, its centre on the label
//      centre (y 668 at plate frame 45) on f272 = VO.w('L03', 6) "measure". Ease power2.inOut (DEVIATION from the contract's
//      expo.inOut: expo put the line on the label for ONE frame = a flicker; power2 keeps the same window, the same centre and the
//      same fastest frame f272 but the line reads on the label for 3 f). The halo stretches with the speed like a 180° shutter
//      (scaleY 1 + 0.5·px-per-frame/220 → 1.5× at the peak, opacity ∝ 1/√stretch); over the glass rows (above y 414 / below
//      y 922) a 12 px fractalNoise feDisplacementMap (±6 px, html/S03.html #s03-shimmer) refracts the line; straight on the label.
//   3. push-in continuity (§0.9): #v-hero scale 1.00 → 1.22 expo.in f298–f306 about the cap (953, 140); S04 lands 1.15 → 1.00.
// "print" (f243): nothing — the plate's own push (restraint).
// Sound (BRIEF §7, 2D: fastest frames stated here): SWEEP2 ends on f216 = the carry band's fastest frame (glass_tick A5 on f216) ·
// MEASURE band_rise ending f272, light_sweep peak f272 = the pass's fastest frame (expo.inOut midpoint), glass_tick A6 f272 ·
// CUT2 f306 (glass_tick D6).
PP.shot("S03", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S03");
  const q = (s) => root.querySelector(s), qa = (s) => Array.from(root.querySelectorAll(s));
  const CX = 640; // the matte containers start at stage x 640 (the vial column 640–1280)

  // ---- 1. the band carry f216–f234 (the light band carries the cut, §0.9) -----------------------------------------
  // Band centre in stage x. f216: its leading (upper-right) edge touches the vial's left edge (778 at plate frame 1 − 100 px
  // visible half-width − 110 px of the 15° lean at cap height) → 568. f234: its trailing (lower-left) edge is clear of the vial's
  // right edge (1134 at plate frame 15 + 100 + 144 of lean at the base) → 1378. Fastest frame = f216 (sine.out, 71 px/f there).
  const bx = q(".s03-bx");
  const X0 = 568, X1 = 1378;
  const EX = gsap.parseEase("sine.out");
  const dEX = (u) => (EX(Math.min(1, u + 1 / 120)) - EX(Math.max(0, u - 1 / 120))) * 60;
  const setX = (u) => {
    const x = X0 + (X1 - X0) * EX(u);
    const vpx = (dEX(u) * (X1 - X0)) / 18; // px per frame
    const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch across the travel
    bx.style.opacity = u < 1 ? (1 / Math.sqrt(s)).toFixed(3) : "0";
    bx.style.transform = `translateX(${(x - CX).toFixed(2)}px) rotate(15deg) scaleX(${s.toFixed(4)})`;
  };
  PP.drive(tl, setX, 0, 1, f(216), f(234) - f(216), "none");

  // ---- 2. MEASURE f266–f278: the vertical measuring pass, centre on "measure" ----------------------------------
  const by = qa(".s03-by"); // two copies (glass rows through the shimmer filter, label rows plain), one setter
  const tM = PP.word("S03", "L03", 6, "S03 measure"); // f272 (VO.w('L03', 6) = 9.05 s)
  const tA = PP.clamp(tM - 6 * F, T0, tM, "S03 measure start"), tB = PP.clamp(tM + 6 * F, tM, PP.OUT("S03") - F, "S03 measure end");
  const Y0 = 20, Y1 = 1316; // cap top (y 19 at plate frame 45) → past the base; midpoint 668 = the label centre (stripes 410 / 927)
  const E = gsap.parseEase("power2.inOut");
  const dE = (u) => (E(Math.min(1, u + 1 / 120)) - E(Math.max(0, u - 1 / 120))) * 60; // dE/du by central difference
  const NF = Math.round((tB - tA) / F); // 12 f
  const setY = (u) => {
    const y = Y0 + (Y1 - Y0) * E(u);
    const vpx = (dE(u) * (Y1 - Y0)) / NF; // px per frame (216 at the peak, u 0.5 = f272)
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

  // ---- 3. push-in continuity into S04 (§0.9): scale 1.00 → 1.22 expo.in f298–f306 about the cap ------------------
  const v = document.getElementById("v-hero");
  if (v) {
    tl.set(v, { transformOrigin: "953px 140px" }, T0);
    PP.vmove(tl, v, f(298), f(306), { s: 1 }, { s: 1.22 }, "expo.in");
  } else console.warn("[S03] #v-hero missing: no push-in continuity");
});
