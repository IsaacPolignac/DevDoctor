# Changelog

All notable changes to DevDoctor. The format follows [Keep a Changelog](https://keepachangelog.com/).

## 0.2.2 — 2026-09-08

### Improved

- Refreshed the public README with the current application icon, direct platform downloads,
  and privacy-checked native macOS screenshots and an English walkthrough.
- Reused the bundle icon inside the native sidebar so the application mark stays consistent
  with the Dock, About panel and release artwork.
- Added a presentation mode that replaces the local computer name in documentation captures.
- Made the detector fixture tests portable across machines without Apple Silicon Homebrew.

## 0.2.1 — 2026-09-07

### Improved

- Polished native macOS Overview, inspector, tables and compact layouts.
- Consistent transparent Liquid Glass and neutral indicators for unscanned areas.
- Subtle radar transitions that respect Reduce Motion.
- Optional quiet scan-completion sound; automatic startup scans remain silent.
- French, Spanish and Simplified Chinese interface translations and accessibility labels.
- Clearer inline commands in diagnostic explanations and repair previews.
- Health refresh after ignoring findings, clean release builds and translation checks in CI.

## 0.2.0 — 2026-09-05

### Added

- **Windows support (beta)**: a `devdoctor-platform-windows` adapter (processes through
  `sysinfo`, listening ports through `netstat -ano`, startup entries from the per-user `Run`
  key and the Startup folder, `taskkill` to stop processes, `explorer /select` to reveal files)
  and a portable `sys` module in the core so every filesystem primitive (modes, mtimes,
  allocated sizes, executability through `PATHEXT`, symlinks, PATH splitting on `;`) has one
  implementation per OS family. On Windows the PATH is read from the registry (machine value,
  then user value) through PowerShell, which is what a new terminal receives; duplicated, dead
  and relative entries are reported with instructions for the Environment Variables dialog
  (no automatic registry edit yet). Runtime discovery covers the nodejs.org installer,
  nvm-windows, fnm, Volta, python.org installs, pyenv-win, uv, conda and flags the Microsoft
  Store `python.exe` alias. Storage categories and package managers use the `%LOCALAPPDATA%`
  locations plus winget, Scoop and Chocolatey. Daily snapshots use a Task Scheduler task
  (`schtasks`, current user). `devdoctor run` launches `.cmd`/`.bat` tools through `cmd.exe`
  and keeps Ctrl-C for the wrapped command with a console control handler. Data lives in
  `%LOCALAPPDATA%\DevDoctor`. The Tauri app builds MSI and per-user NSIS installers with an
  opaque window and the system title bar. CI runs clippy, the tests, a real scan and the Task
  Scheduler round trip on `windows-latest`; the release workflow publishes `devdoctor.exe` and
  both installers.
- **Interface languages**: English, French, Spanish and Simplified Chinese in the native macOS app
  and in the web-technology app (Settings → Language: System / English / Français / Español /
  中文). One translation source (`apps/i18n/strings/*.json`, English as the key) feeds both apps
  through `scripts/gen-i18n.py`, which also reports untranslated strings; a missing translation
  falls back to English. The engine's diagnostics and the CLI remain in English.
- **Publishing kit**: `scripts/install.sh` (macOS, SHA-256 verified, `~/.local/bin`),
  `scripts/install.ps1` (Windows, user PATH), a Homebrew formula (`Formula/devdoctor.rb`) and
  a Scoop manifest (`scoop/devdoctor.json`) with `scripts/update-formula.sh` to refresh their
  hashes after a release, `scripts/set-repo.sh` to point every link at your GitHub account,
  crate metadata (repository, keywords, categories), optional Developer ID signing and
  notarization in the release workflow (enabled by secrets), and `docs/RELEASING.md`.

- **Native macOS app** (`apps/macos`): the SwiftUI interface designed with macOS 26 materials
  (radar overview, system areas, inspector with cause / impact / proposed change / evidence,
  repair preview with diff) is now the primary desktop app and covers the whole engine: Shell with
  the startup profiler, PATH, Runtimes, Packages, Developer Tools, Processes, Ports, Startup
  Items, Developer Storage and Local AI with previewed deletions, Git, SSH, What Changed with
  snapshots and recorded runs, History with scans / repairs / runs and undo, Settings with the
  daily-snapshot switch and Markdown/JSON reports, batch "Fix safely", ignore/unignore, live scan
  progress. Built and signed by `scripts/build-macos-app.sh`; the engine ships inside the bundle.
- CLI commands that back the app and are useful on their own: `devdoctor runtimes`,
  `devdoctor clean node-modules|venv <path>` and `clean ollama-model <name>` (preview, confirm),
  `devdoctor scan --progress` (JSON progress events on stderr).
- **Install tracking**: `devdoctor run <command...>` snapshots the environment before and after
  any command (an installer, `brew install`, `curl ... | sh`) and reports exactly what it
  changed: unified diffs of the startup files (secrets redacted), PATH, packages, runtimes and
  their versions, startup services, listening ports, and new entries in the home folder,
  `~/.config`, `~/.local/bin`, `/usr/local/bin`, `/Applications` and the LaunchAgents folders.
  Ctrl-C reaches the wrapped command but not DevDoctor, so an interrupted install is still
  recorded. `devdoctor runs` lists recorded runs; the desktop "What Changed" page shows them.
- **Terminal startup profiler**: `devdoctor startup` times complete login-shell starts and, for
  zsh, traces one start line by line (timestamped `xtrace`) to name the statements that cost the
  most, with advice for the usual culprits (nvm, compinit, conda, pyenv, oh-my-zsh, completion
  generators). The desktop Shell page has a "Startup time" card.
- **Detectors** (34 in total): slow terminal startup (`shell.startup.slow`), errors printed at
  terminal startup traced to the exact line (`shell.startup.errors`), broken command links in
  PATH directories (`shell.path.dangling_symlinks`), missing or broken Xcode Command Line Tools
  (`macos.xcode_clt`), Intel Homebrew running under Rosetta on Apple Silicon (`homebrew.health`).
- **Fixers** (16 in total): disable a startup line that calls a command which is no longer
  installed anywhere (`shell.line.comment_out`, validated by restarting a login shell and
  checking the error is gone), and remove dangling symlinks from PATH directories in the home
  folder (`shell.path.remove_dangling_symlinks`, reversible: undo recreates the links).
- **Live watch**: `devdoctor watch [--interval N]` prints every tracked change as it happens
  (for graphical installers, `.pkg` files or anything not wrapped in `devdoctor run`) and saves
  the same summary as a run when stopped with Ctrl-C.
- **Daily snapshots**: `devdoctor snapshot schedule [--hour H --minute M]` installs a user
  LaunchAgent that runs `devdoctor snapshot create` every day; `status` and `unschedule`
  complete the set, and the desktop Settings page has a "Daily snapshot" switch. Install and
  removal are transactional fixers validated against `launchctl`.
- Detectors for npm: a global prefix that needs sudo (`node.npm.global_prefix_not_writable`),
  global packages stranded in an inactive nvm/fnm/asdf/mise Node version
  (`node.npm.stranded_globals`); and Claude Code installed both natively and via npm, or in
  several Node versions (`ai.claude_code.duplicate_install`). 37 detectors, 18 fixers.
- Health trend sparkline on the desktop Overview (last 20 checks).
- French README (`README.fr.md`).
- `devdoctor report --markdown`: a sanitized Markdown summary to paste into a bug report; the
  desktop Settings page has "Markdown for a bug report".
- `devdoctor completions <shell>` for zsh, bash, fish, elvish and PowerShell.
- Recorded runs appear in `devdoctor history`.
- GitHub Actions CI (format, clippy, tests, CLI smoke test, desktop build), a release workflow
  producing CLI tarballs and the app bundle, issue and pull request templates.

### Changed

- The login-shell capture keeps what the shell printed to stderr (redacted, capped) so
  detectors can explain startup errors without starting another shell.
- Sanitized reports and demo fixtures also replace the username wherever it appears as a whole
  word (`LOGNAME=…`, temporary paths) and replace e-mail addresses with `<email>`.
- Transactions can record symbolic-link removals (`symlink_delete`) and undo them.
- Version 0.2.0 across the workspace and the desktop app.

## 0.1.0 — 2026-09-04

First vertical slice: shared Rust engine, 30 detectors, 14 transactional fixers, CLI, Tauri
desktop app with a native macOS interface, snapshots and "What changed", sanitized diagnostic
report.
