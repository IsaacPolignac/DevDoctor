// s8 — END CARD (section window 26.00–30.00, brief S8). Final hit at 26.00.
// S7 hands over a 12 px point (white core, --accent glow) at (540, 880) unscaled screen px; here it bursts
// into a radial bloom (80 % → 0 in 0.5 s) whose shock front lights up a molecular lattice as it expands.
// The wordmark resolves out of the light (scale 1.18 → 1, blur 16 → 0, tracking 0.12em → -0.03em, expo.out),
// a light sweep crosses its letterforms, then tagline → URL pill (border draws around) → CTA types on →
// legal line. 28.00–30.00 hold on the complete card; camera push + lattice rotation keep it alive.
//
// Layer structure (root = <section id="s8">):
//   cam   (camera push-in 1.00 → 1.04, 26.00–30.00)
//     latRot (lattice, rotating +3°)  > lat (5 % hairlines, revealed by the shock front) · ring (the front)
//     logo > inner > wordmark · sweep (duplicate wordmark, moving gradient clipped to the text)
//     tagline · pill { fill · svg border · url } · cta · legal
//   bloom · flash · streak · point   (unscaled screen space, centre 540 880)
PP.scene("s8", function (tl, root, cam) {
  const cfg = PP.cfg;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  const T0 = 26.0;
  const T1 = 30.0;
  const PX = 540; // burst point (S7 hand-off), unscaled screen px
  const PY = 880;

  // ================================================================== molecular lattice
  // Graphene-like hexagonal hairline lattice (pointy-top rings, edge A) with a seeded Kekulé subset of
  // rings carrying benzene double bonds (short inner parallels on alternate edges). Centred on the burst
  // point so the rotation pivots there; R covers the frame corners at any rotation (max 1172 px away).
  const A = 46;
  const R = 1240;
  const HW = Math.sqrt(3) * A;
  const latRot = PP.el("div", "s8-latrot", cam);
  latRot.style.left = PX - R + "px";
  latRot.style.top = PY - R + "px";
  latRot.style.width = latRot.style.height = 2 * R + "px";
  latRot.style.transformOrigin = R + "px " + R + "px";

  const rnd = PP.rng(2611);
  const seen = new Set();
  let dEdges = "";
  let dBonds = "";
  const f1 = (x) => x.toFixed(1);
  const rows = Math.ceil(R / (1.5 * A)) + 1;
  const cols = Math.ceil(R / HW) + 1;
  for (let j = -rows; j <= rows; j++) {
    for (let i = -cols; i <= cols; i++) {
      const cx = R + i * HW + (Math.abs(j) % 2 ? HW / 2 : 0);
      const cy = R + j * 1.5 * A;
      if (Math.hypot(cx - R, cy - R) > R + A) continue;
      const v = [];
      for (let k = 0; k < 6; k++) {
        const a = ((-90 + 60 * k) * Math.PI) / 180;
        v.push([cx + A * Math.cos(a), cy + A * Math.sin(a)]);
      }
      for (let k = 0; k < 6; k++) {
        const p = v[k];
        const q = v[(k + 1) % 6];
        const ka = f1(p[0]) + "," + f1(p[1]);
        const kb = f1(q[0]) + "," + f1(q[1]);
        const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        if (seen.has(key)) continue;
        seen.add(key);
        dEdges += "M" + ka + "L" + kb;
      }
      if (rnd() < 0.16) {
        const off = rnd() < 0.5 ? 0 : 1;
        for (let k = off; k < 6; k += 2) {
          const p = v[k];
          const q = v[(k + 1) % 6];
          const ip = [cx + (p[0] - cx) * 0.76, cy + (p[1] - cy) * 0.76];
          const iq = [cx + (q[0] - cx) * 0.76, cy + (q[1] - cy) * 0.76];
          const s = [ip[0] + (iq[0] - ip[0]) * 0.16, ip[1] + (iq[1] - ip[1]) * 0.16];
          const e = [ip[0] + (iq[0] - ip[0]) * 0.84, ip[1] + (iq[1] - ip[1]) * 0.84];
          dBonds += "M" + f1(s[0]) + "," + f1(s[1]) + "L" + f1(e[0]) + "," + f1(e[1]);
        }
      }
    }
  }
  const latSvg = (cls) => {
    const wrap = PP.el("div", cls, latRot);
    const s = PP.svg("svg", { width: 2 * R, height: 2 * R, viewBox: `0 0 ${2 * R} ${2 * R}` }, wrap);
    PP.svg("path", { d: dEdges + dBonds, class: "s8-lat-path" }, s);
    return wrap;
  };
  const lat = latSvg("s8-lat");
  const ring = latSvg("s8-lat s8-lat-ring");

  // ================================================================== logo (width 620, ink centred on y 820)
  const LOGO_CY = 820;
  const logoBox = PP.el("div", "s8-logo", cam);
  const inner = PP.el("div", "s8-logo-inner", logoBox);
  const logo = PP.logo(inner, { width: 620 });
  let sweep = null; // duplicate wordmark (or masked overlay for an image logo) carrying the light band
  let setLS = null; // wordmark tracking driver
  let dotX = 0; // i-dot centre, px from the wordmark's left edge (for the sweep glint)
  let logoW = 620;
  let boxTop;
  let boxH;
  if (!logo.isImage) {
    const fs = logo.fontSize;
    // ink box of the wordmark inside its line box (line-height 1): measured, with the i-dot on top
    let inkTop = 0.107 * fs;
    let inkBot = 1.087 * fs;
    try {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `600 ${fs}px "Inter Tight"`;
      const m = ctx.measureText("PurePeptide");
      if (m.fontBoundingBoxAscent && m.actualBoundingBoxAscent) {
        const base = (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        inkTop = Math.min(base - m.actualBoundingBoxAscent, 0.075 * fs);
        inkBot = base + m.actualBoundingBoxDescent;
      }
    } catch (e) {
      /* keep the estimate */
    }
    boxH = fs;
    boxTop = LOGO_CY - (inkTop + inkBot) / 2;

    const dup = PP.logo(inner, { width: 620 });
    dup.el.classList.add("s8-sweep");
    sweep = dup.el;
    const wms = [logo, dup];
    // Tracking animates on both copies. The trailing letter-space of the last glyph would push the ink
    // off-centre (and the i-dot off its stem), so a matching leading margin and a dot correction follow it.
    setLS = (ls) => {
      const l = ls.toFixed(4) + "em";
      const dm = (-0.09 - (ls + 0.03) / 2).toFixed(4) + "em";
      for (const w of wms) {
        w.el.style.letterSpacing = l;
        w.el.style.marginLeft = l;
        w.dot.style.marginLeft = dm;
      }
    };
    setLS(-0.03);
    logoW = logo.el.offsetWidth;
    dotX = logo.dot.getBoundingClientRect().left + logo.dot.offsetWidth / 2 - logo.el.getBoundingClientRect().left;
  } else {
    boxH = 400;
    boxTop = LOGO_CY - boxH / 2;
    logoBox.classList.add("s8-logo-img");
    sweep = PP.el("div", "s8-sweep-img", inner);
    const mk = `url("${cfg.logoUrl}")`;
    sweep.style.webkitMaskImage = mk;
    sweep.style.maskImage = mk;
  }
  logoBox.style.top = boxTop.toFixed(2) + "px";
  logoBox.style.height = boxH.toFixed(2) + "px";
  logoBox.style.transformOrigin = `540px ${(LOGO_CY - boxTop).toFixed(2)}px`;

  // ================================================================== copy
  const tag = PP.headline(cam, ["Purity you can *verify.*"], "tagline");
  tag.el.classList.add("s8-tag");

  const pillRow = PP.el("div", "s8-pillrow", cam);
  const pill = PP.el("div", "s8-pill", pillRow);
  const pillFill = PP.el("div", "s8-pill-fill", pill);
  const url = PP.el("span", "mono s8-url", pill, { text: "purepeptide.care" });
  const PW = pill.offsetWidth;
  const PH = pill.offsetHeight;
  const border = PP.svg("svg", { class: "s8-pill-svg", width: PW, height: PH, viewBox: `0 0 ${PW} ${PH}` }, pill);
  // two strokes leave the top centre in opposite directions and meet at the bottom centre
  const pr = (PH - 1) / 2;
  const pmid = PW / 2;
  const pathR = PP.svg("path", { d: `M${pmid} 0.5 H${PW - 0.5 - pr} A${pr} ${pr} 0 0 1 ${PW - 0.5 - pr} ${PH - 0.5} H${pmid}` }, border);
  const pathL = PP.svg("path", { d: `M${pmid} 0.5 H${0.5 + pr} A${pr} ${pr} 0 0 0 ${0.5 + pr} ${PH - 0.5} H${pmid}` }, border);

  const cta = PP.el("div", "mono s8-cta", cam);
  const ctaChars = PP.chars(cta, cfg.endCta);

  const legal = PP.el("div", "mono muted s8-legal", cam, { text: "FOR RESEARCH USE ONLY · NOT FOR HUMAN CONSUMPTION" });

  // ================================================================== burst (unscaled screen space)
  const bloom = PP.el("div", "s8-bloom", root); // wide --accent bloom (the brief's 80 % → 0 in 0.5 s)
  const flash = PP.el("div", "s8-flash", root); // white-hot centre of the burst, gone first
  const streak = PP.el("div", "s8-streak", root); // anamorphic flare through the point (scan-line motif)
  const point = PP.el("div", "s8-point", root);
  const halo = PP.el("div", "s8-halo", point);
  const core = PP.el("div", "s8-core", point);

  // ================================================================== timeline
  PP.camera(tl, cam, T0, T1);

  // --- lattice: +3° over the scene (constant drift). Revealed by the shock front of the burst, which
  // lights the rings it crosses (the brighter copy, masked to a thin band behind the front).
  tl.fromTo(latRot, { rotation: 0 }, { rotation: 3, duration: T1 - T0, ease: "none" }, T0);
  const setFront = (rf) => {
    const r0 = Math.max(0, rf);
    lat.style.webkitMaskImage = lat.style.maskImage = `radial-gradient(circle at ${R}px ${R}px, #000 0px, #000 ${r0.toFixed(1)}px, rgba(0,0,0,0) ${(r0 + 320).toFixed(1)}px)`;
    const k = clamp01(rf / 1500);
    ring.style.opacity = (Math.pow(1 - k, 1.4) * clamp01(rf / 60)).toFixed(3);
    ring.style.webkitMaskImage = ring.style.maskImage = `radial-gradient(circle at ${R}px ${R}px, rgba(0,0,0,0) ${Math.max(0, r0 - 200).toFixed(1)}px, #000 ${Math.max(0, r0 - 16).toFixed(1)}px, rgba(0,0,0,0) ${(r0 + 24).toFixed(1)}px)`;
  };
  PP.drive(tl, setFront, -320, 1500, T0, 1.2, "power2.out");

  // --- the point bursts: core flares and dissolves, halo expands; radial bloom 80 % → 0 in 0.5 s
  tl.fromTo(core, { scale: 1, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.22, ease: "power2.out" }, T0);
  tl.fromTo(halo, { scale: 1, opacity: 1 }, { scale: 2.8, opacity: 0, duration: 0.4, ease: "power2.out" }, T0);
  tl.fromTo(bloom, { scale: 0.4 }, { scale: 1.25, duration: 0.5, ease: "expo.out" }, T0);
  tl.fromTo(bloom, { opacity: 0.8 }, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, T0);
  tl.fromTo(flash, { scale: 0.55, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 0.3, ease: "power2.out" }, T0);
  tl.fromTo(streak, { scaleX: 0.18, opacity: 1 }, { scaleX: 1, opacity: 0, duration: 0.42, ease: "expo.out" }, T0);

  // --- logo resolves 26.00–26.90 (expo.out): scale 1.18 → 1, blur 16 → 0, tracking 0.12em → -0.03em
  tl.fromTo(logoBox, { scale: 1.18, filter: "blur(16px)" }, { scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, T0);
  // (held back one frame: the 26.00 hit frame belongs to the flash, and the widest-tracked first state
  // never shows outside the safe zone)
  tl.fromTo(logoBox, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, T0 + 0.04);
  if (setLS) PP.drive(tl, setLS, 0.12, -0.03, T0, 0.9, "expo.out");

  // --- light sweep 26.40–27.10: a soft white / --accent band travelling left → right inside the letterforms.
  // The wordmark resolves at 80 % luminance and the band leaves it at full --text behind it, so the light
  // reads even though the letters are already near-white; the band's glow spills just outside the strokes.
  const BW = 300; // band box width (the bright core is the middle ~20 %)
  const TXT = "#EEF3F8";
  const DIM = "#C2C9D0";
  const baseSt = logo.isImage ? null : logo.el.style;
  const setSweep = (u) => {
    const xc = -60 + u * (logoW + 120); // band centre, px from the wordmark's left edge (just off the ink at both ends)
    const x = xc - BW / 2;
    sweep.style.backgroundPosition = `${x.toFixed(1)}px 0px`;
    sweep.style.opacity = u <= 0 || u >= 1 ? "0" : "1";
    if (baseSt) {
      if (u <= 0 || u >= 1) {
        baseSt.color = u <= 0 ? DIM : "";
        baseSt.backgroundImage = "none";
        baseSt.backgroundColor = "transparent";
        baseSt.webkitBackgroundClip = baseSt.backgroundClip = "border-box";
      } else {
        baseSt.color = "transparent";
        baseSt.backgroundImage = `linear-gradient(102deg, ${TXT} 0%, ${TXT} 40%, ${DIM} 60%, ${DIM} 100%), linear-gradient(${TXT}, ${TXT})`;
        baseSt.backgroundSize = `${BW}px 100%, ${Math.max(0, x).toFixed(1)}px 100%`;
        baseSt.backgroundPosition = `${x.toFixed(1)}px 0px, 0px 0px`;
        baseSt.backgroundRepeat = "no-repeat";
        baseSt.backgroundColor = DIM;
        baseSt.webkitBackgroundClip = baseSt.backgroundClip = "text";
      }
    }
    if (logo.dot) {
      // the band pings the --accent i-dot as it crosses it
      const d = (xc - dotX) / 60;
      const g = Math.exp(-d * d);
      logo.dot.style.boxShadow =
        g > 0.01
          ? `0 0 0.12em rgba(127,231,255,0.6), 0 0 ${(26 * g).toFixed(1)}px ${(5 * g).toFixed(1)}px rgba(127,231,255,${(0.75 * g).toFixed(3)})`
          : "";
    }
  };
  PP.drive(tl, setSweep, 0, 1, 26.4, 0.7, "power1.inOut");

  // --- tagline 26.70–27.20 (brief text-in; expo.out is visually settled by 27.20)
  // (switched on one frame into the reveal: before it, the blurred word tops would peek through the
  // mask's bottom padding)
  tl.fromTo(tag.el, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 26.71);
  PP.wordsIn(tl, tag.words, 26.7, { dur: 0.5, stagger: 0.05 });

  // --- URL pill 27.20–27.60: border draws around from the top centre, text fades in, glass fill settles
  PP.draw(tl, [pathR, pathL], 27.2, 0.4);
  tl.fromTo(url, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.32, ease: "power2.out" }, 27.28);
  tl.fromTo(pillFill, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 27.4);

  // --- CTA types on 27.60–27.90 (per-char rate scaled so the last glyph lands by 27.90)
  PP.typeOn(tl, ctaChars, 27.6, 0.29 / Math.max(1, ctaChars.length - 1));

  // --- legal line fades in at 27.80 and stays (fully readable 28.00–30.00)
  tl.fromTo(legal, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, 27.8);
});
