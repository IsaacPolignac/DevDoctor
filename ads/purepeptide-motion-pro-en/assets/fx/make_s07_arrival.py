#!/usr/bin/env python3
"""S07 crush: the frost's ARRIVAL MAP, so the crush to black (f716–f738) retraces the frost's own growth in reverse —
the cold leaves exactly the way it came, along its crystal structure, the last pool of light being the last region the
frost closed over (the label window, f684–f686) and the phone lands into it on the DROP.

    python3 assets/fx/make_s07_arrival.py          -> assets/fx/s07_arrival.png (1920x1080, 8-bit grey)

Pixel value v = the frost's arrival time, normalised: 0 = frozen on the first frost frame (f648, the four frame edges),
1 = frozen on the last arrival frame (measured: frost frame 38 = f685, the frame before "24" = VO.w('L06', 3)) or never (the 4 % of gaps between
dendrites, filled from their nearest frozen neighbour). "Arrived" = alpha >= 0.5 in assets/fx/frost/frost_####.png (the
halo union: the frame where the field is visibly frosted there). A 14 px Gaussian blur turns the per-dendrite timing into
a regional one (the crush front keeps the DLA's macro outline, not the hairline jitter). js/shots/S07.js maps v to a
per-frame black alpha through an SVG feComponentTransfer table: alpha(p, f) = power2.in(clamp((f - 716) / (22 - lead(p)))),
lead(p) = LEAD * clamp((POOL_V - v(p)) / POOL_V): the last 40 % of arrivals (v >= 0.6, the centre) keep the contract's law
exactly (black ON the DROP), the first frost finishes LEAD = 8 frames ahead of the hit. Deterministic (no randomness)."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets" / "fx" / "frost"
OUT = ROOT / "assets" / "fx" / "s07_arrival.png"
N_FRAMES = 60
N_CLOSE = 39          # frost frame 39 = f686 = "24": the label window is closed (frost_density.json: centre_cov 1.0 from frame 38)
F0 = 648
BLUR = 14.0           # px: regional timing, not per-dendrite jitter
W, H = 1920, 1080

arr = np.zeros((H, W), np.int16)  # 0 = not yet frozen
for n in range(1, N_FRAMES + 1):
    a = np.array(Image.open(SRC / f"frost_{n:04d}.png").getchannel("A"))
    arr[(a >= 128) & (arr == 0)] = n
never = arr == 0
print(f"never frozen (alpha < 0.5 on all {N_FRAMES} frames): {never.mean() * 100:.2f} % -> filled from the nearest frozen pixel")
iy, ix = distance_transform_edt(never, return_distances=False, return_indices=True)
arr_f = arr[iy, ix]
n_last = min(int(arr_f.max()), N_CLOSE)  # the last arrival (measured 38 = f685: the field is closed one frame before "24")
v = np.clip((arr_f.astype(np.float64) - 1.0) / (n_last - 1), 0.0, 1.0)
plateau = (v >= 1.0).mean()
print(f"last arrival: frost frame {int(arr_f.max())} = f{F0 + int(arr_f.max()) - 1}; v = 1 at frame {n_last} = f{F0 + n_last - 1}")
v = gaussian_filter(v, BLUR, mode="nearest")
img = np.clip(np.round(v * 255.0), 0, 255).astype(np.uint8)
Image.fromarray(img, "L").save(OUT, optimize=True)
print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB); v = 1 (the contract's law, lead 0) on {plateau * 100:.1f} % of the frame before the blur")

# where the phone lands (REST: body ≈ x 735–1185, y 90–990) and the frame's edges/corners: the lead in frames (LEAD 8, POOL_V 0.6)
LEAD, POOL_V = 8, 0.6
def lead(x, y):
    return LEAD * float(np.clip((POOL_V - v[min(H - 1, y), min(W - 1, x)]) / POOL_V, 0.0, 1.0))
rows = []
for y in (0, 90, 200, 350, 540, 700, 900, 990, 1079):
    rows.append(f"y {y:4d}: " + "  ".join(f"x{x:4d} {lead(x, y):3.1f}f" for x in (0, 300, 735, 960, 1185, 1620, 1919)))
print("lead (frames the crush finishes ahead of the DROP) at stage points:\n  " + "\n  ".join(rows))
hist, edges = np.histogram(v, bins=8, range=(0, 1))
print("v histogram (8 bins 0..1, % of the frame): " + " ".join(f"{h / v.size * 100:4.1f}" for h in hist))
