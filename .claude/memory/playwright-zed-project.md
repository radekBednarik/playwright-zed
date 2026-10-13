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

Released: npm `playwright-zed-language-server` 0.1.0, 0.2.0 and 0.3.0 (0.3.0 is `latest`,
published 2026-10-13; a public
`0.0.0-stage` placeholder from npm staged publishing also exists, harmless, removable with
`npm unpublish playwright-zed-language-server@0.0.0-stage --otp=<code>` within 72 h of
2026-10-12 16:07 UTC). Rust shell pins 0.3.0; `extension.toml` and `Cargo.toml` are 0.3.0;
tags `v0.1.0`, `v0.2.0`, `v0.3.0`. Zed installing 0.2.0 from npm on its own is verified; the
0.3.0 npm install path in Zed has not been checked yet. Through 0.3.0 the display name ended
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

**Zed registry PR, started 2026-10-13 as feature 004** (`specs/004-zed-registry-submission/`,
branch `004-zed-registry-submission`; the owner lifted the 2026-10-12 hold by asking for it).
Zed's `AI_POLICY.md` forbids autonomous-agent contributions, so the owner forks
`zed-industries/extensions`, pushes, opens the PR and writes every comment personally; the
agent only prepares the submodule and `extensions.toml` entry locally, verifies, and hands
over a fact sheet (no PR text). Found 2026-10-13 from the registry's validation scripts: the
display name must not end with " Zed", so the 0.3.0 display name fails registry CI and must be
renamed; registry CI builds with Rust 1.90 on `wasm32-wasip2`. Owner decided 2026-10-13:
id `playwright-runner-lsp` (replaces `playwright`; superseded `playwright-runner` the same day
because Zed's prerequisites want an `-lsp` suffix; irreversible after publication) and display
name "Playwright Runner". Submission release will be 0.4.0. State on 2026-10-13: spec, plan,
research, data model, contracts, quickstart and tasks (39) are written and `/speckit-analyze`
remediations applied; all committed on branch `004-zed-registry-submission`. Feature 004
state: **in progress**. Done on 2026-10-13: rename, 1.90 CI job, local registry checks, PR #3
merged (squash, `7dd3a65`; the "main" ruleset needs the owner's admin bypass for self-authored
PRs), release 0.4.0 tagged `v0.4.0` at `8379546` on `main`, registry clone `../zed-extensions`
on branch `playwright-runner-lsp` with commit `7466aac` (submodule at v0.4.0, entry, sorted,
`package-extensions` passed locally; remote `origin` only, nothing pushed). **Next: T021 to
T024, the owner runs quickstart step 5 in Zed at v0.4.0** (uninstall old dev extension
`playwright`, reinstall, scenarios, npm install path), then T028 to T030 hand-over. Progress is tracked by the `[X]` markers in
`specs/004-zed-registry-submission/tasks.md` and in its `verification.md`. A fixture commit
on `main` (11e68ae, `test.fail` case) had broken the integration tests; PR #3 fixes the
expectations (16 tests).
Research verified: `cargo +1.90 build --release --target wasm32-wasip2` passes with the
committed lock file (Rust 1.90 installed via rustup on the WSL2 machine, install it elsewhere
with `rustup toolchain install 1.90 --profile minimal --target wasm32-wasip2`); the registry's
pinned `zed-extension` CLI (SHA in the registry's `ci.yml`, downloaded to a scratch dir, not
kept) packages the extension; `corepack pnpm@11` works for the registry scripts; the owner has
zero open registry PRs and no fork yet. Registry clone goes to `../zed-extensions` (sibling
dir). Owner-only actions: fork, push to fork, registry PR and comments, any `npm publish`;
the agent writes no PR text (only `owner-handover.md`, a fact sheet). Merging the project's
own PR for 004 (T018) waits for the owner's OK.

**Why:** the next session on another machine must not re-derive the state, re-ask about
publishing, or prepare the registry PR unasked.

**How to apply:** continue on `main` or a new `/speckit-specify` feature; ask before any
`npm publish` or registry action; see [[dev-environment-wsl-zed]] for the environment and
[[new-machine-setup]] for bootstrapping a fresh clone.
