// three.js plates for the film. n = frames at 30 fps. Film slot noted per plate.
// Keys: az el dist tx ty tz fov (camera, spherical around target), vialRot, rig (env rotation -> reflections slide),
// sweep/sweepI (moving area light, x), exposure, glowK. Looks: studio | rim | cold | back.
export const PLATES = [
  // --- inserts (film 14.5-20)
  { name: "p3_shoulder", n: 15, look: "studio", ease: "lin", // 15.5-16.0 glass shoulder edge, light sweep ~30 %/s
    from: { az: -0.42, el: 0.06, dist: 3.5, tx: 0.55, ty: 3.72, fov: 22, vialRot: -0.6, rig: 0.95, sweep: -6, sweepI: 0.8 },
    to: { az: -0.38, el: 0.05, dist: 3.42, tx: 0.55, ty: 3.72, fov: 22, vialRot: -0.6, rig: 0.35, sweep: 3, sweepI: 0.8 } },
  { name: "p3_cake", n: 30, look: "studio", ease: "lin", // 16.0-17.0 powder cake through the glass (heel band under the label)
    from: { az: 0.2, el: 0.16, dist: 3.9, tx: 0, ty: 0.42, fov: 24, vialRot: 2.4, rig: 0.35 },
    to: { az: 0.24, el: 0.16, dist: 3.82, tx: 0, ty: 0.42, fov: 24, vialRot: 2.4, rig: 0.25 } },
  { name: "p3_capridge", n: 15, look: "studio", ease: "lin", // 17.4-17.9 cap ridge
    from: { az: 0.5, el: 0.42, dist: 3.7, tx: 0, ty: 5.12, fov: 24, rig: -0.3 },
    to: { az: 0.56, el: 0.42, dist: 3.65, tx: 0, ty: 5.12, fov: 24, rig: -0.2 } },
  { name: "p3_labelsweep", n: 15, look: "studio", ease: "lin", // 18.9-19.4 label, sweep ~30 %/s
    from: { az: 0.0, el: 0.02, dist: 5.2, tx: 0, ty: 1.95, fov: 26, vialRot: 0, rig: 0.45, sweep: -3.2, sweepI: 1.1 },
    to: { az: 0.03, el: 0.02, dist: 5.12, tx: 0, ty: 1.95, fov: 26, vialRot: 0, rig: 0.05, sweep: 0.4, sweepI: 1.1 } },
  // --- acceleration (film 39-46), speed ramps
  { name: "p3_orbit", n: 30, look: "studio", ease: "ramp", // 39-40 orbit around the whole vial
    from: { az: -1.15, el: 0.26, dist: 11.5, ty: 3.1, fov: 28, rig: 0.2 },
    to: { az: 0.35, el: 0.06, dist: 12.8, ty: 2.75, fov: 28, rig: -0.2 } },
  { name: "p3_glide", n: 30, look: "studio", ease: "ramp", // 41-42 low glide up the body, strip sweeps
    from: { az: 0.75, el: 0.02, dist: 4.4, ty: 1.3, fov: 26, vialRot: 0.3, rig: 0.4, sweep: -5, sweepI: 0.9 },
    to: { az: 0.42, el: 0.02, dist: 4.1, ty: 3.6, fov: 26, vialRot: 0.3, rig: -0.3, sweep: 5, sweepI: 0.9 } },
  { name: "p3_captop", n: 15, look: "studio", ease: "ramp", // 43-43.5 cap top orbit
    from: { az: -0.85, el: 0.92, dist: 4.6, ty: 5.1, fov: 26, rig: 0.3 },
    to: { az: -0.15, el: 0.8, dist: 4.3, ty: 5.1, fov: 26, rig: -0.1 } },
  { name: "p3_labelpush", n: 15, look: "studio", ease: "ramp", // 44-44.5 label push-in
    from: { az: -0.28, el: 0.05, dist: 4.4, tx: 0.2, ty: 2.0, fov: 24, vialRot: 0.3, sweep: 4, sweepI: 1.0 },
    to: { az: -0.22, el: 0.05, dist: 3.8, tx: 0.2, ty: 2.0, fov: 24, vialRot: 0.1, sweep: -2, sweepI: 1.0 } },
  { name: "p3_heel", n: 8, look: "studio", ease: "o", // 45-45.25 heel + cake macro
    from: { az: 0.45, el: 0.2, dist: 3.4, tx: 0.5, ty: 0.4, fov: 24, vialRot: 2.6, rig: 0.2 },
    to: { az: 0.5, el: 0.2, dist: 3.05, tx: 0.5, ty: 0.4, fov: 24, vialRot: 2.6, rig: 0.1 } },
  { name: "p3_crimp", n: 8, look: "studio", ease: "o", // 45.5-45.75 crimp ribs
    from: { az: 1.0, el: 0.1, dist: 3.9, ty: 4.55, fov: 24, rig: -0.4 },
    to: { az: 1.14, el: 0.1, dist: 3.6, ty: 4.5, fov: 24, rig: -0.25 } },
  // --- stills (2D moves in the film)
  { name: "s3_rim", n: 3, look: "rim", still: true, // 1.6-6.0 line of light (masked in the film)
    from: { az: 0.2, el: 0.03, dist: 13.4, ty: 2.72, fov: 28, vialRot: 0 } },
  { name: "s3_macro", n: 3, look: "studio", still: true, // 30.0-31.5 crimp / shoulder, vial placed right in the film
    from: { az: -0.5, el: 0.1, dist: 5.4, ty: 4.2, fov: 26, vialRot: 0.3, rig: 0.1 } },
  { name: "s3_cold", n: 3, look: "cold", still: true, // 33-36 cold backlight silhouette
    from: { az: 0.05, el: 0.03, dist: 14.2, ty: 2.72, fov: 28, vialRot: 0.35, exposure: 1.0 } },
  { name: "s3_back", n: 3, look: "back", still: true, // 50-53 backlit for smoke
    from: { az: 0.1, el: 0.02, dist: 14.6, ty: 2.72, fov: 28, vialRot: 0.4, exposure: 1.0 } },
];
let f = 0;
export const SEGMENTS = PLATES.map((p) => {
  const s = { ...p, t0: f / 30, dur: p.n / 30, f0: f };
  f += p.n;
  return s;
});
export const TOTAL_FRAMES = f;
