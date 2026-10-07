"""Screen test pattern (1206x2622, iPhone 17 Pro portrait @3x) + patch list for the colour round-trip check.

Run: <venv>/bin/python tools/make_testpattern.py  ->  testpattern.png, testpattern.json
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
W, H = 1206, 2622
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'

im = Image.new('RGB', (W, H), (28, 30, 34))
d = ImageDraw.Draw(im)
f_big = ImageFont.truetype(FONT, 84)
f_mid = ImageFont.truetype(FONT, 44)
f_small = ImageFont.truetype(MONO, 26)

# grid: 30 px (10 pt) fine, 150 px coarse
for x in range(0, W, 30):
    d.line([(x, 0), (x, H)], fill=(44, 47, 53) if x % 150 else (78, 83, 92), width=1 if x % 150 else 2)
for y in range(0, H, 30):
    d.line([(0, y), (W, y)], fill=(44, 47, 53) if y % 150 else (78, 83, 92), width=1 if y % 150 else 2)

# iOS status bar zone (62 pt) + Dynamic Island guide (125 x 37 pt at y = 14 pt)
d.rectangle([0, 0, W, 186], fill=(18, 58, 120))
d.rounded_rectangle([(W - 375) // 2, 42, (W + 375) // 2, 42 + 111], radius=55, outline=(255, 210, 0), width=3)
d.text((66 * 3 - 60, 57), '9:41', font=f_mid, fill=(255, 255, 255))
d.text((W - 300, 66), 'STATUS', font=f_small, fill=(255, 255, 255))

d.text((W // 2, 260), 'TEST PATTERN', font=f_big, fill=(255, 255, 255), anchor='mm')
d.text((W // 2, 350), '1206 x 2622  ·  sRGB', font=f_mid, fill=(200, 205, 215), anchor='mm')

# resolution wedges + circle (aspect check) + text sizes
cy = 1400
d.ellipse([W // 2 - 360, cy - 360, W // 2 + 360, cy + 360], outline=(255, 255, 255), width=6)
d.line([(W // 2 - 380, cy), (W // 2 + 380, cy)], fill=(255, 255, 255), width=2)
d.line([(W // 2, cy - 380), (W // 2, cy + 380)], fill=(255, 255, 255), width=2)
for i, s in enumerate((20, 28, 36, 48, 64)):
    f = ImageFont.truetype(FONT, s)
    d.text((W // 2, 1880 + i * 80), 'Purity, proven. %d px' % s, font=f, fill=(255, 255, 255), anchor='mm')
for i in range(12):  # line pairs
    x = 90 + i * 90
    w = 1 + i // 3
    for k in range(6):
        d.line([(x + k * 2 * w, 2330), (x + k * 2 * w, 2440)], fill=(255, 255, 255), width=w)

# colour patches (sRGB 8-bit) — sampled back from the render to verify the colour round trip
colours = [
    (255, 255, 255), (230, 230, 230), (188, 188, 188), (128, 128, 128), (64, 64, 64), (16, 16, 16),
    (255, 0, 0), (0, 255, 0), (0, 0, 255), (0, 255, 255), (255, 0, 255), (255, 255, 0),
    (18, 58, 120), (31, 79, 209), (20, 130, 110), (244, 247, 251), (225, 180, 150), (120, 70, 40),
    (200, 60, 50), (60, 160, 80), (70, 100, 200), (240, 200, 60), (90, 90, 110), (180, 200, 230),
]
patches = []
pw, ph, gx, gy, x0, y0 = 170, 170, 26, 26, 54, 470
for i, c in enumerate(colours):
    r, k = divmod(i, 6)
    x = x0 + k * (pw + gx)
    y = y0 + r * (ph + gy)
    d.rectangle([x, y, x + pw - 1, y + ph - 1], fill=c)
    patches.append({'rgb': c, 'cx': x + pw / 2, 'cy': y + ph / 2, 'w': pw, 'h': ph})

# edge markers: arrows + labels, 1 px white frame on the exact border
d.rectangle([0, 0, W - 1, H - 1], outline=(255, 255, 255), width=1)
d.rectangle([3, 3, W - 4, H - 4], outline=(255, 60, 60), width=3)
d.text((W // 2, 2540), 'BOTTOM', font=f_mid, fill=(255, 210, 0), anchor='mm')
d.text((30, H // 2), 'L', font=f_big, fill=(255, 210, 0), anchor='lm')
d.text((W - 30, H // 2), 'R', font=f_big, fill=(255, 210, 0), anchor='rm')
for (x, y) in ((0, 0), (W, 0), (0, H), (W, H)):
    d.ellipse([x - 120, y - 120, x + 120, y + 120], outline=(255, 210, 0), width=4)

im.save(os.path.join(ROOT, 'testpattern.png'))
with open(os.path.join(ROOT, 'testpattern.json'), 'w') as fh:
    json.dump({'size': [W, H], 'patches': patches}, fh, indent=1)
print('wrote testpattern.png')
