// s3 (8.00 → 11.80) — « On vérifie que c’est bien le bon produit, et on mesure sa pureté. »
// Revealed under FLASH #1 (8.00, music drop): camera settles 1.12 → 1, the analysis card slams in on 8.0,
// its content on 8.5. Row 1 ✓ lights on « bon » (9.19, tick), row 2 lights on « mesure » (10.33, tick) and its
// bar fills to 10.90. Exit 11.45 → 11.72: the card flies through the camera (push + blur) into s4's giant 99.
PP.scene("s3", function (tl, root, cam) {
  const F = PP.F;
  const T0 = 8.0;
  const EXIT = 11.45;

  // ------------------------------------------------------------ layers
  cam.style.transformOrigin = "540px 1040px";
  const drift = PP.el("div", "s3-drift", cam);
  const back = PP.el("div", "s3-back", drift); // far depth plane (ghost cards, bokeh)
  const glow = PP.el("div", "s3-glow", drift); // neon glow behind the card
  const head = PP.el("div", "s3-head", drift);
  const slam = PP.el("div", "s3-slam", drift); // card entry (y / scale / blur)
  const persp = PP.el("div", "s3-persp", slam); // perspective for the 3D tilt

  // ------------------------------------------------------------ far plane: ghost cards + bokeh (parallax)
  const ghostA = PP.el("div", "s3-ghost", back, { style: "left:-150px;top:640px;width:330px;height:420px" });
  const ghostB = PP.el("div", "s3-ghost", back, { style: "left:880px;top:1180px;width:360px;height:300px" });
  const ghostC = PP.el("div", "s3-ghost", back, { style: "left:760px;top:250px;width:300px;height:190px;opacity:.35" });
  tl.fromTo(ghostA, { y: 60, rotation: -6 }, { y: -40, rotation: -3, duration: 3.8, ease: "none" }, T0);
  tl.fromTo(ghostB, { y: -30, rotation: 5 }, { y: -140, rotation: 2, duration: 3.8, ease: "none" }, T0);
  tl.fromTo(ghostC, { y: 40, x: 0 }, { y: -30, x: -30, duration: 3.8, ease: "none" }, T0);
  const rnd = PP.rng(3031);
  for (let i = 0; i < 16; i++) {
    const s = 6 + rnd() * 16;
    const d = PP.el("div", "s3-bokeh", back);
    d.style.cssText = `left:${(rnd() * 1080).toFixed(0)}px;top:${(300 + rnd() * 1400).toFixed(0)}px;width:${s}px;height:${s}px;opacity:${(0.15 + rnd() * 0.35).toFixed(2)};filter:blur(${(1 + rnd() * 4).toFixed(1)}px)`;
    tl.fromTo(d, { y: 0 }, { y: -(60 + rnd() * 160), duration: 3.8, ease: "none" }, T0);
  }

  // ------------------------------------------------------------ headline (VO L4, words on the voice)
  const h = PP.voHeadline(tl, head, "L4", ["On vérifie que c’est bien", "le *bon* *produit,* et on", "mesure sa *pureté.*"], "h3", { dur: 0.45 });
  h.el.classList.add("s3-title");
  h.el.style.cssText = "position:absolute;left:0;right:0;top:392px";

  // ------------------------------------------------------------ the card
  const card = PP.neonCard(persp, { x: 540, y: 1040, w: 840, h: 620, radius: 34 });
  card.el.classList.add("s3-card");
  const B = card.body;

  // header
  const hdr = PP.el("div", "s3-hdr", B);
  const dotWrap = PP.el("div", "s3-dot", hdr);
  const dotRing = PP.el("div", "s3-dot-ring", dotWrap);
  PP.el("div", "s3-dot-core", dotWrap);
  const label = PP.el("div", "s3-label mono", hdr);
  const labelChars = PP.chars(label, "ANALYSE DU LOT");
  const chrome = PP.el("div", "s3-chrome", hdr);
  for (let i = 0; i < 3; i++) PP.el("i", "", chrome);

  // left: scan panel with the catalog vial
  const panel = PP.el("div", "s3-panel", B);
  PP.el("div", "s3-grid", panel);
  PP.el("div", "s3-pedestal", panel);
  const vial = PP.vial(panel, "assets/vials/bpc157-tb500-10.png", 330);
  vial.el.classList.add("s3-vial");
  // neon "scanned" copy of the vial, clipped to a band that follows the scan line
  const tintBox = PP.el("img", "s3-tint", vial.el, { src: "assets/vials/bpc157-tb500-10.png", alt: "" });
  const brackets = PP.el("div", "s3-brackets", panel);
  ["tl", "tr", "bl", "br"].forEach((c) => PP.el("i", c, brackets));
  const scan = PP.el("div", "s3-scan", panel);
  PP.el("div", "s3-scan-trail", scan);
  PP.el("div", "s3-scan-line", scan);

  // right: two check rows + the gliding highlight bar
  const barLayer = PP.el("div", "s3-barlayer", B);
  const ROWS = [
    { y: 128, h: 196 },
    { y: 350, h: 214 },
  ];
  const mkRow = (i, lines) => {
    const r = PP.el("div", "s3-row", B);
    r.style.top = ROWS[i].y + "px";
    r.style.height = ROWS[i].h + "px";
    const ic = PP.el("div", "s3-ic", r);
    PP.el("div", "s3-ic-ph", ic);
    const chk = PP.checkIcon(ic, 64, PP.C.neon);
    const col = PP.el("div", "s3-col", r);
    const txt = PP.el("div", "s3-txt", col, { html: lines.map((l) => PP.fr(l)).join("<br>") });
    return { r, ic, chk, col, txt };
  };
  const row1 = mkRow(0, ["C’est bien", "le bon produit"]);
  const row2 = mkRow(1, ["Pureté mesurée"]);
  const track = PP.el("div", "s3-track", row2.col);
  const fill = PP.el("div", "s3-fill", track);
  PP.el("div", "s3-fill-head", fill);

  // ------------------------------------------------------------ camera: settle from the flash, then drift
  tl.fromTo(cam, { scale: 1.12 }, { scale: 1, duration: 0.62, ease: "expo.out" }, T0);
  tl.fromTo(drift, { scale: 1, y: 0, rotation: 0 }, { scale: 1.045, y: -18, rotation: -0.6, duration: EXIT - T0 + 0.3, ease: "sine.inOut" }, T0);
  tl.fromTo(head, { y: 0 }, { y: -26, duration: EXIT - T0, ease: "none" }, T0); // headline parallax

  // ------------------------------------------------------------ card slam (beat 8.0) + 3D tilt
  tl.fromTo(slam, { y: 280, scale: 0.8, filter: "blur(18px)" }, { y: 0, scale: 1, filter: "blur(0px)", duration: 0.62, ease: "expo.out" }, T0);
  tl.fromTo(slam, { opacity: 0 }, { opacity: 1, duration: 3 * F, ease: "none" }, T0);
  tl.fromTo(card.el, { rotationX: 28, rotationY: -10 }, { rotationX: 8, rotationY: -4, duration: 0.7, ease: "expo.out" }, T0);
  tl.to(card.el, { rotationX: 3, rotationY: 3, duration: EXIT - T0 - 0.7, ease: "sine.inOut" }, T0 + 0.7);
  tl.fromTo(glow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" }, T0);

  // header types on, status dot pulses on every beat
  PP.typeOn(tl, labelChars, T0 + 0.06, 0.02);
  PP.popIn(tl, dotWrap, T0 + 0.04, { from: 0.2, dur: 0.4, ease: "back.out(3)" });
  for (let b = 8.5; b < EXIT; b += 0.5) tl.fromTo(dotRing, { scale: 1, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, b);
  tl.set(dotRing, { opacity: 0 }, 0);
  PP.popIn(tl, chrome.children, T0 + 0.1, { from: 0, dur: 0.35, stagger: 0.04, ease: "back.out(3)" });

  // beat 8.5: panel + vial + rows slam in
  tl.fromTo(panel, { scale: 0.72, opacity: 0, filter: "blur(10px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "back.out(1.6)" }, 8.5 - 2 * F);
  tl.fromTo(vial.el, { y: 120, scale: 0.8 }, { y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, 8.5);
  tl.fromTo(brackets, { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "expo.out" }, 8.58);
  [row1, row2].forEach((r, i) => {
    tl.fromTo(r.r, { x: 70, opacity: 0, filter: "blur(10px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, 8.5 + i * 0.08);
  });
  tl.fromTo(track, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, 8.66);
  // vial slow float
  tl.fromTo([vial.img, tintBox], { y: 0, rotation: -1.5 }, { y: -10, rotation: 1.5, duration: 2.9, ease: "sine.inOut" }, 8.55);

  // scan line: one deterministic function of time, sweep top -> bottom every 1.0 s
  const PH = 480,
    TR = 110,
    PERIOD = 1.0,
    SWEEP = 0.9,
    S0 = 8.62;
  const vialTop = PH - 34 - vial.height; // vial bottom sits 34 px above the panel bottom
  const setScan = (t) => {
    const k = Math.max(0, t - S0);
    const ph = Math.min(1, (k % PERIOD) / SWEEP);
    const e = ph < 0.5 ? 2 * ph * ph : 1 - Math.pow(-2 * ph + 2, 2) / 2; // quad in-out
    const y = -TR + (PH + TR) * e; // line position = y + TR
    scan.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
    const ly = y + TR;
    const a = Math.max(0, ly - 70),
      b = Math.min(PH, ly + 6);
    const va = a - vialTop,
      vb = b - vialTop;
    tintBox.style.clipPath = vb <= 0 || va >= vial.height ? "inset(100% 0px 0px 0px)" : `inset(${Math.max(0, va).toFixed(1)}px 0px ${Math.max(0, vial.height - vb).toFixed(1)}px 0px)`;
  };
  PP.drive(tl, setScan, S0, EXIT, S0, EXIT - S0, "none");
  setScan(S0);
  tl.fromTo([scan, tintBox], { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none" }, S0);
  vial.el.style.left = (250 - vial.width) / 2 + "px";
  vial.el.style.top = vialTop + "px";

  // ------------------------------------------------------------ highlight bar + row lights
  const L1 = 9.19,
    L2 = 10.33,
    DONE = 10.9;
  PP.highlightBar(tl, barLayer, 300, 512, ROWS, [L1, L2]);
  const lightRow = (r, at) => {
    tl.fromTo(r.txt, { opacity: 0.4 }, { opacity: 1, duration: 3 * F, ease: "none", immediateRender: false }, at - F);
    tl.fromTo(r.txt, { x: 0 }, { x: 10, duration: 0.3, ease: "expo.out", immediateRender: false }, at - F);
    tl.fromTo(r.ic, { scale: 1 }, { scale: 1.22, duration: 0.09, ease: "power2.out", immediateRender: false }, at);
    tl.fromTo(r.ic, { scale: 1.22 }, { scale: 1, duration: 0.4, ease: "back.out(3)", immediateRender: false }, at + 0.09);
  };
  lightRow(row1, L1);
  PP.draw(tl, row1.chk.circle, L1, 0.3, { ease: "power2.out" });
  PP.draw(tl, row1.chk.tick, L1 + 0.04, 0.24, { ease: "power3.out" });
  lightRow(row2, L2);
  PP.draw(tl, row2.chk.circle, L2, DONE - L2, { ease: "power2.inOut" });
  PP.draw(tl, row2.chk.tick, DONE, 0.22, { ease: "power3.out" });
  tl.fromTo(fill, { width: "0%" }, { width: "100%", duration: DONE - L2, ease: "power2.inOut", immediateRender: false }, L2);
  tl.set(fill, { width: "0%" }, 0);
  tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: F, ease: "none", immediateRender: false }, L2);
  tl.set(fill, { opacity: 0 }, 0);
  // card edge / glow pulses on each validation
  [L1, L2, DONE].forEach((t) => {
    tl.fromTo(glow, { opacity: 1.0, scale: 1.08 }, { opacity: 0.7, scale: 1, duration: 0.5, ease: "power2.out", immediateRender: false }, t);
    tl.fromTo(card.edge, { opacity: 1, filter: "brightness(2.2)" }, { filter: "brightness(1)", duration: 0.45, ease: "power2.out", immediateRender: false }, t);
  });

  // ------------------------------------------------------------ exit: fly through the camera
  tl.fromTo(cam, { scale: 1 }, { scale: 2.6, duration: 0.27, ease: "power3.in", immediateRender: false }, EXIT);
  tl.fromTo(cam, { filter: "blur(0px)" }, { filter: "blur(26px)", duration: 0.22, ease: "power2.in", immediateRender: false }, EXIT + 0.02);
  tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.13, ease: "power1.in", immediateRender: false }, EXIT + 0.12);
  tl.fromTo(head, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "power2.in", immediateRender: false }, EXIT);
});
