# PurePeptide — "SPELLED OUT" · 45 s motion-design ad (EN) — production BRIEF

Director's synthesis of Concepts A (24.2), C (23.8) and B (20.5). The spine is **A — "Spelled out"**. It is tightened with
C's clean recapture, offer triad, "See for yourself" bridge and checkout dive, and with B's question-and-answer offer
phrasing. Every weakness the three judges raised is fixed; §9 maps each one to its fix.
The scene-by-scene build contract is `SCENES.md`. This file holds the idea, look, sound, voice and compliance.

Deliverable: **45.00 s, 1920×1080, 30 fps (1350 frames), English VO, HyperFrames (HTML + GSAP, one paused
deterministic timeline)**, `-14 LUFS / ≤ -1.5 dBTP`, owned channels only (paid ad platforms refuse the category).

---

## 1. The idea

> **PurePeptide doesn't print the word "pure". It spells the proof out.** The type becomes the vial, the vial's claims
> become a line, the line becomes the cold, the words fly into a real iPhone and land *exactly* on the live site's
> own headline. Then the real cart does the math, and its own discount lines step out of the screen as the offer.

**Throughline: one typeface.** The ad's hero face is **DM Sans 800**, the purepeptide.care H1 face. The site's H1 really is a
centred two-line "**Purity,** / **proven.**": "Purity," in teal `#0E7D6C`, "proven" in ink `#1B1E24`, then a teal period.
So the ad's last kinetic line FLIPs into the phone and becomes the real H1. It lands on the music drop, and the site
blooms out around it. Ad and store become one object.

**Tempo arc** (Apple "Don't Blink" grammar, built on the music):

| T (s) | Section | Pace |
|---|---|---|
| 0–3.5 | Stamp gag: cheap "pure" stamps accelerate, stall, then one clean "pure" | fast → stall |
| 3.5–9 | The type-vial is spelled out of the brand's claims, then sets into the real glass | build |
| 9–17.7 | Proof on the real vial: 99 % → purity line → every batch / Janoshik → COLD → 24 → 10 | measured, one claim per beat |
| 17.7–20 | Six compounds, one standard (music nearly silent) | **breath** |
| 20–22.5 | Word stream at 7–8 frames per word, "Don't take our word for it." | burst |
| 22.5–25 | The real iPhone flies in; "See for yourself."; the type lands on the H1 **on the drop** | drop |
| 25–36.2 | Real site → real cart. The cart does the math; three offer modules; checkout | fastest section |
| 36.2–41 | Navy: "PurePeptide. Purity, proven."; **total freeze** 40.5–41.0 | slow, then stop |
| 41–45 | Final hit: the period becomes the 14-dot symbol. Shop now · purepeptide.care. Legal. Silence. | hold |

**Wit:** "Anyone can print the word… pure." Cheap stamps against type that was earned. Then
"Don't take our word for it", spoken over a burst of our own words. Then "Now… let the cart do the math."

**Tone:** confident, precise, warm, never clinical-medical, never salesy. A lab notebook set by a Swiss typographer. Premium
restraint: one primary move plus one supporting move at a time, one accent colour per world.

---

## 2. Worlds and palette (CSS variables in `css/tokens.css`; grade last)

| World | Scenes | Background | Text and accents (contrast measured on that background) |
|---|---|---|---|
| **INK** | S01–S04 | `#000000`, which matches the AI plates exactly, plus a 25 % radial vignette | text `#F3F6FA` (19:1) · soft `#93A1B8` (7.4:1) · accent `#2EE6C9` (12:1) · cap-blue rows `#3F7FE8` (5.2:1) · crimp rows `#C3CBD6` |
| **PAPER** | S05–S09 | `#F5F8FB`, plus a soft top-left key `radial-gradient(1400px 900px at 20% 10%, #FFFFFF, #F5F8FB 70%)` | ink `#16233F` (14:1) · ink-soft `#5C697F` (5.2:1) · line `#E6EBF2` · H1 teal `#0E7D6C` (4.7:1) · H1 ink `#1B1E24` · callout teal `#0B6B5D` (5.6:1) · site teal `#16A48F` and bar green `#2BB58A` are **fills only, never text** |
| **NAVY** | S09 end–S11 | `radial-gradient(circle at 50% 45%, #123A78 0%, #0C2558 55%, #081536 100%)` | text `#F3F6FA` (10:1) · accent `#2EE6C9` (7:1) · legal `#C3CBD6` (6.7:1 at the darkest edge) · pill fill `rgba(255,255,255,.08)`, stroke `rgba(255,255,255,.32)` |

Brand assets keep their own colours: the neon symbol `#3F7FE8 → #35BDF0 → #27D9B4`, the light wordmark
`#DCEBFF → #A9E9DC`, and the device's Deep Blue aluminium.

## 3. Typography

All fonts are local woff2 files. The lead copies the missing ones into `assets/fonts/`, which already holds dm-sans 700/800,
inter 400–700 and plex-mono 500.

| Role | Face | Use | Source |
|---|---|---|---|
| Hero / display | **DM Sans 800** | All big type: "pure", "99%", "COLD", "24 / 10", word stream, "Purity, proven.", offer numerals. Tracking −0.02em, leading 1.0 | `assets/fonts/dm-sans-latin-800-normal.woff2` (= the site H1) |
| Labels | **Inter 600**, caps | Tracking +0.06…+0.18em: "MINIMUM.", "INDEPENDENTLY TESTED", module labels | `assets/fonts/inter-latin-600-normal.woff2` |
| Body / URL / legal | Inter 500 | URL pill, legal line | `assets/fonts/inter-latin-500-normal.woff2` |
| Symbols | inter-symbols | ≥, narrow no-break space | copy `/home/user/DevDoctor/ads/purepeptide-film-en/assets/fonts/inter-symbols.woff2` |
| Cheap stamps (S01 only) | Anton 400, Archivo 800/900, IBM Plex Mono 500, Inter Tight 300 | The fake "pure" stamps | copy `/home/user/DevDoctor/ads/purepeptide-film-en/assets/fonts/{anton-latin-400,archivo-latin-800,archivo-latin-900}-normal.woff2` and `/home/user/DevDoctor/ads/purepeptide-30s/assets/fonts/inter-tight-latin-300-normal.woff2` |

Rules:
- **No ad text under 24 px at its rendered size** (font-size × cumulative scale).
- Contrast ≥ 4.5:1. All text inside title-safe x 96–1824, y 54–1026.
- Every text state holds ≥ 25 frames. The only exception is the S05 word stream (Don't Blink), whose claims were each held ≥ 25 f earlier.
- Check that U+2212 "−" is in the DM Sans subset. If it is missing, set the minus in Inter 700 at the same size.

## 4. Texture, light, finish

- **Grain:** `assets/fx/grain0-7.png` (copy from film-en), overlay blend at 7 % on INK, 5 % on PAPER and 6 % on NAVY.
  Reseeded every 2 frames from `PP.rng`. **Grain freezes** during the stop beat f1215–f1230.
- **Vignette:** 25 % radial on INK and NAVY. None on PAPER: there the soft top-left key does the job.
- **One light source per world.** INK: the plates' own rim light. PAPER: top-left key, plus the phone's contact shadow
  `front_shadow.png`. NAVY: a centre glow.
- **One glass highlight sweep per shot** at most: a 105° band, screen blend, xPercent −120→120 over 30 f.
- **Chromatic aberration** ≤ 2 px, only on the COLD zoom-through (f468–474), the S05 whip (f600–606) and the
  checkout dive (f1078–1086).
- **No `backdrop-filter`** anywhere. The Safari glass becomes solid `rgba(250,251,253,.96)`. Blur only on small layers.

## 5. Craft rules applied (from the research bible; § numbers refer to it)

1. **Direction sets the ease (§A1).** Enter `expo.out` / `power4.out` / `cubic-bezier(0.23,1,0.32,1)`. Exit `power3.in`.
   Camera and FLIP `expo.inOut`. Overshoot only with `back.out(0.6–1.0)`, which is 1.2–3.7 % (§A2). Never `back.out(1.7)`.
2. **Durations at 30 fps (§A3).** UI micro-moves 4–8 f, entrances 12–18 f, camera 18–30 f, hero reveals 30–60 f.
   Sibling stagger 2–3 f (§A4).
3. **One primary move plus one supporting move (§A6).** Example: the phone camera moves *or* a module lands, never three things at once.
4. **Real pixels (§B7).** The site is genuine 3× captures of purepeptide.care. The screen is crisp HTML/PNG composited live,
   never baked. Shot order follows wide → readable pause → closer proof (§B8).
5. **Taps without hands (§B9).** A touch ring, the pressed control scaling to 0.97 for 3 f, the state change 2 f later, and a tick
   on the contact frame.
6. **Real momentum scroll (§B10).** An 8 f `power2.in` flick, then deceleration d≈0.998 over 13–20 f, then a hold. Velocity blur ≤ 2 px.
7. **Match cuts at the fastest frame (§C14).** 99% → line → turn plate cut at f336, the midpoint of a 16 f
   `expo.inOut`. Zoom-through mirrored `expo.in` → `expo.out` (§C10, technique 10). The whip blur hides the
   in-between frames (§C15).
8. **Every transition is motivated by an object or a direction of motion (§C13).** No transition type is used twice back to back (§C16):
   morph → light-band → object-led cut → contraction → zoom-through → light white-out → FLIP → whip → FLIP-into-screen →
   page pushes → button-becomes-world → particle-assembly.
9. **Don't Blink typography (§D17).** One- or two-syllable words, 7–8 f each, a deliberate stall before the payoff.
   Display tracking −0.02em (§D18). Reveals are per-word blur-in, masked lines, and FLIP (§D19).
10. **Palette discipline and grade last (§E21–22).** One accent per world, tokens in CSS variables.
11. **Sound to the frame (§F24).** Whooshes peak on the cut or fastest frame (test ±1 f). Risers end on the hit. Cuts land on the
    0.5 s beat grid (§F25).
12. **45 s pacing (§G26).** Product in frame from f0: the vial outline is being drawn as the stamps land. The promise lands by 6 s,
    the demo runs 6–30 s, the peak (cart) runs 28–36 s, the breath 36–40.5 s, the CTA ≥ 3.5 s. **It works muted** (§G27): every claim
    is set as large centred type, and every offer is repeated as an ≥ 120 px callout.
13. **Repo lessons (scout §1).** Real logo SVGs, real vial plates and the real website. An expressive human v4 voice. Coloured worlds,
    not only black. A promotional angle with the CTA written *and* spoken. The last music hit lands exactly on the logo cut, followed by
    0.5–1.6 s of silence.

---

## 6. Voice-over: exactly ONE ElevenLabs v4 take

- **Voice:** "Markmont", warm, deep and confident. Resolve the voice_id with `creative_list_voices`; the earlier session used
  `rTOopItG6FIkKMIVxsl5`. Model `eleven_v4`, stability **Natural**. Run `estimate_only` first and expect about 650 credits
  (711 per ~95 words). **One generation, no retries, no music generation, no video generation.**
- **86 words. The brand is spoken twice** ("PurePeptide" and the URL). Arc: soft and curious hook → confident proof →
  curious bridge → excited offers → warm sign-off.
- Pipeline: Whisper large-v3 → `tools/build_vo.py` cuts the take on its true silences, places each line at its **target
  start**, re-transcribes each clip, and writes `assets/audio/vo/L*.wav`, `lines.tsv` and `js/vo.js`. In `js/vo.js`,
  `VO.w(lineId, i)` is the onset of word *i*. Each line may slide ±0.25 s to keep its picture slot.
  Music-locked events (T 1, 9, 13, 25, 40.5, 41) never move.

### Paste-ready prompt (one continuous performance)

```
[softly] Anyone can print the word... pure. [curious] We'd rather spell it out.
[confident] Identity — confirmed. Purity — measured by HPLC. Ninety-nine percent. MINIMUM.
Every batch, independently tested... by Janoshik Analytical.
Shipped cold, within twenty-four hours... to ten countries.
[warmly] Six compounds. One standard. [pause]
[curious] Don't take our word for it. [confident] See for yourself. [pause]
[excited] Now... let the cart do the math. Two vials? Five percent off. Three or more? EIGHT percent.
Over two hundred dollars? Free shipping. [confident] Applied automatically, right in the cart. [pause]
[warmly] PurePeptide. Purity, proven. Shop now at purepeptide dot care.
```

### Line slots (targets for `build_vo.py`, frames = T×30)

| # | Target start | Line (tag) | Words | Picture lock |
|---|---|---|---|---|
| L01 | 1.20 (f36) | [softly] Anyone can print the word… pure. | 6 | clean "pure" lands on `VO.w('L01',5)` |
| L02 | 3.55 (f107) | [curious] We'd rather spell it out. | 5 | "pure" unspools on 'We'd' |
| L03 | 5.40 (f162) | [confident] Identity — confirmed. | 2 | rows 3–4 light up, ✓ |
| L04 | 7.10 (f213) | Purity — measured by HPLC. | 4 | rows 5–6 light up |
| L05 | 9.45 (f284) | Ninety-nine percent. MINIMUM. | 3 | "99%" per character |
| L06 | 11.30 (f339) | Every batch, independently tested… by Janoshik Analytical. | 7 | "JANOSHIK" ≈ 13.0 (accent) |
| L07 | 14.20 (f426) | Shipped cold, within twenty-four hours… to ten countries. | 8 | COLD; 24; flip to 10 at ≤ f498 |
| L08 | 17.95 (f539) | [warmly] Six compounds. One standard. | 4 | series burst, then six on the shelf |
| L09 | 20.40 (f612) | [curious] Don't take our word for it. | 6 | over the word stream |
| L10 | 22.70 (f681) | [confident] See for yourself. | 3 | phone appears |
| — | 23.5–26.2 | *no voice: fly-in, H1 landing, DROP, bloom* | — | — |
| L11 | 26.20 (f786) | [excited] Now… let the cart do the math. | 7 | product page, "The cart / does the math." |
| L12 | 28.70 (f861) | Two vials? Five percent off. | 5 | "+" tap #1 on 'Five' − 6 f |
| L13 | 30.30 (f909) | Three or more? EIGHT percent. | 5 | "+" tap #2 on 'EIGHT' − 6 f |
| L14 | 31.90 (f957) | Over two hundred dollars? Free shipping. | 6 | module C lands on 'Free' |
| L15 | 33.80 (f1014) | [confident] Applied automatically, right in the cart. | 6 | three ✓ stamps |
| L16 | 37.55 (f1127) | [warmly] PurePeptide. Purity, proven. | 3 | typed wordmark, tagline; **must end ≤ 40.20** |
| L17 | 41.70 (f1251) | Shop now at purepeptide dot care. | 6 | CTA pill sheen |

- Total: 86 words. Voice is present about 29 s of 45. The speech-free windows are 0–1.2, the drop 23.5–26.2, the
  dive 36.1–37.5, the stop beat 40.5–41.0 and the final hit.
- **Zero-credit fallback.** If a line is not word-perfect in Whisper (watch "HPLC", "Janoshik", "dot care"), splice the
  same-voice Markmont line from `/home/user/DevDoctor/ads/purepeptide-film-en/assets/audio/vo/` (see `lines.tsv`):
  - L04 → "Identity, confirmed. Purity, measured."
  - L06 → "Every batch, independently tested." The Janoshik part is then text only.
  - L05 → "Ninety-nine percent purity. Minimum."
  - L07 → "Shipped cold, within twenty-four hours."
  - L08 → "Six compounds. One standard."
  - L12 / L13 / L14 → "Two vials, five percent off." / "Three or more, eight percent off." / "Free shipping on orders over two hundred dollars."
  - L16 → "PurePeptide. Purity, proven."
  - L17 → "Shop now, at purepeptide dot care."

  **Never generate a second take.**

---

## 7. Music: reuse Track A (no generation)

**File:** `/home/user/DevDoctor/ads/purepeptide-film-en/assets/audio/music_raw.mp3`. It is 87.0 s, 120 BPM, centred on D,
with a real arc, a one-beat stop and a natural ending. Tracks B and C are too short and too flat.
Edit it in Python (copy `audiolib.py` and `mix_audio.py` to `tools/`, set `A.N = 45*48000`). Every offset is a multiple of 0.5 s, so the beat grid holds:

```
EDIT = [(8.0, 24.0, 1.0),    # S 8–24  → T 1–17   1 s fade-out T16–17
        (36.0, 60.0, 17.0),  # S 36–60 → T 17–41  1 s equal-power fade-in at T17
        (84.0, 87.0, 41.0)]  # S 84–87 → T 41–44  30 ms join; decays out ≈ 43.8
fader −3 dB · T 0–1 silent apart from the sub pre-lap · T 44–45 total silence (logo still on screen)
```

| T | Music | Picture lock (`js/cues.js`, never moved) |
|---|---|---|
| 0.0–1.0 | silence + sub pre-lap from 0.6 | stamps already slapping (they pre-lap the music) |
| **1.00** | swell (S 8.0) | `HIT1`: vial outline completes, a stamp lands |
| **9.00** | hit (S 16.0) | `HIT9`: the light band crosses the vial axis; type sets into glass |
| **13.00** | accent (S 20.0) | `ACC13`: "BY JANOSHIK ANALYTICAL" turns teal |
| 13–17 | decay | COLD, 24 → 10 |
| 16.5–19.5 | near-silence (fade join) | the six-vial **breath**, plus a sub bed at −30 dB |
| 17–25 | build; synthesized riser T 21–25 | word stream, fly-in |
| **25.00** | **DROP** (S 44.0) | `DROP`: the type lands on the real H1, the site blooms |
| 25–37 | kick every 0.5 s, hats on x.25 / x.75 | taps nudged onto beats when within ±2 f of their VO target |
| 37–40.5 | turnaround | navy, wordmark, tagline |
| **40.50–41.00** | **stop beat** (S 59.5–60) | `STOP`: total freeze, grain frozen, **no SFX** |
| **41.00** | final hit (S 84.0) | `LOGO`: 14 dots assemble the symbol |
| 44–45 | silence | end card static |

**Mix:**
- Music ducked by `vo_key` with bridged pauses: −6 dB T 1–24, −8 dB T 25–37, −11 dB under L16 and L17.
- Voice ≥ 8 dB above the music on every word (check with `--report`).
- SFX ducked −3/−4 dB under the voice.
- Voice chain: HPF 90 Hz, +1.5 dB at 4 kHz, 2:1, −15 LUFS.
- Master: `master()` → −14.0 LUFS, −1.5 dBTP, 48 kHz 24-bit `assets/audio/mix.wav`, always remuxed onto the render.

**Library retune (do first):**
- `impact` root → D1
- `stat_hit` → D2
- `shimmer` → D6/A6/D7/E7
- `sonic_logo` → click + A5→D6 tinks + 73.4 Hz swell
- Pitched SFX on D and A, with E and G as passing notes only. No F, F# or C#.

## 8. SFX, all synthesized locally (`tools/audiolib.py`, seeded)

Sampled files reused: `sfx_whoosh.mp3` (peak at 1.38 s) from `/home/user/DevDoctor/ads/purepeptide-film-en/assets/audio/sfx/`.
The time is the sync frame (±1 f). Gains are into the SFX bus. "new" means a short new function.

| # | T (s) / frame | Event | Recipe | dB |
|---|---|---|---|---|
| 1 | 0.00, 0.40, 0.73, 1.00, 1.23, 1.43, 1.60, 1.73, 1.83 (f0,12,22,30,37,43,48,52,55) | cheap stamps ×9 | new `stamp()`: 25 ms band-passed paper slap 1.2–4 kHz + 140 Hz body, random ±1 dB | −12 |
| 2 | 0.60→1.00 | sub pre-lap | `lp(noise,90)` + D1 sine swell into the music swell | −30 |
| 3 | `VO.w('L01',5)` ≈ 2.65 | clean "pure" | heavier stamp + D3 body + `bell(GLASS_TINK,'D6')` | −10 |
| 4 | 3.50–5.80 | glyph stream | new `grains`: sine grains 2–5 kHz on D/A/E, 20–60 ms, pan by x, density = glyphs landing per frame (exported by the S02 sub-render as `typevial_density.json`) | −24 |
| 5 | each row lock (≥ 35 ms apart); 5.50–5.83 | row ticks; cap snap | `tick(4200)`; cap snap = tick + `glass_tick('D7')` | −22 |
| 6 | 8.73→9.00→9.27 (f262–278, peak f270) | type sets into glass | noise light sweep + retuned `shimmer` D6/A6/D7/E7, peak at 9.00 on the music hit | −16 |
| 7 | first "9" of `VO.w('L05',0)` | 99% land | `stat_hit(D2)` + soft tick per character | −9 |
| 8 | 10.93→11.47 (f328–344) | 99% → line morph, cut at f336 | rising sine "zip" 300→2400 Hz through a band-pass, ending f336; `glass_tick('A6')` when the line seats (f356) | −20 |
| 9 | 13.00 (f390) | Janoshik turns teal | `glass_tick('D6')` on the music accent | −18 |
| 10 | 14.20→14.60 | line contracts to a point | short reverse swell ending f438 | −18 |
| 11 | 14.67 (f440) | COLD bursts | `impact`-lite (D2 body, no sub) + frost crackle (seeded 3–8 kHz noise grains, high-pass 6 kHz, 0.4 s) | −14 |
| 12 | peak 15.73 (f472) | zoom through the O | `whoosh(f0 300→2500)` with its peak on f472 | −12 |
| 13 | flip frame (≤ 16.60) | 24 → 10 split-flap | `tick` 2700/2880/3060 Hz, 2 f apart; then 10 rising `pop`s to D7, 1 f apart | −14 |
| 14 | 17.40→17.73 | light white-out | airy bloom (pink noise, band-pass sweep up) | −20 |
| 15 | 17.73, 17.87, 18.00, 18.13, 18.30, 18.50 | series burst swaps | `glass_tick` D6, E6, A6, D7, E7, A7 | −16 |
| 16 | 19.47–19.93 (f584–598) | six vials land on the shelf | six soft `vial_pop`, 2 f apart; sub bed D1 −30 dB under 16.5–20 | −20 |
| 17 | peak 20.10 (f603) | whip | `whoosh(dur .35)` panned 0.6→−0.6 | −12 |
| 18 | 20.20–21.70 (each word frame) | word stream | `tick(3000)` + low thump (D2, 40 ms) per word; a hush (nothing) on the stall | −16 |
| 19 | 21.00→25.00 | riser | `riser(dur=4.0, tone=('A4','A5'), ends_at=25.00)` | −15 |
| 20 | peak 23.07 (f692 = fastest rotation, source frame ≈ 20, edge-on) | phone fly-in | `sfx_whoosh` window 0.7–2.6 s, positioned so its 1.38 s peak lands on f692; plus a short alu "tsk" (6 kHz high-passed noise, 40 ms) on f692 | −11 |
| 21 | 25.00 (f750) | **DROP + landing** | `impact(root D1)` + 1–3 kHz click layer + new `alu_tick` (inharmonic 3.1 + 6.4 kHz, 50 ms), big send −16 | −8 |
| 22 | 25.03 (f751) | screen bloom | `tick(4200)` + `tap(body_hz=300)` + short `shimmer` | −14 |
| 23 | 26.00 (f780) | tap "Explore the catalog" | `tap(2350, body 380)` + new `haptic` (165 Hz, 30 ms, tanh) | −10 / −16 |
| 24 | peak 26.53 (f796) | Safari page push | `swipe(pan 0.55→−0.55)` | −18 |
| 25 | 27.53 (f826) | **add to cart** | new `add_to_cart`: tap + `pop('A6')` + `pop('D7')` +60 ms + haptic (rising fourth, a cousin of the logo) | −10 |
| 26 | 27.60 (f828) | cart badge | `pop('E7', dur .14)` | −13 |
| 27 | peak 28.27 (f848) | push to cart | `swipe` | −18 |
| 28 | `VO.w('L12',2)` − 6 f (≈ 29.40) | "+" tap #1 | tap + haptic; state +2 f: `pop('E7')`; price-roll ticks; bar fill = rising 1→4 kHz band 0.45 s | −10 / −21 |
| 29 | ≈ 30.13 (module A lands) | FLIP landing | `stat_hit(D2)` light + `tick` | −14 |
| 30 | `VO.w('L13',3)` − 6 f (≈ 31.00) | "+" tap #2 | tap + haptic; bar fill to full → `soft_chime('D6','A6')` at unlock (+14 f) | −10 / −14 |
| 31 | ≈ 31.6 / ≈ 33.0 | module B / module C land | `stat_hit(D2)` light + `tick` | −14 |
| 32 | `VO.w('L15',0)` + 0, 4, 8 f | three ✓ stamps | new `stamp_soft` (10 ms click 3 kHz + `glass_tick('A6')`) | −16 |
| 33 | 34.33→35.07 (f1030–1052) | momentum flick | `swipe` −22 dB + a 4.5 kHz tick train whose gaps widen with the deceleration | −22 / −28 |
| 34 | 35.47 (f1064) | tap "Proceed to checkout" | tap + haptic (sits on the 35.5 beat +1 f) | −10 |
| 35 | 35.53 (f1066) | URL pill lifts | airy lift (`swipe`, high band) | −20 |
| 36 | peak 36.17 (f1085) | **button becomes the world** (dive) | rising dive `whoosh` peaking at f1085, then a low D2 "thoomp" at f1086 | −11 / −12 |
| 37 | `VO.w('L16',0)` | typed wordmark | 11 soft type ticks (`tick(5200)`, −28 dB) + one `shimmer` grain on the sheen | −28 |
| 38 | 40.50–41.00 | **stop beat** | **nothing**; optionally `reverse_swell` (reversed hall D6 bell) ending exactly at 41.00 | −24 |
| 39 | **41.00** (f1230) | **logo** | `sonic_logo` (seal click → A5, D6 tinks +90 ms → 73.4 Hz swell, ≈1.4 s) + 14 glass grains on the flying dots (D/A/E 7) | −4 / −20 |
| 40 | 41.0→44.0 | ring-out | `tail()` in D5/A5, gone by 44.0; 44.0–45.0 silent | −14 |

---

## 9. Judges' weaknesses → fixes

| Raised by | Weakness | Fix in this bible |
|---|---|---|
| J1, J2, J3 | Compliance hole: the home lede says "…certificate of analysis", the "See the tests" chip carries the Janoshik mini-logo, and the ticker shows "SECURE CHECKOUT" | **Clean recapture** (SCENES P0-A) with `visibility:hidden` (layout and coordinates unchanged) on the lede, `.hero__jano`, `.pd__cat`, `.pd__coa`, `.pd__pairs`, `.pp-express` and `.cart-addon`. Ticker frozen with every "SECURE CHECKOUT" item hidden. Home cropped at page y 900 (Retatrutide is at y 1146 and below). Plus a forbidden-word QC gate. No colour patches. |
| J3 | The fly-in being rendered uses `screen_home.png`, which shows the uncleaned lede | Re-render the fly-in with a **blank light screen** (`screen_blank.png`, P0-B). That also solves "dark ink lands on a dark screen" at the H1 landing. |
| J1 | kEff 1.03 is wrong | **K = 400.31 / 402 = 0.99580** stage px per screen pt (from `screen_rect.json`). All screen maths goes through `PH.stage()`. |
| J1, J2 | Offers omit "same compound"; no frame shows all three offers | C's **offer triad**: "2 VIALS · SAME COMPOUND −5%", "3+ VIALS · SAME COMPOUND −8%", "FREE SHIPPING $200+", stamped "APPLIED AUTOMATICALLY ✓". All three hold together beside the phone for ≥ 1.3 s. |
| J1, J3 | Overbuilt, with plate-matching risk | **Cut:** the orbit ring, the macro-stripe seat, the HPLC-like peak and the SVG goo rise. **Kept:** the type-vial (pre-rendered to MP4), the light-band reveal, COLD, the word stream. Each AI-plate join has a hard-cut-on-the-beat fallback. |
| J2 | 6.6 s voice gap | L09 "Don't take our word for it." and L10 "See for yourself." fill 20.4–23.5. Only the drop (23.5–26.2) is voice-free. |
| J2 | No verb in the CTA; category not stated | "Shop now at purepeptide dot care" (VO), and a "Shop now · purepeptide.care" pill. The site's own "RESEARCH PEPTIDES" eyebrow is lifted as a callout at the landing (S07). |
| J1, J2 | Phone runs exactly 14.0 s with no slack | Phone visible f682–f1086 = **13.47 s** (0.53 s slack). |
| J1, J3 | The fly-in starts on the phone's back; 1.5× retime judder | Use the real pose (back → edge-on → front). Retime only by **uniform** steps: source step 2 for frames 0–42, then step 1 for 44–89. Speeding up never strobes. |
| J1 | 180 px type clutters the spinning phone | The type sits *still*, centred exactly over the future H1 (960, 553). The phone flies in **behind** it and comes to the words. |
| J3 | Rebuilt ticker carries an unapproved claim | The ticker is not rebuilt or animated. It is a frozen capture showing only approved items. |
| J2 | Funnel must move forward | It ends on "Proceed to checkout". The navy button floods the frame (C's dive), and the Safari URL pill lifts out and becomes the CTA pill (A). |
| J3 | Text at the 24 px floor, softness at kEff 2.4 | Phone zoom capped at **g ≤ 2.0** (the body layers are 2× renders). The type-vial rows stay at 24.9 px; that is accepted, and those rows are texture repeated by the VO. Everything the viewer must read is ≥ 34 px. |
| B (dropped) | Invented country list, chromatogram axes | Not used. "10 countries" is shown as ten dots, with no names. No axes or peaks anywhere. |

---

## 10. Compliance checklist (gate before every delivery render)

- [ ] **Allowed claims only:**
  - every batch independently tested (Janoshik Analytical, **text only**, no logo; the chip is hidden)
  - identity confirmed
  - purity by HPLC, 99 % minimum
  - shipped cold within 24 hours
  - ships to 10 countries (no names)
  - six compounds (names only as printed on the vial labels)
  - 2 vials −5 %, 3+ vials −8 % (same compound), free shipping over $200, applied automatically in the cart
  - "Purity, proven."
  - purepeptide.care
- [ ] **Never shown or said:**
  - people, hands, fingers, faces, body parts, syringes, needles, pills, injections, doctors
  - dosages, protocols, effects or benefits (health, recovery, muscle, weight, anti-aging, results, benefits, heal, treatment, dose, cycle)
  - invented numbers, certifications, reviews, awards, competitor names
- [ ] **No "certificates published online"** wording or visual: the lede is hidden, the COA pill is hidden, the "See the tests" chip is hidden.
- [ ] **Retatrutide never visible.** Home is shown only at scroll 0 and is cropped at page y 900. The shop page, the drawer and the gate are never used. The tilt-out render is never used (it shows BAC Water).
- [ ] **Never readable:** RECOVERY pill, "tissue repair", "bacteriostatic / reconstitution", BAC Water, COA, G Pay, "Pharmaceutical-grade", MT-2, category chips.
- [ ] **Run the QC script** `tools/qc_frames.sh`: a contact sheet every 0.25 s over T 22–37, read by eye, plus an OCR pass that fails on: `certif|COA|bacterio|reconstitut|Retatrutide|Recovery|repair|G Pay|Pharmaceutical|SECURE`.
- [ ] **Taps** are rings only. No finger or hand anywhere.
- [ ] **Legal line** on the end card for 4.0 s (f1230–f1350), Inter 500 **26 px**, `#C3CBD6` on navy (≥ 6.7:1), exactly: "For laboratory research use only · Not for human or veterinary consumption · 21+".
- [ ] **Type checks:** every ad text node ≥ 24 px rendered, contrast ≥ 4.5:1, inside x 96–1824 / y 54–1026. Run `tools/check_text.js` over a snapshot every 0.5 s.
- [ ] **No Apple logo** on the device; the model has none. iOS UI is drawn from public conventions only. No iOS system sounds.
- [ ] **English only.** Owned channels only. The README discloses that the "Explore the catalog" tap skips the shop grid in the edit (editorial ellipsis), and that prices are the 2026-10-06 captures (re-capture on release day).
- [ ] **ElevenLabs spend:** one v4 VO take (~650 credits). No music or video generation.

Next: see `SCENES.md` for the build contract.
