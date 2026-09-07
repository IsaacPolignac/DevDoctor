# Releasing DevDoctor

## One-time setup

1. Create the GitHub repository (public) and point the tree at it:
   ```sh
   scripts/set-repo.sh <your-github-user>     # replaces the IsaacPolignac placeholder everywhere
   git remote add origin git@github.com:<your-github-user>/devdoctor.git
   git push -u origin main
   ```
2. Optional secrets (Settings → Secrets and variables → Actions). Without them the release
   workflow still runs and produces ad-hoc-signed macOS builds and unsigned Windows builds.
   | Secret | Purpose |
   | --- | --- |
   | `APPLE_CERTIFICATE_P12` | Developer ID Application certificate, base64 of the `.p12` |
   | `APPLE_CERTIFICATE_PASSWORD` | its password |
   | `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAMID)` |
   | `APPLE_NOTARY_KEY_P8`, `APPLE_NOTARY_KEY_ID`, `APPLE_NOTARY_ISSUER_ID` | App Store Connect API key for `notarytool` |
   Windows Authenticode signing is not wired yet (a certificate from a CA or Azure Trusted
   Signing would go into the `app-windows` and `cli-windows` jobs).

## Every release

1. Describe the release in `CHANGELOG.md` under a `## Unreleased` heading (the script renames it
   to the version and the date). Notes are written by a person, never generated.
2. Run one command from a clean, up-to-date `main`:
   ```sh
   scripts/release.sh 0.3.0 --dry-run   # bumps, checks, shows the diff, restores the tree
   scripts/release.sh 0.3.0             # the same, then commit "Release v0.3.0", tag, push
   ```
   The script bumps `Cargo.toml` (workspace version, propagated to every crate),
   `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/package.json` and its lock file,
   `apps/macos/Info.plist` (`CFBundleShortVersionString`, and `CFBundleVersion` + 1), refreshes
   `Cargo.lock`, then runs `cargo fmt --check`, clippy with warnings denied, the test suite and the
   web front-end build before touching git. `--skip-tests` leaves the tests to CI.
3. The pushed tag starts the `Release` workflow: CLI (macOS arm64/x86_64, Windows x64), native
   macOS 26 app, web-technology macOS app, Windows MSI and NSIS installers, all attached with
   `.sha256` files and generated release notes. Its last job runs `scripts/update-formula.sh`
   and commits the new Homebrew and Scoop hashes to `main`, so `brew install` and
   `scoop install` follow the release without a manual step.

Manual fallback, should the last job fail: `scripts/update-formula.sh 0.3.0`, commit, push.
Homebrew users install with `brew tap IsaacPolignac/devdoctor https://github.com/IsaacPolignac/DevDoctor`
then `brew install devdoctor`; Scoop users with `scoop install <raw url of scoop/devdoctor.json>`.

## Asset names

| Asset | Content |
| --- | --- |
| `devdoctor-v*-aarch64-apple-darwin.tar.gz`, `...-x86_64-apple-darwin.tar.gz` | CLI, one `devdoctor` binary |
| `devdoctor-v*-x86_64-pc-windows-msvc.zip` | CLI, `devdoctor.exe` |
| `DevDoctor-v*-macos26-arm64.zip` | native SwiftUI app (macOS 26+) |
| `DevDoctor-Web-v*-macos-arm64.zip` | Tauri app for macOS 12–15 |
| `DevDoctor-v*-windows-x64-setup.exe`, `DevDoctor-v*-windows-x64.msi` | Windows installers (per-user NSIS, MSI) |
