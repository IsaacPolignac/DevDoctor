# Usage: ffmpeg -i assets/plates/ai/hero.mp4 <dir>/%03d.png ; python3 assets/fx/make_s03_matte.py <dir> assets/fx   (writes s03_matte_a/b.png)
# S03 soft luma matte of the vial (hero.mp4) — frame 8 (≈ f225, the S02 band carry) and frame 45 (≈ f272, the measuring pass).
# matte = max(0.65 * silhouette, smoothstep(luma, 12, 120)); silhouette = per-row span of luma > 14 (x 650–1250), blurred.
import sys, numpy as np
from PIL import Image, ImageFilter
SC = sys.argv[1]; OUT = sys.argv[2]
def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
for fr, name in ((8, 'a'), (45, 'b')):
    rgb = np.array(Image.open(f'{SC}/{fr:03d}.png').convert('RGB')).astype(float)
    L = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    sil = np.zeros_like(L)
    for y in range(L.shape[0]):
        xs = np.where(L[y, 650:1250] > 14)[0]
        if len(xs) > 20: sil[y, 650 + xs.min():650 + xs.max() + 1] = 1
    sil = np.array(Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255
    lum = np.array(Image.fromarray((smooth(L, 12, 120) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 255
    m = np.maximum(0.65 * sil, lum)
    out = np.zeros(L.shape + (4,), np.uint8); out[..., :3] = 255; out[..., 3] = (m * 255).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{OUT}/s03_matte_{name}.png', optimize=True)
    # label rows (blue stripes: B > R + 60) in the centre column
    pass

    print(name, "frame", fr, "matte px>0.5:", int((m > 0.5).sum()))
