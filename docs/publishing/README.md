# Publishing — overview & workflow

How a new version of `@stealth-code/omegaindexer-mcp` gets to the public. The pipeline
spans three surfaces; each has its own setup doc:

- **[npm site](./npm.md)** — the registry account, scope, and Trusted Publisher.
- **[Code](./code.md)** — `package.json`, Changesets, and what gets published.
- **[GitHub](./github.md)** — the Actions workflows that automate everything.

Two engines drive it:

- **[Changesets](https://github.com/changesets/changesets)** decides the next version
  and writes `CHANGELOG.md` from human-written intent files.
- **npm Trusted Publishing (GitHub OIDC)** publishes from CI with provenance and **no
  long-lived `NPM_TOKEN`**.

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

Two surfaces must be configured **once** for the OIDC handshake to work: the GitHub
workflow requests an identity token (`id-token: write`), and the npm **Trusted
Publisher** must trust that exact repo + workflow filename. If either is missing,
publish fails with a misleading `E404`.

---

## Recurring release loop (TL;DR)

```bash
npm run changeset   # describe the change, pick patch/minor/major — commit it in your PR
```

Merge your PR → a **"Version Packages"** PR appears → merge it → published to npm,
tagged `v<version>`, GitHub Release posted. You never edit version numbers by hand.

## First-time setup order

Do the three setup docs in this order: **[code](./code.md)** →
**[GitHub](./github.md)** → **[npm site](./npm.md)** → then push to `main`. See
[npm.md](./npm.md#first-public-release) for the 0 → 1.0.0 first publish.

## Troubleshooting & manual publish

Each surface doc has its own troubleshooting section. The most common failure (`E404`
on publish) is the npm Trusted Publisher — see [npm.md](./npm.md#troubleshooting). The
break-glass manual publish is in [github.md](./github.md#manual-publish-break-glass).
