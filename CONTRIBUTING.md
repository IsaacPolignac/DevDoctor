# Contributing to DevDoctor

Thanks for helping developers fix their machines. DevDoctor values trust, clarity and safety
over feature count: a smaller number of reliable detectors beats many speculative ones.

## Setup

```sh
rustup toolchain install stable          # Rust
cargo build                              # engine + CLI
cd apps/desktop && npm install           # desktop app
npm run tauri dev                        # run the app
```

Run everything before opening a pull request:

```sh
cargo fmt --all
cargo clippy --workspace --all-targets
cargo test --workspace
cd apps/desktop && npm run typecheck && npm run build
```

Use `DEVDOCTOR_HOME=/tmp/devdoctor-dev` while developing so your real database stays clean.

Windows: the same commands work from PowerShell (Rust stable with the MSVC toolchain, Node 20+).
From macOS you can prove a change still compiles for Windows without a PC:
`rustup target add x86_64-pc-windows-gnu && brew install mingw-w64`, then
`cargo check --target x86_64-pc-windows-gnu -p devdoctor-cli`. OS-specific code goes into
`crates/devdoctor-core/src/sys.rs` or a platform crate, never into detectors or fixers.

To exercise detectors and fixers against a made-up configuration without touching your own,
point both the home directory and the data directory at a scratch folder:

```sh
mkdir -p /tmp/fakehome && printf 'eval "$(pyenv init -)"\n' > /tmp/fakehome/.zshrc
HOME=/tmp/fakehome devdoctor --data-dir /tmp/fakehome/.dd scan
HOME=/tmp/fakehome devdoctor --data-dir /tmp/fakehome/.dd fix <id>
```

The login shell, the fixers' validation and the mutation policy all follow `HOME`, so fixes are
applied and rolled back inside the scratch folder.

`cargo check -p devdoctor-desktop` needs `apps/desktop/dist` to exist (Tauri embeds it): run
`npm run build` in `apps/desktop` once before checking or building the desktop crate.

To work on the interface without the Rust backend, run `npm run dev` in `apps/desktop` and open
http://localhost:1420: outside Tauri the app serves the sanitized fixtures in
`apps/desktop/src/demo` (regenerate them with `devdoctor demo-export`). The app icon is drawn by
`scripts/make-icon.swift`; run `swift scripts/make-icon.swift apps/desktop/src-tauri/icons/icon.png`
then `npx tauri icon` in `apps/desktop` to refresh the icon set.

## The native macOS app

`apps/macos` is a Swift Package; it needs Xcode 26 (macOS 26 SDK, Liquid Glass APIs).

```sh
cargo build --release -p devdoctor-cli          # the engine the app will run
cd apps/macos && swift build                    # or open Package.swift in Xcode
.build/debug/DevDoctor --section shell          # opens directly on a page
scripts/build-macos-app.sh --open               # full signed bundle in target/macos
```

The app never contains diagnostic logic: it runs `devdoctor --json <command>` and decodes the
result (`EngineModels.swift` mirrors the Rust structs; keep it in sync when a JSON shape changes).
To add a page: a `case` in `AppSection` (title, symbol, blurb), a view built from `PageScaffold`,
`SectionCard`, `Table` + `.devDoctorTable()`, a route in `DevDoctorApp.selectedPage`, and the
`EngineClient` method it needs. Use `.task(id: model.refreshToken)` so the page reloads after a
fix. Screenshots for review: launch the bundle with `--section <name>` and use `screencapture`.

## Adding a detector

1. Put facts in an inventory (`crates/devdoctor-core/src/inventory`) when they are reusable;
   keep policy ("is this a problem?") in the detector.
2. Implement `Detector` in `crates/devdoctor-detectors/src/<area>.rs`:
   - `meta()` with a stable id like `python.pip.mismatch`, a category and the scan modes.
   - `scan()` returning issues built with `IssueBuilder`. Fill `description` (what was found),
     `impact` (why it matters), `evidence` (what you observed), `recommended_action`, and
     `metadata` for fixers.
   - Use `Confidence::Confirmed` only for direct observations. Never present a guess as a fact.
3. Register it in `all_detectors()`.
4. Add a fixture under `fixtures/` and a test in `crates/devdoctor-detectors/tests`
   (`fixtures.rs` for startup-file fixtures, `startup_and_links.rs` for detectors that build
   their own temporary home).

Detectors must never modify anything and must not depend on network access.

## Adding a fixer

1. Implement `Fixer` in `crates/devdoctor-fixers`:
   - `supports(issue)` decides applicability from the issue's detector id and metadata.
   - `preview()` computes the exact changes without mutating (re-read files; do not trust line
     numbers recorded at scan time).
   - `apply()` mutates only through `TxBuilder` (`write_file`, `delete_dir`, `stop_process`,
     `run_command`...).
   - `validate()` checks real post-conditions; a failed check triggers automatic rollback.
2. Set `reversible`/`batch_safe` honestly. Batch-safe means reversible, low risk and confirmed.
3. Register it in `all_fixers()` and cover it with a test that runs against a temporary home.

Never add a fixer that runs `sudo`, touches system directories, or deletes user files without
an explicit per-item confirmation.

## Style

- `rustfmt` and `clippy` clean. No `unwrap`/`expect` in production paths unless logically
  impossible (say why).
- Typed errors (`devdoctor_core::Error`), no panics across detector boundaries.
- Redact anything that may contain a secret before logging or displaying it
  (`devdoctor_core::redact`).
- Keep user-facing text plain and specific: say what was found, why it matters, what changes.

## Pull requests

Describe the problem the change addresses, how it was tested (fixtures, real machine), and any
safety implications. Small, focused PRs are easier to review.
