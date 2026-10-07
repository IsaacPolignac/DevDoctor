# PurePeptide — "A LINE OF LIGHT" · 45 s motion-design film (EN) — production BRIEF

Director's synthesis. Spine: **Concept A "A Line of Light"** (tally 23.8). Grafted: B's water-drop opener and its
cold→warm "thermometer" key, B's frost-to-clear thaw at the screen wake, C's true 3D dive to a close pose where the site
becomes the set, C's rack-focus-as-measurement. Every weakness the three judges raised is fixed (§2).
The build contract (per-shot, for parallel builders) is `SHOTS.md`. Measured facts are in `TECH.md`.

Deliverable: **45.000 s, 1920×1080, 30 fps, 1350 frames**, 16:9 only, English, research positioning, HyperFrames
composition (one paused GSAP timeline) over Cycles-rendered VP9-alpha layers, audio −14 LUFS / ≤ −1.5 dBTP.
Previous film (rejected as "an ad"): `/home/user/DevDoctor/ads/purepeptide-motion-en`. Nothing from its offer grammar survives:
no offer cards, no stamps, no kinetic sales type, no callouts beside the phone.

---

## 1. The film

> **Light reveals; nothing is printed.** A point of light in a water drop finds the word "pure" printed on black steel.
> The same word exists in the phone's black cover glass only as a reflection, and slides off the glass on "prove."
> The real vial is measured by passing light. Frost takes the vial; the phone arrives through the frost, dark, and
> wakes on "Open the site": the frost thaws from the screen outward and the key goes warm. One unbroken 3D take
> carries the phone from its landing to its exit: a dive into the live cart, the cart's own quantity, name and total lift
> off the glass as thin slabs, the hero orbit under the site's own "Purity, proven.", lights out, the phone turns
> edge-on into a single vertical line of light, STOP, and the line becomes the brand symbol.

**One physical idea end to end** (light reveals, matter changes state: water → glass → frost → warm light → a line of
light). **One object** (the photoreal Deep Blue iPhone, no logo) carries 21 of 45 s and every structural beat: the
reflected word, the arrival on the DROP, the wake, the dive, the cart, the depth, the hero, the exit. The real vial is
only ever the photoreal AI plates. The site is only ever the clean captures, live or baked. Type is sparse (five
typed events in 45 s), large, depth-sorted and occluded by the hero. Sound is locked to the fastest frame of every move,
with three real silences (open, STOP, end).

**Structure** (f = frame at 30 fps; beat grid 0.6 s = 18 f anchored on the DROP; cuts on the grid unless VO-locked):

| T (s) | f | Act | World | Phone |
|---|---|---|---|---|
| 0.0–4.0 | 0–120 | A point of light in a water drop; "pure" screen-printed on black brushed steel | BLACK, cold | — |
| 4.0–7.2 | 120–216 | The word exists only as a reflection in the black cover glass; it leaves on "prove." | BLACK, cold | black glass |
| 7.2–21.2 | 216–636 | The vial, measured by light: hero / cap / turn / breath / macro (two typed proofs only) | BLACK | — |
| 21.2–24.6 | 636–738 | Frost takes the vial; the phone arrives through it, frosted; **DROP f738** | BLACK → frost | arrives |
| 24.6–31.0 | 738–930 | The slow show, wake on "Open", thaw, dive into the live cart, the cart does the math | BLACK → warm site inside the glass | one take |
| 31.0–38.4 | 930–1152 | Pull-out, the cart in depth (slabs), hero orbit, "Purity, proven." in the room and on the site | BLACK, warm | one take |
| 38.4–40.2 | 1152–1206 | Lights out, edge-on exit → one vertical line of light; **STOP f1188–f1206** | BLACK | line of light |
| 40.2–45.0 | 1206–1350 | LOGO: the line collapses to a point, the symbol draws from it; URL on the word; legal ≥ 4 s | BLACK | — |

Phone on screen: f120–f216 and f708–f1206 = 594 f = **19.8 s** (plus the end card). Absent only for the droplet (4 s) and the
vial proof (16.4 s), both of which the voice requires.

---

## 2. Judges' weaknesses → fixes (all three verdicts)

| Raised by | Weakness in A | Fix in this bible |
|---|---|---|
| J1, J2, J3 | The 17 s middle act is the previous film's plate ladder with a headline on every plate | Two typed events only ("Independently tested. / JANOSHIK ANALYTICAL" on the turn plate, "99%" + "HPLC PURITY, MINIMUM" on the macro). "Every batch / every single one" is **light passes** (the measuring line crosses the vial once per word), "cold / 24 h" is **frost**, not type. "Pure." is never HTML room type: it is screen-printed in the scene once (S01) and reflected once (S02). |
| J3 (compliance) | S10 lifted the free-shipping card and the −8 % item card = the offer as the subject | The three slabs are the cart's own **quantity stepper "− 3 +"** (the thing that was tapped), the **compound name "BPC-157 / TB-500"** and the **line total "$234.57"** (quantity × product = total: "the math"). No discount line, no shipping line is ever lifted. Offers appear only as the cart's own text at native size, for ≈ 1.1 s, never called out. |
| J1, J3 | `cold.mp4` is not black (corners (2,8,12)–(2,13,18), centre column (70,99,120)): a second light source | `cold.mp4` is not used. "Shipped cold" = a numpy frost sequence crystallising over the held macro plate, then the phone arrives frosted (frost multiplied inside its own alpha). |
| J2 | S08–S09 were the 2D rig at the front pose: the previous film's phone look, a 2D zoom standing in for a camera move | **One Cycles take f738–f1188** (screen = image SEQUENCE captured from the HTML rig): the dive is a true dolly with roll to a perpendicular close pose (screen 1.6× REST, the site is the set), the cart math runs on the 3D screen with real glass reflections, the pull-out and tilt are one compound move, the orbit and exit continue without a cut. The 2D rig survives as the screen author and as the zero-cost fallback. |
| J3 | 2.6× push exceeds the 2× crispness of the 4K body layers | No 2D push. The close pose is rendered. |
| J3 | AgX on screen-off shots vs Standard on screen shots: rail highlights differ | **Standard view everywhere** (the rig's lights were tuned for it); a 2D soft-clip above 92 % on the phone layers outside `matte_screen`. |
| J3 | Full-frame DOF at 16 spp leaves noise OIDN smears | S02 at 24 spp, droplet at 32 spp (24 if the timing test says > 40 s/f). |
| J1 | The S02 reflected word is unproven | It is the **first Blender job**: three 720p frames (f120 / f150 / f180). Fallback: a 2D ghost under `matte_screen` driven by the screen corners (SHOTS S02). |
| J1 | `hero_34.png` shows the uncleaned lede | Every screen texture comes from `assets/site/clean/` only; `screen_home.png`, `screen_cart.png`, `screen_blank.png` from `clean/`; old renders are never used. |
| J2 (B) | Chips drifting beside the phone = the rejected composition | Slabs lift along the screen normal and stay over the screen; the orbit reveals their thickness and shadows. Nothing ever sits beside the phone. |
| J1, J2 | A had no authored CG material | S01: water (IOR 1.333), brushed steel (anisotropic 0.75), screen-printed ink, a rim strip and a travelling top strip. |
| all | Music: Track A is the previous ad's bed | One bespoke ElevenLabs music generation (estimated: 1 650 credits ≈ $0.30, ~102 s), 100 BPM half-time, drop 24.6, silence 39.6, hit 40.2; Track A re-cut is the zero-credit fallback (§6). |

---

## 3. Look

### 3.1 Studio rig (Blender 5, Cycles CPU, `assets/iphone/iphone.blend`; names and values from `tools/build_iphone.py`)

Camera: **85 mm, sensor 36 mm (horizontal fit), at (0, −0.760, 0) m looking +Y, fixed.** The phone empty `iPhone` moves; the camera and
lights never move (every proven cut-check, border crop and pose assumes this). REST = identity = `front_body.png` registration,
phone 900 px tall at 1080p. World: a dark grey Z-ramp (0.006,0.0065,0.008)→(0.11,0.115,0.125), strength 1.0, seen only in reflections
(`film_transparent`). All lights `visible_camera = False`.

| Light | Type | Size (m) | Location (m) | Energy / peak | Colour | Role |
|---|---|---|---|---|---|---|
| `Key` | area rect | 0.90 × 0.60 | (−0.75, −0.50, 0.55) | 6.0 W | (1.0, 0.985, 0.97) | key, up-left front |
| `Fill` | area rect | 0.80 × 0.80 | (0.70, −0.60, −0.25) | 2.0 W | (0.92, 0.95, 1.0) | fill, light-linked OFF the glass and covers |
| `Back` | area rect | 0.90 × 0.60 | (0.25, 0.75, 0.30) | 5.0 W | white | back light |
| `EdgeL` | area rect | 0.025 × 1.20 | (−0.22, 0.60, 0.02) | 3.0 W | (0.95, 0.97, 1.0) | kicker, crisp rim line left |
| `EdgeR` | area rect | 0.025 × 1.20 | (0.24, 0.62, 0.00) | 3.0 W | white | kicker, crisp rim line right (**the only light left on at the exit**) |
| `SoftL` | emissive gradient strip | 0.26 × 1.00 | (−0.40, 0.28, 0.05) | peak 4.0 | (0.95, 0.97, 1.0) | long gradient highlight on the left rail |
| `SoftR` | emissive gradient strip | 0.22 × 1.00 | (0.42, 0.30, 0.00) | peak 3.0 | white | right rail |
| `SoftFR` | emissive gradient strip | 0.45 × 0.60 | (0.75, −0.50, 0.25) | peak 0.9 | white | front-right fill on metal, linked OFF the glass |
| `SoftTop` | emissive gradient strip | 1.20 × 0.45 | (0.00, 0.05, 0.60) → target (0,0,0.02) | peak 5.0 | white | **the travelling band**: keyframed along X −0.30 → +0.30 m to draw a line of light across glass or rail |
| `SideL` | emissive gradient strip | 0.30 × 1.10 | (−0.55, −0.05, 0.05) | peak 4.0 | (0.95, 0.97, 1.0) | the bright line on the front rim radius |
| `SideR` | emissive gradient strip | 0.30 × 1.10 | (0.55, −0.03, 0.00) | peak 2.0 | white | idem right |
| `SheenCard` | emissive gradient card, reflections only | 0.125×0.23 × scale | y = −0.35 | ×0.22 | (0.93, 0.96, 1.0) | the diagonal sheen on the cover glass (max 13 %) |

**Thermometer (B's steal).** The key colour is the film's temperature. **Cold** from f0 until the wake: `Key` (0.90, 0.94, 1.00),
`EdgeL`/`EdgeR` (0.86, 0.92, 1.00), `Fill` (0.88, 0.93, 1.00). **Warm** from the wake: `Key` (1.00, 0.96, 0.91), `EdgeL`/`EdgeR`
(1.00, 0.98, 0.95), `Fill` (0.95, 0.95, 0.98); keyed over f803–f839 (36 f, ease 0.6/0/0.2/1). The site's own page white
(`#FBFCFE`) and the warm key are the only warmth in the film.

**Per-shot additions** (in `blender/common.py`, by name): `SoftTop` X keyframes (S02 band f192–f216; S10 glass crossing
f990–f1008); a `PureReflect` emissive plane visible to glossy rays only (S02); the slow show (`Key`/`Fill` energy 0 → 100 %
f750–f786, rims first); the exit (`Key`, `Fill`, `Back`, `Soft*`, `Side*` energies → 0 over f1158–f1186, `EdgeR` kept, `SideR`
kept at 50 %). The droplet shot (S01) is its own scene (no phone) with the same light family: a rim strip 0.20 × 2.00 m at
135° behind, 3× key; a top strip 0.10 × 1.50 m that slides X −0.30 → +0.30 m; the key 0.9 × 0.6 m fading up; two 0.05 m bulb spots.

### 3.2 Lens set (phone shots use the fixed 85 mm; "lens" = phone distance; the droplet has its own camera)

| Shot | Lens / distance | Field | DOF | Shutter |
|---|---|---|---|---|
| S01 droplet | **100 mm**, sensor 36, 0.32 → 0.26 m, 28° down | 100 mm wide at the drop | **f/2.8**, 7 blades, rotation 12°; focus Empty on the drop, rack to the print f96–f117 | 0.5 |
| S02 black glass | 85 mm, phone at y +0.084 m (0.844 m → 75 % frame height) | hero | **f/4**, 6 blades, 12°, focus on the glass centre | 0.5 |
| ARR + rest (f708–f830) | 85 mm, 0.76 m (REST) | hero | none (f/22) | 0.5 |
| dive → close pose (f830–f930) | 85 mm, 0.76 → **0.472 m** (1.6× REST, screen 1391 px tall) | the site is the set | none (f/22) | 0.5 (the dive is motion-blurred) |
| cards pose (f990–f1044) | 85 mm, **0.585 m** (1.3× REST) | close ¾ | **f/11**, focus 12 mm in front of the screen (keeps 0–28 mm readable) | 0.5 |
| hero (f1116–f1152) | 85 mm, 0.87 m (TILT1 + y 0.11) | hero ¾ | **f/5.6**, focus on the Dynamic Island | 0.5 |
| exit (f1152–f1188) | 85 mm, 0.844 m | edge-on | none | 0.5 |

DOF is one animated `aperture_fstop` curve on the take (f/22 = "off"; keyed to f/11 over f930–f945, f/5.6 by f1060, f/22 by f1160) with a
focus Empty parented to `iPhone` and offset per range (common.py `focus_mm(z)`). Rule (TECH §3): readable UI stays within ±1.5 cm of
focus or the stop is f/8 or smaller.

### 3.3 Materials (values)

- **Phone, as built:** Deep Blue anodised aluminium F0 `#33466E`, edge tint `#9FB2CF`, Metallic 1, roughness 0.30 with faint variation,
  anisotropic along the rail length; rim radii 0.9 / 1.1 mm; antenna resin `#141A26` roughness 0.32; cover glass flush with a 2.5D edge,
  100 % transmission + reflection (skin material), black ink border 1.63 mm; sapphire Camera Control / lens covers IOR 1.77 roughness 0.05;
  the display is an emission texture (strength 1.0, sRGB, Standard view → pixels round-trip within 0.77 levels). `screen_off.png`
  (1206×2622 pure black) = screen off, so reflections stay physically on the glass.
- **S01 bench:** graphite brushed steel, Metallic 1, Base (0.11, 0.115, 0.125), Roughness 0.34 ± 0.03 (noise breakup, scale 40/m),
  Anisotropic 0.75, rotation along X (brush direction), Bump 0.02 mm from a wave texture (bands 400/m, distortion 2). Dust: none.
- **S01 ink "pure":** Base (0.93, 0.95, 0.97), Roughness 0.55, Specular 0.3, raised 0.08 mm (displacement from the 4K word mask), DM Sans 800
  lowercase, cap height 9 mm, 52 mm wide.
- **S01 water drop:** Glass BSDF IOR 1.333, Roughness 0.00, a 7 mm sphere cut 0.4 mm above the plane with a 0.2 mm meniscus fillet,
  shadow-caustics off (fake caustic = the bulb spot through the drop at 0.1 W is enough).
- **S02 `PureReflect` plane:** 0.30 m wide, Emission (0.93, 0.96, 1.0) × E (E tuned 4–8), texture = mirrored 4K PNG of "pure" (alpha → Transparent
  mix), `visible_camera = False`, `visible_diffuse = False`, `visible_glossy = True`, `visible_shadow = False`. Target: 35–45 % sRGB peak on the glass.
- **S10 slabs (TECH §3 recipe):** rounded-rect outline (radius 15 pt for the stepper pill, 10 pt for the name and total) → bmesh face →
  extrude **1.0 mm** → Bevel 0.35 mm, 3 segments; size = capture rect × 0.1657 mm/pt × **1.10**; front = 6× capture crop in
  Mix(Emission 1.0, Principled roughness 0.28 + coat 0.35, fac 0.30); edges milky (Base 0.85, Roughness 0.6, Transmission 0.3, IOR 1.45);
  back = plain grey. `pass_index` 2. Shadows on the page from the shadow-catcher pass (dedicated 0.12 m area key up-left), multiplied inside
  `matte_screen` at 35 % with a 4 px blur, per frame in numpy before encoding.
- **Vial:** real plates only (`assets/plates/ai/`: hero, turn, cap, macro at 24 fps, 1:1), never CG, never a fake label.
- **Frost (2D, numpy):** `tools/make_frost_seq.py` grows crystals from the four frame edges toward the centre (DLA on a 1024² grid, seeded 7,
  upscaled with a 2 px blur), 48 frames, white + `#DCEBFF`, also written as `frost_density.json` (new frost pixels per frame → SFX crackle).
  The same generator, run on the phone silhouette, makes the frost that the arriving phone carries.

### 3.4 Palette (monochrome by rule; the device is the only colour outside the glass)

| Token | Value | Use |
|---|---|---|
| void | `#000000` | the only background in the film (matches the plates' measured 0,0,0) |
| void glow | `radial-gradient(60% 50% at 50% 55%, #0A1020 0%, #000 70%)` | centre lift behind the phone, 100 % in the take, 0 % on the plates |
| type | `rgba(255,255,255,.90)` | all display type (18:1) |
| small caps | `#C3CBD6` | labels, URL underline, legal (13:1 on black) |
| frost | `#FFFFFF` + `#DCEBFF` | frost crystals, the thaw's rim |
| steel | (0.11, 0.115, 0.125) linear | S01 bench |
| device | Deep Blue `#33466E` / `#9FB2CF` | the phone |
| site pixels | `#123A78` status bar, `#FBFCFE` page, `#16A48F` / `#2BB58A` fills | only ever inside the glass |
| brand | symbol gradient `#123A78 → #2A9AC2 → #16A48F`, wordmark `#DCEBFF → #A9E9DC` | end card only |

### 3.5 Grade (finishing, not rescue)

Standard view transform on every Cycles layer (exact screen colours; one family of highlights). Compositor: none (passes via File Output).
HyperFrames finish on `#fx`: grain 2 % (`assets/fx/grain0-7.png`, reseeded every 2 f with `PP.rng(5)`, **frozen f1188–f1206**), vignette 22 %
(0 % on the end card), chromatic aberration ≤ 2 px on exactly three moments (ARR glint f715–f721, dive peak f844–f850, exit f1168–f1176),
one additive light-leak plate 10 f at the wake (peak f815, warm, 18 %), a 2D soft-clip curve above 92 % on the phone layers outside
`matte_screen`. No LUT, no colour grading of the site pixels.

### 3.6 Four key frames

| KF | f | What you see |
|---|---|---|
| KF1 | 90 | Black brushed steel fills the frame at 100 mm, 28° down. A 7 mm water drop sits on the "u" of a white screen-printed **pure**, magnifying it. The top strip's reflection is a single bright point inside the drop and a soft line travelling along the brush; the rim strip carves the drop's edge. The key is at 70 %: the print is emerging. Everything else is black. |
| KF2 | 150 | The phone ¾ front, 75 % frame height, screen off: black glass with one rim line on the right rail (SideR) and the sheen. In the glass, a mirrored ghost of **pure** (≈ 40 % white) sits left of centre, drifting right as the phone turns. Nothing else in frame. Cold key. |
| KF3 | 1000 | The phone close (1.3×), spin 14° / tilt −5° / roll −2°, the real cart (cart3 at scroll 150) on screen, warm key. Three thin slabs have lifted 28 / 22 / 16 mm out of the glass: **"− 3 +"**, **"BPC-157 / TB-500"**, **"$234.57"**, 1 mm thick with milky edges, soft shadows on the page beneath. f/11, everything readable, black void around. |
| KF4 | 1120 | The phone in the ¾ hero pose, right of centre, the home page on screen with its own H1 "Purity, proven.". Left of it, 15 % further from the camera and 3 px soft: **Purity, proven.** (DM Sans 800, 120 px, white 90 %); the phone's left rail is sliding over the final period. |

---

## 4. Typography (fonts in `assets/fonts/`, woff2; all type is HTML except the printed "pure")

| Role | Face | Size | Where |
|---|---|---|---|
| In-scene print | **DM Sans 800** lowercase "pure" → `tools/text_png.cjs` → `assets/type/pure_4k.png` (alpha) | 52 mm wide in S01; the same PNG mirrored = the S02 reflection texture | S01, S02 |
| Proof line | **Inter 600** | 96 px: "Independently tested." | S05 |
| Small caps | **Inter 600**, caps, tracking +0.10 em, `#C3CBD6` | 36 px: "JANOSHIK ANALYTICAL", "HPLC PURITY, MINIMUM" | S05, S06 |
| Stat | **Inter 600** | 160 px cap: "99%" (the one exception to the 14 % height ceiling) | S06 |
| Room type | **DM Sans 800** (the site's H1 face), tracking −0.02 em | 120 px: "Purity, proven." | S11 |
| End card | wordmark SVG ≈ 560 px wide; tagline DM Sans 800 56 px; URL **Inter 500 40 px** with a 2 px `#C3CBD6` underline drawn as a line of light; legal **Inter 500 26 px** `#C3CBD6` | S13 |
| Symbols | `inter-symbols.woff2` (≥, −) | wherever U+2212 is set |

Rules: every text node ≥ 24 px at its rendered size, contrast ≥ 4.5:1 (all are ≥ 12:1 on black), inside title-safe x 96–1824 / y 54–1026,
every text state holds ≥ 36 f; reveals per glyph (opacity + 8 px rise, 1–2 f stagger, 18–22 f `expo.out`), exits 8 f `power3.in`;
type behind the focus plane gets a 3 px blur; the phone's alpha occludes room type for free (z-order). The site's own pixels are exempt
from the 24 px rule (real captures at native size) but every lifted slab line must measure ≥ 24 px (`tools/check_text.js` on the test frame).
