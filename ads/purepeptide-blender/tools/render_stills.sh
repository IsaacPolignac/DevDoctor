#!/usr/bin/env bash
# 2560x1440 stills, sequential: nohup tools/render_stills.sh > logs/stills.log 2>&1 &
cd "$(dirname "$0")/.."
for s in macro_still cap_still hero_still rim_still label_still; do
  .venv/bin/python tools/render_shot.py $s 2>&1 | grep --line-buffered -E "STILL|Error|Traceback"
done
echo ALL_DONE
