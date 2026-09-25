# PurePeptide — « PROOF » 60 s, 16:9, ENGLISH · production contract

One HyperFrames composition (`index.html`, id `main`, **1920×1080**, 30 fps, **60.00 s**), ONE paused GSAP timeline,
absolute seconds. This is the English remake of the French manifesto (`../purepeptide-manifeste-60s/`): **reuse its
scene code** (`js/scenes/*.js` here are copies of the French scenes) and adapt copy + timing. Research that drives this
cut: `../recherche-pubs/01-grandes-marques.md` and `02-ecom-dtc.md` — read the « principles » sections.

## What the research changes (binding)
1. **Brand within 3 s**: the film OPENS on the PurePeptide vial (logo on the label) with the sonic logo at 0.00 — brand on
   the product, not a floating logo.
2. **Hook = a sharp contrast line** (« Anyone can print 99% on a label. »), then pain, then 0.4–1 s of silence before the turn.
3. **Proof = one title + one number per shot, held ≥ 2 s** (Dyson product-film pattern). Text on screen ≥ 0.2 s/word + 2 s.
4. **Sound-off readable**: every VO line must be readable on screen when it is spoken — either as the big type or as a
   clean caption (Inter 600, 38 px, white on a subtle dark pill, bottom-centre y≈960). No line may be audio-only.
5. **Demo** = the real website (recorded live), then a clear **offer** (real site offers only), then climax, 0.75 s
   near-silence, logo + sonic logo, end card 4–6 s+ with tagline ≤ 5 words, URL, legal.
6. **Research positioning** (legal): speak to researchers; no human-use cues; legal line visible on the end card and a
   small « For laboratory research use only » tag during the demo/offer.

## Hard rules
- English only on screen. Only copy from here / `js/config.js` / `js/vo.js` / the site recording. No invented numbers,
  certifications, reviews, competitor names (« anyone » stays generic). No effect/benefit/body wording; no people, body
  parts, syringes, pills, dosages. Products: `PP.cfg.catalog` + hero vial; `PP.cfg.fakeShelf` only in the pain section.
- Text inside x 96→1824, y 54→1026; ≥ 24 px (captions 38 px); contrast ≥ 4.5:1.
- Deterministic (PP.drive / PP.rng; fromTo + immediateRender:false for repeated props; no Math.random/Date/timers;
  no visibility tweens on sections; no will-change). Measure text with canvas `measureText` (clips may be hidden at build).
- Gradient accents: mark each word separately (`*proven.*`).
- Only edit YOUR scene files. Report lib/index bugs with the exact fix.

## Scenes
| id | clip | content |
| --- | --- | --- |
| s1 | 0.00 → 12.10 | 0.00–2.40 BRAND OPEN: hero vial macro, light sweep reveals the logo (sonic logo at 0.00); 2.40 hard cut → PAIN on the fake shelf: L01–L03 |
| s2 | 11.95 → 17.20 | TURN: black at 12.00 (impact), « WE DO. » 12.30; riser 14.5→17 with the hero vial emerging; DROP 17.00 flash (`PP.flashRing` at 17.00) |
| s3 | 17.00 → 31.50 | PROOF blocks L05–L09, then L10 « Don’t take our word for it. », then 30.60 « CHECK IT YOURSELF. » slam (full-frame black), gone by 31.45 |
| s4 (+ `#sitetest` 31.40→45.60, + s4o) | 30.90 → 47.60 | REAL SITE TEST (English recording) with step labels + keyword lower-thirds; 45.60–47.40 OFFER full-frame; exit 47.30 |
| s5 | 47.30 → 60.00 | six vials line-up 47.50…48.75, « NO PROMISES. » 49.50, « JUST PROOF. » 50.39, flash 51.00, silence, logo 52.40 (+sonic logo), « Purity, proven. » 53.60, CTA 55.00 / click 56.00, legal |

## Voice-over (English, js/vo.js — word onsets, s)
| Line | Placed | Words |
| --- | --- | --- |
| L01 | 2.60–5.20 | Anyone 2.60 · can 2.83 · print 3.11 · 99% 3.39 · on 4.43 · a 4.69 · label. 4.79 |
| L02 | 5.80–7.61 | Anyone 5.80 · can 6.02 · say 6.22 · “lab 6.58 · tested.” 6.98 |
| L03 | 8.40–10.07 | Almost 8.40 · no 8.63 · one 8.85 · shows 9.09 · you 9.33 · the 9.53 · proof. 9.67 |
| L04 | 12.30–12.86 | We 12.30 · do. 12.42 |
| L05 | 17.30–19.53 | Every 17.30 · batch, 17.45 · sent 17.73 · to 18.23 · an 18.43 · independent 18.55 · lab. 18.81 |
| L06 | 20.00–21.32 | Identity, 20.00 · confirmed. 20.48 |
| L07 | 22.00–22.93 | Purity, 22.00 · measured. 22.23 |
| L08 | 23.50–25.36 | 99%. 23.50 · Minimum. 24.29 |
| L09 | 26.00–28.08 | Shipped 26.00 · cold, 26.24 · within 26.52 · 24 26.96 · hours. 27.36 |
| L10 | 28.80–30.16 | Don’t 28.80 · take 29.05 · our 29.17 · word 29.39 · for 29.59 · it. 29.81 |
| L11 | 30.60–31.53 | Check 30.60 · it 30.81 · yourself. 30.87 |
| L12 | 36.20–37.23 | Pick 36.20 · your 36.32 · compound. 36.44 |
| L13 | 39.20–40.91 | See 39.20 · the 39.32 · purity. 39.42 · Verified. 39.72 |
| L14 | 42.00–42.50 | Order. 42.00 |
| L15 | 42.80–46.35 | Two 42.80 · vials, 42.92 · 5% 43.36 · off. 43.96 · Three 44.64 · or 45.04 · more, 45.16 · 8%. 45.48 |
| L16 | 49.50–51.33 | No 49.50 · promises. 49.67 · Just 50.39 · proof. 50.75 |
| L18 | 52.40–53.32 | PurePeptide. 52.40 |
| L19 | 53.60–54.63 | Purity, 53.60 · proven. 53.86 |
Music (same ElevenLabs track, re-edited): sparse intro, big hit 12.00, riser 14.5→17, **DROP 17.00** (beats 17 + 0.5k),
near-silence dip 51.30→52.45, tail ends ~58.5.

## Real site test (#sitetest, English, 1920×1200 = 1440×900 css @1.3334, marks on the video timeline)
gate 31.40 · tick 1 32.4 · tick 2 33.0 · « Enter PurePeptide » 33.667 · home 34.6 (« Purity, proven. » hero) ·
« Explore the catalog » click 35.5 · shop grid 35.533 · BPC-157/TB-500 click 38.033 · product page 38.067 ·
purity line outlined 39.167 (« Verified · HPLC purity 99.0% · Certificate of analysis included ») · « Add to cart » click 42.067
(AJAX; page scrolled to bundles + « Ships within 24 h · Free shipping over $200 ») · floating « Cart » click 43.167 · cart drawer
43.4 → 45.60 (shows « $115.01 away from free shipping »). Reuse the French s4/s4o camera function and re-target the push-ins.

## SOUND-EVENT TABLE (already in the mix — visuals must land here ±1 frame)
| t (s) | sound | visual |
| --- | --- | --- |
| 0.00 | SONIC LOGO (seal click + glass tink) | first frame: vial label/logo catches the light (s1) |
| 2.40 → 12 | neon hum; flicker dips at **2.75 · 4.30 · 4.45 · 6.80 · 9.10 · 9.20 · 11.70** (60 ms each) | image dims ~70 % for 2 frames (s1) |
| 3.39 · 6.58 · 9.67 | type slam | « 99% » (3.39) · « “LAB TESTED.” » (6.58) · « PROOF. » (9.67) (s1) |
| 12.00 | impact | hard cut to black (s2) |
| 12.30 | slam | « WE DO. » (s2) |
| 16.90 / 17.00 | whoosh / RING + impact | DROP: flash + ring, hero vial lit (s2 fires ring; s3 under) |
| 18.55 | pop | « INDEPENDENT LAB » card + « Janoshik Analytical » (s3) |
| 20.48 | tick | « IDENTITY ✓ confirmed » (s3) |
| 22.23 | tick | « PURITY » measured bar completes (s3) |
| 23.62→24.00 / 24.00 | roll ticks / RING | « 99% » roll lands 24.00 + flash (s3) |
| 24.29 | pop | « MINIMUM. » (s3) |
| 26.24 · 26.96 | pops | « SHIPPED COLD » (26.24) · « 24 H » (26.96) (s3) |
| 28.75 | whoosh | → « Don’t take our word for it. » (s3) |
| 30.60 | slam | « CHECK IT YOURSELF. » (s3) |
| 31.40 | whoosh | browser window with the English site test flies in (s4) |
| 32.4 · 33.0 · 33.667 · 35.5 · 38.033 · 42.067 · 43.167 | clicks | real clicks inside the recording |
| 43.36 · 45.48 · 46.20 | pops | offer: « 2 VIALS · 5% OFF » (43.36) · « 3+ VIALS · 8% OFF » (45.48) · « FREE SHIPPING OVER $200 » (46.20) (s4o) |
| 47.30 | whoosh | test/offer exits (s4/s4o) |
| 47.50 · 47.75 · 48.00 · 48.25 · 48.50 · 48.75 | pops | six vials slam in (s5) |
| 49.50 · 50.75 | slams | « NO PROMISES. » · « JUST PROOF. » (« PROOF. » gradient) (s5) |
| 51.00 | ring | flash (s5) |
| 51.30 → 52.40 | music dip (silence) | hold / cut to black (s5) |
| 52.40 | SONIC LOGO | symbol + wordmark typed 52.40→52.95 (s5) |
| 53.86 | pop | « proven. » lands (s5) |
| 55.00 / 56.00 | pop / click | CTA « Check the tests → purepeptide.care » / cursor click (s5) |

## Test
`tools/snap.sh /tmp/claude-0/<dir> t1,t2…` (PIL contact sheets) · `npx hyperframes lint` = 0 errors.
