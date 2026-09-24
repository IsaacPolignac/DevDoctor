#!/usr/bin/env python3
"""PurePeptide 30 s ad: procedural soundtrack (BRIEF.md §6).

Run from the project root:

    python3 tools/make_audio.py            # writes assets/audio/soundtrack.wav
    python3 tools/make_audio.py --stems    # same, plus a per-stem loudness table (mix calibration)

Everything is synthesized here (numpy/scipy only, fixed seeds, no samples), so a re-run is
bit-identical. Output: 48 kHz, stereo, 24-bit PCM, exactly 30.000 s (1,440,000 frames), mastered to
-14 LUFS integrated with a true-peak ceiling of -1.5 dBTP. The brief asks for <= -1 dBTP; the extra
0.5 dB leaves room for the AAC 192k encode in the video render.

Music. D minor, 120 BPM (beat 0.5 s, bar 2 s), one chord per bar:
    bar  0-2   0-6 s   intro: supersaw pad and sparse glass plucks behind a low-pass opening 300 Hz -> open
    bar  3-7   6-16 s  drop: four-on-the-floor kick and hats, pluck motif, pumping sub
    bar  8-10  16-22 s full: adds offbeat bass, 16th glass arpeggio, 16th hats, soft clap on 2 & 4
    bar 11-12  22-26 s break: drums out, pad opens with a 4 s riser, reverse suck into 26
    bar 13-14  26-30 s final impact (sub drop, noise burst, shimmer) with the reverb tail to 30.00
SFX. The CUES list below places every hit from BRIEF §6 at t * 48000, sample-accurate.
"""
from __future__ import annotations

import sys
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

# ═══════════════════════════════ constants ═══════════════════════════════
SR = 48_000
DURATION = 30.0
N = 1_440_000                      # exactly 30.000 s
BPM = 120
BEAT = 60 / BPM                    # 0.5 s
BAR = 4 * BEAT                     # 2.0 s
STEP = BEAT / 4                    # 16th note = 0.125 s
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
OUT_PATH = Path(__file__).resolve().parents[1] / "assets" / "audio" / "soundtrack.wav"
TWO_PI = 2 * np.pi
assert N == round(SR * DURATION)


# ═══════════════════════════════ helpers ═══════════════════════════════
def S(t: float) -> int:
    """Seconds to sample index (cue placement is t * 48000, rounded)."""
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
    """'Bb5' -> 932.33 Hz (A4 = 440)."""
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
    """Pan that moves linearly from p0 to p1 over the sound (mono or decorrelated stereo in)."""
    n = x.shape[-1]
    gl, gr = pan_gains(np.linspace(p0, p1, n))
    if x.ndim == 1:
        return np.vstack([x * gl, x * gr])
    return np.vstack([x[0] * gl, x[1] * gr]) * np.sqrt(2)


def norm_peak(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def widen(x: np.ndarray, d_left: float = 0.0113, d_right: float = 0.0171, g: float = 0.3) -> np.ndarray:
    """Mono to stereo through short decorrelated delays (a different comb on each side)."""
    left, right = x.copy(), x.copy()
    a, b = S(d_left), S(d_right)
    left[a:] += g * x[:-a]
    right[b:] += g * x[:-b]
    return np.vstack([left, right]) / (1 + g)


def automation(points, n: int = N, curve: str = "lin") -> np.ndarray:
    """Breakpoint envelope [(t, v), ...]. A repeated t is a step; 'exp' interpolates in the log domain (Hz)."""
    ts, vs, last = [], [], -1.0
    for t, v in points:
        t = max(t, last + 1.0 / SR)          # keep xp strictly increasing (steps)
        ts.append(t)
        vs.append(float(v))
        last = t
    t = np.arange(n) / SR
    if curve == "exp":
        return np.exp(np.interp(t, ts, np.log(vs)))
    return np.interp(t, ts, vs)


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
    """Resonant biquad whose cutoff follows `fc` (scalar or per-sample Hz), processed in 32-sample
    blocks with carried state. This is the moving filter used for sweeps, risers and the pad."""
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
    """Exponentially decaying noise IR, highs decaying faster (4 bands), soft diffuse build-up, unit energy."""
    n = S(length)
    t = np.arange(n) / SR
    noise = rng(seed).standard_normal(n)
    bands = [(lp(noise, 450, 4), 1.15), (bp(noise, 450, 1800), 1.0),
             (bp(noise, 1800, 6000), 0.78), (hp(noise, 6000, 4), 0.5)]
    ir = sum(y * np.exp(-6.9078 * t / (rt60 * m)) for y, m in bands)
    ir *= 1.0 - np.exp(-t / 0.007)
    ir = np.concatenate([np.zeros(S(predelay)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))


HALL_IR = (make_ir(2.3, 3.0, seed=101, predelay=0.018), make_ir(2.3, 3.0, seed=202, predelay=0.018))
BIG_IR = (make_ir(3.6, 4.5, seed=303, predelay=0.010), make_ir(3.6, 4.5, seed=404, predelay=0.010))
SUCK_IR = (make_ir(1.7, 1.2, seed=505), make_ir(1.7, 1.2, seed=606))


def reverb(send: np.ndarray, irs, hp_hz: float = 200.0, lp_hz: float = 11000.0) -> np.ndarray:
    """Stereo convolution reverb (L/R IRs from different seeds), returns the wet signal only."""
    n = send.shape[-1]
    left_in = 0.75 * send[0] + 0.25 * send[1]
    right_in = 0.25 * send[0] + 0.75 * send[1]
    wet = np.vstack([signal.fftconvolve(left_in, irs[0])[:n], signal.fftconvolve(right_in, irs[1])[:n]])
    return lp(hp(wet, hp_hz), lp_hz)


def pingpong(x: np.ndarray, delay: float = 3 * STEP, fb: float = 0.42, taps: int = 4) -> np.ndarray:
    """Dotted-8th ping-pong echo (wet only), darkened."""
    mono = 0.5 * (x[0] + x[1])
    out = np.zeros_like(x)
    d = S(delay)
    for k in range(1, taps + 1):
        out[k % 2, k * d:] += fb ** (k - 1) * mono[:-k * d]
    return lp(hp(out, 300), 4500)


# ═══════════════════════════════ harmony ═══════════════════════════════
# name: (sub root, pad voicing, pluck-motif pool, arpeggio notes)
CHORDS = {
    "Dm9":    ("D2",  ("D3", "A3", "C4", "F4", "E5"),  ("D5", "E5", "F5", "A5", "C6"),   ("D4", "A4", "C5", "E5", "F5", "A5")),
    "Bbmaj7": ("Bb1", ("Bb2", "F3", "A3", "D4", "C5"), ("D5", "F5", "A5", "Bb5", "D6"),  ("Bb3", "F4", "A4", "C5", "D5", "F5")),
    "Gm9":    ("G1",  ("G2", "D3", "Bb3", "F4", "A4"), ("D5", "F5", "G5", "A5", "Bb5"),  ("G3", "D4", "F4", "A4", "Bb4", "D5")),
    "A7sus4": ("A1",  ("A2", "E3", "G3", "D4", "A4"),  ("D5", "E5", "G5", "A5", "D6"),   ("A3", "E4", "G4", "A4", "D5", "E5")),
    "A7":     ("A1",  ("A2", "E3", "G3", "C#4", "E4"), ("C#5", "E5", "G5", "A5", "C#6"), ("A3", "E4", "G4", "A4", "C#5", "E5")),
}
# One chord per 2 s bar. Bars 8-10 carry the product tinks A6-Bb6 | B6-C7-C#7 | D7 (maj7, root | 9, #9, 3 | root).
PROGRESSION = ["Dm9", "Bbmaj7", "A7sus4",                     # 0-6   intro
               "Dm9", "Bbmaj7", "Gm9", "A7sus4", "Dm9",       # 6-16  drop
               "Bbmaj7", "A7", "Dm9",                         # 16-22 full
               "Bbmaj7", "A7sus4",                            # 22-26 break
               "Dm9", "Dm9"]                                  # 26-30 final
assert len(PROGRESSION) * BAR == DURATION


def chord_at(bar: int):
    return CHORDS[PROGRESSION[bar]]


# ═══════════════════════════════ instruments ═══════════════════════════════
def saw_blep(f, n: int, phase0: float = 0.0) -> np.ndarray:
    """Band-limited (polyBLEP) sawtooth; f may be a per-sample array."""
    dt = np.broadcast_to(np.asarray(f, dtype=float) / SR, (n,))
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    u = ph[m] / dt[m]
    y[m] -= u + u - u * u - 1.0
    m = ph > 1.0 - dt
    u = (ph[m] - 1.0) / dt[m]
    y[m] -= u * u + u + u + 1.0
    return y


def supersaw(f: float, n: int, seed: int, voices: int = 5, detune_cents: float = 13.0, width: float = 0.85):
    """Detuned saw stack spread across the stereo field."""
    r = rng(seed)
    out = np.zeros((2, n))
    for o in np.linspace(-1.0, 1.0, voices):
        s = saw_blep(f * 2 ** (o * detune_cents / 1200), n, r.random())
        gl, gr = pan_gains(o * width)
        out[0] += s * gl
        out[1] += s * gr
    return out / voices


GLASS_PARTIALS = [(1.0, 1.00, 1.00), (2.0, 0.42, 0.50), (3.02, 0.20, 0.30),
                  (4.11, 0.11, 0.20), (5.47, 0.06, 0.13), (7.03, 0.03, 0.09)]


def glass_pluck(f: float, dur: float = 1.6, decay: float = 0.55, bright: float = 1.0, seed: int = 0,
                stereo: bool = True) -> np.ndarray:
    """Glassy pluck: slightly inharmonic additive partials (upper ones die faster) plus an FM strike
    transient; widened with short decorrelated delays."""
    t = tvec(dur)
    r = rng(seed)
    x = np.zeros_like(t)
    for k, (ratio, amp, dk) in enumerate(GLASS_PARTIALS):
        fk = f * ratio * (1 + r.uniform(-6e-4, 6e-4))
        if fk > 15000:
            break
        x += amp * bright ** k * np.sin(TWO_PI * fk * t) * np.exp(-t / (decay * dk))
    index = 1.8 * bright * np.exp(-t / 0.02)
    x += 0.3 * np.sin(TWO_PI * f * t + index * np.sin(TWO_PI * 3.51 * f * t)) * np.exp(-t / 0.05)
    x *= attack_env(t.size, 0.0015)
    x = norm_peak(fade_out(x, 0.05))
    return widen(x) if stereo else x


GLASS_TINK = [(1.0, 1.0, 1.0), (2.756, 0.50, 0.42), (5.404, 0.26, 0.24), (8.933, 0.12, 0.14)]   # free-bar modes
CHIME = [(1.0, 1.0, 1.0), (2.0, 0.30, 0.62), (3.0, 0.10, 0.40), (4.16, 0.09, 0.26), (5.43, 0.05, 0.18)]


def bell(f: float, partials, dur: float, decay: float, seed: int = 0, detune_cents: float = 1.2,
         strike: float = 0.25) -> np.ndarray:
    """Tuned percussion: modal partials with per-mode decay; L/R detuned a hair for a slow stereo shimmer."""
    t = tvec(dur)
    r = rng(seed)
    out = np.zeros((2, t.size))
    for ch, sgn in enumerate((-1, 1)):
        fc = f * 2 ** (sgn * detune_cents / 1200)
        for ratio, amp, dk in partials:
            if fc * ratio < 16000:
                out[ch] += amp * np.sin(TWO_PI * fc * ratio * t + r.uniform(0, 0.3)) * np.exp(-t / (decay * dk))
    out += strike * hp(r.standard_normal(t.size), 5000) * np.exp(-t / 0.0025)
    out *= attack_env(t.size, 0.001)
    return norm_peak(fade_out(out, 0.08))


def kick(seed: int = 7) -> np.ndarray:
    """Tight kick: pitch-swept sine (~160 -> 46 Hz), gentle saturation and a click."""
    t = tvec(0.5)
    r = rng(seed)
    f = 46 + 95 * np.exp(-t / 0.035) + 40 * np.exp(-t / 0.008)
    body = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / 0.15)
    body = np.tanh(1.6 * body) / np.tanh(1.6)
    click = 0.22 * hp(r.standard_normal(t.size), 2500) * np.exp(-t / 0.0025)
    click += 0.12 * np.sin(TWO_PI * 1800 * t) * np.exp(-t / 0.004)
    x = (body + click) * attack_env(t.size, 0.0006)
    return norm_peak(fade_out(x, 0.08))


def hat(seed: int, decay: float = 0.032) -> np.ndarray:
    """Closed hat: high-passed noise with a 10 kHz sheen, short decay."""
    t = tvec(0.2)
    noise = rng(seed).standard_normal(t.size)
    x = hp(noise, 7000, 4) + 0.5 * bp(noise, 9000, 12500)
    x *= np.exp(-t / decay) * attack_env(t.size, 0.0004)
    return norm_peak(fade_out(x, 0.02))


def clap(seed: int) -> np.ndarray:
    """Soft clap/rim: three quick band-passed bursts, a short tail, a faint 1.7 kHz rim tone."""
    t = tvec(0.35)
    r = rng(seed)
    noise = bp(r.standard_normal(t.size), 900, 3200)
    env = np.zeros_like(t)
    for d in (0.0, 0.009, 0.019):
        env += (t >= d) * np.exp(-np.maximum(t - d, 0) / 0.004)
    env += 0.6 * (t >= 0.022) * np.exp(-np.maximum(t - 0.022, 0) / 0.075)
    x = noise * env + 0.25 * np.sin(TWO_PI * 1700 * t) * np.exp(-t / 0.012)
    return norm_peak(fade_out(x * attack_env(t.size, 0.0005), 0.05))


def bass_note(f: float, dur: float = 0.2) -> np.ndarray:
    """Deep bass: sine + low harmonics, tanh saturation (audible on phones), low-passed."""
    t = tvec(dur + 0.05)
    x = np.sin(TWO_PI * f * t) + 0.25 * np.sin(TWO_PI * 2 * f * t) + 0.08 * np.sin(TWO_PI * 3 * f * t)
    x = np.tanh(1.8 * x) / np.tanh(1.8)
    x *= attack_env(t.size, 0.004)
    return lp(norm_peak(fade_out(x, 0.05)), 900)


def sub_tone(f: float, dur: float, xfade: float = 0.25) -> np.ndarray:
    """Sustained sub sine (gently saturated) with soft edges for legato cross-fades."""
    t = tvec(dur + xfade)
    x = np.tanh(1.3 * np.sin(TWO_PI * f * t)) / np.tanh(1.3)
    x *= attack_env(t.size, xfade)
    return fade_out(x, xfade)


# ═══════════════════════════════ SFX ═══════════════════════════════
def sub_impact(dur: float = 2.0, f_hi: float = 78.0, f_lo: float = 38.0, tau: float = 0.8, seed: int = 1):
    """Sub drop: pitch-falling sine, tanh saturation for harmonics, low noise thump."""
    t = tvec(dur)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.25)
    x = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / tau)
    x = np.tanh(1.6 * x) / np.tanh(1.6)
    x += 0.5 * norm_peak(lp(rng(seed).standard_normal(t.size), 180)) * np.exp(-t / 0.05)
    x *= attack_env(t.size, 0.002)
    return norm_peak(fade_out(x, 0.1))


def glass_ping(note: str = "D6") -> np.ndarray:
    return bell(hz(note), GLASS_TINK, dur=2.6, decay=1.3, seed=3, strike=0.35)


def glass_tink(note: str, seed: int = 30) -> np.ndarray:
    return bell(hz(note), GLASS_TINK, dur=1.6, decay=0.6, seed=seed, strike=0.4)


def chime_arp(notes, step: float, decay: float = 0.9, seed: int = 40) -> np.ndarray:
    """Notes struck `step` s apart, each a chime (tuned to the key)."""
    total = S(step * (len(notes) - 1) + 2.4)
    out = np.zeros((2, total))
    for k, note in enumerate(notes):
        c = bell(hz(note), CHIME, dur=2.4, decay=decay, seed=seed + k) * (0.85 ** k)
        i = S(k * step)
        out[:, i:i + c.shape[1]] += c[:, :total - i]
    return norm_peak(out)


def tick(f: float = 3200.0, seed: int = 0, decay: float = 0.004) -> np.ndarray:
    """UI tick: tiny sine burst plus a noise click."""
    t = tvec(0.03)
    x = np.sin(TWO_PI * f * t) * np.exp(-t / decay)
    x += 0.4 * hp(rng(seed).standard_normal(t.size), 6000) * np.exp(-t / 0.0015)
    return norm_peak(x * attack_env(t.size, 0.0003))


def scan_sweep(dur: float = 0.8, seed: int = 11) -> np.ndarray:
    """Scan line moving down: resonant band-passed noise whose centre falls, a thin gliding tone and a
    24 Hz raster flutter."""
    t = tvec(dur)
    u = t / dur
    fc = 5200 * (1300 / 5200) ** u
    noise = rng(seed).standard_normal((2, t.size))
    x = sweep_filter(noise, fc, q=5.0, kind="bp")
    x += 0.12 * np.sin(TWO_PI * np.cumsum(fc * 0.5) / SR)
    x *= (1 - 0.3 * (0.5 + 0.5 * np.cos(TWO_PI * 24 * t))) * np.sin(np.pi * u) ** 1.5
    return norm_peak(fade_out(x, 0.02))


def soft_hit(seed: int = 15) -> np.ndarray:
    """Rounded low thud with a little air, for the "vial?" pulse."""
    t = tvec(0.6)
    r = rng(seed)
    f = 70 + 90 * np.exp(-t / 0.03)
    x = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    x += 0.35 * norm_peak(lp(r.standard_normal(t.size), 900)) * np.exp(-t / 0.03)
    x += 0.12 * norm_peak(hp(r.standard_normal(t.size), 4000)) * np.exp(-t / 0.012)
    return norm_peak(fade_out(x * attack_env(t.size, 0.001), 0.1))


def whoosh(dur: float, f0: float, fpk: float, f1: float, peak: float, q: float = 1.2,
           pan=(0.0, 0.0), seed: int = 0, body: float = 0.0) -> np.ndarray:
    """Band-passed noise whose centre moves f0 -> fpk (at `peak` s) -> f1, with a swell envelope
    and moving pan. `body` adds low air for weight."""
    t = tvec(dur)
    r = rng(seed)
    fc = np.where(t < peak, f0 * (fpk / f0) ** (t / peak), fpk * (f1 / fpk) ** ((t - peak) / (dur - peak)))
    noise = r.standard_normal((2, t.size))
    x = sweep_filter(noise, fc, q=q, kind="bp")
    if body:
        x += body * lp(r.standard_normal((2, t.size)), 280)
    env = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / ((dur - peak) / 3.5)))
    x = auto_pan(x * env, *pan)
    return norm_peak(fade_out(hp(x, 120), 0.03))


def shimmer(dur: float = 1.0, notes=("D7", "F7", "A7", "D8"), grains: int = 26, pan=(-0.45, 0.45),
            seed: int = 26) -> np.ndarray:
    """Specular glints: seeded high sine grains (key-tuned) that travel across the stereo field over
    a soft air swell."""
    r = rng(seed)
    total = S(dur + 0.4)
    out = np.zeros((2, total))
    for g in range(grains):
        tg = dur * (g + r.uniform(0.0, 0.8)) / grains
        tt = tvec(0.3)
        s = np.sin(TWO_PI * hz(str(r.choice(notes))) * tt) * np.exp(-tt / r.uniform(0.04, 0.12))
        s *= attack_env(tt.size, 0.002) * np.sin(np.pi * tg / dur) ** 1.2 * r.uniform(0.5, 1.0)
        p = pan[0] + (pan[1] - pan[0]) * tg / dur + r.uniform(-0.15, 0.15)
        i = S(tg)
        out[:, i:i + tt.size] += to_stereo(s, p)[:, :total - i]
    t = tvec(dur)
    air = hp(r.standard_normal(t.size), 7000) * np.sin(np.pi * t / dur) ** 2
    out[:, :t.size] += 0.1 * auto_pan(norm_peak(air), *pan)
    return norm_peak(fade_out(out, 0.1))


def ui_ticks() -> np.ndarray:
    """Callout lines drawing: left label ticks from 3.40, right label ticks from 3.55."""
    out = np.zeros((2, S(0.5)))
    for k in range(5):
        for start, f, p in ((0.0, 3200, -0.45), (0.15, 3600, 0.45)):
            s = to_stereo(tick(f, seed=300 + k + int(start * 100)) * (1.0 - 0.1 * k), p)
            i = S(start + 0.05 * k)
            out[:, i:i + s.shape[1]] += s
    return norm_peak(out)


def riser(dur: float, f0: float, f1: float, tone=None, seed: int = 0) -> np.ndarray:
    """Noise riser: band-pass centre climbing f0 -> f1 with a steepening swell, optional tonal glide.
    Ends exactly at dur (3 ms fade)."""
    t = tvec(dur)
    u = t / dur
    x = sweep_filter(rng(seed).standard_normal((2, t.size)), f0 * (f1 / f0) ** u, q=2.0, kind="bp") * u ** 2.2
    if tone:
        g = hz(tone[0]) * (hz(tone[1]) / hz(tone[0])) ** u
        x += 0.35 * np.sin(TWO_PI * np.cumsum(g) / SR) * u ** 3
    return norm_peak(fade_out(x, 0.003))


def counter_ticks(span: float = 1.8, count: int = 20) -> np.ndarray:
    """Counter settling 7.00 to 8.80: gaps grow from about 50 ms to about 340 ms. The tick that would
    land on 8.80 is left out because the lock chime takes that spot."""
    out = np.zeros((2, S(span)))
    for k in range(count):
        tk = span * (1 - (1 - k / count) ** (1 / 1.8))
        s = to_stereo(tick(2900 - 12 * k, seed=700 + k) * (1.0 - 0.02 * k), 0.08 * (-1) ** k)
        i = S(tk)
        out[:, i:i + s.shape[1]] += s[:, :out.shape[1] - i]
    return norm_peak(out)


def lock_chime(notes=("A5", "D6"), step: float = 0.085) -> np.ndarray:
    """Mechanical lock click followed by a rising two-note chime."""
    c = chime_arp(notes, step, decay=0.9, seed=88)
    t = tvec(0.05)
    click = bp(rng(89).standard_normal(t.size), 1200, 3000) * np.exp(-t / 0.004)
    click += 0.6 * np.sin(TWO_PI * 900 * t) * np.exp(-t / 0.008)
    c[:, :t.size] += 0.35 * norm_peak(click)
    return norm_peak(c)


def blips(notes, step: float) -> np.ndarray:
    """Short ascending triangle blips (bars growing left to right)."""
    out = np.zeros((2, S(step * len(notes) + 0.1)))
    for k, note in enumerate(notes):
        f, t = hz(note), tvec(0.08)
        x = 0.7 * (2 / np.pi) * np.arcsin(np.sin(TWO_PI * f * t)) + 0.3 * np.sin(TWO_PI * 2 * f * t)
        x *= np.exp(-t / 0.018) * attack_env(t.size, 0.002) * (0.8 + 0.2 * k / len(notes))
        s = to_stereo(x, -0.4 + 0.8 * k / (len(notes) - 1))
        i = S(k * step)
        out[:, i:i + s.shape[1]] += s
    return norm_peak(out)


def reverse_suck(dur: float, notes, seed: int) -> np.ndarray:
    """Reversed reverb swell: a struck chord and noise burst go through a short hall, the wet signal
    is reversed and a low-pass opens over it. It is exactly `dur` long, so it ends on the target frame."""
    n = S(dur)
    r = rng(seed)
    src = sum(glass_pluck(hz(nt), dur=0.3, decay=0.25, seed=seed + i, stereo=False) for i, nt in enumerate(notes))
    src = np.concatenate([src, np.zeros(n)])
    src[:S(0.02)] += 0.8 * r.standard_normal(S(0.02))
    wet = np.vstack([signal.fftconvolve(src, SUCK_IR[0])[:n], signal.fftconvolve(src, SUCK_IR[1])[:n]])
    rev = wet[:, ::-1].copy()
    u = np.arange(n) / n
    rev += 0.25 * norm_peak(hp(r.standard_normal((2, n)), 1500)) * u ** 3
    rev = sweep_filter(rev * u ** 1.3, 700 * (11000 / 700) ** u, q=0.9, kind="lp")
    out = norm_peak(fade_out(hp(rev, 150), 0.004))
    assert out.shape[1] == n
    return out


def paper_unfold(dur: float = 0.65, seed: int = 120) -> np.ndarray:
    """Certificate unrolling: seeded crinkle grains (dense early, expo.out) over a soft paper swoosh."""
    r = rng(seed)
    n = S(dur)
    out = np.zeros((2, n))
    for g in range(90):
        tg = dur * 0.9 * (g / 90) ** 1.7
        glen = S(r.uniform(0.002, 0.009))
        fc = r.uniform(1800, 6500)
        grain = bp(r.standard_normal(glen) * np.hanning(glen), fc * 0.7, min(fc * 1.4, 20000))
        grain *= r.uniform(0.3, 1.0) * (1 - tg / dur) ** 1.2
        i = S(tg)
        out[:, i:i + glen] += to_stereo(grain, r.uniform(-0.4, 0.4))[:, :n - i]
    t = tvec(dur)
    env = np.minimum(t / 0.06, 1.0) ** 2 * np.exp(-np.maximum(t - 0.06, 0) / 0.18)
    body = bp(r.standard_normal((2, n)), 350, 1400) * env
    out = norm_peak(out) + 0.5 * norm_peak(body)
    return norm_peak(fade_out(out, 0.05))


def bracket_snaps(step: float = 0.035, pans=(-0.35, 0.35, -0.3, 0.3), seed: int = 134) -> np.ndarray:
    """Four corner brackets snapping onto the QR code: click, a small tonal body and a woody tock."""
    out = np.zeros((2, S(step * 4 + 0.1)))
    for k, p in enumerate(pans):
        t = tvec(0.06)
        x = hp(rng(seed + k).standard_normal(t.size), 3000) * np.exp(-t / 0.0012)
        x += 0.5 * np.sin(TWO_PI * (2600 + 60 * k) * t) * np.exp(-t / 0.01)
        x += 0.4 * np.sin(TWO_PI * 820 * t) * np.exp(-t / 0.018)
        s = to_stereo(x * attack_env(t.size, 0.0002), p)
        i = S(k * step)
        out[:, i:i + s.shape[1]] += s
    return norm_peak(out)


def scan_beep(note: str = "A6", dur: float = 0.12, seed: int = 137) -> np.ndarray:
    """Clean scanner beep plus a faint noise pass that follows the line down and back up (13.70-14.30)."""
    f, t = hz(note), tvec(0.6)
    x = np.sin(TWO_PI * f * t) + 0.15 * np.sin(TWO_PI * 2 * f * t) + 0.08 * np.sin(TWO_PI * 3 * f * t)
    env = attack_env(t.size, 0.004) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.03))
    beep = to_stereo(norm_peak(x * env))
    fc = np.where(t < 0.3, 3000 * (1200 / 3000) ** (t / 0.3), 1200 * (3000 / 1200) ** ((t - 0.3) / 0.3))
    scan = sweep_filter(rng(seed).standard_normal((2, t.size)), fc, q=3.0, kind="bp") * np.sin(np.pi * t / 0.6) ** 2
    return norm_peak(fade_out(beep + 0.18 * norm_peak(scan), 0.02))


def verified_chime(seed: int = 143) -> np.ndarray:
    """The key moment: an open D-A-E chime arpeggio with a high sparkle and a soft stamp thud."""
    out = chime_arp(("D6", "A6", "E7"), 0.045, decay=1.3, seed=seed)
    sparkle = bell(hz("D7"), GLASS_TINK, dur=1.6, decay=0.7, seed=seed + 9) * 0.3
    i = S(0.13)
    out[:, i:i + sparkle.shape[1]] += sparkle[:, :out.shape[1] - i]
    t = tvec(0.12)
    thud = np.sin(TWO_PI * (110 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.04)
    out[:, :t.size] += 0.25 * to_stereo(thud * attack_env(t.size, 0.001))
    return norm_peak(out)


def bloom_swell(dur: float = 1.5, peak: float = 0.8, notes=("D6", "F6", "A6", "E7"), seed: int = 205):
    """Group shot pull-back: a Dm9 cloud and airy noise that swell into the 21.0-21.6 rim-light sweep,
    then settle into the dip."""
    t = tvec(dur)
    r = rng(seed)
    env = np.where(t < peak, (t / peak) ** 2.5, np.exp(-(t - peak) / 0.3))
    tones = np.zeros((2, t.size))
    for k, note in enumerate(notes):
        for ch, sgn in enumerate((-1, 1)):
            tones[ch] += np.sin(TWO_PI * hz(note) * 2 ** (sgn * 4 / 1200) * t + r.uniform(0, TWO_PI)) / (1 + 0.3 * k)
    fc = np.where(t < peak, 1500 * (7000 / 1500) ** (t / peak), 7000 * (3000 / 7000) ** ((t - peak) / (dur - peak)))
    air = sweep_filter(r.standard_normal((2, t.size)), fc, q=1.0, kind="bp")
    x = (0.6 * norm_peak(tones) + 0.4 * norm_peak(air)) * env
    return norm_peak(fade_out(x, 0.05))


def break_riser(dur: float = 4.0, seed: int = 220) -> np.ndarray:
    """22-26 build: noise climbing 250 Hz -> 9 kHz, plus an A-drone (A2/E3/A3 saws) whose filter opens
    while its tremolo accelerates from 8ths to 32nds. Cuts 60 ms before the impact for a breath."""
    t = tvec(dur)
    u = t / dur
    r = rng(seed)
    noise = sweep_filter(r.standard_normal((2, t.size)), 250 * (9000 / 250) ** u, q=1.3, kind="bp") * u ** 1.7
    drone = sum(supersaw(hz(nt), t.size, seed=seed + k, voices=3, detune_cents=9) for k, nt in enumerate(("A2", "E3", "A3")))
    drone = sweep_filter(drone, 250 * (6000 / 250) ** (u ** 2), q=1.6, kind="lp")
    rate = 4.0 * 4.0 ** u
    trem = 0.5 + 0.5 * np.cos(TWO_PI * np.cumsum(rate) / SR)
    drone *= (0.35 + 0.65 * trem) * u ** 1.5
    x = 0.55 * norm_peak(noise) + 0.45 * norm_peak(hp(drone, 150))
    x[:, S(dur - 0.06):] = 0.0
    x[:, :S(dur - 0.06)] = fade_out(x[:, :S(dur - 0.06)], 0.012)
    return norm_peak(x)


def impact_low(seed: int = 260) -> np.ndarray:
    """Final impact, low: long sub drop (90 -> 41 Hz) plus a kick punch. Dry only, kept out of the reverb."""
    x = sub_impact(dur=3.6, f_hi=90, f_lo=41, tau=1.2, seed=seed)
    k = kick(seed + 1)
    x[:k.size] += 0.6 * k
    return norm_peak(fade_out(x, 0.3))


def impact_burst(seed: int = 261) -> np.ndarray:
    """Final impact, body: a stereo noise burst whose low-pass closes 7 kHz -> 250 Hz, plus a crack."""
    t = tvec(2.0)
    r = rng(seed)
    body = sweep_filter(r.standard_normal((2, t.size)), 7000 * (250 / 7000) ** np.clip(t / 1.4, 0, 1), q=0.8, kind="lp")
    body *= np.exp(-t / 0.45)
    crack = bp(r.standard_normal((2, t.size)), 1500, 7000) * np.exp(-t / 0.02)
    x = norm_peak(body) + 0.4 * norm_peak(crack)
    return norm_peak(fade_out(hp(x * attack_env(t.size, 0.001), 60), 0.2))


def shimmer_tail(seed: int = 262) -> np.ndarray:
    """Final impact, shimmer: long, slightly detuned glass bells on D-A-D-E-A that ring into 30.00."""
    out = np.zeros((2, S(4.0)))
    for k, note in enumerate(("D6", "A6", "D7", "E7", "A7")):
        b = bell(hz(note), GLASS_TINK, dur=4.0, decay=2.6 - 0.3 * k, seed=seed + k, detune_cents=3.0,
                 strike=0.2) / (1 + 0.35 * k)
        i = S(0.012 * k)
        out[:, i:] += b[:, :out.shape[1] - i]
    return norm_peak(out)


def drop_air(seed: int = 60) -> np.ndarray:
    """Drop accent: a soft air burst that blooms into the big reverb at 6.00 (the 35 % light bloom)."""
    t = tvec(1.0)
    x = hp(rng(seed).standard_normal((2, t.size)), 400) * np.exp(-t / 0.18)
    return norm_peak(fade_out(lp(x, 6000) * attack_env(t.size, 0.002), 0.2))


# ═══════════════════════════════ cue list (BRIEF §6, exact times) ═══════════════════════════════
@dataclass
class Cue:
    t: float                          # start time (s); placed at sample round(t*48000)
    label: str
    fn: Callable[..., np.ndarray]
    kw: dict = field(default_factory=dict)
    gain_db: float = 0.0              # level into the SFX bus (sources are peak-normalised)
    pan: float = 0.0
    bus: str = "sfx"                  # "sfx" (high-passed at 120 Hz) or "sfx_low" (full range)
    hall: float | None = None         # send (dB) to the hall reverb
    big: float | None = None          # send (dB) to the big reverb
    ends_at: float | None = None      # checked: the sound must end exactly here
    duck: bool = False                # priority: dips plucks/arp/their reverb ~3.7 dB around the cue


PRODUCT_TINKS = [(16.00, "A6"), (17.00, "Bb6"), (18.00, "B6"), (19.00, "C7"), (19.50, "C#7"), (20.00, "D7")]
TILE_PLUCKS = [(22.50, "D5", -0.35), (23.00, "F5", 0.35), (23.50, "A5", -0.35), (24.00, "D6", 0.35)]

CUES: list[Cue] = [
    Cue(0.00, "sub impact", sub_impact, gain_db=-7, bus="sfx_low"),
    Cue(0.00, "glass ping", glass_ping, dict(note="D6"), gain_db=-12, hall=-10, big=-10),
    Cue(0.80, "scan sweep", scan_sweep, dict(dur=0.80), gain_db=-12, hall=-14),
    Cue(1.50, "soft hit", soft_hit, gain_db=-6, bus="sfx_low", big=-20),
    Cue(2.00, "focus whoosh", whoosh, dict(dur=0.70, f0=220, fpk=2400, f1=900, peak=0.42, q=1.1, pan=(-0.3, 0.3), seed=20, body=0.3), gain_db=-7),
    Cue(2.60, "shimmer", shimmer, dict(dur=1.0), gain_db=-12, hall=-8),
    Cue(3.00, "glass tink", glass_tink, dict(note="F6"), gain_db=-10, hall=-8, duck=True),
    Cue(3.40, "UI ticks", ui_ticks, gain_db=-11),
    Cue(5.60, "riser (into 6.00)", riser, dict(dur=0.40, f0=600, f1=9000, tone=("A4", "A5"), seed=56), gain_db=-5, ends_at=6.00),
    Cue(6.00, "drop accent: sub", sub_impact, dict(dur=1.4, f_hi=72, f_lo=40, tau=0.45, seed=61), gain_db=-8, bus="sfx_low"),
    Cue(6.00, "drop accent: air bloom", drop_air, gain_db=-17, big=-12),
    Cue(7.00, "decelerating ticks 7.00-8.80", counter_ticks, dict(span=1.80, count=20), gain_db=-10),
    Cue(7.30, "sub hit", sub_impact, dict(dur=1.2, f_hi=64, f_lo=40, tau=0.45, seed=73), gain_db=-5, bus="sfx_low"),
    Cue(8.80, "two-note lock chime", lock_chime, dict(notes=("A5", "D6")), gain_db=-10, hall=-8, duck=True),
    Cue(9.50, "swish", whoosh, dict(dur=0.55, f0=1500, fpk=6500, f1=3000, peak=0.30, q=1.6, pan=(-0.75, 0.75), seed=95), gain_db=-8),
    Cue(10.05, "ascending blips", blips, dict(notes=("G5", "A5", "Bb5", "D6", "F6", "G6", "A6", "Bb6"), step=0.06), gain_db=-9, hall=-14),
    Cue(10.85, "confirm chime", chime_arp, dict(notes=("D6", "A6"), step=0.07, seed=108), gain_db=-10, hall=-8, duck=True),
    Cue(11.55, "reverse suck (into 12.00)", reverse_suck, dict(dur=0.45, notes=("A4", "D5", "E5"), seed=115), gain_db=-6, ends_at=12.00),
    Cue(12.00, "paper unfold", paper_unfold, dict(dur=0.65), gain_db=-8),
    Cue(13.40, "bracket snaps", bracket_snaps, gain_db=-6),
    Cue(13.70, "scan beep", scan_beep, dict(note="A6"), gain_db=-16, hall=-12),
    Cue(14.30, '"verified" chime', verified_chime, gain_db=-10, hall=-6, big=-14, duck=True),
    Cue(15.50, "whip whoosh", whoosh, dict(dur=0.50, f0=350, fpk=3200, f1=600, peak=0.25, q=1.0, pan=(0.8, -0.8), seed=155, body=0.5), gain_db=-6),
    *[Cue(t, f"product tink {i + 1} ({note})", glass_tink, dict(note=note, seed=160 + i), gain_db=-12, pan=0.12 * (-1) ** i, hall=-8)
      for i, (t, note) in enumerate(PRODUCT_TINKS)],
    Cue(20.50, "bloom swell", bloom_swell, gain_db=-7, big=-8),
    *[Cue(t, f"tile pluck {i + 1} ({note})", glass_pluck, dict(f=hz(note), dur=2.2, decay=0.8, bright=1.1, seed=225 + i), gain_db=-10.5, pan=p, hall=-6)
      for i, (t, note, p) in enumerate(TILE_PLUCKS)],
    Cue(22.00, "break riser 22-26", break_riser, dict(dur=4.0), gain_db=-6, ends_at=26.00),
    Cue(25.50, "reverse suck (into 26.00)", reverse_suck, dict(dur=0.50, notes=("D5", "A5", "D6"), seed=255), gain_db=-7, ends_at=26.00),
    Cue(26.00, "final impact: sub drop + punch", impact_low, gain_db=-3, bus="sfx_low"),
    Cue(26.00, "final impact: noise burst", impact_burst, gain_db=-8, big=-5),
    Cue(26.00, "final impact: shimmer tail", shimmer_tail, gain_db=-11, hall=-8, big=-4),
]


# ═══════════════════════════════ mixer ═══════════════════════════════
# Bus faders (dB), applied in Mix.add so reverb sends are post-fader.
MIX_DB = {"pad": -2.0, "pluck": -13.5, "arp": -10.5, "arp_build": -8.0, "bass": -9.0, "sub": -15.0,
          "kick": -3.5, "hats": -8.0, "clap": -4.5}


class Mix:
    def __init__(self):
        self.buses: dict[str, np.ndarray] = {}

    def bus(self, name: str) -> np.ndarray:
        if name not in self.buses:
            self.buses[name] = np.zeros((2, N))
        return self.buses[name]

    def add(self, name: str, sig: np.ndarray, t: float, gain_db: float = 0.0, pan: float = 0.0,
            sends: dict[str, float | None] | None = None) -> None:
        st = to_stereo(np.asarray(sig, dtype=float), pan) * db(gain_db + MIX_DB.get(name, 0.0))
        self._acc(self.bus(name), st, S(t))
        for send, level in (sends or {}).items():
            if level is not None:
                self._acc(self.bus(send), st * db(level), S(t))

    @staticmethod
    def _acc(buf: np.ndarray, st: np.ndarray, i0: int) -> None:
        a, b = max(0, i0), min(N, i0 + st.shape[1])
        if b > a:
            buf[:, a:b] += st[:, a - i0:b - i0]


def place_cues(mix: Mix) -> None:
    for c in CUES:
        s = c.fn(**c.kw)
        if c.ends_at is not None:
            assert S(c.t) + s.shape[-1] == S(c.ends_at), f"{c.label} does not end on {c.ends_at}"
        mix.add(c.bus, s, c.t, c.gain_db, c.pan, {"hall_s": c.hall, "big": c.big})


# ═══════════════════════════════ music ═══════════════════════════════
KICK_TIMES = [6.0 + BEAT * k for k in range(32) if not 15.5 <= 6.0 + BEAT * k < 16.0]   # 15.5 left open for the whip
INTRO_STEPS, INTRO_IDX, INTRO_VEL = (0, 6, 12), (0, 4, 2), (1.0, 0.8, 0.85)
DROP_STEPS, DROP_IDX, DROP_VEL = (0, 3, 6, 8, 11, 14), (0, 2, 4, 3, 1, 2), (1.0, 0.7, 0.85, 0.9, 0.7, 0.8)
ARP_IDX = (0, 2, 4, 1, 3, 5, 2, 4) * 2                       # 3+3+2 groupings of 16ths
ARP_VEL = (1.0, 0.55, 0.7, 0.85, 0.55, 0.7, 0.8, 0.6) * 2


def build_pad(mix: Mix) -> None:
    """Supersaw pad, one chord per bar with overlapping releases; the final Dm9 blooms at 26 and decays to 30."""
    for bar in range(13):
        attack = 1.2 if bar == 0 else (0.5 if bar in (1, 2) else 0.25)
        dur, release = BAR, 0.9
        n = S(dur + release)
        x = sum(supersaw(hz(nt), n, seed=1000 + 17 * bar + i) for i, nt in enumerate(chord_at(bar)[1]))
        env = attack_env(n, attack)
        env[S(dur):] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(n - S(dur)) / (n - S(dur)))
        mix.add("pad", x * env * 0.3, bar * BAR)
    n = S(4.0)
    t = np.arange(n) / SR
    x = sum(supersaw(hz(nt), n, seed=1300 + i) for i, nt in enumerate(CHORDS["Dm9"][1]))
    env = attack_env(n, 0.12) * np.exp(-t / 1.7)
    mix.add("pad", fade_out(x * env * 0.3, 0.05), 26.0)


def build_plucks(mix: Mix) -> None:
    """Glass pluck motif: 3 notes per bar in the intro, a 3-3-2 syncopation in the drop."""
    k = 0
    for bar in range(8):
        pool = chord_at(bar)[2]
        steps, idx, vel = (INTRO_STEPS, INTRO_IDX, INTRO_VEL) if bar < 3 else (DROP_STEPS, DROP_IDX, DROP_VEL)
        for s, i, v in zip(steps, idx, vel):
            t = bar * BAR + s * STEP
            if 15.5 <= t < 16.0:
                continue
            mix.add("pluck", glass_pluck(hz(pool[i]), dur=1.6, decay=0.5, bright=0.9, seed=2000 + k), t,
                    gain_db=20 * np.log10(v), pan=0.2 * (-1) ** k, sends={"hall_m": -6})
            k += 1


def build_arp(mix: Mix) -> None:
    """16th glass arpeggio of chord tones for bars 8-10 (16 to 22 s). In bar 12 (24 to 25.5 s) it
    comes back filtered as part of the build."""
    k = 0
    for bar, bus, last_step in ((8, "arp", 16), (9, "arp", 16), (10, "arp", 16), (12, "arp_build", 12)):
        notes = chord_at(bar)[3]
        for s in range(last_step):
            mix.add(bus, glass_pluck(hz(notes[ARP_IDX[s]]), dur=0.6, decay=0.16, bright=0.8, seed=3000 + k),
                    bar * BAR + s * STEP, gain_db=20 * np.log10(ARP_VEL[s]), pan=0.3 * (-1) ** s, sends={"hall_m": -14})
            k += 1


def build_bass(mix: Mix) -> None:
    """Offbeat 8th bass on the chord root (octave jump on the third offbeat), bars 8-10."""
    for bar in (8, 9, 10):
        root = hz(chord_at(bar)[0])
        for beat in range(4):
            mix.add("bass", bass_note(root * (2 if beat == 2 else 1)), bar * BAR + beat * BEAT + BEAT / 2)


def build_sub(mix: Mix) -> None:
    """Sustained sub on the chord root under intro, drop and break (the 16-22 bass line replaces it)."""
    for bar in list(range(8)) + [11, 12]:
        mix.add("sub", sub_tone(hz(chord_at(bar)[0]), BAR), bar * BAR - 0.125)
    mix.add("sub", fade_out(sub_tone(hz("D2"), 3.6, xfade=0.4), 1.5), 26.25)


def build_drums(mix: Mix) -> None:
    k = kick()
    for t in KICK_TIMES:
        mix.add("kick", k, t)
    r = rng(4000)
    i = 0
    beat_t = 6.0
    while beat_t < 22.0 - 1e-9:
        if not 15.5 <= beat_t < 16.0:
            if beat_t < 16.0:                         # drop: 8ths, offbeat accented
                hits = ((0.0, 0.4), (0.25, 1.0))
            else:                                     # full: 16ths
                hits = ((0.0, 0.35), (0.125, 0.25), (0.25, 1.0), (0.375, 0.3))
            for off, vel in hits:
                v = vel * (1 + 0.06 * r.uniform(-1, 1))
                mix.add("hats", hat(5000 + i, decay=0.03 if off == 0.25 else 0.022), beat_t + off,
                        gain_db=20 * np.log10(v), pan=0.15 if off in (0.0, 0.25) else -0.15)
                i += 1
        beat_t += BEAT
    for j, t in enumerate(np.arange(16.5, 22.0, 1.0)):          # 2 and 4 of each bar
        mix.add("clap", clap(6000 + j), float(t), sends={"hall_m": -12})


# ═══════════════════════════════ processing ═══════════════════════════════
def sidechain(times, depth: float, release: float = 0.26, attack: float = 0.003) -> np.ndarray:
    """Kick-keyed ducking gain: 3 ms dip before each kick, quadratic recovery."""
    g = np.ones(N)
    na, nr = S(attack), S(release)
    dip = 1.0 - depth * (0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na))
    rec = 1.0 - depth * (1.0 - np.arange(nr) / nr) ** 2
    for tk in times:
        i = S(tk)
        g[i - na:i] = np.minimum(g[i - na:i], dip)
        j = min(N, i + nr)
        g[i:j] = np.minimum(g[i:j], rec[:j - i])
    return g


def priority_duck(times, depth: float = 0.35, pre: float = 0.015, hold: float = 0.15, release: float = 0.45):
    """Look-ahead dip of the melodic music under key chimes so they speak without being pushed louder."""
    g = np.ones(N)
    k_pre, k_hold, k_rel = S(pre), S(hold), S(release)
    shape = np.concatenate([1 - depth * (0.5 - 0.5 * np.cos(np.pi * np.arange(k_pre) / k_pre)),
                            np.full(k_hold, 1 - depth),
                            1 - depth * (0.5 + 0.5 * np.cos(np.pi * np.arange(k_rel) / k_rel))])
    for t in times:
        i = S(t) - k_pre
        a, b = max(0, i), min(N, i + shape.size)
        g[a:b] = np.minimum(g[a:b], shape[a - i:b - i])
    return g


def intro_lowpass(x: np.ndarray, q: float = 0.9) -> np.ndarray:
    """0-6 s: low-pass opening from 300 Hz to ~16 kHz (slow start, fast finish); fully open from 6.00."""
    n6 = S(6.0)
    u = np.arange(n6) / n6
    y = x.copy()
    y[:, :n6] = sweep_filter(x[:, :n6], 300 * (16000 / 300) ** (u ** 1.6), q=q)
    k = S(0.01)                                   # 10 ms splice back to the unfiltered signal
    w = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    y[:, n6 - k:n6] = y[:, n6 - k:n6] * (1 - w) + x[:, n6 - k:n6] * w
    return y


def process(mix: Mix) -> dict[str, np.ndarray]:
    """Bus processing: filters, automation, ducking, reverbs. Returns the stems that sum to the master."""
    b = mix.bus
    duck = {d: sidechain(KICK_TIMES, d) for d in (0.25, 0.3, 0.5, 0.85)}
    clear = priority_duck([c.t for c in CUES if c.duck])

    pad_fc = automation([(0.0, 300), (6.0, 300)], curve="exp")
    n6 = S(6.0)
    pad_fc[:n6] = np.minimum(300 * (16000 / 300) ** ((np.arange(n6) / n6) ** 1.6), 9000)
    pad_fc[n6:] = automation([(6.0, 4200), (16.0, 4200), (16.0, 5200), (22.0, 5200), (22.0, 1400),
                              (25.95, 8000), (26.0, 6500), (30.0, 700)], curve="exp")[n6:]
    pad = hp(sweep_filter(b("pad"), pad_fc, q=1.15), 140)
    pad *= automation([(0, 0.8), (6.0, 0.8), (6.0, 0.78), (16.0, 0.78), (16.0, 0.7), (22.0, 0.7),
                       (22.0, 0.8), (25.95, 1.15), (26.0, 1.0), (30.0, 1.0)]) * duck[0.5]

    pad_verb = reverb(pad, HALL_IR, hp_hz=250, lp_hz=8000) * db(-14)

    pluck = hp(b("pluck") + db(-11) * pingpong(b("pluck")), 180)
    pluck = intro_lowpass(pluck) * clear

    arp = hp(b("arp") + db(-14) * pingpong(b("arp")), 250) * duck[0.3] * clear
    build = b("arp_build") + db(-12) * pingpong(b("arp_build"))
    build = hp(sweep_filter(build, automation([(24.0, 700), (25.5, 5000), (30.0, 5000)], curve="exp"), q=1.4), 250)
    build *= automation([(24.0, 0.6), (25.5, 1.0), (30.0, 1.0)])

    bass = b("bass")
    sub = intro_lowpass(b("sub")) * automation([(0.0, 0.0), (0.8, 0.0), (3.0, 0.55), (6.0, 0.55), (6.0, 0.85),
                                                (22.0, 0.85), (22.0, 0.6), (26.0, 0.9), (30.0, 0.9)]) * duck[0.85]

    hall_m = intro_lowpass(reverb(b("hall_m"), HALL_IR)) * duck[0.25] * clear
    hall_s = reverb(b("hall_s"), HALL_IR)
    big = reverb(b("big"), BIG_IR, hp_hz=150)

    return {
        "pad": pad, "pad_verb": pad_verb, "pluck": pluck, "arp": arp, "arp_build": build, "bass": bass, "sub": sub,
        "kick": b("kick"), "hats": hp(b("hats"), 5000), "clap": b("clap"),
        "hall_m": hall_m, "sfx": hp(b("sfx"), 120), "sfx_low": b("sfx_low"), "hall_s": hall_s, "big": big,
    }


# ═══════════════════════════════ mastering ═══════════════════════════════
# ITU-R BS.1770-4 K-weighting at 48 kHz
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def block_loudness(x: np.ndarray, block: float = 0.4, hop: float = 0.1) -> np.ndarray:
    y = signal.lfilter(*_K2, signal.lfilter(*_K1, x, axis=-1), axis=-1)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(y ** 2, axis=-1)], axis=-1)
    blk = S(block)
    starts = np.arange(0, x.shape[-1] - blk + 1, S(hop))
    z = ((cs[:, starts + blk] - cs[:, starts]) / blk).sum(axis=0)
    return z


def lufs_integrated(x: np.ndarray) -> float:
    """BS.1770-4 integrated loudness (400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU relative gates)."""
    z = block_loudness(x)
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-20))
    g1 = lk > -70
    if not g1.any():
        return -np.inf
    rel = -0.691 + 10 * np.log10(z[g1].mean()) - 10
    g2 = g1 & (lk > rel)
    return float(-0.691 + 10 * np.log10(z[g2].mean()))


def true_peak_db(x: np.ndarray, os: int = 4) -> float:
    return float(20 * np.log10(np.max(np.abs(signal.resample_poly(x, os, 1, axis=-1)))))


def true_peak_limiter(x: np.ndarray, ceiling_db: float, lookahead: float = 0.0015,
                      release_db_s: float = 30.0, os: int = 4):
    """Look-ahead limiter keyed from the 4x oversampled signal (true-peak detection), stereo-linked.
    Gain reduction in dB is spread by a centred max filter of +/- lookahead (so it starts before the
    peak), released at `release_db_s`, then smoothed by two box filters that together stay inside
    +/- lookahead. The applied reduction is therefore never less than what any nearby peak needs."""
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
    """Normalise to -14 LUFS integrated with the true-peak limiter in the loop (iterated to within 0.01 LU)."""
    x = hp(x, 24)
    x = fade_out(x, 0.05)                         # last 50 ms taper
    gain = TARGET_LUFS - lufs_integrated(x)
    for _ in range(12):
        y, gr = true_peak_limiter(x * db(gain), CEILING_DBTP)
        err = TARGET_LUFS - lufs_integrated(y)
        if abs(err) < 0.01:
            break
        gain += err
    return y, gain, gr


def write_wav24(path: Path, x: np.ndarray, seed: int = 24) -> None:
    """24-bit PCM with TPDF dither (deterministic)."""
    r = rng(seed)
    full = 2 ** 23 - 1
    d = (r.random(x.shape) - r.random(x.shape))
    q = np.clip(np.round(x * full + d), -full - 1, full).astype("<i4")
    raw = q.T.reshape(-1, 1).view(np.uint8)[:, :3].tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


def stem_report(stems: dict[str, np.ndarray], master_gain_db: float) -> None:
    print("\nstem loudness after master gain (LUFS integrated over the stem's active blocks; peak dBFS):")
    for name, s in stems.items():
        s = s * db(master_gain_db)
        pk = 20 * np.log10(max(np.max(np.abs(s)), 1e-12))
        print(f"  {name:10s} {lufs_integrated(s):7.1f} LUFS   peak {pk:6.1f}")


# ═══════════════════════════════ main ═══════════════════════════════
def main() -> None:
    mix = Mix()
    build_pad(mix)
    build_plucks(mix)
    build_arp(mix)
    build_bass(mix)
    build_sub(mix)
    build_drums(mix)
    place_cues(mix)
    stems = process(mix)
    mixed = sum(stems.values())
    out, gain, gr = master(mixed)
    assert out.shape == (2, N)
    write_wav24(OUT_PATH, out)

    print(f"wrote {OUT_PATH}  ({N} frames, {N / SR:.3f} s, 48 kHz, stereo, 24-bit)")
    print(f"integrated {lufs_integrated(out):.2f} LUFS | true peak (4x) {true_peak_db(out):.2f} dBTP | "
          f"master gain {gain:+.2f} dB | limiter max GR {gr.max():.2f} dB, "
          f">0.5 dB on {100 * np.mean(gr > 0.5):.1f}% of samples")
    print("cues:")
    for c in CUES:
        print(f"  {c.t:6.2f}s  sample {S(c.t):8d}  {c.label}")
    if "--stems" in sys.argv:
        stem_report(stems, gain)


if __name__ == "__main__":
    main()
