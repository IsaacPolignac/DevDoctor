// S09 · checkout-ready → the button becomes the world · window f1030–f1086 (34.333–36.200 s) · iPhone rig + DOM · PAPER → NAVY.
// SCENES §S09. PH calls are added in time order (flick f1030, press/tap f1064, camera DIVE f1066).
//   f1030–1052  momentum flick on cart3, s 0 → 820 (PH.flick: 8 f power2.in + 14 f expo.out, velocity blur ≤ 2 pt)
//   f1052–1066  S08's offer modules mask out right→left (clip-path inset, 10 f power3.in, stagger 2 f: A, B, C)
//   f1052–1062  readiness glow on "Proceed to checkout" (spread 0 → 10 px rgba(22,164,143,.5), 10 f)
//   f1064       tap: white ring + press (0.97, 3 f / back 6 f); the glow releases outward (8 f); state at f1066
//   f1064       the Safari URL pill is hidden in the screen and cloned at its stage rect as #pill (stage level, z 55)
//   f1066–1074  pill lift by box size (no scale, the text stays crisp): 1 → 1.08, y −10, shadow, 8 f expo.out
//   f1066–1086  #dive grows from the (pressed) button rect to the full frame, cubic-bezier(.7,0,.84,0); fill #123A78
//               crossfades to the NAVY world gradient over the last 8 f; camera DIVE (g 1 → 1.6 about the button,
//               power3.in); chromatic aberration 0 → 2 px f1078–1086 on #phone and on the dive.
//               The pill restyles exactly where the navy passes behind it: its light skin is clipped by the dive's
//               leading edge (the navy skin underneath is the S10 pill).
//   f1086       NAVY world (global), rig hidden (global), this section (and #dive) hidden: same pixels.
// Local helper note: PH.press's patch is widened by 1.5 pt (same local fix as S07/S08: the control's AA rim showed).
PP.scene("S09", function build(tl, root) {
  const F = PP.F, f = PP.f, C = PP.C;
  const E = (n) => gsap.parseEase(n);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const fx = (x) => x.toFixed(2);

  const T_FLICK = f(1030), T_LAND = f(1052), T_TAP = f(1064), T_STATE = f(1066), T_CUT = f(1086);
  const S_END = 820; // cart3 scroll at the landing: Summary / Subtotal / Total $234.57 + "Proceed to checkout"
  const BTN = [45, 1249, 312, 50]; // "Proceed to checkout", page pt (screen 45..357 × 491..541 at s 820)
  const BTN_R = 25; // pt
  const BTN_C = { x: 201, y: 516 }; // screen pt (button centre at s 820)
  const URL_R = [74, 796, 254, 50]; // .ps-url, screen pt (left 74, right 74, bottom 28, h 50)

  // ================================================================== 1. momentum flick (f1030–f1052)
  const tLanded = PH.flick(tl, "cart3", 0, S_END, T_FLICK);
  if (Math.abs(tLanded - T_LAND) > 1e-6) console.warn("[S09] flick lands at " + PP.toF(tLanded));

  // ================================================================== 2. modules exit (f1052–f1066)
  // S08's cards (#offers, stage level). Right→left clip; the negative insets keep the card's soft shadow until the edge
  // reaches it. The cards keep S08's transforms; only clip-path is touched here.
  const mods = (PP.S08 && PP.S08.modules) || [];
  if (!mods.length) console.warn("[S09] PP.S08.modules missing: nothing to mask out");
  const PADC = 64; // shadow 0 12px 32px → reaches ~44 px below
  mods.forEach((m, i) => {
    const card = m.card || m;
    // the slot width, not offsetWidth: S08's FLIP driver writes the card's *source* box at build time (PP.drive calls
    // setter(from)), so offsetWidth here is the small row width and the mask stopped half-way (cards popped off at f1066)
    const w = (m.slot && m.slot.w) || 720;
    const t0 = T_LAND + i * 2 * F;
    tl.set(card, { clipPath: "none" }, 0);
    tl.fromTo(card, { clipPath: `inset(-${PADC}px -${PADC}px -${PADC}px -${PADC}px)` },
      { clipPath: `inset(-${PADC}px ${w + PADC}px -${PADC}px -${PADC}px)`, duration: 10 * F, ease: "power3.in", immediateRender: false }, t0);
    // supporting move: the content drifts 36 px left into the closing mask (CSS `translate`, independent of the
    // `transform` S08's FLIP writes on the same node)
    if (m.content) PP.drive(tl, (v) => (m.content.style.translate = v ? `${fx(v)}px 0px` : "none"), 0, -36, t0, 10 * F, "power2.in");
  });
  if (PP.S08 && PP.S08.offers) tl.set(PP.S08.offers, { opacity: 0 }, T_STATE); // all three are fully clipped by f1066

  // ================================================================== 3. readiness glow (f1052–f1062) + release on the tap
  const glow = PP.el("div", "s9-glow", PH.ov("cart3"), {
    style: `left:${BTN[0]}px;top:${BTN[1]}px;width:${BTN[2]}px;height:${BTN[3]}px;border-radius:${BTN_R}px;opacity:0`,
  });
  const setGlow = (spread, a) => {
    glow.style.boxShadow = `0 0 0 ${fx(spread)}px rgba(22,164,143,${(0.5 * a).toFixed(3)}), 0 0 ${fx(12 + spread * 1.6)}px rgba(22,164,143,${(0.28 * a).toFixed(3)})`;
  };
  tl.set(glow, { opacity: 0 }, 0);
  tl.set(glow, { opacity: 1 }, T_LAND);
  PP.drive(tl, (u) => setGlow(10 * u, 1), 0, 1, T_LAND, 10 * F, "power2.out");
  PP.drive(tl, (u) => setGlow(10 + 10 * u, 1 - u), 0, 1, T_TAP, 8 * F, "power2.out"); // the tap releases it
  tl.set(glow, { opacity: 0 }, T_TAP + 8 * F);

  // ================================================================== 4. tap "Proceed to checkout" (f1064, beat 35.5 − 1 f)
  const pr = PH.press(tl, T_TAP, "cart3", BTN, { radius: BTN_R, bg: "#FFFFFF" });
  const d = 1.5;
  Object.assign(pr.patch.style, { left: BTN[0] - d + "px", top: BTN[1] - d + "px", width: BTN[2] + 2 * d + "px", height: BTN[3] + 2 * d + "px", borderRadius: BTN_R + d + "px" });
  PH.tap(tl, T_TAP, BTN_C.x, BTN_C.y, { white: true });
  // the glow ring hugs the pressed button: keep it above PH.press's patch (else the widened white patch reads as a white
  // stroke between the ring and the shrinking button, f1064–1068) and scale it with the same press curve (below)
  glow.parentNode.appendChild(glow);
  glow.style.transformOrigin = "50% 50%";
  // the press scale as a pure function of time (same curve as PH.press), so the dive starts from the pressed button
  const P2O = E("power2.out"), BO = E("back.out(0.8)");
  const pressS = (t) => {
    const u = (t - T_TAP) / F;
    if (u <= 0 || u >= 9) return 1;
    return u < 3 ? lerp(1, 0.97, P2O(u / 3)) : lerp(0.97, 1, BO((u - 3) / 6));
  };

  PP.driveT(tl, (t) => { const p = pressS(t); glow.style.transform = p === 1 ? "none" : `scale(${p.toFixed(4)})`; }, T_TAP, T_TAP + 9 * F);

  // ================================================================== 5. URL pill → #pill (stage level, z 55, handed to S10)
  const stage = document.getElementById("stage");
  let pill = document.getElementById("pill");
  if (pill) pill.remove();
  pill = PP.el("div", "s9-pill", stage, { id: "pill" });
  const r0 = PH.stageRect(URL_R, T_TAP); // WIDE: x 1213.5–1466.4, y 897.5–947.3
  const LIFT = 1.08, LIFT_Y = -10;
  const cx = r0.x + r0.w / 2, cy0 = r0.y + r0.h / 2;
  const FS0 = 16 * PH.K; // .ps-url is Inter 500 16 pt
  // #pill = the NAVY skin (what S10 animates: left/top/width/height/border-radius/font-size; no transform)
  pill.style.cssText =
    `position:absolute;box-sizing:border-box;z-index:55;pointer-events:none;opacity:0;display:flex;align-items:center;justify-content:center;` +
    `background:${C.pillFill};border:1.5px solid ${C.pillStroke};color:${C.nText};font-family:var(--body);font-weight:500;` +
    `letter-spacing:-0.1px;white-space:nowrap;-webkit-font-smoothing:antialiased`;
  const label = PP.el("span", "s9-pill-label", pill, { text: "purepeptide.care" });
  // light skin = the Safari glass pill (same fill/shadows as .ps-glass) + the lift shadow; clipped by the dive's edge
  const lite = PP.el("div", "s9-pill-lite", pill, { text: "purepeptide.care", "data-qc-skip": "" }); // site UI clone
  lite.style.cssText =
    `position:absolute;left:-1.5px;top:-1.5px;right:-1.5px;bottom:-1.5px;border-radius:inherit;display:flex;align-items:center;justify-content:center;` +
    `background:rgba(250,251,253,.96);color:#111827;font:inherit;letter-spacing:inherit`;
  const setBox = (s, dy) => {
    const w = r0.w * s, h = r0.h * s;
    pill.style.left = fx(cx - w / 2) + "px";
    pill.style.top = fx(cy0 + dy - h / 2) + "px";
    pill.style.width = fx(w) + "px";
    pill.style.height = fx(h) + "px";
    pill.style.borderRadius = fx(h / 2) + "px";
    pill.style.fontSize = fx(FS0 * s) + "px";
  };
  const setLiteShadow = (u) => {
    lite.style.boxShadow =
      `0 ${fx(lerp(6 * PH.K, 20, u))}px ${fx(lerp(22 * PH.K, 40, u))}px rgba(10,30,70,${fx(lerp(0.16, 0.25, u))}), ` +
      `inset 0 0 0 .5px rgba(255,255,255,.9), 0 0 0 .5px rgba(10,30,70,.10)`;
  };
  tl.set(pill, { opacity: 0 }, 0);
  tl.set(pill, { opacity: 1 }, T_TAP);
  tl.set(PH.url, { opacity: 1 }, 0);
  tl.set(PH.url, { opacity: 0 }, T_TAP);
  PP.drive(tl, (u) => { setBox(lerp(1, LIFT, u), LIFT_Y * u); setLiteShadow(u); }, 0, 1, T_STATE, 8 * F, "expo.out");
  tl.set(lite, { opacity: 1 }, 0);
  tl.set(lite, { opacity: 0 }, T_CUT);

  // ================================================================== 6. dive + camera DIVE + CA (f1066–f1086)
  PH.cam(tl, T_STATE, 20 * F, "DIVE", "power3.in");

  const dive = root.querySelector(".s9-dive");
  const clip = root.querySelector(".s9-dive-clip");
  const navy = root.querySelector(".s9-dive-navy");
  const lab = root.querySelector(".s9-dive-label");
  const sheen = root.querySelector(".s9-dive-sheen");
  const SW0 = f(1066), SW1 = f(1079), SWE = E("power2.inOut"); // the sweep crosses the button in the dive's slow first half
  // label crop: the inner navy area of the button (no anti-aliased rim), so its edges vanish into the #123A78 dive
  const LAB = [90, 1257, 222, 34]; // page pt
  Object.assign(lab.style, {
    width: LAB[2] + "px", height: LAB[3] + "px", backgroundImage: `url('${PH.BASE}cart3.png')`,
    backgroundSize: "402px auto", backgroundPosition: `${-LAB[0]}px ${-LAB[1]}px`,
  });
  const DIVE = E(CustomEase.create("s9dive", "M0,0 C0.7,0 0.84,0 1,1"));
  // two copies of the channel-split filter: #phone filters in its local (pre-scale) space, the dive in stage px
  const caPh = root.querySelector("#s9-ca");
  const caDv = caPh.cloneNode(true);
  caDv.id = "s9-ca-dive";
  caPh.parentNode.appendChild(caDv);
  const caOff = Array.from(caPh.querySelectorAll("feOffset")), caOffD = Array.from(caDv.querySelectorAll("feOffset"));
  const lab0 = f(1072), lab1 = f(1079); // the label fades as the button opens up
  const P2I = E("power2.in");

  tl.set(dive, { opacity: 0 }, 0);
  tl.set(dive, { opacity: 1 }, T_STATE);
  PP.driveT(tl, (t) => {
    const u = clamp01((t - T_STATE) / (T_CUT - T_STATE));
    const e = DIVE(u);
    // pressed button rect (stage px) at t, scaled about its centre by the press curve
    const p = pressS(t);
    const b = PH.stageRect([BTN[0], BTN[1] + PH.TOP - S_END, BTN[2], BTN[3]], t);
    const bw = b.w * p, bh = b.h * p, bx = b.x + (b.w - bw) / 2, by = b.y + (b.h - bh) / 2;
    const L = lerp(bx, 0, e), T = lerp(by, 0, e), R = lerp(bx + bw, PP.W, e), B = lerp(by + bh, PP.H, e);
    const rad = lerp((BTN_R * bh) / BTN[3], 0, e);
    clip.style.clipPath = `inset(${fx(T)}px ${fx(PP.W - R)}px ${fx(PP.H - B)}px ${fx(L)}px round ${fx(rad)}px)`;
    // light sweep: left → right across the (growing) button, same clip as the dive, over its label
    const su = clamp01((t - SW0) / (SW1 - SW0));
    if (su <= 0 || su >= 1) sheen.style.opacity = "0";
    else {
      sheen.style.opacity = "1";
      sheen.style.clipPath = clip.style.clipPath;
      sheen.style.setProperty("--x", fx(lerp(L - 140, R + 140, SWE(su))) + "px");
    }
    // last 8 f: #123A78 → the NAVY world gradient
    navy.style.opacity = fx(clamp01((t - f(1078)) / (8 * F)));
    // label rides the pressed button, then fades
    const ls = PH.stage(LAB[0], LAB[1] + PH.TOP - S_END, t);
    const k = ls.s * p;
    const lx = cx0(b, p, ls.x), ly = cy1(b, p, ls.y);
    lab.style.transform = `translate(${fx(lx)}px,${fx(ly)}px) scale(${k.toFixed(4)})`;
    lab.style.opacity = fx(1 - P2I(clamp01((t - lab0) / (lab1 - lab0))));
    // pill: light skin clipped from the top by the dive's leading (bottom) edge
    const pt = parseFloat(pill.style.top), ph = parseFloat(pill.style.height);
    const cut = Math.max(0, B - pt + 1.5);
    lite.style.clipPath = cut <= 0 ? "none" : `inset(${fx(Math.min(cut, ph + 80))}px -80px -80px -80px)`;
    label.style.opacity = cut <= 0 ? "0" : "1"; // the navy skin's text only exists where the navy has arrived
    // chromatic aberration 0 → 2 px (stage px) over f1078–f1086, on the rig and on the dive
    const ca = t >= T_CUT ? 0 : 2 * P2I(clamp01((t - f(1078)) / (8 * F)));
    // depth: the button lifts toward the lens as it opens, its contact shadow spreads (gone off-frame by the cut)
    const shA = clamp01((t - T_STATE) / (6 * F)); // ease the shadow in (the site button has none: no pop at f1066)
    const sh = `drop-shadow(0px ${fx(6 + 34 * e)}px ${fx(14 + 46 * e)}px rgba(8,21,54,${((0.16 + 0.14 * e) * shA).toFixed(3)}))`;
    if (ca < 0.05) {
      PH.el.style.filter = "none";
      dive.style.filter = t > T_STATE ? sh : "none";
    } else {
      const g = PH.camAt(t).g; // #phone's filter runs in its local (pre-scale) space
      caOff[0].setAttribute("dx", fx(-ca / g));
      caOff[1].setAttribute("dx", fx(ca / g));
      caOffD[0].setAttribute("dx", fx(-ca));
      caOffD[1].setAttribute("dx", fx(ca));
      PH.el.style.filter = "url(#s9-ca)";
      dive.style.filter = sh + " url(#s9-ca-dive)";
    }
  }, T_TAP, T_CUT);
  // the label point relative to the pressed button: scale its offset from the button centre by the press
  function cx0(b, p, x) { const c = b.x + b.w / 2; return c + (x - c) * p; }
  function cy1(b, p, y) { const c = b.y + b.h / 2; return c + (y - c) * p; }

  PP.S09 = { pill, pillLabel: label, pillLite: lite, dive, tap: PP.toF(T_TAP), state: PP.toF(T_STATE), cut: PP.toF(T_CUT) };
});
