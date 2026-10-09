#!/usr/bin/env python3
"""PurePeptide "A LINE OF LIGHT" 45 s (EN): the soundtrack (BRIEF §6 music + §7 SFX + mix targets).

    python3 tools/mix_audio.py              # measures the music, writes js/cues.js (unless frozen), writes assets/audio/mix.wav
    python3 tools/mix_audio.py --report     # same, plus the QC tables (loudness, true peak, LRA, momentary max at DROP/LOGO,
                                            # VO-over-bed guard per word, SFX event list, whoosh-vs-pose_speed check,
                                            # sub-spacing rule, RMS every 0.5 s, silence windows)
    --no-cues                               # never rewrite js/cues.js (after the lead froze it)
    --stems                                 # also write assets/audio/mix_music.wav / mix_vo.wav / mix_sfx.wav (post-master stems)

Output: 48 kHz, stereo, 24-bit PCM, exactly 45.000 s (2,160,000 frames), -14.0 LUFS integrated, true peak <= -1.5 dBTP
(4x oversampled), digital zero in the OPEN (0-1.0), STOP (39.6-40.2) and END (44.5-45.0) windows. float64 + fixed seeds:
a re-run is bit-identical. No network.

Timing sources (never hard-coded word times)
    js/vo.js             word onsets; VOw(id, i | "prefix") mirrors VO.w() / PP.word() in js/lib.js (same aliases, clamp + snap)
    js/cues.js           HIT1 / DROP / STOP / LOGO / BEAT: the picture-locked points; BEAT from the measured tempo
    F(n)                 picture frames from BRIEF §7 (n / 30); shot windows = PP.WIN (SHOTS §1) for the clamp
    renders/3d/take/pose_speed.json + arr_glint.json   the fastest frame of every 3D move (whoosh peaks, +/- 1 f rule)
    assets/fx/frost/frost_density.json                 new frost pixels per frame (crackle density + pan)

Music (assets/audio/music_raw.mp3, ElevenLabs, see assets/audio/MUSIC.md): measured here (tempo by spectral-flux
autocorrelation + comb, beat phase, key by log chroma, sub-bass note per beat, 0.5 s RMS arc). The file is flat (no
drop, no silence, no hit), so the arc is built: the source beat where the sub-bass enters D nearest S 24.0 is pulled onto
T 24.60 (EDIT segment 1), the STOP window is gated, and the track's own fade-out (from its last downbeat before the fade)
is placed at T 40.20 as the tail under the LOGO hit. Fader ride + HP ride (the sub arrives on the DROP) + LP ride
18 kHz -> 900 Hz over T 34-39.6 (thins to pad), then the voice pocket, the zone ducking (-6 / -8 / -11 dB) and the
per-word guard (>= 9 dB). If a future file carries a real drop / silence / hit (RMS step >= 3 dB, window < -40 dB),
`measure_music()` reports them and the EDIT pulls those instead ("arc" mode).

Signal flow
    VO     assets/audio/vo/L*.wav at lines.tsv `at` -> HPF 90 -> +1.5 dB @ 4 kHz -> 2:1 soft knee -> de-esser -3 dB 6-8 kHz
           -> +3 dB makeup on the whispered "Minimum." -> -15 LUFS.
    Music  EDIT segments (equal-power joins) -> fader ride -> HP / LP rides -> voice pocket -> zone duck -> word guard.
    SFX    synthesized (tools/audiolib.py, seeded) + sfx_whoosh.mp3; room / hall / big sends; bus ducked -4 dB under speech;
           one primary sound per frame; every pitched element on D / A (E, G passing).
    Master HPF 24 Hz -> glue 1.5:1 -> gain + true-peak limiter iterated to -14.0 LUFS -> silence gates -> 24-bit TPDF dither.
"""
from __future__ import annotations

import json
import re
import sys
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audiolib as A  # noqa: E402

SR = A.SR
N = 45 * SR
A.N, A.NC, A.DURATION = N, N // A.CTRL, N / SR
S, db = A.S, A.db
ROOT = Path(__file__).resolve().parents[1]
AUD = ROOT / "assets" / "audio"
OUT_PATH = AUD / "mix.wav"
FPS = 30
MUSIC_SRC = AUD / "music_raw.mp3"
TRACK_A = [Path("/home/user/DevDoctor/ads/purepeptide-motion-en/assets/audio/music_raw.mp3"),
           Path("/home/user/DevDoctor/ads/purepeptide-film-en/assets/audio/music_raw.mp3")]      # the previous ad's bed, 120 BPM, D
# BRIEF §6 fallback edit (Track A, exact 45 s): hits T1 / T9 / T13, swell tail into the DROP at T 24.6, stop S 59.5-60 -> T 39.9-40.4
# (gated at 39.6), final hit on the LOGO, 44.5-45.0 digital silence
EDIT_A = [(8.0, 28.0, 1.0), (40.6, 60.0, 21.0), (84.0, 86.5, 40.2)]
SEG_FADES_A = [(0.0, 0.0), (0.5, 0.03), (0.003, 0.0)]
CUES_JS = ROOT / "js" / "cues.js"
WIN = {"S01": (0, 126), "S02": (126, 216), "S03": (216, 306), "S04": (306, 396), "S05": (396, 546), "S06": (546, 636),
       "S07": (636, 738), "S08": (738, 822), "S09": (822, 936), "S10": (936, 1044), "S11": (1044, 1152), "S12": (1152, 1206),
       "S13": (1206, 1350)}
TARGETS = {"DROP": 24.6, "STOP": 39.6, "LOGO": 40.2, "HIT1": 1.0}      # picture-locked (BRIEF §6): never move
WARNINGS: list[str] = []


# ═══════════════════════════════ timing sources ═══════════════════════════════
def F(n: float) -> float:
    return n / FPS


def _load_vo() -> dict:
    txt = (ROOT / "js" / "vo.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.VO\s*=\s*(\{.*?\n\});", txt, re.S).group(1))


VO = _load_vo()
_ALIAS = {"ninety": "99", "ninety-nine": "99", "percent": "%", "twenty": "24", "twenty-four": "24", "janoshik": "janosik",
          "dot": ".care", "care": ".care"}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9$%]+$", "", re.sub(r"^[^a-z0-9$%.]+", "", str(s).lower()))


def VOw(lid: str, i) -> float:
    """VO.w(): onset of word i, or of the first word starting with a prefix (same aliases as js/lib.js)."""
    words = VO[lid]["words"]
    if isinstance(i, int):
        return float(words[i][0])
    q = _norm(i)
    for p in (q, _norm(_ALIAS.get(q, "\0"))):
        for t, w in words:
            if _norm(w).startswith(p):
                return float(t)
    print(f"  WARN VOw({lid!r}, {i!r}): no such word, using line start", file=sys.stderr)
    return float(VO[lid]["at"])


def SNAP(t: float) -> float:
    return float(np.floor(t * FPS + 0.5)) / FPS           # = Math.round (JS)


def clamp(t: float, lo: float, hi: float, label: str) -> float:
    c = min(hi, max(lo, t))
    if abs(c - t) > 1e-6:
        WARNINGS.append(f"clamp {label}: {t:.3f} s -> {c:.3f} s (f{t * FPS:.1f} -> f{c * FPS:.1f})")
    return c


def WORD(shot: str, lid: str, i) -> float:
    """PP.word(shot, line, i): VO.w clamped into the shot window, frame-snapped."""
    a, b = WIN[shot]
    return clamp(SNAP(VOw(lid, i)), F(a), F(b - 1), f"{shot} {lid}[{i}]")


def _speed_json() -> dict:
    for p in (ROOT / "renders" / "3d" / "take" / "pose_speed.json", ROOT / "renders" / "3d" / "take_prev" / "pose_speed.json"):
        if p.exists():
            d = json.loads(p.read_text())
            return {int(k): v for k, v in d.get("frames", d).items()}
    return {}


SPEED = _speed_json()
MOVES = {"ARR": (708, 738, 712), "DIVE": (822, 868, 843), "TILT": (936, 966, 949), "ORBIT": (1050, 1116, 1078),
         "EXIT": (1152, 1188, 1170)}                       # (f0, f1, BRIEF's "≈" fallback)


def fastest(move: str) -> tuple[int, str]:
    """The fastest frame of a 3D move (common.py weighting deg/s + 100 m/s), or the BRIEF's estimate."""
    f0, f1, est = MOVES[move]
    if move == "ARR":
        p = ROOT / "renders" / "3d" / "take" / "arr_glint.json"
        if p.exists():
            return int(json.loads(p.read_text())["glint_frame"]), "arr_glint.json"
    fr = [f for f in range(f0, f1 + 1) if f in SPEED]
    if fr:
        return max(fr, key=lambda f: SPEED[f]["deg_s"] + 100 * SPEED[f]["m_s"]), "pose_speed.json"
    return est, "BRIEF estimate"


def ghost_exit() -> int:
    """S02: the frame the 3D ghost leaves the glass (measured on s02.webm, js/shots/S02.js GHOST_EXIT); VO 'prove.' if absent."""
    m = re.search(r"GHOST_EXIT\s*=\s*(\d+)", (ROOT / "js" / "shots" / "S02.js").read_text(encoding="utf-8"))
    return int(m.group(1)) if m else int(round(SNAP(VOw("L02", "prove")) * FPS))


def frost_density() -> tuple[np.ndarray, list, int, str]:
    p = ROOT / "assets" / "fx" / "frost" / "frost_density.json"
    if p.exists():
        d = json.loads(p.read_text())
        rows = d["density"]
        return np.array([max(0.0, r["new_px"]) for r in rows]), [r.get("centroid") for r in rows], int(d["f0"]), str(p.relative_to(ROOT))
    n = 60                                                   # fallback: the growth curve of SHOTS S07 (closes on f686)
    k = np.arange(n)
    c = np.where(k < 9, 0.12 * ((k + 1) / 9) ** 1.3, np.where(k < 39, 0.2 + 0.8 * ((k - 9) / 29) ** 1.25, 1.0))
    return np.diff(np.concatenate([[0], c])) * 2e6, [None] * n, 648, "fallback curve (frost_density.json not found)"


# ═══════════════════════════════ music: measure ═══════════════════════════════
def measure_music(src: np.ndarray) -> dict:
    """Tempo (spectral-flux autocorrelation + 4-harmonic comb, 60-200 BPM), beat phase, key (log chroma 80-3 kHz vs
    Krumhansl profiles), sub-bass note per beat, 0.5 s RMS arc -> drop / stop / hit candidates."""
    m = src.mean(axis=0)
    body = m[:int(min(38.0, src.shape[1] / SR - 1) * SR)]
    f, _t, Z = signal.stft(body, SR, nperseg=2048, noverlap=2048 - 480)
    M = np.log1p(np.abs(Z) * 50)
    flux = np.maximum(np.diff(M, axis=1), 0).sum(axis=0)
    flux = np.maximum(flux - signal.medfilt(flux, 101), 0)
    ac = np.correlate(flux, flux, "full")[flux.size - 1:]
    ac /= max(ac[0], 1e-12)
    best = max(((sum(ac[int(round(k * 60 / bpm / 0.01))] for k in (1, 2, 3, 4)) / 4, bpm) for bpm in np.arange(60, 200.5, 0.5)))
    bpm = float(best[1])
    P = 60.0 / bpm
    tt = np.arange(flux.size) * 0.01
    bins = np.linspace(0, P, 41)
    h = np.array([flux[((tt % P) >= bins[i]) & ((tt % P) < bins[i + 1])].sum() for i in range(40)])
    phase = float(bins[int(np.argmax(h))] + P / 80)          # the beat grid: phase + k P
    # key
    f2, _t2, Z2 = signal.stft(body, SR, nperseg=8192, noverlap=4096)
    L = np.log1p(np.abs(Z2) * 200)
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    ch = np.zeros(12)
    for i, fr in enumerate(f2):
        if 80 < fr < 3000:
            ch[(int(round(12 * np.log2(fr / 440))) + 9) % 12] += L[i].sum()
    ch = (ch - ch.min()) / max(1e-9, ch.max() - ch.min())
    maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    keys = sorted(((float(np.corrcoef(np.roll(pr, k), ch)[0, 1]), names[k] + " " + nm) for k in range(12)
                   for nm, pr in (("maj", maj), ("min", mnr))), reverse=True)
    # sub-bass note per beat
    sub = A.bp(m, 28, 140, 4)
    beats = [phase + k * P for k in range(int((m.size / SR - phase) / P))]
    sub_notes = []
    for b in beats:
        seg = sub[S(b):S(b + P)]
        if seg.size < 100:
            break
        sp = np.abs(np.fft.rfft(seg * np.hanning(seg.size), 8 * SR))
        fr = np.fft.rfftfreq(8 * SR, 1 / SR)
        sel = (fr > 30) & (fr < 130)
        fpk = fr[sel][int(np.argmax(sp[sel]))]
        sub_notes.append(names[int(round(69 + 12 * np.log2(fpk / 440))) % 12])
    # RMS arc
    rms = np.array([10 * np.log10(np.mean(m[i:i + SR // 2] ** 2) + 1e-20) for i in range(0, m.size - SR // 2, SR // 2)])
    steps = np.diff(rms)
    drop_c = [(0.5 * (i + 1), float(steps[i])) for i in np.argsort(steps)[::-1][:3]]
    stop_c = [(0.5 * i, float(rms[i])) for i in range(len(rms)) if rms[i] < -40 and 10 < 0.5 * i < 38]
    root = keys[0][1].split()[0]
    return {"bpm": bpm, "beat": P, "phase": phase, "key": keys[0][1], "key_score": round(keys[0][0], 3), "root": root,
            "chroma": {n: round(float(v), 2) for n, v in zip(names, ch)}, "sub_notes": sub_notes, "beats": beats,
            "rms": rms, "drop_candidates": drop_c, "stop_candidates": stop_c[:3],
            "flat": max(s for _, s in drop_c) < 3.0 and not stop_c,
            "fade_start": next((0.5 * i for i in range(len(rms)) if 0.5 * i > 20 and rms[i] < rms[:40].mean() - 6), None)}


def plan_edit(meas: dict) -> tuple[list, list, dict]:
    """EDIT = [(src_start, src_end, dst_start)], SEG_FADES = [(in, out)], cues. Flat file (this one): the beat where the
    sub-bass enters the root nearest S 24.0 -> T DROP; the body runs to the STOP gate; the last downbeat before the
    fade -> T LOGO as the tail. Arc file: the measured drop / stop / hit beats are pulled onto the targets."""
    P, beats, notes, root = meas["beat"], meas["beats"], meas["sub_notes"], meas["root"]
    if meas["flat"]:
        cands = [b for k, b in enumerate(beats[1:len(notes)], 1) if notes[k] == root and notes[k - 1] != root and abs(b - 24.0) < 2.5]
        s_drop = min(cands, key=lambda b: abs(b - 24.0)) if cands else min(beats, key=lambda b: abs(b - 24.0))
        how = "sub-bass enters the root" if cands else "nearest beat to S 24.0"
    else:
        t_drop = meas["drop_candidates"][0][0]
        s_drop = min(beats, key=lambda b: abs(b - t_drop))
        how = f"measured drop at S {t_drop:.1f}"
    d = TARGETS["DROP"] - s_drop
    fade = meas["fade_start"] or 38.5
    s_tail = max(b for b in beats if b <= fade)              # last downbeat-ish beat before the fade
    seg1 = (max(0.0, -d), TARGETS["STOP"] - d, max(0.0, d))
    seg2 = (s_tail, min(s_tail + 4.8, meas["rms"].size * 0.5), TARGETS["LOGO"])
    edit = [seg1, seg2]
    fades = [(0.0, 0.0), (0.003, 0.0)]
    cues = {"HIT1": TARGETS["HIT1"], "DROP": TARGETS["DROP"], "STOP": TARGETS["STOP"], "LOGO": TARGETS["LOGO"],
            "BEAT": round(P, 4), "BPM": round(meas["bpm"], 1)}
    info = {"src_drop_beat": s_drop, "offset": d, "how": how, "src_tail_beat": s_tail, "fade_start": fade}
    return edit, fades, cues, info


def write_cues(cues: dict, meas: dict, info: dict, allow: bool) -> str:
    body = ", ".join(f"{k}: {v}" for k, v in cues.items())
    txt = (f"// Music cues: HIT1 / DROP / STOP / LOGO are picture-locked (BRIEF §6), BEAT = the measured tempo "
           f"({meas['bpm']:.1f} BPM, key {meas['key']}, grid anchored on the DROP: beats at DROP + k * BEAT).\n"
           f"// Written by tools/mix_audio.py from the measured music (source beat S {info['src_drop_beat']:.3f} -> T "
           f"{TARGETS['DROP']:.2f}, {info['how']}). FROZEN once the lead says so (run the mixer with --no-cues).\n"
           f"window.CUES = Object.freeze({{ {body} }});\n")
    if allow and (not CUES_JS.exists() or CUES_JS.read_text() != txt):
        CUES_JS.write_text(txt)
        return "written"
    return "kept"


def _load_cues() -> dict:
    txt = CUES_JS.read_text(encoding="utf-8")
    body = re.search(r"freeze\(\s*(\{.*?\})\s*\)", txt, re.S).group(1)
    return {k: float(v) for k, v in re.findall(r"(\w+)\s*:\s*([-\d.]+)", body)}


# ═══════════════════════════════ music: build ═══════════════════════════════
# fader ride (T s, dB) before ducking: MUSIC.md. The OPEN window is gated; the music enters on HIT1 at -16.
FADER = [(0.0, -21.0), (1.0, -21.0), (9.0, -15.0), (21.0, -10.0), (24.0, -6.0), (24.6, -4.0), (24.6 + 2 / 30, 0.0),
         (36.0, 0.0), (39.0, -6.0), (39.6, -8.0), (40.2, -2.0), (45.0, -2.0)]
FADER_A = [(0.0, -3.0), (34.0, -3.0), (39.6, -9.0), (40.2, -3.0), (45.0, -3.0)]      # Track A: -3 bed, -6 dB ride into the sign-off
HP_RIDE = [(0.0, 220.0), (9.0, 200.0), (21.0, 160.0), (24.2, 80.0), (24.6, 60.0), (24.6 + 2 / 30, 24.0), (45.0, 24.0)]
LP_RIDE = [(0.0, 18000.0), (34.0, 18000.0), (39.6, 900.0), (40.2, 18000.0), (45.0, 18000.0)]
DUCK_ZONES = [(0.0, 24.6, -6.0), (24.6, 36.0, -8.0), (36.0, 45.0, -11.0)]
POCKET_DB, POCKET_HZ, POCKET_Q = -2.5, 2800.0, 0.9
GUARD_DB, GUARD_MAX_DB = 9.0, -15.0
GUARD_EXTRA: dict = {}                                       # (line, onset) -> extra dB the guard aims for (set by main's final-margin loop)
VO_BUS_DB = 0.0


def _ride(points, log=False) -> np.ndarray:
    t_c = (np.arange(A.NC) + 0.5) / 1000.0
    xs, ys = zip(*points)
    ys = np.log(ys) if log else np.array(ys, float)
    v = np.interp(t_c, xs, ys)
    return np.exp(v) if log else v


def word_windows():
    for lid, ln in VO.items():
        ws = ln["words"]
        for k, (t0, w) in enumerate(ws):
            yield lid, w, float(t0), float(ws[k + 1][0] if k + 1 < len(ws) else ln["end"])


def kblocks(x: np.ndarray) -> np.ndarray:
    y = A.kweight(np.atleast_2d(x))
    return (y ** 2).sum(axis=0)[:A.NC * A.CTRL].reshape(A.NC, A.CTRL).mean(axis=1)


def voiced_mask(pv: np.ndarray, vo_lufs: float) -> np.ndarray:
    return A.lufs(np.convolve(pv, np.ones(10) / 10, mode="same")) > vo_lufs - 20.0


def word_margin(pv, pm, act, t0, t1) -> float:
    i, j = int(t0 * 1000), int(t1 * 1000)
    m = act[i:j]
    return float(A.lufs(pv[i:j][m].mean()) - A.lufs(pm[i:j][m].mean())) if m.any() else np.inf


def guard_curve(vo: np.ndarray, music: np.ndarray) -> np.ndarray:
    """Extra music gain (dB, <= 0) on the words whose VO-over-bed margin is under GUARD_DB (PREV recipe)."""
    from scipy.ndimage import minimum_filter1d
    vst = np.vstack([vo, vo])
    pv, pm0 = kblocks(vst), kblocks(music)
    act = voiced_mask(pv, A.lufs_integrated(vst))
    guard = np.zeros(A.NC)
    w = np.hanning(63)[1:-1]
    for _ in range(12):
        pm = pm0 * 10 ** (guard / 10)
        need = guard.copy()
        for _lid, _w, t0, t1 in word_windows():
            d = word_margin(pv, pm, act, t0, t1) - GUARD_DB - GUARD_EXTRA.get((_lid, t0), 0.0)
            if d < 0:
                i, j = max(0, int(t0 * 1000) - 40), min(A.NC, int(t1 * 1000) + 40)
                need[i:j] = np.minimum(need[i:j], np.maximum(GUARD_MAX_DB, guard[i:j].min() + d - 0.3))
        if np.array_equal(need, guard):
            break
        guard = np.convolve(minimum_filter1d(need, 81, mode="nearest"), w / w.sum(), mode="same")
    return np.minimum(guard, 0.0)


def final_margins(vo_s: np.ndarray, mu_s: np.ndarray) -> dict:
    """VO-over-music margin per word on the MASTERED stems, measured exactly as print_report does. The master's
    true-peak limiter (fast, keyed by the VO's peaks) modulates the music's low end into the K-weighted band and costs a
    short word up to ~1.5 dB of the margin the pre-master guard built, so main() re-aims the guard on these numbers."""
    pv, pm = (np.square(A.kweight(x)).sum(axis=0)[:A.NC * A.CTRL].reshape(A.NC, A.CTRL).mean(axis=1) for x in (vo_s, mu_s))
    act = 10 * np.log10(np.maximum(np.convolve(pv, np.ones(10) / 10, mode="same"), 1e-20)) > A.lufs_integrated(vo_s) - 20.0
    return {(lid, t0): word_margin(pv, pm, act, t0, t1) for lid, _w, t0, t1 in word_windows()}


def build_music(src: np.ndarray, edit: list, fades: list, key: np.ndarray, rep: dict, vo: np.ndarray,
                track_a: bool = False) -> np.ndarray:
    out = np.zeros((2, N))
    for (s0, s1, d), (fi, fo) in zip(edit, fades):
        seg = src[:, S(s0):min(S(s1), src.shape[1])].copy()
        n = seg.shape[1]
        if fi:
            k = S(fi)
            seg[:, :k] *= np.sin(0.5 * np.pi * np.arange(k) / k) if fi >= 0.5 else np.linspace(0, 1, k)
        if fo:
            k = S(fo)
            seg[:, n - k:] *= np.cos(0.5 * np.pi * np.arange(1, k + 1) / k) if fo >= 0.5 else np.linspace(1, 0, k)
        i = S(d)
        j = min(N, i + n)
        out[:, i:j] += seg[:, :j - i]
    # entry: digital zero before HIT1, 20 ms raised-cosine in at HIT1 (the OPEN gate is hard on the master too)
    i0 = S(TARGETS["HIT1"])
    out[:, :i0] = 0.0
    out[:, i0:i0 + S(0.02)] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(S(0.02)) / S(0.02))
    out = out * db(A.ctrl_to_audio(_ride(FADER_A if track_a else FADER)))
    out = A.sweep_filter(out, A.ctrl_to_audio(_ride(HP_RIDE, log=True)), q=0.707, kind="hp")
    out = A.sweep_filter(out, A.ctrl_to_audio(_ride(LP_RIDE, log=True)), q=0.707, kind="lp")
    t_c = (np.arange(A.NC) + 0.5) / 1000.0
    depth = np.zeros(A.NC)
    for a, b, g in DUCK_ZONES:
        depth[(t_c >= a) & (t_c < b)] = g
    duck = A.duck_curve(key, depth)
    amt = A.ctrl_to_audio(np.clip(duck / -6.0, 0.0, 1.0))
    pocket = A.peaking(out, POCKET_HZ, POCKET_DB, POCKET_Q)
    out = out + amt * (pocket - out)
    out = out * db(A.ctrl_to_audio(duck))
    guard = guard_curve(vo, out)
    out = out * db(A.ctrl_to_audio(guard))
    rep["music_duck"], rep["music_guard"] = duck, guard
    return out


# ═══════════════════════════════ voice-over ═══════════════════════════════
def build_vo(rep: dict) -> np.ndarray:
    track = np.zeros(N)
    last, rows = 0, []
    for ln in open(AUD / "vo" / "lines.tsv", encoding="utf-8"):
        lid, at, _src, text = ln.rstrip("\n").split("\t")
        x, sr = A.decode(AUD / "vo" / f"{lid}.wav", 1)
        x = A.fade_out(A.to_48k(x, sr)[0].copy(), 0.01)
        i = S(float(at))
        assert i >= last, f"{lid} overlaps the previous line"
        assert i + x.size <= N, f"{lid} runs past 45 s"
        track[i:i + x.size] += x
        last = i + x.size
        rows.append((lid, float(at), last / SR, text))
    track = A.peaking(A.hp(track, 90.0), 4000.0, 1.5, 0.7)
    track, gr = A.vo_compressor(track)
    track = A.de_esser(track)
    # +3 dB makeup on the whispered "Minimum." (L05 word 2 -> line end), 20 ms ramps
    g = np.zeros(A.NC)
    i, j = int(VOw("L05", "minimum") * 1000), int(VO["L05"]["end"] * 1000) + 60
    g[i:j] = 3.0
    g = np.convolve(g, np.hanning(42)[1:-1] / np.hanning(42)[1:-1].sum(), mode="same")
    track *= db(A.ctrl_to_audio(g))
    track *= db(A.VO_REF_LUFS - A.lufs_integrated(np.vstack([track, track])))
    rep["vo_rows"] = rows
    rep["vo_gr"] = gr[A.ms_env(track) > 10 ** (-45 / 10)]
    return track * db(VO_BUS_DB)


# ═══════════════════════════════ SFX sources ═══════════════════════════════
def whoosh_sample() -> np.ndarray:
    x, sr = A.decode(AUD / "sfx" / "sfx_whoosh.mp3", 2)
    return A.norm_peak(A.fade_out(A.to_48k(x, sr)[:, S(0.7):S(2.6)].copy(), 0.03))


def click13(seed: int = 0) -> np.ndarray:
    t = A.tvec(0.03)
    x = A.bp(A.rng(seed).standard_normal(t.size), 1000, 3000) * np.exp(-t / 0.004)
    return A.norm_peak(x * A.attack_env(t.size, 0.0003))


def frost_shaped(dur: float, dens: np.ndarray, seed: int) -> np.ndarray:
    """frost(dur) whose envelope follows the per-frame new-frost density (sqrt, 0.3 floor), one frame = 1/30 s."""
    x = A.frost(dur, seed=seed)
    k = np.arange(x.shape[1]) / SR * FPS
    env = np.interp(k, np.arange(dens.size), np.sqrt(dens / max(1e-9, dens.max())))
    return A.norm_peak(x * (0.3 + 0.7 * env))


def frost_reversed(dur: float, seed: int) -> np.ndarray:
    return A.norm_peak(A.frost(dur, seed=seed)[:, ::-1].copy())


def expo_out_ticks(t0: float, dur: float, s0: float, s1: float, step: float, gap: float = 0.03) -> list[float]:
    """Momentum scroll (expo.out) crossing multiples of `step` pt -> tick times (s), thinned to >= gap."""
    t = np.arange(0, dur, 1 / 2000)
    s = s0 + (s1 - s0) * (1 - 2 ** (-10 * t / dur))
    idx = np.flatnonzero(np.diff(np.floor(s / step)) > 0) + 1
    out, last = [], -1.0
    for i in idx:
        if t[i] - last >= gap:
            out.append(t0 + float(t[i]))
            last = t[i]
    return out


# ═══════════════════════════════ SFX_EVENTS (the single re-timing table) ═══════════════════════════════
@dataclass
class Ev:
    t: float
    label: str
    fn: Callable[..., np.ndarray]
    kw: dict = field(default_factory=dict)
    gain: float = 0.0
    pan: float = 0.0
    align: str = "start"                                     # start | peak | end
    room: float | None = None
    hall: float | None = None
    big: float | None = None
    sub: bool = False                                        # carries sub energy (the 0.25 s rule)
    move: str | None = None                                  # a whoosh aligned to a 3D move (the +/- 1 f rule)
    on: bool = True


def _events(cues: dict) -> tuple[list[Ev], dict]:
    C = cues
    ev: list[Ev] = []
    add = ev.append
    info = {}
    beat = C.get("BEAT", 0.6)

    def grid_near(t: float, tol_f: float = 6) -> float:
        """The DROP-anchored beat nearest t if within tol_f frames, else t."""
        k = round((t - C["DROP"]) / beat)
        g = C["DROP"] + k * beat
        return SNAP(g) if abs(g - t) <= F(tol_f) else t

    # S01 ---------------------------------------------------------------------------------------------------
    t_hit1 = WORD("S01", "L01", 0)
    if abs(t_hit1 - C["HIT1"]) > 1e-6:
        WARNINGS.append(f"HIT1: VO 'Pure.' at {t_hit1:.3f} vs cues HIT1 {C['HIT1']:.3f} (using the cue)")
    add(Ev(C["HIT1"], "HIT1 impact D1 (rim strip on)", A.impact, dict(seed=100, root="D1", dur=1.4), -10, big=-16, sub=True))
    add(Ev(C["HIT1"], "HIT1 glass tick D6", A.glass_tick, dict(note="D6", seed=101), -16, hall=-12))
    # SWEEP1: the plate's MEASURED brightest frame is f51 (js/shots/S01.js "Sound" header: the strip's line crosses the drop
    # f51-f52), not the planned bez midpoint f54; the grains sit inside the sweep f44-f60
    add(Ev(F(51), "SWEEP1 light sweep through the drop (peak f51, measured)", A.light_sweep, dict(dur=1.2, seed=102), -20, align="peak"))
    r = A.rng(103)
    add(Ev(F(44), "SWEEP1 grains A7 (inside the sweep f44-f60)", A.grains, dict(times=sorted(r.uniform(0.0, 0.53, 6)), notes=("A7",), seed=104), -26, hall=-12))
    # RACK f114-f118: 3 ticks 35 ms apart from f114, the 4th IS the PRINT tick on the word (f117, the rack's last key):
    # one tick per instant (the BRIEF's separate PRINT tick sat 5 ms from RACK tick 4)
    t_print = WORD("S01", "L02", "print")
    for k in range(3):
        add(Ev(F(114) + 0.035 * k, f"RACK tick {k + 1}", A.tick, dict(f=4200, seed=110 + k), -22))
    add(Ev(t_print, "RACK tick 4 = PRINT (the rack lands on the print)", A.tick, dict(f=4200, seed=120), -22))
    # S02 ---------------------------------------------------------------------------------------------------
    add(Ev(F(126), "CUT1 glass tick D6", A.glass_tick, dict(note="D6", seed=200), -16, hall=-12))
    add(Ev(F(126), "CUT1 doppler whoosh 0.6 (peak on the cut)", A.doppler_whoosh, dict(dur=0.6, seed=201), -16, align="peak"))
    t_prove = WORD("S02", "L02", "prove")
    f_exit = ghost_exit()
    add(Ev(F(f_exit), f"PROVE tsk on the ghost's measured exit f{f_exit} (S02.js GHOST_EXIT; VO 'prove.' f{t_prove * FPS:.0f})", A.tsk,
           dict(seed=210), -20))
    add(Ev(t_prove, "PROVE thoomp D2", A.thoomp, dict(note="D2", dur=0.05, seed=211), -16, sub=True))
    add(Ev(F(216), "SWEEP2 light sweep 0.8 ends on the cut", A.light_sweep, dict(dur=0.8, seed=220), -18, align="end"))
    add(Ev(F(216), "SWEEP2 glass tick A5", A.glass_tick, dict(note="A5", seed=221), -18, hall=-12))
    # S03 ---------------------------------------------------------------------------------------------------
    t_meas = WORD("S03", "L03", "measure")
    add(Ev(t_meas, "MEASURE band rise 1k->4k ends on the word", A.band_rise, dict(dur=0.4, f0=1000, f1=4000, seed=300), -20, align="end"))
    add(Ev(t_meas, "MEASURE light sweep 0.54 (peak)", A.light_sweep, dict(dur=0.54, seed=301), -18, align="peak"))
    add(Ev(t_meas, "MEASURE glass tick A6", A.glass_tick, dict(note="A6", seed=302), -18))
    add(Ev(F(296), "MEASURE sub bed under the push-in", A.sub_bed, dict(dur=0.6, seed=303), -30, sub=True))
    add(Ev(F(306), "CUT2 glass tick D6", A.glass_tick, dict(note="D6", seed=310), -20))
    # S04 ---------------------------------------------------------------------------------------------------
    for k, i in enumerate((0, 2)):
        t = WORD("S04", "L04", i)
        add(Ev(t, f"EVERY {k + 1} light sweep 0.3 (peak = the pass centre = the word, S04.js)", A.light_sweep, dict(dur=0.3, seed=400 + k), -22, align="peak"))
        add(Ev(t, f"EVERY {k + 1} tick 4200", A.tick, dict(f=4200, seed=410 + k), -24))
    t_whip = WORD("S05", "L04", "one")                                        # the cut frame f396 opens S05
    add(Ev(t_whip, "WHIP tsk", A.tsk, dict(seed=420), -17))
    add(Ev(t_whip, "WHIP swipe 0.3 (peak)", A.swipe, dict(dur=0.3, seed=421), -20, align="peak"))
    # S05 ---------------------------------------------------------------------------------------------------
    t_tested = WORD("S05", "L04", "Tested")
    add(Ev(t_tested, "TESTED stat_hit A5 light", A.stat_hit, dict(note="A5", root="D2", light=True, seed=500), -14, sub=True))
    for k in range(10):                                                       # onsets f410-f429 (S05.js) -> every 2nd: f410 ... f428
        add(Ev(t_tested + F(2 * k), f"TESTED glyph tick {k + 1}", A.tick, dict(f=4200, seed=510 + k), -24, pan=-0.3 + 0.06 * k))
    t_jano = WORD("S05", "L04", "Janoshik")
    t_acc = grid_near(t_jano)
    info["ACC"] = (t_jano, t_acc)
    add(Ev(t_acc, "ACC glass tick D6 (JANOSHIK; on the beat if within 6 f)", A.glass_tick, dict(note="D6", seed=520), -18, hall=-14))
    add(Ev(F(522), "BREATH sub bed 0.8", A.sub_bed, dict(dur=0.8, seed=530), -30, sub=True))
    t_99 = WORD("S06", "L05", "99")
    add(Ev(t_99, "BREATH reverse swell D6 ends on 99", A.reverse_swell, dict(dur=0.4, note="D6", seed=531), -18, align="end"))
    # S06 ---------------------------------------------------------------------------------------------------
    add(Ev(t_99, "NINETY-NINE stat_hit A5 / D2", A.stat_hit, dict(note="A5", root="D2", seed=600), -9, room=-14, sub=True))
    for k in range(2):
        add(Ev(t_99 + F(2 * k), f"NINETY-NINE char tick {k + 1}", A.tick, dict(f=3600 + 200 * k, seed=610 + k), -18))
    t_min = WORD("S06", "L05", "minimum")
    add(Ev(t_min, "MINIMUM thoomp D2 (the whisper)", A.thoomp, dict(note="D2", dur=0.05, seed=620), -14, sub=True))
    # S07 ---------------------------------------------------------------------------------------------------
    add(Ev(C["DROP"], "RISER0 noise riser A4->A5, last sample on the DROP", A.riser,
           dict(dur=C["DROP"] - F(630), tone=("A4", "A5"), f0=400, f1=9000, seed=700), -15, align="end"))
    add(Ev(C["DROP"], "RISER0 pulse riser D3 (NEW), last sample on the DROP", A.pulse_riser, dict(dur=C["DROP"] - F(630), seed=701), -18, align="end"))
    dens, cents, f0d, dsrc = frost_density()
    info["frost"] = dsrc
    t_frost = WORD("S07", "L06", 0)
    add(Ev(t_frost, f"FROST crackle 2.0 shaped by density ({dsrc})", frost_shaped, dict(dur=2.0, dens=dens, seed=710), -16))
    gt, gp, ga = [], [], []
    for k, (d_, c_) in enumerate(zip(dens, cents)):
        if d_ > 0 and k < 59:
            gt.append(F(k) + 0.004)
            gp.append(float(np.clip((c_[0] - 960) / 960 * 1.4, -0.7, 0.7)) if c_ else 0.0)
            ga.append(float(np.sqrt(d_ / max(1e-9, dens.max()))))
    if gt:
        add(Ev(t_frost, "FROST grains panned by the growth centroid", A.grains, dict(times=gt, pans=gp, amps=ga, seed=711), -24))
    t_cold = WORD("S07", "L06", "cold")
    add(Ev(t_cold, "COLD impact-lite D2", A.impact, dict(seed=720, root="D2", lite=True, dur=0.8), -14, room=-14))
    add(Ev(t_cold, "COLD frost 0.4", A.frost, dict(dur=0.4, seed=721), -14))
    t_close = WORD("S07", "L06", "24")
    add(Ev(t_close, "CLOSE glass settle x4 (NEW)", A.glass_settle, dict(n=4, seed=730), -22, room=-12))
    f_glint, src_g = fastest("ARR")
    info["ARR"] = (f_glint, src_g)
    add(Ev(F(f_glint), f"ARR-GLINT doppler whoosh 0.9 (peak f{f_glint}, {src_g})", A.doppler_whoosh, dict(dur=0.9, seed=740), -11,
           hall=-10, align="peak", move="ARR"))
    add(Ev(F(f_glint), "ARR-GLINT sfx_whoosh sample (peak)", whoosh_sample, {}, -14, align="peak"))
    add(Ev(F(f_glint), "ARR-GLINT tsk", A.tsk, dict(seed=741), -17))
    add(Ev(C["DROP"], "DROP impact D1 1.4", A.impact, dict(seed=750, root="D1", dur=1.4), -8, big=-16, sub=True))
    add(Ev(C["DROP"], "DROP click 1-3 kHz", click13, dict(seed=751), -16))
    add(Ev(C["DROP"], "DROP alu_tick", A.alu_tick, dict(seed=752), -14))
    add(Ev(C["DROP"], "DROP alu_ring D5 (NEW)", A.alu_ring, dict(note="D5", seed=753), -22, hall=-12))
    add(Ev(C["DROP"], "DROP frost field crush 0.3", A.frost, dict(dur=0.3, seed=754), -22))
    # S08 ---------------------------------------------------------------------------------------------------
    add(Ev(F(750), "SLOW SHOW sub bed 1.2", A.sub_bed, dict(dur=1.2, seed=800), -30, sub=True))
    t_wake = WORD("S08", "L07", "Open")
    add(Ev(t_wake, "WAKE screen_wake (NEW)", A.screen_wake, dict(seed=810), -14))
    add(Ev(t_wake + F(18), "WAKE thaw: frost 0.6 reversed, ends f821", frost_reversed, dict(dur=0.6, seed=811), -20, align="end"))
    st = expo_out_ticks(F(812), F(28), 0.0, 36.0, 4.0)
    add(Ev(st[0], f"SCROLL tick train x{len(st)} (widening)", A.tick_train, dict(times=[x - st[0] for x in st], f=4500, seed=820), -30, pan=0.15))
    # S09 ---------------------------------------------------------------------------------------------------
    f_dive, src_d = fastest("DIVE")
    info["DIVE"] = (f_dive, src_d)
    add(Ev(F(f_dive), f"DIVE doppler whoosh 1.4 (peak f{f_dive}, {src_d})", A.doppler_whoosh, dict(dur=1.4, seed=900), -12, hall=-10,
           align="peak", move="DIVE"))
    add(Ev(F(f_dive + 1), "DIVE thoomp D2 at peak + 1 f", A.thoomp, dict(note="D2", seed=901), -14, sub=True))
    add(Ev(F(850), "CART TAP tap 2350 / body 380", A.tap, dict(f=2350, body_hz=380, seed=910), -10))
    add(Ev(F(850), "CART TAP haptic", A.haptic, {}, -16))
    add(Ev(F(854), "PUSH1 swipe (peak f854)", A.swipe, dict(seed=920), -18, align="peak"))
    add(Ev(F(866), "PUSH1 badge pop E7", A.pop, dict(note="E7", dur=0.14, seed=921), -13))
    for n_, f_tap, f_state in ((1, 888, 890), (2, 912, 914)):
        add(Ev(F(f_tap), f"TAP{n_} '+' tap 2350", A.tap, dict(f=2350, body_hz=380, seed=930 + n_), -10))
        add(Ev(F(f_tap), f"TAP{n_} haptic", A.haptic, {}, -16))
        add(Ev(F(f_state), f"TAP{n_} state pop E7", A.pop, dict(note="E7", seed=940 + n_), -16))
        for k in range(4):
            add(Ev(F(f_state + k), f"TAP{n_} price roll tick {k + 1}", A.tick, dict(f=3400 + 150 * k, seed=950 + 10 * n_ + k), -21))
        add(Ev(F(f_state), f"TAP{n_} bar band rise 0.45", A.band_rise, dict(dur=0.45, seed=960 + n_), -21))
    t_auto = WORD("S09", "L08", "automatic")
    add(Ev(t_auto, "AUTOMATIC soft chime D6+A6 (free shipping unlocked reads)", A.soft_chime, dict(notes=("D6", "A6"), seed=970), -14, hall=-12))
    # S10 ---------------------------------------------------------------------------------------------------
    f_tilt, src_t = fastest("TILT")
    info["TILT"] = (f_tilt, src_t)
    add(Ev(F(f_tilt), f"TILT doppler whoosh 0.8 (peak f{f_tilt}, {src_t})", A.doppler_whoosh, dict(dur=0.8, seed=1000), -14, hall=-10,
           align="peak", move="TILT"))
    # the BRIEF's TILT thoomp (peak + 1 f) would sit 4 f before the first slab's stat_hit: the 0.25 s sub rule keeps the slab accent
    add(Ev(F(f_tilt + 1), "TILT thoomp D2 (OFF: within 0.25 s of the SLABS stat_hit, sub rule)", A.thoomp, dict(note="D2", seed=1001), -16, sub=True, on=False))
    for k, (f_, note) in enumerate(((954, "D6"), (959, "A5"), (964, "E6"))):
        add(Ev(F(f_), f"SLAB {k + 1} glass tick {note}", A.glass_tick, dict(note=note, seed=1010 + k), -20))
        add(Ev(F(f_), f"SLAB {k + 1} alu_tick", A.alu_tick, dict(seed=1020 + k), -20))
    add(Ev(F(954), "SLABS stat_hit light on the first lift", A.stat_hit, dict(note="D6", root="D2", light=True, seed=1030), -14, sub=True))
    add(Ev(F(999), "SHEEN light sweep 0.54 (centre f999)", A.light_sweep, dict(dur=0.54, seed=1040), -20, align="peak"))
    r = A.rng(1041)
    add(Ev(F(990), "SHEEN grains A7", A.grains, dict(times=sorted(r.uniform(0.0, 0.55, 5)), notes=("A7",), seed=1042), -26, hall=-12))
    for k, (f_, note) in enumerate(((1020, "E7"), (1025, "D7"), (1030, "A6"))):
        add(Ev(F(f_), f"SEAT {k + 1} pop {note}", A.pop, dict(note=note, seed=1050 + k), -20))
    for k, f_ in enumerate((1034, 1039, 1045)):                              # contact frames (S10.js); the stepper's on f1045, after the NAV tap
        add(Ev(F(f_), f"SEAT {k + 1} glass settle x2 on contact f{f_}", A.glass_settle, dict(n=2, seed=1060 + k), -26))
    # S11 ---------------------------------------------------------------------------------------------------
    add(Ev(F(1044), "NAV TAP tap 2350", A.tap, dict(f=2350, body_hz=380, seed=1100), -10))
    add(Ev(F(1044), "NAV TAP haptic", A.haptic, {}, -16))
    add(Ev(F(1052), "PUSH2 swipe (peak f1052)", A.swipe, dict(seed=1110), -18, align="peak"))
    f_orb, src_o = fastest("ORBIT")
    info["ORBIT"] = (f_orb, src_o)
    add(Ev(F(f_orb), f"ORBIT doppler whoosh 1.0 (peak f{f_orb}, {src_o})", A.doppler_whoosh, dict(dur=1.0, seed=1120), -14, hall=-10,
           align="peak", move="ORBIT"))
    t_sign = WORD("S11", "L09", "Purity")
    add(Ev(t_sign, "SIGN-OFF tick train x11, one per glyph onset f1079-f1089", A.tick_train, dict(times=[F(k) for k in range(11)], f=5200, seed=1130), -28))
    add(Ev(t_sign + F(18), "SIGN-OFF shimmer on the sheen", A.shimmer, dict(seed=1131), -24))
    # S12 ---------------------------------------------------------------------------------------------------
    add(Ev(F(1152), "DIM thoomp D2 (screen emission 1 -> 0)", A.thoomp, dict(note="D2", seed=1200), -16, sub=True))
    f_exit, src_e = fastest("EXIT")
    info["EXIT"] = (f_exit, src_e)
    add(Ev(F(f_exit), f"EXIT doppler whoosh 1.0 (peak f{f_exit}, {src_e})", A.doppler_whoosh, dict(dur=1.0, seed=1210), -16, hall=-10,
           align="peak", move="EXIT"))
    add(Ev(F(1172), "EXIT glint tsk (the rail's flash, CA peak f1172, S12.js)", A.tsk, dict(seed=1211), -19))
    # S13 ---------------------------------------------------------------------------------------------------
    add(Ev(C["LOGO"], "LOGO sonic logo (A5 on the ignite f1206, D6 on the point f1212)", A.sonic_logo, dict(seed=1300, gap=F(6)), -4, hall=-12, sub=True))
    add(Ev(C["LOGO"], "LOGO haptic 0.12", A.haptic, dict(dur=0.12), -20))
    r = A.rng(1310)
    seats = [F(k + 9) for k in range(14)]                       # S13.js: dot k seats on f1215 + k (f1215 ... f1228)
    add(Ev(C["LOGO"] + seats[0], "LOGO grains D7/A7/E7, one per dot seat f1215-f1228", A.grains,
           dict(times=[x - seats[0] for x in seats], pans=list(r.uniform(-0.5, 0.5, 14)), notes=("D7", "A7", "E7"), seed=1311), -20, hall=-12))
    t_url = WORD("S13", "L10", 0)
    add(Ev(t_url, "URL 16 ticks 5200 on the typed frames f1215 + round(18 k / 16)", A.tick_train,
           dict(times=[F(round(18 * k / 16)) for k in range(16)], f=5200, seed=1320), -28))
    t_care = WORD("S13", "L10", ".care")
    add(Ev(t_care, "URL underline light sweep 0.5 ends on '.care'", A.light_sweep, dict(dur=0.5, seed=1321), -26, align="end"))
    add(Ev(C["LOGO"] + 0.05, "TAIL D5/A5 ring-out 2.9 s (gone by 44.5)", A.tail, dict(dur=2.9, seed=1330), -14, hall=-14))
    return ev, info


def _peak_offset(x: np.ndarray) -> int:
    p = np.atleast_2d(x) ** 2
    env = np.convolve(p.mean(axis=0), np.ones(S(0.005)) / S(0.005), mode="same")
    return int(np.argmax(env))


def build_sfx(events: list[Ev], key: np.ndarray, rep: dict) -> np.ndarray:
    buses = {k: np.zeros((2, N)) for k in ("dry", "room", "hall", "big")}
    rows = []
    for e in events:
        if not e.on:
            rows.append((e, None, 0, None, None))
            continue
        s = A.to_stereo(np.asarray(e.fn(**e.kw), dtype=float), e.pan) * db(e.gain)
        n = s.shape[1]
        off = {"start": 0, "peak": _peak_offset(s), "end": n}[e.align]
        i0 = S(e.t) - off
        a, b = max(0, i0), min(N, i0 + n)
        assert b > a, e.label
        seg = s[:, a - i0:b - i0]
        buses["dry"][:, a:b] += seg
        for name, lvl in (("room", e.room), ("hall", e.hall), ("big", e.big)):
            if lvl is not None:
                buses[name][:, a:b] += seg * db(lvl)
        rows.append((e, i0 / SR, n / SR, (i0 + _peak_offset(s)) / SR, 20 * np.log10(np.abs(s).max())))
    sfx = (A.hp(buses["dry"], 30.0) + A.reverb(buses["room"], A.ROOM_IR, hp_hz=300, lp_hz=9000)
           + A.reverb(buses["hall"], A.HALL_IR, hp_hz=300) + A.reverb(buses["big"], A.BIG_IR, hp_hz=200))
    duck = A.duck_curve(key, A.SFX_DUCK_DB)
    rep["sfx_rows"] = rows
    rep["sfx_duck"] = duck
    return sfx * db(A.ctrl_to_audio(duck))


# ═══════════════════════════════ master + gates ═══════════════════════════════
def silence_windows(cues: dict) -> list:
    return [(0.0, cues["HIT1"], 0.0, "OPEN 0-1.0"), (cues["STOP"], cues["LOGO"], 0.030, "STOP 39.6-40.2"), (44.5, 45.0, 0.040, "END 44.5-45.0")]


def silence_gate(cues: dict) -> np.ndarray:
    g = np.ones(N)
    for a, b, pre, _ in silence_windows(cues):
        i, j, k = S(a), min(N, S(b)), S(pre)
        if k:
            g[i - k:i] = np.minimum(g[i - k:i], 0.5 + 0.5 * np.cos(np.pi * np.arange(1, k + 1) / k))
        g[i:j] = 0.0
    return g


def short_term_lra(x: np.ndarray) -> float:
    """EBU R128 loudness range: 3 s short-term blocks (100 ms hop), -70 abs / -20 rel gates, p95 - p10."""
    z = A.block_power(x, block=3.0, hop=0.1)
    lk = A.lufs(z)
    g1 = lk > -70
    if not g1.any():
        return 0.0
    rel = A.lufs(z[g1].mean()) - 20
    v = lk[g1 & (lk > rel)]
    return float(np.percentile(v, 95) - np.percentile(v, 10)) if v.size else 0.0


def momentary_max(x: np.ndarray, a: float, b: float) -> float:
    i, j = S(max(0.0, a - 0.4)), S(b)
    return float(A.lufs(A.block_power(x[:, i:j], block=0.4, hop=0.01)).max())


def main() -> None:
    report = "--report" in sys.argv
    allow_cues = "--no-cues" not in sys.argv
    rep: dict = {}
    track_a = "--track-a" in sys.argv or not MUSIC_SRC.exists()
    if track_a:                                              # BRIEF §6 fallback: the previous ad's bed, re-cut to the same three points
        src_path = next((p for p in TRACK_A if p.exists()), None)
        assert src_path, "neither music_raw.mp3 nor Track A found"
        src, sr = A.decode(src_path, 2)
        src = A.to_48k(src, sr)
        meas = {"bpm": 120.0, "beat": 0.5, "phase": 0.0, "key": "D (Track A, by construction)", "key_score": 1.0, "root": "D",
                "sub_notes": [], "beats": [], "rms": np.zeros(90), "drop_candidates": [(44.0, 0.0)], "stop_candidates": [(59.5, -60.0)],
                "flat": False, "fade_start": None}
        edit, fades = EDIT_A, SEG_FADES_A
        cues = {"HIT1": TARGETS["HIT1"], "DROP": TARGETS["DROP"], "STOP": TARGETS["STOP"], "LOGO": TARGETS["LOGO"], "BEAT": 0.5, "BPM": 120.0}
        info = {"src_drop_beat": 44.0, "offset": -19.4, "how": f"Track A fallback ({src_path.name}), BRIEF §6 EDIT", "src_tail_beat": 84.0,
                "fade_start": None}
        print(f"music: TRACK A FALLBACK ({src_path})")
    else:
        src, sr = A.decode(MUSIC_SRC, 2)
        src = A.to_48k(src, sr)
        meas = measure_music(src)
        edit, fades, cues, info = plan_edit(meas)
    cue_state = write_cues(cues, meas, info, allow_cues)
    cues = _load_cues()                                      # what the picture reads (frozen or just written)
    events, ev_info = _events(cues)
    vo = build_vo(rep)
    sfx = build_sfx(events, A.vo_key(vo, bridge=0.0), rep)
    gate = silence_gate(cues)
    vo_st = np.vstack([vo, vo]) * gate
    sfx = sfx * gate
    key = A.vo_key(vo)
    for rnd in range(5):                                     # guard re-aimed on the mastered stems (final_margins)
        music = build_music(src, edit, fades, key, rep, vo, track_a) * gate
        out, gain, glue_gr, lim_gr = A.master(vo_st + music + sfx)
        post = db(A.ctrl_to_audio(glue_gr)) * db(gain) * 10 ** (-lim_gr / 20) * gate
        fm = final_margins(A.hp(vo_st, 24.0) * post, A.hp(music, 24.0) * post)
        short = {k: m for k, m in fm.items() if m < GUARD_DB + 0.05}
        if not short:
            break
        for k, m in short.items():
            GUARD_EXTRA[k] = GUARD_EXTRA.get(k, 0.0) + (GUARD_DB + 0.25 - m)
        print(f"guard round {rnd + 1}: {len(short)} word(s) under {GUARD_DB} dB after the master "
              f"(min {min(short.values()):.2f}) -> re-aimed")
    out = out * gate
    assert out.shape == (2, N) and np.all(np.isfinite(out)) and np.abs(out).max() < 1.0
    A.write_wav24(OUT_PATH, out)

    with wave.open(str(OUT_PATH)) as w:
        meta = (w.getframerate(), w.getsampwidth() * 8, w.getnchannels(), w.getnframes())
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.uint8).reshape(-1, 3)
    q = (raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16))
    q = np.where(q >= 1 << 23, q - (1 << 24), q).reshape(-1, 2).T / (2 ** 23 - 1)
    assert meta == (SR, 24, 2, N), meta
    lu, tp = A.lufs_integrated(q), A.true_peak_db(q)
    print(f"music: {meas['bpm']:.1f} BPM (beat {meas['beat']:.3f} s, beats at S {meas['phase']:.3f} + k*beat), key {meas['key']} "
          f"(score {meas['key_score']}), sub-bass note per beat: {' '.join(meas['sub_notes'][:64])}")
    print(f"music: {'FLAT (no drop / silence / hit in the file: the arc is built in the mix)' if meas['flat'] else 'ARC measured'}; "
          f"RMS step-ups {[(t, round(v, 1)) for t, v in meas['drop_candidates']]} dB; stop candidates {meas['stop_candidates']}; "
          f"fade from S {meas['fade_start']}")
    print(f"music: EDIT {[(round(a, 3), round(b, 3), round(c, 3)) for a, b, c in edit]}  (DROP <- S {info['src_drop_beat']:.3f} "
          f"[{info['how']}], tail <- S {info['src_tail_beat']:.3f})")
    print(f"cues: {cues}  (js/cues.js {cue_state})")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {meta[3]} frames = {meta[3] / SR:.3f} s, {meta[0]} Hz, {meta[1]}-bit, {meta[2]} ch")
    print(f"integrated {lu:.2f} LUFS | true peak (4x) {tp:.2f} dBTP | sample peak {20 * np.log10(np.abs(q).max()):.2f} dBFS | "
          f"LRA {short_term_lra(q):.1f} LU | master gain {gain:+.2f} dB | glue GR max {-glue_gr.min():.2f} dB | limiter GR max {lim_gr.max():.2f} dB")
    mm_drop, mm_logo = momentary_max(q, cues["DROP"], cues["DROP"] + 1.0), momentary_max(q, cues["LOGO"], cues["LOGO"] + 1.0)
    print(f"momentary max: DROP {mm_drop:.1f} LUFS, LOGO {mm_logo:.1f} LUFS (target <= -9)")
    for wmsg in WARNINGS:
        print("  note:", wmsg)
    ok = abs(lu - A.TARGET_LUFS) <= 0.3 and tp <= A.CEILING_DBTP
    if "--stems" in sys.argv or report:
        post = db(A.ctrl_to_audio(glue_gr)) * db(gain) * 10 ** (-lim_gr / 20) * gate
        stems = {name: A.fade_out(A.hp(s, 24.0), 0.25) * A.attack_env(N, 0.005) * post
                 for name, s in (("vo", vo_st), ("music", music), ("sfx", sfx))}
        if "--stems" in sys.argv:
            for name, s in stems.items():
                A.write_wav24(AUD / f"mix_{name}.wav", np.clip(s, -1, 1))
            print("wrote assets/audio/mix_{vo,music,sfx}.wav (post-master stems)")
        if report:
            print(f"stem sum vs master max abs diff: {np.abs(sum(stems.values()) - out).max():.2e}")
            ok &= print_report(rep, stems, q, cues, events, ev_info)
    print("RESULT:", "PASS" if ok else "FAIL")


# ═══════════════════════════════ report ═══════════════════════════════
def print_report(rep: dict, stems: dict, out: np.ndarray, cues: dict, events: list[Ev], ev_info: dict) -> bool:
    kw = {k: A.kweight(v) for k, v in stems.items()}
    ok = True
    print("\nVO lines placed (lines.tsv):")
    for lid, at, end, text in rep["vo_rows"]:
        print(f"  {lid:5s} {at:6.3f} -> {end:6.3f}  {text}")
    g = rep["vo_gr"]
    print(f"VO compressor GR while speaking: mean {-g.mean():.2f} dB, max {-g.min():.2f} dB")

    pb = {k: (v ** 2).sum(axis=0)[:A.NC * A.CTRL].reshape(A.NC, A.CTRL).mean(axis=1) for k, v in kw.items()}
    act = 10 * np.log10(np.maximum(np.convolve(pb["vo"], np.ones(10) / 10, mode="same"), 1e-20)) > A.lufs_integrated(stems["vo"]) - 20.0

    def Lw(name: str, a: float, b: float) -> float:
        i, j = int(a * 1000), int(b * 1000)
        m = act[i:j]
        return float(A.lufs(pb[name][i:j][m].mean())) if m.any() else -np.inf

    print("\nVO over the bed, per word (K-weighted, voiced 1 ms blocks of [onset, next onset or line end]; guard >= 9 dB over music):")
    worst, worst_s, all_cells = (99.0, ""), (99.0, ""), []
    for lid, ln in VO.items():
        ws = ln["words"]
        cells = []
        for k, (t0, w) in enumerate(ws):
            t1 = ws[k + 1][0] if k + 1 < len(ws) else ln["end"]
            v, mu, sx = Lw("vo", t0, t1), Lw("music", t0, t1), Lw("sfx", t0, t1)
            m = v - mu
            ms = v - 10 * np.log10(10 ** (mu / 10) + 10 ** (sx / 10))
            cells.append(f"{w}:{m:.1f}/{ms:.1f}")
            all_cells.append((lid, w, ms))
            if ms < worst_s[0]:
                worst_s = (ms, f"{lid} '{w}' @ {t0:.2f}")
            if m < worst[0]:
                worst = (m, f"{lid} '{w}' @ {t0:.2f}")
        print(f"  {lid}  " + "  ".join(cells))
    print(f"  (value = VO-music / VO-(music+SFX) dB)   worst VO-music margin {worst[0]:.2f} dB at {worst[1]} -> "
          f"{'PASS' if worst[0] >= 9 else 'FAIL'} (bed guard >= 9 dB)")
    under = [c for c in all_cells if c[2] < 8.0]
    print(f"  VO-(music+SFX) under 8 dB (info: SFX accents placed on those words by design, bus ducked -4 dB): "
          + (", ".join(f"{l} '{w}' {v:.1f}" for l, w, v in under) if under else "none"))
    ok &= worst[0] >= 9

    gd, dk = rep["music_guard"], rep["music_duck"]
    print("\nMusic duck per zone (dB, control rate): zone duck min / guard extra min / guard mean while active / % of time active")
    for a, b, g in DUCK_ZONES:
        i, j = int(a * 1000), int(b * 1000)
        z, x = dk[i:j], gd[i:j]
        on = x < -0.5
        print(f"  T {a:4.1f}-{b:4.1f} (zone {g:+.0f}): duck min {z.min():6.2f} | guard min {x.min():6.2f} | "
              f"guard mean {x[on].mean() if on.any() else 0:6.2f} | active {100 * on.mean():5.1f} %")

    print("\nSFX events (sync t, align, actual start, loudest 5 ms, pre-master peak):")
    for e, st, n, pk, lvl in rep["sfx_rows"]:
        if st is None:
            print(f"  {e.t:7.3f}  f{e.t * FPS:7.1f}  OFF  {e.label}")
            continue
        print(f"  {e.t:7.3f}  f{e.t * FPS:7.1f}  {e.align:5s} start {st:7.3f}  len {n:5.3f}  peak@{pk:7.3f}  "
              f"{lvl:6.1f} dBFS  {e.gain:+5.1f} dB  {e.label}")

    print("\nWhoosh peaks vs the fastest frame of each 3D move (+/- 1 f rule):")
    for e, st, n, pk, lvl in rep["sfx_rows"]:
        if e.move and st is not None:
            f_target, src = ev_info[e.move]
            d = pk * FPS - f_target
            good = abs(d) <= 1.0
            ok &= good
            print(f"  {e.move:6s} target f{f_target} ({src})  loudest 5 ms at f{pk * FPS:7.2f}  delta {d:+.2f} f -> {'PASS' if good else 'FAIL'}")
    t_j, t_a = ev_info["ACC"]
    print(f"  ACC: 'Janoshik' at {t_j:.3f} s, nearest DROP-anchored beat {'used' if t_a != t_j else 'not within 6 f'} -> accent at {t_a:.3f} s")
    print(f"  FROST density source: {ev_info['frost']}")

    print("\nSub spacing (never two subs within 0.25 s):")
    subs = sorted((e.t, e.label) for e in events if e.sub and e.on)
    bad = [(a, b) for a, b in zip(subs, subs[1:]) if b[0] - a[0] < 0.25]
    for a, b in bad:
        print(f"  FAIL {a[0]:.3f} '{a[1]}' and {b[0]:.3f} '{b[1]}' ({b[0] - a[0]:.3f} s)")
    print(f"  {len(subs)} sub events, closest pair {min((b[0] - a[0]) for a, b in zip(subs, subs[1:])):.3f} s -> {'PASS' if not bad else 'FAIL'}")
    ok &= not bad

    print("\nStem loudness (integrated, final gains):")
    for k, v in stems.items():
        print(f"  {k:6s} {A.lufs_integrated(v):7.2f} LUFS   peak {20 * np.log10(np.abs(v).max() + 1e-20):7.2f} dBFS")

    print("\nRMS every 0.5 s (dBFS, mix = written file; stems = RMS over the same 0.5 s):")
    print("     t      mix   vo     music  sfx    |")
    for t in np.arange(0.0, 45.0 - 1e-9, 0.5):
        i, j = S(t), S(t + 0.5)
        r = [10 * np.log10(np.mean(x[:, i:j] ** 2) + 1e-30) for x in (out, stems["vo"], stems["music"], stems["sfx"])]
        bar = "#" * int(max(0, (r[0] + 60) / 1.5))
        f = lambda v: f"{v:6.1f}" if v > -150 else "  -inf"
        print(f"  {t:4.1f}-{t + 0.5:4.1f} {f(r[0])} {f(r[1])} {f(r[2])} {f(r[3])} | {bar}")

    print("\nSilence windows (written file):")
    for a, b, _pre, name in silence_windows(cues):
        i, j = S(a), S(b)
        pk = np.abs(out[:, i:j]).max()
        good = pk == 0
        print(f"  {name:18s} mix peak {20 * np.log10(pk) if pk > 0 else -np.inf:7.1f} dBFS ({'digital silence' if good else 'NOT silent'}) -> {'PASS' if good else 'FAIL'}")
        ok &= bool(good)
    end = max(np.flatnonzero(np.abs(out).max(axis=0) > 0)) / SR
    first = min(np.flatnonzero(np.abs(out).max(axis=0) > 0)) / SR
    print(f"  first non-zero sample at {first:.4f} s, last at {end:.4f} s")
    lra = short_term_lra(out)
    print(f"\nLRA {lra:.1f} LU (target 8-12) -> {'PASS' if 8 <= lra <= 12 else 'INFO'}")
    return ok


if __name__ == "__main__":
    main()
