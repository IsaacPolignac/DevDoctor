#!/usr/bin/env bash
# PNG frames at exact times. Times in seconds (12.5) or frames (f375). Snapshot only the frames you need (4 shared CPUs).
#   tools/snap.sh <out-dir> <t1,t2,...> [project-dir]        e.g. tools/snap.sh /tmp/s07 f750,f780,f796,26.9
#   ZOOM='x,y,w,h' tools/snap.sh ...                          high-density crop of a stage region (deviceScaleFactor 3)
# project-dir defaults to this project (index.html). A scratch project (symlinks + its own index.html) works too.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$1"; TIMES="$2"; PROJ="${3:-$ROOT}"
mkdir -p "$OUT"
AT=$(python3 -c "import sys; print(','.join('%.4f' % ((float(t[1:]) / 30 if t.startswith('f') else float(t)) + 0.0005) for t in sys.argv[1].split(',')))" "$TIMES")
EXTRA=()
[ -n "${ZOOM:-}" ] && EXTRA+=(--zoom "$ZOOM")
cd "$ROOT"
npx hyperframes snapshot "$PROJ" --at "$AT" --no-end --describe false --timeout 20000 -o "$OUT" "${EXTRA[@]}" 2>&1 | grep -E "saved|rror|✗|warn" || true
ls "$OUT"/*.png
