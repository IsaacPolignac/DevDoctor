# S10 · the seat-back stand-ins (SHOTS §S10 QC "the seat-back ends with lift 0.0 / scale 1.0 (the page shows no ghost offset) by f1044").
# The shipped take hides each slab ONE frame after it reaches lift 0, while its 1 mm body still stands on the glass (bevel ring, the
# face 1 mm proud = a (−3, +1) px parallax against the page's own original at spin 16°) WITH its contact shadow at the full umbra
# (tools/post_layers.py: rgb *= 1 − 0.35·blur4(1 − shadow)·matte_screen, 34 % at contact): total f1034 → f1035, name f1039 → f1040,
# stepper f1044 → f1045 (S11's first frame) — three one-frame pops. A plain cross-dissolve of the last seated frame (the first stand-in)
# fixes the pop but doubles every glyph for 3 f (face and page original 3 px apart). So each slab is split into TWO layers, both from
# the shipped render (nothing new is printed, nothing is lifted that was not lifted), placed at the same stage box:
#   s10_seat_<k>_face.png   the slab itself on its last seated frame h−1: final/(h−1) RGB inside the slab's own ID matte
#                           (matte_cards connected component that vanishes on h, dilated 1 px so the dark bevel ring stays whole,
#                           0.6 px soft edge). js/shots/S10.js slides it by the measured parallax (dx, dy) INTO REGISTER with the
#                           page's original while it fades: the face sinks the last millimetre into the glass, no double image.
#   s10_seat_<k>_shade.png  the slab's own contact shadow as a BLACK layer whose alpha is exactly post_layers.py's darkening ratio
#                           1 − k(h−1)/k(h), k = 1 − 0.35·blur4(1 − shadow_pass)·matte_screen (the shadow pass, not the beauty: no
#                           text in it), kept within 32 px of the slab (soft 4 px edge) so the OTHER slabs' moving shadows (the
#                           stepper is still seating while the total and the name vanish) never enter it. Black × alpha in sRGB is
#                           the same multiply post_layers does, so at opacity 1 it re-creates the umbra on whatever take frame lies
#                           beneath (the drift ≤ 0.5 px over 4 f): the CSS opacity table lifts it off the page.
# Also writes s10_seat.json (per slab: hidden frame h, box origin/size, the measured parallax (dx, dy) — the numbers S10.js carries).
# Usage: python3 assets/fx/make_s10_seat.py   (needs renders/3d/take/{final,matte_cards,matte_screen,shadow}; numpy, scipy, PIL)
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TAKE = os.path.join(ROOT, 'renders', '3d', 'take')
HERE = os.path.dirname(os.path.abspath(__file__))
HIDDEN = {'total': 1035, 'name': 1040, 'stepper': 1045}  # the first frame each slab is gone (seat + 14 f + 1)
NEAR, PAD = 32, 40  # the own-shadow reach (px from the slab) and the box padding around the slab


def rd(sub, f, mode='RGBA'):
    return np.asarray(Image.open(os.path.join(TAKE, sub, '%04d.png' % f)).convert(mode), np.float32) / 255.0


def _box(a, r, axis):  # tools/post_layers.py (same blur, same numbers)
    a = np.moveaxis(a, axis, 0)
    pad = np.concatenate([np.repeat(a[:1], r + 1, 0), a, np.repeat(a[-1:], r, 0)], 0)
    c = np.cumsum(pad, 0, dtype=np.float64)
    out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    return np.moveaxis(out, 0, axis).astype(np.float32)


def gaussian(arr, sigma):
    r = max(1, int(round((math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2)))
    out = arr
    for axis in (0, 1):
        for _ in range(3):
            out = _box(out, r, axis)
    return out


def kfac(f):
    """post_layers.py step 3 multiplier for frame f (1 outside f945–f1044)"""
    if not 945 <= f <= 1044:
        return np.ones((1080, 1920), np.float32)
    sh = Image.open(os.path.join(TAKE, 'shadow', '%04d.png' % f)).convert('RGB').resize((1920, 1080), Image.BILINEAR)
    sh = np.asarray(sh, np.float32)[..., 0] / 255.0
    return 1.0 - 0.35 * gaussian(1.0 - sh, 4.0) * rd('matte_screen', f, 'L')


def parallax(face, page, inner):
    """(dx, dy) such that page(p + d) ≈ face(p) on the face's glyph pixels (¼ px grid)"""
    txt = inner & (face < 150)
    best = None
    for dy in np.arange(-1.0, 3.01, 0.25):
        for dx in np.arange(-5.0, 1.01, 0.25):
            e = np.abs(face - nd.shift(page, (-dy, -dx), order=1, mode='nearest'))[txt].mean()
            if best is None or e < best[0]:
                best = (e, float(dx), float(dy))
    return best


def main():
    meta = {}
    for k, h in HIDDEN.items():
        m0, m1 = rd('matte_cards', h - 1)[..., 0], rd('matte_cards', h)[..., 0]
        lab, n = nd.label(m0 > 0.02)
        comps = [(float((m1[lab == i] < 0.02).mean()), int((lab == i).sum()), i) for i in range(1, n + 1)]
        gone, size, idx = max(c for c in comps if c[1] >= 200)
        if gone < 0.99:
            raise SystemExit('%s: no slab vanishes between f%d and f%d (gone %.3f) — the take changed: look' % (k, h - 1, h, gone))
        comp = lab == idx
        ys, xs = np.where(comp)
        x0, y0, x1, y1 = xs.min() - PAD, ys.min() - PAD, xs.max() + 1 + PAD, ys.max() + 1 + PAD
        fin0, fin1 = rd('final', h - 1), rd('final', h)
        if fin0[y0:y1, x0:x1, 3].min() < 0.999:
            raise SystemExit('%s: the box leaves the phone — the patch must sit on opaque phone pixels' % k)
        # the face: the slab's own matte, dilated 1 px (whole bevel ring), 0.6 px soft edge
        face_a = np.clip(gaussian(nd.binary_dilation(comp, iterations=1).astype(np.float32), 0.6) * 1.15, 0, 1)
        face = np.concatenate([fin0[..., :3], face_a[..., None]], -1)[y0:y1, x0:x1]
        # the shade: post_layers' own darkening ratio, own slab only
        a = np.clip(1.0 - kfac(h - 1) / np.maximum(kfac(h), 1e-3), 0, 1)
        near = np.clip(gaussian(nd.binary_dilation(comp, iterations=NEAR).astype(np.float32), 4.0), 0, 1)
        sa = (a * near)[y0:y1, x0:x1]
        shade = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
        shade[..., 3] = sa
        # the parallax face → page original (both Y, the page = the take's first frame without the slab)
        e, dx, dy = parallax(fin0[..., :3].mean(-1), fin1[..., :3].mean(-1), nd.binary_erosion(comp, iterations=6))
        for suf, arr in (('face', face), ('shade', shade)):
            Image.fromarray(np.clip(np.round(arr * 255), 0, 255).astype(np.uint8), 'RGBA').save(
                os.path.join(HERE, 's10_seat_%s_%s.png' % (k, suf)), optimize=True)
        meta[k] = {'hidden': h, 'from': 'final/%04d.png' % (h - 1), 'left': int(x0), 'top': int(y0), 'width': int(x1 - x0),
                   'height': int(y1 - y0), 'dx': dx, 'dy': dy, 'fit_err': round(float(e), 2), 'shade_max': round(float(sa.max()), 3)}
        print(k, meta[k])
    with open(os.path.join(HERE, 's10_seat.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)


if __name__ == '__main__':
    main()
