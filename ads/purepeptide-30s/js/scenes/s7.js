// s7 — STANDARDS (section window 22.00–26.00, brief S7).
// "No shortcuts." + a 2×2 grid of glass tiles (US-based · Lyophilized & sealed · A COA per batch ·
// Ships to N countries), each with a hand-drawn 56 px --accent line icon. Tiles pop on the beats
// 22.50 · 23.00 · 23.50 · 24.00; 24.00–25.50 tension (borders charge to --accent 40 %, the global grid
// brightens, the tiles are pulled a few px toward the centre); 25.50–26.00 implosion (SCENES.md
// hand-off #7): headline + tiles collapse into ONE 12 px point (white core, --accent glow) at (540, 880)
// in unscaled screen px, fully formed before the cut to S8.
//
// Layer structure (root = <section id="s7">):
//   cam    (camera push-in 1.00→1.04, 22.00–26.00)
//     headline · 4 × tile { glass · glow (tension border) · flare (implosion light) · icon · text }
//   point  (unscaled screen space: halo · core)
PP.scene("s7", function (tl, root, cam) {
  const cfg = PP.cfg;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => {
    const u = clamp01((x - a) / (b - a));
    return u * u * (3 - 2 * u);
  };

  // ------------------------------------------------------------------ geometry (cam-local px; = screen px at scale 1)
  // 2 × 2 tiles of 400 × 300 with a 40 px gap: x 120→960, y 560→1200. The grid centre (540, 880) is the
  // implosion point (the brief's "y 560→1240" cannot hold two 300 px rows + a 40 px gap; 880 = centre wins).
  const TW = 400;
  const TH = 300;
  const GAP = 40;
  const X0 = 120;
  const Y0 = 560;
  const PX = 540; // implosion point, unscaled screen px
  const PY = 880;
  const CAM_T0 = 22.0;
  const CAM_T1 = 26.0;
  const camS = (t) => 1 + 0.04 * clamp01((t - CAM_T0) / (CAM_T1 - CAM_T0));
  // cam-local y that lands on screen y 880 at the end of the implosion (cam origin 540 960)
  const PY_LOCAL = 960 + (PY - 960) / camS(25.9);

  // ------------------------------------------------------------------ icons (56 × 56, 2 px round strokes)
  // Each stroke: [d, offset from the icon's draw start (s), duration (s)].
  const ICONS = {
    // Contiguous US, Albers equal-area projection of ~150 coastline / border points, lightly smoothed:
    // Puget notch, 49th-parallel arc, Great Lakes notch (arrowhead · Michigan · Erie), Maine, Atlantic,
    // Florida peninsula, Gulf + Mississippi delta, Texas / Rio Grande, Pacific coast.
    us: [
      [
        "M6.4 12.9 L7.1 12.5 L7.7 12.4 L13.5 13.8 L20.5 14.9 L24.2 15.1 L29.2 15.2 L30.1 15.6 L33.4 16.4 L33.4 16.7 L32.4 17.7 L32.4 17.9 L33.1 17.9 L35 17.2 L36.2 17.8 L37.8 17.7 L38.2 17.9 L39.2 19.4 L39.5 20.6 L40.4 21.3 L40.5 22 L40.2 23.2 L40.9 23.5 L42.2 23 L43.1 22.2 L43.9 21.1 L45.4 20.4 L47 18.4 L49.6 17.3 L50.2 16.4 L50.9 14.4 L51.2 14.1 L51.7 14.3 L53 16.2 L53.1 16.7 L51.5 18.6 L51.2 19.1 L51.2 20.2 L51.6 21.1 L49.7 22.4 L49 23.3 L48.1 27.4 L48.2 28.3 L48.7 29.6 L48.6 30.2 L47.8 31.3 L45.6 33.2 L44.4 34.9 L44.1 35.7 L44.1 36.7 L44.2 37.6 L46.1 41.4 L46.1 42.3 L45.9 43.1 L45.3 43.2 L44.6 42.7 L43.4 41 L42.6 39.1 L41.8 38.3 L41.3 38.1 L40.1 38.4 L38.6 38.1 L37.1 38 L35.9 38.3 L35.6 39.3 L35.1 39.6 L31.5 39.3 L30.2 39.6 L27.9 41.2 L27.3 42 L27.1 43.4 L26.8 43.6 L26.2 43.6 L25.2 42.9 L23.4 39.8 L22.9 39.2 L22.1 38.9 L20.9 39.4 L20.4 39.3 L18.4 36.8 L17.5 36.2 L16.5 35.9 L15 36.2 L13.2 35.9 L11.9 35.4 L9.2 33.7 L7.3 33.2 L6.1 31.5 L4.5 30.2 L4.1 29.6 L3.3 26.1 L2.8 24.5 L2.6 23.1 L2.6 22.2 L3.4 19.2 L4.6 16.4 L5.2 13.2 L5.5 12.8 Z",
        0,
        0.46,
      ],
    ],
    // 2R vial: flip-off top, crimp cap, neck, shoulders, body, lyophilized cake line, glass highlight.
    vial: [
      ["M23 15.5 V17.5 C23 20.5 16 20.5 16 25 V47 Q16 51 20 51 H36 Q40 51 40 47 V25 C40 20.5 33 20.5 33 17.5 V15.5", 0, 0.38],
      ["M20.5 8.5 V13.5 Q20.5 15.5 22.5 15.5 H33.5 Q35.5 15.5 35.5 13.5 V8.5", 0.12, 0.26],
      ["M19.5 4.5 H36.5 Q37.5 4.5 37.5 5.5 V7.5 Q37.5 8.5 36.5 8.5 H19.5 Q18.5 8.5 18.5 7.5 V5.5 Q18.5 4.5 19.5 4.5 Z", 0.2, 0.24],
      ["M16 42 C20 40.6 24 42.4 28 41.4 C32 40.6 36 41.6 40 41.8", 0.24, 0.22],
      ["M20.5 28 V36", 0.3, 0.16],
    ],
    // COA: document with folded corner + three text lines, verified badge (circle + tick) cutting the corner.
    doc: [
      ["M30.5 52 H12 Q9 52 9 49 V7 Q9 4 12 4 H29 L39 14 V30", 0, 0.38],
      ["M29 4 V11 Q29 14 32 14 H39", 0.16, 0.18],
      ["M15 22 H27", 0.18, 0.14],
      ["M15 29 H31", 0.22, 0.14],
      ["M15 36 H23", 0.26, 0.12],
      ["M38 33 A9 9 0 1 0 38 51 A9 9 0 1 0 38 33", 0.12, 0.3],
      ["M34 42 L37 45 L42.5 39", 0.34, 0.14],
    ],
    // Globe: outline, meridian ellipse, central meridian, equator, two parallels.
    globe: [
      ["M28 6 A22 22 0 1 1 28 50 A22 22 0 1 1 28 6", 0, 0.42],
      ["M28 6 C16 12 16 44 28 50 C40 44 40 12 28 6", 0.12, 0.32],
      ["M28 6 V50", 0.2, 0.24],
      ["M6 28 H50", 0.2, 0.24],
      ["M8.95 17 H47.05", 0.26, 0.2],
      ["M8.95 39 H47.05", 0.3, 0.2],
    ],
  };

  const TILES = [
    { icon: "us", title: "US-based", sub: "US-REGISTERED COMPANY" },
    { icon: "vial", title: "Lyophilized & sealed", sub: "SHIPPED AS POWDER" },
    { icon: "doc", title: "A COA per batch", sub: "PUBLISHED ONLINE" },
    { icon: "globe", title: "Ships to " + cfg.countries + " countries", sub: "TRACKED DELIVERY" },
  ];
  const BEATS = [22.5, 23.0, 23.5, 24.0];
  const ICON_INK_X = 2.6; // left edge of the US outline in its 56-unit box (the reference: it already aligns)

  // ------------------------------------------------------------------ headline (top y 330)
  const head = PP.headline(cam, ["No shortcuts."], "h2");
  head.el.classList.add("s7-head");

  // ------------------------------------------------------------------ tiles
  const tiles = TILES.map((def, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = X0 + col * (TW + GAP);
    const y = Y0 + row * (TH + GAP);
    const el = PP.el("div", "s7-tile", cam, { id: "s7-tile-" + (i + 1) });
    el.style.left = x + "px";
    el.style.top = y + "px";
    PP.el("div", "s7-glass", el);
    const glow = PP.el("div", "s7-glow", el);
    const flare = PP.el("div", "s7-flare", el);
    const svg = PP.svg("svg", { class: "s7-icon", width: 56, height: 56, viewBox: "0 0 56 56" }, el);
    const strokes = ICONS[def.icon].map(([d, off, dur]) => ({ path: PP.svg("path", { d }, svg), off, dur }));
    // optical alignment: every icon's ink (not its 56 px box) starts on the same x as the title's ink,
    // so the narrow vial / doc / globe don't sit 5–15 px inside the text column while the wide US map hugs it
    try {
      const inkL = Math.min(...strokes.map((s) => s.path.getBBox().x));
      if (isFinite(inkL)) svg.style.left = (32 + (ICON_INK_X - inkL)).toFixed(1) + "px";
    } catch (e) {
      /* keep the 32 px box position */
    }
    const txt = PP.el("div", "s7-txt", el);
    const title = PP.el("div", "s7-title", txt, { text: def.title });
    const sub = PP.el("div", "mono muted s7-sub", txt, { text: def.sub });
    return { el, glow, flare, strokes, title, sub, cx: x + TW / 2, cy: y + TH / 2 };
  });

  // ------------------------------------------------------------------ implosion point (unscaled screen space)
  const point = PP.el("div", "s7-point", root);
  const halo = PP.el("div", "s7-halo", point);
  const core = PP.el("div", "s7-core", point);

  // ================================================================== timeline
  PP.camera(tl, cam, CAM_T0, CAM_T1);

  // --- headline 22.00–22.40 (faster than the default text-in). Switched on one frame into the reveal so
  // the first frame after the hard cut shows no blurred word tops peeking through the mask padding.
  // Later words are likewise switched on just after their own stagger start (a waiting word's blurred top
  // would otherwise show as a smear along the mask's bottom edge).
  tl.fromTo(head.el, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 22.01);
  head.words.slice(1).forEach((w, k) => tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.005, ease: "none" }, 22.0 + 0.06 * (k + 1) + 0.01));
  PP.wordsIn(tl, head.words, 22.0, { dur: 0.34, stagger: 0.06 });

  // --- tiles pop on the beats: scale 0.94→1, y 24→0, opacity, 0.5 s expo.out; icon strokes draw over
  // ~0.4 s right behind the tile; title then sub (stagger 0.08) with a subtle fade-rise + focus.
  tiles.forEach((t, i) => {
    const T = BEATS[i];
    tl.fromTo(t.el, { scale: 0.94, y: 24, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, T);
    t.strokes.forEach((s) => {
      const at = T + 0.06 + s.off;
      // a 0 %-drawn round-capped stroke still paints a dot: keep each stroke hidden until its pen starts
      tl.fromTo(s.path, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "none" }, at);
      PP.draw(tl, s.path, at, s.dur);
    });
    tl.fromTo(
      [t.title, t.sub],
      { y: 14, opacity: 0, filter: "blur(6px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out", stagger: 0.08 },
      T + 0.14,
    );
  });

  // --- 24.00–25.50 tension: borders charge to --accent 40 % (+ soft outer glow), global grid 5 % → 10 %
  tl.fromTo(
    tiles.map((t) => t.glow),
    { opacity: 0 },
    { opacity: 1, duration: 1.5, ease: "power2.in" },
    24.0,
  );
  const grid = PP.layers && PP.layers.grid;
  if (grid) {
    tl.fromTo(grid, { opacity: 0.5 }, { opacity: 1, duration: 1.5, ease: "power2.in", immediateRender: false }, 24.0);
    tl.fromTo(grid, { opacity: 1 }, { opacity: 0.5, duration: 0.5, ease: "power2.out", immediateRender: false }, 25.5);
  }
  // gravity: the tiles are pulled a few px toward the centre as the riser builds (anticipation)
  const PULL = 7;
  const pull = tiles.map((t) => {
    const dx = PX - t.cx;
    const dy = PY_LOCAL - t.cy;
    const L = Math.hypot(dx, dy);
    return { x: (dx / L) * PULL, y: (dy / L) * PULL };
  });
  tiles.forEach((t, i) => {
    tl.fromTo(t.el, { x: 0, y: 0 }, { x: pull[i].x, y: pull[i].y, duration: 1.0, ease: "power2.in", immediateRender: false }, 24.5);
  });

  // --- 25.50–26.00 implosion: headline + tiles 1→4 (stagger 0.04) collapse into the point, all gone by
  // 25.90 so the last frames show the point alone. Travel to the point: power3.in.
  // Scale → 0.2 / opacity → 0 / blur: power2.in, so the cards shrink and dissolve into light instead of
  // arriving as solid slabs. The headline fades out as it reaches the tile row.
  const HEAD_CY = 330 + 36;
  const IMP0 = 25.5;
  const IMP_D = 0.28;
  tl.fromTo(
    head.el,
    { y: 0, scale: 1, filter: "blur(0px)" },
    { y: PY_LOCAL - HEAD_CY, scale: 0.2, filter: "blur(6px)", duration: 0.3, ease: "power3.in", immediateRender: false },
    IMP0,
  );
  tl.fromTo(head.el, { opacity: 1 }, { opacity: 0, duration: 0.24, ease: "power2.in", immediateRender: false }, IMP0);
  tiles.forEach((t, i) => {
    const at = IMP0 + 0.04 * i;
    tl.fromTo(
      t.el,
      { x: pull[i].x, y: pull[i].y },
      { x: PX - t.cx, y: PY_LOCAL - t.cy, duration: IMP_D, ease: "power3.in", immediateRender: false },
      at,
    );
    // scale / opacity / blur lead the travel slightly (power2.in) so a tile is already small and faint
    // on the last frames of its fall instead of vanishing at 45 % size between two frames
    tl.fromTo(
      t.el,
      { scale: 1, opacity: 1, filter: "blur(0px)" },
      { scale: 0.2, opacity: 0, filter: "blur(6px)", duration: IMP_D, ease: "power2.in", immediateRender: false },
      at,
    );
    // the tile turns to light as it falls in
    tl.fromTo(t.flare, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power2.in" }, at);
  });

  // --- the point: a faint seed appears as the headline starts to fall, then ignites as the tiles arrive.
  // It keeps charging through the last frames (no frozen pre-hit hold) and is fully formed on the last S7
  // frame (25.967); S8 bursts its own identical point at 26.00.
  const P_SEED0 = 25.52;
  const P_SEED1 = 25.7;
  const P_IGN0 = 25.6;
  const P_IGN1 = 25.96;
  const setPoint = (t) => {
    const seed = smooth(P_SEED0, P_SEED1, t);
    const ign = Math.pow(clamp01((t - P_IGN0) / (P_IGN1 - P_IGN0)), 2);
    if (seed <= 0.001) {
      point.style.opacity = "0";
      return;
    }
    point.style.opacity = "1";
    // core: 4 px seed → 12 px, 45 % → 100 %
    const size = 4 + 8 * ign;
    core.style.transform = `scale(${(size / 12).toFixed(4)})`;
    core.style.opacity = (0.45 * seed + 0.55 * ign).toFixed(3);
    // halo: breathes up with the ignition
    halo.style.opacity = (0.18 * seed + 0.82 * ign).toFixed(3);
    halo.style.transform = `scale(${(0.35 + 0.65 * ign).toFixed(4)})`;
  };
  PP.drive(tl, setPoint, 25.5, 26.0, 25.5, 0.5, "none");
});
