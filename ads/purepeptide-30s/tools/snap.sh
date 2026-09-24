#!/usr/bin/env bash
# Usage: tools/snap.sh <output-dir> <t1,t2,...>   — PNG frames at exact times (seconds).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p "$1"
npx hyperframes snapshot --at "$2" --no-end -o "$1" 2>&1 | grep -E "saved|error|Error|✗" || true
ls "$1"/*.png
