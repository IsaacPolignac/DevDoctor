# Usage: python3 tools/sheet.py <snap-dir> [cols]  -> <snap-dir>/contact-sheet.png (labelled 4x3 grid)
import sys, glob, re
from PIL import Image, ImageDraw
d = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
fs = sorted(f for f in glob.glob(d + "/frame-*.png"))
w, h = 640, 360
rows = (len(fs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    t = re.search(r"at-([\d.]+)s", f).group(1)
    dr.text((x + 8, y + 6), t + " s", fill=(255, 210, 0))
sheet.save(d + "/contact-sheet.png")
print(d + "/contact-sheet.png")
