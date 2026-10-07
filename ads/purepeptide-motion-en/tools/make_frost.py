#!/usr/bin/env python3
"""P0-F (S04): seeded, tileable frost texture -> assets/fx/frost_tile.png (512x512 RGB).
White ground + #DCEBFF window-frost dendrites (fern stems in the six ice directions, 60-degree side branches), a slightly deeper
#C2D8F5 core on the main stems for depth, and a faint crystalline speckle. Drawn 2x supersampled, wrapped on a
3x3 tile grid so the pattern repeats seamlessly. S04 fills COLD with it (SVG <pattern>).
Usage: python3 tools/make_frost.py"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'assets/fx/frost_tile.png')
T = 512          # tile size (px)
SS = 2           # supersampling
S = T * SS
rng = np.random.default_rng(440)  # seeded (f440: COLD)

WHITE = (255, 255, 255)
ICE = (0xDC, 0xEB, 0xFF)
CORE = (0xC2, 0xD8, 0xF5)

img = Image.new('RGB', (S, S), WHITE)
d = ImageDraw.Draw(img)


def seg(x0, y0, x1, y1, w, col):
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            d.line([(x0 + ox, y0 + oy), (x1 + ox, y1 + oy)], fill=col, width=max(1, int(round(w))))


def branch(x, y, ang, length, w, depth, col):
    """a stem with 60-degree side branches that shrink along it (classic fern dendrite)."""
    steps = max(2, int(length / (6 * SS)))
    px, py = x, y
    for i in range(1, steps + 1):
        k = i / steps
        nx = x + math.cos(ang) * length * k
        ny = y + math.sin(ang) * length * k
        seg(px, py, nx, ny, w * (1 - 0.6 * k), col)
        if depth > 0 and i < steps and rng.random() < 0.85:
            side = length * (1 - k) * rng.uniform(0.18, 0.34)
            for sgn in (-1, 1):
                if rng.random() < 0.9:
                    branch(nx, ny, ang + sgn * math.pi / 3, side, w * 0.55, depth - 1, ICE)
        px, py = nx, ny


# window frost, not snowflakes: long fern dendrites growing in one of the six ice directions, dense short side
# branches, then a field of fine needles. Thin strokes, layered tones.
for _ in range(34):
    cx, cy = rng.uniform(0, S), rng.uniform(0, S)
    ang = rng.integers(0, 6) * math.pi / 3 + rng.normal(0, 0.08)
    branch(cx, cy, ang, rng.uniform(90, 240) * SS, 2.2 * SS, 2, CORE if rng.random() < 0.5 else ICE)
for _ in range(420):
    cx, cy = rng.uniform(0, S), rng.uniform(0, S)
    ang = rng.integers(0, 6) * math.pi / 3 + rng.normal(0, 0.1)
    branch(cx, cy, ang, rng.uniform(8, 34) * SS, 1.1 * SS, 0, ICE)

img = img.filter(ImageFilter.GaussianBlur(0.6 * SS)).resize((T, T), Image.LANCZOS)
a = np.asarray(img).astype(np.float32)
# faint crystalline speckle (tileable by construction: per-pixel noise)
spk = rng.random((T, T)) ** 24
a = a - spk[..., None] * np.array([40, 22, 0], np.float32)
a = np.clip(a, 0, 255).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
Image.fromarray(a, 'RGB').save(OUT, optimize=True)
print(OUT, a.shape, 'mean', a.reshape(-1, 3).mean(0).round(1))
