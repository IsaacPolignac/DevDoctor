// s3 — PROOF (clip 17.00 → 31.50), ENGLISH cut. Dyson grammar: one title + one proof per shot, cuts on the beats.
//   A 17.00 hero vial (flash reveal) → « EVERY BATCH / SENT TO AN / INDEPENDENT LAB. » + lab badge (pop 18.55)
//   B 20.00 analysis card: Identity ✓ (tick 20.48) · Purity bar + ✓ (tick 22.23) · titles on the VO onsets
//   C 23.50 giant 99% roll, lands 24.00 (ring + punch) · « MINIMUM. » 24.29 · « Purity, every batch »
//   D 26.00 cold chain: « SHIPPED COLD » (pop 26.24) · « 24 H » (pop 26.96) · catalog vial in cold light, frosted glass
//   E 28.75 whoosh → black: « DON’T TAKE / OUR WORD / FOR IT. » on the onsets
//   G 30.60 hard cut: « CHECK IT YOURSELF. » slam, push, gone by 31.39 (s4 window flies in on the 31.40 whoosh)
// All times absolute (s).
PP.scene("s3", function (tl, root, cam) {
  const F = PP.F;
  const T = { A: 17.0, B: 20.0, C: 23.5, D: 26.0, E: 28.75, G: 30.6, OUT: 31.39 };
  const HERO = PP.cfg.heroVial;

  // ------------------------------------------------------------------ helpers (scene-local)
  const grp = (cls) => {
    const g = PP.el("div", "s3-g " + (cls || ""), cam);
    const c = PP.el("div", "s3-cam", g);
    return { g, c };
  };
  // hard cut: visible on [on, off) — switch 2 ms before the frame so frame `on` already shows it
  const vis = (el, on, off) => {
    if (on > T.A) {
      gsap.set(el, { autoAlpha: 0 });
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.001, ease: "none", immediateRender: false }, on - 0.002);
    }
    if (off) tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.001, ease: "none", immediateRender: false }, off - 0.002);
  };
  // manifesto slam: big → settle, lands at `t`
  const slam = (w, t, o) => {
    o = o || {};
    tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none" }, t - F);
    tl.fromTo(w, { scale: o.s || 1.3, filter: `blur(${o.blur == null ? 10 : o.blur}px)` }, { scale: 1, filter: "blur(0px)", duration: o.d || 0.34, ease: "expo.out" }, t - F);
  };
  // Anton line width, measured on a canvas (the clip may be display:none at build time)
  const ctx = document.createElement("canvas").getContext("2d");
  const antonW = (txt, size) => {
    ctx.font = `400 ${size}px Anton`;
    return ctx.measureText(txt.toUpperCase()).width + size * (0.005 * txt.length + 0.03);
  };
  // fit an Anton line to maxW (shrink only unless `grow`), capped at `size`
  const fit = (el, size, maxW, grow) => {
    const w = antonW(el.textContent, size);
    el.style.fontSize = (w > maxW || grow ? Math.min(size, Math.floor((size * maxW) / w)) : size) + "px";
    return el;
  };
  const masked = (el, src) => {
    el.style.webkitMaskImage = el.style.maskImage = `url("${src}")`;
  };
  const pulse = (el, t, from, to, d) => tl.fromTo(el, { opacity: from }, { opacity: to, duration: d || 0.42, ease: "power2.out", immediateRender: false }, t);
  // 3-frame camera shake on an impact (+ settle)
  const SH = [[0, 0], [16, -10], [-12, 8], [6, -4], [0, 0]];
  const shakeAt = (el, t, k) => {
    k = k || 1;
    PP.drive(tl, (v) => {
      const i = Math.min(SH.length - 1, Math.max(0, Math.floor(v + 1e-6)));
      el.style.transform = `translate(${SH[i][0] * k}px, ${SH[i][1] * k}px)`;
    }, 0, 4, t - 0.001, 3 * F + 0.001, "none");
    el.style.transform = "translate(0px, 0px)";
  };
  // lit vial rig: floor contact glow, reflection, masked rim lights, the product render, a masked light sweep
  const vialRig = (parent, src, W, H, o) => {
    const rig = PP.el("div", "s3-rig", parent);
    rig.style.cssText += `left:${o.x - W / 2}px;top:${o.y - H / 2}px;width:${W}px;height:${H}px;`;
    const vb = (o.bottom || 1) * H;
    const contact = PP.el("div", "s3-contact " + (o.cold ? "cold" : ""), rig);
    contact.style.cssText += `left:${W / 2 - W * 0.65}px;top:${vb - 50}px;width:${W * 1.3}px;height:100px;`;
    const refl = PP.el("div", "s3-refl", rig);
    refl.style.cssText += `top:${2 * vb - H}px;width:${W}px;height:${H}px;`;
    PP.el("img", "", refl, { src, alt: "" });
    const rim = PP.el("div", "s3-rim", rig);
    rim.style.width = W + "px";
    rim.style.height = H + "px";
    const rimL = PP.el("div", "", rim);
    rimL.style.background = o.cold ? "#bfe6ff" : "#2ee6c9";
    masked(rimL, src);
    const rimR = PP.el("div", "", rim);
    rimR.style.background = "#5aa8ff";
    masked(rimR, src);
    const img = o.hero ? PP.heroVial(rig, H) : PP.vial(rig, src, H);
    const sweep = PP.el("div", "s3-sweep", rig);
    masked(sweep, src);
    sweep.style.backgroundPosition = "100% 0";
    const sweepAt = (a, b, ease) => PP.drive(tl, (p) => (sweep.style.backgroundPosition = `${(p * 100).toFixed(2)}% 0`), 1, 0, a, b - a, ease || "power2.inOut");
    return { rig, rim, rimL, rimR, img, sweep, sweepAt, contact };
  };

  // ================================================================== A · hero vial + independent lab (17.00 → 20.00)
  const A = grp("s3-a");
  PP.el("div", "s3-a-bg", A.c);
  const back = PP.el("div", "s3-back", A.c); // parallax layer (beams)
  const beamL = PP.el("div", "s3-beam", back);
  beamL.style.left = 960 - 260 - 170 + "px";
  gsap.set(beamL, { rotation: -14 });
  const beamR = PP.el("div", "s3-beam", back);
  beamR.style.left = 960 - 260 + 170 + "px";
  gsap.set(beamR, { rotation: 14 });
  PP.el("div", "s3-floor", A.c);

  const PAN = 380; // world pan (px): vial ends centred at x 580, type column at x 930
  const pan = PP.el("div", "s3-pan", A.c);
  const H = 760;
  const W = H * PP.HERO_RATIO;
  const glow = PP.el("div", "s3-glow", pan);
  glow.style.cssText += `left:${960 - 520}px;top:${560 - 520}px;width:1040px;height:1040px;background:radial-gradient(circle at 50% 50%, rgba(46,230,201,0.30) 0%, rgba(56,189,248,0.14) 30%, rgba(56,189,248,0) 62%);`;
  const hv = vialRig(pan, HERO, W, H, { x: 960, y: 560, bottom: 0.9935, hero: true }); // png row 1526 / 1536
  gsap.set(hv.rimL, { x: -12, scaleY: 1.01 });
  gsap.set(hv.rimR, { x: 12, scaleY: 1.01 });

  // camera: flash reveal → ease back; the world pans right (vial to the left third, type enters), slow drift
  tl.fromTo(A.c, { scale: 1.035 }, { scale: 1, duration: 0.7, ease: "power3.out", immediateRender: false }, T.A);
  tl.fromTo(A.c, { scale: 1 }, { scale: 1.035, duration: T.B - 17.7, ease: "none", immediateRender: false }, 17.7);
  tl.fromTo(pan, { x: 0 }, { x: -PAN, duration: 0.7, ease: "power2.inOut", immediateRender: false }, 17.06);
  tl.fromTo(pan, { x: -PAN }, { x: -PAN - 22, duration: T.B - 17.76, ease: "none", immediateRender: false }, 17.76);
  gsap.set(hv.rig, { rotation: -1.2 });
  tl.fromTo(hv.rig, { scale: 1, rotation: -1.2 }, { scale: 0.9, rotation: 0.4, duration: 0.7, ease: "power2.inOut", immediateRender: false }, 17.06);
  tl.fromTo(hv.rig, { scale: 0.9, rotation: 0.4 }, { scale: 0.935, rotation: 1.4, duration: T.B - 17.76, ease: "none", immediateRender: false }, 17.76);
  tl.fromTo(back, { x: 0 }, { x: -250, duration: 0.7, ease: "power2.inOut", immediateRender: false }, 17.06);
  tl.fromTo(back, { x: -250 }, { x: -232, duration: T.B - 17.76, ease: "none", immediateRender: false }, 17.76);
  tl.fromTo(glow, { x: 30, scale: 1.1 }, { x: -40, scale: 1, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(hv.rim, { opacity: 1 }, { opacity: 0.75, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(hv.rimL, { x: -16 }, { x: -8, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(hv.rimR, { x: 8 }, { x: 16, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  // light: flash residue, beat pulses (drop at 17.00, beats every 0.5 s), sweeps
  gsap.set(glow, { opacity: 1 });
  pulse(glow, T.A, 1, 0.7, 0.6);
  [17.5, 18.0, 18.5, 19.0, 19.5].forEach((b) => pulse(glow, b, b === 18.5 ? 1 : 0.95, 0.7));
  hv.sweepAt(17.0, 17.62);
  hv.sweepAt(18.62, 19.2);

  // type column (in the panned world) — words on the VO onsets
  const COLW = 880;
  const colA = PP.el("div", "s3-a-type", pan);
  colA.style.left = 930 + PAN + "px";
  colA.style.width = COLW + "px";
  const l1 = PP.headline(colA, ["Every batch"], "mf s3-a1");
  const l2 = PP.headline(colA, ["sent to an"], "mf s3-sm");
  const l3 = PP.headline(colA, ["*independent* *lab.*"], "mf s3-a3");
  const bigA = Math.min(parseFloat(fit(l3.el, 150, COLW).style.fontSize), 150);
  l1.el.style.fontSize = bigA + "px";
  l2.el.style.fontSize = Math.round(bigA * 0.5) + "px";
  const badge = PP.el("div", "s3-badge", colA);
  const bpill = PP.el("div", "s3-badge-pill", badge);
  PP.el("span", "", bpill, { text: "Independent lab" });
  const bic = PP.checkIcon(bpill, 46, PP.C.neon);
  PP.el("div", "s3-badge-lab", badge, { text: PP.cfg.lab });

  slam(l1.words[0], 17.3, { s: 1.25 }); // Every
  slam(l1.words[1], 17.45, { s: 1.25 }); // batch,
  PP.wordIn(tl, l2.words[0], 17.7); // sent
  PP.wordIn(tl, l2.words[1], 18.2); // to
  PP.wordIn(tl, l2.words[2], 18.4); // an
  slam(l3.words[0], 18.55, { s: 1.3, blur: 14 }); // independent
  slam(l3.words[1], 18.81, { s: 1.35, blur: 14 }); // lab.
  PP.popIn(tl, badge, 18.55 - F, { from: 0.7, dur: 0.5 }); // pop sfx 18.55
  PP.draw(tl, bic.tick, 18.62, 0.28);
  tl.fromTo(colA, { x: 0 }, { x: -24, duration: T.B - 17.3, ease: "none", immediateRender: false }, 17.3);
  vis(A.g, T.A, T.B);

  // ================================================================== B · analysis card (20.00 → 23.50)
  const B = grp("s3-b");
  PP.el("div", "s3-b-bg", B.c);
  PP.el("div", "s3-b-grid", B.c);
  const ttl = PP.el("div", "s3-b-title", B.c);
  const hId = PP.headline(ttl, ["Identity, *confirmed.*"], "mf s3-b-h");
  const hPu = PP.headline(ttl, ["Purity, *measured.*"], "mf s3-b-h");
  fit(hId.el, 132, 1500);
  fit(hPu.el, 132, 1500);
  PP.wordIn(tl, hId.words[0], 19.95, { rise: 22 }); // Identity, 20.00 (on the cut)
  slam(hId.words[1], 20.48, { s: 1.22, blur: 10 }); // confirmed. (tick)
  tl.fromTo(hId.el, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -70, opacity: 0, filter: "blur(8px)", duration: 0.16, ease: "power2.in", immediateRender: false }, 21.84);
  PP.wordIn(tl, hPu.words[0], 21.96, { rise: 40, dur: 0.45 }); // Purity, 22.00
  slam(hPu.words[1], 22.23, { s: 1.22, blur: 10 }); // measured. (tick)

  const persp = PP.el("div", "s3-persp", B.c);
  const CW = 1080;
  const card = PP.neonCard(persp, { x: 960, y: 650, w: CW, h: 460, radius: 32 });
  card.el.classList.add("s3-card");
  const well = PP.el("div", "s3-well", card.body);
  const cv = PP.vial(well, PP.cfg.catalog[0].img, 360);
  cv.el.style.left = 136 - cv.width / 2 + "px";
  cv.el.style.top = "22px";
  const scan = PP.el("div", "s3-scan", well);
  PP.highlightBar(tl, card.body, 322, CW - 322 - 24, [{ y: 64, h: 136 }, { y: 232, h: 164 }], [20.2, 21.96]);
  const mkRow = (y, label, status, withBar) => {
    const row = PP.el("div", "s3-row", card.body);
    row.style.top = y + "px";
    row.style.width = CW - 340 - 56 + "px";
    const ic = PP.el("div", "s3-ic", row);
    const off = PP.checkIcon(ic, 60, "rgba(255,255,255,0.22)");
    off.tick.style.opacity = "0";
    const on = PP.checkIcon(ic, 60, PP.C.neon);
    const col = PP.el("div", "s3-col", row);
    const line = PP.el("div", "s3-line", col);
    const lbl = PP.el("div", "s3-lbl", line, { text: label });
    const chip = PP.el("div", "s3-chip", line, { text: status });
    let fill = null;
    if (withBar) fill = PP.el("div", "s3-bar-fill", PP.el("div", "s3-bar", col));
    return { row, on, lbl, chip, fill };
  };
  const r1 = mkRow(100, "Identity", "Confirmed");
  const r2 = mkRow(258, "Purity", "Measured", true);
  const lightRow = (r, t) => {
    tl.fromTo(r.on.svg, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, t - F);
    PP.draw(tl, r.on.tick, t - F, 0.22, { ease: "power2.out" });
    tl.fromTo(r.lbl, { color: "#93A1B8" }, { color: "#F3F6FA", duration: 0.15, ease: "none" }, t - F);
    tl.fromTo(r.chip, { opacity: 0, scale: 0.7, x: -12 }, { opacity: 1, scale: 1, x: 0, duration: 0.4, ease: "back.out(2.2)" }, t - F);
  };
  lightRow(r1, 20.48); // tick sfx
  tl.fromTo(r2.fill, { scaleX: 0 }, { scaleX: 1, duration: 22.23 - 21.78, ease: "power2.inOut" }, 21.78);
  lightRow(r2, 22.23); // tick sfx
  // scan line over the vial (checks) — two passes, each ends on its tick
  const scanPass = (a, b) => {
    tl.fromTo(scan, { top: 40, opacity: 1 }, { top: 410, duration: b - a, ease: "power1.inOut", immediateRender: false }, a);
    tl.fromTo(scan, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "none", immediateRender: false }, b);
  };
  gsap.set(scan, { opacity: 0, top: 40 });
  scanPass(20.04, 20.48);
  scanPass(21.78, 22.23);
  // camera: cut in on 20.00 with a 3D settle, then a slow orbit
  tl.fromTo(card.el, { rotationY: -30, rotationX: 12, scale: 1.1 }, { rotationY: -13, rotationX: 7, scale: 1, duration: 0.8, ease: "expo.out", immediateRender: false }, T.B);
  tl.fromTo(card.el, { rotationY: -13, rotationX: 7 }, { rotationY: 7, rotationX: 4, duration: T.C - 20.8, ease: "sine.inOut", immediateRender: false }, 20.8);
  tl.fromTo(B.c, { scale: 1 }, { scale: 1.04, duration: T.C - T.B, ease: "none", immediateRender: false }, T.B);
  tl.fromTo(cv.el, { y: 6 }, { y: -6, duration: T.C - T.B, ease: "sine.inOut", immediateRender: false }, T.B);
  vis(B.g, T.B, T.C);

  // ================================================================== C · 99% MINIMUM (23.50 → 26.00)
  const Cg = grp("s3-c");
  const cGlow = PP.el("div", "s3-c-glow", Cg.c);
  const shake = PP.el("div", "s3-full", Cg.c);
  const NUM_TOP = 150;
  const num = PP.el("div", "s3-num", shake);
  num.style.top = NUM_TOP + "px";
  PP.rollCounter(tl, num, PP.cfg.minPurity + "%", 23.3, 23.92, { stagger: 0.08, ease: "none" }); // pre-spun (already blurred on the 23.50 cut), constant spin, hard stop: last digit lands 24.00
  const NUM_CY = NUM_TOP + 225; // centre of the 450 px digit box
  tl.fromTo(num, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, T.C - 0.08);
  PP.flashRing(tl, PP.layers.fx, 24.0, { x: 960, y: NUM_CY });
  const minEl = PP.headline(shake, ["minimum."], "mf s3-min");
  minEl.el.style.top = "650px";
  slam(minEl.words[0], 24.29, { s: 1.6, blur: 16, d: 0.3 }); // pop sfx
  const cap = PP.headline(shake, ["Purity, every batch"], "s3-cap");
  cap.el.className = "s3-cap";
  cap.el.style.top = "862px";
  PP.wordsIn(tl, cap.words, 24.8, { stagger: 0.05 });
  shakeAt(shake, 24.0);
  PP.drive(tl, (v) => {
    const k = v >= 1 ? 0 : v;
    shake.style.transform = k ? `translate(${k * 10}px, ${-k * 6}px)` : "translate(0px, 0px)";
  }, 0, 1, 24.29, 2 * F, "none");
  tl.fromTo(Cg.c, { scale: 1.03 }, { scale: 1, duration: 0.5, ease: "none", immediateRender: false }, T.C);
  tl.fromTo(Cg.c, { scale: 1.06 }, { scale: 1, duration: 0.4, ease: "expo.out", immediateRender: false }, 24.0);
  tl.fromTo(Cg.c, { scale: 1 }, { scale: 1.04, duration: T.D - 24.4, ease: "none", immediateRender: false }, 24.4);
  gsap.set(cGlow, { opacity: 0.35 });
  tl.fromTo(cGlow, { opacity: 0.35, scale: 0.8 }, { opacity: 1.0, scale: 1.1, duration: 3 * F, ease: "none", immediateRender: false }, 24.0 - 3 * F);
  tl.fromTo(cGlow, { opacity: 1.0, scale: 1.1 }, { opacity: 0.6, scale: 1, duration: 0.6, ease: "power2.out", immediateRender: false }, 24.0);
  [24.5, 25.0, 25.5].forEach((b) => pulse(cGlow, b, 0.78, 0.6));
  vis(Cg.g, T.C, T.D);

  // ================================================================== D · shipped cold, within 24 h (26.00 → 28.75)
  const D = grp("s3-d");
  PP.el("div", "s3-d-bg", D.c);
  const dBack = PP.el("div", "s3-back", D.c);
  const coldBeams = [1180, 1470].map((x, i) => {
    const b = PP.el("div", "s3-beam cold", dBack);
    b.style.left = x - 260 + "px";
    gsap.set(b, { rotation: i ? 12 : -12 });
    return b;
  });
  PP.el("div", "s3-floor cold", D.c);
  const VX = 1460; // vial centre x
  const coldGlow = PP.el("div", "s3-cold-glow", D.c);
  coldGlow.style.left = VX - 600 + "px";
  // frost crystals: SVG turbulence veins (seeded, static) inside a wrapper whose mask we animate (frost creeps in)
  const frostTex = (parent, w, h, seed, freq, cls) => {
    const id = PP.uid("s3-ff");
    const wrap = PP.el("div", cls, parent);
    wrap.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="5" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.96  0 0 0 0 1  0 0 0 -13 2.9"/><feGaussianBlur stdDeviation="0.6"/></filter><rect width="${w}" height="${h}" filter="url(#${id})"/></svg>`;
    return wrap;
  };
  // frosted glass panel behind the vial
  const frost = PP.el("div", "s3-frost", D.c);
  const FW = 600, FH = 760, FT = 150;
  frost.style.cssText += `left:${VX - FW / 2}px;top:${FT}px;width:${FW}px;height:${FH}px;`;
  const frostEdge = PP.el("div", "s3-frost-edge", frost);
  const crystals = frostTex(frost, FW, FH, 11, 0.042, "s3-frost-tex");
  PP.el("div", "s3-frost-spec", frost);
  const setFrostMask = (p) => {
    const m = `radial-gradient(ellipse 72% 66% at 50% 46%, rgba(0,0,0,0) ${p.toFixed(1)}%, #000 100%)`;
    crystals.style.webkitMaskImage = crystals.style.maskImage = m;
  };
  PP.drive(tl, setFrostMask, 96, 50, 26.2, 0.9, "power2.out");
  const VH = 640;
  const cvD = vialRig(D.c, PP.cfg.catalog[3].img, VH * PP.VIAL_RATIO, VH, { x: VX, y: 905 - VH / 2, cold: true });
  gsap.set(cvD.rimL, { x: -10, scaleY: 1.008 });
  gsap.set(cvD.rimR, { x: 10, scaleY: 1.008 });
  // frost on the vial glass (masked by the render's alpha), rising from the base
  const vFrost = PP.el("div", "s3-vfrost", cvD.rig);
  masked(vFrost, PP.cfg.catalog[3].img);
  const vfIn = frostTex(vFrost, Math.round(VH * PP.VIAL_RATIO), VH, 5, 0.075, "s3-vfrost-in");
  PP.drive(tl, (p) => {
    const m = `linear-gradient(0deg, #000 0%, rgba(0,0,0,0.55) ${(p * 0.45).toFixed(1)}%, rgba(0,0,0,0) ${p.toFixed(1)}%)`;
    vfIn.style.webkitMaskImage = vfIn.style.maskImage = m;
  }, 0, 42, 26.2, 1.0, "power2.out");
  const mist = PP.el("div", "s3-mist", D.c);
  // frost particles (deterministic drift)
  const pLayer = PP.el("div", "s3-parts", D.c);
  const rnd = PP.rng(2609);
  const parts = [];
  for (let i = 0; i < 46; i++) {
    const el = PP.el("div", "s3-part", pLayer);
    const s = 2 + rnd() * 5;
    el.style.width = el.style.height = s.toFixed(1) + "px";
    if (s > 5.2) el.style.filter = "blur(2px)";
    parts.push({ el, x: 900 + rnd() * 1100, y: rnd() * 1080, vy: 30 + rnd() * 60, amp: 10 + rnd() * 26, ph: rnd() * 6.28, a: 0.25 + rnd() * 0.6 });
  }
  PP.drive(tl, (t) => {
    const dt = t - T.D;
    parts.forEach((p) => {
      const y = ((p.y + p.vy * dt) % 1140) - 30;
      const x = p.x + p.amp * Math.sin(p.ph + dt * 1.3);
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      p.el.style.opacity = (p.a * Math.min(1, dt * 4)).toFixed(3);
    });
  }, T.D, T.E, T.D, T.E - T.D, "none");

  // type column (left)
  const colD = PP.el("div", "s3-d-type", D.c);
  const mkTile = (parent) => {
    const tile = PP.el("div", "s3-tile", parent);
    return { tile, svg: PP.svg("svg", { width: 88, height: 88, viewBox: "0 0 44 44", class: "s3-ico" }, tile) };
  };
  const row1 = PP.el("div", "s3-d-row", colD);
  const t1 = mkTile(row1);
  // snowflake (line icon): 6 arms, each with a V branch
  const flake = [];
  const flakeG = PP.svg("g", { class: "s3-flake" }, t1.svg);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const P = (r, da) => [22 + r * Math.cos(a + (da || 0)), 22 + r * Math.sin(a + (da || 0))];
    const tip = P(17.5);
    const m = P(11);
    const bL = [m[0] + 5.2 * Math.cos(a - 0.85), m[1] + 5.2 * Math.sin(a - 0.85)];
    const bR = [m[0] + 5.2 * Math.cos(a + 0.85), m[1] + 5.2 * Math.sin(a + 0.85)];
    const f = (p) => p[0].toFixed(2) + " " + p[1].toFixed(2);
    flake.push(PP.svg("path", { d: `M22 22 L${f(tip)}`, fill: "none", stroke: "#CFEAFF", "stroke-width": 2.4, "stroke-linecap": "round" }, flakeG));
    flake.push(PP.svg("path", { d: `M${f(bL)} L${f(m)} L${f(bR)}`, fill: "none", stroke: "#CFEAFF", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, flakeG));
  }
  const d1 = PP.headline(row1, ["Shipped *cold*"], "mf s3-d1");
  const row2 = PP.el("div", "s3-d-row s3-d-row2", colD);
  const t2 = mkTile(row2);
  const clockC = PP.svg("circle", { cx: 22, cy: 22, r: 17.5, fill: "none", stroke: "#CFEAFF", "stroke-width": 2.4 }, t2.svg);
  const ticks = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2;
    return PP.svg("path", { d: `M${(22 + 13.2 * Math.cos(a)).toFixed(2)} ${(22 + 13.2 * Math.sin(a)).toFixed(2)} L${(22 + 15.2 * Math.cos(a)).toFixed(2)} ${(22 + 15.2 * Math.sin(a)).toFixed(2)}`, fill: "none", stroke: "#CFEAFF", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.8 }, t2.svg);
  });
  const hHour = PP.svg("path", { d: "M22 22 L22 14", fill: "none", stroke: "#CFEAFF", "stroke-width": 2.6, "stroke-linecap": "round" }, t2.svg);
  const hMin = PP.svg("path", { d: "M22 22 L22 9.5", fill: "none", stroke: PP.C.neon, "stroke-width": 2.4, "stroke-linecap": "round" }, t2.svg);
  PP.svg("circle", { cx: 22, cy: 22, r: 1.8, fill: "#CFEAFF" }, t2.svg);
  const d2 = PP.headline(row2, ["within 24 hours"], "mf s3-d2");
  const big = PP.el("div", "s3-d-big", colD);
  const n24 = PP.el("span", "s3-n24", big, { text: "24" });
  const nH = PP.el("span", "s3-nh", big, { text: "H" });
  fit(d1.el, 150, 1020 - 160);
  fit(d2.el, 92, 1020 - 160);

  // choreography (VO: Shipped 26.00 · cold 26.24 · within 26.52 · 24 26.96 · hours 27.36)
  slam(d1.words[0], 26.0, { s: 1.2, blur: 8 }); // Shipped (on the cut)
  slam(d1.words[1], 26.24, { s: 1.4, blur: 14 }); // cold (pop)
  PP.popIn(tl, t1.tile, 26.24 - F, { from: 0.6, dur: 0.5 });
  PP.draw(tl, flake, 26.24, 0.4, { stagger: 0.02, ease: "power2.out" });
  tl.fromTo(flakeG, { rotation: -40, svgOrigin: "22 22" }, { rotation: 0, svgOrigin: "22 22", duration: 0.9, ease: "expo.out" }, 26.24);
  tl.fromTo(flakeG, { rotation: 0, svgOrigin: "22 22" }, { rotation: 18, svgOrigin: "22 22", duration: T.E - 27.14, ease: "none", immediateRender: false }, 27.14);
  PP.wordIn(tl, d2.words[0], 26.49); // within
  PP.wordIn(tl, d2.words[1], 26.93); // 24
  PP.wordIn(tl, d2.words[2], 27.33); // hours
  PP.popIn(tl, t2.tile, 26.96 - F, { from: 0.6, dur: 0.45 }); // clock pops with « 24 H » (pop 26.96)
  PP.draw(tl, clockC, 26.93, 0.4, { ease: "power2.out" });
  tl.fromTo(ticks, { opacity: 0 }, { opacity: 0.8, duration: 0.2, ease: "none", stagger: 0.04 }, 27.05);
  tl.fromTo(hMin, { rotation: 0, svgOrigin: "22 22" }, { rotation: 720, svgOrigin: "22 22", duration: 1.1, ease: "power3.out" }, 26.96);
  tl.fromTo(hHour, { rotation: 0, svgOrigin: "22 22" }, { rotation: 60, svgOrigin: "22 22", duration: 1.1, ease: "power3.out" }, 26.96);
  tl.fromTo(big, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none" }, 26.96 - F); // 24 H (pop)
  tl.fromTo(big, { scale: 0.62, filter: "blur(12px)" }, { scale: 1, filter: "blur(0px)", duration: 0.55, ease: "back.out(1.6)" }, 26.96 - F);
  // cold light: the panel frosts over and the light comes up on « cold »
  gsap.set(frostEdge, { opacity: 0.4 });
  tl.fromTo(frostEdge, { opacity: 0.4 }, { opacity: 1, duration: 0.5, ease: "power2.out", immediateRender: false }, 26.24);
  tl.fromTo(frost, { opacity: 0.55 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, 26.24 - F);
  gsap.set(coldGlow, { opacity: 0.55 });
  tl.fromTo(coldGlow, { opacity: 0.55, scale: 0.9 }, { opacity: 1, scale: 1.05, duration: 0.3, ease: "power2.out", immediateRender: false }, 26.24 - F);
  [26.5, 27.0, 27.5, 28.0, 28.5].forEach((b) => pulse(coldGlow, b, b === 27.0 ? 1 : 0.95, 0.78, 0.45));
  cvD.sweepAt(26.3, 26.95);
  cvD.sweepAt(27.6, 28.2);
  tl.fromTo(cvD.rim, { opacity: 0.5 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 26.24 - F);
  tl.fromTo(mist, { x: -40 }, { x: 40, duration: T.E - T.D, ease: "none", immediateRender: false }, T.D);
  // camera: punch-in settle on the cut, slow push, parallax
  tl.fromTo(D.c, { scale: 1.05 }, { scale: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, T.D);
  tl.fromTo(D.c, { scale: 1 }, { scale: 1.03, duration: T.E - 26.6, ease: "none", immediateRender: false }, 26.6);
  tl.fromTo(cvD.rig, { x: 30 }, { x: -10, duration: T.E - T.D, ease: "none", immediateRender: false }, T.D);
  tl.fromTo([frost, coldGlow], { x: 14 }, { x: -4, duration: T.E - T.D, ease: "none", immediateRender: false }, T.D);
  tl.fromTo(dBack, { x: 0 }, { x: -30, duration: T.E - T.D, ease: "none", immediateRender: false }, T.D);
  tl.fromTo(colD, { x: 0 }, { x: -18, duration: T.E - T.D, ease: "none", immediateRender: false }, T.D);
  // whip out on the 28.75 whoosh
  tl.fromTo(D.c, { x: 0, filter: "blur(0px)" }, { x: -760, filter: "blur(28px)", duration: 0.1, ease: "power2.in", immediateRender: false }, T.E - 0.1);
  vis(D.g, T.D, T.E);

  // ================================================================== E · « Don’t take our word for it. » (28.75 → 30.60)
  const E = grp("s3-e");
  PP.el("div", "s3-e-bg", E.c);
  const colE = PP.el("div", "s3-e-type", E.c);
  const e1 = PP.headline(colE, ["Don’t take"], "mf s3-e1");
  const e2 = PP.headline(colE, ["our word"], "mf s3-e1");
  const e3 = PP.headline(colE, ["for it."], "mf s3-e1");
  [e1, e2, e3].forEach((h) => fit(h.el, 250, 1500));
  // Don’t 28.80 · take 29.05 · our 29.17 · word 29.39 · for 29.59 · it. 29.81
  [[e1, 0, 28.8], [e1, 1, 29.05], [e2, 0, 29.17], [e2, 1, 29.39], [e3, 0, 29.59], [e3, 1, 29.81]].forEach(([h, i, t]) => slam(h.words[i], t, { s: 1.16, blur: 8, d: 0.3 }));
  tl.set(colE, { transformOrigin: "0px 540px" }, 0);
  tl.fromTo(colE, { scale: 1.03, x: 16 }, { scale: 1.07, x: 0, duration: T.G - T.E, ease: "none", immediateRender: false }, T.E);
  tl.fromTo(E.c, { x: 260, filter: "blur(18px)" }, { x: 0, filter: "blur(0px)", duration: 0.2, ease: "power3.out", immediateRender: false }, T.E);
  vis(E.g, T.E, T.G);

  // ================================================================== G · « CHECK IT YOURSELF. » (30.60 → 31.39)
  const G = grp("s3-gs");
  PP.el("div", "s3-e-bg", G.c);
  const gGlow = PP.el("div", "s3-g-glow", G.c);
  const gShake = PP.el("div", "s3-full", G.c);
  const colG = PP.el("div", "s3-g-type", gShake);
  const g1 = PP.headline(colG, ["Check it"], "mf s3-g1");
  const g2 = PP.headline(colG, ["*yourself.*"], "mf s3-g2");
  fit(g1.el, 250, 1700);
  fit(g2.el, 300, 1700);
  slam(colG, T.G, { s: 1.45, blur: 18, d: 0.34 }); // slam sfx 30.60
  shakeAt(gShake, T.G, 1.2);
  gsap.set(gGlow, { opacity: 0 });
  tl.fromTo(gGlow, { opacity: 1, scale: 0.85 }, { opacity: 0.5, scale: 1.05, duration: 0.6, ease: "power2.out", immediateRender: false }, T.G);
  tl.fromTo(G.c, { scale: 1 }, { scale: 1.06, duration: 31.26 - T.G, ease: "none", immediateRender: false }, T.G);
  // exit: zoom-through toward the lens, black by 31.39 (s4 whoosh 31.40)
  tl.fromTo(colG, { opacity: 1 }, { opacity: 0, duration: 31.37 - 31.26, ease: "power2.in", immediateRender: false }, 31.26);
  tl.fromTo(G.c, { scale: 1.06, filter: "blur(0px)" }, { scale: 2.1, filter: "blur(16px)", duration: 31.37 - 31.26, ease: "expo.in", immediateRender: false }, 31.26);
  tl.fromTo(gGlow, { opacity: 0.5 }, { opacity: 0, duration: 0.11, ease: "none", immediateRender: false }, 31.26);
  vis(G.g, T.G, T.OUT);
});
