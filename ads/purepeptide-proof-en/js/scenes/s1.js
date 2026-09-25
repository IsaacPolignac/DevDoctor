// s1 — BRAND OPEN + PAIN (0.00 → 12.10).
// 0.00–2.40 BRAND OPEN: macro of the PurePeptide hero vial on a dark stage, rim-lit; a light sweep crosses the label
//   0.00→0.60 on the sonic logo (seal click + glass tink = star glint), slow push-in. 2.40 hard cut.
// 2.40–12.10 PAIN: the AI still (dusty unlabeled vials under a fluorescent tube) in 3 framings (hard cuts on the first
//   word of each VO line: 2.40 / 5.80 / 8.40), cold grade, Ken Burns + handheld micro-drift, dust in the beam, tube
//   flicker dips on the SOUND-EVENT TABLE. The fake claims are physical props slapped on the shot: a cheap printed
//   « 99% » sticker (3.39) and a « “LAB TESTED.” » rubber stamp (6.58); « PROOF. » (9.67) slams hollow — the one thing
//   nobody shows. Every VO word appears on its onset. Darkening 10.1 → 12.0, the 11.70 flicker kills the type.
// Every continuous state is a pure function of one driven clock `t`.
PP.scene("s1", function (tl, root, cam) {
  const F = PP.F;
  const T_CUT = 2.4;
  const T_END = 12.1;
  // the 30 fps frame on screen when an event at t is heard (applied 2 ms early so seeks land robustly)
  const fr = (t) => Math.floor(t * 30 + 1e-6) / 30 - 0.002;
  // binary switch (repeated props -> fromTo, immediateRender:false)
  const sw = (el, a, b, at) => tl.fromTo(el, { opacity: a }, { opacity: b, duration: 0, ease: "none", immediateRender: false }, at);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  // Anton width measured on a canvas (the clip may be display:none at build time)
  const ctx = document.createElement("canvas").getContext("2d");
  const measure = (txt, size) => {
    ctx.font = `400 ${size}px Anton`;
    return ctx.measureText(txt).width + size * 0.005 * txt.length;
  };
  const HERO = PP.cfg.heroVial;
  const masked = (el) => {
    el.style.webkitMaskImage = el.style.maskImage = `url("${HERO}")`;
    el.style.webkitMaskSize = el.style.maskSize = "100% 100%";
    el.style.webkitMaskRepeat = el.style.maskRepeat = "no-repeat";
  };

  // ================================================================== BRAND OPEN (0.00 → 2.40)
  const open = PP.el("div", "s1-open", cam);
  PP.el("div", "s1-o-bg", open);
  const haze = PP.el("div", "s1-o-haze", open);
  // vial 2000 px tall (2.6× the s3 hero): the label fills the frame, wordmark ≈ 640 px wide.
  // Logo cluster (png rows 640 → 990 of 1536) centred at y 525.
  const OH = 2000,
    OW = OH * PP.HERO_RATIO,
    OCY = 0.535 * OH;
  const rig = PP.el("div", "s1-o-rig", open);
  rig.style.cssText = `left:${(960 - OW / 2).toFixed(1)}px;top:${(525 - OCY).toFixed(1)}px;width:${OW.toFixed(1)}px;height:${OH}px;transform-origin:${(OW / 2).toFixed(1)}px ${OCY.toFixed(1)}px;`;
  const rim = PP.el("div", "s1-o-rim", rig);
  const rimL = PP.el("div", "s1-o-rim-l", rim);
  const rimR = PP.el("div", "s1-o-rim-r", rim);
  masked(rimL);
  masked(rimR);
  const hv = PP.heroVial(rig, OH);
  hv.el.style.left = hv.el.style.top = "0px";
  const shade = PP.el("div", "s1-o-shade", rig); // cylindrical key-light falloff on glass + label
  const spec = PP.el("div", "s1-o-spec", rig); // vertical specular stripes on the glass
  const veil = PP.el("div", "s1-o-veil", rig); // label slightly darker ahead of the sweep (the sweep "lights" it)
  const sweep = PP.el("div", "s1-o-sweep", rig);
  [shade, spec, veil, sweep].forEach(masked);
  const glint = PP.el("div", "s1-o-glint", rig); // the « tink »: star glint on the top label band
  PP.el("div", "s1-o-glint-h", glint);
  PP.el("div", "s1-o-glint-v", glint);
  PP.el("div", "s1-o-glint-c", glint);
  glint.style.left = (0.3 * OW).toFixed(1) + "px";
  glint.style.top = ((588 / 1536) * OH).toFixed(1) + "px";
  PP.el("div", "s1-o-falloff", open);
  const oFlash = PP.el("div", "s1-o-flash", open);

  function openFrame(t) {
    const u = t / T_CUT;
    // slow, linear push into the logo (motion-control feel) + tiny rise
    rig.style.transform = `translateY(${(-10 * u).toFixed(2)}px) scale(${(1 + 0.055 * u).toFixed(4)})`;
    // light sweep across the label 0.00 → 0.60 (already on the label's left edge on frame 0)
    const k = clamp(t / 0.6);
    const p = 16 + 124 * (1 - Math.pow(1 - k, 1.7));
    sweep.style.setProperty("--p", p.toFixed(2) + "%");
    veil.style.setProperty("--p", p.toFixed(2) + "%");
    sweep.style.opacity = (t < 0.6 ? 1 : clamp(1 - (t - 0.6) / 0.15)).toFixed(3);
    // exposure kick on the tink, settling to the key level
    const fl = Math.exp(-t * 6.5);
    hv.img.style.filter = `brightness(${(0.86 + 0.22 * fl).toFixed(3)}) contrast(1.05) saturate(1.05)`;
    oFlash.style.opacity = (0.3 * Math.exp(-t * 11)).toFixed(3);
    // glint: born bright on frame 0, twinkles out in ~0.5 s
    const g = Math.exp(-t * 5.2);
    glint.style.opacity = (t < 0.75 ? g : 0).toFixed(3);
    glint.style.transform = `translate(-50%, -50%) rotate(${(-8 + 22 * t).toFixed(2)}deg) scale(${(0.55 + 0.6 * g).toFixed(3)})`;
    // glass speculars drift with the push (parallax against the label)
    spec.style.setProperty("--s", (13.5 + 2.2 * u).toFixed(2) + "%");
    rimL.style.transform = `translateX(${(-24 + 5 * u).toFixed(2)}px)`;
    rimR.style.transform = `translateX(${(24 - 5 * u).toFixed(2)}px)`;
    haze.style.opacity = (0.85 + 0.15 * Math.sin(t * 2.2)).toFixed(3);
  }
  PP.drive(tl, openFrame, 0, T_CUT, 0, T_CUT, "none");
  sw(open, 1, 0, fr(T_CUT)); // HARD CUT

  // ================================================================== PAIN (2.40 → 12.10)
  const pain = PP.el("div", "s1-pain", cam);
  pain.style.opacity = "0";
  sw(pain, 0, 1, fr(T_CUT));

  // ------------------------------------------------------------------ plate (the still)
  const plate = PP.el("div", "s1-plate", pain);
  const shot = PP.el("div", "s1-shot", plate);
  PP.el("img", "s1-img", shot, { src: PP.cfg.fakeShelf, alt: "" });
  const tube = PP.el("div", "s1-tube", shot); // extra glow on the fluorescent tube (image coords)
  const tubeCore = PP.el("div", "s1-tube-core", shot);
  const beam = PP.el("div", "s1-beam", shot); // soft light cone under the tube
  PP.el("div", "s1-tint", plate); // cold grade
  PP.el("div", "s1-scrim", plate); // edge darkening for type legibility

  // ------------------------------------------------------------------ props slapped on the shot (lit by the tube)
  const world = PP.el("div", "s1-world", pain);

  // ------------------------------------------------------------------ dust
  const dustL = PP.el("div", "s1-dust", pain);
  const rnd = PP.rng(1701);
  const dust = [];
  for (let i = 0; i < 90; i++) {
    const z = 0.25 + 0.75 * rnd();
    const d = PP.el("div", "s1-mote", dustL);
    const sz = 2.5 + 9 * z * z;
    d.style.width = d.style.height = sz.toFixed(1) + "px";
    d.style.filter = `blur(${(z > 0.8 ? 1.6 + (z - 0.8) * 10 : 0.4 + z).toFixed(1)}px)`;
    dust.push({
      el: d,
      z,
      x0: rnd() * 2120 - 100,
      y0: rnd() * 1280 - 100,
      vx: (rnd() * 2 - 1) * 9 * z,
      vy: (rnd() * 1.4 - 0.35) * 8 * z,
      wa: (6 + 14 * rnd()) * z,
      wf: 0.35 + 0.9 * rnd(),
      ph: rnd() * 6.283,
      a: 0.3 + 0.6 * rnd(),
    });
  }

  // ------------------------------------------------------------------ darkness (flicker dips + final fade)
  const dark = PP.el("div", "s1-dark", pain);

  // ------------------------------------------------------------------ type
  const typeL = PP.el("div", "s1-type", pain);

  // shots (hard cuts on the first word of each line): image point (cx, cy) framed at screen centre; base scale;
  // slow pan velocity (px/s, image coords)
  const SHOTS = [
    { t0: T_CUT, cx: 1000, cy: 560, s: 1.06, vx: -4, vy: 2 }, // wide: the tube, the whole shelf
    { t0: 5.8, cx: 1150, cy: 690, s: 1.5, vx: 6, vy: -3 }, // tighter, the crowded middle of the shelf
    { t0: 8.4, cx: 770, cy: 640, s: 1.62, vx: -5, vy: -4 }, // tight, open vials front-left under the light
  ];
  const DIPS = [2.75, 4.3, 4.45, 6.8, 9.1, 9.2, 11.7];
  const SLAMS = [
    { t: 3.39, k: 1 },
    { t: 4.79, k: 0.3 },
    { t: 6.58, k: 1.1 },
    { t: 9.67, k: 1 },
  ];
  const kb = (t) => 1 + 0.15 * Math.max(0, t - T_CUT) / (12 - T_CUT); // continuous Ken Burns push (relative)

  function frame(t) {
    if (t < T_CUT - 0.01) {
      dust.forEach((p) => (p.el.style.opacity = "0"));
      return;
    }
    let si = 0;
    for (let i = 0; i < SHOTS.length; i++) if (t >= fr(SHOTS[i].t0)) si = i;
    const S = SHOTS[si];
    const lt = t - S.t0;
    // slam punch-in (decaying) + impact jolt
    let punch = 0,
      jx = 0,
      jy = 0;
    SLAMS.forEach((s) => {
      const d = t - fr(s.t);
      if (d >= 0 && d < 1.2) {
        punch += 0.022 * s.k * Math.exp(-d * 7);
        const e = Math.exp(-d * 16) * s.k;
        jx += 11 * e * Math.sin(d * 83 + 0.6);
        jy += 8 * e * Math.sin(d * 71 + 2.1);
      }
    });
    const sc = S.s * kb(t) * (1 + punch);
    // handheld micro drift (deterministic sine sums)
    const hx = 4.2 * Math.sin(1.7 * t + 0.3) + 2.3 * Math.sin(3.9 * t + 1.7) + 1.0 * Math.sin(9.3 * t + 0.9);
    const hy = 3.4 * Math.sin(1.3 * t + 2.1) + 1.8 * Math.sin(4.4 * t + 0.5) + 0.8 * Math.sin(10.1 * t + 2.6);
    const rot = 0.14 * Math.sin(0.9 * t + 1) + 0.05 * Math.sin(2.7 * t);
    const cx = S.cx + S.vx * lt,
      cy = S.cy + S.vy * lt;
    let tx = 960 - cx * sc,
      ty = 540 - cy * sc;
    const m = 16; // keep the image covering the frame with room for shake/rotation
    tx = Math.min(-m, Math.max(1920 - 1920 * sc + m, tx));
    ty = Math.min(-m, Math.max(1080 - 1080 * sc + m, ty));
    shot.style.transform = `translate(${(tx + hx + jx).toFixed(2)}px, ${(ty + hy + jy).toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`;

    // tube light: hum + 2-frame dips; the light sags through the silence (10.1 → 11.7), dies on the last flicker
    let dip = false;
    for (const d of DIPS) if (t >= fr(d) && t < fr(d) + 2 * F) dip = true;
    const sag = t > 10.1 ? clamp((t - 10.1) / 1.6) : 0;
    const dead = t >= fr(11.7) + 2 * F;
    const hum = (0.9 + 0.06 * Math.sin(t * 23.0) + 0.04 * Math.sin(t * 57.0 + 1.3)) * (1 - 0.35 * sag);
    const L = dip ? 0.08 : dead ? 0.2 : hum;
    tube.style.opacity = L.toFixed(3);
    tubeCore.style.opacity = (dip ? 0.05 : dead ? 0.12 : (0.85 + 0.15 * Math.sin(t * 31)) * (1 - 0.3 * sag)).toFixed(3);
    beam.style.opacity = (dip ? 0.1 : dead ? 0.15 : 0.75 + 0.25 * hum).toFixed(3);
    let fade = 0.6 * sag * sag;
    if (dead) fade = 0.8 + 0.2 * clamp((t - 11.77) / 0.18);
    dark.style.opacity = Math.max(dip ? 0.7 : 0, fade).toFixed(3);

    // dust (re-seeded per shot so each cut reads as a new angle), slight parallax with the camera shake
    const dl = dip ? 0.35 : dead ? 0.2 : 1 - 0.5 * sag;
    const off = si * 613;
    dust.forEach((p, i) => {
      let x = p.x0 + off * (0.7 + (i % 5) * 0.13) + p.vx * t + p.wa * Math.sin(p.wf * t + p.ph) + (hx + jx) * p.z * 1.6;
      let y = p.y0 + si * 377 * (0.5 + (i % 3) * 0.3) + p.vy * t + p.wa * 0.6 * Math.cos(p.wf * 0.8 * t + p.ph) + (hy + jy) * p.z * 1.6;
      x = ((((x + 100) % 2120) + 2120) % 2120) - 100;
      y = ((((y + 100) % 1280) + 1280) % 1280) - 100;
      const inBeam = y < 620 && x > 380 && x < 1800 ? 1.7 : 0.8;
      const tw = 0.7 + 0.3 * Math.sin(2.1 * t * p.wf + p.ph * 3);
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      p.el.style.opacity = Math.min(1, p.a * inBeam * tw * dl).toFixed(3);
    });

    // props ride on the plate (handheld + jolt); type layer: impact shake only
    world.style.transform = `translate(${(hx + jx).toFixed(2)}px, ${(hy + jy).toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
    typeL.style.transform = `translate(${(jx * 0.9).toFixed(2)}px, ${(jy * 0.9).toFixed(2)}px)`;
  }
  PP.drive(tl, frame, 0, T_END, 0, T_END, "none");

  // ------------------------------------------------------------------ type helpers
  const X0 = 132; // left type column (all three phrases share it: the « Anyone can… » anaphora rhymes on screen)
  const phrase = (cls, parent) => PP.el("div", "s1-ph " + cls, parent || typeL);
  const line = (parent, cls) => PP.el("div", "s1-ln " + (cls || ""), parent);
  const word = (ln, text, cls) => {
    if (ln.childNodes.length) ln.appendChild(document.createTextNode(" "));
    return PP.el("span", "mf s1-w " + (cls || ""), ln, { text });
  };
  // a word said by the voice: hard on (1 frame) + tiny settle
  const say = (el, t0) => {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none", immediateRender: true }, fr(t0));
    tl.fromTo(el, { y: 12, filter: "blur(5px)" }, { y: 0, filter: "blur(0px)", duration: 6 * F, ease: "expo.out" }, fr(t0));
  };
  // manifesto slam: 1.15 -> 1 in ~4 frames with motion blur (impact shake is in the driver)
  const slam = (el, t0, s0) => {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none", immediateRender: true }, fr(t0));
    tl.fromTo(el, { scale: s0 || 1.15, filter: "blur(10px)" }, { scale: 1, filter: "blur(0px)", duration: 4 * F, ease: "power3.out" }, fr(t0));
  };
  const hold = (el, t0, t1, amt) => tl.fromTo(el, { scale: 1 }, { scale: 1 + (amt || 0.035), duration: t1 - t0, ease: "none", immediateRender: false }, t0);
  const cut = (el, at) => sw(el, 1, 0, fr(at));

  // shared SVG defs: ink roughness for the printed sticker and the rubber stamp (static seeds = deterministic)
  const defs = PP.svg("svg", { width: 0, height: 0, style: "position:absolute;width:0;height:0" }, pain);
  defs.innerHTML = `<defs>
    <filter id="s1-print-f" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="5" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" result="r"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -7 0 0 0 4.6" result="h"/>
      <feComposite in="r" in2="h" operator="in"/>
    </filter>
    <filter id="s1-ink-f" x="-4%" y="-8%" width="108%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="3" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="7" xChannelSelector="R" yChannelSelector="G" result="r"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="11" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -8 0 0 0 4.9" result="h"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="21" result="lo"/>
      <feColorMatrix in="lo" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -0.75" result="dens"/>
      <feComposite in="h" in2="dens" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="hd"/>
      <feComposite in="r" in2="hd" operator="in"/>
    </filter>
    <filter id="s1-paper-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="14"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.28  0 0 0 -1.4 1.05"/>
      <feComposite in2="SourceAlpha" operator="in"/>
    </filter>
    <linearGradient id="s1-paper-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3efe4"/><stop offset="0.55" stop-color="#e6e0d0"/><stop offset="1" stop-color="#cfc7b3"/>
    </linearGradient>
    <linearGradient id="s1-stk-shade-g" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.6" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/>
    </linearGradient>
    <linearGradient id="s1-curl-g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#fbf8f0"/><stop offset="0.5" stop-color="#d9d2c0"/><stop offset="1" stop-color="#a39a85"/>
    </linearGradient>
  </defs>`;

  // ------------------------------------------------------------------ P1 « Anyone can print 99% on a label. »
  const p1 = phrase("s1-p1");
  p1.style.left = X0 + "px";
  const l1a = line(p1, "s1-mid");
  const w1 = ["ANYONE", "CAN", "PRINT"].map((w) => word(l1a, w));
  [2.6, 2.83, 3.11].forEach((t, i) => say(w1[i], t));

  // the cheap sticker (prop in the world, below the dips/darkness): wrapper = position + cut, inner = the slap
  const STK = { fs: 300, padX: 66, padY: 58, x: X0 - 8, y: 492, rot: -5.5 };
  const SW_ = Math.round(measure("99%", STK.fs) + 2 * STK.padX),
    SH_ = Math.round(0.859 * STK.fs + 2 * STK.padY);
  const stk = PP.el("div", "s1-prop s1-stk", world);
  stk.style.cssText = `left:${STK.x}px;top:${STK.y}px;width:${SW_}px;height:${SH_}px;transform:rotate(${STK.rot}deg);`;
  const stkIn = PP.el("div", "s1-prop-in", stk);
  const stkShadow = PP.el("div", "s1-stk-shadow", stkIn);
  const stkSvg = PP.svg("svg", { width: SW_, height: SH_, viewBox: `0 0 ${SW_} ${SH_}` }, stkIn);
  const c = 34; // lifted corner
  const paperD = `M18 0 H${SW_ - c} L${SW_} ${c} V${SH_ - 18} Q${SW_} ${SH_} ${SW_ - 18} ${SH_} H18 Q0 ${SH_} 0 ${SH_ - 18} V18 Q0 0 18 0 Z`;
  const base = STK.padY + 0.859 * STK.fs;
  stkSvg.innerHTML = `
    <path d="${paperD}" fill="url(#s1-paper-g)"/>
    <path d="${paperD}" fill="#000" filter="url(#s1-paper-f)" opacity="0.6" style="mix-blend-mode:multiply"/>
    <path d="${paperD}" fill="url(#s1-stk-shade-g)"/>
    <rect x="22" y="22" width="${SW_ - 44}" height="${SH_ - 44}" rx="8" fill="none" stroke="#17171a" stroke-width="5" filter="url(#s1-print-f)"/>
    <text x="${SW_ / 2 + 5}" y="${base + 4}" text-anchor="middle" font-family="Anton" font-size="${STK.fs}" fill="#8f8a80" opacity="0.3">99%</text>
    <text x="${SW_ / 2}" y="${base}" text-anchor="middle" font-family="Anton" font-size="${STK.fs}" fill="#141417" filter="url(#s1-print-f)">99%</text>
    <path d="M${SW_ - c} 0 L${SW_} ${c} L${SW_ - c + 7} ${c - 7} Z" fill="url(#s1-curl-g)"/>`;
  tl.fromTo(stkIn, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none", immediateRender: true }, fr(3.39));
  tl.fromTo(stkIn, { scale: 1.5, rotation: -9, filter: "blur(8px)" }, { scale: 1, rotation: 0, filter: "blur(0px)", duration: 5 * F, ease: "power4.out" }, fr(3.39));
  tl.fromTo(stkShadow, { x: 34, y: 60, scale: 1.12, opacity: 0.35 }, { x: 8, y: 14, scale: 1, opacity: 0.7, duration: 5 * F, ease: "power3.out" }, fr(3.39));

  const l1c = PP.el("div", "s1-ln s1-mid s1-p1-tail", p1);
  l1c.style.left = STK.x + SW_ + 40 - X0 + "px";
  const w1c = ["ON", "A", "LABEL."].map((w) => word(l1c, w));
  [4.43, 4.69, 4.79].forEach((t, i) => say(w1c[i], t));
  hold(p1, 2.6, 5.8, 0.025);
  cut(p1, 5.8);
  cut(stk, 5.8);

  // ------------------------------------------------------------------ P2 « Anyone can say “lab tested.” »
  const p2 = phrase("s1-p2");
  p2.style.left = X0 + "px";
  const l2a = line(p2, "s1-mid");
  const w2 = ["ANYONE", "CAN", "SAY"].map((w) => word(l2a, w));
  [5.8, 6.02, 6.22].forEach((t, i) => say(w2[i], t));

  // rubber stamp (ink on the world)
  const STP = { fs: 212, pad: 46, x: X0 - 4, y: 468, rot: -6 };
  const stpTxt = "“LAB TESTED.”";
  const stpTW = measure(stpTxt, STP.fs);
  const PW = Math.round(stpTW + 2 * STP.pad + 24),
    PH = Math.round(0.859 * STP.fs + 2 * STP.pad + 24);
  const stp = PP.el("div", "s1-prop s1-stamp", world);
  stp.style.cssText = `left:${STP.x}px;top:${STP.y}px;width:${PW}px;height:${PH}px;transform:rotate(${STP.rot}deg);`;
  const stpIn = PP.el("div", "s1-prop-in", stp);
  PP.el("div", "s1-stamp-scrim", stpIn);
  const stpSvg = PP.svg("svg", { width: PW, height: PH, viewBox: `0 0 ${PW} ${PH}` }, stpIn);
  stpSvg.innerHTML = `<g filter="url(#s1-ink-f)" fill="none" stroke="#ff5b4d">
      <rect x="7" y="7" width="${PW - 14}" height="${PH - 14}" rx="16" stroke-width="12"/>
      <rect x="25" y="25" width="${PW - 50}" height="${PH - 50}" rx="6" stroke-width="4"/>
      <text x="${PW / 2}" y="${12 + STP.pad + 0.859 * STP.fs}" text-anchor="middle" font-family="Anton" font-size="${STP.fs}" fill="#ff5b4d" stroke="none" letter-spacing="${(STP.fs * 0.005).toFixed(2)}">${stpTxt}</text>
    </g>`;
  tl.fromTo(stpIn, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none", immediateRender: true }, fr(6.58));
  tl.fromTo(stpIn, { scale: 1.7, rotation: -5, filter: "blur(10px)" }, { scale: 1, rotation: 0, filter: "blur(0px)", duration: 4 * F, ease: "power4.out" }, fr(6.58));
  hold(p2, 5.8, 8.4, 0.025);
  cut(p2, 8.4);
  cut(stp, 8.4);

  // ------------------------------------------------------------------ P3 « Almost no one shows you the proof. »
  const p3 = phrase("s1-p3");
  p3.style.left = X0 + "px";
  const l3a = line(p3, "s1-mid");
  const l3b = line(p3, "s1-mid");
  const w3 = [word(l3a, "ALMOST"), word(l3a, "NO"), word(l3a, "ONE"), word(l3b, "SHOWS"), word(l3b, "YOU"), word(l3b, "THE")];
  [8.4, 8.63, 8.85, 9.09, 9.33, 9.53].forEach((t, i) => say(w3[i], t));
  const proof = word(line(p3, "s1-big s1-p3-big"), "PROOF.", "s1-hollow");
  slam(proof, 9.67, 1.18);
  hold(p3, 8.4, 11.7, 0.04);
  cut(p3, 11.7); // the last tube flicker kills the type; silence until the 12.00 hit
});
