// s5 — A COA FOR EVERY BATCH (section window 12.00–16.00, brief S5).
// The S4 match-cut line (2 px --accent, y 560, x 160→920) becomes the top edge of a paper certificate that
// unrolls downward from it, settles into a 3D pose, fills its data rows, locks brackets onto a real QR,
// scans it, gets stamped VERIFIED, drifts, then whip-pans left into S6 (SCENES.md hand-offs #4 and #5).
//
// Layer structure (root = <section id="s5">):
//   whip   (whip pan: translateX 0→-1080 + SVG horizontal blur, 15.50–16.00)
//     cam  (camera push-in 1.00→1.04, 12.00–16.00)
//       headline (H2, 2 lines, top y 300)
//       persp  (perspective 1600 px, origin = card centre; drift scale 1→1.03 about the card centre)
//         sheet  (the 3D pose: hinge on the card's top edge; rotateX 18→8, rotateY 0→-10→-4)
//           shadow · paper (clip-path unroll) [header, rows, thumb, QR, QR scan, curl] · brackets · flash · edge line · pill
//       caption "SCAN · VERIFY · RESEARCH" (top y 1350)
//   fx svg (the <filter> for the whip blur)
//
// Hand-off #4: at 12.00 cam scale = 1, persp scale = 1 and sheet rotateY = 0; the edge line lies on the sheet's
// hinge (z = 0), so rotateX does not move it: it is exactly the S4 line (2 px, y 560, x 160→920). rotateY is
// therefore eased 0→-10 during the unroll instead of being -10 from the first frame.
PP.scene("s5", function (tl, root, cam) {
  const C = PP.C;
  const cfg = PP.cfg;

  // ------------------------------------------------------------------ geometry (card-local px)
  const CARD = { x: 160, y: 560, w: 760, h: 740, r: 18, pad: 48 };
  const CW = CARD.w - 2 * CARD.pad; // 664 content width
  const ROW0 = 152; // first row top (below the header rule at 144)
  const ROW_H = 52;
  const QR = { x: 532, y: 512, s: 180 }; // bottom-right, 48 px padding
  const TH = { x: 48, y: 512, w: 452, h: 180 }; // chromatogram thumbnail, bottom-left
  const PERSP = 1600; // parent perspective (css: .s5-persp)
  const PERSP_OY = 930; // perspective-origin y = card centre (css)
  const PUSH_Z = 60; // final z push-back of the sheet

  // ------------------------------------------------------------------ structure
  const whip = PP.el("div", "s5-whip", root);
  whip.appendChild(cam);

  const fx = PP.svg("svg", { class: "s5-fx", width: 1, height: 1, "aria-hidden": "true" }, root);
  const filt = PP.svg("filter", { id: "s5-whip-blur", x: "-10%", y: "0%", width: "120%", height: "100%", "color-interpolation-filters": "sRGB" }, fx);
  const blur = PP.svg("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "0 0" }, filt);

  // headline
  const head = PP.headline(cam, ["Every batch.", "Its own *COA.*"], "h2");
  head.el.classList.add("s5-head");
  // the lib's mask lines bleed 0.2em past the headline box on purpose (glyph/blur room); nothing is clipped
  head.lines.forEach((ln) => ln.setAttribute("data-layout-allow-overflow", ""));

  const persp = PP.el("div", "s5-persp", cam);
  const sheet = PP.el("div", "s5-sheet", persp);
  const shadow = PP.el("div", "s5-shadow", sheet);
  const paper = PP.el("div", "s5-paper", sheet);
  PP.el("div", "s5-sheen", paper);

  // --- header: wordmark (ink on paper) + title + rule
  const wm = PP.el("div", "s5-wm", paper);
  const logo = PP.logo(wm, { height: 24 });
  if (logo.isImage) logo.el.classList.add("s5-logo-img");
  PP.el("div", "s5-title", paper, { text: "CERTIFICATE OF ANALYSIS" });
  PP.el("div", "s5-rule", paper);

  // --- data rows (printed dividers; key/value text prints in one by one)
  const ROWS = [
    ["PRODUCT", cfg.coaProduct],
    ["BATCH", cfg.batch],
    ["TEST DATE", cfg.testDate],
    ["PURITY (HPLC)", cfg.purityStr + "%"],
    ["IDENTITY (MS)", "CONFORMS"],
    ["LAB", cfg.lab],
  ];
  const PURITY_ROW = 3;
  let underline = null;
  const rowText = ROWS.map(([k, v], i) => {
    const row = PP.el("div", "s5-row", paper);
    row.style.top = ROW0 + i * ROW_H + "px";
    PP.el("div", "s5-div", row);
    if (i === PURITY_ROW) underline = PP.el("div", "s5-uline", row);
    const txt = PP.el("div", "s5-row-in mono tnum", row);
    PP.el("span", "s5-k", txt, { text: k });
    PP.el("span", "s5-v", txt, { text: v });
    return txt;
  });

  // --- chromatogram thumbnail (same signature as S3: main peak at 49 %, two tiny impurity bumps)
  const thumb = PP.el("div", "s5-thumb", paper);
  const tsv = PP.svg("svg", { width: TH.w, height: TH.h, viewBox: `0 0 ${TH.w} ${TH.h}` }, thumb);
  {
    const X0 = 28,
      X1 = TH.w - 28,
      YT = 30,
      YB = TH.h - 30;
    const PW = X1 - X0,
      PH = YB - YT;
    const XP = X0 + 0.49 * PW;
    const defs = PP.svg("defs", null, tsv);
    const g = PP.svg("linearGradient", { id: "s5-th-grad", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    PP.svg("stop", { offset: 0, "stop-color": C.accent, "stop-opacity": 0.7 }, g);
    PP.svg("stop", { offset: 1, "stop-color": C.accent, "stop-opacity": 0.05 }, g);
    for (let k = 1; k <= 3; k++) PP.svg("path", { d: `M${X0} ${YB - (k * PH) / 4} H${X1}`, class: "s5-th-grid" }, tsv);
    for (let k = 0; k <= 4; k++) PP.svg("path", { d: `M${X0 + (k * PW) / 4} ${YB} v6`, class: "s5-th-axis" }, tsv);
    PP.svg("path", { d: `M${X0} ${YB} H${X1}`, class: "s5-th-axis" }, tsv);
    const rnd = PP.rng(2611);
    const knots = Array.from({ length: 80 }, () => rnd() * 2 - 1);
    const noise = (x) => {
      const u = ((x - X0) / PW) * 76;
      const i = Math.floor(u);
      const f = u - i;
      const s = f * f * (3 - 2 * f);
      return knots[i] * (1 - s) + knots[i + 1] * s;
    };
    const BASE = YB - 4;
    const PEAK = (BASE - YT) * 0.92;
    const yAt = (x) => {
      const d = x - XP;
      const sg = d < 0 ? 4.2 : 5.4;
      const p = PEAK * Math.exp(-0.5 * (d / sg) ** 2);
      const b1 = 0.03 * PH * Math.exp(-0.5 * ((x - (X0 + 0.28 * PW)) / 4) ** 2);
      const b2 = 0.02 * PH * Math.exp(-0.5 * ((x - (X0 + 0.71 * PW)) / 3.5) ** 2);
      return BASE - p - b1 - b2 + noise(x) * 0.9 * Math.max(0, 1 - p / 4);
    };
    const pts = [];
    for (let x = X0; x <= X1 + 1e-6; x += Math.abs(x - XP) < 24 ? 0.25 : 1) pts.push([x, yAt(x)]);
    const f2 = (v) => Math.round(v * 100) / 100;
    const d = "M" + pts.map((p) => f2(p[0]) + " " + f2(p[1])).join(" L");
    const fp = pts.filter((p) => Math.abs(p[0] - XP) <= 24);
    const fillD = "M" + f2(fp[0][0]) + " " + BASE + " L" + fp.map((p) => f2(p[0]) + " " + f2(p[1])).join(" L") + " L" + f2(fp[fp.length - 1][0]) + " " + BASE + " Z";
    PP.svg("path", { d: fillD, fill: "url(#s5-th-grad)" }, tsv);
    PP.svg("path", { d, class: "s5-th-trace" }, tsv);
  }

  // --- QR (real, scannable) + corner brackets + scan beam (clipped to the QR box)
  const qrBox = PP.el("div", "s5-qr", paper);
  PP.qr(qrBox, cfg.coaUrl, QR.s);
  const BG = 12; // bracket gap outside the QR box
  const BS = 34; // bracket arm length
  const qcx = QR.x + QR.s / 2;
  const qcy = QR.y + QR.s / 2;
  const brackets = ["tl", "tr", "bl", "br"].map((k) => {
    const b = PP.el("div", "s5-brk s5-brk-" + k, sheet); // on the sheet: the paper clips its overflow
    const bx = k[1] === "l" ? QR.x - BG : QR.x + QR.s + BG - BS;
    const by = k[0] === "t" ? QR.y - BG : QR.y + QR.s + BG - BS;
    b.style.left = bx + "px";
    b.style.top = by + "px";
    b.style.transformOrigin = `${qcx - bx}px ${qcy - by}px`;
    return b;
  });
  const scanClip = PP.el("div", "s5-scanclip", paper);
  const beam = PP.el("div", "s5-beam", scanClip);
  const trail = PP.el("div", "s5-trail", beam);
  PP.el("div", "s5-beam-line", beam);

  // unroll "curl": shading band riding the leading edge of the reveal
  const curl = PP.el("div", "s5-curl", paper);
  const CURL_H = 44;

  // --- over the paper: border flash, match-cut edge line, VERIFIED pill
  const flash = PP.el("div", "s5-flash", sheet);
  const edge = PP.scanLine(sheet, "h", CARD.w);
  edge.classList.add("s5-edge");
  const pill = PP.el("div", "s5-pill", sheet);
  const pck = PP.svg("svg", { width: 22, height: 22, viewBox: "0 0 22 22", class: "s5-pill-ck" }, pill);
  PP.svg("path", { d: "M5 11.5 L9.2 15.5 L17 7", fill: "none", stroke: C.bg, "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }, pck);
  PP.el("span", "s5-pill-t", pill, { text: "VERIFIED" });

  // caption under the card
  const cap = PP.el("div", "mono muted s5-cap", cam, { text: "SCAN · VERIFY · RESEARCH" });

  // ================================================================== timeline
  PP.camera(tl, cam, 12.0, 16.0);

  // --- 12.00–12.60 unroll from the line (clip-path inset(0 0 100% 0) → none, expo.out)
  PP.drive(
    tl,
    (p) => {
      const rev = CARD.h * p;
      const b = CARD.h - rev;
      if (p >= 1) {
        paper.style.clipPath = "none";
        shadow.style.clipPath = "none";
      } else {
        paper.style.clipPath = `inset(0px 0px ${b.toFixed(2)}px 0px)`;
        shadow.style.clipPath = `inset(-200px -200px ${(b - 170 * p).toFixed(2)}px -200px)`;
      }
      shadow.style.opacity = p.toFixed(3);
      curl.style.transform = `translateY(${(rev - CURL_H).toFixed(2)}px)`;
      curl.style.opacity = Math.max(0, Math.min(1, (1 - p) * 7)).toFixed(3);
    },
    0,
    1,
    12.0,
    0.6,
    "expo.out",
  );
  tl.fromTo(sheet, { rotationX: 18 }, { rotationX: 8, duration: 0.6, ease: "power3.out" }, 12.0);
  tl.fromTo(sheet, { rotationY: 0 }, { rotationY: -10, duration: 0.9, ease: "power2.inOut" }, 12.0);
  // Settle back in z while landing, so the pose reads as if pivoting on the card centre (projected box ≈ x 154→922,
  // y 545→1304) instead of the hinge; y compensates exactly so the top-edge centre stays on (540, 560).
  tl.fromTo(sheet, { z: 0, y: 0 }, { z: -PUSH_Z, y: (-(PERSP_OY - CARD.y) * PUSH_Z) / PERSP, duration: 0.9, ease: "power2.inOut" }, 12.0);
  // the line melts into the card's top edge: its ends pull in to where the rounded corners start (x 160→920 at
  // 12.00 = the S4 line; then r·2/3 in from each side so no straight whisker sticks out past the corner arcs)
  tl.fromTo(edge, { scaleX: 1 }, { scaleX: (CARD.w - (4 * CARD.r) / 3) / CARD.w, duration: 0.25, ease: "expo.out", force3D: false }, 12.0);
  tl.fromTo(edge, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power1.in" }, 12.1);

  // --- 12.30 headline. A word parked at yPercent 100 (blurred) shows as a hard-edged sliver in its mask's bottom
  // padding until its own start (line 2 "Its own COA." sat there 0.2–0.3 s, incl. an --accent smear), so each word is
  // gated: opacity 0 until its start, then up over 0.12 s inside the mask reveal (same as S1/S2, S3, S4).
  tl.fromTo(head.words, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out", stagger: 0.06 }, 12.3);
  PP.wordsIn(tl, head.words, 12.3);

  // --- 12.60–13.40 rows print one by one (fade + 8 px rise, stagger 0.1)
  // force3D:false on every tween inside the 3D sheet: a translate3d/scale3d mid-tween promotes the element to its own
  // compositor layer, which splits the paper into layers rasterised at different scales (thin dividers stair-step
  // and flicker for exactly the frames the tween runs, then snap back when it ends).
  tl.fromTo(rowText, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.1, force3D: false }, 12.6);

  // --- 13.40 caption
  tl.fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 13.4);

  // --- 13.40–13.70 corner brackets snap onto the QR
  tl.fromTo(brackets, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.24, ease: "back.out(1.6)", stagger: 0.02, force3D: false }, 13.4);

  // --- 13.70–14.30 scan line passes down then up over the QR
  tl.fromTo(beam, { opacity: 0 }, { opacity: 1, duration: 0.06, ease: "none" }, 13.68);
  tl.fromTo(beam, { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, 14.24);
  PP.drive(
    tl,
    (p) => {
      const half = p < 0.5 ? p * 2 : (1 - p) * 2; // 0 → 1 → 0
      const e = 0.5 - 0.5 * Math.cos(Math.PI * half);
      const speed = Math.sin(Math.PI * half); // 0 at both ends and at the turn
      beam.style.transform = `translateY(${(e * (QR.s - 2)).toFixed(2)}px)`;
      trail.style.transform = `scaleY(${((p < 0.5 ? 1 : -1) * (0.15 + 0.85 * speed)).toFixed(3)})`;
    },
    0,
    1,
    13.7,
    0.6,
    "none",
  );

  // --- 14.30 VERIFIED: pill pops, PURITY underline draws, border flashes once
  gsap.set(pill, { rotation: -6 });
  PP.popIn(tl, pill, 14.3);
  tl.fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut", force3D: false }, 14.32); // see force3D note above
  tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "power2.out" }, 14.3);
  tl.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: "power2.in", immediateRender: false }, 14.4);

  // --- 14.30–15.50 drift: rotateY -10 → -4, scale 1 → 1.03
  tl.fromTo(sheet, { rotationY: -10 }, { rotationY: -4, duration: 1.2, ease: "sine.inOut", immediateRender: false }, 14.3);
  tl.fromTo(persp, { scale: 1 }, { scale: 1.03, duration: 1.2, ease: "sine.inOut" }, 14.3);

  // --- 15.50–16.00 whip pan left (hand-off #5)
  tl.fromTo(whip, { x: 0 }, { x: -PP.W, duration: 0.5, ease: "expo.inOut" }, 15.5);
  PP.drive(
    tl,
    (v) => {
      if (v < 0.01) {
        whip.style.filter = "none";
        blur.setAttribute("stdDeviation", "0 0");
      } else {
        blur.setAttribute("stdDeviation", v.toFixed(2) + " 0");
        whip.style.filter = "url(#s5-whip-blur)";
      }
    },
    0,
    18,
    15.5,
    0.25,
    "power2.in",
  );
});
