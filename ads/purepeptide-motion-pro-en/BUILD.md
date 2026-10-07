# BUILD — how a shot plugs in (P0 scaffold, "A Line of Light")

Contract: `SHOTS.md` (§0 + your section) and `BRIEF.md`. This file only says how the scaffold works. Measured facts: `TECH.md`.

## Files you own (shot `<id>` = S01…S13)

| file | rule |
|---|---|
| `html/<id>.html` | Markup fragment. `tools/assemble.py` wraps it in `<section id="<id>" class="clip scene" data-start data-duration>` (window from SHOTS §1 = `PP.WIN`). Put children in `.z-back` (z 20, behind the phone) or `.z-front` (z 40, in front), or give them your own z-index. |
| `css/<id>.css` | Every selector prefixed by `#<id>`. **Inlined** into index.html, so `url()` paths are root-relative: `url("assets/…")`, never `../`. |
| `js/shots/<id>.js` | `PP.shot("<id>", function build(tl, root) { … })`. Every tween at **absolute seconds** on the master `tl`: `PP.f(frame)`. |

After any edit: `python3 tools/assemble.py && npx hyperframes lint` (0 errors; the 13 `nested_structure_needs_subcomposition` +
1 `composition_file_too_large` warnings are expected). Never edit `index.html`.

Do **not** show/hide your `<section>`: `js/main.js` already does `tl.set(root,{opacity:0},0)`, `{opacity:1}` at IN and
`{opacity:0}` at OUT. Never tween `visibility`/`display`/`autoAlpha` on a section, and never give a section a
`z-index`/`transform`/`filter` (it would become a stacking context and break the global z-order). Anything that must
outlive your window (a hand-off: the held macro, room type that exits in the next shot) goes on a **stage-level** element
(`#type-back`, `#type-front`, `#hold-macro`, `#frost-full`, `#hold-1188`, `#leak`) that you drive from your build.

Assets that do not exist yet (3D layers, frost, holds, `cues.js`, `mix.wav`) are **left out of index.html with a WARN**;
`document.getElementById('v-take')` is `null` until the render lands — guard with `if (v)` and re-run `assemble.py` later.

## Load order and build order

`gsap, DrawSVGPlugin, CustomEase` → `js/cues.js` (`window.CUES`, if present) → `js/vo.js` (`window.VO`) → `js/lib.js` (`PP`) →
`assets/site/screen/phone-screen.js` → `js/phone.js` (`PH`) → `js/screen_tl.js` (`PP.screenTL`) → `js/shots/S01…S13.js` → `js/main.js`.
`main.js` waits for `document.fonts.load(...)` + DOMContentLoaded only (no timers, no image waits), then: `PP.buildGlobal(tl)`
(glow, grain, vignette, media gating) → `PH.init(tl, {root:'phone2d'})` → `PP.screenTL(tl)` → each shot's `build(tl, root)` in
order S01→S13. An inline script registers `window.__timelines["main"]` (45.00 s, paused). A shot that throws is logged
(`[shot Sxx] build failed`) and skipped; the rest still builds.

## Z-stack (SHOTS §0.7; everything is a direct child of `#stage`)

| z | element | what / who drives it |
|---|---|---|
| 0 | `#world` + `.glow` | `#000`; the void glow is 1 over f738–f1188, else 0 (`PP.glow`, global) |
| 10 | `#v-s01` `#v-hero` `#v-cap` `#v-turn` `#v-macro` | stage videos, `class="clip stage-v"`; main.js gates their opacity to their window (1.0/3.2 · 7.2/3.0 · 10.2/3.0 · 13.2/3.9 · 18.2/3.04). Move them with `PP.vmove/vpush` (transform only). |
| 11 | `#hold-macro` (img `assets/plates/macro_last.png`) | S06/S07: the held macro frame f637–f738 (`tl.set(opacity)` + your 2D push). Starts at opacity 0. |
| 15 | `#v-frost` (`assets/fx/frost.webm`, screen blend) · `#frost-full` (img, screen blend) | S07: frost grows 21.6/2.0; `#frost-full` held f708–f738 (starts at opacity 0) |
| 20 | `#type-back` · `.z-back` | room type behind the phone (S11) — 3 px blur |
| 30 | `#v-s02` (4.2/3.0) · `#v-take` (23.6/16.0, f708–f1188) · `#phone2d` | the 3D phone layers; the 2D rig (opacity 0 unless `PP.FALLBACK_2D`) |
| 31 | `#hold-1188` (img `assets/layers/hold_1188.png`) | S12: the STOP frame f1188–f1206 (starts at opacity 0) |
| 35 | `#leak` | additive light leak (screen blend), S08 wake f810–f820 (opacity 0 by default) |
| 40 | `#type-front` · `.z-front` | S05/S06 type, S13 end card |
| 90 / 91 | `#vignette` / `#grain` (inside `#fx`, `z-index:auto`) | vignette 22 % → 0 % at f1206; grain 2 %, reseeded every 2 f (`PP.rng(5)`), frozen f1188–f1206 (global) |
| — | `<svg id="fxdefs">` filter `#ca`, `<template id="svg-symbol|svg-wordmark">` | `PP.ca` and `PP.inlineSvg` sources |
| — | `<audio id="mix">` | `assets/audio/mix.wav`, track 40 (once it exists) |

Sections are tracks 1–13, stage videos 20–29, audio 40.

## `PP` (js/lib.js)

Constants: `PP.W/H/FPS/DUR`, `PP.F = 1/30`, `PP.f(n) = n/30`, `PP.toF(t)`, `PP.fr(t)` (snap to the frame grid), palette `PP.C.*`
(BRIEF §3.4 = css vars in `css/tokens.css`), windows `PP.WIN[id] = [f0, f1)`, `PP.IN(id)`, `PP.OUT(id)`, `PP.DROP = 738`,
`PP.STOP = [1188, 1206]`, `PP.LOGO = 1206`, `PP.grid(k)` (18 f grid from the DROP), `PP.CUES` (= `window.CUES` or the
provisional HIT1 1.0 / DROP 24.6 / STOP 39.6 / LOGO 40.2 / BEAT 0.6).

VO (always read word times, never hard-code):
- `VO.w(id, i)` word i onset (s); `VO.w(id, "prefix")` first word starting with the prefix (case/punctuation-insensitive;
  aliases `"Ninety"→"99"`, `"twenty"→"24"`, `"Janoshik"→"Janosik"`, `"dot"/"care"→".care"`). Not found → console.warn + line start.
- `VO.f(id, i)` the same as a frame. `VO.at(id)`, `VO.end(id)`.
- `PP.clamp(t, lo, hi, label)` clamps and warns. **`PP.word(shot, line, i)`** = `VO.w` clamped into the shot's window, frame-snapped.
  Lines: L01 "Pure." · L02 "It's such an easy word to print. And such a hard one to prove." · L03 "So we don't print it, we
  measure it." · L04 "Every batch. Every single one. Tested independently by Janosik Analytical." · L05 "99 % minimum." · L06
  "Shipped cold within 24 hours." · L07 "Don't take our word for it. Open the site." · L08 "Let the cart do the math. It's
  automatic." · L09 "Pure Peptide. Purity Proven." · L10 "purepeptide .care".

Determinism: `PP.rng(seed)` → `() => [0,1)`; `PP.drive(tl, setter, from, to, at, dur, ease)` (one seek-safe tween that calls
`setter(v)`; use it for per-glyph / per-frame work) or the short form `PP.drive(tl, t0, dur, fn)` (`fn(u)`, u 0..1 linear);
`PP.driveT(tl, setter(t), t0, t1)` (setter gets absolute time). No `Math.random`, `Date`, timers, rAF; `fromTo(..., {immediateRender:false})`;
no `will-change`, no `backdrop-filter`.

DOM/text: `PP.el(tag, cls, parent, attrs)`, `PP.svg(tag, attrs, parent)`, `PP.maskCss(el, css)`, `PP.glyphs(el[, text])` → per-glyph
spans (`.pp-g` inside `.pp-w` word spans; idempotent), `PP.chars(el, text)` → `.pp-c` spans, `PP.headline(parent, lines, cls)`,
`PP.masked(parent, text, cls)`, `PP.inlineSvg('symbol'|'wordmark', parent)` → `<svg>` (brand-symbol.svg viewBox 429 196 405 456 /
brand-wordmark-light.svg viewBox 327 434 611 62; size the wrapper yourself; DrawSVG-ready).

Motion recipes (all `immediateRender:false` + a `tl.set(...,0)` initial state):
- **`PP.wordIn(tl, el, t, {rise:8, stagger:1/30, dur:20/30, ease:'expo.out', overshoot:0})`** — the BRIEF §4 reveal: per glyph,
  opacity 0→1 + 8 px rise. `el` = an element (split into glyphs) or an array of targets. `overshoot: 1.04` adds the 104 % scale.
- **`PP.textOut(tl, el, t, dur = 8/30, ease = 'power3.in')`** — the exit (opacity → 0, −12 px).
- `PP.maskLine(tl, el, at, {dir:'in'|'out'})`, `PP.blurIn(tl, chars, at, o)`, `PP.typeOn(tl, chars, at, perChar)` (S13 URL: 16
  ticks over 18 f), `PP.counter`, `PP.popIn`, `PP.draw(tl, paths, at, dur, {from,to,ease,stagger})` (DrawSVG), `PP.camera`,
  `PP.rollCounter`, `PP.zoomThrough`.
- **`PP.band(tl, el, t0, dur, angle = 105, from, to, {width:220, alpha:.55, ease:'expo.inOut', axis:'x'|'y'})`** — a light band
  (screen blend) inside `el`, sweeping xPercent `from → to` (−120 → 120 crosses it fully); hidden outside the window. `axis:'y'`
  for the vertical measuring pass. Mask `el` yourself (soft luma matte of the vial) so the band never touches the frame edge.
  `PP.sweep(tl, parent, t0, t1, x0, x1, a, {angle, half})` is the PREV one-shot sweep (gradient rebuilt per frame).
- Stage videos: `PP.vmove(tl, id|el, t0, t1, {s,x,y}, {s,x,y}, ease)`, `PP.vpush(tl, id, t0, t1, ratePctPerS, s, x, y)`, `PP.feather(el, css)`.
- Brand: `PP.logo(parent, {width, dark})`, `PP.symbol(parent, h, {neon})` (`<img>`s; use `PP.inlineSvg` to draw strokes).

Finish (global, already wired by main.js — call these only to deviate inside your window): `PP.grain(tl)`,
`PP.vignette(pct[, tl, t, {dur}])`, `PP.glow(tl, 0|1, t, {dur})`, **`PP.ca(tl, t0, t1, px ≤ 2, el = '#v-take')`** — chromatic
aberration on ONE element (SVG filter `#ca`: R +dx, B −dx, screen-added; peaks at the middle of [t0, t1]). Never clone `#stage`
channels. The three allowed moments: ARR glint ±3 f (S07), dive peak f840–f846 (S09), exit f1168–f1176 (S12).

Eases: `PP.registerEases()` registers CustomEase **`"cam"`** = cubic-bezier(0.6, 0, 0.2, 1) (SHOTS §0.8 camera/phone ease) and
`"iosPush"`. Enters `expo.out`, exits `power3.in`.

Fonts (families): `"DM Sans"` 700/800, `"Inter"` 400–700, `"IBM Plex Mono"` 500; `≥` and U+202F from `"PP Symbols"`; css vars
`--display`, `--body`, `--mono`; type classes `.t-proof` (Inter 600 96), `.t-small` (Inter 600 caps 36, +0.1 em, `#C3CBD6`),
`.t-stat` (160), `.t-room` (DM Sans 800 120, −0.02 em), `.t-tag` (56), `.t-url` (Inter 500 40), `.t-legal` (Inter 500 26, `#C3CBD6`).

## `PH` — the 2D iPhone rig (js/phone.js, verbatim PREV + `PH.init(tl, {root, bake})`)

Units: **screen pt** (x 0–402, y 0–874); **page pt** (px, py) at scroll s is on screen at (px, 62 + py − s); stage px.
Geometry (full mode): `PH.SX=759.85, PH.SY=105.27, PH.K=0.99580`; bake mode: `0, 0, 1`. Captures from `PH.BASE = "assets/site/clean/"`
(never raw/). Pages: `blank` (always underneath) + `PH.PAGES = home, product, cart1, cart2, cart3` (hidden until shown; the
product page is never shown in this film). Layers in `#phone2d`: `front_shadow.png` → `#ps` screen → `front_body.png` → `front_glass.png`.

**Call PH functions in time order** (every query is a pure function of time computed from the recorded calls). The whole
screen timeline of this film is already in `js/screen_tl.js` — shots do not add screen events. API (PREV BUILD.md):
`PH.cam(tl, t0, dur, "PROD"|{g,ox,oy,cx,cy}, ease)` (presets `PH.CAMS.REST/HOME/PROD/CART/WIDE/DIVE`), `PH.camAt(t)`, `PH.stage(X, Y, t)`,
`PH.stageRect([x,y,w,h], t)`, `PH.pageStage/pageScreen(page, px, py, t)`, `PH.show(tl, t, page, s?)`, `PH.setScroll`, `PH.scroll(tl, page, s0, s1, t0, dur, ease)`,
`PH.flick`, `PH.scrollAt(page, t)`, `PH.pageAt(t)`, `PH.push(tl, t0, from, to, sTo)` (12 f iosPush), `PH.tap(tl, t, X, Y, {white})`,
`PH.press(tl, t, page, [x,y,w,h], {radius, bg})` (state changes at t + 2 f), `PH.navBadge(tl, t, srcPage, {on})`, `PH.barFill(...)`,
`PH.crop(page, rect, {parent, cls})`, `PH.sample(page, x, y)`; elements `PH.el`, `PH.ps`, `PH.layer(page)`, `PH.ov(page)`, `PH.pages[name].nav`.

## The screen timeline (`js/screen_tl.js`, `PP.screenTL(tl)`) and the bake — FACTS

`PP.SCREEN` (resolved frames, read them instead of re-deriving): `wake 803` (= VO L07 "Open") · `scrollA [812, 840]` (0 → 36
expo.out) · `tapCart 850` · `push1 [852, 864]` (home → cart1 @ 150) · `badge 866` · `tap1 888` · `state2 890` (cart2, bar 0.42 → 0.81
f890–f904) · `tap2 912` · `state3 914` (cart3, bar 0.81 → 1.00 f914–f928; the capture's own bar from f928) · `tapNav 1044` · `push2
[1050, 1062]` (= VO L09 "Pure"; cart3 → home @ 0) · `scrollB [1080, 1150]` (0 → 10 sine.inOut) · `black [708, 802]`.
Deviations from the §0.5 table, all for correctness: the badge "1" at f803 is the nav's alt layer (`PH.navBadge`, static) — a crop
in `PH.ov('home')` would sit under the re-stuck nav; the "+" rings are drawn in page space on the tapped page AND on the page
that replaces it (the row shifts 20 pt at the state change) so ring, press and button stay together (PREV S08 recipe); the
cart-icon press is a crop inside the nav layer (`navPress`); after the push home (f1050) the home nav shows cart3's badge
("3": the cart holds three vials — continuity). Nothing else touches the screen.

The bake: `node tools/bake_screen.cjs` (≈ 90 s, puppeteer on `/opt/pw-browsers/chromium`, dsf 3) → `assets/screen_seq/scr_0001..0481.png`
(1206×2622 RGB, **scr_n = frame n + 707**: scr_0001 = f708, scr_0096 = f803 the first wake frame, scr_0223 = f930, scr_0481 = f1188)
+ `seq.json` (events, timing). Frame f is rendered at t = f/30 + 0.5 ms. `--only 830,930` re-bakes single frames, `--from/--to` a range
(any tap/push change: re-bake, re-run `bake_qc`, re-render only the touched 3D range). Blender: `image.source='SEQUENCE'`,
`frame_duration 481`, `frame_start 1`, `frame_offset` so file n ↔ scene frame n + 707 (TECH §2).
QC: `python3 tools/bake_qc.py` → `renders/qc/bake/{report.json, contact.png, diff_*.png, tap_*.png, ref_*.png}`. Gates: 481 files;
f708–f802 max level ≤ 1; f830 vs `render_screens.cjs home@35.58`, f930 vs `clean/screen_cart.png`, f1080 vs `clean/screen_home.png`,
f1107 vs `home@3.24` — mean < 2 levels (badge box masked); tap rings centred ± 3 pt; OCR every 10th + every event frame vs the
forbidden list. The scroll at f830 is 35.58 pt (the §0.4 "≈ 20" is approximate), at f1107 it is 3.24 pt (the alive scroll).

The 2D fallback: `PP.FALLBACK_2D = true` in `js/main.js` shows `#phone2d` (REST pose, identity transform, same screen pixels) over
`PP.FALLBACK_WIN = [738, 936]`; the dive then becomes `PH.cam(tl, PP.f(822), PP.f(46), 'DIVE', 'cam')` in S09 (accepted downgrade).

## Snapshot one shot

```
python3 tools/assemble.py
tools/snap.sh /tmp/s08 f738,f803,f815,27.3            # seconds or fNNN; only the frames you need (4 shared CPUs)
ZOOM='760,105,400,870' tools/snap.sh /tmp/s08z f815   # 3x crop of a stage region
```
`tools/snap.sh <out> <times> [project-dir]`: a scratch project (symlinks to `assets css html js node_modules hyperframes.json`
+ its own `index.html` from `python3 tools/assemble.py --out /scratch/x/index.html --extra-js test/t.js`) lets you snapshot
temporary tests without touching the shipped index. `hyperframes snapshot` shows **video frame n + 1** (TECH §6): subtract one
frame when checking a webm/mp4 layer, or QC a video cut from a render. Never run a full render or Blender unless your task says so.

## QC tools

- `npx hyperframes lint` → 0 errors (14 warnings expected). `npx hyperframes check` flags `text_occluded` on the iOS chrome under
  the glass: false positive.
- `node tools/check_text.js [--from 0 --to 45 --step 0.5] [--json out.json]` — HTML text ≥ 24 px rendered, contrast ≥ 4.5:1 (measured
  on the frame's pixels), title-safe x 96–1824 / y 54–1026. Exempt: `#phone2d` subtree and `[data-qc-skip]`. Text with opacity
  < 0.9 or a blur is a warning. `QC_DEBUG=1` prints every node.
- `tools/qc_frames.sh [out] [24.6] [38.4] [0.25]` — snapshots + contact sheet (read it by eye) + tesseract OCR that fails on the
  forbidden words. `QC_REUSE=1` re-reads existing frames.
- `python3 tools/bake_qc.py` — the screen bake gate (above).
- `tools/verify_output.sh [renders/purepeptide-motion-pro-en.mp4]` — 1920×1080, 30 fps, 1350 frames, 45.00 s, −14 ±1 LUFS, TP ≤ −1.5 dBTP.
