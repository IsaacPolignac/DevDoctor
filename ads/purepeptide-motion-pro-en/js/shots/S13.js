// S13 · End card · f1206–f1350 (40.20–45.00) · HTML only. SHOTS §S13 + §0.9 (STOP → LOGO), BRIEF §4 / §5 / §7 / §8.
// Every tween at ABSOLUTE seconds on the master timeline (PP.f). Word-locked: PP.word("S13", "L10", 0 | 1).
//
//   f1206        LOGO. A 2 px white HTML line lights exactly over the held f1188 rail line (#hold-1188: measured x 957–959,
//                centre 958, y 125–954), where S12's .s12-rim has held it at 0.8 white through the STOP: the line IGNITES in
//                place (0.8 → 1) and its glow blooms over 4 f. The held frame fades to black f1206–f1212 (power3.out: 12 %
//                left by f1209, before the line has retreated from its ends).
//   f1206–f1212  the line collapses to the point (960,300): both ends ease to y 300, x 957 → 959, expo.in (68 % tall at
//                f1211, a point at f1212). FASTEST FRAME f1211 → f1212 (the end of expo.in). The glow grows as the line
//                shortens. SHUTTER: the film's 0.5-frame motion blur (SHOTS §0.2, centred on the frame), by temporal
//                supersampling — 8 copies of the line at the exposure's instants, 1/8 each, summed with plus-lighter —
//                so f1210–f1212 carry the collapse's tails and f1212 is a streak of light converging into the point.
//   f1212        the point: a hot core that is spent into the unfolding mark (scale 0.5 → 0.2, opacity 1 → 0, gone by
//                f1219) and a wide faint halo (rises f1211–f1213, gone by f1236: true black inside the hexagon before the
//                tagline and the legal land; the card is static from f1256, grain aside).
//   f1212–f1224  brand-symbol.svg draws from the point: the <svg> scales 0.12 → 1 about (960,300) while DrawSVG draws the
//                two hexagon polylines 0 → 100 % (top → bottom), 12 f expo.out. FASTEST f1212–f1213.
//   f1212+i      dot i (14 dots sorted top → bottom) pops 0 → 1.12 over 3 f (power2.out) and SEATS at f1215+i (1 f stagger:
//                seat frames f1215 … f1228, one glass grain each), settling 1.12 → 1 over 5 f (power2.inOut) with a glint
//                (#E8F2FF → its own fill, 6 f) on the seat frame.
//   f1212–f1224  wordmark (brand-wordmark-light.svg, 560×57 centred (960,470)) masked rise yPercent 110 → 0, 12 f power4.out.
//   f1215        URL "purepeptide.care" Inter 500 40 px types in: 16 hard ticks over 18 f at frames f1215 + round(18·i/16)
//                = 1215 1216 1217 1218 1220 1221 1222 1223 1224 1225 1226 1227 1229 1230 1231 1232 (VO L10 "purepeptide").
//   f1226–f1238  the 2 px #C3CBD6 underline draws left → right as a line of light (clip-path + a bright head, power2.inOut,
//                FASTEST f1232); it completes on VO L10 ".care" (f1238); the head's glow dies over 6 f.
//   f1224        tagline "Purity, proven." DM Sans 800 56 px centred (960,560), per glyph 18 f / 1 f stagger (last glyph
//                lands f1255).
//   f1230–f1241  legal line (Inter 500 26 px #C3CBD6, box y 977–1003) 12 f fade-in (+4 px rise) starting f1229, so f1230 is
//                its first frame on screen (QC: visible on every frame f1230–f1350 = 120 f); full from f1241, holds to f1350.
//   f1300–f1350  nothing moves (contract QC: f1349 identical to f1300). No fade-out. Vignette 0 % (main.js), glow 0.
// Sound frames for the mixer (PP.S13): LOGO f1206 (sonic_logo + haptic) · snap into the point f1212 · dot grains f1215–f1228
// (one per frame; tools/mix_audio.py's provisional "LOGO + 10 + k" is f1216–f1229, 1 f late) · URL ticks on the
// 16 frames above · underline light_sweep ending f1238 · legal f1230 (nothing) · TAIL gone by f1335 · SILENCE f1335–f1350.
PP.shot("S13", function build(tl, root) {
  const F = PP.F, f = PP.f, lerp = PP.lerp;
  const T0 = PP.IN("S13"); // f1206 = LOGO (PP.LOGO)
  const T_URL = PP.word("S13", "L10", 0, "S13 URL (L10 purepeptide)"); // f1215
  const T_CARE = PP.word("S13", "L10", 1, "S13 underline (L10 .care)"); // f1238
  const T_POINT = T0 + 6 * F; // f1212: the point is formed, the symbol starts
  const T_TAG = T0 + 18 * F; // f1224
  const T_LEGAL = T0 + 24 * F; // f1230
  const T_UL = T_CARE - 12 * F; // f1226: the underline starts so that it completes on ".care"
  const q = (x) => Math.round(x * 100) / 100;

  // ---------------------------------------------------------------- the held STOP frame → black (f1206–f1212)
  const hold = document.getElementById("hold-1188");
  if (hold) tl.fromTo(hold, { opacity: 1 }, { opacity: 0, duration: 6 * F, ease: "power3.out", immediateRender: false }, T0);
  else console.warn("[S13] #hold-1188 missing (assets/layers/hold_1188.png): the LOGO collapse starts from the HTML line alone");

  // ---------------------------------------------------------------- the line of light → the point (f1206–f1212, expo.in)
  // Measured on assets/layers/hold_1188.png: lit columns 957/958/959 (means 25/77/14 levels, 250-level end caps), y 125–954.
  // S12's .s12-rim rests at exactly this geometry (0.8 white) through the STOP: on f1206 this line takes over in place at 1.
  // SHUTTER (the upgrade): the take is rendered with motion blur, shutter 0.5 frame centred on the frame (SHOTS §0.2), so the
  // HTML line gets the same exposure, by temporal supersampling: NS copies of the line (.s13-line = copy 0, the rest cloned
  // here), each placed at one instant of [t − F/4, t + F/4] at opacity 1/NS and summed with mix-blend-mode: plus-lighter (an
  // accumulation buffer: where all copies overlap the line is exactly 1, the tails fall k/NS, and the glow is blurred with the
  // core, no seams). At rest (f1206–f1209) the copies coincide and the sum IS the single line S12's rim hands over. The tails:
  // f1210 ≈ 10 / 37 px · f1211 ≈ 33 / 121 px · f1212 (the point) a streak from y ≈ 256 and y ≈ 464 converging into (960,300):
  // the snap reads as light pulled into the point instead of a line that vanishes between two frames.
  const LINE = { x: 957, w: 2, y0: 125, y1: 954 };
  const PT = { x: 960, y: 300 };
  const SHUTTER = 0.5 * F, NS = 8;
  const expoIn = gsap.parseEase("expo.in"), p2out = gsap.parseEase("power2.out");
  const line = root.querySelector(".s13-line");
  const lines = [line];
  for (let k = 1; k < NS; k++) lines.push(line.parentNode.insertBefore(line.cloneNode(false), lines[k - 1].nextSibling));
  tl.set(lines, { opacity: 0 }, 0);
  tl.set(lines, { opacity: q(1 / NS) }, T0);
  tl.set(lines, { opacity: 0 }, T_POINT + F); // the core has taken over at f1212; the 2 px point goes at f1213
  const eAt = (t) => expoIn(PP.clamp01((t - T0) / (T_POINT - T0))); // collapse 0 → 1, f1206 → f1212
  const gAt = (t) => p2out(PP.clamp01((t - T0) / (4 * F))); // the glow blooms on the hit (4 f) …
  const setLine = (t) => {
    lines.forEach((el, k) => {
      const tk = t - SHUTTER / 2 + (SHUTTER * (k + 0.5)) / NS, e = eAt(tk), g = gAt(tk);
      const top = lerp(LINE.y0, PT.y - 1, e), bot = lerp(LINE.y1, PT.y + 1, e);
      el.style.top = q(top) + "px";
      el.style.height = q(Math.max(2, bot - top)) + "px";
      el.style.left = q(lerp(LINE.x, PT.x - 1, e)) + "px";
      // … and concentrates as the line shortens (energy into the point)
      const blur = lerp(6, 10, g) + 16 * e, spread = 1 + 2 * g + 4 * e, a = 0.3 + 0.25 * g + 0.45 * e;
      el.style.boxShadow = `0 0 ${q(blur)}px ${q(spread)}px rgba(255,255,255,${q(a)})`;
    });
  };
  PP.driveT(tl, setLine, T0, T_POINT + F); // one setter, absolute time; frozen (line hidden) from f1213

  // the point (f1212): a hot core that is spent into the mark — it shrinks and dims while the symbol unfolds out of it
  // (gone by f1219), and a faint halo that rises with the snap and is gone by f1236 (true black inside the hexagon before the
  // tagline and the legal land; BRIEF §3.4: no void glow on the end card).
  const core = root.querySelector(".s13-core"), halo = root.querySelector(".s13-halo");
  tl.set(core, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, 0);
  tl.fromTo(core, { opacity: 1, scale: 0.5 }, { opacity: 0, scale: 0.2, duration: 7 * F, ease: "power1.in", immediateRender: false }, T_POINT);
  tl.set(halo, { opacity: 0 }, 0);
  tl.fromTo(halo, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "power2.out", immediateRender: false }, T_POINT - F);
  tl.fromTo(halo, { opacity: 1 }, { opacity: 0, duration: 23 * F, ease: "sine.out", immediateRender: false }, T_POINT + F); // 0 by f1236

  // ---------------------------------------------------------------- the symbol draws from the point (f1212–f1224)
  const symWrap = root.querySelector(".s13-sym");
  let seats = [];
  try {
    const svg = PP.inlineSvg("symbol", symWrap);
    svg.setAttribute("width", "196");
    svg.setAttribute("height", "220");
    const polys = Array.from(svg.querySelectorAll("polyline"));
    const dots = Array.from(svg.querySelectorAll("circle")).sort((a, b) => +a.getAttribute("cy") - +b.getAttribute("cy"));
    // the whole mark scales out of the point while the strokes draw (both 12 f expo.out)
    tl.set(svg, { scale: 0.12, transformOrigin: "50% 50%" }, 0);
    tl.fromTo(svg, { scale: 0.12 }, { scale: 1, duration: 12 * F, ease: "expo.out", immediateRender: false }, T_POINT);
    tl.set(polys, { drawSVG: "0%" }, 0);
    tl.fromTo(polys, { drawSVG: "0%" }, { drawSVG: "100%", duration: 12 * F, ease: "expo.out", immediateRender: false }, T_POINT);
    // the 14 dots seat one per frame, top → bottom: pop 0 → 1.12 (3 f) · SEAT at f1215+i (glint) · settle 1.12 → 1 (5 f)
    tl.set(dots, { scale: 0, transformOrigin: "50% 50%" }, 0);
    dots.forEach((d, i) => {
      const own = d.getAttribute("fill");
      const t = T_POINT + i * F, seat = t + 3 * F;
      seats.push(PP.toF(seat));
      tl.set(d, { attr: { fill: own } }, 0);
      tl.fromTo(d, { scale: 0 }, { scale: 1.12, duration: 3 * F, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo(d, { scale: 1.12 }, { scale: 1, duration: 5 * F, ease: "power2.inOut", immediateRender: false }, seat);
      tl.fromTo(d, { attr: { fill: "#E8F2FF" } }, { attr: { fill: own }, duration: 6 * F, ease: "power2.out", immediateRender: false }, seat);
    });
  } catch (e) {
    console.warn("[S13] inline symbol failed, using the <img> fallback:", e && e.message);
    const im = PP.symbol(symWrap, 220).el;
    im.style.cssText += "position:absolute;left:0;top:0";
    tl.set(im, { scale: 0.12, opacity: 0, transformOrigin: "50% 50%" }, 0);
    tl.fromTo(im, { scale: 0.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 12 * F, ease: "expo.out", immediateRender: false }, T_POINT);
  }

  // ---------------------------------------------------------------- the wordmark: masked rise (f1212–f1224)
  const wmIn = root.querySelector(".s13-wm-in");
  try {
    const wm = PP.inlineSvg("wordmark", wmIn);
    wm.setAttribute("width", "560");
    wm.setAttribute("height", "57");
  } catch (e) {
    console.warn("[S13] inline wordmark failed, using the <img> fallback:", e && e.message);
    PP.logo(wmIn, { width: 560 });
  }
  PP.maskLine(tl, wmIn, T_POINT, { dur: 12 * F, ease: "power4.out" });

  // ---------------------------------------------------------------- the URL types on "purepeptide" (f1215), 16 ticks over 18 f
  const urlTxt = root.querySelector(".s13-url-txt");
  const chars = PP.chars(urlTxt, "purepeptide.care");
  tl.set(chars, { opacity: 0 }, 0);
  const ticks = chars.map((c, i) => {
    const t = T_URL + f(Math.round((18 * i) / 16));
    tl.set(c, { opacity: 1 }, t);
    return PP.toF(t);
  });
  // the underline: a line of light left → right, completes on ".care" (f1238)
  const ul = root.querySelector(".s13-ul"), head = root.querySelector(".s13-ul-head");
  tl.set(ul, { opacity: 0 }, 0);
  tl.set(ul, { opacity: 1 }, T_UL);
  tl.set(head, { opacity: 0 }, 0);
  tl.set(head, { opacity: 1 }, T_UL);
  tl.fromTo(head, { opacity: 1 }, { opacity: 0, duration: 6 * F, ease: "power2.out", immediateRender: false }, T_CARE);
  PP.drive(tl, (u) => {
    ul.style.clipPath = `inset(0 ${q(100 * (1 - u))}% 0 0)`;
    head.style.left = q(100 * u) + "%";
  }, 0, 1, T_UL, T_CARE - T_UL, "power2.inOut");

  // ---------------------------------------------------------------- tagline (f1224) per glyph, 18 f, 1 f stagger
  const tag = root.querySelector(".s13-tag");
  const tagIn = PP.wordIn(tl, tag, T_TAG, { rise: 8, stagger: F, dur: 18 * F, ease: "expo.out" });

  // ---------------------------------------------------------------- legal (f1230–f1350): 12 f fade-in, then holds
  const legal = root.querySelector(".s13-legal");
  tl.set(legal, { opacity: 0, y: 4 }, 0);
  // the fade starts one frame early so that f1230 is the first frame the line is ON screen (QC: visible f1230–f1350 = 120 f)
  tl.fromTo(legal, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 12 * F, ease: "sine.out", immediateRender: false }, T_LEGAL - F);

  // for the mixer / neighbours (frames)
  PP.S13 = {
    logo: PP.toF(T0), point: PP.toF(T_POINT), dotSeats: seats, url: PP.toF(T_URL), urlTicks: ticks,
    underline: [PP.toF(T_UL), PP.toF(T_CARE)], tagline: [PP.toF(T_TAG), PP.toF(tagIn.end)], legal: [PP.toF(T_LEGAL), 1350],
    fastest: { collapse: PP.toF(T_POINT), symbol: PP.toF(T_POINT) + 1, underline: PP.toF((T_UL + T_CARE) / 2) },
  };
});
