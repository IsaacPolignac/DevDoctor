// S05 · "Six compounds. One standard." → "Don't take our word for it." · window f532–f674 (17.733–22.467 s) · PAPER.
// SCENES §S05, re-timed to the real v4 VO (L08 "Six" ≈ f557, "one" ≈ f585, "standard." ≈ f599; L09 ≈ f625–f659):
//   series burst f532–f566 (fixed swap frames) → "Six compounds." per-word blur-in on L08 0/1 → split into six f566–f588
//   → masked swap to "One standard." on L08 'one' − 4 f → its underline draws, falls and widens into the shelf → the six land
//   → whip (row + headline to x −2000, horizontal blur, ≤ 2 px CA) while the shelf rises to the word baseline y 640
//   → word stream (spread evenly from the whip's end to f660, i.e. right over L09) → stall f660–f667 (the rule contracts to
//   a point) → "Purity, / proven." masked in at f667 in #type-h1 (z 40, under #stage) and handed to S06 at f674.
// Every word-locked time is read from VO.w() and clamped into the window; the rest is derived from those reads.
PP.scene("S05", function build(tl, root) {
  const F = PP.F, f = PP.f, C = PP.C;
  const $ = (s) => root.querySelector(s);
  const ease = (n) => gsap.parseEase(n);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fr = (t) => Math.round(t * 30) / 30; // snap word-locked events onto the frame grid
  const fx = (x) => x.toFixed(2);

  // ------------------------------------------------------------------ timing
  const T0 = f(532), T1 = f(674);
  const SWAP = [532, 536, 540, 544, 549, 555].map(f); // series burst (SFX #15 glass ticks), hold to f566
  const tSplit = f(566);
  const tSix = fr(PP.clamp(VO.w("L08", 0), f(546), f(566), "S05 'Six'"));
  const tComp = fr(PP.clamp(VO.w("L08", 1), tSix + 3 * F, f(572), "S05 'compounds'"));
  // "One standard." swap: a locked two-line reel inside the slot, 12 f expo.inOut, its fastest frame ON 'one'. The line is
  // then held ≥ 25 f before the whip (VO 'standard.' ≈ f599 is too late to also drive the underline and land the shelf).
  const tOne = fr(PP.clamp(VO.w("L08", "one") - 6 * F, f(570), f(588), "S05 'One standard.'"));
  const tDraw = tOne + 10 * F; // underline draws 7 f expo.out once the line has landed
  const tDrop = tOne + 14 * F; // underline → shelf, 12 f expo.inOut
  const tLand = tOne + 20 * F; // vials land, centre pair first, 2 f stagger, 8 f back.out(0.8)
  const tWhip = Math.min(f(612), tOne + 32 * F); // whip 6 f power3.in
  const tWhipE = tWhip + 6 * F;
  // stall (the rule alone, contracting to a point, 7 f) → "Purity, / proven.": two masked lines, 9 f power4.out, 2 f stagger,
  // started at f665 so the block is STATIC on S06's first frame (f674; the 2nd line is 0.5 px from rest there). Started at
  // f667 with 10 f + 3 f stagger, "proven." was still ~25 px low on f674, its descender cut by the mask, and still rising
  // into S06's hold (SCENES OUT state: static at f674).
  const tStall = f(658), tPP = f(665), PP_DUR = 9 * F, PP_STAG = 2 * F;
  // word stream: spread evenly between the whip's end and the stall (≈ 6.3 f per word, Don't-Blink exception)
  const WORDS = [["Identity.", 0], ["Purity.", 1], ["HPLC.", 0], ["99%.", 2], ["Tested.", 0], ["Cold.", 0], ["24h.", 0]];
  const tW = WORDS.map((_, k) => fr(tWhipE + ((tStall - tWhipE) * k) / WORDS.length));

  // ------------------------------------------------------------------ geometry
  const BASE_Y = 900; // vial base / shelf top
  const H0 = 520, H1 = 440, VR = 606 / 1240;
  const W0 = H0 * VR;
  const vx = (i) => (i - 2.5) * 220; // offset from x 960
  const RANK = [2, 1, 0, 0, 1, 2]; // centre outward
  const SHELF_W = 1320, WORD_Y = 640, LINE_H = 3;
  // DM Sans (hhea 992 / −310, upm 1000): with line-height = font-size the baseline sits 0.841 em below the box top
  const BL = 0.841;

  // ------------------------------------------------------------------ camera: x −20 px linear until the whip
  const cam = $(".s5-cam"), whip = $(".s5-whip");
  tl.fromTo(cam, { x: 0 }, { x: -20, duration: tWhip - T0, ease: "none", immediateRender: false }, T0);
  const driftAt = (t) => -20 * clamp01((t - T0) / (tWhip - T0));

  // ------------------------------------------------------------------ vials (series burst → split → lift → land)
  const row = $(".s5-row");
  const vials = PP.VIALS.map((name, i) => {
    const v = PP.el("div", "s5-v", row);
    v.style.cssText = `left:${fx(960 - W0 / 2)}px; top:${BASE_Y - H0}px; width:${fx(W0)}px; height:${H0}px; z-index:${i + 1}`;
    const shw = PP.el("div", "s5-shw", v);
    const sh = PP.el("div", "s5-sh", shw), ct = PP.el("div", "s5-ct", shw);
    sh.style.cssText = `width:${fx(W0 * 1.25)}px; height:40px; margin-left:${fx(-W0 * 0.625)}px; top:${H0 - 20}px`;
    ct.style.cssText = `width:${fx(W0 * 0.78)}px; height:12px; margin-left:${fx(-W0 * 0.39)}px; top:${H0 - 6}px`;
    const lift = PP.el("div", "s5-lift", v);
    PP.el("img", "", lift, { src: `assets/vials/${name}.png`, alt: "" });
    return { v, shw, sh, ct, lift };
  });
  // burst: one slot, only the product changes (hard swaps); at the split all six are stacked (Semax on top)
  vials.forEach((o, i) => {
    tl.set(o.v, { opacity: 0 }, 0);
    tl.set(o.v, { opacity: 1 }, SWAP[i]);
    if (i < 5) tl.set(o.v, { opacity: 0 }, SWAP[i + 1]);
    if (i < 5) tl.set(o.v, { opacity: 1 }, tSplit);
    // the stacked copies' shadows would darken the floor: fade them in as the stack opens
    if (i < 5) tl.fromTo(o.shw, { opacity: 0 }, { opacity: 1, duration: 6 * F, ease: "none", immediateRender: false }, tSplit);
  });
  // hand-off upgrade: S04's light white-out RESOLVES into the first vial instead of a hard pop on f532. The row is
  // over-exposed (brightness 2.6: label, crimp and shadow blown to near paper, cap pale) and develops back to 1 over 8 f
  // expo.out, a mirror of S04's v-cold brightness 1→6. The f536+ swaps stay hard cuts on an already-settled exposure.
  tl.set(row, { filter: "brightness(2.6)" }, 0);
  tl.fromTo(row, { filter: "brightness(2.6)" }, { filter: "brightness(1)", duration: 8 * F, ease: "expo.out", immediateRender: false }, T0);
  tl.set(row, { filter: "none" }, T0 + 8 * F);
  const S1 = H1 / H0;
  vials.forEach((o, i) => {
    const t = tSplit + RANK[i] * 2 * F;
    tl.fromTo(o.v, { x: 0, scale: 1 }, { x: vx(i), scale: S1, duration: 18 * F, ease: "expo.inOut", immediateRender: false }, t);
    // lift −24 px (in 440 px space) as they part, so they can be set down on the shelf
    tl.fromTo(o.lift, { y: 0 }, { y: -24 / S1, duration: 18 * F, ease: "power2.inOut", immediateRender: false }, t);
    tl.fromTo([o.sh, o.ct], { scaleX: 1, scaleY: 1 }, { scaleX: 1.25, scaleY: 0.8, duration: 18 * F, ease: "power2.inOut", immediateRender: false }, t);
    tl.fromTo(o.ct, { opacity: 1 }, { opacity: 0.15, duration: 18 * F, ease: "power2.inOut", immediateRender: false }, t);
    // land: y −24 → 0, 8 f back.out(0.8), centre pair first
    const tl0 = tLand + RANK[i] * 2 * F;
    tl.fromTo(o.lift, { y: -24 / S1 }, { y: 0, duration: 8 * F, ease: "back.out(0.8)", immediateRender: false }, tl0);
    tl.fromTo([o.sh, o.ct], { scaleX: 1.25, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 6 * F, ease: "expo.out", immediateRender: false }, tl0 + 2 * F);
    tl.fromTo(o.ct, { opacity: 0.15 }, { opacity: 1, duration: 6 * F, ease: "expo.out", immediateRender: false }, tl0 + 2 * F);
  });

  // ------------------------------------------------------------------ headline slot (cap top y 150)
  const CAP = 0.7, HS = 96;
  const lineTop = 150 + CAP * HS - BL * HS; // line box top for a cap top at y 150
  const PAD_T = 12, PAD_B = 26;
  const head = $(".s5-head");
  head.style.top = fx(lineTop - PAD_T) + "px";
  head.style.height = HS + PAD_T + PAD_B + "px";
  const hA = $(".s5-hl-a"), hB = $(".s5-hl-b");
  hA.style.top = PAD_T + "px";
  const mkWords = (el, words) =>
    words.map((w, i) => {
      if (i) el.appendChild(document.createTextNode(" "));
      return PP.el("span", "pp-w", el, { text: w });
    });
  const wA = mkWords(hA, ["Six", "compounds."]);
  const wB = mkWords(hB, ["One", "standard."]);
  // "Six compounds." per-word blur-in on the voice
  PP.blurIn(tl, [wA[0]], tSix, { stagger: 0 });
  PP.blurIn(tl, [wA[1]], tComp, { stagger: 0 });
  // swap: A and B are one reel (B one slot below A); the reel rolls up one slot, so they never overlap
  const SLOT = HS + PAD_T + PAD_B;
  hB.style.top = PAD_T + SLOT + "px";
  const reel = $(".s5-reel");
  tl.fromTo(reel, { y: 0 }, { y: -SLOT, duration: 12 * F, ease: "expo.inOut", immediateRender: false }, tOne);
  tl.set(hB, { opacity: 0 }, 0); // parked lines are clipped by the slot; also take them out of the render tree
  tl.set(hB, { opacity: 1 }, tOne);
  tl.set(hA, { opacity: 0 }, tOne + 12 * F);

  // underline under "standard." (layout values: offset* ignore transforms)
  const ulW0 = wB[1].offsetWidth - 0.02 * HS; // drop the trailing tracking
  const ulL0 = wB[1].offsetLeft + 0.04 * HS;
  const ulW = ulW0 - 0.06 * HS;
  const ulY = 150 + CAP * HS + 16; // 16 px under the baseline

  // ------------------------------------------------------------------ the one line (underline → shelf → baseline → point)
  const line = $(".s5-line");
  const eOut = ease("expo.out"), eIO = ease("expo.inOut"), eIn3 = ease("power3.in");
  const lineAt = (t0) => {
    const t = t0 + 1e-4;
    if (t < tDraw || t >= tPP) return null;
    const d = driftAt(t);
    // underline rect (left-anchored draw)
    const kD = eOut(clamp01((t - tDraw) / (7 * F)));
    let x0 = ulL0 + d, w = ulW * kD, y = ulY;
    // fall + widen into the shelf
    const kP = eIO(clamp01((t - tDrop) / (12 * F)));
    if (kP > 0) {
      const cx = lerp(x0 + w / 2, 960 + d, kP);
      w = lerp(w, SHELF_W, kP);
      y = lerp(ulY, BASE_Y, kP);
      x0 = cx - w / 2;
    }
    // whip: the shelf stays, rises to the word baseline, re-centres
    const kW = eIO(clamp01((t - tWhip) / (6 * F)));
    if (kW > 0) {
      const cx = lerp(x0 + w / 2, 960, kW);
      y = lerp(y, WORD_Y, kW);
      x0 = cx - w / 2;
    }
    // stall: contracts to a point at x 960
    const kS = eIn3(clamp01((t - tStall) / (7 * F)));
    if (kS > 0) {
      w = w * (1 - kS);
      x0 = 960 - w / 2;
    }
    return { x0, w, y };
  };
  PP.driveT(tl, (t) => {
    const s = lineAt(t);
    if (!s || s.w < 0.5) {
      line.style.opacity = "0";
      return;
    }
    line.style.opacity = "1";
    line.style.transform = `translate(${fx(s.x0)}px, ${fx(s.y)}px)`;
    line.style.width = fx(s.w) + "px";
  }, T0, T1);

  // ------------------------------------------------------------------ whip (row + headline to x −2000, blur 0→60, CA ≤ 2 px)
  const blur = root.querySelector("#s5-whipblur");
  const eWh = ease("power3.in");
  PP.driveT(tl, (t0) => {
    const t = t0 + 1e-4;
    const k = clamp01((t - tWhip) / (6 * F));
    const e = eWh(k);
    if (k <= 0) {
      whip.style.transform = "none";
      whip.style.filter = "none";
      return;
    }
    whip.style.transform = `translateX(${fx(-2000 * e)}px)`;
    const sd = 60 * e;
    blur.setAttribute("stdDeviation", `${fx(sd)} 0`);
    const ca = Math.min(2, 2 * (e / 0.3)); // chromatic fringe ≤ 2 px while it moves
    whip.style.filter = `url(#s5-whipf) drop-shadow(${fx(ca)}px 0 0 rgba(230,40,90,.35)) drop-shadow(${fx(-ca)}px 0 0 rgba(20,150,255,.35))`;
  }, tWhip - F, tWhipE + F);

  // ------------------------------------------------------------------ word stream on the rule (baseline 634, rule 640–643)
  const stream = $(".s5-stream");
  const WS = 200, WBASE = WORD_Y - 6;
  const words = WORDS.map(([txt, acc], k) => {
    const w = PP.el("div", "s5-word" + (acc ? " acc" : ""), stream, { text: txt });
    w.style.top = fx(WBASE - BL * WS) + "px";
    w.style.transformOrigin = `960px ${fx(BL * WS)}px`;
    const tIn = tW[k], tOut = k + 1 < WORDS.length ? tW[k + 1] : tStall;
    tl.set(w, { opacity: 1 }, tIn);
    tl.set(w, { opacity: 0 }, tOut);
    const punch = acc === 2;
    tl.fromTo(w, { scale: punch ? 1.15 : 1.06 }, { scale: 1, duration: (punch ? 4 : 3) * F, ease: "power4.out", immediateRender: false }, tIn);
    return w;
  });

  // ------------------------------------------------------------------ "Purity, / proven." → #type-h1 (handed to S06 at f674)
  // Laid out so that ONE uniform scale about the block's ink centre maps it onto the live H1 at the phone's REST pose:
  // ink boxes measured on clean/home.png (3x): "Purity," page pt x 156–248, y 357.67–388.00; "proven." x 147.67–256,
  // y 397.33–421.00 → stage at REST (x = 759.85 + 0.9958·X, y = 105.27 + 0.9958·(62 + py)). The site sets DM Sans 800 at
  // ≈32 pt with letter-spacing ≈ −0.04em and a line pitch of ≈1.03 em: we use the same tracking and pitch at 180 px.
  const K = 0.9958, sx = (X) => 759.85 + K * X, sy = (py) => 105.27 + K * (62 + py);
  const REST = [
    [sx(156), sy(357.67), sx(248), sy(388.0)],
    [sx(147.67), sy(397.33), sx(256), sy(421.0)],
  ];
  const CX = (REST[1][0] + REST[1][2]) / 2, CY = (REST[0][1] + REST[1][3]) / 2; // union ink centre ≈ (960.8, 554.7)
  // Ink boxes are measured with canvas measureText (same shaping as the DOM: kerning + letter-spacing included). The tracking
  // is solved so that both lines have the site's width/height ratios: then ONE uniform scale SC maps them onto the REST H1.
  const PS = 180, TXT = ["Purity,", "proven."];
  const cv = document.createElement("canvas").getContext("2d");
  cv.font = `800 ${PS}px "DM Sans"`;
  const meas = (txt, ls) => {
    cv.letterSpacing = ls.toFixed(3) + "px";
    const m = cv.measureText(txt);
    return { l: -m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent };
  };
  const m0 = TXT.map((t) => meas(t, 0));
  const scH = m0.map((m, i) => (REST[i][3] - REST[i][1]) / (m.a + m.d)); // site ink height / ours (tracking-independent)
  const SC = (scH[0] + scH[1]) / 2; // ≈ 0.177 (site H1 ≈ 32 pt at REST)
  const LS = TXT.map((t, i) => ((REST[i][2] - REST[i][0]) / SC - (m0[i].r - m0[i].l)) / (t.length - 1)).reduce((x, y) => x + y) / 2;
  const INK = TXT.map((t) => meas(t, LS));
  const stage = document.getElementById("stage");
  let th = document.getElementById("type-h1");
  if (th) th.remove();
  th = PP.el("div", "layer", stage, { id: "type-h1" });
  th.style.cssText += `;z-index:40; transform-origin:${fx(CX)}px ${fx(CY)}px; opacity:0`;
  th.dataset.scale = SC.toFixed(5); // S06: scale(SC) about transform-origin lands both lines on the REST H1 ink boxes
  th.dataset.inkCentre = `${fx(CX)},${fx(CY)}`;
  th.dataset.letterSpacing = (LS / PS).toFixed(4) + "em";
  const PAD_T2 = 10, PAD_B2 = 24;
  const thLines = INK.map((k, i) => {
    const r = REST[i];
    const icx = CX + ((r[0] + r[2]) / 2 - CX) / SC; // this line's ink centre in the 180 px layout
    const icy = CY + ((r[1] + r[3]) / 2 - CY) / SC;
    const pen = icx - (k.l + k.r) / 2;
    const base = icy + (k.a - k.d) / 2;
    const m = PP.el("div", "th-mask th-l" + (i + 1), th);
    m.style.cssText = `position:absolute; left:0; width:1920px; overflow:hidden; top:${fx(base - BL * PS - PAD_T2)}px; height:${PS + PAD_T2 + PAD_B2}px`;
    const inner = PP.el("div", "th-in", m);
    inner.style.cssText = `position:absolute; left:${fx(pen)}px; top:${PAD_T2}px; height:${PS}px; white-space:nowrap; font-family:var(--display);` +
      `font-weight:800; font-size:${PS}px; line-height:${PS}px; letter-spacing:${LS.toFixed(3)}px; color:${i ? C.h1Ink : C.h1Teal}`;
    if (i === 0) inner.textContent = TXT[0];
    else {
      inner.appendChild(document.createTextNode("proven"));
      // the site H1's own teal period (SCENES §S05.6, sampled from the capture): punctuation, exempt from the text-contrast QC
      PP.el("span", "", inner, { text: ".", style: `color:${C.siteTeal}`, "data-qc-skip": "site H1 period" });
    }
    // stage ink box of this line at 180 px, and its REST target (for S06's FLIP / QC)
    m.dataset.ink = [pen + k.l, base - k.a, pen + k.r, base + k.d].map(fx).join(",");
    m.dataset.rest = r.map(fx).join(",");
    return inner;
  });
  tl.set(th, { opacity: 0 }, 0);
  tl.set(th, { opacity: 1 }, tPP);
  tl.set(th, { opacity: 0 }, f(750)); // safety: S06 removes it at f750 (the real bitmap H1 takes over)
  thLines.forEach((el, i) => {
    tl.set(el, { yPercent: 110 }, 0);
    tl.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: PP_DUR, ease: "power4.out", immediateRender: false }, tPP + i * PP_STAG);
  });

  // window guards
  if (tWhip < tLand + 10 * F) console.warn("[S05] whip starts before the vials settle");
  if (tW[0] < tWhipE - 1e-6 || tW[6] > tStall - 5 * F) console.warn("[S05] word stream squeezed", tW.map(PP.toF));
  PP.S05 = { tSix: PP.toF(tSix), tComp: PP.toF(tComp), tOne: PP.toF(tOne), tDraw: PP.toF(tDraw), tDrop: PP.toF(tDrop), tLand: PP.toF(tLand), tWhip: PP.toF(tWhip), words: tW.map(PP.toF), tStall: PP.toF(tStall), tPP: PP.toF(tPP), scale: SC,
    // sound-event frames for tools/mix_audio.py (SFX #15–18 were written for the pre-VO spec frames)
    sfx: { swaps: SWAP.map(PP.toF), lands: RANK.map((r) => PP.toF(tLand) + 2 * r), whipPeak: PP.toF(tWhip) + 5, words: tW.map(PP.toF), stall: PP.toF(tStall), payoff: PP.toF(tPP) } };
});
