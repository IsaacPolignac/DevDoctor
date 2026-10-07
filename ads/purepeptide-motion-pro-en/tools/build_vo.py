#!/usr/bin/env python3
"""Cuts the ElevenLabs v4 take (voice « Markmont », assets/audio/vo_v4/take_markmont.mp3 — chosen over a Calen Voss take
of the same script for its wider pitch and loudness range) into its 10 lines, places each one on the picture (PLACE,
video seconds — the picture is built to the voice) and writes
  assets/audio/vo/<id>.wav, assets/audio/vo/lines.tsv (read by mix_audio.py) and js/vo.js (window.VO, read by the shots).
Cuts sit on true silences near the Whisper boundaries; every clip is re-transcribed and must match its text.
   python3 tools/build_vo.py"""
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
TEMPO = 1.0    # delivered as performed: 31 s of speech in a 45 s film

# clip id -> (video time of the speech onset, text)
PLACE = [
    ("L01", 1.00, "Pure."),
    ("L02", 2.40, "It's such an easy word to print. And such a hard one to prove."),
    ("L03", 7.60, "So we don't print it. We measure it."),
    ("L04", 11.20, "Every batch. Every single one. Tested independently. By Janoshik Analytical."),
    ("L05", 18.40, "Ninety-nine percent. Minimum."),
    ("L06", 21.60, "Shipped cold. Within twenty-four hours."),
    ("L07", 25.60, "Don't take our word for it. Open the site."),
    ("L08", 29.00, "Let the cart do the math. It's automatic."),
    ("L09", 35.00, "PurePeptide. Purity. Proven."),
    ("L10", 40.50, "purepeptide dot care"),
]
ANCH = [("pure",), ("it",), ("so",), ("every",), ("99", "ninety"), ("shipped",), ("don",), ("let",), ("pure",), ("purepeptide",)]
NUM = {"99": "ninetynine", "24": "twentyfour", "6": "six", "1": "one", "2": "two", "5": "five", "3": "three", "8": "eight",
       "200": "twohundred", "10": "ten"}


def norm(s):
    s = s.lower().replace("%", " percent").replace("$", " ").replace(".care", " dot care").replace("janosik", "janoshik").replace("apply it", "applied")
    s = re.sub(r"(\d),(\d)", r"\1\2", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return "".join(NUM.get(t, t) for t in s.split()).replace("dollars", "")


def main():
    from faster_whisper import WhisperModel
    wav = SRC / "take.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(SRC / "take_markmont.mp3"), "-ac", "1", "-ar", str(SR), str(wav)], check=True)
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
    ws = [[w[0] / TEMPO, w[1] / TEMPO, w[2]] for w in json.load(open(SRC / "take_words.json"))["words"]]
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
        if not near:                                          # no clean silence: cut at the quietest 10 ms frame
            lo, hi = int((b - 0.3) * 100), int((b + 0.3) * 100)
            i0 = lo + int(np.argmin(e[lo:hi]))
            print(f"  {PLACE[k][0]}: no silence >= 120 ms near {b:.2f}, cutting at the quietest frame {i0/100:.2f}")
            near = [(i0 / 100, i0 / 100 + 0.01)]
        # the silence nearest the Whisper boundary wins; a longer one only if it is not much farther away
        cuts.append(max(near, key=lambda g: (g[1] - g[0]) - 1.5 * abs(0.5 * (g[0] + g[1]) - b)))
    first_on = next(i for i in range(len(e)) if e[i] > floor) / 100
    last_off = next(i for i in range(len(e) - 1, 0, -1) if e[i] > floor) / 100 + 0.01
    spans = [(first_on if k == 0 else cuts[k - 1][1], cuts[k][0] if k < len(cuts) else last_off) for k in range(len(PLACE))]
    # end each clip at most 0.30 s after its last word (Whisper end): breaths and room tail before the next line go
    ends = [ws[idx[k + 1] - 1][1] if k + 1 < len(idx) else ws[-1][1] for k in range(len(PLACE))]
    loud = np.percentile(e, 95) - 28.0                         # voiced speech; breaths and room tail sit below
    def voiced_end(on, off):
        a, b = int(on * 100), int(off * 100)
        hit = [i for i in range(a, b) if e[i] > loud]
        return (hit[-1] + 1) / 100 + 0.10 if hit else off
    spans = [(on, min(off, ends[k] + 0.30, voiced_end(on, off))) for k, (on, off) in enumerate(spans)]

    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    OUT.mkdir(parents=True, exist_ok=True)
    vo, rows, last_end = {}, [], -1.0
    for k, (lid, at, text) in enumerate(PLACE):
        on, off = spans[k]
        nxt_on = spans[k + 1][0] if k + 1 < len(spans) else len(y) / SR
        off = min(off + 0.06, nxt_on - PRE - 0.005)            # release tail, never into the next line
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
        if start < last_end:                                  # slide later rather than overlap; report the slip
            print(f"  {lid}: slid {last_end - start:+.2f} s to avoid overlapping the previous line")
            at, start = round(last_end + PRE + 0.02, 3), last_end + 0.02
        last_end = start + len(clip) / SR
        ab = [[round(start + max(PRE, w[0]), 3), w[1]] for w in words]
        ab[0][0] = at                                         # first word = energy onset
        vo[lid] = dict(at=at, end=round(last_end, 3), text=text, words=ab)
        rows.append(f"{lid}\t{start:.3f}\t{on:.3f}\t{text}")
        print(f"{lid} {at:6.2f}–{last_end:6.2f} ({len(clip)/SR:.2f} s)  " + " ".join(f"{w[1]}@{w[0]:.2f}" for w in ab))
    (OUT / "lines.tsv").write_text("\n".join(rows) + "\n")
    for lid in [k for k in vo if k.endswith("a")]:              # merge the a/b parts back into one line id
        a, b = vo.pop(lid), vo.pop(lid[:-1] + "b")
        vo[lid[:-1]] = dict(at=a["at"], end=b["end"], text=a["text"] + " " + b["text"], words=a["words"] + b["words"])
    vo = dict(sorted(vo.items()))
    js = "// GENERATED by tools/build_vo.py — ElevenLabs v4 take (Markmont), word onsets on the video timeline (s).\n"
    js += "window.VO = " + json.dumps(vo, indent=1) + ";\n"
    js += "window.VO.w = (id, i) => window.VO[id].words[i][0];\n"
    (ROOT / "js" / "vo.js").write_text(js)


if __name__ == "__main__":
    main()
