// S11 · end card · window f1230–f1350 (41.000–45.000 s) · SVG/DOM · NAVY. SCENES §S11.
//   f1230        LOGO hit. S10's #period recoils (1 → 1.32 → 1, 2 f out / 9 f settle) and emits 14 copies of itself: the 14
//                circles of brand-symbol-neon.svg. Each copy flies a seeded quadratic Bézier (launched in a fan out of
//                the period, then converging) to its circle of the symbol, centred (960,266), 140 px tall (y 196–336).
//                14 f expo.out, 1 f stagger, nearest first. Radius period → circle, colour accent → the circle's own fill.
//                Each copy is drawn as a velocity-stretched capsule (0.5 f shutter): a streak on the burst, a dot at rest.
//                It appears only on its launch frame (f1230 = S10's frame + the recoil start) and flies in the period's
//                teal; on seating (u = 10/14) it pings (→ near-white, r ×1.3, spring back over 8 f, 1 px ripple ring)
//                and cools to its brand fill: a bottom → top cascade f1240–1253, settled by f1261.
//   f1238–1250   the two hex strokes draw (DrawSVG, power3.out); a soft centre glow rises under the symbol.
//   f1230–1240   legal line, masked reveal (yPercent 110→0, 10 f power4.out), Inter 500 26 px #C3CBD6, centred y 960.
//   f1236–1247   CTA: the pill widens 520 → 680 by box size (FLIP, crisp, 10 f expo.inOut) while its label does a
//                masked swap inside S11's own window: "purepeptide.care" out up (4 f power3.in), "Shop now" +
//                "· purepeptide.care" in from below at f1240 / f1241 (6 f power4.out), Inter 600 38 px #F3F6FA.
//   L17 'purepeptide'  pill sheen: 105° band, xPercent −120→120, 30 % white, 30 f (clamped f1246–1290; L17 'purepeptide' = f1274 → sheen f1274–1304).
//   after the sheen  static apart from the grain; f1349 = poster frame.
// Hand-over in: S10 leaves #S10-brand (wordmark, tagline, #period) on #stage at z 40 and #pill (z 55) at 960,760 520×84.
// If S10 did not build (no PP.S10) a static copy of its OUT state is drawn here so the card still reads.
PP.scene("S11", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const E = (n) => gsap.parseEase(n);
  const lerp = (a, b, u) => a + (b - a) * u;
  const fx = (x) => x.toFixed(2);
  const snapF = (t) => Math.round(t * 30) / 30;
  const stage = document.getElementById("stage");
  const SVGNS = "http://www.w3.org/2000/svg";

  const T0 = snapF(CUES.LOGO); // f1230, the music LOGO hit (js/cues.js)
  const T_CTA = T0 + 6 * F; // f1236
  const T_STROKE = T0 + 8 * F; // f1238

  // ================================================================== hand-over from S10 (or a static fallback)
  let S10 = PP.S10;
  if (!S10 || !S10.period) {
    console.warn("[S11] PP.S10 missing: drawing a static copy of the S10 OUT state");
    const card = PP.el("div", "layer", root.querySelector(".z-front"));
    const wm = PP.logo(card, { width: 720 });
    Object.assign(wm.el.style, { position: "absolute", left: "600px", top: "372px" });
    const tag = PP.el("div", "", card, { html: '<span style="color:#2EE6C9">Purity,</span> proven<span class="s11-fb-period" style="color:#2EE6C9;display:inline-block">.</span>' });
    tag.style.cssText = "position:absolute;left:0;top:512px;width:1920px;height:96px;text-align:center;white-space:nowrap;font-family:var(--display);" +
      "font-weight:800;font-size:96px;line-height:96px;letter-spacing:-0.02em;color:#F3F6FA";
    S10 = { period: tag.querySelector(".s11-fb-period"), push: 1, camOrigin: { x: 960, y: 480 } };
  }
  const period = S10.period;
  const PUSH = S10.push || 1, O = S10.camOrigin || { x: 960, y: 480 };

  // The period glyph's centre and radius on stage, read at render time (first evaluation at t ≥ f1230, when S10's card
  // push is frozen and the webfont is live): the span's stage box with the recoil scale divided out + the glyph's ink
  // box (fractions of the span). So the 14 copies start exactly on the rendered dot. The initial P0/R0 rank the dots only.
  const ORX = 0.5, ORY = 0.72; // recoil transform-origin
  period.style.transformOrigin = `${ORX * 100}% ${ORY * 100}%`;
  let P0 = { x: 1285, y: 589 }, R0 = 8.3, measured = false, live = false;
  const measure = () => {
    if (measured || !live) return; // never at build time (the card is not in its f1230 state then)
    const sr = stage.getBoundingClientRect(), k0 = sr.width / PP.W || 1;
    const r = period.getBoundingClientRect();
    const s = gsap.getProperty(period, "scale") || 1;
    const W = r.width / k0, H = r.height / k0;
    const ox = (r.left - sr.left) / k0 + ORX * W, oy = (r.top - sr.top) / k0 + ORY * H;
    const w0 = W / s, h0 = H / s;
    if (!(w0 > 0)) return;
    // DM Sans 800 '.' ink inside its span box, as fractions of the span (measured on rendered frames: canvas metrics are
    // unusable here, document.fonts.check() is false for canvas and it falls back to another face)
    const GX = 0.857 * w0, GY = 0.759 * h0, GR = 0.305 * w0;
    P0 = { x: ox - ORX * w0 + GX, y: oy - ORY * h0 + GY };
    R0 = GR;
    measured = true;
  };

  // ================================================================== the symbol (brand-symbol-neon.svg, exact geometry)
  const SYM_H = 140, SYM_TOP = 196, SYM_CX = 960;
  const sc = SYM_H / 456; // viewBox 429 196 405 456 → 140 px tall
  const SYM_W = 405 * sc, SYM_L = SYM_CX - SYM_W / 2;
  const MX = [1.798630533, 1.798210272, -788.896518469, -190.853047203]; // the file's group matrix (a, d, e, f)
  const toStage = (x, y) => ({ x: SYM_L + (MX[0] * x + MX[2] - 429) * sc, y: SYM_TOP + (MX[1] * y + MX[3] - 196) * sc });
  const DOTS = [ // cx, cy, r, fill — the 14 circles, in file order
    [829.29, 250.25, 11.44, "#124084"], [798.5, 269.63, 11.44, "#144B87"], [837.57, 287.46, 9.14, "#16568A"],
    [775.18, 290.68, 8.97, "#16578B"], [828.66, 316.39, 11.44, "#19668F"], [801.37, 324.38, 11.27, "#1A6B90"],
    [775.24, 321.68, 8.97, "#1A698F"], [776.16, 357.63, 11.27, "#1D7E95"], [748.12, 364.81, 11.27, "#1E8296"],
    [802.06, 361.31, 9.02, "#1E8095"], [802.01, 391.85, 9.02, "#21919A"], [739.27, 393.0, 9.2, "#21929A"],
    [778.22, 411.92, 11.44, "#239D9D"], [741.57, 427.73, 11.09, "#25A6A0"],
  ];

  const svg = root.querySelector(".s11-mark");
  const defs = PP.svg("defs", {}, svg);
  const grad = (id, x1, y1, x2, y2, stops, extra) => {
    const g = PP.svg(extra ? "radialGradient" : "linearGradient", Object.assign(extra || { x1, y1, x2, y2 }, { id }), defs);
    stops.forEach(([o, c, a]) => PP.svg("stop", { offset: o, "stop-color": c, "stop-opacity": a == null ? 1 : a }, g));
  };
  grad("s11-leftSeg", 0, 0, 1, 1, [[0, "#2BD0C4"], [1, "#3CC3EE"]]);
  grad("s11-rightSeg", 0, 0, 1, 1, [[0, "#4CB4F2"], [1, "#3A9BEA"]]);
  grad("s11-glow", 0, 0, 0, 0, [[0, "#35BDF0", 0.2], [0.45, "#2E8FD8", 0.08], [1, "#123A78", 0]], { cx: 0.5, cy: 0.5, r: 0.5 });

  // centre glow under the symbol (depth on navy): rises as the dots arrive, then holds
  const glow = PP.svg("ellipse", { cx: SYM_CX, cy: SYM_TOP + SYM_H / 2, rx: 190, ry: 170, fill: "url(#s11-glow)", opacity: 0 }, svg);
  PP.drive(tl, (u) => glow.setAttribute("opacity", u.toFixed(3)), 0, 1, T_STROKE, 22 * F, "power2.out");

  // hex strokes, in the file's own coordinate system
  const sym = PP.svg("svg", { x: SYM_L, y: SYM_TOP, width: SYM_W, height: SYM_H, viewBox: "429 196 405 456", overflow: "visible" }, svg);
  const g = PP.svg("g", { transform: `matrix(${MX[0]},0,0,${MX[1]},${MX[2]},${MX[3]})` }, sym);
  const lineAttrs = { fill: "none", "stroke-width": 7.76, "stroke-linecap": "butt", "stroke-linejoin": "miter" };
  const pl1 = PP.svg("polyline", Object.assign({ points: "800.34,232.65 786.55,224.03 686.02,285.56 686.02,398.29 711.30,414.39", stroke: "url(#s11-leftSeg)" }, lineAttrs), g);
  const pl2 = PP.svg("polyline", Object.assign({ points: "863.53,266.01 893.40,285.56 893.40,398.29 793.45,459.82 775.06,448.90", stroke: "url(#s11-rightSeg)" }, lineAttrs), g);
  PP.draw(tl, [pl1, pl2], T_STROKE, 12 * F, { ease: "power3.out" });

  // ================================================================== 14 copies of the period → the 14 circles
  const ACC = [0x2e, 0xe6, 0xc9];
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const R = PP.rng(1230);
  const EXO = E("expo.out");
  const FLY = 14 * F, SHUTTER = 0.5 / 14, STREAK = 34; // tail lag: 0.5 f shutter of a 14 f flight; streak capped at 34 px
  const dots = DOTS.map(([cx, cy, r, fill]) => {
    const T = toStage(cx, cy);
    return { T, r: r * MX[0] * sc, col: rgb(fill), d: Math.hypot(T.x - P0.x, T.y - P0.y) };
  });
  dots.slice().sort((a, b) => a.d - b.d).forEach((d, k) => (d.rank = k));
  // Launch: every control point sits up-right of the wordmark's end, so each copy leaves the period up and to the right,
  // clears "PUREPEPTIDE" (x ≤ 1330, y 368–446) and sweeps left over it into the hex (an arc, never across the type).
  dots.forEach((d) => {
    d.C = { x: lerp(1600, 1800, R()) + (d.T.x - SYM_CX) * 0.8, y: lerp(110, 330, R()) + (d.T.y - (SYM_TOP + SYM_H / 2)) * 0.8 };
    d.ring = PP.svg("circle", { cx: fx(d.T.x), cy: fx(d.T.y), r: fx(d.r), fill: "none", stroke: "#2EE6C9", "stroke-width": 1, "stroke-opacity": 0 }, svg);
    d.el = PP.svg("ellipse", { cx: fx(P0.x), cy: fx(P0.y), rx: fx(R0), ry: fx(R0), fill: "#2EE6C9" }, svg);
  });
  const bez = (d, e) => {
    const i = 1 - e;
    return { x: i * i * P0.x + 2 * i * e * d.C.x + e * e * d.T.x, y: i * i * P0.y + 2 * i * e * d.C.y + e * e * d.T.y };
  };
  // Landing ping (quality upgrade): each copy flies in the period's teal and only takes its brand fill once it seats,
  // with a glint (teal → near-white, radius ×1.3, then a spring 1.3 → 0.97 → 1 over 8 f) and a thin ripple ring. The
  // cascade runs bottom → top (nearest first), so the darkest top dots — which sit almost on the navy at rest — each
  // get their own lit frame instead of fading out in flight. Peak at u = 10/14 (the head is < 1 % from its seat).
  const UP = 10 / 14, URISE = 2 / 14, UDECAY = 8 / 14;
  const WHITE = [0xf3, 0xf6, 0xfa], PEAK = ACC.map((v, i) => Math.round(lerp(v, WHITE[i], 0.5)));
  const P2O = E("power2.out"), P2I = E("power2.in");
  const setDot = (d, u) => {
    // a copy exists only once it has left: before its launch frame it would sit on the period and fatten its AA edge
    // (14 stacked anti-aliased discs), so f1230 is the S10 frame untouched apart from the recoil's start
    d.el.setAttribute("opacity", u > 0 ? "1" : "0");
    const e = EXO(Math.min(1, Math.max(0, u)));
    const h = bez(d, e), t = bez(d, EXO(Math.min(1, Math.max(0, u - SHUTTER))));
    const len = Math.min(STREAK, Math.hypot(h.x - t.x, h.y - t.y));
    const ang = (Math.atan2(h.y - t.y, h.x - t.x) * 180) / Math.PI;
    const ux = Math.cos((ang * Math.PI) / 180), uy = Math.sin((ang * Math.PI) / 180);
    const mx = h.x - (ux * len) / 2, my = h.y - (uy * len) / 2; // capsule trails behind the head
    // ping: rise (2 f, power2.in) to the peak, then decay (8 f)
    let c, k = 1, ring = 0;
    if (u < UP - URISE) c = ACC;
    else if (u < UP) {
      const q = P2I((u - (UP - URISE)) / URISE);
      c = ACC.map((v, i) => lerp(v, PEAK[i], q));
      k = 1 + 0.3 * q;
    } else {
      const q = Math.min(1, (u - UP) / UDECAY);
      const qc = P2O(q);
      c = PEAK.map((v, i) => lerp(v, d.col[i], qc));
      k = 1 + 0.3 * (1 - q) * (1 - q) * Math.cos(Math.PI * 1.5 * q);
      ring = q < 1 ? q : 0;
    }
    const r = lerp(R0, d.r, e) * k;
    d.el.setAttribute("cx", fx(mx));
    d.el.setAttribute("cy", fx(my));
    d.el.setAttribute("rx", fx(r + len / 2));
    d.el.setAttribute("ry", fx(r));
    d.el.setAttribute("transform", len > 0.05 ? `rotate(${ang.toFixed(2)} ${fx(mx)} ${fx(my)})` : "");
    d.el.setAttribute("fill", `rgb(${c.map(Math.round).join(",")})`);
    // ripple: 1 px teal ring, radius 1 → 2.6 × the dot, opacity 0.55 → 0 (power2.out), only during the decay
    if (ring > 0) {
      const g = P2O(ring);
      d.ring.setAttribute("cx", fx(d.T.x));
      d.ring.setAttribute("cy", fx(d.T.y));
      d.ring.setAttribute("r", fx(d.r * lerp(1.15, 2.6, g)));
      d.ring.setAttribute("stroke-opacity", (0.55 * (1 - g)).toFixed(3));
    } else d.ring.setAttribute("stroke-opacity", "0");
  };
  // one setter drives all 14 (one track): u_i = (t − T0 − rank·1 f) / 14 f; runs on past the flight for the last ping
  const LAST = T0 + 13 * F + FLY * (UP + UDECAY);
  PP.drive(tl, (t) => (t > T0 - F / 2 && measure(), dots).forEach((d) => setDot(d, (t - T0 - d.rank * F) / FLY)), T0, LAST, T0, LAST - T0, "none");
  live = true;

  // the period recoils as it emits (S10's element, animated inside this window only)
  tl.fromTo(period, { scale: 1 }, { scale: 1.32, duration: 2 * F, ease: "power2.out", immediateRender: false }, T0);
  tl.fromTo(period, { scale: 1.32 }, { scale: 1, duration: 9 * F, ease: "back.out(0.8)", immediateRender: false }, T0 + 2 * F);

  // ================================================================== legal line (f1230, on screen 4.0 s)
  const legal = root.querySelector(".s11-legal .pp-ln");
  PP.maskLine(tl, legal, T0, { dur: 10 * F, ease: "power4.out" });

  // ================================================================== CTA: masked label swap + FLIP widen (f1236–1246)
  const pill = document.getElementById("pill");
  let sheenAt = null;
  if (!pill) console.warn("[S11] #pill missing: the CTA swap is skipped");
  else {
    const PILL = { cx: 960, cy: 760, w0: 520, w1: 680, h: 84 }; // S10's OUT state (SCENES §S10) → final
    const old = pill.querySelector(".s9-pill-label");
    // widen by box size (no scale: the stroke and the text stay crisp). Own proxy, no build-time write (S09/S10 own
    // the pill's box before f1236).
    const wide = (u) => {
      const w = lerp(PILL.w0, PILL.w1, u);
      pill.style.left = fx(PILL.cx - w / 2) + "px";
      pill.style.width = fx(w) + "px";
    };
    let cur = 0;
    const proxy = { v(x) { if (x === undefined) return cur; cur = x; wide(x); } };
    tl.fromTo(proxy, { v: 0 }, { v: 1, duration: 10 * F, ease: "expo.inOut", immediateRender: false }, T_CTA);

    // The swap needs its own mask: #pill's overflow:hidden does not clip S09's label (a blockified flex item with a 3D
    // transform: it rose out over the pill's top edge, f1238–1240). So S11 swaps against its own window, an absolute
    // inset-0 box with the pill's radius, holding a copy of the old label (same flex centring, inherits the pill's
    // Inter 500 40 px) and the CTA. At f1236 the copy replaces the original pixel for pixel.
    const win = PP.el("div", "s11-win", pill);
    win.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;overflow:hidden;pointer-events:none;" +
      "display:flex;align-items:center;justify-content:center";
    const oldCopy = PP.el("span", "s11-old", win, { text: old ? old.textContent : "purepeptide.care" });
    oldCopy.style.display = "block";
    tl.set(win, { opacity: 0 }, 0);
    tl.set(win, { opacity: 1 }, T_CTA);
    if (old) {
      tl.set(old, { opacity: 1 }, 0);
      tl.set(old, { opacity: 0 }, T_CTA);
    }
    // old label out: up and fully through the mask (descenders included), 4 f power3.in (f1236–1240), then gone
    tl.set(oldCopy, { y: 0, opacity: 1 }, 0);
    tl.fromTo(oldCopy, { y: 0 }, { y: -84, duration: 4 * F, ease: "power3.in", immediateRender: false }, T_CTA);
    tl.set(oldCopy, { opacity: 0 }, T_CTA + 4 * F);

    const cta = PP.el("div", "s11-cta", win);
    cta.style.cssText =
      "position:absolute;left:50%;top:0;width:900px;margin-left:-450px;height:100%;display:flex;align-items:center;justify-content:center;" +
      "font-family:var(--body);font-weight:600;font-size:38px;letter-spacing:-0.005em;color:#F3F6FA;white-space:pre;" +
      "-webkit-font-smoothing:antialiased;pointer-events:none";
    const a = PP.el("span", "", cta, { text: "Shop now" });
    const b = PP.el("span", "", cta, { text: " · purepeptide.care" });
    [a, b].forEach((s) => (s.style.display = "inline-block"));
    // in from below once the widen is past its midpoint (expo.inOut: 540 px at f1240, 600 at f1241, 680 by f1244), so the
    // 523 px label never rises through the pill's rounded ends while the box is still 520: f1240 / f1241, 6 f power4.out,
    // seated by f1246 / f1247.
    tl.set([a, b], { y: 64 }, 0);
    tl.fromTo(a, { y: 64 }, { y: 0, duration: 6 * F, ease: "power4.out", immediateRender: false }, T_CTA + 4 * F);
    tl.fromTo(b, { y: 64 }, { y: 0, duration: 6 * F, ease: "power4.out", immediateRender: false }, T_CTA + 5 * F);

    // sheen on L17 'purepeptide' (105° band, 30 %, xPercent −120→120 over 30 f)
    sheenAt = snapF(PP.clamp(VO.w("L17", "purepeptide"), T_CTA + 10 * F, T0 + 60 * F, "S11 pill sheen"));
    const sheen = PP.el("div", "s11-sheen", win); // clipped by S11's window (the pill itself is never set to overflow)
    sheen.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;" +
      "background:linear-gradient(105deg,rgba(255,255,255,0) 32%,rgba(255,255,255,.30) 50%,rgba(255,255,255,0) 68%)";
    tl.set(sheen, { opacity: 0, xPercent: -120 }, 0);
    tl.set(sheen, { opacity: 1 }, sheenAt);
    tl.fromTo(sheen, { xPercent: -120 }, { xPercent: 120, duration: 30 * F, ease: "power1.inOut", immediateRender: false }, sheenAt);
    tl.set(sheen, { opacity: 0 }, sheenAt + 30 * F);
  }

  PP.S11 = {
    period: P0, periodR: R0,
    times: { logo: T0, dotsLand: dots.map((d) => T0 + d.rank * F + FLY), dotsPing: dots.map((d) => T0 + d.rank * F + UP * FLY), strokes: [T_STROKE, T_STROKE + 12 * F], cta: T_CTA, sheen: sheenAt },
  };
});
