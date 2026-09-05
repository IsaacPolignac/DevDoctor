# Decision records

Short records of the architectural choices that shape DevDoctor. Newest last.

## ADR-001 — Capture PATH from a fresh login shell

The DevDoctor desktop app is launched by Finder with a minimal PATH, and a CLI inherits its
terminal's already-polluted environment. Both are misleading. DevDoctor therefore spawns
`$SHELL -l -i -c <script>` with a clean environment (`HOME`, `USER`, `TERM=dumb`, launchd's
default PATH) and reads PATH, aliases, function names and a small allow-list of path-like
variables from marker lines. The variable allow-list, not the whole environment, is captured
so that secrets never enter DevDoctor. Environment variable *names* are captured for
snapshots. Falls back to the process environment with an explicit warning.

## ADR-002 — Static parser plus live verification

No parser can evaluate every zsh configuration. DevDoctor uses a tolerant, line-oriented
parser to *attribute* PATH entries to statements and to *plan* edits, and uses the real shell
to *verify* them: `zsh -n` for syntax and a re-captured login shell for PATH semantics. A fix
whose live verification fails is rolled back automatically.

## ADR-003 — The dominance rule for duplicate PATH statements

Removing an arbitrary duplicate can change command precedence (an earlier prepend removed
before a later one is harmless; the last prepend removed changes which `python` wins). The
rule: keep the last unconditional prepend (or the system PATH entry when no prepend exists),
remove other prepends and all appends; never touch conditional blocks, functions, `Set`
statements or expressions with command substitution. Verified by ADR-002.

## ADR-004 — Every mutation goes through `TxBuilder`

Fixers receive a `TxBuilder` and cannot reach the filesystem otherwise. The builder enforces
the `MutationPolicy` (home directory only, forbidden paths, protected directories, symlink
resolution so dotfile symlinks are edited in place), creates backups, records operations and
lets the `TransactionManager` roll back. Deleting caches or stopping processes is recorded as
irreversible; the preview says so.

## ADR-005 — Stable issue ids

Issue ids are `sha256(detector_id, fingerprint)[..12]`. The same finding keeps its id across
scans, which makes `devdoctor fix <id>`, ignore lists and history work without a lookup step.

## ADR-006 — Explainable health score

`100 - Σ severity_weight × confidence_factor`, capped at 40 per category, with every
contribution exposed. Info-level findings weigh nothing so that informational inventory
(occupied dev ports, several Python installations) does not punish the score.

## ADR-007 — Read the filesystem before invoking tools

`brew list`, `npm ls -g` and friends are slow. Homebrew's Cellar/Caskroom directories, npm's
`lib/node_modules`, pipx venvs, `~/.cargo/.crates.toml`, Ollama manifests and launchd plists
give the same facts in milliseconds. `brew doctor` and `--version` calls are reserved for deep
scans or explicit pages.

## ADR-008 — Snapshots store metadata only

A snapshot is a set of hashed `(category, key, value)` items. No file contents, no secret
values. Optional categories (storage, tools) are only diffed when both snapshots collected
them, and command-resolution items hash the resolved path, not the version, so quick scans and
full snapshots do not produce spurious differences.

## ADR-009 — Facade crate instead of duplicated wiring

`crates/devdoctor` assembles the engine, detectors, fixers, platform adapter, database and
transaction manager once. The CLI and the Tauri layer are thin: argument parsing/rendering and
command marshalling respectively. This keeps "GUI and CLI share the same core" true by
construction.

## ADR-010 — Functional UI first

The frontend is a plain React/TypeScript app with CSS variables, small presentational
components and pages that only call the typed API wrapper. Explanatory text comes from the
backend (`Issue`, `FixPreview`), so a later redesign can replace components without touching
diagnostics.

## ADR-011 — Plain-language layer over technical data

The engine keeps precise vocabulary (severity, confidence, detector ids, diffs). The desktop app
maps it to beginner-friendly words in one place (`apps/desktop/src/lib/plain.ts`): "Needs
attention / Should fix / Worth a look / Good to know" for severity, "Verified / Probable /
Possible" for confidence, glossary tooltips for PATH, startup files, caches and snapshots. A
"Technical details" switch (persisted as a setting) reveals ids, raw severities, evidence and
diffs by default. Nothing is hidden from experts and nothing is dumbed down in the data.

## ADR-012 — Fixers recompute their targets at apply time

Line numbers recorded during a scan go stale as soon as another fix (or the user) edits the same
file. Every file-editing fixer therefore re-parses the current files when previewing and
applying, locates the statement again (by directory, source target or content) and refuses with
a clear message when it cannot. Batch "fix safe issues" runs are correct without re-scanning
between fixes.

## ADR-014 — Startup profiling with a timestamped `xtrace`, not `zprof`

`zsh/zprof` only profiles functions, and most of a slow startup is top-level statements in
`.zshrc` (`source nvm.sh`, `eval "$(pyenv init -)"`). Running the login shell once with `-x`
and `PS4='+%D{%s%6.} %N:%i> '` stamps every executed line with a microsecond clock, its file or
function and its line number; the cost of a line is the time until the next one. User
startup-file lines receive everything they trigger (inclusive attribution), which answers
"which line of *my* file is slow"; files, functions and evals also get their self time. The
trace can contain expanded secrets, so it is parsed in memory, hotspots show the line as written
in the file, and everything is redacted before it leaves the core. bash 3.2 cannot stamp
sub-second times in `PS4`, so bash gets timing only.

## ADR-015 — Install tracking wraps the command instead of watching the filesystem

A filesystem watcher would need a background daemon, would miss changes made while DevDoctor
is not running, and could not tell which install caused which change. `devdoctor run` brackets
one command with two snapshots plus the text of the startup files and the entry names of a few
watched directories. The CLI executes the argument vector directly (no shell string), with
inherited stdio so installers keep their prompts, and shields itself from Ctrl-C so an
interrupted install is still recorded. Snapshot diffs stay metadata-only (ADR-008); startup-file
diffs are the one place file contents are compared, and they pass through `redact_text` before
being stored or displayed.

## ADR-016 — Startup errors come from the real shell's stderr

Guessing statically that `eval "$(pyenv init -)"` will fail is unreliable (PATH may be
extended earlier, functions may define the command). The login-shell capture already starts
the user's shell; keeping its stderr (redacted, capped) costs nothing and is direct evidence.
Errors are parsed into `(file, line, kind)`, deduplicated, and mapped onto parsed statements.
The automatic fix (comment the line out) is offered only when the command is absent from PATH
*and* from every known tool directory; when the binary exists somewhere, the issue recommends
fixing PATH order instead, because disabling the line would hide a real installation.

## ADR-017 — Daily snapshots through a user LaunchAgent, installed as a fixer

A background daemon inside DevDoctor would have to stay running; a LaunchAgent lets macOS do
the scheduling with no process of ours alive. The agent is a user agent (no sudo), runs the CLI
with a minimal PATH, writes to DevDoctor's log directory, and is created through the same
transaction machinery as fixes: the plist is written (and backed up) by `TxBuilder`,
`launchctl bootstrap`/`bootout` are recorded commands, validation asks launchd whether the agent
is loaded. Because loading launchd state is not a file change, the transaction is not
"reversible" in the rollback sense; the inverse operation is an explicit `unschedule`. The
desktop app can only schedule when a `devdoctor` binary is found in PATH: launchd needs a
stable path, and the app bundle does not ship the CLI.

## ADR-018 — `watch` is a tracking session, not a filesystem watcher

FSEvents would report thousands of writes without saying what they mean. `devdoctor watch`
reuses the snapshot model: a quick snapshot every few seconds, diffed against the previous one,
printed as the same explained changes users see in "What changed". It costs one snapshot per
interval (filesystem reads, `lsof`, `launchctl list`), needs no privileges, and ends with the
same record as `devdoctor run`, so graphical installers get the same after-the-fact report.

## ADR-019 — The native app drives the CLI over JSON instead of linking the Rust core

A SwiftUI app could link `devdoctor-core` through a C ABI or UniFFI, but that means a second
build system, generated bindings to keep in sync, and a process that holds SQLite open next to
the CLI. Running `devdoctor --json <command>` per action keeps one API for everything (the CLI
is documented, testable in a terminal and already the contract of the demo fixtures), isolates
crashes, and lets the app use any installed engine. The cost is a process launch per call
(tens of milliseconds, a second for a scan); pages reload on a shared refresh token rather than
polling, and scan progress is streamed as JSON lines on stderr (`scan --progress`). The engine
inside the bundle is named `devdoctor-engine`: APFS is case-insensitive by default, and a file
called `devdoctor` next to the `DevDoctor` executable would overwrite it.

## ADR-020 — Two desktop front ends, one primary

The native SwiftUI app (`apps/macos`) is the primary desktop experience: system materials,
Liquid Glass controls, a radar overview and an inspector that the web view could only imitate.
It requires macOS 26. The Tauri + React app (`apps/desktop`) stays in the tree for macOS 12–15
and for the browser demo mode used in screenshots and design work; it shares the facade crate,
so detectors and fixers reach both without duplication. Both front ends contain no diagnostic
logic (ADR-009).

## ADR-021 — Windows through one `sys` seam and a read-only PATH

Porting to Windows could have meant `#[cfg]` blocks scattered through the engine or a fork of
the detectors. Instead every OS primitive moved behind `core::sys` (same signatures on both
families) and a second `Platform` adapter was written; the detectors, fixers, transactions,
snapshots and tracking did not change. Three deliberate limits keep the port honest:

- PATH is read from the registry through PowerShell, exactly what a new terminal receives, and
  reported with instructions; DevDoctor does not write to the registry yet. A registry write
  would need its own backup/rollback operation in the transaction model before it can be a fixer.
- PowerShell profiles are not parsed or profiled. The shell parser is POSIX; pretending
  otherwise would produce wrong findings.
- Daily snapshots use `schtasks` (current user, no elevation) rather than a Windows service.

Windows binaries are cross-compiled from macOS for a compile-time proof (`x86_64-pc-windows-gnu`
with mingw) and built, tested and smoke-run on `windows-latest` in CI (MSVC), including the Task
Scheduler round trip. Until more real machines have run it, the README calls it beta.

## ADR-013 — Real macOS glass, CSS layers on top

The window is transparent with an overlay title bar; `window-vibrancy` attaches an
`NSVisualEffectView` so macOS blurs the desktop behind the window. Inside, the sidebar,
toolbar, cards and sheets are CSS glass layers (translucent fills, backdrop blur, specular top
edge, concentric radii, pill controls). No UI framework or icon font: a small set of inline SVG
line icons and CSS variables, so a designer can restyle everything without touching React logic
or the Rust core.
