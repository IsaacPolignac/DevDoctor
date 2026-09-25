// s5 (13.90 → 18.00) — L6 « Et le rapport d’analyse est publié en ligne. Vous pouvez tout vérifier. »
// The real product page flies in as a 3D browser window (whoosh 14.05), slow camera push onto the purity line,
// cursor glides in, line lights 1 frame before the click (16.70), zoom lens pops out (16.76), whip-out 17.55.
// Window / cursor / anchor are ONE pure function of time (explicit projection math, see proj()).
PP.scene("s5", function (tl, root, cam) {
  const F = PP.F;
  const D = PP.cfg.dProduct; // 1440 x 900 css capture
  const CH = 64; // browser chrome height (window px, before scale)
  const WW = 1440,
    WH = 900 + CH;
  const OX = WW / 2,
    OY = WH / 2; // transform origin (window centre)
  const PERSP = 1800;
  const T0 = 13.9,
    T1 = 18.0;

  // ------------------------------------------------------------ helpers (pure)
  const E = {};
  const ease = (n) => E[n] || (E[n] = gsap.parseEase(n));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const seg = (t, a, b, e) => ease(e || "none")(clamp01((t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const rad = Math.PI / 180;
  // Project a point (u, v) given relative to the window centre through scale -> rotateY -> rotateX ->
  // perspective (same order as the CSS string in applyWin). Returns offset from the origin in screen px.
  function proj(u, v, st) {
    const x0 = st.s * u,
      y0 = st.s * v;
    const cy = Math.cos(st.ry * rad),
      sy = Math.sin(st.ry * rad);
    const x1 = x0 * cy,
      z1 = -x0 * sy;
    const cx = Math.cos(st.rx * rad),
      sx = Math.sin(st.rx * rad);
    const y2 = y0 * cx - z1 * sx,
      z2 = y0 * sx + z1 * cx;
    const w = 1 - z2 / PERSP;
    return { x: x1 / w, y: y2 / w };
  }
  // page css px -> window-centre-relative
  const pageUV = (px, py) => ({ u: px - OX, v: py + CH - OY });

  // focus point = centre of the purity line « Vérifié · Pureté HPLC 99.0% · Certificat d'analyse inclus »
  // (measured on d-product.jpg: chip starts at x 765, text ends at x ≈1160, row y 368→395)
  const FOC = pageUV(962, 381.5);
  const CLICK = pageUV(950, 384); // tip of the cursor: on « 99.0% »
  const HL = { x: 753, y: 361, w: 421, h: 41 }; // highlight rect (page css px)

  // Window state at time t: { s, rx, ry, tx, ty, blur, op }
  function state(t) {
    // 1) fly-in 14.05 → 14.65 (expo.out) from below/right, big 3D angle, blurred
    const kf = seg(t, 14.05, 14.65, "expo.out");
    const kd = seg(t, 14.65, 15.0, "sine.inOut");
    const st = {
      s: lerp(0.42, 0.69, kf) + 0.012 * kd,
      rx: lerp(10, 4, kf),
      ry: lerp(-24, -8, kf) + 1.2 * kd,
    };
    let cxs = lerp(930, 540, kf),
      cys = lerp(1720, 1080, kf) - 8 * kd;
    // 2) camera push 15.0 → 16.5 onto the purity line, then slow drift until the exit
    const kp = seg(t, 15.0, 16.5, "power2.inOut");
    const kz = seg(t, 16.5, 17.95, "none");
    st.s = lerp(st.s, 1.15, kp) + 0.035 * kz;
    st.rx = lerp(st.rx, 2, kp) - 0.8 * kz;
    st.ry = lerp(st.ry, -3.2, kp) + 1.4 * kz;
    const pf = proj(FOC.u, FOC.v, st);
    const aSettle = { x: cxs + pf.x, y: cys + pf.y };
    const aPush = { x: 556 - 10 * kz, y: 1118 - 6 * kz };
    const ax = lerp(aSettle.x, aPush.x, kp),
      ay = lerp(aSettle.y, aPush.y, kp);
    st.tx = ax - pf.x;
    st.ty = ay - pf.y;
    st.blur = 18 * (1 - seg(t, 14.05, 14.5, "power2.out"));
    st.op = seg(t, 14.05, 14.12, "none");
    return st;
  }
  const screenOf = (p, st) => {
    const q = proj(p.u, p.v, st);
    return { x: st.tx + q.x, y: st.ty + q.y };
  };

  // ------------------------------------------------------------ DOM
  const stage = PP.el("div", "s5-stage", cam);
  const glow = PP.el("div", "s5-glow", stage);
  const back = PP.el("div", "s5-back", stage); // far layer (parallax)
  const ghost = PP.el("div", "s5-ghost", back);
  PP.el("img", "", ghost, { src: "assets/site/d-home.jpg", alt: "" });

  const win = PP.el("div", "s5-win", stage);
  win.style.cssText = `width:${WW}px;height:${WH}px;left:${-OX}px;top:${-OY}px;transform-origin:${OX}px ${OY}px;`;
  const bar = PP.el("div", "s5-bar", win);
  bar.style.height = CH + "px";
  const dots = PP.el("div", "s5-dots", bar);
  ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c) => PP.el("i", "", dots, { style: `background:${c}` }));
  const url = PP.el("div", "s5-url", bar);
  url.innerHTML =
    '<svg width="20" height="24" viewBox="0 0 20 24"><rect x="2" y="10" width="16" height="12" rx="3" fill="#2EE6C9"/><path d="M5.5 10V7a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#2EE6C9" stroke-width="2.4"/></svg><span>' +
    PP.cfg.url +
    "</span>";
  const page = PP.el("div", "s5-page", win);
  page.style.top = CH + "px";
  PP.el("img", "", page, { src: D.src, alt: "" });
  const hl = PP.el("div", "s5-hl", page);
  hl.style.cssText = `left:${HL.x}px;top:${HL.y}px;width:${HL.w}px;height:${HL.h}px;`;
  const dim = PP.el("div", "s5-dim", win);
  PP.el("div", "pp-ncard-edge s5-edge", win);
  const sheen = PP.el("div", "s5-sheen", win);

  // headline layer (inside cam so the whip carries it)
  const text = PP.el("div", "s5-text", cam);

  function applyWin(t) {
    const st = state(t);
    win.style.transform = `translate(${st.tx.toFixed(2)}px,${st.ty.toFixed(2)}px) perspective(${PERSP}px) rotateX(${st.rx.toFixed(3)}deg) rotateY(${st.ry.toFixed(3)}deg) scale(${st.s.toFixed(4)})`;
    win.style.filter = st.blur > 0.05 ? `blur(${st.blur.toFixed(2)}px)` : "none";
    win.style.opacity = st.op.toFixed(3);
    // far layer: slower, opposite drift (parallax); glow follows the window softly
    const kf = seg(t, 14.05, 14.8, "expo.out");
    const kp = seg(t, 15.0, 16.5, "power2.inOut");
    back.style.transform = `translate(${(lerp(260, 0, kf) - 60 * kp - 20 * seg(t, 14, 18)).toFixed(1)}px,${(lerp(420, 0, kf) + 90 * kp).toFixed(1)}px) scale(${(1 + 0.12 * kp).toFixed(4)})`;
    back.style.opacity = (0.55 * kf).toFixed(3);
    glow.style.opacity = (seg(t, 14.05, 14.5, "power2.out") * (1 - 0.35 * kp)).toFixed(3);
    glow.style.transform = `translate(${(st.tx - 540) * 0.35}px,${(st.ty - 1080) * 0.35}px) scale(${(0.8 + 0.4 * st.s).toFixed(3)})`;
    // sheen sweep on arrival (window glass catch-light)
    sheen.style.setProperty("--p", (lerp(-30, 130, seg(t, 14.3, 15.1, "power2.inOut"))).toFixed(1) + "%");
  }
  PP.drive(tl, applyWin, T0, T1, T0, T1 - T0, "none");

  // ------------------------------------------------------------ headline (words on VO onsets)
  const vo = PP.VO.find((l) => l.id === "L6");
  const LEAD = 0.08;
  const fit = (lines, fs, maxW) => {
    const c = document.createElement("canvas").getContext("2d");
    c.font = `800 ${fs}px "DM Sans"`;
    const w = Math.max(...lines.map((l) => { const s = PP.fr(l.replace(/\*/g, "")); return c.measureText(s).width - 0.035 * fs * s.length; }));
    return Math.min(fs, Math.floor((fs * maxW) / w));
  };
  const linesA = ["Et le *rapport* *d’analyse*", "est publié en ligne."];
  const linesB = ["Vous pouvez", "*tout* *vérifier.*"];
  const hA = PP.headline(text, linesA, "h2");
  const hB = PP.headline(text, linesB, "h1");
  hA.el.style.cssText = `position:absolute;left:0;right:0;top:300px;font-size:${fit(linesA, 84, 820)}px`;
  hB.el.style.cssText = `position:absolute;left:0;right:0;top:296px;font-size:${fit(linesB, 104, 820)}px`;
  const words = hA.words.concat(hB.words);
  const times = words.map((w, i) => Math.max(0, vo.words[i].t0 - LEAD));
  words.forEach((w, i) => PP.wordIn(tl, w, times[i], { rise: 16, blur: 8 }));
  // first sentence leaves just before « Vous »
  PP.textOut(tl, hA.words, 15.56, { dur: 0.18, stagger: 0.012 });

  // ------------------------------------------------------------ cursor: glides onto « 99.0% », click 16.70
  const cur = PP.cursor(cam, 1160, 1700, 1.25);
  const C0 = { x: 1150, y: 1720 };
  function applyCur(t) {
    const st = state(t);
    const p = screenOf(CLICK, st);
    // glide 15.60 → 16.08 (power3.inOut), lands slightly short, then a small settle onto the exact spot
    const kg = seg(t, 15.6, 16.08, "power3.inOut");
    const ks = seg(t, 16.08, 16.45, "power2.inOut");
    const offx = lerp(22, 0, ks),
      offy = lerp(30, 0, ks);
    const x = lerp(C0.x, p.x + offx, kg),
      y = lerp(C0.y, p.y + offy, kg);
    cur.el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
    cur.el.style.opacity = t < 15.6 ? "0" : "1";
  }
  PP.drive(tl, applyCur, T0, T1, T0, T1 - T0, "none");

  // highlight lights 1 frame before the click, then the click
  const tH = 16.7 - F;
  tl.set(hl, { opacity: 0 }, 0);
  tl.fromTo(hl, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 2 * F, ease: "power2.out", immediateRender: false }, tH - 2 * F);
  cur.click(tl, 16.7);
  tl.fromTo(dim, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, 16.76);

  // ------------------------------------------------------------ lens pops out towards the camera (16.76)
  const crop = [745, 352, 430, 58];
  const LW = 880;
  const LX = 540,
    LY = 1330;
  const lensWrap = PP.el("div", "s5-lensWrap", cam);
  const lens = PP.lens(lensWrap, D.src, D.cssW, D.cssH, crop, LW);
  lensWrap.style.cssText = `left:${LX - LW / 2}px;top:${LY - lens.height / 2}px;width:${LW}px;height:${lens.height}px;`;
  const lring = PP.el("div", "s5-lring", lensWrap);
  // start = where the crop sits on screen at 16.76 (explicit projection)
  const stP = state(16.76);
  const cc = screenOf(pageUV(crop[0] + crop[2] / 2, crop[1] + crop[3] / 2), stP);
  const s0 = (crop[2] * stP.s) / LW;
  const TP = 16.76;
  tl.set(lensWrap, { opacity: 0 }, 0);
  tl.fromTo(
    lensWrap,
    { x: cc.x - LX, y: cc.y - LY, scale: s0, rotationX: 22, transformPerspective: 1100, opacity: 0 },
    { x: 0, y: 0, scale: 1, rotationX: 0, opacity: 1, duration: 0.55, ease: "back.out(1.5)", immediateRender: false },
    TP
  );
  tl.set(lensWrap, { opacity: 1 }, TP + 0.06);
  // magnifier projection beam: highlight corners -> lens corners (pure function of t), lens float on the inner card
  const beam = PP.svg("svg", { class: "s5-beam", width: 1080, height: 1920, viewBox: "0 0 1080 1920" }, cam);
  const gid = PP.uid("s5g");
  const defs = PP.svg("defs", {}, beam);
  const lg = PP.svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  PP.svg("stop", { offset: "0", "stop-color": "#2EE6C9", "stop-opacity": "0.28" }, lg);
  PP.svg("stop", { offset: "1", "stop-color": "#38BDF8", "stop-opacity": "0.06" }, lg);
  const poly = PP.svg("polygon", { fill: `url(#${gid})` }, beam);
  const edL = PP.svg("line", { stroke: "#2EE6C9", "stroke-width": 2, "stroke-opacity": 0.7 }, beam);
  const edR = PP.svg("line", { stroke: "#2EE6C9", "stroke-width": 2, "stroke-opacity": 0.7 }, beam);
  const lensTop = LY - lens.height / 2;
  function applyBeam(t) {
    const fy = -12 * seg(t, TP + 0.55, 17.55, "sine.inOut");
    lens.el.style.transform = `translateY(${fy.toFixed(2)}px)`;
    const st = state(t);
    const a = screenOf(pageUV(HL.x + 10, HL.y + HL.h), st),
      b = screenOf(pageUV(HL.x + HL.w - 10, HL.y + HL.h), st);
    const c = { x: LX + LW / 2 - 14, y: lensTop + fy + 2 },
      d = { x: LX - LW / 2 + 14, y: lensTop + fy + 2 };
    const f = (q) => q.x.toFixed(1) + "," + q.y.toFixed(1);
    poly.setAttribute("points", [a, b, c, d].map(f).join(" "));
    [[edL, a, d], [edR, b, c]].forEach(([l, p, q]) => {
      l.setAttribute("x1", p.x.toFixed(1)); l.setAttribute("y1", p.y.toFixed(1));
      l.setAttribute("x2", q.x.toFixed(1)); l.setAttribute("y2", q.y.toFixed(1));
    });
    beam.style.opacity = seg(t, TP + 0.3, TP + 0.6, "power2.out").toFixed(3);
  }
  PP.drive(tl, applyBeam, T0, T1, T0, T1 - T0, "none");
  tl.fromTo(lring, { scale: 1, opacity: 0 }, { scale: 1, opacity: 0.95, duration: 0.001, immediateRender: false }, TP + 0.08);
  tl.fromTo(lring, { scale: 1, opacity: 0.95 }, { scale: 1.22, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, TP + 0.1);
  tl.set(lring, { opacity: 0 }, 0);

  // ------------------------------------------------------------ camera: constant slow drift, whip-out 17.55
  tl.fromTo(cam, { scale: 1, x: 0 }, { scale: 1.035, x: -8, duration: 17.55 - T0, ease: "none" }, T0);
  tl.fromTo(cam, { y: 0, filter: "blur(0px)" }, { y: -1200, filter: "blur(28px)", duration: 0.36, ease: "expo.in", immediateRender: false }, 17.55);
  tl.fromTo(cam, { scale: 1.035 }, { scale: 1.12, duration: 0.36, ease: "power2.in", immediateRender: false }, 17.55);
  tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "power1.in", immediateRender: false }, 17.72);
});
