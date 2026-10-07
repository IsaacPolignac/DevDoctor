# PurePeptide — "A LINE OF LIGHT" · 45 s motion-design film (EN) — production BRIEF

Director's synthesis. Spine: **Concept A "A Line of Light"** (tally A 23.8 · B 22.0 · C 18.8). Grafted: B's water-drop opener and its
cold → warm "thermometer" key, B's frost-to-clear thaw at the screen wake, C's true 3D dive to a close pose where the site becomes the
set, C's rack-focus-as-measurement. Every weakness the three judges raised is fixed (§2). The build contract (per shot, for parallel
builders) is `SHOTS.md`. Measured facts are in `TECH.md`. Voice timings are `js/vo.js` (`VO.w(lineId, i)`), the only authority for
word-locked events.

Deliverable: **45.000 s, 1920×1080, 30 fps, 1350 frames**, 16:9 only, English, research positioning. HyperFrames composition (one
paused GSAP timeline) over Cycles-rendered VP9-alpha layers and the real AI vial plates; audio −14 LUFS / ≤ −1.5 dBTP, 48 kHz 24-bit.
Previous film (rejected as "an ad"): `/home/user/DevDoctor/ads/purepeptide-motion-en` ("Spelled out", see its `BRIEF.md`, `SCENES.md`,
`renders/draft_contact.png`). Nothing from its offer grammar survives: no offer cards, no stamps, no kinetic sales type, no
"APPLIED AUTOMATICALLY", no callouts beside the phone, no light paper world.

---

## 1. The film

> **Light reveals; nothing is printed.** A point of light in a water drop finds the word "pure" screen-printed on black steel: easy to
> print. The same word exists in the phone's black cover glass only as a reflection, and slides off the glass on "prove.": hard to prove.
> The real vial is measured by passing light. Frost takes the vial; the phone arrives through the frost, dark, and wakes on "Open the
> site": the frost thaws from the screen outward and the key goes warm. One unbroken 3D take then carries the phone from its landing to
> its exit: a dive into the live cart, the cart's own quantity, compound name and line total lift off the glass as thin slabs, the hero
> orbit under the site's own "Purity, proven.", lights out, the phone turns edge-on into a single vertical line of light, STOP, and the
> line becomes the brand symbol.

**One physical idea end to end** (light reveals; matter changes state: water → glass → frost → warm light → a line of light). **One
object** (the photoreal Deep Blue iPhone, no logo) carries every structural beat: the reflected word, the arrival on the DROP, the wake,
the dive, the cart, the depth, the hero, the exit. The real vial is only ever the photoreal AI plates. The site is only ever the clean
captures, live (HTML rig) or baked (image SEQUENCE on the 3D screen). Type is sparse (five typed events in 45 s), large, depth-sorted and
occluded by the hero. Sound is locked to the fastest frame of every move, with three real silences (open, STOP, end).

**Structure** (f = frame at 30 fps; beat grid 0.6 s = 18 f anchored on the DROP, i.e. multiples of 18 f; cuts on the grid unless VO-locked):

| T (s) | f | Act | World | Phone |
|---|---|---|---|---|
| 0.0–4.2 | 0–126 | S01 · a point of light in a water drop; "pure" screen-printed on black brushed steel | BLACK, cold | — |
| 4.2–7.2 | 126–216 | S02 · the word exists only as a reflection in the black cover glass; it leaves on "prove." | BLACK, cold | black glass |
| 7.2–21.2 | 216–636 | S03–S06 · the vial measured by light: hero / cap / turn / breath / macro (two typed proofs only) | BLACK | — |
| 21.2–24.6 | 636–738 | S07 · frost takes the vial; the phone arrives through it, frosted; **DROP f738** | BLACK → frost → BLACK | arrives |
| 24.6–27.4 | 738–822 | S08 · the slow show, wake on "Open" (f803), thaw, key goes warm | BLACK → warm site inside the glass | one take |
| 27.4–31.2 | 822–936 | S09 · the dive to the close pose, the cart does the math | the site is the set | one take |
| 31.2–34.8 | 936–1044 | S10 · the tilt, three slabs lift off the glass and seat back | BLACK, warm | one take |
| 34.8–38.4 | 1044–1152 | S11 · pull-out to the hero orbit, "Purity, proven." in the room and on the site | BLACK, warm | one take |
| 38.4–40.2 | 1152–1206 | S12 · lights out, edge-on exit → one vertical line of light; **STOP f1188–f1206** | BLACK | line of light |
| 40.2–45.0 | 1206–1350 | S13 · LOGO: the line collapses to a point, the symbol draws from it; URL on the word; legal ≥ 4 s | BLACK | — |

Phone on screen: f126–f216 and f708–f1206 = 588 f = **19.6 s** (plus its line of light seeding the end card). Absent only for the
droplet (4.2 s) and the vial proof (16.4 s), both of which the voice requires.

---

## 2. Judges' weaknesses → fixes (all three verdicts)

| Raised by | Weakness in A | Fix in this bible |
|---|---|---|
| J1, J2, J3 | The 17 s middle act is the previous film's plate ladder with a headline on every plate | Two typed events only ("Independently tested." / "JANOSHIK ANALYTICAL" on the turn plate; "99%" + "HPLC PURITY, MINIMUM" on the macro). "Every batch / every single one" is **light passes** (the measuring line crosses the vial once per "Every"), "cold / 24 h" is **frost**, not type. "Pure." is never HTML room type: it is screen-printed in the scene once (S01) and reflected once (S02). |
| J3 (compliance) | S10 lifted the free-shipping card and the −8 % item card = the offer as the subject | The three slabs are the cart's own **quantity stepper "− 3 +"** (the thing that was tapped), the **compound name "BPC-157 / TB-500"** and the **line total "$234.57"** (quantity × product = total: "the math"). No discount line, no shipping line is ever lifted. Offers appear only as the cart's own text at native size (≈ 1.5 s), never called out. |
| J1, J3 | `cold.mp4` is not black (corners ≈ (2,8,12), centre column ≈ (70,99,120)): a second light source | `cold.mp4` is not used. "Shipped cold" = a numpy frost sequence crystallising over the held macro plate; the phone arrives through the frost and carries it (frost multiplied inside its own alpha) until the wake thaws it. |
| J2 | S08–S09 were the 2D rig at the front pose: the previous film's phone look, a 2D zoom standing in for a camera move | **One Cycles take f708–f1188** (screen = image SEQUENCE baked from the HTML rig): the dive is a true dolly with roll to a close pose (screen 1.6× REST, the site is the set), the cart math runs on the 3D screen with real glass reflections, the tilt / slabs / pull-out / orbit / exit continue without a cut. The 2D rig survives as the **screen author** and as the zero-cost fallback. |
| J3 | 2.6× push exceeds the 2× crispness of the 4K body layers | No 2D push. The close pose is rendered; the 1206×2622 screen texture is 1.9× oversampled at the close pose. |
| J3 | AgX on screen-off shots vs Standard on screen shots: rail highlights differ | **Standard view everywhere** (the rig's lights were tuned for it); a 2D soft-clip above 92 % on the phone layers outside `matte_screen`. The droplet (no phone, no screen) also renders Standard so the family of highlights matches. |
| J3 | Full-frame DOF at 16 spp leaves noise OIDN smears | S02 at 24 spp; droplet at 32 spp (24 if the 3-frame timing test says > 36 s/f); slab window at 24 spp. |
| J1 | The S02 reflected word is unproven | It is the **first Blender job** (`blender/tests/s02_reflect.py`): three 720p frames (f126 / f150 / f180). Fallback: a 2D ghost under `matte_screen` driven by the per-frame screen corners (SHOTS S02). |
| J1 | `hero_34.png` shows the uncleaned lede | Every screen texture comes from `assets/site/clean/` only. `assets/iphone/hero_34.png`, `flyin.webm`, `tiltout.webm` are never used in the film. |
| J2 (B) | Chips drifting beside the phone = the rejected composition | Slabs lift along the screen normal and stay over the screen; the orbit reveals their thickness and shadows. Nothing ever sits beside the phone. |
| J1, J2 | A had no authored CG material | S01: water (IOR 1.333), brushed steel (anisotropic 0.75), screen-printed ink, a rim strip and a travelling top strip. |
| J3 (B/C) | STOP/LOGO must not collide with L10 (40.50–42.04) | STOP f1188–f1206 (39.6–40.2) sits in the VO gap; LOGO f1206; the URL lands on the spoken word (f1215); legal line f1230–f1350 = 4.0 s. |
| all | Music: Track A is the previous ad's bed | One bespoke ElevenLabs music generation (estimated: 1 650 credits ≈ $0.30, ~102 s), 100 BPM half-time, drop 24.6, silence 39.6, hit 40.2; a Track A re-cut is the zero-credit fallback (§6). |

---

## 3. Look

### 3.1 Studio rig (Blender 5.0.1, Cycles CPU, `assets/iphone/iphone.blend`; names and values from `assets/iphone/tools/build_iphone.py`)

Camera: **85 mm, sensor 36 mm, at (0, −0.760, 0) m looking +Y, fixed.** The phone empty `iPhone` moves; the camera and lights never
move (every proven cut-check, border crop and pose assumes this). REST = identity = `front_body.png` registration, phone 900 px tall at
1080p, display 1206×2622 texture → 400×869 px. World: a dark Z-ramp seen only in reflections (`film_transparent`). All lights
`visible_camera = False`.

| Light | Type | Size (m) | Location (m) | Energy / peak | Colour | Role |
|---|---|---|---|---|---|---|
| `Key` | area rect | 0.90 × 0.60 | (−0.75, −0.50, 0.55) | 6.0 W | (1.0, 0.985, 0.97) | key, up-left front |
| `Fill` | area rect | 0.80 × 0.80 | (0.70, −0.60, −0.25) | 2.0 W | (0.92, 0.95, 1.0) | fill, light-linked OFF the glass and covers |
| `Back` | area rect | 0.90 × 0.60 | (0.25, 0.75, 0.30) | 5.0 W | white | back light |
| `EdgeL` | area rect | 0.025 × 1.20 | (−0.22, 0.60, 0.02) | 3.0 W | (0.95, 0.97, 1.0) | kicker, crisp rim line left |
| `EdgeR` | area rect | 0.025 × 1.20 | (0.24, 0.62, 0.00) | 3.0 W | white | kicker, crisp rim line right (**the only light left on at the exit**) |
| `SoftL` | emissive gradient strip (`softbox`) | 0.26 × 1.00 | (−0.40, 0.28, 0.05) | peak 4.0 | (0.95, 0.97, 1.0) | long gradient highlight on the left rail |
| `SoftR` | emissive gradient strip | 0.22 × 1.00 | (0.42, 0.30, 0.00) | peak 3.0 | white | right rail |
| `SoftFR` | emissive gradient strip | 0.45 × 0.60 | (0.75, −0.50, 0.25) | peak 0.9 | white | front-right fill on metal, linked OFF the glass |
| `SoftTop` | emissive gradient strip | 1.20 × 0.45 | (0.00, 0.05, 0.60) → target (0, 0, 0.02) | peak 5.0 | white | **the travelling band**: keyframed along X −0.30 → +0.30 m to draw a line of light across glass or rail |
| `SideL` | emissive gradient strip | 0.30 × 1.10 | (−0.55, −0.05, 0.05) | peak 4.0 | (0.95, 0.97, 1.0) | the bright line on the front rim radius |
| `SideR` | emissive gradient strip | 0.30 × 1.10 | (0.55, −0.03, 0.00) | peak 2.0 | white | idem right (kept at 50 % during the exit) |
| `SheenCard` | emissive gradient card, reflections only | ≈ 0.125 × 0.23 scaled | y = −0.35 | ×0.22 | (0.93, 0.96, 1.0) | the diagonal sheen on the cover glass (max 13 %) |

`softbox(peak)` is an emission strength multiplied by a soft-edged, top-weighted UV gradient (`bias` 0.55, `edge` 0.30); area lights are
in watts. Lights are addressed by name in `blender/common.py` (`light(name).energy`, `softbox_peak(name, value)` which writes the
`Value` input of the strip's multiply node).

**Thermometer (B's steal).** The key colour is the film's temperature. **Cold** from f0 until the wake: `Key` (0.90, 0.94, 1.00),
`EdgeL`/`EdgeR` (0.86, 0.92, 1.00), `Fill` (0.88, 0.93, 1.00). **Warm** from the wake: `Key` (1.00, 0.96, 0.91), `EdgeL`/`EdgeR`
(1.00, 0.98, 0.95), `Fill` (0.95, 0.95, 0.98); keyed over f803–f839 (36 f, ease 0.6/0/0.2/1). The site's own page white (`#FBFCFE`) and
the warm key are the only warmth in the film.

**Per-shot additions** (all in `blender/common.py`, applied by the shot scripts): `SoftTop` X keyframes (S02 band f192–f216; S10 glass
crossing f990–f1008); a `PureReflect` emissive plane visible to glossy rays only (S02); the slow show (`Key`/`Fill` energy 0 → 100 % over
f750–f786, rims first); the exit (`Key`, `Fill`, `Back`, `Soft*`, `SideL` energies → 0 over f1158–f1186, `EdgeR` kept, `SideR` at 50 %).
The droplet shot (S01) is its own scene (`blender/s01_droplet.py`, no phone) with the same light family: a rim strip 0.20 × 2.00 m at
135° behind (3× key), a top strip 0.10 × 1.50 m sliding X −0.30 → +0.30 m, the 0.9 × 0.6 m key fading up, two 0.05 m bulb spots.

### 3.2 Lens set (phone shots use the fixed 85 mm; "lens" = phone distance; the droplet has its own camera)

| Shot | Lens / distance | Field | DOF | Shutter |
|---|---|---|---|---|
| S01 droplet | **100 mm**, sensor 36, 0.32 → 0.26 m, 28° down | 100 mm macro on the drop | **f/2.8**, 7 blades, rotation 12°; focus Empty on the drop's front surface, rack to the print f96–f117, hold to f126 | 0.5 |
| S02 black glass | 85 mm, phone at y +0.084 m (0.844 m → 75 % frame height) | hero | **f/4**, 6 blades, 12°, focus on the glass centre | 0.5 |
| ARR + rest (f708–f822) | 85 mm, 0.76 m (REST) | hero | off | 0.5 (ARR motion-blurred) |
| dive → close pose (f822–f936) | 85 mm, 0.76 → **0.472 m** (1.6× REST, screen 1399 px tall, 1.60 px/pt) | the site is the set | off | 0.5 |
| tilt + slabs (f936–f1044) | 85 mm, **0.507 m** (1.5× REST, 1.49 px/pt; slabs ×1.25 → 1.87 px/pt) | close ¾ | **f/16**, focus 18 mm in front of the display (keeps 0–36 mm readable, TECH §3 rule) | 0.5 |
| hero (f1116–f1152) | 85 mm, 0.87 m (TILT1 rotation, loc y 0.110) → phone 786 px = 73 % | hero ¾ | **f/5.6**, focus on the Dynamic Island | 0.5 |
| exit (f1152–f1188) | 85 mm, 0.844 m | edge-on | off | 0.5 |

DOF on the take is `cam.data.dof.use_dof` keyed (constant) False → True at f936 → False at f1160, with `aperture_fstop` f/16 (f936–f1044)
→ f/5.6 (by f1060) and a focus Empty parented to `iPhone`, offset per range (`common.focus_mm(z_mm)`: +18 mm over f936–f1044, the Island
after). Rule (TECH §3): readable UI stays within ±1.5 cm of focus at f/5.6–0.76 m scale, or the stop closes accordingly.

### 3.3 Materials (values)

- **Phone, as built:** Deep Blue anodised aluminium F0 `#33466E`, edge tint `#9FB2CF`, Metallic 1, roughness 0.30 with faint variation,
  anisotropic along the rail length; rim radii 0.9 / 1.1 mm; antenna resin `#141A26` roughness 0.32; cover glass flush with a 2.5D edge,
  100 % transmission + reflection (skin material), black ink border 1.63 mm; sapphire Camera Control / lens covers IOR 1.77 roughness 0.05;
  the display is an emission texture (strength 1.0, sRGB, Standard view → pixels round-trip within 0.77 levels). A pure-black
  1206×2622 frame = screen off, so reflections stay physically on the glass.
- **S01 bench:** graphite brushed steel, Metallic 1, Base (0.11, 0.115, 0.125), Roughness 0.34 ± 0.03 (noise breakup, scale 40/m),
  Anisotropic 0.75, rotation along X (brush direction), Bump 0.02 mm from a wave texture (bands 400/m, distortion 2). No dust.
- **S01 ink "pure":** Base (0.93, 0.95, 0.97), Roughness 0.55, Specular 0.3, raised 0.08 mm (displacement from the 4K word mask), DM Sans 800
  lowercase, cap height 9 mm, ≈ 52 mm wide.
- **S01 water drop:** Glass BSDF IOR 1.333, Roughness 0.00, a 7 mm sphere cut 0.4 mm above the plane with a 0.2 mm meniscus fillet;
  caustics off (the 0.1 W bulb spot through the drop is the fake caustic).
- **S02 `PureReflect` plane:** 0.30 m wide, Emission (0.93, 0.96, 1.0) × E (E tuned 4–8 on the test frames), texture = mirrored 4K PNG of
  "pure" (alpha → Transparent mix), `visible_camera = False`, `visible_diffuse = False`, `visible_glossy = True`, `visible_shadow = False`.
  Target: 35–45 % sRGB peak on the glass at f150.
- **S10 slabs (TECH §3 recipe):** rounded-rect outline (radius 19 pt for the stepper pill, 8 pt for the name and total) → bmesh face →
  extrude **1.0 mm** → Bevel 0.35 mm, 3 segments; size = capture rect × 0.1657 mm/pt × **1.25** (the copy grows 1.00 → 1.25 as it
  lifts); front = 6× capture crop (`tools/render_screens.cjs` at deviceScaleFactor 6) in Mix(Emission 1.0, Principled roughness 0.28 +
  coat 0.35, fac 0.30); edges milky (Base 0.85, Roughness 0.6, Transmission 0.3, IOR 1.45); back plain grey. `pass_index` 2. Shadows on
  the page from the shadow-catcher pass (dedicated 0.12 m area key up-left, `Screen` as catcher, phone parts and studio hidden, cards
  non-emissive), multiplied inside `matte_screen` at 35 % with a 4 px blur, per frame in numpy before encoding.
- **Vial:** real plates only (`assets/plates/ai/`: `hero`, `turn` here; `cap`, `macro` copied from
  `/home/user/DevDoctor/ads/purepeptide-film-en/assets/plates/ai/`; all 1920×1080, 24 fps, 73 f = 3.04 s except `turn` 97 f = 4.04 s;
  played 1:1). Never CG, never a fake label. `cold.mp4` and `smoke.mp4` unused.
- **Frost (2D, numpy):** `tools/make_frost_seq.py` grows crystals from the four frame edges toward the centre (DLA on a 1024² grid,
  seed 7, upscaled ×1.875 with a 2 px blur to 1920×1080), 60 frames (f648–f707) + a held full frame, white + `#DCEBFF`, written as
  `assets/fx/frost/frost_####.png` and `frost_density.json` (new frost pixels per frame → SFX crackle). The arriving phone carries the
  same field inside its alpha (`tools/post_layers.py`), thawed by a radial mask from the screen centre (radius 0 → 520 px, f803–f821).

### 3.4 Palette (monochrome by rule; the device is the only colour outside the glass)

| Token | Value | Use |
|---|---|---|
| void | `#000000` | the only background in the film (matches the plates' measured black) |
| void glow | `radial-gradient(60% 50% at 50% 55%, #0A1020 0%, #000 70%)` | centre lift behind the phone, 100 % during the take, 0 % on the plates and the end card |
| type | `rgba(255,255,255,.90)` | all display type (18:1) |
| small caps | `#C3CBD6` | small lines, URL underline, legal (13:1 on black) |
| frost | `#FFFFFF` + `#DCEBFF` | frost crystals, the thaw's rim |
| steel | (0.11, 0.115, 0.125) linear | S01 bench |
| device | Deep Blue `#33466E` / `#9FB2CF` | the phone |
| site pixels | `#123A78` status bar, `#FBFCFE` page, `#16A48F` / `#2BB58A` bar fills | only ever inside the glass |
| brand | symbol gradient `#123A78 → #2A9AC2 → #16A48F` (`brand-symbol.svg`), wordmark `brand-wordmark-light.svg` | end card only |

### 3.5 Grade (finishing, not rescue)

Standard view transform on every Cycles layer (exact screen colours; one family of highlights). No compositor grading (passes go through
File Output). HyperFrames finish on `#fx`: grain 2 % (`assets/fx/grain0-7.png` copied from motion-en, reseeded every 2 f with
`PP.rng(5)`, **frozen f1188–f1206**), vignette 22 % (0 % on the end card), chromatic aberration ≤ 2 px on exactly three moments (ARR glint
±3 f, dive peak f840–f846, exit f1168–f1176), one additive light-leak plate 10 f at the wake (peak f815, warm, 18 %), a 2D soft-clip curve
above 92 % on the phone layers outside `matte_screen`. No LUT, no colour change on the site pixels.

### 3.6 Four key frames

| KF | f | What you see |
|---|---|---|
| KF1 | 90 | Black brushed steel fills the frame at 100 mm, 28° down. A 7 mm water drop sits on the "u" of a white screen-printed **pure**, magnifying it. The top strip's reflection is a single bright point inside the drop and a soft line travelling along the brush; the rim strip carves the drop's edge. The key is at 70 %: the print is emerging. Everything else is black. |
| KF2 | 150 | The phone ¾ front, 75 % frame height, screen off: black glass with one rim line on the right rail (SideR) and the sheen. In the glass, a mirrored ghost of **pure** (≈ 40 % white) sits left of centre, drifting right as the phone turns. Nothing else in frame. Cold key. |
| KF3 | 1000 | The phone close (1.5×), spin 14° / tilt −5° / roll −2°, the real cart (cart3 at scroll 150) on screen, warm key. Three thin slabs have lifted 36 / 24 / 12 mm out of the glass: **"− 3 +"**, **"$234.57"**, **"BPC-157 / TB-500"**, 1 mm thick with milky edges, soft shadows on the page beneath. f/16, everything readable, black void around. |
| KF4 | 1120 | The phone in the ¾ hero pose, right of centre, the home page on screen with its own H1 "Purity, proven.". Left of it, 15 % further from the camera and 3 px soft: **Purity, proven.** (DM Sans 800, 120 px, white 90 %); the phone's left rail is sliding over the final period. |

---

## 4. Typography (fonts in `assets/fonts/`, woff2; all type is HTML except the printed "pure")

| Role | Face | Size | Where |
|---|---|---|---|
| In-scene print | **DM Sans 800** lowercase "pure" → `tools/text_png.cjs` → `assets/type/pure_4k.png` (alpha) | ≈ 52 mm wide in S01; the same PNG mirrored = the S02 reflection texture | S01, S02 |
| Proof line | **Inter 600** | 96 px: "Independently tested." | S05 |
| Small caps | **Inter 600**, caps, tracking +0.10 em, `#C3CBD6` | 36 px: "JANOSHIK ANALYTICAL", "HPLC PURITY, MINIMUM" | S05, S06 |
| Stat | **Inter 600** | 160 px cap: "99%" (the one exception to the 14 % frame-height ceiling) | S06 |
| Room type | **DM Sans 800** (the site's H1 face), tracking −0.02 em | 120 px: "Purity, proven." | S11 |
| End card | wordmark SVG ≈ 560 px wide; tagline DM Sans 800 56 px; URL **Inter 500 40 px** with a 2 px `#C3CBD6` underline drawn as a line of light; legal **Inter 500 26 px** `#C3CBD6` | S13 |
| Symbols | `inter-symbols.woff2` (≥, −) | wherever U+2212 is set |

Rules: every text node ≥ 24 px at its rendered size, contrast ≥ 4.5:1 (all are ≥ 12:1 on black), inside title-safe x 96–1824 / y 54–1026,
every text state holds ≥ 36 f; reveals per glyph (opacity + 8 px rise, 1–2 f stagger, 18–22 f `expo.out`), exits 8 f `power3.in`;
type behind the focus plane gets a 3 px blur; the phone's alpha occludes room type for free (z-order). The site's own pixels are exempt
from the 24 px rule (real captures at native size) but every lifted slab line must measure ≥ 24 px (`tools/check_text.js` on a slab test
frame: name 14 pt × 1.87 = 26 px, total 16 pt = 30 px, stepper digits 15 pt = 28 px).

---

## 5. VO placement (`js/vo.js` is the truth; f = Math.round(t × 30); nothing is rewritten, no word moves)

Take: ElevenLabs v4 **Markmont**, one performance (`assets/audio/vo_v4/VOICE.md`), lines pre-placed by `tools/build_vo.py`; per-line WAVs in
`assets/audio/vo/L01–L10.wav` (`lines.tsv`). Every picture event below is read at build time with `VO.w(line, i)` and clamped into its
shot window (the shot file `console.warn`s on a clamp).

| Line · word (i) | t (s) | f | Shot | Picture event locked to the word |
|---|---|---|---|---|
| L01 "Pure." (0) | 1.00 | 30 | S01 | **HIT1**: the rim strip switches on over 3 f; the drop becomes a droplet of light |
| L02 "easy" (3) | 2.97 | 89 | S01 | key starts fading up (0 → 100 % by f117): the brush and the print emerge |
| L02 "print" (6) | 3.91 | 117 | S01 | rack focus lands on the printed "pure" (f96 → f117) |
| L02 "and" (7) | 4.19 | 126 | S01→S02 | **cut** on the breath (grid 4.2): droplet highlight → the phone's black glass |
| L02 "hard" (10) | 5.37 | 161 | S02 | the orbit's eased move is at full speed; the ghost crosses the glass centre |
| L02 "prove." (13) | 6.01 | 180 | S02 | the reflected "pure" **leaves the right edge of the glass**; black glass until f216 |
| L03 "print" (3) | 8.11 | 243 | S03 | nothing (restraint: the plate's own push) |
| L03 "measure" (6) | 9.05 | 272 | S03 | the **vertical measuring pass** peaks (cap → base, f266–f278) |
| L04 "Every" (0) | 11.20 | 336 | S04 | first horizontal light pass across the sealed cap (6 f) |
| L04 "Every" (2) | 11.89 | 357 | S04 | second pass |
| L04 "one." (4) | 13.19 | 396 | S04→S05 | **cut** (whip-tilt down to the whole vial) |
| L04 "Tested" (5) | 13.67 | 410 | S05 | *Independently tested.* lands (per glyph) |
| L04 "Janosik" (8) | 15.83 | 475 | S05 | *JANOSHIK ANALYTICAL* small line appears |
| L05 "99" (0) | 18.40 | 552 | S06 | **99%** lands per character (plate fades up f546–f558 beneath it) |
| L05 "minimum." (2) | 19.59 | 588 | S06 | *HPLC PURITY, MINIMUM* small line (the whisper) |
| L06 "Shipped" (0) | 21.60 | 648 | S07 | **frost** starts growing from the four edges over the held macro plate |
| L06 "cold" (1) | 21.89 | 657 | S07 | crackle hit; frost density step |
| L06 "24" (3) | 22.87 | 686 | S07 | the frost closes over the vial's label (the vial is gone) |
| L06 "hours." (4) | 23.39 | 702 | S07 | riser at full tilt; the phone enters at f708 |
| — | 24.19–25.60 | 726–768 | S07/S08 | no voice: **ARR f708–f738, DROP f738**, the slow show |
| L07 "Don't" (0) | 25.60 | 768 | S08 | over the dark, frosted phone (rims only, fill fading in) |
| L07 "Open" (6) | 26.77 | 803 | S08 | **the screen wakes** (home @ 0) and the frost **thaws from the screen outward**; key cold → warm |
| L07 "site." (8) | 27.29 | 819 | S08→S09 | the **dive** begins at f822 (word + 3 f) |
| L08 "Let" (0) | 29.00 | 870 | S09 | cart1 @ 150 is on screen (landed f864); the close pose is reached (f868) |
| L08 "cart" (2) | 29.21 | 876 | S09 | hold: the cart reads |
| L08 "math." (5) | 29.77 | 893 | S09 | bar is filling (0.42 → 0.81, f890–f904) after "+" tap #1 (f888) |
| L08 "automatic." (7) | 30.57 | 917 | S09 | cart3 state (f914): "Volume discount −8%", "Free shipping unlocked!", bar → 1.00 |
| — | 31.27–35.00 | 938–1050 | S10 | no voice: the tilt, the slabs, the seat-back (the picture does the talking) |
| L09 "Pure" (0) | 35.00 | 1050 | S11 | the Safari push to the home page lands the brand on the brand name |
| L09 "Purity" (2) | 35.97 | 1079 | S11 | room type **Purity, proven.** lands per glyph |
| L09 "Proven." (3) | 36.71 | 1101 | S11 | the orbit decelerates into the hero pose (f1116) |
| — | 37.95–40.50 | 1139–1215 | S12 | no voice: lights out, edge-on, **STOP f1188–f1206** |
| L10 "purepeptide" (0) | 40.50 | 1215 | S13 | **URL** types in under the symbol |
| L10 ".care" (1) | 41.27 | 1238 | S13 | the URL underline (a line of light) completes |

---

## 6. Music plan (per the sound research; nothing generated yet)

**Decision: generate ONE bespoke track** with ElevenLabs `eleven_music_v2_5` (`creative_generate_in_flow`, `node_type: music`,
`generations_count: 1`, `duration_seconds: 45`, `lyrics_type: "instrumental"`, `instrumental: true`; estimated **1 650 credits ≈ $0.30,
~102 s**; flow `EwpDuAICbO5CKbr9ZMdG` / node `XC2fgBvqchnqXgo7hw54` may be reused). Track A (the previous ad's bed, 120 BPM four-on-the-floor)
is the zero-credit fallback. Nothing else is generated (no video, no second take).

**Exact prompt (45 s; the drop/silence/hit are picture-locked):**

```
Cinematic minimal electronic score, instrumental, 100 BPM, D minor, modern polished production.
Opens almost silent with a lone sub-bass pulse and a cold glassy pad, slowly adding soft felt-piano notes
and fine granular textures; a filtered noise riser and a tightening pulse build from 21 seconds into one
clean, heavy drop at 24.6 seconds: deep sub bass, sparse half-time percussion, wide analog synth chords.
The groove stays confident and spacious, thins to pad and piano after 36 seconds, cuts to a full one-beat
silence at 39.6 seconds, then a single resonant hit at 40.2 seconds with a long sub tail that fades to
silence by 44.5 seconds. No vocals, no cymbals, no risers after the drop.
```

**Post-generation QC before anything is locked:** decode (`ffmpeg`) → kick-band autocorrelation (expect 0.600 s = 18 f per beat) →
chroma vs D (if not D, change only the root constants in `tools/mix_audio.py`: `impact(root=)`, `stat_hit(root=)`, `shimmer(notes=)`,
`sonic_logo` tinks, `tail` notes) → 0.5 s RMS curve to locate the real drop / stop / hit. Pull them onto 24.60 / 39.60 / 40.20 with the
`EDIT` segment mechanism (equal-power joins on the 0.6 s grid) and `atempo` ≤ ±3 %; then write `js/cues.js` from the **measured** hits
and freeze it. Grid cues may move ±2 f after the measure; VO-locked events never move.

**Fallback (Track A, exact 45 s edit, `N = 45·48000`):**
```
EDIT = [(8.0, 28.0, 1.0),    # S 8–28 → T 1–21: hits T1/T9/T13, natural decay into the source's own silence (S 25–28 → T 18–21)
        (40.6, 60.0, 21.0),  # S 40.6–60 → T 21–40.4: tail of the swell (0.5 s fade-in at −31 dB) into DROP T 24.6 (S 44), groove, stop S 59.5–60 → T 39.9–40.4
        (84.0, 86.5, 40.2)]  # S 84–86.5 → T 40.2–42.7: final hit on LOGO, decays by 43.3; 44.5–45.0 digital silence
SEG_FADES = [(0.0, 0.0), (0.5, 0.03), (0.003, 0.0)]
```
plus a `sweep_filter` LP ride 18 kHz → 900 Hz over T 34–39.6 and a −6 dB fader ride (filter-out into the sign-off) to mitigate the loop feel.

**Mix targets:** master −14.0 LUFS integrated, ≤ −1.5 dBTP, LRA 8–12 LU, momentary max ≤ −9 LUFS at DROP and LOGO; VO stem −15 LUFS
(HPF 90 Hz, +1.5 dB @ 4 kHz, 2:1 soft knee, de-esser −3 dB 6–8 kHz, +3 dB makeup on the whispered "Minimum."); ducking zones −6 dB
T 0–24.6, −8 dB T 24.6–36, −11 dB T 36–41; per-word guard ≥ 9 dB over the bed; SFX bus ducked −4 dB under speech; sub < 120 Hz centre
only; never two subs within 0.25 s; digital zero in the OPEN (0–1.0), STOP (39.6–40.2) and END (44.5–45.0) windows (gate with 20–40 ms
pre-fade).

---

## 7. SFX list (frames; recipes = `tools/audiolib.py` functions, new ones marked NEW; gains dB, sends room/hall/big)

| Cue | f (T) | Picture | Sound |
|---|---|---|---|
| OPEN | 0–30 (0–1.0) | black, nothing moves | `SILENCE` window (digital zero) |
| HIT1 | 30 (1.00) | rim strip on, the drop lights | `impact(root "D1", dur 1.4)` −10 big −16 + `glass_tick("D6")` −16 hall −12; music enters (pad + sub pulse) |
| SWEEP1 | 36→72, peak 54 | top strip travels through the drop | `light_sweep(1.2)` −20 `align="peak"` + `grains(A7)` −26 hall −12 |
| RACK | 114–118 | rack focus lands on the print | 4 × `tick(4200)` −22, 35 ms apart |
| CUT1 | 126 (4.20) | droplet → black glass | `glass_tick("D6")` −16 hall −12 + `doppler_whoosh(0.6)` NEW −16 `align="peak"` |
| PRINT/PROVE | 117 / 180 | ghost drifts / leaves the glass | `tick(4200)` −22 at f117; at f180 `tsk` −20 + `thoomp("D2", 0.05)` −16 |
| SWEEP2 | 192→216, peak 216 | SoftTop band crosses the black glass into the vial | `light_sweep(0.8)` −18 `align="end"` + `glass_tick("A5")` −18 hall −12 on f216 |
| MEASURE | 266→278, peak 272 | vertical measuring pass | `band_rise(0.4, 1k→4k)` −20 ending f272 + `light_sweep(0.54)` −18 peak f272 + `glass_tick("A6")` −18; `sub_bed` −30 under the push |
| CUT2 | 306 | push-in continuity into the cap | `glass_tick("D6")` −20 |
| EVERY ×2 | 336, 357 | two passes over the cap | `light_sweep(0.3)` −22 + `tick(4200)` −24 each |
| WHIP | 396 (13.20) | whip-tilt to the turn plate | `tsk` −17 + `swipe(0.3)` −20 `align="peak"` f396 |
| TESTED | 410 | *Independently tested.* lands | `stat_hit("A5", root "D2", light)` −14 + `tick(4200)` per glyph −24 (≥ 35 ms apart) |
| ACC | 475 (15.83) | *JANOSHIK ANALYTICAL* | `glass_tick("D6")` −18 hall −14 (music accent ±6 f) |
| BREATH | 522–546 | plate crushes to black, words alone | `sub_bed(0.8)` −30; `reverse_swell(0.4, "D6")` −18 `align="end"` on f552 |
| NINETY-NINE | 552 (18.40) | 99% per character | `stat_hit("A5", root "D2")` −9 room −14 + `tick(3600+200k)` ×2 −18 (2 f apart) |
| MINIMUM | 588 (19.59) | the whisper line | `thoomp("D2", 0.05)` −14, music ducked −11 |
| RISER0 | 630→738 | into the DROP | `riser(3.6, A4→A5)` −15 `align="end"` + `pulse_riser(3.6)` NEW −18 (last sample on f738) |
| FROST | 648→707 | frost grows (density from `frost_density.json`) | `frost(2.0)` −16 shaped by density; crackle `grains` −24 panned by growth centroid |
| COLD | 657 (21.89) | crackle hit | `impact(root "D2", lite)` −14 room −14 + `frost(0.4)` −14 |
| CLOSE | 686 (22.87) | frost closes over the label | `glass_settle(n=4)` NEW −22 room −12 |
| ARR-GLINT | ≈ 712 ±2 (measured) | edge-on glint, fastest frame | `doppler_whoosh(0.9)` NEW −11 hall −10 `align="peak"` + `sfx_whoosh` sample −14 + `tsk` −17 |
| **DROP** | **738 (24.60)** | phone lands at REST, frosted | `impact("D1", 1.4)` −8 big −16 + `click13` −16 + `alu_tick` −14 + `alu_ring("D5")` NEW −22 hall −12; frost field crush: `frost(0.3)` −22; music DROP |
| SLOW SHOW | 750→786 | fill fades in | `sub_bed(1.2)` −30 |
| WAKE | 803 (26.77) | screen on, thaw starts | `screen_wake()` NEW −14 (`pop("D6", 0.16)` + `haptic(165, 0.04)` + `light_sweep(0.3)`); thaw `frost(0.6)` reversed −20 f803–f821 |
| SCROLL | 812→840 | momentum scroll 0 → 36 | `tick_train` −30 widening |
| DIVE | 822→868, peak ≈ 843 (measured) | dolly to the close pose | `doppler_whoosh(1.4)` −12 hall −10 `align="peak"` + `thoomp("D2")` −14 at peak + 1 f |
| CART TAP | 850 | ring on the cart icon | `tap(2350, body 380)` −10 + `haptic` −16 |
| PUSH1 | 852→864, peak 854 | Safari push home → cart1 | `swipe()` −18 `align="peak"`; `pop("E7", 0.14)` −13 badge (already "1", pops once at f866) |
| TAP1 | 888 | "+" #1 | `tap(2350)` −10 + `haptic` −16; state f890: `pop("E7")` −16; `tick(3400+150k)` −21 price roll; `band_rise(0.45)` −21 bar f890–f904 |
| TAP2 | 912 | "+" #2 | idem; state f914 `pop("E7")` −16; bar f914–f928 `band_rise(0.45)` −21 |
| AUTOMATIC | 917 (30.57) | "Free shipping unlocked!" reads | `soft_chime(("D6","A6"))` −14 hall −12 |
| TILT | 936→966, peak ≈ 949 (measured) | close pose → cards pose | `doppler_whoosh(0.8)` −14 hall −10 `align="peak"` + `thoomp("D2")` −16 |
| SLABS | 954 / 959 / 964 | stepper / total / name lift | `glass_tick` D6 / A5 / E6 −20 + `alu_tick` −20 each; `stat_hit(light)` −14 on the first |
| SHEEN | 990→1008, centre 999 | SoftTop band crosses the glass | `light_sweep(0.54)` −20 + `grains(A7)` −26 hall −12 |
| SEAT | 1020 / 1025 / 1030 | slabs seat back | `pop` E7 / D7 / A6 descending −20 + `glass_settle(n=2)` −26 |
| NAV TAP | 1044 | ring on the wordmark | `tap(2350)` −10 + `haptic` −16 |
| PUSH2 | 1050→1062, peak 1052 | cart3 → home @ 0 | `swipe()` −18 `align="peak"` |
| ORBIT | 1050→1116, peak ≈ 1078 (measured) | pull-out to the hero | `doppler_whoosh(1.0)` −14 hall −10 `align="peak"`; music thins to pad + piano from f1080 |
| SIGN-OFF | 1079 (35.97) | *Purity, proven.* | `tick_train(f=5200)` 11 ticks over 18 f −28 + `shimmer` −24 on the glass sheen |
| DIM | 1152 (38.40) | screen emission 1 → 0 | `thoomp("D2")` −16; room type exits |
| EXIT | 1152→1188, peak ≈ 1170 (measured) | edge-on turn, lights out | `doppler_whoosh(1.0)` −16 hall −10 `align="peak"`; music cuts to its one-beat silence at 39.6 |
| **STOP** | **1188–1206 (39.60–40.20)** | total freeze | `SILENCE` window: nothing, not even tails (gate) |
| **LOGO** | **1206 (40.20)** | the line collapses to a point, the symbol draws | `sonic_logo()` −4 hall −12 + `haptic(0.12)` −20; one `grains` tink (D7/A7/E7) per dot on its seat frame −20 hall −12; music's final hit |
| URL | 1215→1233 | purepeptide.care types in | 16 × `tick(5200)` −28 over 18 f; underline `light_sweep(0.5)` −26 ending f1238 |
| TAIL / END | 1206→1335 / 1335–1350 | end card | `tail(2.9)` −14 hall −14 gone by 44.5; `SILENCE (44.5, 45.0)` |

New `audiolib.py` functions (≤ 20 lines each, seeded, peak-normalised): `alu_ring`, `glass_settle`, `pulse_riser`, `doppler_whoosh`,
`screen_wake`, `button_click` (unused unless a side button is shown). Hard rules: cuts and landings on the 18 f grid unless VO-locked; a
whoosh is checked at ±1 f against the fastest frame of its move (`blender/*.py` writes `pose_speed.json` per frame; the mixer reads it);
a riser's last sample is the hit frame; one primary sound per frame; every pitched element on D/A, E/G passing.

---

## 8. Compliance checklist (binding; `tools/qc_frames.sh` + `tools/check_text.js` are the gates before any delivery render)

- [ ] English; research positioning; tagline "Purity, proven."; URL purepeptide.care. No other claims typed than: pure (printed/reflected),
      Independently tested. / JANOSHIK ANALYTICAL, 99% / HPLC PURITY, MINIMUM, Purity, proven., purepeptide.care, the legal line.
- [ ] Legal line on the end card: "For laboratory research use only · Not for human or veterinary consumption · 21+", Inter 500 **26 px**
      `#C3CBD6` on `#000` (13:1), centred at y ≈ 990, **f1230–f1350 = 4.0 s ≥ 2.5 s**, fully inside title-safe.
- [ ] No people, hands, fingers, faces, body parts, syringes, needles, pills, injections, doctors, dosages, protocols, effects or benefits
      anywhere (taps are `.ps-tap` rings; the vial plates are label-only; the droplet scene has no hand).
- [ ] No invented numbers, certifications, reviews, awards, competitor names. Janoshik Analytical as text only (no logo). "99 %" only as
      HPLC purity minimum; "24 h" / "cold" only as frost (not typed); "10 countries" not used.
- [ ] Offers are **glimpsed only** on the real cart screen (cart1/cart2/cart3 at scroll 150: "Volume discount −5% / −8%", the free-shipping
      bar, "Free shipping unlocked!"), native size, ≈ 1.5 s in the close pose, never typed, never lifted, never called out. The lifted
      slabs are the stepper, the compound name and the line total only.
- [ ] Never visible: Retatrutide, MT-2, the shop grid, "Recovery", "tissue repair", BAC water, COA / certificate, G Pay, "SECURE",
      "Pharmaceutical". Screens come only from `assets/site/clean/` (OCR QC PASS in `clean/meta.json`; the BAC-water upsell region of
      `clean/cart3.png`, page y 760–900, measures pure white, std 0.0). The home page is shown at scroll 0–36 and the cart pages at
      scroll 150 only; the product page is never visited. Gate: `tools/qc_frames.sh renders/qc 24.6 38.4 0.25` (OCR + contact sheet by eye).
- [ ] Never say or imply certificates are published online ("See the tests" chip on the home page is the site's own UI, never spoken or
      typed, and sits below the visible band after the momentum scroll).
- [ ] Product page is **not visited** (bundle block and "$84.99" never on screen).
- [ ] All HTML text ≥ 24 px, contrast ≥ 4.5:1, inside x 96–1824 / y 54–1026, holds ≥ 36 f (`node tools/check_text.js --step 0.25`).
- [ ] Phone: no Apple logo, no device text (model as built). Deep Blue only.
- [ ] Voice: the recorded v4 take, unedited words; no re-generation.
- [ ] Deliverable 45.000 s exactly, 1350 frames, −14 LUFS, ≤ −1.5 dBTP (`tools/verify_output.sh`).

---

## 9. Render budget (Cycles CPU, 4 threads, OIDN, 1080p unless noted; one Blender at a time; TECH §1/§7.3 classes)

| Shot | Job | Frames | Class | s/frame | CPU |
|---|---|---|---|---|---|
| S01 droplet | `blender/s01_droplet.py` f30–f126 | 97 | glass + anisotropic steel + DOF f/2.8, full frame, 32 spp | 30 (test first; 24 spp → 26) | **49 min** |
| S02 black glass | `blender/s02_glass.py` f126–f216 | 90 | phone full frame, DOF f/4, emissive reflect plane, 24 spp | 15 | **23 min** |
| S07 ARR | `blender/take.py --range 708-738` | 31 | phone only, border crop, motion blur, 16 spp | 7 | 4 min |
| S08 rest + wake | `take.py --range 739-822` | 84 | phone only, border crop, 16 spp | 6.5 | 9 min |
| S09 dive | `take.py --range 823-868` | 46 | phone growing to full frame, mblur, 16 spp | 11 | 8.5 min |
| S09 close pose | `take.py --range 869-936` | 68 | screen fills the frame, 16 spp | 12 | 14 min |
| S10 tilt + slabs | `take.py --range 937-1044` | 108 | phone + 3 slabs + DOF f/16, full frame, 24 spp | 15 | 27 min |
| S10 shadow pass | `take.py --pass shadow --range 945-1044 --pct 50` | 100 | shadow catcher, 16 spp, 50 % | 4 | 7 min |
| S11 hero orbit | `take.py --range 1045-1152` | 108 | border crop, DOF f/5.6, 16 spp | 10 | 18 min |
| S12 exit | `take.py --range 1153-1188` | 36 | border crop, lights fading, 16 spp | 7 | 4 min |
| Tests | `blender/tests/s02_reflect.py` (3 × 720p), `s01_timing.py` (3 f) | 6 | | | 5 min |
| Previews | every 3D shot at `--pct 50 --samples 6 --no-denoise` | 668 | | ≈ 2.3 | 26 min |
| **Total** | | **668 beauty + 100 shadow** | | | **≈ 3.3 h** (cap 5 h) |

Slack ≈ 1.7 h = one full re-render of S02 + the slab window + the hero (23 + 34 + 18 = 75 min) **or** of the droplet (49 min) plus partial
ranges. Trim ladder if measured s/f run high: (1) droplet 24 spp (−10 min); (2) droplet f42–f126 with the black hold grown to 1.4 s
(−7 min); (3) slab window 16 spp (−9 min); (4) hero orbit border crop only, DOF f/8 (−5 min); (5) previews at 25 % (−13 min). HyperFrames
render of the whole composition ≈ 2–3 min; VP9-alpha encodes ≈ 0.11 s/f; ProRes 4444 ≈ 0.015 s/f.

---

## 10. Risks, fallbacks, build order

1. **S02 reflected word** (signature). First Blender job: f126/f150/f180 at 720p; tune E and the plane's position so the ghost peaks at
   35–45 % and leaves the glass edge within ±2 f of f180. If the 2.5D glass edge doubles the ghost: move the plane so the ghost stays on the
   flat display region. Fallback (zero Cycles): a 2D ghost (`assets/type/pure_4k.png` mirrored) under the per-frame `matte_screen`, with a
   Fresnel-shaped opacity ramp and a slide driven by the projected screen corners (`screen_corners.json` → CSS `matrix3d`), moving at 2× the
   screen's parallax. Second fallback (C's steal): a 2D crane-to-sliver of the printed "pure" on the S01 plate's held last frame.
2. **Droplet cost / look.** 3-frame timing test at 32 spp; > 36 s/f → 24 spp; still > 36 → f42–f126. If the drop reads as plastic:
   roughness 0.00 stays, add Thin Film 0; check the meniscus fillet and the bulb spot through the drop.
3. **Baked-screen timing (one take).** Any change to a tap/push frame re-bakes the screen PNGs (fast, HTML) and re-renders only the touched
   range (`--range a-b`), 6–12 s/f. The 2D rig (`js/phone.js`) is the zero-cost fallback for f738–f936 (REST, the proven identity cut
   at f738 against the ARR; the dive then becomes `PH.cam` 1.0 → 1.6 with the body leaving frame, accepted downgrade).
4. **Frost on the phone** reading as a sticker: edge-weight the frost inside the alpha (×(1 − matte_screen·0.5)) so the glass keeps its
   reflections and the rails carry most of the frost; or drop the on-phone frost and keep only the field (the DROP still clears it).
5. **Slabs** (text < 24 px, DOF softening, shadow pass quirk): measure every slab line on the test frame (`check_text.js`), f/16 with the
   focus plane at +18 mm, read the shadow pass's RGB (FLOAT output quirk). Fallback: CSS slabs on the 2D fallback rig.
6. **Hero orbit screen content**: the SEQUENCE must be frame-exact (bake via the render path, not `snapshot`; QC three frames by diff
   as in TECH §2). Fallback: a static `clean/screen_home.png` texture for f1062–f1188.
7. **Plate black vs CG black**: verify the plates' decoded black is ≤ 2 levels (`ffprobe` + histogram); add a 1 % lift matte if they sit
   at 16. `cold.mp4` is excluded for exactly this reason.
8. **Music not yet generated**: picture cues are proposals; the DROP (f738), STOP (f1188–f1206) and LOGO (f1206) never move; grid cues
   may shift ±2 f after the measure; the Track A edit is re-cut to the same three points if credits are refused.
9. **Compliance**: `qc_frames.sh` over 24.6–38.4 every 0.25 s (OCR forbidden list) and by eye; `check_text.js` on all HTML type; the
   BAC-water card must be hidden in the baked cart frames (see §8).

**Build order:** P0 lead (common.py, bake rig, render queue, composition skeleton, stub layers) → S02 test frames → S01 timing test → take
previews (f708–f1188 at 50 %) → S02 final → take final by range (ARR first for the DROP look sign-off, then the slab window, hero, dive,
rest, exit) → S01 final → music generation + measure → `cues.js` frozen → mix → QC gates → delivery.
