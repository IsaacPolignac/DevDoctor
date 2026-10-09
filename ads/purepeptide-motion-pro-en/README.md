# PurePeptide — « A Line of Light », 45 s 3D motion-design film, 16:9, English

> **Light reveals; nothing is printed.** A point of light in a water drop finds the word "pure" screen-printed on black steel
> (easy to print). The same word lives in the phone's black cover glass only as a reflection and slides off on "prove." (hard
> to prove). The real vial is measured by passing light. Frost takes the vial; the photoreal phone arrives through the frost,
> dark, and wakes on "Open the site". One unbroken 3D take then dives into the live cart, lifts its own quantity, compound
> name and line total off the glass as thin slabs, orbits under the site's own "Purity, proven.", turns edge-on into a single
> vertical line of light, STOP, and the line becomes the brand symbol.

Not an ad grammar: no offer cards, no stamps, no sales callouts. Five typed events in 45 s; one object (the photoreal Deep Blue
iPhone, no Apple logo) carries every beat; sound is locked to the fastest frame of every 3D move, with three real silences.

## Deliverables (`delivery/`)

| file | what |
|---|---|
| `purepeptide-a-line-of-light.mp4` | master: 1920×1080 · 30 fps · 1350 frames · 45.000 s · H.264 + AAC 320k · −14 LUFS |
| `purepeptide-a-line-of-light-preview.mp4` | light preview for phones / messaging |
| `contact.png` | 1 frame per second |
| `motion/` | the 3D layers as **ProRes 4444 with alpha** for Apple Motion / Final Cut (see below) |

Bible: `BRIEF.md` (idea, look, lights, VO, music plan, SFX cue sheet, compliance), `SHOTS.md` (build contract, 13 shots + QC
gates), `TECH.md` (measured facts, pipeline), `BUILD.md` (scaffold API).

## How it is made

- **3D: Blender 5 Cycles** (CPU, ≈ 3 h of render). `blender/`: S01 water drop on brushed steel, S02 reflection in the black
  glass, and one 481-frame take of the phone (f708–f1188: arrival, dive, cart slabs, hero orbit, exit to a line of light). The
  site is an image *sequence* on the 3D screen (`screen/`, baked from the real captures in `assets/site/clean/`). Passes: ID
  mattes (screen, cards, phone), shadow catcher, per-frame screen corners (`corners.json`). Post in numpy
  (`tools/post_layers.py`): highlight soft-clip, frost v2 on the phone, contact shadows gated to the slabs, exit glint.
- **Frost v2**: `tools/make_frost_v2.py` — deterministic branching dendritic ice (translucent, the vial ghosts through), on the
  plate and on the phone, thawing from the screen outward.
- **Vial**: the real PurePeptide vial as photoreal AI plates (`assets/plates/ai/`, conformed to 30 fps), measured by light in
  2D (bands, rack focus, glints).
- **Compositing / type / camera FX: HyperFrames** (HTML + GSAP, one paused timeline, `tools/assemble.py` → `index.html`).
- **Voice: ElevenLabs v4**, one continuous emotional performance with audio tags, voice « Markmont », two takes generated
  (Markmont kept, see `assets/audio/vo_v4/VOICE.md`), cut on silences into word-locked clips by `tools/build_vo.py`
  (`js/vo.js`). The v4 node exposes no stability/style sliders: the emotion comes from the tags, the punctuation and the voice.
- **Music: ElevenLabs Music** (one 45.6 s instrumental). The file is flat, so the arc (silent open, build, DROP 24.6 s, STOP
  39.6 s, logo hit 40.2 s, silent end) is built in the mix (`assets/audio/MUSIC.md`). Every SFX is synthesized locally
  (`tools/mix_audio.py`, `tools/audiolib.py`), locked to the 3D speed peaks (`pose_speed.json`).
- **ElevenLabs spend for this film: ≈ 1,929 credits** (2 voice takes × 627 + music 675). Nothing else.

## Apple Motion / Final Cut (`delivery/motion/`)

- `s01.mov` (opaque, f30–f126), `s02.mov` (alpha, f126–f216), `take.mov` (alpha, f708–f1188): ProRes 4444, straight alpha.
  Drop each at its first frame (timeline frame = file frame + start frame, 30 fps).
- `take_corners.json`: the four screen corners of the phone for every frame of the take, keyed by film frame (TL TR BR BL, pixels at 1920×1080). In Motion, use them
  to pin a replacement screen (corner-pin / Four Corner filter), e.g. to swap in a new capture of the site without re-rendering.
- `hold_1188.png`: the last frame of the take (the line of light), held through the STOP.
- The full film is also the HyperFrames project itself: `npx hyperframes preview` opens it in the browser.

## Before you run it

- **Owned channels only.** Ads for research peptides are not accepted by Google/YouTube, Meta, TikTok, Snapchat, X or Pinterest.
  Have a lawyer confirm the rules of each target country before publishing.
- Claims on screen and in the voice are limited to: every batch independently tested (Janoshik Analytical), HPLC purity 99 %
  minimum, shipped cold within 24 h, and the cart's own offers shown as the site shows them. No people, no body, no effects or
  benefits, no dosing; legal line on the end card for the last 4 s: "For laboratory research use only · Not for human or veterinary
  consumption · 21+".
- The cart shows real prices captured on 2026-10-06 ($84.99 line price → 3 vials −8 % = $234.57, free shipping unlocked). If
  prices or offers change, re-capture the site and re-bake the screen before release (`tools/bake_screen.cjs`, then re-render the
  take f823–f1152).

## QC (SHOTS Appendix 2.2)

- `bake_qc` PASS · lint 0 errors · `check_text` 0 failures (0–45 s every 0.25 s) · OCR compliance 0 forbidden words (full film
  at 0.5 s + the cart section at 0.25 s) · cut checks PASS (f738 registration 0.9997 overlap, f930 bake vs capture 0.024 lv,
  f1188 line of light x 956–958).
- Mix: −14.00 LUFS, true peak −2.2 dBTP (−1.9 after AAC), voice ≥ 9 dB over music on every word, whooshes on the measured
  fastest frames (0 frames off), OPEN / STOP / END digital silence.
- Final pass fixes: the S02 reflection now slides off the glass on "prove." (ghost track re-rendered f163–f216); the exit glint
  is a 7-frame sheen instead of one white frame (f1172); the cart slabs' shadows only where they touch a slab (no grey blobs on
  the empty page); the four AI vial plates conformed 24 → 30 fps with motion-compensated interpolation (no 3:2 judder);
  S07 now holds frost v2 through the phone's arrival (the stage still held the old frost image f708–f738), the field fades to
  black as a soft vignette closing on the phone (no jagged rectangle), and the f708 hand-off no longer flashes.
- Known, accepted: LRA 5.1 LU (the voice runs nearly wall to wall; EBU R128 s1 does not apply LRA to adverts); a one-frame
  depth-of-field step at the S09 → S10 cut (f936) and a near-still close pose f868–f936 (both baked in the take, subtle).

## Rebuild

```bash
python3 tools/build_vo.py && python3 tools/mix_audio.py && python3 tools/assemble.py
npx hyperframes render --quality delivery -o renders/master_video.mp4
ffmpeg -i renders/master_video.mp4 -i assets/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest \
  delivery/purepeptide-a-line-of-light.mp4
tools/verify_output.sh delivery/purepeptide-a-line-of-light.mp4
```

3D (only if the screen or the moves change): `python3 tools/render_queue.py` (Blender, see `blender/queue.json`), then
`python3 tools/post_layers.py take` and `bash tools/encode_layers.sh take`.
