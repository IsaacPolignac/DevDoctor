#!/usr/bin/env bash
# T4b (browser half): the CSS matrix3d from screen_corners.json applied to a 402x874 HTML screen element in Chromium
# (hyperframes snapshot of tools/tests/out/homography/html), compared with the full-3D truth frame.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
H="$ROOT/tools/tests/out/homography"
P="$H/html"
cd "$P"
ln -sfn "$ROOT/node_modules" node_modules
ln -sfn /home/user/DevDoctor/ads/purepeptide-motion-en/assets/vendor vendor
cp "$ROOT/hyperframes.json" .
# add gsap + an (empty) master timeline so the snapshot runner finds what it expects
grep -q "__timelines" index.html || python3 - <<'PY'
s = open('index.html').read()
s = s.replace('<head>', '<head><script src="vendor/gsap.min.js"></script>', 1)
s = s.replace('<div id="stage" class="clip" data-start="0" data-duration="1">', '<div id="stage" class="clip" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="1">')
s = s.replace('</body>', '<script>const tl=gsap.timeline({paused:true});tl.to({}, {duration:1});window.__timelines={main:tl};</script></body>', 1)
open('index.html', 'w').write(s)
PY
cd "$ROOT"
rm -rf "$H/snap"
npx hyperframes snapshot "$P" --at 0.2 --no-end --describe false --timeout 30000 -o "$H/snap" 2>&1 | grep -E "saved|rror|✗|warn" || true
ls "$H/snap"
python3 - "$H" <<'PY'
import sys, glob, json, numpy as np
from PIL import Image, ImageDraw
H = sys.argv[1]
snap = sorted(glob.glob(H + '/snap/*.png'))[0]
got = np.asarray(Image.open(snap).convert('RGB'), dtype=float)
ref = np.asarray(Image.open(H + '/truth_over_bg.png').convert('RGB'), dtype=float)
truth = np.asarray(Image.open(H + '/truth.png').convert('RGBA'), dtype=float)
d = np.abs(got - ref)
ys, xs = np.where(truth[..., 3] > 128)
phone = d[ys.min():ys.max(), xs.min():xs.max()]
info = json.load(open(H + '/screen_corners.json'))
c = info['corners_px_1080p_TL_TR_BR_BL']
cx, cy = np.mean([p[0] for p in c]), np.mean([p[1] for p in c])
inner = [(cx + (x - cx) * 0.94, cy + (y - cy) * 0.94) for x, y in c]
m = Image.new('L', (1920, 1080), 0); ImageDraw.Draw(m).polygon(inner, fill=255); m = np.asarray(m) > 0
scr = d[m]
res = {'browser_phone_mean': round(float(phone.mean()), 2), 'browser_phone_p99': round(float(np.percentile(phone, 99)), 1),
       'browser_screen_mean': round(float(scr.mean()), 2), 'browser_screen_p99': round(float(np.percentile(scr, 99)), 1)}
print('BROWSER matrix3d vs truth (levels):', json.dumps(res))
info['browser_matrix3d_vs_truth_levels'] = res
json.dump(info, open(H + '/screen_corners.json', 'w'), indent=1)
Image.fromarray(np.clip(d * 8, 0, 255).astype(np.uint8)).save(H + '/browser_diff_x8.png')
crop = (max(0, xs.min() - 20), max(0, ys.min() - 20), min(1920, xs.max() + 20), min(1080, ys.max() + 20))
tiles = [Image.open(H + '/truth_over_bg.png').crop(crop), Image.open(snap).convert('RGB').crop(crop), Image.open(H + '/browser_diff_x8.png').crop(crop)]
w, h = tiles[0].size
sheet = Image.new('RGB', (w * 3 + 20, h), (20, 22, 26))
for i, t in enumerate(tiles):
    sheet.paste(t, (i * (w + 10), 0))
sheet.save(H + '/browser_side_by_side.png')
PY
