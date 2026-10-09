# PurePeptide "A LINE OF LIGHT" — SHOTS: build contract (45.000 s · 1920×1080 · 30 fps · 1350 frames)

Build contract for parallel builders. Idea, look, type, VO table, music, SFX, compliance and budget live in `BRIEF.md` (read it first);
measured facts in `TECH.md`; the phone model in `assets/iphone/PHONE.md`; the site captures in `assets/site/SITE.md` and
`assets/site/clean/meta.json`. Each shot below can be built by one agent alone provided it respects its **frame window**, its **hand-off
frames** and the **shared rigs** (`blender/common.py`, `js/lib.js`, `js/phone.js`, the screen bake). f = frame (T × 30); all tweens are
placed at absolute seconds `PP.f(f)`. Word-locked events read `VO.w(line, i)` at build time and are clamped into the shot window.

`ROOT = /home/user/DevDoctor/ads/purepeptide-motion-pro-en` · `PREV = /home/user/DevDoctor/ads/purepeptide-motion-en` ·
`FILM = /home/user/DevDoctor/ads/purepeptide-film-en` · `PY = /home/user/DevDoctor/ads/purepeptide-blender/.venv/bin/python` (Blender 5.0.1 as a module,
numpy 1.26; one Blender process at a time, 4 CPUs shared).

---

## 0. Global setup (P0, the lead builds this first; everything else waits for §0.9 stubs)

### 0.1 Project layout

```
ROOT/
  BRIEF.md  SHOTS.md  TECH.md  README.md (delivery notes, written last)
  index.html                       composition (assembled by tools/assemble.py from html/*.html, css/*.css, the media table §0.5)
  html/<id>.html  css/<id>.css     per-shot fragments (selectors prefixed #<id>)
  js/lib.js                        PP helpers (copied from PREV/js/lib.js, adapted §0.6)
  js/phone.js                      the 2D phone rig, copied VERBATIM from PREV/js/phone.js (screen author + fallback)
  js/vo.js  js/cues.js             voice (exists, generated) · music cues (written after the music is measured, then FROZEN)
  js/screen_tl.js                  the screen timeline (taps, pushes, scrolls) shared by the bake and the 2D fallback
  js/shots/<id>.js                 one file per shot: PP.shot('<id>', (tl, root) => {...})
  js/main.js                       builds window.__timelines.main (paused, 45.0 s), calls every shot in order
  screen/bake.html                 the bake page: a 402×874 pt stage at deviceScaleFactor 3 (= 1206×2622) running phone-screen.js + phone.js + screen_tl.js
  blender/common.py                phone import, studio, poses, eases, lights by name, DOF, screen texture/SEQUENCE, slabs, passes, corners JSON, render helpers
  blender/s01_droplet.py           own scene (no phone): bench, ink, drop, lights, camera path → renders/3d/s01/
  blender/s02_glass.py             phone + PureReflect plane → renders/3d/s02/
  blender/take.py                  ONE scene for f708–f1188: --range a-b, --pass beauty|shadow → renders/3d/take/
  blender/tests/s02_reflect.py     3 × 720p test frames (f126/f150/f180)   blender/tests/s01_timing.py  3 frames at 32 spp
  blender/queue.json               the render queue (jobs, in order)
  tools/render_queue.py            runs queue.json sequentially (lock file), logs s/frame, calls post_layers + encode_layers
  tools/post_layers.py             numpy per-frame post: frost inside alpha, shadow × matte_screen, soft-clip → renders/3d/<shot>/final/
  tools/encode_layers.sh           PNG → VP9-alpha webm (assets/layers/) + ProRes 4444 (renders/prores/) + opaque H.264 for S01
  tools/bake_screen.cjs            481 screen PNGs (f708–f1188) from screen/bake.html → assets/screen_seq/scr_0001..0481.png
  tools/make_frost_seq.py          DLA frost: assets/fx/frost/frost_0001..0060.png (+ frost_full.png) + frost_density.json → frost.webm
  tools/text_png.cjs               "pure" DM Sans 800 → assets/type/pure_4k.png (+ pure_4k_mirror.png)
  tools/render_screens.cjs         copied from PREV (6× slab crops: --dsf 6)
  tools/mix_audio.py  tools/audiolib.py  tools/build_vo.py   audio (audiolib + build_vo exist; mix_audio adapted from PREV)
  tools/assemble.py  tools/check_text.js  tools/qc_frames.sh  tools/snap.sh  tools/verify_output.sh
  assets/iphone/  assets/site/clean/  assets/plates/ai/{hero,turn,cap,macro}.mp4  assets/plates/macro_last.png
  assets/fx/{grain0-7.png, frost/, frost.webm}  assets/type/  assets/layers/{s01.mp4, s02.webm, take.webm}  assets/screen_seq/
  assets/audio/{vo/, vo_v4/, music_raw.mp3 (generated), mix.wav}
  renders/3d/<shot>/{beauty,matte_screen,matte_cards,matte_phone,shadow,final}/####.png, corners.json, pose_speed.json, log.json
  renders/prores/*.mov   renders/qc/   renders/purepeptide-motion-pro-en.mp4
```
Copy first: `cp FILM/assets/plates/ai/{cap,macro}.mp4 ROOT/assets/plates/ai/`; `cp PREV/assets/fx/grain*.png ROOT/assets/fx/`;
`cp PREV/js/{phone.js,lib.js} ROOT/js/`; `cp PREV/tools/{render_screens.cjs,assemble.py,mix_audio.py} ROOT/tools/`;
`ffmpeg -sseof -0.05 -i assets/plates/ai/macro.mp4 -frames:v 1 assets/plates/macro_last.png`.

### 0.2 `blender/common.py` (imports `assets/iphone/tools/render_iphone.py` as `R`; nothing in `assets/iphone/` is modified)

| Function | Contract |
|---|---|
| `load()` | `R.load()` → `(scene, root)`; then: Standard view, exposure 0, OIDN Accurate/Balanced, adaptive 0.02 / min 8, bounces as built, `film_transparent=True`, persistent data, `use_motion_blur=True`, shutter 0.5 (Center on Frame), fps 30, `frame_start/end` per `--range`. |
| `pose(root, f, spin, tilt, roll, loc)` | keys `root.location` + `rotation_quaternion` (`R.compose(spin, tilt, roll)`, mode QUATERNION) at frame f, linear interpolation (the ease is baked into the per-frame values: **every frame of a move is keyed**). |
| `bez(t)` / `ease_bez(t, x1=.6, y1=0, x2=.2, y2=1)` | CSS cubic-bezier evaluated by bisection; `lerp_pose(P0, P1, e)` on (spin, tilt, roll, loc) with slerp-free linear angles (all moves < 90° except the exit, which goes through compose() per frame). |
| `move(root, f0, f1, P0, P1, ease=bez)` | keys every frame f0..f1; writes the pose derivative to `pose_speed.json` (deg/s of the rotation, m/s of loc) so the mixer can find the fastest frame. |
| `drift(root, f0, f1, P, dspin, dloc)` | sine.inOut micro-move (never static). |
| `arr_pose(n)` | the retimed fly-in: `t = 2n/42` for n ≤ 11 else `(n+12)/42`; `R.pose('flyin', t)` with `R.FLY0` replaced by **ARR0 = (200, 12, 9, (0.26, 0.08, 0.03))** (monkey-patch `R.FLY0` before calling); n = f − 708, n = 0..30, n = 30 → REST exactly. |
| `light(name)`, `energy_key(name, f, W)`, `color_key(name, f, rgb)` | area lights by name (`Key Fill Back EdgeL EdgeR`). |
| `softbox_peak_key(name, f, v)` | the multiply node feeding Emission Strength in `M_<name>` (`SoftL SoftR SoftFR SoftTop SideL SideR`); `softtop_x_key(f, x)` keys `SoftTop.location.x` (its track-to-target stays). |
| `thermometer(f0, f1)` | cold → warm key colours (BRIEF §3.1) over f0..f1. |
| `slow_show(f0, f1)` | `Key` and `Fill` energy 0 → 6.0 / 2.0 W over f0..f1 (ease), everything else untouched. |
| `lights_out(f0, f1)` | `Key Fill Back` → 0 W, `SoftL SoftR SoftFR SoftTop SideL` peaks → 0, `SideR` → 50 %, `EdgeR` kept, over f0..f1. |
| `screen(path)` / `screen_seq(dir, count, offset)` | `R.set_screen` / `image.source='SEQUENCE'`, `frame_duration=count`, `frame_start=1`, `frame_offset=offset`, `use_auto_refresh=True` (TECH §2; file n ↔ scene frame n + offset). |
| `screen_emission_key(f, strength)` | the `Screen` material's Emission Strength. |
| `dof(scene, root)` → `focus` Empty parented to `iPhone`; `dof_key(f, on, fstop, focus_mm)` | `use_dof` constant keys; `aperture_fstop`, `aperture_blades=6`, `aperture_rotation=12°`; focus Empty local y = −(4.3 + focus_mm) mm (in front of the display). |
| `reflect_plane(png, E, loc, rot)` | S02: 0.30 m wide plane, emission × image (alpha → Transparent mix), `visible_camera/diffuse/shadow=False`, glossy only. |
| `slab(name, capture, rect_pt, radius_pt, screen_pt_centre)` | TECH §3 recipe (`tools/tests/cards_passes.py` `make_card`) parented to `iPhone`; local x = (sx−201)·0.1657 mm, local z = (437−sy)·0.1657 mm, local y = −4.3 mm (on the display); `pass_index=2`; 6× crop texture from `render_screens.cjs --dsf 6`. `slab_key(ob, f, lift_mm, scale)` keys local y = −(4.3 + lift) mm and uniform scale. |
| `shadow_setup(scene)` | the shadow-catcher scene state (TECH §3): `Screen.is_shadow_catcher`, phone parts + studio hidden, cards non-emissive, 0.12 m area key at (−0.25, −0.45, 0.35) 40 W, white diffuse stand-in; `--pct 50`. |
| `passes(scene, outdir)` | File Output: `beauty` RGBA, `matte_phone/cards/screen` (ID Mask on pass_index 1/2/3, AA), `Z` EXR; Blender 5 API per TECH §4. |
| `corners(scene, f)` | 4 display corners px at 1080p + CSS matrix3d (from `tools/tests/homography.py`) → appended to `corners.json`. |
| `render(scene, root, frames, pct, samples, border, outdir)` | per frame: `R.set_border` when `border` (margin 0.015), `R.render_to`; logs s/frame to `log.json`; skips frames already on disk unless `--force`. |

CLI for every shot script: `--range a-b` (absolute film frames) `--pct N` `--samples N` `--no-denoise` `--pass beauty|shadow` `--force`
`--exec "python"`. Exit non-zero if another Blender holds `renders/3d/.lock`.

### 0.3 `tools/render_queue.py` and `blender/queue.json`

`queue.json` = ordered list of `{id, script, range, pct, samples, pass, est_sf}`. The queue runs them one at a time (lock file), writes
`renders/3d/<id>/log.json` (measured s/frame, wall time), stops on the first failure, then runs `tools/post_layers.py <id>` and
`tools/encode_layers.sh <id>`. Flags: `--only id[,id]`, `--range a-b` (override), `--pct`, `--samples`, `--dry` (prints the estimate from
`est_sf × frames`), `--resume` (skip rendered frames), `--preview` (= `--pct 50 --samples 6 --no-denoise`, outputs under `renders/3d/<id>_prev/`).
Default queue order: `s02_test` → `s01_test` → `take` previews → `s02` → `take` ranges (708-738, 937-1044, 1045-1152, 823-936, 739-822, 1153-1188)
→ `take_shadow` (945-1044) → `s01`.

Encodes (`tools/encode_layers.sh <id>`, from `renders/3d/<id>/final/`):
`ffmpeg -framerate 30 -start_number N -i %04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -row-mt 1 -auto-alt-ref 0 assets/layers/<id>.webm`
and `-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 -qscale:v 9 renders/prores/<id>.mov`. S01 is opaque:
`-c:v libx264 -crf 14 -pix_fmt yuv420p assets/layers/s01.mp4`. Read a webm back with `-c:v libvpx-vp9` before `-i` to check alpha.

### 0.4 The screen bake (`tools/bake_screen.cjs`, `screen/bake.html`, `js/screen_tl.js`)

- `screen/bake.html` is a 402×874 pt page (deviceScaleFactor 3 → 1206×2622 px), black background, holding the `.ps` root from
  `assets/site/screen/phone-screen.{css,js}` at `left:0; top:0; transform:none` (no `border-radius`, the bezel clips in 3D), loading
  `js/vo.js`, `js/lib.js`, `js/phone.js` (with `PH.init` in **bake mode**: `PH.SX=0, PH.SY=0, PH.K=1`, no body/glass/shadow layers), and
  `js/screen_tl.js`, which builds the screen timeline into a paused GSAP timeline `window.__timelines.screen` (absolute seconds, §0.5 events).
- `tools/bake_screen.cjs` (puppeteer from `node_modules`, chrome-headless-shell): loads the page, waits for fonts and images, then for f in
  708..1188: `tl.seek(f/30, false)`, screenshot the `.ps` element → `assets/screen_seq/scr_%04d.png` with number **f − 707** (scr_0001 =
  f708). ≈ 3 min. Frames f708–f802 are pure black (`PH` shows nothing: the rig's `.ps` background is `#000`).
- QC (mandatory): `python3 tools/bake_qc.py` diffs `scr_0123` (f830, home @ ≈ 20) against `render_screens.cjs home:home:20`, `scr_0223`
  (f930, cart3 @150, bar 1.0, no ring) against `assets/site/clean/screen_cart.png` (expect mean < 2 levels), and `scr_0400` (f1107, home @0)
  against `clean/screen_home.png`. Also OCR the whole sequence every 10 frames with the forbidden list (`qc_frames.sh` regex).
- The same `js/screen_tl.js` drives the 2D fallback rig in `index.html` (hidden by default: `#phone2d` opacity 0) so a fallback is one flag.

### 0.5 The screen timeline (`js/screen_tl.js`; coordinates in screen pt; page pt (px,py) at scroll s → screen (px, 62 + py − s))

| f | Event | Call (phone.js API) |
|---|---|---|
| 708–802 | black (screen off) | nothing shown |
| 803–814 | home @ 0 fades in with 2 px → 0 blur (the wake) | `PH.show(tl, PP.f(803), 'home', 0)`; opacity 0→1 + filter blur 2→0 over 12 f `expo.out` on `.ps` |
| 803 | badge "1" on the home nav (one vial already in the cart) | `PH.ov('home')` gets `PH.crop('cart1', {x:321, y:62, w:16, h:16})` at page (321,62) — the cart1 nav badge, page space |
| 812–840 | momentum scroll 0 → 36 (stays below the 46 re-stick) | `PH.scroll(tl, 'home', 0, 36, PP.f(812), PP.f(28), 'expo.out')` |
| 850 | tap the cart icon (page centre 319, 81 → screen (319, 107) at s 36) | `PH.tap(tl, PP.f(850), 319, 107)`; `PH.press(tl, PP.f(850), 'home', {x:298,y:60,w:42,h:42})` |
| 852–864 | Safari push home → cart1 @ 150 | `PH.push(tl, PP.f(852), 'home', 'cart1', 150)` |
| 866 | badge pop (stays "1") | `PH.navBadge(tl, PP.f(866), 'cart1')` |
| 888 | "+" tap #1 (cart1 "+" page (211,495,30,30) → centre screen (226, 422)) | `PH.tap(tl, PP.f(888), 226, 422)`; `PH.press(tl, PP.f(888), 'cart1', {x:211,y:495,w:30,h:30})` |
| 890 | state → cart2 @ 150 (tap + 2 f) | `PH.show(tl, PP.f(890), 'cart2', 150)`; `PH.barFill(tl, PP.f(890), PP.f(14), 'cart2', 0.4207, 0.811, '#16A48F', '#16A48F')` |
| 912 | "+" tap #2 (cart2 "+" page (211,515) → screen (226, 442)) | `PH.tap(tl, PP.f(912), 226, 442)`; `PH.press(tl, PP.f(912), 'cart2', {x:211,y:515,w:30,h:30})` |
| 914 | state → cart3 @ 150 | `PH.show(tl, PP.f(914), 'cart3', 150)`; `PH.barFill(tl, PP.f(914), PP.f(14), 'cart3', 0.811, 1.0, '#16A48F', '#2BB58A')` |
| 914–1044 | cart3 @ 150 holds (= `clean/screen_cart.png` from f930 on) | — |
| 1044 | tap the wordmark in the stuck nav (page (57,74,148,15) → screen (57, 90); centre (131, 98)) | `PH.tap(tl, PP.f(1044), 131, 98)` |
| 1050–1062 | Safari push cart3 → home @ 0 | `PH.push(tl, PP.f(1050), 'cart3', 'home', 0)` |
| 1062–1188 | home @ 0 holds; scroll 0 → 10 over f1080–f1150 (alive) | `PH.scroll(tl, 'home', 0, 10, PP.f(1080), PP.f(70), 'sine.inOut')` |

Nothing else ever touches the screen. The product page is never shown. Bar fractions are the measured ones from `clean/meta.json`
(`ship_bar.fill_frac`), the bar rect is page (37, 295, 328, 8).

### 0.6 `js/lib.js` additions (on top of PREV)

`PP.f(n) = n/30`; `PP.shot(id, build)` (registers; `main.js` calls `build(tl, root)` in order); `PP.clamp(t, lo, hi, label)` (warns);
`PP.rng(seed)`, `PP.drive(tl, t0, dur, fn)` (one setter per heavy animation), `PP.glyphs(el)`, `PP.wordIn(tl, el, t, {rise:8, stagger:1/30, dur:20/30, ease:'expo.out'})`,
`PP.textOut(tl, el, t, 8/30, 'power3.in')`, `PP.band(tl, el, t0, dur, angle, from, to)` (a 105° light band, screen blend, xPercent sweep),
`PP.grain(tl)` (reseed every 2 f via `PP.rng(5)`, frozen f1188–f1206), `PP.vignette(pct)`, `PP.ca(tl, t0, t1, px)` (three cloned
channel layers of `#stage` content are NOT allowed — CA is applied only to the phone webm layer with two offset copies in `mix-blend-mode: screen`).
Determinism: no `Math.random`, `Date`, timers, rAF; `fromTo(..., {immediateRender:false})`; no `will-change`, no `backdrop-filter`.

### 0.7 Composition (`index.html`, assembled; z bottom → top)

| z | id | Content | data-start / duration / media-start |
|---|---|---|---|
| 0 | `#world` | `#000` + `.glow` (radial glow, opacity 0 outside f738–f1188) | — |
| 10 | `#v-s01` | `assets/layers/s01.mp4` (opaque, black for f0–f30 inside the file) | 1.0 / 3.2 / 0 (file starts at f30) |
| 10 | `#v-hero` | `assets/plates/ai/hero.mp4` | 7.2 / 3.0 / 0 |
| 10 | `#v-cap` | `assets/plates/ai/cap.mp4` | 10.2 / 3.0 / 0 |
| 10 | `#v-turn` | `assets/plates/ai/turn.mp4` | 13.2 / 3.9 / 0 |
| 10 | `#v-macro` | `assets/plates/ai/macro.mp4` | 18.2 / 3.04 / 0 |
| 11 | `#S06 .hold` | `assets/plates/macro_last.png` (held, pushed) | shown f637–f738 |
| 15 | `#v-frost` | `assets/fx/frost.webm` (VP9 alpha, `mix-blend-mode: screen`) + `.frost-full` img | 21.6 / 2.0 / 0, img f708–f738 |
| 20 | `#type-back` | room type behind the phone (S11) | — |
| 30 | `#v-s02` | `assets/layers/s02.webm` | 4.2 / 3.0 / 0 |
| 30 | `#v-take` | `assets/layers/take.webm` (f708–f1188, frost/shadow/soft-clip baked) | 23.6 / 16.0 / 0 |
| 30 | `#phone2d` | the 2D rig (fallback only, opacity 0) | — |
| 35 | `#leak` | additive light leak (S08 wake) | f810–f820 |
| 40 | `#type-front` | S05/S06 type, S13 end card | — |
| 50 | `#fx` | vignette + grain | — |
| — | `<audio id="mix">` | `assets/audio/mix.wav` | 0 / 45 |

One `<section class="clip scene" id="Sxx">` per shot with `data-start`/`data-duration` from the table in §1 (track-index 1–13), stage videos
on tracks 20–29, audio track 40. `npx hyperframes lint` 0 errors; `npx hyperframes check`.

### 0.8 Conventions (binding)

- Eases: camera/phone moves `cubic-bezier(0.6, 0, 0.2, 1)` (handles ≈ 40 % of the move); enters `expo.out`; exits `power3.in`; overshoot
  ≤ 104 %; anticipation 2–4 f on landings; follow-through 4–8 f on slabs.
- Rhythm: cuts on the 18 f grid (multiples of 18) unless VO-locked; every text state ≥ 36 f; one idea per shot; nothing is ever static
  in 3D (a drift ≥ 0.5°/s or 1 cm/s).
- Type: HTML only (except the printed "pure"); ≥ 24 px, ≥ 4.5:1, inside x 96–1824 / y 54–1026; per-glyph in, 8 f out; depth-sorted
  behind the phone where the shot says so (z 20) with a 3 px blur.
- Sound: every move writes its fastest frame to `pose_speed.json` (3D) or a comment in the shot file (2D); the mixer aligns whoosh peaks
  to it ±1 f; risers end on the hit frame; STOP/OPEN/END windows are gated silence.
- Compliance: screens only from `assets/site/clean/`; the forbidden-word OCR gate; no people/hands/syringes; offers glimpsed only.

### 0.9 Hand-off (transition) contract — what the last frame of each shot hands to the next

| Cut f | From → To | Type | Match contract |
|---|---|---|---|
| 126 | S01 → S02 | cut on the grid, light-led | the droplet's highlight point (stage ≈ (1040, 520), measured on the S01 preview) is where S02's right rim line (`SideR`) sits at f126 (tune S02 loc x, default −0.02 m); both frames cold key, black beyond |
| 216 | S02 → S03 | light band carries the cut | `SoftTop` band peaks on the glass at f216 (3D); the same 105° 2D band enters the vial plate at f216 and finishes crossing at f234 |
| 306 | S03 → S04 | push-in continuity | S03 scale 1.00 → 1.22 `expo.in` f298–f306; S04 scale 1.15 → 1.00 `expo.out` f306–f314 |
| 396 | S04 → S05 | whip-tilt down | S04 y 0 → −140 px + 3 f directional blur out; S05 y +90 → 0 with 3 f blur in |
| 522–546 | S05 → S06 | breath (black) | plate crushed by f522; type alone to f536; black f544–f546; S06 fades up from f546 |
| 636–648 | S06 → S07 | continuous | the macro's held frame stays; type exits f636–f644; frost starts f648 |
| 738 | S07 → S08 | continuous (same take) | phone at REST exactly on f738 (ARR t = 1.0); frost field black by f738 |
| 822 | S08 → S09 | continuous | dive starts f822 from the drifted REST pose (drift ≤ 1.5° / 2 mm) |
| 936 | S09 → S10 | continuous | tilt starts from the close pose creep (spin 4.5°) |
| 1044 | S10 → S11 | continuous | slabs seated (lift 0, scale 1.0) by f1044; nav tap f1044 |
| 1152 | S11 → S12 | continuous | hero drift pose at f1152; room type exited f1152–f1160 |
| 1188 | S12 → STOP | freeze | f1188 is the held frame (`<img>` of the take's f1188 or the webm paused: use the PNG `assets/layers/hold_1188.png`) |
| 1206 | STOP → S13 | LOGO | the vertical line (held frame) collapses to a point over 6 f, the symbol draws from it |

---

## 1. Shot list

Shot windows (`data-start`/`data-duration` in s): S01 0–4.2 · S02 4.2–7.2 · S03 7.2–10.2 · S04 10.2–13.2 · S05 13.2–18.2 · S06 18.2–21.2 ·
S07 21.2–24.6 · S08 24.6–27.4 · S09 27.4–31.2 · S10 31.2–34.8 · S11 34.8–38.4 · S12 38.4–40.2 · S13 40.2–45.0.

Poses used by the take (spin°, tilt°, roll°, loc m), evaluated by `common.move()`:
`REST (0, 0, 0, (0, 0, 0))` · `ARR0 (200, 12, 9, (0.26, 0.08, 0.03))` · `CLOSE (4, −3, −1, (0.000, −0.288, 0.006))` ·
`CARDS (14, −5, −2, (0.012, −0.253, 0.004))` · `HERO (26, −14, −4, (0.012, 0.110, 0.010))` (TILT1 rotation, farther) ·
`EDGE (90, 0, 0, (0.000, 0.084, 0.000))`. Camera distance = 0.760 − loc.y.

### S01 · "A droplet of light" · f0–f126 (0.00–4.20) · **3D (own scene), opaque**

- **Scene (`blender/s01_droplet.py`, no phone):** 0.6 m bench of black brushed steel at z = 0 (BRIEF §3.3), the word **pure**
  (`assets/type/pure_4k.png` from `tools/text_png.cjs`: DM Sans 800 lowercase, 4096 px wide, alpha) as colour mask (ink material) and
  0.08 mm displacement, 52 mm wide, centred on the origin, reading along +X. A 7 mm water drop (sphere cut 0.4 mm above the plane, 0.2 mm
  meniscus fillet, Glass IOR 1.333, roughness 0) on the "u" (x ≈ −6 mm). World black.
- **Lights:** rim strip 0.20 × 2.00 m at (0.25, 0.25, 0.12) aimed at the drop, 18 W (3× key), cold (0.86, 0.92, 1.0), energy 0 → 18 W over
  f30–f33 (HIT1); top strip 0.10 × 1.50 m at (x, 0.00, 0.30), x keyed −0.30 → +0.30 over f36–f72 (ease), 8 W; key 0.90 × 0.60 m at
  (−0.45, −0.30, 0.40), 6 W cold (0.90, 0.94, 1.0), energy 0 → 6 W over f89–f117 (VO "easy" → "print"); two 0.05 m bulb spots 0.1 W at
  (0.08, −0.05, 0.15) and (−0.10, 0.04, 0.12). All `visible_camera=False`.
- **Camera:** 100 mm, sensor 36, f/2.8 (7 blades, rotation 12°), 28° down, aimed at the drop; distance 0.32 → 0.26 m over f30–f126
  (ease 0.6/0/0.2/1), roll 0 → +2.5°. Focus Empty on the drop's front surface f30–f96, **rack to the "p" of pure f96–f117** (ease in-out),
  hold to f126. Shutter 0.5.
- **What moves:** f0–f30 black (rim at 0 W; these frames are not rendered: the mp4 begins at f30 with 3 black frames). f30 the drop lights
  (HIT1). f36–f72 the focused highlight travels through the drop (a droplet of light) and along the brush. f89–f117 the key fades up:
  the brushed texture and the print emerge as the voice says "easy word to print"; the rack lands on the print on "print" (f117).
- **Site:** none. **Text:** the printed "pure" in the scene (white ink on dark steel ≈ 12:1, ≈ 140 px tall at f117). No HTML type.
- **Transition out (f126):** cut on the grid (VO breath "and"); the highlight → rim-line match (§0.9).
- **Sound:** OPEN silence 0–1.0 · HIT1 f30 · SWEEP1 peak f54 · RACK f114–f118 · CUT1 f126 (BRIEF §7).
- **Render:** `--range 30-126` (97 f), full frame, 32 spp + OIDN, transmission bounces 8, caustics off, Standard view, film opaque (black
  world), RGB PNG → `assets/layers/s01.mp4` (H.264 crf 14) + ProRes. Timing test first (`blender/tests/s01_timing.py`: f54, f90, f117 at
  32 spp); if > 36 s/f → 24 spp; still > 36 → `--range 42-126` and the black hold grows to 1.4 s. Estimate 30 s/f ≈ **49 min**.
- **QC:** drop reads as water (refraction of the "u", a single bright point, no plastic sheen); brush anisotropy visible; no clipping
  above 92 % except the highlight point; f117 print sharp (Laplacian variance peak at f117 ± 1); f126 highlight position logged for S02.

### S02 · "Printed on glass" · f126–f216 (4.20–7.20) · **3D (phone, alpha)**

- **Scene (`blender/s02_glass.py`):** the phone at y +0.084 (0.844 m → 75 % frame height), screen = pure black 1206×2622 PNG
  (`assets/type/screen_off.png`, generated), cold key. The `PureReflect` plane (`common.reflect_plane`, `assets/type/pure_4k_mirror.png`,
  E = 6 default) placed front-left of the phone at about (−0.35, −0.30, 0.10) m, rotated to face the glass, so that **the only "pure" in
  the shot is its reflection in the cover glass**: ghost ≈ 40 % white at f150, left of centre, drifting right at 2× the spin.
- **Motion (phone only; camera and lights fixed):** spin −22 → +6, tilt −8 → −3, roll −3 → +1.5, loc x −0.02 → +0.01: drift f126–f150
  (≈ 3°), one eased move f150–f186 (the rest), drift to f216. Tune the plane position / the move so the ghost **leaves the right edge of the
  glass at f180 ± 2** (VO "prove."). From f180 to f216: black glass, one rim line (`SideR`), the sheen; nothing printed.
- **Light:** `SoftTop` x −0.30 → +0.30 over f192–f216 (`softtop_x_key`): the band crosses the black glass and peaks on the cut frame f216.
- **Site:** none. **Text:** none (the reflection only).
- **Transition out (f216):** the light band carries the cut into S03 (§0.9).
- **Sound:** PRINT/PROVE f117 (S01) / f180 · SWEEP2 peak f216 · music pad.
- **Render:** `--range 126-216` (90 f), full frame (phone 75 %: border crop still helps, keep `border=True`), DOF f/4 focus on the glass
  centre, 24 spp + OIDN, Standard, alpha. ≈ 15 s/f ≈ **23 min**. **First job of the whole build:** `blender/tests/s02_reflect.py` renders
  f126/f150/f180 at 720p (≈ 2 min): check ghost peak 35–45 % sRGB on the glass, single (no 2.5D-edge doubling), gone from the glass at f180.
- **Fallback (zero Cycles):** 2D ghost: `pure_4k_mirror.png` as an HTML layer under the per-frame `matte_screen` of this shot (export the
  matte pass), Fresnel-shaped opacity ramp, slide driven by `corners.json` (`matrix3d`) at 2× the parallax; second fallback: the C-style
  crane-to-sliver of the printed "pure" on the S01 held last frame.
- **QC:** ghost readable but ≤ 45 %; leaves at f180 ± 2; metal highlights ≤ 92 % except the rim line; f126 rim line at the logged
  S01 highlight x ± 40 px; alpha clean (no fringe) in the webm (`-c:v libvpx-vp9` decode, alpha 0–255).

### S03 · "We measure it" · f216–f306 (7.20–10.20) · **AI plate `hero.mp4`** (media 0 → 3.0, 1:1)

- **What moves:** the plate's own slow push-in on black. f216–f234 the 2D light band from S02 finishes crossing the vial (`PP.band`,
  105°, 220 px, `mix-blend-mode: screen`, masked by a soft luma matte of the vial, xPercent −120 → 120). **MEASURE:** a second pass,
  vertical, cap → base over f266–f278 (`expo.inOut`), its centre on the label at **f272 = VO.w('L03', 6)**; a 12 px SVG
  `feDisplacementMap` shimmer (amplitude 6 px) on the glass only while it passes.
- **Text:** none. **Site:** none.
- **Transition out:** push-in continuity (§0.9).
- **Sound:** MEASURE f266→f278 peak f272 · CUT2 f306.
- **Render:** HyperFrames only. **QC:** plate black ≤ 2 levels in the corners (histogram); band never touches the frame edges with a hard
  line; the vertical pass centre within ±1 f of `VO.w('L03',6)`.

### S04 · "Every batch" · f306–f396 (10.20–13.20) · **AI plate `cap.mp4`** (media 0 → 3.0)

- **What moves:** the plate (crimp and cap macro). Two quick horizontal light passes (6 f each, `PP.band`) over the sealed cap on
  **f336 = VO.w('L04',0)** and **f357 = VO.w('L04',2)**: every batch, every single one, measured. 1 %/s 2D push.
- **Text:** none (no "Every batch." type — the light says it). **Site:** none.
- **Transition out (f396 = VO.w('L04',4) "one."):** whip-tilt down (§0.9).
- **Sound:** EVERY ×2 f336/f357 · WHIP f396.
- **Render:** HyperFrames only. **QC:** passes land on the VO words ±1 f; the whip's blur is directional (CSS `filter: blur` on a
  stretched clone is not allowed; use a 3-frame SVG `feConvolveMatrix` motion kernel or three offset copies at 33 %).

### S05 · "Independently tested" · f396–f546 (13.20–18.20) · **AI plate `turn.mp4`** (media 0 → 3.9) + type

- **What moves:** the vial turns slowly on black. f512–f522 the plate crushes to black (brightness curve `power2.in`, no fade of the type).
  f522–f546 black (the breath).
- **Text (z 40, left of the vial, x 160–760):** *Independently tested.* Inter 600 96 px white 90 %, lands **f410 = VO.w('L04',5)** per glyph
  (20 f, 1 f stagger); beneath it on **f475 = VO.w('L04',8)** the small line *JANOSHIK ANALYTICAL* Inter 600 caps 36 px tracking +0.10 em
  `#C3CBD6`. Both hold alone on black f522–f536 (the words outlive the object), exit f536–f544 `power3.in`.
- **Site:** none.
- **Transition out:** the breath (§0.9); music thinned to pad.
- **Sound:** TESTED f410 · ACC f475 · BREATH f522–f546 (`reverse_swell` ending on f552).
- **Render:** HyperFrames only. **QC:** `check_text.js --from 13.6 --to 18.2 --step 0.25` (96 / 36 px, ≥ 12:1, title-safe); the type never
  overlaps the vial's silhouette (vial centre-right); plate black ≤ 2 levels.

### S06 · "99 %" · f546–f636 (18.20–21.20) · **AI plate `macro.mp4`** (media 0 → 3.04, ends f637) + held frame

- **What moves:** dark reveal f546–f558 (opacity 0 → 1, blur 6 → 0 px) under the type; the plate's label macro drift. From f637 the held
  last frame (`#S06 .hold`, `assets/plates/macro_last.png`) continues with a 2D push 1.00 → 1.04 to f738 (`sine.inOut`), so the frost in
  S07 grows over a slowly moving image.
- **Text (z 40, left third):** **99%** Inter 600 160 px cap white 90 %, lands **f552 = VO.w('L05',0)** character by character (2 f apart,
  18 f `expo.out`, 104 % overshoot); small line *HPLC PURITY, MINIMUM* Inter 600 caps 36 px `#C3CBD6` on **f588 = VO.w('L05',2)** (the
  whisper; it sinks 6 px over 20 f). Hold to f636 (84 f), exit f636–f644.
- **Site:** none.
- **Transition out:** continuous into the frost (§0.9).
- **Sound:** NINETY-NINE f552 · MINIMUM f588 (duck −11).
- **Render:** HyperFrames only. **QC:** `check_text.js` (160 / 36 px); the "%" inside title-safe; `macro_last.png` equals the plate's
  last decoded frame (diff < 2 levels) so f637 does not pop.

### S07 · "Cold" — frost takes the vial, the phone arrives · f636–f738 (21.20–24.60) · **hybrid: 2D frost over the held plate + the take's ARR**

- **Frost (2D):** `tools/make_frost_seq.py` → `assets/fx/frost/frost_0001..0060.png` (DLA on 1024², seed 7, grown from the four frame
  edges toward the centre, upscaled to 1920×1080 with a 2 px blur; white + `#DCEBFF`, alpha = coverage) + `frost_full.png` (frame 60 held)
  + `frost_density.json` (new frost pixels per frame, for the SFX) → `assets/fx/frost.webm` (VP9 alpha). Placed at `data-start 21.6`
  (**f648 = VO.w('L06',0)**) with `mix-blend-mode: screen` over the held macro frame; by **f686 = VO.w('L06',3)** the frost has closed over
  the label (tune the growth curve so coverage at the frame centre reaches 1.0 at f686 ± 2); `frost_full.png` holds f708–f738. The whole
  frost field + held plate crush to black over f716–f738 (`power2.in` on brightness) so at f738 only the phone remains.
- **ARR (3D, the take's first range, f708–f738):** the phone enters from the right **back first** (camera plateau, no logo), `arr_pose(n)`
  (ARR0 → REST, the proven fly-in settle math with the 1.4° overshoot, retimed 2× then 1:1), screen black, lit by rims and strips only
  (`Key`/`Fill` at 0 W: the slow show begins at f750). The edge-on frame (|spin − 90°| minimal; expected f712 ± 2) is read from
  `pose_speed.json` and written to `renders/3d/take/arr_glint.json` for the mixer and the CA pass. **f738: REST exactly.**
- **Frost on the phone (numpy, `tools/post_layers.py`):** for f708–f821 the frost field (`frost_full.png`) is screen-blended into the
  phone layer **inside its own alpha**, weighted ×(1 − 0.5·matte_screen) so the glass keeps its reflections and the rails carry most of the
  frost; thaw f803–f821: a radial mask from the display centre (stage (960, 540) at REST), radius 0 → 520 px, `expo.inOut`, multiplies the
  frost away. Written into `renders/3d/take/final/`. Fallback: no frost on the phone (flag `--no-phone-frost`).
- **Text:** none ("cold" and "24 h" are the frost). **Site:** none (screen black).
- **Transition out:** continuous; **DROP f738** (the sub hit lands on the contact frame; the phone is at REST, frosted, on black).
- **Sound:** FROST f648→f707 (density-shaped) · COLD f657 · CLOSE f686 · RISER0 f630→f738 · ARR-GLINT (measured, ≈ f712) · **DROP f738**.
- **Render (take range 708–738):** 31 f, border crop, motion blur 0.5, 16 spp + OIDN, Standard; screen = SEQUENCE frames scr_0001–0031
  (black). ≈ 7 s/f ≈ **4 min**. CA ±3 f around the measured glint (2 px, phone layer only).
- **QC:** frost never shows a tile seam or a straight growth front (DLA, not noise); the frost over the label reaches 50 % coverage by f686 ± 2 (frost v2: translucent ice, the vial ghosts through at ~40–55 %);
  the field is black (≤ 1 level) by f738; the phone's silhouette at f738 equals `front_body.png`'s silhouette ± 1 px (registration);
  the glint lasts ≤ 2 output frames; no Apple logo or text on the back during the entry.

### S08 · "Open the site" — the slow show, the wake, the thaw · f738–f822 (24.60–27.40) · **3D (take)**

- **Phone:** REST held f738–f750 (exact identity, keeps the 2D fallback cut valid), then `drift` spin 0 → 1.5°, loc x +2 mm over f750–f822
  (`sine.inOut`): never static.
- **Light:** `slow_show(750, 786)`: rims only at the landing, `Key`/`Fill` fade 0 → 100 %. **Thermometer** `thermometer(803, 839)`: the key
  goes warm from the wake. Everything else as built.
- **Screen (SEQUENCE):** black to f802; **f803 = VO.w('L07',6) "Open": home @ 0 fades in** over 12 f with a 2 px → 0 blur (baked into the
  texture, §0.5); badge "1" on the home nav (crop of cart1's badge in page space); momentum scroll 0 → 36 over f812–f840.
- **Frost:** thaw f803–f821 (post, S07). Picture: the frost clears from the screen outward as the page lights, then the rails; the key
  turns warm behind it. One 10 f additive light-leak plate (`#leak`, warm, 18 %, peak f815) over the wake.
- **Text:** none. **Transition out:** the dive begins at f822 (VO "site." f819 + 3 f).
- **Sound:** SLOW SHOW f750→f786 (`sub_bed`) · WAKE f803 (`screen_wake`) · thaw `frost` reversed f803–f821 · SCROLL ticks f812→f840.
- **Render (take range 739–822):** 84 f, border crop, 16 spp. ≈ 6.5 s/f ≈ **9 min**.
- **QC:** f738–f750 pose identity (corners.json equals `screen_rect.json` ± 0.3 px); the wake's first visible home frame has the badge "1"
  and the H1 "Purity, proven." readable (≈ 30 px at REST); the home never scrolls past 36 (no re-stuck nav); OCR the baked frames
  f803–f822 every 2 f (forbidden list); the light leak never exceeds 92 % on the phone.

### S09 · "The cart does the math" — the dive and the close pose · f822–f936 (27.40–31.20) · **3D (take)**

- **Dive (f822–f868):** `move(REST(drifted) → CLOSE)` over 46 f, ease 0.6/0/0.2/1: a dolly with roll toward a perpendicular close pose
  (screen 1399 px tall = 1.60 px/pt; the frame shows screen pt ≈ 63–743; the cart item band y 300–490 at the frame centre: CLOSE.loc.z =
  +6 mm). Fastest frame ≈ f843 (measured, `pose_speed.json`), whoosh peak there, CA 2 px f840–f846. Motion blur 0.5.
- **Close pose hold (f868–f936):** creep loc y −0.288 → −0.284, spin 4 → 4.5° (always moving). The site is the set: the rails show as two
  Deep-Blue columns at the frame edges, the screen is the only light besides the strips; real glass reflections (the sheen crosses nothing
  here: `SheenCard` stays as built).
- **Screen (SEQUENCE, §0.5):** cart tap f850 at (319, 107) → push home → cart1 @ 150 f852–f864 (landed 6 f before **"Let" f870**) →
  "+" #1 f888 at (226, 422) → cart2 f890, bar 0.42 → 0.81 f890–f904 → "+" #2 f912 at (226, 442) → cart3 f914 ("Volume discount −8%",
  "Free shipping unlocked!", bar 0.81 → 1.00 f914–f928, teal outline) as **"automatic." (f917)** is said → hold cart3 @ 150 to f936 and
  beyond (= `clean/screen_cart.png`). Offers are the cart's own pixels at native size, ≈ 1.5 s, never captioned.
- **Text:** none. **Transition out:** continuous; the tilt starts f936.
- **Sound:** DIVE peak ≈ f843 · CART TAP f850 · PUSH1 f852→f864 · TAP1 f888 (+ state f890, bar) · TAP2 f912 (+ state f914, bar) ·
  AUTOMATIC f917 (`soft_chime`).
- **Render (take ranges 823–868, 869–936):** 46 f at ≈ 11 s/f (phone grows to full frame, border crop until the bbox fills) + 68 f at
  ≈ 12 s/f (the screen fills most of the frame), 16 spp. ≈ **22.5 min**.
- **QC:** cart1 visible by f864 (6 f before "Let"); each tap ring is centred on its button ± 3 pt (`bake_qc.py` overlays meta.json boxes);
  state changes at tap + 2 f; bar fractions 0.4207 / 0.811 / 1.0; `scr_0223` (f930) vs `clean/screen_cart.png` mean < 2 levels;
  **OCR gate** `qc_frames.sh renders/qc 27.4 31.2 0.1` PASS; the BAC-water region (screen y 672–812 at s 150) is blank; the Summary block
  (page y ≥ 965 → screen ≥ 877) is outside the frame at the close pose; the product page never appears.

### S10 · "The math, in depth" — the tilt and the three slabs · f936–f1044 (31.20–34.80) · **3D (take) + shadow pass**

- **Phone:** `move(CLOSE(crept) → CARDS)` f936–f966 (30 f; fastest ≈ f949) then `drift` spin 14 → 16°, loc x +1 mm to f1044. CARDS =
  (14, −5, −2, (0.012, −0.253, 0.004)) = the proven cards pose at 1.5× REST (1.49 px/pt).
- **Slabs (`common.slab`, cart3 @ 150; rects in page pt → screen pt y = 62 + py − 150):**

  | Slab | Page rect (pt) | Screen centre (pt) | Radius | Lift (mm) | Lift frame | Why |
  |---|---|---|---|---|---|---|
  | `stepper` "− 3 +" | (113, 511, 132, 38) | (179, 442) | 19 (pill) | **36** | f954 | the thing that was tapped (hierarchy top) |
  | `total` "$234.57" | (297, 553, 75, 28) | (334.5, 479) | 8 | **24** | f959 | the result of the math |
  | `name` "BPC-157 / TB-500" | (113, 401, 149, 28) | (187.5, 327) | 8 | **12** | f964 | the compound (name as printed) |

  Each: 1.0 mm thick, 0.35 mm bevel ×3, 6× capture crop front (Mix emission/principled per TECH §3), milky edges, `pass_index 2`;
  lift along the display normal over 20 f `expo.out` with 104 % overshoot while scaling 1.00 → **1.25** (text ≥ 26 px at 1080: name 14 pt
  → 26 px, total 16 pt → 30 px, digits 15 pt → 28 px; `check_text.js` on the f1000 preview); the page keeps its own originals beneath
  (the slabs are copies rising from the page). **Never lifted:** the discount line, the ship bar, prices per vial, the Summary.
  **Seat back:** total f1020, name f1025, stepper f1030, each 14 f `power3.in` to lift 0 / scale 1.0 with a 4 f settle; all seated by f1044.
- **DOF:** `dof_key(936, on, f/16, +18 mm)`: focus plane 18 mm in front of the display keeps 0–36 mm readable at 0.507 m (TECH §3 rule
  scaled: ±1.5 cm at f/5.6–0.76 m → ≈ ±1.9 cm at f/16–0.507 m). Off again from f1160 (S12).
- **Light:** `SoftTop` x −0.30 → +0.30 over f990–f1008: the band crosses the glass under the slabs (SHEEN).
- **Shadow pass (`take.py --pass shadow --range 945-1044 --pct 50`):** TECH §3 recipe (catcher = `Screen`, phone + studio hidden,
  0.12 m key, non-emissive slabs); `post_layers.py` multiplies it inside `matte_screen` at 35 % with a 4 px blur (read the RGB of the
  FLOAT output). Fallback: a two-layer CSS-like shadow painted in numpy from the slab mattes (`--shadow fake`).
- **Text:** none (the lifted UI is the typography). **Site:** cart3 @ 150 held.
- **Transition out:** continuous; nav tap f1044.
- **Sound:** TILT peak ≈ f949 · SLABS f954/f959/f964 · SHEEN centre f999 · SEAT f1020/f1025/f1030.
- **Render (take range 937–1044):** 108 f, full frame (the phone at 1.5× exceeds the frame top/bottom: `border=True` still crops x), DOF
  f/16, 24 spp, ≈ 15 s/f ≈ **27 min** + shadow 100 f × 4 s ≈ **7 min**.
- **QC:** every slab text line ≥ 24 px on the f1000 preview; slabs stay within the screen's projection (never beside the phone); slab
  edges 1 mm visible at the tilt; shadows soft (penumbra ≈ 15 px), no double shadow; no discount/shipping text on any slab (OCR the slab
  crops); `matte_cards` clean; the seat-back ends with lift 0.0 / scale 1.0 (the page shows no ghost offset) by f1044.

### S11 · "Purity, proven." — pull-out to the hero · f1044–f1152 (34.80–38.40) · **3D (take) + room type**

- **Phone:** hold CARDS(drifted) f1044–f1050; `move(CARDS → HERO)` f1050–f1116 (66 f, ≈ 11°/s + a 36 cm pull-out; fastest ≈ f1078); then
  `drift` spin +1.5°, loc y +1 cm to f1152. HERO = TILT1 rotation at 0.87 m → phone 786 px (73 %), right of centre. DOF f/5.6 from f1060,
  focus on the Dynamic Island (`focus_mm` to the Island's local position).
- **Screen (SEQUENCE):** nav wordmark tap f1044 at (131, 98) → push cart3 → home @ 0 over f1050–f1062 (landing on **"Pure" f1050**:
  the brand arrives on its name) → home @ 0 with the site's own H1 "Purity, proven." f1062–f1152 (scroll 0 → 10 f1080–f1150).
- **Text (z 20, behind the phone, `#type-back`):** **Purity, proven.** DM Sans 800 120 px white 90 %, tracking −0.02 em, left-centre
  (x ≈ 300–1060, baseline y ≈ 580), 3 px blur (behind the focus plane), lands **f1079 = VO.w('L09',2)** per glyph (22 f, 1 f stagger);
  holds to f1152 (73 f); the phone's left rail slides over the final period around f1120 (depth-sorted occlusion is free: z 30 over z 20).
  Exits f1152–f1160 `power3.in` (before the lights go).
- **Transition out:** continuous into the exit.
- **Sound:** NAV TAP f1044 · PUSH2 f1050→f1062 · ORBIT peak ≈ f1078 · SIGN-OFF f1079 · music thins to pad + piano from f1080.
- **Render (take range 1045–1152):** 108 f, border crop, DOF f/5.6, 16 spp, ≈ 10 s/f ≈ **18 min**.
- **QC:** `check_text.js --from 35.9 --to 38.4 --step 0.25` (120 px, title-safe, ≥ 12:1 where not occluded); the room type never fully
  disappears behind the phone (≥ 60 % of its glyphs visible at every frame); the H1 on screen readable at the hero (≥ 24 px measured);
  `scr_0400` (f1107) vs `clean/screen_home.png` mean < 2 levels; the pull-out is one eased move (no velocity kink at f1116).

### S12 · "Lights out" — the edge-on exit and the STOP · f1152–f1206 (38.40–40.20) · **3D (take) f1152–f1188 + held frame**

- **Phone:** `move(HERO(drifted) → EDGE)` f1152–f1188 (36 f; fastest ≈ f1170): spin → 90°, tilt/roll → 0, loc → (0, 0.084, 0): the phone
  turns edge-on at 0.844 m (rail ≈ 47 px wide, 810 px tall).
- **Screen:** `screen_emission_key` 1 → 0 over f1152–f1170 (the site goes dark; reflections stay on the glass).
- **Light:** `lights_out(1158, 1186)`: `Key Fill Back Soft* SideL` → 0, `SideR` → 50 %, `EdgeR` kept, so **f1188 is a single vertical
  line of light** (the rail's rim highlight, ≈ 2–3 px wide, ≈ 800 px tall) at the frame centre on black: the bookend of S01's point of light.
- **STOP f1188–f1206 (39.60–40.20):** total freeze: `assets/layers/hold_1188.png` (the take's final f1188 PNG) shown as an `<img>` above
  the webm; grain frozen (`PP.grain` holds the seed); nothing moves; gated digital silence.
- **Text:** none (the room type exited f1152–f1160). **Site:** dark.
- **Transition out:** LOGO at f1206 (S13): the held line collapses to a point.
- **Sound:** DIM f1152 · EXIT peak ≈ f1170 (CA 2 px f1168–f1176) · music one-beat silence from 39.6 · **STOP window: nothing**.
- **Render (take range 1153–1188):** 36 f, border crop (small bbox: fast), 16 spp, ≈ 7 s/f ≈ **4 min**.
- **QC:** at f1188 the frame's only pixels > 8 levels lie in a vertical band ≤ 12 px wide around x = 960 ± 20; nothing else is lit;
  the webm's alpha at f1188 covers the rail only; the held PNG equals the webm's last frame (diff < 2 levels).

### S13 · End card · f1206–f1350 (40.20–45.00) · **HTML**

- **LOGO f1206:** the vertical line (a 2 px white HTML line drawn over the held frame at the measured rail x) collapses to a point at
  (960, 300) over 6 f (`expo.in`) while the held frame fades to black over the same 6 f; from the point, `assets/brand/brand-symbol.svg`
  (viewBox 429 196 405 456, rendered 196 × 220 px, centre (960, 300)) draws over 12 f (`expo.out`, DrawSVG on the hexagon strokes), its
  dots seat with 1 f stagger (one glass grain each); `brand-wordmark-light.svg` (viewBox 327 434 611 62 → 560 × 57 px, centre (960, 470))
  masked-line reveal f1212–f1224.
- **URL f1215 = VO.w('L10',0):** **purepeptide.care** Inter 500 40 px white 90 %, centre (960, 660), 16 type ticks over 18 f; its 2 px
  `#C3CBD6` underline draws left → right as a line of light f1226–f1238 (completes on ".care").
- **Tagline f1224:** **Purity, proven.** DM Sans 800 56 px white 90 %, centre (960, 560), per glyph 18 f.
- **Legal f1230–f1350 (4.0 s):** "For laboratory research use only · Not for human or veterinary consumption · 21+" Inter 500 **26 px**
  `#C3CBD6`, centred at y 990 (box 977–1003, inside y ≤ 1026), 12 f fade-in. Everything holds to the last frame; no fade-out; vignette 0 %.
- **Sound:** LOGO f1206 (`sonic_logo` + grains per dot) · URL f1215→f1233 ticks, underline sweep ending f1238 · TAIL gone by 44.5 ·
  SILENCE 44.5–45.0.
- **Render:** HyperFrames only. **QC:** `check_text.js --from 40.2 --to 45 --step 0.25` (40 / 56 / 26 px, ≥ 12:1, title-safe); legal
  visible on every frame f1230–f1350 (120 f); the symbol's gradient is the only colour on the card; frame 1349 identical to frame 1300
  except nothing (no drift).

---

## 2. Appendix

### 2.1 `tools/post_layers.py` (numpy/PIL, per frame, deterministic) — the take

Input `renders/3d/take/{beauty,matte_screen,matte_cards,shadow}/####.png`; output `renders/3d/take/final/####.png` (straight alpha).
1. Soft-clip: on RGB outside `matte_screen`, `y > 0.92 → 0.92 + 0.08·tanh((y−0.92)/0.08)` (per channel, linearised sRGB).
2. Frost (f708–f821): `rgb = screen(rgb, frost_full · w)`, `w = alpha · (1 − 0.5·matte_screen) · (1 − thaw(f))`, `thaw(f)` = radial mask
   from (960, 540), radius `520·bez((f−803)/18)` for f ≥ 803, soft edge 40 px; `alpha` unchanged.
3. Shadow (f945–f1044): `rgb *= 1 − 0.35·blur4(1 − shadow_rgb) · matte_screen` (shadow read from the FLOAT output's RGB, pct 50 → upscaled).
4. Writes `final/####.png` and a 1-in-30 contact sheet `renders/3d/take/contact.png` for the by-eye pass.

### 2.2 QC gates (in order, before the delivery render)

1. `python3 tools/bake_qc.py` (screen bake diffs + OCR) → PASS.
2. `tools/render_queue.py --dry` ≤ 5 h; every `log.json` s/frame within 1.3× of the estimate (else apply the trim ladder, BRIEF §9).
3. `npx hyperframes lint` (0 errors) · `npx hyperframes check`.
4. `node tools/check_text.js --step 0.25` → 0 failures (warnings only during reveals).
5. `tools/qc_frames.sh renders/qc 24.6 38.4 0.25` → OCR PASS + contact sheet read by eye (no people/hands, no forbidden words, offers
   only as cart pixels, slabs = stepper/total/name only).
6. Cut checks: f738 silhouette registration; f930 bake vs `screen_cart.png`; f1188 line-of-light test; the three S02 ghost frames.
7. Audio: `python3 tools/mix_audio.py --report` (−14.0 ± 0.3 LUFS, ≤ −1.5 dBTP, no word under 8 dB guard, STOP/OPEN/END windows at
   digital zero, whoosh peaks within ±1 f of `pose_speed.json` maxima).
8. `tools/verify_output.sh renders/purepeptide-motion-pro-en.mp4` (1350 f, 45.000 s, 1920×1080, 30 fps, audio 48 kHz).

### 2.3 Deliverables

`renders/purepeptide-motion-pro-en.mp4` (H.264 crf 14 + AAC 320 k, `npx hyperframes render --quality delivery`), `assets/audio/mix.wav`
(45.000 s, 24-bit) + a music-only stem, `renders/prores/{s01,s02,take}.mov` (ProRes 4444) with `renders/3d/take/corners.json` (per-frame
display corners + matrix3d for an Apple Motion Four Corner re-comp) and `pose_speed.json`, the 4K front layers (`assets/iphone/`), the
screen bake (`assets/screen_seq/`), `README.md` (what was built, what was measured, the fallbacks taken).
