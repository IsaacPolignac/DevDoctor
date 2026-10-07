// S04 · "Shipped cold… 24 → 10" · window f426–f532 (14.200–17.733 s) · INK → PAPER · SCENES §S04.
// f426 picks up S03's 120 px teal segment at (545,552) → it flies to (960,520) and collapses to a 10 px point (expo.in, 12 f)
// while v-turn dims. f440 the point bursts into COLD (DM Sans 800 outlines, 400 px); frost creeps in from the glyph edges
// (f446–f462) and v-cold plays inside the O's counter only (clip-path = the counter outline). f462–f472 the camera flies
// through the O (COLD ×28 about the counter centre, expo.in; the plate mirrors it, settling expo.out to f480), CA 2 px f468–f474.
// Right of the vial: WITHIN 24 HOURS → split-flap → TO 10 COUNTRIES + ten teal dots. f522–f531 light white-out to PAPER.
// Everything per-frame runs through PP.drive / PP.driveT setters (pure functions of timeline time).
PP.scene("S04", function build(tl, root) {
  // geometry of "COLD" (tools/glyphs_cold.py → assets/type/cold_O_counter.json): font units, y down, baseline 0
  // <COLD>
  const COLD = {"font":"DM Sans 800","text":"COLD","upm":1000,"track":-0.02,"n":200,"yDown":true,"width":2736.0,"ink":[45.0,-712.0,2691.0,12],"glyphs":[{"ch":"C","adv":740,"x":0.0,"d":"M384 12Q279 12 203 -33.5Q127 -79 86 -160.5Q45 -242 45 -349Q45 -456 86 -538Q127 -620 203 -666Q279 -712 384 -712Q511 -712 593 -648Q675 -584 695 -468H541Q529 -524 488.5 -554.5Q448 -585 382 -585Q321 -585 277.5 -556.5Q234 -528 211 -475Q188 -422 188 -349Q188 -276 211 -223.5Q234 -171 277.5 -142.5Q321 -114 382 -114Q448 -114 488 -142.5Q528 -171 541 -222H695Q675 -113 593 -50.5Q511 12 384 12Z"},{"ch":"O","adv":785,"x":720.0,"d":"M1112 12Q1010 12 932 -34Q854 -80 809.5 -161.5Q765 -243 765 -350Q765 -457 809.5 -538.5Q854 -620 932 -666Q1010 -712 1112 -712Q1215 -712 1293.5 -666Q1372 -620 1415.5 -538.5Q1459 -457 1459 -350Q1459 -243 1415.5 -161.5Q1372 -80 1293.5 -34Q1215 12 1112 12ZM1112 -114Q1175 -114 1221 -143Q1267 -172 1292 -224.5Q1317 -277 1317 -350Q1317 -423 1292 -475.5Q1267 -528 1221 -557Q1175 -586 1112 -586Q1050 -586 1004.5 -557Q959 -528 933.5 -475.5Q908 -423 908 -350Q908 -277 933.5 -224.5Q959 -172 1004.5 -143Q1050 -114 1112 -114Z"},{"ch":"L","adv":562,"x":1485.0,"d":"M1553 0V-700H1693V-109H1999V0Z"},{"ch":"D","adv":709,"x":2027.0,"d":"M2095 0V-700H2333Q2454 -700 2534 -656.5Q2614 -613 2652.5 -534.5Q2691 -456 2691 -350Q2691 -245 2652.5 -166Q2614 -87 2534.5 -43.5Q2455 0 2332 0ZM2235 -120H2325Q2409 -120 2457.5 -147.5Q2506 -175 2527 -226.5Q2548 -278 2548 -350Q2548 -422 2527 -473.5Q2506 -525 2457.5 -553Q2409 -581 2325 -581H2235Z"}],"counter":[[1112.0,-114.0],[1119.04,-114.1],[1126.08,-114.38],[1133.11,-114.86],[1140.12,-115.55],[1147.11,-116.44],[1154.06,-117.57],[1160.98,-118.92],[1167.84,-120.5],[1174.64,-122.33],[1181.38,-124.41],[1188.02,-126.74],[1194.58,-129.32],[1201.03,-132.15],[1207.36,-135.24],[1213.56,-138.57],[1219.63,-142.15],[1225.55,-145.97],[1231.33,-150.01],[1236.94,-154.26],[1242.39,-158.72],[1247.67,-163.39],[1252.75,-168.26],[1257.65,-173.33],[1262.35,-178.58],[1266.85,-184.0],[1271.15,-189.58],[1275.24,-195.31],[1279.12,-201.19],[1282.81,-207.19],[1286.28,-213.32],[1289.56,-219.55],[1292.65,-225.89],[1295.53,-232.32],[1298.2,-238.83],[1300.68,-245.43],[1302.96,-252.09],[1305.04,-258.83],[1306.93,-265.61],[1308.64,-272.45],[1310.17,-279.32],[1311.54,-286.23],[1312.73,-293.18],[1313.76,-300.14],[1314.64,-307.13],[1315.37,-314.14],[1315.96,-321.16],[1316.41,-328.19],[1316.73,-335.23],[1316.92,-342.27],[1317.0,-349.31],[1316.95,-356.36],[1316.78,-363.4],[1316.48,-370.44],[1316.06,-377.47],[1315.5,-384.5],[1314.79,-391.5],[1313.95,-398.5],[1312.94,-405.47],[1311.78,-412.42],[1310.45,-419.34],[1308.95,-426.22],[1307.28,-433.06],[1305.42,-439.86],[1303.37,-446.6],[1301.13,-453.28],[1298.7,-459.89],[1296.06,-466.42],[1293.23,-472.87],[1290.18,-479.22],[1286.94,-485.48],[1283.5,-491.63],[1279.86,-497.66],[1276.01,-503.56],[1271.96,-509.32],[1267.7,-514.93],[1263.24,-520.38],[1258.58,-525.66],[1253.72,-530.76],[1248.67,-535.67],[1243.43,-540.38],[1238.02,-544.89],[1232.43,-549.19],[1226.69,-553.27],[1220.8,-557.13],[1214.76,-560.75],[1208.58,-564.13],[1202.27,-567.27],[1195.84,-570.15],[1189.31,-572.78],[1182.67,-575.15],[1175.96,-577.28],[1169.17,-579.16],[1162.32,-580.79],[1155.41,-582.19],[1148.47,-583.35],[1141.48,-584.3],[1134.48,-585.03],[1127.45,-585.55],[1120.41,-585.86],[1113.37,-585.99],[1106.33,-585.93],[1099.29,-585.68],[1092.26,-585.23],[1085.24,-584.56],[1078.25,-583.68],[1071.3,-582.57],[1064.38,-581.22],[1057.52,-579.63],[1050.72,-577.8],[1043.99,-575.71],[1037.35,-573.36],[1030.8,-570.76],[1024.36,-567.91],[1018.04,-564.79],[1011.85,-561.43],[1005.81,-557.82],[999.91,-553.97],[994.15,-549.9],[988.56,-545.63],[983.13,-541.14],[977.87,-536.45],[972.8,-531.55],[967.92,-526.48],[963.23,-521.22],[958.73,-515.8],[954.43,-510.22],[950.33,-504.49],[946.43,-498.62],[942.73,-492.63],[939.22,-486.52],[935.91,-480.31],[932.78,-473.99],[929.86,-467.58],[927.14,-461.08],[924.62,-454.5],[922.31,-447.85],[920.19,-441.13],[918.26,-434.36],[916.52,-427.53],[914.96,-420.66],[913.57,-413.76],[912.36,-406.82],[911.3,-399.85],[910.4,-392.86],[909.66,-385.86],[909.06,-378.84],[908.6,-371.81],[908.27,-364.77],[908.08,-357.73],[908.0,-350.69],[908.06,-343.64],[908.22,-336.6],[908.53,-329.56],[908.96,-322.53],[909.53,-315.51],[910.25,-308.5],[911.11,-301.51],[912.14,-294.54],[913.33,-287.59],[914.68,-280.68],[916.2,-273.8],[917.91,-266.97],[919.8,-260.18],[921.88,-253.45],[924.16,-246.79],[926.64,-240.19],[929.31,-233.67],[932.19,-227.25],[935.28,-220.91],[938.56,-214.68],[942.03,-208.55],[945.69,-202.53],[949.56,-196.64],[953.62,-190.88],[957.88,-185.27],[962.34,-179.82],[966.99,-174.53],[971.84,-169.42],[976.87,-164.5],[982.09,-159.76],[987.49,-155.23],[993.05,-150.91],[998.77,-146.8],[1004.64,-142.91],[1010.66,-139.25],[1016.83,-135.84],[1023.12,-132.68],[1029.54,-129.77],[1036.07,-127.13],[1042.69,-124.73],[1049.41,-122.6],[1056.19,-120.71],[1063.04,-119.08],[1069.95,-117.68],[1076.9,-116.52],[1083.88,-115.6],[1090.89,-114.89],[1097.92,-114.39],[1104.96,-114.1]]};
  // </COLD>
  if (!COLD) throw new Error("S04: COLD glyph data missing (run python3 tools/glyphs_cold.py)");

  const F = PP.F, f = PP.f;
  const $ = (s) => root.querySelector(s);
  const E = (n) => gsap.parseEase(n);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fx = (v) => String(Math.round(v * 100) / 100);
  const eIn = E("expo.in"), eOut = E("expo.out"), eIO = E("power2.inOut"), eP2in = E("power2.in"), eFlip = E("power3.inOut"), eRoll = E("power3.inOut");
  const eSine = E("sine.inOut");

  // ------------------------------------------------------------------ timing (frames are SCENES §S04 / Appendix A)
  const tIn = f(426), tFly = f(438), tBurst = f(440), tFr0 = f(446), tFr1 = f(462);
  const tZ0 = f(462), tZ1 = f(472), tP1 = f(480), tCA0 = f(468), tCA1 = f(474);
  const tW0 = f(522), tW1 = f(531), tOut = f(532);
  // The v4 take slid L07 ~1 s later than the BRIEF target ('Shipped' ≈ f459, 'twenty' ≈ f487, 'ten' ≈ f526).
  // SHIPPED: set during the contraction (≤ f430, the spec's intent) so it holds ≥ 25 f before the zoom-through; the VO says it on screen.
  const tShip = Math.max(tIn + 2 * F, Math.min(VO.w("L07", 0), f(430)));
  // Flip: same formula as tools/mix_audio.py (flip ticks + ten pops are keyed to it).
  const tFlip = Math.min(VO.w("L07", "ten"), f(498));
  // 24 lands ≥ 20 f before the flip (14 f roll, revealed through the opening counter); never later than the spoken 'twenty'.
  const tLand = Math.min(VO.w("L07", "twenty"), tFlip - 20 * F);
  const tRoll = tLand - 14 * F;
  const tWithin = PP.clamp(VO.w("L07", "within"), tRoll + 6 * F, tLand, "S04 WITHIN");
  const tHours = Math.min(VO.w("L07", "hours"), tLand); // with the landing: HOURS must hold before the flip swaps it

  // ------------------------------------------------------------------ COLD layout: 400 px, ink centred at (960,540)
  const S = 400 / COLD.upm;
  const ink = COLD.ink;
  const X0 = 960 - ((ink[0] + ink[2]) / 2) * S;
  const BASE = 540 - ((ink[1] + ink[3]) / 2) * S;
  const gl = $("#s4-gl");
  gl.setAttribute("transform", `translate(${fx(X0)} ${fx(BASE)}) scale(${S})`);
  COLD.glyphs.forEach((g) => PP.svg("path", { d: g.d }, gl));
  const Q = COLD.counter.map((p) => [X0 + p[0] * S, BASE + p[1] * S]); // counter outline in stage px (scale 1)
  const qx = Q.map((p) => p[0]), qy = Q.map((p) => p[1]);
  const CX = (Math.min(...qx) + Math.max(...qx)) / 2, CY = (Math.min(...qy) + Math.max(...qy)) / 2;

  // ------------------------------------------------------------------ elements
  const vTurn = document.getElementById("v-turn");
  const vCold = document.getElementById("v-cold");
  const feather = $(".s4-feather"), atmo = $(".s4-atmo");
  const seg = $(".s4-seg"), line = $(".s4-line"), trail = $(".s4-trail"), ring = $(".s4-ring");
  const zwrap = $(".s4-zwrap"), zoom = $(".s4-zoom"), coldwrap = $(".s4-coldwrap");
  const fstroke = $(".s4-fstroke"), gfrost = $(".s4-gfrost");
  const col = $(".s4-col"), num = $(".s4-num"), dotsBox = $(".s4-dots"), white = $(".s4-white");
  const caOff = [...root.querySelectorAll("#s4-ca feOffset")], cavOff = [...root.querySelectorAll("#s4-cav feOffset")];

  // ------------------------------------------------------------------ v-turn dims out (S03 owns its transform: x +300, scale 1)
  if (vTurn) {
    tl.fromTo(vTurn, { filter: "brightness(1)" }, { filter: "brightness(0.25)", duration: 14 * F, ease: "power1.inOut", immediateRender: false }, tIn);
    tl.fromTo(vTurn, { filter: "brightness(0.25)" }, { filter: "brightness(0)", duration: 6 * F, ease: "power1.in", immediateRender: false }, tBurst);
  }
  tl.set(feather, { opacity: 1 }, tIn); // S03's left feather, carried until v-turn has gone (f446)
  tl.set(feather, { opacity: 0 }, tFr0);
  // cold air behind COLD (rises with the frost, gone as we pass through)
  tl.fromTo(atmo, { opacity: 0 }, { opacity: 1, duration: 16 * F, ease: "power1.out", immediateRender: false }, tFr0);
  tl.fromTo(atmo, { opacity: 1 }, { opacity: 0, duration: 6 * F, ease: "power2.in", immediateRender: false }, f(466));

  // ------------------------------------------------------------------ SHIPPED (rides the zoom group: it flies off with COLD)
  PP.maskLine(tl, $(".s4-ship .pp-ln"), tShip);

  // ------------------------------------------------------------------ COLD burst: scale 0.6 → 1 about the point, blur 12 → 0, 10 f expo.out
  // f440 itself must already show the burst (no dead frame between the point and the word): 0.45 → 1 over 2 f
  tl.set(coldwrap, { opacity: 0 }, 0);
  tl.fromTo(coldwrap, { opacity: 0.45 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, tBurst);
  // scale 0.6 → 1 is set per frame by the rig (sbAt) so the O-counter clip of v-cold follows the burst exactly
  tl.fromTo(coldwrap, { filter: "blur(12px)" }, { filter: "blur(0px)", duration: 10 * F, ease: "expo.out", immediateRender: false }, tBurst);
  tl.set(coldwrap, { filter: "none" }, tBurst + 10 * F);
  // a thin teal ring released by the point
  PP.drive(tl, (u) => {
    const r = lerp(5, 640, eOut(u));
    ring.style.width = ring.style.height = fx(2 * r) + "px";
    ring.style.left = fx(960 - r) + "px";
    ring.style.top = fx(520 - r) + "px";
    ring.style.opacity = u <= 0 || u >= 1 ? "0" : fx(0.9 * Math.pow(1 - u, 1.6));
  }, 0, 1, tBurst, 14 * F, "none");

  // ------------------------------------------------------------------ the number: split-flap cells "24" → "10"
  const FROM = "24", TO = "10";
  const cells = Array.from(FROM).map((d0, i) => {
    const cell = PP.el("div", "s4-cell", num);
    const rollBox = PP.el("div", "s4-roll", cell);
    const strip = PP.el("div", "s4-strip", rollBox);
    const n = 10 * (i + 1) + Number(d0); // 1 + i full turns
    for (let k = 0; k <= n; k++) PP.el("span", "s4-d", strip, { text: String(k % 10) });
    const half = (cls, ch) => {
      const h = PP.el("div", "s4-half " + cls, cell);
      PP.el("span", "", h, { text: ch });
      return h;
    };
    const d1 = TO[i];
    return {
      rollBox, strip, n,
      topNew: half("top", d1), botOld: half("bot", d0), flapF: half("top", d0), flapB: half("bot", d1),
      land: tLand + i * 2 * F, flip: tFlip + i * 2 * F,
    };
  });
  tl.set(num, { opacity: 0 }, 0);
  tl.set(num, { opacity: 1 }, tRoll);
  cells.forEach((c) => {
    // roll (hidden behind COLD, revealed through the opening counter, lands on tLand + 2 f stagger)
    const dur = c.land - tRoll;
    PP.drive(tl, (u) => {
      const k = eRoll(u);
      c.strip.style.transform = `translateY(${fx((-100 * c.n * k) / (c.n + 1))}%)`;
      const b = 7 * Math.pow(Math.max(0, 1 - Math.abs(2 * u - 1)), 1.4);
      c.strip.style.filter = b > 0.05 ? `blur(${fx(b)}px)` : "none";
    }, 0, 1, tRoll, dur, "none");
    // split flap: 0 → 180°, 8 f power3.inOut, perspective 1200 px; the falling top half shades as it turns
    // from the landing on, the halves carry the digit (static at 0°) and the roll strip is hidden (its off-window digits too)
    PP.driveT(tl, (t) => {
      const on = t >= c.land;
      const u = clamp01((t - c.flip) / (8 * F));
      const a = 180 * eFlip(u);
      c.rollBox.style.visibility = on ? "hidden" : "visible";
      // free-standing type has no opaque cards: the static halves are clipped to the part the flap no longer covers
      // (projected flap height cos·p/(p − h·sin), the conservative near-side perspective), so old and new never overlap
      const rad = (a * Math.PI) / 180, cosA = Math.cos(rad), sinA = Math.abs(Math.sin(rad));
      const cover = clamp01((Math.abs(cosA) * 1200) / (1200 - 150 * sinA));
      const turning = on && u > 0 && u < 1;
      c.topNew.style.opacity = on && a > 0 ? "1" : "0";
      c.topNew.style.clipPath = turning && a < 90 ? `inset(0 -20% ${fx(cover * 100)}% -20%)` : "none";
      c.botOld.style.opacity = on && u < 1 ? "1" : "0";
      c.botOld.style.clipPath = turning && a > 90 ? `inset(${fx(cover * 100)}% -20% 0 -20%)` : "none";
      const sh = (deg) => `brightness(${fx(1 - 0.6 * Math.sin((deg * Math.PI) / 180))})`;
      c.flapF.style.opacity = on && a < 90 ? "1" : "0";
      c.flapF.style.transform = a > 0 ? `perspective(1200px) rotateX(${fx(-a)}deg)` : "none"; // static: no 3D layer (no hinge seam)
      c.flapF.style.filter = a > 0 ? sh(a) : "none";
      c.flapB.style.opacity = on && a >= 90 ? "1" : "0";
      c.flapB.style.transform = u >= 1 ? "none" : `perspective(1200px) rotateX(${fx(180 - a)}deg)`;
      c.flapB.style.filter = u >= 1 ? "none" : sh(a);
    }, c.land - F, c.flip + 8 * F); // starts 1 f early: at progress 0 (any seek before it) the roll shows
  });

  // ------------------------------------------------------------------ labels: WITHIN / HOURS → TO / COUNTRIES (masked swaps)
  const ln = (s) => $(s + " .pp-ln");
  PP.maskLine(tl, ln(".s4-within"), tWithin);
  PP.maskLine(tl, ln(".s4-hours"), tHours);
  PP.maskLine(tl, ln(".s4-within"), tFlip - 2 * F, { dir: "out" });
  PP.maskLine(tl, ln(".s4-to"), tFlip + 5 * F);
  PP.maskLine(tl, ln(".s4-hours"), tFlip, { dir: "out" });
  PP.maskLine(tl, ln(".s4-countries"), tFlip + 6 * F);

  // ------------------------------------------------------------------ ten dots (no names): 14 px, 36 px apart, under the number, y 730
  // centred under the ink of "10" (measured: '1' ink x 1288, '0' ink x 1612 — the cells centre their glyphs)
  const dcx = 1450;
  for (let k = 0; k < 10; k++) {
    const d = PP.el("div", "s4-dot", dotsBox);
    d.style.left = fx(dcx + (k - 4.5) * 36 - 7) + "px";
    d.style.top = "723px";
    // pop k lands on tFlip + (6 + k) f, as the mix's ten rising pops
    tl.fromTo(d, { scale: 0 }, { scale: 1, duration: 6 * F, ease: "back.out(1.0)", immediateRender: false }, tFlip + (6 + k) * F);
  }

  // ------------------------------------------------------------------ the white-out: light from the floor line (y 860) becomes PAPER
  PP.drive(tl, (u) => {
    if (u <= 0) {
      white.style.opacity = "0";
      return;
    }
    white.style.opacity = "1";
    if (u >= 1) {
      PP.maskCss(white, "none");
      return;
    }
    // the front grows expo.in from the floor line; outside it the light lifts the whole frame (0.85·u⁴), so the
    // last step to the flat PAPER frame (f530 → f531) is a soft lift, not a pop
    const R = lerp(60, 1620, eIn(u)), soft = 300, fl = 0.85 * Math.pow(u, 4), mid = fl + (1 - fl) * 0.6;
    PP.maskCss(white, `radial-gradient(circle at 960px 860px, #000 ${fx(Math.max(0, R - soft))}px, rgba(0,0,0,${fx(mid)}) ${fx(R - soft * 0.45)}px, rgba(0,0,0,${fx(fl)}) ${fx(R)}px)`);
  }, 0, 1, tW0, tW1 - tW0, "none");
  // INK → PAPER: the vignette and the INK grain level hand over with the light (PP.world switches hard at f532)
  tl.fromTo("#vignette", { opacity: 1 }, { opacity: 0, duration: tW1 - tW0, ease: "power2.in", immediateRender: false }, tW0);
  tl.fromTo("#grain", { opacity: PP.WORLD.ink.grain }, { opacity: PP.WORLD.paper.grain, duration: tW1 - tW0, ease: "power2.in", immediateRender: false }, tW0);
  tl.set(col, { opacity: 0 }, tW1); // fully under the PAPER layer from f531
  if (vCold) tl.set(vCold, { opacity: 0 }, tOut); // its clip runs to f536: never let it paint over S05's PAPER

  // ------------------------------------------------------------------ the per-frame rig: segment, zoom, plate, clips, frost, CA
  // v-cold inside the O at 0.22 (the whole vial, cap to base, sits in the counter). On the zoom-through the far plate grows
  // k^γ while COLD grows k (camera dolly) — but never less than what keeps the opening counter filled with picture — peaks at
  // 1.06 on f472, then settles to 1.00 by f480 (expo.out: the mirror of COLD's expo.in).
  const SP0 = 0.22, SPZ = 1.06;
  const GAM = Math.log(SPZ / SP0) / Math.log(28);
  const PO = [960, 545]; // plate transform-origin: the vial's centre in cold.mp4
  if (vCold) tl.set(vCold, { transformOrigin: `${PO[0]}px ${PO[1]}px` }, 0);
  const A0 = [545, 552], A1 = [960, 520];
  const segAt = (t) => {
    const e = eIn(clamp01((t - tIn) / (tFly - tIn)));
    return { x: lerp(A0[0], A1[0], e), y: lerp(A0[1], A1[1], e), h: lerp(60, 0, e), w: lerp(4, 10, e) };
  };
  const kAt = (t) => 1 + 27 * eIn(clamp01((t - tZ0) / (tZ1 - tZ0)));
  // upgrade: COLD never sits dead on the frost hold — a 3 % push-in about the counter (sine.in, f450–f462) hands its
  // velocity to the expo.in fly-through; the plate inside the O does not follow it (it is far away: depth parallax)
  const eSin = E("sine.in");
  const dAt = (t) => 1 + 0.03 * eSin(clamp01((t - (tBurst + 10 * F)) / (tZ0 - tBurst - 10 * F)));
  const kEff = (t) => kAt(t) * dAt(t);
  const BP = [960, 520]; // burst origin (the point)
  const sbAt = (t) => (t < tBurst ? 0.6 : lerp(0.6, 1, eOut(clamp01((t - tBurst) / (10 * F)))));
  const qb = [Math.min(...qx), Math.min(...qy), Math.max(...qx), Math.max(...qy)];
  // plate offset: vial centred in the counter, sliding to the frame centre while the counter opens (gone by f470)
  const offAt = (t) => {
    const p = eIO(clamp01((t - tZ0) / (f(470) - tZ0)));
    return [(CX - PO[0]) * (1 - p), (CY - PO[1]) * (1 - p)];
  };
  // smallest plate scale whose rect contains the counter's on-screen box (+1 %)
  const coverAt = (t, k, o) => {
    const bx0 = Math.max(0, CX + k * (qb[0] - CX)), by0 = Math.max(0, CY + k * (qb[1] - CY));
    const bx1 = Math.min(1920, CX + k * (qb[2] - CX)), by1 = Math.min(1080, CY + k * (qb[3] - CY));
    return 1.01 * Math.max((PO[0] + o[0] - bx0) / PO[0], (bx1 - PO[0] - o[0]) / (1920 - PO[0]), (PO[1] + o[1] - by0) / PO[1], (by1 - PO[1] - o[1]) / (1080 - PO[1]));
  };
  const spZoom = (t) => {
    return Math.max(SP0 * Math.pow(kAt(t), GAM), coverAt(t, kEff(t), offAt(t)));
  };
  const spPeak = spZoom(tZ1);
  const spAt = (t) => {
    if (t <= tZ0) return SP0;
    if (t <= tZ1) return spZoom(t);
    return lerp(spPeak, 1, eOut(clamp01((t - tZ1) / (tP1 - tZ1))));
  };
  const pathOf = (pts) => "path('M" + pts.map((p) => fx(p[0]) + " " + fx(p[1])).join("L") + "Z')";

  const rig = (t) => {
    // --- segment → point (f426–f440)
    if (t < tBurst) {
      const s = segAt(t);
      let w = s.w;
      if (t > tFly) w = lerp(10, 13, eP2in(clamp01((t - tFly) / (tBurst - tFly)))); // the point charges for 2 f
      seg.style.opacity = "1";
      line.setAttribute("d", `M${fx(s.x - s.h)} ${fx(s.y)}L${fx(s.x + s.h)} ${fx(s.y)}`);
      line.style.strokeWidth = fx(w);
      const p = segAt(t - 0.8 * F);
      const dist = Math.hypot(s.x - p.x, s.y - p.y);
      if (t > tIn + F && dist > 3) {
        trail.setAttribute("d", `M${fx(p.x)} ${fx(p.y)}L${fx(s.x)} ${fx(s.y)}`);
        trail.style.strokeWidth = fx(w * 0.8);
        trail.style.opacity = "0.45";
      } else trail.style.opacity = "0";
    } else seg.style.opacity = "0";

    // --- COLD zoom-through about the counter centre (f462–f472), gone at f472
    const k = kEff(t), sb = sbAt(t);
    coldwrap.style.transform = sb < 0.99995 ? `matrix(${fx(sb)},0,0,${fx(sb)},${fx(BP[0] * (1 - sb))},${fx(BP[1] * (1 - sb))})` : "none";
    zoom.style.transform = k > 1.0001 ? `matrix(${fx(k)},0,0,${fx(k)},${fx(CX * (1 - k))},${fx(CY * (1 - k))})` : "none";
    zwrap.style.opacity = t < tZ1 ? "1" : "0";
    // CA ≤ 2 px on f468–f474, peaking on the f472 pass
    const ca = t >= tCA0 && t <= tCA1 ? 2 * Math.max(0.35, 1 - Math.abs(t - tZ1) / (4 * F)) : 0;
    caOff[0].setAttribute("dx", fx(-ca));
    caOff[1].setAttribute("dx", fx(ca));
    zwrap.style.filter = ca > 0 && t < tZ1 ? "url(#s4-ca)" : "none";

    // --- frost creeps in from the glyph edges (f446–f462)
    const uf = clamp01((t - tFr0) / (tFr1 - tFr0));
    gfrost.setAttribute("opacity", t >= tFr0 ? "1" : "0");
    if (uf < 1) {
      gfrost.setAttribute("mask", "url(#s4-fm)");
      fstroke.setAttribute("stroke-width", fx((120 * eSine(uf)) / S));
    } else gfrost.removeAttribute("mask");

    // --- counter clip (stage px) while COLD is on screen
    const P = t < tZ1 ? Q.map((q) => {
      const x = BP[0] + sb * (q[0] - BP[0]), y = BP[1] + sb * (q[1] - BP[1]);
      return [CX + k * (x - CX), CY + k * (y - CY)];
    }) : null;
    col.style.clipPath = P ? pathOf(P) : "none";

    // --- v-cold: inside the O at 0.25 (vial centred in the counter), mirrors the zoom, settles to full frame by f480
    if (vCold) {
      const sp = spAt(t);
      const [tx, ty] = offAt(t);
      vCold.style.transform = `translate(${fx(tx)}px, ${fx(ty)}px) scale(${fx(sp)})`;
      // the same counter in the video's local (pre-transform) coordinates
      vCold.style.clipPath = P ? pathOf(P.map((p) => [PO[0] + (p[0] - PO[0] - tx) / sp, PO[1] + (p[1] - PO[1] - ty) / sp])) : "none";
      const b = t > tW0 ? 1 + 5 * eP2in(clamp01((t - tW0) / (tW1 - tW0))) : 1;
      cavOff[0].setAttribute("dx", fx(-ca / sp));
      cavOff[1].setAttribute("dx", fx(ca / sp));
      vCold.style.filter = (ca > 0 ? "url(#s4-cav) " : "") + (b > 1 ? `brightness(${fx(b)})` : "");
      if (!vCold.style.filter) vCold.style.filter = "none";
    }
  };
  PP.driveT(tl, rig, tIn, tOut);
});
