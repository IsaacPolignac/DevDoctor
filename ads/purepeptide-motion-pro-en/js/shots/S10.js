// S10 · "The math, in depth" — the tilt and the three slabs · f936–f1044 (31.20–34.80) · 3D: the take + the shadow pass (#v-take,
// stage-level z 30, assets/layers/take.webm = renders/3d/take/final/0708–1188 with the slab shadows and the soft-clip baked by
// tools/post_layers.py; media f708–f1188, data-start 23.6, gated by main.js). The picture of this shot is in that layer (SHOTS §S10);
// every number below was MEASURED on the shipped final frames, the ID mattes, corners.json and pose_speed.json of this window:
//   tilt    f936–f966: move(CLOSE crept (spin 4.5°, tilt −3°, roll −1°, loc (0, −0.284, +0.006)) → CARDS (14°, −5°, −2°, (0.012,
//           −0.253, 0.004))), ease 0.6/0/0.2/1, 30 f, motion blur 0.5. Fastest frame f949 (pose_speed.json 32.6 °/s, 0.112 m/s;
//           moves.json tilt.fastest_frame = 949, the contract's estimate). The display goes from 1383 px tall, centred (the close
//           pose: rails at the frame edges) to the ¾ cards pose — corners TL (762,−149) TR (1336,−135) BR (1391,1145) BL (804,1173)
//           at f966, 1.49 px/pt, the phone still taller than the frame.
//   drift   f966–f1044: spin 14 → 16° (sine.inOut, 0.77 °/s mean ≥ the 0.5 °/s rule), loc x +1 mm; the corners walk 13 px right
//           (corners.json f966 → f1044). Never static.
//   slabs   three 1 mm slabs (common.slab: rounded rect → extrude 1.0 mm → bevel 0.35 mm × 3, 6× capture-crop front, milky edges,
//           pass_index 2) lift off the glass along its normal with scale 1.00 → 1.25 (20 f expo.out, 104 % overshoot):
//             stepper  "− 3 +"             f954–f974, 36 mm   (the thing that was tapped: hierarchy top)
//             total    "$234.57"           f959–f979, 24 mm   (the result of the math)
//             name     "BPC-157 / TB-500"  f964–f984, 12 mm   (the compound, as printed)
//           and seat back (10 f power3.in to lift 0 / scale 1.0 + a 4 f 0.4 mm settle, then hidden): total f1020 (settled f1034,
//           hidden f1035), name f1025 (f1039 / f1040), stepper f1030 (f1044 / f1045). The page keeps its own originals beneath.
//           At f1000 (matte_cards): name 276×54 px = 1.85–1.93 px/pt → 14 pt = 26–27 px (caps 19–20 px); stepper 257×79 px =
//           1.95–2.08 px/pt → 15 pt digits = 29–31 px; total 141×56 px = 1.88–2.0 px/pt → 16 pt = 30–32 px: every lifted line ≥ 24 px by
//           the contract's font-size metric (BRIEF §4). OCR of the three crops (renders/3d/take/crops): "- 3 +", "$234.57",
//           "BPC-157 / TB-500", 0 hits on the forbidden list; nothing else is ever lifted (no discount line, no ship bar, no per-vial
//           price, no Summary). 0 slab px outside the phone's alpha on f975 / f1000 / f1020: nothing ever sits beside the phone.
//   shadow  the shadow-catcher pass f945–f1044 (0.12 m key up-left) multiplied inside matte_screen at 35 % with a 4 px blur: ONE
//           shadow per slab, umbra 0.46 in the pass → ≤ 19 % darkening of the page, near-edge penumbra ≈ 10–16 px, a long soft tail.
//   DOF     f/16 from f936, focus plane +18 mm in front of the display: page and slabs (0–36 mm) readable (the f1000 crops).
//   screen  cart3 @ 150 held (= clean/screen_cart.png, bake_qc PASS; the BAC-water region blank, the Summary below the frame); the
//           nav-wordmark tap ring lands on f1044 = PP.SCREEN.tapNav (S11's hand-off: the Safari push home lands on VO "Pure" f1050).
// What THIS file adds: nothing on the stage (SHOTS §S10 "Text: none — the lifted UI is the typography"; no 2D move; no CA: the three
// allowed moments are S07 / S09 / S12; the void glow, grain and vignette are global). It asserts the contract at build time
// (console.warn, never throws), publishes the measured facts as PP.S10 and states the sound frames. The 2D fallback of BRIEF §10.5
// ("CSS slabs on the 2D rig") is NOT built: the slab window rendered (take.webm covers f936–f1044) and PP.FALLBACK_WIN ends at f936,
// so even with PP.FALLBACK_2D on this window is the take; a missing take is reported below, never faked.
// DEVIATIONS measured on the shipped frames (3D-owned: reported to the lead with the fix, not patched in 2D):
//   1. SHEEN f990–f1008 is invisible. The SoftTop crossing leaves no trace: screen luma 0.9724 flat to 4 decimals over f980–f1022,
//      the slab faces +0.3 % monotonic (= the drift), the body luma monotonic 0.4067 → 0.4188, |f999 − f984| shows only the drift's
//      edges. A strip reflected in a white emissive page cannot read; only the ink border, the rails and the slab coats could carry
//      it, and they do not at the shipped SoftTop peak / angle. Fix (take.py): a brighter / lower SoftTop pass, or move the crossing
//      onto the slab coats; re-render f978–f1019 (42 f ≈ 10 min) + post + encode.
//   2. the seat-back ends with a one-frame blink. Each slab is hidden one frame after reaching lift 0, but at lift 0 its 1 mm body
//      still stands on the glass (edge ring + contact shadow Δ ≈ 31–34 levels mean, up to 94–102) and its front face is 1 mm before
//      the page, i.e. ≈ 3 px of parallax at spin 16° (interior Δ 48 / 50 levels mean for total / name, 9 for the stepper):
//      f1034 → f1035 (total, 2.5 k px > 50 lv), f1039 → f1040 (name, 4.9 k px), f1044 → f1045 (stepper, 2.6 k px — S11's first frame).
//      Fix (take.py): end the seat at lift −0.98 mm (the front face flush with the display plane, the body behind it) so the copy
//      registers to its original and the edges sink into the glass, and hide it only then; re-render f1020–f1045 beauty + shadow
//      (26 f ≈ 8 min) + post + encode.
//   3. the lifted total overhangs the display's projection on the right (32–37 % of its px, ≤ 52 px, f975–f1020) over the bezel and
//      the rail: inside the phone's silhouette (0 px beside the phone), but not "within the screen's projection" as the QC line asks.
//      It is the geometry of CARDS (spin +14–16° lifts everything toward +x) on the rightmost cart element (page x 297–372 of 402).
// Hand-offs (§0.9): f936 from S09 — continuous, same take: the tilt starts from the crept close pose (spin 4.5°, loc y −0.284; the
// corners of f935 and f936 agree to 0.3 px); f1044 to S11 — continuous: all three slabs seated (lift 0 / scale 1.0) by f1044 (the
// stepper's settle ends ON f1044), the nav tap ring on f1044, the drift continues into S11's hold (f1044–f1050, spin 16.0 → 16.1°).
// Nothing of S10 outlives the window (the section is empty).
// Sound (BRIEF §7, SHOTS §S10; the 3D fastest frames are in pose_speed.json / moves.json, read by the mixer): TILT f936 → f966, peak
// f949 (doppler_whoosh 0.8 align=peak + thoomp D2) · SLABS f954 / f959 / f964 (glass_tick D6 / A5 / E6 + alu_tick each, stat_hit light
// on the first) · SHEEN f990 → f1008, centre f999 (light_sweep 0.54 + grains A7 — deviation 1: the frames do not carry it yet) · SEAT
// f1020 / f1025 / f1030 (pop E7 / D7 / A6 descending + glass_settle n=2) · the settles end f1034 / f1039 / f1044 (no cue) · NAV TAP
// f1044 (S11's cue; the ring is on this window's last frame). No voice in this window: L08 ends f938 (the tail of "automatic."), L09
// "Pure" starts f1050 (S11). No 2D move in this shot: nothing else has a sound frame.
PP.shot("S10", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S10"), T1 = PP.OUT("S10"); // f936, f1044
  const F0 = PP.WIN.S10[0], F1 = PP.WIN.S10[1];
  const E = PP.SCREEN || {}; // the resolved screen timeline (js/screen_tl.js ran before the shots: main.js)
  const take = document.getElementById("v-take");
  const warn = (m) => console.warn("[S10] " + m);

  // ---- the measured take of this window (blender/take.py + renders/3d/take/{moves,pose_speed,corners}.json + matte_cards) --------
  const TILT = [F0, F0 + 30]; // f936–f966, move(CLOSE crept → CARDS), ease cam
  const FASTEST = 949; // MEASURED: pose_speed.json 32.6 °/s · 0.112 m/s = moves.json tilt.fastest_frame
  const LIFT_F = 20, SEAT_F = 14; // 20 f expo.out + overshoot; 10 f power3.in + 4 f settle
  const SLABS = {
    stepper: { text: "− 3 +", mm: 36, lift: 954, seat: 1030 },
    total: { text: "$234.57", mm: 24, lift: 959, seat: 1020 },
    name: { text: "BPC-157 / TB-500", mm: 12, lift: 964, seat: 1025 },
  };
  const SHEEN = [990, 1008, 999]; // SoftTop x −0.30 → +0.30; centre f999 (deviation 1: not visible on the shipped frames)
  const SHADOW = [945, 1044]; // the shadow pass multiplied inside matte_screen (post_layers.py)
  PP.S10 = { tilt: TILT, fastest: FASTEST, slabs: SLABS, liftF: LIFT_F, seatF: SEAT_F, sheen: SHEEN, shadow: SHADOW,
    hidden: { total: SLABS.total.seat + SEAT_F + 1, name: SLABS.name.seat + SEAT_F + 1, stepper: SLABS.stepper.seat + SEAT_F + 1 } };

  // ---- the take: the whole picture; assert its placement and coverage (stage-level, main.js gates it) -----------------------------
  if (!take) warn("#v-take missing (assets/layers/take.webm): no tilt, no slabs — re-run tools/assemble.py once it lands" +
    (PP.FALLBACK_2D ? " (PP.FALLBACK_2D covers f738–f936 only: this window has no 2D fallback, BRIEF §10.5's CSS slabs are not built)" : ""));
  else {
    const s = +take.dataset.start, d = +take.dataset.duration, ms = +take.dataset.mediaStart || 0;
    if (PP.toF(s) !== 708 || ms !== 0) warn(`#v-take placed at f${PP.toF(s)} / media-start ${ms}: the take must start on f708 (media 0)`);
    if (PP.toF(s + d) < F1 + 1) warn(`#v-take ends at f${PP.toF(s + d)}: it must carry the window's last frame f${F1 - 1} and S11's first`);
  }

  // ---- the voice (read, never hard-coded): this is the film's picture-only stretch — nothing to lock, everything to keep clear -----
  const fAuto = VO.f("L08", "automatic"); // f917 (S09): cart3 must read before anything lifts
  const fL08end = PP.toF(VO.end("L08")); // f938: the tail of "automatic." dies under the tilt's run-up
  const fPure = VO.f("L09", "Pure"); // f1050 (S11): the push home lands on the brand name
  if (fL08end > FASTEST) warn(`L08 ends f${fL08end}, after the tilt's fastest frame f${FASTEST}: the whoosh would sit on a word`);
  if (fPure < F1) warn(`VO "Pure" f${fPure} is inside this window (ends f${F1}): the push home (S11) would start over the slabs`);
  if (SLABS.stepper.lift - fAuto < 36) warn(`the first lift f${SLABS.stepper.lift} is only ${SLABS.stepper.lift - fAuto} f after "automatic." f${fAuto} (< 36 f read)`);
  for (const id in VO) if (VO[id] && VO[id].words) {
    const inside = VO[id].words.filter((w) => PP.toF(w[0]) >= F0 && PP.toF(w[0]) < F1).map((w) => w[1]);
    if (inside.length) warn(`${id} has words inside the slab window (f${F0}–f${F1}): ${inside.join(" ")} — the picture was meant to do the talking`);
  }

  // ---- the move and the slabs vs the contract (SHOTS §S10) -----------------------------------------------------------------------
  if (!(FASTEST > TILT[0] && FASTEST < TILT[1])) warn(`the measured fastest frame f${FASTEST} is outside the tilt f${TILT[0]}–f${TILT[1]}`);
  if (SLABS.stepper.lift < FASTEST + 4) warn(`the first slab lifts f${SLABS.stepper.lift}, less than 4 f after the tilt's peak f${FASTEST}`);
  const order = [SLABS.stepper, SLABS.total, SLABS.name];
  for (let i = 1; i < order.length; i++) if (order[i].lift - order[i - 1].lift !== 5) warn("the lifts are not 5 f apart (954 / 959 / 964)");
  const lastLift = SLABS.name.lift + LIFT_F, firstSeat = Math.min(SLABS.total.seat, SLABS.name.seat, SLABS.stepper.seat);
  if (firstSeat - lastLift < 36) warn(`the three slabs read for ${firstSeat - lastLift} f (f${lastLift}–f${firstSeat}), less than 36 f`);
  if (!(SHEEN[0] >= lastLift && SHEEN[1] <= firstSeat)) warn(`the sheen f${SHEEN[0]}–f${SHEEN[1]} is not inside the read f${lastLift}–f${firstSeat}`);
  for (const k in SLABS) {
    const sl = SLABS[k];
    if (sl.seat + SEAT_F > F1) warn(`${k} seats f${sl.seat} + ${SEAT_F} f = f${sl.seat + SEAT_F}, after the window's end f${F1}`);
  }
  if (SLABS.stepper.seat + SEAT_F !== F1) warn(`the last settle ends f${SLABS.stepper.seat + SEAT_F}, not on the hand-off f${F1}`);
  if (SHADOW[1] !== F1 || SHADOW[0] > SLABS.stepper.lift) warn(`the shadow pass f${SHADOW[0]}–f${SHADOW[1]} does not cover the lifted slabs`);

  // ---- the screen (baked): the nav tap IS the hand-off frame (S11's push home follows 6 f later, on "Pure") --------------------------
  if (E.tapNav == null) warn("PP.SCREEN is not resolved: js/screen_tl.js must run before the shots (main.js)");
  else {
    if (E.tapNav !== F1) warn(`the nav tap is f${E.tapNav}, the window ends f${F1}: the take was baked with the ring on f1044 (re-bake + re-render 1040–1062)`);
    if (E.push2 && E.push2[0] !== fPure) warn(`the push home f${E.push2[0]} is not on VO "Pure" f${fPure}`);
    if (E.state3 != null && E.state3 + 14 > SLABS.stepper.lift) warn(`cart3's bar fill (to f${E.state3 + 14}) runs into the first lift f${SLABS.stepper.lift}`);
  }
  // S09's hand-off checked from this side: the tilt starts on the window's first frame from the crept close pose (take.py 936)
  if (TILT[0] !== PP.WIN.S09[1]) warn(`the tilt starts f${TILT[0]} but S09 ends f${PP.WIN.S09[1]}`);
  void T0; void T1; void F; void f; void root;
});
