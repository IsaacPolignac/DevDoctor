#!/bin/sh
# DevDoctor installer for macOS: downloads the latest release of the `devdoctor` CLI for this
# machine, verifies its SHA-256 and installs it into ~/.local/bin (or $DEVDOCTOR_INSTALL_DIR).
#
#   curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB_USER/devdoctor/main/scripts/install.sh | sh
#
# Environment: DEVDOCTOR_REPO (owner/name), DEVDOCTOR_VERSION (tag, default latest),
# DEVDOCTOR_INSTALL_DIR (default ~/.local/bin). Nothing runs with sudo.
set -eu

REPO="${DEVDOCTOR_REPO:-YOUR_GITHUB_USER/devdoctor}"
INSTALL_DIR="${DEVDOCTOR_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) ;;
  *) echo "install.sh supports macOS; on Windows use scripts/install.ps1, on Linux build from source (cargo install --git https://github.com/$REPO devdoctor-cli)." >&2; exit 1 ;;
esac
case "$arch" in
  arm64|aarch64) target="aarch64-apple-darwin" ;;
  x86_64) target="x86_64-apple-darwin" ;;
  *) echo "unsupported architecture: $arch" >&2; exit 1 ;;
esac

if [ -n "${DEVDOCTOR_VERSION:-}" ]; then
  tag="$DEVDOCTOR_VERSION"
else
  tag="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)"
  [ -n "$tag" ] || { echo "could not determine the latest release of $REPO" >&2; exit 1; }
fi

name="devdoctor-$tag-$target"
base="https://github.com/$REPO/releases/download/$tag"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading DevDoctor $tag for $target ..."
curl -fsSL -o "$tmp/$name.tar.gz" "$base/$name.tar.gz"
curl -fsSL -o "$tmp/$name.tar.gz.sha256" "$base/$name.tar.gz.sha256"
(cd "$tmp" && shasum -a 256 -c "$name.tar.gz.sha256" >/dev/null) || { echo "checksum mismatch; aborting" >&2; exit 1; }

mkdir -p "$INSTALL_DIR"
tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
install -m 755 "$tmp/devdoctor" "$INSTALL_DIR/devdoctor"
# Release binaries are not notarized as command line tools; clear the quarantine flag we just created.
xattr -d com.apple.quarantine "$INSTALL_DIR/devdoctor" 2>/dev/null || true

echo "Installed $INSTALL_DIR/devdoctor ($("$INSTALL_DIR/devdoctor" --version))"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "Add it to your PATH, for example: echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc" ;;
esac
echo "Run: devdoctor scan"
