# @stealth-code/omegaindexer-mcp

[![npm](https://img.shields.io/npm/v/@stealth-code/omegaindexer-mcp)](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

Connect the hosted [Omegaindexer](https://www.omegaindexer.com) MCP server to your AI client.

You need an [Omegaindexer account](https://www.omegaindexer.com) and a browser for the one-time sign-in (any device — even a phone).

**One thing to know:** the server is **hosted** (`https://mcp.omegaindexer.com/mcp`) — there's nothing to run locally. Every client just registers that URL as a **remote** MCP server. Sign-in is automatic browser OAuth on first use; you never paste a token. (Exception: chat-only headless hosts that can't do OAuth — see [Headless hosts](#headless-hosts).)

> **Shortcut for desktop clients:** `npx -y @stealth-code/omegaindexer-mcp install` auto-detects and configures Claude Code, Claude Desktop, Codex CLI, Cursor, and Windsurf in one go. The per-client prompts below do the same thing explicitly (and cover OpenCode + headless hosts, which the installer doesn't).

## Set up your client

Pick your client and paste the prompt to its AI assistant. Then restart the client — on the first Omegaindexer tool call your browser opens to sign in. Verify with: _"Run `omegaindexer_whoami`."_

### Claude Code

> Add the hosted Omegaindexer MCP server to Claude Code by running `claude mcp add --transport http omegaindexer https://mcp.omegaindexer.com/mcp`. It's a remote HTTP server — don't register it as a local/stdio command.

### Cursor

> Add the hosted Omegaindexer MCP server to Cursor: in `~/.cursor/mcp.json`, merge into `mcpServers` the entry `"omegaindexer": { "url": "https://mcp.omegaindexer.com/mcp" }`. It's a remote HTTP server — no `command`/stdio.

### Codex CLI

> Add the hosted Omegaindexer MCP server to Codex: append this to `~/.codex/config.toml` — `[mcp_servers.omegaindexer]` on one line, then `url = "https://mcp.omegaindexer.com/mcp"`. It's a remote HTTP server — no `command`.

### Windsurf

> Add the hosted Omegaindexer MCP server to Windsurf: in `~/.codeium/windsurf/mcp_config.json`, merge into `mcpServers` the entry `"omegaindexer": { "url": "https://mcp.omegaindexer.com/mcp" }`. It's a remote HTTP server — no `command`/stdio.

### Claude Desktop

> Add the Omegaindexer MCP server to Claude Desktop via Settings → Connectors → Add custom connector, with URL `https://mcp.omegaindexer.com/mcp`. (Editing `claude_desktop_config.json` does **not** register remote servers — use the Connectors UI.)

### OpenCode

> Add a **remote** MCP server named `omegaindexer` with url `https://mcp.omegaindexer.com/mcp` to my OpenCode config (`~/.config/opencode/opencode.json`, under `mcp`, with `"type": "remote"` and `"enabled": true`). Do **not** install the npm package and do **not** use `type: "local"`/npx — it's a hosted server, so a local/stdio entry will fail to connect.

## Headless hosts

Chat-only gateways (**Hermes**, Discord/Slack/Telegram bots) **can't do browser OAuth**. They connect to `https://mcp.omegaindexer.com/mcp-headless` and sign in via a device-flow that mints a long-lived token, stored as an `Authorization` header. Don't run the `npx … install` CLI on these — it only configures desktop clients.

### Hermes

> Install Omegaindexer by fetching `https://mcp.omegaindexer.com/install/headless` and following it verbatim. Do not run the `@stealth-code/omegaindexer-mcp` npm CLI, and do not use `hermes mcp login` / `--auth oauth` — this host signs in through the device-flow runbook at that URL.

### OpenClaw

OpenClaw can't do OAuth for remote MCP servers (`openclaw mcp` has no `auth`/`login` subcommand — only a static `Authorization` header). So it signs in with a token via the headless device-flow. In a terminal:

1. Register the **headless** endpoint (note `/mcp-headless`, not `/mcp`):
   ```bash
   openclaw mcp set omegaindexer '{"url":"https://mcp.omegaindexer.com/mcp-headless","transport":"streamable-http"}'
   ```
2. Reload OpenClaw so it connects and exposes the tools (restart your OpenClaw gateway/session).
3. Ask an OpenClaw agent to call the `omegaindexer_login` tool. It returns a URL + 8-char code — open the URL, enter the code, approve in your browser.
4. It returns a token. Store it by re-running `set` with the full entry plus the header:
   ```bash
   openclaw mcp set omegaindexer '{"url":"https://mcp.omegaindexer.com/mcp-headless","transport":"streamable-http","headers":{"Authorization":"Bearer <TOKEN>"}}'
   ```
5. Reload again, then verify by asking an agent to run `omegaindexer_whoami`.

## Uninstall

Paste to your AI assistant: _"Uninstall the Omegaindexer MCP server from this client."_ Or remove it manually:

| Client         | Removal                                                          |
| -------------- | ---------------------------------------------------------------- |
| Claude Code    | `claude mcp remove omegaindexer`                                 |
| Claude Desktop | remove the connector from `Settings → Connectors`                |
| Codex CLI      | remove `[mcp_servers.omegaindexer]` from `~/.codex/config.toml`  |
| Cursor         | remove `omegaindexer` from `~/.cursor/mcp.json`                  |
| Windsurf       | remove `omegaindexer` from `~/.codeium/windsurf/mcp_config.json` |
| OpenCode       | remove `omegaindexer` from `~/.config/opencode/opencode.json`   |
| Hermes         | remove the `omegaindexer` entry from `~/.hermes/config.yaml`     |

Revoke access any time at `omegaindexer.com → Settings → Connected MCP Clients`.

## Links

- npm: [@stealth-code/omegaindexer-mcp](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
- GitHub: [github.com/StealthCodeLtd/omegaindexer-mcp](https://github.com/StealthCodeLtd/omegaindexer-mcp)
