// S07 · "Cold" — frost takes the vial, the phone arrives · f636–f738 (21.20–24.60) · hybrid: 2D frost over the held macro plate
// + the take's ARR (SHOTS §S07, §0.9). No type, no site: "cold" and "24 h" are the frost; the phone's screen is black.
// Everything is a pure function of time on the master timeline; the shot drives stage-level layers (BUILD.md) and one child.
//   0. hand-off in (§0.9, f636–f648 continuous): S06's type exits f636–f644 on #type-front (S06 owns it); the held macro frame
//      #hold-macro keeps S06's 2D push 1.00 → 1.04 (sine.inOut, zero velocity at both ends) to f738 and S06 switches it off ON
//      f738. Nothing here touches it: the frost grows over a slowly moving image, as the contract says.
//   1. FROST f648 = VO.w('L06', 0) "Shipped": #v-frost (assets/fx/frost.webm, 60 f, VP9 alpha, screen blend) is placed by
//      tools/assemble.py at data-start 21.6 and gated by main.js to f648–f707; this build ASSERTS that its start is the word
//      (console.warn if the voice or the media table ever drift apart). The growth curve lives in the asset
//      (tools/make_frost_seq.py, DLA seed 7, frost_density.json): slow for 9 f, a density step on frame 10 = f657 "cold" (the
//      crackle hit: new_px 22.7 k → 43.4 k), the skeleton spans the frame by f682, the centre window (the label, 960×540 ± 190×105)
//      is closed (alpha > 0.5 on 99.7 % of it) on f684 and 100 % on f685 — f686 = VO.w('L06', 3) "24" ± 2 as specified; the
//      halo keeps filling to f707 (coverage 0.954 → 0.962: alive to the last frame).
//   2. the hold f708–f738: #frost-full (assets/fx/frost_full.png = frost frame 60, bit-identical; screen blend) switches on at
//      f708 as the webm's window ends (seamless: same pixels) and off on f738. Static by design: frost ON THE LENS between the
//      camera and the vial does not move with the plate's push; the motion of these 30 f is the phone.
//   3. ARR f708–f738 (the take's first range, baked: assets/layers/take.webm from data-start 23.6 = f708, gated by main.js):
//      the phone enters from the right, back first, ARR0 (200°, 12°, 9°, (0.26, 0.08, 0.03)) → REST on f738 exactly
//      (corners.json f738 == screen_rect.json to 0.01 px; the f738 silhouette = front_body.png's bbox ± 1 px), screen black
//      (scr_0001–0031), Key/Fill at 0 W (rims and strips only), motion blur 0.5. Fastest frame f709 (1089 °/s, 1.29 m/s:
//      pose_speed.json); the edge-on GLINT is f712 (renders/3d/take/arr_glint.json, |screen normal · camera| 0.02 at f712, 0.30
//      at ± 1 f): a 1–2 frame sliver of light. The frost on the phone is screened inside its own alpha by tools/post_layers.py
//      (weight alpha·(1 − 0.5·matte_screen), thaw f803–f821 in S08).
//   4. CA on the glint: PP.ca over f709–f715 (± 3 f), 2 px, on #v-take ONLY (the SVG #ca filter: R +dx, B −dx), a sine that
//      peaks exactly on f712 and is 0 at both ends (BRIEF §3.5: one of the three allowed moments).
//   5. the crush f716–f738 (§S07): the whole frost field + held plate go to black on power2.in (GSAP power2 = cubic): a
//      full-frame overlay at z 16 (.s07-crush, above the field at 15 and the hold at 11, below the phone at 30) whose black
//      alpha is u³ — brightness 0.91 / 0.62 / 0.36 / 0.13 / 0.0 at f726 / f732 / f735 / f737 / f738 (measured on the snapshots)
//      — identical to a brightness multiply on a black world; its biggest step is the last one, ON the DROP: the field is cut to
//      black by the hit. POLISH (one upgrade, within the contract): the crush RETRACES THE FROST'S OWN GROWTH IN REVERSE. The
//      overlay's background is the frost's arrival map (assets/fx/s07_arrival.png, assets/fx/make_s07_arrival.py: per pixel the
//      frost frame on which it froze — alpha ≥ 0.5 in frost_0001..0060 — normalised 0 = f648 at the four edges … 1 = f685, the
//      last arrival, the vial's band; 14 px blur so the front keeps the DLA's macro outline, not the hairline jitter) and the
//      SVG filter #s07-crush-f (html/S07.html) maps that grey to the pixel's black alpha through a feComponentTransfer table
//      rewritten per frame (K = 33 entries over the arrival axis, deduped, one setter): alpha(p, f) = power2.in(clamp((f − 716)
//      / (22 − lead(p)))), lead(p) = LEAD·clamp((POOL_V − v(p)) / POOL_V): the LAST 40 % of the frost's arrivals (v ≥ POOL_V =
//      0.6: the centre, where the field closed f672–f685, ≈ 45 % of the frame, the vial's band and the phone) follow the
//      contract's law EXACTLY (their biggest step is the last one, ON the DROP: measured field mean 30 → 1.6 levels f737 → f738);
//      the first 60 % finish earlier the earlier they froze, linearly to LEAD = 8 f at the first frost (the four edges ≈ 7 f,
//      black by f731; the phone's top and bottom, y 90 / 990, ≈ 2 f). So every pixel follows power2.in on brightness and is
//      black on the DROP, and the cold leaves the way it came — from the edges inward along its own crystals — while the phone
//      lands into the last pool of frost light, which the void glow (centre
//      lift, main.js f738) takes over on the hit. LEAD = 0 gives the uniform crush as written; without the filter (no
//      #s07-crush-a) the build falls back to the contract's literal law (a black overlay, opacity power2.in). On f738 the hold is
//      off (S06), #frost-full is off (here), the section is gated off (main.js), the void glow comes on (main.js): only the
//      phone remains, at REST, on black. S08 takes over the same take without a cut. The DROP is asserted against the measured
//      music (js/cues.js: CUES.DROP == PP.DROP).
// Sound (BRIEF §7, SHOTS §S07; 2D fastest frames stated here, the 3D ones are in pose_speed.json / arr_glint.json):
//   RISER0 f630 → f738 (last sample on the DROP) · FROST f648 → f707 (frost(2.0) shaped by frost_density.json new_px; crackle
//   grains panned by the growth centroid) · COLD f657 = VO.w('L06', 1) (impact D2 lite + frost(0.4): the density step is on
//   this very frame) · CLOSE f686 = VO.w('L06', 3) (glass_settle n=4; the centre closed f684–f685) · "hours." f702 (no cue:
//   the riser is at full tilt) · ARR-GLINT f712 (doppler_whoosh peak + sfx_whoosh + tsk: the edge-on frame; the fastest frame
//   of the fly-in is f709, the whoosh is aligned to the glint as §S07 says) · the crush f716 → f738 has no sound of its own
//   except the DROP's frost(0.3) −22 tail (its fastest 2D frames: the corners' last step f730, the last pool's last step f738 = the hit) · DROP f738 (impact D1 + click13 + alu_tick + alu_ring; music DROP).
//   No other sound frames in this shot.
PP.shot("S07", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S07"), T1 = PP.OUT("S07"); // f636, f738
  const q = (s) => root.querySelector(s);
  const vFrost = document.getElementById("v-frost");
  const frostFull = document.getElementById("frost-full");
  const take = document.getElementById("v-take");
  const hold = document.getElementById("hold-macro");
  const crush = q(".s07-crush");

  // ---- the voice (read, never hard-coded; clamped into the window with a warning) ----------------------------------------
  const tShip = PP.word("S07", "L06", 0, "S07 Shipped"); // f648: the frost's first frame
  const tCold = PP.word("S07", "L06", 1, "S07 cold"); // f657: the crackle hit (density step baked on frost frame 10)
  const tClose = PP.word("S07", "L06", 3, "S07 24"); // f686: the frost has closed over the label
  const tHours = PP.word("S07", "L06", 4, "S07 hours"); // f702: the riser at full tilt; the phone enters 6 f later
  const fShip = PP.toF(tShip), fCold = PP.toF(tCold), fClose = PP.toF(tClose);
  void tHours;

  // ---- 1. FROST: the webm is placed by the media table (tools/assemble.py); assert it sits on the word -----------------------
  if (!vFrost) console.warn("[S07] #v-frost missing (assets/fx/frost.webm): no frost field over the plate — re-run tools/assemble.py");
  else {
    const s = +vFrost.dataset.start, d = +vFrost.dataset.duration;
    if (PP.toF(s) !== fShip) console.warn(`[S07] #v-frost starts at f${PP.toF(s)}, the word "Shipped" is f${fShip}: move data-start in tools/assemble.py`);
    if (PP.toF(s + d) !== 708) console.warn(`[S07] #v-frost ends at f${PP.toF(s + d)} (expected f708 = frost_full takes over)`);
    // the asset's baked beats vs the voice (tools/make_frost_seq.py: F_COLD = f657 on frame 10, F_CLOSE = f686 on frame 39)
    if (fCold !== PP.toF(s) + 9) console.warn(`[S07] the frost's density step is baked on frost frame 10 = f${PP.toF(s) + 9}, "cold" is f${fCold}: re-run make_frost_seq.py`);
    if (Math.abs(fClose - (PP.toF(s) + 38)) > 2) console.warn(`[S07] the frost closes on frost frame 39 = f${PP.toF(s) + 38}, "24" is f${fClose} (> ±2 f): re-run make_frost_seq.py`);
  }

  // ---- 2. the hold f708–f738: frost_full on as the webm ends (same pixels), off on the DROP -------------------------------
  const F_ARR = take ? PP.toF(+take.dataset.start) : 708; // the take's first frame (media table: 23.6 = f708)
  if (F_ARR !== 708) console.warn(`[S07] #v-take starts at f${F_ARR} (expected f708): the ARR is off the contract`);
  if (!frostFull) console.warn("[S07] #frost-full missing (assets/fx/frost_full.png): the field vanishes at f708 — re-run tools/assemble.py");
  else {
    // FINAL PASS: main.js hides #v-frost at exactly data-start + duration = 23.6 s and the render's f708 lands a hair before
    // it (float), so the webm (frost frame 60) and frost_full were both on, screen-blended twice: a one-frame flash (mean 174
    // → 216 levels). Both switches now sit 2 ms before f708, so f708 shows frost_full alone in the render and the snapshots.
    const H708 = f(708) - 0.002;
    tl.set(frostFull, { opacity: 1 }, H708);
    if (vFrost) tl.set(vFrost, { opacity: 0 }, H708);
    tl.set(frostFull, { opacity: 0 }, f(PP.DROP));
  }
  if (!hold) console.warn("[S07] #hold-macro missing: the frost grows over black instead of the held macro (S06 owns the hold)");

  // ---- 3 + 4. the ARR is baked in the take; CA ± 3 f around the measured glint, phone layer only --------------------------
  const GLINT = 712; // renders/3d/take/arr_glint.json (measured on the final frames; the ARR's edge-on frame)
  if (!take) console.warn("[S07] #v-take missing (assets/layers/take.webm): no phone enters — re-run tools/assemble.py once it lands");
  else PP.ca(tl, f(GLINT - 3), f(GLINT + 3), 2, take); // sine over 6 f: 0 at f709, 2 px on f712, 0 at f715

  // ---- 5. the crush f716–f738: brightness → 0 on power2.in, retracing the frost's arrival in reverse; 1.0 everywhere on the DROP
  const F_CRUSH0 = 716, F_CRUSH1 = PP.DROP; // the contract's window (22 f)
  const LEAD = 4; // frames the frame's corners (v = 0) finish ahead of the DROP; 0 = the uniform crush as written. FINAL PASS: the map is now
  // elliptical (assets/fx/make_s07_arrival.py: frost v2's own arrival map read as blotches) → a soft vignette tightening on the phone
  const POOL_V = 0.6; // arrivals at v ≥ POOL_V (the last 40 %: the centre, closed f672–f685) keep the contract's law exactly (lead 0, black ON the DROP)
  const K = 33; // transfer-table entries over the arrival axis v = 0 (first frost) … 1 (last frost, f685: the vial's band, where the phone lands)
  const EC = gsap.parseEase("power2.in"); // GSAP power2 = cubic: u³
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const funcA = document.getElementById("s07-crush-a"); // the feFuncA of #s07-crush-f (html/S07.html); its table is the per-frame law
  tl.set(crush, { opacity: 0 }, 0);
  tl.set(crush, { opacity: 1 }, f(F_CRUSH0)); // the table is all zeros at u = 0 (fully transparent) anyway
  if (!funcA) {
    console.warn("[S07] #s07-crush-a (the crush filter) missing: uniform crush, the contract's literal law (a black overlay, opacity power2.in)");
    crush.style.filter = "none";
    crush.style.background = "#000";
    tl.set(crush, { opacity: 0 }, f(F_CRUSH0));
    tl.fromTo(crush, { opacity: 0 }, { opacity: 1, duration: f(F_CRUSH1 - F_CRUSH0), ease: "power2.in", immediateRender: false }, f(F_CRUSH0));
  } else {
    // the black alpha of a pixel whose frost arrived at v (0 first … 1 last) on frame fr (continuous): the contract's law, lead(v) f early
    const leadAt = (v) => LEAD * c01((POOL_V - v) / POOL_V); // 8 f at the first frost → 0 from v = POOL_V on (the centre pool)
    const alphaAt = (fr, v) => EC(c01((fr - F_CRUSH0) / (F_CRUSH1 - F_CRUSH0 - leadAt(v))));
    let lastTable = null;
    const crushAt = (u) => {
      const fr = F_CRUSH0 + (F_CRUSH1 - F_CRUSH0) * u;
      const vals = [];
      for (let k = 0; k < K; k++) vals.push(alphaAt(fr, k / (K - 1)).toFixed(4));
      const table = vals.join(" ");
      if (table === lastTable) return;
      lastTable = table;
      funcA.setAttribute("tableValues", table);
    };
    PP.drive(tl, f(F_CRUSH0), f(F_CRUSH1 - F_CRUSH0), crushAt); // u linear over f716–f738; the ease is inside alphaAt
  }
  if (PP.CUES && Math.abs(PP.CUES.DROP * 30 - PP.DROP) > 0.5) console.warn(`[S07] js/cues.js puts the DROP at ${PP.CUES.DROP} s (f${Math.round(PP.CUES.DROP * 30)}), PP.DROP is f${PP.DROP}: the hit and the picture disagree`);
  if (PP.toF(T1) !== PP.DROP) console.warn(`[S07] the window ends on f${PP.toF(T1)}, the DROP is f${PP.DROP}`);
  void T0;
});
