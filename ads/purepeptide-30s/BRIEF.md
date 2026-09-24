---
workflow: general-video
flow: autonomous
deliverable: renders/purepeptide-30s.mp4 (1080x1920, 30 fps, 30.00 s, H.264 + AAC)
---

# PUREPEPTIDE — 30 s PREMIUM MOTION-DESIGN AD — HYPERFRAMES BRIEF

## 0. VARIABLES (resolved — see "Decisions" at the end)

| Variable        | Value used in this build                                   | Status                          |
| --------------- | ---------------------------------------------------------- | ------------------------------- |
| `{{LOGO_URL}}`  | *(empty)* → wordmark fallback                              | replace when the logo exists    |
| `{{VIAL_URLS}}` | *(empty)* → reusable SVG vial, label swapped per product   | replace when renders exist      |
| `{{COA_PRODUCT}}` | BPC-157                                                  | from brief                      |
| `{{AMOUNT}}`    | 10 mg                                                      | brief example                   |
| `{{BATCH}}`     | PP-2611-A                                                  | brief example                   |
| `{{PURITY}}`    | 99.3                                                       | brief example — **must match the real COA** |
| `{{LAB}}`       | INDEPENDENT LAB                                            | neutral placeholder (no lab name invented) |
| `{{TEST_DATE}}` | 09/15/2026                                                 | placeholder — **must match the real COA** |
| `{{M_EXP}}`     | 1419.5 Da (BPC-157 average molecular weight, 1419.5 g/mol) | theoretical value               |
| `{{M_OBS}}`     | 1419.6 Da                                                  | placeholder — **must match the real COA** |
| `{{COA_URL}}`   | https://purepeptide.care/coa/PP-2611-A                     | placeholder path on the brand domain |
| `{{COUNTRIES}}` | 30                                                         | placeholder — **must be true**  |
| `{{END_CTA}}`   | LAUNCHING DECEMBER 2026 · JOIN THE LIST                    | pre-launch version              |

All values live in `index.html` → `data-composition-variables` and can be overridden at render time:
`npx hyperframes render --variables '{"PURITY":"99.1","BATCH":"PP-2701-B"}'`.

## 1. OBJECTIVE & TONE
A 30.00 s motion-design ad for PurePeptide, a US-based supplier of research-grade peptides.
One single message: purity you can verify — HPLC purity → confirmed identity → a published COA for every batch.
Tone: clinical luxury — calm, exact, confident. Feel: Apple product-film restraint × Linear/Stripe interface precision × high-end lab instrument. Not a supplement ad. Must be fully understandable with the sound off.

## 2. FORMAT
- Canvas 1080×1920 (9:16), 30 fps, 30.00 s = 900 frames, one composition.
- Rhythm: 120 BPM → 1 beat = 0.5 s (15 f), 1 bar = 2 s (60 f). Scene cuts and major hits land on beats (the times below already respect this).
- Safe zone: all text and logo strictly inside x 120→960, y 260→1400 (TikTok/Reels UI). 120 px side margins everywhere.
- No fade-out: the last frame is the complete end card (clean loop).

## 3. DESIGN SYSTEM — use ONLY this, ignore any default house style or preset
Colors
  --bg #05070A · --panel rgba(255,255,255,0.035) · --line rgba(234,242,255,0.10)
  --text #EEF3F8 · --muted #7D8896 · --accent #7FE7FF (ice blue — never more than ~10% of a frame)
  --paper #F4F6F8 · --ink #0B1016
Typography (embed the fonts, no system fallback)
  Display: Inter Tight 600 (300/500 where stated), tracking -0.03em, line-height 1.0
  Data: IBM Plex Mono 400/500, UPPERCASE, tracking +0.12em, tabular numbers
  Sizes: H1 110 px · H2 72 px · H3 64 px · tagline 52 px · labels 20–28 px · nothing below 20 px
  Headlines: sentence case, ending with a period, max 5 words per line. No emojis.
Global layers (whole video)
  - --bg + soft radial glow (--accent 10%, radius 650 px) behind each scene's hero element
  - 60 px hairline grid (1 px, --text 5%) drifting up 20 px over 30 s
  - deterministic film grain (SVG feTurbulence, seed stepped each frame) at 4%, overlay blend + vignette (edges 35% black)
  - camera: every scene container pushes in 1.00→1.04 over its duration (linear)
Motion language
  - Text in: per-word mask reveal (translateY 100%→0 inside overflow-hidden lines), 0.55 s expo.out, stagger 0.06 s, blur 10 px→0
  - Text out: translateY 0→-40% + opacity→0, 0.25 s power2.in
  - Strokes: stroke-dashoffset, power2.inOut · Counters: power3.out, one decimal, tabular
  - Pop-ins: scale 0.9→1, back.out(1.6), 0.3 s · nothing linear except camera drifts
  - Recurring motif: a thin --accent scan line (2 px + 24 px glow) = "verification" (S1 scan, S3→S4 wipe, S5 QR scan)
  - 100% deterministic: seeded noise only, no random values

## 4. ASSETS
Logo: {{LOGO_URL}}. If missing → wordmark "PurePeptide": "Pure" Inter Tight 600 + "Peptide" Inter Tight 300, same size, no space, --text; the dot of the "i" replaced by a 0.18em --accent circle.
Vials: {{VIAL_URLS}}. If missing (or if only one render is provided, use it for S1–S2) → build ONE reusable SVG vial and swap the label per product: clear 2R-style glass vial, body 260×560 px with rounded shoulders, neck 150 px wide; aluminium crimp cap 170×90 px (gradient #D9DEE3→#8E969F); flip-off top 176×28 px in --accent; transparent glass with two vertical highlight strips (white 35% and 12%) and darker edges; white lyophilized powder cake filling the bottom 18% of the body (#F2F0EA, slightly irregular top); wrap-around label (--paper, 58% of body height) with logo, product name (Inter Tight 600), {{AMOUNT}}, batch code and "RESEARCH USE ONLY" micro-text.
Hero product (S1–S5): {{COA_PRODUCT}}.

## 5. TIMELINE (absolute seconds / frames)

S1 — HOOK · 0.00–2.50 (f0–75)
Layout: hero vial out of focus, centered (540,1000), height 900, blur 24 px, opacity 35%. H1 centered on y 880, two lines: "What's really" / "in your vial?" — "vial?" in --accent.
- 0.00–0.80 word mask reveal; the first word is already moving on frame 0 (no empty opening frame)
- 0.80–1.60 scan line travels y 700→1080 (power1.inOut); each text line glows briefly as it passes
- 1.50 "vial?" pulse 1→1.06→1 (0.3 s)
- 2.00–2.50 RACK FOCUS: headline blur 0→18 px, scale→1.12, opacity→0 (power2.in); vial blur 24→0, opacity→100%, scale 1.15→1.00 (expo.out), landing exactly in its S2 position

S2 — HERO VIAL · 2.50–6.00 (f75–180)
Layout: logo 44 px tall, top center, y 300. H3 headline centered, y 460. Vial centered (540,1000), height 780, standing on a 1 px --line floor (y 1392, x 200→880) with a mirrored reflection (15% opacity, fading out over 220 px). Two callouts (mono 22 px, --muted, max 2 lines, max 240 px wide, 1 px leader lines ending in 6 px --accent dots): left "LYOPHILIZED / POWDER" → powder cake (y≈1320); right "BATCH / {{BATCH}}" → label (y≈1000).
- 2.50–6.00 vial floats ±6 px (sine, 2 s period)
- 2.60–3.60 specular sweep: 140 px vertical white band (0→55%→0), skewed -12°, masked to the vial, x 300→780
- 2.70–3.20 logo slides down 12 px + fades in
- 2.90–3.45 headline A "We don't ask for trust." · hold · 4.10–4.35 out
- 3.40–3.90 callout lines draw (left 3.40, right 3.55), labels type on (0.025 s/char)
- 4.30–4.85 headline B "We publish the proof." ("proof." in --accent) · hold to 5.60
- 5.60–6.00 ZOOM-THROUGH: vial group scales 1→2.6 from the label's center, blur 0→14 px, opacity→0 (power2.in); S3 enters from scale 1.12 + blur 12 px (5.75–6.25, expo.out); radial light bloom peaking at 6.00 (35%). If shader transitions are available, add a subtle glass-refraction distortion.

S3 — PURITY · 6.00–10.00 (f180–300) — music drop at 6.00
Layout: H2 "Purity, measured." y 300. Counter "{{PURITY}}%" 150 px, --accent, centered y≈520; "HPLC PURITY" (mono 26 px, --muted) y 620. Chart card x 120→960, y 700→1340, radius 28, --panel fill, 1 px --line border, 48 px padding — stylized HPLC chromatogram: axes with mono 20 px labels ("RETENTION TIME (MIN)" 0·5·10·15·20, "mAU"), 6% gridlines; 2.5 px trace (--text 85%): flat baseline with seeded micro-noise (±2 px), two tiny impurity bumps (3% and 2% height), one sharp main peak at 49% of the x-axis reaching 92% of chart height. Card footer (mono 20 px, --muted): "BATCH {{BATCH}} · {{LAB}}".
- 6.10–6.60 headline in · 6.20–6.60 axes and gridlines draw (stagger 0.03 s)
- 6.40–8.20 trace draws left→right (power1.inOut), led by an 8 px --accent dot with a 16 px glow
- 7.30–7.80 when the dot reaches the peak: peak area fills with an --accent gradient (55%→0) + "MAIN PEAK" label pops
- 7.00–8.80 counter 0.0→{{PURITY}} (power3.out); "HPLC PURITY" types on at 7.00; at 8.80 glow pulse (0→28→8 px) + check icon (44 px circle, stroke draw 0.3 s) right of the number
- 9.50–10.00 SCAN WIPE: vertical scan line sweeps left→right, revealing S4 behind it (clip-path)

S4 — IDENTITY · 10.00–12.00 (f300–360)
Layout: H2 "Identity, confirmed." y 300. Card x 120→960, y 620→1260. Top-left inside the card (x 168, y 668): "MASS MATCH" (mono 28 px 500, --text) + SVG check, below it "EXPECTED {{M_EXP}} · OBSERVED {{M_OBS}}" (mono 20 px, --muted). Lower 70% of the card: stylized mass spectrum, 36 bars (6 px wide, 14 px gap), seeded heights 3–18%, one dominant bar at 62% of the width, 90% height, in --accent (others --text 35%), linked to the label by a 1 px leader line. Under the card, y 1310 (mono 22 px, --muted): "LC-MS · INDEPENDENT THIRD-PARTY LAB".
- 10.00–10.50 headline in
- 10.05–10.55 bars grow from the baseline (scaleY 0→1, stagger 0.012 s left→right, 0.35 s power3.out)
- 10.55–10.80 dominant bar turns --accent + glow · 10.60–10.90 label slides in 20 px from the left · 10.85–11.10 check draws
- 11.55–12.00 MATCH CUT: bars collapse edges→center into a single 2 px --accent line that rises to y 560 and becomes the top edge of the S5 certificate

S5 — A COA FOR EVERY BATCH · 12.00–16.00 (f360–480)
Layout: H2 on two lines from y 300: "Every batch." / "Its own COA." ("COA." in --accent). Certificate card (--paper, --ink text) x 160→920, y 560→1300, radius 18, perspective 1600 px, rotateX 8°, rotateY -10°, shadow 0 40px 80px rgba(0,0,0,.55). Content: "CERTIFICATE OF ANALYSIS" (Inter Tight 600, 28 px); rows (IBM Plex Mono 20 px, 1 px dividers): PRODUCT {{COA_PRODUCT}} · BATCH {{BATCH}} · TEST DATE {{TEST_DATE}} · PURITY (HPLC) {{PURITY}}% · IDENTITY (MS) CONFORMS · LAB {{LAB}}; a mini chromatogram thumbnail; a real, scannable QR code for {{COA_URL}} (180 px, bottom-right). Under the card, y 1350 (mono 22 px, --muted): "SCAN · VERIFY · RESEARCH".
- 12.00–12.60 card unrolls downward from the line (clip-path inset(0 0 100% 0)→inset(0), expo.out) while rotateX eases 18°→8°
- 12.30–12.90 headline in · 12.60–13.40 rows appear one by one (fade + 8 px rise, stagger 0.1 s)
- 13.40–13.70 four --accent corner brackets snap onto the QR (scale 1.4→1, back.out(1.6))
- 13.70–14.30 scan line passes down then up over the QR
- 14.30 "VERIFIED" stamp pill (--accent fill, --bg text, mono 22 px 500) pops on the card's top-right corner, rotated -6°; the PURITY row gets an --accent underline; the card border flashes once
- 14.30–15.50 card drifts rotateY -10°→-4°, scale 1→1.03
- 15.50–16.00 WHIP PAN LEFT: scene translateX 0→-1080 with horizontal directional blur (SVG feGaussianBlur stdDeviation "18 0"); S6 enters from the right the same way

S6 — CATALOG · 16.00–22.00 (f480–660) — music full
Layout: kicker "THE CATALOG" (mono 24 px, --muted, tracking 0.2em) y 300. Carousel on a glossy floor: active vial centered (540,880), height 640; neighbours centered at x 150 and x 930, height 460, 45% opacity, blur 3 px, partly cropped. Under the active vial: product name H3 (baseline y≈1290) + spec line (mono 22 px, --muted, y≈1350): "{{AMOUNT}} · LYOPHILIZED · HPLC-TESTED".
- Product changes (0.45 s expo.inOut slide; name rolls up slot-machine style in 0.35 s): 16.00 BPC-157 · 17.00 GHK-Cu · 18.00 CJC-1295 / Ipamorelin · 19.00 Selank · 19.50 Semax · 20.00 IGF-1 LR3 (accelerating cadence)
- 20.50–22.00 pull back to a group shot: the 6 vials, heights 320/360/400/400/360/320 px, 12 px gaps, bases on a shallow arc (center y 1200, outer y 1160), shared reflection; line above the group at y 700: "ALL BATCH-TESTED · COA ONLINE" (mono 24 px); --accent rim-light sweep across all vials 21.00–21.60
- 21.60–22.00 DIP: brightness 1→0.35, group scale 1→0.92

S7 — STANDARDS · 22.00–26.00 (f660–780) — music break + riser
Layout: H2 "No shortcuts." y 330. 2×2 grid of glass tiles (400×300, radius 24, --panel, 1 px --line), x 120→960, y 560→1240, 40 px gap, 32 px padding. Each tile: 56 px line icon (2 px --accent stroke), title Inter Tight 600 32 px (may wrap to 2 lines), sub mono 20 px --muted:
  1. US map outline — "US-based" / "US-REGISTERED COMPANY"
  2. Vial — "Lyophilized & sealed" / "SHIPPED AS POWDER"
  3. Document + check — "A COA per batch" / "PUBLISHED ONLINE"
  4. Globe — "Ships to {{COUNTRIES}} countries" / "TRACKED DELIVERY"
- 22.00–22.40 headline in
- tiles pop on the beats 22.50 · 23.00 · 23.50 · 24.00 (scale 0.94→1, y 24→0, 0.5 s expo.out); each icon stroke draws 0.4 s after its tile; title then sub (stagger 0.08 s)
- 24.00–25.50 tension: tile borders glow --accent 0→40%, grid brightens to 10%
- 25.50–26.00 IMPLOSION: tiles collapse to the center (scale→0.2, opacity→0, stagger 0.04 s, power3.in) into a single bright point (12 px, white/--accent) at (540,880)

S8 — END CARD · 26.00–30.00 (f780–900) — final hit at 26.00
Layout: logo centered y≈820, width 620. Tagline y 980, 52 px Inter Tight 500: "Purity you can verify." ("verify." in --accent). URL pill y 1110: "purepeptide.care" (mono 30 px, 1 px --accent 60% border, fully rounded, padding 18/36). CTA y 1210 (mono 24 px): {{END_CTA}}. Legal line y 1330 (mono 20 px, --muted, centered): "FOR RESEARCH USE ONLY · NOT FOR HUMAN CONSUMPTION". Background: molecular lattice (hairlines 5%) slowly rotating +3° over the scene.
- 26.00 the point bursts into a radial bloom (80%→0 in 0.5 s); logo resolves scale 1.18→1, blur 16→0 (wordmark fallback: letter-spacing 0.12em→0), 0.9 s expo.out; light sweep across the logo 26.40–27.10
- 26.70–27.20 tagline in · 27.20–27.60 URL pill border draws around, text fades in · 27.60–27.90 CTA types on
- 27.80 legal line fades in and stays until 30.00
- 28.00–30.00 hold on the complete end card. No fade to black.

## 6. AUDIO (only if the pipeline supports audio — otherwise keep every timing on the 120 BPM grid so music can be added in post)
Music: dark minimal electronic / cinematic tech, 120 BPM, minor key, glassy plucks + deep sub. 0–6 s filtered intro (low-pass slowly opening) · 6.00 drop (kick + hats) · 16.00 full (bass + arpeggio) · 22.00 break (drums out, pad + riser) · 26.00 final impact, reverb tail to 30.00.
SFX: 0.00 sub impact + glass ping · 0.80 scan sweep · 1.50 soft hit · 2.00 focus whoosh · 2.60 shimmer · 3.00 glass tink · 3.40 UI ticks · 5.60 riser · 7.30 sub hit · 7.00–8.80 decelerating ticks · 8.80 two-note lock chime · 9.50 swish · 10.05 ascending blips · 10.85 confirm chime · 11.55 reverse suck · 12.00 paper unfold · 13.40 bracket snaps · 13.70 scan beep · 14.30 "verified" chime · 15.50 whip whoosh · 16.00→20.00 one glass tink per product, a semitone higher each time · 20.50 bloom swell · 22.50/23.00/23.50/24.00 tile plucks · 25.50 reverse suck · 26.00 impact + shimmer tail.
Master: -14 LUFS integrated, true peak ≤ -1 dBTP.

## 7. HARD RULES
Compliance
- Never show: syringes, needles, injections, pills, people or body parts, muscles, before/after, scales, tanned skin, doctors, patients, dosages, protocols.
- Never state or imply any effect or benefit (recovery, healing, fat loss, muscle, anti-aging, focus, tanning…). Banned words: results, benefits, heal, treatment, dose, cycle.
- Only the claims written in this brief. Use the variables exactly; never invent numbers, certifications, awards or lab names.
- The legal line stays readable for at least 2 s, never below 20 px.
Craft
- No stock footage, no clip-art, no generic sci-fi HUD clutter; max 2 moving focal points per frame.
- Everything aligned to an 8 px grid, 120 px side margins.
- Nothing ever fully frozen: every held element keeps a micro-drift.
- Text contrast ≥ 4.5:1.

## 8. DELIVERABLE
One composition, 1080×1920, 30 fps, 30.00 s, rendered to MP4. Other formats and language versions will come later as edits — do not build them now.

---

## Decisions taken for this build (autonomous run)

1. **No logo / vial files supplied** → wordmark fallback and the reusable SVG vial (brief §4). Both switch automatically to the real assets once `LOGO_URL` / `VIAL_URLS` are set.
2. **Placeholders, not facts.** `PURITY`, `TEST_DATE`, `M_OBS`, `COUNTRIES` and the COA URL are stand-ins and must be replaced with the real certificate's values before this ad is published. `LAB` is the neutral "INDEPENDENT LAB" so that no lab name is invented.
3. **Audio is synthesized procedurally** (`tools/make_audio.py`, numpy): an original 120 BPM score + every SFX cue in §6, mastered to -14 LUFS / ≤ -1 dBTP. No third-party samples.
4. **Label micro-text** on the vial (mini wordmark, spec line, "RESEARCH USE ONLY") is product artwork and is the only text below 20 px, as the brief's own "micro-text" requires.
5. **Coordinates**: when the brief gives a bare `y`, it is the top of the element's box (line-height 1.0); "centered on y" and "baseline y" are honoured literally.
