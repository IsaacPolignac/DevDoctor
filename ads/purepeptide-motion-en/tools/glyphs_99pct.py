#!/usr/bin/env python3
"""P0-F (S03 part): glyph outlines of "99%" in DM Sans 800 -> assets/type/99pct.json.
Each contour is flattened (quadratic/cubic segments sampled densely) and resampled to N=200 points by arc length (every outline corner kept exactly),
in font units with y DOWN (SVG convention, baseline at y=0). S03 lays the glyphs out itself (advance + tracking),
so the per-char DOM/SVG glyphs and the morph path are the same geometry.
S04 owns cold_O_counter.json (its own tool).   Usage: python3 tools/glyphs_99pct.py"""
import json
import math
import re
import os

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONT = os.path.join(ROOT, 'assets/fonts/dm-sans-latin-800-normal.woff2')
OUT = os.path.join(ROOT, 'assets/type/99pct.json')
TEXT = '99%'
N = 200


def bez(p0, ps, t):
    pts = [p0] + list(ps)
    while len(pts) > 1:
        pts = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(pts, pts[1:])]
    return pts[0]


def flatten(rec):
    contours, cur, start = [], [], None
    for op, args in rec:
        if op == 'moveTo':
            cur = [args[0]]
            start = args[0]
        elif op == 'lineTo':
            cur.append(args[0])
        elif op in ('qCurveTo', 'curveTo'):
            p0 = cur[-1]
            if op == 'qCurveTo' and len(args) > 2:  # implied on-curve points between off-curve pairs
                offs, end = list(args[:-1]), args[-1]
                segs = []
                for i, o in enumerate(offs):
                    e = end if i == len(offs) - 1 else ((o[0] + offs[i + 1][0]) / 2, (o[1] + offs[i + 1][1]) / 2)
                    segs.append((o, e))
                for o, e in segs:
                    for k in range(1, 25):
                        cur.append(bez(p0, [o, e], k / 24))
                    p0 = e
            else:
                for k in range(1, 25):
                    cur.append(bez(p0, args, k / 24))
        elif op in ('closePath', 'endPath'):
            if cur and start is not None and cur[-1] != start:
                cur.append(start)
            contours.append(cur)
            cur = []
    return contours


def resample(pts, n, corner_deg=28.0):
    """n points by arc length, but every corner of the outline (turn > corner_deg) is kept exactly: a uniform
    resample cuts the 9's tail terminal and the bowl/stem joins, which reads as notches at 330 px."""
    if pts[-1] == pts[0]:
        pts = pts[:-1]
    m = len(pts)
    def turn(i):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % m]
        u = (b[0] - a[0], b[1] - a[1]); v = (c[0] - b[0], c[1] - b[1])
        nu, nv = math.hypot(*u), math.hypot(*v)
        if nu < 1e-9 or nv < 1e-9:
            return 0.0
        return math.degrees(math.acos(max(-1.0, min(1.0, (u[0] * v[0] + u[1] * v[1]) / (nu * nv)))))
    corners = [i for i in range(m) if turn(i) > corner_deg] or [0]
    # rotate so the contour starts on a corner, then cut it into runs corner -> next corner
    pts = pts[corners[0]:] + pts[:corners[0]] + [pts[corners[0]]]
    cs = [c - corners[0] for c in corners] + [m]
    runs = [pts[a:b + 1] for a, b in zip(cs, cs[1:])]
    lens = []
    for r in runs:
        lens.append(sum(math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in zip(r, r[1:])))
    L = sum(lens)
    free = n - len(runs)  # one point per corner, the rest shared by arc length
    alloc = [free * l / L for l in lens]
    k = [int(a) for a in alloc]
    for i in sorted(range(len(runs)), key=lambda i: alloc[i] - k[i], reverse=True)[:free - sum(k)]:
        k[i] += 1
    out = []
    for r, l, kk in zip(runs, lens, k):
        out.append(r[0])
        d = [0.0]
        for a, b in zip(r, r[1:]):
            d.append(d[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        j = 0
        for i in range(1, kk + 1):
            s = l * i / (kk + 1)
            while j < len(d) - 2 and d[j + 1] < s:
                j += 1
            seg = d[j + 1] - d[j] or 1
            t = (s - d[j]) / seg
            a, b = r[j], r[j + 1]
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    assert len(out) == n, (len(out), n)
    return [[round(x, 1), round(-y, 1)] for x, y in out]  # y down


def main():
    f = TTFont(FONT)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    upm = f['head'].unitsPerEm
    glyphs = []
    for ch in TEXT:
        name = cmap[ord(ch)]
        pen = DecomposingRecordingPen(gs)
        gs[name].draw(pen)
        cs = [resample(c, N) for c in flatten(pen.value) if len(c) > 2]
        xs = [p[0] for c in cs for p in c]
        ys = [p[1] for c in cs for p in c]
        glyphs.append({'ch': ch, 'name': name, 'adv': hmtx[name][0], 'bbox': [min(xs), min(ys), max(xs), max(ys)], 'contours': cs})
    # GPOS pair kerning is ignored on purpose: S03 sets its own tracking and every consumer uses this file's layout.
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'font': 'DM Sans 800', 'text': TEXT, 'upm': upm, 'n': N, 'yDown': True, 'glyphs': glyphs}, open(OUT, 'w'), separators=(',', ':'))
    # S03.js cannot fetch at build time (sync, seek-safe build): the same data is embedded between markers in the scene file.
    js = os.path.join(ROOT, 'js/scenes/S03.js')
    if os.path.exists(js):
        src = open(js).read()
        blob = json.dumps({'upm': upm, 'glyphs': [{'ch': g['ch'], 'adv': g['adv'], 'bbox': g['bbox'], 'c': g['contours']} for g in glyphs]}, separators=(',', ':'))
        new, k = re.subn(r'(// <G99>\n).*?(\n\s*// </G99>)', lambda m: m.group(1) + '  const G99 = ' + blob + ';' + m.group(2), src, flags=re.S)
        if k:
            open(js, 'w').write(new)
            print('embedded into', js)
    print(OUT, [(g['ch'], g['adv'], len(g['contours']), g['bbox']) for g in glyphs])


if __name__ == '__main__':
    main()
