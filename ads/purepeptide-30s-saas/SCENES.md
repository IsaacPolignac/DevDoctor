# PurePeptide — pub SaaS 30 s (FR) · contrat de production

One HyperFrames composition (`index.html`, id `main`, 1080×1920, 30 fps, 30.00 s), ONE paused GSAP timeline,
all tweens at **absolute seconds**. Look: purepeptide.care's own brand (light, clinical, navy→blue→teal gradient),
motion language of a premium **SaaS product ad** (Linear / Stripe / Apple product pages): the real website in
action inside a phone, UI elements lifting out as floating cards, kinetic headlines synced to the voice-over,
spring pops on the music beats. Everything on screen is in **French**.

## Hard rules (compliance — from the original brief, still binding)
- Only copy listed here or read from `js/config.js` / `js/vo.js` / the site captures. No invented numbers, claims,
  certifications, lab names, batch numbers or dates. No effect/benefit wording (no récupération, guérison,
  perte de poids, muscle, anti-âge, bronzage…). Never show syringes, pills, people, body parts, dosages.
- Products shown: the six in `PP.cfg.catalog` only (MT-2 and Retatrutide never appear).
- The legal line (`PP.cfg.legal`) must be readable ≥ 2 s on the end card, ≥ 20 px.
- Text and logos stay inside the safe zone x 120→960, y 260→1400 (the phone/vials may extend beyond; the text
  that matters inside them must stay readable above y 1400).
- Nothing below 20 px except text that is part of a site capture or product art.
- Deterministic: no Math.random / Date / timers / GSAP callbacks for visual state (use `PP.drive`);
  repeated props: `fromTo` + `immediateRender:false`; never tween visibility/display/autoAlpha on a `<section>`.

## Timing (music + voice are fixed — build the picture on them)
Music (ElevenLabs, `assets/audio/music_raw.mp3`): 120 BPM, beats on every multiple of 0.5 s. Calm filtered intro
0–14 s, build 14–16 s, **DROP at 16.00 s**, full energy 16–25 s, fade 25–30 s.

Voice-over (Hugo, `js/vo.js` → `PP.VO`, word timings on the video timeline):

| Line | Video time | Text |
| --- | --- | --- |
| L1 | 0.30 – 2.25 | Qu’y a-t-il vraiment dans votre fiole ? |
| L2 | 3.00 – 5.85 | On ne vous demande pas de nous croire, on vous montre les preuves. |
| L3 | 6.45 – 9.74 | Chaque lot est analysé par Janoshik, un laboratoire indépendant. |
| L4 | 10.00 – 13.88 | Pureté par HPLC, identité par spectrométrie de masse. |
| L5 | 14.10 – 16.16 | Chaque certificat, publié en ligne. |
| L6 | 16.95 – 19.82 | Expédition sous 24 heures, vers dix pays. |
| L7 | 23.95 – 26.54 | PurePeptide, la pureté, prouvée. |

Use `PP.voHeadline(tl, parent, "L3", ["Chaque lot est analysé", "par *Janoshik,* un laboratoire", "indépendant."], "h2")`:
the display strings must contain exactly the VO line's words in order (punctuation may differ; `*word*` = brand
gradient); each word then appears when Hugo says it.

## Sound-event table (the audio agent places SFX here — scenes MUST put the matching visual on these times, ±1 frame)
| t (s) | Event | Owner |
| --- | --- | --- |
| 2.95 | whoosh — phone rises into frame | s23 |
| 4.00 / 4.45 | tap — tick checkbox 1 / checkbox 2 of the « Vérification chercheur » gate | s23 |
| 5.15 | tap — « Entrer sur PurePeptide » | s23 |
| 5.95 | swipe — in-phone navigation to the BPC-157 / TB-500 product page | s23 |
| 6.90 | pop — zoom lens « Vérifié · Pureté HPLC 99.0% » lifts out of the phone | s23 |
| 7.64 | pop — Janoshik Analytical card (on the word « Janoshik ») | s23 |
| 8.60 | tap — on the product page line « Analysé par un laboratoire indépendant (HPLC + spectrométrie de masse) » | s23 |
| 10.05 | swipe — navigation to the Qualité page | s45 |
| 10.80 | pop — « Pureté · HPLC » card lifts out (word « HPLC ») | s45 |
| 11.84 | pop — « Identité · Spectrométrie de masse » card lifts out (word « identité ») | s45 |
| 14.05 | swipe — navigation to the Certificats d'analyse page | s45 |
| 14.90 | pop — QR card (`PP.qr(…, PP.cfg.coaUrl, …)`) | s45 |
| 15.10 – 15.60 | scan — scan line passes over the QR | s45 |
| 15.60 → 16.00 | riser into the drop; s45 exits by 16.00 | s45 |
| 16.00 16.50 17.00 17.50 18.00 18.50 | impact + 5 pops — the six catalog vials slam in, one per beat | s67 |
| 18.75 19.25 19.75 20.25 | pop — four trust pills | s67 |
| 20.50 21.00 21.50 | hit — three proof stats land (counters tick while counting) | s67 |
| 23.75 | whoosh — transition to the end card | s67 → s8 |
| 24.00 | shimmer — brand symbol + wordmark reveal | s8 |
| 26.20 | soft chime — « prouvée. » | s8 |

## Files and ownership
| Scene | Files (edit ONLY yours) | Section window |
| --- | --- | --- |
| S1 hook | `js/scenes/s1.js`, `css/s1.css` | `#s1` 0.00 – 3.20 |
| S2+S3 phone act 1 | `js/scenes/s23.js`, `css/s23.css` | `#s23` 2.80 – 10.00 |
| S4+S5 phone act 2 | `js/scenes/s45.js`, `css/s45.css` | `#s45` 10.00 – 16.20 |
| S6+S7 drop + proof | `js/scenes/s67.js`, `css/s67.css` | `#s67` 15.90 – 24.20 |
| S8 end card | `js/scenes/s8.js`, `css/s8.css` | `#s8` 23.80 – 30.00 |
| Audio | `tools/mix_audio.py` → `assets/audio/mix.wav` | — |

Later sections stack above earlier ones (`#s1` z 11 … `#s8` z 15). Scope CSS under your section id; prefix ids.
Never edit `index.html`, `js/lib.js`, `js/global.js`, `js/config.js`, `js/vo.js` or someone else's files.

## Hand-off contracts
1. **s1 → s23 (2.80–3.20):** s23's phone rises over s1 (whoosh 2.95); s1 clears its content by 3.20.
2. **s23 → s45 at 10.00 (invisible cut):** s23's last frames and s45's first frames are pixel-identical:
   background + a phone created with `PP.phone(cam)` at the standard pose P0 (no transform on the phone, `cam`
   at scale 1 — do NOT push-in the camera during 9.50–10.50 in either scene) showing `assets/site/m-product.jpg`
   (css height 1900) scrolled to **css y = 1100** (the page bottom: 1900 − 797 visible css px ≈ 1103), nothing else on screen (all headlines / cards gone by 9.97).
3. **s45 → s67 at 16.00:** s45 is fully gone at 16.00 (its exit happens 15.60–16.00); s67 lands the drop at 16.00.
4. **s67 → s8 (23.75–24.20):** s67 exits with the whoosh at 23.75; s8 is on screen from 23.95.

## Library (`js/lib.js`, global `PP`) — read the file, it is short
`PP.cfg` (facts, catalog, trust copy, legal) · `PP.VO` (voice lines) · `PP.C` (colours) · `PP.el/svg` · `PP.rng` ·
`PP.drive` · `PP.headline` / `PP.voHeadline` / `PP.wordIn` / `PP.wordsIn` / `PP.textOut` · `PP.chars` + `PP.typeOn` ·
`PP.counter` · `PP.popIn` · `PP.draw` · `PP.camera` · `PP.logo({width, light})` (official SVG wordmark, 611:62) ·
`PP.symbol(h)` · `PP.vial(parent, src, height)` (official renders 606×1240) · `PP.checkIcon` · `PP.qr` ·
`PP.phone(parent, {x,y,scale})` → `{el, screen, view, addPage(src, cssH, {full}), pt(cx,cy,scroll,full)}` with
`page.scroll(tl, y0, y1, at, dur, ease)` · `PP.touch(parent)` → `{el, tap(tl, at)}` (move `el` with x/y) ·
`PP.lens(parent, src, imgCssW, imgCssH, [x,y,w,h], width)` (magnified crop card) · `PP.pill(parent, text, {check, dark})`.
Standard phone pose P0: centre (540, 1040), CSS scale 1.4 → screen 546×1182 (status bar 66 px), outer 572×1208.

## Site captures (`assets/site/`, French, mobile @3x = 1170 px wide = 390 css px; `rects.json` has element boxes)
| File | css size | Content |
| --- | --- | --- |
| `gate-0/1/2.jpg` | 390×844 | « Vérification chercheur » gate: 0 = unticked, 1 = first box ticked, 2 = both ticked (button active). Boxes at css (70,446) and (70,502); « Entrer sur PurePeptide » button (46,631,298,50). Use `addPage(src, 844, {full:true})`. |
| `m-product.jpg` | 390×1900 | BPC-157 / TB-500 page: title y≈614, « Vérifié · Pureté HPLC 99.0% » row (20,662,350,48), shipping (21,1606), lab line « Analysé par un laboratoire indépendant (HPLC + spectrométrie de masse) » (21,1749,348,63). Effect tags/descriptions already removed. |
| `m-quality.jpg` | 390×2500 | « Chaque lot, vérifié. » (h1 y≈193), cards Identité (97,485,254,131) « Spectrométrie de masse », Pureté (97,697,254,155) « HPLC », thresholds table (20,1941,350,453). |
| `m-coa.jpg` | 390×1300 | « Certificats d'analyse », Janoshik logo, « Chaque lot est analysé par Janoshik Analytical, un laboratoire tiers indépendant… » (20,309,350,112). Below y≈400 it says « Certificats à venir » — don't linger there. |
| `m-home.jpg` | 390×2600 | Home: hero « La pureté, prouvée. » + vial, stats, catalogue cards. |
| `m-home-proof.jpg` | 390×810 | « Un standard de pureté que vous pouvez vérifier vous-même. » + « ≥ 99% Pureté HPLC · 2 Méthodes analytiques · 1 COA par lot ». |
| `m-shop.jpg` | 390×2600 | Boutique grid (BAC Water + the six catalog products). |
| `d-home/quality/product/coa.jpg` | 1440×900 @2x | Desktop viewport captures (for an optional browser-window shot). |

Brand assets: `assets/brand/brand-wordmark(.svg|-light.svg)`, `brand-symbol.svg`, `janoshik-logo.svg` (Janoshik's
own logo, as shown on the site). Vials: `assets/vials/*.png` (+ `hero.png`, 1024×1536, generic label).

## Verify
`tools/snap.sh /tmp/claude-0/snaps-<you> 6.9,7.64,…` (exact frames) → Read the PNGs · `npx hyperframes lint` (0 errors).
Do not render, preview, or git commit.
