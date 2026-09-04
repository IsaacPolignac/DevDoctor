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

`cargo check -p devdoctor-desktop` needs `apps/desktop/dist` to exist (Tauri embeds it): run
`npm run build` in `apps/desktop` once before checking or building the desktop crate.

To work on the interface without the Rust backend, run `npm run dev` in `apps/desktop` and open
http://localhost:1420: outside Tauri the app serves the sanitized fixtures in
`apps/desktop/src/demo` (regenerate them with `devdoctor demo-export`). The app icon is drawn by
`scripts/make-icon.swift`; run `swift scripts/make-icon.swift apps/desktop/src-tauri/icons/icon.png`
then `npx tauri icon` in `apps/desktop` to refresh the icon set.

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
4. Add a fixture under `fixtures/` and a test in `crates/devdoctor-detectors/tests`.

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
