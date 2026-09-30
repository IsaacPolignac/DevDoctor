#!/usr/bin/env python3
"""Cuts the ElevenLabs v4 take (one continuous performance, voice « Markmont », assets/audio/vo_v4/take_markmont_b.mp3)
into its 15 lines, places each line on the picture (PLACE below, video seconds) and writes:
  assets/audio/vo/L01..L15.wav   one clip per line, starting 30 ms before the speech onset
  assets/audio/vo/lines.tsv      id · clip start on the video timeline · onset in the take · text  (read by mix_audio.py)
  js/vo.js                       window.VO: absolute word onsets on the video timeline (read by js/film.js)
Cutting: the take's line breaks are true silences; each boundary is the longest silence (>= 120 ms) near the
Whisper boundary between two lines. Every clip is then re-transcribed on its own (Whisper large-v3): its words must
match the line, and they give the word onsets.   python3 tools/build_vo.py"""
import json
import re
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "audio" / "vo_v4"
OUT = ROOT / "assets" / "audio" / "vo"
SR = 48000
PRE = 0.03

# line id -> (video time of the speech onset, text). Windows are set by the picture (SCENES.md).
PLACE = [
    ("L01", 2.40, "Most labels promise purity."),
    ("L02", 6.30, "Few can prove it."),
    ("L03", 12.72, "This is PurePeptide."),
    ("L04", 20.30, "Identity, confirmed. Purity, measured."),
    ("L05", 24.15, "Every batch, independently tested."),
    ("L06", 30.00, "Ninety-nine percent purity. Minimum."),
    ("L07", 33.25, "Shipped cold, within twenty-four hours."),
    ("L08", 36.10, "Six compounds. One standard."),
    ("L09", 39.20, "Buy more, save more."),
    ("L10", 42.05, "Two vials, five percent off."),
    ("L11", 44.13, "Three or more, eight percent off."),
    ("L12", 46.30, "Free shipping on orders over two hundred dollars."),
    ("L13", 50.15, "No promises. Just proof."),
    ("L14", 53.30, "PurePeptide. Purity, proven."),
    ("L15", 56.10, "Shop now, at purepeptide dot care."),
]
ANCH = [("most",), ("few",), ("this",), ("identity",), ("every",), ("99", "ninety"), ("shipped",), ("six", "6"), ("buy",),
        ("two", "2"), ("three", "3"), ("free",), ("no",), ("pure", "purepeptide"), ("shop",)]
NUM = {"99": "ninetynine", "24": "twentyfour", "6": "six", "1": "one", "2": "two", "5": "five", "3": "three", "8": "eight",
       "200": "twohundred"}


def norm(s):
    s = s.lower().replace("%", " percent").replace("$", " ").replace(".care", " dot care")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return "".join(NUM.get(t, t) for t in s.split()).replace("dollars", "")


def main():
    from faster_whisper import WhisperModel
    wav = SRC / "take.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(SRC / "take_markmont_b.mp3"), "-ac", "1", "-ar", str(SR), str(wav)], check=True)
    y, _ = sf.read(wav)
    wav.unlink()
    n = SR // 100
    k = len(y) // n
    e = 20 * np.log10(np.sqrt((y[: k * n].reshape(k, n) ** 2).mean(1) + 1e-12))
    floor = np.percentile(e, 95) - 38.0                       # speech threshold: 38 dB under the loud frames
    q = e <= floor
    gaps, i = [], 0                                           # silent runs >= 120 ms, (start, end) in s
    while i < len(q):
        if q[i]:
            j = i
            while j < len(q) and q[j]:
                j += 1
            if j - i >= 12:
                gaps.append((i / 100, j / 100))
            i = j
        else:
            i += 1
    # Whisper line boundaries on the whole take -> longest silence near each boundary
    ws = json.load(open(SRC / "take_words.json"))["words"]
    idx, j = [], 0
    for a in ANCH:
        while not any(re.sub(r"[^a-z0-9]", "", ws[j][2].lower()).startswith(x) for x in a):
            j += 1
        idx.append(j)
        j += 1
    cuts = []
    for k in range(1, len(PLACE)):
        b = 0.5 * (ws[idx[k] - 1][1] + ws[idx[k]][0])
        near = [g for g in gaps if abs(0.5 * (g[0] + g[1]) - b) < 0.8 and (not cuts or g[0] > cuts[-1][1])]
        cuts.append(max(near, key=lambda g: g[1] - g[0]))
    first_on = next(i for i in range(len(e)) if e[i] > floor) / 100
    last_off = next(i for i in range(len(e) - 1, 0, -1) if e[i] > floor) / 100 + 0.01
    spans = [(first_on if k == 0 else cuts[k - 1][1], cuts[k][0] if k < len(cuts) else last_off) for k in range(len(PLACE))]

    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    OUT.mkdir(parents=True, exist_ok=True)
    vo, rows, last_end = {}, [], -1.0
    for k, (lid, at, text) in enumerate(PLACE):
        on, off = spans[k]
        nxt_on = spans[k + 1][0] if k + 1 < len(spans) else len(y) / SR
        off = min(off + 0.12, nxt_on - PRE - 0.005)            # release tail, never into the next line
        clip = y[int((on - PRE) * SR): int(off * SR)].copy()
        f = int(0.008 * SR)
        clip[:f] *= np.linspace(0, 1, f)
        clip[-int(0.04 * SR):] *= np.linspace(1, 0, int(0.04 * SR))
        path = OUT / f"{lid}.wav"
        sf.write(path, clip, SR, subtype="PCM_24")
        segs, _ = m.transcribe(str(path), language="en", word_timestamps=True, beam_size=5)
        words = [[w.start, w.word.strip()] for s in segs for w in s.words]
        heard = " ".join(w[1] for w in words)
        assert norm(heard) == norm(text), f"{lid}: heard « {heard} » expected « {text} »"
        start = at - PRE
        assert start >= last_end, f"{lid} overlaps the previous line ({start:.2f} < {last_end:.2f})"
        last_end = start + len(clip) / SR
        ab = [[round(start + max(PRE, w[0]), 3), w[1]] for w in words]
        ab[0][0] = at                                         # first word = energy onset
        vo[lid] = dict(at=at, end=round(last_end, 3), text=text, words=ab)
        rows.append(f"{lid}\t{start:.3f}\t{on:.3f}\t{text}")
        print(f"{lid} {at:6.2f}–{last_end:6.2f} ({len(clip)/SR:.2f} s)  " + " ".join(f"{w[1]}@{w[0]:.2f}" for w in ab))
    (OUT / "lines.tsv").write_text("\n".join(rows) + "\n")
    js = "// GENERATED by tools/build_vo.py — ElevenLabs v4 take (Markmont), word onsets on the video timeline (s).\n"
    js += "window.VO = " + json.dumps(vo, indent=1) + ";\n"
    js += "window.VO.w = (id, i) => window.VO[id].words[i][0];\n"
    (ROOT / "js" / "vo.js").write_text(js)


if __name__ == "__main__":
    main()
