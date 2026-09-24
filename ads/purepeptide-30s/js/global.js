// Global layers for the whole video: hairline grid drift, per-scene radial glow, film grain,
// the S2->S3 light bloom. Scenes never touch these except where documented in SCENES.md.
(function () {
  const PP = window.PP;

  PP.buildGlobal = function (tl) {
    const grid = document.getElementById("grid");
    const glow = document.getElementById("glow");
    const bloom = document.getElementById("bloom");
    const turb = document.getElementById("grain-turb");
    PP.layers = { grid, glow, bloom };

    // 60 px hairline grid drifting up 20 px over 30 s (linear). Base opacity 0.5 => 5 % lines.
    tl.fromTo(grid, { y: 0 }, { y: -20, duration: 30, ease: "none" }, 0);
    tl.set(grid, { opacity: 0.5 }, 0);
    // The grid pans with the S5 -> S6 whip so the move reads as one camera pan (1080 px = 18 cells: seamless).
    tl.fromTo(grid, { x: 0 }, { x: -1080, duration: 0.5, ease: "expo.inOut" }, 15.5);

    // Film grain: seed stepped every frame (900 frames), deterministic.
    PP.drive(tl, (v) => turb.setAttribute("seed", String(Math.round(v))), 0, 900, 0, 30, "none");

    // Radial glow (--accent 10 %, radius 650 px) parked behind each scene's hero element.
    // [time, x, y] centre positions; moves ease over 0.4 s at each cut.
    const stops = [
      [0.0, 540, 1000], // S1/S2 vial
      [5.8, 540, 820], // S3 counter + chromatogram
      [9.7, 540, 940], // S4 card
      [11.8, 540, 930], // S5 certificate
      [15.7, 540, 880], // S6 carousel
      [20.5, 540, 1040], // S6 group shot
      [21.9, 540, 900], // S7 tiles
      [25.8, 540, 850], // S8 logo
    ];
    tl.set(glow, { x: stops[0][1] - 650, y: stops[0][2] - 650 }, 0);
    for (let k = 1; k < stops.length; k++) {
      const [t, x, y] = stops[k];
      const [, px, py] = stops[k - 1];
      tl.fromTo(glow, { x: px - 650, y: py - 650 }, { x: x - 650, y: y - 650, duration: 0.4, ease: "power2.inOut", immediateRender: false }, t);
    }

    // S2 -> S3 zoom-through light bloom, peaking at 6.00 (35 %).
    tl.fromTo(bloom, { opacity: 0 }, { opacity: 0.35, duration: 0.4, ease: "power2.in" }, 5.6);
    tl.fromTo(bloom, { opacity: 0.35 }, { opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, 6.0);
  };

  PP.build = function () {
    const tl = gsap.timeline({ paused: true });
    PP.buildGlobal(tl);
    PP._scenes.forEach(({ id, build }) => {
      const root = document.getElementById(id);
      let cam = root.querySelector(".cam");
      if (!cam) cam = PP.el("div", "cam", root);
      try {
        build(tl, root, cam);
      } catch (e) {
        console.error("[scene " + id + "] build failed:", e);
      }
    });
    return tl;
  };
})();
