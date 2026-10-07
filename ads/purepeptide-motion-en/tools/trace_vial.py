#!/usr/bin/env python3
"""P0-E (S02): trace the real vial in assets/plates/ai/hero.mp4 at media 0.50 s (24 fps source frame 12) and write
assets/typevial/silhouette.json — the shared geometry of S01 (outline + stamps) and S02 (type-vial rows).

Coordinates:
  *_src   : hero.mp4 pixel space (1920x1080) at media 0.50 = the type-vial canvas at camera scale 1.000 (f262).
  *_stage : the same point at canvas scale 0.957 about the frame centre (960,540) = what S01 draws and what
            typevial.mp4 frame 0 (f105) shows.  stage = C + 0.957 * (src - C).
push: per source frame 12..25, the affine p_k = s*p_12 + (tx,ty) that maps frame-12 geometry onto frame k
      (measured from the body width, the vial axis, the cap top and the label top edge).
Usage: python3 tools/trace_vial.py
"""
import json, os
import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'assets/plates/ai/hero.mp4')
OUT = os.path.join(ROOT, 'assets/typevial/silhouette.json')
S0, C = 0.957, (960.0, 540.0)
PITCH = 31


def frames():
    cap = cv2.VideoCapture(SRC)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f.astype(np.int32))
    return out


def edges(f, y, thr=40):
    lum = f[y].sum(1) / 3
    xs = np.where(lum > thr)[0]
    if len(xs) == 0:
        return None
    # sub-pixel: interpolate the threshold crossing on each side
    x0, x1 = xs.min(), xs.max()
    def cross(a, b):
        la, lb = lum[a], lum[b]
        return a + (thr - la) / (lb - la) if lb != la else a
    return (float(cross(x0 - 1, x0)), float(cross(x1 + 1, x1)))


def label_rows(f):
    b, r = f[..., 0], f[..., 2]
    lum = f.sum(2) / 3
    reg = slice(800, 1100)
    white = ((lum[:, reg] > 190) & (np.abs(b[:, reg] - r[:, reg]) < 40)).mean(1)
    blue = (b[:, reg] > r[:, reg] + 60).mean(1)
    return white, blue


def measure(f):
    white, blue = label_rows(f)
    ys = np.arange(1080)
    # cap top: first row with any vial pixel in the central columns
    lum = f[:, 900:1000].sum(2).mean(1) / 3
    cap_top = int(np.argmax(lum > 40))
    # label: longest run of rows with white >= .85 + stripes; take first/last white row between y 380..1000
    # label = the contiguous run of white-or-blue rows that contains y 520 (glass gaps read ~0)
    on = (white + blue) > 0.5
    lab_top = lab_bot = 520
    while on[lab_top - 1]: lab_top -= 1
    while on[lab_bot + 1]: lab_bot += 1
    # body width = median width over the label band
    ws, axes = [], []
    for y in range(lab_top + 30, lab_bot - 30, 4):
        e = edges(f, y)
        ws.append(e[1] - e[0]); axes.append((e[0] + e[1]) / 2)
    return dict(cap_top=cap_top, lab_top=lab_top, lab_bot=lab_bot, width=float(np.median(ws)), axis=float(np.median(axes)),
                white=white, blue=blue)


def main():
    F = frames()
    f = F[12]
    m = measure(f)
    white, blue = m['white'], m['blue']
    ys = np.arange(1080)
    # cap (blue) rows, stripes (blue inside label band)
    capr = np.where((blue > 0.5) & (ys < 300))[0]
    cap = [int(capr.min()), int(capr.max())]
    # stripes: runs (>= 5 rows) of blue > .6 inside the label band (the wordmark underline is 1-3 rows)
    runs, a = [], None
    for y in range(m['lab_top'], m['lab_bot'] + 1):
        if blue[y] > 0.6 and a is None: a = y
        if blue[y] <= 0.6 and a is not None:
            if y - a >= 5: runs.append((a, y - 1))
            a = None
    stripes = [float((r[0] + r[1]) / 2) for r in (runs[0], runs[-1])]
    # vial bottom: width minimum just above the reflection (search 940..1000)
    best = None
    for y in range(940, 1000):
        e = edges(f, y)
        w = e[1] - e[0]
        if best is None or w < best[1]:
            best = (y, w)
    bottom = best[0]
    # neck (narrowest run between crimp and shoulder) and shoulder end
    wid = {y: (lambda e: e[1] - e[0])(edges(f, y)) for y in range(cap[0] + 2, bottom)}
    neck = [y for y in range(260, 360) if wid[y] < 250]
    crimp = [cap[1] + 1, neck[0] - 1]
    shoulder = [neck[-1] + 1, m['lab_top'] - 1]
    zones = dict(cap=cap, crimp=crimp, neck=[neck[0], neck[-1]], shoulder=shoulder, label=[m['lab_top'], m['lab_bot']],
                 glass=[m['lab_bot'] + 1, bottom])
    # outline (src), every 2 px, smoothed
    yy = list(range(cap[0], bottom + 1, 2))
    L = np.array([edges(f, y)[0] for y in yy]); R = np.array([edges(f, y)[1] for y in yy])
    k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
    Ls = np.convolve(np.pad(L, 2, mode='edge'), k, 'valid'); Rs = np.convolve(np.pad(R, 2, mode='edge'), k, 'valid')
    pts = [(float(x), float(y)) for x, y in zip(Ls, yy)] + [(float(x), float(y)) for x, y in zip(Rs[::-1], yy[::-1])]
    def to_stage(p):
        return (C[0] + S0 * (p[0] - C[0]), C[1] + S0 * (p[1] - C[1]))
    def d(ps):
        return 'M' + ' L'.join('%.1f %.1f' % p for p in ps) + ' Z'

    # rows: pitch 31, anchored so 14 label rows sit between the two stripes
    lab0 = int(round((stripes[0] + stripes[1]) / 2 - 7 * PITCH))
    rows = []
    y = lab0
    while y - PITCH >= cap[0] - 6:
        y -= PITCH
    while y + PITCH <= bottom + 4:
        yc = y + PITCH / 2
        e = edges(f, int(round(yc)))
        # narrowest extent over the row's cap-height band keeps glyphs inside the glass
        band = [edges(f, int(yy_)) for yy_ in range(int(yc - 9), int(yc + 10))]
        x0 = max(b_[0] for b_ in band); x1 = min(b_[1] for b_ in band)
        z = next((n for n, (a, b_) in zones.items() if a <= yc < b_ + 1), 'glass')
        if z == 'label' and not (stripes[0] - 1 <= y and y + PITCH <= stripes[1] + 1):
            z = 'label_edge'  # the thin white label margin outside the stripes: no type
        rows.append(dict(y=y, yc=yc, x0=round(x0, 1), x1=round(x1, 1), zone=z))
        y += PITCH
    # label anchors (src): symbol + wordmark rows are the first two label rows
    labrows = [r for r in rows if r['zone'] == 'label']
    assert len(labrows) == 14, len(labrows)
    label_c = ((m['axis']), (m['lab_top'] + m['lab_bot']) / 2)

    push = []
    def feats(fr):
        lum = fr[:, 900:1000].sum(2).mean(1) / 3
        y0 = int(np.argmax(lum > 40))
        ct = y0 - 1 + (40 - lum[y0 - 1]) / (lum[y0] - lum[y0 - 1])
        b_, r_ = fr[..., 0], fr[..., 2]
        bl = (b_[:, 800:1100] > r_[:, 800:1100] + 60).mean(1)
        out = [ct]
        for lo, hi in ((400, 520), (820, 960)):
            w = np.clip(bl[lo:hi] - 0.3, 0, None)
            out.append(lo + float((w * np.arange(hi - lo)).sum() / w.sum()))
        return np.array(out)
    f12 = feats(F[12])
    for i in range(12, 26):
        mi = measure(F[i])
        s = mi['width'] / m['width']
        tx = mi['axis'] - s * m['axis']
        ty = float(np.mean(feats(F[i]) - s * f12))
        push.append(dict(src_frame=i, media=round(i / 24, 4), cap_top=mi['cap_top'], width=round(mi['width'], 2), axis=round(mi['axis'], 2),
                         s=round(s, 5), tx=round(tx, 2), ty=round(ty, 2)))

    J = dict(
        source='assets/plates/ai/hero.mp4', media=0.5, src_frame=12, fps=24, size=[1920, 1080],
        stage_scale=S0, stage_centre=list(C), pitch=PITCH,
        note='*_src = hero pixel space (= type-vial canvas at scale 1.000, f262). *_stage = scale 0.957 about (960,540) (= S01 + typevial.mp4 frame 0). stage = C + 0.957*(src - C).',
        zones_src=zones, axis_src=round(m['axis'], 2), body_width_src=round(m['width'], 2), bottom_src=bottom,
        stripes_src=stripes, label_c_src=[round(label_c[0], 1), round(label_c[1], 1)],
        label_c=[round(v, 1) for v in to_stage(label_c)],
        pure_f104=dict(font='800 150px "DM Sans"', letter_spacing='-0.02em', color='#F3F6FA', centre=[round(v, 1) for v in to_stage(label_c)],
                       rule='stage px. Horizontal centre of the word on label_c.x; em box (line-height 1 or normal) centred on label_c.y, '
                            'i.e. alphabetic baseline = label_c.y + 0.341*150 = label_c.y + 51.2 (DM Sans asc .992 / desc .310)'),
        outline_stroke=dict(width=2, color='#93A1B8', space='stage (outline_d_stage)'),
        label_rows_y_src=[r['y'] for r in labrows],
        symbol_c_src=[round(m['axis'], 1), labrows[0]['yc']], wordmark_c_src=[round(m['axis'], 1), labrows[1]['yc']],
        outline_d_src=d(pts), outline_d_stage=d([to_stage(p) for p in pts]),
        rows=rows, push=push)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(J, open(OUT, 'w'), indent=1)
    open(OUT[:-5] + '.js', 'w').write('// GENERATED by tools/trace_vial.py\nwindow.SIL = ' + json.dumps(J) + ';\n')
    print('zones', zones, 'stripes', stripes, 'label_c', J['label_c'], 'rows', len(rows))


if __name__ == '__main__':
    main()
