// S11 · "Purity, proven." — pull-out to the hero · f1044–f1152 (34.80–38.40) · 3D: the take (#v-take, stage-level z 30,
// assets/layers/take.webm = renders/3d/take/final/0708–1188 with frost, shadow and soft-clip baked by tools/post_layers.py; media
// f708–f1188, data-start 23.6, gated by main.js) + the room type behind it. The phone and the screen of this shot are in that layer
// (SHOTS §S11; every number below was MEASURED on the shipped frames / corners.json / pose_speed.json, not taken from the estimates):
//   phone   CARDS(drifted) held f1044–f1050 (spin 16.0 → 16.1°, the slabs seated: S10's hand-off), move(CARDS → HERO) f1050–f1116
//           (66 f, ease cubic-bezier(0.6, 0, 0.2, 1) = "cam": spin 16.1 → 26°, tilt −5 → −14°, roll −2 → −4°, loc y −0.253 → +0.110:
//           the 36 cm pull-out; the display shrinks from 1325 px tall (1.53 px/pt) to 748 px (0.86 px/pt), the body from x 737–1412
//           to 820–1222 — the hero is only 61 px right of centre, not the contract's "right of centre"), fastest frame f1078 MEASURED
//           (pose_speed.json 20.593 °/s · 0.559 m/s; f1077 20.49 / f1079 19.65 °/s; moves.json orbit.fastest_frame = 1078 = the
//           contract's "≈ f1078"), then drift spin 26 → 27.5°, loc y +1 cm over f1116–f1152 (sine.inOut: 0.04 °/f, never static;
//           the body's left edge walks 850 → 853 px). DOF f/5.6 from f1060, focus on the Dynamic Island (baked).
//   screen  the baked SEQUENCE (scr_n = f − 707, bake_qc PASS: f1107 vs clean/screen_home.png): the wordmark tap f1044 (ring at screen
//           (131, 98), PP.SCREEN.tapNav) → Safari push cart3 → home @ 0 f1050–f1062 (PP.SCREEN.push2; f1050 = VO.w('L09', 0) "Pure":
//           the brand arrives on its name; the nav badge reads "3" from the push on — continuity) → home @ 0 with the site's own H1
//           "Purity, / proven." under the vial, alive scroll 0 → 10 f1080–f1150 (PP.SCREEN.scrollB).
// What THIS file adds (the one typed event of the shot, BRIEF §4 / §5 "L09 Purity (2) f1079: room type lands per glyph"):
//   1. ROOM TYPE, z 20 behind the phone (depth-sorted occlusion is free: the take's alpha at z 30 covers it): "Purity, / proven." DM
//      Sans 800 120 px white 90 %, −0.02 em, 3 px blur, TWO lines left-aligned (the site's own H1 stack) on a 112 px pitch, baselines
//      y 522 / 634 (x-band centre ≈ 550: where the contract's single-line baseline 580 sat), left ink edge x 360 at the landing
//      (372 − the 3 % settle), KERNED: the per-glyph split keeps DM Sans' pair kerning ("y," −8 px, "ov"/"ve" −2.8 px; measured on
//      the unsplit run at build, re-applied as glyph margins, asserted to 0.1 px) — the comma sits on "Purity" as in the site's H1.
//      Landing f1079 = VO.w('L09', 2) "Purity": per glyph in reading order (14 glyphs: P u r i t y , p r o v e n . — opacity 0 → 1 +
//      8 px rise, 1 f stagger, 22 f expo.out): onsets f1079–f1092, all settled by f1114, 2 f before the hero pose; holds to f1152
//      (60 f from the last onset ≥ 36 f); exits f1152–f1160 (8 f power3.in, opacity → 0, −12 px) BEFORE the lights go (lights_out
//      f1158–f1186 is in the take; at f1158 the type is at 58 %, at f1160 gone). The block lives on the stage-level #type-back (z 20)
//      from build time (BUILD.md: main.js gates this section at f1152, the exit outlives the window), nothing else touches #type-back.
//   2. THE PARALLAX (ONE setter — transform + the focus-pull blur of 3. — f1044 → f1160): the room is a fixed thing behind a phone the camera orbits (the spin
//      exposes the phone's LEFT rail — the buttons — more and more: the camera moves to the phone's left, so a background 15 % behind
//      the phone slides RIGHT, toward and under the rail). x(f) = 0.8 px/f glide from the landing (the orbit's slow continuation
//      through the hold: 24 px/s, 58 px over the hold) + 40 px × the orbit's REMAINING "cam" ease after f1079 (camR(f) = (cam(u) −
//      cam(u1079)) / (1 − cam(u1079)), u = (f − 1050)/66: the type arrives decelerating with the phone, 5 px/f on f1079, 1.2 px/f by
//      f1100, 0.8 px/f from f1116) and a settle of the block's scale 1.03 → 1.00 on the same remainder, about the final period
//      (transform-origin = the "." of "proven.", so the period's x is the pure slide). Measured against the rail's left edge at the
//      period's rows (alpha > 128 of final/####.png over y 616–634: f1079 820 · f1085 837 · f1090 843 · f1100 850 · f1105 851 · f1110–
//      f1120 852 · f1130 853 · f1140 855 · f1152 855): the period's right ink edge sits 34 px left of the rail on f1079, 21 px on f1090,
//      11 px on f1100, MEETS the rail on f1113 (period right 852.0 = rail 852), is 6.5 px under on KF4 f1120 ("the phone's left rail is
//      sliding over the final period"), 15 px on f1132, fully hidden (20 px) from f1141; the "n" touches the rail on f1152 (its right
//      ink edge 855 = rail 855). Line 1 "Purity," (63 px shorter, kerned) never reaches the rail: its comma's right edge is 31 px clear at
//      f1152, 25 px at f1160. Glyphs visible at every frame: 14 of 14 to f1112, 13 of 14 from f1141 (≥ 60 % QC: 93 %). The slide
//      continues at 0.8 px/f through the exit (the camera does not stop; S12's edge-on turn starts on f1152 from rest in the take).
//   3. THE FOCUS PULL (the shot's deliberate upgrade, same setter as the parallax): the room type lands soft (8 px) and racks into
//      its 3 px depth blur f1079 → f1101 = VO.w('L09', 2) "Purity" → VO.w('L09', 3) "Proven." (22 f sine.inOut: 6.9 px f1086,
//      4.8 f1092, 3.4 f1097, 3.0 f1101), then holds the 3 px rest to the exit. S01's rack (21 f sine in-out, landing on "print": the
//      printed word comes into focus) answered at the sign-off: the word that was easy to print is brought into focus — measured — ON
//      "Proven.". It is also what the pull-out does physically: the camera backs off 36 cm, the depth of field deepens, the room
//      behind the phone sharpens while the phone (on the focus plane) stays sharp.
//   4. build-time asserts (console.warn, never throws): the take layer is placed on f708 and covers the window and the exit; the VO
//      words of L09 sit inside the window ("Pure" = the push landing, "Purity" = the landing, "Proven." before the hero); the screen
//      timeline resolved the nav tap on the window's first frame, the push on "Pure" and the alive scroll inside the window; the
//      measured orbit peak lies inside the orbit; the landing is f1079 — the slide constants (P0, the rail table) were tuned on the
//      rendered take for THAT frame, so a moved landing warns (the rail is where it is: re-tune X0/V/A or re-render 1045–1152).
// Deviation from the contract (and why): "left-centre (x ≈ 300–1060, baseline y ≈ 580)" assumed the hero's rail at ≈ 1060; the rendered
// HERO (loc x +12 mm = 61 px right of centre) has its left rail at x 818–856 at the type's rows. A 120 px single line "Purity, proven."
// is 835 px wide (measured): starting inside title-safe (x ≥ 96) it would end at x 931, 80–110 px under the phone, with the period
// never visible and "Purity, prov" on screen. The two-line stack keeps every other rule — 120 px, −0.02 em, white 90 %, 3 px blur, the
// per-glyph landing on "Purity", the 73 f hold, the 8 f exit, title-safe, the period beat at ≈ f1120, ≥ 60 % visible — and rhymes
// with the site's own two-line H1 on the screen beside it. Nothing is typed anywhere else; the take is untouched (no CA: this shot is
// none of BRIEF §3.5's three moments). The landing blur (8 px f1079, 3 px from f1101) extends BRIEF §4's "3 px blur behind the focus
// plane" through the reveal only (the reveal's own state, like its opacity); every held frame f1101–f1152 is the 3 px rest.
// Hand-offs (§0.9): f1044 from S10 — continuous, same take: the slabs are seated (lift 0, scale 1.0) and the nav tap rings on f1044 in
// the layer; this shot draws nothing on its first 35 frames (the room type is invisible until f1079: glyph opacity 0 from time 0, the
// block slides unseen). f1152 to S12 — continuous: the hero drift pose at f1152 (spin 27.5°, loc y 0.120, corners.json) is the exit's
// start; the room type exits f1152–f1160 on #type-back (S12 must not touch #type-back; its screen DIM f1152–f1170 and lights-out
// f1158 are in the take); nothing else of S11 outlives the window (the section is empty on the stage).
// Sound (BRIEF §7, SHOTS §S11; 3D fastest frames in pose_speed.json / moves.json, read by the mixer): NAV TAP f1044 (tap 2350 + haptic;
// the ring is in the bake) · PUSH2 f1050 → f1062, peak f1052 (swipe) · ORBIT f1050 → f1116, peak f1078 MEASURED (doppler_whoosh 1.0
// align=peak; = the contract's ≈ f1078) · SIGN-OFF f1079 (tick_train 5200 Hz, 11 ticks over 18 f −28 + shimmer on the sheen): the
// glyph onsets are f1079, f1080 … f1092 at 1 f spacing — put the 11 ticks on f1079–f1089 (one per onset) or every other onset, the
// mixer's call · "Proven." f1101: the room type's focus pull lands (the voice is the cue; if anything, a soft RACK tail like S01's
// f114–f118 ending ON f1101, −30 or lower — optional, never over the word) · music thins to pad + piano from f1080 · the 2D
// parallax's fastest frame is f1079 (5 px/f at the period, 6.3 px/f at the "P": it rides the orbit's whoosh, no sound of its own);
// the period meets the rail on f1113 (silent) · the exit f1152–f1160 has no sound (DIM f1152 is S12's thoomp). No other sound frames.
PP.shot("S11", function build(tl, root) {
  const F = PP.F, f = PP.f, c01 = PP.clamp01;
  const T0 = PP.IN("S11"), T1 = PP.OUT("S11"); // 34.8 / 38.4 s
  const F0 = PP.WIN.S11[0], F1 = PP.WIN.S11[1]; // f1044 / f1152
  const q = (s) => root.querySelector(s);
  const E = PP.SCREEN || {}; // the resolved screen timeline (js/screen_tl.js ran before the shots: main.js)
  const take = document.getElementById("v-take");

  // ---- the voice (read, never hard-coded; clamped into the window with a warning) ----------------------------------------
  const tPure = PP.word("S11", "L09", 0, "S11 L09 Pure"); // f1050: the push lands home on the brand name
  const tLand = PP.word("S11", "L09", 2, "S11 L09 Purity"); // f1079: the room type lands per glyph
  const tProven = PP.word("S11", "L09", 3, "S11 L09 Proven."); // f1101: the orbit decelerates into the hero (no picture event)
  const fPure = PP.toF(tPure), fLand = PP.toF(tLand), fProven = PP.toF(tProven);
  const W = (id, i) => (window.VO[id].words[i] || [])[1] || "";
  if (!/^pure/i.test(W("L09", 0)) || !/^purity/i.test(W("L09", 2)) || !/^proven/i.test(W("L09", 3)))
    console.warn(`[S11] L09 words are not Pure / Purity / Proven. at 0 / 2 / 3 (${window.VO.L09.words.map((w) => w[1]).join(" ")})`);

  // ---- the take: the whole phone; assert its placement and coverage (the layer is stage-level, main.js gates it) ----------
  const ORB0 = 1050, ORB1 = 1116; // move(CARDS → HERO), 66 f, ease "cam" (blender/take.py)
  const FASTEST = 1078; // MEASURED: renders/3d/take/pose_speed.json (20.593 °/s, 0.559 m/s) = moves.json orbit.fastest_frame
  const EXIT1 = 1160; // the type's exit ends here (S12's window; the take still covers it)
  if (!take) console.warn("[S11] #v-take missing (assets/layers/take.webm): no phone, the room type plays alone — re-run tools/assemble.py once it lands");
  else {
    const s = +take.dataset.start, d = +take.dataset.duration, ms = +take.dataset.mediaStart || 0;
    if (PP.toF(s) !== 708 || ms !== 0) console.warn(`[S11] #v-take placed at f${PP.toF(s)} / media-start ${ms}: the take must start on f708 (media 0)`);
    if (PP.toF(s + d) < EXIT1) console.warn(`[S11] #v-take ends at f${PP.toF(s + d)}, before the type's exit ends (f${EXIT1})`);
  }
  if (FASTEST <= ORB0 || FASTEST >= ORB1) console.warn(`[S11] the measured orbit peak f${FASTEST} is outside the orbit f${ORB0}–f${ORB1}`);
  if (fPure !== ORB0) console.warn(`[S11] VO "Pure" is f${fPure} but the orbit / push start on f${ORB0} in the take + bake`);
  if (!(fLand > ORB0 && fLand < ORB1)) console.warn(`[S11] the landing f${fLand} is not inside the orbit f${ORB0}–f${ORB1}`);
  if (!(fProven > fLand && fProven <= ORB1)) console.warn(`[S11] "Proven." f${fProven} is not between the landing and the hero f${ORB1}`);

  // ---- the screen (baked): the resolved timeline vs the contract (every value is read, none re-derived) --------------------
  const tapNav = E.tapNav, push2 = E.push2 || [], scrollB = E.scrollB || [];
  if (tapNav == null || push2.length !== 2 || scrollB.length !== 2) console.warn("[S11] PP.SCREEN is not resolved: js/screen_tl.js must run before the shots (main.js)");
  else {
    if (tapNav !== F0) console.warn(`[S11] the nav tap is f${tapNav}, not the window's first frame f${F0} (§0.9: nav tap f1044)`);
    if (push2[0] !== fPure || push2[1] !== push2[0] + 12) console.warn(`[S11] push2 f${push2[0]}–f${push2[1]} is not VO "Pure" f${fPure} + 12 f`);
    if (push2[1] >= fLand) console.warn(`[S11] the push lands f${push2[1]}, after the room type's landing f${fLand}`);
    if (scrollB[0] < F0 || scrollB[1] > F1) console.warn(`[S11] the alive scroll f${scrollB[0]}–f${scrollB[1]} leaves the window`);
  }

  // ---- 1. the room type: onto the stage-level #type-back (the exit outlives the section's gate at f1152) -------------------
  const block = q(".s11-room"), tb = document.getElementById("type-back");
  if (!block) return console.warn("[S11] .s11-room markup missing (html/S11.html): no room type");
  if (tb) tb.appendChild(block);
  else console.warn("[S11] no stage-level #type-back: the type exit f1152–f1160 is cut by the section gate at f1152");
  const par = block.querySelector(".s11-par"), lines = block.querySelector(".s11-lines");
  // KERNING: PP.glyphs makes every glyph an inline-block (its own shaping run), which drops DM Sans' pair kerning — at 120 px
  // "y," opens by 8.0 px (the comma floats off "Purity"), "ov" / "ve" by 2.8 px, "ro" by 0.8 px. Measure the kerned run first
  // (a Range per character on the unsplit text node), split, then give each glyph margin-right = kerned advance − its own
  // advance: the animated glyphs sit exactly on the font's kerned positions (asserted to 0.1 px), as the site's own H1 does.
  const scaleK = () => { const k = par.getBoundingClientRect().width / (par.offsetWidth || 1); return k > 0 && Math.abs(k - 1) > 0.01 ? k : 1; };
  const kernSplit = (el) => {
    const tn = el.firstChild, txt = tn && tn.nodeType === 3 ? tn.textContent : "";
    const k = scaleK(); // any scale already on the block (none at build)
    const rg = document.createRange(), xs = [];
    for (let i = 0; i < txt.length; i++) { rg.setStart(tn, i); rg.setEnd(tn, i + 1); xs.push(rg.getBoundingClientRect().left / k); }
    const gs = PP.glyphs(el);
    if (gs.length !== xs.length || xs.length < 2) { console.warn(`[S11] kerning: ${el.className} not measurable (${xs.length} chars, ${gs.length} glyphs)`); return gs; }
    const ws = gs.map((g) => g.getBoundingClientRect().width / k);
    gs.forEach((g, i) => { if (i < gs.length - 1) g.style.marginRight = (xs[i + 1] - xs[i] - ws[i]).toFixed(3) + "px"; });
    const x0 = gs[0].getBoundingClientRect().left / k;
    const err = Math.max(...gs.map((g, i) => Math.abs(g.getBoundingClientRect().left / k - x0 - (xs[i] - xs[0]))));
    if (err > 0.1) console.warn(`[S11] kerning: ${el.className} glyphs are ${err.toFixed(2)} px off the kerned run`);
    return gs;
  };
  const l1 = kernSplit(block.querySelector(".s11-l1")), l2 = kernSplit(block.querySelector(".s11-l2"));
  const glyphs = l1.concat(l2); // 7 + 7, reading order
  if (glyphs.length !== 14) console.warn(`[S11] expected 14 glyphs, got ${glyphs.length}`);
  const DUR = 22, STAG = 1; // frames: 22 f expo.out per glyph, 1 f stagger (SHOTS §S11)
  const landed = PP.wordIn(tl, glyphs, tLand, { rise: 8, stagger: STAG * F, dur: DUR * F, ease: "expo.out" }); // onsets f1079–f1092
  const fSettled = PP.toF(landed.end), fLastOnset = fLand + STAG * (glyphs.length - 1);
  if (fSettled > ORB1) console.warn(`[S11] the last glyph is still landing at f${fSettled} (hero pose f${ORB1})`);
  if (F1 - fLastOnset < 36) console.warn(`[S11] the room type holds ${F1 - fLastOnset} f from its last onset (< 36 f)`);
  // the exit: f1152–f1160, 8 f power3.in (opacity → 0, −12 px) on .s11-lines — never on .s11-par (the parallax owns its transform)
  PP.textOut(tl, lines, T1, 8 / 30, "power3.in");

  // ---- 2. the parallax: ONE setter f1044 → f1160 (slide right under the rail + the 103 → 100 % settle + the focus pull, 3.) --
  // Tuned on the rendered take for a landing on f1079 (the rail table in the header): the period's right ink edge is at X0 + 421.6 (kerned)
  // on f1079 and meets the rail (x 852 at rows 616–634) on f1113. A moved landing or a re-rendered 1045–1152 needs a re-tune.
  const LAND0 = 1079; // the frame the constants were tuned for
  if (fLand !== LAND0) console.warn(`[S11] the landing moved to f${fLand} (tuned for f${LAND0}): the period/rail beat needs re-tuning (X0, V, A)`);
  const V = 0.8; // px per frame: the glide through the hold (24 px/s)
  const A = 40; // px on the orbit's remaining "cam" ease after the landing (the type arrives decelerating with the phone)
  const S = 0.03; // the settle: 103 % at the landing → 100 % at the hero, about the final period
  const X0 = 364.4; // css left of .s11-par (box; ink from +8): the period's right ink edge = 364.4 + 421.6 = 786 on f1079, 34 px off the rail
  const PER_INK = 25; // the period's right ink edge from its glyph box's left (measured at 1×: DM Sans 800 120 px)
  const ORIGIN_X = 421.6; // css transform-origin x of .s11-par = the period's right ink edge in the box, kerned (was 428 unkerned)
  const perX = (() => { const g = l2[l2.length - 1], k = scaleK();
    return (g.getBoundingClientRect().left - par.getBoundingClientRect().left) / k + PER_INK; })();
  if (Math.abs(perX - ORIGIN_X) > 0.5) console.warn(`[S11] the period's ink edge sits at ${perX.toFixed(1)} px in the block, css origin says ${ORIGIN_X}: re-sync css/S11.css left/transform-origin`);
  const CAM = gsap.parseEase("cam") || gsap.parseEase("power2.inOut"); // CustomEase "cam" = cubic-bezier(0.6, 0, 0.2, 1) (PP.registerEases)
  const camAt = (fr) => CAM(c01((fr - ORB0) / (ORB1 - ORB0)));
  const c0 = camAt(LAND0);
  const camR = (fr) => (fr <= LAND0 ? 0 : (camAt(fr) - c0) / (1 - c0)); // 0 at the landing → 1 at the hero
  if (Math.abs(par.offsetLeft - X0) > 0.5 && par.offsetParent) console.warn(`[S11] .s11-par sits at x ${par.offsetLeft}, css says ${X0}`);
  // ---- 3. THE FOCUS PULL (the shot's upgrade; same setter): the room type lands soft and racks into its 3 px depth blur ON the
  // word "Proven." — f1079 → f1101 = VO.w('L09', 2) → VO.w('L09', 3), 22 f sine.inOut, blur 8 → 3 px. It is S01's rack
  // (f96 → f117, 21 f sine in-out, landing on "print": the printed word comes into focus) answered at the sign-off: "pure" was
  // easy to print, "Purity, proven." is brought into focus — measured — on "Proven.". Physically it is the pull-out itself: the
  // camera backs off 36 cm, the depth of field deepens, the room behind the phone sharpens to its 3 px (the phone, on the focus
  // plane, stays sharp). Before the landing the block is invisible; from f1101 it holds 3 px (BRIEF §4) to the exit.
  const B0 = 8, B1 = 3; // px: CSS filter blur on .s11-par at the landing → at "Proven." and after (css/S11.css keeps the 3 px rest)
  const fRack1 = fProven; // f1101
  if (!(fRack1 - fLand >= 12 && fRack1 <= ORB1)) console.warn(`[S11] the focus pull f${fLand}–f${fRack1} is too short or ends after the hero f${ORB1}`);
  const SINE = gsap.parseEase("sine.inOut");
  const blurAt = (fr) => B0 + (B1 - B0) * SINE(c01((fr - fLand) / (fRack1 - fLand)));
  let lastTf = null, lastBl = null;
  const parallax = (t) => {
    const fr = t * 30;
    const r = camR(fr);
    const dx = V * (fr - LAND0) + A * r;
    const s = 1 + S * (1 - r);
    const tf = `translate(${dx.toFixed(2)}px, 0px) scale(${s.toFixed(4)})`;
    if (tf !== lastTf) { lastTf = tf; par.style.transform = tf; }
    const bl = `blur(${blurAt(fr).toFixed(2)}px)`;
    if (bl !== lastBl) { lastBl = bl; par.style.filter = bl; }
  };
  PP.driveT(tl, parallax, T0, f(EXIT1)); // every frame of the window and the exit gets a new value (nothing holds)
  void F;
});
