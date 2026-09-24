// s4 — IDENTITY (section window 9.50–12.00, brief S4 10.00–12.00).
// "Identity, confirmed." + a mass-match card: stylised mass spectrum (36 seeded bars, one dominant
// --accent peak), "MASS MATCH" label + check, EXPECTED / OBSERVED masses linked to the peak by a leader.
// 11.55–12.00 match cut (SCENES.md hand-off #4): the bars collapse edges→centre into the baseline, which
// ignites into one 2 px --accent scan line and rises to y 560, x 160→920 (unscaled screen px) at 12.00.
//
// Layer structure (root = <section id="s4">):
//   cam   (camera push-in 1.00→1.04, 10.00–12.00; static layer from 9.50 = card + footer)
//     card · headline · label group · leader SVG · spec (axis + bars; translated during the match cut) · footer
//   line  (unscaled screen space: match-cut scan line + motion trail, masked for the edges→centre ignition)
PP.scene("s4", function (tl, root, cam) {
  const C = PP.C;
  const cfg = PP.cfg;

  // ------------------------------------------------------------------ geometry (cam-local px; = screen px at scale 1)
  const CARD = { x: 120, y: 620, w: 840, h: 640, pad: 48 };
  const IX0 = CARD.x + CARD.pad; // 168  inner left
  const IX1 = CARD.x + CARD.w - CARD.pad; // 912  inner right
  const CX = CARD.x + CARD.w / 2; // 540
  const BASE = 1208; // spectrum baseline (top of the 1 px axis)
  const AREA_TOP = 808; // spectrum area = lower ~70 % of the card (808 → 1208)
  const AH = BASE - AREA_TOP; // 400
  const N = 36;
  const BW = 6;
  const PITCH = BW + 14;
  const FIELD = N * BW + (N - 1) * 14; // 706
  const FX0 = CX - FIELD / 2; // 187
  const DOM = 22; // dominant bar: centre at 62.7 % of the field width
  const barCx = (i) => FX0 + i * PITCH + BW / 2;
  const AXIS_HALF = (IX1 - IX0) / 2; // 372
  const AXIS_CY = BASE + 0.5; // axis centre line

  // seeded heights 3–18 % of the area; neighbours of the dominant peak form a faint isotope shoulder
  const rnd = PP.rng(14195);
  // skewed toward the noise floor (few mid peaks) so it reads as a spectrum, not a bar chart
  const hFrac = Array.from({ length: N }, () => 0.03 + 0.15 * Math.pow(rnd(), 1.7));
  hFrac[DOM] = 0.9;
  hFrac[DOM - 1] = 0.07;
  hFrac[DOM + 1] = 0.18;
  hFrac[DOM + 2] = 0.1;

  // camera scale as a pure function of time (PP.camera(tl, cam, 10, 12): 1.00 → 1.04 linear)
  const camS = (t) => 1 + 0.04 * Math.min(1, Math.max(0, (t - 10) / 2));
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  // ------------------------------------------------------------------ static layer (visible from 9.50)
  const card = PP.el("div", "s4-card", cam);
  const footer = PP.el("div", "mono muted s4-footer", cam, { text: "LC-MS · INDEPENDENT THIRD-PARTY LAB" });

  // ------------------------------------------------------------------ headline
  const head = PP.headline(cam, ["Identity, confirmed."], "h2");
  head.el.classList.add("s4-head");

  // ------------------------------------------------------------------ label group (x 168, y 668)
  const label = PP.el("div", "s4-label", cam);
  const mmRow = PP.el("div", "s4-mm-row", label);
  PP.el("div", "mono s4-mm", mmRow, { text: "MASS MATCH" });
  const checkWrap = PP.el("div", "s4-check", mmRow);
  const check = PP.checkIcon(checkWrap, 30, C.accent);
  check.circle.setAttribute("transform", "rotate(-90 22 22)"); // circle draws from 12 o'clock
  check.circle.setAttribute("stroke-width", 2.6);
  check.tick.setAttribute("stroke-width", 3);
  const sub = PP.el("div", "mono muted s4-sub", label);
  // units keep their SI case ("Da"), like S3's "mAU"
  sub.appendChild(document.createTextNode("EXPECTED " + cfg.mExp + " "));
  PP.el("span", "s4-unit", sub, { text: "Da" });
  sub.appendChild(document.createTextNode(" · OBSERVED "));
  const obs = PP.el("span", "s4-obs", sub);
  obs.appendChild(document.createTextNode(cfg.mObs + " "));
  PP.el("span", "s4-unit", obs, { text: "Da" });

  // ------------------------------------------------------------------ spectrum (axis + bars)
  const spec = PP.el("div", "s4-spec", cam);
  const axis = PP.el("div", "s4-axis", spec);
  const bars = [];
  let hot = null;
  let halo = null;
  for (let i = 0; i < N; i++) {
    const h = Math.round(hFrac[i] * AH);
    const b = PP.el("div", "s4-bar" + (i === DOM ? " s4-bar-dom" : ""), spec);
    b.style.left = FX0 + i * PITCH + "px";
    b.style.top = BASE - h + "px";
    b.style.height = h + "px";
    if (i === DOM) {
      halo = PP.el("div", "s4-halo", b);
      hot = PP.el("div", "s4-hot", b);
    }
    bars.push(b);
  }
  const DOM_X = barCx(DOM); // 630
  const DOM_TOP = BASE - Math.round(hFrac[DOM] * AH); // 848

  // ------------------------------------------------------------------ leader: dominant peak top → observed mass
  // Measured before any tween touches the label (cam is untransformed during the build).
  const cr = cam.getBoundingClientRect();
  const or = obs.getBoundingClientRect();
  const sr = sub.getBoundingClientRect();
  const trail = 0.12 * 20; // trailing tracking of the last glyph
  let vl = or.left - cr.left;
  let vr = or.right - cr.left - trail;
  let subBottom = sr.bottom - cr.top;
  if (!(or.width > 0)) {
    // fallback (layout unavailable): IBM Plex Mono advance 0.6 em + 0.12 em tracking at 20 px
    const adv = 20 * 0.72;
    const pre = ("EXPECTED " + cfg.mExp + " Da · OBSERVED ").length;
    vl = 168 + pre * adv;
    vr = vl + (cfg.mObs + " Da").length * adv - trail;
    subBottom = 730;
  }
  const UL_Y = Math.round(subBottom + 12); // underline under the observed value
  const ulL = Math.min(vl, DOM_X);
  const ulR = Math.max(vr, DOM_X);
  const svg = PP.svg("svg", { class: "s4-svg", width: PP.W, height: PP.H, viewBox: `0 0 ${PP.W} ${PP.H}` }, cam);
  const leaderG = PP.svg("g", { class: "s4-leader" }, svg);
  const leaderV = PP.svg("path", { d: `M${DOM_X} ${DOM_TOP - 12} V${UL_Y}` }, leaderG);
  const leaderU = PP.svg("path", { d: `M${ulL.toFixed(1)} ${UL_Y + 0.5} H${ulR.toFixed(1)}` }, leaderG);
  const junction = ((DOM_X - ulL) / Math.max(1, ulR - ulL)) * 100;

  // ------------------------------------------------------------------ match-cut line (unscaled screen space)
  const lineWrap = PP.el("div", "s4-linewrap", root);
  const WRAP_PAD = 48; // room above the line for its glow inside the masked wrapper
  const line = PP.scanLine(lineWrap, "h", 760);
  line.classList.add("s4-line");
  line.style.top = WRAP_PAD + "px";
  const trailEl = PP.el("div", "s4-trail", lineWrap);
  trailEl.style.top = WRAP_PAD + 2 + "px";
  // fuse flare where the two ignition fronts meet (outside the ignition mask)
  const flare = PP.el("div", "s4-flare", root);

  // ================================================================== timeline
  PP.camera(tl, cam, 10.0, 12.0);

  // --- headline 10.00–10.50 (hidden until then: waiting words would peek through the mask padding)
  // (switched on one frame into the reveal so the first frame shows no blurred word tops)
  tl.fromTo(head.el, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 10.01);
  PP.wordsIn(tl, head.words, 10.0);

  // --- baseline axis draws left→right just ahead of the bars
  tl.fromTo(axis, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.inOut" }, 10.0);

  // --- bars grow from the baseline 10.05 (scaleY 0→1, stagger 0.012 s, 0.35 s power3.out)
  tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: "power3.out", stagger: 0.012 }, 10.05);

  // --- dominant bar turns --accent + glow 10.55–10.80
  tl.fromTo(hot, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, 10.55);
  // confirmation pulse: soft halo blooms with the colour change, then settles to a quiet glow
  tl.fromTo(halo, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" }, 10.58);
  tl.fromTo(halo, { opacity: 1 }, { opacity: 0.35, duration: 0.45, ease: "power2.inOut", immediateRender: false }, 10.78);

  // --- label slides in 20 px from the left 10.60–10.90; check draws 10.85–11.10
  tl.fromTo(label, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 10.6);
  PP.draw(tl, check.circle, 10.85, 0.2);
  PP.draw(tl, check.tick, 10.95, 0.15, { ease: "power2.out" });

  // --- leader: rises from the peak top 10.90–11.12, then the underline opens from the junction
  PP.draw(tl, leaderV, 10.9, 0.22);
  tl.fromTo(
    leaderU,
    { drawSVG: `${junction.toFixed(2)}% ${junction.toFixed(2)}%` },
    { drawSVG: "0% 100%", duration: 0.2, ease: "power2.out" },
    11.1,
  );
  tl.fromTo(obs, { color: C.muted }, { color: C.text, duration: 0.25, ease: "power2.out" }, 11.1);

  // --- 11.55 text-out: headline, label, leader, footer
  PP.textOut(tl, [head.el, label, footer], 11.55);
  // leader retracts into the peak (reverse of its build) just before the peak collapses
  tl.fromTo(
    leaderU,
    { drawSVG: "0% 100%" },
    { drawSVG: `${junction.toFixed(2)}% ${junction.toFixed(2)}%`, duration: 0.08, ease: "power2.in", immediateRender: false },
    11.55,
  );
  tl.fromTo(leaderV, { drawSVG: "0% 100%" }, { drawSVG: "0% 0%", duration: 0.1, ease: "power2.in", immediateRender: false }, 11.58);
  tl.fromTo(leaderG, { opacity: 1 }, { opacity: 0, duration: 0.02, ease: "none", immediateRender: false }, 11.68);

  // --- 11.55–12.00 match cut ------------------------------------------------------------
  // Ignition: two fronts run from the axis ends to the centre on a quadratic ease-in (accelerating "suck").
  // Each bar collapses (≤ 0.11 s, power2.in, never before 11.55) and lands exactly as the front passes it.
  const T_CUT = 11.55;
  const IG0 = 11.6;
  const IGD = 0.16;
  const COLLAPSE = 0.11;
  bars.forEach((b, i) => {
    const d = Math.abs(barCx(i) - CX) / AXIS_HALF; // 0 centre … 1 axis end
    const land = IG0 + IGD * Math.sqrt(1 - d);
    const start = Math.max(T_CUT, land - COLLAPSE);
    tl.fromTo(b, { scaleY: 1 }, { scaleY: 0, duration: land - start, ease: "power2.in", immediateRender: false }, start);
  });

  // Rise: the line lifts from the (cam-scaled) baseline to y 560 while widening to x 160→920.
  // power1.inOut (quadratic; GSAP's power2 is cubic) keeps the peak speed ≈ 105 px/frame and still
  // lands with zero velocity at 12.00, where S5's static line takes over.
  const R0 = 11.58;
  const RD = 12.0 - R0;
  const Y_END = 560 + 1; // line centre (top edge at 560, 2 px)
  const HW_END = 380; // half-width → x 160…920
  const riseEase = gsap.parseEase("power1.inOut");
  const riseVel = (r) => (r < 0.5 ? 4 * r : 4 * (1 - r)); // d(power1.inOut)/dr
  const F = 28; // soft width of the ignition fronts
  const setMask = (m) => {
    lineWrap.style.webkitMaskImage = m;
    lineWrap.style.maskImage = m;
  };

  PP.drive(
    tl,
    (t) => {
      const s = camS(t);
      const u = clamp01((t - IG0) / IGD);
      const front = 1 - u * u; // fraction of the half-width still un-ignited
      const r = clamp01((t - R0) / RD);
      const re = riseEase(r);
      const y0 = 960 + (AXIS_CY - 960) * s; // screen y of the axis centre
      const y = y0 + (Y_END - y0) * re;
      const hw0 = AXIS_HALF * s;
      const hw = hw0 + (HW_END - hw0) * re;

      // screen line + trail
      if (u <= 0) {
        lineWrap.style.opacity = "0";
      } else {
        lineWrap.style.opacity = "1";
        lineWrap.style.transform = `translate3d(0px, ${(y - 1 - WRAP_PAD).toFixed(2)}px, 0px)`;
        line.style.left = (540 - hw).toFixed(2) + "px";
        line.style.width = (2 * hw).toFixed(2) + "px";
        const vel = ((Y_END - y0) * riseVel(r)) / RD; // px/s (negative = upward)
        const th = Math.min(96, Math.abs(vel) * 0.018);
        trailEl.style.left = (540 - hw).toFixed(2) + "px";
        trailEl.style.width = (2 * hw).toFixed(2) + "px";
        trailEl.style.height = th.toFixed(2) + "px";
        trailEl.style.opacity = th < 1 ? "0" : "1";
        if (u >= 1) setMask("none");
        else {
          const fd = front * hw;
          const L = 540 - fd;
          const R = 540 + fd;
          const Lt = Math.min(L + F, 540);
          const Rt = Math.max(R - F, 540);
          setMask(
            `linear-gradient(to right, #000 0px, #000 ${L.toFixed(1)}px, transparent ${Lt.toFixed(1)}px, transparent ${Rt.toFixed(1)}px, #000 ${R.toFixed(1)}px, #000 1080px)`,
          );
        }
      }

      // fuse flare: brief bright seam where the fronts meet (peak at IG0 + IGD), riding the line
      const fk = (t - (IG0 + IGD)) / 0.035;
      const fa = t < IG0 ? 0 : Math.exp(-fk * fk);
      flare.style.opacity = fa < 0.01 ? "0" : fa.toFixed(3);
      flare.style.transform = `translate3d(540px, ${y.toFixed(2)}px, 0px)`;

      // spectrum (in cam) rides with the line; the neutral axis hands over to the accent line
      const lineLocal = 960 + (y - 960) / s;
      spec.style.transform = r > 0 ? `translate3d(0px, ${(lineLocal - AXIS_CY).toFixed(2)}px, 0px)` : "none";
      axis.style.opacity = String(1 - clamp01((t - (IG0 + IGD)) / 0.06));

      // card: rolled up into the rising line (its bottom edge keeps the baseline→bottom padding) + dissolves
      const cut = AXIS_CY - lineLocal;
      card.style.clipPath = cut > 0.01 ? `inset(0px 0px ${cut.toFixed(2)}px 0px round 28px)` : "none";
      const co = clamp01((t - 11.62) / 0.28);
      card.style.opacity = String(1 - co * co);
    },
    11.55,
    12.0,
    11.55,
    0.45,
    "none",
  );
});
