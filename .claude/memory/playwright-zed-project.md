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

**When maintainer feedback on PR #7975 arrives** (procedure agreed 2026-10-13): the owner
pastes or points at the comment; the agent looks up facts and verifies claims locally; the
owner writes the reply (AI policy; quoted agent output only in a labelled quote block with
the owner's commentary). If a code or metadata change is requested: change it on `main`
through the project's normal PR flow, release a new version (0.4.1 or higher; `v0.4.0` is
now referenced by the registry PR and must never be moved again), publish the server first
if it changed and bump the pin, verify in Zed at the new tag, then in `../zed-extensions`
move the submodule to the new tag, set the new `version` in `extensions.toml`, run
`corepack pnpm@11 sort-extensions` and the local `package-extensions` check, commit, and
the owner pushes to the `fork` remote (SSH, `git@github.com:radekBednarik/extensions.git`),
which updates the PR. If maintainers ask for a different id: it is renamed before merge
(manifest, submodule path, entry, all docs), same release procedure. If the PR is closed
without feedback: re-read the prerequisites, fix, the owner opens a fresh PR. On merge: run
T032 (install from `zed: extensions` on a profile without the dev extension, feature 001
scenario 5, time to passing run under 5 minutes), drop "under review" and the PR link from
the README install section, set this state to `merged`; later updates follow
`docs/publishing.md` section 4. Owner preference recorded 2026-10-13: server and extension
are released in lockstep (same version, npm first, then the pin), do not plan a release that
skips the server publish.

**Feature 005, project selection** (`specs/005-project-selection/`, merged to `main` via
PR #4 on 2026-10-16 as squash commit `00c9668`, branch deleted locally and on origin; owner
verified all quickstart scenarios in Zed on 2026-10-14): code action
picker `Playwright: [x] <project>` / `Playwright: Select all projects`, commands
`playwright.toggleProject` and `playwright.selectAllProjects`, `--project` per selected
project, first project selected by default (upstream parity, owner decision), per-user
memory in `project-selection.json` under the platform state directory (override
`PLAYWRIGHT_ZED_STATE_DIR`; owner decision, Zed offers no store), and a `zed-only` folder
default `lsp.playwright.settings.projects` forwarded by the shell's new
`language_server_workspace_configuration`. No browser picker: Playwright rejects
`--browser` when a config defines projects (owner decision 2026-10-14). The fixture has a
second project `mobile` (Pixel 7, Chromium). Automated gate green (8 Rust tests, 152 vitest
tests in 14 files; 154 after the two owner findings below). Two findings during manual use,
both fixed on the branch: Zed caches the code action menu per cursor position (refetched only
on cursor move, buffer edit or server registration; `crates/editor/src/code_actions.rs`), so
every selection change is confirmed by an Info notification and the quirk is documented
(README, parity note); a Zed issue about it is the owner's to file. Failures of one test in
several projects carry a `[<project>]` prefix in diagnostics and the error notification.
Closed out 2026-10-16: all tasks ticked (T032/T037 were recorded as PASS but unticked;
`/speckit-analyze` and `/speckit-converge` run, one contract row added as T042), fresh gate
green (8 Rust, 154 vitest). **PR #4** (https://github.com/radekBednarik/playwright-zed/pull/4)
merged by the owner with `! gh pr merge 4 --squash --admin --delete-branch` on 2026-10-16,
CI green on the PR. **Released 0.5.0** (2026-10-16): owner published server 0.5.0 to npm, pin bumped to 0.5.0,
npm install path verified (Zed 1.24.2 started the server from the work directory, the
installed binary discovered the fixture and ran a test, record in
`specs/005-project-selection/verification.md`), tag `v0.5.0`. Gotcha found on the way:
`~/.bashrc:157` still exports `PLAYWRIGHT_ZED_SERVER_ENTRY` (the zshrc copy is commented out),
and Zed re-reads the login shell, so an npm-path check from a bash-launched Zed needs
`SHELL=/bin/sh` or that line commented out. The Linux Zed is now 1.24.2.
**Released 0.5.1** (2026-10-16, owner asked for everything in sync before the registry push):
lockstep release with no server code change, carrying the updated `extension.toml`
description (PR #5, project selection named). Server 0.5.1 published by the owner from the
release branch, release PR #6 merged as `eca794a`, tag `v0.5.1` = `eca794a`, pin 0.5.1, npm
install path verified (record in `specs/005-project-selection/verification.md`). Registry PR
#7975 bump prepared in the fork clone `../zed-extensions` (remotes: `fork` =
`git@github.com:radekBednarik/extensions.git` SSH, `origin` = upstream HTTPS; partial clone,
only this submodule initialised), branch `playwright-runner-lsp`, commit `b3be8f7` on top of
`0aef1c4` (submodule at `eca794a` = `v0.5.1`, `version = "0.5.1"`, sorted, `package-extensions`
passed locally with the CLI at SHA `9ee3c503`, Rust 1.90). Not pushed: the owner pushes with
`git -C ../zed-extensions push fork playwright-runner-lsp` and writes any PR comment
personally. PR had no maintainer feedback as of 2026-10-16, only the CLA bot exchange (CLA
signed 2026-10-13). Gotcha: in the registry clone, stage the new submodule commit before
`package-extensions` (it checks out the indexed commit), otherwise the check reports the old
version. Direct pushes to `main` bypass the "pull request required" ruleset through the
owner's admin rights; docs changes go through PRs from now on. Note: the gitignored
`.specify/feature.json` pins the feature dir for speckit scripts; set
`SPECIFY_FEATURE_DIRECTORY=specs/<nnn>-<name>` when it points at an older feature.

**Feature 006, single-click run parity gaps** (`specs/006-single-click-run-parity/`, branch
`006-single-click-run-parity` created from `main` at `0a0c400` on 2026-10-16, spec written,
checklist green, not planned yet): investigates whether the three gaps of the "Run tests with
a single click" parity row (executing-line highlight, per-step durations, in-editor run
output) can be closed with surfaces Zed renders for language servers, and delivers every gap
with a "deliverable" verdict; a "blocked" verdict with evidence is a complete outcome. Upstream
facts verified 2026-10-16: active step line highlighted with a trailing "waiting…" note,
finished steps show "<n>ms" (with "ran N×"), cleared on edit or next run; test stdout goes to
VS Code's Test Results panel, never a terminal, so "terminal output" is read as "full output
readable inside the editor". Planned 2026-10-16 (`plan.md`, `research.md`, `data-model.md`, `contracts/run-feedback.md`, `quickstart.md`): all three gaps are deliverable on Zed 1.24.2 (`fb69067`): executing mark and durations as LSP inlay hints (`inlay_hints.enabled` is off by default in Zed; refresh via `workspace/inlayHint/refresh`, per-server invalidation verified in `crates/editor/src/inlays/inlay_hints.rs`), fed by a step reporter shipped in `server/dist` and passed as `--reporter=list,json,<abs path>` (Playwright resolves absolute reporter paths; events as JSON lines in a temp file polled every 200 ms); run output written to `<stateDir>/runs/<key>.log` and opened through `window/showDocument` (Zed handles it in `crates/editor/src/items.rs` `handle_lsp_show_document`, any absolute path) from the code action "Playwright: Show last run output". Semantic tokens (supported but off by default), code lens blocks and Hint diagnostics were rejected. Server-only change, no Rust. Implemented 2026-10-16 on the
branch (tasks T001 to T034 and T036 ticked; T035, the Zed scenarios, is the owner's): new
server modules `step-reporter.ts` (CommonJS `export =`, loaded by Playwright), `marks.ts`,
`output.ts`; `spawn.ts` polls the step file; `server.ts` declares `inlayHintProvider`, answers
`textDocument/inlayHint`, offers "Playwright: Show last run output" (`playwright.showLastRunOutput`)
and writes `<stateDir>/runs/<sha1 prefix>.log`; current run id guard everywhere. Fixture gained
`tests/slow.spec.ts` and `tests/helpers/steps.ts` (17 discovered tests now). Gate green: 8 Rust,
208 vitest in 19 files (after `/speckit-converge` appended and `/speckit-implement` closed T037, T038: per-run
reporter log line, contract additions; all 38 tasks ticked). Gotcha found: WSL2 steps its wall clock (a -2480 ms step measured),
Playwright's `step.duration` then goes negative; the server clamps to 0 and the integration
test checks the longest step only. Parity row moved to `full` in `docs/parity.md` (owner may
still prefer `partial` because the executing mark is a label, not a line background). Owner
verified all 10 quickstart scenarios in Zed 1.24.2 on 2026-10-16 (recorded in
`verification.md`, T035 ticked, all 36 tasks done, not yet committed). Committed as `c2591f6`, pushed,
**PR #8** (https://github.com/radekBednarik/playwright-zed/pull/8) opened 2026-10-16; parity row
stays `full` (owner decision 2026-10-16). CI green on PR #8 (all six checks, 2026-10-16
evening). **State at end of 2026-10-16: PR #8 open, awaiting the owner's merge.** Resume
procedure for the next session: (1) owner merges with `! gh pr merge 8 --squash --admin
--delete-branch`, then `git checkout main && git pull && git branch -D 006-single-click-run-parity`
locally; (2) lockstep release 0.6.0 (MINOR, a parity row moved to `full`): release branch, bump
`server/package.json` to 0.6.0, owner publishes the server from their own terminal
(`npm publish --otp=<code>` in `server/`), then bump `PINNED_SERVER_VERSION` in `src/lib.rs`,
`extension.toml` and `Cargo.toml` to 0.6.0, `cargo test`, wasm build, release PR, merge, tag
`v0.6.0` on the merge commit; (3) npm install path check in Zed (fresh terminal without
`PLAYWRIGHT_ZED_SERVER_ENTRY`, `zed: install dev extension` rerun, look for 0.6.0 in
`~/.local/share/zed/extensions/work/playwright-runner-lsp/package.json`), record in
`specs/006-single-click-run-parity/verification.md`; (4) registry bump in `../zed-extensions`
(stage the submodule at `v0.6.0` first, `version = "0.6.0"` in `extensions.toml`,
`corepack pnpm@11 sort-extensions`, local `package-extensions` with Rust 1.90), owner pushes
to `fork`, which updates registry PR #7975 (still no maintainer feedback as of 2026-10-16).
Also pending from earlier: the 0.5.1 registry bump commit `b3be8f7` in `../zed-extensions` was
prepared but, as far as recorded, not yet pushed by the owner; check `git -C ../zed-extensions
log fork/playwright-runner-lsp..playwright-runner-lsp` before preparing 0.6.0 on top.
`.specify/feature.json` points at `specs/006-single-click-run-parity`; a new feature starts
with `/speckit-specify` (the Spec Kit 1.1.2 script creates the directory, the branch is made by
hand). The sparse Zed source clone used for research lived in the session scratchpad and is
gone; re-clone with `git clone --branch v1.24.2 --depth 1 --filter=blob:none --sparse` if
Zed source evidence is needed again.
Note: `create-new-feature.sh` in Spec Kit 1.1.2 no longer creates the git branch; it was
created by hand.

**Why:** the next session on another machine must not re-derive the state, re-ask about
publishing, or prepare the registry PR unasked.

**How to apply:** continue on `main` or a new `/speckit-specify` feature; ask before any
`npm publish`, registry action or merge; see [[dev-environment-wsl-zed]] for the environment and
[[new-machine-setup]] for bootstrapping a fresh clone.
