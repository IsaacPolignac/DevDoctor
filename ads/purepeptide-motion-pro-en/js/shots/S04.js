// S04 · "Every batch" · f306–f396 (10.20–13.20) · AI plate cap.mp4 (#v-cap, media 0 → 3.0 s, 1:1): the plate's own descent to a
// top ¾ view of the sealed cap + crimp on black. Light only — no type, no site (SHOTS §S04: "the light says it").
// Everything is a pure function of time: ONE setter for the plate (landing × push × whip, also applied to the .s04-fx wrapper so
// the cap mattes stay registered), one setter per light pass.
//   1. push-in continuity (§0.9): S03 arrives at ×1.22 expo.in; S04 lands scale 1.15 → 1.00 expo.out f306–f314 about the cap's
//      centre (960, 400), then the 1 %/s 2D push (× (1 + 0.01·(t − T0))) runs to the cut: never static, the push never stops.
//   2. EVERY ×2: two quick horizontal passes (6 f each) of the film's 105° band (220 px, cold white, screen blend) across the sealed
//      cap, masked by a soft luma matte of the plate at each pass's centre frame (assets/fx/s04_matte_{a,b}.png). Pass A f333–f339
//      centred on f336 = VO.w('L04', 0) "Every", pass B f354–f360 centred on f357 = VO.w('L04', 2) "Every" (every single one): the
//      same direction, the same speed — a scanner, not a flourish. Core x 470 → 1450 (980 px). Ease power1.inOut (quadratic;
//      DEVIATION from PP.band's expo.inOut, for the same reason as S03: expo puts the band on the cap for ONE frame = a flicker; the
//      quadratic keeps the window, the centre frame and the fastest frame, and the band reads on the cap for 5 f: f334 the core on
//      the left rim, f335 left half, f336 core on the cap's centre at 327 px/f, f337 right half, f338 the core on the crimp's right
//      edge, going down the flank). The halo stretches with the speed like a 180° shutter (scaleX 1 + 0.5·px-per-frame/220
//      → 1.74× at the peak, opacity ∝ stretch^-1/4: 0.87 at the peak — S03's 1/√stretch left the band a pale sliver on the blue
//      cap), a 1 f ramp at each end (only the soft shoulder is on the object there). The whole .s04-fx wrapper is screen-blended
//      (z 12) so the band brightens the plate instead of milking it; 2 px core line + 6 px glow = S03's line of light.
//   3. whip-tilt down (§0.9, the cut on "one." f396 = VO.w('L04', 4)): anticipation y 0 → +6 px f386–f390 (sine.inOut, §0.8
//      2–4 f), then y +6 → −140 px over f390–f396 power3.in (fastest at the cut: f393 −12, f394 −36, f395 −75, f396 −140 = never
//      shown; 18 / 33 / 51 px per frame on the last three), with a DIRECTIONAL blur on the last 3 frames only (f393–f395): an SVG
//      feConvolveMatrix 1 × N vertical box kernel on #v-cap, N = 0.8 × the frame's displacement (15 / 27 / 41 px), not a CSS blur.
//      S05 lands y +90 → 0 with its own 3 f blur in from f396.
// Sound (BRIEF §7; 2D, fastest frames stated here): CUT2 f306 (glass_tick D6, the push-in continuity) · EVERY ×2: light_sweep(0.3)
// + tick(4200), fastest frame = the pass centre (power1.inOut midpoint) = f336 and f357 exactly · WHIP f396: tsk + swipe(0.3)
// align="peak" — the whip accelerates into the cut, its fastest frame IS f396 (S04's last visible frame f395 moves 51 px/f).
// No other sound frames in this shot.
PP.shot("S04", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S04"), T1 = PP.OUT("S04");
  const q = (s) => root.querySelector(s);
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // dE/du of a GSAP ease by central difference (one-sided at the ends)
  const slope = (E, u) => {
    const h = 1 / 240, a = Math.max(0, u - h), b = Math.min(1, u + h);
    return (E(b) - E(a)) / (b - a);
  };

  // ---- 1 + 3. the plate: landing × push × whip, ONE setter over the whole window -----------------------------------
  const v = document.getElementById("v-cap");
  const fx = q(".s04-fx");
  const kern = document.getElementById("s04-whip-k");
  const ORIGIN = "960px 400px"; // the cap's centre at the cut (plate frame 1: cap disk y 226–490 → body centre ≈ 400)
  const EL = gsap.parseEase("expo.out"), EA = gsap.parseEase("sine.inOut"), EW = gsap.parseEase("power3.in");
  const tLand1 = f(314), tAnt0 = f(386), tWhip0 = f(390), tWhip1 = T1;
  const tCutVO = VO.w("L04", 4); // "one." — the cut frame per the contract (the window end is fixed; the voice is checked)
  if (Math.abs(PP.toF(tCutVO) - PP.toF(T1)) > 1) console.warn(`[S04] VO "one." at f${PP.toF(tCutVO)} ≠ the cut f${PP.toF(T1)}`);
  const ANT = 6, WHIP = 140; // px: anticipation down, whip up (the camera tilts down: the picture leaves at the top)
  const yAt = (t) => {
    if (t < tAnt0) return 0;
    if (t < tWhip0) return ANT * EA((t - tAnt0) / (tWhip0 - tAnt0));
    return ANT - (WHIP + ANT) * EW(c01((t - tWhip0) / (tWhip1 - tWhip0)));
  };
  const sAt = (t) => (1 + 0.15 * (1 - EL(c01((t - T0) / (tLand1 - T0))))) * (1 + 0.01 * Math.max(0, t - T0));
  const BLUR_FROM = f(393); // the last 3 frames of the window get the directional blur
  let lastN = 0;
  const plate = (t) => {
    const y = yAt(t), s = sAt(t);
    const tf = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(5)})`;
    if (v) v.style.transform = tf;
    if (fx) fx.style.transform = tf;
    if (!v || !kern) return;
    // the whip's directional blur: a 1 × N vertical box kernel, N = 0.8 × this frame's displacement (central difference over 1 f)
    const vpx = Math.abs(yAt(t + F / 2) - yAt(t - F / 2));
    let N = t >= BLUR_FROM - F / 2 && t < T1 ? Math.round(0.8 * vpx) : 0;
    if (N < 3) N = 0;
    else if (!(N & 1)) N += 1; // odd: the box is centred on the pixel
    if (N === lastN) return;
    lastN = N;
    if (!N) {
      v.style.filter = "";
      return;
    }
    kern.setAttribute("order", `1 ${N}`);
    kern.setAttribute("kernelMatrix", Array(N).fill("1").join(" "));
    kern.setAttribute("divisor", String(N));
    v.style.filter = "url(#s04-whip)";
  };
  if (v) v.style.transformOrigin = ORIGIN;
  if (fx) fx.style.transformOrigin = ORIGIN;
  if (!v) console.warn("[S04] #v-cap missing: no landing / push / whip on the plate");
  PP.driveT(tl, plate, T0, T1);

  // ---- 2. EVERY ×2: the horizontal passes over the sealed cap ---------------------------------------------------------
  // Band centre in stage x at y 540 (the box's rotation centre; at stage y the band sits (540 − y)·tan 15° to the right).
  // 470 → 1450 (980 px): at u = 1/6 the core line is ON the cap's left rim (x 552 / 531 at the cap's mid rows, lean +37), at u = 5/6
  // it is on the crimp's right edge (≈ 1350 at y 750, lean −56), so the pass reads on 5 of its 6 frames (off at u = 0 and 1); the
  // core crosses the cap's centre (959, 400) at u = 0.48 = 0.12 f before the word (the ±1 f QC tolerance is 160 px here).
  const X0 = 470, X1 = 1450, E = gsap.parseEase("power1.inOut");
  const pass = (band, tC, label) => {
    const tA = PP.clamp(tC - 3 * F, T0, tC, label + " start"), tB = PP.clamp(tC + 3 * F, tC, T1 - F, label + " end");
    const NF = Math.max(1, Math.round((tB - tA) / F)); // 6 f
    const set = (u) => {
      const x = X0 + (X1 - X0) * E(u);
      const vpx = (slope(E, u) * (X1 - X0)) / NF; // px per frame: 327 at the peak (u 0.5 = the word), 2× the average
      const s = 1 + (0.5 * vpx) / 220; // 180° shutter stretch of the halo across the travel
      const on = u > 0 && u < 1;
      const op = on ? Math.min(1, 6 * u, 6 * (1 - u)) / Math.sqrt(Math.sqrt(s)) : 0; // 1 f ramp at each end (only the soft shoulder is on the cap there); the stretch dims it only to s^-1/4 (0.87 at the peak: the pass must READ on the cap in 6 f)
      band.style.opacity = op.toFixed(3);
      band.style.transform = `translateX(${x.toFixed(2)}px) rotate(15deg) scaleX(${s.toFixed(4)})`;
    };
    PP.drive(tl, set, 0, 1, tA, tB - tA, "none");
    return PP.toF(tC);
  };
  const fA = pass(q(".s04-a .s04-band"), PP.word("S04", "L04", 0, "S04 Every #1"), "S04 pass A"); // f336
  const fB = pass(q(".s04-b .s04-band"), PP.word("S04", "L04", 2, "S04 Every #2"), "S04 pass B"); // f357
  if (fA !== 336 || fB !== 357) console.warn(`[S04] pass centres f${fA} / f${fB} (mattes were cut for f336 / f357: re-run assets/fx/make_s04_matte.py)`);
});
