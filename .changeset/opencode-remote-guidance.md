---
"@stealth-code/omegaindexer-mcp": patch
---

Clarify the README's OpenCode section: tell agents to add a *remote* MCP server with the hosted URL, and warn against registering a `type: "local"` npx entry (which fails — this package is an installer, not a stdio server).
