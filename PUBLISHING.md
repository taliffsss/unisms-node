# Publishing `@taliffsss/unisms`

This document is for maintainers. It covers how releases are cut and
published to npm, and how to reverse a bad release.

## One-time setup

1. **npm account/org.** `@taliffsss/unisms` is a scoped package. You need
   an npm user or org literally named `taliffsss` that you have publish
   rights on (create it at <https://www.npmjs.com/signup> if it doesn't
   exist yet, or request access from whoever owns it).
2. **npm access token.** Generate an **Automation** token (bypasses 2FA
   for CI, scoped to publish only):
   `npmjs.com` → avatar → *Access Tokens* → *Generate New Token* →
   *Automation*.
3. **GitHub repository secret.** In `github.com/taliffsss/unisms-node` →
   *Settings* → *Secrets and variables* → *Actions*, add a repository
   secret named `NPM_TOKEN` with that token's value.
4. **Provenance (optional but recommended).** The release workflow
   publishes with `--provenance`, which cryptographically attests the
   package was built by this exact GitHub Actions workflow run. This
   requires the repo to be public (or npm's paid provenance tier for
   private repos) and needs no extra setup beyond the `id-token: write`
   permission already set in `.github/workflows/release.yml`.

## How a release works

Publishing is fully automated by [`.github/workflows/release.yml`](.github/workflows/release.yml),
triggered by **either**:

- pushing a tag matching `v*.*.*` (e.g. `v0.2.0`), or
- publishing a GitHub Release (which you can create from that tag, or
  which will create the tag for you if it doesn't exist yet).

The workflow:

1. Checks out the tagged commit.
2. Verifies the tag's version matches `package.json`'s `"version"` field
   — this fails loudly instead of publishing the wrong thing.
3. Runs `npm ci`, lint, typecheck, and the full test suite as a gate.
4. Builds with `tsup` (ESM + CJS + `.d.ts`).
5. Runs `npm publish --provenance --access public`.

If the version was already published, `npm publish` fails with
`403 You cannot publish over the previously published version` — a safe,
expected outcome, not a bug to work around.

## Cutting a release (step by step)

1. On `main`, decide the next version per [SemVer](https://semver.org/):
   - **patch** (`0.1.0` → `0.1.1`): bug fixes, no API changes.
   - **minor** (`0.1.0` → `0.2.0`): backwards-compatible additions.
   - **major** (`0.1.0` → `1.0.0`): breaking changes.
2. Update `package.json`'s `"version"` field to the new version.
3. Move the `[Unreleased]` section of `CHANGELOG.md` into a new dated
   entry for that version (Keep a Changelog format), and add a fresh
   empty `[Unreleased]` section above it.
4. Commit:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release v0.2.0"
   ```
5. Tag and push:
   ```bash
   git tag v0.2.0
   git push origin main --tags
   ```
6. That tag push triggers the `Release` workflow, which publishes to
   npm automatically. Watch it under the repo's *Actions* tab.
7. (Optional but recommended) Create a GitHub Release from the tag with
   release notes copied from the CHANGELOG entry — this gives users a
   readable release feed and triggers the same workflow again
   harmlessly (npm publish is a no-op the second time).

## Verifying a published release

```bash
npm view @taliffsss/unisms versions --json   # confirm the new version is listed
npm install @taliffsss/unisms@0.2.0          # smoke-test the install in a scratch dir
```

## Deprecating or unpublishing a version

- **Deprecate** (preferred — warns installers without breaking existing
  lockfiles):
  ```bash
  npm deprecate @taliffsss/unisms@0.2.0 "Contains a bug, use 0.2.1 instead"
  ```
- **Unpublish** (npm only allows this within 72 hours of publishing, and
  discourages it — it breaks anyone who already depends on that exact
  version):
  ```bash
  npm unpublish @taliffsss/unisms@0.2.0
  ```
  After 72 hours, unpublishing requires contacting npm support. Prefer
  shipping a patch release and deprecating the bad one instead.

## How users install and upgrade

```bash
npm install @taliffsss/unisms          # latest
npm install @taliffsss/unisms@0.2.0    # pin an exact version
npm update @taliffsss/unisms           # upgrade within semver range in package.json
```

Since this package follows SemVer, consumers pinning with a caret range
(`^0.2.0`, npm's default) automatically receive non-breaking updates on
`npm install`/`npm update`. Consumers should review `CHANGELOG.md` before
upgrading across a major version bump.
