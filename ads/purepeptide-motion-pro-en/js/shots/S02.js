// S02 · Printed on glass · f126–f216 · 3D phone, alpha. STUB — replaced by the shot builder (SHOTS.md §S02, BUILD.md).
// Every tween at ABSOLUTE seconds on the master timeline: PP.f(frame). Word-locked events: PP.word("S02", "Lxx", i).
PP.shot("S02", function build(tl, root) {
  const T0 = PP.IN("S02"), T1 = PP.OUT("S02");
  const label = root.querySelector(".stub-label");
  // the stub label breathes in over 8 f so the window's first frame is visibly the shot's own (main.js gates the section)
  tl.set(label, { opacity: 0 }, 0);
  tl.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 8 * PP.F, ease: "power2.out", immediateRender: false }, T0);
  void T1;
});
