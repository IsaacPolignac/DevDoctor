// S09 · "The cart does the math" — the dive and the close pose · f822–f936 (27.40–31.20) · 3D: the take (#v-take, stage-level z 30,
// assets/layers/take.webm = renders/3d/take/final/0708–1188 with frost, thaw, shadow and soft-clip baked by tools/post_layers.py;
// media f708–f1188, data-start 23.6, gated by main.js). The picture of this shot is in that layer (SHOTS §S09; every number below
// was verified on the decoded webm frames of this window, not on the contract's estimates):
//   dive    f822–f868: move(REST drifted (spin 1.5°, loc x +2 mm) → CLOSE (4°, −3°, −1°, (0, −0.288, +0.006))), ease 0.6/0/0.2/1, 46 f,
//           motion blur 0.5. The display grows from 869 px (REST, 1.0 px/pt) to 1394.5 px tall (1.596 px/pt: the site is the set);
//           its top leaves the frame at f842, the bottom at f844, the body settles at x 599–1321 (corners.json). Fastest frame
//           f841 MEASURED: pose_speed.json 0.636 m/s and 8.80 °/s (f840 0.591 / f842 0.626 / f843 0.571 m/s); moves.json
//           dive.fastest_frame = 841; tools/mix_audio.py fastest("DIVE") (deg/s + 100·m/s) resolves the same frame. The contract's
//           "≈ f843" was the pre-render estimate: the whoosh, the thoomp (+1 f) and the CA pass all sit on the measured frame.
//   hold    f868–f936: the creep loc y −0.288 → −0.284 (0.472 → 0.476 m, the display 1394.5 → 1383 px tall) and spin 4.0 → 4.5°
//           (pose_speed.json: 0.0073 °/f, 0.059 mm/f, every frame different) — never static. The rails are the two Deep-Blue columns
//           at the screen's edges, the screen is the only light besides the strips (Key/Fill warm since f839), SheenCard as built.
//   screen  the baked SEQUENCE (scr_n = f − 707; tools/bake_qc.py PASS: taps centred 1.7 / 0.94 / 0.94 pt, f930 vs
//           clean/screen_cart.png mean 0.02 levels, OCR 0 hits). Resolved frames in PP.SCREEN (js/screen_tl.js), asserted below:
//           home @ 36 (the momentum scroll ends f840) → tapCart f850 (ring on the cart icon at screen (319, 107)) → push1 home →
//           cart1 @ 150 f852–f864 (cart1 reads: qty 1, $84.99; landed 6 f before VO "Let" f870) → badge pop f866 → tap1 f888 ("+" at
//           (226, 422)) → state2 f890 (cart2: qty 2, "Volume discount −5%", $161.48; bar 0.4207 → 0.811 f890–f904 as "math." f893
//           is said) → tap2 f912 ("+" at (226, 442)) → state3 f914 (cart3: qty 3, "Volume discount −8%", "Free shipping unlocked!",
//           $234.57; bar 0.811 → 1.00 f914–f928, teal outline) 3 f before "automatic." f917 → cart3 @ 150 holds to f936 and on.
//           At the close pose the frame shows screen pt ≈ 135–812: the item band (pt 300–490) sits at y ≈ 263–567, the Summary
//           block (pt ≥ 877) is below the frame, the BAC-water region (pt 672–812, page y 760–900) is blank white, the product
//           page never appears. Offers are the cart's own pixels at native size (≈ 1.5 s), never captioned, never lifted.
// What THIS file adds (nothing else is typed or drawn — SHOTS §S09 "Text: none"):
//   1. the CA pass on the dive peak (BRIEF §3.5: the second of the three allowed moments, "≤ 2 px on the phone webm layer only"),
//      as a LENS (lateral, radial) chromatic aberration, html/S09.html #s09-lens on #v-take ONLY over f838–f844 (± 3 f around the
//      MEASURED fastest frame f841): R magnified / B shrunk about the optical centre (960, 540) by feDisplacementMap with a radial
//      ramp map, so the shift is 0 on axis and k·r off axis, k = 2 px / 615 px (615 = the farthest phone pixel on f841: the
//      display corners in corners.json + the rails) — a sine envelope, 0 on f838, k·0.50 / 0.87 / 1.00 / 0.87 / 0.50 on f839–f843,
//      0 again (filter cleared) on f844. Why radial and not the shared uniform #ca (S07 glint, S12 exit): this is the one CA moment
//      that is a DOLLY — real lateral CA is radial, it grows toward the edge of the field exactly where the move streaks — and it
//      keeps the site's own "Purity, proven." at the frame centre clean at the speed peak (the uniform pass split it 2 px).
//      Measured in a HyperFrames render test (Skia rounds displacements to whole pixels): centre 0.0 px, 1 px per axis from 154 px off axis (the rails,
//      the nav, the trust bar), 2 px only in the top/bottom 80 px rows of the frame, radial direction everywhere (R outward, B inward); the same pattern in `hyperframes snapshot` of this
//      project (centre 0.0 px, ±1 px at the four phone quadrants on f841). If #s09-lens is missing the shared uniform PP.ca pass runs
//      instead (same window, 2 px).
//      Deviation from the contract's "f840–f846": that window was centred on the estimated f843; the shipped move peaks on f841, and
//      the aberration must sit on the speed (the whoosh does, ± 1 f, via pose_speed.json), so the window moved 2 f earlier. Width
//      unchanged (6 f), nothing else moves.
//   2. the 2D fallback (PP.FALLBACK_2D only, BRIEF §10.3 / BUILD.md "accepted downgrade"): PH.cam over f822–f868 (46 f, ease
//      "cam") to the 3D close pose read from corners.json f868 — g 1.6 (1.596 px/pt / PH.K), the screen centre pt (201, 437) at
//      stage (961, 485) — then the creep to g 1.587 over f868–f936 (corners.json f936: ×0.9917, linear like the 3D loc y), so the
//      fallback never holds a static frame either. PH.CAMS.DIVE (cx 1340: the previous film's phone-right framing with callouts
//      beside it) is NOT used: this film's close pose is centred (BRIEF §2 J2/B).
//   3. build-time asserts (console.warn, never throws): the take layer is placed on f708 and covers the window; the VO words of L08
//      sit inside the window; cart1 has landed ≥ 6 f before "Let"; cart3 is on screen on or before "automatic." (≤ 6 f early);
//      the cart tap and the push land inside the dive; the dive starts on VO "site." + 3 f (S08's hand-off, checked from this side).
// Hand-offs (§0.9): f822 from S08 — continuous, same take: the dive starts from the drifted REST pose (spin 1.50°, loc x 2.000 mm,
// pose_speed.json f822; S08's leak is 0 again by f820); f936 to S10 — continuous: the tilt starts from the crept close pose (spin 4.5°,
// loc y −0.284, corners.json f936), nothing of S09 outlives the window (the lens CA is cleared on f844, the section paints nothing).
// Sound (BRIEF §7, SHOTS §S09; 3D fastest frames are in pose_speed.json / moves.json, read by the mixer): DIVE f822 → f868, peak f841
// MEASURED (doppler_whoosh 1.4 align=peak, thoomp D2 at f842 = peak + 1) · CART TAP f850 (tap 2350 + haptic) · PUSH1 f852 → f864, peak f854
// (swipe) · BADGE pop f866 (pop E7, stays "1") · "Let" f870 / "cart" f876 (no cue: the cart reads) · TAP1 f888 (tap + haptic), state2
// f890 (pop E7 + price-roll ticks), bar band_rise f890 → f904 · "math." f893 (no cue) · TAP2 f912, state3 f914, bar f914 → f928 ·
// AUTOMATIC f917 (soft_chime D6/A6). No 2D move in this shot: the lens CA has no sound of its own, it rides the dive's whoosh.
PP.shot("S09", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S09"), T1 = PP.OUT("S09"); // f822, f936
  const F0 = PP.WIN.S09[0], F1 = PP.WIN.S09[1];
  const E = PP.SCREEN || {}; // the resolved screen timeline (js/screen_tl.js ran before the shots: main.js)
  const take = document.getElementById("v-take");

  // ---- the voice (read, never hard-coded; clamped into the window with a warning) ----------------------------------------
  const tLet = PP.word("S09", "L08", "Let", "S09 L08 Let"); // f870: cart1 reads (landed f864)
  const tCart = PP.word("S09", "L08", "cart", "S09 L08 cart"); // f876: the hold
  const tMath = PP.word("S09", "L08", "math", "S09 L08 math."); // f893: the bar is filling after "+" #1
  const tAuto = PP.word("S09", "L08", "automatic", "S09 L08 automatic."); // f917: cart3 (free shipping unlocked) reads
  const fLet = PP.toF(tLet), fAuto = PP.toF(tAuto);
  void tCart; void tMath;

  // ---- the take: the whole picture; assert its placement and coverage (the layer is stage-level, main.js gates it) ----------
  const DIVE0 = F0, DIVE1 = F0 + 46; // f822–f868: move(REST drifted → CLOSE), 46 f (blender/take.py)
  const FASTEST = 841; // MEASURED: renders/3d/take/pose_speed.json (0.636 m/s, 8.80 °/s) = moves.json dive.fastest_frame
  if (!take) console.warn("[S09] #v-take missing (assets/layers/take.webm): no dive, no cart — re-run tools/assemble.py once it lands");
  else {
    const s = +take.dataset.start, d = +take.dataset.duration, ms = +take.dataset.mediaStart || 0;
    if (PP.toF(s) !== 708 || ms !== 0) console.warn(`[S09] #v-take placed at f${PP.toF(s)} / media-start ${ms}: the take must start on f708 (media 0)`);
    if (PP.toF(s + d) < F1) console.warn(`[S09] #v-take ends at f${PP.toF(s + d)}, before the window's end f${F1}`);
  }
  if (FASTEST <= DIVE0 || FASTEST >= DIVE1) console.warn(`[S09] the measured fastest frame f${FASTEST} is outside the dive f${DIVE0}–f${DIVE1}`);
  // S08's hand-off checked from this side: the dive begins on VO "site." + 3 f (BRIEF §5)
  const fSite = VO.f("L07", "site");
  if (fSite + 3 !== F0) console.warn(`[S09] the window starts f${F0} but VO "site." + 3 f is f${fSite + 3}: the dive is no longer on the word`);

  // ---- 1. LENS CA ± 3 f around the measured dive peak, ≤ 2 px, phone layer only (cleared again on f844, inside the window) ---
  const CA0 = Math.max(F0, FASTEST - 3), CA1 = Math.min(F1 - 1, FASTEST + 3); // f838–f844
  if (CA1 - CA0 !== 6) console.warn(`[S09] CA window f${CA0}–f${CA1} is not 6 f (clamped into the shot)`);
  const lens = document.getElementById("s09-lens"), lensR = document.getElementById("s09-lens-r"), lensB = document.getElementById("s09-lens-b");
  const R_MAX = 615, PX = 2; // px of shift at the farthest phone pixel on the peak frame (BRIEF §3.5: ≤ 2 px)
  const MAP_SPAN = 1920; // the ramp map spans 1920 px for 0 → 1 (html/S09.html): shift = scale · (r / MAP_SPAN)
  if (take && lens && lensR && lensB) {
    PP.drive(tl, (u) => {
      const a = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); // sine: 0 on f838, 1 on f841, 0 on f844
      if (a < 0.125) { // < 0.25 px anywhere on the phone (Skia rounds displacements to whole px): no filter at all
        if (take.style.filter) take.style.filter = "";
        return;
      }
      const s = (PX / R_MAX) * MAP_SPAN * a; // 6.24 at the peak
      lensR.setAttribute("scale", (-s).toFixed(3)); // R sampled toward the centre = magnified (red fringe outward)
      lensB.setAttribute("scale", s.toFixed(3)); // B sampled away from it = shrunk (blue fringe inward)
      take.style.filter = "url(#s09-lens)";
    }, 0, 1, f(CA0), f(CA1 - CA0), "none");
  } else if (take) {
    console.warn("[S09] #s09-lens missing (html/S09.html): falling back to the uniform PP.ca pass");
    PP.ca(tl, f(CA0), f(CA1), 2, take);
  }

  // ---- the screen (baked): the resolved timeline vs the contract (every value is read, none re-derived) --------------------
  const tapCart = E.tapCart, push1 = E.push1 || [], state2 = E.state2, state3 = E.state3, tap1 = E.tap1, tap2 = E.tap2;
  if (tapCart == null || push1.length !== 2 || state3 == null) console.warn("[S09] PP.SCREEN is not resolved: js/screen_tl.js must run before the shots (main.js)");
  else {
    if (!(tapCart > DIVE0 && push1[1] <= DIVE1 - 4)) console.warn(`[S09] cart tap f${tapCart} / push landing f${push1[1]} are not inside the dive (f${DIVE0}–f${DIVE1 - 4})`);
    if (push1[1] + 6 > fLet) console.warn(`[S09] cart1 lands f${push1[1]}, less than 6 f before "Let" f${fLet}`);
    if (state2 !== tap1 + 2 || state3 !== tap2 + 2) console.warn(`[S09] state changes f${state2}/f${state3} are not tap + 2 f (taps f${tap1}/f${tap2})`);
    if (state3 > fAuto || fAuto - state3 > 6) console.warn(`[S09] cart3 state f${state3} vs "automatic." f${fAuto}: must be on the word or ≤ 6 f before it`);
    if (state3 + 14 > F1) console.warn(`[S09] the bar's fill (f${state3}–f${state3 + 14}) runs past the window f${F1}`);
  }

  // ---- 2. the 2D fallback: the same dive on #phone2d (accepted downgrade), to the 3D close pose, then the creep -------------
  if (PP.FALLBACK_2D && window.PH && PH.cam) {
    // corners.json f868: display 1394.5 px tall = 1.596 px/pt → g = 1.596 / PH.K ≈ 1.60; centre of the 4 corners (961, 485)
    const CLOSE2D = { g: 1.6, ox: 201, oy: 437, cx: 961, cy: 485 };
    PH.cam(tl, f(DIVE0), f(DIVE1 - DIVE0), CLOSE2D, "cam"); // cubic-bezier(0.6, 0, 0.2, 1), SHOTS §0.8
    // the creep f868–f936: 0.472 → 0.476 m = ×0.9917 (corners.json f936: 1383 px tall), linear like the 3D loc y
    PH.cam(tl, f(DIVE1), f(F1 - DIVE1), { g: 1.6 * 0.9917, ox: 201, oy: 437, cx: 961, cy: 485 }, "none");
  }
  void T0; void T1; void F; void root;
});
