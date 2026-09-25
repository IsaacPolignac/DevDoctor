// s3 — PROOF (clip 17.00 → 30.20). Hero vial reveal · independent lab · right product ✓ · purity · 99 % MINIMUM ·
// « ne nous croyez pas sur parole ». All times absolute (s). Content gone by 29.70 (hard cut to black).
PP.scene("s3", function (tl, root, cam) {
  const F = PP.F;
  const T = { A: 17.0, B: 20.0, C: 23.5, D: 27.0, END: 29.7 };
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
  const fit = (el, size, maxW) => {
    el.style.fontSize = size + "px";
    const w = el.getBoundingClientRect().width;
    if (w > maxW) el.style.fontSize = Math.floor((size * maxW) / w) + "px";
    return el;
  };
  const masked = (el, src) => {
    el.style.webkitMaskImage = el.style.maskImage = `url("${src}")`;
  };
  const pulse = (el, t, from, to, d) => tl.fromTo(el, { opacity: from }, { opacity: to, duration: d || 0.42, ease: "power2.out", immediateRender: false }, t);

  // ================================================================== A · hero vial (17.00 → 20.00)
  const A = grp("s3-a");
  PP.el("div", "s3-a-bg", A.c);
  const back = PP.el("div", "s3-back", A.c); // parallax layer (beams)
  back.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;";
  const beamL = PP.el("div", "s3-beam", back);
  beamL.style.left = 960 - 260 - 170 + "px";
  gsap.set(beamL, { rotation: -14 });
  const beamR = PP.el("div", "s3-beam", back);
  beamR.style.left = 960 - 260 + 170 + "px";
  gsap.set(beamR, { rotation: 14 });
  PP.el("div", "s3-floor", A.c);

  const H = 760;
  const W = H * PP.HERO_RATIO;
  const rig = PP.el("div", "s3-rig", A.c);
  rig.style.cssText += `left:${960 - W / 2}px;top:${560 - H / 2}px;width:${W}px;height:${H}px;`;
  const glow = PP.el("div", "s3-glow", rig);
  glow.style.cssText += `left:${W / 2 - 520}px;top:${H / 2 - 520}px;width:1040px;height:1040px;background:radial-gradient(circle at 50% 50%, rgba(46,230,201,0.30) 0%, rgba(56,189,248,0.14) 30%, rgba(56,189,248,0) 62%);`;
  const vb = 0.9935 * H; // vial bottom (png row 1526 / 1536)
  const contact = PP.el("div", "s3-contact", rig);
  contact.style.cssText += `left:${W / 2 - 330}px;top:${vb - 50}px;width:660px;height:100px;`;
  const refl = PP.el("div", "s3-refl", rig);
  refl.style.cssText += `top:${2 * vb - H}px;width:${W}px;height:${H}px;transform-origin:50% 50%;`;
  PP.el("img", "", refl, { src: HERO, alt: "" });
  const rim = PP.el("div", "s3-rim", rig);
  rim.style.width = W + "px";
  rim.style.height = H + "px";
  const rimL = PP.el("div", "", rim);
  rimL.style.background = "#2ee6c9";
  masked(rimL, HERO);
  gsap.set(rimL, { x: -12, scaleY: 1.01 });
  const rimR = PP.el("div", "", rim);
  rimR.style.background = "#5aa8ff";
  masked(rimR, HERO);
  gsap.set(rimR, { x: 12, scaleY: 1.01 });
  PP.heroVial(rig, H);
  const sweep = PP.el("div", "s3-sweep", rig);
  masked(sweep, HERO);
  const sweepAt = (a, b, ease) => PP.drive(tl, (p) => (sweep.style.backgroundPosition = `${(p * 100).toFixed(2)}% 0`), 1, 0, a, b - a, ease || "power2.inOut");
  sweep.style.backgroundPosition = "100% 0";

  // camera: flash reveal → ease back, vial slides to the left third, slow orbit-like drift
  tl.fromTo(A.c, { scale: 1.035 }, { scale: 1, duration: 0.7, ease: "power3.out", immediateRender: false }, T.A);
  tl.fromTo(A.c, { scale: 1 }, { scale: 1.035, duration: T.B - 17.7, ease: "none", immediateRender: false }, 17.7);
  gsap.set(rig, { rotation: -1.2 });
  tl.fromTo(rig, { x: 0, scale: 1, rotation: -1.2 }, { x: -360, scale: 0.9, rotation: 0.4, duration: 0.66, ease: "power3.inOut", immediateRender: false }, 17.12);
  tl.fromTo(rig, { x: -360, scale: 0.9, rotation: 0.4 }, { x: -384, scale: 0.935, rotation: 1.4, duration: T.B - 17.78, ease: "none", immediateRender: false }, 17.78);
  tl.fromTo(back, { x: 0 }, { x: -250, duration: 0.66, ease: "power3.inOut", immediateRender: false }, 17.12);
  tl.fromTo(back, { x: -250 }, { x: -230, duration: T.B - 17.78, ease: "none", immediateRender: false }, 17.78);
  tl.fromTo(glow, { x: 30, scale: 1.1 }, { x: -40, scale: 1, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(rim, { opacity: 1 }, { opacity: 0.75, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(rimL, { x: -16 }, { x: -8, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  tl.fromTo(rimR, { x: 8 }, { x: 16, duration: T.B - T.A, ease: "none", immediateRender: false }, T.A);
  // light: flash residue, beat pulses (drop at 17.00, beats every 0.5 s), sweeps
  gsap.set(glow, { opacity: 1 });
  pulse(glow, T.A, 1, 0.7, 0.6);
  [17.5, 18.0, 18.5, 19.0, 19.5].forEach((b) => pulse(glow, b, b === 19.0 ? 1 : 0.95, 0.7));
  sweepAt(17.0, 17.62);
  sweepAt(18.86, 19.42);

  // type (right side) — words on Paul K's onsets
  const colA = PP.el("div", "s3-a-type", A.c);
  const l1 = PP.headline(colA, ["Chaque lot"], "mf");
  const l2 = PP.headline(colA, ["part dans un"], "mf s3-sm");
  const l3 = PP.headline(colA, ["laboratoire"], "mf");
  const l4 = PP.headline(colA, ["*indépendant.*"], "mf");
  fit(l1.el, 170, 760);
  fit(l2.el, 78, 760);
  fit(l3.el, 190, 770);
  fit(l4.el, 190, 770);
  const badge = PP.el("div", "s3-badge", colA);
  const pill = PP.el("div", "s3-badge-pill", badge);
  const bic = PP.checkIcon(pill, 48, PP.C.neon);
  PP.el("span", "", pill, { text: "Indépendant" });
  PP.el("div", "s3-badge-lab", badge, { text: PP.cfg.lab });

  slam(l1.words[0], 17.33, { s: 1.25 }); // Chaque
  slam(l1.words[1], 17.56, { s: 1.25 }); // lot
  PP.wordIn(tl, l2.words[0], 17.7); // part
  PP.wordIn(tl, l2.words[1], 17.95); // dans
  PP.wordIn(tl, l2.words[2], 18.15); // un
  slam(l3.words[0], 18.38, { s: 1.18 }); // laboratoire
  slam(l4.words[0], 18.94, { s: 1.35, blur: 14 }); // indépendant.
  PP.popIn(tl, badge, 18.94 - F, { from: 0.7, dur: 0.5 });
  PP.draw(tl, bic.tick, 19.0, 0.28);
  tl.fromTo(colA, { x: 0 }, { x: -26, duration: T.B - 17.3, ease: "none", immediateRender: false }, 17.3);
  vis(A.g, T.A, T.B);

  // ================================================================== B · verification card (20.00 → 23.50)
  const B = grp("s3-b");
  PP.el("div", "s3-b-bg", B.c);
  PP.el("div", "s3-b-grid", B.c);
  const h8 = PP.voHeadline(tl, B.c, "L8", ["On vérifie que c’est le *bon* *produit.*"], "s3-b-h", { lead: 0.06 });
  const h9 = PP.voHeadline(tl, B.c, "L9", ["On mesure sa *pureté.*"], "s3-b-h", { lead: 0.06 });
  PP.textOut(tl, h8.el, 21.9, { dur: 0.12 });
  const persp = PP.el("div", "s3-persp", B.c);
  const card = PP.neonCard(persp, { x: 960, y: 640, w: 960, h: 420, radius: 30 });
  card.el.classList.add("s3-card");
  const well = PP.el("div", "s3-well", card.body);
  const cv = PP.vial(well, PP.cfg.catalog[0].img, 330);
  cv.el.style.left = 136 - cv.width / 2 + "px";
  cv.el.style.top = "22px";
  const scan = PP.el("div", "s3-scan", well);
  PP.highlightBar(tl, card.body, 322, 614, [{ y: 60, h: 128 }, { y: 214, h: 150 }], [20.26, 22.08]);
  const mkRow = (y, label, withBar) => {
    const row = PP.el("div", "s3-row", card.body);
    row.style.top = y + "px";
    const ic = PP.el("div", "s3-ic", row);
    const off = PP.checkIcon(ic, 60, "rgba(255,255,255,0.22)");
    off.tick.style.opacity = "0";
    const on = PP.checkIcon(ic, 60, PP.C.neon);
    const col = PP.el("div", "s3-col", row);
    const lbl = PP.el("div", "s3-lbl", col, { text: label });
    let fill = null;
    if (withBar) fill = PP.el("div", "s3-bar-fill", PP.el("div", "s3-bar", col));
    return { row, on, lbl, fill };
  };
  const r1 = mkRow(60 + 64 - 30, "Le bon produit");
  const r2 = mkRow(214 + 20, "Pureté mesurée", true);
  const lightRow = (r, t) => {
    tl.fromTo(r.on.svg, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, t - F);
    PP.draw(tl, r.on.tick, t - F, 0.22, { ease: "power2.out" });
    tl.fromTo(r.lbl, { color: "#93A1B8" }, { color: "#F3F6FA", duration: 0.15, ease: "none" }, t - F);
  };
  lightRow(r1, 21.07);
  tl.fromTo(r2.lbl, { color: "#93A1B8" }, { color: "#93A1B8", duration: 0.01, ease: "none" }, 20.0);
  tl.fromTo(r2.fill, { scaleX: 0 }, { scaleX: 1, duration: 22.55 - 22.1, ease: "power2.inOut" }, 22.1);
  lightRow(r2, 22.55);
  // scan line over the vial (checks) — two passes
  const scanPass = (a, b) => {
    tl.fromTo(scan, { top: 40, opacity: 1 }, { top: 372, duration: b - a, ease: "power1.inOut", immediateRender: false }, a);
    tl.fromTo(scan, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "none", immediateRender: false }, b);
  };
  gsap.set(scan, { opacity: 0, top: 40 });
  scanPass(20.3, 21.07);
  scanPass(22.1, 22.55);
  // camera: cut in on 20.00 with a 3D settle, then a slow orbit
  tl.fromTo(card.el, { rotationY: -30, rotationX: 12, scale: 1.1, z: 0 }, { rotationY: -13, rotationX: 7, scale: 1, duration: 0.8, ease: "expo.out", immediateRender: false }, T.B);
  tl.fromTo(card.el, { rotationY: -13, rotationX: 7 }, { rotationY: 7, rotationX: 4, duration: T.C - 20.8, ease: "sine.inOut", immediateRender: false }, 20.8);
  tl.fromTo(B.c, { scale: 1 }, { scale: 1.04, duration: T.C - T.B, ease: "none", immediateRender: false }, T.B);
  tl.fromTo(cv.el, { y: 6 }, { y: -6, duration: T.C - T.B, ease: "sine.inOut", immediateRender: false }, T.B);
  vis(B.g, T.B, T.C);

  // ================================================================== C · 99 % MINIMUM (23.50 → 27.00)
  const Cg = grp("s3-c");
  const cGlow = PP.el("div", "s3-c-glow", Cg.c);
  const shake = PP.el("div", "", Cg.c);
  shake.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;";
  const NUM_TOP = 90;
  const num = PP.el("div", "s3-num", shake);
  num.style.top = NUM_TOP + "px";
  PP.rollCounter(tl, num, PP.cfg.minPurity + "%", 23.62, 23.92, { stagger: 0.08, ease: "power3.out" }); // last digit lands 24.00
  const NUM_CY = NUM_TOP + 250; // centre of the 500 px digit box
  tl.fromTo(num, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, 23.56);
  PP.flashRing(tl, PP.layers.fx, 24.0, { x: 960, y: NUM_CY });
  const minEl = PP.headline(shake, ["minimum."], "mf s3-min");
  minEl.el.style.top = "640px";
  slam(minEl.words[0], 24.48, { s: 1.6, blur: 16, d: 0.3 });
  const cap = PP.headline(shake, ["de pureté, mesurée par le laboratoire"], "s3-cap");
  cap.el.className = "s3-cap";
  cap.el.style.top = "846px";
  PP.wordsIn(tl, cap.words, 24.88, { stagger: 0.045 });
  // punch + 3-frame shake on the landing
  const SH = [[0, 0], [16, -10], [-12, 8], [6, -4], [0, 0]];
  PP.drive(tl, (v) => {
    const k = Math.min(SH.length - 1, Math.max(0, Math.floor(v + 1e-6)));
    shake.style.transform = `translate(${SH[k][0]}px, ${SH[k][1]}px)`;
  }, 0, 4, 24.0 - 0.001, 3 * F + 0.001, "none");
  shake.style.transform = "translate(0px, 0px)";
  PP.drive(tl, (v) => {
    const k = v >= 1 ? 0 : v;
    shake.style.transform = k ? `translate(${k * 10}px, ${-k * 6}px)` : "translate(0px, 0px)";
  }, 0, 1, 24.48, 2 * F, "none");
  tl.fromTo(Cg.c, { scale: 1.03 }, { scale: 1, duration: 0.5, ease: "none", immediateRender: false }, T.C);
  tl.fromTo(Cg.c, { scale: 1.09 }, { scale: 1, duration: 0.4, ease: "expo.out", immediateRender: false }, 24.0);
  tl.fromTo(Cg.c, { scale: 1 }, { scale: 1.045, duration: 26.9 - 24.4, ease: "none", immediateRender: false }, 24.4);
  gsap.set(cGlow, { opacity: 0.35 });
  tl.fromTo(cGlow, { opacity: 0.35, scale: 0.8 }, { opacity: 1.0, scale: 1.1, duration: 3 * F, ease: "none", immediateRender: false }, 24.0 - 3 * F);
  tl.fromTo(cGlow, { opacity: 1.0, scale: 1.1 }, { opacity: 0.6, scale: 1, duration: 0.6, ease: "power2.out", immediateRender: false }, 24.0);
  [24.5, 25.0, 25.5, 26.0, 26.5].forEach((b) => pulse(cGlow, b, 0.78, 0.6));
  // whip out on the 26.95 whoosh
  tl.fromTo(Cg.c, { x: 0, filter: "blur(0px)" }, { x: -720, filter: "blur(26px)", duration: 0.1, ease: "power2.in", immediateRender: false }, 26.9);
  vis(Cg.g, T.C, T.D);

  // ================================================================== D · « ne nous croyez pas sur parole » (27.00 → 29.70)
  const D = grp("s3-d");
  PP.el("div", "s3-d-bg", D.c);
  const colD = PP.el("div", "s3-d-type", D.c);
  const d1 = PP.headline(colD, ["Et surtout…"], "mf s3-d1");
  const d2 = PP.headline(colD, ["ne nous croyez pas"], "mf s3-d2");
  const d3 = PP.headline(colD, ["sur *parole.*"], "mf s3-d3");
  fit(d1.el, 120, 1500);
  fit(d2.el, 210, 1540);
  fit(d3.el, 330, 1540);
  d2.el.style.marginTop = "18px";
  d3.el.style.marginTop = "14px";
  PP.wordIn(tl, d1.words[0], 27.0, { rise: 20 });
  PP.wordIn(tl, d1.words[1], 27.06, { rise: 20 });
  slam(d2.words[0], 27.54, { s: 1.15, blur: 8 });
  slam(d2.words[1], 28.08, { s: 1.15, blur: 8 });
  slam(d2.words[2], 28.22, { s: 1.15, blur: 8 });
  slam(d2.words[3], 28.48, { s: 1.15, blur: 8 });
  slam(d3.words[0], 28.7, { s: 1.2, blur: 8 });
  slam(d3.words[1], 28.88, { s: 1.5, blur: 18, d: 0.4 });
  tl.set(colD, { transformOrigin: "0px 540px" }, 0);
  tl.fromTo(colD, { scale: 1 }, { scale: 1.05, duration: T.END - T.D, ease: "none", immediateRender: false }, T.D);
  tl.fromTo(D.c, { scale: 1.035 }, { scale: 1, duration: 0.3, ease: "expo.out", immediateRender: false }, 28.88);
  vis(D.g, T.D, T.END);

  // hard cut to black 29.70 (s4o slams « TESTEZ. » at 29.93)
  const cover = PP.el("div", "s3-cover", root);
  tl.fromTo(cover, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, T.END - 0.002);
});
