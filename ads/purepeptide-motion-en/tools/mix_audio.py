#!/usr/bin/env python3
"""PurePeptide "SPELLED OUT" 45 s (EN): the soundtrack (BRIEF §7 music + §8 SFX + mix, SCENES Appendix A).

    python3 tools/mix_audio.py            # writes assets/audio/mix.wav
    python3 tools/mix_audio.py --report   # same, plus the QC tables (VO-over-music margin per word, loudness,
                                          # true peak, SFX event list, RMS every 0.5 s, silence windows)

Output: 48 kHz, stereo, 24-bit PCM, exactly 45.000 s (2,160,000 frames), -14.0 LUFS integrated, true peak
<= -1.5 dBTP (4x oversampled). float64 + fixed seeds: a re-run is bit-identical. No network, no ElevenLabs.

Timing sources (never hard-coded word times):
    js/cues.js   music cues (frozen): HIT1 1.0, HIT9 9.0, ACC13 13.0, RISER0 21.0, DROP 25.0, STOP 40.5, LOGO 41.0
    js/vo.js     word onsets; VOw(id, i | "prefix") mirrors VO.w() in js/lib.js (same aliases)
    F(n)         picture frames from BRIEF §8 / SCENES (n / 30)
    assets/typevial/density.json (S02 sub-render: glyphs landed per frame), optional; a fallback curve is used if absent.

Re-timing after picture lock: edit SFX_EVENTS (one row per sound; `t` is the sync point, `align` says which
point of the sound lands on it: its start, its loudest 5 ms, or its end), then re-run.

Signal flow
    VO     assets/audio/vo/L*.wav placed at lines.tsv `at` -> HPF 90 Hz -> +1.5 dB @ 4 kHz -> 2:1 comp -> -15 LUFS.
    Music  film-en Track A (assets/audio/music_raw.mp3, 120 BPM, D) edited per EDIT (all offsets on the 0.5 s grid):
           S 8-24 -> T 1-17 (1 s fade-out T16-17) · S 36-60 -> T 17-41 (1 s equal-power fade-in) · S 84-87 -> T 41-44
           -> fader -3 dB -> voice pocket (-2.5 dB @ 2.8 kHz while the VO speaks) -> duck keyed by the VO with
           bridged pauses: -6 dB T 1-24, -8 dB T 25-37, -11 dB under L16 / L17.
    SFX    synthesized (tools/audiolib.py, seeded) + film-en sfx_whoosh.mp3; room / hall / big reverb sends;
           bus ducked -4 dB where it overlaps speech.
    Master HPF 24 Hz -> glue 1.5:1 -> gain + true-peak limiter iterated to -14.0 LUFS -> silence gates
           (stop beat 40.50-41.00, tail 44.00-45.00: digital zero, no dither) -> 24-bit TPDF dither.
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


# ═══════════════════════════════ timing sources ═══════════════════════════════
def F(n: float) -> float:
    """Picture frame -> seconds."""
    return n / FPS


def _load_cues() -> dict:
    txt = (ROOT / "js" / "cues.js").read_text(encoding="utf-8")
    body = re.search(r"freeze\(\s*(\{.*?\})\s*\)", txt, re.S).group(1)
    return {k: float(v) for k, v in re.findall(r"(\w+)\s*:\s*([-\d.]+)", body)}


def _load_vo() -> dict:
    txt = (ROOT / "js" / "vo.js").read_text(encoding="utf-8")
    m = re.search(r"window\.VO\s*=\s*(\{.*?\n\});", txt, re.S)
    return json.loads(m.group(1))


CUES = _load_cues()
VO = _load_vo()
_ALIAS = {"ninety": "99", "ninety-nine": "99", "percent": "%", "five": "5", "eight": "8", "ten": "10", "twenty": "24",
          "twenty-four": "24", "janoshik": "janosik", "two": "two", "200": "$200", "dot": ".care", "care": ".care"}


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


WARNINGS: list[str] = []


def SNAP(t: float) -> float:
    """Onto the picture's frame grid (the scenes snap word-locked events the same way)."""
    return float(np.floor(t * FPS + 0.5)) / FPS   # = Math.round (JS), not banker's rounding


def clamp(t: float, lo: float, hi: float, label: str) -> float:
    """SCENES §0.3 clamp rule, mirrored so the sound lands where the scene clamps the picture."""
    c = min(hi, max(lo, t))
    if abs(c - t) > 1e-6:
        WARNINGS.append(f"clamp {label}: {t:.3f} s -> {c:.3f} s (f{t * FPS:.1f} -> f{c * FPS:.1f})")
    return c


# ═══════════════════════════════ music ═══════════════════════════════
MUSIC_SRC = AUD / "music_raw.mp3"              # copy of purepeptide-film-en/assets/audio/music_raw.mp3 (Track A)
EDIT = [(8.0, 24.0, 1.0),     # S 8-24  -> T 1-17   1 s fade-out T16-17
        (36.0, 60.0, 17.0),   # S 36-60 -> T 17-41  1 s equal-power fade-in at T17
        (84.0, 87.0, 41.0)]   # S 84-87 -> T 41-44  join on the final hit; decays out ~43.8
SEG_FADES = [(0.0, 1.0), (1.0, 0.03), (0.003, 0.0)]   # (fade-in, fade-out) s per segment; the final hit keeps its attack
MUSIC_FADER_DB = -3.0
DUCK_ZONES = [(0.0, 24.5, -6.0), (24.5, 37.2, -8.0), (37.2, 45.0, -11.0)]   # -6 T1-24 · -8 T25-37 · -11 under L16/L17
POCKET_DB, POCKET_HZ, POCKET_Q = -2.5, 2800.0, 0.9
# word guard: on top of the zone duck, the bed dips further only on the words where it would sit less than GUARD_DB
# under the voice (same per-word measure as --report), at most GUARD_MAX_DB more. It keeps BRIEF §7's ">= 8 dB on
# every word" under the music's own accents (T1 swell under the soft L01, the ACC13 accent under "by", drop kicks)
# without pumping the rest of the bed.
GUARD_DB, GUARD_MAX_DB = 9.0, -12.0
VO_BUS_DB = 0.0
SILENCE = [(CUES["STOP"], CUES["LOGO"], 0.020),        # stop beat: total freeze, no music, no SFX, no VO
           (44.0, 45.0, 0.040)]                        # logo still on screen, total silence


def word_windows():
    """(lid, word, t0, t1) for every VO word: onset -> next onset (or line end)."""
    for lid, ln in VO.items():
        ws = ln["words"]
        for k, (t0, w) in enumerate(ws):
            yield lid, w, float(t0), float(ws[k + 1][0] if k + 1 < len(ws) else ln["end"])


def kblocks(x: np.ndarray) -> np.ndarray:
    """K-weighted power per 1 ms block (channels summed, BS.1770)."""
    y = A.kweight(np.atleast_2d(x))
    return (y ** 2).sum(axis=0)[:A.NC * A.CTRL].reshape(A.NC, A.CTRL).mean(axis=1)


def voiced_mask(pv: np.ndarray, vo_lufs: float) -> np.ndarray:
    """VO 10 ms K-weighted level within 20 dB of the VO stem's loudness."""
    return A.lufs(np.convolve(pv, np.ones(10) / 10, mode="same")) > vo_lufs - 20.0


def word_margin(pv, pm, act, t0, t1) -> float:
    i, j = int(t0 * 1000), int(t1 * 1000)
    m = act[i:j]
    if not m.any():
        return np.inf
    return float(A.lufs(pv[i:j][m].mean()) - A.lufs(pm[i:j][m].mean()))


def guard_curve(vo: np.ndarray, music: np.ndarray) -> np.ndarray:
    """Extra music gain (dB, control rate, <= 0): each word whose VO-over-music margin is under GUARD_DB gets the
    deficit as a dip over [t0 - 40 ms, t1 + 40 ms]; min-filter +/-40 ms then a +/-30 ms Hann, so the smoothed dip
    is at least the deficit over the whole word. Two passes (the dip is linear in dB, the smoothing is not)."""
    from scipy.ndimage import minimum_filter1d
    vst = np.vstack([vo, vo])
    pv, pm0 = kblocks(vst), kblocks(music)
    act = voiced_mask(pv, A.lufs_integrated(vst))
    guard = np.zeros(A.NC)
    w = np.hanning(63)[1:-1]
    for _ in range(5):
        pm = pm0 * 10 ** (guard / 10)
        need = guard.copy()
        for _lid, _w, t0, t1 in word_windows():
            d = word_margin(pv, pm, act, t0, t1) - GUARD_DB
            if d < 0:
                i, j = max(0, int(t0 * 1000) - 40), min(A.NC, int(t1 * 1000) + 40)
                need[i:j] = np.minimum(need[i:j], np.maximum(GUARD_MAX_DB, guard[i:j].min() + d))
        if np.array_equal(need, guard):
            break
        guard = np.convolve(minimum_filter1d(need, 81, mode="nearest"), w / w.sum(), mode="same")
    return np.minimum(guard, 0.0)


def build_music(key: np.ndarray, rep: dict, vo: np.ndarray | None = None) -> np.ndarray:
    src, sr = A.decode(MUSIC_SRC, 2)
    src = A.to_48k(src, sr)
    out = np.zeros((2, N))
    for (s0, s1, d), (fi, fo) in zip(EDIT, SEG_FADES):
        seg = src[:, S(s0):min(S(s1), src.shape[1])].copy()
        n = seg.shape[1]
        if fi:
            k = S(fi)
            seg[:, :k] *= np.sin(0.5 * np.pi * np.arange(k) / k) if fi >= 0.5 else np.linspace(0, 1, k)   # equal power
        if fo:
            k = S(fo)
            seg[:, n - k:] *= np.cos(0.5 * np.pi * np.arange(1, k + 1) / k) if fo >= 0.5 else np.linspace(1, 0, k)
        i = S(d)
        j = min(N, i + n)
        out[:, i:j] += seg[:, :j - i]
    out *= db(MUSIC_FADER_DB)
    t_c = (np.arange(A.NC) + 0.5) / 1000.0
    depth = np.zeros(A.NC)
    for a, b, g in DUCK_ZONES:
        depth[(t_c >= a) & (t_c < b)] = g
    duck = A.duck_curve(key, depth)
    amt = A.ctrl_to_audio(np.clip(duck / -6.0, 0.0, 1.0))
    pocket = A.peaking(out, POCKET_HZ, POCKET_DB, POCKET_Q)
    out = out + amt * (pocket - out)
    out = out * db(A.ctrl_to_audio(duck))
    guard = guard_curve(vo, out) if vo is not None else np.zeros(A.NC)
    out = out * db(A.ctrl_to_audio(guard))
    rep["music_duck"], rep["music_guard"] = duck, guard
    return out


# ═══════════════════════════════ voice-over ═══════════════════════════════
def build_vo(rep: dict) -> np.ndarray:
    """Clips from assets/audio/vo/ (already cut by build_vo.py) placed at lines.tsv `at`; one voice chain on the
    assembled track (one continuous v4 performance: no per-line levelling)."""
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
    track *= db(A.VO_REF_LUFS - A.lufs_integrated(np.vstack([track, track])))
    rep["vo_rows"] = rows
    rep["vo_gr"] = gr[A.ms_env(track) > 10 ** (-45 / 10)]
    return track * db(VO_BUS_DB)


# ═══════════════════════════════ SFX sources ═══════════════════════════════
def _sample(name: str, a: float, b: float) -> np.ndarray:
    x, sr = A.decode(AUD / "sfx" / name, 2)
    return A.norm_peak(A.fade_out(A.to_48k(x, sr)[:, S(a):S(b)].copy(), 0.03))


def whoosh_sample() -> np.ndarray:
    """film-en sfx_whoosh.mp3, window 0.7-2.6 s (its peak at 1.38 s is found by align='peak')."""
    return _sample("sfx_whoosh.mp3", 0.7, 2.6)


def click13(seed: int = 0) -> np.ndarray:
    """1-3 kHz click layer for the DROP."""
    t = A.tvec(0.03)
    x = A.bp(A.rng(seed).standard_normal(t.size), 1000, 3000) * np.exp(-t / 0.004)
    return A.norm_peak(x * A.attack_env(t.size, 0.0003))


def url_lift(seed: int = 0) -> np.ndarray:
    """Airy lift: swipe, high band only."""
    return A.norm_peak(A.hp(A.swipe(dur=0.28, peak=0.07, pan=(0.1, 0.25), seed=seed), 5000, 4))


def hall_d6_rev(dur: float = 0.5, seed: int = 0) -> np.ndarray:
    return A.reverse_swell(dur=dur, note="D6", seed=seed)


# glyph stream density (S02 sub-render) -------------------------------------------------------------
PLATE_T0 = 3.5                                  # typevial.mp4 frame 0 = T 3.50 (f105)


def glyph_events() -> tuple[list[float], list[float], list[float], str]:
    """(times, pans, amps, source) of the glyph grains: at most 2 grains per frame, amplitude ~ sqrt(density),
    pan from the landing x when density.json carries it."""
    src = None
    for p in (ROOT / "assets" / "typevial" / "density.json", ROOT / "assets" / "typevial" / "typevial_density.json",
              ROOT / "assets" / "typevial_density.json"):
        if p.exists():
            src = p
            break
    counts, xs, f0 = None, None, 0
    if src:
        d = json.loads(src.read_text())
        if isinstance(d, dict):
            counts = d.get("counts") or d.get("density") or d.get("n")
            xs = d.get("x") or d.get("xs")
            f0 = int(d.get("f0", d.get("frame0", 0)))
        elif d and isinstance(d[0], dict):
            counts = [e.get("n", e.get("count", 0)) for e in d]
            xs = [e.get("x") for e in d] if "x" in d[0] else None
        else:
            counts = d
    if counts is None:                          # fallback: rows bottom-up, 2 f stagger, ~20 glyphs/row,
        n_f = 72                                # landing ~6 f into their 14 f expo.out, glyphs 0.3 f apart
        c = np.zeros(n_f)
        for k in range(30):
            for g in range(20):
                fr = int(2 * k + 0.3 * g + 6)
                if fr < n_f:
                    c[fr] += 1
        counts, xs, f0, label = c.tolist(), None, 0, "fallback curve (density.json not found)"
    else:
        label = str(src.relative_to(ROOT))
    counts = np.asarray(counts, float)
    r = A.rng(4040)
    times, pans, amps = [], [], []
    mx = max(1.0, counts.max())
    for k, n in enumerate(counts):
        if n <= 0:
            continue
        for g in range(int(min(2, np.ceil(n)))):
            times.append(PLATE_T0 + (f0 + k + r.uniform(0, 1)) / FPS)
            x = xs[k] if xs is not None and k < len(xs) and xs[k] is not None else None
            pans.append(float(np.clip((x - 960) / 960 * 1.6, -0.6, 0.6)) if x is not None else float(r.uniform(-0.35, 0.35)))
            amps.append(float(np.sqrt(n / mx)) * r.uniform(0.6, 1.0))
    return times, pans, amps, label


def flick_tick_times(t0: float, s0: float = 0.0, s1: float = 820.0, step: float = 30.0, gap: float = 0.03) -> list[float]:
    """PH.flick: 8 f power2.in to 20 % of the distance, then 14 f expo.out. One tick each time the scroll crosses
    a multiple of `step` pt, thinned to >= `gap` s: the gaps widen with the deceleration."""
    t = np.arange(0, F(22), 1 / 2000)
    p1 = t < F(8)
    u = np.where(p1, t / F(8), (t - F(8)) / F(14))
    s = np.where(p1, s0 + 0.2 * (s1 - s0) * u ** 2, s0 + (s1 - s0) * (0.2 + 0.8 * (1 - 2 ** (-10 * np.clip(u, 0, 1)))))
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
    t: float                                    # sync time (s)
    label: str
    fn: Callable[..., np.ndarray]
    kw: dict = field(default_factory=dict)
    gain: float = 0.0                           # dB into the SFX bus (sources are peak-normalised)
    pan: float = 0.0
    align: str = "start"                        # which point of the sound lands on t: start | peak | end
    room: float | None = None                   # reverb sends (dB)
    hall: float | None = None
    big: float | None = None
    on: bool = True


def _events() -> list[Ev]:
    C = CUES
    ev: list[Ev] = []
    add = ev.append
    rs = A.rng(1001)

    # S01 ---------------------------------------------------------------------------------------------------
    for k, f in enumerate([0, 12, 22, 30, 37, 43, 48, 52, 55]):                       # 1 cheap stamps x9
        add(Ev(F(f), f"#1 cheap stamp {k + 1} (f{f})", A.stamp, dict(seed=100 + k), -12 + rs.uniform(-1, 1),
               pan=0.15 * (-1) ** k, room=-14))
    add(Ev(C["HIT1"], "#2 sub pre-lap 0.60->1.00 into the music swell", A.sub_swell, dict(dur=0.55, peak=0.40, seed=2),
           -30, align="peak"))
    t_pure = SNAP(clamp(VOw("L01", 5), F(70), F(88), "S01 clean pure"))
    add(Ev(t_pure, "#3 clean 'pure': heavy stamp", A.stamp, dict(seed=130, heavy=True), -10, room=-12))
    add(Ev(t_pure, "#3 clean 'pure': D3 body", A.thoomp, dict(note="D3", dur=0.06, seed=131), -14))
    add(Ev(t_pure, "#3 clean 'pure': glass bell D6", A.glass_tick, dict(note="D6", seed=132, decay=0.3), -16, hall=-12))

    # S02 ---------------------------------------------------------------------------------------------------
    gt, gp, ga, _ = glyph_events()
    add(Ev(min(gt), "#4 glyph grains 3.50-5.80 (density)", A.grains,
           dict(times=[x - min(gt) for x in gt], pans=gp, amps=ga, seed=404), -24))
    for k in range(25):                                                               # 5 row locks, 2 f apart
        f = 105 + 2 * k + 14
        add(Ev(F(f), f"#5 row tick {k + 1} (f{f})", A.tick, dict(f=4200, seed=500 + k), -22, pan=0.1 * np.sin(k)))
    add(Ev(F(175), "#5 cap snap: tick", A.tick, dict(f=4200, seed=560), -20))
    add(Ev(F(175), "#5 cap snap: glass D7", A.glass_tick, dict(note="D7", seed=561), -22, room=-12))
    add(Ev(C["HIT9"], "#6 light sweep 8.73->9.00->9.27", A.light_sweep, dict(dur=0.54, seed=600), -16, align="peak"))
    add(Ev(C["HIT9"], "#6 shimmer D6/A6/D7/E7 on HIT9", A.shimmer, dict(seed=601), -16, hall=-10))

    # S03 ---------------------------------------------------------------------------------------------------
    t99 = clamp(VOw("L05", "Ninety"), F(280), F(292), "S03 99% land")
    add(Ev(t99, "#7 99% land: stat_hit D2", A.stat_hit, dict(note="A5", root="D2", seed=700), -9, room=-14))
    for k in range(3):
        add(Ev(t99 + F(2 * k), f"#7 99% char tick {k + 1}", A.tick, dict(f=3600 + 200 * k, seed=710 + k), -18))
    add(Ev(F(298), "#7 MINIMUM. low thump (masked in f298)", A.thoomp, dict(note="D2", dur=0.05, seed=720), -14))
    add(Ev(F(336), "#8 zip 300->2400 Hz ends on the plate cut f336", A.zip_up, dict(dur=F(336) - F(328), seed=800),
           -20, align="end"))
    add(Ev(F(356), "#8 line seats: glass A6", A.glass_tick, dict(note="A6", seed=810), -20, room=-12))
    t_jano = VOw("L06", "Janoshik")
    t_acc = t_jano if abs(t_jano - C["ACC13"]) <= F(6) else C["ACC13"]
    add(Ev(t_acc, "#9 Janoshik turns teal: glass D6 (ACC13)", A.glass_tick, dict(note="D6", seed=900), -18, hall=-14))

    # S04 ---------------------------------------------------------------------------------------------------
    add(Ev(F(438), "#10 reverse swell, line contracts (ends f438)", A.reverse_swell, dict(dur=0.40, note="D6", seed=1000),
           -18, align="end"))
    add(Ev(F(440), "#11 COLD: impact-lite D2", A.impact, dict(seed=1100, root="D2", lite=True, dur=0.8), -14, room=-14))
    add(Ev(F(440), "#11 COLD: frost crackle 0.4 s", A.frost, dict(dur=0.4, seed=1101), -14))
    add(Ev(F(472), "#12 zoom through the O (peak f472)", A.whoosh,
           dict(dur=0.50, peak=0.33, f0=300, fpk=2500, f1=800, q=1.0, seed=1200), -12, align="peak"))
    t_flip = min(VOw("L07", "ten"), F(498))
    for k, f in enumerate((2700, 2880, 3060)):
        add(Ev(t_flip + F(2 * k), f"#13 split-flap tick {f} Hz", A.tick, dict(f=f, seed=1300 + k), -14))
    for k, n in enumerate(["A4", "D5", "E5", "G5", "A5", "D6", "E6", "G6", "A6", "D7"]):
        add(Ev(t_flip + F(6 + k), f"#13 ten-dot pop {k + 1} ({n})", A.pop, dict(note=n, dur=0.12, seed=1310 + k),
               -16, pan=-0.5 + k / 9))
    add(Ev(F(522), "#14 light white-out bloom 17.40->17.73", A.bloom, dict(dur=F(532) - F(522), seed=1400), -20))

    # S05 ---------------------------------------------------------------------------------------------------
    for k, (f, n) in enumerate(zip([532, 536, 540, 544, 549, 555], ["D6", "E6", "A6", "D7", "E7", "A7"])):
        add(Ev(F(f), f"#15 series swap {k + 1} glass {n}", A.glass_tick, dict(note=n, seed=1500 + k), -16, room=-12))
    # S05 timing mirrored from js/scenes/S05.js (PP.S05.sfx): tOne = 'one' − 6 f (snapped, clamped f570–f588);
    # the six land from tOne + 20 f, centre pair first, 2 f per rank, 8 f back.out(0.8) -> contact ≈ +4 f
    t_one = SNAP(clamp(VOw("L08", "one") - F(6), F(570), F(588), "S05 'One standard.'"))
    t_land = t_one + F(20)
    t_whip = min(F(612), t_one + F(32))                                               # whip 6 f power3.in
    t_whip_e, t_stall = t_whip + F(6), F(658)
    for k, i in enumerate([2, 3, 1, 4, 0, 5]):                                        # centre outward
        x = 960 + (i - 2.5) * 220
        add(Ev(t_land + F(2 * (k // 2) + 4), f"#16 vial lands {k + 1} (x {x:.0f})", A.vial_pop,
               dict(note=["A5", "D6", "E6", "A6", "D7", "E7"][k], seed=1600 + k), -20, pan=(x - 960) / 960 * 1.2, room=-12))
    add(Ev(16.5, "#16 sub bed D1 16.5-20.0", A.sub_bed, dict(dur=3.5, seed=1610), -30))
    add(Ev(t_whip + F(5), "#17 whip (peak = its fastest frame, whip start + 5 f)", A.whoosh,
           dict(dur=0.35, peak=0.22, f0=320, fpk=3000, f1=1200, q=1.0, pan=(0.6, -0.6), seed=1700), -12, align="peak"))
    for k in range(7):                                                                # spread whip end -> stall (S05)
        tw = SNAP(t_whip_e + (t_stall - t_whip_e) * k / 7)
        add(Ev(tw, f"#18 word stream {k + 1} (f{round(tw * 30)}): tick", A.tick, dict(f=3000, seed=1800 + k), -16))
        add(Ev(tw, f"#18 word stream {k + 1}: D2 thump", A.thoomp, dict(note="D2", dur=0.04, seed=1810 + k), -16))
    add(Ev(C["DROP"], "#19 riser 21.00->25.00 (A4->A5)", A.riser, dict(dur=C["DROP"] - C["RISER0"], tone=("A4", "A5"),
                                                                        f0=400, f1=9000, seed=1900), -15, align="end"))

    # S06 ---------------------------------------------------------------------------------------------------
    add(Ev(F(692), "#20 phone fly-in sfx_whoosh (peak f692)", whoosh_sample, {}, -11, align="peak"))
    add(Ev(F(692), "#20 alu tsk f692", A.tsk, dict(seed=2000), -17))
    add(Ev(C["DROP"], "#21 DROP: impact D1", A.impact, dict(seed=2100, root="D1"), -8, big=-16))
    add(Ev(C["DROP"], "#21 DROP: 1-3 kHz click", click13, dict(seed=2101), -16))
    add(Ev(C["DROP"], "#21 DROP: alu_tick", A.alu_tick, dict(seed=2102), -14, room=-14))

    # S07 ---------------------------------------------------------------------------------------------------
    add(Ev(F(751), "#22 bloom: tick 4200", A.tick, dict(f=4200, seed=2200), -14))
    add(Ev(F(751), "#22 bloom: tap body 300", A.tap, dict(f=2350, body_hz=300, seed=2201), -16))
    add(Ev(F(751), "#22 bloom: short shimmer", A.shimmer, dict(seed=2202, dur=0.7, grains=5), -18, hall=-12))
    add(Ev(F(780), "#23 tap Explore the catalog", A.tap, dict(f=2350, body_hz=380, seed=2300), -10, room=-14))
    add(Ev(F(780), "#23 haptic", A.haptic, {}, -16))
    add(Ev(F(796), "#24 Safari push to product (peak f796)", A.swipe, dict(seed=2400), -18, align="peak", room=-14))
    add(Ev(F(826), "#25 add to cart", A.add_to_cart, dict(seed=2500), -10, room=-14))
    add(Ev(F(828), "#26 cart badge pop E7", A.pop, dict(note="E7", dur=0.14, seed=2600), -13))
    add(Ev(F(848), "#27 push to cart (peak f848)", A.swipe, dict(seed=2700), -18, align="peak", room=-14))

    # S08 ---------------------------------------------------------------------------------------------------
    t1 = SNAP(clamp(VOw("L12", "Five") - F(6), F(876), F(890), "S08 '+' tap #1"))
    add(Ev(t1, "#28 '+' tap #1", A.tap, dict(f=2640, body_hz=400, seed=2800), -10, room=-14))
    add(Ev(t1, "#28 haptic", A.haptic, {}, -16))
    add(Ev(t1 + F(2), "#28 state: discount pop E7", A.pop, dict(note="E7", seed=2801), -16))
    for k in range(4):
        add(Ev(t1 + F(2 + k), f"#28 price-roll tick {k + 1}", A.tick, dict(f=3400 + 150 * k, seed=2810 + k), -21))
    add(Ev(t1 + F(2), "#28 bar fill band 1->4 kHz", A.band_rise, dict(dur=0.45, seed=2820), -21))
    add(Ev(t1 + F(22), "#29 module A lands", A.stat_hit, dict(note="D6", root="D2", light=True, seed=2900), -14))
    add(Ev(t1 + F(22), "#29 module A tick", A.tick, dict(f=3800, seed=2901), -14))
    t2 = SNAP(clamp(VOw("L13", "EIGHT") - F(6), F(922), F(940), "S08 '+' tap #2"))
    add(Ev(t2, "#30 '+' tap #2", A.tap, dict(f=2640, body_hz=400, seed=3000), -10, room=-14))
    add(Ev(t2, "#30 haptic", A.haptic, {}, -16))
    add(Ev(t2 + F(2), "#30 bar fill band to full", A.band_rise, dict(dur=F(14), f0=2000, f1=4000, seed=3001), -21))
    add(Ev(t2 + F(16), "#30 free-shipping unlock chime D6+A6", A.soft_chime, dict(notes=("D6", "A6"), seed=3002, dur=1.6),
           -14, hall=-12))
    add(Ev(t2 + F(22), "#31 module B lands", A.stat_hit, dict(note="A5", root="D2", light=True, seed=3100), -14))
    add(Ev(t2 + F(22), "#31 module B tick", A.tick, dict(f=3800, seed=3101), -14))
    tC = SNAP(clamp(VOw("L14", "Free"), F(975), F(995), "S08 module C"))
    add(Ev(tC + F(18), "#31 module C lands", A.stat_hit, dict(note="D6", root="D2", light=True, seed=3110), -14))
    add(Ev(tC + F(18), "#31 module C tick", A.tick, dict(f=3800, seed=3111), -14))
    tS = SNAP(max(VOw("L15", 0), F(1012)))
    for k in range(3):
        add(Ev(tS + F(4 * k), f"#32 ✓ stamp {'ABC'[k]}", A.stamp_soft, dict(seed=3200 + k), -16, pan=-0.35, room=-16))

    # S09 ---------------------------------------------------------------------------------------------------
    add(Ev(F(1038), "#33 momentum flick swipe (fastest f1038)", A.swipe, dict(dur=0.5, peak=0.08, pan=(0.2, 0.2), seed=3300),
           -22, align="peak"))
    ft = flick_tick_times(F(1030))
    add(Ev(ft[0], f"#33 flick tick train x{len(ft)}", A.tick_train, dict(times=[x - ft[0] for x in ft], f=4500, seed=3310),
           -28, pan=0.2))
    add(Ev(F(1064), "#34 tap Proceed to checkout", A.tap, dict(f=2350, body_hz=360, seed=3400), -10, room=-14))
    add(Ev(F(1064), "#34 haptic", A.haptic, {}, -16))
    add(Ev(F(1066), "#35 URL pill lifts (airy)", url_lift, dict(seed=3500), -20, align="start"))
    add(Ev(F(1085), "#36 dive whoosh (peak f1085)", A.whoosh,
           dict(dur=0.66, peak=0.56, f0=200, fpk=3200, f1=900, q=1.0, seed=3600, body=0.5), -11, align="peak", room=-14))
    add(Ev(F(1086), "#36 D2 thoomp", A.thoomp, dict(note="D2", dur=0.09, seed=3601), -12, hall=-16))

    # S10 ---------------------------------------------------------------------------------------------------
    tW = SNAP(clamp(VOw("L16", 0), F(1120), F(1135), "S10 typed wordmark"))
    add(Ev(tW, "#37 typed wordmark ticks x11", A.tick_train,
           dict(times=[F(18) * k / 11 for k in range(11)], f=5200, seed=3700), -28))
    add(Ev(tW + F(18), "#37 shimmer grain on the sheen", A.grains, dict(times=[0.0], notes=("A7",), seed=3710), -26,
           hall=-12))
    add(Ev(C["LOGO"], "#38 stop beat: optional reverse swell (OFF: pure silence)", hall_d6_rev, dict(dur=0.5, seed=3800),
           -24, align="end", on=False))

    # S11 ---------------------------------------------------------------------------------------------------
    add(Ev(C["LOGO"], "#39 sonic logo (click -> A5, D6 +90 ms -> D2 swell)", A.sonic_logo, dict(seed=3900), -4, hall=-12))
    r = A.rng(3910)
    gtimes = [F(k + 10) for k in range(14)]   # S11 dotsPing: dot of rank k seats (pings) at LOGO + k f + 10/14 of its 14 f flight
    add(Ev(C["LOGO"] + gtimes[0], "#39 14 glass grains on the flying dots", A.grains,
           dict(times=[x - gtimes[0] for x in gtimes], pans=list(r.uniform(-0.5, 0.5, 14)), notes=("D7", "A7", "E7"),
                seed=3911), -20, hall=-12))
    add(Ev(C["LOGO"] + 0.05, "#40 tail D5/A5 ring-out, gone by 44.0", A.tail, dict(dur=44.0 - C["LOGO"] - 0.05, seed=4000),
           -14, hall=-14))
    return ev


SFX_EVENTS: list[Ev] = _events()


def _peak_offset(x: np.ndarray) -> int:
    p = np.atleast_2d(x) ** 2
    env = np.convolve(p.mean(axis=0), np.ones(S(0.005)) / S(0.005), mode="same")
    return int(np.argmax(env))


def build_sfx(key: np.ndarray, rep: dict) -> np.ndarray:
    buses = {k: np.zeros((2, N)) for k in ("dry", "room", "hall", "big")}
    rows = []
    for e in SFX_EVENTS:
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
def silence_gate() -> np.ndarray:
    """1 everywhere, 0 inside each SILENCE window, raised-cosine fade over `pre` s before it. Ends are hard
    (the logo hit starts on 41.00 exactly)."""
    g = np.ones(N)
    for a, b, pre in SILENCE:
        i, j, k = S(a), min(N, S(b)), S(pre)
        g[i - k:i] = np.minimum(g[i - k:i], 0.5 + 0.5 * np.cos(np.pi * np.arange(1, k + 1) / k))
        g[i:j] = 0.0
    return g


def main() -> None:
    report = "--report" in sys.argv
    rep: dict = {}
    vo = build_vo(rep)
    music = build_music(A.vo_key(vo), rep, vo)                 # bed stays down through commas / short pauses
    sfx = build_sfx(A.vo_key(vo, bridge=0.0), rep)         # SFX dip only where they really overlap speech
    gate = silence_gate()
    vo_st = np.vstack([vo, vo]) * gate
    music, sfx = music * gate, sfx * gate
    out, gain, glue_gr, lim_gr = A.master(vo_st + music + sfx)
    out = out * gate                                        # kill any filter / limiter smear inside the windows
    assert out.shape == (2, N) and np.all(np.isfinite(out)) and np.abs(out).max() < 1.0
    A.write_wav24(OUT_PATH, out)

    with wave.open(str(OUT_PATH)) as w:
        meta = (w.getframerate(), w.getsampwidth() * 8, w.getnchannels(), w.getnframes())
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.uint8).reshape(-1, 3)
    q = (raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16))
    q = np.where(q >= 1 << 23, q - (1 << 24), q).reshape(-1, 2).T / (2 ** 23 - 1)
    assert meta == (SR, 24, 2, N), meta
    lu, tp = A.lufs_integrated(q), A.true_peak_db(q)
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {meta[3]} frames = {meta[3] / SR:.3f} s, {meta[0]} Hz, {meta[1]}-bit, "
          f"{meta[2]} ch")
    print(f"integrated {lu:.2f} LUFS | true peak (4x) {tp:.2f} dBTP | sample peak {20 * np.log10(np.abs(q).max()):.2f} "
          f"dBFS | master gain {gain:+.2f} dB | glue GR max {-glue_gr.min():.2f} dB | limiter GR max {lim_gr.max():.2f} dB")
    for wmsg in WARNINGS:
        print("  note:", wmsg)
    ok = abs(lu - A.TARGET_LUFS) <= 0.1 and tp <= A.CEILING_DBTP
    if report:
        post = db(A.ctrl_to_audio(glue_gr)) * db(gain) * 10 ** (-lim_gr / 20) * gate
        stems = {name: A.fade_out(A.hp(s, 24.0), 0.25) * A.attack_env(N, 0.005) * post
                 for name, s in (("vo", vo_st), ("music", music), ("sfx", sfx))}
        print(f"stem sum vs master max abs diff: {np.abs(sum(stems.values()) - out).max():.2e}")
        ok &= print_report(rep, stems, q)
    print("RESULT:", "PASS" if ok else "FAIL")


# ═══════════════════════════════ report ═══════════════════════════════
def print_report(rep: dict, stems: dict, out: np.ndarray) -> bool:
    kw = {k: A.kweight(v) for k, v in stems.items()}
    cs = {k: np.concatenate([np.zeros(1), np.cumsum((v ** 2).sum(axis=0))]) for k, v in kw.items()}

    def L(name: str, a: float, b: float) -> float:
        i, j = S(a), S(b)
        return float(A.lufs((cs[name][j] - cs[name][i]) / max(1, j - i)))

    ok = True
    print("\nVO lines placed (lines.tsv):")
    for lid, at, end, text in rep["vo_rows"]:
        print(f"  {lid:5s} {at:6.3f} -> {end:6.3f}  {text}")
    g = rep["vo_gr"]
    print(f"VO compressor GR while speaking: mean {-g.mean():.2f} dB, max {-g.min():.2f} dB")

    # per-word margin: K-weighted power in 1 ms blocks, summed over the word's VOICED blocks only (VO 10 ms RMS
    # within 20 dB of the VO stem's loudness), so pauses between words are not counted as words
    pb = {k: (v ** 2).sum(axis=0)[:A.NC * A.CTRL].reshape(A.NC, A.CTRL).mean(axis=1) for k, v in kw.items()}
    act = 10 * np.log10(np.maximum(np.convolve(pb["vo"], np.ones(10) / 10, mode="same"), 1e-20)) \
        > A.lufs_integrated(stems["vo"]) - 20.0

    def Lw(name: str, a: float, b: float) -> float:
        i, j = int(a * 1000), int(b * 1000)
        m = act[i:j]
        return float(A.lufs(pb[name][i:j][m].mean())) if m.any() else -np.inf

    print("\nVO over music, per word (K-weighted, voiced 1 ms blocks of [onset, next onset or line end]; need >= 8 dB):")
    worst, worst_s = (99.0, ""), 99.0
    for lid, ln in VO.items():
        ws = ln["words"]
        cells = []
        for k, (t0, w) in enumerate(ws):
            t1 = ws[k + 1][0] if k + 1 < len(ws) else ln["end"]
            v, mu, sx = Lw("vo", t0, t1), Lw("music", t0, t1), Lw("sfx", t0, t1)
            m = v - mu
            ms = v - 10 * np.log10(10 ** (mu / 10) + 10 ** (sx / 10))
            cells.append(f"{w}:{m:.1f}/{ms:.1f}")
            worst_s = min(worst_s, ms)
            if m < worst[0]:
                worst = (m, f"{lid} '{w}' @ {t0:.2f}")
        print(f"  {lid}  " + "  ".join(cells))
    print(f"  (value = VO-music / VO-(music+SFX) dB)   worst VO-music margin {worst[0]:.2f} dB at {worst[1]} -> "
          f"{'PASS' if worst[0] >= 8 else 'FAIL'}   (worst VO-(music+SFX) {worst_s:.2f} dB, info)")
    ok &= worst[0] >= 8

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

    print("\nStem loudness (integrated, final gains):")
    for k, v in stems.items():
        print(f"  {k:6s} {A.lufs_integrated(v):7.2f} LUFS   peak {20 * np.log10(np.abs(v).max() + 1e-20):7.2f} dBFS")

    print("\nRMS every 0.5 s (dBFS, mix = written file; stems = momentary-ish RMS over the same 0.5 s):")
    print("     t      mix   vo     music  sfx    |")
    for t in np.arange(0.0, 45.0 - 1e-9, 0.5):
        i, j = S(t), S(t + 0.5)
        r = [10 * np.log10(np.mean(x[:, i:j] ** 2) + 1e-30) for x in (out, stems["vo"], stems["music"], stems["sfx"])]
        bar = "#" * int(max(0, (r[0] + 60) / 1.5))
        f = lambda v: f"{v:6.1f}" if v > -150 else "  -inf"
        print(f"  {t:4.1f}-{t + 0.5:4.1f} {f(r[0])} {f(r[1])} {f(r[2])} {f(r[3])} | {bar}")

    print("\nSilence windows (written file):")
    for a, b, name in ((0.0, CUES["HIT1"] - 0.4, "T 0-0.6 music (stamps only)"),
                       (CUES["STOP"], CUES["LOGO"], "stop beat 40.50-41.00"), (44.0, 45.0, "tail 44.00-45.00")):
        i, j = S(a), S(b)
        pk = np.abs(out[:, i:j]).max()
        pk_db = 20 * np.log10(pk) if pk > 0 else -np.inf
        mpk = np.abs(stems["music"][:, i:j]).max()
        mus = 20 * np.log10(mpk) if mpk > 0 else -np.inf
        if "music" in name:
            good = mus == -np.inf
            print(f"  {name:30s} music stem peak {mus:7.1f} dBFS -> {'PASS' if good else 'FAIL'}")
        else:
            good = pk == 0
            print(f"  {name:30s} mix peak {pk_db:7.1f} dBFS ({'digital silence' if pk == 0 else 'NOT silent'}) "
                  f"-> {'PASS' if good else 'FAIL'}")
        ok &= bool(good)
    end = max(np.flatnonzero(np.abs(out).max(axis=0) > 0)) / SR
    print(f"  last non-zero sample at {end:.4f} s")
    return ok


if __name__ == "__main__":
    main()
