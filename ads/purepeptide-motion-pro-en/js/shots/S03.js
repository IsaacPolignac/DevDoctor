// S03 · "We measure it" · f216–f306 (7.20–10.20) · AI plate hero.mp4 (#v-hero, media 0 → 3.0 s, 1:1). The plate carries its own
// push-in on black — MEASURED (tools: the polish pass, 73 plate frames): a zoom about stage (946, 563), scale 1.000 → 1.298 by plate
// frame 66 ≈ f297, decelerating (label 346 → 450 px wide), then it stops. Light only — no type, no site (SHOTS §S03).
// Two passes of light over the vial, each inside a container masked by a soft luma matte of the plate (assets/fx/make_s03_matte.py →
// s03_matte_a.png = plate frame 7 ≈ f223, s03_matte_b.png = plate frame 46 ≈ f272; matte = max(0.75·silhouette, smoothstep(luma, 12,
// 120)) blurred 6 / 3 px, faded to 0 over the top 48 / bottom 90 px), screen blend, so a band never meets a frame edge with a hard line.
//   0. THE LIGHT REVEALS (exposure, .s03-dim: a black veil at z 11 between the plate and the light): screen-blending a white band onto
//      the white label (240) adds 15 levels = invisible, onto 190 it adds 60. So the plate arrives at 78 % on the cut frame and fills
//      to 100 % with the carry band's own ease (the band lights the vial as it crosses: a light-led cut, S02's last frame is near
//      black), and breathes down 18 % under the measuring pass (cosine bump f262–f284, the floor on f272, the pass itself the
//      motivation). DEVIATION from the contract's "the plate's own push only": without it neither pass reads on the label (the S04
//      builder's note: "a pale sliver"), and the measuring pass is this shot's VO-locked event.
//   1. the S02 band carry (§0.9 "the light band carries the cut", BRIEF §7 SWEEP2 "crosses the black glass into the vial"): the 105°
//      band (220 px halo, 2 px core line) is the SAME line of light that S02 leaves on the glass — a MATCH CUT on the light (the polish
//      pass's upgrade). Measured on the S02 snapshots: S02's core crosses stage y 540 at x 971 / 992 / 1016 on f213 / f214 / f215
//      (lean 16.5°, accelerating 21 → 24 px/f); continued one frame it is at x 1040 on f216, moving 24.6 px/f. So the carry band's
//      core is at stage (1040, 540) on the cut frame at 24.6 px/f (cubic-bezier(0.4, 0.5, 0.6, 1): slope 1.25 at u = 0 → the cut IS
//      the fastest frame), easing to rest at 1394 by f234: the upper end of the line is on the cap's right corner, the lower end on the
//      base's centre; the core leaves the label's right edge ≈ f220, the vial's right edge at the base ≈ f229, the trailing shoulder is
//      clear of the base (right edge 1142 at plate frame 16) by f234 with 24 px to spare. The first build restarted the band at the
//      vial's LEFT edge (x 827): a 213 px jump backwards on the cut, against the line's own motion. Stretch like a 180° shutter (scaleX
//      1 + 0.5·px-per-frame/220, 1.056 → 1.00), opacity ∝ stretch^-1/4.
//   1b. THE MATTES FOLLOW THE PLATE (polish fix): each matte is one plate frame, but the plate zooms 3.3 % across the carry (the cap top
//      moves 129 → 113 px: the old matte let the halo bloom 16 px above the cap on black, and clipped the halo 7 px inside the right
//      rail by f234). The two containers are scaled per frame by s(plate frame)/s(matte frame) about the plate's measured zoom centre
//      (ZOOM below; max residual 4 px over all 73 frames), and the band positions are converted into the scaled container's space.
//   2. MEASURE: a level line of light (2 px core + 220 px halo), cap → base over f266–f278, its centre on the label's centre
//      (y 668.5 at plate frame 46: blue stripes 410–419 / 918–927) on f272 = VO.w('L03', 6) "measure". Ease power1.inOut
//      (= quadratic in GSAP; DEVIATION from the contract's expo.inOut: expo puts the line on the label for ONE frame = a flicker,
//      and so does GSAP's cubic power2; the quadratic keeps the same window, the same centre frame and the same fastest frame f272
//      (217 px/f) and the line reads on the label for 3 f: f271 y 470, f272 y 668, f273 y 867). The halo stretches with the speed
//      like a 180° shutter (scaleY 1 + 0.5·px-per-frame/220 → 1.49× at the peak, opacity ∝ stretch^-1/4); over the glass rows (the
//      neck / shoulder y 200–410 and the base below 927) a 12 px fractalNoise feDisplacementMap (±6 px, html/S03.html #s03-shimmer,
//      one octave = 12 px features, the contract's number) refracts the line; straight on the cap, the crimp and the label. 3 f
//      fade-in at the cap; the matte's bottom fade dissolves it at the base (f274 y 1028 at ≈ 50 %, gone by f275).
//   3. the plate never freezes: a 2D push 1.000 → 1.025 power2.in f270–f298 takes over as the plate's own push dies (≈ f297), then
//      push-in continuity (§0.9): scale → ×1.22 expo.in f298–f306 about the cap (953, 140); S04 lands 1.15 → 1.00 expo.out.
//      (The 2D push is ≤ 1.002 during the measuring pass: the mattes ignore it, ≤ 1 px.)
// "print" (f243 = VO.w('L03', 3)): nothing — the plate's own push (restraint, BRIEF §5).
// Sound (BRIEF §7; 2D, fastest frames stated here): SWEEP2 ends on f216 = the carry band's fastest frame (24.6 px/f, glass_tick A5 on
// f216) · MEASURE band_rise ending f272, light_sweep peak f272 = the pass's fastest frame (power1.inOut midpoint), glass_tick A6 f272 ·
// CUT2 f306 (glass_tick D6). No other sound frames in this shot.
PP.shot("S03", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S03"), T1 = PP.OUT("S03");
  const q = (s) => root.querySelector(s), qa = (s) => Array.from(root.querySelectorAll(s));
  const CX = 640; // the matte containers start at stage x 640 (the vial column 640–1280)
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // dE/du of an ease by central difference (one-sided at the ends)
  const slope = (E, u) => {
    const h = 1 / 240, a = Math.max(0, u - h), b = Math.min(1, u + h);
    return (E(b) - E(a)) / (b - a);
  };
  // CSS cubic-bezier(x1, y1, x2, y2) as a function of u (bisection on the x polynomial; the same math as blender/common.py bez())
  const bezier = (x1, y1, x2, y2) => (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const cx = (p1, p2, s) => 3 * p1 * s * (1 - s) * (1 - s) + 3 * p2 * s * s * (1 - s) + s * s * s;
    let lo = 0, hi = 1, s = u;
    for (let i = 0; i < 40; i++) {
      s = (lo + hi) / 2;
      if (cx(x1, x2, s) < u) lo = s;
      else hi = s;
    }
    return cx(y1, y2, s);
  };

  // ---- the plate's own zoom (measured per plate frame, 24 fps; frame k is shown at media time [k/24, (k+1)/24)) ------------
  // scale relative to plate frame 1 about stage (946.2, 563.1); the matte containers are scaled by s(frame)/s(matte frame).
  const ZOOM = {
    cx: 946.2, cy: 563.1,
    s: [1.0, 1.0053, 1.0107, 1.0148, 1.0214, 1.0267, 1.0333, 1.0413, 1.0494, 1.0545, 1.0598, 1.0664, 1.0744, 1.0812, 1.0878, 1.0944,
      1.1009, 1.1051, 1.1116, 1.117, 1.125, 1.1304, 1.1369, 1.1437, 1.1476, 1.1542, 1.1583, 1.1649, 1.1715, 1.1768, 1.1809, 1.1875,
      1.1941, 1.1982, 1.2036, 1.2075, 1.2126, 1.2167, 1.2221, 1.2272, 1.2301, 1.2366, 1.2393, 1.242, 1.2473, 1.2512, 1.2539, 1.258,
      1.2605, 1.2658, 1.2671, 1.2712, 1.2712, 1.2765, 1.2778, 1.2819, 1.2831, 1.2843, 1.2872, 1.2878, 1.2885, 1.2911, 1.2926, 1.2926,
      1.2926, 1.2965, 1.2965, 1.2965, 1.2977, 1.2977, 1.2977, 1.2977, 1.2977],
  };
  const plateS = (t) => ZOOM.s[Math.max(0, Math.min(ZOOM.s.length - 1, Math.floor((t - T0) * 24 + 1e-4)))];
  const S_A = ZOOM.s[6], S_B = ZOOM.s[45]; // the matte frames: 7 (carry) and 46 (measure), 1-based
  const OX = ZOOM.cx - CX, OY = ZOOM.cy; // the zoom centre in container coordinates (css transform-origin on .s03-matte)

  // ---- word lock: "measure" (f272 = VO.w('L03', 6) = 9.05 s → frame-snapped 9.0667) ------------------------------
  const tM = PP.word("S03", "L03", 6, "S03 measure");
  const tA = PP.clamp(tM - 6 * F, T0, tM, "S03 measure start"), tB = PP.clamp(tM + 6 * F, tM, T1 - F, "S03 measure end");

  // ---- 1. the band carry f216–f234: the match cut on the light (§0.9) --------------------------------------------
  // Band centre in stage x at y 540 (the box's rotation centre; at stage y the band sits (540 − y)·tan 15° to the right).
  // f216: S02's core continued one frame = stage 1040 (S02 measured 971 / 992 / 1016 on f213–f215, +24.6 px/f); the cap (y 130)
  // sees the line at 1150 = the cap's right corner, the base (y 980) at 922 = its centre. f234: 1394 = X0 + 24.6 · 18 / 1.25 (the
  // bezier's start slope), so the speed on the cut frame is S02's; the trailing shoulder (−110, lean −118 at the base) ends at 1166,
  // clear of the vial's right edge at the base (1142 at plate frame 16).
  const bx = q(".s03-bx"), ca = q(".s03-a");
  const X0 = 1040, V0 = 24.6, NX = 18;
  const EX = bezier(0.4, 0.5, 0.6, 1); // slope 1.25 at u = 0: the cut is the fastest frame, easing to rest by f234
  const X1 = X0 + (V0 * NX) / 1.25; // 1394.2
  const tC0 = T0, tC1 = f(234);
  const setX = (u) => {
    const t = tC0 + u * (tC1 - tC0);
    const k = plateS(t) / S_A; // the matte follows the plate's zoom
    const x = X0 + (X1 - X0) * EX(u);
    const xl = OX + (x - ZOOM.cx) / k; // stage x → the scaled container's own coordinates
    const vpx = (slope(EX, u) * (X1 - X0)) / NX; // px per frame: 24.6 at f216 → 0 at f234
    const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch across the travel (1.056 → 1.00)
    if (ca) ca.style.transform = `scale(${k.toFixed(5)})`;
    bx.style.opacity = u < 1 ? Math.pow(s, -0.25).toFixed(3) : "0";
    bx.style.transform = `translateX(${xl.toFixed(2)}px) rotate(15deg) scaleX(${s.toFixed(4)})`;
  };
  PP.drive(tl, setX, 0, 1, tC0, tC1 - tC0, "none");

  // ---- 0. the exposure: the light reveals (one time-driven setter over the whole window) ------------------------
  const dim = q(".s03-dim");
  const DIM_CUT = 0.22, DIM_MEASURE = 0.18;
  const dIn0 = PP.clamp(tM - 10 * F, T0, tM, "S03 breath in"), dOut1 = PP.clamp(tM + 12 * F, tM, T1, "S03 breath out");
  const dimAt = (t) => {
    let d = 0;
    if (t < tC1) d = DIM_CUT * (1 - EX(c01((t - tC0) / (tC1 - tC0)))); // 0.22 on the cut frame, filled by the band's own ease
    if (t >= dIn0 && t < tM) d = Math.max(d, DIM_MEASURE * (0.5 - 0.5 * Math.cos((Math.PI * (t - dIn0)) / (tM - dIn0))));
    else if (t >= tM && t < dOut1) d = Math.max(d, DIM_MEASURE * (0.5 + 0.5 * Math.cos((Math.PI * (t - tM)) / (dOut1 - tM))));
    return d;
  };
  if (dim) PP.driveT(tl, (t) => (dim.style.opacity = dimAt(t).toFixed(3)), T0, T1);

  // ---- 2. MEASURE f266–f278: the vertical measuring pass, centre on "measure" ----------------------------------
  const by = qa(".s03-by"), cb = q(".s03-b"); // two band copies (glass rows through the shimmer filter, label rows plain), one setter
  const Y0 = 18, Y1 = 1319; // stage y: cap top (17 at plate frame 46) → past the base; midpoint 668.5 = the label centre
  const E = gsap.parseEase("power1.inOut"); // quadratic (GSAP power1); power2 is cubic
  const NF = Math.max(1, Math.round((tB - tA) / F)); // 12 f
  const setY = (u) => {
    const t = tA + u * (tB - tA);
    const k = plateS(t) / S_B; // the matte follows the plate's zoom (0.996 → 1.003 across the pass)
    const y = Y0 + (Y1 - Y0) * E(u);
    const yl = OY + (y - ZOOM.cy) / k; // stage y → the scaled container's own coordinates
    const vpx = (slope(E, u) * (Y1 - Y0)) / NF; // px per frame (217 at the peak, u 0.5 = f272; 2× the average)
    const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch of the halo: 1 → 1.49 at the peak
    const on = u > 0 && u < 1;
    const op = on ? Math.min(1, u / 0.25) * Math.pow(s, -0.25) : 0; // 3 f fade-in at the cap, energy spread over the stretch
    const tf = `translateY(${yl.toFixed(2)}px) scaleY(${s.toFixed(4)})`;
    if (cb) cb.style.transform = `scale(${k.toFixed(5)})`;
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
    PP.vmove(tl, v, f(298), f(306), { s: 1.025 }, { s: 1.025 * 1.22 }, "expo.in"); // ×1.22 at the cut (f305 ≈ ×1.12)
  } else console.warn("[S03] #v-hero missing: no push-in continuity");
});
