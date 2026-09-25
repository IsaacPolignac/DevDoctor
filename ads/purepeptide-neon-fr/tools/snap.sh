#!/usr/bin/env bash
# Usage: tools/snap.sh <output-dir> <t1,t2,...>   — PNG frames at exact times (seconds).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p "$1"
AT=$(python3 -c "import sys; print(','.join('%.4f' % (float(t) + 0.0005) for t in sys.argv[1].split(',')))" "$2")
npx hyperframes snapshot --at "$AT" --no-end -o "$1" 2>&1 | grep -E "saved|error|Error|✗" || true
ls "$1"/*.png
