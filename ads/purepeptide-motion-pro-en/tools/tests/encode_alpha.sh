#!/usr/bin/env bash
# T5a: alpha encodes from a PNG sequence (RGBA): ProRes 4444 (for Apple Motion / FCP) and VP9 (for HyperFrames / Chromium).
#   tools/tests/encode_alpha.sh [png-dir] [out-dir]
# Default source: the 68 frames of assets/iphone/flyin_land.webm decoded back to RGBA PNGs with libvpx-vp9 (alpha-capable).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${1:-$ROOT/tools/tests/out/encode/src}"
OUT="${2:-$ROOT/tools/tests/out/encode}"
mkdir -p "$SRC" "$OUT"
if [ ! -f "$SRC/0000.png" ]; then
  ffmpeg -hide_banner -loglevel error -y -c:v libvpx-vp9 -i "$ROOT/assets/iphone/flyin_land.webm" -pix_fmt rgba -start_number 0 "$SRC/%04d.png"
fi
N=$(ls "$SRC"/*.png | wc -l)
echo "source: $N RGBA PNG frames in $SRC ($(python3 -c "from PIL import Image; im=Image.open('$SRC/0000.png'); print(im.size, im.mode)"))"
echo "loadavg before: $(cut -d' ' -f1-3 /proc/loadavg)"
t0=$(date +%s.%N)
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i "$SRC/%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 -qscale:v 9 "$OUT/prores4444_alpha.mov"
t1=$(date +%s.%N)
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i "$SRC/%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -row-mt 1 -auto-alt-ref 0 "$OUT/vp9_alpha.webm"
t2=$(date +%s.%N)
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 0 -i "$SRC/%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -row-mt 1 -auto-alt-ref 0 -deadline good -cpu-used 2 "$OUT/vp9_alpha_fast.webm"
t3=$(date +%s.%N)
python3 - "$t0" "$t1" "$t2" "$t3" "$N" <<'PY'
import sys; t0,t1,t2,t3,n=map(float,sys.argv[1:]); n=int(n)
print('ENCODE prores4444: %.1f s (%.2f s/frame)' % (t1-t0,(t1-t0)/n))
print('ENCODE vp9 crf18 (default deadline): %.1f s (%.2f s/frame)' % (t2-t1,(t2-t1)/n))
print('ENCODE vp9 crf18 -deadline good -cpu-used 2: %.1f s (%.2f s/frame)' % (t3-t2,(t3-t2)/n))
PY
for f in prores4444_alpha.mov vp9_alpha.webm vp9_alpha_fast.webm; do
  echo "--- $f: $(stat -c %s "$OUT/$f") bytes"
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_frames:stream_tags=alpha_mode,ALPHA_MODE -of default=nw=1 "$OUT/$f"
done
# decode-back alpha check (frame 20: phone mid-flight, both opaque and transparent pixels)
ffmpeg -hide_banner -loglevel error -y -i "$OUT/prores4444_alpha.mov" -vf "select=eq(n\,20)" -vframes 1 -pix_fmt rgba "$OUT/back_prores_f20.png"
ffmpeg -hide_banner -loglevel error -y -c:v libvpx-vp9 -i "$OUT/vp9_alpha.webm" -vf "select=eq(n\,20)" -vframes 1 -pix_fmt rgba "$OUT/back_vp9_f20.png"
python3 - "$SRC" "$OUT" <<'PY'
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
ref = np.asarray(Image.open(src + '/0020.png').convert('RGBA'), dtype=float)
for name in ('back_prores_f20.png', 'back_vp9_f20.png'):
    im = np.asarray(Image.open(out + '/' + name).convert('RGBA'), dtype=float)
    a = im[..., 3]
    op = ref[..., 3] > 250
    d = np.abs(im[..., :3] - ref[..., :3])[op]
    print('%-20s alpha min %d max %d | transparent px exact-0: %.1f%% | opaque RGB mean abs diff %.2f p99 %.1f' % (
        name, a.min(), a.max(), 100 * (a[ref[..., 3] < 1] == 0).mean(), d.mean(), np.percentile(d, 99)))
PY
echo "loadavg after: $(cut -d' ' -f1-3 /proc/loadavg)"
