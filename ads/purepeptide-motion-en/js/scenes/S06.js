// S06 · fly-in → the type becomes the real H1 · window f674–f750 (22.467–25.000 s) · PAPER. SCENES §S06.
//   f674–f726  #type-h1 "Purity, / proven." (180 px, created by S05 under #stage, z 40) holds still with a slow push
//              1 → 1.007 (linear) while the Blender fly-in #v-flyin (z 30, f682–f749) rises behind it and comes to the words.
//   f726–f750  FLIP, 24 f expo.inOut: one uniform scale about the block's ink centre (S05 laid the lines out so that
//              scale(SC) about that centre lands both ink boxes on the live H1 at REST, SC ≈ 0.177). The landing target
//              rides on the settling phone (its last ~10 px of travel, measured per frame on the render), so the words
//              arrive ON the screen, not on where the screen will be.
//   f735–f749  contact shadow (front_shadow.png, same canvas as the rig) ramps 0 → 1, power2.out, tracking the phone too.
//   f750       the rig takes over at REST (main.js), S05/S06 hide #type-h1; the real bitmap H1 is under the same pixels.
// No word-locked events: VO L10 "See for yourself." (≈ f681) plays over the hold; the DROP (CUES.DROP, f750) is the landing.
PP.scene("S06", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const fx = (x) => x.toFixed(3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  const T0 = f(674), T1 = f(750);
  const tFlip0 = f(726), tFlip1 = f(750); // 24 f expo.inOut, lands on the DROP
  const tSh0 = f(735), tSh1 = f(749);
  if (Math.abs(tFlip1 - CUES.DROP) > 1e-6) console.warn("[S06] FLIP landing is off the DROP");

  // ------------------------------------------------------------------ the settling phone (measured, not animated)
  // assets/iphone/renders/flyin_land/0040–0067.png (= f722–f749): alpha-centroid offset from the REST pose (stage px) and
  // height ratio (scale about the REST centroid 959.41, 539.18). Frame 67 (f749) is REST exactly.
  const PC = [959.41, 539.18];
  const SETTLE0 = 722;
  const SETTLE = [
    [34.03, 29.27, 0.99077], [32.01, 27.55, 0.99094], [30.06, 25.93, 0.99168], [28.2, 24.37, 0.99229],
    [26.41, 22.83, 0.99241], [24.69, 21.38, 0.99305], [23.05, 19.98, 0.99342], [21.45, 18.64, 0.9943],
    [19.93, 17.33, 0.99449], [18.48, 16.08, 0.99456], [17.06, 14.85, 0.99534], [15.72, 13.7, 0.99579],
    [14.44, 12.56, 0.99615], [13.18, 11.48, 0.99646], [12.0, 10.45, 0.99657], [10.88, 9.43, 0.99675],
    [9.78, 8.46, 0.99706], [8.71, 7.55, 0.99729], [7.68, 6.69, 0.99801], [6.69, 5.82, 0.99806],
    [5.73, 4.98, 0.99806], [4.81, 4.2, 0.99847], [3.94, 3.42, 0.99884], [3.12, 2.64, 0.99898],
    [2.31, 1.97, 0.99979], [1.48, 1.24, 0.99976], [0.68, 0.61, 0.99966], [0, 0, 1],
  ];
  // phone offset at time t (frame-interpolated; identity from f749 on, i.e. the rig at REST)
  const phoneAt = (t) => {
    const u = t * 30 - SETTLE0;
    if (u <= 0) return SETTLE[0];
    if (u >= SETTLE.length - 1) return SETTLE[SETTLE.length - 1];
    const i = Math.floor(u), k = u - i, a = SETTLE[i], b = SETTLE[i + 1];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  };
  // stage point P of the REST pose, carried by the phone at time t
  const onPhone = (x, y, t) => {
    const [dx, dy, s] = phoneAt(t);
    return [PC[0] + dx + s * (x - PC[0]), PC[1] + dy + s * (y - PC[1])];
  };

  // ------------------------------------------------------------------ ink fit (local helper, not in lib.js)
  // S05 lays "Purity, / proven." out from canvas measureText at build time. In the project's own snapshot/render run that
  // measure happens before DM Sans 800 is usable (S05 gets letter-spacing −1.887 px instead of −5.616 px, and the DOM
  // Range boxes are fallback-font boxes too), so the painted lines came out ≈ 20 px too wide and 15–33 px off their ink
  // targets: no uniform scale could land them on the H1. So S06 re-fits the layer ANALYTICALLY from the font file's own
  // metrics (no DOM or canvas measurement, hence no font race): DM Sans 800 (assets/fonts/dm-sans-latin-800-normal.woff2,
  // fontTools, units/1000): A = kerned advance sum (GPOS pair kerning), x0 = xMin of the first glyph, adv/x1 = advance
  // and xMax of the last glyph, top/bot = ink extremes. Ink width at tracking LS = A·u + (n−1)·LS − x0·u − (adv−x1)·u.
  // Each line's tracking is solved for the site's ink width/height ratio, and its pen/baseline placed so that ONE scale
  // SC about (CX, CY) lands both ink boxes on their REST targets (data-rest, measured on clean/home.png).
  // Where S05's canvas did see the font (a scratch copy of the project), the corrections are < 3 px at 180 px (≈ 0.5 px landed).
  const GM = {
    "Purity,": { A: 3160, x0: 68, adv: 252, x1: 215, top: 725, bot: -220 },
    "proven.": { A: 3683, x0: 66, adv: 258, x1: 215, top: 516, bot: -220 },
  };
  function fitLines(th, CX, CY) {
    const PS = 180, BL = 0.841, PAD_T = 10; // S05's layout: 180 px lines, baseline 0.841 em under the box top (hhea 992/−310), 10 px pad
    const u = PS / 1000;
    const lines = Array.from(th.querySelectorAll(".th-mask")).map((m) => {
      const inner = m.querySelector(".th-in");
      return { m, inner, txt: inner ? inner.textContent : "", rest: (m.dataset.rest || "").split(",").map(Number) };
    });
    if (lines.length !== 2 || lines.some((l) => !GM[l.txt] || l.rest.length !== 4 || l.rest.some(isNaN))) {
      console.warn("[S06] fitLines: unexpected #type-h1 structure, keeping S05's layout");
      return 0;
    }
    lines.forEach((l) => (l.g = GM[l.txt]));
    const SC = lines.reduce((s, l) => s + (l.rest[3] - l.rest[1]) / ((l.g.top - l.g.bot) * u), 0) / 2;
    const log = [];
    lines.forEach((l) => {
      const g = l.g, n = l.txt.length;
      const wT = (l.rest[2] - l.rest[0]) / SC; // ink width at 180 px
      const ls = (wT - (g.A - g.x0 - (g.adv - g.x1)) * u) / (n - 1);
      const xcT = CX + ((l.rest[0] + l.rest[2]) / 2 - CX) / SC;
      const pen = xcT - wT / 2 - g.x0 * u;
      const ycT = CY + ((l.rest[1] + l.rest[3]) / 2 - CY) / SC;
      const base = ycT + ((g.top + g.bot) / 2) * u;
      const top = base - BL * PS - PAD_T;
      log.push({ line: l.txt, ls: [parseFloat(l.inner.style.letterSpacing), +ls.toFixed(3)], pen: [parseFloat(l.inner.style.left), +pen.toFixed(2)], top: [parseFloat(l.m.style.top), +top.toFixed(2)] });
      l.inner.style.letterSpacing = ls.toFixed(3) + "px";
      l.inner.style.left = pen.toFixed(3) + "px";
      l.m.style.top = top.toFixed(3) + "px";
    });
    th.dataset.inkFit = JSON.stringify({ SC: +SC.toFixed(5), lines: log });
    if (log.some((o) => Math.abs(o.ls[1] - o.ls[0]) > 0.1 || Math.abs(o.pen[1] - o.pen[0]) > 1 || Math.abs(o.top[1] - o.top[0]) > 1))
      console.warn("[S06] re-fitted #type-h1 to the H1 (S05's canvas layout was off)", th.dataset.inkFit);
    return SC;
  }

  // ------------------------------------------------------------------ #type-h1 (S05's hand-off layer)
  const th = document.getElementById("type-h1");
  if (!th) {
    console.warn("[S06] #type-h1 missing (S05 did not build): nothing to FLIP");
  } else {
    const [CX, CY] = (th.dataset.inkCentre || "960.84,554.71").split(",").map(Number);
    const SC = fitLines(th, CX, CY) || +th.dataset.scale || 0.1777;
    // REST target of the block's ink centre, read from the rig (camera at f750 = REST; S07 starts its drift there)
    const rest = PH.stage((CX - PH.SX) / PH.K, (CY - PH.SY) / PH.K, T1);
    if (Math.hypot(rest.x - CX, rest.y - CY) > 0.05 || Math.abs(rest.g - 1) > 1e-6) console.warn("[S06] rig is not at REST on f750", rest);
    const PUSH = 1.007;
    const eIO = gsap.parseEase("expo.inOut");
    // layer transform at time t: [x, y, scale] about the ink centre (CX, CY)
    const poseAt = (t) => {
      if (t < tFlip0) return [0, 0, lerp(1, PUSH, clamp01((t - T0) / (tFlip0 - T0)))];
      const e = eIO(clamp01((t - tFlip0) / (tFlip1 - tFlip0)));
      const [px, py] = onPhone(rest.x, rest.y, t);
      return [e * (px - CX), e * (py - CY), lerp(PUSH, SC * phoneAt(t)[2], e)];
    };
    // (polish) speed-matched blur on the FLIP: the 24 f expo.inOut covers 0.83 of scale in ~6 frames, so the 180 px
    // glyphs strobe through ~60 px/frame at the peak. Blur ∝ the outer-ink-edge travel per frame (≈ 300 px from the
    // centre), capped at 1.6 px on screen, 0 below 0.35 px: exactly 0 on the hold and on the landed frames (f744→f749).
    const R_EDGE = 300, BLUR_K = 0.035, BLUR_MAX = 1.6;
    const blurAt = (t) => {
      if (t < tFlip0 || t >= tFlip1 - F) return 0;
      const a = poseAt(t), b = poseAt(t - F);
      const v = Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.abs(a[2] - b[2]) * R_EDGE;
      const px = Math.min(BLUR_MAX, BLUR_K * v);
      return px < 0.35 ? 0 : px;
    };
    // (contrast fix) a paper-coloured halo behind the glyphs, sampled from the PAPER world around the block
    // (rgb 246,249,251). On paper it is invisible; where the navy fly-in passes BEHIND the words (f682–f725: "n." over the
    // camera plateau, the edge-on frame, the bezels) it keeps the #1B1E24 / teal ink separated from the navy body.
    // Ramps in f679–f684 (before the phone enters at f682), out over f726–f736 (before the type meets the light screen),
    // so the landed frames (and the f749/f750 cut against the bitmap H1) carry no halo at all.
    const tH0 = f(679), tH1 = f(684), tH2 = f(726), tH3 = f(736);
    const haloAt = (t) => (t < tH1 ? clamp01((t - tH0) / (tH1 - tH0)) : 1 - clamp01((t - tH2) / (tH3 - tH2)));
    const inners = Array.from(th.querySelectorAll(".th-in"));
    const HALO = (a) => a <= 0.002 ? "none"
      : `0 0 2px rgba(246,249,251,${(a * 0.95).toFixed(3)}), 0 0 9px rgba(246,249,251,${(a * 0.85).toFixed(3)}), 0 0 22px rgba(246,249,251,${(a * 0.6).toFixed(3)})`;
    let lastHalo = null;
    PP.driveT(tl, (t0) => {
      const t = t0 + 1e-4;
      const [x, y, sc] = poseAt(t);
      th.style.transform = `translate(${fx(x)}px, ${fx(y)}px) scale(${sc.toFixed(5)})`;
      const bl = blurAt(t);
      th.style.filter = bl > 0 ? `blur(${(bl / sc).toFixed(3)}px)` : "none"; // filter is in the layer's local (pre-scale) px
      const h = HALO(haloAt(t));
      if (h !== lastHalo) { inners.forEach((el) => (el.style.textShadow = h)); lastHalo = h; }
      // once inside the screen (FLIP half-way, f738, ≤ 110 px) the type IS the site's H1 (colours sampled from the capture,
      // teal on the lit screen ≈ 4.25:1 like the bitmap that replaces it at f750): same QC exemption as the #phone subtree.
      const seated = t >= tFlip0 + 0.5 * (tFlip1 - tFlip0);
      if (seated !== (th.dataset.qcSkip != null)) seated ? (th.dataset.qcSkip = "site H1 depiction (lands on #phone)") : delete th.dataset.qcSkip;
    }, T0, T1);
    tl.set(th, { opacity: 0 }, T1); // removed on the DROP: the real bitmap H1 (S07's bloom) is under the same pixels
  }

  // ------------------------------------------------------------------ contact shadow (rides the phone, then = the rig's)
  const sh = root.querySelector(".s6-shadow");
  const eSh = gsap.parseEase("power2.out");
  PP.driveT(tl, (t0) => {
    const t = t0 + 1e-4;
    const a = eSh(clamp01((t - tSh0) / (tSh1 - tSh0)));
    if (a <= 0) {
      sh.style.opacity = "0";
      return;
    }
    const [dx, dy, s] = phoneAt(t);
    sh.style.opacity = a.toFixed(4);
    sh.style.transform = `translate(${fx(dx)}px, ${fx(dy)}px) scale(${s.toFixed(5)})`;
  }, T0, T1);

  PP.S06 = { flip: [726, 750], shadow: [735, 749] };
});
