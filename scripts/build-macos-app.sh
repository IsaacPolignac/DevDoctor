#!/usr/bin/env bash
# Builds the native macOS app: the Rust engine (CLI) in release mode, the SwiftUI app, and a
# self-contained DevDoctor.app bundle (engine included) signed ad hoc.
#
#   scripts/build-macos-app.sh            -> target/macos/DevDoctor.app
#   scripts/build-macos-app.sh --open     -> also launches it
#
# Requirements: Xcode 26 (macOS 26 SDK; the app uses Liquid Glass APIs) and the Rust toolchain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/macos"
OUT="$ROOT/target/macos"
BUNDLE="$OUT/DevDoctor.app"
CONFIG="${CONFIG:-release}"

echo "==> Building the engine (cargo build --release -p devdoctor-cli)"
(cd "$ROOT" && cargo build --release -p devdoctor-cli)

echo "==> Building the SwiftUI app (swift build -c $CONFIG)"
(cd "$APP_DIR" && swift build -c "$CONFIG" 2>&1 | grep -Ev "^\[|^Compiling|^Emitting|^Write|^Build complete" || true)
BIN_DIR="$(cd "$APP_DIR" && swift build -c "$CONFIG" --show-bin-path)"
test -x "$BIN_DIR/DevDoctor" || { echo "Swift build did not produce $BIN_DIR/DevDoctor" >&2; exit 1; }

echo "==> Assembling $BUNDLE"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"
cp "$BIN_DIR/DevDoctor" "$BUNDLE/Contents/MacOS/DevDoctor"
# Named devdoctor-engine: APFS is case-insensitive, so "devdoctor" would overwrite "DevDoctor".
cp "$ROOT/target/release/devdoctor" "$BUNDLE/Contents/MacOS/devdoctor-engine"
cp "$APP_DIR/Info.plist" "$BUNDLE/Contents/Info.plist"
cp "$APP_DIR/Assets/AppIcon.icns" "$BUNDLE/Contents/Resources/AppIcon.icns"
if [ -d "$BIN_DIR/DevDoctor_DevDoctor.bundle" ]; then
  cp -R "$BIN_DIR/DevDoctor_DevDoctor.bundle" "$BUNDLE/Contents/Resources/"
fi
printf 'APPL????' > "$BUNDLE/Contents/PkgInfo"

echo "==> Signing (ad hoc)"
# Developer ID signing when DEVDOCTOR_SIGN_IDENTITY is set (release workflow); ad-hoc otherwise.
if [ -n "${DEVDOCTOR_SIGN_IDENTITY:-}" ]; then
  codesign --force --deep --options runtime --timestamp --sign "$DEVDOCTOR_SIGN_IDENTITY" "$BUNDLE" >/dev/null
else
  codesign --force --deep --sign - --timestamp=none "$BUNDLE" >/dev/null
fi
codesign --verify --deep --strict "$BUNDLE"

echo "==> Done: $BUNDLE"
"$BUNDLE/Contents/MacOS/devdoctor-engine" --version
if [ "${1:-}" = "--open" ]; then
  open "$BUNDLE"
fi
