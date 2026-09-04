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

## ADR-013 — Real macOS glass, CSS layers on top

The window is transparent with an overlay title bar; `window-vibrancy` attaches an
`NSVisualEffectView` so macOS blurs the desktop behind the window. Inside, the sidebar,
toolbar, cards and sheets are CSS glass layers (translucent fills, backdrop blur, specular top
edge, concentric radii, pill controls). No UI framework or icon font: a small set of inline SVG
line icons and CSS variables, so a designer can restyle everything without touching React logic
or the Rust core.
