// S08 · the cart does the math → offer triad · window f849–f1030 (28.300–34.333 s) · iPhone rig + site + DOM modules · PAPER.
// SCENES §S08. Every PH call is added in time order (PH queries are pure functions of time built from the recorded calls).
//   f850–868  camera CART (g 2.0, (201,470) → (1290,540), expo.inOut 18 f). S07 masks "Let the cart / do the math." out f866–874.
//   t1        "+" tap #1 = VO.w('L12','Five') − 6 f, clamped f876–f890 · state t1+2 f: hard swap cart1 → cart2,
//             "Volume discount −5%" wipes in (8 f), ship bar 0.42 → 0.81 (14 f power3.out), message + line total roll (4 f)
//             module A FLIPs from the discount row to slot A (t1+4 f → +22 f, expo.inOut, content swap at 50 %)
//   t2        "+" tap #2 = VO.w('L13','EIGHT') − 6 f, clamped f922–f940 · state t2+2 f: cart2 → cart3 under a cart2
//             ship-card crop; bar 0.81 → 1.0 (#16A48F → #2BB58A); t2+16 f crop removed → real "Free shipping unlocked!"
//             card + teal ring burst; "−8%" row wipes in; line total rolls; module B FLIP (t2+4 f → +22 f)
//   tc        VO.w('L14','Free'), clamped f975–f995: module C FLIPs from the ship message; soft glow on the full bar (20 f)
//   f996–1020 camera WIDE (g 1.0, (201,437) → (1340,540), expo.inOut 24 f)
//   ta        VO.w('L15',0), clamped ≥ f1012: stamp rows A/B/C mask in (stagger 4 f), ✓ draws 8 f, then scale 1.06 → 1 (4 f)
// The modules live in #offers (stage level, z 40) so they survive this section's hide at f1030: S09 masks them out
// (f1052–f1066) through PP.S08.modules. Safety hide of #offers at f1086 (the NAVY world).
PP.scene("S08", function build(tl, root) {
  const F = PP.F, f = PP.f, C = PP.C;
  const E = (n) => gsap.parseEase(n);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const fx = (x) => x.toFixed(2);
  const fr = (t) => Math.round(t * 30 + 1e-6) / 30; // word-locked events snap to the frame grid
  const T0 = PP.IN("S08"), T1 = PP.OUT("S08");
  const WHITE = "#FFFFFF";

  // canvas metrics (fonts are loaded before any build): top of a line box (line-height lh) whose baseline is at y
  const cv = document.createElement("canvas").getContext("2d");
  const baseOff = (font, lh) => {
    cv.font = font;
    const m = cv.measureText("H");
    return (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
  };
  const capH = (font) => { cv.font = font; return cv.measureText("H").actualBoundingBoxAscent; };

  // ------------------------------------------------------------------ local helpers (rig overlays, page pt)
  // PH.press's patch is only 0.5 pt larger than the control: the control's anti-aliased rim stays visible around the
  // 0.97 sprite. Same local fix as S07: widen the patch by 1.5 pt.
  const press = (t, page, r, rad) => {
    const p = PH.press(tl, t, page, r, { radius: rad, bg: WHITE });
    const d = 1.5;
    Object.assign(p.patch.style, { left: r[0] - d + "px", top: r[1] - d + "px", width: r[2] + 2 * d + "px", height: r[3] + 2 * d + "px", borderRadius: rad + d + "px" });
    return p;
  };
  // Touch ring in PAGE space: PH.tap's ring is screen-level, so after the hard page swap (20 pt layout shift) it would
  // hang above the "+" it touched. The ring is drawn on the tapped page and continued, on the same curve, on the page that
  // replaces it at the "+" new position: ring, press sprite and button stay together. Same look as PH.tap.
  const tapRing = (t, page, X, Y) => {
    const ring = PP.el("div", "ps-tapr s8-tapr", PH.ov(page));
    ring.style.cssText += `;left:${X}px;top:${Y}px`;
    tl.set(ring, { opacity: 0, scale: 0.4 }, 0);
    tl.fromTo(ring, { scale: 0.4, opacity: 0.6 }, { scale: 1, opacity: 0, duration: 12 * F, ease: "power2.out", immediateRender: false }, t);
    return ring;
  };
  // Left→right wipe-in of a row that is already in the capture: a white patch over it whose feathered left edge runs off
  // to the right. Returns wp(t) = wipe progress (0..1), shared with the FLIP ghost so the copy matches the row.
  const FE = 14; // feather (pt)
  const wipeIn = (t0, page, r, dur, ease) => {
    const pad = 3;
    const W = r[2] + 2 * pad;
    const patch = PP.el("div", "s8-wipe", PH.ov(page), { style: `left:${r[0] - pad}px;top:${r[1] - pad}px;width:${W}px;height:${r[3] + 2 * pad}px;background:${WHITE};opacity:0` });
    const Ez = E(ease || "power3.out");
    const wp = (t) => Ez(clamp01((t - t0) / dur));
    tl.set(patch, { opacity: 0 }, 0);
    tl.set(patch, { opacity: 1 }, t0);
    PP.driveT(tl, (t) => {
      const e = lerp(0, W + FE, wp(t));
      PP.maskCss(patch, `linear-gradient(90deg, rgba(0,0,0,0) ${fx(e - FE)}px, #000 ${fx(e)}px)`);
    }, t0, t0 + dur);
    tl.set(patch, { opacity: 0 }, t0 + dur);
    return { patch, wp, x0: r[0] - pad };
  };
  // 4 f masked vertical roll: old value (crop of the previous capture) rolls up and out, the new one rolls in.
  const roll = (t0, page, rNew, oldPage, rOld, dur) => {
    const box = PP.el("div", "s8-roll", PH.ov(page), { style: `left:${rNew[0]}px;top:${rNew[1]}px;width:${rNew[2]}px;height:${rNew[3]}px;overflow:hidden;background:${WHITE};opacity:0` });
    const strip = PP.el("div", "s8-roll-strip", box, { style: "position:absolute;left:0;top:0" });
    const a = PH.crop(oldPage, rOld, { parent: strip });
    const b = PH.crop(page, rNew, { parent: strip });
    a.style.cssText += ";position:absolute;left:0;top:0";
    b.style.cssText += `;position:absolute;left:0;top:${rNew[3]}px`;
    tl.set(box, { opacity: 0 }, 0);
    tl.set(box, { opacity: 1 }, t0);
    tl.set(strip, { y: 0 }, 0);
    tl.fromTo(strip, { y: 0 }, { y: -rNew[3], duration: dur, ease: "power2.inOut", immediateRender: false }, t0);
    tl.set(box, { opacity: 0 }, t0 + dur);
    return box;
  };

  // ------------------------------------------------------------------ the offer modules (#offers, stage level, z 40)
  const stage = document.getElementById("stage");
  let offers = document.getElementById("offers");
  if (offers) offers.remove();
  offers = PP.el("div", "layer", stage, { id: "offers" });
  offers.style.cssText += ";z-index:40;pointer-events:none";
  tl.set(offers, { opacity: 0 }, 0);
  tl.set(offers, { opacity: 1 }, T0);
  tl.set(offers, { opacity: 0 }, f(1086)); // safety: the NAVY world (S09 masks the cards out f1052–f1066)

  const MX = 96, MW = 720, MH = 250, MR = 28;
  const FONT_LABEL = '600 26px "Inter"', FONT_NUM = '800 128px "DM Sans"';
  const offLabel = baseOff(FONT_LABEL, 26), offNum = baseOff(FONT_NUM, 128), capLabel = capH(FONT_LABEL);
  const SLOTS = [
    { id: "A", y: 140, label: "2 VIALS · SAME COMPOUND", num: "−5%" },
    { id: "B", y: 406, label: "3+ VIALS · SAME COMPOUND", num: "−8%" },
    { id: "C", y: 672, label: "FREE SHIPPING", num: "$200+" },
  ];
  const ST_TOP = 196, ST_H = 46, ICON = 32; // stamp mask box (card px): y 196..242, baseline 232
  const modules = SLOTS.map((S) => {
    const card = PP.el("div", "s8-card s8-card-" + S.id, offers);
    card.style.cssText = `position:absolute;left:${MX}px;top:${S.y}px;width:${MW}px;height:${MH}px;box-sizing:border-box;border-radius:${MR}px;` +
      `background:${WHITE};border:1px solid ${C.pLine};box-shadow:0 12px 32px rgba(22,35,63,.10);overflow:hidden;opacity:0`;
    const content = PP.el("div", "s8-content", card, { style: `position:absolute;left:-1px;top:-1px;width:${MW}px;height:${MH}px;transform-origin:0 0` });
    const label = PP.el("div", "s8-label", content, { text: S.label });
    label.style.cssText = `position:absolute;left:40px;top:${fx(60 - offLabel)}px;white-space:nowrap;font-family:var(--body);font-weight:600;font-size:26px;line-height:26px;letter-spacing:0.12em;color:${C.pInkSoft}`;
    const num = PP.el("div", "s8-num", content, { text: S.num });
    num.style.cssText = `position:absolute;left:40px;top:${fx(190 - offNum)}px;white-space:nowrap;font-family:var(--display);font-weight:800;font-size:128px;line-height:128px;letter-spacing:-0.02em;color:${C.callout}`;
    // stamp row: ✓ disc (SVG, U+2713 is in no font) + "APPLIED AUTOMATICALLY", masked in on L15
    const sm = PP.el("div", "s8-stamp-mask", content, { style: `position:absolute;left:40px;top:${ST_TOP}px;width:640px;height:${ST_H}px;overflow:hidden` });
    const si = PP.el("div", "s8-stamp", sm, { style: `position:absolute;left:0;top:0;width:640px;height:${ST_H}px` });
    const capMid = 232 - capLabel / 2 - ST_TOP;
    const icon = PP.svg("svg", { width: ICON, height: ICON, viewBox: "0 0 44 44", class: "s8-check" }, si);
    icon.style.cssText = `position:absolute;left:0;top:${fx(capMid - ICON / 2)}px;overflow:visible;transform-origin:50% 50%`;
    PP.svg("circle", { cx: 22, cy: 22, r: 22, fill: C.callout }, icon);
    const tick = PP.svg("path", { d: "M12.5 22.8 L19.2 29.4 L31.8 15.8", fill: "none", stroke: WHITE, "stroke-width": 4.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, icon);
    const st = PP.el("div", "s8-stamp-t", si, { text: "APPLIED AUTOMATICALLY" });
    st.style.cssText = `position:absolute;left:${ICON + 14}px;top:${fx(232 - offLabel - ST_TOP)}px;white-space:nowrap;font-family:var(--body);font-weight:600;font-size:26px;line-height:26px;letter-spacing:0.12em;color:${C.callout}`;
    // landing glint: a 105° light band crosses the numeral as the card seats (text-clipped copy, white over teal)
    const shine = PP.el("div", "s8-shine", content, { text: S.num, "data-qc-skip": "" });
    shine.style.cssText = num.style.cssText + ";color:transparent;-webkit-background-clip:text;background-clip:text;visibility:hidden";
    return { id: S.id, slot: { x: MX, y: S.y, w: MW, h: MH }, card, content, label, num, shine, stampMask: sm, stamp: si, icon, tick, stampText: st };
  });

  // FLIP: a copy of a site row (page crop) leaves the phone and becomes module m. The card's box interpolates from the
  // row's stage rect to its slot (expo.inOut, 18 f); the ghost crop scales with the card and fades out around 50 %, the
  // module content (scaled to the card width) fades in from 40 %, sharp at rest. The card lifts mid-flight (shadow).
  // o.arc (0..1): the box's top-left travels a quadratic Bézier whose control point is pulled from the straight midpoint
  // toward the corner (src.x, slot.y) — a gentle arc for A/B; for C a strong one (down beside the phone, then left into its
  // slot) so it does not cross module B.
  const flip = (m, tS, page, pr, o) => {
    o = o || {};
    const dur = 18 * F, Ez = E("expo.inOut");
    const scr = PH.pageScreen(page, pr[0], pr[1], tS);
    const src = PH.stageRect([scr.x, scr.y, pr[2], pr[3]], tS);
    const s0 = PH.stage(scr.x, scr.y, tS).s;
    const PX = 12, PY = 8;
    const A = { x: src.x - PX, y: src.y - PY, w: src.w + 2 * PX, h: src.h + 2 * PY, r: 10 };
    const B = { x: m.slot.x, y: m.slot.y, w: m.slot.w, h: m.slot.h, r: MR };
    const ghost = PH.crop(page, pr, { parent: m.card, cls: "s8-ghost" });
    ghost.style.cssText += `;position:absolute;left:0;top:0;transform-origin:0 0;z-index:2`;
    tl.set(m.card, { opacity: 0 }, 0);
    tl.set(m.card, { opacity: 1 }, tS);
    PP.driveT(tl, (t) => {
      const u = Ez(clamp01((t - tS) / dur));
      const arc = o.arc || 0;
      const qx = lerp((A.x + B.x) / 2, A.x, arc), qy = lerp((A.y + B.y) / 2, B.y, arc);
      const x = (1 - u) * (1 - u) * A.x + 2 * u * (1 - u) * qx + u * u * B.x;
      const y = (1 - u) * (1 - u) * A.y + 2 * u * (1 - u) * qy + u * u * B.y;
      const w = lerp(A.w, B.w, u), h = lerp(A.h, B.h, u);
      const k = w / A.w; // card growth (width)
      const cs = m.card.style;
      cs.left = fx(x) + "px"; cs.top = fx(y) + "px"; cs.width = fx(w) + "px"; cs.height = fx(h) + "px";
      cs.borderRadius = fx(lerp(A.r, B.r, u)) + "px";
      // pick-up: expo.inOut barely moves for its first ~6 f, so the copy would sit on the row as a flat white double.
      // It is lifted off the page at once instead (time-based, 3 f): border + a tight contact shadow, which then
      // opens into the flight shadow (sin lift) and settles into the module's rest shadow.
      const pk = smooth((t - tS) / (3 * F)) * (1 - smooth(u / 0.5));
      const bA = Math.max(smooth(u / 0.3), pk);
      cs.borderColor = `rgba(230,235,242,${bA.toFixed(3)})`;
      const lift = Math.max(Math.sin(Math.PI * u), pk * 0.55);
      cs.boxShadow = u >= 1 ? "0 12px 32px rgba(22,35,63,.10)" :
        `0 ${fx(12 * bA + 20 * lift)}px ${fx(32 * bA + 28 * lift)}px rgba(22,35,63,${(0.10 * bA + 0.07 * lift + 0.06 * pk).toFixed(3)})`;
      // ghost: the row, scaled with the card, anchored at the card's padding
      const gs = s0 * k;
      const go = 1 - smooth((u - 0.28) / 0.16);
      ghost.style.transform = `translate(${fx(PX * k - 1)}px, ${fx(PY * k - 1)}px) scale(${gs.toFixed(4)})`;
      ghost.style.opacity = go.toFixed(3);
      ghost.style.visibility = go <= 0.001 ? "hidden" : "visible";
      if (o.wp) {
        const p = o.wp(t);
        const e = lerp(0, pr[2] + 6 + FE, p) - 3; // the row's wipe edge, in ghost pt
        PP.maskCss(ghost, p >= 1 ? "none" : `linear-gradient(90deg, #000 ${fx(e - FE)}px, rgba(0,0,0,0) ${fx(e)}px)`);
      }
      // module content: scaled to the card width, fades in from 40 % to 85 % (brief, faint overlap with the ghost leaving by 44 %), blur settles to 0 (sharp at rest)
      const c = w / MW;
      const co = smooth((u - 0.40) / 0.45); // still settling (opacity < 0.9, soft) while the card is < 0.92 of its size: the 26 px labels are never shown sharp under 24 px
      m.content.style.transform = c >= 0.9999 ? "none" : `scale(${c.toFixed(4)})`;
      m.content.style.opacity = co.toFixed(3);
      m.content.style.filter = co >= 0.999 ? "none" : `blur(${fx((1 - co) * 6)}px)`;
    }, tS, tS + dur);
    // the glint rides the last 4 f of the seat and runs 16 f past it (power2.inOut)
    const g0 = tS + dur - 4 * F, gd = 16 * F;
    tl.set(m.shine, { visibility: "hidden" }, 0);
    tl.set(m.shine, { visibility: "visible" }, g0);
    PP.drive(tl, (x) => {
      m.shine.style.backgroundImage = `linear-gradient(105deg, rgba(255,255,255,0) ${fx(x - 14)}%, rgba(255,255,255,.55) ${fx(x)}%, rgba(255,255,255,0) ${fx(x + 14)}%)`;
    }, -20, 120, g0, gd, "power2.inOut");
    tl.set(m.shine, { visibility: "hidden" }, g0 + gd);
    return { tS, tE: tS + dur, src, ghost };
  };

  // ================================================================== 1. camera CART (f850–f868)
  PH.cam(tl, f(850), 18 * F, "CART", "expo.inOut");

  // ================================================================== 2. "+" tap #1 → cart2 (−5 %) → module A
  const t1 = fr(PP.clamp(VO.w("L12", "Five") - 6 * F, f(876), f(890), "S08 '+' tap #1"));
  const s1 = t1 + 2 * F;
  tapRing(t1, "cart1", 226, 510); // screen (226,572) at s 0
  tapRing(t1, "cart2", 226, 530);
  press(t1, "cart1", [211, 495, 30, 30], 7);
  press(t1, "cart2", [211, 515, 30, 30], 7); // the press continues on the swapped page (same curve)
  PH.show(tl, s1, "cart2", 0); // a real browser updates instantly: hard swap, the 20 pt layout shift is not animated
  const wA = wipeIn(s1, "cart2", [117, 453, 138, 16], 8 * F);
  PH.barFill(tl, s1, 14 * F, "cart2", PH.BAR.frac.cart1, PH.BAR.frac.cart2, C.siteTeal, C.siteTeal);
  roll(s1, "cart2", [58, 256, 232, 28], "cart1", [58, 256, 232, 28], 4 * F); // "$115.01 away" → "$38.52 away"
  roll(s1, "cart2", [292, 553, 80, 28], "cart1", [292, 533, 80, 28], 4 * F); // $84.99 → $161.48
  const fA = flip(modules[0], t1 + 4 * F, "cart2", [117, 453, 138, 16], { wp: wA.wp, arc: 0.35 });

  // ================================================================== 3. "+" tap #2 → cart3 (−8 %, free shipping) → module B
  const t2 = fr(PP.clamp(VO.w("L13", "EIGHT") - 6 * F, f(922), f(940), "S08 '+' tap #2"));
  const s2 = t2 + 2 * F, tFull = t2 + 16 * F;
  tapRing(t2, "cart2", 226, 530); // screen (226,592) at s 0
  tapRing(t2, "cart3", 226, 530);
  press(t2, "cart2", [211, 515, 30, 30], 7);
  press(t2, "cart3", [211, 515, 30, 30], 7);
  PH.show(tl, s2, "cart3", 0);
  // the cart2 ship card (and the band around it, which hides cart3's teal glow) stays on top until the bar is full
  const shipOld = PH.crop("cart2", [0, 225, 402, 113], { parent: PH.ov("cart3"), cls: "s8-shipold" });
  shipOld.style.cssText += ";left:0;top:225px";
  tl.set(shipOld, { opacity: 0 }, 0);
  tl.set(shipOld, { opacity: 1 }, s2);
  tl.set(shipOld, { opacity: 0 }, tFull);
  PH.barFill(tl, s2, 14 * F, "cart3", PH.BAR.frac.cart2, PH.BAR.frac.cart3, C.siteTeal, C.barGreen, { until: tFull });
  // unlock: the real cart3 card (teal outline, "Free shipping unlocked!") + a teal ring burst, spread 0 → 10, α .35 → 0, 12 f
  const burst = PP.el("div", "s8-burst", PH.ov("cart3"), { style: "left:20px;top:240.88px;width:362px;height:76.8px;border-radius:14px;opacity:0" });
  tl.set(burst, { opacity: 0 }, 0);
  tl.set(burst, { opacity: 1 }, tFull);
  PP.drive(tl, (v) => {
    burst.style.boxShadow = `0 0 0 ${fx(10 * v)}px rgba(22,164,143,${(0.35 * (1 - v)).toFixed(3)})`;
  }, 0, 1, tFull, 12 * F, "power2.out");
  tl.set(burst, { opacity: 0 }, tFull + 12 * F);
  const wB = wipeIn(s2, "cart3", [117, 453, 139, 16], 8 * F);
  roll(s2, "cart3", [292, 553, 80, 28], "cart2", [292, 553, 80, 28], 4 * F); // $161.48 → $234.57
  const fB = flip(modules[1], t2 + 4 * F, "cart3", [117, 453, 139, 16], { wp: wB.wp, arc: 0.35 });

  // ================================================================== 4. free shipping → module C + bar glow
  const tc = fr(PP.clamp(VO.w("L14", "Free"), f(975), f(995), "S08 module C"));
  const fC = flip(modules[2], tc, "cart3", [62, 259, 161, 22], { arc: 0.9 });
  const glow = PP.el("div", "s8-glow", PH.ov("cart3"), { style: `left:${PH.BAR.x}px;top:${PH.BAR.y}px;width:${PH.BAR.w}px;height:${PH.BAR.h}px;border-radius:${PH.BAR.r}px;box-shadow:0 0 20px rgba(43,181,138,.45);opacity:0` });
  tl.set(glow, { opacity: 0 }, 0);
  tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 20 * F, ease: "power2.out", immediateRender: false }, tc);

  // "Over $200": a light sweep runs along the full bar on the voice's "$200" (fills the hold before module C)
  const tSw = fr(PP.clamp(VO.w("L14", "$200"), tFull + 12 * F, tc - 20 * F, "S08 bar sweep"));
  const swBox = PP.el("div", "s8-barsweep", PH.ov("cart3"), { style: `left:${PH.BAR.x}px;top:${PH.BAR.y}px;width:${PH.BAR.w}px;height:${PH.BAR.h}px;border-radius:${PH.BAR.r}px;overflow:hidden` });
  const swEl = PP.sweep(tl, swBox, tSw, tSw + 20 * F, -15, 115, 0.65, { angle: 100, half: 12, ease: "sine.inOut" });
  Object.assign(swEl.style, { left: "0", top: "0", width: "100%", height: "100%" }); // .layer is stage-sized: fit the bar

  // ================================================================== 5. camera WIDE (f996–f1020)
  const tW = f(996);
  if (fC.tE - tW > 6 * F + 1e-6) console.warn(`[S08] camera WIDE overlaps module C's FLIP by ${PP.toF(fC.tE - tW)} f (> 6)`);
  PH.cam(tl, tW, 24 * F, "WIDE", "expo.inOut");

  // ================================================================== 6. "Applied automatically." — three stamps
  const ta = fr(PP.clamp(VO.w("L15", 0), f(1012), T1, "S08 stamps"));
  const tStamp = modules.map((_, i) => ta + i * 4 * F);
  modules.forEach((m, i) => {
    const t = tStamp[i];
    PP.maskLine(tl, m.stamp, t);
    PP.draw(tl, [m.tick], t + 2 * F, 8 * F, { ease: "power2.inOut" });
    tl.set(m.icon, { scale: 1 }, 0);
    tl.fromTo(m.icon, { scale: 1.06 }, { scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, t + 10 * F);
  });

  PP.S08 = {
    offers, modules, // modules[i] = { id, slot:{x,y,w,h}, card, content, label, num, stampMask, stamp, icon, tick, stampText }
    taps: [PP.toF(t1), PP.toF(t2)], states: [PP.toF(s1), PP.toF(s2)], unlock: PP.toF(tFull),
    flips: { A: [PP.toF(fA.tS), PP.toF(fA.tE)], B: [PP.toF(fB.tS), PP.toF(fB.tE)], C: [PP.toF(fC.tS), PP.toF(fC.tE)] },
    stamps: tStamp.map(PP.toF), stampsDone: PP.toF(tStamp[2] + 14 * F), camCart: [850, 868], camWide: [996, 1020],
  };
});
