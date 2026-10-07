"""S01 timing + look test (BRIEF §9/§10.2): f54 / f90 / f117 at 32 spp, 1080p, full settings.
Reports s/frame (> 36 → 24 spp; still > 36 → --range 42-126), the print sharpness (Laplacian variance over the word
region, must peak at f117), clipping (fraction of pixels > 92 % outside the highlight point) and the drop's highlight.

usage: PY blender/tests/s01_timing.py [--range 54,90,117] [--samples 32] [--pct 100]
outputs: renders/3d/s01_test/beauty/####.png, sheet.png, result.json
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import common as C  # noqa: E402
import s01_droplet as S  # noqa: E402


def laplacian_var(g):
    k = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(k.var())


def measure(outdir, f):
    im = C.R.read_png(os.path.join(outdir, 'beauty', '%04d.png' % f))[..., :3]
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    H, W = lum.shape
    word = lum[int(H * 0.35):int(H * 0.75), int(W * 0.2):int(W * 0.8)]
    hot = lum > 0.92
    ys, xs = np.where(hot)
    peak = {'px': int(hot.sum()), 'cx': round(float(xs.mean()), 1) if xs.size else None, 'cy': round(float(ys.mean()), 1) if ys.size else None}
    bright = np.argmax(lum)
    return {'frame': f, 'mean_lum': round(float(lum.mean()), 4), 'p99_lum': round(float(np.percentile(lum, 99)), 3),
            'clip_px_gt_92pct': peak, 'brightest_px_xy': [int(bright % W), int(bright // W)],
            'word_region_laplacian_var': round(laplacian_var(word) * 1e4, 3)}


def main():
    ap = C.cli('S01 timing test', default_range='54,90,117')
    args = ap.parse_args()
    C.lock()
    samples = args.samples or 32
    scene = S.build(denoise=not args.no_denoise, samples=samples)
    outdir = args.out or os.path.join(C.RENDERS, 's01_test')
    frames = C.parse_range(args.range)
    times = C.render(scene, None, frames, args.pct, samples, False, outdir, force=True, denoise=not args.no_denoise)
    res = {'samples': samples, 'pct': args.pct, 's_per_frame': [round(t, 1) for t in times],
           'avg_s_per_frame': round(sum(times) / len(times), 1) if times else None,
           'frames': [measure(outdir, f) for f in frames]}
    avg = res['avg_s_per_frame'] or 0
    res['decision'] = ('32 spp OK' if avg <= 36 else '> 36 s/f: use 24 spp (then --range 42-126 if still > 36)')
    json.dump(res, open(os.path.join(outdir, 'result.json'), 'w'), indent=1)
    C.contact_sheet([os.path.join(outdir, 'beauty', '%04d.png' % f) for f in frames], os.path.join(outdir, 'sheet.png'),
                    cols=3, tile=(640, 360), labels=['f%d' % f for f in frames])
    print('RESULT', json.dumps(res), flush=True)


if __name__ == '__main__':
    main()
