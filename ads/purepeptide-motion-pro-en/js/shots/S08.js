// S08 · "Open the site" — the slow show, the wake, the thaw · f738–f822 (24.60–27.40) · 3D: the take (#v-take, stage-level z 30,
// assets/layers/take.webm = renders/3d/take/final/0708–1188 with frost, thaw and soft-clip baked by tools/post_layers.py; media
// f708–f1188, data-start 23.6). The picture of this shot is in that layer (SHOTS §S08, all verified on the shipped frames):
//   phone   REST held f738–f750 (exact identity: corners.json f738–f750 = screen_rect ± 0.01 px, the 2D fallback cut stays valid),
//           then drift spin 0 → 1.5°, loc x 0 → +2 mm over f750–f822 sine.inOut (pose_speed.json: 0.56° at f780, 1.18° at f800,
//           1.47° at f815, 1.50° at f822) — never static; the display's left edge walks 759.8 → 772.4 px.
//   light   slow_show(750, 786): rims only at the landing, Key/Fill 0 → 100 %; thermometer(803, 839): the key goes warm from the wake.
//   screen  the baked SEQUENCE (scr_n = f − 707): black to f802; f803 = VO.w('L07', 6) "Open" (PP.SCREEN.wake): home @ 0 fades in over
//           12 f with a 2 → 0 px blur, the cart badge "1" on the nav (cart1's nav band); momentum scroll 0 → 36 f812–f840 expo.out
//           (seq.json scrollA; 35.58 pt at f830: below the 46 pt re-stick, the nav never re-sticks); no other screen event here.
//   frost   thaw f803–f821: a radial mask from the display centre, radius 0 → 520 px bez(0.6, 0, 0.2, 1), clears the screen first
//           (f806: the page lit, the rails still frosted), the rails by f813, the corners by f821 (post_layers.py, S07's recipe).
// What THIS file adds (the shot's one 2D element, BRIEF §3.5 / §S08): the wake's additive light leak on the stage-level #leak (z 35,
// mix-blend-mode: screen; opacity 0 by css/tokens.css until this setter): 10 f, f810–f820, peak f815 = the wake + 12 f = the frame
// the page reaches full brightness (the 12 f fade ends f815), peak opacity 0.18. The plate (assets/fx/leak.png, written by
// assets/fx/make_leak.py) is the lit page blooming in the lens AROUND the phone: a warm halo following the phone's own silhouette
// (exp(−d/110) + 0.4·exp(−d/360) of the ANAMORPHIC distance d outside the f815 silhouette — vertical distances count 1.35×, so the
// bloom spreads sideways like the streak and spills less onto the top/bottom frame edges 90 px above and below the phone — +22 %
// toward the key's up-left; INSIDE the silhouette the halo holds its edge value for 24 px before falling off as exp(−(d_in−24)/18),
// so the plate's drift/scale below never opens a seam between the rail and the bloom) and a horizontal anamorphic streak through
// the screen centre (σ 30 / 110 px in y, 420 px in x, faded to 0 over the outer 160 px of the frame: it never meets a frame edge;
// a flare off the page, not a horizon), hot core (1.00, 0.88, 0.72) → amber fringe (1.00, 0.62, 0.40). Its wrapper carries the
// feathered INVERSE phone mask (assets/fx/leak_mask.png: the f815 silhouette dilated 3 px, feathered 5 px; ≈ 0.3 on the
// silhouette's own edge pixels, 0.8 at 8 px out, 1.0 by 12 px out, 0.000 on every site pixel — the display sits ≥ 15 px inside the
// silhouette), so the halo is brightest AT the rail (polish: the first build's 8 px / 12 px mask left a 30 px dark matte line
// between the rail and the glow — the plate × mask peaked 30–40 px out; now it peaks by 12 px) and the leak never lands on the
// rails (QC: a 92 % rim pixel can only reach 92.4 % at the peak — worst case 0.049 leak × screen blend on a silhouette edge pixel,
// 0.027 on the rail proper) nor on the site pixels (§3.5: no colour change on the site; the mask is exactly 0 inside matte_screen).
// The silhouette drifts < 1 px across f810–f820 (corners 771.5 → 772.4): one mask.
// Envelope: opacity 0.18 · sin(π·u)^1.25 over u = (f − 810) / 10 (f811 0.23 · f812 0.52 · f813 0.77 · f814 0.94 · f815 1.00 · f816
// 0.94 … f819 0.23 · f820 0: a new value every frame, nothing holds); the plate drifts (+10 px, −5 px) and scales 1.000 → 1.035 about
// the phone's centre (971, 540) across the 10 f, linear, while the mask stays on the phone. ONE setter (PP.drive) for all of it.
// Measured on the f815 snapshot (luma, y 540): the void right of the rail reads 28 / 38 / 45 / 46 at 4 / 8 / 12 / 16 px out and
// 44–46 to 60 px (the first build: 22 / 27 / 32 / 36 rising to 45 only at 28 px = the matte line); the halo adds ≤ +35 levels on the
// void at its peak, 0 on the rim highlights, 0 on the page (mask 0.000 inside matte_screen); above the phone the spill at the top
// frame edge is 21 levels (was 24).
// Hand-offs (§0.9): f738 from S07 — continuous, same take (REST exactly, frost field black by f738; the void glow switches on at
// f738 globally, main.js); f822 to S09 — continuous, the dive starts f822 from the drifted REST pose (= VO "site." f819 + 3 f,
// checked below against the actual word time). This section ends up EMPTY on the stage (the leak lives in #leak): nothing else
// of S08 touches the DOM, nothing outlives the window (the leak is 0 again by f820).
// Sound (BRIEF §7; 2D moves stated here): SLOW SHOW f750 → f786 (sub_bed, 3D) · WAKE f803 (screen_wake; thaw frost reversed f803 →
// f821, 3D/post) · SCROLL ticks f812 → f840 (the bake) · the LEAK's fastest 2D frame is f812 (the envelope's steepest rise, 0.23 →
// 0.52 → 0.77) and its peak f815: it has no sound of its own — it rides the wake's light_sweep tail. No other 2D sound frames.
PP.shot("S08", function build(tl, root) {
  const F = PP.F, f = PP.f;
  const T0 = PP.IN("S08"), T1 = PP.OUT("S08");
  const q = (s) => root.querySelector(s);

  const v = document.getElementById("v-take");
  if (!v) console.warn("[S08] #v-take missing: the take layer is not in index.html yet (re-run tools/assemble.py once assets/layers/take.webm lands)");

  // ---- word locks (read from VO, never hard-coded; clamped into the window) ------------------------------------------------
  const tOpen = PP.word("S08", "L07", "Open", "S08 L07 Open"); // the wake, f803
  const tSite = PP.word("S08", "L07", "site", "S08 L07 site."); // f819: the dive begins at site + 3 f = f822 = S09 IN
  const fOpen = PP.toF(tOpen), fSite = PP.toF(tSite);
  // the wake is baked (screen SEQUENCE + the thaw + the thermometer all start on PP.SCREEN.wake, resolved from the same VO word)
  const fWake = PP.SCREEN && PP.SCREEN.wake != null ? PP.SCREEN.wake : 803;
  if (fWake !== fOpen) console.warn(`[S08] VO "Open" reads f${fOpen} but the screen timeline woke at f${fWake}: the bake / take 803–822 need re-doing`);
  if (fWake !== 803) console.warn(`[S08] the wake moved to f${fWake}: assets/layers/take.webm was rendered for f803 (re-bake + re-render 803–822)`);
  if (fSite + 3 !== PP.WIN.S09[0]) console.warn(`[S08] the dive (S09 IN f${PP.WIN.S09[0]}) is no longer VO "site." + 3 f (f${fSite + 3})`);
  if (fOpen < 738 + 36) console.warn(`[S08] the dark slow show is shorter than 36 f before the wake (f${fOpen})`);

  // ---- the leak: f810–f820, peak f815 (= wake + 7 / + 17 / + 12 f), opacity 0 → 0.18 → 0; ONE setter ------------------------
  const wrap = q(".s08-leak");
  const plate = wrap && wrap.querySelector(".s08-leak-plate");
  if (!wrap || !plate) return console.warn("[S08] .s08-leak markup missing (html/S08.html): no light leak at the wake");
  const host = document.getElementById("leak");
  if (host) host.appendChild(wrap); // stage-level z 35, screen blend (css/tokens.css); the section itself is empty from here on
  else console.warn("[S08] no stage-level #leak: the leak stays inside the section as its own z 35 screen-blend layer");
  const target = host || wrap; // whose opacity is the envelope (#leak and the fallback wrapper are both opacity 0 by CSS)
  const fL0 = Math.max(738, fWake + 7), fL1 = Math.min(822, fWake + 17); // 810 / 820
  if (fL1 - fL0 !== 10) console.warn(`[S08] leak window f${fL0}–f${fL1} is not 10 f (clamped into the shot)`);
  const PEAK = 0.18, DX = 10, DY = -5, DS = 0.035;
  tl.set(target, { opacity: 0 }, 0);
  let lastTf = null;
  const leak = (u) => {
    const a = u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 1.25); // peak at u = 0.5 = f815
    target.style.opacity = (PEAK * a).toFixed(4);
    const tf = `translate(${(DX * u).toFixed(2)}px, ${(DY * u).toFixed(2)}px) scale(${(1 + DS * u).toFixed(4)})`;
    if (tf !== lastTf) {
      plate.style.transform = tf;
      lastTf = tf;
    }
  };
  PP.drive(tl, leak, 0, 1, f(fL0), f(fL1 - fL0), "none");
  void T0; void T1; void F;
});
