# S08 · the wake's light leak (SHOTS §S08 / BRIEF §3.5: "one additive light-leak plate 10 f at the wake, peak f815, warm, 18 %").
# Writes two files next to this script (both deterministic, no randomness):
#   leak.png       1920x1080 RGB plate, screen-blended by #leak (z 35) over the wake f810–f820 at peak opacity 0.18 (js/shots/S08.js).
#                  Shape = the lit screen blooming in the lens AROUND the phone: a halo that follows the phone's own silhouette (the
#                  Euclidean distance d outside the silhouette of renders/3d/take/final/0815.png, the peak frame: exp(-d/110) + 0.40·
#                  exp(-d/360), falling off inward as exp(-d_in/18) so the bloom meets the rail without a dark valley), weighted +22 % toward the key's up-left, plus a horizontal anamorphic streak through the screen
#                  centre (sigma 30 px core + 110 px skirt in y, 560 px in x, faded to 0 over the outer 160 px of the frame so it never
#                  meets a frame edge). Colour: hot core (1.00, 0.88, 0.72) → amber fringe (1.00, 0.62, 0.40) by local intensity.
#   leak_mask.png  1920x1080 RGBA, alpha = 1 − feather(dilate(phone silhouette at f815, 8 px), 12 px): CSS mask-image on the plate's
#                  wrapper, so the leak never lands on the phone body (rim highlights stay ≤ 92 %, QC) nor on the site pixels (BRIEF
#                  §3.5: no colour change on the site pixels). The drift f810–f820 moves the silhouette < 1 px: one mask serves all 10 f.
# Usage: python3 assets/fx/make_leak.py   (needs renders/3d/take/final/0815.png; numpy, scipy, PIL)
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'renders/3d/take/final/0815.png')
W, H = 1920, 1080


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


alpha = np.asarray(Image.open(SRC).convert('RGBA'))[..., 3]
sil = alpha > 127
ys, xs = np.where(sil)
cx, cy = (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0  # the phone's centre at f815 (≈ 971, 540)
print(f'silhouette bbox x {xs.min()}–{xs.max()} y {ys.min()}–{ys.max()}, centre ({cx:.1f}, {cy:.1f}), {sil.sum()} px')

# ---- the plate -------------------------------------------------------------------------------------------------------
d = distance_transform_edt(~sil)  # px outside the silhouette (0 inside)
din = distance_transform_edt(sil)  # px inside the silhouette (0 outside): the plate falls off INWARD from the edge too
Y, X = np.mgrid[0:H, 0:W].astype(float)
halo = (np.exp(-d / 110.0) + 0.40 * np.exp(-d / 360.0)) * np.exp(-din / 18.0)  # inside: gone within ≈ 40 px (the mask's residual carries nothing)
ang = np.arctan2(Y - cy, X - cx)  # screen coords (y down): up-left = -3π/4
halo *= 1.0 + 0.22 * np.cos(ang + 3 * np.pi / 4)
gy = np.exp(-0.5 * ((Y - cy) / 30.0) ** 2) + 0.35 * np.exp(-0.5 * ((Y - cy) / 110.0) ** 2)
gx = np.exp(-0.5 * ((X - cx) / 560.0) ** 2) * (1.0 + 0.10 * np.tanh((X - cx) / 300.0))  # a touch longer to the right (the fill side), seamless
edge = smooth(X, 0, 160) * (1 - smooth(X, W - 160, W)) * smooth(Y, 0, 60) * (1 - smooth(Y, H - 60, H))
streak = 0.75 * gy * gx * edge
V = halo + streak
V = 1 - np.exp(-V / 1.1)  # soft knee: the halo at the phone's edge reads against the streak instead of being normalised away
V /= V.max()
inner = np.array([1.00, 0.88, 0.72])
outer = np.array([1.00, 0.62, 0.40])
k = (V ** 0.6)[..., None]
col = outer * (1 - k) + inner * k
rgb = np.clip(col * V[..., None] * 255.0 + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(rgb, 'RGB').save(os.path.join(HERE, 'leak.png'), optimize=True)
print(f'leak.png: max {V.max():.2f}, mean {V.mean():.3f}; at the silhouette edge {V[(d > 0) & (d < 2)].mean():.2f}, '
      f'at 100 px {V[(d > 99) & (d < 101)].mean():.2f}, at 300 px {V[(d > 299) & (d < 301)].mean():.2f}')

# ---- the mask ----------------------------------------------------------------------------------------------------------
m = Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(12))
m = np.asarray(m).astype(float) / 255.0
mask = np.zeros((H, W, 4), np.uint8)
mask[..., :3] = 255
mask[..., 3] = np.clip((1 - m) * 255.0 + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(mask, 'RGBA').save(os.path.join(HERE, 'leak_mask.png'), optimize=True)
print(f'leak_mask.png: mask (1 = leak passes) at the silhouette edge {(1 - m)[(d > 0) & (d < 2)].mean():.2f}, 2 px inside '
      f'{(1 - m)[sil & (distance_transform_edt(sil) < 3)].mean():.2f}, 40 px outside {(1 - m)[(d > 39) & (d < 41)].mean():.2f}')
# the leak the phone body would see at peak (opacity 0.18) on a 92 % rim pixel, screen blend: worst case over the body
body_leak = 0.18 * V * (1 - m) * sil
worst = body_leak.max()
print(f'worst-case leak on the phone body at peak: {worst:.4f} → a 92 % pixel becomes {1 - 0.08 * (1 - worst):.4f}')
