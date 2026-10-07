#!/usr/bin/env bash
# Compliance QC (BRIEF §10, SCENES Appendix B.3): snapshots every STEP s over [FROM, TO] (default 22–37 every 0.25 s),
# a contact sheet to read BY EYE, and an OCR pass (tesseract, 2x upscale) that FAILS on any forbidden word.
#   tools/qc_frames.sh [out-dir] [from] [to] [step]        e.g. tools/qc_frames.sh renders/qc 22 37 0.25
#   QC_REUSE=1 tools/qc_frames.sh renders/qc               re-run OCR + sheet on existing frames (no snapshots)
# 61 snapshots at the default settings: run it as a gate before a delivery render, not on every edit (4 shared CPUs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/renders/qc}"; FROM="${2:-22}"; TO="${3:-37}"; STEP="${4:-0.25}"
FORBID='certif|\bCOA\b|bacterio|reconstitut|Retatrutide|Recovery|repair|G ?Pay|Pharmaceutical|SECURE|syringe|needle|inject|dosage|\bdose|protocol|benefit|heal|treatment|anti-?aging|weight loss|muscle'
mkdir -p "$OUT/frames"
if [ -z "${QC_REUSE:-}" ]; then
  TIMES=$(python3 -c "import sys; a,b,s=map(float,sys.argv[1:]); n=int(round((b-a)/s)); print(','.join('%.3f'%(a+i*s) for i in range(n+1)))" "$FROM" "$TO" "$STEP")
  rm -f "$OUT"/frames/*.png
  "$ROOT/tools/snap.sh" "$OUT/frames" "$TIMES" >/dev/null
fi
python3 - "$OUT" "$FORBID" <<'PY'
import glob, os, re, subprocess, sys
from PIL import Image, ImageDraw
out, forbid = sys.argv[1], re.compile(sys.argv[2], re.I)
coa = re.compile(r'\bCOA\b')  # case-sensitive: never "coat"
fs = sorted(glob.glob(os.path.join(out, 'frames', 'frame-*.png')), key=lambda f: float(re.search(r'at-([\d.]+)s', f).group(1)))
if not fs:
    sys.exit('no frames')
# contact sheet: 6 per row at 320x180
cols, w, h = 6, 320, 180
sheet = Image.new('RGB', (cols * w, ((len(fs) + cols - 1) // cols) * (h + 22)), 'white')
d = ImageDraw.Draw(sheet)
bad = []
for i, f in enumerate(fs):
    t = float(re.search(r'at-([\d.]+)s', f).group(1))
    im = Image.open(f).convert('RGB')
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im.resize((w, h)), (x, y + 22))
    d.text((x + 4, y + 4), f't={t:.2f}  f{round(t * 30)}', fill='black')
    big = os.path.join(out, 'ocr.png')
    im.resize((im.width * 2, im.height * 2), Image.LANCZOS).save(big)
    txt = subprocess.run(['tesseract', big, '-', '--psm', '11'], capture_output=True, text=True).stdout
    hits = sorted(set(m.group(0) for m in forbid.finditer(txt) if m.group(0).upper() != 'COA')) + sorted(set(coa.findall(txt)))
    if hits:
        bad.append((t, hits))
        d.rectangle([x, y + 22, x + w - 1, y + 22 + h - 1], outline='red', width=4)
    open(os.path.join(out, 'frames', os.path.basename(f)[:-4] + '.txt'), 'w').write(txt)
os.remove(os.path.join(out, 'ocr.png'))
sheet.save(os.path.join(out, 'contact.png'))
print(f'contact sheet: {os.path.join(out, "contact.png")} ({len(fs)} frames) — READ IT BY EYE')
for t, hits in bad:
    print(f'FAIL t={t:.2f} f{round(t * 30)}: {", ".join(hits)}')
print(f'qc_frames: {len(bad)} frame(s) with forbidden words')
sys.exit(1 if bad else 0)
PY
