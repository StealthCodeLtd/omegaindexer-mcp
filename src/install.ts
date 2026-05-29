import { promises as fs } from "node:fs"
import { delimiter as PATH_DELIM } from "node:path"
import { homedir, platform } from "node:os"
import { dirname, join, relative } from "node:path"

// HTTP-native MCP hosts only. For each supported host we write a direct
// `url`-style entry pointing at the hosted Omega MCP server.

const SERVER_KEY = "omegaindexer"

// Replaces ASCII control characters with '?' before echoing user input
// in error messages to prevent ANSI escape injection.
const CTRL_RE = /[\x00-\x08\x0a-\x1f\x7f-\x9f]/g

// Validate and canonicalize the server URL. Rejects non-http(s) schemes
// or anything that wouldn't survive `new URL`. The canonical form is
// guaranteed free of `"`, `\n`, `\r` — safe for JSON and TOML emission.
function assertSafeServerUrl(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error("Invalid OMEGA_MCP_URL: not a valid http(s) URL")
  }
  if (parsed.protocol === "http:") {
    const h = parsed.hostname
    if (h !== "localhost" && h !== "127.0.0.1" && h !== "::1") {
      throw new Error("OMEGA_MCP_URL with http: is only allowed for localhost (use https: for remote hosts)")
    }
  } else if (parsed.protocol !== "https:") {
    throw new Error(`OMEGA_MCP_URL must use https:; got ${parsed.protocol}`)
  }
  return parsed.toString()
}

type ClientName =
  | "claude-code"
  | "claude-desktop"
  | "codex"
  | "cursor"
  | "windsurf"

type InstallKind =
  | "json-mcpServers"  // JSON config with `mcpServers.<key>.url` (cursor, windsurf)
  | "toml-codex"       // TOML config with `[mcp_servers.<key>] url = "..."` (codex)

interface ClientSpec {
  kind: InstallKind
  configPath: () => string
}

const SPECS: Partial<Record<ClientName, ClientSpec>> = {
  codex: { kind: "toml-codex", configPath: codexConfigPath },
  cursor: { kind: "json-mcpServers", configPath: cursorConfigPath },
  windsurf: { kind: "json-mcpServers", configPath: windsurfConfigPath },
}

const CLIENT_NAMES: ClientName[] = [
  "claude-code",
  "claude-desktop",
  "codex",
  "cursor",
  "windsurf",
]

interface ParsedArgs {
  only: string[]
  exclude: string[]
  client: string | null
  all: boolean
}

function splitList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { only: [], exclude: [], client: null, all: false }
  const requireValue = (flag: string, raw: string | undefined): string => {
    if (raw === undefined || raw.startsWith("--")) {
      throw new Error(`${flag} requires a value`)
    }
    return raw
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--client") {
      out.client = requireValue("--client", argv[++i])
    } else if (a === "--only") {
      const items = splitList(requireValue("--only", argv[++i]))
      if (items.length === 0) throw new Error("--only requires a non-empty client list")
      out.only.push(...items)
    } else if (a === "--exclude") {
      const items = splitList(requireValue("--exclude", argv[++i]))
      if (items.length === 0) throw new Error("--exclude requires a non-empty client list")
      out.exclude.push(...items)
    } else if (a === "--all") {
      out.all = true
    } else {
      throw new Error(`Unknown install flag: ${a.replace(CTRL_RE, "?")}`)
    }
  }
  const modes: string[] = []
  if (out.client !== null) modes.push("--client")
  if (out.only.length > 0) modes.push("--only")
  if (out.all) modes.push("--all")
  if (modes.length > 1) {
    throw new Error(`Mutually exclusive flags: ${modes.join(", ")}. Pick one.`)
  }
  if (out.exclude.length > 0 && modes.length > 0) {
    throw new Error(`--exclude only applies to auto-detect mode. Remove ${modes[0]} or --exclude.`)
  }
  return out
}

function validateClient(name: string): ClientName {
  if (!(CLIENT_NAMES as string[]).includes(name)) {
    throw new Error(`Unknown client "${name.replace(CTRL_RE, "?")}". Supported: ${CLIENT_NAMES.join(", ")}`)
  }
  return name as ClientName
}

// Display path safely — strip $HOME so CI logs / screenshots / test
// snapshots don't leak the OS username inside the absolute path.
function displayPath(p: string): string {
  const home = homedir()
  const rel = relative(home, p)
  if (!rel.startsWith("..") && !rel.startsWith("/") && !/^[A-Za-z]:/.test(rel)) {
    return `~${rel ? "/" + rel.replaceAll("\\", "/") : ""}`
  }
  return p
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === "ENOENT" || code === "ENOTDIR") return false
    // ACL/perm errors (EACCES/EPERM) — host may exist but is unreadable.
    // Treat as absent for detection, but surface the cause so users can debug.
    process.stderr.write(`omegaindexer: cannot stat ${displayPath(p)}: ${code ?? "unknown error"} (treating as absent)\n`)
    return false
  }
}

function claudeDesktopAppDir(): string {
  if (platform() === "darwin") return join(homedir(), "Library", "Application Support", "Claude")
  if (platform() === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    return join(appData, "Claude")
  }
  return join(homedir(), ".config", "Claude")
}

// Probe PATH for an executable. ~/.claude.json persists after Claude
// Code is uninstalled and is also created by one-shot `npx claude`
// runs, so file presence alone is too noisy for auto-detect. Require
// the `claude` binary to actually be on PATH.
async function commandExists(name: string): Promise<boolean> {
  const PATH = process.env.PATH
  if (!PATH) return false
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
      : [""]
  for (const dir of PATH.split(PATH_DELIM)) {
    if (!dir) continue
    for (const ext of exts) {
      const candidate = join(dir, name + ext.toLowerCase())
      try {
        const stat = await fs.stat(candidate)
        if (stat.isFile()) return true
      } catch {
        // ignore
      }
    }
  }
  return false
}

async function isHostDetected(client: ClientName): Promise<boolean> {
  switch (client) {
    case "claude-code":
      // Both the config file AND the binary must be present — neither
      // alone is a reliable signal of an active Claude Code install.
      if (!(await pathExists(join(homedir(), ".claude.json")))) return false
      return commandExists("claude")
    case "claude-desktop":
      return pathExists(claudeDesktopAppDir())
    case "codex":
      return pathExists(join(homedir(), ".codex"))
    case "cursor":
      return pathExists(join(homedir(), ".cursor"))
    case "windsurf":
      return pathExists(join(homedir(), ".codeium", "windsurf"))
  }
}

async function resolveHosts(args: ParsedArgs): Promise<{ hosts: ClientName[]; detected: boolean }> {
  if (args.client !== null) {
    return { hosts: [validateClient(args.client)], detected: false }
  }
  if (args.only.length > 0) {
    return { hosts: args.only.map(validateClient), detected: false }
  }
  if (args.all) {
    return { hosts: [...CLIENT_NAMES], detected: false }
  }
  const excluded = new Set(args.exclude.map(validateClient))
  const hosts: ClientName[] = []
  for (const c of CLIENT_NAMES) {
    if (excluded.has(c)) continue
    if (await isHostDetected(c)) hosts.push(c)
  }
  return { hosts, detected: true }
}

function windsurfConfigPath(): string {
  return join(homedir(), ".codeium", "windsurf", "mcp_config.json")
}

function cursorConfigPath(): string {
  return join(homedir(), ".cursor", "mcp.json")
}

function codexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml")
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
    throw e
  }
}

async function atomicWriteFile(path: string, contents: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.omegaindexer.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(tmp, contents, { encoding: "utf8", mode: 0o600 })
    await fs.rename(tmp, path)
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw e
  }
  // mode: 0o600 is ignored on Windows (ACL-based); enforce on POSIX explicitly
  if (process.platform !== "win32") await fs.chmod(path, 0o600).catch(() => {})
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await atomicWriteFile(path, JSON.stringify(data, null, 2) + "\n")
}

async function writeJsonMcpServers(path: string, serverUrl: string): Promise<void> {
  const raw = (await readJson<unknown>(path)) ?? {}
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path}: expected a JSON object at root`)
  }
  const existing = raw as Record<string, unknown>
  const rawServers = existing.mcpServers
  if (rawServers !== undefined && (typeof rawServers !== "object" || rawServers === null || Array.isArray(rawServers))) {
    throw new Error(`${path}: mcpServers must be an object`)
  }
  const servers = (rawServers ?? {}) as Record<string, unknown>
  const prev = servers[SERVER_KEY]
  if (prev !== undefined && typeof prev === "object" && prev !== null && !Array.isArray(prev)) {
    const prevObj = prev as Record<string, unknown>
    // If the prior entry was a stdio server (command/args), DO NOT merge.
    // Hosts that see both `command` and `url` typically pick `command`
    // and ignore the new url, leaving the install silently broken.
    // Replace the whole entry with an HTTP one and warn loudly.
    const isStdioShape = prevObj.command !== undefined || prevObj.args !== undefined
    if (isStdioShape) {
      process.stderr.write(
        `omegaindexer: replacing stdio "${SERVER_KEY}" entry in ${displayPath(path)} ` +
          `with the hosted HTTP server. Backed-up keys: ${Object.keys(prevObj).join(", ") || "(none)"}\n`,
      )
      servers[SERVER_KEY] = { url: serverUrl }
    } else {
      // Preserve user-set fields (headers, disabled, env, …) and only
      // refresh `url`. Silent destruction of custom config breaks setups.
      if (prevObj.url !== serverUrl) {
        process.stderr.write(`omegaindexer: updating "${SERVER_KEY}".url in ${displayPath(path)} (preserving other fields)\n`)
      }
      servers[SERVER_KEY] = { ...prevObj, url: serverUrl }
    }
  } else {
    if (prev !== undefined) {
      process.stderr.write(`omegaindexer: replacing non-object "${SERVER_KEY}" entry in ${displayPath(path)}\n`)
    }
    servers[SERVER_KEY] = { url: serverUrl }
  }
  existing.mcpServers = servers
  await writeJson(path, existing)
}

// Detect the three TOML forms for `mcp_servers.omegaindexer`:
//   1. standard table:  [mcp_servers.omegaindexer]
//   2. inline table:    mcp_servers.omegaindexer = { url = "..." }
//   3. dotted key:      mcp_servers.omegaindexer.url = "..."
// If any form is present we refuse to append a duplicate definition —
// codex's TOML parser rejects redefinitions and would error on the
// entire config, not just our block.
const CODEX_SERVER_PATTERNS: RegExp[] = [
  /^\s*\[mcp_servers\.omegaindexer\s*\]/m,
  /^\s*mcp_servers\s*\.\s*omegaindexer\s*=/m,
  /^\s*mcp_servers\s*\.\s*omegaindexer\s*\./m,
]
function codexHasServerEntry(text: string): boolean {
  return CODEX_SERVER_PATTERNS.some((re) => re.test(text))
}

// TOML basic strings share JSON's escape rules for `"`, `\`, and control
// chars. JSON.stringify produces a safely-quoted TOML basic string.
function tomlQuote(s: string): string {
  return JSON.stringify(s)
}

async function writeCodexTomlBlock(
  path: string,
  serverUrl: string,
): Promise<{ alreadyPresent: boolean }> {
  let existing = ""
  try {
    existing = await fs.readFile(path, "utf8")
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
  }
  // Preserve the file's existing line endings. Normalizing existing CRLF to
  // LF would rewrite every unrelated line in the user's config on Windows.
  // The detection regexes work on either ending: \r is whitespace and /^/m
  // matches positions after \n (which includes after \r\n).
  if (codexHasServerEntry(existing)) return { alreadyPresent: true }
  // Majority-vote line ending. "Any CRLF wins" misclassifies a mostly-LF
  // file that picked up one stray CRLF from a paste, resulting in mixed
  // endings after we append.
  const crlfCount = (existing.match(/\r\n/g) ?? []).length
  const loneLfCount = (existing.match(/(?<!\r)\n/g) ?? []).length
  const eol = crlfCount > loneLfCount ? "\r\n" : "\n"
  const block = [`[mcp_servers.${SERVER_KEY}]`, `url = ${tomlQuote(serverUrl)}`].join(eol)
  const prefix =
    existing.length === 0
      ? ""
      : existing.endsWith(eol + eol)
        ? ""
        : existing.endsWith(eol)
          ? eol
          : eol + eol
  await atomicWriteFile(path, existing + prefix + block + eol)
  return { alreadyPresent: false }
}

function printClaudeCodeInstructions(serverUrl: string): void {
  // Single-quote escaping ('\''...) is bash/zsh only; use double-quotes on Windows.
  // assertSafeServerUrl guarantees the URL is new URL()-canonical, so it never contains '"'.
  const quoted =
    process.platform === "win32"
      ? `"${serverUrl}"`
      : `'${serverUrl.replace(/'/g, "'\\''")}'`
  process.stdout.write(
    "Claude Code speaks Streamable HTTP natively. Run:\n" +
      `  claude mcp add --transport http ${SERVER_KEY} ${quoted}\n`,
  )
}

function printClaudeDesktopInstructions(serverUrl: string): void {
  process.stdout.write(
    "Claude Desktop adds remote servers via Settings → Connectors → Add custom connector.\n" +
      `  URL: ${serverUrl}\n` +
      "Editing claude_desktop_config.json directly does NOT register remote (HTTP) servers.\n",
  )
}

function assertNever(_x: never, msg: string): never {
  throw new Error(msg)
}

async function installToHost(client: ClientName, serverUrl: string): Promise<void> {
  if (client === "claude-code") {
    printClaudeCodeInstructions(serverUrl)
    return
  }
  if (client === "claude-desktop") {
    printClaudeDesktopInstructions(serverUrl)
    return
  }
  const spec = SPECS[client]
  if (spec === undefined) throw new Error(`internal: no spec for client ${client}`)
  const path = spec.configPath()
  switch (spec.kind) {
    case "json-mcpServers":
      await writeJsonMcpServers(path, serverUrl)
      process.stdout.write(`omegaindexer: wrote ${client} config at ${displayPath(path)}\n`)
      return
    case "toml-codex": {
      const { alreadyPresent } = await writeCodexTomlBlock(path, serverUrl)
      if (alreadyPresent) {
        process.stderr.write(
          `omegaindexer: ${displayPath(path)} already defines mcp_servers.${SERVER_KEY} ` +
            "(any of: [mcp_servers.omegaindexer], inline-table, or dotted-key form). " +
            "Edit it manually or remove the block and re-run.\n",
        )
        return
      }
      process.stdout.write(`omegaindexer: wrote ${client} config at ${displayPath(path)}\n`)
      return
    }
    default:
      return assertNever(spec.kind, `internal: unhandled kind=${String(spec.kind)}`)
  }
}

export async function runInstall(argv: string[], rawServerUrl: string): Promise<void> {
  const args = parseArgs(argv)
  const serverUrl = assertSafeServerUrl(rawServerUrl)
  const { hosts, detected } = await resolveHosts(args)

  if (hosts.length === 0) {
    if (detected) {
      process.stderr.write(
        "omegaindexer: no MCP hosts detected on this machine. Launch one of " +
          `${CLIENT_NAMES.join(", ")} once, or pass --only <name> / --all to force.\n`,
      )
      process.exitCode = 1
      return
    }
    process.stderr.write("omegaindexer: no hosts selected. Use --only <name>, --all, or omit flags to auto-detect.\n")
    process.exitCode = 1
    return
  }

  if (detected) {
    process.stdout.write(`omegaindexer: detected ${hosts.length} host(s): ${hosts.join(", ")}\n`)
  }

  let failures = 0
  for (const host of hosts) {
    try {
      await installToHost(host, serverUrl)
    } catch (e) {
      failures++
      process.stderr.write(`omegaindexer: ${host} failed: ${e instanceof Error ? e.message : String(e)}\n`)
    }
  }

  // Only nudge a restart if at least one host actually got configured.
  if (failures < hosts.length) {
    process.stdout.write("Restart your MCP host. On first tool call, your browser will open for sign-in.\n")
  }
  if (failures > 0) process.exitCode = 1
}
