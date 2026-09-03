# Security policy

DevDoctor inspects developer machines, which are full of credentials. The following rules are
part of the design, not optional hardening:

- Nothing leaves the machine. No telemetry, no crash reporting, no update checks, no network.
- Secrets are never displayed, logged or stored. Environment variable values whose names look
  sensitive are hidden; snapshots keep variable names only; free-form text (command lines,
  config excerpts) passes through a redaction filter.
- Private key contents are never read. SSH checks look at file names, permissions and
  `~/.ssh/config` structure only.
- No shell strings. External programs are started with explicit argument vectors, timeouts and
  a controlled environment.
- Mutations are confined to the home directory and refused for `~/.ssh`, `~/.gnupg`, keychains
  and DevDoctor's own data. Symlinks are resolved and checked before writing; deletions refuse
  symlinked roots. `sudo` is never used.
- Every mutation is a transaction with backups; validation failures roll back automatically.

## Reporting a vulnerability

Please report security problems privately to the maintainers (see the repository's contact
information) rather than in a public issue. Include the DevDoctor version, macOS version and
reproduction steps. You will receive an acknowledgement, and a fix or mitigation plan before
any public disclosure.
