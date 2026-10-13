---
name: playwright-zed-project
description: State of the Playwright-for-Zed extension as of 2026-10-13; what is released, what is deliberately on hold, open decisions, where the spec-kit artifacts live
metadata:
  type: project
---

Public repo https://github.com/radekBednarik/playwright-zed (made public 2026-10-12). `main`
carries feature 001 (`specs/001-scaffold-run-at-cursor/`,
run at cursor, run file, re-run last) and feature 002 (`specs/002-discovery-consent/`, per
workspace per session consent prompt before `playwright test --list` runs workspace code).
Feature branches `001-scaffold-run-at-cursor` and `002-discovery-consent` were merged and
deleted locally and on origin, as was `003-remember-discovery-consent` (PR #2,
merged 2026-10-13); `main` is the only branch. A new feature starts with `/speckit-specify`, which creates `specs/<nnn>-<name>/` and a branch.

Released: npm `playwright-zed-language-server` 0.1.0, 0.2.0, 0.3.0 and 0.4.0 (0.4.0 is `latest`,
published 2026-10-13 16:20 UTC by the owner; 0.3.0 published 2026-10-13 07:06 UTC; a public
`0.0.0-stage` placeholder from npm staged publishing also exists, harmless, removable with
`npm unpublish playwright-zed-language-server@0.0.0-stage --otp=<code>` within 72 h of
2026-10-12 16:07 UTC). Rust shell pins 0.4.0; `extension.toml` and `Cargo.toml` are 0.4.0;
tags `v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0`. Zed installing 0.2.0 and 0.3.0 from npm on its own is
verified; 0.4.0 npm install path verified on 2026-10-13 at `b4c1116`. Through 0.3.0 the display name ended
with " Zed" and the id was `playwright`; feature 004 renames them to "Playwright Runner" and
`playwright-runner-lsp`. The description starts with "Work in progress." and
carries a non-affiliation notice (Playwright is a Microsoft trademark); READMEs disclose
AI-assisted development (GitHub Spec Kit, Claude Code, models Fable and Opus).

Feature 003 (`specs/003-remember-discovery-consent/`, merged via PR #2 on 2026-10-13, owner
confirmed it manually in Zed): Zed 0.218+
(`clientInfo` name `Zed`/`Zed Preview`/`Zed Nightly`/`Zed Dev`) starts language servers only in
trusted worktrees, so the server enables discovery without asking for every reported
workspace folder; the feature 002 question stays for older Zed, other clients and `rootUri`
fallback roots. Gate logic in `server/src/trust.ts`. Automated suite: 7 Rust tests, 108 vitest
tests in 11 files (needs Chromium and network for the TodoMVC fixture tests; integration tests
spawn `server/dist`, so build before testing). Every verification is recorded
in the feature's `verification.md`.

CI (added 2026-10-13, `.github/workflows/ci.yml`): runs on pushes to `main` and on every PR,
including Dependabot's. Jobs: Rust (`cargo test`, wasm32-wasip2 build) and the server on
Node 22 and 24 (`npm ci`, Chromium, lint, build, full vitest suite). Green on first run.
Check a Dependabot PR's CI before merging: PR #1 (vitest 3 to 5, security bump of
`@vitest/mocker`) was merged without CI and broke `npm install` (ERESOLVE on `@types/node`),
fixed by raising `@types/node` to `^22.12.0`.

0.3.0 carries feature 003 (Zed worktree trust gate) and server `engines: node >=22` (Node 20
is end of life), plus vitest 5 and `@types/node` 22 on the dev side. `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19; if Chromium's
`--with-deps` install fails in CI after that, pin `runs-on: ubuntu-24.04`.

**Zed registry PR, feature 004** (`specs/004-zed-registry-submission/`, merged to `main` via PR #3
on 2026-10-13; the owner lifted the 2026-10-12 hold). Zed's `AI_POLICY.md` forbids
autonomous-agent contributions, so the owner forks `zed-industries/extensions`, pushes, opens
the PR and writes every comment personally; the agent prepared everything local and wrote
only facts (`owner-handover.md`, no PR text). Decisions 2026-10-13: id `playwright-runner-lsp`
(the prerequisites ask language-server-only extensions for an `-lsp` suffix; replaces
`playwright`, irreversible after publication), display name "Playwright Runner" (the registry
rejects names ending in " Zed"). Registry CI builds with Rust 1.90 on `wasm32-wasip2`; the
project CI has the same job.

**State: pr-open** (registry PR https://github.com/zed-industries/extensions/pull/7975, opened by
the owner 2026-10-13, all registry checks green; wait for maintainer review, owner answers
within three weeks; on merge run T032, on close fix and open a fresh PR)
(2026-10-13). Release `v0.4.0` = `b4c1116` on `main` (re-pointed from `8379546` after the
owner published server 0.4.0 and asked for lockstep; the pin is 0.4.0). Registry clone
`../zed-extensions`, branch `playwright-runner-lsp`, commit `0aef1c49` (submodule at
`b4c1116`, entry, sorted, `package-extensions` passed locally; remote `origin` only, nothing
pushed). Manual Zed verification passed at `8379546` (owner, Zed 1.23.3; npm install path
verified with server 0.3.0) and re-checked at `b4c1116` (dev extension rebuilt, work
directory holds server 0.4.0 from npm, PASS). Owner's remaining steps are in
`specs/004-zed-registry-submission/owner-handover.md` Part 2: fork, add `fork` remote, push,
PR in own words, record the PR number. State machine: prepared, pr-open, merged, closed; the
owner reports transitions, the agent records them here and in the README (T032 after merge:
install from the registry on a clean machine, drop the "under review" wording). The "main"
ruleset (created 2026-10-13) needs the owner's admin bypass to merge self-authored PRs, and
the Claude Code permission classifier declines `gh pr merge --admin`, so the owner runs
merges with `!`. Fixture commit 11e68ae (`test.fail` case, 16 tests) had broken the
integration tests on `main`; fixed in PR #3. Session scratch (registry CLI binary) is not
kept; re-download per `docs/publishing.md` section 2.

**Why:** the next session on another machine must not re-derive the state, re-ask about
publishing, or prepare the registry PR unasked.

**How to apply:** continue on `main` or a new `/speckit-specify` feature; ask before any
`npm publish`, registry action or merge; see [[dev-environment-wsl-zed]] for the environment and
[[new-machine-setup]] for bootstrapping a fresh clone.
