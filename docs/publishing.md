# Publishing

Order matters: the extension installs the language server from npm by the version pinned in
`src/lib.rs` (`PINNED_SERVER_VERSION`), so the npm package must exist before the Zed registry
PR is opened.

## 1. Publish the language server to npm

```sh
cd server
npm run lint && npm test && npm run build
npm version <x.y.z>            # must equal PINNED_SERVER_VERSION in src/lib.rs
npm publish --access public    # package: playwright-zed-language-server
```

Publishing needs an interactive terminal: accounts with two-factor "authorization and
writes" get a one-time-code or browser prompt, and a non-interactive shell fails with
`EOTP`. Pass `--otp=<code>` or run the command in a normal terminal. npm's staged
publishing may create a public `0.0.0-stage` placeholder for a brand-new package before the
real version appears; it can be removed with `npm unpublish <package>@0.0.0-stage` within
72 hours or left alone (`latest` points at the real version).

## 2. Prepare the extension

- Set the same version in `extension.toml` (`version`) and `Cargo.toml`.
- Confirm `src/lib.rs` pins the server version just published.
- `cargo test && cargo build --release --target wasm32-wasip2`.
- `cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190`. The
  registry pipeline compiles with the Rust version pinned in its `.github/workflows/ci.yml`
  (1.90 on 2026-10-13), not with current stable; the project CI runs the same job. Install it
  once with `rustup toolchain install 1.90 --profile minimal --target wasm32-wasip2`.
- Run the registry's packaging CLI against the repository (same SHA as
  `ZED_EXTENSION_CLI_SHA` in that workflow file; keep the binary outside the repository):

  ```sh
  wget -q https://zed-extension-cli.nyc3.digitaloceanspaces.com/<sha>/x86_64-unknown-linux-gnu/zed-extension
  chmod +x zed-extension
  RUSTUP_TOOLCHAIN=1.90 ./zed-extension --source-dir <repo> --output-dir out --scratch-dir scratch
  cat out/manifest.json   # name, version and provides as expected
  ```

- Run the manual scenarios in `specs/001-scaffold-run-at-cursor/quickstart.md` and
  `specs/003-remember-discovery-consent/quickstart.md` as a dev extension at the commit you
  will submit. Zed's prerequisites require testing at that commit, and clearly untested
  extensions are closed without feedback.
- Verify the npm install path: run `zed: install dev extension` again after the pin bump (the
  dev extension symlinks the repository and recompiles the Rust shell only on that command),
  quit Zed, start it from a terminal where `PLAYWRIGHT_ZED_SERVER_ENTRY` is not exported, and
  confirm `~/.local/share/zed/extensions/work/playwright-runner-lsp/package.json` names the
  pinned version.
- Merge to `main` and tag the repository: `git tag v<x.y.z> && git push --tags`. The
  repository must be public and the submitted commit must be on a branch, not detached.

## 3. Submit to the Zed registry

Rules from https://zed.dev/docs/extensions/publishing/publishing-guide, the registry's
`CONTRIBUTING.md`, `AI_POLICY.md` and its validation scripts (`src/lib/validation.js`),
read on 2026-10-13:

- Fork `zed-industries/extensions` to a personal account, not an organisation, so Zed staff
  can push fixes to the PR branch. Clone the fork. `git submodule init && git submodule
  update` is optional: the registry has well over a thousand submodules and
  `package-extensions` checks out only the changed one.
- Add this repository as a submodule with an HTTPS URL, pinned to the tagged commit on
  `main`:

  ```sh
  git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright-runner-lsp
  git -C extensions/playwright-runner-lsp checkout main
  git -C extensions/playwright-runner-lsp reset --hard v<x.y.z>
  git add extensions/playwright-runner-lsp
  ```

- Add the entry to `extensions.toml`. The key must equal the `id` in `extension.toml`, the
  submodule name must equal `extensions/<id>`, and `version` must match `extension.toml` at
  the submodule commit:

  ```toml
  [playwright-runner-lsp]
  submodule = "extensions/playwright-runner-lsp"
  version = "<x.y.z>"
  ```

- Sort both files, otherwise the pipeline fails:
  `corepack pnpm@11 install --frozen-lockfile && corepack pnpm@11 sort-extensions`.
- Run the registry's own validation locally before pushing (the `zed-extension` binary from
  section 2 copied to the clone root):

  ```sh
  RUSTUP_TOOLCHAIN=1.90 REF_NAME=<branch> corepack pnpm@11 package-extensions playwright-runner-lsp
  git diff --exit-code -- extensions.toml .gitmodules   # still sorted
  ```

  Expected: `Packaging 'playwright-runner-lsp'. Version: <x.y.z>` and no thrown error. Delete
  the binary and any `build/`, `output/`, `scratch/` directories before committing.
- Open the PR from the fork. One extension per PR, at most three open PRs per contributor,
  and answer maintainer feedback within three weeks or the PR is closed. The template has
  one checkbox (contribution guidelines read and followed). The registry's Danger run fails
  a PR that does not touch `extensions.toml` and warns on a title that starts with a
  lowercase letter, ends with punctuation or uses a Conventional Commits prefix.
- First feedback usually takes a few weeks, sometimes one to two months. A PR closed with
  little feedback nearly always violated a prerequisite: re-read them, fix, open a fresh PR.

### AI policy

The registry's https://github.com/zed-industries/extensions/blob/main/AI_POLICY.md applies
to every registry-facing action:

- The owner writes the PR title, the PR body and every comment personally, in their own
  words. Autonomous agents must not contribute to the registry, and AI-written replies must
  not be copied into the PR.
- The agent's role ends at local preparation (submodule, entry, sort, local validation) and
  verification; it hands over facts, not text to paste.
- If AI output is quoted on the registry, it goes in a quote block, labelled as AI output,
  kept short, and followed by the owner's own commentary on its relevance.
- Using AI to polish English is allowed as long as the result keeps the author's own voice.

## 4. Ship an update

Same PR rules and the same AI policy. In the extensions fork:
`git submodule update --remote extensions/playwright-runner-lsp` (or check out the new tag in
the submodule), bump `version` in `extensions.toml` to match the new `extension.toml`, sort,
validate locally, open the PR. The version must never decrease.

## 5. Documentation site

The site at https://radekbednarik.github.io/playwright-zed/ is built from `site/` (Astro
with Starlight, TypeScript) and published by `.github/workflows/docs-site.yml`:

- Pull requests that touch `site/**`, `docs/parity.md` or the workflow run the `build`
  job (`npm ci`, `npm run check`, `npm run build`); a type error, a missing screenshot or
  an invalid internal link fails the check.
- Pushes to `main` that touch the same paths run `build` and then `deploy`
  (`actions/deploy-pages`, environment `github-pages`). Pages is configured with the
  "GitHub Actions" source (enabled by the owner on 2026-10-29); no branch holds the built
  site.
- `workflow_dispatch` republishes without a change.

The parity page is generated from `docs/parity.md` at every build (`site/scripts/sync-parity.ts`);
do not edit `site/src/content/docs/reference/parity.md`, it is gitignored.

Screenshots live in `site/src/assets/screenshots/` with a typed manifest in
`site/src/data/screenshots.ts`. `npm run check` fails when a manifest entry's
`extensionVersion` differs from `version` in `extension.toml`, so a release that changes
what a capability looks like is followed by retaking the pictures:

1. `site/scripts/zed-screenshot-profile.sh` starts Zed on `fixtures/sample-project` with a
   dedicated profile (stock theme, lenses and inlay hints on, the released extension
   installed from npm). First launch: `zed: install dev extension` on the repository root,
   then `editor: restart language server`.
2. Stage a scene from the table in `specs/010-user-docs-site/quickstart.md`, maximise the
   window, run `python3 site/scripts/capture-screenshot.py <scene-id> --force` (add
   `--full` for a scene whose second window reaches outside the Zed window). The portal
   captures the whole screen; the helper crops the GNOME top bar and the Ubuntu dock.
   Staging can be scripted with `site/scripts/zed-input.py` (keystrokes and clicks through
   the RemoteDesktop portal, one-time approval, keep hands off the keyboard while it
   runs); `zed <file>:<line>:<col>` with the profile's `XDG_*` variables places the cursor,
   `ctrl-.` plus arrow keys drives the menu, and the run log under the profile's state
   directory tells when a run has ended.
3. Update the manifest entry (`extensionVersion`, `zedVersion`, `capturedOn`, alt text if
   the picture changed), run `npm run check`, and review the picture for private data.

A release that changes no capability only needs the manifest's `extensionVersion` bumped.

## Identity

The prerequisites ask extensions that provide only a language server to carry a
`-language-server` or `-lsp` suffix in the id. This extension's manifest declares a language
server and nothing else, so the id is `playwright-runner-lsp` (owner's decision, 2026-10-13):
the `playwright-runner` stem says what the extension provides, a test runner, and the suffix
follows the prerequisite. Ids cannot change after publication, so later debugger and task
capabilities ship under the same id. The display name is "Playwright Runner": the registry
rejects names that start with "Zed ", end with " Zed" or contain "extension", which is why
the earlier name was dropped. Display names can change later; ids cannot.

## Prerequisite self-check

- [ ] id `playwright-runner-lsp`: lowercase letters, digits and hyphens only; no `zed-`
      prefix, no `-zed` suffix, no `extension`
- [ ] display name "Playwright Runner": does not start with "Zed ", does not end with " Zed",
      does not contain "extension" in any casing
- [ ] `extension.toml` has id, name, version, schema_version (1), authors, description,
      repository
- [ ] version is plain `major.minor.patch`, equal in `extension.toml`, `Cargo.toml` and the
      registry entry at the submodule commit, and not lower than the previous registry version
- [ ] `LICENSE` (MIT) at the extension root
- [ ] no bundled language server, debug adapter or MCP server; only `npm:install` for
      `playwright-zed-language-server` in `capabilities`
- [ ] no slash commands or agent servers
- [ ] all user-facing text in English
- [ ] no Git LFS in the repository
- [ ] `cargo +1.90 build --release --target wasm32-wasip2` passes (registry toolchain)
- [ ] registry `package-extensions` run locally passes
- [ ] `extensions.toml` and `.gitmodules` sorted with `corepack pnpm@11 sort-extensions`
- [ ] submodule URL is HTTPS, repository public, submodule commit tagged and on `main`
- [ ] tested manually in Zed as a dev extension at the submitted commit; npm install path
      verified
- [ ] non-affiliation notice in the description and READMEs, no Playwright or Microsoft logo
- [ ] fork under the personal account; fewer than three open registry PRs
- [ ] AI policy: the owner writes the PR title, body and every comment; quoted AI output in a
      labelled quote block with the owner's commentary
- [ ] respond to maintainer feedback within three weeks
