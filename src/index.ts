#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { runInstall } from "./install.js"

const MIN_NODE_MAJOR = 20
const MIN_NODE_MINOR = 12

function checkNodeVersion(): void {
  const parts = process.versions.node.split(".").map(Number)
  const maj = parts[0] ?? 0
  const min = parts[1] ?? 0
  if (maj < MIN_NODE_MAJOR || (maj === MIN_NODE_MAJOR && min < MIN_NODE_MINOR)) {
    process.stderr.write(
      `omegaindexer: requires Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+, got ${process.versions.node}\n`,
    )
    process.exit(1)
  }
}

function readVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }
    return pkg.version ?? "0.0.0"
  } catch {
    return "0.0.0"
  }
}

function printHelp(): void {
  process.stdout.write(
    [
      "omegaindexer — installer for the hosted Omegaindexer MCP server",
      "",
      "Configures HTTP-native MCP hosts to connect to https://mcp.omegaindexer.com/mcp.",
      "",
      "Usage:",
      "  omegaindexer install                    auto-detect installed hosts, configure each",
      "  omegaindexer install --only <a,b,...>   configure only the listed hosts (force)",
      "  omegaindexer install --exclude <a,b>    auto-detect, skip the listed hosts",
      "  omegaindexer install --all              configure all supported hosts (force)",
      "  omegaindexer install --client <name>    (legacy) configure a single host",
      "    <name>: claude-code | claude-desktop | codex | cursor | windsurf",
      "    Writes config:   codex  cursor  windsurf",
      "    Prints steps:    claude-code  claude-desktop",
      "  omegaindexer --version, -v              print version",
      "  omegaindexer --help, -h                 show this help",
      "",
      "Environment:",
      "  OMEGA_MCP_URL   override server URL (default https://mcp.omegaindexer.com/mcp)",
      "",
    ].join("\n"),
  )
}

checkNodeVersion()

const VERSION = readVersion()
const DEFAULT_SERVER_URL = process.env.OMEGA_MCP_URL ?? "https://mcp.omegaindexer.com/mcp"

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)
  switch (cmd) {
    case undefined:
      printHelp()
      return
    case "install":
      await runInstall(rest, DEFAULT_SERVER_URL)
      return
    case "--version":
    case "-v":
      process.stdout.write(`omegaindexer ${VERSION}\n`)
      return
    case "--help":
    case "-h":
      printHelp()
      return
    default:
      process.stderr.write(`omegaindexer: unknown command "${cmd.replace(/[\x00-\x08\x0a-\x1f\x7f-\x9f]/g, "?")}"\n\n`)
      printHelp()
      process.exitCode = 1
      return
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`omegaindexer: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
