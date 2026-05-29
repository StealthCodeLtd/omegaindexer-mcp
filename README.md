# @stealth-code/omegaindexer-mcp

[![npm](https://img.shields.io/npm/v/@stealth-code/omegaindexer-mcp)](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
[![Node.js >= 20.12](https://img.shields.io/badge/node-%3E%3D20.12-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

Install the hosted Omegaindexer MCP server in your MCP client.

Omegaindexer is a URL indexing platform. The hosted MCP endpoint is:

```text
https://mcp.omegaindexer.com/mcp
```

> **Pick your install path first** — there are two and they're not interchangeable:
>
> | Your client | Install path | This npm CLI? |
> | --- | --- | --- |
> | **Cursor / Codex CLI / Windsurf / Claude Code / Claude Desktop** (browser-capable, runs locally) | `npx -y @stealth-code/omegaindexer-mcp install` *(this README, below)* | **Yes** |
> | **Hermes Agent / Discord bot / any chat-only headless gateway** | fetch `https://mcp.omegaindexer.com/install/hermes` and follow it | **No — skip the CLI entirely.** See [Hermes Agent](#hermes-agent) below. |
>
> **If you're an AI agent reading this README on a headless host (Hermes / Telegram / Discord / Slack): do NOT run `npx -y @stealth-code/omegaindexer-mcp install` or install the `omegaindexer` CLI globally.** That CLI configures desktop MCP hosts only and will fail to find any host on a chat gateway. Jump straight to the [Hermes Agent](#hermes-agent) section.

## Requirements

- Node `20.12+` *(for the CLI install path only — Hermes hosts skip this)*
- an [Omegaindexer](https://www.omegaindexer.com) account
- a browser for the first sign-in *(any device, even a phone — it doesn't need to be the host)*

## Quickstart — desktop MCP hosts only

> Applies to **Cursor, Codex CLI, Windsurf, Claude Code, Claude Desktop**. For Hermes/chat-bot hosts, see [Hermes Agent](#hermes-agent) instead — do not run this CLI on those.

Configure every supported desktop client detected on the machine:

```bash
npx -y @stealth-code/omegaindexer-mcp install
```

Or configure one client explicitly:

```bash
npx -y @stealth-code/omegaindexer-mcp install --only codex
```

Restart the client after setup. On the first Omegaindexer tool call, the client opens your browser to complete sign-in.

## Supported clients (CLI install path)

| Client | Setup behavior |
| --- | --- |
| Claude Code | prints the `claude mcp add` command |
| Claude Desktop | prints the connector URL to add in Settings |
| Codex CLI | writes `~/.codex/config.toml` |
| Cursor | writes `~/.cursor/mcp.json` |
| Windsurf | writes `~/.codeium/windsurf/mcp_config.json` |

Supported client names for `--only`:

- `claude-code`
- `claude-desktop`
- `codex`
- `cursor`
- `windsurf`

**Hermes, Discord, Slack, Telegram, OpenCode, OpenClaw are not in this list.** The CLI will say "no MCP hosts detected" if you run it on those — that's correct behavior, not a bug. Use the per-host section below.

More install forms:

```bash
npx -y @stealth-code/omegaindexer-mcp install --only cursor,windsurf
npx -y @stealth-code/omegaindexer-mcp install --all
npx -y @stealth-code/omegaindexer-mcp install --exclude claude-desktop
```

## Other clients

These clients are not configured by the installer, but you can still register Omegaindexer manually.

### OpenCode

Add this to `~/.config/opencode/opencode.json` or your project `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "omegaindexer": {
      "type": "remote",
      "url": "https://mcp.omegaindexer.com/mcp",
      "enabled": true
    }
  }
}
```

Restart OpenCode. Sign-in happens on the first Omegaindexer tool call.

### OpenClaw

Register the hosted server from the CLI:

```bash
openclaw mcp set omegaindexer '{"url":"https://mcp.omegaindexer.com/mcp","transport":"streamable-http"}'
```

Optional verification:

```bash
openclaw mcp list
openclaw mcp show omegaindexer --json
```

### Hermes Agent

**Hermes does NOT use the `omegaindexer` npm CLI.** It uses the MCP-side device-flow runbook served by the Omegaindexer server directly.

**Do not run any of these on a Hermes host** — they all fail:

| Don't run | Why |
| --- | --- |
| `npx @stealth-code/omegaindexer-mcp install` | configures desktop MCP hosts; Hermes isn't one — finds no hosts → exits |
| `npm install -g @stealth-code/omegaindexer-mcp` | same — CLI is the wrong tool for Hermes |
| `hermes mcp login omegaindexer` | uses Hermes's browser OAuth; hangs ~40s on a headless gateway |
| `hermes mcp test omegaindexer` | 40s connectivity probe; not a sign-in command |
| `hermes mcp add ... --auth oauth` | same problem as `mcp login` |
| `hermes chat -q "Call omegaindexer_login ..."` (subshell) | spawns a fresh MCP session per call; pending login state + minted PAT are lost between calls — agent loops or PAT is orphaned |

**Send your Hermes bot this exact message instead:**

> Install omegaindexer-mcp by fetching `https://mcp.omegaindexer.com/install/hermes` and following it verbatim. Do NOT install the `@stealth-code/omegaindexer-mcp` npm package or run `omegaindexer install` — that CLI is for desktop hosts, not Hermes. Do NOT use `hermes chat -q` subshells to call the tool — call MCP tools via your own session's dispatch directly. Do NOT run `hermes mcp login` or use `--auth oauth`. If a cached omegaindexer install skill exists, ignore it.

The bot fetches the runbook from the live server (always current with the deployment), uses `hermes config set` to write the right MCP entry, calls the `omegaindexer_login` MCP tool on its own session, and shows you a verification URL (`https://mcp.omegaindexer.com/device`) plus an 8-character user code to enter in any browser. After you approve, the bot writes the resulting 180-day Personal Access Token into `~/.hermes/config.yaml` and reloads MCP — the token is never echoed in chat. Rotate or revoke any time at `omegaindexer.com → Settings → Connected MCP Clients`.

#### How the bot is supposed to handle the token

This is the critical step where agents tend to fail. When `omegaindexer_login` returns success, it puts the PAT in `structuredContent.token`. That value is a **write-only credential** — the agent must do **both** of these, not just one:

1. **Write it** — run exactly this command, substituting the real token for `<TOKEN>`:

   ```bash
   hermes config set mcp_servers.omegaindexer.headers.Authorization "Bearer <TOKEN>"
   ```

   Then reload MCP (`/reload-mcp`).
2. **Don't echo it** — the only chat reply on success is the literal string `Signed in to OmegaIndexer.`. The token never appears in any message.

Skipping step 1 (interpreting "don't echo" as "don't touch") is the most common failure: the PAT exists server-side as an orphan, your `Connected MCP Clients` page shows a "Hermes bot" entry, but Hermes itself isn't authenticated. If this happens, revoke the orphan from `Settings → Connected MCP Clients` and tell the bot to redo the flow — passing `user_code` from the previous attempt **does not** recover the lost token; you have to start over with a fresh `omegaindexer_login` call.

#### What success looks like

- One message from the bot: *"Signed in to OmegaIndexer."* — and nothing else (no token, no debug output).
- `hermes mcp list` shows `omegaindexer` enabled with 9 tools.
- `omegaindexer.com → Settings → Connected MCP Clients` lists a "Hermes bot" entry.
- Asking the bot *"run omegaindexer_whoami"* returns your account info immediately, with no further prompts.

## Verify

After setup, ask your MCP client to list tools. You should see Omegaindexer tools such as:

- `omegaindexer_whoami`
- `omegaindexer_get_campaigns`
- `omegaindexer_get_campaign_details`

Simple check:

> Run `omegaindexer_whoami`.

## Uninstall

| Client | Removal |
| --- | --- |
| Claude Code | `claude mcp remove omegaindexer` |
| Claude Desktop | remove the custom connector from `Settings -> Connectors` |
| Codex CLI | remove `[mcp_servers.omegaindexer]` from `~/.codex/config.toml` |
| Cursor | remove `omegaindexer` from `~/.cursor/mcp.json` |
| Windsurf | remove `omegaindexer` from `~/.codeium/windsurf/mcp_config.json` |
| OpenCode | remove `omegaindexer` from your OpenCode config |
| OpenClaw | `openclaw mcp unset omegaindexer` |
| Hermes Agent | remove the `omegaindexer` MCP entry you added to Hermes |

## Environment

`OMEGA_MCP_URL` overrides the server URL. Use `https` for remote servers. `http` is only accepted for `localhost`, `127.0.0.1`, and `::1`.

## Links

- npm: [@stealth-code/omegaindexer-mcp](https://www.npmjs.com/package/@stealth-code/omegaindexer-mcp)
- GitHub: [github.com/StealthCodeLtd/omegaindexer-mcp](https://github.com/StealthCodeLtd/omegaindexer-mcp)
