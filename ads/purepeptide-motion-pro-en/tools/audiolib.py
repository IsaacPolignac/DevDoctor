#!/usr/bin/env python3
"""PurePeptide "SPELLED OUT" 45 s (EN): DSP + SFX library for tools/mix_audio.py.

Ported from the 30 s SaaS / film-en audiolib and retuned for this film (BRIEF §7 "library retune"):
the music (film-en Track A) is centred on D, so every pitched SFX sits on D and A, with E and G as passing
notes only (never F, F#, C#):
    impact      sub drop -> D1 (36.7 Hz)               stat_hit   body -> D2 (73.4 Hz), accent on A/D
    shimmer     glass bells D6 / A6 / D7 / E7, grains on D/E/A 7-8
    soft_chime  D6 + A6                                 sonic_logo seal click + A5 -> D6 tinks (+90 ms) + 73.4 Hz swell
    tail        D5 / A5 ring-out
New short functions (BRIEF §8 "new"): stamp, grains, frost, zip_up, reverse_swell, bloom, alu_tick, tsk, haptic,
add_to_cart, stamp_soft, thoomp, sub_swell, sub_bed, band_rise, tick_train.
"A LINE OF LIGHT" additions (pro-en BRIEF §7 NEW, <= 20 lines each, seeded, peak-normalised): alu_ring, glass_settle,
pulse_riser, doppler_whoosh, screen_wake, button_click; de_esser for the voice chain.

Everything is float64 numpy with fixed seeds: a re-run is bit-identical. The module-level N / NC are the
timeline length; mix_audio.py sets them (A.N = 45 * 48000) before building anything.
"""
from __future__ import annotations

import subprocess
import wave
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

# ═══════════════════════════════ constants ═══════════════════════════════
SR = 48_000
N = 45 * SR                                    # exactly 45.000 s (mix_audio.py sets it again)
DURATION = N / SR
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
LIMITER_CEILING_DB = -2.2                      # internal ceiling: the deliverable is AAC 320 k (SHOTS §2.3) and the AAC encode
                                               # MEASURED +0.32 dB of true-peak overshoot (wav -1.62 -> mp4 -1.3 dBTP, failing
                                               # verify_output's <= -1.5): 0.7 dB of codec margin + dither
ROOT = Path(__file__).resolve().parents[1]
TWO_PI = 2 * np.pi
CTRL = 48                                      # control-rate block for envelopes: 1 ms
NC = N // CTRL

VO_REF_LUFS = -15.0            # processed VO track level before the master stage (BRIEF §7 voice chain)
SFX_DUCK_DB = -4.0
DUCK_ATTACK, DUCK_RELEASE, DUCK_LOOKAHEAD, DUCK_HOLD = 0.040, 0.350, 0.030, 0.060
DUCK_BRIDGE = 0.60             # pauses shorter than this inside the VO keep the key on (no pumping on commas)

# ═══════════════════════════════ helpers ═══════════════════════════════
def S(t: float) -> int:
    """Seconds to sample index (placement is t * 48000, rounded)."""
    return int(round(t * SR))


def tvec(dur: float) -> np.ndarray:
    return np.arange(S(dur)) / SR


def db(x: float) -> float:
    return 10.0 ** (x / 20.0)


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
       "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def hz(note: str) -> float:
    """'A6' -> 1760 Hz (A4 = 440)."""
    midi = 12 * (int(note[-1]) + 1) + _PC[note[:-1]]
    return 440.0 * 2.0 ** ((midi - 69) / 12)


def attack_env(n: int, a: float) -> np.ndarray:
    """Raised-cosine fade-in over `a` seconds (kills onset clicks)."""
    e = np.ones(n)
    k = min(n, max(1, S(a)))
    e[:k] = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    return e


def fade_out(x: np.ndarray, dur: float) -> np.ndarray:
    k = min(x.shape[-1], S(dur))
    if k > 0:
        x[..., -k:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, k + 1) / k)
    return x


def pan_gains(p):
    a = (np.clip(p, -1.0, 1.0) + 1.0) * np.pi / 4
    return np.cos(a), np.sin(a)


def to_stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """Mono -> equal-power pan; stereo -> balance (centre = unity)."""
    if x.ndim == 2:
        if pan == 0.0:
            return x
        return np.vstack([x[0] * min(1.0, 1.0 - pan), x[1] * min(1.0, 1.0 + pan)])
    gl, gr = pan_gains(pan)
    return np.vstack([x * gl, x * gr])


def auto_pan(x: np.ndarray, p0: float, p1: float) -> np.ndarray:
    """Pan moving p0 -> p1 over the sound (mono or decorrelated stereo in)."""
    n = x.shape[-1]
    gl, gr = pan_gains(np.linspace(p0, p1, n))
    if x.ndim == 1:
        return np.vstack([x * gl, x * gr])
    return np.vstack([x[0] * gl, x[1] * gr]) * np.sqrt(2)


def norm_peak(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def ms_env(x: np.ndarray) -> np.ndarray:
    """Mean-square per 1 ms control block (channels averaged)."""
    x2 = np.atleast_2d(x)
    p = (x2[:, :NC * CTRL] ** 2).mean(axis=0)
    return p.reshape(NC, CTRL).mean(axis=1)


def ctrl_to_audio(g: np.ndarray) -> np.ndarray:
    """Control-rate curve (one value per 1 ms block, at the block centre) -> per-sample, linear interp."""
    centres = (np.arange(g.size) + 0.5) * CTRL
    return np.interp(np.arange(N), centres, g)


def ballistics(target_db: np.ndarray, attack: float, release: float, dt: float = CTRL / SR) -> np.ndarray:
    """One-pole smoother in dB: `attack` when the value falls (more reduction), `release` when it rises.
    Times are 10-90 % times (tau = T / ln 9)."""
    aa = 1.0 - np.exp(-dt * np.log(9) / attack)
    ar = 1.0 - np.exp(-dt * np.log(9) / release)
    y = np.empty_like(target_db)
    cur = 0.0
    for i, v in enumerate(target_db.tolist()):
        cur += (v - cur) * (aa if v < cur else ar)
        y[i] = cur
    return y


def soft_knee_gr(level_db: np.ndarray, thresh: float, ratio: float, knee: float) -> np.ndarray:
    """Static compressor curve: gain change (dB, <= 0) for a detector level."""
    over = level_db - thresh
    slope = 1.0 / ratio - 1.0
    gr = np.where(over <= -knee / 2, 0.0, slope * over)
    mid = np.abs(over) < knee / 2
    gr[mid] = slope * (over[mid] + knee / 2) ** 2 / (2 * knee)
    return gr


# ─────────────────────────────── filters ───────────────────────────────
def _butter(x, kind, fc, order):
    sos = signal.butter(order, fc, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    return _butter(x, "highpass", fc, order)


def lp(x, fc, order=2):
    return _butter(x, "lowpass", fc, order)


def bp(x, f1, f2, order=2):
    return _butter(x, "bandpass", [f1, f2], order)


def peaking(x: np.ndarray, fc: float, gain_db: float, q: float) -> np.ndarray:
    """RBJ peaking EQ."""
    a_ = 10 ** (gain_db / 40)
    w0 = TWO_PI * fc / SR
    alpha = np.sin(w0) / (2 * q)
    b = np.array([1 + alpha * a_, -2 * np.cos(w0), 1 - alpha * a_])
    a = np.array([1 + alpha / a_, -2 * np.cos(w0), 1 - alpha / a_])
    return signal.lfilter(b / a[0], a / a[0], x, axis=-1)


def _rbj(kind: str, fc: float, q: float):
    w0 = TWO_PI * fc / SR
    c, alpha = np.cos(w0), np.sin(w0) / (2 * q)
    if kind == "lp":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif kind == "hp":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:                                   # band-pass, 0 dB peak
        b = [alpha, 0.0, -alpha]
    a0 = 1 + alpha
    return np.array(b) / a0, np.array([1.0, -2 * c / a0, (1 - alpha) / a0])


def sweep_filter(x: np.ndarray, fc, q: float = 0.707, kind: str = "lp", block: int = 32) -> np.ndarray:
    """Resonant biquad whose cutoff follows `fc` (scalar or per-sample Hz), 32-sample blocks, carried state."""
    x2 = np.atleast_2d(x)
    n = x2.shape[-1]
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    y = np.empty_like(x2)
    z = np.zeros((x2.shape[0], 2))
    for i in range(0, n, block):
        j = min(n, i + block)
        b, a = _rbj(kind, float(np.clip(fc[(i + j) // 2], 20.0, 0.45 * SR)), q)
        y[:, i:j], z = signal.lfilter(b, a, x2[:, i:j], axis=-1, zi=z)
    return y if x.ndim == 2 else y[0]


# ─────────────────────────────── reverbs ───────────────────────────────
def make_ir(rt60: float, length: float, seed: int, predelay: float = 0.0) -> np.ndarray:
    """Exponentially decaying noise IR, highs decaying faster (4 bands), soft build-up, unit energy."""
    n = S(length)
    t = np.arange(n) / SR
    noise = rng(seed).standard_normal(n)
    bands = [(lp(noise, 450, 4), 1.15), (bp(noise, 450, 1800), 1.0),
             (bp(noise, 1800, 6000), 0.78), (hp(noise, 6000, 4), 0.5)]
    ir = sum(y * np.exp(-6.9078 * t / (rt60 * m)) for y, m in bands)
    ir *= 1.0 - np.exp(-t / 0.004)
    ir = np.concatenate([np.zeros(S(predelay)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))


ROOM_IR = (make_ir(0.45, 0.8, seed=11, predelay=0.006), make_ir(0.45, 0.8, seed=12, predelay=0.006))
HALL_IR = (make_ir(2.2, 3.0, seed=101, predelay=0.018), make_ir(2.2, 3.0, seed=202, predelay=0.018))
BIG_IR = (make_ir(3.4, 4.5, seed=303, predelay=0.012), make_ir(3.4, 4.5, seed=404, predelay=0.012))


def reverb(send: np.ndarray, irs, hp_hz: float = 250.0, lp_hz: float = 10000.0) -> np.ndarray:
    """Stereo convolution reverb (L/R IRs from different seeds), wet only."""
    n = send.shape[-1]
    left_in = 0.75 * send[0] + 0.25 * send[1]
    right_in = 0.25 * send[0] + 0.75 * send[1]
    wet = np.vstack([signal.fftconvolve(left_in, irs[0])[:n], signal.fftconvolve(right_in, irs[1])[:n]])
    return lp(hp(wet, hp_hz), lp_hz)


# ─────────────────────────────── I/O ───────────────────────────────
def decode(path: Path, channels: int) -> tuple[np.ndarray, int]:
    """ffmpeg -> float64 at the file's native rate. Returns (channels, samples), sample rate."""
    sr = int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                             "stream=sample_rate", "-of", "default=nw=1:nk=1", str(path)],
                            capture_output=True, text=True, check=True).stdout.strip())
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f64le", "-acodec", "pcm_f64le",
                          "-ac", str(channels), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f8").reshape(-1, channels).T.copy(), sr


def to_48k(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == SR:
        return x
    r = Fraction(SR, sr)
    return signal.resample_poly(x, r.numerator, r.denominator, axis=-1)


def write_wav24(path: Path, x: np.ndarray, seed: int = 24) -> None:
    """24-bit PCM with TPDF dither (deterministic). Samples that are exactly 0.0 on both channels (the gated
    silence windows) get no dither, so they stay digital silence."""
    r = rng(seed)
    full = 2 ** 23 - 1
    d = r.random(x.shape) - r.random(x.shape)
    d[:, np.all(x == 0.0, axis=0)] = 0.0
    q = np.clip(np.round(x * full + d), -full - 1, full).astype("<i4")
    raw = q.T.reshape(-1, 1).view(np.uint8)[:, :3].tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


# ─────────────────────────────── loudness (ITU-R BS.1770-4, 48 kHz) ───────────────────────────────
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def kweight(x: np.ndarray) -> np.ndarray:
    return signal.lfilter(*_K2, signal.lfilter(*_K1, np.atleast_2d(x), axis=-1), axis=-1)


def block_power(x: np.ndarray, block: float = 0.4, hop: float = 0.1, y: np.ndarray | None = None) -> np.ndarray:
    y = kweight(x) if y is None else y
    cs = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=-1)], axis=-1)
    blk = S(block)
    starts = np.arange(0, y.shape[-1] - blk + 1, S(hop))
    return ((cs[:, starts + blk] - cs[:, starts]) / blk).sum(axis=0)


def lufs(z) -> np.ndarray:
    return -0.691 + 10 * np.log10(np.maximum(z, 1e-20))


def lufs_integrated(x: np.ndarray) -> float:
    """BS.1770-4 integrated loudness (400 ms blocks, 75 % overlap, -70 LUFS / -10 LU gates)."""
    z = block_power(x)
    lk = lufs(z)
    g1 = lk > -70
    if not g1.any():
        return -np.inf
    rel = lufs(z[g1].mean()) - 10
    g2 = g1 & (lk > rel)
    return float(lufs(z[g2].mean()))


def true_peak_db(x: np.ndarray, os: int = 4) -> float:
    return float(20 * np.log10(np.max(np.abs(signal.resample_poly(x, os, 1, axis=-1)))))


# ═══════════════════════════════ voice-over ═══════════════════════════════
def vo_compressor(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Light feed-forward compressor: 5 ms RMS detector, 2:1 soft knee (6 dB) from -17 dBFS,
    6 ms attack, 110 ms release. Returns (y, gain reduction dB per control block)."""
    p = uniform_filter1d(ms_env(x), 5, mode="nearest")
    level = 10 * np.log10(np.maximum(p, 1e-12))
    gr = ballistics(soft_knee_gr(level, -17.0, 2.0, 6.0), attack=0.006, release=0.110)
    return x * db(ctrl_to_audio(gr)), gr



def vo_key(vo: np.ndarray, bridge: float = DUCK_BRIDGE) -> np.ndarray:
    """VO presence key at control rate (0/1): 10 ms RMS above -40 dBFS (25 dB under the VO reference),
    pauses shorter than `bridge` s filled, 60 ms hold, 30 ms look-ahead."""
    p = uniform_filter1d(ms_env(vo), 10, mode="nearest")
    on = (10 * np.log10(np.maximum(p, 1e-12)) > VO_REF_LUFS - 25.0).astype(float)
    edges = np.flatnonzero(np.diff(np.concatenate([[0.0], on, [0.0]])))
    starts, ends = edges[0::2], edges[1::2]                                        # active runs [s, e)
    for e, s_next in zip(ends[:-1], starts[1:]):
        if s_next - e < bridge * 1000:
            on[e:s_next] = 1.0
    h = int(round(DUCK_HOLD * 1000))
    on = maximum_filter1d(on, h + 1, origin=h // 2, mode="constant")               # window [i-h, i]
    la = int(round(DUCK_LOOKAHEAD * 1000))
    on = maximum_filter1d(on, la + 1, origin=-(la // 2), mode="constant")          # window [i, i+la]
    return on


def duck_curve(key: np.ndarray, depth_db) -> np.ndarray:
    """Sidechain gain (dB, control rate): key * depth, 40 ms attack / 350 ms release, 10 ms Hann rounding."""
    g = ballistics(key * depth_db, DUCK_ATTACK, DUCK_RELEASE)
    w = np.hanning(12)[1:-1]
    return np.convolve(g, w / w.sum(), mode="same")


# ═══════════════════════════════ SFX ═══════════════════════════════
GLASS_TINK = [(1.0, 1.0, 1.0), (2.756, 0.45, 0.42), (5.404, 0.2, 0.24), (8.933, 0.08, 0.14)]   # free-bar modes
CHIME = [(1.0, 1.0, 1.0), (2.0, 0.28, 0.62), (3.0, 0.08, 0.40), (4.16, 0.07, 0.26), (5.43, 0.04, 0.18)]


def bell(f: float, partials, dur: float, decay: float, seed: int = 0, detune_cents: float = 1.2,
         strike: float = 0.2) -> np.ndarray:
    """Tuned percussion: modal partials with per-mode decay; L/R detuned a hair for a slow stereo shimmer."""
    t = tvec(dur)
    r = rng(seed)
    out = np.zeros((2, t.size))
    for ch, sgn in enumerate((-1, 1)):
        fc = f * 2 ** (sgn * detune_cents / 1200)
        for ratio, amp, dk in partials:
            if fc * ratio < 16000:
                out[ch] += amp * np.sin(TWO_PI * fc * ratio * t + r.uniform(0, 0.3)) * np.exp(-t / (decay * dk))
    out += strike * lp(hp(r.standard_normal(t.size), 4000), 12000) * np.exp(-t / 0.002)
    out *= attack_env(t.size, 0.001)
    return norm_peak(fade_out(out, 0.08))


def whoosh(dur: float, peak: float, f0: float, fpk: float, f1: float, q: float = 1.1,
           pan=(0.0, 0.0), seed: int = 0, body: float = 0.35) -> np.ndarray:
    """Band-passed noise whose centre moves f0 -> fpk (at `peak` s) -> f1, swell envelope, moving pan,
    low air body for weight."""
    t = tvec(dur)
    r = rng(seed)
    fc = np.where(t < peak, f0 * (fpk / f0) ** (t / peak), fpk * (f1 / fpk) ** ((t - peak) / (dur - peak)))
    x = sweep_filter(r.standard_normal((2, t.size)), fc, q=q, kind="bp")
    if body:
        x += body * lp(r.standard_normal((2, t.size)), 260) * 2.5
    env = np.where(t < peak, (t / peak) ** 2.4, np.exp(-(t - peak) / ((dur - peak) / 3.2)))
    x = auto_pan(x * env, *pan)
    return norm_peak(fade_out(lp(hp(x, 110), 9000), 0.03))


def tap(f: float = 2200.0, body_hz: float = 380.0, weight: float = 1.0, seed: int = 0) -> np.ndarray:
    """Soft UI tap: a 1 ms filtered click, a tiny pitched body (sine, 9 ms) and a small low 'thock'."""
    t = tvec(0.09)
    r = rng(seed)
    click = lp(hp(r.standard_normal(t.size), 3000), 9000) * np.exp(-t / 0.0007)
    tone = np.sin(TWO_PI * f * t) * np.exp(-t / 0.009)
    fb = body_hz * (1 + 0.35 * np.exp(-t / 0.004))
    thock = np.sin(TWO_PI * np.cumsum(fb) / SR) * np.exp(-t / 0.016)
    x = 0.45 * norm_peak(click) + 0.35 * tone + 0.55 * weight * thock
    x *= attack_env(t.size, 0.0003)
    return norm_peak(fade_out(x, 0.02))


def swipe(dur: float = 0.30, peak: float = 0.045, pan=(0.55, -0.55), seed: int = 0) -> np.ndarray:
    """Airy swish: two decorrelated noise bands (2.5 -> 6 -> 3.5 kHz) with a fast swell, moving across."""
    t = tvec(dur)
    r = rng(seed)
    fc = np.where(t < peak, 2500 * (6000 / 2500) ** (t / peak), 6000 * (3500 / 6000) ** ((t - peak) / (dur - peak)))
    x = sweep_filter(r.standard_normal((2, t.size)), fc, q=0.9, kind="bp")
    x += 0.35 * sweep_filter(r.standard_normal((2, t.size)), fc * 0.35, q=1.2, kind="bp")
    env = np.where(t < peak, (t / peak) ** 1.6, np.exp(-(t - peak) / 0.06))
    x = auto_pan(x * env, *pan)
    return norm_peak(fade_out(hp(x, 400), 0.03))


def pop(note: str, dur: float = 0.18, glide: float = 0.42, decay: float = 0.034, body: float = 0.35,
        seed: int = 0) -> np.ndarray:
    """Bubbly UI pop: sine whose pitch springs up into the note (water-drop shape), a hint of 2nd
    harmonic, a soft 170 Hz thump and a tiny top click."""
    f = hz(note)
    t = tvec(dur)
    r = rng(seed)
    fi = f * (1 - glide * np.exp(-t / 0.011))
    ph = TWO_PI * np.cumsum(fi) / SR
    x = (np.sin(ph) + 0.16 * np.sin(2 * ph)) * np.exp(-t / decay)
    fb = 170 * (1 + 0.5 * np.exp(-t / 0.006))
    x += body * np.sin(TWO_PI * np.cumsum(fb) / SR) * np.exp(-t / 0.02)
    x += 0.1 * lp(hp(r.standard_normal(t.size), 4000), 10000) * np.exp(-t / 0.0006)
    x *= attack_env(t.size, 0.0012)
    return norm_peak(fade_out(x, 0.03))


def riser(dur: float = 0.40, f0: float = 500.0, f1: float = 8500.0, tone=("A4", "A5"), seed: int = 0) -> np.ndarray:
    """Noise riser: band-pass centre climbing f0 -> f1 on a steepening swell, faint tonal glide.
    Exactly `dur` long (3 ms fade) so it lands on the impact."""
    t = tvec(dur)
    u = t / dur
    x = sweep_filter(rng(seed).standard_normal((2, t.size)), f0 * (f1 / f0) ** u, q=1.8, kind="bp") * u ** 2.0
    g = hz(tone[0]) * (hz(tone[1]) / hz(tone[0])) ** (u ** 1.5)
    x = norm_peak(x) + 0.18 * np.sin(TWO_PI * np.cumsum(g) / SR) * u ** 2.5
    return norm_peak(fade_out(hp(x, 200), 0.003))


def impact(seed: int = 0, root: str = "D1", lite: bool = False, dur: float = 1.6) -> np.ndarray:
    """Drop impact (retuned): sub drop 85 Hz -> `root` (D1, the track's root), a noise burst whose low-pass
    closes 6 kHz -> 300 Hz, a short crack. `lite=True` + root D2: the COLD "impact-lite" (short body, no sub)."""
    sub = 0.0 if lite else 0.8
    t = tvec(dur)
    r = rng(seed)
    f0 = max(85.0, 1.6 * hz(root))
    f = hz(root) + (f0 - hz(root)) * np.exp(-t / 0.09)
    s = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / (0.42 if sub else 0.16))
    s = np.tanh(1.5 * s) / np.tanh(1.5)
    burst = sweep_filter(r.standard_normal((2, t.size)), 6000 * (300 / 6000) ** np.clip(t / 0.9, 0, 1), q=0.7, kind="lp")
    burst *= np.exp(-t / 0.22)
    crack = bp(r.standard_normal((2, t.size)), 1500, 7000) * np.exp(-t / 0.012)
    x = (sub or 0.6) * s + 0.55 * norm_peak(hp(burst, 90 if sub else 140)) + 0.22 * norm_peak(crack)
    return norm_peak(fade_out(x * attack_env(t.size, 0.0015), 0.25))


def vial_pop(note: str, seed: int = 0) -> np.ndarray:
    """Vial landing: glassy free-bar 'tink' plus a soft low thump (125 -> 65 Hz) and a felt tap."""
    tink = bell(hz(note), GLASS_TINK, dur=1.2, decay=0.42, seed=seed, strike=0.15)
    t = tvec(0.3)
    r = rng(seed + 1)
    fb = 65 + 60 * np.exp(-t / 0.018)
    thump = np.sin(TWO_PI * np.cumsum(fb) / SR) * np.exp(-t / 0.055)
    thump += 0.25 * norm_peak(lp(r.standard_normal(t.size), 700)) * np.exp(-t / 0.008)
    thump *= attack_env(t.size, 0.0015)
    out = 0.75 * tink
    out[:, :t.size] += 0.6 * to_stereo(norm_peak(thump))
    return norm_peak(out)


def tick(f: float = 3200.0, seed: int = 0, decay: float = 0.0035) -> np.ndarray:
    """UI tick: tiny sine burst plus a noise click."""
    t = tvec(0.03)
    x = np.sin(TWO_PI * f * t) * np.exp(-t / decay)
    x += 0.35 * lp(hp(rng(seed).standard_normal(t.size), 5000), 12000) * np.exp(-t / 0.0012)
    return norm_peak(x * attack_env(t.size, 0.0003))


def stat_hit(note: str = "A5", seed: int = 0, root: str = "D2", light: bool = False) -> np.ndarray:
    """Proof stat landing (retuned): punchy thump 150 Hz -> `root` (D2), a filtered click and a short tonal
    accent on `note`. `light` = shorter, softer body (module landings)."""
    t = tvec(0.30 if light else 0.45)
    r = rng(seed)
    f = hz(root) + (150 - hz(root)) * np.exp(-t / 0.022)
    body = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / (0.05 if light else 0.085))
    body = np.tanh(1.8 * body) / np.tanh(1.8)
    click = lp(bp(r.standard_normal(t.size), 1800, 6000), 9000) * np.exp(-t / 0.0018)
    fa = hz(note)
    accent = (np.sin(TWO_PI * fa * t) + 0.2 * np.sin(TWO_PI * 2 * fa * t)) * np.exp(-t / 0.06) * attack_env(t.size, 0.002)
    x = (0.6 if light else 1.0) * body + 0.35 * norm_peak(click) + 0.22 * accent
    return norm_peak(fade_out(x * attack_env(t.size, 0.001), 0.08))


def shimmer(seed: int = 0, notes=("D6", "A6", "D7", "E7"), dur: float = 2.2, grains: int = 14, air: float = 0.08) -> np.ndarray:
    """Light / glass shimmer (retuned): quick rising arpeggio of glass bells D6 A6 D7 E7, key-tuned high grains
    (D/E/A 7-8) travelling left -> right, and a soft air swell. `dur` < 1 gives the short bloom variant."""
    r = rng(seed)
    total = S(dur)
    out = np.zeros((2, total))
    for k, note in enumerate(notes):
        b = bell(hz(note), GLASS_TINK, dur=min(1.8, dur), decay=(0.9 - 0.12 * k) * min(1.0, dur / 2.2), seed=seed + k,
                 detune_cents=3.0, strike=0.12) * (0.9 ** k)
        b = to_stereo(b, -0.3 + 0.2 * k)
        i = S(0.04 * k)
        out[:, i:i + b.shape[1]] += b[:, :total - i]
    span = 0.9 * min(1.0, dur / 2.2)
    for g in range(grains):
        tg = span * (g + r.uniform(0.0, 0.8)) / grains
        tt = tvec(0.25)
        s = np.sin(TWO_PI * hz(str(r.choice(["D7", "E7", "A7", "D8"]))) * tt) * np.exp(-tt / r.uniform(0.04, 0.09))
        s *= attack_env(tt.size, 0.002) * np.sin(np.pi * min(tg / span, 1.0)) ** 1.2 * r.uniform(0.25, 0.5)
        i = S(0.05 + tg)
        if i < total:
            out[:, i:i + tt.size] += to_stereo(s, -0.5 + tg / span + r.uniform(-0.1, 0.1))[:, :total - i]
    t = tvec(min(1.0, dur))
    a = hp(r.standard_normal(t.size), 6500) * np.sin(np.pi * t / t[-1]) ** 2
    out[:, :t.size] += air * auto_pan(norm_peak(a), -0.5, 0.5)
    return norm_peak(fade_out(out, min(0.2, dur / 4)))


def soft_chime(notes=("D6", "A6"), step: float = 0.03, seed: int = 0, dur: float = 2.4) -> np.ndarray:
    """Soft two-note chime (tuned bell partials, gentle strike): the free-shipping unlock, D6 + A6."""
    out = np.zeros((2, S(dur + 0.2)))
    for k, note in enumerate(notes):
        c = bell(hz(note), CHIME, dur=dur, decay=1.0, seed=seed + k, strike=0.06) * (0.7 ** k)
        i = S(k * step)
        out[:, i:i + c.shape[1]] += c[:, :out.shape[1] - i]
    return norm_peak(fade_out(out, 0.2))


# ─────────────────────────────── retuned + new SFX (BRIEF §8) ───────────────────────────────
def glass_tick(note: str = "D7", seed: int = 0, decay: float = 0.12) -> np.ndarray:
    return bell(hz(note), GLASS_TINK, dur=0.5, decay=decay, seed=seed, strike=0.3)


def sonic_logo(seed: int = 90, gap: float = 0.09) -> np.ndarray:
    """Retuned sonic logo (~1.4 s): seal click -> A5 tink, D6 tink +`gap` s (the rising fourth; 90 ms default) -> 73.4 Hz (D2) swell."""
    t = tvec(1.45)
    r = rng(seed)
    click = lp(hp(r.standard_normal(t.size), 2500), 9000) * np.exp(-t / 0.0015)
    tink = bell(hz("A5"), GLASS_TINK, dur=1.45, decay=0.55, seed=seed, strike=0.15)[0]
    tink2 = bell(hz("D6"), GLASS_TINK, dur=1.45, decay=0.5, seed=seed + 1, strike=0.1)[0]
    swell = np.sin(TWO_PI * hz("D2") * t) * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.05))
    x = 0.5 * norm_peak(click) + 0.65 * tink + 0.5 * np.pad(tink2, (S(gap), 0))[:t.size] + 0.35 * swell
    return norm_peak(fade_out(x, 0.25))


def tail(dur: float = 2.95, seed: int = 7) -> np.ndarray:
    """Ring-out after the final hit: D5 / A5 glass partials, decaying, faded to zero at `dur` (gone by 44.0)."""
    x = (bell(hz("D5"), GLASS_TINK, dur=dur, decay=1.1, seed=seed, strike=0.05)
         + 0.6 * bell(hz("A5"), GLASS_TINK, dur=dur, decay=0.9, seed=seed + 1, strike=0.05))
    return norm_peak(fade_out(x, 0.6))


def stamp(seed: int = 0, heavy: bool = False) -> np.ndarray:
    """Cheap rubber stamp: 25 ms band-passed paper slap (1.2-4 kHz) + a 140 Hz body. `heavy`: longer slap,
    more body (the clean "pure")."""
    r = rng(seed)
    t = tvec(0.16 if heavy else 0.10)
    slap = bp(r.standard_normal(t.size), 1200, 4000) * np.exp(-t / (0.008 if heavy else 0.006))
    slap *= np.clip(((0.035 if heavy else 0.025) - t) / 0.004, 0.0, 1.0)      # 25 ms slap (35 ms heavy)
    fb = 140 * (1 + 0.3 * np.exp(-t / 0.005))
    body = np.sin(TWO_PI * np.cumsum(fb) / SR) * np.exp(-t / (0.035 if heavy else 0.02))
    paper = hp(r.standard_normal(t.size), 5000) * np.exp(-t / 0.003)
    x = norm_peak(slap) + (0.8 if heavy else 0.5) * body + 0.15 * norm_peak(paper)
    return norm_peak(fade_out(x * attack_env(t.size, 0.0004), 0.02))


def grains(times, pans=None, amps=None, notes=("D7", "A6", "E7", "A7", "D8"), seed: int = 0) -> np.ndarray:
    """Glyph stream: one short sine grain (20-60 ms, 2-5 kHz on D/A/E) per time (s, relative), seeded, panned."""
    r = rng(seed)
    times = np.asarray(times, float)
    out = np.zeros((2, S(float(times.max()) + 0.08) + 1))
    for k, tg in enumerate(times):
        d = r.uniform(0.02, 0.06)
        tt = tvec(d)
        f = hz(str(r.choice(notes)))
        s = np.sin(TWO_PI * f * tt + r.uniform(0, 6.28)) * np.sin(np.pi * tt / d) ** 2
        a = 1.0 if amps is None else amps[k]
        p = r.uniform(-0.4, 0.4) if pans is None else pans[k]
        i = S(tg)
        out[:, i:i + tt.size] += to_stereo(s * a, p)
    return norm_peak(out)


def frost(dur: float = 0.4, seed: int = 0) -> np.ndarray:
    """Frost crackle: seeded 3-8 kHz noise grains, high-passed 6 kHz, thinning out over `dur`."""
    r = rng(seed)
    out = np.zeros((2, S(dur)))
    n = 70
    for k in range(n):
        tg = dur * (k / n) ** 1.6 * 0.9
        g = tvec(r.uniform(0.002, 0.008))
        f = r.uniform(3000, 8000)
        s = np.sin(TWO_PI * f * g) * np.exp(-g / 0.0015) + 0.6 * r.standard_normal(g.size) * np.exp(-g / 0.001)
        i = S(tg)
        out[:, i:i + g.size] += to_stereo(s * (1 - tg / dur) * r.uniform(0.4, 1.0), r.uniform(-0.6, 0.6))[:, :out.shape[1] - i]
    return norm_peak(fade_out(hp(out, 6000, 4), 0.05))


def zip_up(dur: float = 0.27, f0: float = 300.0, f1: float = 2400.0, seed: int = 0) -> np.ndarray:
    """Rising sine 'zip' f0 -> f1 (exponential) through a band-pass that follows it, plus a little filtered
    noise; swells and ends sharply at `dur` (lands on the plate cut)."""
    t = tvec(dur)
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 1.3)
    tone = np.sin(TWO_PI * np.cumsum(f) / SR)
    nz = sweep_filter(rng(seed).standard_normal((2, t.size)), f * 1.2, q=3.0, kind="bp")
    x = 0.6 * to_stereo(tone) + 0.5 * norm_peak(nz)
    x *= (0.15 + 0.85 * u ** 1.5)
    x[:, -S(0.004):] *= np.linspace(1, 0, S(0.004))
    return norm_peak(x * attack_env(t.size, 0.01))


def reverse_swell(dur: float = 0.40, note: str = "D6", seed: int = 0) -> np.ndarray:
    """Reversed hall bell: a D6 glass bell through the hall IR, reversed, so it swells and ends exactly at `dur`."""
    b = bell(hz(note), GLASS_TINK, dur=1.2, decay=0.5, seed=seed, strike=0.1)
    w = reverb(np.pad(b, ((0, 0), (0, S(1.8)))), HALL_IR, hp_hz=300)
    x = (0.4 * np.pad(b, ((0, 0), (0, S(1.8)))) + w)[:, ::-1]
    x = x[:, -S(dur):].copy()
    x *= attack_env(x.shape[1], 0.05)
    x[:, -S(0.003):] *= np.linspace(1, 0, S(0.003))
    return norm_peak(x)


def bloom(dur: float = 0.33, seed: int = 0) -> np.ndarray:
    """Airy white-out bloom: pink-ish noise through a band-pass sweeping up 600 Hz -> 9 kHz, swelling."""
    t = tvec(dur)
    r = rng(seed)
    w = r.standard_normal((2, t.size))
    pink = lp(w, 1500, 1) + 0.5 * w                      # cheap tilt
    u = t / dur
    x = sweep_filter(pink, 600 * (9000 / 600) ** u, q=0.8, kind="bp")
    env = np.sin(np.pi * np.clip(u * 0.85, 0, 1)) ** 1.5 * (0.3 + 0.7 * u)
    return norm_peak(fade_out(x * env, 0.06))


def alu_tick(seed: int = 0) -> np.ndarray:
    """Aluminium tick: inharmonic 3.1 + 6.4 kHz partials, 50 ms."""
    t = tvec(0.05)
    r = rng(seed)
    x = np.sin(TWO_PI * 3100 * t) * np.exp(-t / 0.012) + 0.6 * np.sin(TWO_PI * 6400 * t + 1.0) * np.exp(-t / 0.007)
    x += 0.25 * hp(r.standard_normal(t.size), 7000) * np.exp(-t / 0.0015)
    return norm_peak(fade_out(x * attack_env(t.size, 0.0003), 0.01))


def tsk(seed: int = 0) -> np.ndarray:
    """Short aluminium 'tsk': 6 kHz high-passed noise, 40 ms."""
    t = tvec(0.04)
    x = hp(rng(seed).standard_normal(t.size), 6000, 4) * np.exp(-t / 0.009)
    return norm_peak(fade_out(x * attack_env(t.size, 0.001), 0.008))


def haptic(f: float = 165.0, dur: float = 0.03) -> np.ndarray:
    """Taptic buzz: 165 Hz sine, 30 ms, tanh-saturated, square-ish envelope."""
    t = tvec(dur)
    x = np.tanh(3.0 * np.sin(TWO_PI * f * t)) * attack_env(t.size, 0.002)
    return norm_peak(fade_out(x, 0.008))


def thoomp(note: str = "D2", dur: float = 0.04, seed: int = 0) -> np.ndarray:
    """Low thump on `note` (default D2, 40 ms body) with a 2x pitch drop into it."""
    t = tvec(max(dur * 4, 0.12))
    f = hz(note) * (1 + 1.0 * np.exp(-t / 0.008))
    x = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / dur)
    x += 0.15 * lp(rng(seed).standard_normal(t.size), 600) * np.exp(-t / 0.006)
    return norm_peak(fade_out(np.tanh(1.4 * x) * attack_env(t.size, 0.001), 0.02))


def add_to_cart(seed: int = 0) -> np.ndarray:
    """Add to cart: tap + pop A6, pop D7 at +60 ms (rising fourth, a cousin of the logo) + haptic."""
    out = np.zeros((2, S(0.40)))
    for x, at, g in ((to_stereo(tap(2350, 380, seed=seed)), 0.0, 0.8), (to_stereo(haptic()), 0.0, 0.35),
                     (to_stereo(pop("A6", seed=seed + 1), -0.05), 0.012, 0.7),
                     (to_stereo(pop("D7", seed=seed + 2), 0.05), 0.072, 0.7)):
        i = S(at)
        out[:, i:i + x.shape[1]] += g * x[:, :out.shape[1] - i]
    return norm_peak(fade_out(out, 0.05))


def stamp_soft(seed: int = 0) -> np.ndarray:
    """Soft ✓ stamp: 10 ms click at 3 kHz + a glass tick A6."""
    t = tvec(0.01)
    c = np.sin(TWO_PI * 3000 * t) * np.exp(-t / 0.002)
    c += 0.3 * bp(rng(seed).standard_normal(t.size), 2000, 6000) * np.exp(-t / 0.001)
    x = 0.6 * glass_tick("A6", seed=seed, decay=0.08)
    x[:, :t.size] += to_stereo(norm_peak(c))
    return norm_peak(x)


def sub_swell(dur: float = 0.55, peak: float = 0.40, seed: int = 0) -> np.ndarray:
    """Sub pre-lap: lp(noise, 90) + D1 sine, swelling to `peak` (lands on the music swell), then a short release."""
    t = tvec(dur)
    x = 0.5 * norm_peak(lp(rng(seed).standard_normal(t.size), 90, 4)) + np.sin(TWO_PI * hz("D1") * t)
    env = np.where(t < peak, (t / peak) ** 2, np.exp(-(t - peak) / 0.05))
    return norm_peak(fade_out(x * env, 0.03))


def sub_bed(dur: float = 3.5, seed: int = 0) -> np.ndarray:
    """Breath bed: D1 sine + lp(noise, 90), slow fade in and out."""
    t = tvec(dur)
    x = np.sin(TWO_PI * hz("D1") * t) + 0.35 * norm_peak(lp(rng(seed).standard_normal(t.size), 90, 4))
    env = np.sin(np.pi * t / dur) ** 0.8
    return norm_peak(x * env)


def band_rise(dur: float = 0.45, f0: float = 1000.0, f1: float = 4000.0, seed: int = 0) -> np.ndarray:
    """Bar fill: a narrow noise band rising f0 -> f1 (power3.out like the fill), soft ends."""
    t = tvec(dur)
    u = 1 - (1 - t / dur) ** 3
    x = sweep_filter(rng(seed).standard_normal((2, t.size)), f0 * (f1 / f0) ** u, q=5.0, kind="bp")
    env = np.minimum(t / 0.03, 1.0) * np.clip((dur - t) / 0.12, 0, 1)
    return norm_peak(x * env)


def tick_train(times, f: float = 4500.0, seed: int = 0, pans=None) -> np.ndarray:
    """A train of tick(f) at relative times (s), each slightly varied."""
    times = np.asarray(times, float)
    out = np.zeros((2, S(float(times.max()) + 0.04) + 1))
    for k, tk in enumerate(times):
        s = to_stereo(tick(f * (1 + 0.01 * ((k % 3) - 1)), seed=seed + k), 0.0 if pans is None else pans[k])
        i = S(tk)
        out[:, i:i + s.shape[1]] += s[:, :out.shape[1] - i]
    return norm_peak(out)


def light_sweep(dur: float = 0.54, seed: int = 0) -> np.ndarray:
    """Noise light sweep: airy band (2.5 -> 9 -> 4 kHz) swelling to its centre, moving L -> R."""
    t = tvec(dur)
    pk = dur / 2
    fc = np.where(t < pk, 2500 * (9000 / 2500) ** (t / pk), 9000 * (4000 / 9000) ** ((t - pk) / (dur - pk)))
    x = sweep_filter(rng(seed).standard_normal((2, t.size)), fc, q=1.4, kind="bp")
    env = np.sin(np.pi * t / dur) ** 2
    return norm_peak(fade_out(auto_pan(x * env, -0.6, 0.6), 0.02))


# ═══════════════════════════════ master ═══════════════════════════════
def glue(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Bus glue: stereo-linked RMS (20 ms) compressor, 1.5:1, 8 dB soft knee from 2 dB above the mix's
    loudness, 25 ms attack, 250 ms release."""
    p = uniform_filter1d(ms_env(x), 20, mode="nearest")
    level = 10 * np.log10(np.maximum(p, 1e-12))
    thresh = lufs_integrated(x) + 2.0
    gr = ballistics(soft_knee_gr(level, thresh, 1.5, 8.0), attack=0.025, release=0.250)
    return x * db(ctrl_to_audio(gr)), gr


def true_peak_limiter(x: np.ndarray, ceiling_db: float, lookahead: float = 0.002,
                      release_db_s: float = 25.0, os: int = 4):
    """Look-ahead limiter keyed from the 4x oversampled signal (true-peak detection), stereo-linked.
    Gain reduction (dB) is spread by a centred max filter of +/- lookahead, released linearly at
    `release_db_s`, then smoothed by two box filters that stay inside +/- lookahead, so the applied
    reduction is never less than what any nearby peak needs."""
    n = x.shape[-1]
    up = np.abs(signal.resample_poly(x, os, 1, axis=-1)).max(axis=0)[:n * os].reshape(n, os).max(axis=1)
    pk = np.maximum(np.maximum(up, np.concatenate([[0.0], up[:-1]])), np.abs(x).max(axis=0))
    need = np.maximum(0.0, 20 * np.log10(np.maximum(pk, 1e-12)) - ceiling_db)
    L = S(lookahead) // 2 * 2
    gr = maximum_filter1d(need, 2 * L + 1, mode="nearest")
    ramp = np.arange(n) * (release_db_s / SR)
    gr = np.maximum.accumulate(gr + ramp) - ramp
    gr = uniform_filter1d(uniform_filter1d(gr, L + 1, mode="nearest"), L + 1, mode="nearest")
    return x * 10 ** (-gr / 20), gr


def master(x: np.ndarray):
    """HPF 24 Hz -> 5 ms start / 0.25 s end taper -> glue -> gain + true-peak limiter iterated to -14.0 LUFS."""
    x = fade_out(hp(x, 24.0), 0.25) * attack_env(N, 0.005)
    x, glue_gr = glue(x)
    gain = TARGET_LUFS - lufs_integrated(x)
    for _ in range(16):
        y, lim_gr = true_peak_limiter(x * db(gain), LIMITER_CEILING_DB)
        err = TARGET_LUFS - lufs_integrated(y)
        if abs(err) < 0.005:
            break
        gain += err
    return y, gain, glue_gr, lim_gr

# ═══════════════════════════════ "A LINE OF LIGHT" (pro-en BRIEF §7 NEW) ═══════════════════════════════
ALU_MODES = [(1.0, 1.0, 1.0), (2.32, 0.55, 0.55), (3.91, 0.3, 0.35), (5.12, 0.18, 0.25), (6.9, 0.1, 0.18)]   # anodised shell


def alu_ring(note: str = "D5", dur: float = 0.6, seed: int = 0) -> np.ndarray:
    """Aluminium body ring on the DROP: inharmonic shell modes on `note`, 0.6 s, fast-decaying strike noise."""
    return bell(hz(note), ALU_MODES, dur=dur, decay=0.16, seed=seed, detune_cents=2.0, strike=0.35)


def glass_settle(n: int = 4, seed: int = 0, notes=("D7", "A6", "E7", "D8")) -> np.ndarray:
    """Ice settling: n tiny glass tinks at shrinking intervals (90 -> 35 ms) and levels (-0 -> -9 dB), panned."""
    r = rng(seed)
    out = np.zeros((2, S(0.09 * n + 0.5)))
    t = 0.0
    for k in range(n):
        b = bell(hz(notes[k % len(notes)]), GLASS_TINK, dur=0.4, decay=0.07 + 0.02 * r.random(), seed=seed + k, strike=0.25)
        i = S(t)
        out[:, i:i + b.shape[1]] += to_stereo(b[0], r.uniform(-0.5, 0.5)) * db(-9.0 * k / max(1, n - 1))
        t += 0.09 - 0.055 * k / max(1, n - 1) + r.uniform(-0.008, 0.008)
    return norm_peak(fade_out(out, 0.1))


def pulse_riser(dur: float = 3.6, note: str = "D3", seed: int = 0) -> np.ndarray:
    """The tightening pulse into the DROP: a D3 tone chopped by a pulse whose rate accelerates 2.5 -> 16 Hz, a
    low-pass opening 400 Hz -> 6 kHz and a swelling level; exactly `dur` long (last sample on the hit frame)."""
    t = tvec(dur)
    u = t / dur
    rate = 2.5 * (16.0 / 2.5) ** (u ** 1.4)
    gate = np.clip(np.sin(TWO_PI * np.cumsum(rate) / SR) * 4.0, 0.0, 1.0)
    f = hz(note) * (1 + 0.004 * np.sin(TWO_PI * 5.0 * t))
    tone = np.sin(TWO_PI * np.cumsum(f) / SR) + 0.3 * np.sin(TWO_PI * 2 * np.cumsum(f) / SR)
    x = sweep_filter(np.vstack([tone, tone * 0.9]) * gate, 400 * (6000 / 400) ** u, q=1.2, kind="lp")
    x += 0.12 * bp(rng(seed).standard_normal((2, t.size)), 1500, 5000) * gate * u ** 2
    x *= (0.12 + 0.88 * u ** 2.2)
    return norm_peak(fade_out(x, 0.003))


def doppler_whoosh(dur: float = 1.0, pan=(-0.6, 0.6), seed: int = 0, peak_at: float = 0.55) -> np.ndarray:
    """Pass-by whoosh: band-passed noise whose centre climbs 350 Hz -> 3.4 kHz into the pass (`peak_at` x dur) and
    drops faster after it (the Doppler fall), a faint tone riding the same bend, low air body, moving pan. The
    loudest 5 ms sits on the pass: place it with align="peak"."""
    t = tvec(dur)
    r = rng(seed)
    pk = peak_at * dur
    fc = np.where(t < pk, 350 * (3400 / 350) ** (t / pk), 3400 * (700 / 3400) ** np.clip((t - pk) / (0.55 * (dur - pk)), 0, 1))
    x = sweep_filter(r.standard_normal((2, t.size)), fc, q=1.1, kind="bp")
    x += 0.10 * np.sin(TWO_PI * np.cumsum(fc * 0.5) / SR) * np.exp(-((t - pk) / (0.25 * dur)) ** 2)
    x += 0.3 * lp(r.standard_normal((2, t.size)), 220) * 2.5
    env = np.where(t < pk, (t / pk) ** 2.2, np.exp(-(t - pk) / ((dur - pk) / 3.0)))
    x = auto_pan(x * env, *pan)
    return norm_peak(fade_out(lp(hp(x, 90), 10000), 0.03))


def screen_wake(seed: int = 0) -> np.ndarray:
    """The display wakes: pop D6 (0.16 s) + haptic 165 Hz 40 ms + a short light sweep (0.3 s) under them."""
    out = np.zeros((2, S(0.36)))
    for x, at, g in ((to_stereo(pop("D6", dur=0.16, seed=seed)), 0.0, 0.9), (to_stereo(haptic(165.0, 0.04)), 0.0, 0.4),
                     (light_sweep(0.3, seed=seed + 1), 0.0, 0.55)):
        i = S(at)
        out[:, i:i + x.shape[1]] += g * x[:, :out.shape[1] - i]
    return norm_peak(fade_out(out, 0.03))


def button_click(seed: int = 0) -> np.ndarray:
    """Side-button click (unused unless a button is shown): 2 ms mechanical click, 1.4 kHz body, 25 ms."""
    t = tvec(0.025)
    r = rng(seed)
    x = lp(hp(r.standard_normal(t.size), 1500), 8000) * np.exp(-t / 0.0012)
    x += 0.5 * np.sin(TWO_PI * 1400 * t) * np.exp(-t / 0.004)
    return norm_peak(fade_out(x * attack_env(t.size, 0.0002), 0.005))


def de_esser(x: np.ndarray, lo: float = 6000.0, hi: float = 8000.0, depth_db: float = -3.0) -> np.ndarray:
    """Dynamic -3 dB on 6-8 kHz: the band's 5 ms level within 10 dB of its loudest (the esses) is cut by `depth_db`,
    2 ms attack / 40 ms release; the band is subtracted (not EQ'd) so the rest of the voice is untouched."""
    band = bp(x, lo, hi, 4)
    p = uniform_filter1d(ms_env(band), 5, mode="nearest")
    lvl = 10 * np.log10(np.maximum(p, 1e-14))
    gr = ballistics(np.clip((lvl - (lvl.max() - 10.0)) / 10.0, 0, 1) * depth_db, 0.002, 0.040)
    return x - band * (1.0 - db(ctrl_to_audio(gr)))
