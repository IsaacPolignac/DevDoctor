#!/bin/sh
# Cuts a DevDoctor release in one command: bumps every version field, runs the checks, commits,
# tags and pushes. The push of the tag starts the Release workflow, which builds and publishes
# the binaries and then refreshes the Homebrew formula and the Scoop manifest on main.
#
#   scripts/release.sh 0.3.0               release 0.3.0
#   scripts/release.sh 0.3.0 --dry-run     apply the bumps, run the checks, show the diff, restore
#   scripts/release.sh 0.3.0 --skip-tests  skip cargo test locally (CI runs the full suite)
#
# CHANGELOG.md must contain either a "## <version>" section or a "## Unreleased" section, which
# is renamed to the version and today's date. Release notes are never invented by the script.
set -eu

version="${1:?usage: release.sh <version> [--dry-run] [--skip-tests]}"
shift
dry_run=0
skip_tests=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --skip-tests) skip_tests=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
case "$version" in
  *[!0-9.]*|.*|*.|*..*) echo "version must look like 1.2.3 (got '$version')" >&2; exit 2 ;;
esac
dots="$(printf '%s' "$version" | tr -cd '.' | wc -c | tr -d ' ')"
[ "$dots" = "2" ] || { echo "version must look like 1.2.3 (got '$version')" >&2; exit 2; }

cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"

fail() { echo "release: $*" >&2; exit 1; }

# ---- preconditions -------------------------------------------------------------------------
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "switch to main first"
[ -z "$(git status --porcelain)" ] || fail "the working tree is not clean; commit or stash first"
git fetch origin main --quiet
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main is not in sync with origin/main (pull or push first)"
[ -z "$(git tag -l "v$version")" ] || fail "tag v$version already exists locally"
[ -z "$(git ls-remote --tags origin "refs/tags/v$version")" ] || fail "tag v$version already exists on origin"
current="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -n 1)"
[ "$current" != "$version" ] || fail "Cargo.toml is already at $version"

# ---- changelog -----------------------------------------------------------------------------
today="$(date +%Y-%m-%d)"
if grep -q "^## $version" CHANGELOG.md; then
  echo "CHANGELOG: section for $version found"
elif grep -q "^## Unreleased" CHANGELOG.md; then
  sed -i.bak "s/^## Unreleased.*/## $version — $today/" CHANGELOG.md && rm -f CHANGELOG.md.bak
  echo "CHANGELOG: '## Unreleased' renamed to '## $version — $today'"
else
  fail "CHANGELOG.md needs a '## Unreleased' section (or '## $version — <date>') describing this release"
fi

# ---- version bumps -------------------------------------------------------------------------
python3 - "$version" <<'PY'
import json, pathlib, re, sys
version = sys.argv[1]

p = pathlib.Path("Cargo.toml"); s = p.read_text()
s, n = re.subn(r'(?m)^version = "[^"]+"', f'version = "{version}"', s, count=1)
assert n == 1, "workspace version not found in Cargo.toml"
p.write_text(s)

p = pathlib.Path("apps/desktop/src-tauri/tauri.conf.json"); d = json.loads(p.read_text())
d["version"] = version
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")

for name in ("apps/desktop/package.json", "apps/desktop/package-lock.json"):
    p = pathlib.Path(name)
    if not p.exists():
        continue
    d = json.loads(p.read_text())
    d["version"] = version
    if "packages" in d and "" in d["packages"]:
        d["packages"][""]["version"] = version
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")

p = pathlib.Path("apps/macos/Info.plist"); s = p.read_text()
s, n = re.subn(r"(<key>CFBundleShortVersionString</key>\s*<string>)[^<]+(</string>)", rf"\g<1>{version}\g<2>", s)
assert n == 1, "CFBundleShortVersionString not found"
def bump(m):
    return f"{m.group(1)}{int(m.group(2)) + 1}{m.group(3)}"
s, n = re.subn(r"(<key>CFBundleVersion</key>\s*<string>)(\d+)(</string>)", bump, s)
assert n == 1, "CFBundleVersion not found"
p.write_text(s)
print("versions bumped to", version)
PY
cargo update --workspace --offline --quiet 2>/dev/null || cargo update --workspace --quiet

# ---- checks --------------------------------------------------------------------------------
echo "checking formatting and lints..."
cargo fmt --all -- --check
cargo clippy --workspace --exclude devdoctor-desktop --all-targets -- -D warnings
if [ "$skip_tests" = "0" ]; then
  echo "running tests..."
  cargo test --workspace --exclude devdoctor-desktop
fi
if [ -d apps/desktop/node_modules ]; then
  echo "building the web front end..."
  (cd apps/desktop && npm run build --silent)
fi

# ---- commit, tag, push ---------------------------------------------------------------------
git --no-pager diff --stat
if [ "$dry_run" = "1" ]; then
  echo
  echo "dry run: restoring the working tree. A real run would now:"
  echo "  git commit -am 'Release v$version' && git tag -a v$version && git push origin main v$version"
  git checkout -- .
  exit 0
fi
git add -A
git commit -q -m "Release v$version"
git tag -a "v$version" -m "DevDoctor $version"
git push origin main
git push origin "v$version"
repo="$(sed -n 's/^repository = "https:\/\/github.com\/\([^"]*\)"/\1/p' Cargo.toml | head -n 1)"
echo
echo "Release v$version pushed. Follow the build at https://github.com/$repo/actions/workflows/release.yml"
echo "When it finishes, the workflow commits the Homebrew and Scoop hashes to main by itself."
