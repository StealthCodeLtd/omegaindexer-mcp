---
"@stealth-code/omegaindexer-mcp": patch
---

Finalize the OpenClaw README section (drop "beta"): OpenClaw has no MCP OAuth (`openclaw mcp` has no auth subcommand), so document the concrete headless device-flow — register `/mcp-headless`, mint a token via `omegaindexer_login`, store it as an `Authorization` header.
