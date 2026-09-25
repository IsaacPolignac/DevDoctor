#!/usr/bin/env bash
# continuation under heavy CPU contention (another agent's renders): wait for turntable, then
# cap_top + macro_sweep rendered at 10 fps / 28 spp (interpolated to 30 fps), then the 4K still.
cd "$(dirname "$0")/.."
while pgrep -f "render_shot.py turntable" >/dev/null; do sleep 10; done
tools/encode.sh turntable 15
for shot in cap_top macro_sweep; do
  .venv/bin/python tools/render_shot.py $shot all --fps 10 --samples 28 2>&1 | grep --line-buffered -E "FRAME|DONE|Error|Traceback"
  tools/encode.sh $shot 10
done
.venv/bin/python tools/render_shot.py hero_still --samples 64 2>&1 | grep --line-buffered -E "FRAME|DONE|Error|Traceback"
echo ALL_DONE
