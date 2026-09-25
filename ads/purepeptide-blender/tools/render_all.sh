#!/usr/bin/env bash
# full production run (background): nohup tools/render_all.sh > logs/render_all.log 2>&1 &
cd "$(dirname "$0")/.."
for shot in hero turntable cap_top macro_sweep; do
  .venv/bin/python tools/render_shot.py $shot all 2>&1 | grep --line-buffered -E "FRAME|DONE|Error|Traceback"
  tools/encode.sh $shot
done
.venv/bin/python tools/render_shot.py hero_still 2>&1 | grep --line-buffered -E "FRAME|DONE|Error|Traceback"
echo ALL_DONE
