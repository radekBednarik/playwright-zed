---
name: new-machine-setup
description: Steps to get a fresh clone of playwright-zed building, testing and running as a Zed dev extension on a new machine
metadata:
  type: project
---

Bootstrap a fresh clone (verified set of commands, 2026-10-12). Node ^22.12 or >=24 is
needed (vitest 5); the server declares `engines: node >=22`:

```sh
rustup target add wasm32-wasip2
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm install && npm run lint && npm run build && cd ..
cd fixtures/sample-project && npm install && npx playwright install chromium && cd ../..
cd server && npm test        # 108 tests; TodoMVC cases need network
```

Zed dev extension: `zed: install dev extension` on the repo root (symlinks the repo; rerun
it after every Rust change, otherwise `extension.wasm` stays stale). Settings:
`"code_lens": "on"`. To run the local server build instead of the npm package pinned in `src/lib.rs`, export
`PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js` in the
terminal that launches Zed; to test the npm install path, launch Zed from a terminal where
it is not exported (check `/proc/<zed pid>/environ`) and look for the version in
`~/.local/share/zed/extensions/work/playwright-runner-lsp/package.json` (before the feature 004
rename: `work/playwright/`). The dev extension is listed as "Playwright Runner". On opening
`fixtures/sample-project`, Zed 0.218+ asks whether to trust the folder (feature 003; then no
Playwright question); older Zed shows the discovery question (feature 002), click "Run discovery".

npm publishing needs `npm login` plus a one-time code (`npm publish --otp=<code>`) in the
owner's own terminal; the Claude Code `!` shell cannot answer the two-factor prompt. The
registry may take a few minutes to list a new version (HTTP 202 on PUT). Publishing steps
and the registry PR procedure are in `docs/publishing.md`.

**Why:** the owner switches machines (WSL2 today); the gitignored pieces (`node_modules`,
Chromium, `extension.wasm`, `server/dist`) must be rebuilt per machine.

**How to apply:** run the block above first; then see [[playwright-zed-project]] for state
and [[dev-environment-wsl-zed]] for the WSL-specific notes if on WSL again.
