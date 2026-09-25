# PurePeptide — motion design néon 30 s (FR) · production contract

One HyperFrames composition (`index.html`, id `main`, 1080×1920 (9:16), 30 fps, 30.00 s), ONE paused GSAP
timeline, all tweens at **absolute seconds**. Style = the Trendtrack reference analysed in
`../reference-trendtrack/ANALYSE.md` (read §1–§3): near-black stage, permanent bottom halo, ONE neon accent
(brand teal pushed to neon `#2EE6C9`, gradient partner `#38BDF8`/`#5AA8FF`), bold geometric type (DM Sans 800),
words appearing exactly when the voice says them, dark UI cards with a neon edge, slight 3D, camera always
moving, cuts or "object" transitions (never fade-to-black), 3 flash+ring moments.

**Audience = prospects who don't know the technical terms.** Plain French only on screen: no "HPLC", "COA",
"spectrométrie", "lot n°", no acronyms, except inside a real site capture (that's fine, it's the site).

## Hard rules (compliance — binding)
- Only copy listed here / in `js/config.js` / `js/vo.js`. No invented numbers, claims, certifications, lab
  names, batch numbers, dates, reviews. No effect/benefit wording (no santé, récupération, muscle, perte de
  poids, anti-âge, résultats, bienfaits, traitement, dose, cycle, guérir…).
- Never show syringes, needles, pills, people, body parts, doctors, scales, dosages, protocols.
- Products: only the six in `PP.cfg.catalog` + the hero vial (`PP.cfg.heroVial`).
- Text/logos inside the safe zone **x 120→960, y 260→1400**. Vials/cards may extend beyond, but any text that
  matters must stay inside. Nothing under 24 px except text inside a site capture.
- Contrast ≥ 4.5:1 (white `#F3F6FA` or `#93A1B8` on the dark stage are fine; never neon text on a neon fill).
- Deterministic: no Math.random/Date/timers/callbacks for visual state (`PP.drive` for setters, `PP.rng(seed)`
  for pseudo-randomness); repeated props on one element → `fromTo` + `immediateRender:false`; never tween
  visibility/display/autoAlpha on a `<section>`; don't add `will-change`.
- Only edit YOUR files: `js/scenes/sN.js` and `css/sN.css` for your scenes. Do NOT edit `index.html`,
  `js/lib.js`, `js/global.js`, `js/config.js`, `js/vo.js`, audio. Need a helper? Write it inside your scene file.
  Found a bug in lib.js? Report it (exact fix) in your final message.

## Library (js/lib.js — read it) — what you get
`PP.scene(id, (tl, root, cam) => {})` register a scene (`cam` = full-frame wrapper for camera moves).
`PP.el / PP.svg / PP.fr` DOM + French typography. `PP.drive(tl, setter, from, to, at, dur, ease)` seek-safe setter.
Text: `PP.voHeadline(tl, parent, "L3", ["line 1", "line *2*"], "h1"|"h2"|"h3"|"h0", o)` → each word appears when
Hugo says it (display words must equal the VO line's words in order, `*word*` = neon gradient; returns
`{el, lines, words, times}`; position `h.el` yourself: `h.el.style.cssText = "position:absolute;left:0;right:0;top:300px"`).
`PP.headline`, `PP.wordIn`, `PP.textOut(tl, targets, at)`, `PP.popIn`, `PP.typeOn/PP.chars`, `PP.draw` (DrawSVG), `PP.checkIcon`.
Brand: `PP.logo(parent,{width})` (light wordmark for dark bg), `PP.symbol(parent, h)` (neon-bright symbol),
`PP.vial(parent, src, h)` (606×1240 catalog renders), `PP.heroVial(parent, h)` (1024×1536 big hero vial).
Neon recipes (reference §3):
- `PP.flashRing(tl, PP.layers.fx, at, {x, y, target})` — target (optional, an element with border-radius) goes
  solid neon over the 4 frames before `at`; ring bursts from (x,y) past the frame in 9 frames; bloom.
- `PP.cursor(parent, x0, y0)` → `.move(tl, x, y, at, dur)`, `.click(tl, at)`. Light the target 1 frame before.
- `PP.rollCounter(tl, parent, "99", at, land)` — digit strips spin with motion blur and land (font-size from parent).
- `PP.typedWordmark(tl, parent, width, at)` — official PUREPEPTIDE wordmark typed letter by letter + sheen.
- `PP.zoomThrough(tl, el, x, y, at, {amount, dur})` — 4-frame exponential zoom around a point.
- `PP.highlightBar(tl, parent, x, w, rows[{y,h}], times)` — neon bar gliding row to row.
- `PP.globe(parent, size)` → `.spin(tl, at, dur, turns)` wireframe globe.
- `PP.morphFromPill(tl, card, w, h, {dx,dy,w,h}, at)` — card grows out of a pill (clip-path).
- `PP.neonCard(parent, {x, y, w, h, radius})` → dark card with neon top-left edge `{el, body}`.
- `PP.pill(parent, text, {check})` dark neon-bordered pill. `PP.lens(parent, src, cssW, cssH, crop[x,y,w,h], width)`.
- `PP.F` = 1/30 s. Global layers: `PP.layers.fx` (full-frame layer ABOVE all scenes, for rings/bloom).
CSS classes available: `.grad` (neon gradient text), `.neon`, `.soft`, `.mono`, `.pp-h.h0/.h1/.h2/.h3`.

## Scene clips (data-start / end) — you own everything visible inside your section
| id | clip | VO | content |
| --- | --- | --- | --- |
| s1 | 0.00 → 4.25 | L1, L2 | hook: search bar + question, zoom-through the « o » of fiole |
| s2 | 4.10 → 8.30 | L3 | vial → independent lab; FLASH #1 at 8.00 (music drop) |
| s3 | 8.00 → 11.80 | L4 | analysis card: right product ✓, purity measured |
| s4 | 11.60 → 14.10 | L5 | giant 99 % roll counter; FLASH #2 at 12.00 |
| s5 | 13.90 → 18.00 | L6 | the website in action (browser), cursor click, lens |
| s6 | 17.80 → 22.20 | L7 | six vials, 24 h shipping, globe 10 countries |
| s7 | 21.90 → 30.00 | L8 | FLASH #3 at 22.00, typed wordmark, tagline, CTA click, legal |
Overlaps are hand-offs: the outgoing scene must be fully gone (opacity 0 / off-frame) by its clip end, and the
incoming scene must look right from its first frame.

## Voice-over (Hugo, js/vo.js — word onsets on the video timeline, s)
| Line | Placed | Words (onset) |
| --- | --- | --- |
| L1 | 0.30–1.70 | Vous .37 · achetez .44 · des .73 · peptides .84 · en 1.24 · ligne ? 1.31 |
| L2 | 1.95–4.23 | Mais 2.01 · savez-vous 2.08 · vraiment 2.59 · ce 2.99 · qu’il 3.28 · y 3.49 · a 3.59 · dans 3.66 · la 3.73 · fiole ? 3.80 |
| L3 | 4.50–7.76 | Chez 4.58 · PurePeptide, 4.83 · chaque 5.37 · lot 5.65 · part 5.85 · dans 6.09 · un 6.29 · laboratoire 6.42 · indépendant. 6.91 |
| L4 | 8.20–11.32 | On 8.27 · vérifie 8.34 · que 8.69 · c’est 8.85 · bien 8.99 · le 9.12 · bon 9.19 · produit, 9.36 · et 9.55 · on 10.05 · mesure 10.33 · sa 10.64 · pureté. 10.86 |
| L5 | 11.70–13.31 | 99 %, 11.76 · minimum. 12.46 |
| L6 | 14.00–17.47 | Et 14.07 · le 14.14 · rapport 14.21 · d’analyse 14.45 · est 15.02 · publié 15.09 · en 15.38 · ligne. 15.50 · Vous 15.78 · pouvez 16.00 · tout 16.35 · vérifier. 16.68 |
| L7 | 17.95–21.00 | Six 18.00 · références, 18.10 · expédiées 18.47 · sous 19.19 · 24 19.35 · heures, 19.62 · vers 20.26 · 10 20.35 · pays. 20.63 |
| L8 | 22.30–24.70 | PurePeptide. 22.36 · La 23.31 · pureté, 23.38 · prouvée. 24.31 |
Music: 120 BPM, beats on multiples of 0.5 s; tense ticking intro 0–8 s, **DROP at 8.00** (full beat after).

## SOUND-EVENT TABLE (the mix places SFX exactly here — put the matching visual on these times, ±1 frame)
| t (s) | sound | visual (owner) |
| --- | --- | --- |
| 0.40 → 1.20 | typing | "peptides" typed into a search bar (s1) |
| 1.32 | click | cursor clicks the search button / "Rechercher" (s1) |
| 2.00 | soft whoosh | hero vial rises into frame behind the question (s1) |
| 4.05 | whoosh | zoom-through the « o » of « fiole » (s1: 4.10→4.233) |
| 4.83 | pop | brand chip (symbol + wordmark) on « PurePeptide » (s2) |
| 5.37 | pop | pill « Chaque lot » (s2) |
| 5.85 | whoosh | vial travels along the neon path (s2) |
| 6.29 | pop | lab card grows out of a pill (s2) |
| 6.91 | tick | « Indépendant » check badge (s2) |
| 8.00 | RING (big) | FLASH #1: lab card → neon fill → ring (s2); s3 is revealed under it |
| 9.19 | tick | row 1 « C'est bien le bon produit » ✓ lights (s3) |
| 10.33 | tick | row 2 « Pureté mesurée » lights, bar fills (s3) |
| 11.62 → 12.00 | roll ticks | 99 rolls, lands at 12.00 (s4) |
| 12.00 | RING (big) | FLASH #2 behind the 99 (s4) |
| 12.46 | pop | « minimum » (s4) |
| 14.05 | whoosh | browser window flies in (s5) |
| 16.70 | click | cursor clicks the purity line on the product page (s5) |
| 16.76 | pop | zoom lens on « Vérifié · Pureté … · Certificat d'analyse inclus » (s5) |
| 18.00 18.083 18.167 18.25 18.333 18.417 | 6 pops | the six vials slam in, one every 2.5 frames (s6) |
| 19.35 | pop | « Expédition sous 24 h » card (s6) |
| 20.35 | pop | globe + « 10 pays » (s6) |
| 21.85 | whoosh | s6 exits (s6) |
| 22.00 | RING (big) | FLASH #3 (s7) |
| 22.36 → 22.91 | typing | wordmark typed (s7) |
| 24.31 | pop | « prouvée. » lands (s7) |
| 25.00 | pop | CTA pill « purepeptide.care » (s7) |
| 25.90 | click | cursor clicks the CTA (s7) |

## Test
`tools/snap.sh /tmp/claude-0/<your-dir> 4.0,4.2,…` → PNGs at exact times (look at them with Read). Run
`npx hyperframes lint` (0 errors). Check your hand-off frames (clip start and end) and every table time.
