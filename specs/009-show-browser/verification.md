# Verification Record: Show Browser

**Feature**: 009-show-browser | **Started**: 2026-10-29

**Baseline** (T001, branch `009-show-browser` at `5d58188` plus the feature documents,
2026-10-29 12:48 to 12:51 UTC): `cargo test` 8 passed; `cargo build --release --target
wasm32-wasip2` finished (release profile); `cd server && npm run lint && npm run build &&
npm test` green, 248 tests in 22 files (137.9 s, Node 24.19.0, WSLg display `:0` available,
so feature 008's real-viewer tests ran). Environment: WSL2, Playwright 1.64.0 in
`fixtures/sample-project`, Chromium installed, `xvfb-run` at `/usr/bin/xvfb-run`.

## Automated gate after implementation (T022)

Branch `009-show-browser` on top of `5d58188`, working tree with the feature (not yet
committed), 2026-10-29 13:05 to 13:08 UTC:

- `cargo test`: 8 passed (no Rust change in this feature).
- `cargo build --release --target wasm32-wasip2`: finished (release profile).
- `cd server && npm run lint && npm run build`: clean.
- `cd server && npm test`: 24 files, 284 tests passed, 0 skipped, 182.8 s (WSLg display
  present, so feature 008's real-viewer tests ran; the new browser suite needs no display:
  the kept browser runs headless under `PW_DEBUG_CONTROLLER_HEADLESS=1`). Baseline was 248
  tests in 22 files; the feature adds 36 tests: unit `browser.test.ts` (12), store (2),
  commands (1), runner (1), integration `browser.test.ts` (20: toggle, flags, endpoint, one
  headless server kept across runs, browser and server killed from outside, stop on
  shutdown, close all browsers during and after a run, toggle off mid-run, restart,
  settings default and invalid value, the trace viewer coupling).
- One pre-existing test adjusted: `projects.test.ts` lists picker entries by the
  `Playwright: [` prefix and now also excludes the "Show browser" toggle, as it already
  excluded "Show trace viewer".
- `git status`: no files under `fixtures/sample-project/` changed; `pgrep -f run-server`
  found no leftover browser server after the suite.

**Change after the owner's first manual check** (2026-10-29): the owner turned "Show
browser" on, ran a test, then turned "Show trace viewer" on and expected the browser to
close and "Show browser" to switch off, which the one-directional upstream rule did not
do. Decision: the two options exclude each other both ways (spec FR-005, research R6,
parity note). `toggleTraceViewerCommand` now turns the browser option off (remembered),
stops the idle servers and confirms with `Playwright: show trace viewer is on; show browser
turned off (browsers closed)`; both on remains reachable only through a settings default,
which the existing run-start guard covers. Integration tests (s) and (t) rewritten. Gate
rerun 13:19 to 13:22 UTC: `cargo test` 8 passed, wasm build finished, lint and build clean,
`npm test` 24 files, 284 tests passed (183.0 s), fixture tree clean, no leftover server.

## Manual scenarios in Zed (T023)

Owner ran quickstart scenarios 1 to 12 in Zed (dev extension, Linux Zed with WSLg, dev
server from `server/dist`) on 2026-10-29: all PASS. The first pass surfaced the
one-directional coupling (see the change note above); after the symmetric rule was built,
scenario 10 was re-run and passed. The owner reported the result in the session; no
scenario was skipped.

## Release 0.8.0

2026-10-29, lockstep, MINOR (two upstream capabilities). Release branch `release-0.8.0`:
`server/package.json`, `Cargo.toml`, `extension.toml`, `PINNED_SERVER_VERSION` and the README
manual-testing line bumped to 0.8.0, description names the shown browser; gate on the
branch: `cargo test` 8 passed, wasm32-wasip2 release build finished, server lint, build and
`npm test` 24 files / 284 tests green, `npm pack --dry-run` lists `dist/browser.js`. Server
0.8.0 published by the owner from the branch at about 14:08 UTC; `npm view` listed it after
about three minutes with dist-tag `latest`. Release PR #19 merged by the owner as squash
`72fbf34` with all eight CI checks green; tag `v0.8.0` on `72fbf34`, pushed.

Published package check (14:25 UTC): `npm install --omit=dev playwright-zed-language-server@0.8.0`
into a scratch directory, the server started with `--stdio` and `PW_DEBUG_CONTROLLER_HEADLESS=1`,
driven through `vscode-jsonrpc`: `initialize` advertised `playwright.toggleShowBrowser` and
`playwright.closeAllBrowsers`, discovery found 17 tests, the toggle confirmed, a run at the
cursor passed with a command ending in `--headed --workers 1 --trace off` and
`playwright/status` listed one ready browser server, toggle off stopped it within 1.5 s,
`shutdown` and `exit` returned exit code 0, no leftover `run-server`. PASS.

Registry bump: `../zed-extensions` branch `playwright-runner-lsp` reset to the fork's
`bb79322` (the local clone was stale at `40a4df3`), submodule moved to `v0.8.0` (`72fbf34`),
`version = "0.8.0"`, `sort-extensions`, `RUSTUP_TOOLCHAIN=1.90 corepack pnpm@11
package-extensions` passed with the CLI at SHA `9ee3c503` (manifest: name "Playwright
Runner", version 0.8.0, provides language-servers), committed as `c48f6b2`; the owner
pushes to `fork`.

Owner's Zed npm install path check for 0.8.0 (2026-10-29): PASS. Zed installed server
0.8.0 from npm into the extension's work directory and the fixture tests ran and passed
through it (reported by the owner in the session).
