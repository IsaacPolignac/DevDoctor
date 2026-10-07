// S10 · "PurePeptide. Purity, proven." + stop beat · window f1086–f1230 (36.200–41.000 s) · DOM/SVG · NAVY. SCENES §S10.
//   f1086–1110  #pill (S09's stage clone, z 55) travels from its lifted WIDE rect (≈ 1340,912 · 273×54) to the CTA slot
//               (960,760 · 520×84, radius 42, Inter 500 40 px), by box size + font-size (no scale: the text stays crisp),
//               24 f in-out (cubic-bezier(.62,0,.18,1): expo.inOut's settle without its 6-frame start dwell); y leads x a little, so the pill keeps rising out of its lift and arcs into place.
//               A soft drop shadow + top highlight grow under it (depth on navy).
//               Landing: +~1 % box micro-overshoot settling by f1118 (text size untouched), and a rim catch — one highlight
//               runs along the 1.5 px stroke + a faint glass glint, f1104–1124 (fills the hold before L16 'Pure').
//   f1086–1215  .s10-cam card push, linear 0.8 %/s (1 → 1.0344), wordmark + tagline only (not the pill). Stops at f1215.
//   L16 'Pure'  typed wordmark (PP.typedWordmark, light, width 720, y 372–445), 18 f, with its sheen; clamped f1120–1135.
//   L16 'Purity' / 'proven'  per-word blur-in (yPercent 35→0, blur 10→0, 12 f expo.out); #period follows "proven" by 3 f.
//   f1215–1230  STOP: no tween of this scene runs (everything has settled by ≈ f1184), the push has stopped, the grain is
//               frozen globally. Frame-identical f1215…f1229.
// Persistence: #S10-brand is re-parented onto #stage (z 40) so the wordmark, the tagline and #period stay up after this
// section hides at f1230 — S11 animates them in place (handle PP.S10). Nothing here hides them.
PP.scene("S10", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const E = (n) => gsap.parseEase(n);
  const lerp = (a, b, u) => a + (b - a) * u;
  const fx = (x) => x.toFixed(2);
  const snapF = (t) => Math.round(t * 30) / 30; // land word-locked events on the frame grid

  const T_IN = f(1086), T_PILL = f(1110), T_STOP = f(1215);
  const stage = document.getElementById("stage");

  // ------------------------------------------------------------------ the card (stage level, survives f1230)
  const brand = root.querySelector("#S10-brand");
  stage.appendChild(brand);
  const cam = brand.querySelector(".s10-cam");
  const wmSlot = brand.querySelector(".s10-wm");
  const tag = brand.querySelector(".s10-tag");
  const [wPurity, wProven, period] = Array.from(tag.querySelectorAll(".s10-w"));
  tl.set(brand, { opacity: 0 }, 0);
  tl.set(brand, { opacity: 1 }, T_IN);

  // ------------------------------------------------------------------ 1. pill → CTA slot (f1086–1110)
  const pill = document.getElementById("pill");
  if (!pill) console.warn("[S10] #pill missing (S09 did not build): the CTA pill is skipped");
  else {
    // S09's hand-off state (its lift ends at f1074): the URL pill's WIDE stage rect × 1.08, raised 10 px.
    const r0 = PH.stageRect([74, 796, 254, 50], f(1064));
    const LIFT = 1.08;
    const A = { cx: r0.x + r0.w / 2, cy: r0.y + r0.h / 2 - 10, w: r0.w * LIFT, h: r0.h * LIFT, fs: 16 * PH.K * LIFT };
    const B = { cx: 960, cy: 760, w: 520, h: 84, fs: 40 };
    // expo.inOut (SCENES) dwells ~6 f at the start, which read as dead frames right after the dive cut: this in-out keeps
    // expo's long settle but leaves on frame 2 (0.7 % at f1088, 3 % at f1090, 50 % at f1096, 92 % at f1102).
    const EIO = E(CustomEase.create("s10pill", "M0,0 C0.62,0 0.18,1 1,1"));
    // micro-overshoot: +2.6 % on the box at its peak (≈ f1108), settled by f1118; zero at u = 0.72 and u = U_END
    const T_SETTLE = f(1118), U_END = (T_SETTLE - T_IN) / (T_PILL - T_IN), OVS = 0.026;
    const bump = (u) => {
      const s = (u - 0.72) / (U_END - 0.72);
      return s <= 0 || s >= 1 ? 0 : Math.sin(Math.PI * s) * (1 - s) * (1 - s) * 2.4;
    };
    const YLEAD = 0.86; // y completes at 86 % of the move (continuous: the ease has zero slope at 1)
    const setPill = (u) => {
      const e = EIO(Math.min(1, u)), ey = EIO(Math.min(1, u / YLEAD));
      // landing micro-overshoot on the box only (the text keeps its own size: no wobble on the type)
      const es = e + OVS * bump(u);
      const w = lerp(A.w, B.w, es), h = lerp(A.h, B.h, es);
      const cx = lerp(A.cx, B.cx, e), cy = lerp(A.cy, B.cy, ey);
      const s = pill.style;
      s.left = fx(cx - w / 2) + "px";
      s.top = fx(cy - h / 2) + "px";
      s.width = fx(w) + "px";
      s.height = fx(h) + "px";
      s.borderRadius = fx(h / 2) + "px";
      s.fontSize = fx(lerp(A.fs, B.fs, e)) + "px";
      s.boxShadow = `0 ${fx(18 * e)}px ${fx(44 * e)}px rgba(3,10,32,${(0.38 * e).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,${(0.14 * e).toFixed(3)})`;
    };
    // Not PP.drive: its build-time setter(from) would overwrite S09's pre-lift box (seeks into f1064–1066).
    // Same function-property proxy as PP.drive (no callbacks), without the immediate call.
    let cur = 0;
    const o = { v(x) { if (x === undefined) return cur; cur = x; setPill(x); } };
    // the travel is 24 f (u 0→1, f1086–1110); the proxy runs on to f1118 (u 1→U_END) only for the overshoot's settle
    tl.fromTo(o, { v: 0 }, { v: U_END, duration: T_SETTLE - T_IN, ease: "none", immediateRender: false }, T_IN);

    // Quality upgrade · rim catch: as the pill seats, a highlight runs once along its 1.5 px stroke (masked to the ring
    // only, so the fill and the label are untouched) and a faint glint crosses the glass. It bridges the hold before the
    // wordmark (f1104–1124 → L16 'Pure' at f1127) and hands the eye from the CTA up to the brand. Gone (opacity 0) after.
    const rim = PP.el("div", "s10-rim", pill);
    rim.style.cssText =
      "position:absolute;left:-1.5px;top:-1.5px;right:-1.5px;bottom:-1.5px;border-radius:inherit;padding:1.5px;box-sizing:border-box;" +
      "pointer-events:none;opacity:0;" +
      "-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;" +
      "mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)";
    const glint = PP.el("div", "s10-glint", pill);
    glint.style.cssText = "position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;overflow:hidden";
    const band = (x, a, half) =>
      `linear-gradient(105deg, rgba(255,255,255,0) ${fx(x - half)}%, rgba(255,255,255,${a}) ${fx(x)}%, rgba(255,255,255,0) ${fx(x + half)}%)`;
    const RIM0 = f(1104), RIM1 = f(1124);
    tl.set([rim, glint], { opacity: 0 }, 0);
    PP.drive(tl, (x) => {
      const on = x > -30 && x < 130;
      rim.style.opacity = glint.style.opacity = on ? "1" : "0";
      rim.style.background = band(x, 0.9, 18);
      glint.style.background = band(x, 0.07, 22);
    }, -30, 130, RIM0, RIM1 - RIM0, "power2.inOut");
  }

  // ------------------------------------------------------------------ 2. card push (f1086–1215), stops for the STOP beat
  const PUSH = 1 + 0.008 * (T_STOP - T_IN); // 1.0344
  tl.set(cam, { scale: 1 }, 0);
  tl.fromTo(cam, { scale: 1 }, { scale: PUSH, duration: T_STOP - T_IN, ease: "none", immediateRender: false }, T_IN);

  // ------------------------------------------------------------------ 3. wordmark on L16 'Pure' (clamped f1120–1135)
  const tWm = snapF(PP.clamp(VO.w("L16", 0), f(1120), f(1135), "S10 wordmark"));
  const wm = PP.typedWordmark(tl, wmSlot, 720, tWm, { perLetter: (18 * F) / 11, sheenTail: 14 * F });

  // ------------------------------------------------------------------ 4. tagline per word (period = its own span, for S11)
  const hi = T_STOP - 16 * F; // a blur-in (12 f) + the period's 3 f lag settle before the stop beat
  const tPurity = snapF(PP.clamp(VO.w("L16", "Purity"), tWm + 18 * F, hi, "S10 Purity"));
  const tProven = snapF(PP.clamp(VO.w("L16", "proven"), tPurity + 6 * F, hi, "S10 proven"));
  PP.blurIn(tl, [wPurity], tPurity);
  PP.blurIn(tl, [wProven], tProven);
  PP.blurIn(tl, [period], tProven + 3 * F);

  // ------------------------------------------------------------------ hand-off geometry for S11 (stage px)
  // Layout boxes at push 1 (measured at build, before any transform), plus their f1230 position after the push.
  const sr = stage.getBoundingClientRect();
  const k = sr.width / PP.W || 1;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  };
  const O = { x: 960, y: 480 }; // .s10-cam transform-origin (css/S10.css)
  const pushed = (b) => ({ x: O.x + (b.x - O.x) * PUSH, y: O.y + (b.y - O.y) * PUSH, w: b.w * PUSH, h: b.h * PUSH });
  const pb = box(period);
  PP.S10 = {
    brand, cam, wordmark: wm.box, tagline: tag, words: [wPurity, wProven], period, pill,
    push: PUSH, camOrigin: O,
    periodBox: pb, // unpushed
    periodAt1230: pushed(pb), // the period's stage rect at f1230 (glyph box of the "." span, 96 px DM Sans 800)
    wordmarkAt1230: pushed(box(wmSlot)),
    taglineAt1230: pushed(box(tag)),
    times: { wordmark: tWm, purity: tPurity, proven: tProven, period: tProven + 3 * F },
  };
});
