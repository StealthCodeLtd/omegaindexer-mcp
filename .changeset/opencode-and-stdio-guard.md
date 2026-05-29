---
"@stealth-code/omegaindexer-mcp": patch
---

Add an OpenCode remote-config section to the README, and fail loudly with stderr guidance when the installer is mistakenly launched as a stdio MCP server (instead of silently corrupting the JSON-RPC channel).
