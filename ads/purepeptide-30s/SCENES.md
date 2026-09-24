# Scene build contract

The ad is ONE HyperFrames composition (`index.html`, id `main`, 1080×1920, 30 fps, 30 s) driven by
ONE paused GSAP timeline. Every tween is placed at **absolute seconds** (the brief's times).
Read `BRIEF.md` for the creative spec; this file is the technical contract.

## Files and ownership

| Scene file            | CSS file      | Section `#id` | Section window (s) | Brief scenes |
| --------------------- | ------------- | ------------- | ------------------ | ------------ |
| `js/scenes/s12.js`    | `css/s12.css` | `#s12`        | 0.00 – 6.00        | S1 + S2      |
| `js/scenes/s3.js`     | `css/s3.css`  | `#s3`         | 5.60 – 10.00       | S3           |
| `js/scenes/s4.js`     | `css/s4.css`  | `#s4`         | 9.50 – 12.00       | S4           |
| `js/scenes/s5.js`     | `css/s5.css`  | `#s5`         | 12.00 – 16.00      | S5           |
| `js/scenes/s6.js`     | `css/s6.css`  | `#s6`         | 15.50 – 22.00      | S6           |
| `js/scenes/s7.js`     | `css/s7.css`  | `#s7`         | 22.00 – 26.00      | S7           |
| `js/scenes/s8.js`     | `css/s8.css`  | `#s8`         | 26.00 – 30.00      | S8           |

- Edit **only** your own scene file and CSS file. Never edit `index.html`, `js/lib.js`, `js/global.js`,
  `js/config.js` or another scene. If you need a helper, write it locally in your scene file.
- Scope every CSS rule under your section id (`#s3 .card { … }`).
- Prefix any element `id` you create with your section id (`s3-counter`).
- A section is only visible inside its window (HyperFrames clip lifecycle). Earlier sections are stacked
  **above** later ones (`#s12` z 17 … `#s8` z 11), so an outgoing scene covers the incoming one.

## Scene module shape

```js
PP.scene("s3", function (tl, root, cam) {
  // root = <section id="s3">, cam = <div class="cam"> (pre-created direct child of root,
  // absolute inset 0, transform-origin 540px 960px). Build DOM with PP.el / PP.svg, add tweens to tl.
  PP.camera(tl, cam, 6.0, 10.0); // brief: push-in 1.00 -> 1.04 over the nominal scene duration
});
```

You may wrap `cam` (e.g. `const whip = PP.el("div", "whip", root); whip.appendChild(cam);`) or add
siblings outside it. Things that must hand off pixel-exactly across a cut (match-cut line, implosion point)
must live **outside `cam`** (unscaled screen coordinates) — or you must compensate for the cam scale.

The build runs once, after fonts load, before the timeline is registered. DOM geometry (getBBox,
getBoundingClientRect, getTotalLength) is available during the build.

## Library (`js/lib.js`, global `PP`)

| Helper | What it does |
| --- | --- |
| `PP.cfg` | all brief variables: `coaProduct, amount, batch, purity (number), lab, testDate, mExp, mObs, coaUrl, countries, endCta, catalog[6], logoUrl, vialUrls[]` |
| `PP.C` | colour tokens (`bg, panel, line, text, muted, accent, paper, ink`); CSS vars `--bg … --ink` also exist |
| `PP.el(tag, cls, parent, attrs)` / `PP.svg(tag, attrs, parent)` | element factories (`attrs.text`, `attrs.style` supported) |
| `PP.rng(seed)` | seeded PRNG → `() => [0,1)` (Math.random is forbidden) |
| `PP.headline(parent, lines, cls)` | `cls` = `h1`/`h2`/`h3`/`tagline`; `lines` = array of strings, `*word*` = --accent. Returns `{el, lines, words}`; lines are overflow-hidden masks |
| `PP.wordsIn(tl, words, at, o?)` | brief text-in (mask reveal, 0.55 s expo.out, stagger 0.06, blur 10→0) |
| `PP.textOut(tl, targets, at, o?)` | brief text-out (yPercent 0→-40, opacity→0, 0.25 s power2.in) |
| `PP.chars(el, text)` + `PP.typeOn(tl, chars, at, perChar=0.025)` | type-on |
| `PP.counter(tl, el, {from, to, at, dur, decimals=1, ease='power3.out', format?})` | seek-safe counter |
| `PP.drive(tl, setter, from, to, at, dur, ease)` | seek-safe generic value driver (use for anything that must write text/attributes per frame) |
| `PP.popIn(tl, targets, at, o?)` | scale 0.9→1 + opacity, back.out(1.6), 0.3 s |
| `PP.draw(tl, paths, at, dur, o?)` | DrawSVG stroke draw (power2.inOut default) |
| `PP.camera(tl, cam, start, end)` | push-in 1.00→1.04 linear |
| `PP.scanLine(parent, 'h'|'v', len)` | 2 px --accent line + 24 px glow (absolute; you position it) |
| `PP.checkIcon(parent, size, color?)` | `{svg, circle, tick}` 44-unit viewBox; draw with `PP.draw` |
| `PP.logo(parent, {width}|{height})` | image logo or wordmark fallback; returns `{el, dot, fontSize, width, height, isImage}` (`.pp-wordmark` has letter-spacing -0.03em) |
| `PP.qr(parent, text, size)` | real scannable QR SVG (ink on paper, 2-module quiet zone) |
| `PP.vial(parent, {height, product?, amount?, batch?, hero?})` | SVG vial (viewBox 300×712; `PP.VIAL_VB`). Returns `{el, svg, sweep, sweepRect, label, cake, scale, height, width}`. `el` is `position:absolute`, sized `width×height`: you set `left/top`. `sweepRect` is a skewed band (viewBox units) clipped to the vial: animate `attr:{x}` from about -200 to 360 and `sweep` opacity. `svg`/`sweepRect` are `null` when a real render image is used — guard for that. |
| `PP.vialReflection(parent, {height, product?, fade=220, opacity=0.15})` | mirrored copy fading out; returns `{el, vial}`; place its top at the floor line |
| `PP.layers.grid / glow / bloom` | global layers (see below) |

Vial geometry (viewBox units, y from top of the 712-unit box): flip-off 6–34, cap 34–118, neck 116–150,
shoulders 150–202, body to 710; label 252–577 (centre ≈ 414); cake top ≈ 609 → bottom 706 (centre ≈ 658).
Screen y = vialTop + unit × scale, scale = height / 712.

## Global layers (owned by `js/global.js`, do not re-create)

- `#bg`, the hairline grid (`PP.layers.grid`, base opacity 0.5 = 5 % lines, drifting up 20 px over 30 s),
  the radial `--accent` glow (moves to each scene's hero automatically), film grain (4 %, overlay,
  per-frame seed) and the vignette (above all scenes).
- The S2→S3 light bloom (5.60→6.00→6.50, peak 35 %) is global — S2/S3 do **not** add another.
- Only S7 may touch `PP.layers.grid` (brighten opacity 0.5→1.0 during 24.00–25.50) and it must return it
  to 0.5 by 26.00.

## Conventions

- Positions: the brief's explicit coordinates win. A bare `y` = top edge of the element box
  (line-height 1.0). "centered on y" / "baseline y" / "centered (x,y)" are literal. Unspecified positions:
  multiples of 8 px. All text and logos stay inside x 120→960, y 260→1400.
- Type: only the classes/tokens in `index.html` (`.pp-h .h1/.h2/.h3/.tagline`, `.mono`, `.acc`, `.muted`,
  `.tnum`). Nothing below 20 px except the vial label art. Headlines exactly as written in the brief
  (use the typographic apostrophe ’ in "What’s" and "don’t").
- Copy: only the copy in the brief. No extra words, no numbers other than the variables, no invented
  claims. Banned words: results, benefits, heal, treatment, dose, cycle.
- Motion: brief motion language only; `ease: "none"` only for camera drifts / constant drifts.
  Max 2 moving focal points per frame. Every held element keeps a micro-drift (the camera push-in counts).
- --accent covers ≤ ~10 % of any frame.

## Determinism rules (renders are split across parallel workers that seek to arbitrary frames)

- No `Math.random`, `Date`, `performance.now`, timers, `requestAnimationFrame`, network, or GSAP
  callbacks (`onUpdate`, `onComplete`, `call`) for visual state. Use `PP.drive` / `PP.counter` instead.
- Every property animated more than once on the same element: first tween `fromTo`, later tweens
  `fromTo(..., { immediateRender: false })` with explicit from-values equal to the previous end-values.
- No `repeat: -1`; compute finite repeats (`Math.floor`).
- Never tween `visibility`, `display` or `autoAlpha` on the `<section>` itself; animate children / `cam`.
- Transformed elements must be block-level and sized.
- SVG filters with `stdDeviation` animated: use `PP.drive` to write the attribute.

## Cross-scene hand-offs (contracts — honour them exactly)

1. **S1 → S2 (both in s12).** Rack focus lands the hero vial at S2's exact position/size at 2.50.
2. **S2 → S3 zoom-through.** s12: 5.60–6.00 vial group (vial, reflection, floor, callouts) scales 1→2.6
   from the label centre, blur 0→14 px, opacity→0 (power2.in); logo + headline B text-out at 5.60.
   s3: content hidden until 5.75, then enters from scale 1.12 + blur 12 px → 1 / 0 (5.75–6.25, expo.out)
   on an inner wrapper (the S3 camera push-in 6.00→10.00 runs on `cam`).
3. **S3 → S4 scan wipe.** s4's static layout (card panel + border, footer line) is visible from 9.50
   (its section starts then; headline/bars/labels animate from 10.00). s3: 9.50–10.00 a vertical scan
   line sweeps x 0→1080 (power2.inOut) and S3's content is clipped away behind it
   (`clip-path: inset(0 0 0 X px)`), revealing S4. S4 camera push-in 10.00→12.00.
4. **S4 → S5 match cut.** s4: 11.55–12.00 bars collapse edges→centre into one horizontal 2 px --accent line
   (with the scan-line glow) that rises to **y 560** and spans **x 160→920** at 12.00 (unscaled screen
   coordinates). s4's headline/labels text-out at 11.55. s5: at 12.00 the same line (2 px, x 160→920,
   y 560) is on screen and the certificate unrolls downward from it (12.00–12.60); the line then melts into
   the card's top edge (fade by ~12.60).
5. **S5 → S6 whip pan.** s5: 15.50–16.00 wrapper translateX 0→-1080 (`expo.inOut`) + horizontal blur
   `stdDeviation "0 0" → "18 0"` over 15.50–15.75 (power2.in), held to 16.00. s6: section starts 15.50;
   wrapper translateX 1080→0 (`expo.inOut`, 15.50–16.00) + blur `"18 0"` held to 15.75 then → `"0 0"` by
   16.00 (power2.out). BPC-157 is the active product when S6 lands. S5 camera 12→16, S6 camera 16→22.
6. **S6 → S7.** s6: 21.60–22.00 dip (brightness 1→0.35, group scale 1→0.92). Hard cut at 22.00.
7. **S7 → S8 implosion.** s7: 25.50–26.00 tiles + headline collapse to centre into one bright 12 px point
   (white core, --accent glow) at **(540, 880)** unscaled screen coordinates, fully formed at 26.00.
   s8: at 26.00 its own 12 px point at (540, 880) bursts into a radial bloom (80 %→0 in 0.5 s).

## Verify your work

```bash
tools/snap.sh /tmp/claude-0/snaps-s3 6.2,7.4,8.9,9.75   # PNG frames at exact times → Read them
npx hyperframes lint                                     # must stay at 0 errors
```

`snap.sh` adds 0.5 ms to each time, so `14.3` captures exactly frame 429 (the CLI floors t×30).

Headline reveals: gate each word's opacity (0→1 over 0.12 s from its own stagger start) on top of
`PP.wordsIn`, otherwise words still parked at yPercent 100 show a blurred sliver in the mask padding.

Look at the PNGs yourself and compare them against BRIEF.md: layout coordinates, safe zone, type sizes,
colours, the state at each listed time. Iterate until it matches and looks premium.
