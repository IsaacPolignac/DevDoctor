# TECH — measured facts and the recommended pipeline for the "pro" motion film

Technical direction for `purepeptide-motion-pro-en`. Every number below was measured on this machine on 2026-10-07
(4 shared CPUs, load 2–4 from other agents during the runs, Blender 5.0.1 via `/home/user/DevDoctor/ads/purepeptide-blender/.venv`,
Cycles CPU, 4 threads, OIDN; ffmpeg 6.1.1; HyperFrames 0.8.73 with chrome-headless-shell 152; Node 22). Scripts are in
`tools/tests/`, outputs in `tools/tests/out/` (not in git, re-run the scripts). One Blender at a time, every test render < 3 min.

| test | script | result files |
|---|---|---|
| T1 Cycles cost | `tools/tests/bench_cycles.py` | `out/bench/bench.json`, `bench_sheet.png`, one PNG per run |
| T2 screen image SEQUENCE | `tools/tests/seq_screen.py` | `out/seq/seq_result.json`, `seq_contact.png`, `seq_f*.png` |
| T3 cards + T4 passes | `tools/tests/cards_passes.py [--fstop 8 --focus screen]` | `out/cards/cards_test.png`, `cards_shadowed.png`, `cards_sheet.png`, `matte_*.png`, `depth.exr`, `cards_multilayer.exr`, `cards_result.json`; `out/cards_f2/` (f/2, cards 6–10 cm out), `out/cards_f56_far/` |
| T4b tilted screen → matrix3d | `tools/tests/homography.py` + `tools/tests/hf_matrix3d_check.sh` | `out/homography/screen_corners.json`, `side_by_side.png`, `browser_side_by_side.png`, `html/` |
| T5a alpha encodes | `tools/tests/encode_alpha.sh` | `out/encode/prores4444_alpha.mov`, `vp9_alpha.webm`, `encode.log` |
| T5b two alpha videos in HyperFrames | `tools/tests/hf_alpha_test.sh` (scratch project `tools/tests/hf_alpha/`) | `out/hf_alpha/hf_alpha_1s.mp4`, `snap/`, `expected_f15.png`, `hf_alpha.log` |
| shadow-catcher diagnosis | `tools/tests/shadow_probe.py` | `out/shadow_probe/` |

---

## 1. Cycles cost per frame (T1)

Scene: `assets/iphone/iphone.blend` as built by `build_iphone.py`, phone in the `hero_34` pose, screen `clean/screen_cart.png`,
production settings kept (adaptive sampling threshold 0.02 / min 8, OIDN prefilter Accurate quality Balanced, 8 bounces,
filter 1.0 px, Standard view, film transparent, persistent data). "16" = 16 samples + OIDN, "48" = 48 samples + OIDN.
Wall seconds per frame, including denoise and PNG write (`bpy.ops.render.render(write_still=True)`).

| scene | 1280×720, 16 | 1280×720, 48 | 1920×1080, 16 | 1920×1080, 48 |
|---|---:|---:|---:|---:|
| phone alone, full frame | **6.5** | 5.9 | **10.9** | 12.4 |
| phone alone, border crop (production, 22 % of the frame) | – | – | **5.5** | 7.9 |
| phone + 3 glass spheres + glossy floor + DOF f/2.8 | **9.4** | 21.5 | **20.8** | 45.3 |
| phone + volumetric fog box (Principled Volume, density 1.6/m) | **22.1** | 57.6 | **47.3** | 129.8 |

Facts to design with:
- The phone alone **does not get more expensive at 48 samples** (adaptive sampling stops at the 0.02 noise threshold: the
  phone converges around 12–16 samples). Its full-frame cost is mostly fixed overhead: **OIDN ≈ 4.3 s at 1080p**
  (48 samples with denoise 12.4 s, without 8.0 s). The production border crop halves it again (5.5 s).
- Glass + floor + DOF and fog **scale linearly with samples** (2.2× and 2.7× from 16 to 48) and need the samples: at 16 the
  floor reflections and the fog are visibly noisy before OIDN; 32–48 is the real cost for those looks.
- 720p costs 0.45–0.6× of 1080p (not 0.44 = pixel ratio, because OIDN and scene setup are fixed costs). It is a preview
  resolution only: the film is 1080p and the 2D front layers are rendered at 2× (4K) for crispness.
- Fog is the expensive one: 47 s/frame at 16 samples = 24 min per second of film at 1080p. **Do fog in 2D** from the Z pass
  (free, §4) unless a shot needs light shafts through the fog.
- Machine note: the runs shared the 4 CPUs with another agent's process (load 3–4); on a quiet machine expect ~10–20 % less.
  The earlier production fly-in measured 5.8–7.1 s/frame with the same settings + motion blur (PHONE.md), consistent with
  the 5.5 s border-crop number plus motion blur.

## 2. Image SEQUENCE on the screen (T2) — works

`image.source = 'SEQUENCE'` on the `ScreenImage` node, `image_user.frame_duration = N`, `frame_start = 1`
(scene frame at which file 0001 shows), `frame_offset`, `use_auto_refresh = True`; files named `scr_0001.png …`.
`scene.frame_set(f)` switches the texture inside one `bpy` session (no reload needed), so a scrolling site can be baked
into a 3D shot: one 1206×2622 PNG per frame.

Proof (front pose, glass hidden so colours round-trip, 1080p, 12 samples, border crop, 2.9 s/frame): three textures =
`screen_blank` chrome + `product_3` scrolled to 900 / 1000 / 1100 pt. Mean abs difference of the rendered screen area
against each expected texture (levels /255):

| rendered | vs tex 1 | vs tex 2 | vs tex 3 |
|---|---:|---:|---:|
| scene frame 1 | **1.17** | 34.4 | 32.7 |
| scene frame 2 | 34.3 | **1.19** | 33.8 |
| scene frame 3 | 32.7 | 33.8 | **1.09** |
| scene frame 1, `frame_offset = 1` | 34.3 | **1.19** | 33.8 |

All four cases pass (`seq_contact.png` shows the three crisp frames). Generate the frames with the browser rig
(`phone-screen.js` scroll state → `tools/render_screens.cjs`-style stills) or with PIL as in `seq_screen.py`
(page crop + re-stuck nav). Cost of the texture frames themselves is negligible; the 3D frame costs §1.

## 3. UI cards as thin extruded planes (T3) — works, see `out/cards/cards_test.png`

![cards](tools/tests/out/cards/cards_shadowed.png)

- Geometry: rounded-rect outline (card radius 16 pt, pill 26 pt) → bmesh face → extrude **1.0 mm** → Bevel modifier
  0.35 mm, 3 segments, angle-limited (`make_card()` in `cards_passes.py`). Size = capture rect × 0.1657 mm/pt × 1.08
  (64.8 × 13.7 / 11.8 / 9.3 mm). Front material = Image Texture of the clean capture crop (sRGB, cubic, EXTEND) into
  **Mix(Emission 1.0, Principled roughness 0.28 + coat 0.35, fac 0.30)**: exact UI colours with a lit coat on the bevel;
  edge material light grey. Cards float 16–28 mm in front of the display in a tilted pose (spin 14°, tilt −5°, roll −2°).
- DOF: at 85 mm / 0.76 m the depth of field is ±1.5 cm at f/5.6. **f/2 with the cards 6–10 cm out blurs everything but the
  focus card** (`out/cards_f2/`, looks like a lens test, unreadable); **f/8 with the cards 16–28 mm out keeps phone and
  cards readable** with a gentle falloff (`out/cards/`). Rule: UI text that must read stays within ±1.5 cm of the focus
  plane or the shot uses f/8+.
- Cost: **15 s/frame** at 1080p, 24 samples + OIDN, full frame (phone + 3 cards + DOF), no border crop.
- Soft shadows: the cards shadow each other and the bezel in the beauty. On the **screen** (an emitter) a shadow can only be
  applied in comp, as a multiply layer from a **Shadow Catcher pass** (§4): rendered separately with the `Screen` plane as
  `is_shadow_catcher`, all phone parts and studio lights hidden, a dedicated 0.12 m area key up-left, the cards with a plain
  non-emissive material and the catcher with a white diffuse stand-in (the pass is a ratio: with the emissive screen or
  emissive cards it stays at 0.98–0.92, i.e. no shadow; measured). With the stand-ins the pass is a full-strength control
  matte: umbra 0.0, 26 k px < 0.5 and 40 k px < 0.9 inside the screen on the test frame, ~15 px penumbra from the 0.12 m key.
  Shadow pass cost **14 s/frame** at 32 samples. `cards_shadowed.png` multiplies it inside `matte_screen` at 35 % opacity
  with a 4 px blur (the comp owns strength and softness). Quirk: a FLOAT File Output item written as RGBA PNG puts the value
  in RGB *and* alpha (viewers show the umbra as transparent): read the RGB, or write the slot as BW.
- Comp alternative that costs nothing: CSS cards in HyperFrames with `transform: perspective() rotate3d()` and
  `box-shadow`; the 3D version earns its cost only when the cards share the camera move / DOF / reflections of a true 3D
  shot. Both can coexist (3D cards in the 3D shots, CSS cards on the 2D rig).

## 4. Passes for compositing (T4) — all available, Blender 5.0 API notes below

One render (`cards_passes.py`, 1080p, 24 samples) writes, through the compositor:

| output | file | what / how |
|---|---|---|
| RGBA beauty | `cards_rgba.png` | straight alpha PNG, film transparent |
| Z | `depth.exr` (float32) + `depth_preview.png` | `Depth` socket; preview = Map Range near→far → 1→0 |
| object-index mattes | `matte_phone.png`, `matte_cards.png`, `matte_screen.png` | `pass_index` 1 / 2 / 3 → ID Mask (anti-aliased). `GlassScreen` gets index 3 too, so the transparent cover glass over the display reads as screen. The Dynamic Island (index 1) and the cards punch holes in `matte_screen` → an exact per-frame **screen-only matte** even through DOF (soft edges). Coverage on the test frame: phone bezel 41 k px, cards 77 k, screen 280 k. |
| Cryptomatte | `cards_multilayer.exr` | multipart EXR with `Image.RGBA`, `Depth.V`, `IndexOB.V`, `CryptoObject00/01/02.rgba` (12 crypto channels, verified by parsing the EXR headers) — for Nuke/AE/Fusion; Apple Motion does not read Cryptomatte, use the ID mattes there |
| Shadow Catcher | `shadow_catcher.png` | separate render, §3 |

Blender 5.0 gotchas (all handled in the scripts):
`scene.compositing_node_group` replaces `scene.node_tree`; the File Output node has `file_output_items.new('RGBA'|'FLOAT', name)`
instead of `file_slots`, writes `<directory>/<file_name><item>.<ext>` (no frame number on stills), and `ImageFormatSettings.media_type`
(`'IMAGE'` / `'MULTI_LAYER_IMAGE'`) gates `file_format`; a multilayer File Output writes **one EXR part per item**; Render Layers
sockets are `Depth`, `Object Index`, `Shadow Catcher`, `CryptoObject00…`; with compositing on, the main render output is the
composite (Combined only), so every pass goes through File Output nodes; `CompositorNodeMapRange` is gone (use `ShaderNodeMapRange`);
ID Mask takes `Index` / `Anti-Alias` as input sockets.

## 5. Crisp HTML on the 3D screen of a tilted phone (T4b) — proven, 1.4 levels

Per frame, project the 4 display corners (`Screen` mesh bbox × `matrix_world`, `world_to_camera_view`) → `screen_corners.json`:
corners in px at 1080p and the **CSS `matrix3d`** for a 402×874 pt element at (0,0) with `transform-origin: 0 0`
(homography pt→px, DLT; `css_matrix3d()` in `homography.py`). The HTML screen is clipped with `border-radius: 52.12px`
(= `radius_cover` 51.9 / K, same as the 2D rig) so the rectangle corners never poke out of the bezel on a tilt.

Stack (bottom → top): HTML screen under `matrix3d` → `body_hole` (phone with the `Screen` as holdout, `GlassScreen` hidden:
the production `front_body` recipe, now per frame) → `glass_only` (cover-glass reflections over a black screen, everything else
holdout: the `front_glass` recipe, per frame; normal blend as RGBA with alpha = max channel, or `mix-blend-mode: screen` as RGB).

Measured on the tilted test frame (spin 14°, tilt −5°, roll −2°) against the full-3D render of the same frame, over a light bg,
levels /255:

| composite | phone region mean / p99 | screen interior mean / p99 |
|---|---|---|
| PIL (2× supersampled perspective warp, Lanczos down) | 1.71 / 32 | **1.42** / 28.9 |
| Chromium (`hyperframes snapshot` of `out/homography/html`, the CSS `matrix3d` as emitted) | 1.68 / 29 | **1.41** / 26 |

The p99 sits on text edges only (texture filter vs browser resampling), as in the production cutcheck (2.1 mean / 25 p99).
Render cost of the two layers vs one beauty, border crop, 16 samples: `body_hole` 2.9 s + `glass_only` 4.8 s = **7.7 s** vs
truth 6.0 s (1.3×). Note the trade: the HTML stays crisp and live (scroll, taps, rolls keep working during a tilt) but gets
**no DOF / motion blur / refraction**; keep DOF off (or f/8+) on those shots and keep tilts moderate. For every frame emit the
matrix3d into a JSON the scene reads and apply it with one `PP.drive` setter (`el.style.transform = M[frame]`).

## 6. Alpha delivery (T5)

ffmpeg from a 1920×1080 RGBA PNG sequence (68 frames of the fly-in):

| encode | time | size | decode-back (frame 20) |
|---|---:|---:|---|
| ProRes 4444 `-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 -qscale:v 9` (ffmpeg writes 12-bit 4444) | **1.0 s (0.015 s/f)** | 8.1 MB (119 KB/f) | alpha exact (100 % of transparent px = 0), RGB mean diff 0.37 |
| VP9 `-c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -row-mt 1 -auto-alt-ref 0` | 7.3 s (0.11 s/f) | 1.02 MB | alpha_mode=1, alpha 99.9 % exact, RGB mean diff 1.31 (4:2:0 chroma) |
| same + `-deadline good -cpu-used 2` | 5.8 s | 1.13 MB | same quality class |

- **ProRes 4444 is the Apple Motion / FCP interchange** (also for the user's Mac tools); Chromium cannot decode ProRes, so
  **HyperFrames gets VP9 webm** (alpha decoded only by the libvpx decoder, `-c:v libvpx-vp9` before `-i` when reading back).
- Two overlapping VP9-alpha videos in one HyperFrames composition (fly-in full frame z 1, tilt-out translated/scaled z 2 over a
  CSS gradient, 1 s): `npx hyperframes render --quality delivery` → **9.5 s for 30 frames** (2 workers, includes browser start),
  1920×1080 H.264. Frame 15 of the MP4 vs a PIL composite of the decoded frames: bg 3.3 (H.264), A-only **1.9**, B-only **2.4**,
  overlap (B over A) **2.0**, B's soft alpha edge over A 6.3 levels → both alphas composite correctly, including the
  semi-transparent edge. Gotcha: **`hyperframes snapshot` showed video frame n+1** (t = 0.5005 s → frame 16, 0.04 levels vs
  frame 16, 38 vs frame 15); the MP4 render is frame-exact. Use renders, not snapshots, for frame-exact video QC (or subtract
  one frame in snapshot times).
- 2D rig throughput for the budget: the 45 s / 1350-frame film captured in 78.6 s with 2 workers (`motion-en/renders/draft.log`)
  = **17 fps ≈ 1.75 s per second of film**.

---

## 7. Recommended pipeline

### 7.1 Which shots are true 3D, which are the 2D rig

| shot | tool | why | screen |
|---|---|---|---|
| fly-in (S06, 68 f) and any shot where the phone **moves in depth, rolls past edge-on, or shows its back** | Cycles, RGBA | the 2D rig has no silhouette change, no rim lighting | baked (`screen_blank` or SEQUENCE §2) |
| hero beats with **glass / floor reflections / DOF / cards floating in 3D** (opening or closing hero, "proof on glass") | Cycles, RGBA + Z + ID mattes (+ shadow pass if cards over the screen) | the look needs real reflections and bokeh | baked SEQUENCE (DOF/blur apply to the content) |
| **every UI interaction at the front pose** (S07–S08: scroll, flick, push, tap, press, bar fill, badge) | 2D rig `js/phone.js` on the 4K layers | crisp text, 1.75 s per second of film, instant iteration, identity transform matches 3D within 2 levels | HTML |
| **tilted phone while the UI still moves** (e.g. S09 dive/tilt-out with the cart rolling, a 3/4 hold with taps) | hybrid §5: `body_hole.webm` + `glass_only.webm` + HTML under per-frame `matrix3d` | keeps the HTML live and crisp on a 3D body | HTML (no DOF on these frames) |
| fog / atmosphere | 2D: Z pass → HyperFrames blur/haze layers, or a static fog plate | 47 s/frame in Cycles vs free | – |
| floating UI cards | 3D in the 3D shots (§3), CSS cards (`perspective`/`rotate3d`, `box-shadow`) on the 2D rig | – | – |

Cuts between 3D and 2D stay on the identity transform (PHONE.md: 2.1–2.7 levels at the cut) or go through the hybrid, whose
`body_hole` frame on the identity transform *is* `front_body.png` at 1× (same recipe).

### 7.2 How the screen is composited, per shot type

1. **Baked 3D** — `render_iphone.py`-style sequence with the screen texture per frame (§2). Use when the content is passive
   (a slow scroll, a hold) and the shot has DOF, motion blur, glass or fog. Colours round-trip exactly through the Standard view.
2. **2D rig** — `front_shadow` → HTML `.ps` → `front_body` → `front_glass` (BUILD.md). All interactions.
3. **Hybrid** — HTML screen under `matrix3d` from `screen_corners.json` → `body_hole.webm` → `glass_only.webm` (§5). Add a 2D
   drop shadow driven from the same corners (or a rendered shadow-catcher floor pass) since the 3D layers carry none.
4. **Cards over the screen** — 3D cards rendered as their own RGBA layer with `matte_cards`, their shadow on the screen as the
   shadow-catcher pass multiplied inside `matte_screen` (`mix-blend-mode: multiply` on a VP9 layer, or baked into the HTML
   layer by a canvas), so the screen content stays HTML or baked as the shot requires.

Delivery of every 3D layer: PNG sequence (archive) → VP9 alpha webm (HyperFrames) + ProRes 4444 (Apple Motion, if the user
finishes there). Z and ID mattes as PNG16/EXR sequences; Cryptomatte EXR only if a Nuke/AE pass exists.

### 7.3 Render settings per shot type

| shot | res | samples | extras | s/frame (1080p) |
|---|---|---|---|---:|
| phone only, motion (fly-in, turns) | 1080p, border crop | 12–16 + OIDN, motion blur 0.5 | – | **5.5–7** |
| phone only, full frame (no crop possible: shadows, floor) | 1080p | 16 + OIDN | – | 11 |
| hybrid tilted screen (2 layers) | 1080p, border crop | 16 + OIDN | Screen holdout / holdout others | 7.7 |
| phone + 3D cards + DOF f/8 | 1080p | 24 + OIDN | Z, index, crypto free; shadow pass +14 s | 15 (+14) |
| glass props + glossy floor + DOF | 1080p | 32–48 + OIDN | transmission bounces 8 | 30–45 |
| volumetric fog (avoid) | 1080p | 32–48 + OIDN | volume bounces 0 | 90–130 |
| previews | 720p, `--pct 50` for blocking | 6–8 | no denoise | 1–6 |

Adaptive sampling stays on (threshold 0.02): it is what keeps the phone-only shots at the 16-sample price.

### 7.4 Per-second render budget (30 fps, 1080p, this 4-CPU box, one Blender at a time)

| content | s per second of film | 1 s | 3 s | 10 s |
|---|---:|---:|---:|---:|
| 2D rig / HTML scenes (HyperFrames capture) | **1.8** | 2 s | 5 s | 18 s |
| phone only, border crop, 12–16 spp (fly-in class) | **165–210** | 3 min | 9–10 min | 28–35 min |
| hybrid tilted screen, 2 layers | 230 | 4 min | 12 min | 38 min |
| phone only, full frame | 330 | 5.5 min | 16 min | 55 min |
| phone + 3D cards + DOF (beauty) | 450 (+420 shadow pass) | 7.5 min | 22 min | 75 min |
| glass + floor + DOF, 32–48 spp | 900–1360 | 15–23 min | 45–68 min | 2.5–3.8 h |
| volumetric fog, 16 / 48 spp | 1420 / 3900 | 24 / 65 min | 71 / 195 min | – |
| VP9 alpha encode | 3.3 | – | – | 33 s |
| ProRes 4444 encode | 0.45 | – | – | 5 s |

Budget rule for a 45 s film on this box: ≤ 14 s of true 3D at the phone-only / hybrid class (≈ 45–55 min of Cycles), one
glass/DOF hero of ≤ 3 s (≈ 1 h), no volumetrics (2D fog), everything else on the 2D rig (≈ 2 min for the whole HyperFrames
render). That is about 2 h of unattended rendering per full iteration of the 3D layers; previews at 720p / 6 samples cost 1/5.
Render only the frames you change (`--frames a-b`), keep `use_border`, keep one Blender at a time (4 threads are the whole box).

### 7.5 Out of scope here, noted for the brief
The VO (ElevenLabs v4 takes in `assets/audio/vo_v4/`) and the music mix do not affect the render budget; the HyperFrames
audio mix is the same as `motion-en` (`tools/mix_audio.py`). If the user finishes in Apple Motion, hand over ProRes 4444
layers + the 4K front layers + `screen_corners.json`-style corner tracks (Motion's "Four Corner" parameter takes them directly).
