// S02 · "We'd rather spell it out." · window f105–f278 (3.500–9.267 s) · INK (SCENES §S02).
// The type-vial (fill, light-ups on "Identity"/"confirmed"/"Purity"/"HPLC", camera 0.957→1.000 matched to the hero push)
// is pre-rendered: assets/plates/typevial.mp4 = stage video v-typevial (tools/render_typevial.sh, sub/typevial/). Its
// word-locked events read VO.w() at render time, so re-run tools/render_typevial.sh whenever js/vo.js changes.
// This file owns the transition "type sets into glass" (f262–f278):
//   - v-hero (starts f262, media 0.50, above v-typevial) is masked by linear-gradient(90deg, #000 X, transparent X+40px);
//     X rides the light band;
//   - the light band: 220 px, #FFF at ≤ 18 %, screen, clipped to the real vial (hero geometry + its measured push),
//     moving left→right over f262–f278 with expo.inOut; its centre crosses the vial axis exactly on f270 (HIT9);
//   - f278: mask cleared, band gone: full-frame hero (S03 takes over). v-typevial is covered from f271 and ends f278.
// The band geometry (axis, half-travel, push) comes from html/S02.html data-cfg (tools/s02_build.py) — the same numbers
// the plate uses for its 4 px band slip (sub/typevial/typevial.js bandX / maskEdge).
PP.scene("S02", function build(tl, root) {
  const svg = root.querySelector(".s02-band");
  if (!svg) return console.warn("[S02] no .s02-band (run tools/s02_build.py)");
  const cfg = JSON.parse(svg.dataset.cfg);
  const cam = svg.querySelector(".s02-cam");
  const beam = svg.querySelector(".s02-beam");
  const hero = document.getElementById("v-hero");
  if (!hero) console.warn("[S02] #v-hero missing: no reveal mask");
  if (!document.getElementById("v-typevial")) console.warn("[S02] #v-typevial missing: run tools/render_typevial.sh, then assemble.py");

  const T0 = PP.f(262), DUR = PP.f(16), T1 = PP.f(278);
  const ease = gsap.parseEase("expo.inOut");
  const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const bandX = (T) => cfg.axis - cfg.half + 2 * cfg.half * ease(cl((T - T0) / DUR)); // centre = axis at f270
  const push = (T) => {
    // v-hero media = 0.50 + (T − f262); push rows are 24 fps source frames 12…25
    const k = Math.max(0, Math.min(cfg.push.length - 1.0001, (0.5 + (T - T0)) * 24 - 12));
    const i = Math.floor(k), w = k - i, a = cfg.push[i], b = cfg.push[i + 1];
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
  };
  const HALF_W = 110, PEAK = 0.18;

  tl.set(svg, { opacity: 0 }, 0);
  tl.set(svg, { opacity: 1 }, T0);
  tl.set(svg, { opacity: 0 }, T1);
  PP.driveT(
    tl,
    (T) => {
      const x = bandX(T);
      const [s, tx, ty] = push(T);
      // band in stage px → the clip's (hero source) space
      cam.setAttribute("transform", `matrix(${s} 0 0 ${s} ${tx} ${ty})`);
      beam.setAttribute("x", ((x - HALF_W - tx) / s).toFixed(2));
      beam.setAttribute("width", ((2 * HALF_W) / s).toFixed(2));
      beam.setAttribute("y", (-ty / s).toFixed(2));
      beam.setAttribute("height", (1080 / s).toFixed(2));
      // light only while it travels over the glass: 0 at the travel ends, 18 % on the axis (f270)
      const near = cl(1 - Math.abs(x - cfg.axis) / (cfg.half * 0.95));
      beam.setAttribute("fill-opacity", (PEAK * Math.sqrt(near)).toFixed(4));
      if (hero) {
        const X = x - 20;
        PP.maskCss(hero, T >= T1 - 1e-6 ? "none" : `linear-gradient(90deg, #000 ${X.toFixed(1)}px, transparent ${(X + 40).toFixed(1)}px)`);
      }
    },
    T0,
    T1
  );
});
