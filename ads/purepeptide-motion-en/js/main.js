// Master timeline (SCENES §0.1): one paused GSAP timeline, 45.00 s, registered as window.__timelines["main"] by index.html.
// buildGlobal → PH.init → each scene's build(tl, root) in scene order (PP.scene registrations from js/scenes/*.js).
// main.js already shows each <section> at its IN frame and hides it at its OUT frame (tl.set opacity, PP.WIN):
// scenes must not repeat it, and must never tween visibility/display/autoAlpha on their section.
(function () {
  const PP = window.PP;
  PP.SCENES = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11"];

  PP.buildGlobal = function (tl) {
    // worlds (hard switches; scenes that own a transition crossfade with their own layers on top)
    PP.world(tl, "ink", 0);
    PP.world(tl, "paper", 532 / 30); // S04 white-out ends: PAPER at f532
    PP.world(tl, "navy", 1086 / 30); // S09 dive covers the frame: NAVY at f1086
    PP.grain(tl);
    // stage videos: visible only inside their own window (the runtime keeps a <video> painted outside it otherwise)
    document.querySelectorAll("video.stage-v").forEach((v) => {
      const a = +v.dataset.start, d = +v.dataset.duration;
      tl.set(v, { opacity: 0 }, 0);
      tl.set(v, { opacity: 1 }, a);
      tl.set(v, { opacity: 0 }, a + d);
    });
    // the rig is visible f750–f1085 only (S06 fly-in video before, S09 dive after)
    tl.set("#phone", { opacity: 0 }, 0);
    tl.set("#phone", { opacity: 1 }, 750 / 30);
    tl.set("#phone", { opacity: 0 }, 1086 / 30);
    tl.set({}, {}, PP.DUR); // pin the duration to 45.00 s
  };

  PP.build = function () {
    const tl = gsap.timeline({ paused: true });
    PP.buildGlobal(tl);
    window.PH.init(tl);
    const order = PP.SCENES.concat(PP._scenes.map((s) => s.id).filter((id) => !PP.SCENES.includes(id)));
    order.forEach((id) => {
      const reg = PP._scenes.filter((s) => s.id === id);
      const root = document.getElementById(id);
      if (!root) return console.error("[main] no <section> for scene " + id);
      if (PP.WIN[id]) {
        tl.set(root, { opacity: 0 }, 0);
        tl.set(root, { opacity: 1 }, PP.IN(id));
        tl.set(root, { opacity: 0 }, PP.OUT(id));
      }
      reg.forEach(({ build }) => {
        try {
          build(tl, root);
        } catch (e) {
          console.error("[scene " + id + "] build failed:", e && e.stack ? e.stack : e);
        }
      });
    });
    if (tl.duration() > PP.DUR + 1e-6) console.warn("[main] timeline runs past 45 s: " + tl.duration().toFixed(3));
    return tl;
  };

  gsap.registerPlugin(DrawSVGPlugin, CustomEase);
  const fonts = ['800 100px "DM Sans"', '700 100px "DM Sans"', '400 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"', '700 40px "Inter"',
    '500 30px "IBM Plex Mono"', '400 100px "Anton"', '800 100px "Archivo"', '900 100px "Archivo"', '300 100px "Inter Tight"'].map((f) => document.fonts.load(f));
  fonts.push(document.fonts.load('600 40px "PP Symbols"', "≥ "));
  // PP.ready resolves { tl } (wrapped: a GSAP timeline is a thenable). index.html registers it as __timelines["main"].
  // The HyperFrames bundler may hoist scripts above the markup: also wait for the DOM (no timers, no image waits).
  const dom = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
  fonts.push(dom);
  PP.ready = Promise.all(fonts)
    .then(() => ({ tl: PP.build() }))
    .catch((e) => {
      console.error("[main] build failed:", e && e.stack ? e.stack : e);
      throw e;
    });
})();
