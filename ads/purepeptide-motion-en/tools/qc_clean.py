#!/usr/bin/env python3
"""QC + measurements for the clean site captures (SCENES P0-A, §0.4 PH.barFill, BRIEF §10).
  python3 tools/qc_clean.py
- measures the cart ship bar (track rect + fill fraction + colours) from PIXELS on clean/cart{1,2,3}.png and writes
  meta.json["ship_bar"] (and meta[cartN]["ship_bar_px"]);
- OCR gate (tesseract): no forbidden word on any clean/*.png (page captures and screen_*.png); required strings present;
- contact sheet -> assets/site/clean_qc_contact.png (outside clean/ so no glob picks it up).
Exit code 1 on any failure."""
import glob, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(ROOT, 'assets/site/clean')
FORBID = re.compile(r'certif|\bCOA\b|bacterio|reconstitut|Retatrutide|Recovery|repair|G ?Pay|Pharmaceutical|SECURE|MT-2', re.I)
REQUIRE = {  # OCR (dark text on light) + DOM text from meta.json (white-on-navy buttons OCR poorly)
    'home.png': ['Purity', 'proven', 'RESEARCH PEPTIDES', 'Explore the catalog', 'HPLC', 'THIRD-PARTY TESTED'],
    'product.png': ['BUNDLE & SAVE', '1 vial', '2 vials', '-5%', '3+ vials', '-8%', '$84.99', 'Add to cart · $84.99'],
    'cart1.png': ['$115.01 away from free shipping', '$84.99', 'Proceed to checkout', 'For laboratory research use only'],
    'cart2.png': ['$38.52 away from free shipping', 'Volume discount', '-5%', '$80.74', '$161.48', 'Proceed to checkout'],
    'cart3.png': ['Free shipping unlocked', 'Volume discount', '-8%', '$78.19', '$234.57', 'Proceed to checkout', 'For laboratory research use only'],
}
fails = []


def ocr(img):
    txt = ''
    W, H = img.size
    with tempfile.TemporaryDirectory() as d:
        for y in range(0, H, 1200):
            p = os.path.join(d, 't.png')
            img.crop((0, max(0, y - 150), W, min(H, y + 1350))).save(p)
            txt += subprocess.run(['tesseract', p, '-', '--psm', '11'], capture_output=True, text=True).stdout + '\n'
    return txt


def norm(s):
    return ' '.join(s.replace('−', '-').replace('–', '-').split())


def measure_bar(name):
    a = np.asarray(Image.open(os.path.join(CLEAN, name + '.png')).convert('RGB')).astype(int)
    nonw = np.abs(a - 255).sum(2) > 15
    ys = [y for y in range(285 * 3, 310 * 3) if nonw[y, 40 * 3:360 * 3].mean() > 0.9]
    y0, y1 = ys[0], ys[-1] + 1
    ym = (y0 + y1) // 2
    xs = np.where(nonw[ym, 75:1125])[0] + 75          # inside the card (x 25..375 pt)
    x0, x1 = int(xs[0]), int(xs[-1] + 1)
    row = a[ym]
    sat = row.max(1) - row.min(1)
    f = np.where(sat[x0:x1] > 40)[0]
    fx1 = int(x0 + f[-1] + 1) if len(f) else x0
    hexc = lambda c: '#%02X%02X%02X' % tuple(int(v) for v in c)
    return {
        'rect_pt': [round(x0 / 3, 2), round(y0 / 3, 2), round((x1 - x0) / 3, 2), round((y1 - y0) / 3, 2)],
        'fill_right_pt': round(fx1 / 3, 2),
        'fill_frac': round((fx1 - x0) / (x1 - x0), 4),
        'fill_rgb': hexc(row[x0 + 30]),
        'track_rgb': hexc(row[x1 - 12]) if fx1 < x1 - 12 else None,
    }


meta_p = os.path.join(CLEAN, 'meta.json')
meta = json.load(open(meta_p))

# 1. ship bar
bars = {n: measure_bar(n) for n in ('cart1', 'cart2', 'cart3')}
r = bars['cart1']['rect_pt']
meta['ship_bar'] = {
    'note': 'measured from pixels on the clean captures (page points); PH.barFill(tl,t0,dur,page,f0,f1,c0,c1) uses rect + fractions',
    'rect_pt': r, 'track_rgb': bars['cart1']['track_rgb'],
    'fill_frac': {n: bars[n]['fill_frac'] for n in bars},
    'fill_rgb': {n: bars[n]['fill_rgb'] for n in bars},
    'dom_width_style': {n: (meta.get(n, {}).get('els', {}).get('ship_fill') or {}).get('style') for n in bars},
}
for n in bars:
    meta[n]['ship_bar_px'] = bars[n]
    if bars[n]['rect_pt'] != r:
        fails.append(f'{n}: bar rect differs {bars[n]["rect_pt"]} vs {r}')
print('ship bar', json.dumps(meta['ship_bar']))

# 2. OCR gate + required strings
files = sorted(glob.glob(os.path.join(CLEAN, '*.png')))
for f in files:
    b = os.path.basename(f)
    txt = norm(ocr(Image.open(f).convert('RGB')))
    hits = sorted(set(m.group(0) for m in FORBID.finditer(txt)))
    if hits:
        fails.append(f'{b}: forbidden OCR hits {hits}')
    req = REQUIRE.get(b, [])
    dom = norm(' '.join(x['text'] for x in meta.get(b[:-4], {}).get('boxes', [])))
    missing = [s for s in req if norm(s).lower() not in txt.lower() and norm(s).lower() not in dom.lower()]
    if missing:
        fails.append(f'{b}: required text missing {missing}')
    print(f'{b:22s} forbidden={hits or "none"} missing={missing or "none"}')
    domhits = sorted(set(m.group(0) for m in FORBID.finditer(dom)))
    if domhits:
        fails.append(f'{b}: forbidden words in visible DOM boxes {domhits}')

# 3. contact sheet (1x, columns of 950 pt)
tiles = []
for f in files:
    im = Image.open(f).convert('RGB')
    im = im.resize((402, im.size[1] // 3))
    for c in range((im.size[1] + 949) // 950):
        tiles.append((os.path.basename(f), c, im.crop((0, c * 950, 402, min(im.size[1], (c + 1) * 950)))))
sheet = Image.new('RGB', (len(tiles) * 412, 980), (40, 40, 40))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for k, (b, c, t) in enumerate(tiles):
    sheet.paste(t, (k * 412, 30))
    d.text((k * 412 + 6, 8), f'{b} [{c * 950}-{c * 950 + 950} pt]', fill=(255, 255, 255))
out = os.path.join(ROOT, 'assets/site/clean_qc_contact.png')
sheet.save(out)
print('contact sheet', out, sheet.size)

meta['qc'] = {'ocr_forbidden': FORBID.pattern, 'result': 'PASS' if not fails else 'FAIL', 'fails': fails,
              'files': [os.path.basename(f) for f in files]}
json.dump(meta, open(meta_p, 'w'), indent=1, ensure_ascii=False)
print('QC', meta['qc']['result'], fails)
sys.exit(1 if fails else 0)
