// s2 — TURN (11.95 → 17.20). Hard cut to black on the 12.00 hit, « NOUS AUSSI. » in silence, « Alors on a fait
// autrement. », then the riser: a neon line grows from the centre, streaks accelerate inward, the hero vial emerges
// as a rim-lit silhouette and the camera pushes in; 16.90 the light gathers, 17.00 DROP = flash + ring (s3 below).
PP.scene("s2", function (tl, root, cam) {
  const F = PP.F;
  const DROP = 17.0;
  const fr = (t) => Math.floor(t * 30 + 1e-6) / 30 - 0.002; // frame on screen at t (2 ms early for robust seeks)
  // s3's first frame: hero vial fully lit, centred (960, 560), 760 px high
  const VH = 760,
    VW = VH * PP.HERO_RATIO,
    VX = 960,
    VY = 560;

  // ------------------------------------------------------------------ black (transparent until the 12.00 hit)
  const blk = PP.el("div", "s2-black", cam);
  // binary switches (repeated props -> fromTo, immediateRender:false)
  const sw = (el, a, b, at) => tl.fromTo(el, { opacity: a }, { opacity: b, duration: 0, ease: "none", immediateRender: false }, at);
  sw(blk, 0, 1, fr(12.0));

  const stage = PP.el("div", "s2-stage", cam);

  // ------------------------------------------------------------------ riser: glow, line, streaks, vial
  const halo = PP.el("div", "s2-halo", stage);
  const lineEl = PP.el("div", "s2-line", stage);
  const lineCore = PP.el("div", "s2-line-core", lineEl);
  const streakL = PP.el("div", "s2-streaks", stage);
  const rnd = PP.rng(4242);
  const streaks = [];
  for (let i = 0; i < 64; i++) {
    const el = PP.el("div", "s2-streak", streakL);
    const side = i % 2 ? 1 : -1;
    const spread = Math.pow(rnd(), 1.6) * 460 * (rnd() < 0.5 ? -1 : 1);
    streaks.push({ el, side, y0: VY + spread, ph: rnd(), rate: 0.55 + 0.6 * rnd(), len: 60 + 220 * rnd(), th: rnd() < 0.2 ? 2 : 1, a: 0.35 + 0.65 * rnd() });
  }
  const vialW = PP.el("div", "s2-vial", stage);
  vialW.style.left = VX - VW / 2 + "px";
  vialW.style.top = VY - VH / 2 + "px";
  vialW.style.width = VW + "px";
  vialW.style.height = VH + "px";
  const hv = PP.heroVial(vialW, VH);
  hv.el.style.left = hv.el.style.top = "0px";
  const sweep = PP.el("div", "s2-sweep", vialW);
  sweep.style.webkitMaskImage = sweep.style.maskImage = `url("${PP.cfg.heroVial}")`;
  sweep.style.webkitMaskSize = sweep.style.maskSize = "100% 100%";

  // ------------------------------------------------------------------ type
  const typeL = PP.el("div", "s2-type", stage);
  const nous = PP.el("div", "s2-nous", typeL);
  const wN = PP.el("span", "mf s2-w", nous, { text: "NOUS" });
  nous.appendChild(document.createTextNode(" "));
  const wA = PP.el("span", "mf s2-w", nous, { text: "AUSSI." });
  const slam = (el, t0, s0) => {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0, ease: "none" }, fr(t0));
    tl.fromTo(el, { scale: s0 || 1.15, filter: "blur(12px)" }, { scale: 1, filter: "blur(0px)", duration: 4 * F, ease: "power3.out" }, fr(t0));
  };
  slam(wN, 12.34);
  slam(wA, 12.48);
  tl.fromTo(nous, { scale: 1 }, { scale: 1.045, duration: 13.6 - 12.34, ease: "none", immediateRender: false }, 12.34);
  sw(nous, 1, 0, fr(13.6));

  const alors = PP.voHeadline(tl, typeL, "L6", ["Alors on a fait *autrement.*"], "s2-alors", { lead: F, rise: 12, blur: 8, dur: 0.45 });
  tl.fromTo(alors.el, { scale: 1 }, { scale: 1.035, duration: 2.0, ease: "none", immediateRender: false }, 13.6);
  PP.textOut(tl, alors.el, 15.6, { dur: 0.35 });

  // ------------------------------------------------------------------ driven clock (camera, riser, silhouette)
  const SL = [
    { t: 12.34, k: 1 },
    { t: 12.48, k: 0.8 },
  ];
  const vImg = hv.img;
  function frame(t) {
    // type camera: slow push + micro handheld + slam jolt
    let jx = 0,
      jy = 0;
    SL.forEach((s) => {
      const d = t - fr(s.t);
      if (d >= 0 && d < 1) {
        const e = Math.exp(-d * 15) * s.k;
        jx += 12 * e * Math.sin(d * 80 + 0.4);
        jy += 9 * e * Math.sin(d * 67 + 1.9);
      }
    });
    const hx = 2.2 * Math.sin(1.6 * t + 0.7) + 1.1 * Math.sin(4.1 * t + 2.2);
    const hy = 1.8 * Math.sin(1.2 * t + 1.4) + 0.9 * Math.sin(3.7 * t);
    typeL.style.transform = `translate(${(hx + jx).toFixed(2)}px, ${(hy + jy).toFixed(2)}px)`;

    // riser progress 14.5 -> 16.9, then gather 16.9 -> 17.0
    const u = Math.max(0, Math.min(1, (t - 14.5) / 2.4));
    const g = Math.max(0, Math.min(1, (t - 16.9) / 0.1));
    // neon line: grows from the centre, collapses into a hot point on the whoosh
    const lw = (80 + 1520 * Math.pow(u, 1.8)) * (1 - g * 0.92);
    const lh = 2 + 3 * u + 6 * g;
    lineEl.style.width = (u > 0 ? lw : 0).toFixed(1) + "px";
    lineEl.style.height = lh.toFixed(2) + "px";
    lineEl.style.transform = `translate(${(-lw / 2).toFixed(1)}px, ${(-lh / 2).toFixed(2)}px)`;
    lineEl.style.opacity = (u > 0 ? Math.min(1, u * 4) * (0.55 + 0.45 * u) : 0).toFixed(3);
    lineCore.style.opacity = (0.5 + 0.5 * u).toFixed(3);
    halo.style.opacity = (Math.pow(u, 1.4) * 0.85 + g * 0.15).toFixed(3);
    halo.style.transform = `scale(${(0.6 + 0.5 * u - 0.25 * g).toFixed(3)})`;

    // streaks accelerate toward the centre (phase integral of an accelerating speed)
    const tau = Math.max(0, t - 14.5);
    const ph = 0.25 * tau + 0.16 * tau * tau * tau;
    const vis = u > 0 && t < DROP ? Math.min(1, u * 2.5) : 0;
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

    // hero vial silhouette: emerges 14.8 -> 15.8, pushes in to scale 1.000 exactly at 16.97
    const e = Math.max(0, Math.min(1, (t - 14.8) / 1.0));
    const pk = Math.max(0, Math.min(1, (t - 14.8) / (16.97 - 14.8)));
    const sc = 0.86 + 0.14 * (1 - Math.pow(1 - pk, 1.6));
    const yy = 26 * (1 - pk);
    vialW.style.opacity = (e * e).toFixed(3);
    vialW.style.transform = `translateY(${yy.toFixed(2)}px) scale(${sc.toFixed(4)})`;
    const br = 0.09 + 0.09 * Math.max(0, Math.min(1, (t - 16.2) / 0.77)) + 0.3 * g;
    const rim = 0.55 + 0.45 * u;
    vImg.style.filter = `brightness(${br.toFixed(3)}) drop-shadow(0 0 1.5px rgba(46,230,201,${rim.toFixed(3)})) drop-shadow(0 0 16px rgba(46,230,201,${(rim * 0.55).toFixed(3)}))`;
    // light sweep across the glass (two passes, the second faster, right before the drop)
    let sp = -40;
    if (t >= 15.75 && t < 16.45) sp = -30 + 160 * ((t - 15.75) / 0.7);
    else if (t >= 16.55 && t < 16.95) sp = -30 + 160 * ((t - 16.55) / 0.4);
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
