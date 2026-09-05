# Releasing DevDoctor

## One-time setup

1. Create the GitHub repository (public) and point the tree at it:
   ```sh
   scripts/set-repo.sh <your-github-user>     # replaces the YOUR_GITHUB_USER placeholder everywhere
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

1. Update `CHANGELOG.md` and bump the version in `Cargo.toml` (`workspace.package.version`),
   `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/package.json` and `apps/macos/Info.plist`.
2. Run the checks locally:
   ```sh
   cargo fmt --all && cargo clippy --workspace --exclude devdoctor-desktop --all-targets -- -D warnings
   cargo test --workspace --exclude devdoctor-desktop
   (cd apps/desktop && npm run build)
   # optional Windows compile proof from macOS: rustup target add x86_64-pc-windows-gnu; brew install mingw-w64
   cargo check --target x86_64-pc-windows-gnu -p devdoctor-cli
   ```
3. Commit, tag and push:
   ```sh
   git commit -am "Release v0.2.0" && git tag v0.2.0 && git push && git push --tags
   ```
   The `Release` workflow builds the CLI (macOS arm64/x86_64, Windows x64), the native macOS 26
   app, the web-technology macOS app and the Windows MSI/NSIS installers, attaches them with
   `.sha256` files and generates release notes.
4. When the release is public, refresh the Homebrew formula and the Scoop manifest with the real
   hashes and commit them:
   ```sh
   scripts/update-formula.sh 0.2.0
   ```
   Homebrew users install with `brew tap <user>/devdoctor https://github.com/<user>/devdoctor`
   then `brew install devdoctor`; Scoop users with `scoop install <raw url of scoop/devdoctor.json>`.

## Asset names

| Asset | Content |
| --- | --- |
| `devdoctor-v*-aarch64-apple-darwin.tar.gz`, `...-x86_64-apple-darwin.tar.gz` | CLI, one `devdoctor` binary |
| `devdoctor-v*-x86_64-pc-windows-msvc.zip` | CLI, `devdoctor.exe` |
| `DevDoctor-v*-macos26-arm64.zip` | native SwiftUI app (macOS 26+) |
| `DevDoctor-Web-v*-macos-arm64.zip` | Tauri app for macOS 12–15 |
| `DevDoctor-v*-windows-x64-setup.exe`, `DevDoctor-v*-windows-x64.msi` | Windows installers (per-user NSIS, MSI) |
