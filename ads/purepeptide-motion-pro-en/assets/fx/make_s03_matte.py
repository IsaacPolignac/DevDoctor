# S03 soft luma mattes of the vial (hero.mp4) for the two light passes (SHOTS §S03: "masked by a soft luma matte of the vial").
#   frame 7  (media 0.25 s ≈ f223, the middle of the S02 band carry f216–f234)  → s03_matte_a.png
#   frame 46 (media 1.875 s ≈ f272, the measuring pass f266–f278)               → s03_matte_b.png
# matte = max(0.75 · silhouette, smoothstep(luma, 12, 120)), blurred 6 / 3 px, then faded to 0 over the top 48 px and the
# bottom 90 px of the frame so a band inside the matte can never meet a frame edge with a hard line (QC rule). RGBA PNG:
# RGB white, alpha = matte (CSS mask-image reads the alpha).
# Usage: ffmpeg -i assets/plates/ai/hero.mp4 <dir>/%03d.png ; python3 assets/fx/make_s03_matte.py <dir> assets/fx
import sys
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


for fr, name in ((7, 'a'), (46, 'b')):
    rgb = np.array(Image.open(f'{SRC}/{fr:03d}.png').convert('RGB')).astype(float)
    L = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    H, W = L.shape
    sil = np.zeros_like(L)
    for y in range(H):  # per-row span of the vial (the plate is black outside it)
        xs = np.where(L[y, 650:1250] > 14)[0]
        if len(xs) > 20:
            sil[y, 650 + xs.min():650 + xs.max() + 1] = 1
    sil = np.array(Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
    lum = np.array(Image.fromarray((smooth(L, 12, 120) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 255
    m = np.maximum(0.75 * sil, lum)
    yy = np.arange(H)[:, None].astype(float)
    m *= smooth(yy, 0, 48) * (1 - smooth(yy, 990, 1070))  # never a hard line on the top / bottom frame edge
    out = np.zeros(L.shape + (4,), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (m * 255).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{OUT}/s03_matte_{name}.png', optimize=True)
    # report: the label's blue stripes (B > R + 60 across the centre columns) = the label's top / bottom edges
    blue = (rgb[:, 900:1020, 2] - rgb[:, 900:1020, 0] > 60).mean(axis=1) > 0.5
    runs, prev = [], None
    for y in np.where(blue)[0]:
        if runs and y - runs[-1][1] <= 2:
            runs[-1][1] = int(y)
        else:
            runs.append([int(y), int(y)])
    cols = np.where(sil.max(axis=0) > 0.5)[0]
    rows = np.where(sil.max(axis=1) > 0.5)[0]
    print(f'{name}: frame {fr}  vial x {cols.min()}–{cols.max()}  y {rows.min()}–{rows.max()}  matte>0.5 px {int((m > 0.5).sum())}  '
          f'blue stripes {[tuple(r) for r in runs if r[1] - r[0] >= 3]}')
