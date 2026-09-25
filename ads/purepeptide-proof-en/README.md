# PurePeptide — « PROOF », 60 s, 16:9, English

Hero film 1920×1080, 30 fps, 60.00 s, sound included. Deliverable: [`renders/purepeptide-proof-en.mp4`](renders/purepeptide-proof-en.mp4)
(light preview: `renders/purepeptide-proof-en-preview.mp4`).

## The film
| Time | VO | Picture |
| --- | --- | --- |
| 0–2.4 s | — (sonic logo) | macro of the PurePeptide vial, light sweep on the logo — **brand in the first frame** |
| 2.4–12 s | « Anyone can print 99% on a label. Anyone can say “lab tested.” Almost no one shows you the proof. » | dusty unlabeled vials under a flickering tube; « 99% » cheap sticker, « LAB TESTED » rubber stamp, « PROOF. » outline only |
| 12–17 s | « We do. » | black, silence, then the vial emerges; drop + flash at 17 s |
| 17–31.5 s | « Every batch, sent to an independent lab. Identity, confirmed. Purity, measured. 99%. Minimum. Shipped cold, within 24 hours. Don’t take our word for it. Check it yourself. » | one proof per shot (independent lab · Janoshik Analytical, identity ✓, purity ✓, rolling 99%, cold chain + 24 H), « CHECK IT YOURSELF. » |
| 31.4–45.6 s | « Pick your compound. See the purity. Verified. Order. Two vials, 5% off. Three or more, 8%. » | **the real website, recorded live in English**: researcher gate → catalog → BPC-157 / TB-500 → purity line → add to cart → cart; steps 01–04 |
| 45.6–47.4 s | (end of the offer line) | offer panel: 2 vials −5% · 3+ vials −8% · free shipping over $200, « Applied automatically in the cart. » |
| 47.3–60 s | « No promises. Just proof. » … « PurePeptide. Purity, proven. » | six-vial line-up, flash, **0.75 s of silence**, logo + sonic logo, tagline, « Check the tests → purepeptide.care », legal line |

## What the research changed (see `../recherche-pubs/`)
- Brand within the first 3 s, on the product (Google/Kantar ABCD; System1).
- Contrast/anaphora copy, 1–2 words/s, short sentences; silence before the key line (Patagonia, Nike, Apple).
- Proof = one title + one number per shot, held ≥ 2 s (Dyson product films; BCAP text-hold rule).
- Every line readable with the sound off (Meta: most feed video is watched muted).
- Real product demo instead of testimonials (no people allowed) + a real, quantified offer (Baymard: extra costs 40 %, slow delivery 20 %, trust 19 % of cart abandonment).
- Sonic signature at the open and on the logo (Ipsos: audio assets 3.4× more effective).

## Tools
Kokoro-82M (local English TTS, voice af_heart — ElevenLabs credits were exhausted) · ElevenLabs Music + SFX (reused) ·
Whisper large-v3 (timing/pronunciation check) · Chrome/Puppeteer (`tools/record_site.cjs`, live site test, compliance
masks: category tags, « studied for… » copy, BAC-water upsell, Retatrutide / MT-2 hidden) · HyperFrames + GSAP ·
Python mix (−14 LUFS, TP ≤ −1.5 dBTP).

## Before you run it
- **Where**: Google/YouTube, Meta, TikTok, Snapchat, X, Pinterest do not accept this product category (see
  `../recherche-pubs/03-plateformes-conformite.md`). Use owned channels (site, email, organic) — and have your counsel
  confirm the target country's rules (FDA/FTC in the US, Health Canada, MHRA/ASA, TGA all published 2026 actions on
  « research use only » peptides).
- The site says « scan the code on the vial and read the full HPLC report » but `/coa/` still shows « coming soon »:
  publish the certificates (the film says « Check the tests »).
- Better voice: with ElevenLabs credits (~700) the VO can be re-generated with a human-grade voice; `tools/build_vo.py`
  and `tools/mix_audio.py` take one file per line in `assets/audio/vo/`.

## Rebuild
```bash
python3 tools/build_vo.py && python3 tools/mix_audio.py
CHROME=/path/to/chrome node tools/record_site.cjs /tmp/frames && ffmpeg -framerate 30 -i /tmp/frames/f_%05d.jpg -c:v libx264 -crf 15 -pix_fmt yuv420p assets/site-test/site_test.mp4
npx hyperframes render --quality delivery -o renders/purepeptide-proof-en.mp4 && tools/verify_output.sh renders/purepeptide-proof-en.mp4
```
