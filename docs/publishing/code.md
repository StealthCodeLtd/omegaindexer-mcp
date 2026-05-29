# Code / repository setup

Everything that lives in the repo: `package.json`, Changesets, and authoring a release.
See the [overview](./README.md) for how this fits the whole flow.

## `package.json` essentials

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

Supply-chain hygiene: **no `postinstall`**, exclude source maps from the published
tarball, keep runtime dependencies minimal. Check exactly what ships before the first
publish:

```bash
npm pack --dry-run
```

## Changesets

```bash
npm install -D @changesets/cli
npx changeset init       # creates .changeset/config.json + .changeset/README.md
```

`.changeset/config.json` for this single-package repo:

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

## Authoring a release (recurring)

```bash
npm run changeset
```

Pick the bump and write a one-line summary (it becomes the public changelog entry):

- **patch** — fixes, chores (`1.0.0 → 1.0.1`)
- **minor** — backward-compatible features (`1.0.0 → 1.1.0`)
- **major** — breaking changes (`1.0.0 → 2.0.0`)

This writes `.changeset/<name>.md`. **Commit it with your PR.** The rest is automated by
the [GitHub workflows](./github.md). Resulting `CHANGELOG.md` groups entries like:

```
## 1.1.0
### Minor Changes
- 33e0198: add the deploy-published-workers script
### Patch Changes
- bdb5b89: remove redundant pnpx from the deploy script
```

## Tag format note

In a **single-package** repo, Changesets tags as `v<version>` (e.g. `v1.0.0`). The
scoped `name@version` form (e.g. `@scope/pkg@1.2.3`) only appears in **monorepos** with
multiple packages — there's no flag to force it on a single package without a custom
tagging step. Stick with `v<version>`.
