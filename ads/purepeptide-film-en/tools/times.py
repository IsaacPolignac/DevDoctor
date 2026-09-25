#!/usr/bin/env python3
"""Print snapshot times from the EDL: mode mid | all (first/mid/last frame of every picture clip)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gen_index import EDL
mode = sys.argv[1] if len(sys.argv) > 1 else 'mid'
ts = set()
for e in EDL:
    cid, t0, t1, kind = e[:4]
    if kind == 'text':
        continue
    f0, f1 = round(t0 * 30 + 0.49), round(t1 * 30 + 0.49) - 1  # first / last frame index inside [t0, t1)
    fm = (f0 + f1) // 2
    ts.update([fm] if mode == 'mid' else [f0, fm, f1])
if mode == 'all':
    ts.update([0, 45, 1605, 1620, 1650, 1680, 1766, 1799])
print(','.join('%.4f' % (f / 30) for f in sorted(ts)))
