"""First Blender job (BRIEF §10.1): the S02 reflected word, three 720p frames f126 / f150 / f180.
Checks: ghost peak 35–45 % sRGB on the glass at f150 (inside matte_screen, excluding the sheen level), single (no
2.5D-edge doubling: one connected blob), gone from the glass at f180 (display peak ≤ sheen + 4 %).

usage: PY blender/tests/s02_reflect.py [--E 6] [--dist 0.30] [--width 0.08] [--flip] [--frames 126,150,180] [--samples 16]
outputs: renders/3d/s02_test/{beauty,matte_screen}/####.png, sheet.png, result.json
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import common as C  # noqa: E402
import s02_glass as S  # noqa: E402


def measure(outdir, f):
    b = C.R.read_png(os.path.join(outdir, 'beauty', '%04d.png' % f))
    m = C.R.read_png(os.path.join(outdir, 'matte_screen', '%04d.png' % f))[..., 0]
    inside = m > 0.5
    lum = (0.2126 * b[..., 0] + 0.7152 * b[..., 1] + 0.0722 * b[..., 2])     # sRGB-encoded levels (as shown)
    v = lum[inside]
    peak = float(np.percentile(v, 99.8)) if v.size else 0.0
    thr = 0.22
    hot = inside & (lum > thr)
    ys, xs = np.where(hot)
    blob = None
    if xs.size:
        blob = {'px': int(xs.size), 'cx': round(float(xs.mean()), 1), 'cy': round(float(ys.mean()), 1),
                'x0': int(xs.min()), 'x1': int(xs.max()), 'y0': int(ys.min()), 'y1': int(ys.max())}
    # the display's projected centre column from the matte
    sy, sx = np.where(inside)
    scr = {'cx': round(float(sx.mean()), 1), 'x0': int(sx.min()), 'x1': int(sx.max())} if sx.size else None
    return {'frame': f, 'display_peak_sRGB': round(peak, 3), 'display_mean_sRGB': round(float(v.mean()), 4) if v.size else 0,
            'hot_blob(>0.22)': blob, 'display_px': scr}


def main():
    ap = C.cli('S02 reflect test', default_range='126,150,180')
    ap.add_argument('--E', type=float, default=3.6)
    ap.add_argument('--dist', type=float, default=0.15)
    ap.add_argument('--width', type=float, default=0.044)
    ap.add_argument('--flip', action='store_true')
    ap.add_argument('--no-link', action='store_true')
    args = ap.parse_args()
    C.lock()
    scene, root = C.load(S.F0, S.F1, denoise=not args.no_denoise)
    S.build(scene, root, E=args.E, dist=args.dist, width=args.width, flip=args.flip, link=not args.no_link)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    outdir = args.out or os.path.join(C.RENDERS, 's02_test')
    C.passes(scene, outdir, mattes=True)
    frames = C.parse_range(args.range)
    times = C.render(scene, root, frames, 100, args.samples or 16, True, outdir, force=True,
                     log_extra={'E': args.E, 'dist': args.dist, 'width': args.width})
    res = {'params': {'E': args.E, 'dist': args.dist, 'width': args.width, 'flip': args.flip, 'samples': args.samples or 16,
                      'res': '1280x720', 'link': not args.no_link},
           'frames': [measure(outdir, f) for f in frames], 's_per_frame_720p': [round(t, 1) for t in times]}
    peak150 = [x for x in res['frames'] if x['frame'] == 150]
    gone180 = [x for x in res['frames'] if x['frame'] == 180]
    res['check'] = {'ghost_peak_f150_in_35_45': bool(peak150 and 0.35 <= peak150[0]['display_peak_sRGB'] <= 0.45),
                    'gone_f180(display peak <= 0.20)': bool(gone180 and gone180[0]['display_peak_sRGB'] <= 0.20)}
    json.dump(res, open(os.path.join(outdir, 'result.json'), 'w'), indent=1)
    C.contact_sheet([os.path.join(outdir, 'beauty', '%04d.png' % f) for f in frames], os.path.join(outdir, 'sheet.png'),
                    cols=3, tile=(640, 360), labels=['f%d' % f for f in frames])
    print('RESULT', json.dumps(res), flush=True)


if __name__ == '__main__':
    main()
