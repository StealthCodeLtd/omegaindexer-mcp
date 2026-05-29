# GitHub setup

The Actions workflows that automate versioning, publishing, and releases.
See the [overview](./README.md) for how this fits the whole flow.

## `release.yml` — versions & publishes

Runs on push to `main`. Pending changesets → opens the "Version Packages" PR; none
pending → publishes any unpublished version via OIDC.

```yaml
name: Release
on:
  push:
    branches: [main]
    # Skip pure docs pushes (root *.md + docs/**). Scoped so .changeset/*.md
    # still triggers (paths-ignore has no negation to re-include it).
    paths-ignore:
      - "*.md"
      - "docs/**"
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

Key points:

- **`id-token: write`** is the non-obvious requirement — without it OIDC fails and npm
  rejects the publish. It pairs with the npm [Trusted Publisher](./npm.md).
- **`GITHUB_TOKEN`** (auto-provided) lets the action open the Version PR and create the
  GitHub Release + tag. No PAT needed.
- **`paths-ignore`** keeps docs-only pushes from running the workflow.

## `ci.yml` — PR checks

Build + typecheck on pull requests only (`release.yml` covers `main`):

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

## GitHub Releases & tags

Created automatically by `changesets/action` on publish — tag `v<version>` and a
Release whose body is the new `CHANGELOG.md` section. Nothing to do by hand.

## Troubleshooting

| Symptom                                  | Cause / Fix                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| OIDC / provenance error, `id-token` miss | Add `permissions: id-token: write` to the release job.                   |
| Provenance fails, `npm` too old          | `npm install -g npm@latest` before `npm ci` (needs npm ≥ 11.5.1).        |
| Workflow runs but publishes nothing      | Expected: no pending changesets and version already on npm — safe no-op. |
| `E404` on publish                        | npm-side issue — see [npm.md](./npm.md#troubleshooting).                  |

## Manual publish (break-glass)

Only if CI publishing is unavailable. The CI path above is the supported one.

```bash
npm login                 # 2FA OTP
npm run build
npm publish --provenance --access public
git tag v<version> && git push origin v<version>
```
