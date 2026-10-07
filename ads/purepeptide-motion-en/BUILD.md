# BUILD — how scenes plug in (P0-C scaffold)

Contract: `SCENES.md` (§0 + your section) and `BRIEF.md`. This file only says how the scaffold works.

## Files you own (scene `<id>` = S01…S11)

| file | rule |
|---|---|
| `html/<id>.html` | Markup fragment. `tools/assemble.py` wraps it in `<section id="<id>" class="clip scene" data-start data-duration>` (window from SCENES §0.9). Put children in `.z-back` (z 20, behind the phone) or `.z-front` (z 40, in front), or give them your own z-index. |
| `css/<id>.css` | Every selector prefixed by `#<id>`. **Inlined** into index.html, so `url()` paths are root-relative: `url("assets/…")`, never `../`. |
| `js/scenes/<id>.js` | `PP.scene("<id>", function build(tl, root) { … })`. Every tween at **absolute seconds** on the master `tl`. |

After any edit: `python3 tools/assemble.py && npx hyperframes lint` (must stay at 0 errors). Never edit `index.html`.

Do **not** show/hide your `<section>`: `js/main.js` already does `tl.set(root,{opacity:0},0)`, `{opacity:1}` at IN and
`{opacity:0}` at OUT. Never tween `visibility`/`display`/`autoAlpha` on a section, and never give a section a
`z-index`/`transform`/`filter` (it would become a stacking context and break the global z-order).

## Load order and build order

`gsap, DrawSVGPlugin, CustomEase` → `js/cues.js` (`window.CUES`, frozen) → `js/vo.js` (`window.VO`, generated) →
`js/lib.js` (`PP`) → `assets/site/screen/phone-screen.js` → `js/phone.js` (`PH`) → `js/scenes/S01…S11.js` → `js/main.js`.
`main.js` waits for `document.fonts.load(...)` + DOMContentLoaded only, then: `PP.buildGlobal(tl)` → `PH.init(tl)` → each
scene's `build(tl, root)` in order S01→S11. An inline script registers `window.__timelines["main"]` (45.00 s, paused).
A scene that throws is logged (`[scene Sxx] build failed`) and skipped; the rest still builds.

## Z-order (SCENES §0.8)

| layer | z | notes |
|---|---|---|
| `#world` (`.w-ink`, `.w-paper`, `.w-navy`) | 0 | Global hard switches: INK at 0, **PAPER at f532**, **NAVY at f1086** (`PP.world`). A scene that crossfades uses its own overlay layer. |
| stage videos `v-typevial` 10 · `v-hero` 11 · `v-turn` 11 · `v-cold` 12 · `v-flyin` 30 | 10–12, 30 | Direct children of `#stage`, `class="clip stage-v"`; main.js gates their opacity to their window. Move them with `PP.vmove/vpush` (transform only). Overlays above a video: your own element with a higher z. |
| scene type behind the phone | 20 | `.z-back` |
| `#phone` rig | 30 | opacity 1 on **f750–f1085** only (global) |
| scene type in front | 40 | `.z-front` |
| S09 `#dive` / `#pill` | 50 / 55 | |
| `#vignette` / `#grain` (inside `#fx`) | 90 / 91 | grain overlay 7/5/6 % per world, reseeded every 2 f, frozen f1215–f1230; vignette on INK + NAVY only |

`#fx` has `z-index:auto` on purpose: an isolated group would cut the grain's overlay blend off from the picture.

Stage videos whose file does not exist yet (`assets/plates/typevial.mp4`, `assets/iphone/flyin_land.webm`) are **left out**
of index.html with a WARN; re-run `assemble.py` when they land. `getElementById('v-flyin')` is `null` until then.

## `PP` (js/lib.js)

Constants: `PP.W=1920, PP.H=1080, PP.F=1/30, PP.f(n)=n/30, PP.toF(t)`, palette `PP.C.*` (BRIEF §2, same as css vars in
`css/tokens.css`), windows `PP.WIN[id]=[f0,f1]`, `PP.IN(id)`, `PP.OUT(id)`, music `CUES.HIT1/HIT9/ACC13/RISER0/DROP/STOP/LOGO/BEAT`.

VO (always read word times, never hard-code):
- `VO.w(id, i)` word i onset; `VO.w(id, "prefix")` first word starting with the prefix (case/punctuation-insensitive).
  Spoken-form aliases because the transcript writes digits: `"Ninety"→"99"`, `"Five"→"5"`, `"EIGHT"→"8%"`, `"ten"→"10"`,
  `"twenty"→"24"`, `"Janoshik"→"Janosik"`, `"dot"/"care"→".care"`. Not found → console.warn + line start.
- `VO.at(id)`, `VO.end(id)`. `PP.clamp(t, lo, hi, label)` clamps into your window and warns when it fires.

Determinism: `PP.rng(seed)` → `() => [0,1)`; `PP.drive(tl, setter, from, to, at, dur, ease)` (one seek-safe tween that
calls `setter(v)`; use it for per-glyph / per-frame work); `PP.driveT(tl, setter(t), t0, t1)` (setter gets absolute time).

DOM/text: `PP.el(tag, cls, parent, attrs)`, `PP.svg(tag, attrs, parent)`, `PP.maskCss(el, css)`,
`PP.headline(parent, lines, cls)` → `{el, lines, words}` (`*word*` → class `acc`), `PP.masked(parent, text, cls)` → inner
line inside `.pp-mask`, `PP.chars(el, text)` → char spans.

Motion recipes (all `immediateRender:false` + a `tl.set(...,0)` initial state where needed):
- `PP.maskLine(tl, el, at, {dir:'in'|'out', dur, ease, stagger, set})` — in: yPercent 110→0, 12 f power4.out; out: 0→−110, 8 f power3.in.
- `PP.blurIn(tl, chars, at, {dur, ease, stagger, set})` — yPercent 35→0, blur 10→0, opacity 0→1, 12 f expo.out, stagger 2 f.
- `PP.wordIn(tl, word, at, o)`, `PP.wordsIn(tl, words, at, o)`, `PP.voHeadline(tl, parent, lineId, lines, cls, {lead, clamp:[lo,hi]})`,
  `PP.textOut(tl, targets, at, o)`, `PP.typeOn`, `PP.counter(tl, el, {from,to,at,dur,format})`, `PP.popIn` (back.out(0.8)),
  `PP.draw(tl, paths, at, dur, {from,to,ease,stagger,immediate})` (DrawSVG), `PP.camera(tl, wrap, t0, t1, amount)`.
- `PP.rollCounter(tl, parent, "24", at, land, {stagger, ease})`, `PP.typedWordmark(tl, parent, width, at, {perLetter, dark})`,
  `PP.flashRing(tl, parent, at, {x,y,size,target})`, `PP.zoomThrough(tl, el, x, y, at, {amount, dur, ease})`.
- Brand: `PP.logo(parent,{width,dark})`, `PP.symbol(parent, h, {plain})`, `PP.vial(parent, name, h)` (`PP.VIALS` = the six
  catalog PNGs in `assets/vials/`), `PP.checkIcon(parent, size, color, {circle:false})` — **✓ must be SVG** (U+2713 is in
  no font). U+2212 "−" is in DM Sans and Inter; "≥" and U+202F come from `PP Symbols`.
- Ported from film.js: `PP.vmove(tl, id|el, t0, t1, {s,x,y}, {s,x,y}, ease)`, `PP.vpush(tl, id, t0, t1, ratePctPerS, s, x, y)`,
  `PP.feather(el, css)`, `PP.sweep(tl, parent, t0, t1, x0%, x1%, alpha, {angle:105, half:14})`, `PP.world(tl, 'ink'|'paper'|'navy', t)`, `PP.grain(tl)` (global).

Fonts (families): `"DM Sans"` 700/800, `"Inter"` 400–700, `"IBM Plex Mono"` 500, `"Anton"` 400, `"Archivo"` 800/900,
`"Inter Tight"` 300; css vars `--display`, `--body`, `--mono`.

## `PH` — the iPhone rig (js/phone.js, SCENES §0.4)

Units: **screen pt** (x 0–402, y 0–874); **page pt** (px, py) at scroll s is on screen at (px, 62 + py − s); stage px.
Geometry: `PH.SX=759.85, PH.SY=105.27, PH.K=0.99580`; captures from `PH.BASE = "assets/site/clean/"` (never raw/).
Pages: `blank` (always visible underneath) + `PH.PAGES = home, product, cart1, cart2, cart3` (hidden until shown).
Layers in `#phone`: `front_shadow.png` → `#ps` screen → `front_body.png` → `front_glass.png` (normal blend; the
`front_glass_screen.png` variant paints opaque black inside the transformed `#phone` group, so it is not used).

**Call PH functions in time order** (scenes build S06→S09 in order; inside a scene add them chronologically). Every
query is a pure function of time computed from the recorded calls, so it is safe inside `PP.drive` setters.

| call | what |
|---|---|
| `PH.cam(tl, t0, dur, "PROD" \| {g, ox, oy, cx, cy}, ease)` | tween g/tx/ty from the state at t0 to: screen (ox,oy) at stage (cx,cy), scale g. Presets `PH.CAMS.REST/HOME/PROD/CART/WIDE/DIVE`. The rig starts at REST (identity). Segments must not overlap (warns). |
| `PH.camAt(t)` → `{g, tx, ty}` · `PH.camState(o)` | camera state at t / for a preset |
| `PH.stage(X, Y, t)` → `{x, y, g, s}` | stage point of screen point at t (`s = g·K` = stage px per pt) |
| `PH.stageRect([x,y,w,h], t)` → `{x,y,w,h}` | stage rect of a screen-pt rect |
| `PH.pageStage(page, px, py, t)` · `PH.pageScreen(page, px, py, t)` | page pt → stage / screen, using that page's scroll at t |
| `PH.show(tl, t, page, s?)` | hard cut to `page` (others hidden), optional scroll |
| `PH.setScroll(tl, page, s, t)` · `PH.scroll(tl, page, s0, s1, t0, dur, ease='power2.inOut')` | scroll (sticky nav re-sticks at s ≥ 46) |
| `PH.flick(tl, page, s0, s1, t0)` → end time | 8 f power2.in to 20 %, then 14 f expo.out (22 f), blur min(2, 0.04·Δs/f) pt on `.ps-img` |
| `PH.scrollAt(page, t)` · `PH.pageAt(t)` | scroll / page on screen at t |
| `PH.push(tl, t0, from, to, sTo)` → end time | Safari push, 12 f `iosPush` = cubic-bezier(.32,.72,0,1): incoming x 402→0 pt + left shadow, outgoing 0→−120 pt, dim 0→20 %, then hidden |
| `PH.tap(tl, t, X, Y, {white})` | ring only (no finger), screen pt; scale 0.4→1, opacity 0.6→0, 12 f power2.out; `white:true` on navy buttons |
| `PH.press(tl, t, page, [x,y,w,h], {radius, bg, sampleAt:[x,y]})` | page-pt crop scales 0.97 (3 f power2.out) then back (6 f back.out(0.8)); a rounded patch in the sampled surround colour hides the edges. Pass `radius` (pt) = the control's corner radius (25 for the 50 pt pill buttons). **State changes at t + 2 f.** |
| `PH.navBadge(tl, t, srcPage, {on})` | the nav of the page on screen at t (or `on`) shows srcPage's nav (badge), pop 1→1.3→1 over 8 f on a 24×24 pt crop around the badge, page pt (329,70) (nav band 46–117; stuck on screen at y 86) |
| `PH.barFill(tl, t0, dur, page, f0, f1, c0, c1, {ease:'power3.out', until, track})` → `{el, fill}` | HTML ship bar over the captured one; rect `PH.BAR` (page x 37.33–364.67, y 295–303, r 4, track **#EEF2F7 measured on the captures**, SCENES says #E6EBF2: pass `track` to override). Measured fractions `PH.BAR.frac = {cart1: .4196, cart2: .8106, cart3: 1}`. Visible from t0 to `until`. |
| `PH.crop(page, [x,y,w,h], {parent, cls})` → div | w×h pt div showing that page-pt rect of the capture (FLIP sources). Scale it yourself (stage size = w·`PH.stage(...).s`). |
| `PH.sample(page, x, y)` | pixel colour of a capture (null until decoded) |

Elements: `PH.el` (#phone), `PH.ps` (#ps screen root, 402×874 pt), `PH.layer(page)`, `PH.ov(page)` (page-pt overlay
container that scrolls with the page: put wipes/rolls/crops here), `PH.url` (`.ps-url` pill, hide it for S09's clone),
`PH.safari`, `PH.status`. S07's bloom: mask `PH.layer('home')` with `PP.maskCss` driven by `PP.drive`.

## Snapshot one scene

```
python3 tools/assemble.py
tools/snap.sh /tmp/s07 f750,f764,f780,f796,26.9          # seconds or fNNN; only the frames you need (4 shared CPUs)
ZOOM='1100,400,500,400' tools/snap.sh /tmp/s07z f826     # 3x crop of a stage region
```
`tools/snap.sh <out> <times> [project-dir]`: a scratch project (symlinks to `assets css html js node_modules
hyperframes.json` + its own `index.html` from `python3 tools/assemble.py --out /scratch/x/index.html --extra-js test/t.js`)
lets you snapshot temporary tests without touching the shipped index (that is how the rig was proven).
Never run a full render or Blender unless your task says so.

## QC tools

- `npx hyperframes lint` → 0 errors (11 `nested_structure_needs_subcomposition` warnings are expected). `npx hyperframes check`
  flags `text_occluded` on the iOS chrome under the glass layer: false positive.
- `node tools/check_text.js [--from 0 --to 45 --step 0.5] [--json out.json]` — ad text ≥ 24 px rendered, contrast ≥ 4.5:1
  (measured on the frame's pixels), title-safe x 96–1824 / y 54–1026. Exempt: `#phone` subtree and `[data-qc-skip]`.
  Text with opacity < 0.9 or a blur is a warning. `QC_DEBUG=1` prints every node.
- `tools/qc_frames.sh [out] [22] [37] [0.25]` — snapshots + contact sheet (read it by eye) + tesseract OCR that fails on
  the BRIEF §10 forbidden words. `QC_REUSE=1` re-reads existing frames.
- `tools/verify_output.sh [renders/purepeptide-motion-en.mp4]` — 1920×1080, 30 fps, 1350 frames, 45.00 s, −14 ±1 LUFS, TP ≤ −1 dBTP.
