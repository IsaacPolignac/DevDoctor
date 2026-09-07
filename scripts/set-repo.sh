#!/bin/sh
# Points every reference at your GitHub repository, once, before the first push:
#   scripts/set-repo.sh <owner>            (repository name stays "devdoctor")
# It rewrites the IsaacPolignac placeholder in README files, Cargo.toml, install scripts,
# the Homebrew formula, the Scoop manifest and the issue template links.
set -eu
owner="${1:?usage: set-repo.sh <github-owner>}"
files="$(grep -rl "IsaacPolignac" --exclude-dir=target --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.build . || true)"
[ -n "$files" ] || { echo "nothing to replace"; exit 0; }
for f in $files; do
  sed -i '' "s/IsaacPolignac/$owner/g" "$f"
  echo "updated $f"
done
