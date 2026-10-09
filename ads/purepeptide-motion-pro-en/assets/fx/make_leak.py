# S08 · the wake's light leak (SHOTS §S08 / BRIEF §3.5: "one additive light-leak plate 10 f at the wake, peak f815, warm, 18 %").
# Writes two files next to this script (both deterministic, no randomness):
#   leak.png       1920x1080 RGB plate, screen-blended by #leak (z 35) over the wake f810–f820 at peak opacity 0.18 (js/shots/S08.js).
#                  Shape = the lit page blooming in the lens AROUND the phone: a halo that follows the phone's own silhouette (the
#                  distance d outside the silhouette of renders/3d/take/final/0815.png, the peak frame, measured with an ANAMORPHIC
#                  metric — vertical distances count 1.35×, so the bloom spreads sideways like the streak and spills less onto the
#                  top/bottom frame edges 90 px above and below the phone): exp(-d/110) + 0.40·exp(-d/360), weighted +22 % toward
#                  the key's up-left. INSIDE the silhouette the halo holds its edge value for 24 px (a plateau) and only then falls
#                  off as exp(-(d_in-24)/18): the MASK (below) is what stops the leak at the rail, so the plate's own drift (+10/−5 px)
#                  and scale (1.000 → 1.035 about the phone's centre, js/shots/S08.js) never open a dark seam between the rail and
#                  the bloom, and the halo is brightest AT the rail (no matte line). Plus a horizontal anamorphic streak through the
#                  screen centre (sigma 30 px core + 110 px skirt in y, 420 px in x, faded to 0 over the outer 160 px of the frame so
#                  it never meets a frame edge: a flare off the page, not a horizon). Colour: hot core (1.00, 0.88, 0.72) → amber
#                  fringe (1.00, 0.62, 0.40) by local intensity.
#   leak_mask.png  1920x1080 RGBA, alpha = 1 − feather(dilate(phone silhouette at f815, 3 px), 5 px): CSS mask-image on the plate's
#                  wrapper. The mask is ≈ 0.3 on the silhouette's own edge pixels, 0.9 at 6 px out, 1.0 by 12 px out (the bloom hugs
#                  the rail) and 0.00 on every site pixel (the display sits ≥ 15 px inside the silhouette; max mask on matte_screen is
#                  printed and asserted), so the leak never lands on the site pixels (BRIEF §3.5: no colour change on the site) and
#                  adds ≤ 0.5 % on the phone body (rim highlights stay ≤ 92 %, QC: the worst case is printed). The drift f810–f820
#                  moves the silhouette < 1 px: one mask serves all 10 f.
# Usage: python3 assets/fx/make_leak.py   (needs renders/3d/take/final/0815.png + matte_screen/0815.png; numpy, scipy, PIL)
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'renders/3d/take/final/0815.png')
MATTE = os.path.join(ROOT, 'renders/3d/take/matte_screen/0815.png')
W, H = 1920, 1080
ANISO = 1.35      # vertical distances count 1.35× (anamorphic bloom: wider than tall)
PLATEAU = 24.0    # px inside the silhouette over which the halo keeps its edge value (the mask does the cutting)
DILATE = 3        # px: mask dilation of the silhouette (MaxFilter 2·DILATE + 1)
FEATHER = 5.0     # px: Gaussian feather of the dilated silhouette
PEAK = 0.18       # the shot's peak opacity (js/shots/S08.js), for the worst-case print only


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


alpha = np.asarray(Image.open(SRC).convert('RGBA'))[..., 3]
sil = alpha > 127
ys, xs = np.where(sil)
cx, cy = (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0  # the phone's centre at f815 (≈ 971, 540)
print(f'silhouette bbox x {xs.min()}–{xs.max()} y {ys.min()}–{ys.max()}, centre ({cx:.1f}, {cy:.1f}), {sil.sum()} px')

# ---- the plate -------------------------------------------------------------------------------------------------------
d = distance_transform_edt(~sil, sampling=[ANISO, 1.0])  # anamorphic px outside the silhouette (0 inside)
din = distance_transform_edt(sil)  # px inside the silhouette (0 outside)
Y, X = np.mgrid[0:H, 0:W].astype(float)
inner = np.exp(-np.maximum(din - PLATEAU, 0.0) / 18.0)  # 1.0 for the first 24 px inside, then gone within ≈ 40 px more
halo = (np.exp(-d / 110.0) + 0.40 * np.exp(-d / 360.0)) * inner
ang = np.arctan2(Y - cy, X - cx)  # screen coords (y down): up-left = -3π/4
halo *= 1.0 + 0.22 * np.cos(ang + 3 * np.pi / 4)
gy = np.exp(-0.5 * ((Y - cy) / 30.0) ** 2) + 0.35 * np.exp(-0.5 * ((Y - cy) / 110.0) ** 2)
gx = np.exp(-0.5 * ((X - cx) / 420.0) ** 2) * (1.0 + 0.10 * np.tanh((X - cx) / 300.0))  # a touch longer to the right (the fill side), seamless
edge = smooth(X, 0, 160) * (1 - smooth(X, W - 160, W)) * smooth(Y, 0, 60) * (1 - smooth(Y, H - 60, H))
streak = 0.75 * gy * gx * edge
V = halo + streak
V = 1 - np.exp(-V / 1.1)  # soft knee: the halo at the phone's edge reads against the streak instead of being normalised away
V /= V.max()
inner_c = np.array([1.00, 0.88, 0.72])
outer_c = np.array([1.00, 0.62, 0.40])
k = (V ** 0.6)[..., None]
col = outer_c * (1 - k) + inner_c * k
rgb = np.clip(col * V[..., None] * 255.0 + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(rgb, 'RGB').save(os.path.join(HERE, 'leak.png'), optimize=True)
dpx = distance_transform_edt(~sil)  # plain px, for the prints
ring = lambda a, b: (dpx > a) & (dpx < b)
print(f'leak.png: max {V.max():.2f}, mean {V.mean():.3f}; at the silhouette edge {V[ring(0, 2)].mean():.2f}, 24 px inside '
      f'{V[sil & (din > 23) & (din < 25)].mean():.2f}, at 100 px {V[ring(99, 101)].mean():.2f}, at 300 px {V[ring(299, 301)].mean():.2f}; '
      f'top row max {V[0].max():.2f}, bottom row max {V[-1].max():.2f}, left/right col max {V[:, 0].max():.2f}/{V[:, -1].max():.2f}')

# ---- the mask ----------------------------------------------------------------------------------------------------------
m = Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * DILATE + 1)).filter(ImageFilter.GaussianBlur(FEATHER))
m = np.asarray(m).astype(float) / 255.0
mask = np.zeros((H, W, 4), np.uint8)
mask[..., :3] = 255
mask[..., 3] = np.clip((1 - m) * 255.0 + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(mask, 'RGBA').save(os.path.join(HERE, 'leak_mask.png'), optimize=True)
mk = mask[..., 3] / 255.0
print('leak_mask.png (1 = leak passes) vs px outside the silhouette 0/2/4/6/8/12: ' +
      ' '.join(f'{mk[ring(k - 0.5, k + 0.5)].mean():.2f}' for k in (0, 2, 4, 6, 8, 12)) +
      '; inside 2/5/8/12 px: ' + ' '.join(f'{mk[sil & (din > k - 0.5) & (din < k + 0.5)].mean():.3f}' for k in (2, 5, 8, 12)))
pm = V * mk
print('plate × mask vs px outside 0/2/4/6/8/12/20/40: ' + ' '.join(f'{pm[ring(k - 0.5, k + 0.5)].mean():.2f}' for k in (0, 2, 4, 6, 8, 12, 20, 40)))
if os.path.exists(MATTE):
    ms = np.asarray(Image.open(MATTE).convert('L')) > 127
    worst_site = mk[ms].max()
    print(f'max mask on the site pixels (matte_screen f815): {worst_site:.4f} (display ≥ {din[ms].min():.1f} px inside the silhouette)')
    assert worst_site < 1 / 255.0, 'the leak reaches the site pixels: tighten DILATE/FEATHER'
# the leak the phone body would see at peak (opacity 0.18) on a 92 % rim pixel, screen blend: worst case over the body
body_leak = PEAK * pm * sil
worst = body_leak.max()
print(f'worst-case leak on the phone body at peak: {worst:.4f} → a 92 % pixel becomes {1 - 0.08 * (1 - worst):.4f}')
