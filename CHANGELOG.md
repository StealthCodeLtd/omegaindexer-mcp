# @stealth-code/omegaindexer-mcp

## 1.0.4

### Patch Changes

- 880399f: Clarify the README's OpenCode section: tell agents to add a _remote_ MCP server with the hosted URL, and warn against registering a `type: "local"` npx entry (which fails — this package is an installer, not a stdio server).

## 1.0.3

### Patch Changes

- 9ef3e72: Add an OpenCode remote-config section to the README, and fail loudly with stderr guidance when the installer is mistakenly launched as a stdio MCP server (instead of silently corrupting the JSON-RPC channel).

## 1.0.2

### Patch Changes

- 70c9cdf: Point the headless install pointer at the canonical `/install/headless` URL and tighten the install prompt wording.

## 1.0.1

### Patch Changes

- 4abcf5c: Simplify README to a user-facing, prompt-driven install/uninstall guide.

## 1.0.0

Initial public release. CLI installer/configurator for the hosted Omegaindexer MCP
server (`https://mcp.omegaindexer.com/mcp`). Writes per-host MCP configuration for
HTTP-native MCP hosts.

### Added

- `install --client <name>` writes per-host MCP config for HTTP-native hosts:
  `claude-code`, `claude-desktop`, `cursor`, `codex`, `windsurf`. Auto-detects the
  host when `--client` is omitted.
- All entries are direct `url`-style registrations.
- `cursor`, `windsurf`, and `codex` configs are written idempotently with atomic
  `tmp + rename`. Existing entries under the `omegaindexer` key emit a stderr warning
  before overwrite.
- `claude-code` and `claude-desktop` are instruction-only: the tool prints the exact
  CLI command or Settings UI step; no config file is modified.
- Codex: duplicate `[mcp_servers.omegaindexer]` detection exits with an actionable
  message; the block is never silently overwritten.
- Headless / Hermes device-flow install path documented and supported via the
  `/install/hermes` runbook; the CLI installer is explicitly out of scope for that flow.
- Runtime Node version check (`>= 20.12`).

### Security

- Written config files are created with mode `0o600` on POSIX; `chmod` is enforced
  after the atomic rename.
- `OMEGA_MCP_URL` must use `https:` for remote hosts; `http:` is only permitted for
  `localhost` / `127.0.0.1` / `::1`. The value is validated and canonicalized via
  `URL.toString()` and is never echoed in error messages.
- Codex TOML emission uses `JSON.stringify` quoting — safe against injection via
  `OMEGA_MCP_URL`. Duplicate-section detection uses an anchored regex; Windows
  `\r\n` endings are normalized before append.
- User-supplied CLI arguments are stripped of ASCII control characters before
  appearing in error output.
- `mcpServers` field in existing JSON configs is structurally validated before mutation.

### Build & release

- Zero runtime dependencies. Supply-chain hardened: no `postinstall`,
  `provenance: true`, `access: public` in `publishConfig`. Source maps excluded from
  the published package.
- Releases are managed with [Changesets](https://github.com/changesets/changesets) and
  published to npm via Trusted Publishing (GitHub OIDC, with provenance) — no
  long-lived `NPM_TOKEN`.
