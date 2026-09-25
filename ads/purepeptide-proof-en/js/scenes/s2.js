// s2 — TURN (11.95 → 17.20). Hard cut to black on the 12.00 hit, « WE DO. » slams (We 12.30 · do. 12.42) in the
// silence and holds on a slow push; 13.20 the riser is born under it: a neon line grows from the centre, « WE DO. »
// lifts off it and dissolves up (14.20), streaks accelerate inward, the hero vial emerges from the dark as a rim-lit
// silhouette with light sweeps (15.0 / 15.95 / 16.55) while the camera pushes in; 16.90 the light gathers,
// 17.00 DROP = flash + ring (s3 below). The silhouette lands on s3's first frame (vial centre (960, 560), 760 px,
// s3 camera scale 1.035, rig rotation -1.2°).
PP.scene("s2", function (tl, root, cam) {
  const F = PP.F;
  const DROP = 17.0;
  const T_RISE = 13.2; // riser born
  const T_OUT = 14.2; // « WE DO. » exits
  const fr = (t) => Math.floor(t * 30 + 1e-6) / 30 - 0.002; // frame on screen at t (2 ms early for robust seeks)
  const clamp = (x) => Math.max(0, Math.min(1, x));
  // s3's first frame: hero vial centred (960, 560), 760 px high, inside a camera scaled 1.035 about (960, 540)
  const VH = 760,
    VW = VH * PP.HERO_RATIO,
    VX = 960,
    VY = 560;
  const S3_CAM = 1.035,
    S3_ROT = -1.2;

  // ------------------------------------------------------------------ black (transparent until the 12.00 hit)
  const blk = PP.el("div", "s2-black", cam);
  // binary switches (repeated props -> fromTo, immediateRender:false)
  const sw = (el, a, b, at) => tl.fromTo(el, { opacity: a }, { opacity: b, duration: 0, ease: "none", immediateRender: false }, at);
  sw(blk, 0, 1, fr(12.0));

  const stage = PP.el("div", "s2-stage", cam);

  // ------------------------------------------------------------------ riser: glow, line, streaks, vial
  const halo = PP.el("div", "s2-halo", stage);
  const lineEl = PP.el("div", "s2-line", stage);
  PP.el("div", "s2-line-core", lineEl);
  const lineCore = lineEl.firstChild;
  const streakL = PP.el("div", "s2-streaks", stage);
  const rnd = PP.rng(4242);
  const streaks = [];
  for (let i = 0; i < 64; i++) {
    const el = PP.el("div", "s2-streak", streakL);
    const side = i % 2 ? 1 : -1;
    const spread = Math.pow(rnd(), 1.6) * 460 * (rnd() < 0.5 ? -1 : 1);
    streaks.push({ el, side, y0: VY + spread, ph: rnd(), rate: 0.55 + 0.6 * rnd(), len: 60 + 220 * rnd(), th: rnd() < 0.2 ? 2 : 1, a: 0.35 + 0.65 * rnd() });
  }
  // the vial lives in a "camera" that reproduces s3's opening camera (scale about (960, 540)) at 16.97
  const vcam = PP.el("div", "s2-vcam", stage);
  const vialW = PP.el("div", "s2-vial", vcam);
  vialW.style.left = VX - VW / 2 + "px";
  vialW.style.top = VY - VH / 2 + "px";
  vialW.style.width = VW + "px";
  vialW.style.height = VH + "px";
  const rim = PP.el("div", "s2-rim", vialW); // teal / blue silhouettes offset behind the glass = rim light
  const rimL = PP.el("div", "s2-rim-l", rim);
  const rimR = PP.el("div", "s2-rim-r", rim);
  const hv = PP.heroVial(vialW, VH);
  hv.el.style.left = hv.el.style.top = "0px";
  const sweep = PP.el("div", "s2-sweep", vialW);
  [rimL, rimR, sweep].forEach((el) => {
    el.style.webkitMaskImage = el.style.maskImage = `url("${PP.cfg.heroVial}")`;
    el.style.webkitMaskSize = el.style.maskSize = "100% 100%";
    el.style.webkitMaskRepeat = el.style.maskRepeat = "no-repeat";
  });

  // ------------------------------------------------------------------ type « WE DO. »
  const typeL = PP.el("div", "s2-type", stage);
  const lift = PP.el("div", "s2-lift", typeL); // riser lift + exit
  const we = PP.el("div", "s2-we", lift); // slow push
  const wW = PP.el("span", "mf s2-w", we, { text: "WE" });
  we.appendChild(document.createTextNode(" "));
  const wD = PP.el("span", "mf s2-w", we, { text: "DO." });
  const slam = (el, t0, s0) => {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none" }, fr(t0));
    tl.fromTo(el, { scale: s0 || 1.18, filter: "blur(14px)" }, { scale: 1, filter: "blur(0px)", duration: 4 * F, ease: "power3.out" }, fr(t0));
  };
  slam(wW, 12.3);
  slam(wD, 12.42, 1.14);
  tl.fromTo(we, { scale: 1 }, { scale: 1.06, duration: T_OUT + 0.3 - 12.3, ease: "none", immediateRender: false }, 12.3);
  // the light is born under the words: they lift off the line, then dissolve upward into the dark
  tl.fromTo(lift, { y: 0 }, { y: -190, duration: T_OUT - 13.05, ease: "sine.inOut", immediateRender: false }, 13.05);
  tl.fromTo(lift, { y: -190, opacity: 1, filter: "blur(0px)" }, { y: -270, opacity: 0, filter: "blur(16px)", duration: 0.34, ease: "power2.in", immediateRender: false }, T_OUT);

  // ------------------------------------------------------------------ driven clock (camera, riser, silhouette)
  const SL = [
    { t: 12.3, k: 1 },
    { t: 12.42, k: 0.85 },
  ];
  const vImg = hv.img;
  function frame(t) {
    // type camera: micro handheld + slam jolt
    let jx = 0,
      jy = 0;
    SL.forEach((s) => {
      const d = t - fr(s.t);
      if (d >= 0 && d < 1) {
        const e = Math.exp(-d * 15) * s.k;
        jx += 13 * e * Math.sin(d * 80 + 0.4);
        jy += 10 * e * Math.sin(d * 67 + 1.9);
      }
    });
    const hx = 2.2 * Math.sin(1.6 * t + 0.7) + 1.1 * Math.sin(4.1 * t + 2.2);
    const hy = 1.8 * Math.sin(1.2 * t + 1.4) + 0.9 * Math.sin(3.7 * t);
    typeL.style.transform = `translate(${(hx + jx).toFixed(2)}px, ${(hy + jy).toFixed(2)}px)`;

    // riser progress 13.2 -> 16.9 (accelerating after the music riser starts at 14.5), then gather 16.9 -> 17.0
    const u = clamp((t - T_RISE) / (16.9 - T_RISE));
    const g = clamp((t - 16.9) / 0.1);
    // neon line: grows from the centre, collapses into a hot point on the whoosh
    const lw = (70 + 1530 * Math.pow(u, 1.9)) * (1 - g * 0.92);
    const lh = 2 + 3 * u + 6 * g;
    lineEl.style.width = (u > 0 ? lw : 0).toFixed(1) + "px";
    lineEl.style.height = lh.toFixed(2) + "px";
    lineEl.style.transform = `translate(${(-lw / 2).toFixed(1)}px, ${(-lh / 2).toFixed(2)}px)`;
    lineEl.style.opacity = (u > 0 ? clamp(u * 8) * (0.6 + 0.4 * u) : 0).toFixed(3);
    lineCore.style.opacity = (0.55 + 0.45 * u).toFixed(3);
    halo.style.opacity = (Math.pow(u, 1.5) * 0.85 + g * 0.15).toFixed(3);
    halo.style.transform = `scale(${(0.6 + 0.5 * u - 0.25 * g).toFixed(3)})`;

    // streaks accelerate toward the centre (phase integral of an accelerating speed)
    const tau = Math.max(0, t - 13.6);
    const ph = 0.2 * tau + 0.075 * tau * tau * tau;
    const vis = t > 13.6 && t < DROP ? clamp((t - 13.6) / 1.2) : 0;
    streaks.forEach((s) => {
      if (!vis) {
        s.el.style.opacity = "0";
        return;
      }
      const p = (((s.ph + s.rate * ph) % 1) + 1) % 1;
      const k = Math.pow(1 - p, 1.4);
      const dist = 40 + 1000 * k;
      const x = VX + s.side * dist;
      const y = VY + (s.y0 - VY) * (0.25 + 0.75 * k) * (1 - g);
      const len = s.len * (0.5 + 1.8 * u + 2 * g);
      s.el.style.width = len.toFixed(1) + "px";
      s.el.style.height = s.th + "px";
      s.el.style.transform = `translate(${(s.side > 0 ? x : x - len).toFixed(1)}px, ${y.toFixed(1)}px)`;
      s.el.style.opacity = (vis * s.a * Math.sin(Math.PI * p) * (0.4 + 0.6 * u)).toFixed(3);
    });

    // hero vial silhouette: rim light first (13.9 →), body 14.3 → 15.4; rises and pushes in to s3's framing at 16.97
    const er = clamp((t - 13.9) / 0.9);
    const e = clamp((t - 14.3) / 1.1);
    const pk = clamp((t - 13.9) / (16.97 - 13.9));
    const ease = 1 - Math.pow(1 - pk, 1.7);
    const sc = 0.8 + 0.2 * ease;
    const yy = 70 * (1 - ease);
    const rot = S3_ROT * ease;
    vialW.style.opacity = Math.max(er * 0.55, e).toFixed(3);
    vialW.style.transform = `translateY(${yy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
    vcam.style.transform = `scale(${(1 + (S3_CAM - 1) * ease).toFixed(4)})`;
    const br = 0.07 + 0.06 * e + 0.1 * clamp((t - 16.2) / 0.77) + 0.3 * g;
    vImg.style.filter = `brightness(${br.toFixed(3)}) contrast(1.1)`;
    const rimA = er * (0.6 + 0.4 * u) + g * 0.3;
    rim.style.opacity = Math.min(1, rimA).toFixed(3);
    const rdx = 7 + 5 * u;
    rimL.style.transform = `translateX(${(-rdx).toFixed(2)}px)`;
    rimR.style.transform = `translateX(${rdx.toFixed(2)}px)`;
    // light sweeps across the glass (three passes, each faster — the riser accelerating into the drop)
    let sp = -40;
    if (t >= 15.0 && t < 15.75) sp = -30 + 160 * ((t - 15.0) / 0.75);
    else if (t >= 15.95 && t < 16.45) sp = -30 + 160 * ((t - 15.95) / 0.5);
    else if (t >= 16.55 && t < 16.92) sp = -30 + 160 * ((t - 16.55) / 0.37);
    sweep.style.setProperty("--p", sp.toFixed(1) + "%");
  }
  PP.drive(tl, frame, 11.95, 17.2, 11.95, 17.2 - 11.95, "none");

  // ------------------------------------------------------------------ DROP 17.00
  const fx = PP.layers.fx;
  const flash = PP.el("div", "s2-flash", fx);
  tl.fromTo(flash, { opacity: 0 }, { opacity: 0.35, duration: 2 * F, ease: "power2.in", immediateRender: false }, fr(DROP) - 2 * F);
  tl.fromTo(flash, { opacity: 0.92 }, { opacity: 0, duration: 8 * F, ease: "power2.out", immediateRender: false }, fr(DROP));
  PP.flashRing(tl, fx, DROP, { x: VX, y: VY });
  sw(stage, 1, 0, fr(DROP + 2 * F));
  sw(blk, 1, 0, fr(DROP + 2 * F));
});
