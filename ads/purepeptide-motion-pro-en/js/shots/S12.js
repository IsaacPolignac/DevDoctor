// S12 · "Lights out" — the edge-on exit and the STOP · f1152–f1206 (38.40–40.20) · 3D: the take (#v-take, stage-level z 30,
// assets/layers/take.webm = renders/3d/take/final/0708–1188, media f708–f1188 from data-start 23.6; main.js gates it to [f708, f1188))
// + the held STOP frame (#hold-1188, stage-level z 31, assets/layers/hold_1188.png = final/1188.png bit-identical, opacity 0 until
// this shot switches it on). The picture of this shot is in those two layers (SHOTS §S12); every number below was MEASURED on the
// shipped frames, corners.json, pose_speed.json and moves.json of this window — not taken from the estimates:
//   exit    f1152–f1188 (36 f): move(HERO drifted (spin 27.5°, tilt −14°, roll −4°, loc (0.012, 0.120, 0.010)) → EDGE (90°, 0°, 0°,
//           (−0.0045, 0.084, 0))), ease cubic-bezier(0.6, 0, 0.2, 1) = "cam", motion blur 0.5. Fastest frame f1167 (pose_speed.json
//           182.26 °/s · 0.115 m/s; f1166 164.5, f1168 175.4 °/s; moves.json exit.fastest_frame = 1167; the contract's "≈ f1170" was
//           the estimate). The silhouette narrows from 397 px (x 822–1218) to 68 px (x 892–959) by f1184 and holds there; the display's
//           projected width (corners.json) 300 px → 0.1 px at f1188. loc x −4.5 mm: the rail stands 2 px left of the frame centre.
//   DIM     f1152–f1170: screen_emission_key 1 → 0 (the site goes dark, reflections stay on the glass): the mean RGB inside the
//           alpha falls 183 → 73 lv over the window, with the page already grey by f1162.
//   glint   f1172: ONE frame of the cover glass at grazing angle: the whole 151 px sliver reads white (mean 163 lv inside the alpha
//           vs 66 on f1171 and 51 on f1173; p99 255 — it lies inside matte_screen, so post_layers' soft-clip does not touch it).
//           It is the exit's glint, the bookend of the ARR's f712; the CA peaks on it (below).
//   lights  lights_out(1158, 1186) with the "cam" ease: Key Fill Back → 0 W, SoftL SoftR SoftFR SoftTop SideL → 0 and — common.py's
//           measured defaults, set by the lead for the single line — SideR → 0 (the contract said 50 %: with it the whole 68 px rail
//           read 15–20 lv), EdgeL → 0, world ramp → 0, SheenCard → 0; EdgeR kept. Lit pixels > 8 lv per frame: 237 k on f1164,
//           43.7 k on f1176, 13.4 k on f1180, 2.6 k from f1186 (the line only).
//   f1188   a single vertical line of light: lit columns x 957 / 958 / 959 (means 25 / 77 / 14 lv, 250-lv end caps at the rail's
//           corners), y 125–954 (830 px tall), luma-weighted centre x 958.35; plus 8 px at 9–10 lv on y 125 (x 904, 943–949: the
//           sliver's top edge, alpha 191–207) — the QC's "> 8 lv only inside a ≤ 12 px band at x 960 ± 20" holds for the line (952–960 =
//           9 px) and is marginal by those 8 top-edge pixels at 9–10 lv (3D-owned; invisible under the 2 % grain). The sliver's
//           alpha covers x 892–959 (68 px: the rail, the buttons' bumps), y 124–955.
//   hold    hold_1188.png vs the webm decoded: media f480 (= f1188) 0.09 lv RGB mean / 0.004 alpha; media f479 (= f1187, the last
//           frame HyperFrames paints before the clip ends at 39.6) 0.12 lv mean, p99 1 lv: the freeze is invisible as a cut.
// What THIS file adds (SHOTS §S12 "Text: none; Site: dark" — nothing is typed; one thing is drawn, the rim light, 4. below):
//   1. the STOP: #hold-1188 → opacity 1 on f1188 = PP.STOP[0] = CUES.STOP (39.6). main.js hides #v-take on the same frame (its clip
//      ends at 23.6 + 16.0 = 39.6), the hold is z 31 above it either way. Nothing moves f1188–f1206: PP.grain freezes its seed over
//      PP.STOP (global), the vignette holds 22 % until main.js takes it to 0 on f1206, the glow is already 0 (3.). S13 fades the hold
//      to black f1206–f1212 and lights its own 2 px HTML line on x 957 over the rail line (its LINE constant = the measurement above).
//   2. the CA pass (BRIEF §3.5: the third of the three allowed moments, "exit f1168–f1176"; SHOTS §S12 "CA 2 px f1168–f1176"): PP.ca
//      over f1168–f1176 on #v-take ONLY (the SVG #ca filter: R +dx, B −dx, screen-added), a sine that is 0 on f1168, 0.77 / 1.41 /
//      1.85 px on f1169–f1171, 2.0 px on f1172 = THE GLINT, 1.85 / 1.41 / 0.77 on f1173–f1175 and 0 again on f1176 — the window is
//      kept as written because, unlike S09's dive (centred on its speed peak), the exit has a glint and the contract's window is
//      centred on it exactly (as S07's CA sits on the ARR glint f712): the fringe rides the one white frame, not the dark turn.
//   3. the void glow dies with the studio lights: #world .glow opacity 1 → 0 over f1158–f1186, the lights_out window, on the same
//      "cam" ease (the glow is the key's spill on the void: no key, no spill). DEVIATION from main.js's global "1 over f738–f1188,
//      else 0" (a hard set on f1188): with that, the centre of the void would sit at (10, 16, 32) on f1187 and jump to black on the
//      freeze — a 32-lv pop on the one frame that must not move. With the ramp the line stands on true black from f1186 and the
//      global set on f1188 is a no-op. (BUILD.md: "call these only to deviate inside your window" — this is that.)
//   4. THE RIM LIGHT (the upgrade, within "f1188 is a single vertical line of light … the bookend of S01's point of light"): the
//      take's own rail line is a 1 px Cycles specular that DIMS as the rail reaches edge-on — column means 110–125 lv on f1176–f1181,
//      90 → 66 on f1182–f1184, 55–80 lv on f1186–f1188, broken into sparkles — so the STOP held a faint grey thread and S13's 2 px
//      white line then REPLACED it on f1206 (a substitution, not a continuation). .s12-rim (2 px white + a 5 px glow, z 32)
//      rides the measured rail highlight f1176–f1185 — per-frame fit of the rim specular on final/####.png (rows 160–900, robust
//      line fit): centre x 947.87 → 958.00 decelerating (2.1 → 0.4 px/f), lean 0.21° → 0° (the roll settling), extent = the
//      silhouette's y range − 1 px — and gathers the light the room loses: opacity 0 on f1176 (the CA has just cleared) → 0.8 ON
//      the STOP frame f1188 (sine.inOut over 12 f, settling like the turn's own cam ease; the room is fully out on f1186), then
//      holds, frozen, through the STOP (f1188 = … = f1205, the first frozen frame is the first full one) in exactly S13's
//      geometry (left 957, top 125, 2 × 829 px; glow 5 px vs S13's 6 px). On f1206 S13's own line takes over in place at opacity 1
//      and blooms: the line IGNITES on the LOGO (0.8 → 1, glow 5 → 6 px, then S13's flare) instead of popping in. The f1188 QC
//      holds with a margin: the only > 8-lv pixels of the whole frame are the rim's band, ≈ 10 px wide centred on 958 (with
//      S13's 6 px glow it measured 12 px, the limit).
//   5. build-time asserts (console.warn, never throws): PP.STOP / CUES.STOP / CUES.LOGO agree with the window (f1188, f1206); the
//      VO gap holds the STOP (L09 ends before the window, L10 starts after it: nothing is spoken over the freeze); the take is placed
//      on f708 (media 0) and its clip ends ON f1188 (one frame of gap or overlap either side would show as black or a doubled frame);
//      #hold-1188 exists and is the f1188 PNG; the #ca filter exists; the measured exit peak and glint lie inside the exit; the
//      rim light's rest geometry equals S13's .s13-line (the LOGO hand-off).
// Hand-offs (§0.9): f1152 from S11 — continuous, same take: the exit starts from the hero drift pose (spin 27.5°, loc y 0.120;
// corners.json f1151 / f1152 agree to 0.05 px); the room type exits f1152–f1160 on #type-back (S11's, untouched here: at f1158 it is at
// 58 %, gone on f1160, before the key starts going out). f1188 → STOP: the freeze (1.). f1206 → S13 LOGO: the held frame fades over
// 6 f and the HTML line collapses to (960, 300) (S13's; the hold is handed over at opacity 1, glow 0, grain frozen, vignette 22 %).
// Sound (BRIEF §7, SHOTS §S12; 3D fastest frames in pose_speed.json / moves.json, read by the mixer): DIM f1152 (thoomp D2 −16; the
// room type's exit f1152–f1160 is silent) · EXIT f1152 → f1188, whoosh peak f1167 MEASURED (doppler_whoosh 1.0 align=peak, hall −10;
// ≠ the contract's ≈ f1170) · GLINT f1172 (no cue in the list: if the mixer wants the ARR-GLINT's `tsk` −17 on the flash, this is the
// frame; the CA peaks here) · lights fully out f1186 (no cue) · music cuts to its one-beat silence on 39.6 = f1188 · STOP f1188–f1206
// gated digital silence (nothing, not even tails) · LOGO f1206 is S13's. No voice in this window (L09 ends f1139, L10 starts f1215).
PP.shot("S12", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S12"), T1 = PP.OUT("S12"); // f1152, f1206
  const F0 = PP.WIN.S12[0], F1 = PP.WIN.S12[1];
  const take = document.getElementById("v-take");
  const hold = document.getElementById("hold-1188");
  const warn = (m) => console.warn("[S12] " + m);

  // ---- the measured take of this window (blender/take.py + renders/3d/take/{moves,pose_speed,corners}.json + final/####.png) ----
  const EXIT = [F0, 1188]; // move(HERO drifted → EDGE), ease cam
  const FASTEST = 1167; // MEASURED: pose_speed.json 182.26 °/s · 0.115 m/s = moves.json exit.fastest_frame
  const GLINT = 1172; // MEASURED: the one white frame of the glass at grazing angle (mean 163 lv in the alpha; 66 / 51 at ± 1 f)
  const DIM = [F0, 1170]; // screen_emission_key 1 → 0
  const LIGHTS_OUT = [1158, 1186]; // common.lights_out(1158, 1186): everything but EdgeR → 0, ease cam
  const CA = [1168, 1176]; // BRIEF §3.5 / SHOTS §S12, peak 2 px on f1172 = GLINT
  const STOP = [PP.STOP[0], PP.STOP[1]]; // f1188–f1206: the freeze
  const LINE = { x: [957, 959], centre: 958, y: [125, 954], alphaX: [892, 959] }; // the line of light on hold_1188.png

  // ---- asserts: the contract against the cues, the voice and the composition (warn, never throw) ---------------------------
  if (STOP[0] !== 1188 || STOP[1] !== F1 || PP.LOGO !== F1) warn(`PP.STOP ${STOP} / PP.LOGO ${PP.LOGO} disagree with the window [${F0}, ${F1}): the STOP must be f1188–f1206`);
  if (Math.abs(PP.CUES.STOP - f(STOP[0])) > 1e-6) warn(`CUES.STOP ${PP.CUES.STOP} s is not f1188 (39.600 s): the music's one-beat silence is off the freeze`);
  if (Math.abs(PP.CUES.LOGO - f(STOP[1])) > 1e-6) warn(`CUES.LOGO ${PP.CUES.LOGO} s is not f1206 (40.200 s): the hit is off the LOGO`);
  if (window.VO) {
    if (VO.end("L09") > T0 + 1e-6) warn(`L09 ends at ${VO.end("L09").toFixed(2)} s, inside the exit (the window starts ${T0.toFixed(2)} s)`);
    if (VO.at("L10") < T1 - 1e-6) warn(`L10 starts at ${VO.at("L10").toFixed(2)} s, before the LOGO (${T1.toFixed(2)} s): the STOP is not in the VO gap`);
  }
  if (!(FASTEST > EXIT[0] && FASTEST < EXIT[1] && GLINT > FASTEST && GLINT < EXIT[1])) warn(`the measured exit peak f${FASTEST} / glint f${GLINT} do not lie inside the exit f${EXIT[0]}–f${EXIT[1]}`);
  if (CA[0] < F0 || CA[1] > STOP[0]) warn(`the CA window f${CA[0]}–f${CA[1]} leaves the exit`);
  if (!take) {
    warn("#v-take missing (assets/layers/take.webm): no exit, no line of light — re-run tools/assemble.py once it lands (the STOP still shows the hold)");
  } else {
    const s = +take.dataset.start, d = +take.dataset.duration, ms = +take.dataset.mediaStart;
    if (PP.toF(s) !== 708 || ms !== 0) warn(`#v-take placed at f${PP.toF(s)} / media-start ${ms}: the take must start on f708 (media 0)`);
    if (PP.toF(s + d) !== STOP[0]) warn(`#v-take ends at f${PP.toF(s + d)}: its clip must end ON f${STOP[0]} (the hold takes over there; earlier = black frames, later = the webm's f1188 under the hold)`);
  }
  if (!hold) warn("#hold-1188 missing (assets/layers/hold_1188.png): the STOP f1188–f1206 has no held frame — re-run tools/assemble.py once it lands");
  else if (!/hold_1188\.png$/.test(hold.getAttribute("src") || "")) warn(`#hold-1188 src is ${hold.getAttribute("src")}, not assets/layers/hold_1188.png`);
  if (!document.getElementById("ca")) warn("no #ca SVG filter in index.html: the exit's chromatic aberration will be skipped by PP.ca");

  // ---- 1. the STOP f1188–f1206: the held f1188 frame above the webm; nothing else moves (grain frozen, glow 0, vignette 22 %) ----
  // main.js: #hold-1188 is opacity 0 from time 0 (stage-img) and #v-take is hidden on its clip end 39.6 = f1188. S13 fades the hold
  // to black over f1206–f1212 (its own fromTo from opacity 1), so this shot only switches it on — never off.
  if (hold) tl.set(hold, { opacity: 1 }, f(STOP[0]));

  // ---- 2. CA 2 px on the glint, phone layer only: 0 on f1168, 2.0 px on f1172, 0 on f1176 (cleared again inside the exit) --------
  if (take) PP.ca(tl, f(CA[0]), f(CA[1]), 2, take);

  // ---- 3. the void glow dies with the studio lights (f1158–f1186, ease cam = lights_out's bezier); 0 before the freeze --------------
  const glow = document.querySelector("#world .glow");
  if (glow) tl.fromTo(glow, { opacity: 1 }, { opacity: 0, duration: (LIGHTS_OUT[1] - LIGHTS_OUT[0]) * F, ease: "cam", immediateRender: false }, f(LIGHTS_OUT[0]));
  else warn("no #world .glow: the void keeps whatever main.js set (a hard switch on f1188)");

  // ---- 4. the rim light: the rail's line of light, gathered as the room goes out, frozen through the STOP ------------------------
  // RIM_TRACK rows: [frame, centre x at y 540 (px), lean dx/dy, top y, bottom y], measured on renders/3d/take/final/####.png
  // (per-row luma centroid of the rim specular inside x 925–966, rows 160–900, robust linear fit; extent = alpha y range − 1 px).
  // From f1185 the rail is still (958.07 / 958.03 / 957.92 / 957.90 measured): the rest state is S13's .s13-line, centre 958.0.
  const RIM_TRACK = [
    [1176, 947.87, 3.63e-3, 120, 945], [1177, 949.99, 2.24e-3, 121, 947], [1178, 951.75, 1.60e-3, 122, 948],
    [1179, 953.25, 0.81e-3, 123, 949], [1180, 954.53, 0.36e-3, 123, 951], [1181, 955.56, 0.33e-3, 124, 951],
    [1182, 956.35, 0, 125, 952], [1183, 957.02, 0, 125, 952], [1184, 957.64, 0, 125, 953],
    [1185, 958.0, 0, 125, 954], [1186, 958.0, 0, 125, 954],
  ];
  const RIM = { f0: 1176, f1: PP.STOP[0], peak: 0.8, rest: { left: 957, top: 125, width: 2, height: 829 } };
  const rim = root.querySelector(".s12-rim");
  if (!rim) warn("no .s12-rim in html/S12.html: the STOP holds the take's own faint rail line and S13's line pops in on f1206");
  else {
    const q2 = (x) => (Math.round(x * 100) / 100).toString();
    const setRim = (v) => {
      const i = Math.max(0, Math.min(RIM_TRACK.length - 2, Math.floor(v - RIM_TRACK[0][0])));
      const a = RIM_TRACK[i], b = RIM_TRACK[i + 1], u = PP.clamp01(v - a[0]);
      const xc = PP.lerp(a[1], b[1], u), lean = PP.lerp(a[2], b[2], u), top = PP.lerp(a[3], b[3], u), bot = PP.lerp(a[4], b[4], u);
      const x = xc + lean * ((top + bot) / 2 - 540); // the centre of the 2 px line at the element's own mid-height
      rim.style.left = q2(x - RIM.rest.width / 2) + "px";
      rim.style.top = q2(top) + "px";
      rim.style.height = q2(bot - top) + "px";
      rim.style.transform = lean ? `rotate(${(-Math.atan(lean) * 180 / Math.PI).toFixed(4)}deg)` : "none"; // bottom leans right
      const k = PP.clamp01((v - RIM.f0) / (RIM.f1 - RIM.f0));
      rim.style.opacity = q2(RIM.peak * 0.5 * (1 - Math.cos(Math.PI * k))); // sine.inOut
    };
    PP.drive(tl, setRim, RIM.f0, RIM.f1, f(RIM.f0), (RIM.f1 - RIM.f0) * F, "none"); // v = the frame; the rest state from f1188 (the STOP) on
    // hand-off assert: the rest geometry must be S13's line (its CSS; S13.js keeps it there on f1206 with its glow at g = 0)
    const s13 = document.querySelector("#S13 .s13-line");
    if (s13) {
      const cs = getComputedStyle(s13), r = RIM.rest;
      const got = [parseFloat(cs.left), parseFloat(cs.top), parseFloat(cs.width), parseFloat(cs.height)];
      if (got.join() !== [r.left, r.top, r.width, r.height].join()) warn(`S13's .s13-line is at ${got} (left, top, w, h), the rim light rests at ${[r.left, r.top, r.width, r.height]}: the LOGO hand-off will jump`);
      if (+cs.borderTopLeftRadius.replace("px", "") !== 1 || !/255, 255, 255/.test(cs.backgroundColor)) warn(`S13's line is no longer a 2 px white bar (${cs.backgroundColor}, radius ${cs.borderTopLeftRadius}): re-match .s12-rim`);
    }
  }

  // ---- the measured facts, for the mixer and the neighbours (frames) -------------------------------------------------------------
  PP.S12 = {
    exit: EXIT, fastest: FASTEST, glint: GLINT, dim: DIM, lightsOut: LIGHTS_OUT, ca: CA, caPeak: GLINT, stop: STOP, logo: F1,
    hold: "hold-1188", line: LINE, glowOut: LIGHTS_OUT, rim: { from: RIM.f0, full: RIM.f1, opacity: RIM.peak, rest: RIM.rest },
    sound: { dim: F0, exitPeak: FASTEST, glint: GLINT, musicSilence: STOP[0], stop: STOP, logo: F1 },
  };
});
