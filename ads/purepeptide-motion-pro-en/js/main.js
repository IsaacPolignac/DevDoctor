// Master timeline (SHOTS §0.1): one paused GSAP timeline, 45.00 s, registered as window.__timelines["main"] by index.html.
// buildGlobal → PH.init (the 2D rig, hidden) → PP.screenTL (the screen events on the 2D rig) → each shot's build(tl, root)
// in shot order (PP.shot registrations from js/shots/*.js).
// main.js already shows each <section> at its IN frame and hides it at its OUT frame (tl.set opacity, PP.WIN):
// shots must not repeat it, and must never tween visibility/display/autoAlpha (nor set z-index/transform/filter) on
// their section.
(function () {
  const PP = window.PP;
  const f = PP.f;

  // The zero-cost fallback (BRIEF §10.3): true shows the 2D rig (#phone2d, REST pose) over FALLBACK_WIN instead of the
  // take webm's f738–f936; the screen pixels are the same js/screen_tl.js events. Flip it only if the take fails.
  PP.FALLBACK_2D = false;
  PP.FALLBACK_WIN = [738, 936];

  PP.buildGlobal = function (tl) {
    PP.registerEases();
    // the void glow: 100 % during the take (f738–f1188), 0 % on the plates and the end card
    PP.glow(tl, 0, 0);
    PP.glow(tl, 1, f(738));
    PP.glow(tl, 0, f(1188));
    // finish: grain 2 % (frozen on the STOP), vignette 22 % → 0 % on the end card
    PP.grain(tl);
    PP.vignette(22, tl, 0);
    PP.vignette(0, tl, f(PP.LOGO));
    // stage media: visible only inside their own window (the runtime keeps a <video> painted outside it otherwise)
    document.querySelectorAll("video.stage-v").forEach((v) => {
      const a = +v.dataset.start, d = +v.dataset.duration;
      tl.set(v, { opacity: 0 }, 0);
      tl.set(v, { opacity: 1 }, a);
      tl.set(v, { opacity: 0 }, a + d);
    });
    // stage stills start hidden; the owning shot switches them on (BUILD.md)
    document.querySelectorAll("img.stage-img").forEach((im) => tl.set(im, { opacity: 0 }, 0));
    // the 2D rig: hidden unless the fallback flag is on
    tl.set("#phone2d", { opacity: 0 }, 0);
    if (PP.FALLBACK_2D) {
      tl.set("#phone2d", { opacity: 1 }, f(PP.FALLBACK_WIN[0]));
      tl.set("#phone2d", { opacity: 0 }, f(PP.FALLBACK_WIN[1]));
    }
    tl.set({}, {}, PP.DUR); // pin the duration to 45.00 s
  };

  PP.build = function () {
    const tl = gsap.timeline({ paused: true });
    PP.buildGlobal(tl);
    window.PH.init(tl, { root: "phone2d" });
    PP.screenTL(tl);
    const order = PP.SHOTS.concat(PP._shots.map((s) => s.id).filter((id) => !PP.SHOTS.includes(id)));
    order.forEach((id) => {
      const reg = PP._shots.filter((s) => s.id === id);
      const root = document.getElementById(id);
      if (!root) return console.error("[main] no <section> for shot " + id);
      if (PP.WIN[id]) {
        tl.set(root, { opacity: 0 }, 0);
        tl.set(root, { opacity: 1 }, PP.IN(id));
        tl.set(root, { opacity: 0 }, PP.OUT(id));
      }
      reg.forEach(({ build }) => {
        try {
          build(tl, root);
        } catch (e) {
          console.error("[shot " + id + "] build failed:", e && e.stack ? e.stack : e);
        }
      });
    });
    if (tl.duration() > PP.DUR + 1e-6) console.warn("[main] timeline runs past 45 s: " + tl.duration().toFixed(3));
    return tl;
  };

  gsap.registerPlugin(DrawSVGPlugin, CustomEase);
  const fonts = ['800 100px "DM Sans"', '700 100px "DM Sans"', '400 40px "Inter"', '500 40px "Inter"', '600 40px "Inter"', '700 40px "Inter"',
    '500 30px "IBM Plex Mono"'].map((ff) => document.fonts.load(ff));
  fonts.push(document.fonts.load('600 40px "PP Symbols"', "≥ "));
  // Brand SVGs for DrawSVG (S13) are inlined by tools/assemble.py as <template id="svg-symbol|svg-wordmark"> (PP.inlineSvg).
  // PP.ready resolves { tl } (wrapped: a GSAP timeline is a thenable). index.html registers it as __timelines["main"].
  // The HyperFrames bundler may hoist scripts above the markup: also wait for the DOM (no timers, no image waits).
  const dom = document.readyState === "loading" ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
  PP.ready = Promise.all(fonts.concat([dom]))
    .then(() => ({ tl: PP.build() }))
    .catch((e) => {
      console.error("[main] build failed:", e && e.stack ? e.stack : e);
      throw e;
    });
})();
