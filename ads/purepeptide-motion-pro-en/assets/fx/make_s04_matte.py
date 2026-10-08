# S04 soft luma mattes of the sealed cap (cap.mp4) for the two horizontal light passes (SHOTS §S04: "two quick horizontal light
# passes (6 f each) over the sealed cap on f336 = VO.w('L04',0) and f357 = VO.w('L04',2)"). Same recipe as assets/fx/make_s03_matte.py.
#   frame 25 (media 1.000 s = f336, the centre of pass A f333–f339) → s04_matte_a.png
#   frame 42 (media 1.708 s ≈ f357, the centre of pass B f354–f360) → s04_matte_b.png
# matte = max(0.9 · silhouette, smoothstep(luma, 12, 120)), blurred 6 / 3 px (0.9, not S03's 0.75: the cap is one object and the
# blue cap's luma only reaches 0.78), then faded to 0 over the top 48 px and the
# bottom 90 px of the frame (the crimp and the shoulder touch the bottom edge in every frame of this plate) so a band inside
# the matte can never meet a frame edge with a hard line (QC rule). RGBA PNG: RGB white, alpha = matte (CSS mask-image reads
# the alpha). The plate's black is exactly 0 in the corners (measured on frames 1 / 25 / 42 / 60 / 73).
# Usage: ffmpeg -i assets/plates/ai/cap.mp4 <dir>/%03d.png ; python3 assets/fx/make_s04_matte.py <dir> assets/fx
import sys
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


for fr, name in ((25, 'a'), (42, 'b')):
    rgb = np.array(Image.open(f'{SRC}/{fr:03d}.png').convert('RGB')).astype(float)
    L = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    H, W = L.shape
    sil = np.zeros_like(L)
    for y in range(H):  # per-row span of the cap + crimp + shoulder (the plate is black outside it)
        xs = np.where(L[y, 380:1540] > 14)[0]
        if len(xs) > 20:
            sil[y, 380 + xs.min():380 + xs.max() + 1] = 1
    sil = np.array(Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
    lum = np.array(Image.fromarray((smooth(L, 12, 120) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 255
    m = np.maximum(0.9 * sil, lum)
    yy = np.arange(H)[:, None].astype(float)
    m *= smooth(yy, 0, 48) * (1 - smooth(yy, 990, 1070))  # never a hard line on the top / bottom frame edge
    out = np.zeros(L.shape + (4,), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (m * 255).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{OUT}/s04_matte_{name}.png', optimize=True)
    blue = (rgb[..., 2] - rgb[..., 0] > 60) & (rgb[..., 2] > 120)  # the blue cap
    bc, br = np.where(blue.any(axis=0))[0], np.where(blue.any(axis=1))[0]
    cols = np.where(sil.max(axis=0) > 0.5)[0]
    rows = np.where(sil.max(axis=1) > 0.5)[0]
    print(f'{name}: frame {fr}  object x {cols.min()}–{cols.max()}  y {rows.min()}–{rows.max()}  cap x {bc.min()}–{bc.max()} '
          f'y {br.min()}–{br.max()}  matte>0.5 px {int((m > 0.5).sum())}')
