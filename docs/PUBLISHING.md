# Publishing — technical runbook

End-to-end reference for publishing `@stealth-code/omegaindexer-mcp` (and any package set
up the same way). Two engines drive it:

- **[Changesets](https://github.com/changesets/changesets)** — decides the next version
  and writes `CHANGELOG.md` from human-written intent files.
- **npm Trusted Publishing (GitHub OIDC)** — publishes from CI with provenance and **no
  long-lived `NPM_TOKEN`**.

The pipeline spans three surfaces — **code** (the repo), **GitHub** (Actions), and the
**npm site** (registry settings). All three must agree for OIDC publishing to work.

---

## The overall workflow

```
 Developer                GitHub (Actions)              npm registry
 ─────────                ────────────────              ────────────
 1. npm run changeset
    (describe change)
 2. open PR  ───────────▶ CI: build + typecheck
 3. merge PR ───────────▶ release.yml runs
                          │
              pending? ───┤
                 yes      └─▶ opens "Version Packages" PR
                              (bumps version + CHANGELOG)
 4. merge that PR ───────▶ release.yml runs again
                 no  ─────────▶ npm run release ──OIDC──▶ publish + provenance
                              ├─ git tag v<version>
                              └─ GitHub Release (from CHANGELOG)
```

You never edit version numbers or run publish by hand.

## TL;DR (recurring releases)

```bash
npm run changeset      # describe the change, pick patch/minor/major
git add .changeset && git commit -m "chore: changeset"   # in a PR
```

Merge the PR → the **Release** workflow opens a **"Version Packages"** PR → merge that →
it publishes to npm and creates the `v<version>` tag + GitHub Release.

---

## Surface 1 — Code (the repo)

### `package.json` essentials

```jsonc
{
  "name": "@stealth-code/omegaindexer-mcp", // scoped name == npm scope
  "version": "1.0.0",
  "publishConfig": {
    "access": "public",   // scoped packages are private by default — this makes it public
    "provenance": true     // attach build provenance on publish
  },
  "files": ["dist/", "README.md", "LICENSE"], // only ship build output + docs
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepare": "npm run build",            // ensures dist/ exists before publish
    "changeset": "changeset",
    "version": "changeset version",        // bumps version + writes CHANGELOG
    "release": "npm run build && changeset publish"
  }
}
```

Supply-chain hygiene: **no `postinstall`**, exclude source maps, keep runtime deps
minimal. Check exactly what ships: `npm pack --dry-run`.

### Changesets

```bash
npm install -D @changesets/cli
npx changeset init       # creates .changeset/config.json + .changeset/README.md
```

`.changeset/config.json` (single-package repo):

```jsonc
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "fixed": [],
  "linked": [],
  "ignore": []
}
```

Authoring a release: `npm run changeset`, then pick the bump and write a one-line
summary (it becomes the public changelog entry) — **patch** (fix/chore), **minor**
(feature), **major** (breaking). Commit the generated `.changeset/<name>.md` with your PR.

**Tag format note.** Single-package repos tag as `v<version>` (e.g. `v1.0.0`). The scoped
`name@version` form only appears in monorepos with multiple packages — there's no flag to
force it on a single package without a custom tagging step. Stick with `v<version>`.

---

## Surface 2 — GitHub (Actions)

### `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    branches: [main]
    # Skip pure docs pushes (root *.md + docs/**). Scoped so .changeset/*.md
    # still triggers (paths-ignore has no negation to re-include it).
    paths-ignore: ["*.md", "docs/**"]
concurrency: ${{ github.workflow }}-${{ github.ref }}
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # create the Version Packages PR commit + git tags
      pull-requests: write  # open/update the Version Packages PR
      id-token: write       # npm Trusted Publishing (OIDC) — REQUIRED
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v5
        with: { node-version: "22", registry-url: "https://registry.npmjs.org" }
      - run: npm install -g npm@latest   # OIDC needs npm >= 11.5.1; Node 22 ships npm 10
      - run: npm ci
      - run: npm run typecheck
      - name: Version or publish
        uses: changesets/action@v1
        with:
          version: npm run version   # pending changesets -> opens Version PR
          publish: npm run release   # none pending -> publishes unpublished versions
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- **`id-token: write`** is the non-obvious requirement — without it OIDC fails and the
  publish is rejected. Pairs with the npm Trusted Publisher (Surface 3).
- **`GITHUB_TOKEN`** (auto) opens the Version PR and creates the tag + GitHub Release.

### `.github/workflows/ci.yml`

Build + typecheck on PRs only (`release.yml` covers `main`):

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: "22" }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

GitHub Releases + tags are created automatically by `changesets/action` on publish.

---

## Surface 3 — npm site

- An npm account in the publishing scope (`@stealth-code`). New scope: claim/create it on
  npmjs.com first.
- Public access comes from `publishConfig.access: "public"` (above); otherwise publish
  fails `402 Payment Required`.

**Trusted Publisher** (lets Actions publish without a token) —
**npmjs.com → package → Settings → Trusted Publisher → GitHub Actions:**

| Field             | Value                               |
| ----------------- | ----------------------------------- |
| Organization/user | `StealthCodeLtd`                    |
| Repository        | `omegaindexer-mcp`                  |
| Workflow filename | `release.yml`                       |
| Environment       | _(blank, unless the job uses one)_  |

> ⚠️ **Pinned to the exact workflow filename.** Rename/move the publishing workflow and
> publishing breaks with a misleading **`E404 Not Found - PUT .../<pkg>`** (npm returns
> 404, not 403, when the OIDC token isn't trusted). Fix: update the filename here. (We hit
> this during 1.0.0.)

For a scope that has **never** published this package, the first publish may need a
one-time manual `npm publish` (with `npm login` + 2FA) to create it; Trusted Publishing
takes over after. An existing package publishes straight through OIDC.

---

## First public release (0 → 1.0.0)

1. Land code + setup on `main`, `version` at `1.0.0`.
2. Configure the Trusted Publisher (Surface 3).
3. Push to `main` → with no pending changesets, the workflow runs `changeset publish`,
   sees `1.0.0` isn't on npm, publishes it, tags `v1.0.0`, posts the Release.
4. Verify: `npm view @stealth-code/omegaindexer-mcp version dist-tags.latest`.

## CHANGELOG format

```
## 1.1.0
### Minor Changes
- 33e0198: add the deploy-published-workers script
### Patch Changes
- bdb5b89: remove redundant pnpx from the deploy script
```

## Troubleshooting

| Symptom                                  | Cause / Fix                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `E404 Not Found - PUT .../<pkg>`         | Trusted Publisher not set, or wrong workflow filename. Fix in npm Settings.  |
| `402 Payment Required`                   | Scoped package private. Set `publishConfig.access = "public"`.               |
| OIDC / provenance error, `id-token` miss | Add `permissions: id-token: write` to the release job.                       |
| Provenance fails, `npm` too old          | `npm install -g npm@latest` before `npm ci` (needs npm ≥ 11.5.1).            |
| Runs but publishes nothing               | No pending changesets and version already live — safe no-op.                 |

## Manual publish (break-glass)

Only if CI publishing is unavailable; the CI path above is supported.

```bash
npm login                 # 2FA OTP
npm run build
npm publish --provenance --access public
git tag v<version> && git push origin v<version>
```
