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

## 2. Prepare the extension

- Set the same version in `extension.toml` (`version`) and `Cargo.toml`.
- Confirm `src/lib.rs` pins the version just published.
- `cargo test && cargo build --release --target wasm32-wasip2`.
- Run the manual scenarios in `specs/001-scaffold-run-at-cursor/quickstart.md` as a dev
  extension at the commit you will submit. Zed's prerequisites require testing at that commit.
- Tag the repository: `git tag v<x.y.z> && git push --tags`. The repository must be public and
  the submitted commit must be on a branch, not detached.

## 3. Submit to the Zed registry

Rules from https://zed.dev/docs/extensions/publishing/publishing-guide:

- Fork `zed-industries/extensions` to a personal account, clone it, `git submodule init &&
  git submodule update`.
- Add this repository as a submodule with an HTTPS URL:

  ```sh
  git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright
  git add extensions/playwright
  ```

- Add the entry to `extensions.toml`. `version` must match `extension.toml` at the submodule
  commit:

  ```toml
  [playwright]
  submodule = "extensions/playwright"
  version = "0.1.0"
  ```

- Run `pnpm sort-extensions` so `extensions.toml` and `.gitmodules` stay sorted.
- Open the PR. One extension per PR, at most three open PRs at a time, and answer maintainer
  feedback within three weeks or the PR is closed.

## 4. Ship an update

Same PR rules. In the extensions fork: `git submodule update --remote extensions/playwright`,
bump `version` in `extensions.toml` to match the new `extension.toml`, open the PR.

## Identity fallback

The prerequisites suggest a `-language-server` or `-lsp` suffix for language-server
extensions. This extension is a Playwright tool integration that will also carry debugger and
task capabilities, so it is submitted as `playwright`. If maintainers ask for a suffix, rename
the id to `playwright-lsp` before the first publication; ids cannot change afterwards.

## Prerequisite self-check

- [ ] id is kebab-case and contains neither `zed` nor `extension`
- [ ] `extension.toml` has id, name, version, schema_version, authors, description, repository
- [ ] `LICENSE` (MIT) at the extension root
- [ ] no bundled language server, debug adapter or MCP server
- [ ] no slash commands or agent servers
- [ ] all user-facing text in English
- [ ] only `npm:install` for `playwright-zed-language-server` in `capabilities`
- [ ] tested manually at the submitted commit
- [ ] display name `Playwright for Zed`, non-affiliation notice in the description and READMEs, no Playwright or Microsoft logo
