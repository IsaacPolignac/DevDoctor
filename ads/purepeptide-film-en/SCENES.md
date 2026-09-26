# PurePeptide — product film, 60 s, 16:9, English, PROMO cut with voice-over · edit decision list

Built on the measured grammar in `../recherche-pubs/04-analyse-image-par-image.md` (read « La grammaire Apple / premium,
mesurée » + the blueprint). 1920×1080, 30 fps, 60.00 s, one paused GSAP timeline, absolute seconds. Soundtrack is
final: `assets/audio/mix.wav` (`tools/mix_audio.py`) — the picture must land on its cues (table below, ±1 frame).

## Grammar (binding, measured)
- **Black world** only. One hard light source per shot (rim/strip). Accent colour comes from the product (blue cap,
  label gradient), not from backgrounds. No neon UI, no flash frames, no glow gimmicks.
- **Cuts are hard cuts** (≥ 90 %). Only the opening fades in. Light « turns on » through cuts, not fades.
- **Push-ins are slow**: 0.8–1.6 %/s on hero/luxury shots; pull-outs −1 to −2 %/s; speed ramps (8–15 %/s) only in the
  acceleration block. Specular sweeps cross the frame at 14–37 %/s (median ~20 %/s).
- **Text is small and rare**: 2–8 % of frame height (22–90 px), Inter 600 (Apple-like), white or light grey, centred or
  beside the product; enters on a cut (0–3 frames) or word-by-word over ~1–1.3 s; stays 2.5–4 s; leaves on the cut.
  Total text ≈ 8–12 s out of 60. No gradients on text except the end tagline accent is allowed but not required.
- **Product held**: reveal 2.5 s; detail 1–1.5 s; insert 0.25–0.5 s; signature shot 4 s.
- Content rules: English; research positioning; no people/body/syringe/pills/dosage/effect claims; only these claims:
  « Every batch. Independently tested. » · « 99% purity. Minimum. » · « Shipped cold. Within 24 hours. » ·
  « Purity, proven. » · « purepeptide.care » · legal « For laboratory research use only · Not for human or veterinary
  consumption · 21+ » (legal visible on the end card ≥ 3 s, ≥ 24 px).

## Picture sources
1. **Blender Cycles (photoreal, preferred for hero moments)** — `assets/footage/hero.mp4` (3.0 s, 1920×1080, centred hero,
   slow push, rim light rising) and `assets/footage/turntable.mp4` (4.0 s, 120° turntable on glossy black floor).
   Hi-res STILLS are being rendered at 2560×1440 into `../purepeptide-blender/renders/` (look for `*still*.png`:
   macro_still, cap_still, hero_still, rim_still, label_still). Copy them into `assets/footage/` when present; animate
   them with slow 2D push/pull + masked light sweeps (a still at 2560 px supports ~1.3× push without softness).
   Until a still exists, use the fallback noted per shot.
2. **Three.js real-time vial** — `../purepeptide-3d-proto/` (js/vial3d.js, js/label.js, three in assets/vendor/three):
   fully animatable camera/lights, deterministic from the timeline. Use it for camera moves the stills can't do
   (orbits, speed ramps, macro glides) — grade it to match Blender (tone, black level, rim).
3. **Real catalog renders** `assets/vials/*.png` (606×1240, six products + hero.png) — for the burst and the line-up.
4. Brand SVGs `assets/brand/` (brand-symbol.svg, brand-wordmark-light.svg).

## Edit decision list (T = video time, s)
| # | T in → out | Shot | Source / move | Text |
| --- | --- | --- | --- | --- |
| 1 | 0.00 → 2.00 | black, silence (fade in from 1.6) | — | — |
| 2 | 2.00 → 6.00 | a single line of light draws the vial's silhouette (shoulder, then body) — nothing else visible | rim_still + animated gradient mask sweeping 20–25 %/s (fallback: three.js dark scene, one strip light moving) | — |
| 3 | 6.00 → 8.00 | macro: aluminium crimp ribs, push 1 %/s | cap_still crop (fallback three.js macro) | — |
| 4 | 8.00 → 10.00 | the blue cap alone lit in the dark (tension) | cap_still with a radial dark mask (fallback three.js) | — |
| 5 | 10.00 → 12.50 | **REVEAL** hard cut: whole vial, 3/4, pool of light, push 0.8 %/s (music hit 10.00) | Blender hero.mp4 (0–2.5 s) | — |
| 6 | 12.50 → 14.50 | brand card on black: PurePeptide symbol + wordmark, wordmark ≈ 4 % of height, cut in/out (sonic logo 12.50) | SVG | wordmark |
| 7 | 14.50 → 20.00 | details/inserts, cuts at **14.5 · 15.5 · 16.0 · 17.0 · 17.4 · 17.9 · 18.9 · 19.4** (1 s / 0.5 s alternation); label logo, glass shoulder edge, powder cake through glass, crimp, cap ridge; sweeps ~30 %/s on 15.5 and 18.9 | label_still / macro_still crops + three.js macros | — |
| 8 | 20.00 → 24.00 | **signature**: turntable, camera still, light fixed | Blender turntable.mp4 (4 s) | — |
| 9 | 24.00 → 27.00 | vial in the left third (hero_still or last turntable frame), card built word by word in ~1 s then held | hero_still (fallback hero.mp4 last frame) | « Every batch. » / « Independently tested. » |
| 10 | 27.00 → 33.00 | 4 macros × 1.5 s (cuts 27.0 · 28.5 · 30.0 · 31.5), pull-out −2 %/s | label_still, macro_still, cap_still, three.js | 30.00–33.00: « 99% purity. Minimum. » |
| 11 | 33.00 → 36.00 | cold light: vial silhouette in cold blue-white backlight, frost-like haze | hero_still graded cold (fallback three.js cold light) | « Shipped cold. » / « Within 24 hours. » |
| 12 | 36.00 → 38.00 | **burst**: 8 shots × 250 ms, identical framing, only the product changes (six catalog renders + 2 repeats) | assets/vials/*.png centred, same size, same light | — |
| 13 | 38.00 → 39.00 | the last vial held 1 s | hero.png or Blender still | — |
| 14 | 39.00 → 46.00 | **acceleration** (music DROP 39.00, beats 39 + 0.5k): 4 × 1 s (39–43), 4 × 0.5 s (43–45), 4 × 0.25 s (45–46); speed ramps 8–15 %/s, orbit moves, flares | three.js orbits + Blender turntable/hero sped up | — |
| 15 | 46.00 → 50.00 | line-up of the six vials aligned, final light sweep ~20 %/s | assets/vials/*.png on glossy black floor with reflections | — |
| 16 | 50.00 → 53.00 | single vial backlit in smoke (volumetric look) | hero_still/rim_still + 2D animated smoke (SVG feTurbulence driven by timeline) | — |
| 17 | 53.00 → 60.00 | **cut to logo** (final hit 53.00): symbol ≈ 13 % height + wordmark, one light sweep across in 1.2 s; 54.20 « Purity, proven. » (≈ 3.5 % height); 55.00 « purepeptide.care »; legal line from 53.4; hold, silence from 58.9 | SVG | as listed |

## Promo cut (v2) — voice, worlds, offers
Voice-over: Kokoro `am_fenrir` (ElevenLabs credits exhausted), one file per line in `assets/audio/vo/`, placed at the
times in `assets/audio/vo/lines.tsv`, word timings in `vo_words.json` (Whisper large-v3). Music ducked −8 dB under
the voice. Changes to the EDL above:
| T | Shot | VO / text |
| --- | --- | --- |
| 2.4 · 6.3 | (as above) | « Most labels promise purity. » · « Few can prove it. » |
| 12.75 | brand card | « This is PurePeptide. » |
| 20.3 | turntable | « Identity, confirmed. Purity, measured. » |
| 24.15 · 30.0 · 33.15 | cards as above | VO says the card |
| 36–38 | burst: each vial on a different world (white · brand blue · black · grey · navy · sky · white · blue) | « Six compounds. One standard. » |
| 39–42 | acceleration trimmed to 3 × 1 s | « Buy more, save more. » (text 39.2–41) |
| 42–44 | **white studio**, 2 vials | « 2 vials / 5% off » on « Two vials, five percent off. » |
| 44–46 | **brand blue**, 3 vials | « 3+ vials / 8% off » |
| 46–50 | line-up on **white studio** | « Free shipping over $200. » + « Discounts applied automatically in the cart. » |
| 50–53 | smoke (black) | « No promises. Just proof. » |
| 53–60 | logo on **navy** world; « Purity, proven. » 54.26; **« Shop now » button** 55.7 (click 56.6); purepeptide.care 56.14; legal from 53.4 | « PurePeptide. Purity, proven. » · « Shop now, at purepeptide dot care. » |
Offers are the site's own (shop + cart, applied automatically). The v1 no-VO grammar rules (black world only, rare text) are
deliberately relaxed for this promo cut.

## Sound cues already in the mix (land the picture on them)
2.0 sub bed + light shimmer · 6.00 tick (crimp) · 8.00 cap click · 10.00 glass tink (reveal, music hit) · 12.50 sonic
logo · insert ticks on 14.5 15.5 16.0 17.0 17.4 17.9 18.9 19.4 · shimmers 15.5, 18.9, 20.2 · 24.0 soft whoosh · ticks 27.0
28.5 30.0 31.5 · 33.0 shimmer · burst ticks 36.00 + 0.25k (k = 0…7) · 38.0 tink · 39.0 41.0 43.0 45.0 whooshes · 45.0–45.75
ticks · 46.1 shimmer · 50.1 shimmer · **53.00 final hit + sonic logo + long tail** · silence from 58.9.

## Test
`tools/snap.sh /tmp/claude-0/<dir> t1,…` + PIL contact sheets; `npx hyperframes lint` 0 errors; render
`npx hyperframes render --quality delivery -o renders/purepeptide-film-en.mp4`.
