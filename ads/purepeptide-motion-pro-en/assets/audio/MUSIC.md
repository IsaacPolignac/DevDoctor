# Music — `music_raw.mp3` (ElevenLabs `eleven_music_v2_5`, one generation, 675 credits, 45.6 s, instrumental)

Prompt: BRIEF §6. Flow https://elevenlabs.io/app/flows/m2eq0xdoFKFVVUhMjigz (node sYiR1ew5pXs8xrFrWS93).

**Measured (mono RMS per 0.5 s, dBFS):** the track is *flat*: −14…−16 dB from 0.0 to 38.0 s, with no quiet opening, no
audible level jump at 24.6 s and no one-beat silence; it fades out on its own from 38.5 s (−23) to digital silence by
≈ 43 s. So the arc the picture needs (OPEN silence → cold intro → build → DROP 24.6 → groove → STOP 39.6 → LOGO hit
40.2 → tail → silence 44.5) must be **made in the mix**, not found in the file:

- Measure the tempo anyway (kick-band autocorrelation) and the key (chroma vs D) and retune the pitched SFX if needed.
- `EDIT` suggestion: `[(0.0, 39.6, 0.0), (38.2, 43.0, 40.2)]` — the body straight through, hard gate at the STOP window
  (39.6–40.2 digital zero, 30 ms pre-fade), then the track's own fade-out placed under the synthesized LOGO hit as its
  tail (gone by 44.5). Nudge the first segment's start so a downbeat (from the autocorrelation grid) lands on 24.60.
- Fader ride (dB, music bus, before ducking): 0–1.0 s gated silence (OPEN) → −16 at 1.0 → −10 at 9.0 → −6 at 21.0 →
  riser region 21–24.6 rising to −2 → **+0 at 24.60 with a 2-frame step** (the DROP is the `impact` + this step) →
  0 to 36.0 → −6 by 39.0 → gate 39.6. A 18 kHz → 900 Hz low-pass ride over 34–39.6 sells the "thins to pad" line.
- The DROP, STOP and LOGO cues in `js/cues.js` are therefore the picture-locked values (24.60 / 39.60 / 40.20), not
  measured ones; freeze them.
