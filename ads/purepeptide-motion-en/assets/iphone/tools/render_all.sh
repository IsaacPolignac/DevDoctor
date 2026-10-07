#!/bin/bash
# Re-render every deliverable sequentially (one Blender at a time).  usage: tools/render_all.sh [--screen PNG]
set -e
cd "$(dirname "$0")/.."
PY=${PY:-/home/user/DevDoctor/ads/purepeptide-blender/.venv/bin/python}
EXTRA="$@"
$PY tools/build_iphone.py
$PY tools/render_iphone.py front $EXTRA
$PY tools/render_iphone.py colortest
$PY tools/render_iphone.py front3d $EXTRA
$PY tools/render_iphone.py flyin $EXTRA
$PY tools/render_iphone.py tiltout
$PY tools/render_iphone.py hero_34 $EXTRA
$PY tools/render_iphone.py back $EXTRA
$PY tools/render_iphone.py contact
$PY tools/render_iphone.py cutcheck $EXTRA
echo ALL_DONE
