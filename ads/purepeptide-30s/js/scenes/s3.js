// s3 — PURITY (section window 5.60–10.00, brief S3 6.00–10.00).
// "Purity, measured." + HPLC purity counter + stylised chromatogram card, then a vertical
// scan-line wipe that clips S3 away left→right to reveal S4 (SCENES.md hand-offs #2 and #3).
//
// Layer structure (root = <section id="s3">):
//   wipe  (unscaled, full frame; clip-path inset(0 0 0 Xpx) during 9.50–10.00)
//     backdrop  (opaque replica of #bg/#glow/#grid, only from 9.50 — occludes S4 until wiped)
//     cam       (camera push-in 1.00→1.04, 6.00–10.00)
//       enter   (zoom-through entry: scale 1.12 + blur 12 px → 1 / 0, 5.75–6.25)
//         headline · counter · HPLC label · chart card (HTML) · chart SVG · tip dot · labels
//   scan  (vertical PP.scanLine, unscaled screen x, 9.50–10.00)
PP.scene("s3", function (tl, root, cam) {
  const C = PP.C;
  const cfg = PP.cfg;

  // ------------------------------------------------------------------ geometry (screen px)
  const CARD = { x: 120, y: 700, w: 840, h: 640, pad: 48 };
  const X0 = CARD.x + CARD.pad; // 168  plot left  (y-axis)
  const X1 = CARD.x + CARD.w - CARD.pad; // 912  plot right
  const YT = 792; // plot top
  const YB = 1120; // plot bottom (x-axis)
  const PW = X1 - X0; // 744
  const PH = YB - YT; // 328  = "chart height"
  const Y_BASE = YB - 0.04 * PH; // detector baseline, a hair above the axis
  const APEX_Y = YB - 0.92 * PH; // main peak reaches 92 % of chart height
  const XP = X0 + 0.49 * PW; // main peak at 49 % of the x-axis

  // ------------------------------------------------------------------ structure
  const wipe = PP.el("div", "s3-wipe", root);
  const backdrop = PP.el("div", "s3-backdrop", wipe);
  const bdGlow = PP.el("div", "s3-bd-glow", backdrop);
  const bdGrid = PP.el("div", "s3-bd-grid", backdrop);
  wipe.appendChild(cam);
  const enter = PP.el("div", "s3-enter", cam);

  // headline
  const head = PP.headline(enter, ["Purity, measured."], "h2");
  head.el.classList.add("s3-head");

  // counter row: number (fixed width, right-aligned so the digits never jump) + small "%"
  const row = PP.el("div", "s3-row", enter);
  const ctr = PP.el("div", "s3-counter tnum", row);
  const num = PP.el("span", "s3-num", ctr);
  PP.el("span", "s3-pct", ctr, { text: "%" });
  num.textContent = cfg.purity.toFixed(1);
  const numW = num.getBoundingClientRect().width;
  if (numW > 0) num.style.width = Math.ceil(numW + 2) + "px";
  const checkWrap = PP.el("div", "s3-check", ctr);
  const check = PP.checkIcon(checkWrap, 44, C.accent);
  check.circle.setAttribute("transform", "rotate(-90 22 22)"); // circle draws from 12 o'clock
  const LOCK_SHIFT = -(24 + 44) / 2; // at the lock the number slides left so number + check sit centred

  // "HPLC PURITY"
  const hplc = PP.el("div", "mono muted s3-hplc", enter);
  const hplcChars = PP.chars(hplc, "HPLC PURITY");

  // chart card (static layout: panel, border, divider, footer)
  PP.el("div", "s3-card", enter);
  PP.el("div", "s3-divider", enter);
  PP.el("div", "mono muted s3-footer", enter, { text: "BATCH " + cfg.batch + " · " + cfg.lab });

  // ------------------------------------------------------------------ chart SVG
  const svg = PP.svg("svg", { class: "s3-chart", width: PP.W, height: PP.H, viewBox: `0 0 ${PP.W} ${PP.H}` }, enter);
  const defs = PP.svg("defs", null, svg);
  const grad = PP.svg("linearGradient", { id: "s3-peak-grad", gradientUnits: "userSpaceOnUse", x1: 0, y1: APEX_Y, x2: 0, y2: Y_BASE }, defs);
  PP.svg("stop", { offset: 0, "stop-color": C.accent, "stop-opacity": 0.55 }, grad);
  PP.svg("stop", { offset: 1, "stop-color": C.accent, "stop-opacity": 0 }, grad);
  // fill reveal: a mask whose feathered "liquid level" rises from the baseline past the apex
  const FEATHER = 26;
  const maskGrad = PP.svg("linearGradient", { id: "s3-level-grad", gradientUnits: "userSpaceOnUse", x1: 0, y1: Y_BASE + 3, x2: 0, y2: Y_BASE + 3 + FEATHER }, defs);
  PP.svg("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, maskGrad); // above the level: hidden
  PP.svg("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, maskGrad); // below: shown
  // …and never ahead of the drawing tip: a clip whose right edge follows the tip x
  const tipClip = PP.svg("clipPath", { id: "s3-tip-clip" }, defs);
  const tipRect = PP.svg("rect", { x: 0, y: 0, width: X0, height: PP.H }, tipClip);
  const mask = PP.svg("mask", { id: "s3-peak-mask", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: PP.W, height: PP.H }, defs);
  PP.svg("rect", { x: 0, y: 0, width: PP.W, height: PP.H, fill: "url(#s3-level-grad)" }, mask);

  const gGrid = PP.svg("g", { class: "s3-grid" }, svg);
  const gAxes = PP.svg("g", { class: "s3-axes" }, svg);
  const hGrid = [0.25, 0.5, 0.75, 1].map((f) => PP.svg("path", { d: `M${X0} ${YB - f * PH} H${X1}` }, gGrid));
  const vGrid = [1, 2, 3, 4].map((i) => PP.svg("path", { d: `M${X0 + (i * PW) / 4} ${YB} V${YT}` }, gGrid));
  const xAxis = PP.svg("path", { d: `M${X0} ${YB} H${X1}` }, gAxes);
  const yAxis = PP.svg("path", { d: `M${X0} ${YB} V${YT}` }, gAxes);
  const tickMarks = [0, 1, 2, 3, 4].map((i) => PP.svg("path", { d: `M${X0 + (i * PW) / 4} ${YB} v8` }, gAxes));

  // --- chromatogram trace: seeded micro-noise baseline, two tiny impurity bumps, one sharp main peak
  const rnd = PP.rng(2611);
  const K1 = 7; // noise knot spacing (px)
  const K2 = 2.6;
  const k1 = Array.from({ length: Math.ceil(PW / K1) + 3 }, () => rnd() * 2 - 1);
  const k2 = Array.from({ length: Math.ceil(PW / K2) + 3 }, () => rnd() * 2 - 1);
  const vnoise = (knots, step, x) => {
    const u = (x - X0) / step;
    const i = Math.floor(u);
    const f = u - i;
    const s = f * f * (3 - 2 * f);
    return knots[i] * (1 - s) + knots[i + 1] * s;
  };
  const PEAK_H = Y_BASE - APEX_Y;
  const SIG_L = 8.5; // slight tailing: right flank a little wider
  const SIG_R = 11;
  const bumps = [
    { x: X0 + 0.28 * PW, h: 0.03 * PH, s: 6.5 },
    { x: X0 + 0.71 * PW, h: 0.02 * PH, s: 5.5 },
  ];
  const peakAt = (x) => {
    const d = x - XP;
    const s = d < 0 ? SIG_L : SIG_R;
    return PEAK_H * Math.exp(-0.5 * (d / s) * (d / s));
  };
  const yAt = (x) => {
    const p = peakAt(x);
    let h = p;
    bumps.forEach((b) => (h += b.h * Math.exp(-0.5 * ((x - b.x) / b.s) ** 2)));
    const damp = Math.max(0, 1 - p / 6); // clean flanks on the main peak
    const n = (vnoise(k1, K1, x) * 1.45 + vnoise(k2, K2, x) * 0.55) * damp; // |n| <= 2 px
    return Y_BASE - h + n;
  };
  const pts = [];
  for (let x = X0; x <= X1 + 1e-6; ) {
    pts.push([x, yAt(x)]);
    const near = Math.abs(x - XP) < 44;
    let nx = x + (near ? 0.25 : 1);
    if (x < XP && nx > XP) nx = XP; // include the exact apex
    x = nx;
  }
  const f2 = (v) => Math.round(v * 100) / 100;
  const traceD = "M" + pts.map((p) => f2(p[0]) + " " + f2(p[1])).join(" L");

  // peak fill: trace segment under the main peak, closed on the baseline
  const fx0 = XP - 4.2 * SIG_L;
  const fx1 = XP + 4.2 * SIG_R;
  const fpts = pts.filter((p) => p[0] >= fx0 && p[0] <= fx1);
  const fillD =
    "M" + f2(fpts[0][0]) + " " + f2(Y_BASE + 2) + " L" + fpts.map((p) => f2(p[0]) + " " + f2(p[1])).join(" L") + " L" + f2(fpts[fpts.length - 1][0]) + " " + f2(Y_BASE + 2) + " Z";
  const fillG = PP.svg("g", { "clip-path": "url(#s3-tip-clip)" }, svg);
  PP.svg("path", { d: fillD, fill: "url(#s3-peak-grad)", mask: "url(#s3-peak-mask)" }, fillG);
  const trace = PP.svg("path", { class: "s3-trace", d: traceD }, svg);

  // "MAIN PEAK" leader + label, hung right of the apex
  const leader = PP.svg("path", { class: "s3-leader", d: `M${XP + 14} ${APEX_Y} H${XP + 38}` }, svg);
  const peakLabel = PP.el("div", "mono s3-peaklabel", enter, { text: "MAIN PEAK" });
  peakLabel.style.left = XP + 48 + "px";
  peakLabel.style.top = APEX_Y - 12.5 + "px";

  // tip dot (8 px --accent, 16 px glow), rides the drawing tip
  const dot = PP.el("div", "s3-dot", enter);

  // axis labels
  const mau = PP.el("div", "mono muted s3-lbl s3-mau", enter, { text: "mAU" });
  const tickLbls = [0, 5, 10, 15, 20].map((v, i) => {
    const e = PP.el("div", "mono muted s3-lbl s3-tick", enter, { text: String(v) });
    const x = X0 + (i * PW) / 4;
    if (i === 0) e.style.left = x + "px";
    else if (i === 4) {
      e.style.right = PP.W - x + "px";
      e.classList.add("s3-tick-r");
    }
    else {
      e.style.left = x + "px";
      e.classList.add("s3-tick-c");
    }
    return e;
  });
  const xTitle = PP.el("div", "mono muted s3-lbl s3-xtitle", enter, { text: "RETENTION TIME (MIN)" });

  // ------------------------------------------------------------------ path geometry for the tip
  const totalLen = trace.getTotalLength();
  let apexLen = 0;
  for (let i = 1; i < pts.length; i++) {
    apexLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (pts[i][0] >= XP) break;
  }
  const TR_AT = 6.4;
  const TR_DUR = 1.8;
  const apexFrac = apexLen / totalLen;
  // invert power1.inOut to find when the tip reaches the apex (≈ 7.30 by design)
  const u = apexFrac < 0.5 ? Math.sqrt(apexFrac / 2) : 1 - Math.sqrt((1 - apexFrac) / 2);
  const T_APEX = TR_AT + TR_DUR * u;

  // ================================================================== timeline
  // --- entry (hand-off #2): hidden until 5.75, then zoom-through from 1.12 + blur 12 px
  tl.fromTo(enter, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, 5.75);
  tl.fromTo(enter, { scale: 1.12, filter: "blur(12px)" }, { scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, 5.75);
  PP.camera(tl, cam, 6.0, 10.0);

  // --- headline 6.10 (element hidden until then: the waiting words would peek through the mask's bottom padding)
  tl.fromTo(head.el, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 6.095);
  PP.wordsIn(tl, head.words, 6.1);

  // --- axes + gridlines draw 6.20–6.60 (stagger 0.03)
  PP.draw(tl, [xAxis, yAxis], 6.2, 0.3);
  PP.draw(tl, tickMarks, 6.26, 0.12, { stagger: 0.03 });
  PP.draw(tl, hGrid, 6.23, 0.28, { stagger: 0.03 });
  PP.draw(tl, vGrid, 6.23, 0.28, { stagger: 0.03 });
  tl.fromTo([mau, ...tickLbls, xTitle], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", stagger: 0.03 }, 6.3);

  // --- trace 6.40–8.20 (power1.inOut) led by the tip dot on exactly the same ease/duration
  tl.fromTo(trace, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, TR_AT - 0.01);
  PP.draw(tl, trace, TR_AT, TR_DUR, { ease: "power1.inOut" });
  PP.drive(
    tl,
    (p) => {
      const pt = trace.getPointAtLength(p * totalLen);
      dot.style.transform = `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px)`;
      tipRect.setAttribute("width", (p >= 1 ? PP.W : pt.x).toFixed(2));
    },
    0,
    1,
    TR_AT,
    TR_DUR,
    "power1.inOut",
  );
  tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power2.out" }, TR_AT - 0.02);
  tl.fromTo(dot, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power2.inOut", immediateRender: false }, TR_AT + TR_DUR);

  // --- main peak: fill rises under the peak + "MAIN PEAK" pops when the tip reaches the apex
  const LVL0 = Y_BASE + 3; // level below the fill: nothing shown
  const LVL1 = APEX_Y - FEATHER - 4; // feather fully above the apex: whole fill shown
  PP.drive(
    tl,
    (p) => {
      const y = LVL0 + (LVL1 - LVL0) * p; // top of the feather band
      maskGrad.setAttribute("y1", y.toFixed(2));
      maskGrad.setAttribute("y2", (y + FEATHER).toFixed(2));
    },
    0,
    1,
    T_APEX,
    0.5,
    "power3.out",
  );
  PP.draw(tl, leader, T_APEX, 0.2, { ease: "power2.out" });
  PP.popIn(tl, peakLabel, T_APEX + 0.05);

  // --- counter 7.00–8.80 + "HPLC PURITY" type-on at 7.00
  tl.fromTo(ctr, { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power2.out" }, 7.0);
  PP.counter(tl, num, { from: 0, to: cfg.purity, at: 7.0, dur: 1.8, decimals: 1, ease: "power3.out" });
  PP.typeOn(tl, hplcChars, 7.0);

  // --- lock at 8.80: glow pulse 0→28→8 px + check draws in 0.3 s
  const eo = gsap.parseEase("power2.out");
  const eio = gsap.parseEase("power2.inOut");
  PP.drive(
    tl,
    (p) => {
      const b = p < 0.25 ? 28 * eo(p / 0.25) : 28 - 20 * eio((p - 0.25) / 0.75);
      const a = p < 0.25 ? 0.95 * eo(p / 0.25) : 0.95 - 0.35 * eio((p - 0.25) / 0.75);
      ctr.style.textShadow = b < 0.05 ? "none" : `0 0 ${b.toFixed(2)}px rgba(127, 231, 255, ${a.toFixed(3)})`;
    },
    0,
    1,
    8.8,
    0.6,
    "none",
  );
  tl.fromTo(checkWrap, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, 8.79);
  tl.fromTo(row, { x: 0 }, { x: LOCK_SHIFT, duration: 0.5, ease: "expo.out" }, 8.8);
  PP.draw(tl, check.circle, 8.8, 0.3);
  PP.draw(tl, check.tick, 8.92, 0.18, { ease: "power2.out" });

  // --- scan wipe 9.50–10.00 (hand-off #3)
  // Backdrop = pixel replica of the global #bg/#glow/#grid (same styles, same tweens as global.js) so S3
  // occludes S4's static layout until the scan line passes. Verified pixel-identical to the global layers
  // (backdrop on vs off: max diff 0), so switching it on at 9.49 is invisible.
  // Keep in sync with global.js if its grid drift or the 5.8 / 9.7 glow stops change.
  tl.fromTo(bdGrid, { y: 0 }, { y: -20, duration: 30, ease: "none" }, 0);
  tl.fromTo(bdGlow, { x: 540 - 650, y: 820 - 650 }, { x: 540 - 650, y: 940 - 650, duration: 0.4, ease: "power2.inOut" }, 9.7);
  tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 9.49);

  const scan = PP.scanLine(root, "v", PP.H);
  scan.classList.add("s3-scan");
  tl.fromTo(scan, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 9.49);
  PP.drive(
    tl,
    (x) => {
      wipe.style.clipPath = x <= 0 ? "none" : `inset(0px 0px 0px ${x.toFixed(2)}px)`;
      scan.style.transform = `translateX(${(x - 1).toFixed(2)}px)`;
    },
    0,
    PP.W,
    9.5,
    0.5,
    "power2.inOut",
  );
});
