# npm site setup

Everything configured on **npmjs.com**. Done once per package.
See the [overview](./README.md) for how this fits the whole flow.

## Account & scope

- An npm account that is a member of the publishing scope (here `@stealth-code`).
- For a brand-new scope, claim it / create the org on npmjs.com first
  (`npm org create` or via the website).

## Public access

Scoped packages are **private by default**. Publishing publicly requires
`publishConfig.access = "public"` in `package.json` (see [code.md](./code.md)). Without
it the publish fails with `402 Payment Required`.

## Trusted Publisher (the step everyone forgets)

This is what lets GitHub Actions publish without a token. On
**npmjs.com → your package → Settings → Trusted Publisher → GitHub Actions**, set:

| Field             | Value                               |
| ----------------- | ----------------------------------- |
| Organization/user | `StealthCodeLtd`                    |
| Repository        | `omegaindexer-mcp`                  |
| Workflow filename | `release.yml`                       |
| Environment       | _(blank, unless the job uses one)_  |

> ⚠️ **Pinned to the exact workflow filename.** If you rename or move the publishing
> workflow (e.g. `publish.yml` → `release.yml`), publishing breaks with a misleading
> `E404 Not Found - PUT .../<pkg>` — npm returns 404, not 403, when the OIDC token isn't
> trusted. Fix by updating the Workflow filename here to match. (We hit exactly this
> during 1.0.0.)

## First public release

For a scope that has **never** published this package, the very first publish may need a
one-time manual `npm publish` (with `npm login` + 2FA) to create it, after which Trusted
Publishing takes over. An already-existing package (any prior version) publishes
straight through OIDC once the Trusted Publisher above is set.

The 0 → 1.0.0 path end to end:

1. Code + setup landed on `main`, `version` at `1.0.0`.
2. Trusted Publisher configured (above).
3. Push to `main` → the Release workflow publishes `1.0.0`, tags it, posts the release.
4. Verify:

   ```bash
   npm view @stealth-code/omegaindexer-mcp version dist-tags.latest
   ```

## Troubleshooting

| Symptom                                     | Cause / Fix                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `E404 Not Found - PUT .../<pkg>` on publish | Trusted Publisher not set, or wrong workflow filename. Fix it in Settings.   |
| `402 Payment Required`                      | Scoped package defaulting to private. Set `publishConfig.access = "public"`. |
| Verify a published version                  | `npm view @stealth-code/omegaindexer-mcp@<version>`                          |
