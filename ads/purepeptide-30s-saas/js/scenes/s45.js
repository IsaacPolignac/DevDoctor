// s45 — S4+S5 phone act 2 (10.00 – 16.20).
// 10.00 invisible cut from s23 (phone at P0, m-product.jpg at css scroll 1100, nothing else) →
// 10.05 iOS push to the Qualité page, the phone steps back (scale 0.78) while the page scrolls to the
// Identité / Pureté rows → 10.80 the « Pureté » row lifts out as a floating card with an HPLC chromatogram,
// 11.84 the « Identité » row lifts out with a mass-spectrum bar chart → cards clear by 13.9 →
// 14.05 iOS push to « Certificats d'analyse » → 14.90 QR card pops, 15.10–15.60 scan line →
// 15.60–16.00 zoom-through exit into the drop (everything gone at 16.00).
// Every visual state is a pure function of timeline time (fromTo + immediateRender:false, PP.drive).
(function () {
  const PP = window.PP;

  PP.scene("s45", function (tl, root, cam) {
    const C = PP.C;
    const S = PP.PHONE.S; // 1.4 px per css px at P0

    // ------------------------------------------------------------------ timing (sound-event table)
    const T_NAV1 = 10.05; // swipe → Qualité
    const T_PUR = 10.8; // pop — Pureté card (word « HPLC »)
    const T_IDE = 11.84; // pop — Identité card (word « identité »)
    const T_OUT = 13.5; // cards clean away (gone by ~13.85)
    const T_NAV2 = 14.05; // swipe → Certificats d'analyse
    const T_QR = 14.9; // pop — QR card
    const T_SCAN = 15.1; // scan 15.10 – 15.60
    const T_EXIT = 15.6; // riser / zoom-through 15.60 → 16.00

    // ------------------------------------------------------------------ poses (rig = phone + in-phone fx)
    // pose = uniform scale around the P0 centre (540, 1040) + vertical offset
    const P0 = { s: 1, dy: 0 };
    const PA = { s: 0.78, dy: 0 }; // L4: room for the 3-line headline + side cards
    const PB = { s: 0.78, dy: -76 }; // L5: 2-line headline → phone glides up (COA paragraph clear of the QR card)
    const Q_SCROLL0 = 120; // Qualité page lands with « Chaque lot, vérifié. » in view
    const Q_SCROLL1 = 300; // then scrolls: Identité + Pureté rows centred in the phone

    // ------------------------------------------------------------------ helpers
    const ft = (target, from, to, at, dur, ease) =>
      tl.fromTo(target, from, Object.assign({ duration: dur, ease: ease || "none", immediateRender: false }, to), at);
    const snap = (target, from, to, at) => ft(target, from, to, at, 0.001, "none");
    CustomEase.create("s45spring", "M0,0 C0.14,0.62 0.22,1.1 0.4,1.085 0.56,1.07 0.68,0.985 0.82,0.996 0.9,1.001 0.95,1 1,1");

    // ------------------------------------------------------------------ rig + phone (identical to s23's last frame)
    const rig = PP.el("div", "s45-rig", cam);
    const setPose = (s, dy) => {
      rig.style.transform = Math.abs(s - 1) < 1e-5 && Math.abs(dy) < 0.005 ? "none" : "translate(0px," + dy.toFixed(3) + "px) scale(" + s.toFixed(5) + ")";
    };
    const poseMove = (A, B, at, dur, ease) => PP.drive(tl, (p) => setPose(A.s + (B.s - A.s) * p, A.dy + (B.dy - A.dy) * p), 0, 1, at, dur, ease);

    const phone = PP.phone(rig);
    const PL = 540 - phone.W / 2;
    const PT = 1040 - phone.H / 2;
    // page css coords -> rig coords (= frame coords at P0)
    const at = (cx, cy, scroll, full) => {
      const p = phone.pt(cx, cy, scroll, full);
      return { x: PL + p.x, y: PT + p.y };
    };
    // rig coords -> cam coords for a given pose
    const inPose = (p, pose) => ({ x: 540 + (p.x - 540) * pose.s, y: 1040 + pose.dy + (p.y - 1040) * pose.s });

    const prod = phone.addPage("assets/site/m-product.jpg", 1900);
    gsap.set(prod.img, { y: -1100 * S });
    const prodDim = PP.el("div", "s45-dim", prod.el);

    const qual = phone.addPage("assets/site/m-quality.jpg", 2500);
    qual.el.classList.add("s45-push");
    gsap.set(qual.img, { y: -Q_SCROLL0 * S });
    const qualDim = PP.el("div", "s45-dim", qual.el);

    const coa = phone.addPage("assets/site/m-coa.jpg", 1300);
    coa.el.classList.add("s45-push");
    const OFF = phone.sw + 90; // parked right of the screen, shadow included
    gsap.set([qual.el, coa.el], { x: OFF });

    // COA focus scrim: veils the « Certificats de lot / à venir » part of the page (below the Janoshik
    // paragraph, css y 432). It lives INSIDE the COA page at full density, so the page slides in already
    // veiled — « Certificats à venir » is never legible (it used to read clearly 14.10 → 14.55).


    // in-phone fx (rig coords): lifted-row slots + COA paragraph ring
    const fx = PP.svg("svg", { class: "s45-fx", width: 1080, height: 1920, viewBox: "0 0 1080 1920" }, rig);
    const defs = PP.svg("defs", {}, fx);
    const gradDef = (id, x1, y1, x2, y2, units, parent) => {
      const g = PP.svg("linearGradient", Object.assign({ id, x1, y1, x2, y2 }, units ? { gradientUnits: "userSpaceOnUse" } : {}), parent);
      PP.svg("stop", { offset: "0", "stop-color": C.navy }, g);
      PP.svg("stop", { offset: "0.55", "stop-color": C.blue }, g);
      PP.svg("stop", { offset: "1", "stop-color": C.teal }, g);
      return g;
    };
    gradDef("s45-grad", "0", "0", "1", "1", false, defs);

    // ------------------------------------------------------------------ headline layer (not in the camera)
    const hl = PP.el("div", "s45-hl", root);
    const fitHeadline = (h, maxW) => {
      let widest = 0;
      h.lines.forEach((ln) => {
        const ws = ln.querySelectorAll(".pp-w");
        const a = ws[0].getBoundingClientRect();
        const b = ws[ws.length - 1].getBoundingClientRect();
        widest = Math.max(widest, b.right - a.left);
      });
      if (widest > maxW) {
        const fs = parseFloat(getComputedStyle(h.el).fontSize);
        h.el.style.fontSize = Math.floor((fs * maxW) / widest) + "px";
      }
    };
    const h4 = PP.voHeadline(tl, hl, "L4", ["Pureté par *HPLC,*", "identité par", "spectrométrie de *masse.*"], "h2 s45-h");
    fitHeadline(h4, 800);
    PP.textOut(tl, [...h4.lines].reverse(), 13.66, { dur: 0.22, stagger: 0.04 });

    const h5 = PP.voHeadline(tl, hl, "L5", ["Chaque *certificat,*", "publié en ligne."], "h2 s45-h");
    h5.el.style.fontSize = h4.el.style.fontSize; // same size for both lines of the act
    // exit: the headline layer zooms with the camera (same origin, same relative scale → no overlap with the
    // phone during the zoom-through); blur/fade come a beat later so « en ligne. » still lands
    ft(hl, { scale: 1 }, { scale: 1.4 / 1.04 }, 15.6, 0.4, "power3.in");
    ft(h5.el, { opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: "blur(10px)" }, 15.78, 0.2, "power2.in");

    // ================================================================== ACT 2a — Qualité (L4)
    // 10.05 iOS push navigation (slide from the right; product page parallaxes left under a dim)
    ft(qual.el, { x: OFF }, { x: 0 }, T_NAV1, 0.55, "power4.out");
    ft(prod.el, { x: 0 }, { x: -0.3 * phone.sw }, T_NAV1, 0.55, "power4.out");
    ft(prodDim, { opacity: 0 }, { opacity: 0.16 }, T_NAV1, 0.45, "power2.out");

    // phone steps back to pose A while the page scrolls to the two rows
    poseMove(P0, PA, 10.24, 0.54, "power3.inOut");
    qual.scroll(tl, Q_SCROLL0, Q_SCROLL1, 10.34, 0.44, "power2.inOut");

    // gentle camera push (scale 1 until 10.50 — hand-off rule), continued through L5
    ft(cam, { scale: 1 }, { scale: 1.03 }, 10.5, 3.3, "sine.inOut");
    ft(cam, { scale: 1.03 }, { scale: 1.04 }, 13.8, T_EXIT - 13.8, "none");

    // ------------------------------------------------------------------ lifted cards
    const CW = 400; // card width
    const PANEL = 150; // chart panel height
    const SHADOW0 = "0 0px 0px rgba(18,42,84,0), 0 0 0 1px rgba(230,235,242,0)";
    const SHADOW1 = "0 30px 70px rgba(18,42,84,0.2), 0 0 0 1px rgba(230,235,242,1)";

    function liftCard(o) {
      const [cx, cy, cw, chh] = o.crop;
      const card = PP.el("div", "s45-card", cam);
      card.style.left = o.x + "px";
      card.style.top = o.y + "px";
      card.style.width = CW + "px";
      const lens = PP.lens(card, "assets/site/m-quality.jpg", 390, 2500, o.crop, CW);
      const cropH = lens.height;
      const H = cropH + PANEL;
      card.style.height = H + "px";
      const panel = PP.el("div", "s45-panel", card);
      panel.style.top = cropH + "px";
      panel.style.height = PANEL + "px";

      // slot left behind in the phone (rig coords, so it follows the pose)
      const r0 = at(cx, cy, Q_SCROLL1);
      const slot = PP.el("div", "s45-slot", rig);
      slot.style.cssText = `left:${r0.x}px;top:${r0.y}px;width:${cw * S}px;height:${chh * S}px`;
      gsap.set(slot, { opacity: 0 });

      // FLIP start: the crop sits exactly on the source row (pose A)
      const src = inPose(r0, PA);
      const s0 = (cw * S * PA.s) / CW;
      const x0 = src.x - o.x;
      const y0 = src.y - o.y;
      gsap.set(card, { x: x0, y: y0, scale: s0, opacity: 0, height: cropH, borderRadius: 6, boxShadow: SHADOW0 });

      const T = o.t;
      snap(card, { opacity: 0 }, { opacity: 1 }, T);
      ft(slot, { opacity: 0 }, { opacity: 1 }, T, 0.16, "power1.out");
      ft(card, { x: x0, y: y0, scale: s0 }, { x: 0, y: 0, scale: 1 }, T, 0.62, "s45spring");
      ft(card, { borderRadius: 6, boxShadow: SHADOW0 }, { borderRadius: 26, boxShadow: SHADOW1 }, T, 0.34, "power2.out");
      ft(card, { height: cropH }, { height: H }, T + 0.16, 0.5, "power3.out");
      ft(panel, { opacity: 0 }, { opacity: 1 }, T + 0.2, 0.25, "power1.out");
      // idle float, then clean away
      ft(card, { y: 0 }, { y: -8 }, T + 0.62, o.out - (T + 0.62), "sine.inOut");
      ft(card, { opacity: 1 }, { opacity: 0 }, o.out, 0.3, "power2.in");
      ft(card, { x: 0, y: -8, scale: 1 }, { x: CW * 0.03 + o.exitX, y: H * 0.03 + 14, scale: 0.94 }, o.out, 0.3, "power2.in");
      ft(slot, { opacity: 1 }, { opacity: 0 }, o.out + 0.08, 0.26, "power1.inOut");
      return { card, panel, H, cropH };
    }

    // Identité row (css 21,466 → 348 x 210) goes up-right; Pureté row (css 21,677.5 → 348 x 233) goes left
    const ide = liftCard({ crop: [21, 466, 348, 58], x: 556, y: 632, t: T_IDE, out: T_OUT, exitX: -16 });
    PP.el("div", "s45-chip mono", ide.panel, { text: "Spectrométrie de masse" });
    // y 1036: the card's top edge stays below the in-phone Identité chip (« SPECTROMÉTRIE DE MASSE ») until it lifts
    const pur = liftCard({ crop: [21, 677.5, 348, 58], x: 124, y: 1036, t: T_PUR, out: T_OUT + 0.08, exitX: 16 });
    PP.el("div", "s45-chip mono", pur.panel, { text: "HPLC" });

    // ---- chromatogram (Pureté): one sharp peak, brand-gradient stroke, soft gradient fill under the peak
    (function chromatogram(panel) {
      const W = CW,
        H = PANEL;
      const X0 = 28,
        X1 = W - 28,
        TOP = 24,
        BASE = H - 30;
      const svg = PP.svg("svg", { class: "s45-chart", width: W, height: H, viewBox: `0 0 ${W} ${H}` }, panel);
      const d = PP.svg("defs", {}, svg);
      gradDef("s45-chro-stroke", X0, 0, X1, 0, true, d);
      const fg = PP.svg("linearGradient", { id: "s45-chro-fill", x1: "0", y1: "0", x2: "0", y2: "1" }, d);
      PP.svg("stop", { offset: "0", "stop-color": C.blue, "stop-opacity": "0.5" }, fg);
      PP.svg("stop", { offset: "1", "stop-color": C.teal, "stop-opacity": "0" }, fg);
      // light grid
      [TOP, (TOP + BASE) / 2].forEach((y) => PP.svg("line", { x1: X0, y1: y, x2: X1, y2: y, stroke: "#EDF1F6", "stroke-width": 2, "stroke-dasharray": "2 8", "stroke-linecap": "round" }, svg));
      PP.svg("line", { x1: X0, y1: BASE + 2, x2: X1, y2: BASE + 2, stroke: C.line, "stroke-width": 2 }, svg);
      // signal
      const PX = X0 + (X1 - X0) * 0.47;
      const AMP = BASE - TOP - 4;
      const rnd = PP.rng(4510);
      const g = (x, c, a, sl, sr) => {
        const s = x < c ? sl : sr;
        return a * Math.exp(-((x - c) * (x - c)) / (2 * s * s));
      };
      const yAt = (x) => BASE - (g(x, PX, AMP, 5.4, 7.6) + g(x, X0 + (X1 - X0) * 0.2, 5, 5, 6) + g(x, X0 + (X1 - X0) * 0.74, 8, 5, 7) + g(x, X0 + (X1 - X0) * 0.86, 3.5, 4, 5));
      let dd = "";
      const pts = [];
      for (let x = X0; x <= X1 + 0.01; x += 1.5) {
        const nearPeak = Math.abs(x - PX) < 22;
        const y = yAt(x) - (nearPeak ? 0 : (rnd() - 0.5) * 1.3);
        pts.push([x, y]);
        dd += (dd ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(2);
      }
      let fd = "";
      pts.filter(([x]) => Math.abs(x - PX) <= 40).forEach(([x, y], i) => (fd += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(2)));
      fd += ` L${(PX + 40).toFixed(1)} ${BASE} L${(PX - 40).toFixed(1)} ${BASE} Z`;
      const fill = PP.svg("path", { d: fd, fill: "url(#s45-chro-fill)" }, svg);
      const drop = PP.svg("line", { x1: PX, y1: BASE - AMP + 10, x2: PX, y2: BASE, stroke: C.teal, "stroke-width": 2, "stroke-dasharray": "3 6", "stroke-linecap": "round", opacity: 0.45 }, svg);
      const line = PP.svg("path", { d: dd, fill: "none", stroke: "url(#s45-chro-stroke)", "stroke-width": 3.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
      const apex = PP.svg("circle", { cx: PX, cy: BASE - AMP, r: 6.5, fill: "#FFFFFF", stroke: C.teal, "stroke-width": 3.2 }, svg);
      gsap.set([fill, drop], { opacity: 0 });
      gsap.set(apex, { scale: 0, transformOrigin: "50% 50%" });
      gsap.set(line, { drawSVG: "0%" });
      // the stroke reaches the peak at ~47 % of the draw
      const D0 = T_PUR + 0.3,
        DD = 0.95;
      ft(line, { drawSVG: "0%" }, { drawSVG: "100%" }, D0, DD, "power1.inOut");
      const tPeak = D0 + DD * 0.47;
      ft(apex, { scale: 0 }, { scale: 1 }, tPeak, 0.36, "back.out(3)");
      ft(fill, { opacity: 0 }, { opacity: 1 }, tPeak - 0.05, 0.4, "power2.out");
      ft(drop, { opacity: 0 }, { opacity: 0.45 }, tPeak + 0.05, 0.3, "power1.out");
    })(pur.panel);

    // ---- mass spectrum (Identité): one dominant teal bar, small isotope + noise bars
    (function spectrum(panel) {
      const W = CW,
        H = PANEL;
      const X0 = 28,
        X1 = W - 28,
        TOP = 24,
        BASE = H - 30;
      const svg = PP.svg("svg", { class: "s45-chart", width: W, height: H, viewBox: `0 0 ${W} ${H}` }, panel);
      [TOP, (TOP + BASE) / 2].forEach((y) => PP.svg("line", { x1: X0, y1: y, x2: X1, y2: y, stroke: "#EDF1F6", "stroke-width": 2, "stroke-dasharray": "2 8", "stroke-linecap": "round" }, svg));
      PP.svg("line", { x1: X0, y1: BASE + 2, x2: X1, y2: BASE + 2, stroke: C.line, "stroke-width": 2 }, svg);
      const rnd = PP.rng(4545);
      const AMP = BASE - TOP;
      const MX = X0 + (X1 - X0) * 0.58;
      const bars = [];
      const bar = (x, h, w, fill, op) => {
        const r = PP.svg("rect", { x: (x - w / 2).toFixed(1), y: (BASE - h).toFixed(1), width: w, height: h.toFixed(1), rx: w / 2, fill, "fill-opacity": op }, svg);
        return r;
      };
      // noise bars
      const xs = [0.05, 0.11, 0.16, 0.24, 0.3, 0.37, 0.43, 0.49, 0.72, 0.79, 0.85, 0.91, 0.96];
      xs.forEach((f) => bars.push(bar(X0 + (X1 - X0) * f, 5 + rnd() * 15, 5, "#B9C7DA", 1)));
      // isotope pattern next to the main peak
      const iso1 = bar(MX + 13, AMP * 0.46, 6, C.teal, 0.42);
      const iso2 = bar(MX + 26, AMP * 0.14, 6, C.teal, 0.3);
      const main = bar(MX, AMP, 8, C.teal, 1);
      const cap = PP.svg("circle", { cx: MX, cy: BASE - AMP - 1, r: 6.5, fill: "#FFFFFF", stroke: C.teal, "stroke-width": 3.2 }, svg);
      const all = bars.concat([iso2, iso1]);
      gsap.set(all.concat([main]), { scaleY: 0, transformOrigin: "50% 100%" });
      gsap.set(cap, { scale: 0, transformOrigin: "50% 50%" });
      const B0 = T_IDE + 0.3;
      all.forEach((b, i) => ft(b, { scaleY: 0 }, { scaleY: 1 }, B0 + i * 0.022, 0.32, "back.out(2)"));
      // dominant bar springs up as « spectrométrie » is said (12.48)
      ft(main, { scaleY: 0 }, { scaleY: 1 }, 12.44, 0.5, "s45spring");
      ft(cap, { scale: 0 }, { scale: 1 }, 12.62, 0.34, "back.out(3)");
      ft(cap, { y: AMP }, { y: 0 }, 12.44, 0.5, "s45spring");
    })(ide.panel);

    // ================================================================== ACT 2b — Certificats d'analyse (L5)
    poseMove(PA, PB, 13.8, 0.6, "power3.inOut");
    ft(coa.el, { x: OFF }, { x: 0 }, T_NAV2, 0.55, "power4.out");
    ft(qual.el, { x: 0 }, { x: -0.3 * phone.sw }, T_NAV2, 0.55, "power4.out");
    ft(qualDim, { opacity: 0 }, { opacity: 0.16 }, T_NAV2, 0.45, "power2.out");

    // ring on the Janoshik paragraph (css 20,309,350,112) on « certificat »
    const RPX = 14, // horizontal padding: the text starts at the capture's css x 20 — keep it off the stroke
      RPY = 7;
    const p0 = at(20, 309, 0);
    const ring = PP.svg("rect", { x: p0.x - RPX, y: p0.y - RPY, width: 350 * S + 2 * RPX, height: 112 * S + 2 * RPY, rx: 22, fill: "rgba(42,154,194,0.06)", stroke: "url(#s45-grad)", "stroke-width": 4.5 }, fx);
    gsap.set(ring, { drawSVG: "0%", attr: { "fill-opacity": 0 } });
    ft(ring, { drawSVG: "0%" }, { drawSVG: "100%" }, 14.4, 0.42, "power2.out");
    ft(ring, { attr: { "fill-opacity": 0 } }, { attr: { "fill-opacity": 1 } }, 14.4, 0.3, "power1.out");

    // QR card
    const QR = 250;
    const QW = 520;
    const qr = PP.el("div", "s45-qr", cam);
    qr.style.left = 540 - QW / 2 + "px";
    qr.style.top = "1034px";
    qr.style.width = QW + "px";
    const code = PP.el("div", "s45-qr-code", qr);
    code.style.width = code.style.height = QR + "px";
    PP.qr(code, PP.cfg.coaUrl, QR);
    // four corner brackets
    const BR = 16,
      BL = 40;
    const brk = PP.svg("svg", { class: "s45-brk", width: QR + 2 * BR + 8, height: QR + 2 * BR + 8, viewBox: `0 0 ${QR + 2 * BR + 8} ${QR + 2 * BR + 8}` }, code);
    const bd = PP.svg("defs", {}, brk);
    gradDef("s45-brk-grad", 0, 0, QR + 2 * BR + 8, QR + 2 * BR + 8, true, bd);
    const E = QR + 2 * BR + 4;
    const corners = [
      `M4 ${4 + BL} V${4 + 10} Q4 4 ${4 + 10} 4 H${4 + BL}`,
      `M${E - BL} 4 H${E - 10} Q${E} 4 ${E} ${4 + 10} V${4 + BL}`,
      `M${E} ${E - BL} V${E - 10} Q${E} ${E} ${E - 10} ${E} H${E - BL}`,
      `M${4 + BL} ${E} H${4 + 10} Q4 ${E} 4 ${E - 10} V${E - BL}`,
    ].map((dd) => PP.svg("path", { d: dd, fill: "none", stroke: "url(#s45-brk-grad)", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, brk));
    // scan line + glow trail
    const scanClip = PP.el("div", "s45-scan-clip", code);
    const scan = PP.el("div", "s45-scan", scanClip);
    PP.el("div", "s45-scan-trail", scan);
    PP.el("div", "s45-scan-line", scan);
    const cap = PP.el("div", "s45-qr-cap", qr);
    PP.el("span", "s45-qr-dot", cap);
    PP.el("span", "", cap, { text: "purepeptide.care/coa" });

    gsap.set(qr, { opacity: 0, transformOrigin: "50% 60%" });
    gsap.set(scan, { opacity: 0, y: 0 });
    const T_QRV = T_QR - 1 / 30; // onset one frame early: the 14.90 pop frame already shows the card
    snap(qr, { opacity: 0 }, { opacity: 1 }, T_QRV);
    ft(qr, { scale: 0.62, y: 46 }, { scale: 1, y: 0 }, T_QRV, 0.6, "s45spring");
    ft(qr, { boxShadow: SHADOW0 }, { boxShadow: SHADOW1 }, T_QRV, 0.3, "power2.out");
    // brackets snap in from outside
    const bOff = [
      [-14, -14],
      [14, -14],
      [14, 14],
      [-14, 14],
    ];
    corners.forEach((c, i) => {
      ft(c, { x: bOff[i][0], y: bOff[i][1], opacity: 0 }, { x: 0, y: 0, opacity: 1 }, T_QR + 0.1 + i * 0.03, 0.38, "back.out(2.4)");
    });
    ft(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, T_QR + 0.16, 0.3, "power2.out");
    // idle float of the card until the exit
    ft(qr, { y: 0 }, { y: -6 }, T_QR + 0.6, T_EXIT - (T_QR + 0.6), "sine.inOut");
    // 15.10 – 15.60 scan pass (top → bottom of the code)
    ft(scan, { opacity: 0 }, { opacity: 1 }, T_SCAN, 0.06, "power1.out");
    ft(scan, { y: 0 }, { y: QR }, T_SCAN, 0.5, "sine.inOut");
    ft(scan, { opacity: 1 }, { opacity: 0 }, T_SCAN + 0.42, 0.08, "power1.in");
    // brackets pulse once the pass completes
    ft(brk, { scale: 1 }, { scale: 1.04 }, T_SCAN + 0.3, 0.2, "power2.out");
    ft(brk, { scale: 1.04 }, { scale: 1 }, T_SCAN + 0.5, 0.1, "power2.in");

    // ================================================================== EXIT 15.60 → 16.00 (zoom-through into the drop)
    ft(cam, { scale: 1.04 }, { scale: 1.4 }, T_EXIT, 0.4, "power3.in");
    ft(cam, { filter: "blur(0px)" }, { filter: "blur(12px)" }, T_EXIT, 0.4, "power2.in");
    ft(cam, { opacity: 1 }, { opacity: 0 }, T_EXIT + 0.08, 0.32, "power2.in");

    // start state = s23's last frame (P0, no transform)
    setPose(1, 0);
  });
})();
