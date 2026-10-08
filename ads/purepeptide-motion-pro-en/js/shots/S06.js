// S06 · "99 %" · f546–f636 (18.20–21.20) · AI plate macro.mp4 (#v-macro, media 0 → 3.04 s = f546–f637, 1:1) + the held last frame
// (#hold-macro, stage-level z 11, = the plate's last decoded frame, diff 0.0) + type. The label macro emerges from the breath's
// black under the film's one big number; the plate's own pan carries the vial toward the type; the held frame keeps moving into
// the frost. Everything is a pure function of time: ONE setter for the dark reveal, ONE transform setter for the plate AND the
// hold (shift × push), the per-character stat, the per-glyph whisper, the exit.
//   1. the dark reveal f546–f558 (§S06): a full-frame black at z 12 lifts 1 → 0 (power1.out = quadratic: 44 / 75 / 94 % of the
//      plate at f549 / f552 / f555 — the plate is there when the "9" lands) while the plate's blur goes 6 → 0 px (power2.out =
//      cubic: 2.5 / 0.75 / 0.1 px at f549 / f552 / f555 — it focuses as it is lit, a beat behind). S05 hands over two black frames.
//   2. the plate: its own camera pan carries the vial left (measured on the decoded frames: bbox x 781–1649 → 286–1132, eased
//      in-out, 0 px/f at both ends, fastest ≈ 16 px/f at plate frames 28–33 ≈ f580–f586, right under "minimum."). A constant
//      +280 px shift (black plate edges, the reveal is invisible) ends the vial centred (x 566–1412, the label's hexagon at ≈ (925,
//      900): the frost has a centred label to close over) and keeps it ≥ 70 px clear of the type column at every frame; the only
//      cost is the right rim highlight 29 → 0 px past the frame edge over f546–f556, under the reveal's blur. The pan ends at
//      zero velocity, so the hold is continuous (verified frame-exactly on a scratch render of plate + hold: the cut steps 0.57
//      levels = H.264 noise; `hyperframes snapshot` batches can show a stale video frame near the end of a file — QC the cut from
//      a render, TECH §6): from f637 #hold-macro (opacity 1 at f637, 0 at f738) carries the same transform
//      and the 2D push 1.00 → 1.04 over f637–f738 (sine.inOut, zero velocity at both ends) about the vial's centre (709, 760)
//      in plate coordinates — the frost in S07 grows over a slowly moving image.
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
// (thoomp D2 −14, music ducked −11; glyph onsets f588–f605) · the plate's fastest pan frame ≈ f583 (no cue) · no sound on the
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

  // ---- 2. the plate and its hold: ONE transform setter (shift × push), f546 → f738 ------------------------------------------
  const SHIFT = 280; // px: the vial ends centred (x 566–1412) and stays ≥ 70 px right of the type column
  const ORIGIN = "709px 760px"; // the vial's centre on the last plate frame, plate coordinates (the push grows the label in place)
  const PUSH = 0.04; // 1.00 → 1.04 over the hold (§S06)
  const tHold0 = f(637), tHold1 = f(738);
  const SI = gsap.parseEase("sine.inOut");
  const vEnd = v ? +v.dataset.start + +v.dataset.duration : f(637.2);
  if (PP.toF(vEnd) !== 637) console.warn(`[S06] #v-macro ends at f${PP.toF(vEnd)} (expected f637): the hold still is cut for f637`);
  const plate = (t) => {
    const u = c01((t - tHold0) / (tHold1 - tHold0));
    const s = 1 + PUSH * SI(u);
    const tf = `translate(${SHIFT}px, 0px) scale(${s.toFixed(5)})`;
    if (v) v.style.transform = tf;
    if (hold) hold.style.transform = tf;
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
