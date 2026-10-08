// S06 · "99 %" · f546–f636 (18.20–21.20) · AI plate macro.mp4 (#v-macro, media 0 → 3.04 s = f546–f637, 1:1) + the held last frame
// (#hold-macro, stage-level z 11, = the plate's last decoded frame, diff 0.0) + type. The label macro emerges from the breath's
// black under the film's one big number; the plate's own pan carries the vial toward the type; the held frame keeps moving into
// the frost. Everything is a pure function of time: ONE setter for the dark reveal, ONE transform setter for the plate AND the
// hold (reframe × push), the per-character stat, the per-glyph whisper, the exit.
//   1. the dark reveal f546–f558 (§S06): a full-frame black at z 12 lifts 1 → 0 (power1.out = quadratic: 44 / 75 / 94 % of the
//      plate at f549 / f552 / f555 — the plate is there when the "9" lands) while the plate's blur goes 6 → 0 px (power2.out =
//      cubic: 2.5 / 0.75 / 0.1 px at f549 / f552 / f555 — it focuses as it is lit, a beat behind). S05 hands over two black frames.
//   2. the plate: its own camera pan carries the vial left (measured on the 73 decoded frames, PAN below: the vial's left silhouette
//      x 781.8 → 288.3, 493 px, sub-pixel, eased in-out, 0 px/f at both ends, fastest 11 px per plate frame at plate frames 30–41 ≈
//      f583–f597, right under "minimum."). Played raw, the vial would end at x 288 — through the type column — so the plate is
//      REFRAMED: a shift of +120 px on the first frame → +280 px on the last, so the vial glides 902–1764 → 568–1411: it starts in
//      the right third (151 px clear of the frame edge — a constant +280 would put its rim ON the right edge for the first 20 frames
//      and release it as the pan starts, a framing accident), reaches the centre as the whisper lands (centre 990, the label's
//      hexagon at ≈ (988, 900): the frost has a centred label to close over) and stays ≥ 73 px right of the type's ink at every
//      frame (at the stat's rows, the vial's shoulder, ≥ 105 px). Net glide 333 px over 90 f: a drift, never static.
//      THE PULLDOWN. The plate is 24 fps on a 30 fps timeline, so one plate frame in five is shown twice. The RENDERER (not the
//      browser) decides which: HyperFrames extracts every source video with ffmpeg `fps=30` (nearest-slot rounding: source frame n
//      lands on output slot round(1.25 n), a slot shows the latest source frame at or before it) and indexes the slots by
//      floor(localTime × 30) — measured on a 48-frame scratch render of macro.mp4 (every output frame 0.4 levels from ONE decoded
//      source frame, 5–11 levels from its neighbours): film frame k = f − 546 shows plate frame n(k) = k − floor((k + 3) / 5):
//      0 1 1 2 3 4 5 5 6 7 8 9 9 … (the repeat is at k ≡ 2 mod 5; the browser's seek shows floor(0.8 k), repeat at k ≡ 1 mod 5, and
//      `hyperframes snapshot` is one frame ahead of that again — TECH §6 — so this sync is QC'd from a render, never a snapshot).
//      The shift is NOT a stepped copy of the plate's pan (a stepped shift in the wrong phase ticks the vial BACKWARDS +3.6 px and
//      then lurches −11 px every fifth frame; a stepped shift in the right phase still holds the vial still one frame in five — the
//      pulldown judder of every 24-in-30 pan). Instead the shift makes the vial's NET position a smooth function of film time:
//      x(k) = X0 + (X1 − X0) · P(0.8 k), with P the plate's own pan progress (0 → 1, linearly interpolated between plate frames) and
//      X0 = 902 / X1 = 568, and shift(k) = x(k) − PAN[n(k)]: on the four frames the plate advances, the shift takes back 46 % of its
//      step; on the fifth, where the plate repeats, the shift carries the whole step. The vial moves 5.3–6.0 px on EVERY film frame
//      of the fast pan (never 0, never backwards; residual ±0.3 px from the plate's own ease and the 0.1 px table), the plate's
//      texture and lighting keep their 24 fps cadence underneath (sub-pixel changes, invisible), and the two ends are the same as a
//      stepped reframe (shift 120 at f546, 280 at f636, zero velocity at both ends).
//      The pan ends at zero velocity and the shift with it, so the hold is continuous: from f637 #hold-macro (opacity 1 at f637,
//      0 at f738) carries the same transform (shift 280 = the last plate frame's) and the 2D push 1.00 → 1.04 over f637–f738
//      (sine.inOut, zero velocity at both ends) about the vial's centre (709, 760) in plate coordinates — the frost in S07 grows
//      over a slowly moving image. (The cut f636 → f637 is video frame 72 → the identical PNG; #v-macro's clip ends at f637.2 and
//      the renderer has no slot 91 to show, so the hold is ON at f637 above it, z 11 over 10.)
//   3. NINETY-NINE f552 = VO.w('L05', 0): "99%" Inter 600 160 px white 90 %, character by character 2 f apart (9 f552, 9 f554,
//      % f556), each opacity 0 → 1 + 8 px rise over 18 f expo.out with the 104 % overshoot (scale 0.96 → 1.04 → 1.00); the "%"
//      is settled by f574; holds 62 f to the exit. (The spoken "percent" is f570: the sign does not wait for it — the stat lands
//      as one number, two ticks 2 f apart in the mix.)
//   4. MINIMUM f588 = VO.w('L05', 2): "HPLC PURITY, / MINIMUM" Inter 600 caps 36 px +0.10 em #C3CBD6 on two lines (one line is
//      496 px and would run under the glass from f611), per glyph (18 glyphs, 1 f stagger, 20 f expo.out) — the whisper SINKS
//      6 px (y −6 → 0) instead of rising; the last glyph lands f605, all settled by f625; 48 f on screen before the exit.
//   5. the exit f636–f644 (8 f power3.in, opacity → 0, −12 px) on both blocks; the plate (now the hold) stays: continuous into
//      the frost (§0.9: type exits f636–f644, frost starts f648 = VO.w('L06', 0) over the held, pushing plate). main.js gates
//      this <section> to opacity 0 at f636, so the type block is moved into the stage-level #type-front (z 40) at build (BUILD.md:
//      hand-offs that outlive the window live on stage-level elements); the glyphs are invisible outside f552–f644 by their own
//      tweens, nothing else touches #type-front here.
// Sound (BRIEF §7; 2D, fastest frames stated here): BREATH's reverse_swell ends on f552 (S05) · NINETY-NINE f552 (stat_hit A5
// root D2 −9 room −14; the two ticks 2 f apart = the glyph onsets f552 / f554; the "%" lands f556 silent) · MINIMUM f588
// (thoomp D2 −14, music ducked −11; glyph onsets f588–f605) · the plate's fastest frames f583–f597 (no cue) · no sound on the
// reveal f546–f558, the exit f636–f644 or the hold push f637–f738. No other sound frames in this shot.
PP.shot("S06", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S06"), T1 = PP.OUT("S06");
  const q = (s) => root.querySelector(s);
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  const v = document.getElementById("v-macro");
  const hold = document.getElementById("hold-macro");
  const dark = q(".s06-dark");
  if (!v) console.warn("[S06] #v-macro missing: no plate under the type");
  if (!hold) console.warn("[S06] #hold-macro missing: the plate is black from f638 (re-run tools/assemble.py once macro_last.png lands)");

  // the type block outlives the window (exit f636–f644): it lives on the stage-level #type-front (z 40, same z as .z-front)
  const typeBlock = q(".s06-type"), tf = document.getElementById("type-front");
  if (typeBlock && tf) tf.appendChild(typeBlock);
  else console.warn("[S06] no #type-front: the type exit f636–f644 is cut by the section gate at f636");

  // ---- 1. the dark reveal f546–f558: ONE setter (black lifts power1.out; blur 6 → 0 px power2.out on the plate) ----------------
  const tRev1 = T0 + 12 * F;
  const E2 = gsap.parseEase("power1.out"), EX = gsap.parseEase("power2.out");
  let lastFilter = null;
  const reveal = (t) => {
    const u = c01((t - T0) / (tRev1 - T0));
    dark.style.opacity = (1 - E2(u)).toFixed(4);
    if (!v) return;
    const b = u >= 1 ? 0 : 6 * (1 - EX(u));
    const fs = b < 0.05 ? "" : `blur(${b.toFixed(2)}px)`;
    if (fs !== lastFilter) {
      v.style.filter = fs;
      lastFilter = fs;
    }
  };
  PP.driveT(tl, reveal, T0, tRev1);

  // ---- 2. the plate and its hold: ONE transform setter (reframe × push), f546 → f738 ----------------------------------------
  // The vial's left silhouette x per plate frame (73 frames at 24 fps; luma > 40 over rows 300–1000, sub-pixel crossing, min over
  // rows; measured with PIL/numpy on the decoded macro.mp4). PAN[0] 781.8 → PAN[72] 288.3; monotonic, eased in-out.
  const PAN = [781.8, 781.5, 780.8, 779.5, 777.9, 776.0, 773.6, 770.6, 767.3, 763.8, 759.6, 754.8, 750.0, 744.6, 738.5, 732.2, 725.3, 718.6,
    711.2, 703.2, 694.9, 686.6, 677.5, 668.2, 658.7, 649.6, 639.9, 629.8, 619.7, 609.5, 598.5, 587.6, 576.7, 566.2, 555.6, 544.9, 534.1,
    523.3, 512.0, 501.0, 490.2, 479.9, 469.9, 459.4, 448.3, 438.5, 428.3, 418.2, 408.7, 399.8, 391.1, 382.5, 374.1, 366.1, 357.8, 350.0,
    342.6, 335.3, 329.0, 323.0, 318.0, 313.1, 308.4, 304.4, 300.8, 297.8, 294.8, 292.6, 291.1, 289.8, 289.1, 288.5, 288.3];
  const PAN_N = PAN.length - 1; // 72
  const PLATE_FPS = 24, RATIO = PLATE_FPS / PP.FPS; // 0.8 plate frames per film frame
  // the plate frame the RENDERER shows on film frame k = f − 546 (ffmpeg fps=30 extraction, nearest-slot rounding; measured, see above)
  const plateFrame = (k) => Math.max(0, Math.min(PAN_N, k - Math.floor((k + 3) / 5)));
  // the plate's own pan progress 0 → 1 at a fractional plate time τ (linear between the measured frames)
  const panAt = (tau) => {
    const x = Math.max(0, Math.min(PAN_N, tau)), i = Math.floor(x), fr = x - i;
    const v = i >= PAN_N ? PAN[PAN_N] : PAN[i] * (1 - fr) + PAN[i + 1] * fr;
    return (PAN[0] - v) / (PAN[0] - PAN[PAN_N]);
  };
  const SHIFT0 = 120, SHIFT1 = 280; // px: the reframe, +120 at plate frame 0 (vial 902–1764) → +280 at frame 72 (vial 568–1411, centred)
  const X0 = PAN[0] + SHIFT0, X1 = PAN[PAN_N] + SHIFT1; // the vial's left edge on screen: 901.8 at f546 → 568.3 at f636
  const vStart = v ? +v.dataset.start : T0; // 18.2: media time = t − vStart (data-media-start 0)
  if (v && Math.abs(vStart - T0) > 1e-6) console.warn(`[S06] #v-macro starts at ${vStart} s (expected ${T0}): the reframe is out of sync with the pan`);
  const filmFrame = (t) => Math.max(0, Math.round((t - vStart) * PP.FPS)); // k, the film frame since the plate's first
  const shiftAt = (t) => {
    const k = filmFrame(t);
    return X0 + (X1 - X0) * panAt(k * RATIO) - PAN[plateFrame(k)]; // the vial's net x is smooth in k; the shift absorbs the pulldown
  };
  const ORIGIN = "709px 760px"; // the vial's centre on the last plate frame, plate coordinates (the push grows the label in place)
  const PUSH = 0.04; // 1.00 → 1.04 over the hold (§S06)
  const tHold0 = f(637), tHold1 = f(738);
  const SI = gsap.parseEase("sine.inOut");
  const vEnd = v ? +v.dataset.start + +v.dataset.duration : f(637.2);
  if (PP.toF(vEnd) !== 637) console.warn(`[S06] #v-macro ends at f${PP.toF(vEnd)} (expected f637): the hold still is cut for f637`);
  let lastTf = null;
  const plate = (t) => {
    const u = c01((t - tHold0) / (tHold1 - tHold0));
    const s = 1 + PUSH * SI(u);
    const tfm = `translate(${shiftAt(t).toFixed(2)}px, 0px) scale(${s.toFixed(5)})`;
    if (tfm === lastTf) return;
    lastTf = tfm;
    if (v) v.style.transform = tfm;
    if (hold) hold.style.transform = tfm;
  };
  if (v) v.style.transformOrigin = ORIGIN;
  if (hold) hold.style.transformOrigin = ORIGIN;
  PP.driveT(tl, plate, T0, tHold1);
  // the hold: on at f637 (the video's last frame, identical pixels; #v-macro's window ends at f637.2), off at f738 (DROP: only
  // the phone remains — S07 crushes the field to black over f716–f738 above it)
  if (hold) {
    tl.set(hold, { opacity: 1 }, tHold0);
    tl.set(hold, { opacity: 0 }, tHold1);
  }

  // ---- 3 + 4. the stat and the whisper, on the voice ------------------------------------------------------------------------
  const tq = (s) => (typeBlock || root).querySelector(s);
  const stat = tq(".s06-stat"), acc = tq(".s06-acc");
  const statG = PP.glyphs(stat); // "9" "9" "%"
  const accG = PP.glyphs(tq(".s06-l1")).concat(PP.glyphs(tq(".s06-l2"))); // 11 + 7 glyphs, reading order
  const t99 = PP.word("S06", "L05", 0, "S06 99"); // f552
  const tMin = PP.word("S06", "L05", 2, "S06 minimum"); // f588
  const in99 = PP.wordIn(tl, statG, t99, { rise: 8, stagger: 2 / 30, dur: 18 / 30, ease: "expo.out", overshoot: 1.04 }); // settled f574
  const inMin = PP.wordIn(tl, accG, tMin, { rise: -6, stagger: 1 / 30, dur: 20 / 30, ease: "expo.out" }); // sinks; settled f625
  const tOut = f(636);
  if (PP.toF(in99.end) + 36 > PP.toF(tOut)) console.warn(`[S06] the stat holds < 36 f (settled f${PP.toF(in99.end)})`);
  if (PP.toF(inMin.end) > PP.toF(tOut) - 8) console.warn(`[S06] the whisper is still landing at f${PP.toF(inMin.end)} (exit f636)`);

  // ---- 5. the exit f636–f644 (8 f power3.in); the hold keeps pushing underneath, into the frost ------------------------------
  PP.textOut(tl, [stat, acc], tOut, 8 / 30, "power3.in");
  void T1;
});
