#!/usr/bin/env python3
"""S01 data (SCENES §S01). Owned by S01. Re-run whenever assets/typevial/silhouette.json lands or changes.

  python3 tools/s01_build.py            # own smoothed outline (default; S02 should draw assets/s01/outline.json paths at frame 0)
  python3 tools/s01_build.py --use-s02  # adopt silhouette.json outline_d_stage verbatim instead

1. Vial outline: traced from assets/plates/ai/hero.mp4 at media 0.50 s (the same frame S02's trace_vial.py uses),
   per-row sub-pixel edges (grey > 22), median + box smoothing, RDP-simplified, then scaled 0.957 about the frame
   centre (960, 540). Two half paths (left / right), each drawn from the base centre up to the cap-top centre, so a
   DrawSVG 35 % → 100 % grows both flanks bottom-up and closes at the cap.
   If assets/typevial/silhouette.json exists and carries `label_c` (stage px, at canvas scale 0.957), that anchor wins.
2. assets/s01/distress.png: seeded rubber-stamp wear mask (white, alpha = ink) for the cheap stamps.
3. Writes assets/s01/outline.json (paths, label_c, clean-"pure" placement) and html/S01.html (markup fragment).
"""
import json
import re
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
S = 0.957          # canvas scale at f0 (SCENES §S01/§S02)
CX, CY = 960.0, 540.0
TH = 22.0          # grey threshold: glass edge vs the plate's pure black
FONT_PX = 150      # clean "pure", DM Sans 800
TRACK = -0.02      # display tracking (em)


def grab_frame():
    out = os.path.join(ROOT, 'assets/s01/.hero050.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.5', '-i', os.path.join(ROOT, 'assets/plates/ai/hero.mp4'),
                    '-frames:v', '1', out], check=True)
    im = cv2.imread(out)
    os.remove(out)
    return im


def edges(g):
    """Sub-pixel left/right threshold crossings per row (search window x 600–1320 keeps out stray pixels)."""
    rows = {}
    for y in range(g.shape[0]):
        r = g[y, 600:1320]
        idx = np.where(r > TH)[0]
        if len(idx) < 40:
            continue
        i0, i1 = idx[0], idx[-1]
        # interpolate the crossing between the last dark and first bright pixel
        def cross(a, b, va, vb):
            return a + (TH - va) / (vb - va) * (b - a) if vb != va else float(b)
        xl = cross(i0 - 1, i0, r[i0 - 1], r[i0]) + 600 if i0 > 0 else 600.0
        xr = cross(i1 + 1, i1, r[i1 + 1], r[i1]) + 600 if i1 < len(r) - 1 else 1320.0
        rows[y] = (xl, xr)
    return rows


def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts.tolist()
    a, b = pts[0], pts[-1]
    d = b - a
    n = np.hypot(*d) or 1.0
    dist = np.abs(d[0] * (pts[:, 1] - a[1]) - d[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [a.tolist(), b.tolist()]


def sc(x, y):
    return CX + (x - CX) * S, CY + (y - CY) * S


def distress(path, seed=11, w=640, h=320):
    rng = np.random.default_rng(seed)
    a = np.ones((h, w), np.float32)
    # low-frequency wear: blurred noise, thresholded into soft bald patches (~9 %)
    lo = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 9)
    lo = (lo - lo.mean()) / lo.std()
    a -= np.clip((lo - 1.35) * 1.6, 0, 1)
    # mid streaks (dragged rubber), horizontal-ish
    st = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), sigmaX=14, sigmaY=1.6)
    st = (st - st.mean()) / st.std()
    a -= np.clip((st - 1.7) * 1.2, 0, 0.85)
    # fine speckle holes (~6 %)
    sp = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 0.9)
    sp = (sp - sp.mean()) / sp.std()
    a -= np.clip((sp - 1.6) * 2.5, 0, 1)
    a = np.clip(a, 0, 1)
    a = 0.12 + 0.88 * a  # never fully bald: the word must stay legible
    rgba = np.dstack([np.full((h, w), 255, np.uint8)] * 3 + [(a * 255).astype(np.uint8)])
    cv2.imwrite(path, rgba)


def pure_metrics():
    """Ink box of 'pure' in DM Sans 800 at FONT_PX with TRACK (Chrome adds letter-spacing after every glyph)."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.boundsPen import BoundsPen
    f = TTFont(os.path.join(ROOT, 'assets/fonts/dm-sans-latin-800-normal.woff2'))
    upm = f['head'].unitsPerEm
    cmap, hm, gs = f.getBestCmap(), f['hmtx'], f.getGlyphSet()
    k = FONT_PX / upm
    pen = 0.0
    xmin, xmax = None, None
    for ch in 'pure':
        g = cmap[ord(ch)]
        bp = BoundsPen(gs)
        gs[g].draw(bp)
        b = bp.bounds
        x0, x1 = pen + b[0] * k, pen + b[2] * k
        xmin = x0 if xmin is None else min(xmin, x0)
        xmax = x1 if xmax is None else max(xmax, x1)
        pen += hm[g][0] * k + TRACK * FONT_PX
    return {'ink_x0': xmin, 'ink_x1': xmax, 'xheight': f['OS/2'].sxHeight * k}


def main():
    os.makedirs(os.path.join(ROOT, 'assets/s01'), exist_ok=True)
    im = grab_frame()
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 0.8)
    rows = edges(g)
    # vial body ends where the base heel meets its reflection: narrowest row in y 960–1000
    ys = sorted(rows)
    y_top = ys[0]
    y_bot = min(range(960, 1000), key=lambda y: rows[y][1] - rows[y][0] if y in rows else 1e9)
    Y = np.arange(y_top, y_bot + 1)
    L = np.array([rows[y][0] for y in Y])
    R = np.array([rows[y][1] for y in Y])
    from scipy.ndimage import median_filter, uniform_filter1d  # noqa
    L = uniform_filter1d(median_filter(L, 9, mode='nearest'), 3, mode='nearest')
    R = uniform_filter1d(median_filter(R, 9, mode='nearest'), 3, mode='nearest')
    # the glass body is a straight cylinder: replace the stripe-notched flank rows (y 405–950) by a least-squares line
    body = (Y >= 405) & (Y <= 950)
    for E in (L, R):
        k, b = np.polyfit(Y[body], E[body], 1)
        E[body] = k * Y[body] + b
    axis = float(np.median((L + R)[(Y > 420) & (Y < 940)] / 2))
    top_y = y_top - 0.5
    # half outlines, base centre → base corner → flank (bottom-up) → cap-top centre
    left = [(axis, y_bot)] + [(L[i], Y[i]) for i in range(len(Y) - 1, -1, -1)] + [(axis, top_y)]
    right = [(axis, y_bot)] + [(R[i], Y[i]) for i in range(len(Y) - 1, -1, -1)] + [(axis, top_y)]
    left, right = rdp(left, 0.7), rdp(right, 0.7)

    def path(pts):
        p = [sc(x, y) for x, y in pts]
        return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in p)

    # label band = between the two blue stripes (blue-dominant rows on the axis)
    col = im[:, int(axis) - 50:int(axis) + 50].astype(int).mean(axis=1)
    blue = [y for y in range(380, 960) if col[y][0] - col[y][2] > 50 and col[y][0] < 140]
    s1 = [y for y in blue if y < 650]
    s2 = [y for y in blue if y > 650]
    lab_y = (np.mean(s1) + np.mean(s2)) / 2
    label_c = list(sc(axis, lab_y))
    sil = os.path.join(ROOT, 'assets/typevial/silhouette.json')
    src = 'own trace'
    if os.path.exists(sil):
        try:
            j = json.load(open(sil))
            if 'label_c' in j:
                lc = j['label_c']
                label_c = [float(lc[0]), float(lc[1])] if isinstance(lc, (list, tuple)) else [float(lc['x']), float(lc['y'])]
                src = 'silhouette.json'
        except Exception as e:  # keep the own trace
            print('WARN silhouette.json unreadable:', e, file=sys.stderr)
    # The outline itself: S02 owns the trace (silhouette.json outline_d_stage = typevial.mp4 frame 0). Use it verbatim
    # (split into two bottom-up halves) so the f104 → f105 hand-off is geometry-identical; own trace is the fallback.
    # Default: the own smoothed trace (S02's raw trace notches 3–4 px at the label stripes). --use-s02 adopts S02's path.
    if '--use-s02' in sys.argv and os.path.exists(sil):
        try:
            j = json.load(open(sil))
            P = [(float(a), float(b)) for a, b in re.findall(r'(-?[\d.]+)[ ,](-?[\d.]+)', j['outline_d_stage'])]
            ymax = max(y for _, y in P)
            base = [i for i, (_, y) in enumerate(P) if y >= ymax - 0.05]
            iBL, iBR = base[0], base[-1]
            ax = CX + (float(j['axis_src']) - CX) * S
            top = P[0][1]
            bot = ymax
            lh = [(ax, ymax)] + P[iBL::-1] + [(ax, top)]
            rh = [(ax, ymax)] + P[iBR:] + [(ax, P[-1][1])]
            sp = lambda pts: 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in rdp(pts, 0.25))
            out_paths = (sp(lh), sp(rh), ax, top, bot)
            src += ' + outline_d_stage'
        except Exception as e:
            print('WARN silhouette.json outline unusable, keeping own trace:', e, file=sys.stderr)
            out_paths = None
    else:
        out_paths = None
    m = pure_metrics()
    # clean "pure": ink box centred on label_c.x; x-height band centred on label_c.y (optical centre for lowercase)
    pure_x = label_c[0] - (m['ink_x0'] + m['ink_x1']) / 2
    pure_base = label_c[1] + m['xheight'] / 2
    bot = sc(axis, y_bot)[1]
    top = sc(axis, top_y)[1]
    out = {
        'note': 'S01 vial outline (stage px, already at canvas scale 0.957 about 960,540) + clean "pure" placement. '
                'Generated by tools/s01_build.py from hero.mp4 media 0.50 s.',
        'scale': S, 'stroke': {'width': 2, 'color': '#93A1B8', 'linecap': 'round', 'linejoin': 'round'},
        'path_left': out_paths[0] if out_paths else path(left), 'path_right': out_paths[1] if out_paths else path(right),
        'axis_x': out_paths[2] if out_paths else sc(axis, 0)[0], 'top_y': out_paths[3] if out_paths else top,
        'base_y': out_paths[4] if out_paths else bot,
        'label_c': label_c, 'label_c_source': src,
        'label_band_y': [sc(0, float(np.mean(s1)))[1], sc(0, float(np.mean(s2)))[1]],
        'pure': {'font': 'DM Sans 800', 'size': FONT_PX, 'letter_spacing_px': TRACK * FONT_PX, 'fill': '#F3F6FA',
                 'x': pure_x, 'baseline': pure_base, 'ink_x': [pure_x + m['ink_x0'], pure_x + m['ink_x1']]},
    }
    json.dump(out, open(os.path.join(ROOT, 'assets/s01/outline.json'), 'w'), indent=1)
    distress(os.path.join(ROOT, 'assets/s01/distress.png'))

    html = f'''<!-- S01 · hook · f0–f105. GENERATED by tools/s01_build.py (outline traced from hero.mp4 @0.50 s, scale 0.957). -->
<!-- Stamps are built by js/scenes/S01.js inside .s01-stamps. -->
<div class="z-back s01">
  <svg class="s01-vial" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
    <path class="s01-ol s01-ol-l" d="{out['path_left']}" />
    <path class="s01-ol s01-ol-r" d="{out['path_right']}" />
  </svg>
  <div class="s01-stamps" data-cx="{label_c[0]:.2f}" data-cy="{label_c[1]:.2f}"></div>
  <svg class="s01-clean" width="1920" height="1080" viewBox="0 0 1920 1080">
    <text class="s01-pure" x="{pure_x:.2f}" y="{pure_base:.2f}">pure</text>
  </svg>
</div>
'''
    open(os.path.join(ROOT, 'html/S01.html'), 'w').write(html)
    print(f'outline ({"S02 outline_d_stage" if out_paths else "own trace"}): axis {out["axis_x"]:.2f}, cap top {out["top_y"]:.2f}, base {out["base_y"]:.2f}')
    print(f'label_c {label_c[0]:.2f},{label_c[1]:.2f} ({src}); pure x {pure_x:.2f} baseline {pure_base:.2f} ink {out["pure"]["ink_x"]}')


if __name__ == '__main__':
    main()
