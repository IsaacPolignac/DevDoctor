// Global layers: black stage, vignette, animated film grain, fx layer (flash rings). Assembles the master timeline.
(function () {
  const PP = window.PP;
  PP.DUR = 60;
  PP.buildGlobal = function (tl) {
    const turb = document.getElementById("grain-turb");
    PP.layers = { fx: document.getElementById("fx") };
    PP.drive(tl, (v) => turb.setAttribute("seed", String(Math.round(v))), 0, 1800, 0, PP.DUR, "none"); // new grain every frame
  };
  PP.build = function () {
    const tl = gsap.timeline({ paused: true });
    PP.buildGlobal(tl);
    PP._scenes.forEach(({ id, build }) => {
      const root = document.getElementById(id);
      let cam = root.querySelector(":scope > .cam");
      if (!cam) {
        cam = PP.el("div", "cam", null);
        root.insertBefore(cam, root.firstChild);
      }
      try {
        build(tl, root, cam);
      } catch (e) {
        console.error("[scene " + id + "] build failed:", e);
      }
    });
    return tl;
  };
})();
