// s6 — THE CATALOG (section window 15.50–22.00, brief S6).
// Whip-pan entry from the right (SCENES.md hand-off #5), a six-product carousel on a glossy floor that steps
// through PP.cfg.catalog on an accelerating cadence, a slot-machine name reel, then a pull-back to the whole
// line-up on a shallow arc, an --accent rim light passing across every vial, and the dip into S7.
//
// Layer structure (root = <section id="s6">):
//   whip   (translateX 1080→0 expo.inOut + SVG horizontal blur "18 0"→"0 0", 15.50–16.00)
//     dip  (CSS brightness 1→0.35, 21.60–22.00)
//       cam  (camera push-in 1.00→1.04, 16.00–22.00)
//         kicker "THE CATALOG" (top y 300)
//         stage (group dip scale 1→0.92 about (540,1000))
//           gloss · floor hairline (svg) · units[6] (reflection + vial, one transform each) · group line (top y 700)
//         name mask > reel (6 rows, slot-machine roll) · spec line (top y 1350)
//   fx svg (whip blur + reel motion-blur filters)
//
// Every vial is laid out by ONE pure function of time (render(t), driven by PP.drive over the whole window):
// carousel position p (0..5, eased steps) → per-vial offset d = i - p → x / height / opacity / blur,
// blended with g (0..1, the pull-back) into the group layout. No state is carried between frames.
PP.scene("s6", function (tl, root, cam) {
  const C = PP.C;
  const cfg = PP.cfg;
  const VB = PP.VIAL_VB;
  const names = cfg.catalog;
  const N = names.length;

  // ------------------------------------------------------------------ geometry (cam-local px)
  const H0 = 640; // native unit height = active carousel vial (brief: centred (540,880), height 640)
  const W0 = (VB.w * H0) / VB.h; // unit box width
  const BODY = 260 / VB.h; // visible glass-body width per px of vial height (viewBox body x 20→280)
  const FLOOR = 880 + H0 / 2; // 1200: active vial base = carousel floor line
  const STEP = 390; // neighbour centres at x 150 / 930
  const NB_H = 460;
  const NB_OP = 0.45;
  const NB_BLUR = 3;
  const REFL_OP = 0.13;
  const REFL_FADE = [118, 132]; // on-screen reflection fade (px): carousel (clears the name) → group

  // group shot: heights 320/360/400/400/360/320, 12 px gaps between the glass bodies, bases on a shallow arc
  const GH = [320, 360, 400, 400, 360, 320];
  const GAP = 12;
  const gbw = GH.map((h) => h * BODY);
  const gTotal = gbw.reduce((a, b) => a + b, 0) + GAP * (N - 1);
  let gx = 540 - gTotal / 2;
  const GX = gbw.map((w) => {
    const c = gx + w / 2;
    gx += w + GAP;
    return c;
  });
  // parabola through the base points: centre pair at y 1200, outer pair at y 1160
  const dIn = Math.abs(GX[2] - 540);
  const dOut = Math.abs(GX[0] - 540);
  const ARC_K = 40 / (dOut * dOut - dIn * dIn);
  const ARC_A = 1200 + ARC_K * dIn * dIn;
  const arcY = (x) => ARC_A - ARC_K * (x - 540) * (x - 540);

  // name reel
  const ROW = 120; // reel pitch = mask height
  const ROW_PAD = 28; // text line box top inside a row
  const NAME_BASE = 1290; // brief: baseline y ≈ 1290

  // ------------------------------------------------------------------ timing (absolute seconds)
  const T_IN = 15.5;
  const T_LAND = 16.0;
  const CHANGES = [17.0, 18.0, 19.0, 19.5, 20.0]; // → GHK-Cu, CJC-1295 / Ipamorelin, Selank, Semax, IGF-1 LR3
  const SLIDE = 0.45;
  const ROLL_AT = 0.1; // the name roll crosses over at the slide's midpoint and lands with the vial (T + 0.45)
  const ROLL = 0.35;
  const T_OUT = 20.5; // name + spec exit
  const T_GROUP = 20.5;
  const GROUP = 0.8;
  const T_LINE = 20.9;
  const T_RIM = 21.0;
  const RIM = 0.6;
  const T_DIP = 21.6;
  const T_END = 22.0;
  const GLINT = 0.6;
  const GLINT_AT = [T_LAND].concat(CHANGES.map((c) => c + 0.12)); // soft white glint as each product lands

  // ------------------------------------------------------------------ helpers
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const eSlide = gsap.parseEase("expo.inOut");
  const eGroup = gsap.parseEase("expo.inOut");
  const eSweep = gsap.parseEase("sine.inOut");
  const eGlint = gsap.parseEase("power2.inOut");
  const cosS = (a) => 0.5 - 0.5 * Math.cos(Math.PI * a); // smooth 0→1 on [0,1]
  const cubicIO = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
  // slot-machine landing: fast roll that runs 4.5 % past the stop, then clunks back into place
  const rollE = (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    if (u < 0.72) return 1.045 * cubicIO(u / 0.72);
    return 1.045 - 0.045 * cosS((u - 0.72) / 0.28);
  };
  const carouselP = (t) => CHANGES.reduce((p, c) => p + eSlide(clamp01((t - c) / SLIDE)), 0);
  const reelN = (t) => CHANGES.reduce((n, c) => n + rollE(clamp01((t - c - ROLL_AT) / ROLL)), 0);
  const groupG = (t) => eGroup(clamp01((t - T_GROUP) / GROUP));

  // carousel layout from the continuous offset d = i - p (pure)
  const carousel = (d) => {
    const a = Math.abs(d);
    if (a <= 1) {
      const s = cosS(a);
      return { x: 540 + STEP * d, h: lerp(H0, NB_H, s), op: lerp(1, NB_OP, s), blur: NB_BLUR * s };
    }
    const f = clamp01((a - 1) / 0.8); // beyond ±1: shrink a touch, fade out, park off-screen
    return { x: 540 + STEP * d, h: NB_H - 60 * clamp01(a - 1), op: NB_OP * (1 - cosS(f)), blur: NB_BLUR };
  };
  // floor under a vial at x, blended between the flat carousel floor and the group arc
  const floorY = (x, g) => lerp(FLOOR, arcY(x), g);

  // ------------------------------------------------------------------ structure
  const whip = PP.el("div", "s6-whip", root);
  const dip = PP.el("div", "s6-dip", whip);
  dip.appendChild(cam);

  const fx = PP.svg("svg", { class: "s6-fx", width: 1, height: 1, "aria-hidden": "true" }, root);
  const whipF = PP.svg("filter", { id: "s6-whip-blur", x: "-10%", y: "0%", width: "120%", height: "100%", "color-interpolation-filters": "sRGB" }, fx);
  const whipBlur = PP.svg("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "18 0" }, whipF);
  const rollF = PP.svg("filter", { id: "s6-roll-blur", x: "-2%", y: "-10%", width: "104%", height: "120%", "color-interpolation-filters": "sRGB" }, fx);
  const rollBlur = PP.svg("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "0 0" }, rollF);

  // kicker
  PP.el("div", "mono s6-kicker", cam, { text: "THE CATALOG" });

  // stage: floor + vials + group line (scaled together by the dip)
  const stage = PP.el("div", "s6-stage", cam);
  PP.el("div", "s6-gloss", stage);
  const FL_X0 = 72;
  const FL_X1 = 1008;
  const floorSvg = PP.svg("svg", { class: "s6-floor", width: 1080, height: 200, viewBox: "0 1080 1080 200" }, stage);
  const flDefs = PP.svg("defs", null, floorSvg);
  const flGrad = PP.svg("linearGradient", { id: "s6-floor-g", gradientUnits: "userSpaceOnUse", x1: FL_X0, y1: 0, x2: FL_X1, y2: 0 }, flDefs);
  [
    [0, 0],
    [0.14, 0.08],
    [0.36, 0.18],
    [0.5, 0.26],
    [0.64, 0.18],
    [0.86, 0.08],
    [1, 0],
  ].forEach(([o, a]) => PP.svg("stop", { offset: o, "stop-color": "#EAF2FF", "stop-opacity": a }, flGrad));
  const floorPath = PP.svg("path", { d: "", fill: "none", stroke: "url(#s6-floor-g)", "stroke-width": 1.25 }, floorSvg);

  // Strip slots -1..6: the six catalog vials (0..5) plus two ghost neighbours (IGF-1 LR3 left of BPC-157 at the
  // start, BPC-157 right of IGF-1 LR3 at the end) so the carousel always reads as a ring with both neighbours.
  // Ghosts are reflected with -webkit-box-reflect instead of a second SVG (14 vial SVGs in total) and are hidden
  // whenever their opacity is 0.
  const unitsBox = PP.el("div", "s6-units", stage);
  const SLOTS = [-1, 0, 1, 2, 3, 4, 5, N];
  const units = SLOTS.map((k) => {
    const ghost = k < 0 || k >= N;
    const name = names[(k + N) % N];
    const el = PP.el("div", "s6-unit", unitsBox);
    el.style.width = W0 + "px";
    el.style.height = 2 * H0 + "px";
    el.style.transformOrigin = W0 / 2 + "px " + H0 + "px";
    let refl = null;
    if (!ghost) {
      refl = PP.vialReflection(el, { height: H0, product: name, fade: REFL_FADE[0], opacity: REFL_OP });
      refl.el.style.left = "0px";
      refl.el.style.top = H0 + "px"; // mirror about the base line
    }
    const vial = PP.vial(el, { height: H0, product: name });
    vial.el.style.left = "0px";
    vial.el.style.top = "0px";
    // rim light: an --accent band (soft) under the lib's white core band, both clipped to the vial
    let rim = null;
    if (vial.sweepRect && !ghost) {
      const defs = vial.svg.querySelector("defs");
      const gid = "s6-rim-g-" + k;
      const g = PP.svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      [
        [0, 0],
        [0.5, 0.5],
        [1, 0],
      ].forEach(([o, a]) => PP.svg("stop", { offset: o, "stop-color": C.accent, "stop-opacity": a }, g));
      rim = PP.svg("rect", { x: -600, y: -60, width: 200, height: 840, fill: `url(#${gid})`, transform: "skewX(-12)" }, vial.sweep);
      vial.sweep.insertBefore(rim, vial.sweepRect);
      vial.sweepRect.setAttribute("x", -600);
    }
    // group-shot target: catalog slots take their place in the line-up, ghosts drift off-frame and fade
    const target = ghost
      ? { x: k < 0 ? GX[0] - 420 : GX[N - 1] + 420, h: GH[0], op: 0, blur: NB_BLUR }
      : { x: GX[k], h: GH[k], op: 1, blur: 0 };
    return { k, ghost, el, vial, rim, refl, target };
  });

  // group line (top y 700), types on at 20.90
  const line = PP.el("div", "mono s6-line", stage);
  const lineChars = PP.chars(line, "ALL BATCH-TESTED · COA ONLINE");

  // name: slot-machine reel inside a soft-edged mask
  const nameBox = PP.el("div", "s6-name", cam);
  const reel = PP.el("div", "s6-reel", nameBox);
  const rows = names.map((name) => {
    const r = PP.el("div", "s6-row", reel);
    r.style.height = ROW + "px";
    r.style.paddingTop = ROW_PAD + "px";
    const txt = PP.el("span", "pp-h h3 s6-row-t", r, { text: name });
    return { r, txt };
  });
  // baseline probe → put the H3 baseline on y 1290 exactly (offsetTop ignores transforms)
  const probe = PP.el("span", "s6-probe", rows[0].txt);
  const baseOff = probe.offsetTop + rows[0].txt.offsetTop;
  probe.remove();
  nameBox.style.top = (NAME_BASE - baseOff).toFixed(2) + "px";
  nameBox.style.height = ROW + "px";
  // safety: a name wider than the safe zone (840 px) is scaled down to fit (not expected at 64 px)
  rows.forEach(({ txt }) => {
    const w = txt.offsetWidth;
    if (w > 832) txt.style.fontSize = ((64 * 832) / w).toFixed(2) + "px";
  });

  // spec line (top y 1350)
  const spec = PP.el("div", "mono s6-spec", cam, { text: cfg.amount + " · LYOPHILIZED · HPLC-TESTED" });

  // ------------------------------------------------------------------ per-frame layout (pure function of t)
  const TAN12 = Math.tan((12 * Math.PI) / 180);
  const RIM_X0 = GX[0] - gbw[0] / 2 - 90;
  const RIM_X1 = GX[N - 1] + gbw[N - 1] / 2 + 90;
  const RIM_W = 72; // on-screen width of the accent band (soft falloff, narrower than a vial so it reads as a passing light)
  const CORE_W = 22; // on-screen width of the white core
  const f2 = (v) => v.toFixed(2);

  function render(t) {
    const p = carouselP(t);
    const g = groupG(t);

    // ---- vials
    const rimOn = t >= T_RIM && t <= T_RIM + RIM;
    const rimX = lerp(RIM_X0, RIM_X1, eSweep(clamp01((t - T_RIM) / RIM)));
    const reflFade = lerp(REFL_FADE[0], REFL_FADE[1], g);
    for (const u of units) {
      const c = carousel(u.k - p);
      const T = u.target;
      const x = lerp(c.x, T.x, g);
      const h = lerp(c.h, T.h, g);
      const base = floorY(x, g);
      const op = lerp(c.op, T.op, g);
      const blur = lerp(c.blur, T.blur, g);
      const s = h / H0;
      const hidden = op < 0.004;
      u.el.style.visibility = hidden ? "hidden" : "";
      if (hidden) continue;
      u.el.style.transform = `translate(${f2(x - W0 / 2)}px, ${f2(base - H0)}px) scale(${s.toFixed(4)})`;
      u.el.style.opacity = op.toFixed(3);
      u.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
      u.el.style.zIndex = String(100 - Math.round(Math.abs(u.k - p) * 10));
      if (u.refl) {
        const m = `linear-gradient(to bottom, #000 0px, transparent ${f2(reflFade / s)}px)`;
        u.refl.el.style.webkitMaskImage = m;
        u.refl.el.style.maskImage = m;
      } else {
        // same falloff as PP.vialReflection: alpha REFL_OP at the floor → 0 at reflFade px below it
        u.vial.el.style.webkitBoxReflect = `below 0px linear-gradient(to bottom, rgba(0,0,0,0) ${f2(H0 - reflFade / s)}px, rgba(0,0,0,${REFL_OP}) ${H0}px)`;
      }

      // ---- light on the glass: landing glint (white) or the group rim light (--accent + white core)
      if (!u.rim) continue;
      const vs = h / VB.h; // px per viewBox unit
      const toRect = (screenX, bandPx) => (screenX - (x - (VB.w * vs) / 2)) / vs - bandPx / vs / 2 + TAN12 * (VB.h / 2);
      let coreX = -600;
      let rimRectX = -600;
      let coreW = CORE_W / vs;
      const rimW = RIM_W / vs;
      let sweepOp = 0;
      if (rimOn) {
        coreX = toRect(rimX, CORE_W);
        rimRectX = toRect(rimX, RIM_W);
        sweepOp = 1;
        u.vial.sweepRect.style.opacity = "0.6";
      } else {
        const kk = (t - GLINT_AT[u.k]) / GLINT;
        if (kk > 0 && kk < 1) {
          const lx = lerp(-60, VB.w + 60, eGlint(kk)); // viewBox units across the vial
          coreW = 150 / vs;
          coreX = lx - coreW / 2 + TAN12 * (VB.h / 2);
          sweepOp = 0.85 * Math.sin(Math.PI * kk);
          u.vial.sweepRect.style.opacity = "1";
        }
      }
      u.vial.sweepRect.setAttribute("x", f2(coreX));
      u.vial.sweepRect.setAttribute("width", f2(coreW));
      u.rim.setAttribute("x", f2(rimRectX));
      u.rim.setAttribute("width", f2(rimW));
      u.vial.sweep.style.opacity = sweepOp.toFixed(3);
    }

    // ---- floor hairline: flat at y 1200, bending into the group arc as the camera pulls back
    let d = "";
    for (let fxp = FL_X0; fxp <= FL_X1 + 0.1; fxp += 12) d += (d ? " L" : "M") + fxp + " " + f2(floorY(fxp, g) + 0.5);
    floorPath.setAttribute("d", d);

    // ---- name reel (+ vertical motion blur from the reel speed)
    const n = reelN(t);
    reel.style.transform = `translateY(${f2(-n * ROW)}px)`;
    const speed = Math.abs(reelN(t + 1 / 120) - reelN(t - 1 / 120)) * 60 * ROW; // px / s
    const mb = Math.min(7, speed * 0.0045);
    if (mb > 0.08) {
      rollBlur.setAttribute("stdDeviation", "0 " + mb.toFixed(2));
      reel.style.filter = "url(#s6-roll-blur)";
    } else {
      rollBlur.setAttribute("stdDeviation", "0 0");
      reel.style.filter = "none";
    }
  }

  // ================================================================== timeline
  PP.drive(tl, render, T_IN, T_END, T_IN, T_END - T_IN, "none");

  // --- 15.50–16.00 whip pan in from the right (hand-off #5)
  tl.fromTo(whip, { x: PP.W }, { x: 0, duration: T_LAND - T_IN, ease: "expo.inOut" }, T_IN);
  PP.drive(
    tl,
    (v) => {
      if (v < 0.01) {
        whip.style.filter = "none";
        whipBlur.setAttribute("stdDeviation", "0 0");
      } else {
        whipBlur.setAttribute("stdDeviation", v.toFixed(2) + " 0");
        whip.style.filter = "url(#s6-whip-blur)";
      }
    },
    18,
    0,
    15.75,
    0.25,
    "power2.out",
  );

  // --- 16.00–22.00 camera push-in
  PP.camera(tl, cam, T_LAND, T_END);

  // --- 20.50 name + spec out (brief text-out: -40 % of the text height, opacity → 0, 0.25 s power2.in)
  tl.fromTo(nameBox, { y: 0, opacity: 1 }, { y: -26, opacity: 0, duration: 0.25, ease: "power2.in" }, T_OUT);
  tl.fromTo(spec, { y: 0, opacity: 1 }, { y: -9, opacity: 0, duration: 0.25, ease: "power2.in" }, T_OUT + 0.04);

  // --- 20.90 group line types on (0.025 s/char, reads left→right with the rim light)
  PP.typeOn(tl, lineChars, T_LINE);

  // --- 21.60–22.00 dip: whole scene brightness 1 → 0.35, group scale 1 → 0.92
  PP.drive(tl, (b) => (dip.style.filter = b > 0.999 ? "none" : `brightness(${b.toFixed(3)})`), 1, 0.35, T_DIP, T_END - T_DIP, "power2.in");
  tl.fromTo(stage, { scale: 1 }, { scale: 0.92, duration: T_END - T_DIP, ease: "power2.in" }, T_DIP);
});
