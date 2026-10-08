// S01 · "A droplet of light" · f0–f126 (0.00–4.20) · 3D own scene, OPAQUE: assets/layers/s01.mp4 (#v-s01, stage video z 10,
// data-start 1.0 / duration 3.2 / media 0: file frame n = film frame n + 30, shown f30–f125; S02's alpha webm takes over at f126).
// The shot IS the plate (blender/s01_droplet.py, 97 f at 24 spp + OIDN, Standard, film opaque): black brushed steel at 100 mm f/2.8,
// 28° down; the screen-printed "pure" (52 mm, the only non-HTML type in the film); a 7 mm water drop on the "u" at the frame centre
// (the camera aims at the drop: it never leaves (960, 540)); the camera dollies 0.32 → 0.26 m (cubic-bezier 0.6/0/0.2/1 = ×1.23,
// fastest f72 at 5.9 cm/s) with a 2.5° roll; the rim strip switches on over f30–f33 (HIT1); the top strip travels x −0.30 → +0.30
// over f36–f72 (its reflection: a soft wash travelling along the brush; fastest frame f54 = the ease's midpoint — measured on the
// PNGs as the largest frame-to-frame change of the whole plate, 5.4 levels); the key fades up f89–f117 ("easy" → "print": the ink
// lifts 146 → 205 levels, the brush emerges); the focus racks from the drop to the "p" f96–f117 (sine in-out; the print reaches its
// sharpness plateau at f111–f114, Laplacian peak f113, within 10 % of it to the cut) and holds to the cut. No HTML type, no site
// (SHOTS §S01). The 2D layer is a pure function of time with ONE setter:
//   0. OPEN f0–f29: black, nothing moves (BRIEF §7: the first of the film's three real silences). #world is #000, main.js gates the
//      stage video to opacity 0 before 1.0 s; the grain (overlay) and the vignette leave black at 0 (measured: f0 mean 0.00).
//   1. HIT1 f30 = VO.w('L01', 0) "Pure." = the plate's first frame. The rim strip's own switch-on is a LINEAR 0 → 2 W ramp over
//      f30–f33 (blender/s01_droplet.py keys), but the encoded plate is already pre-lit at f30 by the top strip and the two bulbs
//      (the ink at ≈ 100 levels; SHOTS §S01 promises "the mp4 begins at f30 with 3 black frames"). The exposure GATE (.s01-gate, a
//      full-frame black at z 11 between the plate at 10 and everything above — S03/S04's veil recipe) restores it: opacity
//      1 − (t − tHit) / (3 f), so the whole picture switches on from true black with the rim's own ramp: f30 black (the hit frame —
//      the sound leads the light by one frame, cause → effect), f31 33 %, f32 67 %, f33 100 %, 0 from then on. The plate's pixels are
//      untouched from f33 to the cut. DEVIATION from the plate's pixels on 3 frames; none from the contract (it restores its letter).
//   2. f33–f125: the plate alone. Nothing is added: no 2D push (the camera's own ease decelerates into the "hold to f126" the contract
//      asks for — 0.21 cm/s at f117, 0.02 at f125: a landed 9 f hold on the sharp print before the cut on the breath), no bloom, no
//      colour (BRIEF §3.5: finishing, not rescue; the three CA moments and the one light leak are elsewhere).
//   3. CUT1 f126 = VO.w('L02', 7) "and" = the window end (on the 18 f grid: 126 = 7 × 18): a hard cut, light-led (§0.9). HAND-OFF,
//      measured on the final plate (renders/3d/s01/final/0126.png): the drop has no single bright point (caustics off; the 0.1 W
//      bulb through the drop stays under the ink; the whole shot's max luminance is 86 % — nothing clips anywhere); what the eye
//      holds at the cut is the drop's RIGHT RIM ARC — a vertical sliver of light at x 1019–1030, y ≈ 480–600 (the meniscus catching
//      the rim strip), beside the "u"'s right stem (ink from x 1051). S02's f126 (renders/3d/s02/final/0126.png over black) puts its
//      SideR rim line at x 1028–1033 over y 400–640: the sliver of light stays put across the cut (Δx ≤ 10 px; §0.9 allows ± 40).
//      The §0.9 figure "(1040, 520)" was the preview's; the final numbers are PP.HANDOFF.S01 below (S02's 2D fallback may read them).
// VO locks (read at build time; the plate is baked, so a mismatch > 1 f is a console.warn for the lead — the picture cannot move):
//   HIT1 f30 = VO.w('L01', 0) must equal #v-s01's data-start (1.0 s) · "easy" f89 = VO.w('L02', 3) = the key's first frame ·
//   "print" f117 = VO.w('L02', 6) = the rack's landing · "and" f126 = VO.w('L02', 7) = the cut = the window end.
// Sound (BRIEF §7; fastest frames of the baked plate, measured on the PNGs): OPEN digital zero f0–f29 · HIT1 f30 (impact D1 + glass
// tick D6; under the gate the picture's largest step is f31 → f32) · SWEEP1 f36 → f72, PEAK f54 exactly (the top strip's bez
// midpoint; light_sweep align="peak" on f54) · RACK f114–f118 (4 ticks: the print reaches its sharpness plateau at f114, the rack's
// keys end f117) · CUT1 f126 (glass tick + doppler whoosh align="peak" on the cut frame). No other sound frames in this shot.
PP.shot("S01", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S01"), T1 = PP.OUT("S01");
  const q = (s) => root.querySelector(s);
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  const v = document.getElementById("v-s01");
  if (!v) console.warn("[S01] #v-s01 missing: the shot is black (re-run tools/assemble.py once assets/layers/s01.mp4 lands)");
  const vStart = v ? +v.dataset.start : f(30);
  const vEnd = v ? +v.dataset.start + +v.dataset.duration : T1;

  // ---- VO locks: the plate is baked (f30 / f89 / f117 / f126 live inside the mp4); verify the voice still sits on them -------------
  const tHit = PP.word("S01", "L01", 0, "S01 HIT1"); // f30: the rim switches on, the plate's first frame
  const tEasy = PP.word("S01", "L02", 3, "S01 easy"); // f89: the key starts fading up
  const tPrint = PP.word("S01", "L02", 6, "S01 print"); // f117: the rack lands on the print
  const tAnd = PP.fr(VO.w("L02", 7)); // f126: the cut (not clamped: it IS the window end)
  const BAKED = { HIT1: [tHit, 30], easy: [tEasy, 89], print: [tPrint, 117], and: [tAnd, PP.toF(T1)] };
  for (const k in BAKED) {
    const [t, fb] = BAKED[k];
    if (Math.abs(PP.toF(t) - fb) > 1) console.warn(`[S01] VO "${k}" at f${PP.toF(t)} ≠ the baked f${fb} (blender/s01_droplet.py keys / the window): re-time or re-render the plate`);
  }
  if (Math.abs(vStart - tHit) > F / 2) console.warn(`[S01] #v-s01 starts at ${vStart} s but HIT1 is ${tHit} s: tools/assemble.py VIDEOS v-s01 must start on the hit`);
  if (Math.abs(vEnd - T1) > 1e-6) console.warn(`[S01] #v-s01 ends at ${vEnd} s ≠ the window end ${T1} s`);

  // ---- 1. the HIT1 exposure gate: ONE time-driven setter over the whole window (seek-safe, nothing else moves in 2D) ---------------
  // opacity(t) = 1 before the hit, 1 − (t − tHit)/(3 f) over f30–f33 (the rim's linear 0 → 2 W ramp), 0 from f33 to the cut.
  const gate = q(".s01-gate");
  const tGate1 = tHit + 3 * F; // f33
  if (gate) {
    let last = null;
    const set = (t) => {
      const o = (t < tHit ? 1 : 1 - c01((t - tHit) / (tGate1 - tHit))).toFixed(4);
      if (o === last) return;
      last = o;
      gate.style.opacity = o;
    };
    PP.driveT(tl, set, T0, T1);
  } else console.warn("[S01] .s01-gate missing (html/S01.html): the plate's pre-lit f30–f32 show instead of the 3 f switch-on");

  // ---- 3. the hand-off (§0.9), measured on the final plate: S02's 2D fallback ghost may read the rim x from here ----------------------
  PP.HANDOFF = PP.HANDOFF || {};
  PP.HANDOFF.S01 = Object.freeze({
    cut: PP.toF(T1), // f126
    dropCentre: [960, 540], // the camera aims at the drop: fixed
    rimArcX: [1019, 1030], rimArcY: [480, 600], // the drop's right rim arc at f125/f126 (the sliver of light the cut hands over)
    inkRightStemX: 1051, // the "u"'s right stem starts here at y 540
    s02RimX: [1028, 1033], // S02's SideR rim line at f126 (renders/3d/s02/final/0126.png), y 400–640: Δx ≤ 10 px
    maxLumPct: 86, // nothing clips anywhere in the plate (QC: no px > 92 %)
  });
});
