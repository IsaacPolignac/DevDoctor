// s4 (11.60 → 14.10) — « 99 %, minimum. »
// Giant 99 rolls in from 11.62 (s3 flies through the camera), last digit lands on 12.00 = beat + FLASH #2
// (ring from the number, punch 1.12 → 1, 3-frame camera shake, spark burst). « minimum » on the VO (12.46),
// plain caption at 12.90. Exit 13.75 → 13.95: push through + blur, centre clear for s5's browser.
PP.scene("s4", function (tl, root, cam) {
  const F = PP.F;
  const T0 = 11.6;
  const HIT = 12.0; // last digit lands + flash
  const EXIT = 13.72;
  const CY = 850; // visual centre of the number

  cam.style.transformOrigin = `540px ${CY}px`;
  const drift = PP.el("div", "s4-drift", cam);
  drift.style.transformOrigin = `540px ${CY}px`;

  // ------------------------------------------------------------ background: giant outline 99 + glow
  const bg = PP.el("div", "s4-bgword", drift, { text: "99", "data-layout-allow-overflow": "" });
  tl.fromTo(bg, { x: 70, scale: 1.1 }, { x: -70, scale: 1, duration: 2.5, ease: "none" }, T0);
  tl.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, T0);
  const glow = PP.el("div", "s4-glow", drift);
  tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 0.9, duration: 0.4, ease: "power2.out" }, T0);
  tl.fromTo(glow, { opacity: 1, scale: 1.25 }, { opacity: 0.6, scale: 1, duration: 0.7, ease: "expo.out", immediateRender: false }, HIT);

  // ------------------------------------------------------------ spark burst at the hit (deterministic)
  const sparks = PP.el("div", "s4-sparks", drift);
  sparks.style.left = "540px";
  sparks.style.top = CY + "px";
  const rnd = PP.rng(4099);
  for (let i = 0; i < 30; i++) {
    const arm = PP.el("div", "s4-arm", sparks);
    arm.style.transform = `rotate(${((i / 30) * 360 + rnd() * 10).toFixed(1)}deg)`;
    const sp = PP.el("div", "s4-spark", arm);
    const len = 30 + rnd() * 70;
    sp.style.height = len + "px";
    const r0 = 170 + rnd() * 60,
      r1 = 420 + rnd() * 380;
    tl.set(sp, { y: -r0, opacity: 0 }, 0);
    tl.fromTo(sp, { y: -r0, opacity: 1, scaleY: 1.6 }, { y: -r1, opacity: 0, scaleY: 0.3, duration: 0.5 + rnd() * 0.35, ease: "power3.out", immediateRender: false }, HIT);
  }

  // ------------------------------------------------------------ the number
  const numIn = PP.el("div", "s4-numin", drift); // entry
  const punch = PP.el("div", "s4-punch", numIn); // punch on the hit
  const row = PP.el("div", "s4-row", punch);
  const digits = PP.el("div", "s4-digits", row);
  const counter = PP.rollCounter(tl, digits, "99", 11.62, HIT - 0.08); // lands 11.92 / 12.00
  const pct = PP.el("div", "s4-pct", row, { text: "%" });
  // extra motion blur on each digit window while it spins (the strip blur alone is too crisp at this size)
  counter.digs.forEach((d, i) => {
    const lnd = HIT - 0.08 + i * 0.08;
    tl.fromTo(d.win, { filter: "blur(0px)" }, { filter: "blur(9px)", duration: 0.1, ease: "power1.in" }, 11.64);
    tl.fromTo(d.win, { filter: "blur(9px)" }, { filter: "blur(0px)", duration: 0.12, ease: "power2.out", immediateRender: false }, lnd - 0.1);
  });

  tl.fromTo(numIn, { scale: 1.45, filter: "blur(24px)" }, { scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, T0);
  tl.fromTo(numIn, { opacity: 0 }, { opacity: 1, duration: 3 * F, ease: "none" }, T0);
  // « % » slides in on the voice (« 99 % », 11.76)
  tl.fromTo(pct, { x: 120, opacity: 0, filter: "blur(14px)", scale: 0.7 }, { x: 0, opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.42, ease: "expo.out" }, 11.74);
  // punch + brightness flash on the hit
  tl.fromTo(punch, { scale: 1 }, { scale: 1.1, duration: F, ease: "none" }, HIT - F);
  tl.fromTo(punch, { scale: 1.1 }, { scale: 1, duration: 0.5, ease: "expo.out", immediateRender: false }, HIT);
  tl.fromTo(punch, { filter: "brightness(1)" }, { filter: "brightness(1.9)", duration: F, ease: "none" }, HIT - F);
  tl.fromTo(punch, { filter: "brightness(1.9)" }, { filter: "brightness(1)", duration: 0.45, ease: "power2.out", immediateRender: false }, HIT);

  // FLASH #2 (fx layer, above everything) from the number
  PP.flashRing(tl, PP.layers.fx, HIT, { x: 540, y: CY });

  // camera shake: 3 frames, deterministic
  [
    [0, 0, 0],
    [HIT, 16, -12],
    [HIT + F, -12, 9],
    [HIT + 2 * F, 7, -5],
    [HIT + 3 * F, 0, 0],
  ].forEach(([t, x, y]) => tl.set(cam, { x, y }, t));

  // slow camera drift over the whole scene
  tl.fromTo(drift, { scale: 1, y: 0 }, { scale: 1.035, y: -12, duration: 2.5, ease: "sine.inOut" }, T0);

  // ------------------------------------------------------------ « minimum » + caption
  const minWrap = PP.el("div", "s4-min", drift);
  const h = PP.headline(minWrap, ["minimum."], "h1");
  PP.wordIn(tl, h.words[0], 12.46 - 0.04, { rise: 40, blur: 12, dur: 0.5 });
  tl.fromTo(h.el, { scale: 1.25 }, { scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 12.42);
  const rule = PP.el("div", "s4-rule", minWrap);
  tl.fromTo(rule, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: "expo.out" }, 12.56);
  const cap = PP.el("div", "s4-cap soft", minWrap);
  const capWords = PP.headline(cap, ["de pureté, mesurée par le laboratoire"], "s4-capline").words;
  PP.wordsIn(tl, capWords, 12.9, { stagger: 0.045, rise: 12, blur: 6 });

  // ------------------------------------------------------------ exit: push through + blur, gone by 13.95
  tl.fromTo(cam, { scale: 1 }, { scale: 2.2, duration: 0.24, ease: "power3.in", immediateRender: false }, EXIT);
  tl.fromTo(cam, { filter: "blur(0px)" }, { filter: "blur(24px)", duration: 0.18, ease: "power2.in", immediateRender: false }, EXIT + 0.02);
  tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.12, ease: "power1.in", immediateRender: false }, EXIT + 0.06);
  tl.fromTo(minWrap, { y: 0 }, { y: 140, duration: 0.2, ease: "power2.in", immediateRender: false }, EXIT);
});
