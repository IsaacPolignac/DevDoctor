// S05 · "Independently tested" · f396–f546 (13.20–18.20) · AI plate turn.mp4 (#v-turn, media 0 → 3.9 s = f396–f512, 1:1): the vial
// turns slowly on black, centre-right; the two typed proofs land left of it on the voice; the plate crushes to black and the words
// outlive the object (the breath). Everything is a pure function of time: ONE setter for the plate (landing × shift × push × whip
// blur, also written to the hold still), the per-glyph reveals, the crush, the exit.
//   1. whip-tilt landing (§0.9, the cut on "one." f396 = VO.w('L04', 4) is the window start): the plate lands y +90 → 0 over 10 f
//      (f396–f406) on expo.out plus a 3 % settle (y(u) = 90·(1 − expo.out(u) − 0.04·sin²(πu)): −2.5 px past the mark at f402 (measured),
//      back to 0 at f406 with zero slope — the camera's follow-through on a hard stop), fastest on the cut: 45 / 23 / 13 px on f396–f398
//      (S04 leaves at 7.5 / 20 / 42 px per frame on f393–f395 and 75 px into the cut: the picture keeps travelling UP through the cut, decelerating). A DIRECTIONAL blur on
//      those 3 frames only: an SVG feConvolveMatrix 1 × N vertical box kernel on #v-turn, N = 0.8 × the frame's displacement
//      (37 / 19 / 11 px), not a CSS blur. The plate sits +300 px right for the whole shot (the vial x 1031–1483, centre 1257: the
//      type's column is x 160–816) — a whip reframes; the horizontal offset is absorbed in the 3 blurred frames.
//   2. never static: the plate's own slow turn + a 1 %/s 2D push about the vial's centre (×1.042 by f522).
//   3. TESTED f410 = VO.w('L04', 5): "Independently / tested." Inter 600 96 px white 90 %, per glyph (20 glyphs in reading order,
//      opacity 0 → 1 + 8 px rise, 1 f stagger, 20 f expo.out): the last glyph lands f449, as the voice reaches "by". Two ragged-left
//      lines (one line is 997 px wide and would cross the vial).
//   4. ACC f475 = VO.w('L04', 8): "JANOSHIK ANALYTICAL" Inter 600 caps 36 px +0.10 em #C3CBD6, per glyph (1 f stagger, 18 f expo.out),
//      as TWO word-locked beats in the voice's own order: JANOSHIK on "Janosik" f475 (glyph onsets f475–f482, settled f500) and
//      ANALYTICAL on "Analytical" f490 = VO.w('L04', 9) (onsets f490–f499, ≥ 90 % by f505, tween tail f517 under the crush, which
//      never touches the type). One continuous ripple from f475 had ANALYTICAL visibly arriving 7 f before the word was spoken;
//      now each word lands on its word (the proof line stays one ripple: the voice says "Tested independently", the type the
//      reverse, so a two-beat lock there would cross-rhyme). The complete line reads from ≈ f505 to the exit f536 (31 f) and is on
//      screen 61 f + 8 f exit. Text only (no logo).
//   5. the crush f512–f522: the plate's brightness → 0 on power2.in (GSAP's power2 is cubic: a full-frame black at z 12 whose opacity
//      is u³ — brightness 0.875 / 0.66 / 0.49 / 0.27 / 0 on f517 / f519 / f520 / f521 / f522 — identical to a brightness multiply on a
//      black world), NO fade of the type. #v-turn's media window ends at f513 (§0.7: 13.2 / 3.9), so a still of the plate's
//      decoded frame 93 (0-based, the 94th; assets/plates/turn_hold.png = what f513 would show: media 3.9 s × 24 fps = 93.6; the
//      plate's frame step measures 0.47 levels mean and the Chromium video → PNG seam f512 → f513 measures 0.50 on a snapshot, a
//      held frame is invisible under the crush) takes over f513–f522 with the same transform setter (the push continues on it).
//   6. the breath (§0.9): black from f522, the two lines alone to f536 (the words outlive the object), exit f536–f544 power3.in
//      (opacity → 0, −12 px), black f544–f546; S06 fades up from f546.
// Sound (BRIEF §7; 2D, fastest frames stated here): WHIP f396 = the landing's fastest frame (45 px/f; S04 states the same frame for
// its tsk + swipe peak) · TESTED f410 (stat_hit A5 light −14): glyph onsets f410, f411 … f429 at 1 f spacing — the per-glyph ticks
// (≥ 35 ms apart) go on every second onset f410, f412 … f428 · ACC f475 (glass_tick D6 on f475 ONLY: glyph onsets f475–f482 JANOSHIK,
// f490–f499 ANALYTICAL = VO.w('L04', 9) — the second word's accent is the voice's own, no second tick) · BREATH f522–f546
// (sub_bed; reverse_swell ending on f552 = S06's "99"); the type exit f536–f544 has no sound. No other sound frames in this shot.
PP.shot("S05", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S05"), T1 = PP.OUT("S05");
  const q = (s) => root.querySelector(s);
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // ---- 1 + 2 + 5. the plate: landing × shift × push (+ the whip blur), ONE setter over the whole window -------------------
  const v = document.getElementById("v-turn");
  const hold = q(".s05-hold"), crush = q(".s05-crush");
  const kern = document.getElementById("s05-whip-k");
  const SHIFT = 300; // px: the vial centre-right (plate x 731–1183 → stage 1031–1483)
  const ORIGIN = "957px 580px"; // the vial's centre in plate coordinates (label rows y 400–840; the push grows the vial in place)
  const LAND = 90, NL = 10; // px, frames: y +90 → 0 over f396–f406
  const EX = gsap.parseEase("expo.out");
  const tLand1 = f(PP.toF(T0) + NL);
  const tCutVO = VO.w("L04", 4); // "one." — the cut frame per the contract (the window start is fixed; the voice is checked)
  if (Math.abs(PP.toF(tCutVO) - PP.toF(T0)) > 1) console.warn(`[S05] VO "one." at f${PP.toF(tCutVO)} ≠ the cut f${PP.toF(T0)}`);
  const yAt = (t) => {
    const u = c01((t - T0) / (tLand1 - T0));
    const s = Math.sin(Math.PI * u);
    return LAND * (1 - EX(u) - 0.04 * s * s); // expo.out landing + a 3 % settle (−2.5 px at u 0.6, 0 at u 1 with zero slope)
  };
  const sAt = (t) => 1 + 0.01 * Math.max(0, t - T0); // the 1 %/s push, from the cut
  const BLUR_TO = T0 + 3 * F; // the first 3 frames of the window get the directional blur
  let lastN = 0;
  const plate = (t) => {
    const y = yAt(t), s = sAt(t);
    const tf = `translate(${SHIFT}px, ${y.toFixed(2)}px) scale(${s.toFixed(5)})`;
    if (v) v.style.transform = tf;
    if (hold) hold.style.transform = tf;
    if (!v || !kern) return;
    // the landing's directional blur: a 1 × N vertical box kernel, N = 0.8 × this frame's displacement (forward difference over 1 f)
    const vpx = Math.abs(yAt(t + F) - yAt(t));
    let N = t >= T0 - F / 2 && t < BLUR_TO - F / 2 ? Math.round(0.8 * vpx) : 0;
    if (N < 6) N = 0;
    else if (!(N & 1)) N += 1; // odd: the box is centred on the pixel
    if (N === lastN) return;
    lastN = N;
    if (!N) {
      v.style.filter = "";
      return;
    }
    kern.setAttribute("order", `1 ${N}`);
    kern.setAttribute("kernelMatrix", Array(N).fill("1").join(" "));
    kern.setAttribute("divisor", String(N));
    v.style.filter = "url(#s05-whip)";
  };
  if (v) v.style.transformOrigin = ORIGIN;
  if (!v) console.warn("[S05] #v-turn missing: no landing / push / whip on the plate");
  PP.driveT(tl, plate, T0, T1);

  // the hold still stands in for the plate from the end of #v-turn's window (f513) to the end of the crush (f522)
  const vEnd = v ? +v.dataset.start + +v.dataset.duration : f(513); // 17.1 s = f513 (§0.7)
  const tCrush0 = f(512), tCrush1 = f(522);
  if (PP.toF(vEnd) > 513 || PP.toF(vEnd) < 500) console.warn(`[S05] #v-turn ends at f${PP.toF(vEnd)}: the hold still is cut for f513`);
  tl.set(hold, { opacity: 0 }, 0);
  tl.set(hold, { opacity: 1 }, vEnd);
  tl.set(hold, { opacity: 0 }, tCrush1);
  // the crush: brightness 1 → 0 on power2.in over f512–f522 (the black's opacity = u³, GSAP power2 = cubic), held black to the window's end
  tl.set(crush, { opacity: 0 }, 0);
  tl.fromTo(crush, { opacity: 0 }, { opacity: 1, duration: tCrush1 - tCrush0, ease: "power2.in", immediateRender: false }, tCrush0);

  // ---- 3 + 4. the two typed proofs, on the voice ------------------------------------------------------------------------
  const proof = q(".s05-proof"), acc = q(".s05-acc");
  const glyphs = PP.glyphs(q(".s05-l1")).concat(PP.glyphs(q(".s05-l2"))); // 13 + 7 glyphs, reading order
  const tTested = PP.word("S05", "L04", 5, "S05 Tested"); // f410
  const inProof = PP.wordIn(tl, glyphs, tTested, { rise: 8, stagger: 1 / 30, dur: 20 / 30, ease: "expo.out" }); // last glyph lands f449
  if (PP.toF(inProof.end) > 512) console.warn(`[S05] the proof line is still landing at f${PP.toF(inProof.end)} (crush from f512)`);
  // the small line: two word-locked beats, each word's glyphs on its own spoken word (JANOSHIK f475, ANALYTICAL f490)
  PP.glyphs(acc);
  const accWords = Array.from(acc.querySelectorAll(".pp-w")).map((w) => Array.from(w.querySelectorAll(".pp-g"))); // [8 glyphs, 10 glyphs]
  const tJan = PP.word("S05", "L04", 8, "S05 Janoshik"); // f475
  const tAna = PP.word("S05", "L04", 9, "S05 Analytical"); // f490
  const ACC = { rise: 8, stagger: 1 / 30, dur: 18 / 30, ease: "expo.out" };
  const tOut = f(536);
  if (accWords.length !== 2) console.warn(`[S05] the small line split into ${accWords.length} words (expected JANOSHIK + ANALYTICAL)`);
  const inJan = PP.wordIn(tl, accWords[0], tJan, ACC); // onsets f475–f482, settled f500
  const inAna = PP.wordIn(tl, accWords[1] || [], tAna, ACC); // onsets f490–f499, ≥ 90 % by f505, tail f517
  if (tAna < tJan + F) console.warn(`[S05] "Analytical" f${PP.toF(tAna)} is not after "Janosik" f${PP.toF(tJan)}: the two beats collapse`);
  // the line must read for ≥ 1 s before the exit: the last glyph's onset + 6 f (expo.out ≥ 90 %) at least 30 f before f536
  const tAnaRead = tAna + (accWords[1] ? accWords[1].length - 1 : 0) * F + 6 * F;
  if (tAnaRead > tOut - 30 * F) console.warn(`[S05] the small line is readable only from f${PP.toF(tAnaRead)} (exit f536)`);
  if (PP.toF(inJan.end) > 512) console.warn(`[S05] JANOSHIK is still landing at f${PP.toF(inJan.end)} (crush from f512)`);
  void inAna;

  // ---- 6. the breath: the words alone on black f522–f536, exit f536–f544 (8 f power3.in), black f544–f546 ---------------------
  PP.textOut(tl, [proof, acc], tOut, 8 / 30, "power3.in");
  void T1;
});
