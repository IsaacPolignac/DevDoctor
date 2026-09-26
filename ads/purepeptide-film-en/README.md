# PurePeptide — product film, 60 s, 16:9, English (promo cut)

Apple-style product film (Blender Cycles stills, three.js plates, real catalog renders) turned into a promotional ad:
English voice-over, coloured « worlds » on some shots (white studio, brand blue, navy) and the site's real offers.
Deliverable: [`renders/purepeptide-film-en.mp4`](renders/purepeptide-film-en.mp4) (preview: `renders/purepeptide-film-en-preview.mp4`).

Script (VO, Kokoro `am_fenrir`): « Most labels promise purity. Few can prove it. This is PurePeptide. Identity,
confirmed. Purity, measured. Every batch, independently tested. Ninety-nine percent purity. Minimum. Shipped cold,
within twenty-four hours. Six compounds. One standard. Buy more, save more. Two vials, five percent off. Three or more,
eight percent off. Free shipping on orders over two hundred dollars. No promises. Just proof. PurePeptide. Purity,
proven. Shop now, at purepeptide dot care. »

Edit decision list and timings: `SCENES.md`.

## Before you run it
- Not accepted by Google/YouTube, Meta, TikTok, Snapchat, X, Pinterest for this product category — owned channels only,
  and have counsel confirm the target country's rules (see `../recherche-pubs/03-plateformes-conformite.md`).
- Offers (2 vials −5 %, 3+ vials −8 %, free shipping over $200) must still be live on the site when the ad runs.
- Better voice: with ~550 ElevenLabs credits, regenerate the lines (one file per line in `assets/audio/vo/`, same names).

## Rebuild
```bash
python3 tools/mix_audio.py && python3 tools/gen_index.py
npx hyperframes render --quality delivery -o renders/purepeptide-film-en.mp4
ffmpeg -i renders/purepeptide-film-en.mp4 -i assets/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k out.mp4
tools/verify_output.sh out.mp4
```
