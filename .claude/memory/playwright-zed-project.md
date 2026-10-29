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
2026-10-12 16:07 UTC). Later releases: 0.5.0 and 0.5.1 (2026-10-16), **0.6.0 (2026-10-17,
`latest` until 0.7.0; shell pin, `extension.toml` and `Cargo.toml` were 0.6.0, tag `v0.6.0` =
`91aab9c`)**, then 0.7.0 (2026-10-20), then **0.8.0 (2026-10-29, current, see feature 009 below)**; tags `v0.1.0` through `v0.8.0`. Zed installing 0.2.0 and 0.3.0 from npm on its own is
verified; 0.4.0 npm install path verified on 2026-10-13 at `b4c1116`, 0.5.0, 0.5.1 and
0.6.0 likewise (records in the feature 005 and 006 verification files). Through 0.3.0 the display name ended
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
evening). **PR #8 merged** by the owner on 2026-10-17 06:24 UTC as merge commit `12556f9`
(not squash); branch deleted locally and on origin; stale local branches
`001-scaffold-run-at-cursor` and `remote` deleted (`004-zed-registry-submission` kept, not
an ancestor of `main`). **Released 0.6.0** (2026-10-17, lockstep, carries 006 and 007):
release branch `release-0.6.0`, server 0.6.0 published by the owner from the branch (npm
`latest` within minutes), pin, `extension.toml`, `Cargo.toml` and the README manual-testing
line bumped, description names the step marks and run output, release PR #12 merged by the
owner as squash `91aab9c`, tag `v0.6.0` on it; published package driven over stdio and the
owner's Zed npm install path check both PASS (record: "Release 0.6.0" section in
`specs/006-single-click-run-parity/verification.md`). Registry bump `40a4df3` in
`../zed-extensions` (submodule at `v0.6.0`, packaging check with the CLI at SHA `9ee3c503`,
Rust 1.90, binary linked at the clone root from session scratch, gitignored) pushed by the
owner to `fork/playwright-runner-lsp`; registry PR #7975 head is `40a4df3`, `package`,
Danger and CLA checks green, no maintainer review as of 2026-10-17 (queue: 388 open PRs,
maintainers merge selectively, recent language-server submissions took 1 to 7 days).
Release procedure that worked for 0.5.1 and 0.6.0 (reuse for the next one):
(1) release branch from `main`, `cd server && npm version <x.y.z> --no-git-tag-version`,
same version in `Cargo.toml`, `extension.toml`, `PINNED_SERVER_VERSION` in `src/lib.rs`,
README "must list Playwright Runner <x.y.z>" line, description if features were added,
`cargo test` (refreshes `Cargo.lock`), wasm build, server lint, build, test, `npm pack
--dry-run` in `server/`, commit, push, release PR; (2) owner publishes from the branch
(`npm publish --otp=<code>` in `server/`), poll `npm view playwright-zed-language-server@<x.y.z>
version` (a few minutes); (3) owner merges the PR, agent tags `v<x.y.z>` on the merge commit
and pushes the tag; (4) agent checks the published package: `npm install --omit=dev` into a
scratch dir (the bare tarball lacks `vscode-languageserver`) and drive it over stdio; owner
does the Zed npm install path check (terminal without `PLAYWRIGHT_ZED_SERVER_ENTRY`,
`zed: install dev extension` rerun, version in the work directory's `package.json`);
(5) registry bump in `../zed-extensions`: fetch tags in the submodule, check out the tag
commit, `git add` it first, `version` in `extensions.toml`, `corepack pnpm@11
sort-extensions`, download the CLI at the `ZED_EXTENSION_CLI_SHA` of the registry's
`.github/workflows/ci.yml` to scratch, symlink as `./zed-extension` in the clone root,
`RUSTUP_TOOLCHAIN=1.90 corepack pnpm@11 package-extensions`, check `output/manifest.json`,
commit "Update playwright-runner-lsp to v<x.y.z>", owner pushes to `fork`; (6) record in the
feature's verification file and here through a docs PR.
A new feature starts with `/speckit-specify` (the Spec Kit 1.1.2 script creates the
directory, the branch is made by hand).

**Feature 007, attach to already-open spec files** (`specs/007-attach-open-spec-files/`,
branch `007-attach-open-spec-files` created from `main` at `3d8e362` on 2026-10-17, spec
written, checklist green, planned 2026-10-17: `plan.md`, `research.md`, `data-model.md`,
`contracts/attach.md`, `quickstart.md`, `tools/lsp-tap.js`; tasks T001 to T009 implemented
2026-10-17 on the branch, not committed: `server/test/integration/attach.test.ts` (3 tests),
`servedOpenFiles` plus the log line in `server/src/server.ts` `discoverEnabled`, README
Install caveat, parity rows, `verification.md`; owner ran quickstart scenarios 1 to 4 and 6 on Zed 1.24.2 on 2026-10-17,
all PASS, recorded, all 10 tasks ticked; **PR #10**
(https://github.com/radekBednarik/playwright-zed/pull/10) merged by the owner on 2026-10-17
as squash commit `d937c90` with all eight CI checks green, branch deleted locally and on
origin; released in 0.6.0 the same day (see "Released 0.6.0" above);
`.specify/feature.json` points at it): owner report that spec files open in Zed before the
extension is installed get no lenses until closed and reopened. Research verdicts (Zed
1.24.2 source at `fb69067` plus a message-level reproduction with the Linux Zed and an LSP
tap, timelines in `research.md` R5): first install in a fresh session, `editor: restart
language server` and an editor restart with restored tabs already work (Zed sends `didOpen`
for every open buffer when a server starts, `lsp_store.rs:13575`, and the server's
`codeLens/refresh` after discovery makes Zed refetch); update, reinstall and every rerun of
`zed: install dev extension` in the same session are **blocked by Zed**: the extension
unload path calls `stop_language_servers_for_buffers`, which adds "playwright" to
`stopped_language_servers` (`lsp_store.rs:13151`), `register_buffer_with_language_servers`
then skips the server for every file, old or new (`:3218`), and only `editor: restart
language server` (`clear_stopped = true`, `:13081`) or a new Zed process clears it; closing
and reopening a file does not help. Zed issue #60405 (open) is the remote variant. **Dev
loop gotcha**: after each `zed: install dev extension` rerun, run `editor: restart language
server` from a spec file, otherwise the Playwright server stays down. Deliverables: server
integration test `attach.test.ts` (open before discovery, empty lenses, refresh, lenses),
a log line `playwright: <n> open file(s) served after discovery: ...`, README install caveat
with the restart command, parity notes with the link, verification record; no Rust change.
The owner writes any Zed issue comment (AI policy); R3 holds the facts. The remote
topology (Windows Zed + WSL remote server) never loaded this extension
(`~/.local/share/zed/remote_extensions/` has only `html`) and is out of scope. Reproduction
method that needs no GUI: create or remove the symlink
`~/.local/share/zed/extensions/installed/playwright-runner-lsp` while Zed runs (Zed watches
the directory); the server entry override must sit in `~/.bashrc` because Zed reads the
project environment from the login shell. The sparse Zed source clone used for research lived in the session scratchpad and is
gone; re-clone with `git clone --branch v1.24.2 --depth 1 --filter=blob:none --sparse` if
Zed source evidence is needed again.

**Feature 008, show trace viewer** (`specs/008-show-trace-viewer/`, spec, plan, research,
data model, contract, quickstart, tasks and verification written 2026-10-20; implemented the
same day; **PR #14** (https://github.com/radekBednarik/playwright-zed/pull/14) merged by the
owner on 2026-10-20 as squash `a89d103`, branch deleted; `.specify/feature.json` points at
it). **Released 0.7.0** (2026-10-20, lockstep, MINOR): release PR #16 merged by the owner
as squash `01cae88`, tag `v0.7.0` = `01cae88`, server 0.7.0 published by the owner (npm
`latest`), published package driven over stdio PASS (record in the feature's
`verification.md`, "Release 0.7.0"); the shell pin, `extension.toml` and `Cargo.toml`
were 0.7.0 until 0.8.0 (feature 009). Registry bump committed in `../zed-extensions`
on `playwright-runner-lsp` (local branch reset to the fork's `40a4df3`; this machine's
clone had been stale at `0aef1c4`): "Update playwright-runner-lsp to v0.7.0", submodule
at `01cae88`, `package-extensions` passed with the CLI at SHA `9ee3c503` (re-downloaded
to session scratch, symlinked as `./zed-extension`, gitignored) and Rust 1.90; pushed by
the owner to `fork/playwright-runner-lsp` on 2026-10-20, so registry PR #7975's head is
`bb79322c` (still open, no maintainer review as of that day). The owner's Zed npm install path check for 0.7.0 PASSED on
2026-10-20 (0.7.0 in the work directory's `package.json`).
Delivered, server only, no Rust change: code action `Playwright: [x]/[ ] Show trace viewer`
(`playwright.toggleTraceViewer`, remembered per user in `trace-viewer.json` next to
`project-selection.json`, Zed settings default `lsp.playwright.settings.showTrace`, a
remembered choice wins, every toggle confirmed by an Info notification); `--trace on` on
every run while on; one `playwright show-trace --stdin` process per config
(`server/src/trace.ts` `ViewerSessions`, cwd = workspace root, started on the first trace,
reused, closed on toggle off, workspace removal, shutdown and exit); a single-test run is
followed live (step reporter emits `traceLive` on `testBegin`, the predicted
`<outputDir>/.playwright-artifacts-<worker>/traces/<test.id>.json`, and `trace` on
`testEnd`); `Playwright: Show trace` (`playwright.showTrace`, `[{ uri, line }]`) shows the
latest trace of the test at the cursor from the last run's JSON report attachments; Warning
`Playwright: no trace recorded for <target> in this run` for a followed run without a
trace. Parity row `full` (`lsp, playwright-ui`), "Show browser" row carries a deferred note
(upstream disables tracing while the browser is shown). Playwright gotchas (research R2):
the viewer dies on a path that does not exist (so `.zip` paths are stat-checked) and reads
each stdin chunk as one path with its reader attached only after loading, so two paths
written close together crash it; writes are spaced (first at once, later ones 3 s after
start and 250 ms apart, a newer path replaces a waiting one), which is why a fast test shows
its final trace up to 3 s late. CI: the server test step runs `xvfb-run -a npm test`
(installs `xvfb` if missing) because one integration test starts the real viewer window;
the test skips itself without `DISPLAY` or `WAYLAND_DISPLAY`. Test-writing gotcha:
`workspace/executeCommand` for a run answers only when the run ends, so a mid-run action in
a test must not await the run. Gate after merge: 8 Rust, 248 vitest tests in 22 files.
Owner verified quickstart scenarios 1 to 11 in Zed on 2026-10-20.

**Feature 009, show browser and close all browsers** (`specs/009-show-browser/`, spec,
plan, research, data model, contract, quickstart, tasks and verification written
2026-10-29; implemented the same day; `/speckit-analyze` findings remediated (FR-005
amended: video cannot be forced off from the CLI); `/speckit-converge` clean; **PR #17**
(https://github.com/radekBednarik/playwright-zed/pull/17) merged by the owner on 2026-10-29
as squash `fe8f09b`, branch deleted; `.specify/feature.json` points at it). **Released
0.8.0** (2026-10-29, lockstep, MINOR, two upstream capabilities): release PR #19 merged by
the owner as squash `72fbf34`, tag `v0.8.0` = `72fbf34`, server 0.8.0 published by the owner
from the release branch (npm `latest` after about three minutes), published package driven
over stdio PASS (install into scratch, both new commands advertised, discovery, a headless
shown run through a kept server, toggle off stopped it, clean exit); **the shell pin,
`extension.toml` and `Cargo.toml` are 0.8.0 and `v0.8.0` is the current tag**. Registry
bump committed in `../zed-extensions` on `playwright-runner-lsp` as `c48f6b2` on top of the
fork's `bb79322` (local branch was stale at `40a4df3` and was reset to
`fork/playwright-runner-lsp` first; submodule at `72fbf34`, `version = "0.8.0"`,
`sort-extensions`, `package-extensions` passed with the CLI at SHA `9ee3c503` re-downloaded
to session scratch and symlinked as `./zed-extension`, Rust 1.90, manifest version 0.8.0);
pushed by the owner to `fork/playwright-runner-lsp` on 2026-10-29, so registry PR #7975's
head is `c48f6b2`. The owner's Zed npm install path check for 0.8.0 PASSED on 2026-10-29
(server 0.8.0 installed from npm, fixture tests passed). Delivered, server
only, no Rust change: code action
`Playwright: [x]/[ ] Show browser` (`playwright.toggleShowBrowser`, remembered per user in
`show-browser.json` next to `trace-viewer.json`, Zed settings default
`lsp.playwright.settings.reuseBrowser` under upstream's setting name, a remembered choice
wins, every toggle confirmed by an Info notification) and `Playwright: Close all browsers`
(`playwright.closeAllBrowsers`, offered while the option is on or a server runs, refused
with a Warning during a run, `no browsers to close` when idle). Mechanism (research R1 to
R4, verified by probes on Playwright 1.64.0): one `playwright run-server --path=/<32 hex>
--host 127.0.0.1` process per configuration with `PW_EXTENSION_MODE=1`
(`server/src/browser.ts` `BrowserServers`, cwd = config dir, started by the first run that
needs it, endpoint parsed from the `Listening on ws://...` line, 15 s readiness timeout,
shared promise while starting); shown runs carry `--headed --workers 1 --trace off` plus
`PW_TEST_CONNECT_WS_ENDPOINT` and `PW_TEST_REUSE_CONTEXT=1`, so the browser window stays
open between runs with the last page and the next run continues in it; a browser closed by
hand is relaunched by the server at the next run. Stop is `SIGINT` then `SIGKILL` after 5 s
(stdin end does nothing, the server never reads stdin; `SIGTERM` closes the browser but
leaves the Node process alive; `SIGHUP` likewise); stopped on toggle off (idle workspaces
at once, a workspace with a run in progress at that run's end), close action, settings
default turning off, workspace removal, shutdown and exit; an unexpected exit logs and
shows one Warning, the next run starts a new server. **Owner decision 2026-10-29, beyond
upstream**: "Show browser" and "Show trace viewer" exclude each other both ways (upstream
only turns the trace viewer off when the browser is shown); turning either on turns the
other off as a remembered choice and closes its window or browsers; both on is reachable
only through a settings default and then runs record no trace with a one-time Warning per
combination. Video cannot be forced off from the CLI (no `playwright test` option); a
project with `video: on` keeps recording and Playwright then skips context reuse on its own
(recorded in the parity note). "Show trace" at the cursor is now offered only when the last
run recorded a trace. Tests: the integration suite keeps the kept browser headless through
Playwright's own `PW_DEBUG_CONTROLLER_HEADLESS=1` (passed via a new `env` option of
`TestClient.start`), so no display and no CI change; `childPids` and `processAlive`
helpers; test suites that own a state directory across restarts create it themselves
because `TestClient.stop()` removes a directory it created. Gate after merge: 8 Rust, 284
vitest tests in 24 files. `projects.test.ts` filters the picker entries by the
`Playwright: [` prefix and excludes both the trace and the browser toggles. Owner verified
quickstart scenarios 1 to 12 in Zed on 2026-10-29. Parity rows "Show browser" (`full`,
`lsp, playwright-ui`) and "Close all browsers" (`full`, `lsp`).

**Feature 010, user docs site and README restructure** (`specs/010-user-docs-site/`,
spec, plan, research, data model, two contracts, quickstart, tasks, three design mocks,
decision record and verification written and implemented on 2026-10-29; **PR #20**
(https://github.com/radekBednarik/playwright-zed/pull/20) merged by the owner the same day
as squash `35d25fe`, branch deleted; `.specify/feature.json` points at it; docs only, **no
extension, server or registry change**, the pin stays 0.8.0 and `v0.8.0` the current tag).
Delivered: README reordered for users (requirements, install, what it does, settings,
usage, limitations and differences, getting help, then one "Contributing and development"
part; site link on the first screen; contract in `contracts/readme-structure.md`); the
documentation site in `site/` (Astro 7.4.4 + Starlight 0.42.7, TypeScript, npm, exact pins,
`typescript` 6.0.3 because `@astrojs/check` 0.9.12 accepts only 5.x and 6.x; design A
"Terminal" chosen by the owner from three static mocks in `specs/010-user-docs-site/mocks/`;
landing page as `site/src/pages/index.astro` inside Starlight's frame, 14 docs pages, parity
page generated from `docs/parity.md` by `site/scripts/sync-parity.ts` at every build and
gitignored, `starlight-links-validator` fails the build on invalid internal links,
`site/scripts/check-screenshots.ts` fails `npm run check` when a capability has no
screenshot or a manifest entry's `extensionVersion` differs from `extension.toml`,
`check-external-links.ts` run locally only); 13 real screenshots in
`site/src/assets/screenshots/` with a typed manifest `site/src/data/screenshots.ts` and the
`<Shot id>` component (Zed 1.26.2, extension 0.8.0 from npm, One Dark, 1920 x 1119 after
cropping the 32 px GNOME top bar and the 49 px Ubuntu dock); deploy workflow
`.github/workflows/docs-site.yml` (build on PRs touching `site/**`, `docs/parity.md`,
`extension.toml` or the workflow; build and deploy on pushes to `main`; Pages enabled by
the owner on 2026-10-29 with the "GitHub Actions" source). Site address:
https://radekbednarik.github.io/playwright-zed/ (**deployed** 2026-10-29 by workflow run 40922437794 on `35d25fe`, Build and Deploy both success; every page answers 200 and the optimised hero image is served; later site changes on `main` redeploy on their own). Screenshot procedure
(`docs/publishing.md` section 5): `site/scripts/zed-screenshot-profile.sh` starts Zed with
its own XDG config and data under `~/.cache/playwright-zed-screenshots/` and its own
extension state through `PLAYWRIGHT_ZED_STATE_DIR` (the first menu capture showed the
owner's real "Show trace viewer" choice before that was added); `capture-screenshot.py`
captures through `org.freedesktop.portal.Screenshot` (one-time approval, remembered);
`zed-input.py` sends keystrokes and clicks through `org.freedesktop.portal.RemoteDesktop`
(one-time approval; the auto-mode classifier refused the agent's first `session` call,
the owner ran it with `!`, after that the agent staged all 13 scenes: `zed <file>:<line>`
with the profile env places the cursor, `ctrl-.` plus Down selects menu entries, Return
runs; Zed dismisses its notifications after about 5 s, so a result capture must follow
the run end at once, best by polling the run log under the profile state for a final
`# status:`; `workspace: clear trusted worktrees` restarts Zed and restores windows
un-maximised, the trust dialog is reopened from the Restricted Mode badge). Gotchas:
pressing Return with the code action menu closed inserts a newline (undo and save the
unchanged buffer, otherwise the next run warns about unsaved changes); Chromium's translate
prompt appears in the trace viewer on a Czech locale (dismiss before capturing).
`/speckit-analyze` ran before the merge: no critical or high finding; C1 (workflow path
filter), I1 (FR-013 wording) and I2 (input helper record) were applied. Gate after merge
unchanged: 8 Rust, 284 vitest; the docs "Build" job takes under 30 s. Follow-ups merged
the same day: PR #21 (memory record, landing `<title>`) and the click-to-zoom overlay in
`Shot.astro` (owner found the screenshots unreadable on phones; full-size WebP in a
`<dialog>` at native width).

Note: `create-new-feature.sh` in Spec Kit 1.1.2 no longer creates the git branch; it was
created by hand.

**Why:** the next session on another machine must not re-derive the state, re-ask about
publishing, or prepare the registry PR unasked.

**How to apply:** continue on `main` or a new `/speckit-specify` feature; ask before any
`npm publish`, registry action or merge; see [[dev-environment-linux-zed]] for the environment and
[[new-machine-setup]] for bootstrapping a fresh clone.
