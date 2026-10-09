# S10 · the rim line (the deliberate upgrade of the SHEEN stand-in; js/shots/S10.js header "3. RIM").
# The SHEEN is SoftTop's strip crossing the glass left → right (SHOTS §S10 Light). Its 2D stand-in is the film's 105° band; where that
# band crosses the phone's RIGHT rail, the rail's rounded outer edge (already carrying a faint rim, 130–190 levels in its outer 2 px)
# catches the strip: a short line of light that RUNS DOWN the rail, top → bottom, as the band's lean (15°) meets the rail's (2.5°) —
# the film's own motif ("a line of light": S01's point, S12's last vertical line on a rail, f1188) glimpsed once, mid-film.
# This writes the line's ALPHA SHAPE only (white): per row, the rail crest 2 px inside the phone's outer silhouette on the reference
# frame (final/1005.png alpha, subpixel), a 1.2 px core + a 3.5 px glow at 35 %, kept inside the phone's alpha, and CUT wherever a
# slab stands in front of the rail (matte_cards dilated 2 px: the lifted "$234.57" overhangs the rail at rows ≈ 512–567, so the
# line passes BEHIND it — a free depth cue). WHERE along the rail it shows, and how bright, is js/shots/S10.js's per-frame mask (the
# band's own position, lean and envelope); the take drifts the edge 0.11 px/f (the setter follows it).
# Output: s10_rim.png (crop) + s10_rim.json (crop origin/size, reference frame, edge drift). Usage: python3 assets/fx/make_s10_rim.py
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TAKE = os.path.join(ROOT, 'renders', '3d', 'take')
HERE = os.path.dirname(os.path.abspath(__file__))
REF, F0, F1 = 1005, 990, 1008
INSET, CORE, GLOW, GLOW_A = 2.0, 1.2, 3.5, 0.35


def rd(sub, f, mode='RGBA'):
    return np.asarray(Image.open(os.path.join(TAKE, sub, '%04d.png' % f)).convert(mode), np.float32) / 255.0


def right_edge(alpha):
    """per row: the subpixel x where the phone's alpha falls through 0.5 on its right side (nan if none)"""
    xe = np.full(alpha.shape[0], np.nan, np.float32)
    for y in range(alpha.shape[0]):
        row = alpha[y]
        idx = np.where(row > 0.5)[0]
        if len(idx) and idx.max() + 1 < row.size:
            i = idx.max()
            xe[y] = i + 0.5 + (row[i] - 0.5) / max(row[i] - row[i + 1], 1e-3)  # pixel centres at i + 0.5
    return xe


def main():
    a = rd('final', REF)[..., 3]
    xe = right_edge(a)
    mc = nd.binary_dilation(rd('matte_cards', REF)[..., 0] > 0.02, iterations=2)
    H, W = a.shape
    x0, x1 = int(np.nanmin(xe)) - 14, int(np.nanmax(xe)) + 4
    xs = np.arange(x0, x1, dtype=np.float32) + 0.5
    out = np.zeros((H, x1 - x0), np.float32)
    for y in range(H):
        if np.isnan(xe[y]):
            continue
        d = xs - (xe[y] - INSET)
        out[y] = np.maximum(np.exp(-0.5 * (d / CORE) ** 2), GLOW_A * np.exp(-0.5 * (d / GLOW) ** 2))
    # the side button: its outline jumps the edge outward (rows where xe leaves the rail's straight line) — keep the rail line straight
    yy = np.arange(H)
    ok = ~np.isnan(xe)
    for _ in range(4):  # robust line fit: drop the button's rows and refit
        p = np.polyfit(yy[ok], xe[ok], 1)
        ok = ~np.isnan(xe) & (np.abs(xe - np.polyval(p, yy)) < 1.5)
    jump = ~(np.abs(xe - np.polyval(p, yy)) <= 3.0)
    jump = nd.binary_dilation(jump, iterations=6)
    out[jump] = 0.0
    out *= a[:, x0:x1]                       # inside the phone only
    out *= 1.0 - nd.gaussian_filter(mc[:, x0:x1].astype(np.float32), 1.0)  # behind the slabs
    rgba = np.zeros((H, x1 - x0, 4), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = np.clip(np.round(out * 255), 0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(HERE, 's10_rim.png'), optimize=True)
    # the edge drift over the sheen (px/f at mid-height), measured on the final frames
    e0, e1 = right_edge(rd('final', F0)[..., 3]), right_edge(rd('final', F1)[..., 3])
    rows = ~jump & ~np.isnan(e0) & ~np.isnan(e1)
    vx = float(np.median((e1 - e0)[rows]) / (F1 - F0))
    meta = {'ref': REF, 'left': int(x0), 'top': 0, 'width': int(x1 - x0), 'height': int(H), 'edge_fit': [round(float(p[0]), 5), round(float(p[1]), 2)],
            'cut_rows': [[int(r[0].start), int(r[0].stop) - 1] for r in nd.find_objects(nd.label(jump)[0])],
            'slab_rows': [int(yy[mc[:, x0:x1].any(1)].min()), int(yy[mc[:, x0:x1].any(1)].max())] if mc[:, x0:x1].any() else None,
            'drift_px_per_f': round(vx, 3)}
    json.dump(meta, open(os.path.join(HERE, 's10_rim.json'), 'w'), indent=1)
    print(meta)


if __name__ == '__main__':
    main()
