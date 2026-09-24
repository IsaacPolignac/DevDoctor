// s1 — HOOK (0.00–3.20). The official hero vial, alive from frame 0, under a SaaS "analysis" overlay:
// brand-gradient corner brackets snap on (~0.9), a scan beam sweeps down (1.0–1.9), two neutral callout
// tags pop as the beam passes them (« ANALYSE… », « ? »). Headline = VO L1 word by word.
// Exit 2.80–3.20: headline text-out, the vial drops out of frame while s23's phone rises over it.
// Every visual state is a pure function of timeline time (fromTo / PP.drive, no callbacks).
(function () {
  const PP = window.PP;

  PP.scene("s1", function (tl, root, cam) {
    const el = PP.el;

    // ------------------------------------------------------------------ geometry (scene px)
    const CX = 540,
      CY = 1080;
    const VH = 800, // hero.png is 1024 x 1536, vial occupies rows 6..1526, cols 196..829
      K = VH / 1536,
      VW = 1024 * K;
    const IX = CX - VW / 2,
      IY = CY - VH / 2;
    const vx0 = IX + 196 * K,
      vx1 = IX + 829 * K,
      vy0 = IY + 6 * K,
      vy1 = IY + 1526 * K;
    // analysis frame (corner brackets) around the vial
    const BX0 = vx0 - 46,
      BX1 = vx1 + 46,
      BY0 = vy0 - 36,
      BY1 = vy1 + 34;
    const BW = BX1 - BX0,
      BH = BY1 - BY0;
    // scan field (beam travels inside, clipped)
    const FI = 8,
      FX = BX0 + FI,
      FY = BY0 + FI,
      FW = BW - 2 * FI,
      FH = BH - 2 * FI;

    // ------------------------------------------------------------------ timing
    const T_BRK = 0.8; // brackets appear 0.80, snap onto the frame at ≈ 0.94 (back.out crossing)
    const T_SCAN = 1.0,
      D_SCAN = 0.9; // beam sweep 1.00 → 1.90
    const T_TAG_OUT = 2.6;
    const T_BRK_OUT = 2.68;
    const T_OUT = 2.8; // headline out + vial drop
    // beam position (scene y) at time t, and the time the beam reaches scene y (inverse of sine.inOut)
    const B0 = -6,
      B1 = FH + 6;
    const beamTimeAt = (sy) => {
      const e = (sy - FY - B0) / (B1 - B0);
      return T_SCAN + (D_SCAN * Math.acos(1 - 2 * Math.min(1, Math.max(0, e)))) / Math.PI;
    };

    // ------------------------------------------------------------------ layers
    // back: soft brand light + hairline rings (behind the vial, not floating)
    const back = el("div", "s1-layer s1-back", cam);
    const glow = el("div", "s1-glow", back);
    Object.assign(glow.style, { left: CX - 470 + "px", top: CY - 600 + "px", width: "940px", height: "1160px" });
    const glowT = el("div", "s1-glow teal", back);
    Object.assign(glowT.style, { left: CX - 60 + "px", top: CY + 40 + "px", width: "620px", height: "620px" });
    const ring = el("div", "s1-ring", back);
    Object.assign(ring.style, { left: CX - 380 + "px", top: CY - 380 + "px", width: "760px", height: "760px" });

    // rig: everything that belongs to the vial (drops out together at the end)
    const rig = el("div", "s1-layer s1-rig", cam);
    const shadow = el("div", "s1-shadow", rig);
    Object.assign(shadow.style, { left: CX - 190 + "px", top: vy1 - 14 + "px", width: "380px", height: "46px" });
    const float = el("div", "s1-layer s1-float", rig);

    // the hero vial (official generic render)
    const vial = el("div", "s1-vial", float);
    Object.assign(vial.style, { left: IX + "px", top: IY + "px", width: VW + "px", height: VH + "px" });
    el("img", "", vial, { src: PP.cfg.heroVial, alt: "" });
    // scan tint: a light band masked by the vial's own silhouette, locked to the beam
    const tint = el("div", "s1-tint", vial);
    tint.style.webkitMaskImage = tint.style.maskImage = 'url("' + PP.cfg.heroVial + '")';
    const BAND = 170;
    const band = el("div", "s1-band", tint);
    band.style.height = BAND + "px";

    // corner brackets (one SVG in scene coordinates, brand gradient across the whole frame)
    const svg = PP.svg("svg", { class: "s1-brackets", width: 1080, height: 1920, viewBox: "0 0 1080 1920" }, float);
    svg.style.left = svg.style.top = "0px";
    const gid = PP.uid("s1g");
    const defs = PP.svg("defs", {}, svg);
    const lg = PP.svg("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: BX0, y1: BY0, x2: BX1, y2: BY1 }, defs);
    PP.svg("stop", { offset: "0", "stop-color": PP.C.navy }, lg);
    PP.svg("stop", { offset: "0.55", "stop-color": PP.C.blue }, lg);
    PP.svg("stop", { offset: "1", "stop-color": PP.C.teal }, lg);
    const L = 74,
      R = 20;
    const corners = [
      { dx: -1, dy: -1, d: `M${BX0} ${BY0 + L} L${BX0} ${BY0 + R} Q${BX0} ${BY0} ${BX0 + R} ${BY0} L${BX0 + L} ${BY0}` },
      { dx: 1, dy: -1, d: `M${BX1 - L} ${BY0} L${BX1 - R} ${BY0} Q${BX1} ${BY0} ${BX1} ${BY0 + R} L${BX1} ${BY0 + L}` },
      { dx: 1, dy: 1, d: `M${BX1} ${BY1 - L} L${BX1} ${BY1 - R} Q${BX1} ${BY1} ${BX1 - R} ${BY1} L${BX1 - L} ${BY1}` },
      { dx: -1, dy: 1, d: `M${BX0 + L} ${BY1} L${BX0 + R} ${BY1} Q${BX0} ${BY1} ${BX0} ${BY1 - R} L${BX0} ${BY1 - L}` },
    ].map((c) => {
      const g = PP.svg("g", {}, svg);
      PP.svg("path", { d: c.d, fill: "none", stroke: `url(#${gid})`, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      return Object.assign(c, { g });
    });

    // scan field + beam
    const field = el("div", "s1-field", float);
    Object.assign(field.style, { left: FX + "px", top: FY + "px", width: FW + "px", height: FH + "px" });
    const TRAIL = 210;
    const trail = el("div", "s1-trail", field);
    trail.style.height = TRAIL + "px";
    const beam = el("div", "s1-beam", field);

    // callout A (right, on the vial neck) — « ANALYSE… »
    const A = { y: 880, x: 651 };
    const leadA = el("div", "s1-lead r", float);
    const nodeA = el("div", "s1-node", float);
    Object.assign(nodeA.style, { left: A.x + "px", top: A.y + "px" });
    const tagA = el("div", "s1-tag", float);
    const live = el("div", "s1-live", tagA);
    const liveRing = el("b", "", live);
    el("i", "", live);
    const txtA = el("span", "mono", tagA, { text: "ANALYSE" });
    const dotsWrap = el("span", "s1-dots", txtA);
    const dots = [0, 1, 2].map(() => el("span", "", dotsWrap, { text: "." }));
    const TAX = 716; // tag A left edge (right edge ≤ 950 at full camera push)
    Object.assign(tagA.style, { left: TAX + "px", top: A.y - 27 + "px" });
    Object.assign(leadA.style, { left: A.x + 8 + "px", top: A.y - 1 + "px", width: TAX - A.x - 8 + "px" });
    tagA.style.transformOrigin = "0% 50%";

    // callout B (left, on the vial body) — « ? »
    const B = { y: 1340, x: vx0 + 1 };
    const leadB = el("div", "s1-lead l", float);
    const nodeB = el("div", "s1-node t", float);
    Object.assign(nodeB.style, { left: B.x + "px", top: B.y + "px" });
    const tagB = el("div", "s1-tag q", float);
    el("span", "grad", tagB, { text: "?" });
    const TBR = 296; // tag B right edge
    Object.assign(tagB.style, { left: TBR - 72 + "px", top: B.y - 36 + "px" });
    Object.assign(leadB.style, { left: TBR + "px", top: B.y - 1 + "px", width: B.x - 8 - TBR + "px" });
    tagB.style.transformOrigin = "100% 50%";

    // headline (outside the camera push so it stays crisp and steady)
    const head = el("div", "s1-head", root);
    head.style.top = "318px";
    const h = PP.voHeadline(tl, head, "L1", ["Qu’y a-t-il vraiment", "dans votre *fiole ?*"], "h2", { lead: 0.08 });

    // ------------------------------------------------------------------ motion
    // camera: slow push-in for the whole hook
    PP.camera(tl, cam, 0, T_OUT, 0.035);

    // vial alive from frame 0: settle-in rise, gentle float, subtle 3D turn
    tl.fromTo(rig, { y: 46, scale: 0.955 }, { y: 0, scale: 1, duration: 1.8, ease: "expo.out" }, 0);
    tl.fromTo(float, { y: 0 }, { y: -14, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);
    tl.fromTo(shadow, { scaleX: 1, opacity: 1 }, { scaleX: 0.9, opacity: 0.72, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);
    tl.fromTo(vial, { rotationY: -11, rotation: -1.1, transformPerspective: 1500 }, { rotationY: 9, rotation: 0.9, transformPerspective: 1500, duration: T_OUT + 0.4, ease: "sine.inOut" }, 0);
    tl.fromTo(back, { scale: 0.97 }, { scale: 1.02, duration: T_OUT, ease: "none" }, 0);
    tl.fromTo(ring, { scale: 0.94, opacity: 0.6 }, { scale: 1, opacity: 1, duration: 1.6, ease: "power2.out" }, 0);

    // brackets snap in (from outside, springy), lock pulse after the scan, fly out on exit
    corners.forEach((c) => {
      tl.fromTo(c.g, { x: c.dx * 38, y: c.dy * 38 }, { x: 0, y: 0, duration: 0.5, ease: "back.out(2.6)" }, T_BRK);
      tl.fromTo(c.g, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none" }, T_BRK);
      tl.fromTo(c.g, { x: 0, y: 0 }, { x: -c.dx * 8, y: -c.dy * 8, duration: 0.13, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, 1.94);
      tl.fromTo(c.g, { x: 0, y: 0 }, { x: c.dx * 70, y: c.dy * 70, duration: 0.3, ease: "power2.in", immediateRender: false }, T_BRK_OUT);
      tl.fromTo(c.g, { opacity: 1 }, { opacity: 0, duration: 0.22, ease: "power1.in", immediateRender: false }, T_BRK_OUT + 0.06);
    });

    // scan beam + trail + vial tint band, all on the same ease so they stay locked together
    tl.fromTo(beam, { y: B0 }, { y: B1, duration: D_SCAN, ease: "sine.inOut" }, T_SCAN);
    tl.fromTo(trail, { y: B0 - TRAIL }, { y: B1 - TRAIL, duration: D_SCAN, ease: "sine.inOut" }, T_SCAN);
    const bandY = (b) => FY + b - IY - BAND;
    tl.fromTo(band, { y: bandY(B0) }, { y: bandY(B1), duration: D_SCAN, ease: "sine.inOut" }, T_SCAN);
    tl.fromTo([beam, trail, tint], { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none" }, T_SCAN - 0.04);
    tl.fromTo([beam, trail, tint], { opacity: 1 }, { opacity: 0, duration: 0.14, ease: "power1.in", immediateRender: false }, T_SCAN + D_SCAN - 0.1);

    // callouts pop exactly when the beam crosses their anchor
    const callout = (node, lead, tag, at, fromX) => {
      tl.fromTo(node, { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(3)" }, at);
      tl.fromTo(lead, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out" }, at + 0.03);
      tl.fromTo(tag, { scale: 0.55, x: fromX }, { scale: 1, x: 0, duration: 0.55, ease: "back.out(2.2)" }, at + 0.08);
      tl.fromTo(tag, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, at + 0.08);
      tl.fromTo([tag, node], { opacity: 1 }, { opacity: 0, duration: 0.18, ease: "power1.in", immediateRender: false }, T_TAG_OUT);
      tl.fromTo(tag, { scale: 1 }, { scale: 0.88, duration: 0.2, ease: "power2.in", immediateRender: false }, T_TAG_OUT);
      tl.fromTo(lead, { scaleX: 1 }, { scaleX: 0, duration: 0.18, ease: "power2.in", immediateRender: false }, T_TAG_OUT);
    };
    const tA = beamTimeAt(A.y),
      tB = beamTimeAt(B.y);
    callout(nodeA, leadA, tagA, tA, -18);
    callout(nodeB, leadB, tagB, tB, 18);
    // « ANALYSE… » stays alive: the dots count up once per beat (120 BPM grid, reset on each beat), live dot pings
    PP.drive(
      tl,
      (v) => {
        const n = Math.floor((((v % 1) + 1) % 1) * 4);
        dots.forEach((d, i) => (d.style.opacity = i < n ? "1" : "0.18"));
      },
      tA / 0.5,
      T_TAG_OUT / 0.5,
      tA,
      T_TAG_OUT - tA,
      "none"
    );
    tl.fromTo(liveRing, { scale: 1, opacity: 0.8 }, { scale: 2.6, opacity: 0, duration: 0.5, ease: "power1.out", repeat: 2 }, tA + 0.2);
    // « ? » gets a second little nod on the beat after the VO line ends
    tl.fromTo(tagB, { rotation: 0 }, { rotation: -8, duration: 0.12, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, 2.0);

    // ------------------------------------------------------------------ exit 2.80 → 3.20
    // quick text-out so the top zone is clear (≈ 3.01) when s23's L2 headline starts (« On » ≈ 3.00)
    // (the LINES move, not the words: a word sliding inside its overflow-hidden line got its ascenders sliced off)
    PP.textOut(tl, h.lines, T_OUT - 0.04, { dur: 0.2, stagger: 0.02 });
    // tiny anticipation lift, then the vial drops out of frame under the rising phone (fully off-frame by 3.14)
    // (in-out ease: power2.out started at full speed and the vial + brackets jumped ~17 px in the single frame 2.70→2.73)
    tl.fromTo(rig, { y: 0, scale: 1 }, { y: -24, scale: 1.015, duration: 0.14, ease: "power2.inOut", immediateRender: false }, T_OUT - 0.1);
    // (quad ease + a quick dissolve while the phone passes over it: with the old cubic ease the vial was still parked
    // when the phone's top edge reached it and read as "plugged into" the phone for ~3 frames, 2.93–3.00)
    tl.fromTo(rig, { y: -24, scale: 1.015, rotation: 0 }, { y: 1500, scale: 0.8, rotation: 4, duration: 0.3, ease: "power1.in", immediateRender: false }, T_OUT + 0.04);
    tl.fromTo(rig, { opacity: 1 }, { opacity: 0, duration: 0.13, ease: "none", immediateRender: false }, T_OUT + 0.08);
    tl.fromTo(back, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in", immediateRender: false }, T_OUT);
  });
})();
