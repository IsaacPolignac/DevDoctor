#!/usr/bin/env bash
# tools/encode_layers.sh <id>   — renders/3d/<id>/final/####.png → assets/layers/<id>.webm (VP9 alpha, for HyperFrames)
#                                 + renders/prores/<id>.mov (ProRes 4444, Apple Motion); s01 is opaque → assets/layers/s01.mp4
# The start number is the first PNG in final/ (s02 = 0126, take = 0708, s01 = 0030). Read a webm's alpha back with
#   ffmpeg -c:v libvpx-vp9 -i assets/layers/<id>.webm -frames:v 1 -f image2 -pix_fmt rgba x.png
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ID="$1"
SRC="$ROOT/renders/3d/$ID/final"
[ -d "$SRC" ] || { echo "no $SRC (run tools/post_layers.py $ID first)"; exit 2; }
FIRST=$(ls "$SRC"/*.png | head -1 | xargs -n1 basename | sed 's/\.png//')
N=$((10#$FIRST))
COUNT=$(ls "$SRC"/*.png | wc -l)
mkdir -p "$ROOT/assets/layers" "$ROOT/renders/prores"
echo "encode $ID: $COUNT frames from $FIRST"
if [ "$ID" = "s01" ]; then
  ffmpeg -v error -y -framerate 30 -start_number "$N" -i "$SRC/%04d.png" -c:v libx264 -crf 14 -pix_fmt yuv420p -movflags +faststart "$ROOT/assets/layers/s01.mp4"
  ffmpeg -v error -y -framerate 30 -start_number "$N" -i "$SRC/%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuv444p10le -vendor apl0 -qscale:v 9 "$ROOT/renders/prores/s01.mov"
else
  ffmpeg -v error -y -framerate 30 -start_number "$N" -i "$SRC/%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 18 -row-mt 1 -auto-alt-ref 0 "$ROOT/assets/layers/$ID.webm"
  ffmpeg -v error -y -framerate 30 -start_number "$N" -i "$SRC/%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 -qscale:v 9 "$ROOT/renders/prores/$ID.mov"
  if [ "$ID" = "take" ] && [ -f "$SRC/1188.png" ]; then cp "$SRC/1188.png" "$ROOT/assets/layers/hold_1188.png"; fi
fi
ls -la "$ROOT/assets/layers/$ID".* "$ROOT/renders/prores/$ID.mov"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,nb_frames,pix_fmt -of csv=p=0 "$ROOT/renders/prores/$ID.mov"
