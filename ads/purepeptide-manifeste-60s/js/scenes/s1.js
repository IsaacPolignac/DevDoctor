// s1 — PAIN (0.00 → 12.10). The AI still (dusty unlabeled vials under a fluorescent tube) shot as 3 "camera
// angles" (hard cuts 4.20 / 8.00), cold grade, Ken Burns push + handheld micro-drift, dust in the beam, tube
// flicker dips on the SOUND-EVENT TABLE, manifesto type slamming on Paul K's stressed words.
// Every continuous state (camera, shake, flicker, dust) is a pure function of one driven clock `t`.
PP.scene("s1", function (tl, root, cam) {
  const F = PP.F;
  const T_END = 12.1;
  // the 30 fps frame on screen when an event at t is heard (applied 2 ms early so seeks land robustly)
  const fr = (t) => Math.floor(t * 30 + 1e-6) / 30 - 0.002;

  // ------------------------------------------------------------------ plate (the still)
  const plate = PP.el("div", "s1-plate", cam);
  const shot = PP.el("div", "s1-shot", plate);
  PP.el("img", "s1-img", shot, { src: PP.cfg.fakeShelf, alt: "" });
  const tube = PP.el("div", "s1-tube", shot); // extra glow on the fluorescent tube (image coords)
  const tubeCore = PP.el("div", "s1-tube-core", shot);
  const beam = PP.el("div", "s1-beam", shot); // soft light cone under the tube
  PP.el("div", "s1-tint", plate); // cold grade
  PP.el("div", "s1-scrim", plate); // edge darkening for type legibility

  // ------------------------------------------------------------------ dust
  const dustL = PP.el("div", "s1-dust", cam);
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
  const dark = PP.el("div", "s1-dark", cam);

  // ------------------------------------------------------------------ type
  const typeL = PP.el("div", "s1-type", cam);

  // shots: image point (cx, cy) is framed at screen centre; base scale; slow pan velocity (px/s, image coords)
  const SHOTS = [
    { t0: 0.0, cx: 1000, cy: 520, s: 1.05, vx: -4, vy: 2 }, // wide
    { t0: 4.2, cx: 1150, cy: 690, s: 1.5, vx: 6, vy: -3 }, // tighter, the crowded middle of the shelf
    { t0: 8.0, cx: 770, cy: 640, s: 1.62, vx: -5, vy: -4 }, // tight, open vials front-left under the light
  ];
  const DIPS = [0.35, 1.9, 2.05, 4.4, 6.7, 6.8, 9.3, 10.9, 11.0, 11.3];
  const SLAMS = [
    { t: 1.54, k: 1 },
    { t: 1.92, k: 0.35 },
    { t: 4.3, k: 1 },
    { t: 4.6, k: 0.55 },
    { t: 6.9, k: 1 },
    { t: 9.52, k: 1 },
    { t: 10.0, k: 0.6 },
  ];
  const kb = (t) => 1 + (0.17 / 1.05) * (t / 12); // continuous Ken Burns 1.05 -> 1.22 over 12 s (relative)

  function frame(t) {
    let si = 0;
    for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].t0 - 0.0005) si = i;
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

    // tube light: hum + 2-frame dips
    let dip = false;
    for (const d of DIPS) if (t >= fr(d) && t < fr(d) + 2 * F) dip = true;
    const hum = 0.9 + 0.06 * Math.sin(t * 23.0) + 0.04 * Math.sin(t * 57.0 + 1.3);
    const L = dip ? 0.08 : hum;
    tube.style.opacity = L.toFixed(3);
    tubeCore.style.opacity = (dip ? 0.05 : 0.85 + 0.15 * Math.sin(t * 31)).toFixed(3);
    beam.style.opacity = (dip ? 0.1 : 0.75 + 0.25 * hum).toFixed(3);
    let fade = 0;
    if (t > 11.0) fade = Math.pow(Math.min(1, (t - 11.0) / 0.9), 1.5);
    dark.style.opacity = Math.max(dip ? 0.7 : 0, fade).toFixed(3);

    // dust (re-seeded per shot so each cut reads as a new angle), slight parallax with the camera shake
    const dl = dip ? 0.35 : 1;
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

    // type layer: impact shake only
    typeL.style.transform = `translate(${(jx * 0.9).toFixed(2)}px, ${(jy * 0.9).toFixed(2)}px)`;
  }
  PP.drive(tl, frame, 0, T_END, 0, T_END, "none");

  // ------------------------------------------------------------------ type helpers
  const phrase = (cls) => PP.el("div", "s1-ph " + cls, typeL);
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
  const cut = (el, at) => tl.set(el, { opacity: 0 }, fr(at));

  // ---- P1 « Vous en avez marre, hein ? » — centred
  const p1 = phrase("s1-p1");
  const l1a = line(p1, "s1-small");
  const w1 = ["VOUS", "EN", "AVEZ"].map((w) => word(l1a, w));
  [0.7, 1.16, 1.36].forEach((t, i) => say(w1[i], t));
  const l1b = line(p1, "s1-big s1-p1-big");
  const marre = word(l1b, "MARRE");
  const q = PP.el("span", "mf s1-w s1-q", l1b, { text: "?" });
  slam(marre, 1.54);
  slam(q, 1.92, 1.3);
  hold(p1, 0.7, 2.76, 0.03);
  cut(p1, 2.76);

  // ---- P2 « Marre des peptides vendus par de faux labos. » — left, low
  const p2 = phrase("s1-p2");
  const l2a = line(p2, "s1-mid");
  const l2b = line(p2, "s1-mid");
  const l2c = line(p2, "s1-big s1-p2-big");
  const w2 = [word(l2a, "MARRE"), word(l2a, "DES"), word(l2a, "PEPTIDES"), word(l2b, "VENDUS"), word(l2b, "PAR"), word(l2b, "DE")];
  [2.76, 3.06, 3.16, 3.6, 3.98, 4.18].forEach((t, i) => say(w2[i], t));
  slam(word(l2c, "FAUX"), 4.3);
  slam(word(l2c, "LABOS."), 4.6, 1.1);
  hold(p2, 2.76, 5.53, 0.03);
  cut(p2, 5.53);

  // ---- P3 « Des analyses… que personne ne montre. » — right, high
  const p3 = phrase("s1-p3");
  const l3a = line(p3, "s1-mid");
  const l3b = line(p3, "s1-big s1-p3-big");
  const l3c = line(p3, "s1-mid");
  const w3 = [word(l3a, "DES"), word(l3a, "ANALYSES…"), word(l3a, "QUE")];
  [5.53, 5.76, 6.18].forEach((t, i) => say(w3[i], t));
  slam(word(l3b, "PERSONNE"), 6.9);
  const w3c = [word(l3c, "NE"), word(l3c, "MONTRE.")];
  [7.3, 7.58].forEach((t, i) => say(w3c[i], t));
  hold(p3, 5.53, 8.43, 0.03);
  cut(p3, 8.43);

  // ---- P4 « Des fioles… sans aucune preuve. » — centred, stacked, the heaviest
  const p4 = phrase("s1-p4");
  const l4a = line(p4, "s1-mid");
  const w4 = [word(l4a, "DES"), word(l4a, "FIOLES…"), word(l4a, "SANS")];
  [8.43, 8.5, 8.92].forEach((t, i) => say(w4[i], t));
  slam(word(line(p4, "s1-big s1-p4-big"), "AUCUNE"), 9.52);
  const l4c = line(p4, "s1-big s1-p4-big");
  const preuve = word(l4c, "PREUVE.");
  slam(preuve, 10.0, 1.12);
  const rule = PP.el("div", "s1-rule", p4);
  tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "expo.out" }, 10.18);
  hold(p4, 8.43, 11.3, 0.04);
  cut(p4, 11.3); // the last tube flicker kills the type; silence until the 12.00 hit
});
