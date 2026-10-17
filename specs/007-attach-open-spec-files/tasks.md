---

description: "Task list for Attach to Already-Open Spec Files"
---

# Tasks: Attach to Already-Open Spec Files

**Input**: Design documents from `/specs/007-attach-open-spec-files/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/attach.md,
quickstart.md

**Tests**: Included. Constitution Principle V requires evidence; research R7 decided on an
integration test that replays the editor's sequence for the working paths, and the
quickstart scenarios in Zed are the owner's verification.

**Organization**: Tasks are grouped by user story. Research found no server change needed
for the behaviour itself (R1, R2, R4) and one path blocked inside Zed (R3), so the stories
deliver a regression test and a log line (US1), the verdicts for the other paths (US2), and
the documentation of the blocked path (US3). The Rust shell is untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 use the extension right after installing it, US2 other ways the
  extension starts serving a workspace, US3 know what to do when the editor cannot do it
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; integration tests `server/test/integration/`
- Sample project: `fixtures/sample-project/`
- Docs: `README.md`, `docs/parity.md`
- Feature record: `specs/007-attach-open-spec-files/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirm the working tree and the gate the feature builds on.

- [X] T001 Run the baseline gate on the branch before any change: `cargo test && cargo build --release --target wasm32-wasip2` and `cd server && npm run lint && npm run build && npm test`; record the counts (expected from feature 006: 8 Rust tests, 208 vitest tests in 19 files) in a "Baseline" line at the top of `specs/007-attach-open-spec-files/verification.md` (create the file with the title `# Verification Record: Attach to Already-Open Spec Files`, a `**Feature**: 007-attach-open-spec-files | **Started**: <date>` line, and empty sections "Start-up path verdicts", "Automated gate", "Manual scenarios (Zed)")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: nothing blocks the stories; the server already tracks open documents
(`documents`, a `TextDocuments` instance in `server/src/server.ts`) and already sends
`workspace/codeLens/refresh` after discovery (`discoverEnabled`, `server/src/server.ts:211`).

**Checkpoint**: Phase 1 done; user stories can start, US1 and US3 in parallel.

---

## Phase 3: User Story 1 - Use the extension right after installing it (Priority: P1) 🎯 MVP

**Goal**: pin the editor sequence of the working paths (open before discovery, empty
lenses, refresh, lenses) in the automated suite, and give users a log line that names the
open files served when discovery ends (contract sections 1 to 3).

**Independent Test**: `cd server && npm run build && npm test -- --run integration/attach`
passes; in Zed, quickstart scenario 1 shows the three pre-open tabs served and the log line
`playwright: 3 open file(s) served after discovery: ...`.

### Tests for User Story 1

- [X] T002 [US1] Write `server/test/integration/attach.test.ts` (new, same imports and `TestClient` usage as `server/test/integration/consent.test.ts`): (a) `TestClient.start(FIXTURE)` then immediately `client.open(PASSING)` and `client.codeLenses(PASSING)`: expect `[]`; then `await client.waitForDiscovery()`; `client.codeLenses(PASSING)` again: expect at least one lens whose `command.title` is `▶ Run test`; expect a `window/logMessage` whose `message` matches `/^playwright: 1 open file\(s\) served after discovery: tests\/passing\.spec\.ts$/`; (b) start, open `PASSING`, `FAILING` and `SLOW` (define `FAILING`/`SLOW` constants from `fixtures/sample-project/tests/failing.spec.ts` and `tests/slow.spec.ts` if `helpers.ts` lacks them) in one burst before discovery: all three answer `[]`, after `waitForDiscovery()` all three answer lenses, and the log line is `playwright: 3 open file(s) served after discovery: tests/failing.spec.ts, tests/passing.spec.ts, tests/slow.spec.ts` (sorted, relative to the workspace root); (c) start, open `fixtures/sample-project/playwright.config.ts` before discovery: `[]` before and after, and no log line names `playwright.config.ts` (the count excludes it; with no other document open, no log line at all); run the file and confirm (a) to (c) fail only on the missing log line, proving the sequence itself already works

### Implementation for User Story 1

- [X] T003 [US1] Extend `server/src/server.ts`: add `function servedOpenFiles(ws: Workspace): string[]` returning, for every document in `documents.all()`, the `toPath(uri)` values that are not null and for which `configForFile(ws, file)` returns a config, converted with `path.relative(ws.rootPath, file)` and sorted; in `discoverEnabled(ws)` after `await reporter.refreshCodeLenses()`, compute `const served = servedOpenFiles(ws)` and, when `served.length > 0`, `reporter.log(\`playwright: ${served.length} open file(s) served after discovery: ${served.join(', ')}\`)` (contract section 2: one line per discovery run, omitted at zero, after the "discovered N test(s)" line); keep `reporter.log` so the line reaches `window/logMessage` as the other `playwright:` lines do; make T002 pass with `cd server && npm run build && npm test -- --run integration/attach`

**Checkpoint**: the install sequence is covered by the suite; the log line is visible in
Zed's language server log.

---

## Phase 4: User Story 2 - Other ways the extension starts serving a workspace (Priority: P2)

**Goal**: record the verdict for each start-up path with its evidence, so the parity notes
and the README state only verified facts (FR-006).

**Independent Test**: `verification.md` has one row per path with verdict, evidence pointer
and editor version; the owner's quickstart scenarios 3 and 4 are recorded PASS.

### Implementation for User Story 2

- [X] T004 [US2] Fill the "Start-up path verdicts" table in `specs/007-attach-open-spec-files/verification.md` with the five rows of research R0 (verdict table at the top of `research.md`): columns path, verdict, source evidence (file and line at Zed `fb69067` from R2, R3, R4), demonstration (research R5 session 1 or 2, or "source only" for the restart command), quickstart scenario number, editor version `Zed 1.24.2 (fb69067)`, date `2026-10-17`; note under the table that the remote topology is out of scope (R6) and that "disable then enable" is the same path as reinstall because Zed 1.24.2 has no per-extension disable

**Checkpoint**: every path has a recorded verdict; the owner's Zed runs (T010) complete the
demonstration column.

---

## Phase 5: User Story 3 - Know what to do when the editor cannot do it (Priority: P3)

**Goal**: the blocked path is documented where a new user reads first, with the step that
is verified to work, and the parity matrix carries the reason and the link (FR-007,
contract section 4).

**Independent Test**: `README.md` "Install" section contains the restart sentence and the
link to Zed issue #60405; `docs/parity.md` rows "Run tests with a single click" and
"Playwright project detection and selection" mention pre-open files and the update caveat;
no document in the repository tells the user to close and reopen a file for this.

### Implementation for User Story 3

- [X] T005 [P] [US3] Update `README.md` "Install" section: after step 3 of "From source" (the `zed: install dev extension` step) add a paragraph stating that files already open when the extension is installed are picked up without a reopen (verified on Zed 1.24.2), and that after an **update, a reinstall, or a rerun of `zed: install dev extension` in the same Zed session**, Zed keeps the Playwright server stopped (it marks the server as manually stopped when the old extension version unloads and never clears the mark); run `editor: restart language server` from any TypeScript or JavaScript file of the project, or restart Zed; closing and reopening files does not help; link `https://github.com/zed-industries/zed/issues/60405` as the tracked Zed report (remote variant of the same mechanism); also update the "Manual testing" sentence near line 314 ("After a Rust change run `zed: install dev extension` again") to add "then `editor: restart language server`, see Install"
- [X] T006 [P] [US3] Update `docs/parity.md`: append to the "Run tests with a single click" row note and the "Playwright project detection and selection" row note one sentence each: files open before the extension starts are served without a reopen (Zed sends `didOpen` for every open buffer when a server starts, verified on Zed 1.24.2), except after an update or reinstall in the same session, when Zed keeps the extension's server stopped until `editor: restart language server` (Zed limitation, `crates/project/src/lsp_store.rs` `stopped_language_servers`, tracked as zed-industries/zed#60405); statuses unchanged
- [X] T007 [P] [US3] Grep the repository for reopen advice tied to this behaviour (`grep -rn "close.*reopen\|reopen" README.md server/README.md docs/ specs/007-attach-open-spec-files/spec.md`) and make sure the only remaining "reopen" mentions are the unrelated ones (feature 005 code action menu cache, feature 006 durations reappearing on reopen); update `specs/007-attach-open-spec-files/checklists/requirements.md` notes with the date this was checked

**Checkpoint**: a new user reading Install knows the one step that works after an update.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: gate, owner verification in Zed, memory.

- [X] T008 Run the automated gate from `quickstart.md` (`cargo test && cargo build --release --target wasm32-wasip2`; `cd server && npm run lint && npm run build && npm test`) and record the commands, the test counts (expect 8 Rust tests and 211 vitest tests in 20 files, three new in `attach.test.ts`) and the outcome in the "Automated gate" section of `specs/007-attach-open-spec-files/verification.md`
- [X] T009 [P] Update `.claude/memory/playwright-zed-project.md`: feature 007 state (implemented, awaiting owner verification, then PR), the dev-loop gotcha (after `zed: install dev extension` run `editor: restart language server`), the new test and log line, and that the next lockstep release (0.6.0, carrying 006 and 007) follows the procedure already recorded there
- [X] T010 Run quickstart scenarios 1 to 4 and 6 in Zed 1.24.2 with the dev extension and `PLAYWRIGHT_ZED_SERVER_ENTRY` in `~/.bashrc` (scenario 1 three times for SC-001, scenario 2 once with the Zed version recorded, scenario 5 optional) and record each outcome, the Zed version and the date in the "Manual scenarios (Zed)" section of `specs/007-attach-open-spec-files/verification.md`; this task is the owner's, the agent prepares the file and ticks it only after the owner reports the outcomes

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (T001) first: baseline counts for the verification record.
- Phase 3 (US1): T002 before T003 (test first, then the log line makes it pass).
- Phase 4 (US2): T004 independent of code; can run right after T001.
- Phase 5 (US3): T005, T006, T007 independent of code and of each other.
- Phase 6: T008 after T003; T009 after T008; T010 after T008 (owner).

### User Story Dependencies

- US1 depends on nothing beyond Phase 1.
- US2 depends on nothing beyond Phase 1 (verdicts come from research.md); its
  demonstration column is completed by T010.
- US3 depends on nothing beyond Phase 1; its claims are research R3 facts.

### Parallel Opportunities

- After T001: T002 (US1), T004 (US2), T005, T006, T007 (US3) can all run in parallel.
- T009 can run while T010 waits for the owner.

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 baseline.
2. T002 test, T003 log line: the install sequence is pinned and observable.
3. Validate with `npm test -- --run integration/attach` and quickstart scenario 1.

### Incremental Delivery

- US1 gives the regression guard and the user-visible check.
- US2 and US3 are documentation; they can merge with US1 in one PR, since no release is
  planned for 007 alone (the 0.6.0 lockstep release carries 006 and 007 together, owner
  decision 2026-10-17).
- T010 (owner) closes the verification; T009 records the state for the next session.
