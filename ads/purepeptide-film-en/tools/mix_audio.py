#!/usr/bin/env python3
"""PurePeptide product film 60 s (EN, no voice-over) — soundtrack, built on the measured premium grammar
(ads/recherche-pubs/04-analyse-image-par-image.md): music-led, sound designed to the PICTURE (glass tinks, crimp
clicks, cap snap, light shimmers), sonic logo on the brand card and on the end logo, silence at the head and tail.

Music edit (source assets/audio/music_raw.mp3, ElevenLabs): T 0–2 silence · [0, 25.53) → T 2.00 (soft hits land on
T 10.00 = reveal, T 17.90, T 21.95) · [33.00, 44.47) → T 27.53 (build) · [44.47, 58.47) → T 39.00 (drop, beats every
0.5 s) · 53.00 final hit, music cut into a long tail, silence from ~58.5.   python3 tools/mix_audio.py"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audiolib as A  # noqa: E402

SR = A.SR
N = SR * 60
A.N = N
A.NC = N // A.CTRL
S, db = A.S, A.db
ROOT = Path(__file__).resolve().parents[1]
AUD = ROOT / "assets" / "audio"
EDIT = [(0.0, 25.53, 2.0), (33.0, 44.47, 27.53), (44.47, 58.47, 39.0)]
XF = 0.03


def load(name, ch=2):
    x, sr = A.decode(AUD / name, ch)
    return A.to_48k(x, sr)


def build_music():
    src = load("music_raw.mp3", 2)
    out = np.zeros((2, N))
    xf = S(XF)
    for k, (s0, s1, d) in enumerate(EDIT):
        seg = src[:, S(s0):min(S(s1) + xf, src.shape[1])].copy()
        if k:
            seg[:, :xf] *= np.linspace(0, 1, xf)
        seg[:, -xf:] *= np.linspace(1, 0, xf)
        i = S(d)
        j = min(N, i + seg.shape[1])
        out[:, i:j] += seg[:, : j - i]
    t = np.arange(N) / SR
    out *= db(np.interp(t, [2.0, 3.5], [-12.0, 0.0]))            # the head swells in from silence
    out *= np.clip((53.12 - t) / 0.12, 0, 1)                      # hard stop on the final hit
    return out * db(-3.0)


def sonic_logo(seed=90):
    t = np.arange(S(1.6)) / SR
    r = A.rng(seed)
    click = A.lp(A.hp(r.standard_normal(t.size), 2500), 9000) * np.exp(-t / 0.0015)
    tink = A.bell(A.hz("C6"), A.GLASS_TINK, dur=1.6, decay=0.6, seed=seed, strike=0.15)[0]
    tink2 = A.bell(A.hz("G6"), A.GLASS_TINK, dur=1.6, decay=0.5, seed=seed + 1, strike=0.1)[0]
    swell = np.sin(2 * np.pi * 65 * t) * np.exp(-t / 0.5) * (1 - np.exp(-t / 0.05))
    x = 0.5 * A.norm_peak(click) + 0.7 * tink[: t.size] + 0.35 * np.pad(tink2, (S(0.09), 0))[: t.size] + 0.35 * swell
    return A.norm_peak(A.fade_out(x, 0.25))


def glass_tick(note="E7", seed=0):
    return A.bell(A.hz(note), A.GLASS_TINK, dur=0.5, decay=0.12, seed=seed, strike=0.3)


def shimmer(dur=1.2, seed=0):
    """Light sweep: airy high band-passed noise swelling and fading (the sound of light crossing glass)."""
    t = np.arange(S(dur)) / SR
    r = A.rng(seed)
    x = A.bp(r.standard_normal((2, t.size)), 5000, 12000)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return A.norm_peak(x * env)


def tail(dur=5.5, seed=7):
    """Long ringing tail after the final hit: stacked glass partials with slow decay."""
    return A.norm_peak(A.bell(A.hz("C5"), A.GLASS_TINK, dur=dur, decay=2.2, seed=seed, strike=0.05) +
                       0.6 * A.bell(A.hz("G5"), A.GLASS_TINK, dur=dur, decay=1.8, seed=seed + 1, strike=0.05))


def main():
    music = build_music()
    sfx = np.zeros((2, N))

    def put(x, t, g=0.0, pan=0.0):
        if x.ndim == 1:
            x = A.to_stereo(x, pan)
        i = S(t)
        j = min(N, i + x.shape[1])
        sfx[:, i:j] += x[:, : j - i] * db(g)

    click = A.decode(AUD / "sfx/sfx_click.mp3", 2)
    click = A.to_48k(*click)[:, : S(0.3)]
    whoosh = A.to_48k(*A.decode(AUD / "sfx/sfx_whoosh.mp3", 2))[:, S(0.7):S(2.6)]
    wpk = 1.38 - 0.7
    logo = sonic_logo()

    put(A.norm_peak(A.lp(A.rng(2).standard_normal(S(4.0)), 90)) * np.linspace(0, 1, S(4.0)), 2.0, -30)  # sub bed rising
    put(shimmer(2.2, 3), 2.2, -20)            # the first line of light draws the vial (2–6)
    put(shimmer(1.6, 4), 4.2, -22)
    put(A.tick(2400, seed=5), 6.00, -16)      # macro crimp
    put(click, 8.00 - 0.03, -10)             # the cap, alone in the light
    put(glass_tick("C7", 6), 10.00, -12)      # REVEAL (music hit)
    put(logo, 12.50, -6)                      # brand card + sonic logo (brand within the first seconds of the reveal)
    for k, t in enumerate([14.5, 15.5, 16.0, 17.0, 17.4, 17.9, 18.9, 19.4]):   # detail/insert cuts
        put(glass_tick(["E7", "G7", "D7", "A7", "E7", "C7", "G7", "D7"][k], 10 + k), t, -22, 0.3 * (-1) ** k)
    put(shimmer(1.2, 20), 15.5, -22)
    put(shimmer(1.2, 21), 18.9, -22)
    put(shimmer(3.6, 22), 20.2, -24)          # turntable: reflections slide
    put(whoosh * 0.5, 24.0 - wpk, -14)        # card 1
    for k, t in enumerate([27.0, 28.5, 30.0, 31.5]):
        put(glass_tick(["G6", "C7", "E7", "G7"][k], 30 + k), t, -20)
    put(shimmer(2.0, 33), 33.0, -22)          # cold card
    for k in range(8):                        # burst 36–38: one tick per label change, rising
        put(A.tick(2200 + 180 * k, seed=40 + k), 36.0 + 0.25 * k, -13 + 0.4 * k, 0.2 * (-1) ** k)
    put(glass_tick("C7", 50), 38.0, -12)
    for t in [39.0, 41.0, 43.0, 45.0]:        # acceleration: speed-ramp whooshes
        put(whoosh, t - wpk, -12)
    for k, t in enumerate([45.0, 45.25, 45.5, 45.75]):
        put(A.tick(3000 + 200 * k, seed=60 + k), t, -14)
    put(shimmer(3.8, 70), 46.1, -20)          # line-up sweep
    put(shimmer(2.8, 71), 50.1, -22)          # smoke / backlight
    put(A.impact(seed=80), 53.00, -8)         # final hit on the cut to the logo
    put(logo, 53.00, -4)
    put(tail(), 53.05, -14)

    mix = music + sfx
    out, gain, _, lim = A.master(mix)
    t = np.arange(N) / SR
    out = out * np.clip((58.9 - t) / 0.4, 0, 1)   # 1 s of silence at the end
    A.write_wav24(AUD / "mix.wav", out)
    print(f"mix.wav: {out.shape[1] / SR:.3f} s  {A.lufs_integrated(out):.2f} LUFS  TP {A.true_peak_db(out):.2f} dBTP  max GR {lim.max():.2f} dB")


if __name__ == "__main__":
    main()
