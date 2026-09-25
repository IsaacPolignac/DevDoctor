// s2 (4.10 → 8.30) — « Chez PurePeptide, chaque lot part dans un laboratoire indépendant. »
// Seen through the counter of the « o » of s1 (circle clip 4.10→4.233, same expo curve as s1's zoom), camera
// settles 1.15 → 1. Brand chip 4.83 (pop), pill « Chaque lot » 5.37 (pop), the vial shrinks and travels along a
// neon dotted path 5.85 (whoosh), lab card grows out of a pill 6.29 (pop), « Indépendant » check 6.91 (tick),
// push toward the card 7.30→8.00, FLASH #1 at 8.00 on the card; s2 content hidden at 8.067.
PP.scene("s2", function (tl, root, cam) {
  const F = PP.F;
  const S12 = PP.s12 || {};
  const O = S12.o || { x: 590, y: 600, r: 14, A: 120, at: 4.1 };

  const drift = PP.el("div", "s2-layer", cam);
  const headL = PP.el("div", "s2-layer", drift);
  const push = PP.el("div", "s2-layer", drift);
  const back = PP.el("div", "s2-layer", push);

  // ------------------------------------------------ reveal through the « o » (circle clip on cam)
  PP.drive(
    tl,
    (v) => {
      if (v >= O.A - 1e-3) cam.style.clipPath = "none";
      else cam.style.clipPath = `circle(${(O.r * v).toFixed(2)}px at ${O.x.toFixed(1)}px ${O.y.toFixed(1)}px)`;
    },
    1,
    O.A,
    O.at,
    4 * F,
    "expo.in"
  );
  // camera: settle from the zoom (origin = the « o »), then a slow constant lateral drift
  tl.set(drift, { transformOrigin: `${O.x}px ${O.y}px` }, 0);
  tl.fromTo(drift, { scale: 1.16 }, { scale: 1, duration: 1.1, ease: "expo.out" }, 4.1);
  const DX0 = -10,
    DX1 = 10;
  tl.fromTo(drift, { x: DX0 }, { x: DX1, duration: 4.2, ease: "none" }, 4.1);
  const driftAt = (t) => DX0 + ((DX1 - DX0) * (t - 4.1)) / 4.2;

  // ------------------------------------------------ headline (top zone)
  const h = PP.voHeadline(tl, headL, "L3", ["Chez *PurePeptide*,", "chaque lot part dans", "un *laboratoire* *indépendant.*"], "h2 s2-h");
  h.el.style.cssText = "position:absolute;left:0;right:0;top:300px";
  tl.set(headL, { transformOrigin: "540px 400px" }, 0);
  tl.fromTo(headL, { scale: 1 }, { scale: 1.035, duration: 3.9, ease: "none" }, 4.1);

  // ------------------------------------------------ background depth
  const glow = PP.el("div", "s2-vglow", back);
  tl.fromTo(glow, { opacity: 0.6, scale: 0.9 }, { opacity: 1, scale: 1.05, duration: 1.7, ease: "sine.inOut" }, 4.1);
  tl.to(glow, { opacity: 0, duration: 0.4, ease: "power2.in" }, 5.85);
  if (S12.bokeh) S12.bokeh(tl, back, 23, 18, 4.1, 8.3);

  // ------------------------------------------------ neon dotted path (vial → lab)
  const CARD = { x: 540, y: 900, w: 720, h: 300 };
  const cardL = CARD.x - CARD.w / 2,
    cardT = CARD.y - CARD.h / 2;
  const PILL = { dx: 30, dy: 105, w: 220, h: 90 };
  const pEnd = { x: cardL + PILL.dx + PILL.w / 2, y: cardT + PILL.dy + PILL.h / 2 };
  const V0 = { x: 540, y: 1200 }; // vial centre
  const svg = PP.svg("svg", { width: 1080, height: 1920, viewBox: "0 0 1080 1920", class: "s2-path" }, push);
  const mid = PP.uid("s2m");
  const defs = PP.svg("defs", {}, svg);
  const mask = PP.svg("mask", { id: mid, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 1080, height: 1920 }, defs);
  const d = `M${V0.x} ${V0.y} C ${V0.x} 1480, 150 1480, 170 1210 S ${pEnd.x - 120} ${pEnd.y + 10}, ${pEnd.x} ${pEnd.y}`;
  const reveal = PP.svg("path", { d, fill: "none", stroke: "#fff", "stroke-width": 40, "stroke-linecap": "round" }, mask);
  const g = PP.svg("g", { mask: `url(#${mid})` }, svg);
  PP.svg("path", { d, fill: "none", stroke: "rgba(46,230,201,0.18)", "stroke-width": 10, "stroke-linecap": "round" }, g);
  const dots = PP.svg("path", { d, fill: "none", stroke: PP.C.neon, "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": "0 22", class: "s2-dots" }, g);
  PP.draw(tl, reveal, 5.78, 0.5, { ease: "power3.inOut" });
  PP.drive(tl, (v) => dots.setAttribute("stroke-dashoffset", v.toFixed(1)), 0, -330, 5.78, 2.3, "none");
  tl.fromTo(svg, { opacity: 1 }, { opacity: 0.55, duration: 0.8, ease: "power1.inOut", immediateRender: false }, 6.4);

  // ------------------------------------------------ hero vial (centred, on the halo)
  const vPos = PP.el("div", "s2-vpos", push);
  const vAnim = PP.el("div", "s2-vanim", vPos);
  const v = S12.vial ? S12.vial(vAnim, 700) : PP.heroVial(vAnim, 700);
  v.el.style.left = V0.x - v.width / 2 + "px";
  v.el.style.top = V0.y - v.height / 2 + "px";
  v.el.classList.add("s2-vial");
  tl.set(vAnim, { transformOrigin: `${V0.x}px ${V0.y}px` }, 0);
  tl.fromTo(vAnim, { scaleX: 0.95, rotation: -2.5, y: 16 }, { scaleX: 1, rotation: 1.5, y: -10, duration: 1.75, ease: "sine.inOut" }, 4.1);
  if (S12.vialLife) S12.vialLife(tl, v, 4.1, 1.8);
  // travel along the path 5.82 → 6.30: shrink, motion blur mid-flight, dive into the pill
  const path = dots;
  const LEN = path.getTotalLength();
  PP.drive(
    tl,
    (k) => {
      const p = path.getPointAtLength(LEN * k);
      const s = 1 - 0.74 * k;
      const blur = Math.sin(Math.PI * k) * 7;
      vPos.style.transform = `translate(${(p.x - V0.x).toFixed(2)}px, ${(p.y - V0.y).toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${(-18 * Math.sin(Math.PI * k)).toFixed(2)}deg)`;
      vPos.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
    },
    0,
    1,
    5.85 - F,
    0.48,
    "power3.inOut"
  );
  vPos.style.transformOrigin = `${V0.x}px ${V0.y}px`;
  tl.fromTo(vAnim, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.4, duration: 5 * F, ease: "power2.in", immediateRender: false }, 6.24);

  // ------------------------------------------------ brand chip on « PurePeptide » (4.83 pop)
  const chip = PP.el("div", "s2-chip", push);
  PP.symbol(chip, 44);
  PP.logo(chip, { width: 260 });
  const chipSheen = PP.el("div", "s2-chip-sheen", chip);
  tl.fromTo(chip, { opacity: 0, scale: 0.6, y: 24, filter: "blur(8px)" }, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "back.out(2.2)" }, 4.83 - F);
  PP.drive(tl, (p) => chipSheen.style.setProperty("--p", p.toFixed(1) + "%"), -30, 140, 4.9, 0.7, "power2.inOut");

  // ------------------------------------------------ pill « Chaque lot » attached to the vial (5.37 pop)
  const lotWrap = PP.el("div", "s2-lotwrap", push);
  const tether = PP.el("div", "s2-tether", lotWrap);
  const lot = PP.pill(lotWrap, "Chaque lot");
  lot.classList.add("s2-lot");
  const box = PP.svg("svg", { width: 40, height: 40, viewBox: "0 0 40 40", class: "s2-box" }, lot);
  lot.insertBefore(box, lot.firstChild);
  ["M20 4 L35 11.5 L35 28.5 L20 36 L5 28.5 L5 11.5 Z", "M5 11.5 L20 19 L35 11.5", "M20 19 L20 36", "M12.5 7.8 L27.5 15.3"].forEach((pd) =>
    PP.svg("path", { d: pd, fill: "none", stroke: PP.C.neon, "stroke-width": 2.6, "stroke-linejoin": "round", "stroke-linecap": "round" }, box)
  );
  tl.fromTo(lot, { opacity: 0, scale: 0.5, x: -40, filter: "blur(8px)" }, { opacity: 1, scale: 1, x: 0, filter: "blur(0px)", duration: 0.45, ease: "back.out(2)" }, 5.37 - F);
  tl.fromTo(tether, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.25, ease: "expo.out" }, 5.37 - F);
  tl.fromTo(lotWrap, { opacity: 1, y: 0, filter: "blur(0px)" }, { opacity: 0, y: -40, filter: "blur(10px)", duration: 0.18, ease: "power2.in", immediateRender: false }, 5.8);

  // ------------------------------------------------ lab card grows out of a pill (6.29 pop)
  const persp = PP.el("div", "s2-layer s2-persp", push);
  persp.style.perspectiveOrigin = `${CARD.x}px ${CARD.y}px`;
  const tilt = PP.el("div", "s2-layer", persp);
  tilt.style.transformOrigin = `${CARD.x}px ${CARD.y}px`;
  const pill0 = PP.el("div", "s2-pill0", tilt);
  pill0.style.cssText = `left:${cardL + PILL.dx}px;top:${cardT + PILL.dy}px;width:${PILL.w}px;height:${PILL.h}px`;
  tl.fromTo(pill0, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.14, ease: "back.out(2.5)" }, 6.2);
  tl.fromTo(pill0, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "power1.out", immediateRender: false }, 6.32);

  const card = PP.neonCard(tilt, { x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h, radius: 28 });
  card.el.classList.add("s2-card");
  card.el.style.opacity = "0";
  tl.fromTo(card.el, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, 6.29 - F);
  PP.morphFromPill(tl, card.el, CARD.w, CARD.h, PILL, 6.29 - F);
  tl.fromTo(card.el, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: "back.out(1.6)", immediateRender: false }, 6.29 - F);

  const ic = PP.el("div", "s2-ic", card.body);
  const fl = PP.svg("svg", { width: 76, height: 76, viewBox: "0 0 64 64" }, ic);
  const flask = [
    "M23 6 H41",
    "M27 6 V25 L11.5 50.5 Q8.5 57 16 57 H48 Q55.5 57 52.5 50.5 L37 25 V6",
    "M17.5 41 H46.5",
  ].map((pd) => PP.svg("path", { d: pd, fill: "none", stroke: PP.C.neon, "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, fl));
  const bub = [
    [28, 48, 2.6],
    [36, 45, 2],
    [33, 51, 1.6],
  ].map(([x, y, r]) => PP.svg("circle", { cx: x, cy: y, r, fill: PP.C.neon }, fl));
  PP.draw(tl, flask, 6.36, 0.5, { stagger: 0.06, ease: "power2.out" });
  tl.fromTo(bub, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.07, ease: "back.out(2)" }, 6.7);
  PP.drive(tl, (y) => bub.forEach((b, i) => b.setAttribute("transform", `translate(0 ${(-((y + i * 5) % 9)).toFixed(2)})`)), 0, 30, 6.9, 1.1, "none");
  tl.fromTo(ic, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" }, 6.32);

  const title = PP.el("div", "s2-title", card.body, { text: "Laboratoire indépendant" });
  const sub = PP.el("div", "s2-sub", card.body, { text: PP.cfg.lab });
  PP.wordIn(tl, title, 6.36, { rise: 18 });
  PP.wordIn(tl, sub, 6.5, { rise: 14 });

  const badge = PP.el("div", "s2-badge", card.body);
  const bLit = PP.el("div", "s2-badge-lit", badge);
  const chk = PP.checkIcon(badge, 38, PP.C.neon);
  const bTxt = PP.el("span", "s2-badge-txt", badge, { text: "Indépendant" });
  tl.fromTo(badge, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "expo.out" }, 6.58);
  // tick 6.91: badge lights neon, check draws
  tl.fromTo(bLit, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, 6.91 - F);
  tl.fromTo(chk.svg, { opacity: 0.35 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, 6.91 - F);
  tl.fromTo(bTxt, { color: PP.C.inkSoft }, { color: PP.C.ink, duration: 0.001, ease: "none", immediateRender: false }, 6.91 - F);
  tl.fromTo(chk.tick, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.22, ease: "power2.out", immediateRender: false }, 6.91 - F);
  tl.set(chk.tick, { drawSVG: "0%" }, 0);
  tl.fromTo(badge, { scale: 1 }, { scale: 1.1, duration: 0.08, ease: "power2.out", immediateRender: false }, 6.91 - F);
  tl.fromTo(badge, { scale: 1.1 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, 6.91 + 2 * F);
  const cardSheen = PP.el("div", "s2-card-sheen", card.el);
  PP.drive(tl, (p) => cardSheen.style.setProperty("--p", p.toFixed(1) + "%"), -30, 140, 6.9, 0.7, "power2.inOut");

  // 3D life of the card, then lift + push toward it (7.30 → 8.00)
  tl.fromTo(tilt, { rotationY: -14, rotationX: 8 }, { rotationY: -4, rotationX: 3, duration: 1.0, ease: "power3.out" }, 6.29);
  tl.fromTo(tilt, { rotationY: -4, rotationX: 3, scale: 1 }, { rotationY: 9, rotationX: -7, scale: 1.05, duration: 0.7, ease: "power2.inOut", immediateRender: false }, 7.3);
  tl.set(push, { transformOrigin: `${CARD.x}px ${CARD.y}px` }, 0);
  tl.fromTo(push, { scale: 1 }, { scale: 1.25, duration: 0.7, ease: "power2.in", immediateRender: false }, 7.3);
  tl.fromTo(chip, { opacity: 1 }, { opacity: 0.0, duration: 0.5, ease: "power1.in", immediateRender: false }, 7.35);

  // FLASH #1 at 8.00 on the card's on-screen centre (drift x at 8.00; push & tilt keep the centre fixed)
  PP.flashRing(tl, PP.layers.fx, 8.0, { x: CARD.x + driftAt(8.0), y: CARD.y, target: card.el });
  tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.001, ease: "none", immediateRender: false }, 8.0 + 2 * F);
});
