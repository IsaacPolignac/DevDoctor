#!/usr/bin/env bash
# usage: tools/encode.sh <shot> [render_fps]
# encode renders/<shot>/####.png (15 or 10 fps render, 1600x900) -> renders/<shot>.mp4
# (30 fps via motion-compensated interpolation, lanczos upscale to 1920x1080, H.264 CRF 14, yuv420p)
set -e
cd "$(dirname "$0")/.."
shot=$1
rfps=${2:-15}  # frame rate the PNG sequence was rendered at
case $shot in
  macro_sweep) nf=90 ;; turntable) nf=120 ;; cap_top) nf=75 ;; hero) nf=90 ;; *) echo "unknown shot"; exit 1 ;;
esac
ffmpeg -y -loglevel error -framerate $rfps -i renders/$shot/%04d.png \
  -vf "scale=1920:1080:flags=lanczos,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,tpad=stop_mode=clone:stop=6,format=yuv420p" \
  -frames:v $nf -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -r 30 -movflags +faststart renders/$shot.mp4
echo "encoded renders/$shot.mp4"
