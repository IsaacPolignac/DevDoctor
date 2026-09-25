// s6 — clip 17.80 → 22.20 · VO L7 « Six références, expédiées sous 24 heures, vers 10 pays. »
// 18.000…18.417 six vials slam in (one every 2.5 f, pop each) as a curved fan with depth ·
// 18.9–19.3 the fan recedes to a compact row at the bottom · 19.35 pop « Expédition sous 24 h » card (clock) ·
// 20.35 pop wireframe globe + pill « Livraison vers 10 pays » · 21.85 whoosh: zoom-into-camera exit.
PP.scene("s6", function (tl, root, cam) {
  const F = PP.F;
  const C = PP.C;

  // cam = exit move (zoom into camera) · stage = constant slow drift
  const stage = PP.el("div", "s6-stage", cam);
  tl.fromTo(stage, { scale: 1, y: 10, x: -6 }, { scale: 1.045, y: -14, x: 6, duration: 4.05, ease: "sine.inOut", immediateRender: false }, 17.8);
  tl.set(stage, { scale: 1, y: 10, x: -6 }, 0);

  // ---------------------------------------------------------------- background depth
  const bg = PP.el("div", "s6-bg", stage);
  const glow = PP.el("div", "s6-glow", bg);
  const rnd = PP.rng(606);
  for (let i = 0; i < 16; i++) {
    const s = 6 + rnd() * 26;
    const b = PP.el("div", "s6-bokeh", bg);
    b.style.cssText = `left:${(rnd() * 1080).toFixed(0)}px;top:${(200 + rnd() * 1500).toFixed(0)}px;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;opacity:${(0.18 + rnd() * 0.4).toFixed(2)};filter:blur(${(s / 6).toFixed(1)}px)`;
    tl.fromTo(b, { y: 0 }, { y: -(60 + rnd() * 120), duration: 4.4, ease: "none", immediateRender: false }, 17.8);
  }
  tl.fromTo(glow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, 17.95);
  tl.set(glow, { opacity: 0 }, 0);

  // ---------------------------------------------------------------- headline (VO L7)
  const hWrap = PP.el("div", "s6-hl", stage);
  const h = PP.voHeadline(tl, hWrap, "L7", ["*Six* références,", "expédiées sous *24* heures,", "vers *10* pays."], "h3");
  h.el.style.cssText = "position:absolute;left:0;right:0;top:282px";

  // ---------------------------------------------------------------- the six vials: a curved fan with depth
  const floor = PP.el("div", "s6-floor", stage);
  const group = PP.el("div", "s6-group", stage);
  const X = [-345, -215, -75, 75, 215, 345];
  const HH = [370, 425, 480, 480, 425, 370];
  const BOT = [1172, 1200, 1226, 1226, 1200, 1172];
  const ROT = [-6.5, -3.8, -1.2, 1.2, 3.8, 6.5];
  const Z = [1, 2, 3, 4, 2, 1];
  const DIM = [0.78, 0.9, 1, 1, 0.9, 0.78];
  const slam = [18.0, 18.0 + 2.5 * F, 18.0 + 5 * F, 18.0 + 7.5 * F, 18.0 + 10 * F, 18.0 + 12.5 * F];
  const ORDER = [0, 5, 1, 4, 2, 3]; // outer pair first, then inwards: the fan closes on the centre
  PP.cfg.catalog.forEach((p, i) => {
    const hgt = HH[i];
    const w = hgt * PP.VIAL_RATIO;
    const item = PP.el("div", "s6-v", group);
    item.style.cssText = `left:${540 + X[i] - w / 2}px;top:${BOT[i] - hgt}px;width:${w}px;height:${hgt}px;z-index:${Z[i]}`;
    const halo = PP.el("div", "s6-v-halo", item);
    const refl = PP.el("div", "s6-v-refl", item);
    PP.el("img", "", refl, { src: p.img, alt: "" });
    const v = PP.vial(item, p.img, hgt);
    v.el.style.left = "0px";
    v.el.style.top = "0px";
    v.img.style.filter = `brightness(${DIM[i]}) drop-shadow(0 0 1.5px rgba(150,255,238,0.95)) drop-shadow(0 0 18px rgba(46,230,201,0.42)) drop-shadow(0 30px 40px rgba(0,0,0,0.6))`;
    const shock = PP.el("div", "s6-v-shock", item);
    const t = slam[ORDER.indexOf(i)];
    gsap.set(item, { rotation: ROT[i], transformOrigin: "50% 85%" });
    // slam: big + blurred -> hits its spot exactly on the pop, tiny bounce after
    tl.fromTo(item, { scale: 1.65, y: -40, filter: "blur(16px)" }, { scale: 0.94, y: 0, filter: "blur(0px)", duration: 3 * F, ease: "power2.in", immediateRender: false }, t - 3 * F);
    tl.fromTo(item, { scale: 0.94 }, { scale: 1, duration: 0.32, ease: "back.out(3)", immediateRender: false }, t);
    tl.fromTo(item, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, t - 3 * F);
    tl.set(item, { opacity: 0 }, 0);
    tl.fromTo(shock, { scale: 0.3, opacity: 0.95 }, { scale: 1.9, opacity: 0, duration: 0.42, ease: "power2.out", immediateRender: false }, t);
    tl.set(shock, { opacity: 0 }, 0);
    tl.fromTo(halo, { opacity: 1, scaleX: 1.5 }, { opacity: 0.55, scaleX: 1, duration: 0.5, ease: "power2.out", immediateRender: false }, t);
    tl.set(halo, { opacity: 0 }, 0);
    // floor flares on every hit
    tl.fromTo(floor, { opacity: 1 }, { opacity: 0.55, duration: 0.25, ease: "power2.out", immediateRender: false }, t);
    // idle life: each vial breathes a little out of phase
    tl.fromTo(v.el, { y: 0 }, { y: -7, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: 2, immediateRender: false }, 18.55 + i * 0.09);
  });
  tl.set(floor, { opacity: 0 }, 0);
  // group: slight 3D sway, then recedes to a compact row at the bottom (y ~1515) to make room
  gsap.set(group, { transformOrigin: "540px 1000px", transformPerspective: 1500 });
  tl.fromTo(group, { rotationY: -9, rotationX: 4 }, { rotationY: 7, rotationX: 0, duration: 3.9, ease: "sine.inOut", immediateRender: false }, 17.9);
  tl.fromTo(group, { scale: 1, y: 0 }, { scale: 0.64, y: 515, duration: 0.45, ease: "power3.inOut", immediateRender: false }, 18.88);
  tl.fromTo(floor, { scale: 1, y: 0 }, { scale: 0.64, y: 395, duration: 0.45, ease: "power3.inOut", immediateRender: false }, 18.88);
  tl.fromTo(glow, { y: 0 }, { y: 120, duration: 0.45, ease: "power3.inOut", immediateRender: false }, 18.88);

  // ---------------------------------------------------------------- 19.35 card « Expédition sous 24 h »
  const card = PP.neonCard(stage, { x: 540, y: 752, w: 760, h: 176, radius: 30 });
  card.el.classList.add("s6-card");
  const row = PP.el("div", "s6-card-row", card.body);
  const S = 112;
  const clk = PP.svg("svg", { width: S, height: S, viewBox: "0 0 112 112", class: "s6-clock" }, row);
  PP.svg("circle", { cx: 56, cy: 56, r: 50, fill: "rgba(46,230,201,0.07)", stroke: "rgba(255,255,255,0.14)", "stroke-width": 2 }, clk);
  const arc = PP.svg("circle", { cx: 56, cy: 56, r: 50, fill: "none", stroke: C.neon, "stroke-width": 4, "stroke-linecap": "round", transform: "rotate(-90 56 56)" }, clk);
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const r0 = k % 3 ? 40 : 36;
    PP.svg("line", { x1: 56 + r0 * Math.sin(a), y1: 56 - r0 * Math.cos(a), x2: 56 + 44 * Math.sin(a), y2: 56 - 44 * Math.cos(a), stroke: k % 3 ? "rgba(243,246,250,0.35)" : C.ink, "stroke-width": k % 3 ? 2 : 3, "stroke-linecap": "round" }, clk);
  }
  const hourH = PP.svg("line", { x1: 56, y1: 56, x2: 56, y2: 32, stroke: C.ink, "stroke-width": 5, "stroke-linecap": "round" }, clk);
  const minH = PP.svg("line", { x1: 56, y1: 60, x2: 56, y2: 18, stroke: C.neon, "stroke-width": 3.5, "stroke-linecap": "round" }, clk);
  PP.svg("circle", { cx: 56, cy: 56, r: 4.5, fill: C.neon }, clk);
  const txt = PP.el("div", "s6-card-txt", row, { html: PP.fr("Expédition sous ") + '<span class="grad">24 h</span>' });
  const sheen = PP.el("div", "s6-card-sheen", card.el);
  gsap.set(card.el, { transformPerspective: 1200, transformOrigin: "50% 50%" });
  tl.fromTo(card.el, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, 19.35 - 2 * F);
  tl.set(card.el, { opacity: 0 }, 0);
  tl.fromTo(card.el, { scale: 0.62, y: 50, rotationX: 38, filter: "blur(10px)" }, { scale: 1, y: 0, rotationX: 0, filter: "blur(0px)", duration: 0.55, ease: "back.out(1.9)", immediateRender: false }, 19.35 - 2 * F);
  tl.fromTo(minH, { rotation: 0 }, { rotation: 1440, svgOrigin: "56 56", duration: 0.85, ease: "power3.out", immediateRender: false }, 19.35);
  tl.fromTo(hourH, { rotation: 0 }, { rotation: 480, svgOrigin: "56 56", duration: 0.85, ease: "power3.out", immediateRender: false }, 19.35);
  gsap.set([minH, hourH], { svgOrigin: "56 56" });
  PP.draw(tl, arc, 19.35, 0.85, { ease: "power3.out" });
  tl.set(arc, { drawSVG: "0%" }, 0);
  tl.fromTo(txt, { x: 26, opacity: 0, filter: "blur(6px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "expo.out", immediateRender: false }, 19.35 + 2 * F);
  tl.set(txt, { opacity: 0 }, 0);
  tl.fromTo(sheen, { xPercent: -130 }, { xPercent: 130, duration: 0.7, ease: "power2.inOut", immediateRender: false }, 19.5);
  tl.fromTo(card.el, { y: 0 }, { y: -8, duration: 2.2, ease: "sine.inOut", immediateRender: false }, 19.9);

  // ---------------------------------------------------------------- 20.35 globe + pill « Livraison vers 10 pays »
  const gWrap = PP.el("div", "s6-globe", stage);
  const GS = 380;
  gWrap.style.cssText = `left:${540 - GS / 2}px;top:${1068 - GS / 2}px;width:${GS}px;height:${GS}px`;
  PP.el("div", "s6-globe-glow", gWrap);
  const globe = PP.globe(gWrap, GS, { meridians: 9 });
  // a generic orbit with a travelling light (no countries, no markers)
  const orb = PP.svg("svg", { width: 560, height: 560, viewBox: "-280 -280 560 560", class: "s6-orbit" }, gWrap);
  const og = PP.svg("g", { transform: "rotate(-18)" }, orb);
  PP.svg("ellipse", { cx: 0, cy: 0, rx: 250, ry: 70, fill: "none", stroke: "rgba(56,189,248,0.45)", "stroke-width": 1.6, "stroke-dasharray": "3 9", "stroke-linecap": "round" }, og);
  const dot = PP.svg("circle", { cx: 250, cy: 0, r: 7, fill: C.neon, class: "s6-orbit-dot" }, og);
  PP.drive(tl, (a) => {
    dot.setAttribute("cx", (250 * Math.cos(a)).toFixed(2));
    dot.setAttribute("cy", (70 * Math.sin(a)).toFixed(2));
    dot.setAttribute("opacity", Math.sin(a) > -0.15 ? "1" : "0.25");
  }, 0.4, 0.4 + Math.PI * 1.6, 20.35, 1.6, "power1.inOut");
  globe.spin(tl, 20.3, 1.8, 0.4);
  gsap.set(gWrap, { transformPerspective: 1200 });
  tl.fromTo(gWrap, { opacity: 0 }, { opacity: 1, duration: 3 * F, ease: "none", immediateRender: false }, 20.35 - 2 * F);
  tl.set(gWrap, { opacity: 0 }, 0);
  tl.fromTo(gWrap, { y: 170, scale: 0.55, filter: "blur(12px)" }, { y: 0, scale: 1, filter: "blur(0px)", duration: 0.6, ease: "back.out(1.5)", immediateRender: false }, 20.35 - 2 * F);

  const pillWrap = PP.el("div", "s6-pillwrap", stage);
  const pill = PP.pill(pillWrap, "Livraison vers 10 pays", { check: true, iconSize: 32 });
  pill.classList.add("s6-pill");
  tl.fromTo(pillWrap, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, 20.35 + F);
  tl.set(pillWrap, { opacity: 0 }, 0);
  tl.fromTo(pillWrap, { scale: 0.5, y: 40, filter: "blur(8px)" }, { scale: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "back.out(2.2)", immediateRender: false }, 20.35 + F);

  // ---------------------------------------------------------------- 21.85 exit: fast zoom into camera + blur
  gsap.set(cam, { transformOrigin: "540px 900px" });
  tl.fromTo(cam, { scale: 1, filter: "blur(0px)" }, { scale: 3.4, filter: "blur(26px)", duration: 0.2, ease: "expo.in", immediateRender: false }, 21.83);
  tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "power2.in", immediateRender: false }, 21.93);
  tl.set(cam, { scale: 1, opacity: 1, filter: "blur(0px)" }, 0);
});
