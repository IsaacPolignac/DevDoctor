#!/usr/bin/env python3
"""Screen-bake QC (SHOTS §0.4, S09 QC) — the gate before the SEQUENCE goes onto the 3D screen.
  python3 tools/bake_qc.py [--seq assets/screen_seq] [--out renders/qc/bake] [--no-ocr]
Checks (all numbers in sRGB levels /255, mean absolute difference over the whole 1206x2622 texture):
  1. 481 frames scr_0001..0481 (= f708..f1188), 1206x2622 RGB.
  2. f708–f802 pure black (max level ≤ 1).
  3. scr_0123 (f830, home mid-scroll) vs tools/render_screens.cjs home at the SAME scroll (the §0.5 expo.out curve):  < 2
     scr_0223 (f930, cart3 @ 150, bar 1.0, no ring, no press) vs assets/site/clean/screen_cart.png:                 < 2
     scr_0373 (f1080, home @ 0 after the push) vs assets/site/clean/screen_home.png:                                < 2
     scr_0400 (f1107, home @ 3.24, the alive scroll) vs render_screens.cjs home at that scroll:                     < 2
     (the nav badge digit differs by design — 1 / 3 vs the captures' 0 — so the badge box is masked; both numbers printed)
  4. tap rings centred on their control ± 3 pt (centroid of the pixels that change over tap ±1 f near the control vs its centre).
  5. OCR (tesseract) every 10th frame + every event frame against the forbidden list (tools/qc_frames.sh regex).
Writes <out>/report.json and the diff images; exit 1 on any FAIL."""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PREV = '/home/user/DevDoctor/ads/purepeptide-motion-en'
FIRST = 708
FORBID = re.compile(r'certif|\bCOA\b|bacterio|reconstitut|Retatrutide|Recovery|repair|G ?Pay|Pharmaceutical|SECURE|syringe|needle|inject|dosage|\bdose|protocol|benefit|heal|treatment|anti-?aging|weight loss|muscle', re.I)
COA = re.compile(r'\bCOA\b')


def scr(seq, f):
    return os.path.join(seq, 'scr_%04d.png' % (f - FIRST + 1))


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.int16)


def expo_out(p):
    return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)


def sine_inout(p):
    return -(math.cos(math.pi * p) - 1) / 2


def scroll_home(f, ev):
    """home scroll at frame f per js/screen_tl.js: 0 → 36 expo.out over scrollA, 0 after push2, 0 → 10 sine.inOut over scrollB."""
    a0, a1 = ev['scrollA']
    b0, b1 = ev['scrollB']
    if f < ev['push2'][0]:
        if f <= a0:
            return 0.0
        return 36 * expo_out(min(1.0, (f - a0) / (a1 - a0)))
    if f <= b0:
        return 0.0
    return 10 * sine_inout(min(1.0, (f - b0) / (b1 - b0)))


def render_ref(name, page, s, out):
    """Render home@s with tools/render_screens.cjs (the same component at the same scale) → out/<name>.png."""
    script = os.path.join(ROOT, 'tools', 'render_screens.cjs')
    if not os.path.exists(script):
        script = os.path.join(PREV, 'tools', 'render_screens.cjs')
    site_root = os.path.dirname(os.path.dirname(script))
    job = f'qc_{name}:{page}:{s:.4f}'
    r = subprocess.run(['node', script, '--dir', 'clean', job], capture_output=True, text=True, cwd=site_root)
    if r.returncode:
        raise RuntimeError('render_screens.cjs failed: ' + r.stderr[-800:])
    src = os.path.join(site_root, 'assets', 'site', 'clean', f'screen_qc_{name}.png')
    dst = os.path.join(out, f'ref_{name}.png')
    shutil.move(src, dst)
    return dst


def diff(a_path, b_path, out_png, mask=None):
    a, b = load(a_path), load(b_path)
    if a.shape != b.shape:
        return {'error': f'shape {a.shape} vs {b.shape}'}
    d = np.abs(a - b).mean(axis=2)
    res = {'mean': float(d.mean()), 'p99': float(np.percentile(d, 99)), 'max': float(d.max())}
    if mask is not None:
        m = np.ones(d.shape, bool)
        x, y, w, h = mask
        m[y:y + h, x:x + w] = False
        res['mean_masked'] = float(d[m].mean())
    Image.fromarray(np.clip(d * 4, 0, 255).astype(np.uint8)).resize((603, 1311)).save(out_png)
    return res


def ocr(path):
    r = subprocess.run(['tesseract', path, '-', '--psm', '11'], capture_output=True, text=True)
    txt = r.stdout
    hits = sorted(set(m.group(0) for m in FORBID.finditer(txt) if m.group(0).upper() != 'COA')) + sorted(set(COA.findall(txt)))
    return txt, hits


def ring_centroid(seq, f_tap, expect_xy, out):
    """Centroid (screen pt) of the pixels that change between f_tap−1 and f_tap+1 inside ±60 pt of the control's centre
    (the ring + the press sprite), vs that centre. Changes outside the window are counted (informational: the state
    change lands at tap + 2 f, a sub-pixel text re-raster can happen when a transform tween starts)."""
    a, b = load(scr(seq, f_tap - 1)), load(scr(seq, f_tap + 1))
    d = np.abs(a - b).max(axis=2)
    ys, xs = np.nonzero(d > 6)
    if len(xs) < 20:
        return {'frame': f_tap, 'expected_pt': expect_xy, 'error': 'no change found'}
    X, Y = expect_xy[0] * 3, expect_xy[1] * 3
    win = (np.abs(xs - X) <= 180) & (np.abs(ys - Y) <= 180)
    if win.sum() < 20:
        return {'frame': f_tap, 'expected_pt': expect_xy, 'error': 'no change near the control', 'changed_px_elsewhere': int((~win).sum())}
    cx, cy = xs[win].mean() / 3, ys[win].mean() / 3
    off = math.hypot(cx - expect_xy[0], cy - expect_xy[1])
    X, Y = int(X), int(Y)
    Image.fromarray(np.clip(b[max(0, Y - 150):Y + 150, max(0, X - 150):X + 150], 0, 255).astype(np.uint8)).save(os.path.join(out, f'tap_f{f_tap}.png'))
    return {'frame': f_tap, 'expected_pt': expect_xy, 'measured_pt': [round(cx, 2), round(cy, 2)], 'offset_pt': round(off, 2),
            'changed_px': int(win.sum()), 'changed_px_elsewhere': int((~win).sum())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seq', default='assets/screen_seq')
    ap.add_argument('--out', default='renders/qc/bake')
    ap.add_argument('--no-ocr', action='store_true')
    a = ap.parse_args()
    seq = os.path.join(ROOT, a.seq)
    out = os.path.join(ROOT, a.out)
    os.makedirs(out, exist_ok=True)
    fails, report = [], {}

    # ---- 1. files
    meta = json.load(open(os.path.join(seq, 'seq.json'))) if os.path.exists(os.path.join(seq, 'seq.json')) else {}
    ev = meta.get('events') or {'wake': 803, 'scrollA': [812, 840], 'tapCart': 850, 'push1': [852, 864], 'badge': 866, 'tap1': 888, 'state2': 890,
                                'tap2': 912, 'state3': 914, 'tapNav': 1044, 'push2': [1050, 1062], 'scrollB': [1080, 1150]}
    missing = [f for f in range(708, 1189) if not os.path.exists(scr(seq, f))]
    sizes = set()
    for f in (708, 803, 930, 1188):
        if os.path.exists(scr(seq, f)):
            im = Image.open(scr(seq, f))
            sizes.add((im.size, im.mode))
    report['files'] = {'missing': missing, 'sizes': sorted(map(str, sizes)), 'events': ev}
    if missing:
        fails.append(f'{len(missing)} frames missing (first f{missing[0]})')
    if sizes - {((1206, 2622), 'RGB')}:
        fails.append(f'unexpected size/mode {sizes}')
    print(f'files: {481 - len(missing)}/481, sizes {sorted(sizes)}')

    # ---- 2. black before the wake
    mx = 0
    for f in range(708, ev['wake']):
        if os.path.exists(scr(seq, f)):
            mx = max(mx, int(load(scr(seq, f)).max()))
    report['black_max'] = mx
    print(f'black f708–f{ev["wake"] - 1}: max level {mx}')
    if mx > 1:
        fails.append(f'screen-off frames not black (max {mx})')

    # ---- 3. diffs
    badge = (321 * 3, (62 + 62) * 3, 16 * 3, 16 * 3)  # home nav badge box (page 321,62,16,16) at scroll 0, in px; shifted per scroll below
    diffs = {}
    s830 = scroll_home(830, ev)
    ref830 = render_ref('home830', 'home', s830, out)
    diffs['f830_vs_home@%.2f' % s830] = diff(scr(seq, 830), ref830, os.path.join(out, 'diff_f830.png'),
                                              mask=(badge[0], int((62 + 62 - s830) * 3), badge[2], badge[3]))
    diffs['f930_vs_screen_cart'] = diff(scr(seq, 930), os.path.join(ROOT, 'assets/site/clean/screen_cart.png'), os.path.join(out, 'diff_f930.png'))
    diffs['f1080_vs_screen_home'] = diff(scr(seq, 1080), os.path.join(ROOT, 'assets/site/clean/screen_home.png'), os.path.join(out, 'diff_f1080.png'), mask=badge)
    s1107 = scroll_home(1107, ev)
    ref1107 = render_ref('home1107', 'home', s1107, out)
    diffs['f1107_vs_home@%.2f' % s1107] = diff(scr(seq, 1107), ref1107, os.path.join(out, 'diff_f1107.png'),
                                                mask=(badge[0], int((62 + 62 - s1107) * 3), badge[2], badge[3]))
    diffs['f1107_vs_screen_home(scroll_0,_informational)'] = diff(scr(seq, 1107), os.path.join(ROOT, 'assets/site/clean/screen_home.png'), os.path.join(out, 'diff_f1107_s0.png'), mask=badge)
    report['diffs'] = diffs
    for k, v in diffs.items():
        gate = 'informational' in k
        m = v.get('mean_masked', v.get('mean'))
        print(f'diff {k}: mean {v.get("mean", -1):.3f}' + (f' (badge masked {v["mean_masked"]:.3f})' if 'mean_masked' in v else '') + f' p99 {v.get("p99", -1):.1f} max {v.get("max", -1):.0f}' + ('' if gate else f'  → {"PASS" if m < 2 else "FAIL"}'))
        if not gate and ('error' in v or m >= 2):
            fails.append(f'{k}: mean {m:.3f} ≥ 2')

    # ---- 4. tap rings
    taps = [(ev['tapCart'], [319, 107]), (ev['tap1'], [226, 422]), (ev['tap2'], [226, 442]), (ev['tapNav'], [131, 98])]
    rings = [ring_centroid(seq, f, xy, out) for f, xy in taps]
    report['taps'] = rings
    for r in rings:
        ok = 'offset_pt' in r and r['offset_pt'] <= 3
        print(f'tap f{r["frame"]}: expected {r["expected_pt"]} measured {r.get("measured_pt")} offset {r.get("offset_pt")} pt → {"PASS" if ok else "FAIL"}')
        if not ok:
            fails.append(f'tap f{r["frame"]} off by {r.get("offset_pt")} pt')

    # ---- 5. OCR
    if not a.no_ocr:
        frames = sorted(set(list(range(708, 1189, 10)) + [ev['wake'] + 12, 830, ev['tapCart'] + 2, ev['push1'][1] + 1, ev['badge'] + 2, ev['tap1'] + 2, ev['state2'] + 1,
                                                            ev['state2'] + 14, ev['tap2'] + 2, ev['state3'] + 1, ev['state3'] + 14, 930, 1000, ev['tapNav'] + 2, ev['push2'][1] + 1, 1107, 1150, 1188]))
        bad = []
        words = set()
        for f in frames:
            if not os.path.exists(scr(seq, f)):
                continue
            txt, hits = ocr(scr(seq, f))
            words.update(w for w in re.findall(r'[A-Za-z][A-Za-z\-]{2,}', txt))
            if hits:
                bad.append((f, hits))
        report['ocr'] = {'frames': len(frames), 'fails': bad, 'vocab_size': len(words)}
        print(f'ocr: {len(frames)} frames, {len(bad)} with forbidden words' + (': ' + '; '.join(f'f{f} {h}' for f, h in bad) if bad else ''))
        for f, h in bad:
            fails.append(f'OCR f{f}: {", ".join(h)}')
        open(os.path.join(out, 'ocr_vocab.txt'), 'w').write('\n'.join(sorted(words, key=str.lower)))

    # contact sheet of the event frames
    keys = [708, ev['wake'], ev['wake'] + 6, ev['wake'] + 12, 830, ev['tapCart'] + 1, ev['push1'][0] + 6, ev['push1'][1] + 1, ev['badge'] + 3, ev['tap1'] + 1, ev['state2'] + 1,
            ev['state2'] + 8, ev['tap2'] + 1, ev['state3'] + 1, ev['state3'] + 8, 930, ev['tapNav'] + 1, ev['push2'][0] + 6, ev['push2'][1] + 1, 1107, 1150, 1188]
    w, h = 201, 437
    sheet = Image.new('RGB', (w * 11 + 10 * 6, (h + 16) * 2), '#333')
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(keys):
        if not os.path.exists(scr(seq, f)):
            continue
        im = Image.open(scr(seq, f)).resize((w, h), Image.LANCZOS)
        x, y = (i % 11) * (w + 6), (i // 11) * (h + 16)
        sheet.paste(im, (x, y + 14))
        d.text((x + 2, y + 1), f'f{f} scr_{f - FIRST + 1:04d}', fill='white')
    sheet.save(os.path.join(out, 'contact.png'))

    report['fails'] = fails
    report['result'] = 'PASS' if not fails else 'FAIL'
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), indent=1)
    print(f'bake_qc: {report["result"]}' + (' — ' + ' | '.join(fails) if fails else '') + f'  (report {os.path.relpath(os.path.join(out, "report.json"), ROOT)})')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
