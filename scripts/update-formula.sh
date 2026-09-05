#!/bin/sh
# Refreshes Formula/devdoctor.rb and scoop/devdoctor.json for a released version:
#   scripts/update-formula.sh 0.2.0
# Needs the GitHub release (source tarball and Windows zip) to exist.
set -eu
version="${1:?usage: update-formula.sh <version>}"
repo="$(sed -n 's/^repository = "https:\/\/github.com\/\([^"]*\)"/\1/p' Cargo.toml | head -n 1)"
src_url="https://github.com/$repo/archive/refs/tags/v$version.tar.gz"
src_sha="$(curl -fsSL "$src_url" | shasum -a 256 | cut -d' ' -f1)"
sed -i '' -e "s|url \".*archive/refs/tags/v.*\.tar\.gz\"|url \"$src_url\"|" -e "s|sha256 \".*\"|sha256 \"$src_sha\"|" Formula/devdoctor.rb
echo "Formula: v$version $src_sha"
zip_url="https://github.com/$repo/releases/download/v$version/devdoctor-v$version-x86_64-pc-windows-msvc.zip"
zip_sha="$(curl -fsSL "$zip_url.sha256" | cut -d' ' -f1)"
python3 - "$version" "$zip_url" "$zip_sha" <<'PY'
import json, sys
version, url, sha = sys.argv[1:]
with open("scoop/devdoctor.json") as f:
    m = json.load(f)
m["version"] = version
m["architecture"]["64bit"]["url"] = url
m["architecture"]["64bit"]["hash"] = sha
with open("scoop/devdoctor.json", "w") as f:
    json.dump(m, f, indent=2)
    f.write("\n")
PY
echo "Scoop: v$version $zip_sha"
