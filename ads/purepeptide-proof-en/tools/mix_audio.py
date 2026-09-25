#!/usr/bin/env python3
"""PurePeptide « Proof » 60 s (EN) — soundtrack: English VO (Kokoro-82M af_heart, one file per line) + sonic logo + ElevenLabs Music (re-edited to 60 s) +
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
    lines = A.load_vo_table()
    track = np.zeros(N)
    fade = S(0.010)
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(fade) / fade)
    for ln in lines:
        x, sr = A.decode(ROOT / ln["file"], 1)
        take = A.to_48k(x, sr)[0]
        a, b = S(max(0.0, ln["src"][0] - 0.03)), S(ln["src"][1] + 0.08)
        seg = take[a:min(b, take.size)].copy()
        l = A.lufs_integrated(np.vstack([seg, seg])) - 10 * np.log10(2)
        seg *= db(float(np.clip(-14.0 - l, -3.0, 4.0)))
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        i0 = S(ln["at"] - 0.03)
        track[i0:i0 + seg.size] += seg[: N - i0]
    track = A.hp(track, 90.0, order=2)
    track = A.peaking(track, 180.0, 2.0, 0.8)    # a little chest for the light Kokoro timbre
    track = A.peaking(track, 3500.0, 1.5, 0.7)
    track, _ = A.vo_compressor(track)
    track *= db(-14.5 - A.lufs_integrated(np.vstack([track, track])))
    return track


def sonic_logo(seed=90):
    """PurePeptide sonic signature: soft seal click + glass vial tink (C6 + G6) + low swell. ~1.4 s."""
    t = np.arange(S(1.4)) / SR
    r = A.rng(seed)
    click = A.lp(A.hp(r.standard_normal(t.size), 2500), 9000) * np.exp(-t / 0.0015)
    tink = A.bell(A.hz("C6"), A.GLASS_TINK, dur=1.4, decay=0.5, seed=seed, strike=0.15)[0]
    tink2 = A.bell(A.hz("G6"), A.GLASS_TINK, dur=1.4, decay=0.45, seed=seed + 1, strike=0.1)[0]
    swell = np.sin(2 * np.pi * 65 * t) * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.05))
    x = 0.5 * A.norm_peak(click) + 0.7 * tink[: t.size] + 0.35 * np.pad(tink2, (S(0.09), 0))[: t.size] + 0.35 * swell
    return A.norm_peak(A.fade_out(x, 0.2))


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
    dip = np.interp(t, [51.30, 51.55, 52.30, 52.45], [0.0, -20.0, -20.0, 0.0])  # 0.75 s of near-silence before « PurePeptide. »
    return out * db(dip) * np.clip((59.9 - t) / 0.6, 0, 1)


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

    import json
    mk = {m["name"]: 31.4 + m["t"] for m in json.load(open(ROOT / "assets/site-test/marks.json"))["marks"]}
    logo = sonic_logo()
    # --- s1: sonic logo on the vial, then the pain (neon hum + slams)
    put(logo, 0.00, -6)
    hum = neon_hum(9.8)
    hum[-S(0.4):] *= np.linspace(1, 0, S(0.4))
    put(hum, 2.40, -25)
    for k, t in enumerate([3.39, 6.58, 9.67]):
        put(slam(10 + k), t, -11)
    # --- s2 turn
    put(A.impact(seed=20), 12.00, -9)
    put(slam(21), 12.30, -8)
    put(whoosh, 16.90 - wpk, -9)
    put(ring, 17.00 - 0.01, -5)
    put(A.impact(seed=22), 17.00, -10)
    # --- s3 proof blocks (Dyson-style: one title + one number)
    put(A.pop("C6", seed=30), 18.55, -9)
    put(A.tick(3200, seed=31), 20.48, -9)
    put(A.tick(3600, seed=32), 22.23, -9)
    for k in range(14):
        u = (k + 0.5) / 14
        put(A.tick(2600 + 60 * k, seed=300 + k), 23.62 + 0.36 * (u - 0.35 * np.sin(2 * np.pi * u) / (2 * np.pi)), -15, 0.15 * (-1) ** k)
    put(ring, 24.00 - 0.01, -6)
    put(A.impact(seed=33), 24.00, -12)
    put(A.pop("G5", seed=34), 24.29, -9)
    put(A.pop("C6", seed=35), 26.24, -10)
    put(A.pop("G5", seed=36), 26.96, -10)
    put(whoosh, 28.75 - wpk, -12)
    # --- s4 check it yourself + real site test
    put(slam(40), 30.60, -7)
    put(whoosh, 31.40 - wpk, -9)
    for name in ["check1", "check2", "enter", "catalog-click", "product-click", "add-click", "cart-click"]:
        put(click, mk[name] - 0.04, -4)
    put(A.swipe(0.35, 0.12, seed=41), mk["shop"], -14)
    put(A.swipe(0.35, 0.12, pan=(-0.5, 0.5), seed=42), mk["product"], -14)
    for k, t in enumerate([43.36, 45.48, 46.20]):        # offer cards: 5% · 8% · free shipping
        put(A.pop(["C6", "G6", "C7"][k], seed=45 + k), t, -9)
    put(whoosh, 47.30 - wpk, -10)
    # --- s5 line-up, climax, logo
    for k, t in enumerate([47.50, 47.75, 48.00, 48.25, 48.50, 48.75]):
        put(A.pop(["C5", "D5", "G5", "C6", "D6", "G6"][k], seed=50 + k), t, -10, [-0.5, 0.5, -0.3, 0.3, -0.1, 0.1][k])
    put(slam(56), 49.50, -8)
    put(slam(57), 50.75, -7)
    put(ring, 51.00 - 0.01, -7)
    put(logo, 52.40, -4)
    put(A.pop("C6", seed=59), 53.86, -9)
    put(A.pop("G5", seed=60), 55.00, -9)
    put(click, 56.00 - 0.04, -3)

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
