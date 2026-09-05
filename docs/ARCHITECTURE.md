# DevDoctor architecture

## Goals

- One diagnostic engine shared by the desktop app and the CLI. No diagnostic logic in either UI.
- Detectors never mutate. Fixers mutate only through transactions.
- Every finding carries its evidence, impact and recommended action as structured data.
- Platform-specific code is isolated behind a trait so Linux/Windows can be added later.
- Local-first: SQLite, backups on disk, no network.

## Crates

```
   ┌────────────────────────┐
   │ apps/macos (SwiftUI)   │  spawns `devdoctor --json <command>`, reads JSON
   └──────────┬─────────────┘  (progress: `scan --progress` events on stderr)
              ▼
                         ┌──────────────────────┐   ┌──────────────────────┐
                         │ apps/desktop (Tauri) │   │ crates/devdoctor-cli │
                         └──────────┬───────────┘   └──────────┬───────────┘
                                    │  Tauri commands            │ clap
                                    ▼                            ▼
                         ┌───────────────────────────────────────────────┐
                         │ crates/devdoctor  (facade: DevDoctor struct)  │
                         │ scan / issues / fix / rollback / explorers /  │
                         │ snapshots / overview / search / report        │
                         └───────┬───────────────┬───────────────┬───────┘
                                 │               │               │
                    ┌────────────▼───┐   ┌───────▼────────┐  ┌───▼──────────────────┐
                    │ devdoctor-     │   │ devdoctor-     │  │ devdoctor-platform-  │
                    │ detectors      │   │ fixers         │  │ macos | windows      │
                    └────────────┬───┘   └───────┬────────┘  └───┬──────────────────┘
                                 │               │               │
                         ┌───────▼───────────────▼───────────────▼───────┐
                         │ crates/devdoctor-core                         │
                         │ SystemContext · Issue · Detector · Fixer      │
                         │ shell parser · PATH model · resolve           │
                         │ ScanEngine · HealthScore · TransactionManager │
                         │ BackupStore · Database (SQLite) · Snapshots   │
                         │ inventories (homebrew, node, python, rust,    │
                         │ tools, storage, ollama, local AI, git, ssh)   │
                         │ sys: the OS primitives (one impl per family)  │
                         └───────────────────────────────────────────────┘
```

The facade selects the adapter at compile time (`cfg(target_os = "macos")` /
`cfg(windows)`); the macOS crate is empty on other systems so `cargo test --workspace` runs
everywhere, and the Windows crate compiles on every OS so its `netstat`/`reg` parsers are tested
on macOS too.

### devdoctor-core

- `context::SystemContext` is the only door to the machine. It owns the home directory, the
  shell kind, the process environment, a `Platform` implementation, a `CommandRunner`, and
  caches for the login-shell capture and the startup-file analysis. Tests build one with
  `SystemContext::for_test` (temporary home, `FakePlatform`, `MockRunner`, explicit PATH).
- `command`: structured process execution (argument vectors, timeouts, controlled environment).
  DevDoctor never builds shell command strings.
- `issue`: the `Issue` model and `IssueBuilder`. Ids are stable hashes of
  `detector_id + fingerprint`, so the same problem keeps its id across scans.
- `detector`: the `Detector` trait (`meta()` + `scan(&SystemContext)`) and `ScanMode`.
- `engine::ScanEngine`: runs detectors with `catch_unwind`, measures each one, annotates
  issues with fixer availability, computes the health score.
- `health`: explainable score (severity weight × confidence factor, capped per category).
- `fixer`: the `Fixer` trait (`supports`, `preview`, `apply`, `validate`), `FixPreview`,
  `FixerRegistry`.
- `transaction`: `Transaction`, `Operation`, `MutationPolicy` (allowed roots, forbidden
  paths, protected directories, symlink checks), `TxBuilder` (the only mutation primitives:
  `write_file`, `delete_file`, `delete_symlink`, `delete_dir`, `clear_dir`, `stop_process`,
  `run_command`) and `TransactionManager` (apply with automatic rollback, manual rollback).
  `delete_symlink` removes only the link and records its target, so rollback recreates it.
- `backup`: content-addressed copies of files before modification.
- `db`: SQLite schema and queries (scans, issues, ignored issues, transactions, operations,
  backups, snapshots, settings). Migrations are embedded SQL files.
- `shell`: tolerant parser for zsh/bash startup files, multi-file analysis with static
  variable expansion, PATH mutation model, the duplicate "dominance" rule and safe rewriting.
- `path_env`: fresh login-shell capture (PATH, aliases, functions, allow-listed variables,
  environment variable names), PATH report with per-entry attribution and origin.
- `resolve`: command resolution explorer.
- `inventory`: read-only fact gathering for Homebrew, Node, Python, Rust, tools, package
  managers, processes, storage, Ollama, other local AI stores, Git and SSH. The storage
  measurement is cached on the `SystemContext` for the duration of a scan so that several
  storage detectors share one walk of the project folders.
- `snapshot`: snapshot collection (metadata only) and diffing.
- `startup`: terminal startup profiling. Timing starts the controlled login shell
  (`path_env::login_shell_spec`) several times; attribution runs zsh once with `xtrace` and a
  `PS4` carrying epoch microseconds, `%N` (file or function) and `%i` (line), then assigns the
  time between consecutive trace lines to the first line. User startup-file lines receive
  everything they trigger (inclusive); files, functions and evals also get their own self time.
  Only redacted summaries leave the module.
- `schedule`: the daily-snapshot LaunchAgent: plist text, paths, status (`launchctl print`),
  which `devdoctor` binary to run. Installing and removing it are fixers, so the change goes
  through a transaction like everything else.
- `tracking`: install tracking for `devdoctor run` and `devdoctor watch`. `begin` takes a full snapshot, keeps the text
  of every known startup file and the entry names of a few watched directories; `finish` does
  the same after the command and produces a `RunRecord` (snapshot diff, redacted unified diffs,
  directory changes, runtime version changes, headline). Runs are persisted in the `runs` table.

### Platform trait

`platform::Platform` exposes `os_info`, `processes`, `listening_ports`, `services`,
`process_alive`, `stop_process` and `reveal_in_file_manager`. The macOS implementation uses
`sysinfo` for processes, `lsof -F` for ports, launchd plists plus `launchctl list` for
services, and `sysctl`/`sw_vers` for system information. The Windows implementation uses
`sysinfo`, `netstat -ano`, the `HKCU\...\Run` key plus the Startup folder, `taskkill` and
`explorer /select`. `FakePlatform` serves tests.

### The `sys` module

Everything that differs between Unix and Windows below the `Platform` trait lives in
`devdoctor-core/src/sys.rs`: permission bits, modification times, allocated sizes and hard-link
identity for `dir_size`, executability (`mode & 0o111` versus `PATHEXT`), symlink creation,
PATH splitting (`:` versus `;`, case folding on Windows), the well-known program directories,
the default shell and `%LOCALAPPDATA%`. No other file in the engine imports `std::os::unix` or
`std::os::windows`. On Windows the shell capture is replaced by a registry read through
PowerShell (`PathSource::Registry`), startup-file analysis finds no POSIX files, the startup
profiler reports that PowerShell is not profiled, and the launchd schedule module has a
Task Scheduler twin (`schtasks /Create|/Query|/Delete`). Detectors and fixers that only make
sense on macOS (Homebrew, Xcode, launchd, PATH statement edits) are registered only there.

## Key flows

### Quick scan

1. `DevDoctor::scan` refreshes the shell capture (a fresh `$SHELL -l -i` with a minimal
   environment prints PATH, aliases, function names and a few path-like variables).
2. `ScanEngine::run` executes each detector selected by the mode, isolating failures.
3. The report (issues, timings, health) is persisted; issues from detectors that ran but did
   not report again are marked resolved.
4. A lightweight snapshot is recorded when its content hash differs from the latest one.

### PATH duplicate fix (the reference vertical slice)

1. `shell.path.duplicate` compares the effective PATH with the statically parsed statements
   and applies the dominance rule (`shell::path_model::plan_duplicate_removals`): the last
   unconditional prepend of a directory decides its position; earlier prepends and every
   append are redundant; appends are also redundant when the system PATH already has the
   directory. Conditional statements, functions and complex expressions are never edited.
2. The fixer re-parses the files at preview and apply time (never trusts stale line numbers),
   rewrites or deletes only the redundant statement, and shows a unified diff.
3. Validation after apply: `zsh -n` on each file; a fresh login shell must produce the same
   de-duplicated PATH order and fewer occurrences of the directory. Otherwise the backups are
   restored automatically.

### Install tracking (`devdoctor run`)

1. The CLI asks the facade to `begin_tracking`: the shell capture is refreshed, a full snapshot
   (`kind = run_before`) is collected and persisted immediately, startup-file contents and
   watched-directory listings are kept in memory.
2. The CLI runs the user's argument vector in the foreground with inherited stdio (no shell
   string is built). A no-op `SIGINT` handler is installed in DevDoctor for the duration:
   handlers are reset on `exec`, so the child keeps the default Ctrl-C behaviour while DevDoctor
   survives to record the aftermath.
3. `finish_tracking` refreshes the shell capture, collects the `run_after` snapshot, diffs both
   snapshots, diffs the startup files (through `redact_text`), compares directory listings and
   runtime versions, and stores the `RunRecord`. The CLI exits with the child's status.

### Live watch and scheduled snapshots

`devdoctor watch` is a tracking session (same `begin`/`finish` as `run`) with a loop in the
middle: every few seconds a quick, unpersisted snapshot is diffed against the previous one and
the changes are printed with a timestamp. Ctrl-C sets a flag (the handler only stores to an
atomic), the loop ends and the summary is recorded like a run. `devdoctor snapshot schedule`
writes a user LaunchAgent (`StartCalendarInterval`, missed runs fire on wake) through the
transaction builder and loads it with `launchctl bootstrap gui/<uid>`; `unschedule` runs
`launchctl bootout` and deletes the file with a backup.

### Startup profiling

1. `startup::measure` starts `$SHELL -l -i -c exit` N times in the controlled environment and
   keeps each wall-clock duration.
2. `startup::trace` starts it once more with `-x` and `PS4='+%D{%s%6.} %N:%i> '`; the stderr is
   parsed by locating markers anywhere in the text (command-substitution output interleaves).
3. `startup::attribute` computes self time per source and inclusive time per user startup line,
   replaces the expanded command with the line as written in the file, redacts it and attaches a
   hint for known slow tools. The quick scan reuses the capture's duration as the first sample
   and only slow shells pay for a confirmation run and a trace.

### Snapshots and "What changed"

Snapshots store `(category, key, value, hash)` items: PATH, startup-file hashes, Homebrew
formulae/casks, npm globals, pipx/uv/cargo installs, Node and Python installations, command
resolution (path only, versions informational), launch agents, listening ports, environment
variable names, tools, Ollama models and (when measured) storage buckets. `snapshot::diff`
turns two snapshots into described changes and a headline.

## The native macOS app

`apps/macos` is a Swift Package (SwiftUI, macOS 26) with no Rust linkage: `EngineClient` runs the
`devdoctor` binary with `--json` for every read and every change, decodes the same JSON the CLI
prints, and shows it. The bundle produced by `scripts/build-macos-app.sh` carries the engine as
`Contents/MacOS/devdoctor-engine`; during development the client falls back to the repository's
`target/release` or `target/debug` build, then to `devdoctor` in PATH, and `DEVDOCTOR_ENGINE`
overrides the lookup. App and CLI share the default data directory, so history, snapshots,
recorded runs and ignored issues are the same in both. Live scan progress comes from
`devdoctor scan --progress`, which writes one JSON event per detector on stderr. Mutations follow
the CLI's own flow: `fix --dry-run` / `clean … --dry-run` / `snapshot schedule --dry-run` for the
preview sheet, then the same command with `--yes`; the returned transaction is shown in a result
sheet with Undo (`rollback`). `DevDoctor --section <name>` opens a page directly (QA, deep links).

## Extending

Adding a detector: implement `Detector` in `crates/devdoctor-detectors`, register it in
`all_detectors()`, add a fixture-based test. Adding a fixer: implement `Fixer` in
`crates/devdoctor-fixers`, register it in `all_fixers()`, make sure `preview` never mutates
and `validate` verifies real post-conditions. See `CONTRIBUTING.md`.
