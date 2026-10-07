#!/usr/bin/env bash
# T5b: does HyperFrames composite TWO overlapping VP9-alpha videos correctly? (scratch project tools/tests/hf_alpha)
#   tools/tests/hf_alpha_test.sh
# 1. snapshot t = 0.5 s (frame 15 of both videos) -> compare with a PIL composite of the decoded frames over the gradient
# 2. render the 1 s composition to MP4 (timing) and compare its frame 15 as well
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJ="$ROOT/tools/tests/hf_alpha"
OUT="$ROOT/tools/tests/out/hf_alpha"
mkdir -p "$OUT"
cd "$ROOT"
echo "loadavg before: $(cut -d' ' -f1-3 /proc/loadavg)"
# decoded reference frames (libvpx-vp9 keeps the alpha)
ffmpeg -hide_banner -loglevel error -y -c:v libvpx-vp9 -i assets/iphone/flyin_land.webm -vf "select=eq(n\,15)" -vframes 1 -pix_fmt rgba "$OUT/A_f15.png"
ffmpeg -hide_banner -loglevel error -y -c:v libvpx-vp9 -i assets/iphone/tiltout.webm   -vf "select=eq(n\,15)" -vframes 1 -pix_fmt rgba "$OUT/B_f15.png"
t0=$(date +%s.%N)
npx hyperframes snapshot "$PROJ" --at 0.5005 --no-end --describe false --timeout 30000 -o "$OUT/snap" 2>&1 | grep -E "saved|rror|✗|warn" || true
t1=$(date +%s.%N)
ls "$OUT/snap"
npx hyperframes render "$PROJ" --quality delivery -o "$OUT/hf_alpha_1s.mp4" 2>&1 | grep -E "Render|frames|fps|rror|✗|Done|saved|Encoded|elapsed|took" | tail -8 || true
t2=$(date +%s.%N)
python3 - "$t0" "$t1" "$t2" <<'PY'
import sys; t0,t1,t2=map(float,sys.argv[1:]); print('TIME snapshot %.1f s, render 1 s (30 f) %.1f s' % (t1-t0, t2-t1))
PY
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt,width,height,nb_frames,r_frame_rate -of default=nw=1 "$OUT/hf_alpha_1s.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$OUT/hf_alpha_1s.mp4" -vf "select=eq(n\,15)" -vframes 1 "$OUT/mp4_f15.png"
python3 - "$OUT" <<'PY'
import sys, glob, numpy as np
from PIL import Image
out = sys.argv[1]
W, H = 1920, 1080
# CSS linear-gradient(90deg, #0b1a3a 0%, #1f6fb0 50%, #f2f5fa 100%), interpolated in sRGB (legacy gradient behaviour)
stops = [(0.0, (0x0b, 0x1a, 0x3a)), (0.5, (0x1f, 0x6f, 0xb0)), (1.0, (0xf2, 0xf5, 0xfa))]
x = (np.arange(W) + 0.5) / W
grad = np.zeros((H, W, 3))
for (p0, c0), (p1, c1) in zip(stops[:-1], stops[1:]):
    m = (x >= p0) & (x <= p1)
    u = ((x[m] - p0) / (p1 - p0))[:, None]
    grad[:, m, :] = (np.array(c0) * (1 - u) + np.array(c1) * u)[None]
A = np.asarray(Image.open(out + '/A_f15.png').convert('RGBA'), dtype=float)
Bim = Image.open(out + '/B_f15.png').convert('RGBA')
Bs = Bim.resize((int(W * 0.8), int(H * 0.8)), Image.BILINEAR)
B = np.zeros((H, W, 4)); b = np.asarray(Bs, dtype=float); bw = min(b.shape[1], W - 420); B[0:b.shape[0], 420:420 + bw] = b[:, :bw]
def over(dst, src):
    a = src[..., 3:4] / 255.0
    return src[..., :3] * a + dst * (1 - a)
exp = over(over(grad, A), B)
Image.fromarray(np.clip(exp, 0, 255).astype(np.uint8)).save(out + '/expected_f15.png')
aA, aB = A[..., 3] > 128, B[..., 3] > 128
regions = {'bg (no video)': ~aA & ~aB, 'A only': aA & ~aB, 'B only': ~aB | aA, 'overlap (B over A)': aA & aB}
regions['B only'] = aB & ~aA
for name in ('snap', 'mp4'):
    files = glob.glob(out + '/snap/*.png') if name == 'snap' else [out + '/mp4_f15.png']
    if not files:
        print(name, 'MISSING'); continue
    got = np.asarray(Image.open(sorted(files)[0]).convert('RGB'), dtype=float)
    d = np.abs(got - exp)
    print('%-5s vs expected: ' % name + ', '.join('%s %.2f (p99 %.0f, n=%d)' % (k, d[m].mean(), np.percentile(d[m], 99), m.sum()) for k, m in regions.items()))
    # edge check: in the overlap, B's soft edge must blend over A (not a hard/black fringe): mean on B's edge pixels
    edge = (B[..., 3] > 8) & (B[..., 3] < 248) & aA
    print('      B alpha-edge pixels over A: n=%d, mean abs diff %.2f' % (edge.sum(), d[edge].mean()))
PY
echo "loadavg after: $(cut -d' ' -f1-3 /proc/loadavg)"
