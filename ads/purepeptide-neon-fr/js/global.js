// Global layers: near-black stage, the permanent bottom "stage light" halo (reference DNA), faint dot grid,
// a beat pulse on the halo after the music drop (8.00 s, 120 BPM), grain. Assembles the master timeline.
(function () {
  const PP = window.PP;
  PP.DUR = 30;
  PP.buildGlobal = function (tl) {
    const halo = document.getElementById("halo");
    const halo2 = document.getElementById("halo2");
    const dots = document.getElementById("dots");
    const turb = document.getElementById("grain-turb");
    PP.layers = { halo, halo2, dots, fx: document.getElementById("fx") };
    tl.fromTo(dots, { y: 0 }, { y: -40, duration: PP.DUR, ease: "none" }, 0);
    // halo breathes slowly during the tense intro, then pulses on every beat from the drop
    tl.fromTo(halo, { opacity: 0.55, scaleX: 0.9 }, { opacity: 0.8, scaleX: 1, duration: 8, ease: "sine.inOut" }, 0);
    for (let b = 8; b < 28.5; b += 0.5) {
      tl.fromTo(halo2, { opacity: 0.55 }, { opacity: 0.12, duration: 0.45, ease: "power2.out", immediateRender: false }, b);
    }
    tl.set(halo2, { opacity: 0 }, 0);
    tl.fromTo(halo, { opacity: 0.8 }, { opacity: 0.5, duration: 2, ease: "sine.inOut", immediateRender: false }, 28);
    PP.drive(tl, (v) => turb.setAttribute("seed", String(Math.round(v))), 0, 900, 0, PP.DUR, "none");
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
