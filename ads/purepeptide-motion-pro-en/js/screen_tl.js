// The screen timeline (SHOTS §0.5): every event that ever touches the phone's screen, in time order, on the PH rig.
// Shared by the BAKE (screen/bake.html → tools/bake_screen.cjs → assets/screen_seq/scr_0001..0481.png = f708..f1188, the
// 3D screen SEQUENCE) and by the 2D fallback rig in index.html (#phone2d, hidden by default) — one flag, same pixels.
// Coordinates: screen pt (x 0–402, y 0–874); a page pt (px, py) at scroll s is on screen at (px, 62 + py − s).
// Word-locked frames are read from VO.w at build time (BRIEF §5) and clamped; everything else is the table's frame.
// Nothing else ever touches the screen. The product page is never shown. Screens come only from assets/site/clean/.
(function () {
  const PP = window.PP;

  // Resolved event frames (filled by PP.screenTL; read them from shots / QC instead of re-deriving).
  PP.SCREEN = {};

  // PP.screenTL(tl): adds the screen events to the (paused, absolute-seconds) timeline. PH.init must have run.
  PP.screenTL = function (tl) {
    const PH = window.PH, VO = window.VO;
    const f = PP.f, F = PP.F;
    const ps = PH.ps;
    const E = PP.SCREEN;
    const fr = (t) => Math.round(t * 30 + 1e-6);
    const lock = (frame, lo, hi, label) => {
      const c = Math.min(hi, Math.max(lo, frame));
      if (c !== frame) console.warn(`[screen_tl] ${label}: f${frame} clamped to f${c}`);
      return c;
    };
    const expect = (label, got, table) => {
      if (got !== table) console.warn(`[screen_tl] ${label}: VO gives f${got}, SHOTS §0.5 table says f${table} (VO wins)`);
    };

    // ---------------------------------------------------------------- f708–f802: black (screen off)
    // The whole .ps (chrome + pages) is invisible until the wake; the bake page and the 2D rig both show black there.
    tl.set(ps, { opacity: 0, filter: "blur(2px)" }, 0);

    // ---------------------------------------------------------------- f803: the wake = VO L07 "Open" (6)
    E.wake = lock(fr(VO.w("L07", 6)), 795, 812, "wake (L07 Open)");
    expect("wake", E.wake, 803);
    const tWake = f(E.wake);
    PH.show(tl, tWake, "home", 0);
    // home @ 0 fades in with a 2 px → 0 blur over 12 f expo.out (baked into the texture)
    tl.fromTo(ps, { opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)", duration: 12 * F, ease: "expo.out", immediateRender: false }, tWake);
    // badge "1" on the home nav (one vial already in the cart): the nav shows cart1's nav band (its badge reads 1).
    // The §0.5 crop in PH.ov('home') would sit UNDER the re-stuck nav layer, so the swap is done on the nav itself
    // (PH.navBadge's alt layer, pop hidden: static). home.png and cart1.png differ only inside the badge (measured: the
    // nav band's mean difference is 0.10 levels, confined to x 326–332 pt).
    const nb = PH.navBadge(tl, tWake, "cart1", { on: "home" });
    nb.pop.style.visibility = "hidden";
    const BASE = PH.BASE;
    tl.set(nb.alt, { backgroundImage: `url('${BASE}cart1.png')` }, 0);

    // ---------------------------------------------------------------- f812–f840: momentum scroll 0 → 36 (below the 46 re-stick)
    E.scrollA = [812, 840];
    PH.scroll(tl, "home", 0, 36, f(812), f(28), "expo.out");

    // ---------------------------------------------------------------- the cart: landed 6 f before VO L08 "Let" (0)
    E.let = lock(fr(VO.w("L08", 0)), 860, 880, "L08 Let");
    expect("Let", E.let, 870);
    E.push1 = [E.let - 18, E.let - 6]; // Safari push home → cart1 @ 150, 12 f (table: f852–f864)
    E.tapCart = E.push1[0] - 2; // tap the cart icon (table: f850)
    E.badge = E.push1[1] + 2; // badge pop, stays "1" (table: f866)
    // tap the cart icon: page centre (319, 81) → screen (319, 107) at s 36; press the 42x42 nav control (page 298,60)
    PH.tap(tl, f(E.tapCart), 319, 107);
    navPress(tl, f(E.tapCart), "home", { x: 298, y: 60, w: 42, h: 42 });
    PH.push(tl, f(E.push1[0]), "home", "cart1", 150);
    PH.navBadge(tl, f(E.badge), "cart1");

    // ---------------------------------------------------------------- "+" tap #1 (f888) → cart2 @ 150 (f890), bar 0.42 → 0.81
    // The ring is drawn in PAGE space on the tapped page and continued on the page that replaces it at the "+"'s new
    // position (the item row shifts 20 pt when the discount line appears), so ring, press and button stay together
    // (PREV S08 recipe). Same look and curve as PH.tap.
    E.tap1 = 888;
    E.state2 = 890;
    pageRing(tl, f(E.tap1), "cart1", 226, 510); // page (226,510) = screen (226,422) at s 150
    pageRing(tl, f(E.tap1), "cart2", 226, 530);
    PH.press(tl, f(E.tap1), "cart1", { x: 211, y: 495, w: 30, h: 30 }, { radius: 7, bg: "#FFFFFF" });
    PH.press(tl, f(E.tap1), "cart2", { x: 211, y: 515, w: 30, h: 30 }, { radius: 7, bg: "#FFFFFF" });
    PH.show(tl, f(E.state2), "cart2", 150);
    PH.barFill(tl, f(E.state2), f(14), "cart2", 0.4207, 0.811, "#16A48F", "#16A48F");

    // ---------------------------------------------------------------- "+" tap #2 (f912) → cart3 @ 150 (f914), bar 0.81 → 1.00
    E.tap2 = 912;
    E.state3 = 914;
    pageRing(tl, f(E.tap2), "cart2", 226, 530); // page (226,530) = screen (226,442) at s 150
    pageRing(tl, f(E.tap2), "cart3", 226, 530);
    PH.press(tl, f(E.tap2), "cart2", { x: 211, y: 515, w: 30, h: 30 }, { radius: 7, bg: "#FFFFFF" });
    PH.press(tl, f(E.tap2), "cart3", { x: 211, y: 515, w: 30, h: 30 }, { radius: 7, bg: "#FFFFFF" });
    PH.show(tl, f(E.state3), "cart3", 150);
    // the HTML bar hands back to the capture's own (full, #2BB58A) bar once the fill has landed (f928)
    PH.barFill(tl, f(E.state3), f(14), "cart3", 0.811, 1.0, "#16A48F", "#2BB58A", { until: f(E.state3 + 14) });
    // f914–f1044: cart3 @ 150 holds (= clean/screen_cart.png from f930 on)

    // ---------------------------------------------------------------- f1044 nav tap → push cart3 → home @ 0 on VO L09 "Pure" (0)
    E.push2 = [lock(fr(VO.w("L09", 0)), 1044, 1056, "L09 Pure"), 0];
    E.push2[1] = E.push2[0] + 12;
    expect("push2", E.push2[0], 1050);
    E.tapNav = E.push2[0] - 6; // wordmark in the stuck nav: page (57,74,148,15) → screen (57, 90); centre (131, 98)
    PH.tap(tl, f(E.tapNav), 131, 98);
    // continuity: the cart now holds 3 vials, so the home's nav shows cart3's badge ("3") from the push on
    tl.set(nb.alt, { backgroundImage: `url('${BASE}cart3.png')` }, f(E.push2[0]));
    PH.push(tl, f(E.push2[0]), "cart3", "home", 0);

    // ---------------------------------------------------------------- f1062–f1188: home @ 0 holds; scroll 0 → 10 over f1080–f1150 (alive)
    E.scrollB = [1080, 1150];
    PH.scroll(tl, "home", 0, 10, f(1080), f(70), "sine.inOut");

    E.black = [708, E.wake - 1];
    E.last = 1188;
    return E;

    // ------------------------------------------------------------ helpers
    // Press of a control that lives in the sticky nav (PH.press parents its sprite to the page overlay, which sits under
    // the re-stuck nav): the same 0.97 → 1 spring on a crop placed inside the page's nav layer.
    function navPress(tl, t, name, r) {
      const P = PH.pages[name];
      const sp = PH.crop(name, r, { parent: P.nav, cls: "ps-press" });
      sp.style.cssText += `;left:${r.x}px;top:${r.y - PH.NAV_Y}px;border-radius:${r.w / 2}px;opacity:0;transform-origin:50% 50%`;
      tl.set(sp, { opacity: 0, scale: 1 }, 0);
      tl.set(sp, { opacity: 1 }, t);
      tl.fromTo(sp, { scale: 1 }, { scale: 0.97, duration: 3 * F, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo(sp, { scale: 0.97 }, { scale: 1, duration: 6 * F, ease: "back.out(0.8)", immediateRender: false }, t + 3 * F);
      tl.set(sp, { opacity: 0 }, t + 9 * F);
      return sp;
    }
    // Touch ring in page space (page pt), same curve as PH.tap: scale 0.4 → 1, opacity 0.6 → 0, 12 f power2.out.
    function pageRing(tl, t, name, X, Y) {
      const ring = PP.el("div", "ps-tapr", PH.ov(name));
      ring.style.cssText += `;left:${X}px;top:${Y}px`;
      tl.set(ring, { opacity: 0, scale: 0.4 }, 0);
      tl.fromTo(ring, { scale: 0.4, opacity: 0.6 }, { scale: 1, opacity: 0, duration: 12 * F, ease: "power2.out", immediateRender: false }, t);
      return ring;
    }
  };
})();
