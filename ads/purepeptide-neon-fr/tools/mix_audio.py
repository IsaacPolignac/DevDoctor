#!/usr/bin/env python3
"""PurePeptide neon ad — final soundtrack: Hugo VO (ElevenLabs v3) + ElevenLabs Music + ElevenLabs SFX
(ring / whoosh / click / typing) + a few synthesized UI sounds (pops, ticks, roll ticks).

    python3 tools/mix_audio.py          # -> assets/audio/mix.wav (48 kHz, 24-bit, 30.000 s, -14 LUFS, TP <= -1.5 dBTP)

Every cue time below mirrors the SOUND-EVENT TABLE in SCENES.md. DSP helpers: tools/audiolib.py
(loudness BS.1770, look-ahead true-peak limiter, compressor, filters, synth voices)."""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audiolib as A  # noqa: E402
from audiolib import SR, N, S, db, hp, lp, bp, to_stereo, norm_peak, fade_out, attack_env, decode, to_48k  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
AUD = ROOT / "assets" / "audio"
A.VO_JS = ROOT / "js" / "vo.js"

MUSIC_FADER_DB = -5.0
DUCK_DB = -7.5          # music under the VO
SFX_BUS_DB = -3.0
MUSIC_FADE = (28.4, 29.95)


def load(name, ch=2):
    x, sr = decode(AUD / name, ch)
    return to_48k(x, sr)


def build_vo():
    take = load("vo_hugo.mp3", 1)[0]
    lines = A.load_vo_table()
    track = np.zeros(N)
    fade = S(0.012)
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(fade) / fade)
    for ln in lines:
        a, b = S(ln["src"][0]), S(ln["src"][1])
        seg = take[a:min(b, take.size)].copy()
        l = A.lufs_integrated(np.vstack([seg, seg])) - 10 * np.log10(2)
        seg *= db(float(np.clip(-14.0 - l, -2.0, 2.5)))   # level the lines
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        i0 = S(ln["at"])
        track[i0:i0 + seg.size] += seg[: N - i0]
    track = hp(track, 85.0, order=2)
    track = A.peaking(track, 3800.0, 2.0, 0.7)            # presence: a punchier, "announcer" read
    track, _ = A.vo_compressor(track)
    track *= db(-14.5 - A.lufs_integrated(np.vstack([track, track])))
    return track


def build_music(key):
    m = load("music_raw.mp3", 2)[:, :N]
    if m.shape[1] < N:
        m = np.pad(m, ((0, 0), (0, N - m.shape[1])))
    m *= db(MUSIC_FADER_DB)
    g = A.duck_curve(key, DUCK_DB)
    m *= db(A.ctrl_to_audio(g))
    t = np.arange(N) / SR
    f0, f1 = MUSIC_FADE
    env = np.clip((f1 - t) / (f1 - f0), 0, 1)
    return m * (0.5 - 0.5 * np.cos(np.pi * env))


def sample(name, a, b, peak_at=None):
    """Cut [a, b] s of an ElevenLabs SFX; returns (stereo, offset of its reference point)."""
    x = load("sfx/" + name, 2)
    seg = x[:, S(a):S(b)].copy()
    seg = fade_out(seg, min(0.08, (b - a) / 4)) * attack_env(seg.shape[1], 0.002)
    return seg, (peak_at - a) if peak_at is not None else 0.0


def main():
    vo = build_vo()
    key = A.vo_key(vo)
    music = build_music(key)
    sfx = np.zeros((2, N))

    def put(x, t, gain_db=0.0, pan=0.0):
        if x.ndim == 1:
            x = to_stereo(x, pan)
        i = S(t)
        j = min(N, i + x.shape[1])
        if i < 0:
            x, i = x[:, -i:], 0
        sfx[:, i:j] += x[:, : j - i] * db(gain_db)

    ring, _ = sample("sfx_ring.mp3", 0.0, 1.0)
    whoosh, wpk = sample("sfx_whoosh.mp3", 0.70, 2.60, peak_at=1.38)
    click, _ = sample("sfx_click.mp3", 0.0, 0.30)
    typing, _ = sample("sfx_type.mp3", 0.0, 0.66)

    # --- s1
    put(typing[:, : S(0.62)], 0.40, -6)
    put(click, 1.32 - 0.01, -4)
    put(A.swipe(0.5, 0.18, seed=3), 2.00 - 0.15, -9)
    put(whoosh, 4.15 - wpk, -5)                       # peak on the zoom-through (4.10 -> 4.233)
    # --- s2
    put(A.pop("C6", seed=11), 4.83, -10)
    put(A.pop("G5", seed=12), 5.37, -10)
    put(A.swipe(0.45, 0.2, pan=(-0.4, 0.5), seed=13), 5.85 - 0.12, -8)
    put(A.pop("C6", seed=14), 6.29, -9)
    put(A.tick(3000, seed=15), 6.91, -12)
    put(ring, 8.00 - 0.01, -5)
    put(A.impact(seed=16), 8.00, -10)
    # --- s3
    put(A.swipe(0.6, 0.3, pan=(0, 0), seed=17), 8.35, -16)   # scan line
    put(A.tick(3200, seed=18), 9.19, -10)
    put(A.tick(3600, seed=19), 10.33, -10)
    # --- s4: roll ticks accelerate then decelerate into the landing
    for k in range(14):
        u = (k + 0.5) / 14
        tk = 11.62 + 0.36 * (u - 0.35 * np.sin(2 * np.pi * u) / (2 * np.pi))
        put(A.tick(2600 + 60 * k, seed=200 + k), tk, -15 + 0.3 * k, 0.15 * (-1) ** k)
    put(ring, 12.00 - 0.01, -6)
    put(A.impact(seed=21), 12.00, -12)
    put(A.pop("G5", seed=22), 12.46, -9)
    # --- s5
    put(whoosh, 14.18 - wpk, -8)
    put(click, 16.70 - 0.01, -3)
    put(A.pop("C6", seed=31), 16.76, -9)
    # --- s6
    for k, t in enumerate([18.0, 18.083, 18.167, 18.25, 18.333, 18.417]):
        put(A.pop(["C5", "D5", "G5", "C6", "D6", "G6"][k], seed=40 + k), t, -9, [-0.5, 0.5, -0.3, 0.3, -0.1, 0.1][k])
    put(A.pop("G5", seed=47), 19.35, -9)
    put(A.pop("C6", seed=48), 20.35, -9)
    put(whoosh, 21.95 - wpk, -11)
    # --- s7
    put(ring, 22.00 - 0.01, -7)
    put(A.impact(seed=50), 22.00, -12)
    put(typing[:, : S(0.56)], 22.36, -7)
    put(A.pop("C6", seed=51), 24.31, -8)
    put(A.pop("G5", seed=52), 25.00, -9)
    put(click, 25.90 - 0.01, -3)

    sfx *= db(SFX_BUS_DB)
    sfx *= db(A.ctrl_to_audio(A.duck_curve(key, -3.0)))
    mix = music + sfx + to_stereo(vo)
    out, gain, _, lim = A.master(mix)
    A.write_wav24(AUD / "mix.wav", out)
    tp = A.true_peak_db(out)
    print(f"mix.wav: {out.shape[1] / SR:.3f} s  {A.lufs_integrated(out):.2f} LUFS  TP {tp:.2f} dBTP  "
          f"max limiter GR {lim.max():.2f} dB")
    for nm, st in [("vo", to_stereo(vo)), ("music", music), ("sfx", sfx)]:
        print(f"  {nm:5s} {A.lufs_integrated(st * db(gain)):.1f} LUFS")


if __name__ == "__main__":
    main()
