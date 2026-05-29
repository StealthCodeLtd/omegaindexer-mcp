# @stealth-code/omegaindexer-mcp

[![npm](https://img.shields.io/npm/v/@stealth-code/omegaindexer-mcp)](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

Install the hosted [Omegaindexer](https://www.omegaindexer.com) MCP server in your AI client (Claude Code, Cursor, Codex CLI, Windsurf, Claude Desktop).

You need an [Omegaindexer account](https://www.omegaindexer.com) and a browser for the one-time sign-in (any device, even a phone).

## Install

Paste this to your AI assistant:

> Install the Omegaindexer MCP server by running `npx -y @stealth-code/omegaindexer-mcp install`, then restart yourself. On my first Omegaindexer tool call, open my browser so I can sign in to omegaindexer.com.

Or run it yourself, then restart your client:

```bash
npx -y @stealth-code/omegaindexer-mcp install
```

The first Omegaindexer tool call opens your browser to sign in. Verify with: *"Run `omegaindexer_whoami`."*

> **Headless host (Hermes, Discord, Slack, Telegram)?** Don't run the CLI — it configures desktop clients only. Fetch `https://mcp.omegaindexer.com/install/hermes` and follow it instead.

## Uninstall

Paste this to your AI assistant:

> Uninstall the Omegaindexer MCP server from this client.

Or remove it manually:

| Client | Removal |
| --- | --- |
| Claude Code | `claude mcp remove omegaindexer` |
| Claude Desktop | remove the connector from `Settings → Connectors` |
| Codex CLI | remove `[mcp_servers.omegaindexer]` from `~/.codex/config.toml` |
| Cursor | remove `omegaindexer` from `~/.cursor/mcp.json` |
| Windsurf | remove `omegaindexer` from `~/.codeium/windsurf/mcp_config.json` |

Revoke access any time at `omegaindexer.com → Settings → Connected MCP Clients`.

## Links

- npm: [@stealth-code/omegaindexer-mcp](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
- GitHub: [github.com/StealthCodeLtd/omegaindexer-mcp](https://github.com/StealthCodeLtd/omegaindexer-mcp)
