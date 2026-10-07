// S12 · Lights out, STOP · f1152–f1206 · take + held frame. STUB — replaced by the shot builder (SHOTS.md §S12, BUILD.md).
// Every tween at ABSOLUTE seconds on the master timeline: PP.f(frame). Word-locked events: PP.word("S12", "Lxx", i).
PP.shot("S12", function build(tl, root) {
  const T0 = PP.IN("S12"), T1 = PP.OUT("S12");
  const label = root.querySelector(".stub-label");
  // the stub label breathes in over 8 f so the window's first frame is visibly the shot's own (main.js gates the section)
  tl.set(label, { opacity: 0 }, 0);
  tl.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 8 * PP.F, ease: "power2.out", immediateRender: false }, T0);
  void T1;
});
