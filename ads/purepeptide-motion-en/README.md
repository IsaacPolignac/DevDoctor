# PurePeptide — « Spelled out », motion design 45 s, 16:9, English

Kinetic-type motion ad: the brand's claims spell out the vial, become the proof (99 % minimum, every batch independently
tested by Janoshik Analytical, shipped cold within 24 h, 10 countries, six compounds), fly into a **photoreal iPhone
(Blender, iPhone 17 Pro-style, no Apple logo)** and land exactly on the headline of the **real purepeptide.care mobile
site**. The real cart then does the math (2 vials of the same compound −5 %, 3+ −8 %, free shipping over $200, applied
automatically) and the checkout button floods into the navy end card.

Deliverable: [`renders/purepeptide-motion-en.mp4`](renders/purepeptide-motion-en.mp4) (preview `-preview.mp4`) —
1920×1080 · 30 fps · 1350 frames · 45.000 s · −14.0 LUFS · TP −1.5 dBTP (`tools/verify_output.sh` PASS).

- Bible: `BRIEF.md` (idea, palette, type, VO, music, SFX, compliance) and `SCENES.md` (build contract, 11 scenes).
- Voice: **one** ElevenLabs v4 take, voice « Markmont », emotion tags (691 credits), sped up 7 %, cut into word-synced
  clips by `tools/build_vo.py` (`js/vo.js`). Music re-edited from the film-en track; every SFX synthesized locally
  (`tools/mix_audio.py`, `tools/audiolib.py`). No other ElevenLabs generation.
- Site: captured 2026-10-06 (`tools/capture_clean.cjs`, `assets/site/clean/`), with non-compliant elements hidden
  (certificate wording, COA, Recovery/tissue-repair copy, BAC-water upsell, G Pay, Retatrutide/MT-2 never shown).
  Editorial ellipsis: the « Explore the catalog » tap goes straight to the product page (the shop grid is skipped).
  Re-capture on release day if prices or offers change.
- iPhone: `assets/iphone/` (PHONE.md), rig `js/phone.js`.

## Before you run it
Not accepted by Google/YouTube, Meta, TikTok, Snapchat, X, Pinterest for this category — owned channels only, and
have counsel confirm the target country's rules. The offers must still be live on the site when the ad runs.

## Rebuild
```bash
python3 tools/build_vo.py && python3 tools/mix_audio.py && python3 tools/assemble.py
npx hyperframes render --quality delivery -o renders/master_video.mp4
ffmpeg -i renders/master_video.mp4 -i assets/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest renders/purepeptide-motion-en.mp4
tools/verify_output.sh renders/purepeptide-motion-en.mp4
```
