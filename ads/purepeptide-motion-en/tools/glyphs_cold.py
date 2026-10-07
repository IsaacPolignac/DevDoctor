#!/usr/bin/env python3
"""P0-F (S04 part): "COLD" in DM Sans 800 -> assets/type/cold_O_counter.json (+ embedded into js/scenes/S04.js).

Output (font units, y DOWN, baseline y = 0, x = 0 at the left of the C's advance box):
  glyphs[]   {ch, adv, x, d}   exact outline of each glyph as an SVG path (curves kept, placed at its pen x)
  counter    the O's inner contour (the counter), resampled to N = 200 points by arc length, already placed at the O's x
  width      total advance with the tracking applied (tracking -0.02 em between glyphs, like every display line)
  ink        [x0, y0, x1, y1] ink box of the whole word
S04 draws COLD from these paths (one SVG), so the v-cold clip-path (the counter) is the same geometry as the glyph hole.
GPOS pair kerning is ignored on purpose (C-O / O-L / L-D carry none worth noting at -0.02 em; one layout for everyone).
Usage: python3 tools/glyphs_cold.py"""
import json
import math
import os
import re

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONT = os.path.join(ROOT, 'assets/fonts/dm-sans-latin-800-normal.woff2')
OUT = os.path.join(ROOT, 'assets/type/cold_O_counter.json')
TEXT = 'COLD'
TRACK = -0.02  # em
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
            if op == 'qCurveTo' and len(args) > 2:
                offs, end = list(args[:-1]), args[-1]
                for i, o in enumerate(offs):
                    e = end if i == len(offs) - 1 else ((o[0] + offs[i + 1][0]) / 2, (o[1] + offs[i + 1][1]) / 2)
                    for k in range(1, 33):
                        cur.append(bez(p0, [o, e], k / 32))
                    p0 = e
            else:
                for k in range(1, 33):
                    cur.append(bez(p0, args, k / 32))
        elif op in ('closePath', 'endPath'):
            if cur and start is not None and cur[-1] != start:
                cur.append(start)
            contours.append(cur)
            cur = []
    return contours


def area(c):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(c, c[1:] + c[:1]))


def resample(pts, n, dx):
    d = [0.0]
    for a, b in zip(pts, pts[1:]):
        d.append(d[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    L = d[-1]
    out, j = [], 0
    for i in range(n):
        s = L * i / n
        while j < len(d) - 2 and d[j + 1] < s:
            j += 1
        seg = d[j + 1] - d[j] or 1
        t = (s - d[j]) / seg
        a, b = pts[j], pts[j + 1]
        out.append([round(dx + a[0] + (b[0] - a[0]) * t, 2), round(-(a[1] + (b[1] - a[1]) * t), 2)])  # y down
    return out


def main():
    f = TTFont(FONT)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    upm = f['head'].unitsPerEm
    track = TRACK * upm
    x = 0.0
    glyphs, counter, xs, ys = [], None, [], []
    for i, ch in enumerate(TEXT):
        name = cmap[ord(ch)]
        adv = hmtx[name][0]
        sp = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        gs[name].draw(TransformPen(sp, (1, 0, 0, -1, x, 0)))  # y down, placed at pen x
        glyphs.append({'ch': ch, 'adv': adv, 'x': round(x, 2), 'd': sp.getCommands()})
        rec = DecomposingRecordingPen(gs)
        gs[name].draw(rec)
        cs = [c for c in flatten(rec.value) if len(c) > 2]
        for c in cs:
            xs += [x + p[0] for p in c]
            ys += [-p[1] for p in c]
        if ch == 'O':
            inner = min(cs, key=lambda c: abs(area(c)))  # the counter is the smaller contour
            counter = resample(inner, N, x)
        x += adv + (track if i < len(TEXT) - 1 else 0)
    data = {'font': 'DM Sans 800', 'text': TEXT, 'upm': upm, 'track': TRACK, 'n': N, 'yDown': True, 'width': round(x, 2),
            'ink': [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)], 'glyphs': glyphs, 'counter': counter}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w'), separators=(',', ':'))
    # the scene build is synchronous (no fetch): embed the same data between markers in js/scenes/S04.js
    js = os.path.join(ROOT, 'js/scenes/S04.js')
    if os.path.exists(js):
        src = open(js).read()
        blob = json.dumps(data, separators=(',', ':'))
        new, k = re.subn(r'(// <COLD>\n).*?(\n\s*// </COLD>)', lambda m: m.group(1) + '  const COLD = ' + blob + ';' + m.group(2), src, flags=re.S)
        if k:
            open(js, 'w').write(new)
            print('embedded into', js)
    cx = [p[0] for p in counter]
    cy = [p[1] for p in counter]
    print(OUT, 'width', data['width'], 'ink', data['ink'], 'counter bbox', min(cx), min(cy), max(cx), max(cy))


if __name__ == '__main__':
    main()
