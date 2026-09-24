// Global layers: light brand background with drifting gradient light, dot grid, subtle grain.
// Assembles the single master timeline from the scene modules.
(function () {
  const PP = window.PP;
  PP.buildGlobal = function (tl) {
    const dots = document.getElementById("dots");
    const turb = document.getElementById("grain-turb");
    const blobs = [...document.querySelectorAll(".blob")];
    PP.layers = { dots, blobs };
    tl.fromTo(dots, { y: 0 }, { y: -28, duration: 30, ease: "none" }, 0);
    // three soft brand-colour lights drifting on slow, finite sine paths
    const paths = [
      { x0: -260, y0: 120, x1: 140, y1: 420 },
      { x0: 520, y0: 980, x1: 180, y1: 1240 },
      { x0: 640, y0: -120, x1: 420, y1: 260 },
    ];
    blobs.forEach((b, i) => {
      const p = paths[i];
      tl.fromTo(b, { x: p.x0, y: p.y0 }, { x: p.x1, y: p.y1, duration: 15, ease: "sine.inOut" }, 0);
      tl.fromTo(b, { x: p.x1, y: p.y1 }, { x: p.x0 + 60, y: p.y0 + 40, duration: 15, ease: "sine.inOut", immediateRender: false }, 15);
    });
    PP.drive(tl, (v) => turb.setAttribute("seed", String(Math.round(v))), 0, 900, 0, 30, "none");
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
