#!/usr/bin/env bash
# encode renders/<shot>/####.png (15 fps render) -> renders/<shot>.mp4 (30 fps, 1920x1080, H.264 CRF 14, yuv420p)
# motion-compensated interpolation doubles the frame rate; moves are slow and smooth by design.
set -e
cd "$(dirname "$0")/.."
shot=$1
ffmpeg -y -loglevel error -framerate 15 -i renders/$shot/%04d.png \
  -vf "scale=1920:1080:flags=lanczos,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -movflags +faststart renders/$shot.mp4
echo "encoded renders/$shot.mp4"
