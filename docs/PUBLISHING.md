# Publishing — from zero to a public npm package

This is the end-to-end runbook for publishing `@stealth-code/omegaindexer-mcp` (and
any package set up the same way). It covers the **one-time setup** and the
**recurring release loop**.

The release pipeline has two moving parts:

- **[Changesets](https://github.com/changesets/changesets)** — decides the next version
  and writes `CHANGELOG.md` from human-written intent files.
- **npm Trusted Publishing (GitHub OIDC)** — publishes to npm from CI with provenance
  and **no long-lived `NPM_TOKEN`**.

---

## TL;DR (recurring releases)

```bash
npm run changeset      # describe the change, pick patch/minor/major
git add .changeset && git commit -m "chore: changeset" && git push   # in a PR
```

Merge the PR → the **Release** workflow opens a **"Version Packages"** PR → merge that
→ it publishes to npm and creates the `v<version>` tag + GitHub Release. Done.

---

## Part 1 — One-time setup (the "from 0" part)

You only do this once per package. It's already done for this repo — kept here as the
reference for the next package.

### 1.1 Prerequisites

- **Node** `>= 20.12` and npm `>= 11.5.1` (Trusted Publishing needs modern npm).
- An **npm account** that is a member of the publishing org/scope (here: the
  `@stealth-code` scope). For a brand-new scope: `npm org create` / claim the scope on
  npmjs.com first.
- A **GitHub repo** under the org (here: `StealthCodeLtd/omegaindexer-mcp`).

### 1.2 `package.json` essentials

```jsonc
{
  "name": "@stealth-code/omegaindexer-mcp", // scoped name == npm scope
  "version": "1.0.0",
  "publishConfig": {
    "access": "public",      // scoped packages are private by default — this makes it public
    "provenance": true        // attach build provenance on publish
  },
  "files": ["dist/", "README.md", "LICENSE"], // only ship build output + docs
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepare": "npm run build",                 // ensures dist/ exists before publish
    "changeset": "changeset",
    "version": "changeset version",             // bumps version + writes CHANGELOG
    "release": "npm run build && changeset publish"
  }
}
```

Supply-chain hygiene that matters: **no `postinstall`**, exclude source maps from the
published tarball, and keep runtime dependencies minimal. Verify the tarball contents
before the first publish:

```bash
npm pack --dry-run     # lists exactly what will be published
```

### 1.3 Initialize Changesets

```bash
npm install -D @changesets/cli
npx changeset init       # creates .changeset/config.json + .changeset/README.md
```

`.changeset/config.json` for a single-package repo:

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

> **Tag format note.** In a **single-package** repo, Changesets tags releases as
> `v<version>` (e.g. `v1.0.0`). The scoped `name@version` form (e.g.
> `@scope/pkg@1.2.3`) only appears in **monorepos** with multiple packages. There is no
> config flag to force the scoped form on a single package — it would require a custom
> tagging step. Pick `v<version>` unless you have a strong reason not to.

### 1.4 GitHub Actions workflows

**`.github/workflows/release.yml`** — runs on push to `main`, drives Changesets:

```yaml
name: Release
on:
  push:
    branches: [main]
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
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
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

**`.github/workflows/ci.yml`** — build/typecheck on PRs only (release.yml covers main):

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
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

`id-token: write` is the non-obvious requirement — without it OIDC fails and npm
rejects the publish.

### 1.5 Configure the npm Trusted Publisher (the step everyone forgets)

On **npmjs.com → your package → Settings → Trusted Publisher → GitHub Actions**, set:

| Field             | Value                                |
| ----------------- | ------------------------------------ |
| Organization/user | `StealthCodeLtd`                     |
| Repository        | `omegaindexer-mcp`                   |
| Workflow filename | `release.yml`                        |
| Environment       | _(blank, unless your job uses one)_  |

> ⚠️ **This config is pinned to the exact workflow filename.** If you rename or move the
> publishing workflow (e.g. `publish.yml` → `release.yml`), publishing breaks with a
> confusing **`E404 Not Found - PUT .../<pkg>`** — npm returns 404, *not* 403, when the
> OIDC token isn't trusted. Fix: update the Workflow filename here to match. (We hit
> exactly this during 1.0.0.)

For a scope that has **never** published before, the very first publish may need a
one-time manual `npm publish` (with `npm login` + 2FA) to create the package, after
which Trusted Publishing takes over. An already-existing package (any prior version)
publishes straight through OIDC once the Trusted Publisher above is set.

---

## Part 2 — The first public release (0 → 1.0.0)

1. Land all code on `main` with `package.json` `version` at `1.0.0` and the Part-1 setup
   committed.
2. Make sure the **Trusted Publisher** (1.5) is configured.
3. Push to `main`. With no pending changesets, the Release workflow runs
   `npm run release` → `changeset publish` sees `1.0.0` is not on npm → publishes it,
   tags `v1.0.0`, and creates the GitHub Release.
4. Verify:

   ```bash
   npm view @stealth-code/omegaindexer-mcp version dist-tags.latest
   ```

That's the whole "from 0 to public" path: **setup → Trusted Publisher → push to main.**

---

## Part 3 — Every release after that

1. In your feature branch, record the change:

   ```bash
   npm run changeset
   ```

   - **patch** — bug fixes, chores, docs that ship (e.g. `1.0.0 → 1.0.1`)
   - **minor** — backward-compatible features (`1.0.0 → 1.1.0`)
   - **major** — breaking changes (`1.0.0 → 2.0.0`)

   This writes a `.changeset/<random-name>.md` file. **Commit it with your PR.**

2. Merge the PR to `main`. The Release workflow opens/updates a **"Version Packages"**
   PR that bumps the version and rewrites `CHANGELOG.md` from your changeset(s).

3. **Merge the "Version Packages" PR.** That triggers the publish: npm release +
   `v<version>` tag + GitHub Release. No manual version edits, ever.

The CHANGELOG format produced looks like the Cloudflare example you referenced:

```
## 1.1.0
### Minor Changes
- 33e0198: add the deploy-published-workers script
### Patch Changes
- bdb5b89: remove redundant pnpx from the deploy script
```

---

## Troubleshooting

| Symptom                                                        | Cause / Fix                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `E404 Not Found - PUT .../<pkg>` during publish                | Trusted Publisher not set, or pinned to the wrong workflow filename. Fix the npm Settings → Trusted Publisher. |
| `npm error 402 Payment Required`                               | Scoped package defaulting to private. Set `publishConfig.access = "public"`.                                  |
| OIDC / provenance error, `id-token` missing                    | Add `permissions: id-token: write` to the release job.                                                       |
| Provenance fails with `npm` too old                            | Add `npm install -g npm@latest` before `npm ci` (Trusted Publishing needs npm ≥ 11.5.1).                     |
| Release workflow runs but publishes nothing                    | Expected when no changesets are pending and the current version is already on npm — it's a safe no-op.        |
| Want to publish locally instead of CI                          | `npm run release` (needs `npm login` + 2FA OTP). Bypasses OIDC for that one publish.                          |

---

## Manual publish (fallback / break-glass)

```bash
npm login                 # 2FA OTP
npm run build
npm publish --provenance --access public
git tag v<version> && git push origin v<version>
```

Use only if CI publishing is unavailable. The CI path (Parts 2–3) is the supported one.
