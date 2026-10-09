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
//           (corners.json f966 → f1044), 0.17 px/f through the sheen, ≤ 0.5 px over any seat-back patch. Never static.
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
//           shadow per slab. While a slab floats the shadow is all penumbra (final/beauty luma ratio ≥ 0.83 = ≤ 17 % darkening, a
//           long soft tail); at contact it is the full umbra (ratio 0.66 = 34 %, a tight dark edge under the plate).
//   DOF     f/16 from f936, focus plane +18 mm in front of the display: page and slabs (0–36 mm) readable (the f1000 crops).
//   screen  cart3 @ 150 held (= clean/screen_cart.png, bake_qc PASS; the BAC-water region blank, the Summary below the frame); the
//           nav-wordmark tap ring lands on f1044 = PP.SCREEN.tapNav (S11's hand-off: the Safari push home lands on VO "Pure" f1050).
// What THIS file adds (html/S10.html, css/S10.css; no type — "Text: none — the lifted UI is the typography"; no 2D move on the phone;
// no CA: the three allowed moments are S07 / S09 / S12; the void glow, grain and vignette are global): the 2D stand-ins for the two
// parts of the contract the shipped take does not carry, each behind ONE flag (below) so the lead switches it off the day the 3D
// re-render lands (both were built against assets/layers/take.webm of 2026-10-08 11:21, 7 415 106 bytes — a newer webm means: look):
//   1. SHEEN_2D — SHOTS §S10 Light "SoftTop x −0.30 → +0.30 over f990–f1008: the band crosses the glass"; BRIEF §7 SHEEN f990 → f1008
//      centre f999 (light_sweep 0.54 + grains A7). On the shipped frames the crossing is INVISIBLE: screen luma 0.9724 flat to 4
//      decimals over f980–f1022, the slab faces +0.3 % monotonic (= the drift), the body luma monotonic 0.4067 → 0.4188, |f999 − f984|
//      shows only the drift's edges (a strip reflected in a white emissive page cannot read, and the ink border, rails and slab
//      coats do not carry it at the shipped SoftTop peak / angle). Stand-in: the film's own line of light — S02's SoftTop band on the
//      black glass, continued as the 2D 105° bands of S03 / S04 — as a 320 px white halo (0 → 0.35 → 0.65 → 1 → 0.65 → 0.35 → 0 across,
//      no hard core: at 50 px/f a 2 px core would strobe), mix-blend-mode: screen, a DIRECT child of the section at z 40 (.z-front is
//      a stacking context: the blend would see black — html/S03.html), travelling LEFT → RIGHT across the glass from x 629 (its centre
//      160 px left of the glass's left edge at y 540, x 789) to x 1528 (160 px right of the right edge, x 1368) over the 18 f, LINEAR
//      (49.9 px/f: a strip keyed along X moves at one speed), with a sine intensity envelope × gain 0.45 peaking on f999 = the
//      sound's centre (0 on f990 and f1008: no pop). It is clipped per frame to the phone's own silhouette — the two rail lines fitted
//      on the final frames' alpha (f990 / f999 / f1008, residual ≤ 2 px, inset 2 px) with the side-button notch on the right rail
//      (rows 512–568, +18 → +29 px) — and feathered 60 px at the frame's top / bottom (css), so it never lands on the void, never meets a
//      frame edge with a hard line, and reads where a strip reflects in glass over a white page: the page (248) stays white (252), the
//      text / ink border / rails / slab coats lift (a 30-level glyph under the centre goes to ≈ 130 for ≤ 3 f; measured on a PIL
//      screen-blend of f999, the same math the browser does). The slab coats catch it with the glass (the parallax of a 36 mm slab
//      against a strip 0.6 m away is < 1 f — a lag would be fake).
//   2. SEAT_2D — SHOTS §S10 QC "the seat-back ends with lift 0.0 / scale 1.0 (the page shows no ghost offset) by f1044". The take
//      hides each slab one frame after it reaches lift 0, but at lift 0 its 1 mm body still stands on the glass (bevel ring, the face
//      1 mm proud = ≈ 3 px of parallax at spin 16°) WITH its contact shadow at the full 34 % (above): total f1034 → f1035 (41 k px
//      change > 12 levels), name f1039 → f1040, stepper f1044 → f1045 — three one-frame pops, the last on S11's first frame (the
//      hand-off). Stand-in: a feathered crop of each slab's LAST seated frame (assets/fx/s10_seat_{total,name,stepper}.png, written by
//      assets/fx/make_s10_seat.py from final/1034 / 1039 / 1044: slab ∪ contact shadow + 18 px, alpha feathered 14 px — the shipped
//      render's own pixels, nothing new printed, nothing lifted that was not lifted) placed at its crop origin at z 40 and dissolved
//      over the next 4 f: 0.78 / 0.55 / 0.32 / 0.12 then 0 — the plate and its shadow sink into the page (the dissolve is a frame-
//      stepped table, not a tween: the pop becomes five ≤ 23 % steps). The take drifts ≤ 0.5 px under a patch (corners.json), the
//      feather hides it. total and name dissolve inside the window (f1035–f1038, f1040–f1043); the stepper's patch is MOVED into the
//      stage-level #type-front (z 40) because its frames f1045–f1048 are S11's (BUILD.md: a hand-off that outlives the window goes on
//      a stage-level element; S11 draws nothing before f1079 and never touches #type-front).
// 3D-owned deviations reported to the lead with the fix (the 2D stand-ins above cover 1 and 2 until then):
//   1. the SHEEN (take.py: a brighter / lower SoftTop pass, or the crossing on the slab coats; re-render f978–f1019, 42 f ≈ 10 min + post
//      + encode) → then SHEEN_2D = false.
//   2. the seat-back blink (take.py: end each seat at lift −0.98 mm so the face is flush and the body is behind the glass, and fade the
//      shadow pass to 0 over the last 4 f of each seat in post_layers.py; re-render f1020–f1045 beauty + shadow, 26 f ≈ 8 min + post +
//      encode) → then SEAT_2D = false and delete assets/fx/s10_seat_*.png.
//   3. the shadow-pass key sits far off-axis for this scale: the offset of a slab's shadow is ≈ 1.3 × lift right and 1.8 × lift down,
//      so the 36 mm stepper's and 24 mm total's shadows leave the screen's projection bottom-right while they float (f957–f962 a dark
//      blob walks off the page by the "Update cart" row; f1036–f1039 the stepper's comes back the same way) and only the 12 mm name's
//      stays under the slabs; "contact shadows on the page beneath" would want the key within ≈ 0.1 m of the camera axis (shadow_setup).
//   4. the lifted total overhangs the display's projection on the right (32–37 % of its px, ≤ 52 px, f975–f1020) over the bezel and
//      the rail: inside the phone's silhouette (0 px beside the phone), but not "within the screen's projection" as the QC line asks.
//      It is the geometry of CARDS (spin +14–16° lifts everything toward +x) on the rightmost cart element (page x 297–372 of 402).
// Hand-offs (§0.9): f936 from S09 — continuous, same take: the tilt starts from the crept close pose (spin 4.5°, loc y −0.284; the
// corners of f935 and f936 agree to 0.3 px; this section draws nothing before f990). f1044 to S11 — continuous: all three slabs seated
// (lift 0 / scale 1.0) by f1044 (the stepper's settle ends ON f1044), the nav tap ring on f1044, the drift continues into S11's hold
// (f1044–f1050, spin 16.0 → 16.1°). ONE thing of S10 outlives the window: the stepper's seat patch on #type-front, f1045–f1048
// (opacity 0.78 → 0.12, 0 from f1049; S11's header assumption "nothing of S10 outlives the window" is superseded by this).
// Sound (BRIEF §7, SHOTS §S10; the 3D fastest frames are in pose_speed.json / moves.json, read by the mixer): TILT f936 → f966, peak
// f949 (doppler_whoosh 0.8 align=peak + thoomp D2) · SLABS f954 / f959 / f964 (glass_tick D6 / A5 / E6 + alu_tick each, stat_hit light
// on the first) · SHEEN f990 → f1008, centre f999 (light_sweep 0.54 + grains A7): the 2D band's intensity peaks on f999 and it crosses
// the glass centre (x 1078) on f999 — its travel is linear (no velocity peak), the sound centres on the intensity peak · SEAT
// f1020 / f1025 / f1030 (pop E7 / D7 / A6 descending + glass_settle n=2) · the settles end f1034 / f1039 / f1044 and the 2D dissolves
// follow f1035–f1038 / f1040–f1043 / f1045–f1048 (no cue of their own: they are the tail of each glass_settle) · NAV TAP f1044 (S11's
// cue; the ring is on this window's last frame). No voice in this window: L08 ends f938 (the tail of "automatic."), L09 "Pure" starts
// f1050 (S11). No other 2D move in this shot: nothing else has a sound frame.
PP.shot("S10", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S10"), T1 = PP.OUT("S10"); // f936, f1044
  const F0 = PP.WIN.S10[0], F1 = PP.WIN.S10[1];
  const E = PP.SCREEN || {}; // the resolved screen timeline (js/screen_tl.js ran before the shots: main.js)
  const take = document.getElementById("v-take");
  const q = (s) => root.querySelector(s);
  const warn = (m) => console.warn("[S10] " + m);

  // ---- the flags: the 2D stand-ins for what the shipped take (2026-10-08 11:21, 7 415 106 bytes) does not carry — header 1 / 2 -------
  const SHEEN_2D = true; // false once take.py's SoftTop re-render (f978–f1019) carries the sheen
  const SEAT_2D = true; // false once take.py seats the slabs flush (f1020–f1045 + shadow) — then delete assets/fx/s10_seat_*.png

  // ---- the measured take of this window (blender/take.py + renders/3d/take/{moves,pose_speed,corners}.json + matte_cards) --------
  const TILT = [F0, F0 + 30]; // f936–f966, move(CLOSE crept → CARDS), ease cam
  const FASTEST = 949; // MEASURED: pose_speed.json 32.6 °/s · 0.112 m/s = moves.json tilt.fastest_frame
  const LIFT_F = 20, SEAT_F = 14; // 20 f expo.out + overshoot; 10 f power3.in + 4 f settle
  const SLABS = {
    stepper: { text: "− 3 +", mm: 36, lift: 954, seat: 1030 },
    total: { text: "$234.57", mm: 24, lift: 959, seat: 1020 },
    name: { text: "BPC-157 / TB-500", mm: 12, lift: 964, seat: 1025 },
  };
  const SHEEN = [990, 1008, 999]; // SoftTop x −0.30 → +0.30; centre f999 (3D: not visible on the shipped frames → SHEEN_2D)
  const SHADOW = [945, 1044]; // the shadow pass multiplied inside matte_screen (post_layers.py)
  const HIDDEN = { total: SLABS.total.seat + SEAT_F + 1, name: SLABS.name.seat + SEAT_F + 1, stepper: SLABS.stepper.seat + SEAT_F + 1 }; // 1035 / 1040 / 1045
  // the 2D sheen (stage px): the glass's left / right edge at y 540 on f999 (corners.json: TL (767,−150) BL (809,1173) → 789;
  // TR (1339,−134) BR (1394,1145) → 1368), the band's half width, and the phone's silhouette lines x = a·y + b fitted on the final
  // frames' alpha (f990 → f1008, interpolated per frame), inset 2 px; the side-button notch on the right rail (rows 512–568)
  const BAND_W = 320, GLASS_L = 789, GLASS_R = 1368, GAIN = 0.45;
  const SIL = { L0: [0.0337, 729.69], L1: [0.03386, 733.14], R0: [0.04289, 1362.24], R1: [0.04303, 1364.26], INSET: 2,
    NOTCH: [[508, 0], [514, 24], [520, 27], [556, 27], [562, 24], [568, 0]] };
  // the seat dissolves: opacity per frame after the hidden frame (frame-stepped, then 0)
  const SEAT_OP = [0.78, 0.55, 0.32, 0.12];
  PP.S10 = { tilt: TILT, fastest: FASTEST, slabs: SLABS, liftF: LIFT_F, seatF: SEAT_F, sheen: SHEEN, shadow: SHADOW, hidden: HIDDEN,
    sheen2d: SHEEN_2D ? { x: [GLASS_L - BAND_W / 2, GLASS_R + BAND_W / 2], width: BAND_W, gain: GAIN, peak: SHEEN[2], angle: 105 } : null,
    seat2d: SEAT_2D ? { total: [HIDDEN.total, HIDDEN.total + 3], name: [HIDDEN.name, HIDDEN.name + 3], stepper: [HIDDEN.stepper, HIDDEN.stepper + 3], op: SEAT_OP } : null };

  // ---- the take: the whole picture; assert its placement and coverage (stage-level, main.js gates it) -----------------------------
  if (!take) warn("#v-take missing (assets/layers/take.webm): no tilt, no slabs — re-run tools/assemble.py once it lands" +
    (PP.FALLBACK_2D ? " (PP.FALLBACK_2D covers f738–f936 only: this window has no 2D fallback, BRIEF §10.5's CSS slabs are not built)" : ""));
  else {
    const s = +take.dataset.start, d = +take.dataset.duration, ms = +take.dataset.mediaStart || 0;
    if (PP.toF(s) !== 708 || ms !== 0) warn(`#v-take placed at f${PP.toF(s)} / media-start ${ms}: the take must start on f708 (media 0)`);
    if (PP.toF(s + d) < HIDDEN.stepper + SEAT_OP.length) warn(`#v-take ends at f${PP.toF(s + d)}: it must carry the window's last frame f${F1 - 1}, S11's first and the stepper's dissolve (to f${HIDDEN.stepper + SEAT_OP.length})`);
  }

  // ---- the voice (read, never hard-coded): this is the film's picture-only stretch — nothing to lock, everything to keep clear -----
  const fAuto = VO.f("L08", "automatic"); // f917 (S09): cart3 must read before anything lifts
  const fL08end = PP.toF(VO.end("L08")); // f938: the tail of "automatic." dies under the tilt's run-up
  const fPure = VO.f("L09", "Pure"); // f1050 (S11): the push home lands on the brand name
  if (fL08end > FASTEST) warn(`L08 ends f${fL08end}, after the tilt's fastest frame f${FASTEST}: the whoosh would sit on a word`);
  if (fPure < F1) warn(`VO "Pure" f${fPure} is inside this window (ends f${F1}): the push home (S11) would start over the slabs`);
  if (fPure <= HIDDEN.stepper + SEAT_OP.length) warn(`VO "Pure" f${fPure} lands before the stepper's dissolve ends f${HIDDEN.stepper + SEAT_OP.length}: the push home would start under the patch`);
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
  if (SHEEN[2] * 2 !== SHEEN[0] + SHEEN[1]) warn(`the sheen's centre f${SHEEN[2]} is not the middle of f${SHEEN[0]}–f${SHEEN[1]}`);
  for (const k in SLABS) {
    const sl = SLABS[k];
    if (sl.seat + SEAT_F > F1) warn(`${k} seats f${sl.seat} + ${SEAT_F} f = f${sl.seat + SEAT_F}, after the window's end f${F1}`);
  }
  if (SLABS.stepper.seat + SEAT_F !== F1) warn(`the last settle ends f${SLABS.stepper.seat + SEAT_F}, not on the hand-off f${F1}`);
  if (SHADOW[1] !== F1 || SHADOW[0] > SLABS.stepper.lift) warn(`the shadow pass f${SHADOW[0]}–f${SHADOW[1]} does not cover the lifted slabs`);
  if (HIDDEN.total + SEAT_OP.length > HIDDEN.name || HIDDEN.name + SEAT_OP.length > HIDDEN.stepper) warn("the seat dissolves overlap (each slab's patch must end before the next slab hides)");

  // ---- the screen (baked): the nav tap IS the hand-off frame (S11's push home follows 6 f later, on "Pure") --------------------------
  if (E.tapNav == null) warn("PP.SCREEN is not resolved: js/screen_tl.js must run before the shots (main.js)");
  else {
    if (E.tapNav !== F1) warn(`the nav tap is f${E.tapNav}, the window ends f${F1}: the take was baked with the ring on f1044 (re-bake + re-render 1040–1062)`);
    if (E.push2 && E.push2[0] !== fPure) warn(`the push home f${E.push2[0]} is not on VO "Pure" f${fPure}`);
    if (E.push2 && E.push2[0] <= HIDDEN.stepper + SEAT_OP.length) warn(`the push home f${E.push2[0]} starts before the stepper's dissolve ends f${HIDDEN.stepper + SEAT_OP.length}`);
    if (E.state3 != null && E.state3 + 14 > SLABS.stepper.lift) warn(`cart3's bar fill (to f${E.state3 + 14}) runs into the first lift f${SLABS.stepper.lift}`);
  }
  // S09's hand-off checked from this side: the tilt starts on the window's first frame from the crept close pose (take.py 936)
  if (TILT[0] !== PP.WIN.S09[1]) warn(`the tilt starts f${TILT[0]} but S09 ends f${PP.WIN.S09[1]}`);

  // ---- 1. the SHEEN stand-in: ONE setter (clip-path + band x + opacity) over f990–f1008 -----------------------------------------------
  const sheen = q(".s10-sheen"), band = sheen && sheen.querySelector(".s10-sheen-band");
  if (!sheen || !band) warn(".s10-sheen markup missing (html/S10.html): no 2D sheen");
  else if (!SHEEN_2D) sheen.remove();
  else {
    const [S0, S1, SC] = SHEEN, SD = S1 - S0;
    const X0 = GLASS_L - BAND_W / 2, X1 = GLASS_R + BAND_W / 2; // 629 → 1528: the halo enters from the left edge, leaves past the right
    const line = (A, B, u) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
    const clip = (fr) => {
      const u = PP.clamp01((fr - S0) / SD);
      const L = line(SIL.L0, SIL.L1, u), R = line(SIL.R0, SIL.R1, u);
      const xl = (y) => (L[0] * y + L[1] + SIL.INSET).toFixed(1), xr = (y, dx) => (R[0] * y + R[1] - SIL.INSET + (dx || 0)).toFixed(1);
      const pts = [`${xl(-10)}px -10px`, `${xr(-10)}px -10px`];
      for (const [y, dx] of SIL.NOTCH) pts.push(`${xr(y, dx)}px ${y}px`);
      pts.push(`${xr(1090)}px 1090px`, `${xl(1090)}px 1090px`);
      return `polygon(${pts.join(", ")})`;
    };
    let lastClip = null, lastTf = null;
    tl.set(sheen, { opacity: 0 }, 0);
    PP.drive(tl, (v) => {
      const u = PP.clamp01((v - S0) / SD);
      const env = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); // 0 on f990 and f1008, 1 on f999 (= the sound's centre)
      sheen.style.opacity = (GAIN * env).toFixed(4);
      const c = clip(v);
      if (c !== lastClip) { sheen.style.clipPath = c; sheen.style.webkitClipPath = c; lastClip = c; }
      const x = X0 + (X1 - X0) * u; // linear: 49.9 px/f, the glass centre (x 1078) on f999
      const tf = `translateX(${(x - BAND_W / 2).toFixed(2)}px) rotate(15deg)`;
      if (tf !== lastTf) { band.style.transform = tf; lastTf = tf; }
    }, S0, S1, f(S0), f(SD), "none");
    void SC;
  }

  // ---- 2. the SEAT-BACK stand-ins: a frame-stepped 4 f dissolve of each slab's last seated frame -------------------------------------
  const seat = q(".s10-seat"), out = q(".s10-seat-out");
  const imgs = { total: q(".s10-seat-total"), name: q(".s10-seat-name"), stepper: q(".s10-seat-stepper") };
  if (!seat || !out || !imgs.total || !imgs.name || !imgs.stepper) warn(".s10-seat markup missing (html/S10.html): the seat-back pops stay");
  else if (!SEAT_2D) { seat.remove(); out.remove(); }
  else {
    const tf = document.getElementById("type-front");
    if (tf) tf.appendChild(out); // the stepper's 4 f are S11's (f1045–f1048): stage-level z 40, outside this section's gate
    else warn("no stage-level #type-front: the stepper's dissolve f1045–f1048 is cut by the section gate at f1044");
    for (const k in imgs) {
      const im = imgs[k], h = HIDDEN[k];
      tl.set(im, { opacity: 0 }, 0);
      // from the last seated frame (opacity 0: the take still shows the slab) through the 4 dissolve frames to 0 again
      PP.drive(tl, (v) => {
        const i = Math.floor(v + 1e-3) - h;
        im.style.opacity = i >= 0 && i < SEAT_OP.length ? String(SEAT_OP[i]) : "0";
      }, h - 1, h + SEAT_OP.length, f(h - 1), f(SEAT_OP.length + 1), "none");
      if (k !== "stepper" && h + SEAT_OP.length > F1) warn(`${k}'s dissolve runs to f${h + SEAT_OP.length}, past the section gate f${F1}`);
    }
  }
  void T0; void T1; void F;
});
