---
name: playwright-zed-project
description: State of the Playwright-for-Zed extension as of 2026-10-12; what is done, what waits on the owner, where the spec-kit artifacts live
metadata:
  type: project
---

Private repo https://github.com/radekBednarik/playwright-zed. `main` has only the bootstrap
commit; all work is on branch `001-scaffold-run-at-cursor` (feature 001, spec-kit artifacts in
`specs/001-scaffold-run-at-cursor/`). Architecture: Rust/WASM shell + Node language server
(`server/`, npm name `playwright-zed-language-server`, not yet published). Automated suite:
7 Rust tests, 78 vitest tests in 8 files (needs Chromium and network for the TodoMVC fixture tests).

Open on 2026-10-12: only T041, npm publish of the server (owner must approve,
outward-facing). Convergence Phases 8 and 9 are done and the owner ran all 23 manual
quickstart scenarios in Zed 1.23.2 with every one passing (recorded in `verification.md`).
Repo must become public before a Zed registry PR.

**Why:** the next session should not re-derive the branch layout or re-ask about publishing.

**How to apply:** continue on the feature branch; ask before `npm publish`; see
[[dev-environment-wsl-zed]] for the local Zed setup and the `PLAYWRIGHT_ZED_SERVER_ENTRY`
override that must be exported in `~/.bashrc`.
