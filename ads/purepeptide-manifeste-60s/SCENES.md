# PurePeptide — « manifeste » 60 s, 16:9 (FR) · production contract

One HyperFrames composition (`index.html`, id `main`, **1920×1080**, 30 fps, **60.00 s**), ONE paused GSAP timeline,
all tweens at **absolute seconds**. Tone: a big-brand manifesto commercial (Nike / Apple): black, huge condensed
uppercase type (Anton, class `.mf`), brutal hard cuts on the beat, real cinematic imagery, silence used as a weapon,
then the product and the proof. Structure: **pain → turn → proof → live website test → brand**.

The voice (« Paul K », ElevenLabs v3) is expressive and human — the picture must breathe with it: type slams on the
stressed words, holds on the pauses. Audience = prospects who don't know the technical terms → plain French on
screen (the site capture itself may contain technical words: fine, it's the real site).

## Hard rules (compliance — binding)
- Only copy listed here / `js/config.js` / `js/vo.js`. No invented numbers, claims, certifications, lab names, batch
  numbers, reviews, competitor names. « faux labos » stays generic (never a name, logo or recognisable brand).
- No effect/benefit wording (santé, récupération, muscle, perte de poids, anti-âge, résultats, bienfaits, traitement,
  dose, cycle, guérir…). Never show syringes, needles, pills, people, body parts, doctors, dosages, protocols.
- Products: the six in `PP.cfg.catalog` + `PP.cfg.heroVial`. The AI still `PP.cfg.fakeShelf` (generic unlabeled
  vials) is ONLY for the « pain » section (never associated with PurePeptide).
- Text inside the title-safe area **x 96→1824, y 54→1026** (5 %). Legal line readable ≥ 2 s, ≥ 24 px.
  Contrast ≥ 4.5:1. Nothing under 24 px except text inside the site recording.
- Deterministic: no Math.random/Date/timers/callbacks for visual state (`PP.drive` for setters, `PP.rng(seed)`);
  repeated props on one element → `fromTo` + `immediateRender:false`; never tween visibility/display on a
  `<section>`; no `will-change`.
- Only edit YOUR files (`js/scenes/<id>.js`, `css/<id>.css`). Never `index.html`, `js/lib.js`, `js/global.js`,
  `js/config.js`, `js/vo.js`, audio. Helpers go inside your scene file. Lib bug → report the exact fix.

## Library (js/lib.js — read it; shared with our neon ad)
`PP.scene(id, (tl, root, cam) => {})` (`cam` = full-frame wrapper, transform-origin 960 540).
`PP.el / PP.svg / PP.fr / PP.drive / PP.rng`. Text: `PP.headline(parent, lines, cls)` (word spans; mark accents
**per word**: `"*la* *pureté*"`), `PP.voHeadline(tl, parent, "L7", lines, cls, o)` (words appear on Paul K's word
onsets — display words must equal the VO words in order), `PP.wordIn`, `PP.textOut`, `PP.popIn`, `PP.typeOn/chars`,
`PP.draw`, `PP.checkIcon`. Classes: `.mf` (Anton uppercase manifesto), `.pp-h.h0/h1/h2/h3` (Archivo 900),
`.pp-h.mf` (Anton in a headline), `.grad` (brand neon gradient text), `.neon`, `.soft`, `.mono`.
Brand: `PP.logo(parent,{width})` (light wordmark), `PP.symbol(parent,h)` (bright symbol), `PP.vial(parent,src,h)`
(606×1240 catalog renders), `PP.heroVial(parent,h)` (1024×1536). Recipes: `PP.flashRing(tl, PP.layers.fx, at, {x,y,target})`,
`PP.cursor(parent,x0,y0)`, `PP.rollCounter`, `PP.typedWordmark(tl,parent,width,at)`, `PP.zoomThrough`,
`PP.highlightBar`, `PP.globe`, `PP.morphFromPill`, `PP.neonCard(parent,{x,y,w,h})`, `PP.pill`. `PP.F` = 1/30 s.
Global: black stage, vignette, per-frame film grain (above everything), `PP.layers.fx` full-frame layer above scenes.

## Scenes (clips) — you own everything visible in yours
| id | clip | content |
| --- | --- | --- |
| s1 | 0.00 → 12.10 | PAIN — AI still of dusty unlabeled vials under a flickering tube; manifesto type slams |
| s2 | 11.95 → 17.20 | TURN — black; « NOUS AUSSI. »; « Alors on a fait autrement. »; riser; DROP 17.00 = flash reveal |
| s3 | 17.00 → 30.20 | PROOF — PurePeptide hero vial, independent lab, right product ✓, purity, 99 % MINIMUM, « ne nous croyez pas sur parole » |
| s4 | 29.80 → 44.60 | TEST — background + browser-window chrome (z below the video) |
| `#sitetest` video | 30.40 → 44.60 | the REAL recorded site test (stage-level `<video>`, 1920×1200 px, z between s4 and s4o) — s4's owner positions/transforms it |
| s4o | 29.80 → 44.60 | TEST overlays (z above the video): « TESTEZ. », step labels, highlights, chips |
| s5 | 44.30 → 60.00 | BRAND — six vials, « PAS DE PROMESSES. DES PREUVES. », logo, tagline, CTA, legal |

## Voice-over (js/vo.js — word onsets on the video timeline, s)
| Line | Placed | Text (word onsets) |
| --- | --- | --- |
| L1 | 0.70–2.17 | Vous .70 · en 1.16 · avez 1.36 · marre, 1.54 · hein ? 1.92 |
| L2 | 2.70–5.12 | Marre 2.76 · des 3.06 · peptides 3.16 · vendus 3.60 · par 3.98 · de 4.18 · faux 4.30 · labos. 4.60 |
| L3 | 5.50–8.10 | Des 5.53 · analyses… 5.76 · que 6.18 · personne 6.90 · ne 7.30 · montre. 7.58 |
| L4 | 8.40–10.70 | Des 8.43 · fioles… 8.50 · sans 8.92 · aucune 9.52 · preuve. 10.00 |
| L5 | 12.30–12.96 | Nous 12.34 · aussi. 12.48 |
| L6 | 13.60–14.75 | Alors 13.63 · on 13.74 · a 13.92 · fait 14.04 · autrement. 14.18 |
| L7 | 17.30–19.80 | Chaque 17.33 · lot 17.56 · part 17.74 · dans 18.00 · un 18.20 · laboratoire 18.38 · indépendant. 18.94 |
| L8 | 20.20–21.81 | On 20.23 · vérifie 20.30 · que 20.64 · c’est 20.80 · le 21.00 · bon 21.07 · produit. 21.26 |
| L9 | 22.00–23.12 | On 22.03 · mesure 22.10 · sa 22.35 · pureté. 22.55 |
| L10 | 23.60–25.80 | 99 %, 23.64 · minimum. 24.48 |
| L11 | 27.00–29.46 | Et 27.03 · surtout… 27.10 · ne 27.54 · nous 28.08 · croyez 28.22 · pas 28.48 · sur 28.70 · parole. 28.88 |
| L12 | 29.90–30.42 | Testez ! 29.93 |
| L13 | 35.00–36.41 | Choisissez 35.03 · votre 35.41 · référence. 35.61 |
| L14 | 38.10–39.97 | Regardez 38.13 · sa 38.56 · pureté, 38.64 · vérifiée. 39.31 |
| L15 | 41.00–41.59 | Commandez : 41.03 |
| L16 | 41.80–44.30 | expédié 41.83 · sous 42.27 · 24 42.47 · heures, 42.81 · vers 43.21 · 10 43.57 · pays. 43.79 |
| L17 | 46.50–47.32 | Pas 46.53 · de 46.60 · promesses. 46.67 |
| L18 | 47.80–48.57 | Des 47.83 · preuves. 47.90 |
| L19 | 49.50–50.29 | PurePeptide. 49.53 |
| L20 | 50.80–52.15 | La 50.83 · pureté, 50.90 · prouvée. 51.72 |
Music: dark sparse intro (hit at 0.00 and 8.00), big hit **12.00** then near-silence, riser 14.5→17, **DROP 17.00**,
driving anthem after (beats on 17.00 + 0.5·k), music tail ends ~58.5, silence at 60.

## Real site test — `#sitetest` (assets/site-test/site_test.mp4, 1920×1200 px = 1440×900 css px @1.3334)
Recorded live on purepeptide.care by `tools/record_site.cjs` (scripted user, compliance masks injected). Timeline
marks (video time): gate 30.40 (researcher-verification modal) · tick 1 **31.40** · tick 2 **32.00** · « Entrer »
**32.667** · home 33.60 · click « Explorer le catalogue » **34.50** · shop grid 34.53 · click BPC-157/TB-500
**37.033** · product page 37.07 · purity line highlighted (green outline, in the video) 38.17 · click « Ajouter au
panier » **41.067** (page reloads: perks list with « Expédition sous 24 h » and the delivery countries visible
41.07–42.1) · click floating « Panier » **42.167** · cart drawer open 42.40 → 44.60. The cursor is inside the video.

## SOUND-EVENT TABLE (already in the mix — put the matching visual on these times, ±1 frame)
| t (s) | sound | visual (owner) |
| --- | --- | --- |
| 0 → 12 | neon-tube hum; **flicker dips** at 0.35 · 1.90 · 2.05 · 4.40 · 6.70 · 6.80 · 9.30 · 10.90 · 11.00 · 11.30 (60 ms each) | the tube light / whole image dims ~70 % for 2 frames at each (s1) |
| 1.54 · 4.30 · 6.90 · 9.52 | deep type slam | manifesto word slams in: « MARRE ? » (1.54) · « FAUX LABOS. » (4.30) · « PERSONNE. » (6.90) · « AUCUNE PREUVE. » (9.52) (s1) |
| 12.00 | huge impact | hard cut to pure black (s2 covers s1) |
| 12.34 | slam | « NOUS AUSSI. » (s2) |
| 16.90 | whoosh | light gathering toward the centre (s2) |
| 17.00 | RING + impact (DROP) | flash + neon ring → PurePeptide hero vial revealed (s2 fires `PP.flashRing` at 17.00; s3 is under it) |
| 18.94 | pop | « indépendant » badge (s3) |
| 21.07 | tick | « le bon produit » ✓ (s3) |
| 22.55 | tick | « pureté » measured (s3) |
| 23.62 → 24.00 | roll ticks | 99 rolls, lands 24.00 (s3) |
| 24.00 | RING | flash #2 behind « 99 % » (s3) |
| 24.48 | pop | « MINIMUM. » (s3) |
| 26.95 | whoosh | transition to « ne nous croyez pas sur parole » (s3) |
| 29.93 | slam | « TESTEZ. » (s4o) |
| 30.40 | whoosh | browser window with the site test flies in (s4) |
| 31.40 · 32.00 · 32.667 · 34.50 · 37.033 · 41.067 · 42.167 | real clicks | clicks inside the recording (optional overlay ripple) |
| 34.52 · 37.05 | swish | page changes in the recording |
| 42.47 · 43.57 | pops | chips « Expédition sous 24 h » (42.47) and « Livraison vers 10 pays » (43.57) (s4o) |
| 44.30 | whoosh | test window exits (s4/s4o) |
| 44.50 · 44.75 · 45.00 · 45.25 · 45.50 · 45.75 | 6 pops | the six catalog vials slam in (s5) |
| 46.53 | slam | « PAS DE PROMESSES. » (s5) |
| 47.83 | slam | « DES PREUVES. » (s5) |
| 48.00 | RING | flash #3 (s5) |
| 49.53 → 50.10 | typing | PUREPEPTIDE wordmark typed (s5) |
| 51.72 | pop | « prouvée. » (s5) |
| 53.00 | pop | CTA « Testez vous-même · purepeptide.care » (s5) |
| 54.00 | click | cursor clicks the CTA (s5) |

## Test
`tools/snap.sh /tmp/claude-0/<dir> t1,t2,…` → PNGs at exact times (Read them, make PIL contact sheets).
`npx hyperframes lint` must stay at 0 errors. Check hand-offs (clip start/end) and every table time.
