// s4o — TEST overlays (clip 29.80 → 44.60), ABOVE the stage-level #sitetest video. « TESTEZ. » slam on black →
// flies to the header; step labels + progress; window edge light + corner masks (same camera as s4 via PP.s4cam);
// click ripples on the real clicks; VO keywords (L13 / L14) as big lower thirds; shipping chips. Gone by 44.55.
PP.scene("s4o", function (tl, root, cam) {
  const F = PP.F;
  const C = PP.s4cam;
  const T = { SLAM: 29.93, IN: 30.4, OUT: 44.3 };

  // hard cut: visible on [on, off)
  const vis = (el, on, off) => {
    gsap.set(el, { autoAlpha: 0 });
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.001, ease: "none", immediateRender: false }, on - 0.002);
    if (off) tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.001, ease: "none", immediateRender: false }, off - 0.002);
  };
  // offset of an element relative to the section (layout px, ignores transforms/preview scaling)
  const offs = (el) => {
    let x = 0,
      y = 0,
      e = el;
    while (e && e !== root) {
      x += e.offsetLeft;
      y += e.offsetTop;
      e = e.offsetParent;
    }
    return { x, y };
  };
  const wordIn = (w, at, o) => PP.wordIn(tl, w, at, o);
  const out = (els, at, o) => {
    o = o || {};
    tl.fromTo(els, { opacity: 1, y: 0, filter: "blur(0px)" }, { opacity: 0, y: o.y == null ? -18 : o.y, filter: `blur(${o.blur == null ? 6 : o.blur}px)`, duration: o.d || 0.18, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false }, at);
  };

  // ================================================================ window edge light + bottom corner masks (camera-locked)
  let edge = null;
  if (C) {
    edge = PP.el("div", "s4o-edge", cam);
    edge.style.width = C.VW + "px";
    edge.style.height = C.VH + C.TBU + "px";
    edge.style.borderRadius = C.RAD + "px";
    const ring = PP.el("div", "s4o-edge-ring", edge);
    ring.style.borderRadius = C.RAD + "px";
    const r = C.RAD;
    const mk = (cls, left, pos) => {
      const m = PP.el("div", "s4o-corner " + cls, edge);
      m.style.cssText += `width:${r + 2}px;height:${r + 2}px;left:${left}px;top:${C.TBU + C.VH - r}px;background:radial-gradient(circle at ${pos}, rgba(2,3,5,0) ${r - 0.8}px, #020305 ${r + 0.2}px);`;
    };
    mk("bl", -2, `${r + 2}px 0px`);
    mk("br", C.VW - r, `0px 0px`);
    PP.drive(
      tl,
      (t) => {
        const st = C.state(t);
        edge.style.transform = C.tf(st);
        edge.style.opacity = st.op;
      },
      29.8,
      44.6,
      29.8,
      14.8,
      "none"
    );
  }

  // ================================================================ click ripples (cursor positions measured in the recording, video px)
  const CLICKS = [
    [31.4, 695, 629],
    [32.0, 695, 731],
    [32.667, 959, 853],
    [34.5, 394, 866],
    [37.033, 281, 410],
    [41.067, 1394, 700],
    [42.167, 1787, 1138],
  ];
  if (C)
    CLICKS.forEach(([tc, vx, vy]) => {
      const rp = PP.el("div", "s4o-ripple", cam);
      const dot = PP.el("div", "s4o-ripple-dot", cam);
      const D = 0.6;
      PP.drive(
        tl,
        (v) => {
          if (v <= 0 || v >= 1) {
            rp.style.opacity = "0";
            dot.style.opacity = "0";
            return;
          }
          const p = C.pt(tc + v * D, vx, vy);
          const e = 1 - Math.pow(1 - v, 3);
          const d = (26 + 130 * e) * (p.k / C.K0);
          rp.style.width = rp.style.height = d + "px";
          rp.style.left = p.x - d / 2 + "px";
          rp.style.top = p.y - d / 2 + "px";
          rp.style.borderWidth = 5 - 3 * e + "px";
          rp.style.opacity = String(0.95 * (1 - v));
          const dd = 30 * (p.k / C.K0) * (1 - 0.4 * v);
          dot.style.width = dot.style.height = dd + "px";
          dot.style.left = p.x - dd / 2 + "px";
          dot.style.top = p.y - dd / 2 + "px";
          dot.style.opacity = String(v < 0.35 ? 0.55 : 0.55 * (1 - (v - 0.35) / 0.65));
        },
        0,
        1,
        tc,
        D,
        "none"
      );
    });

  // ================================================================ perk highlight « Expédition sous 24 h » (41.07 → 42.1 in the recording)
  if (C) {
    const hb = PP.el("div", "s4o-perk", cam);
    const R = [1022, 862, 652, 64]; // video px rect of the perk row
    PP.drive(
      tl,
      (t) => {
        if (t <= 41.4 || t >= 42.25) {
          hb.style.opacity = "0";
          return;
        }
        const st = C.state(t);
        hb.style.left = st.X + R[0] * st.k + "px";
        hb.style.top = st.Y + R[1] * st.k + "px";
        hb.style.width = R[2] * st.k + "px";
        hb.style.height = R[3] * st.k + "px";
        const a = Math.min(1, (t - 41.4) / 0.12) * Math.min(1, (42.25 - t) / 0.12);
        hb.style.opacity = a.toFixed(3);
        hb.style.clipPath = `inset(0 ${(100 * (1 - Math.min(1, (t - 41.4) / 0.3))).toFixed(1)}% 0 0 round 14px)`;
      },
      41.3,
      42.35,
      41.3,
      1.05,
      "none"
    );
  }

  // ================================================================ lower thirds (VO keywords)
  const scrimBR = PP.el("div", "s4o-scrim br", cam);
  const scrimBL = PP.el("div", "s4o-scrim bl", cam);

  // L13 « Choisissez votre référence. » — bottom right (the focused card is on the left)
  const lt13 = PP.el("div", "s4o-lt right", cam);
  const k13 = PP.el("div", "s4o-kick", lt13);
  const k13w = [PP.el("span", "pp-w", k13, { text: "Choisissez" })];
  const b13 = PP.el("div", "s4o-big mf", lt13);
  const b13w = [PP.el("span", "pp-w", b13, { text: "Votre" })];
  b13.appendChild(document.createTextNode(" "));
  b13w.push(PP.el("span", "pp-w grad", b13, { text: "référence." }));
  wordIn(k13w[0], 35.03 - 0.06, { rise: 12, blur: 4 });
  wordIn(b13w[0], 35.41 - 0.05, { rise: 40, blur: 10, dur: 0.45 });
  wordIn(b13w[1], 35.61 - 0.05, { rise: 40, blur: 10, dur: 0.45 });
  tl.fromTo(scrimBR, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 34.95);
  out([k13, b13], 36.4, { stagger: 0.03 });
  tl.fromTo(scrimBR, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power2.in", immediateRender: false }, 36.45);

  // L14 « Regardez sa pureté, vérifiée. » — bottom left (purity line is upper right)
  const lt14 = PP.el("div", "s4o-lt left", cam);
  const k14 = PP.el("div", "s4o-kick", lt14);
  const k14w = [PP.el("span", "pp-w", k14, { text: "Regardez" })];
  k14.appendChild(document.createTextNode(" "));
  k14w.push(PP.el("span", "pp-w", k14, { text: "sa" }));
  const b14 = PP.el("div", "s4o-big mf", lt14);
  const b14w = [PP.el("span", "pp-w", b14, { text: "Pureté" })];
  b14.appendChild(document.createTextNode(" "));
  b14w.push(PP.el("span", "pp-w grad", b14, { text: "vérifiée." }));
  wordIn(k14w[0], 38.13 - 0.06, { rise: 12, blur: 4 });
  wordIn(k14w[1], 38.56 - 0.06, { rise: 12, blur: 4 });
  wordIn(b14w[0], 38.64 - 0.05, { rise: 40, blur: 10, dur: 0.45 });
  wordIn(b14w[1], 39.31 - 0.05, { rise: 40, blur: 10, dur: 0.45 });
  tl.fromTo(scrimBL, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 38.05);
  out([k14, b14], 40.3, { stagger: 0.03 });
  tl.fromTo(scrimBL, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power2.in", immediateRender: false }, 40.35);

  // chips (pops 42.47 · 43.57) — bottom left, over the dimmed product page while the cart drawer opens on the right
  const chips = PP.el("div", "s4o-chips", cam);
  const c1 = PP.pill(chips, "Expédition sous " + PP.cfg.shipping, { check: true });
  const c2 = PP.pill(chips, "Livraison vers " + PP.cfg.countries + " pays", { check: true });
  c1.style.top = "0px";
  c2.style.top = "88px";
  gsap.set([c1, c2], { transformOrigin: "0% 50%" });
  PP.popIn(tl, c1, 42.47 - F, { from: 0.6, dur: 0.5 });
  PP.popIn(tl, c2, 43.57 - F, { from: 0.6, dur: 0.5 });
  gsap.set([c1, c2], { opacity: 0 });
  tl.fromTo(scrimBL, { opacity: 0 }, { opacity: 0.85, duration: 0.3, ease: "power2.out", immediateRender: false }, 42.4);
  out([c1, c2], T.OUT, { y: -30, d: 0.16, stagger: 0.02 });
  tl.fromTo(scrimBL, { opacity: 0.85 }, { opacity: 0, duration: 0.18, ease: "power2.in", immediateRender: false }, T.OUT);

  // ================================================================ header: « TESTEZ. » + step label + progress
  const hdr = PP.el("div", "s4o-hdr", cam);
  const plate = PP.el("div", "s4o-plate", hdr);
  const row = PP.el("div", "s4o-row", hdr);
  const tLabel = PP.el("div", "s4o-testez mf grad", row, { text: "Testez." });
  PP.el("div", "s4o-sep", row);
  const stack = PP.el("div", "s4o-stack", row);
  const STEPS = [
    { t: 30.62, end: 34.45, n: "01", w: "Entrez" },
    { t: 34.5, end: 37.95, n: "02", w: "Choisissez" },
    { t: 38.0, end: 40.95, n: "03", w: "Vérifiez" },
    { t: 41.0, end: T.OUT, n: "04", w: "Commandez" },
  ];
  const labs = STEPS.map((s) => {
    const l = PP.el("div", "s4o-step mf", stack);
    PP.el("span", "neon", l, { text: s.n });
    PP.el("span", "s4o-dot", l, { text: " · " });
    PP.el("span", "", l, { text: s.w });
    return l;
  });
  const maxW = Math.max(...labs.map((l) => l.offsetWidth));
  stack.style.width = maxW + "px";
  const meta = PP.el("div", "s4o-meta", hdr);
  const bars = PP.el("div", "s4o-bars", meta);
  const fills = STEPS.map(() => PP.el("i", "", PP.el("b", "", bars)));
  const ctr = PP.el("div", "s4o-ctr mono", row);
  const ctrs = STEPS.map((s, i) => PP.el("span", "", ctr, { text: `Étape ${i + 1}/4` }));

  // step label cuts
  STEPS.forEach((s, i) => {
    gsap.set([labs[i], ctrs[i]], { opacity: 0 });
    tl.fromTo(labs[i], { opacity: 0, y: 26, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.32, ease: "expo.out", immediateRender: false }, s.t);
    tl.fromTo(ctrs[i], { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, s.t);
    if (i < STEPS.length - 1) {
      tl.fromTo(labs[i], { opacity: 1, y: 0 }, { opacity: 0, y: -22, duration: 0.1, ease: "power2.in", immediateRender: false }, STEPS[i + 1].t - 0.1);
      tl.fromTo(ctrs[i], { opacity: 1 }, { opacity: 0, duration: 0.06, ease: "none", immediateRender: false }, STEPS[i + 1].t - 0.06);
    }
    tl.fromTo(fills[i], { scaleX: 0 }, { scaleX: 1, duration: s.end - s.t, ease: "none", immediateRender: false }, s.t);
  });
  gsap.set(fills, { scaleX: 0, transformOrigin: "0% 50%" });
  gsap.set([plate, meta], { opacity: 0 });
  tl.fromTo(plate, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 30.55);
  tl.fromTo(meta, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, 30.7);
  tl.fromTo(hdr, { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.18, ease: "power2.in", immediateRender: false }, T.OUT);

  // ================================================================ « TESTEZ. » slam on black (29.93) → flies into the header (30.40)
  const black = PP.el("div", "s4o-black", cam);
  vis(black, T.SLAM, T.IN);
  const fly = PP.el("div", "s4o-fly", cam);
  const inner = PP.el("div", "s4o-fly-in mf", fly, { text: "Testez." });
  const BIG = 360;
  const W = inner.offsetWidth,
    H = inner.offsetHeight;
  inner.style.transformOrigin = `${W / 2}px ${H / 2}px`;
  const tp = offs(tLabel);
  const sc = tLabel.offsetHeight / H;
  const x0 = 960 - W / 2,
    y0 = 540 - H / 2 + 10;
  gsap.set(fly, { x: x0, y: y0, scale: 1, opacity: 0, transformOrigin: "0 0" });
  gsap.set(tLabel, { opacity: 0 });
  tl.fromTo(fly, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, T.SLAM - F);
  tl.fromTo(inner, { scale: 1.32, filter: "blur(12px)" }, { scale: 1, filter: "blur(0px)", duration: 0.3, ease: "expo.out", immediateRender: false }, T.SLAM - F);
  tl.fromTo(inner, { scale: 1 }, { scale: 1.045, duration: T.IN - (T.SLAM + 0.27), ease: "none", immediateRender: false }, T.SLAM + 0.27);
  tl.fromTo(inner, { scale: 1.045 }, { scale: 1, duration: 0.5, ease: "power3.inOut", immediateRender: false }, T.IN);
  tl.fromTo(fly, { x: x0, y: y0, scale: 1 }, { x: tp.x, y: tp.y, scale: sc, duration: 0.5, ease: "power3.inOut", immediateRender: false }, T.IN);
  tl.fromTo(fly, { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, T.IN + 0.44);
  tl.fromTo(tLabel, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: "none", immediateRender: false }, T.IN + 0.42);
  gsap.set(inner, { opacity: 1 });
});
