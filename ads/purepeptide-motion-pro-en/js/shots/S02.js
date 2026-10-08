// S02 · "Printed on glass" · f126–f216 (4.20–7.20) · 3D phone layer assets/layers/s02.webm (#v-s02, z 30, alpha; 91 f = f126–f216, media 0 = f126).
// The black cover glass at 0.844 m (75 % frame height), cold key, the word "pure" present ONLY as the reflection of the PureReflect plane
// (blender/s02_glass.py), the SideR rim line, the sheen. Light only — no type, no site (SHOTS §S02). The 3D carries the ghost and the
// drift; this file adds ONE 2D event. MEASURED on the shipped layer (ffmpeg -c:v libvpx-vp9 decode × renders/3d/s02/matte_screen):
//   · the ghost: 43 % sRGB peak on the glass f126–f161 (screen-masked p99.5 42.4–42.9 %, max ≤ 46 %: inside the 35–45 % target), left of
//     the display centre at f150 (−3 mm), crossing it at f161–f163 = VO "hard" (f161), the move's fastest frame f165 (70.6°/s,
//     pose_speed.json), the trailing "e" off the glass at f174 (last word pixel > 25 %: f173). DEVIATION of the 3D layer: the contract
//     wants the word to leave on "prove." = VO.w('L02', 13) = f180 ± 2; it leaves 6 f early. Not fixable in 2D without doubling the word
//     (a crisp 2D copy over the motion-blurred 3D exit); re-render proposal (the ghost track only, ≈ 10 min) in the build report.
//   · black glass f174–f216: one rim line, the sheen, the sine drift (spin 5 → 6°, ≤ 1.6°/s).
//   · the cut f126 (§0.9, light-led): S01 f125's bright vertical stroke (the "u" stem, x 1033–1103, lum 218) → S02 f126's SideR rim line
//     (x 1029–1038, lum 197–254 over y 137–922): a vertical bright edge in the same place (the BRIEF's "(1040, 520)" is that stem; the
//     drop's own specular is dim; the S01 builder's PP.HANDOFF.S01: the drop's right rim arc x 1019–1030 → S02's rim x 1028–1033, Δx ≤ 10 px).
//     No 2D carry needed; the cut is hard and dark (frame mean 19.5 → 5.8 levels).
//   · SWEEP2 (§0.9 "SoftTop band peaks on the glass at f216"): the keyed SoftTop pass f192–f216 does NOT read in the render (screen-masked
//     max 9.9 → 8.0 % over f188–f216, the static sheen only; a ×6 gain shows nothing crossing). DEVIATION → the band is 2D, on the cover
//     glass itself: .s02-glass is the display as a per-frame quad (renders/3d/s02/corners.json → the CSS matrix3d of a 402×874 pt element,
//     TECH §5 recipe, 1.4 levels), +8 pt for the black ink border, radius 60 pt, overflow hidden, mix-blend-mode: screen (a DIRECT child
//     of the section with z 32: above the phone webm at 30, below #leak at 35; inside .z-front a screen blend would see black).
//     The film's 105° line of light (S03/S04's band: 220 pt halo ≈ 195 px, 2.3 pt core ≈ 2 px + glow, cold white): its leading halo
//     fades up at the glass's left edge over f192–f196 (4 f), the core enters the glass on f198 and crosses to the display centre on
//     f215 — the LAST S02 frame — accelerating (x ∝ u^2.5 from rest: 2.5× the mean speed at the cut, ≈ 21 px/f on f215; a cubic kept
//     the band invisible until f204, a quadratic lands it too slowly) and brightening (opacity 0.55 → 1.0): the shot's brightest
//     moment is its last frame, and on f216 S03's band is on the vial's left side at speed (§0.9). 180° shutter stretch (scaleX
//     1 + 0.5·px-per-frame/195, opacity ∝ stretch^-1/4) as in S03/S04.
// Sound (BRIEF §7; frames for the mixer): CUT1 f126 · PRINT/PROVE f180 = VO "prove." (picture: the ghost is ALREADY gone, f174, until the
// 3D is re-rendered) · the 3D move's fastest frame f165 (no cue in §7) · SWEEP2 f192→f216: the band's fastest and brightest shown frame is
// f215, its last sample on the cut f216 = S03's glass_tick A5. Nothing else is 2D in this shot.
PP.shot("S02", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S02"), T1 = PP.OUT("S02");
  const glass = root.querySelector(".s02-glass"), band = root.querySelector(".s02-band");
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // ---- word locks (read from VO, never hard-coded): the ghost's picture events are baked in the 3D layer; checked here for the QC
  const tHard = PP.word("S02", "L02", 10, "S02 hard"); // the ghost crosses the display centre (3D: f161–f163)
  const tProve = PP.word("S02", "L02", 13, "S02 prove."); // the ghost leaves the glass (3D, measured: f174)
  const GHOST_CROSS = 162, GHOST_EXIT = 174; // measured on assets/layers/s02.webm (see the header)
  if (Math.abs(PP.toF(tHard) - GHOST_CROSS) > 2) console.warn(`[S02] 3D ghost crosses the centre at f${GHOST_CROSS}, "hard" is f${PP.toF(tHard)}`);
  if (Math.abs(PP.toF(tProve) - GHOST_EXIT) > 2)
    console.warn(`[S02] 3D ghost leaves the glass at f${GHOST_EXIT}, "prove." is f${PP.toF(tProve)}: re-render the ghost track (build report)`);

  // ---- the cover glass quad: display corners → CSS matrix3d per frame (renders/3d/s02/corners.json, f190–f216; the drift is ≤ 0.06°/f here)
  const M = {
    190: [0.907548, 0.0342169, 0, 1.73214e-05, -0.0312327, 0.886021, 0, -1.13049e-05, 0, 0, 1, 0, 840.71, 143.865, 0, 1],
    191: [0.907615, 0.0343461, 0, 1.74033e-05, -0.0312843, 0.886063, 0, -1.12812e-05, 0, 0, 1, 0, 840.884, 143.839, 0, 1],
    192: [0.907696, 0.0345014, 0, 1.75016e-05, -0.0313459, 0.886113, 0, -1.12518e-05, 0, 0, 1, 0, 841.093, 143.807, 0, 1],
    193: [0.90779, 0.0346806, 0, 1.76155e-05, -0.0314175, 0.886171, 0, -1.12186e-05, 0, 0, 1, 0, 841.335, 143.77, 0, 1],
    194: [0.907894, 0.0348816, 0, 1.77429e-05, -0.0314976, 0.886236, 0, -1.11808e-05, 0, 0, 1, 0, 841.606, 143.73, 0, 1],
    195: [0.908008, 0.0351021, 0, 1.78833e-05, -0.0315856, 0.886307, 0, -1.11393e-05, 0, 0, 1, 0, 841.905, 143.685, 0, 1],
    196: [0.908131, 0.03534, 0, 1.80347e-05, -0.0316812, 0.886384, 0, -1.1095e-05, 0, 0, 1, 0, 842.227, 143.636, 0, 1],
    197: [0.908261, 0.0355927, 0, 1.81959e-05, -0.0317825, 0.886465, 0, -1.10477e-05, 0, 0, 1, 0, 842.569, 143.585, 0, 1],
    198: [0.908397, 0.0358566, 0, 1.83645e-05, -0.0318879, 0.886551, 0, -1.09975e-05, 0, 0, 1, 0, 842.928, 143.531, 0, 1],
    199: [0.908537, 0.0361293, 0, 1.85391e-05, -0.0319973, 0.88664, 0, -1.09457e-05, 0, 0, 1, 0, 843.3, 143.476, 0, 1],
    200: [0.908678, 0.0364077, 0, 1.87174e-05, -0.0321096, 0.88673, 0, -1.08932e-05, 0, 0, 1, 0, 843.68, 143.42, 0, 1],
    201: [0.908821, 0.0366886, 0, 1.88977e-05, -0.0322227, 0.886821, 0, -1.08399e-05, 0, 0, 1, 0, 844.064, 143.363, 0, 1],
    202: [0.908963, 0.0369689, 0, 1.9078e-05, -0.0323359, 0.886912, 0, -1.07865e-05, 0, 0, 1, 0, 844.449, 143.306, 0, 1],
    203: [0.909103, 0.0372462, 0, 1.92566e-05, -0.0324486, 0.887001, 0, -1.07343e-05, 0, 0, 1, 0, 844.83, 143.25, 0, 1],
    204: [0.909238, 0.0375165, 0, 1.94312e-05, -0.0325582, 0.887089, 0, -1.06828e-05, 0, 0, 1, 0, 845.202, 143.196, 0, 1],
    205: [0.909369, 0.0377778, 0, 1.95999e-05, -0.0326641, 0.887175, 0, -1.06326e-05, 0, 0, 1, 0, 845.562, 143.143, 0, 1],
    206: [0.909493, 0.0380261, 0, 1.97607e-05, -0.0327652, 0.887255, 0, -1.05852e-05, 0, 0, 1, 0, 845.906, 143.093, 0, 1],
    207: [0.90961, 0.0382603, 0, 1.99126e-05, -0.0328605, 0.887332, 0, -1.05403e-05, 0, 0, 1, 0, 846.23, 143.046, 0, 1],
    208: [0.909717, 0.0384767, 0, 2.00531e-05, -0.0329487, 0.887402, 0, -1.04987e-05, 0, 0, 1, 0, 846.53, 143.002, 0, 1],
    209: [0.909814, 0.0386729, 0, 2.01807e-05, -0.0330291, 0.887466, 0, -1.04613e-05, 0, 0, 1, 0, 846.804, 142.963, 0, 1],
    210: [0.9099, 0.0388478, 0, 2.02943e-05, -0.0331006, 0.887523, 0, -1.04274e-05, 0, 0, 1, 0, 847.047, 142.928, 0, 1],
    211: [0.909974, 0.0389989, 0, 2.03929e-05, -0.0331625, 0.887572, 0, -1.03985e-05, 0, 0, 1, 0, 847.258, 142.897, 0, 1],
    212: [0.910036, 0.0391246, 0, 2.04747e-05, -0.0332141, 0.887613, 0, -1.03741e-05, 0, 0, 1, 0, 847.433, 142.872, 0, 1],
    213: [0.910085, 0.0392239, 0, 2.05398e-05, -0.0332548, 0.887646, 0, -1.03552e-05, 0, 0, 1, 0, 847.572, 142.852, 0, 1],
    214: [0.91012, 0.0392955, 0, 2.05865e-05, -0.0332842, 0.887669, 0, -1.03412e-05, 0, 0, 1, 0, 847.672, 142.838, 0, 1],
    215: [0.910141, 0.039339, 0, 2.06148e-05, -0.0333022, 0.887683, 0, -1.03331e-05, 0, 0, 1, 0, 847.733, 142.829, 0, 1],
    216: [0.910148, 0.0393535, 0, 2.06243e-05, -0.033308, 0.887688, 0, -1.03302e-05, 0, 0, 1, 0, 847.753, 142.826, 0, 1],
  };
  const matrixAt = (fr) => "matrix3d(" + M[Math.max(190, Math.min(216, fr))].join(",") + ")";

  // ---- SWEEP2: the line of light crosses the black glass f192–f215 (the band is in glass pt; 0.886 px/pt at f216)
  // BAND_2D: set false if s02 is re-rendered with a SoftTop pass that reads on the glass (then the 3D band carries the cut alone).
  const BAND_2D = true;
  if (!BAND_2D) return void (glass.style.opacity = "0");
  const FB0 = 192, FB1 = 215; // f215 = the last S02 frame: the core on the display centre, the band at speed and at its brightest
  const tB0 = f(FB0), tB1 = f(FB1), NX = FB1 - FB0; // 23 f
  const E = (u) => Math.pow(u, 2.5); // from rest, fastest on the cut (S03's carry band is at speed on f216 and eases to rest)
  const X0 = -14.5, X1 = 201; // core x (pt): just outside the glass edge (−8 pt) at f192, entering on f198 → the display centre on f215
  const FADE = 4 / NX; // the leading halo (already over the glass edge at u = 0) fades up over 4 f: no pop on f192
  const PXPT = 0.886, HALO = 195; // stage px per glass pt; the halo in stage px
  const slope = (u) => {
    const h = 1 / 240, a = Math.max(0, u - h), b = Math.min(1, u + h);
    return (E(b) - E(a)) / (b - a);
  };
  const setBand = (t) => {
    const fr = Math.floor(t * 30 + 1e-3);
    const u = c01((t - tB0) / (tB1 - tB0));
    const on = u > 1e-6;
    glass.style.opacity = on ? "1" : "0";
    if (!on) return;
    glass.style.transform = matrixAt(fr);
    const x = X0 + (X1 - X0) * E(u);
    const vpx = ((slope(u) * (X1 - X0)) / NX) * PXPT; // stage px per frame: 0 → ≈ 24 on f215
    const s = 1 + (0.5 * vpx) / HALO; // 180° shutter stretch of the halo across its travel
    const op = Math.min(1, u / FADE) * (0.55 + 0.45 * u) * Math.pow(s, -0.25); // 4 f fade-up, brightening into the cut, energy spread over the stretch
    band.style.opacity = op.toFixed(3);
    band.style.transform = `translateX(${x.toFixed(2)}px) rotate(15deg) scaleX(${s.toFixed(4)})`;
  };
  PP.driveT(tl, setBand, tB0, tB1);
  void T0; void T1; void F;
});
