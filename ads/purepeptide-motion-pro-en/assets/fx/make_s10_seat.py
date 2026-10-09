# S10 · the seat-back patches (SHOTS §S10 QC "the seat-back ends with lift 0.0 / scale 1.0 (the page shows no ghost offset) by f1044").
# The shipped take hides each slab one frame after it reaches lift 0, while its 1 mm body still stands on the glass (bevel ring, the
# face 1 mm proud = ≈ 3 px of parallax at spin 16°) and its CONTACT shadow (tools/post_layers.py: the shadow pass × 0.35 reaches the
# full umbra at contact, final/beauty luma ratio 0.66 = a 34 % dark patch) — so the slab and a 34 % shadow vanish in ONE frame:
# total f1034 → f1035, name f1039 → f1040, stepper f1044 → f1045 (S11's first frame). The 3D fix is the lead's (end the seat at
# lift −0.98 mm, re-render 1020–1045 + shadow); until it lands, js/shots/S10.js dissolves a crop of each slab's LAST seated frame over
# the next 4 f (opacity 0.78 / 0.55 / 0.32 / 0.12, then 0), so the plate and its contact shadow sink into the page instead of popping.
# Writes three RGBA crops next to this script (deterministic, no randomness):
#   s10_seat_total.png    renders/3d/take/final/1034.png, stage box (1208, 520)–(1374, 626): the "$234.57" slab + its contact shadow
#   s10_seat_name.png     final/1039.png, box (938, 296)–(1212, 401): "BPC-157 / TB-500" + shadow (the shadow covers the "10 mg" row)
#   s10_seat_stepper.png  final/1044.png, box (944, 460)–(1193, 582): "− 3 +" + shadow
# Each box = the slab's matte_cards bbox ∪ its contact-shadow region (final/beauty luma ratio < 0.97) padded 18 px; the alpha is
# feathered to 0 over the outer 14 px, so where the page beneath is unchanged the patch is invisible (same pixels) and the take's
# drift under the patch (corners.json: ≤ 0.5 px over the 4 f) never shows a seam. Placement (left/top) = the box origin: css/S10.css.
# The pixels are the shipped render (the clean bake through Cycles): nothing new is printed, nothing is lifted that was not lifted.
# Usage: python3 assets/fx/make_s10_seat.py   (needs renders/3d/take/final/{1034,1039,1044}.png; numpy, PIL)
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FINAL = os.path.join(ROOT, 'renders', '3d', 'take', 'final')
HERE = os.path.dirname(os.path.abspath(__file__))
FEATHER = 14
PATCHES = {  # name: (frame, (x0, y0, x1, y1) stage px, exclusive x1/y1)
    'total': (1034, (1208, 520, 1374, 626)),
    'name': (1039, (938, 296, 1212, 401)),
    'stepper': (1044, (944, 460, 1193, 582)),
}


def feather(h, w, n):
    """alpha 0 → 1 over n px from every edge (smoothstep), 1 inside"""
    y = np.arange(h, dtype=np.float32)
    x = np.arange(w, dtype=np.float32)
    ey = np.minimum(np.minimum(y, h - 1 - y) / float(n), 1.0)
    ex = np.minimum(np.minimum(x, w - 1 - x) / float(n), 1.0)
    e = np.minimum(ey[:, None], ex[None, :])
    return e * e * (3 - 2 * e)


def main():
    for name, (frame, (x0, y0, x1, y1)) in PATCHES.items():
        src = os.path.join(FINAL, '%04d.png' % frame)
        im = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
        crop = im[y0:y1, x0:x1]
        a = crop[..., 3] / 255.0
        if a.min() < 0.999:
            raise SystemExit('%s: the box leaves the phone (alpha min %.3f) — the patch must sit on opaque phone pixels' % (name, a.min()))
        out = crop.copy()
        out[..., 3] = feather(y1 - y0, x1 - x0, FEATHER) * 255.0
        dst = os.path.join(HERE, 's10_seat_%s.png' % name)
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(dst, optimize=True)
        print('%s  %dx%d at (%d, %d) from final/%04d.png -> %s (%d bytes)' % (name, x1 - x0, y1 - y0, x0, y0, frame, os.path.relpath(dst, ROOT), os.path.getsize(dst)))


if __name__ == '__main__':
    main()
