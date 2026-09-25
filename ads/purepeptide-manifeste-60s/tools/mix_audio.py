#!/usr/bin/env python3
"""PurePeptide 60 s manifesto — soundtrack: Paul K VO (ElevenLabs v3) + ElevenLabs Music (re-edited to 60 s) +
ElevenLabs SFX (ring / whoosh / click / typing) + synthesized hits, ticks, pops and a flickering-neon hum.

    python3 tools/mix_audio.py      # -> assets/audio/mix.wav (48 kHz, 24-bit, 60.000 s, -14 LUFS, TP <= -1.5 dBTP)

Music edit (source = assets/audio/music_raw.mp3, 87 s): [0, 12.0) -> T 0 ; [16.0, 18.5) -> T 12.0 (the hit at 16 s
lands on « Nous aussi ») ; [41.97, 44.47) -> T 14.5 (riser) ; [44.47, 87.5) -> T 17.0 (DROP at 17.00, beats every
0.5 s). Cue times mirror the SOUND-EVENT TABLE in SCENES.md."""
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
A.VO_JS = ROOT / "js" / "vo.js"

EDIT = [(0.0, 12.0, 0.0), (16.0, 18.5, 12.0), (41.97, 44.47, 14.5), (44.47, 87.5, 17.0)]  # (src0, src1, dst)
XF = 0.03
MUSIC_FADER_DB = -4.0
DUCK_DB = -8.0


def load(name, ch=2):
    x, sr = A.decode(AUD / name, ch)
    return A.to_48k(x, sr)


def build_vo():
    take = load("vo.mp3", 1)[0]
    lines = A.load_vo_table()
    track = np.zeros(N)
    fade = S(0.012)
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(fade) / fade)
    for ln in lines:
        a, b = S(ln["src"][0]), S(ln["src"][1])
        seg = take[a:min(b, take.size)].copy()
        l = A.lufs_integrated(np.vstack([seg, seg])) - 10 * np.log10(2)
        seg *= db(float(np.clip(-14.0 - l, -2.5, 2.5)))
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        i0 = S(ln["at"])
        track[i0:i0 + seg.size] += seg[: N - i0]
    track = A.hp(track, 80.0, order=2)
    track = A.peaking(track, 3500.0, 1.5, 0.7)
    track, _ = A.vo_compressor(track)
    track *= db(-14.5 - A.lufs_integrated(np.vstack([track, track])))
    return track


def build_music(key):
    src = load("music_raw.mp3", 2)
    out = np.zeros((2, N))
    xf = S(XF)
    for k, (s0, s1, d) in enumerate(EDIT):
        a, b = S(s0), min(S(s1) + xf, src.shape[1])
        seg = src[:, a:b].copy()
        if k:  # fade in over XF (the previous segment fades out over the same XF)
            seg[:, :xf] *= np.linspace(0, 1, xf)
        if k < len(EDIT) - 1:
            seg[:, -xf:] *= np.linspace(1, 0, xf)
        i = S(d)
        j = min(N, i + seg.shape[1])
        out[:, i:j] += seg[:, : j - i]
    out *= db(MUSIC_FADER_DB)
    out *= db(A.ctrl_to_audio(A.duck_curve(key, DUCK_DB)))
    t = np.arange(N) / SR
    return out * np.clip((59.9 - t) / 0.6, 0, 1)


def sample(name, a, b, peak_at=None):
    x = load("sfx/" + name, 2)
    seg = x[:, S(a):S(b)].copy()
    seg = A.fade_out(seg, min(0.08, (b - a) / 4)) * A.attack_env(seg.shape[1], 0.002)
    return seg, (peak_at - a) if peak_at is not None else 0.0


def neon_hum(dur, seed=5):
    """Fluorescent tube: 100 Hz buzz + harmonics, crackle bursts, flicker amplitude (deterministic)."""
    t = np.arange(S(dur)) / SR
    r = A.rng(seed)
    x = sum((0.5 / k) * np.sin(2 * np.pi * 100 * k * t + k) for k in range(1, 9))
    x += 0.15 * A.bp(r.standard_normal(t.size), 1500, 6000) * (r.random(t.size) > 0.9985)
    flick = np.ones(t.size)
    for f0 in [0.35, 1.9, 2.05, 4.4, 6.7, 6.8, 9.3, 10.9, 11.0, 11.3]:  # same times as the picture flicker (SCENES.md)
        i = S(f0)
        flick[i:i + S(0.06)] = 0.15
    x *= np.convolve(flick, np.ones(96) / 96, mode="same")
    return A.norm_peak(A.hp(x, 80))


def main():
    vo = build_vo()
    key = A.vo_key(vo)
    music = build_music(key)
    sfx = np.zeros((2, N))

    def put(x, t, gain_db=0.0, pan=0.0):
        if x.ndim == 1:
            x = A.to_stereo(x, pan)
        i = S(t)
        if i < 0:
            x, i = x[:, -i:], 0
        j = min(N, i + x.shape[1])
        sfx[:, i:j] += x[:, : j - i] * db(gain_db)

    ring, _ = sample("sfx_ring.mp3", 0.0, 1.0)
    whoosh, wpk = sample("sfx_whoosh.mp3", 0.70, 2.60, peak_at=1.38)
    click, _ = sample("sfx_click.mp3", 0.0, 0.30)
    typing, _ = sample("sfx_type.mp3", 0.0, 0.66)
    slam = lambda seed: A.stat_hit("C2", seed=seed)  # noqa: E731  deep type slam

    # --- s1 pain (0-12): neon hum + type slams
    hum = neon_hum(12.0)
    hum[-S(0.3):] *= np.linspace(1, 0, S(0.3))
    put(hum, 0.0, -24)
    for k, t in enumerate([1.54, 4.30, 6.90, 9.52]):
        put(slam(10 + k), t, -11)
    # --- s2 turn
    put(A.impact(seed=20), 12.00, -9)
    put(slam(21), 12.34, -8)
    put(whoosh, 16.90 - wpk, -9)
    put(ring, 17.00 - 0.01, -5)
    put(A.impact(seed=22), 17.00, -10)
    # --- s3 proof
    put(A.pop("C6", seed=30), 18.94, -9)
    put(A.tick(3200, seed=31), 21.07, -9)
    put(A.tick(3600, seed=32), 22.55, -9)
    for k in range(14):
        u = (k + 0.5) / 14
        put(A.tick(2600 + 60 * k, seed=300 + k), 23.62 + 0.36 * (u - 0.35 * np.sin(2 * np.pi * u) / (2 * np.pi)), -15, 0.15 * (-1) ** k)
    put(ring, 24.00 - 0.01, -6)
    put(A.impact(seed=33), 24.00, -12)
    put(A.pop("G5", seed=34), 24.48, -9)
    put(whoosh, 26.95 - wpk, -12)
    # --- s4 test
    put(slam(40), 29.93, -7)
    put(whoosh, 30.40 - wpk, -9)
    for t in [31.40, 32.00, 32.667, 34.50, 37.033, 41.067, 42.167]:  # real clicks in the recording
        put(click, t - 0.04, -4)
    put(A.swipe(0.35, 0.12, seed=41), 34.52, -14)
    put(A.swipe(0.35, 0.12, pan=(-0.5, 0.5), seed=42), 37.05, -14)
    put(A.pop("C6", seed=43), 42.47, -9)
    put(A.pop("G5", seed=44), 43.57, -9)
    put(whoosh, 44.30 - wpk, -10)
    # --- s5 end
    for k, t in enumerate([44.50, 44.75, 45.00, 45.25, 45.50, 45.75]):
        put(A.pop(["C5", "D5", "G5", "C6", "D6", "G6"][k], seed=50 + k), t, -10, [-0.5, 0.5, -0.3, 0.3, -0.1, 0.1][k])
    put(slam(56), 46.53, -8)
    put(slam(57), 47.83, -7)
    put(ring, 48.00 - 0.01, -6)
    put(A.impact(seed=58), 48.00, -11)
    put(typing[:, : S(0.56)], 49.53, -7)
    put(A.pop("C6", seed=59), 51.72, -8)
    put(A.pop("G5", seed=60), 53.00, -9)
    put(click, 54.00 - 0.04, -3)

    sfx *= db(-2.0)
    sfx *= db(A.ctrl_to_audio(A.duck_curve(key, -3.0)))
    mix = music + sfx + A.to_stereo(vo)
    out, gain, _, lim = A.master(mix)
    A.write_wav24(AUD / "mix.wav", out)
    print(f"mix.wav: {out.shape[1] / SR:.3f} s  {A.lufs_integrated(out):.2f} LUFS  TP {A.true_peak_db(out):.2f} dBTP  max GR {lim.max():.2f} dB")
    print("GR>2dB at:", [i / 2 for i in range(120) if lim[i * SR // 2:(i + 1) * SR // 2].max() > 2])
    for nm, st in [("vo", A.to_stereo(vo)), ("music", music), ("sfx", sfx)]:
        print(f"  {nm:5s} {A.lufs_integrated(st * db(gain)):.1f} LUFS")


if __name__ == "__main__":
    main()
