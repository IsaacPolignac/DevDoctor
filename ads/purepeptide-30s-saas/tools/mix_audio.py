#!/usr/bin/env python3
"""PurePeptide 30 s SaaS ad: final soundtrack (voice-over + music + synthesized SFX).

Run from the project root:

    python3 tools/mix_audio.py            # writes assets/audio/mix.wav
    python3 tools/mix_audio.py --report   # same, plus the verification tables (cues, VO/music ratio, stems)

Output: 48 kHz, stereo, 24-bit PCM, exactly 30.000 s (1,440,000 frames), -14 LUFS integrated,
true peak <= -1.5 dBTP (4x oversampled detection). Everything runs in float64 with fixed seeds, so a
re-run is bit-identical.

Signal flow
    VO     vo_hugo.mp3 (ElevenLabs take, Hugo) -> ffmpeg f64 -> 48 kHz (polyphase 160/147)
           -> per-line clip gain (lines levelled to the same loudness) -> HPF 90 Hz (12 dB/oct)
           -> presence peak +1.5 dB @ 4 kHz (Q 0.7, covers 3-5 kHz) -> light compressor (2:1, soft knee)
           -> each line cut at PP.VO[i].src (10 ms raised-cosine fades), placed at PP.VO[i].at, centred.
    Music  music_raw.mp3 -> trim/pad to 30.000 s -> fader -> dynamic "voice pocket" (-2.5 dB @ 2.8 kHz
           only while the VO speaks) -> sidechain duck (-8 dB, -11 dB for the 24-26.5 tagline; 40 ms
           attack, 350 ms release (10-90 % times), 30 ms look-ahead, keyed from the VO itself, pauses
           < 0.6 s bridged so commas don't pump; the tagline dip is also drawn as automation that is
           fully down at 24.00) -> 0.25 s end fade.
    SFX    synthesized here (no samples), one cue per row of SCENES.md's SOUND-EVENT TABLE, placed at
           round(t * 48000); room / hall / big convolution reverbs (seeded noise IRs); the SFX bus is
           ducked -4 dB by the same VO key wherever it overlaps speech.
    Master sum -> HPF 24 Hz -> glue compressor (1.5:1, slow) -> gain + look-ahead true-peak limiter
           (-1.5 dBTP ceiling, 4x oversampled detection) iterated to -14.0 LUFS; 5 ms start and
           0.25 s end tapers; 24-bit with TPDF dither.

Harmony note: the ElevenLabs track is in A440 and moves F(maj7) - G - Am (pitch classes C E F G A,
no B/Bb), so every pitched SFX uses C D E G A, the notes it shares with D minor / F major.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import wave
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Callable

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

# ═══════════════════════════════ constants ═══════════════════════════════
SR = 48_000
N = 1_440_000                                  # exactly 30.000 s
DURATION = N / SR
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
LIMITER_CEILING_DB = -1.62                     # internal ceiling: 0.12 dB margin for dither / other TP meters
ROOT = Path(__file__).resolve().parents[1]
VO_PATH = ROOT / "assets" / "audio" / "vo_hugo.mp3"
MUSIC_PATH = ROOT / "assets" / "audio" / "music_raw.mp3"
VO_JS = ROOT / "js" / "vo.js"
OUT_PATH = ROOT / "assets" / "audio" / "mix.wav"
TWO_PI = 2 * np.pi
CTRL = 48                                      # control-rate block for envelopes: 1 ms
NC = N // CTRL

# mix decisions (dB)
VO_REF_LUFS = -15.0            # processed VO track level before the master stage
LINE_TARGET_LUFS = -14.2       # per-line clip-gain target (median of the take's lines)
LINE_GAIN_LIMIT = (-1.5, 2.5)  # clip gain range
MUSIC_FADER_DB = -6.0
INTRO_LIFT_DB, INTRO_LIFT_END = 6.0, (13.5, 15.5)   # calm filtered intro sits too far under the VO: lift it, back to 0 dB before the drop
DUCK_DB = -8.0                 # music under the VO
DUCK_TAG_DB = -11.0            # music under the end tagline
TAG_WINDOW = (23.90, 26.60)
TAG_AUTO = (23.85, 24.00, 26.50, 26.85)  # tagline automation: ramp in, hold, ramp out
SFX_DUCK_DB = -4.0
DUCK_ATTACK, DUCK_RELEASE, DUCK_LOOKAHEAD, DUCK_HOLD = 0.040, 0.350, 0.030, 0.060
DUCK_BRIDGE = 0.60             # pauses shorter than this inside the VO keep the key on (no pumping on commas)
POCKET_DB, POCKET_HZ, POCKET_Q = -2.5, 2800.0, 0.9


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


def load_vo_table() -> list[dict]:
    """PP.VO from js/vo.js (the array literal is plain JSON)."""
    txt = VO_JS.read_text(encoding="utf-8")
    m = re.search(r"PP\.VO\s*=\s*(\[.*\])\s*;", txt, re.S)
    lines = json.loads(m.group(1))
    for ln in lines:
        assert len(ln["src"]) == 2 and ln["src"][1] > ln["src"][0]
    return lines


def write_wav24(path: Path, x: np.ndarray, seed: int = 24) -> None:
    """24-bit PCM with TPDF dither (deterministic)."""
    r = rng(seed)
    full = 2 ** 23 - 1
    d = r.random(x.shape) - r.random(x.shape)
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


def build_vo(report: dict) -> tuple[np.ndarray, list[dict]]:
    """Returns the processed VO timeline (mono, N samples) and the line table with sample positions."""
    take, sr = decode(VO_PATH, 1)
    take = to_48k(take[0], sr)
    lines = load_vo_table()
    track = np.zeros(N)
    fade = S(0.010)
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(fade) / fade)
    last_end = -1
    for ln in lines:
        a, b = S(ln["src"][0]), S(ln["src"][1])
        seg = take[a:min(b, take.size)].copy()
        # clip gain: level each line to LINE_TARGET_LUFS (limited range)
        seg_l = lufs_integrated(np.vstack([seg, seg])) - 10 * np.log10(2)      # mono loudness
        g = float(np.clip(LINE_TARGET_LUFS - seg_l, *LINE_GAIN_LIMIT))
        seg *= db(g)
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        i0 = S(ln["at"])
        assert i0 >= last_end, f"{ln['id']} overlaps the previous line"
        assert i0 + seg.size <= N
        track[i0:i0 + seg.size] += seg
        last_end = i0 + seg.size
        ln.update(i0=i0, i1=i0 + seg.size, src_i=(a, b), clip_gain=g, take_lufs=seg_l)
        assert abs((i0 + seg.size) / SR - ln["end"]) < 0.002, f"{ln['id']}: end {ln['end']} != at + src span"
    # voice chain on the assembled track (silence between lines)
    track = hp(track, 90.0, order=2)
    track = peaking(track, 4000.0, 1.5, 0.7)
    track, gr = vo_compressor(track)
    lvl = lufs_integrated(np.vstack([track, track]))
    track *= db(VO_REF_LUFS - lvl)
    speaking = ms_env(track) > 10 ** (-45 / 10)
    report["vo_gr"] = gr
    report["vo_gr_speech"] = gr[speaking]
    return track, lines


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


# ═══════════════════════════════ music ═══════════════════════════════
def build_music(key: np.ndarray, report: dict) -> np.ndarray:
    m, sr = decode(MUSIC_PATH, 2)
    m = to_48k(m, sr)
    report["music_raw_frames"] = m.shape[1]
    if m.shape[1] >= N:
        m = m[:, :N]
    else:
        m = np.concatenate([m, np.zeros((2, N - m.shape[1]))], axis=1)
    m = m * db(MUSIC_FADER_DB)
    t_c = (np.arange(NC) + 0.5) / 1000.0
    lift = np.interp(t_c, [0.0, INTRO_LIFT_END[0], INTRO_LIFT_END[1], DURATION], [INTRO_LIFT_DB, INTRO_LIFT_DB, 0.0, 0.0])
    m = m * db(ctrl_to_audio(lift))
    depth = np.where((t_c >= TAG_WINDOW[0]) & (t_c < TAG_WINDOW[1]), DUCK_TAG_DB, DUCK_DB)
    duck = duck_curve(key, depth)
    # end tagline: the stronger dip is also drawn as automation that is fully down when L7 starts
    # (23.85 -> 24.00 in, out over 26.50 -> 26.85), so the bed never sits on its first syllable
    tag = np.interp(t_c, [0.0, TAG_AUTO[0], TAG_AUTO[1], TAG_AUTO[2], TAG_AUTO[3], DURATION],
                    [0.0, 0.0, 1.0, 1.0, 0.0, 0.0])
    duck = np.minimum(duck, DUCK_TAG_DB * (0.5 - 0.5 * np.cos(np.pi * tag)))
    amt = ctrl_to_audio(np.clip(duck / DUCK_DB, 0.0, 1.0))                  # 0..1 (>= 1 under the tagline)
    pocket = peaking(m, POCKET_HZ, POCKET_DB, POCKET_Q)
    m = m + np.minimum(amt, 1.0) * (pocket - m)
    m = m * db(ctrl_to_audio(duck))
    m = fade_out(m, 0.25)
    report["music_duck"] = duck
    return m


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


def scan(dur: float = 0.50, note: str = "A6", seed: int = 0) -> np.ndarray:
    """QR scan: a soft low-passed beep at the start plus a narrow noise band whose centre follows the scan
    line down the code (sine.inOut, 4.8 -> 1.7 kHz), with a faint 30 Hz raster flutter.
    Exactly `dur` long (15.10 -> 15.60)."""
    t = tvec(dur)
    r = rng(seed)
    f = hz(note)
    bt = t[:S(0.11)]
    beep = (np.sin(TWO_PI * f * bt) + 0.12 * np.sin(TWO_PI * 2 * f * bt)) * attack_env(bt.size, 0.004)
    beep *= np.where(bt < 0.07, 1.0, np.exp(-(bt - 0.07) / 0.012))
    beep = lp(beep, 3500, 2)
    u = 0.5 - 0.5 * np.cos(np.pi * t / dur)
    fc = 4800 * (1700 / 4800) ** u
    band = sweep_filter(r.standard_normal((2, t.size)), fc, q=4.0, kind="bp")
    band *= (1 - 0.25 * (0.5 + 0.5 * np.cos(TWO_PI * 30 * t)))
    band *= np.minimum(t / 0.06, 1.0) * np.clip((dur - t) / 0.08, 0.0, 1.0)
    x = 0.32 * norm_peak(band)
    x[:, :bt.size] += 0.75 * norm_peak(beep)
    out = norm_peak(fade_out(x, 0.005))
    assert out.shape[1] == S(dur)
    return out


def riser(dur: float = 0.40, f0: float = 500.0, f1: float = 8500.0, tone=("A4", "A5"), seed: int = 0) -> np.ndarray:
    """Noise riser: band-pass centre climbing f0 -> f1 on a steepening swell, faint tonal glide.
    Exactly `dur` long (3 ms fade) so it lands on the impact."""
    t = tvec(dur)
    u = t / dur
    x = sweep_filter(rng(seed).standard_normal((2, t.size)), f0 * (f1 / f0) ** u, q=1.8, kind="bp") * u ** 2.0
    g = hz(tone[0]) * (hz(tone[1]) / hz(tone[0])) ** (u ** 1.5)
    x = norm_peak(x) + 0.18 * np.sin(TWO_PI * np.cumsum(g) / SR) * u ** 2.5
    return norm_peak(fade_out(hp(x, 200), 0.003))


def impact(seed: int = 0) -> np.ndarray:
    """Drop impact: sub drop 85 Hz -> F1 (the track's root at 16.00), a noise burst whose low-pass
    closes 6 kHz -> 300 Hz, a short crack."""
    t = tvec(1.6)
    r = rng(seed)
    f = hz("F1") + (85 - hz("F1")) * np.exp(-t / 0.09)
    sub = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    sub = np.tanh(1.5 * sub) / np.tanh(1.5)
    burst = sweep_filter(r.standard_normal((2, t.size)), 6000 * (300 / 6000) ** np.clip(t / 0.9, 0, 1), q=0.7, kind="lp")
    burst *= np.exp(-t / 0.22)
    crack = bp(r.standard_normal((2, t.size)), 1500, 7000) * np.exp(-t / 0.012)
    x = 0.8 * sub + 0.55 * norm_peak(hp(burst, 90)) + 0.22 * norm_peak(crack)
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


def stat_hit(note: str, seed: int = 0) -> np.ndarray:
    """Proof stat landing: punchy UI thump (150 Hz -> G1), a filtered click and a short tonal accent."""
    t = tvec(0.45)
    r = rng(seed)
    f = hz("G1") + (150 - hz("G1")) * np.exp(-t / 0.022)
    body = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    body = np.tanh(1.8 * body) / np.tanh(1.8)
    click = lp(bp(r.standard_normal(t.size), 1800, 6000), 9000) * np.exp(-t / 0.0018)
    fa = hz(note)
    accent = (np.sin(TWO_PI * fa * t) + 0.2 * np.sin(TWO_PI * 2 * fa * t)) * np.exp(-t / 0.06) * attack_env(t.size, 0.002)
    x = body + 0.35 * norm_peak(click) + 0.22 * accent
    return norm_peak(fade_out(x * attack_env(t.size, 0.001), 0.08))


# counters (s67.js): PP.counter(from 0 to `to`, at T, dur, power3.out, Math.round) — one tick per
# displayed change, thinned to >= 35 ms apart, none in the 30 ms after the card's own hit.
COUNTERS = [(20.50, 99, 0.95), (21.00, 2, 0.55), (21.50, 1, 0.45)]


def counter_tick_times() -> list[float]:
    out = []
    for t0, to, dur in COUNTERS:
        last = -1.0
        for k in range(1, to + 1):
            tk = t0 + dur * (1 - (1 - (k - 0.5) / to) ** (1 / 3))
            if tk - t0 < 0.03 or tk - last < 0.035:
                continue
            out.append(round(tk, 4))
            last = tk
    return out


def counter_ticks() -> np.ndarray:
    times = counter_tick_times()
    t0 = COUNTERS[0][0]
    out = np.zeros((2, S(times[-1] - t0 + 0.05)))
    for k, tk in enumerate(times):
        s = to_stereo(tick(2700 + 25 * k, seed=700 + k) * (1.0 - 0.012 * k), 0.12 * (-1) ** k)
        i = S(tk) - S(t0)
        out[:, i:i + s.shape[1]] += s[:, :out.shape[1] - i]
    return norm_peak(out)


def shimmer(seed: int = 0) -> np.ndarray:
    """Brand reveal: quick rising arpeggio of glass bells (E6 A6 C7 E7), key-tuned high grains
    travelling left -> right, and a soft air swell. Meant to bloom into the hall/big reverbs."""
    r = rng(seed)
    total = S(2.2)
    out = np.zeros((2, total))
    for k, note in enumerate(("E6", "A6", "C7", "E7")):
        b = bell(hz(note), GLASS_TINK, dur=1.8, decay=0.9 - 0.12 * k, seed=seed + k, detune_cents=3.0,
                 strike=0.12) * (0.9 ** k)
        b = to_stereo(b, -0.3 + 0.2 * k)
        i = S(0.04 * k)
        out[:, i:i + b.shape[1]] += b[:, :total - i]
    grains = 14
    for g in range(grains):
        tg = 0.9 * (g + r.uniform(0.0, 0.8)) / grains
        tt = tvec(0.25)
        s = np.sin(TWO_PI * hz(str(r.choice(["E7", "G7", "A7", "C8"]))) * tt) * np.exp(-tt / r.uniform(0.04, 0.09))
        s *= attack_env(tt.size, 0.002) * np.sin(np.pi * min(tg / 0.9, 1.0)) ** 1.2 * r.uniform(0.25, 0.5)
        i = S(0.05 + tg)
        out[:, i:i + tt.size] += to_stereo(s, -0.5 + tg / 0.9 + r.uniform(-0.1, 0.1))[:, :total - i]
    t = tvec(1.0)
    air = hp(r.standard_normal(t.size), 6500) * np.sin(np.pi * t / 1.0) ** 2
    out[:, :t.size] += 0.08 * auto_pan(norm_peak(air), -0.5, 0.5)
    return norm_peak(fade_out(out, 0.2))


def soft_chime(notes=("A6", "E7"), step: float = 0.03, seed: int = 0) -> np.ndarray:
    """« prouvée. »: a soft two-note chime (tuned bell partials, gentle strike)."""
    out = np.zeros((2, S(2.6)))
    for k, note in enumerate(notes):
        c = bell(hz(note), CHIME, dur=2.4, decay=1.0, seed=seed + k, strike=0.06) * (0.7 ** k)
        i = S(k * step)
        out[:, i:i + c.shape[1]] += c[:, :out.shape[1] - i]
    return norm_peak(fade_out(out, 0.2))


# ─────────────────────────────── cue list (SCENES.md SOUND-EVENT TABLE) ───────────────────────────────
@dataclass
class Cue:
    t: float                         # event time from the table (s)
    label: str
    fn: Callable[..., np.ndarray]
    kw: dict = field(default_factory=dict)
    gain_db: float = 0.0             # level into the SFX bus (sources are peak-normalised)
    pan: float = 0.0
    offset: float = 0.0              # sound starts at t + offset (whooshes/swipes pre-roll into their peak)
    room: float | None = None        # sends (dB, post-fader)
    hall: float | None = None
    big: float | None = None
    ends_at: float | None = None     # checked: the sound must end exactly here

    @property
    def start(self) -> float:
        return self.t + self.offset


WHOOSH_PEAK = 0.03                   # whooshes peak 30 ms after their table time

VIALS = [(16.00, "A5", -0.2), (16.50, "C6", 0.0), (17.00, "D6", 0.2),
         (17.50, "E6", -0.2), (18.00, "G6", 0.0), (18.50, "A6", 0.2)]
PILLS = [(18.75, "C6", -0.15), (19.25, "D6", 0.15), (19.75, "E6", -0.15), (20.25, "G6", 0.15)]
STATS = [(20.50, "E5"), (21.00, "G5"), (21.50, "A5")]

CUES: list[Cue] = [
    Cue(2.95, "whoosh: phone rises", whoosh,
        dict(dur=0.52, peak=0.32, f0=260, fpk=2600, f1=1100, q=1.0, pan=(-0.15, 0.15), seed=295),
        gain_db=-14, offset=WHOOSH_PEAK - 0.32, room=-14),
    Cue(4.00, "tap: checkbox 1", tap, dict(f=2350, body_hz=380, seed=400), gain_db=-15, pan=-0.12, room=-12),
    Cue(4.45, "tap: checkbox 2", tap, dict(f=2640, body_hz=400, seed=445), gain_db=-15, pan=-0.12, room=-12),
    Cue(5.15, "tap: Entrer sur PurePeptide", tap, dict(f=2090, body_hz=330, weight=1.3, seed=515),
        gain_db=-14, pan=-0.05, room=-12),
    Cue(5.95, "swipe: to product page", swipe, dict(pan=(0.55, -0.55), seed=595),
        gain_db=-18, offset=-0.015, room=-14),
    Cue(6.90, "pop: HPLC 99.0% lens", pop, dict(note="E6", seed=690), gain_db=-17, pan=0.1, room=-10),
    Cue(7.64, "pop: Janoshik card", pop, dict(note="G6", seed=764), gain_db=-17, pan=-0.1, room=-10),
    Cue(8.60, "tap: lab line", tap, dict(f=2350, body_hz=360, seed=860), gain_db=-15, pan=-0.1, room=-12),
    Cue(10.05, "swipe: to Qualité page", swipe, dict(pan=(0.55, -0.55), seed=1005),
        gain_db=-18, offset=-0.015, room=-14),
    Cue(10.80, "pop: Pureté · HPLC card", pop, dict(note="A5", seed=1080), gain_db=-17, pan=0.12, room=-10),
    Cue(11.84, "pop: Identité · masse card", pop, dict(note="C6", seed=1184), gain_db=-17, pan=-0.12, room=-10),
    Cue(14.05, "swipe: to Certificats page", swipe, dict(pan=(0.55, -0.55), seed=1405),
        gain_db=-18, offset=-0.015, room=-14),
    Cue(14.90, "pop: QR card", pop, dict(note="D6", seed=1490), gain_db=-16, room=-10),
    Cue(15.10, "scan: beep + moving band 15.10-15.60", scan, dict(dur=0.50, note="A6", seed=1510),
        gain_db=-20, room=-12, ends_at=15.60),
    Cue(15.60, "riser 15.60 -> 16.00", riser, dict(dur=0.40, seed=1560), gain_db=-15, ends_at=16.00),
    Cue(16.00, "impact: sub drop + noise burst", impact, dict(seed=1600), gain_db=-13, big=-16),
    *[Cue(t, f"vial pop {i + 1} ({n})", vial_pop, dict(note=n, seed=1610 + 7 * i), gain_db=-17, pan=p, hall=-13)
      for i, (t, n, p) in enumerate(VIALS)],
    *[Cue(t, f"pill pop {i + 1} ({n})", pop, dict(note=n, dur=0.14, decay=0.026, body=0.15, glide=0.35,
                                                  seed=1875 + 5 * i), gain_db=-17, pan=p, room=-10)
      for i, (t, n, p) in enumerate(PILLS)],
    *[Cue(t, f"stat hit {i + 1}", stat_hit, dict(note=n, seed=2050 + 5 * i), gain_db=-9, room=-14)
      for i, (t, n) in enumerate(STATS)],
    Cue(20.50, "counter ticks 20.50-21.59", counter_ticks, gain_db=-21),
    Cue(23.75, "whoosh: to end card", whoosh,
        dict(dur=0.56, peak=0.34, f0=240, fpk=3000, f1=900, q=1.0, pan=(0.45, -0.45), seed=2375, body=0.45),
        gain_db=-12, offset=WHOOSH_PEAK - 0.34, room=-14),
    Cue(24.00, "shimmer: brand reveal", shimmer, dict(seed=2400), gain_db=-18, hall=-7, big=-11),
    Cue(26.20, "soft chime: prouvée.", soft_chime, dict(seed=2620), gain_db=-21, hall=-8),
]


def build_sfx(key: np.ndarray, report: dict) -> np.ndarray:
    buses = {k: np.zeros((2, N)) for k in ("dry", "room", "hall", "big")}
    rows = []
    for c in CUES:
        s = to_stereo(np.asarray(c.fn(**c.kw), dtype=float), c.pan) * db(c.gain_db)
        i0 = S(c.start)
        if c.ends_at is not None:
            assert i0 + s.shape[1] == S(c.ends_at), f"{c.label} does not end on {c.ends_at}"
        b = min(N, i0 + s.shape[1])
        buses["dry"][:, i0:b] += s[:, :b - i0]
        for name, lvl in (("room", c.room), ("hall", c.hall), ("big", c.big)):
            if lvl is not None:
                buses[name][:, i0:b] += s[:, :b - i0] * db(lvl)
        env = np.abs(s).max(axis=0)
        rows.append((c, i0, s.shape[1], (i0 + int(np.argmax(env))) / SR, 20 * np.log10(env.max())))
    sfx = (hp(buses["dry"], 35.0) + reverb(buses["room"], ROOM_IR, hp_hz=300, lp_hz=9000)
           + reverb(buses["hall"], HALL_IR, hp_hz=300) + reverb(buses["big"], BIG_IR, hp_hz=200))
    duck = duck_curve(key, SFX_DUCK_DB)
    sfx = sfx * db(ctrl_to_audio(duck))
    report["cues"] = rows
    report["sfx_duck"] = duck
    return sfx


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


# ═══════════════════════════════ report ═══════════════════════════════
def print_report(rep: dict, stems: dict[str, np.ndarray], out: np.ndarray, lines: list[dict]) -> None:
    print("\nVO lines (take cut -> timeline):")
    for ln in lines:
        a, b = ln["src_i"]
        print(f"  {ln['id']}  src {ln['src'][0]:6.2f}-{ln['src'][1]:6.2f} s (samples {a}-{b})  at {ln['at']:6.2f} s "
              f"(sample {ln['i0']})  ends {ln['i1'] / SR:6.3f} s  take {ln['take_lufs']:6.2f} LUFS  clip gain {ln['clip_gain']:+.2f} dB")
    g = rep["vo_gr_speech"]
    print(f"VO compressor GR while speaking: mean {-g.mean():.2f} dB, 95th pct {-np.percentile(g, 5):.2f} dB, max {-g.min():.2f} dB")

    print("\nSFX cues (start sample = round(start * 48000); peak = loudest sample of the cue):")
    for c, i0, n, tpk, pk in rep["cues"]:
        print(f"  t {c.t:6.2f}  start {c.start:7.3f}s  sample {i0:8d}  len {n / SR:5.3f}s  peak@{tpk:7.3f}s  "
              f"{pk:6.1f} dBFS pre-master  {c.label}")
    print(f"  counter ticks: {', '.join(f'{t:.3f}' for t in counter_tick_times())}")

    # VO vs music on the final stems (after glue / master gain / limiter), K-weighted (BS.1770)
    kw = {k: kweight(v) for k, v in stems.items()}
    cs = {k: np.concatenate([np.zeros((2, 1)), np.cumsum(v ** 2, axis=-1)], axis=-1) for k, v in kw.items()}

    def pw(name, t_a, t_b):
        i, j = S(t_a), S(t_b)
        return float((cs[name][:, j] - cs[name][:, i]).sum() / max(1, j - i))

    print("\nVO vs music during speech, final stems (dB = VO loudness - music loudness):")
    print("  (a) per word: K-weighted loudness over each PP.VO word [t0, t1]")
    print("  (b) 400 ms blocks (100 ms hop) inside the line with >= 75 % of their 10 ms frames speech-active")
    print("  (c) strict: every 400 ms block inside the line whose VO loudness is within 10 LU of the line's")
    print("  line  VO LUFS  music LUFS  line ratio | (a) min word          | (b) min  5th pct | (c) min | VO/(music+SFX) (a) min")
    worst_a = worst_b = np.inf
    p_act = uniform_filter1d(ms_env(stems["vo"]), 10, mode="nearest")
    active = 10 * np.log10(np.maximum(p_act, 1e-12)) > lufs_integrated(stems["vo"]) - 25.0
    zs = {k: block_power(None, y=v) for k, v in kw.items()}
    t0 = np.arange(zs["vo"].size) * 0.1
    for ln in lines:
        ta, tb = ln["i0"] / SR, ln["i1"] / SR
        v_int, m_int = lufs(pw("vo", ta, tb)), lufs(pw("music", ta, tb))
        words = [(w["w"], lufs(pw("vo", w["t0"], w["t1"])) - lufs(pw("music", w["t0"], w["t1"])),
                  lufs(pw("vo", w["t0"], w["t1"])) - lufs(pw("music", w["t0"], w["t1"]) + pw("sfx", w["t0"], w["t1"])))
                 for w in ln["words"]]
        wmin = min(words, key=lambda x: x[1])
        wmin2 = min(x[2] for x in words)
        sel = (t0 >= ta - 1e-9) & (t0 + 0.4 <= tb + 1e-9)
        frac = np.array([active[int(round(t * 1000)):int(round(t * 1000)) + 400].mean() for t in t0])
        bsel = sel & (frac >= 0.75)
        rb = lufs(zs["vo"][bsel]) - lufs(zs["music"][bsel])
        vl = lufs(zs["vo"][sel])
        csel = sel.copy()
        csel[sel] = vl > lufs(zs["vo"][sel].mean()) - 10
        rc = lufs(zs["vo"][csel]) - lufs(zs["music"][csel])
        worst_a, worst_b = min(worst_a, wmin[1]), min(worst_b, rb.min())
        print(f"  {ln['id']}  {v_int:7.2f}  {m_int:10.2f}  {v_int - m_int:10.2f} | {wmin[1]:6.2f} ({wmin[0]:>14s}) | "
              f"{rb.min():7.2f}  {np.percentile(rb, 5):7.2f} | {rc.min():7.2f} | {wmin2:6.2f}")
    ok = worst_a >= 8 and worst_b >= 8
    print(f"  worst word {worst_a:.2f} dB, worst speech block {worst_b:.2f} dB -> {'PASS' if ok else 'FAIL'} (>= 8 dB)")

    print("\nSFX vs VO where they overlap (K-weighted loudness over [t, t + 0.25 s]):")
    for c, i0, n, tpk, pk in rep["cues"]:
        ta, tb = max(c.t, c.start), max(c.t, c.start) + 0.25
        v, x, m = lufs(pw("vo", ta, tb)), lufs(pw("sfx", ta, tb)), lufs(pw("music", ta, tb))
        vs = f"VO {v:6.1f}  VO-SFX {v - x:5.1f} dB" if v > -40 else "VO   -    (no speech)       "
        print(f"  {c.t:6.2f}  SFX {x:6.1f}  music {m:6.1f}  {vs}  {c.label}")

    print("\nStem loudness (integrated, final gains):")
    for k, v in stems.items():
        print(f"  {k:6s} {lufs_integrated(v):7.2f} LUFS   peak {20 * np.log10(np.abs(v).max()):6.2f} dBFS")

    print("\nEvery 0.5 s (EBU windows ending at t: S = 3 s short-term, shorter at the start; M = 400 ms):")
    print("    t    mix S   mix M |  VO M  music M  sfx M")
    cm = np.concatenate([np.zeros(1), np.cumsum((kweight(out) ** 2).sum(axis=0))])
    for t in np.arange(0.5, DURATION + 1e-9, 0.5):
        j = S(t)

        def win(c, w):
            i = max(0, j - S(w))
            return lufs((c[j] - c[i]) / (j - i))

        st = [win(np.concatenate([[0.0], cs[k][:, 1:].sum(axis=0)]), 0.4) for k in ("vo", "music", "sfx")]
        f = lambda v: f"{v:6.1f}" if v > -99 else "  -inf"
        print(f"  {t:4.1f}  {f(win(cm, 3.0))}  {f(win(cm, 0.4))} | {f(st[0])}  {f(st[1])}  {f(st[2])}")


# ═══════════════════════════════ main ═══════════════════════════════
def main() -> None:
    rep: dict = {}
    vo, lines = build_vo(rep)
    music = build_music(vo_key(vo), rep)                   # bed stays down through commas / short pauses
    sfx = build_sfx(vo_key(vo, bridge=0.0), rep)           # SFX dip only where they really overlap speech
    vo_st = np.vstack([vo, vo])
    mixed = vo_st + music + sfx
    out, gain, glue_gr, lim_gr = master(mixed)
    assert out.shape == (2, N)
    assert np.all(np.isfinite(out)) and np.abs(out).max() < 1.0
    write_wav24(OUT_PATH, out)

    tp = true_peak_db(out)
    print(f"wrote {OUT_PATH}  ({N} frames, {N / SR:.3f} s, 48 kHz, stereo, 24-bit)")
    print(f"integrated {lufs_integrated(out):.2f} LUFS | true peak (4x) {tp:.2f} dBTP | sample peak "
          f"{20 * np.log10(np.abs(out).max()):.2f} dBFS | master gain {gain:+.2f} dB")
    print(f"glue GR max {-glue_gr.min():.2f} dB, mean {-glue_gr.mean():.2f} dB | limiter GR max {lim_gr.max():.2f} dB, "
          f">0.5 dB on {100 * np.mean(lim_gr > 0.5):.2f} % of samples, >1 dB on {100 * np.mean(lim_gr > 1):.2f} %")
    print(f"music: {rep['music_raw_frames']} decoded frames -> {N} | duck min {rep['music_duck'].min():.2f} dB | "
          f"SFX duck min {rep['sfx_duck'].min():.2f} dB")

    if "--report" in sys.argv:
        post = db(ctrl_to_audio(glue_gr)) * db(gain) * 10 ** (-lim_gr / 20)
        stems = {}
        for name, s in (("vo", vo_st), ("music", music), ("sfx", sfx)):
            stems[name] = fade_out(hp(s, 24.0), 0.25) * attack_env(N, 0.005) * post
        stems_sum = stems["vo"] + stems["music"] + stems["sfx"]
        print(f"stem sum vs master max abs diff: {np.abs(stems_sum - out).max():.2e}")
        print_report(rep, stems, out, lines)


if __name__ == "__main__":
    main()
