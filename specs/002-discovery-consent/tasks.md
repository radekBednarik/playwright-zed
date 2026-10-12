---

description: "Task list for Ask Before Running Workspace Code on Open"
---

# Tasks: Ask Before Running Workspace Code on Open

**Input**: Design documents from `/specs/002-discovery-consent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle V requires fixture-backed integration tests before
the parity row is recorded, and SC-001 demands an observable proof that nothing executes
before consent.

**Organization**: Tasks are grouped by user story. All code lives in the language server
(`server/`); the Rust shell is untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1 nothing runs until agreed, US2 agreeing enables
  everything, US3 declining keeps idle with a way back)
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`, tests in `server/test/integration/`
- Docs: `README.md`, `docs/parity.md`, feature 001 contracts and quickstart under
  `specs/001-scaffold-run-at-cursor/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness support for the prompt so every later task can be verified.

- [X] T001 Extend `server/test/integration/helpers.ts`: `TestClient.start(folders, { answer?: 'Run discovery' | 'Not now' | null })` with default `'Run discovery'`; in the star request handler, when `method === 'window/showMessageRequest'`, record the request in `requests` and return the action whose `title` equals `answer`, or never resolve the returned promise when `answer === null` (models a dismissed prompt); add `prompts()` returning the recorded `window/showMessageRequest` params; keep `waitForDiscovery()` waiting for `workspace/codeLens/refresh`
- [X] T002 [P] Add `discovery: 'pending' | 'enabled' | 'declined'` and `discoveryAsked: boolean` to `Workspace` in `server/src/types.ts` (export `type DiscoveryDecision = 'pending' | 'enabled' | 'declined'`), per data-model.md: initial `pending`, `discoveryAsked` initially `false`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The prompt helper and the gate itself, which every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `askDiscovery(folderName: string, folderPath: string): Promise<'Run discovery' | 'Not now' | null>` in `server/src/reporting.ts` using `connection.window.showWarningMessage(message, { title: 'Run discovery' }, { title: 'Not now' })` with the exact message text from `contracts/discovery-consent.md`; resolve to the chosen title, `null` when the client returns no selection, and reject when the request fails
- [X] T004 Gate discovery in `server/src/server.ts`: in `discoverWorkspace`, keep config location and the unsupported-version warning unconditional; when at least one supported config exists and `ws.discovery === 'pending'` and `!ws.discoveryAsked`, set `discoveryAsked = true` and call `askDiscovery` without awaiting it on the discovery path: on `'Run discovery'` call a new `enableDiscovery(ws)`; on `'Not now'` set `declined`; on rejection set `declined` and `showWarning` with the "is off for <folder>" text from the contract; run `discoverConfig` for the supported configs only when `ws.discovery === 'enabled'`; implement `enableDiscovery(ws)` as idempotent: set `enabled`, discover every supported config, `refreshCodeLenses()`
- [X] T005 Initialise `discovery: 'pending'` and `discoveryAsked: false` in `addWorkspace` in `server/src/server.ts` and extend the `playwright/status` response with `discovery` and `discoveryAsked`

**Checkpoint**: Opening the fixture sends one prompt; with the helper's default answer every
feature 001 integration test still passes (`npm test`).

---

## Phase 3: User Story 1 - Nothing runs until I say so (Priority: P1) 🎯 MVP

**Goal**: No Playwright process, no lenses, no run actions before consent; run commands are
refused with the pending message.

**Independent Test**: A temp project whose config writes a marker file on load; the marker
must not exist until "Run discovery" is answered.

### Tests for User Story 1

- [X] T006 [P] [US1] Create `server/test/integration/consent.test.ts` with a `sideEffectProject()` helper: temp dir, symlink to the fixture's `node_modules`, `tests/one.spec.ts` with one passing `page.setContent` test, and `playwright.config.ts` that `import { writeFileSync } from 'node:fs'` and writes `'loaded'` to the path in `process.env.PW_ZED_MARKER` before `defineConfig` (the server inherits `process.env`, so the test sets `PW_ZED_MARKER` on its own process before `TestClient.start`); cases: (a) with `answer: null` initialise, wait 1500 ms, assert the marker file does not exist, `playwright/status` shows `discovery: 'pending'`, `discoveryAsked: true`, one prompt whose message contains the folder basename and "executes", `codeLens` on the spec returns `[]`, `codeAction` returns exactly one action titled `Playwright: Enable test discovery`; (b) still pending, `playwright.runAtCursor` on the spec yields a Warning containing "has not been enabled" and no `$/progress`, marker still absent; (c) a plain folder with only `index.ts` sends no prompt

### Implementation for User Story 1

- [X] T007 [US1] In `server/src/server.ts` make `testFileContext` return `ctx: null` when `ws.discovery !== 'enabled'` so lenses and run actions disappear; add the code action `Playwright: Enable test discovery` (kind `source.playwright`, command `playwright.enableDiscovery`, arguments `[{ uri }]`) in `onCodeAction` when the document's workspace has at least one supported config and `discovery !== 'enabled'`, and return no other Playwright action in that state (including `Re-run last`)
- [X] T008 [US1] In `server/src/server.ts` make `runAtCursor`, `runFile` and `rerunLast` refuse with the contract's `pending` or `declined` Warning when the target workspace is not `enabled` (check before `notPlaywright`); add `COMMAND_ENABLE_DISCOVERY = 'playwright.enableDiscovery'` to `ALL_COMMANDS` in `server/src/commands.ts` and dispatch it in `onExecuteCommand` to `enableDiscovery` for the workspace of `uri` (Warning `Playwright was not found in the workspace for <file>` when none)

**Checkpoint**: `consent.test.ts` cases (a) to (c) pass; nothing executes before consent.

---

## Phase 4: User Story 2 - Agreeing enables everything as before (Priority: P1)

**Goal**: "Run discovery" starts discovery immediately; feature 001 behaviour follows with no
further question in the session.

**Independent Test**: Fixture with the default answer: lenses appear, a run passes, saving a
file re-discovers without a second prompt.

### Tests for User Story 2

- [X] T009 [P] [US2] Extend `server/test/integration/consent.test.ts`: (d) side-effect project with default answer: after `waitForDiscovery()` the marker file exists, `discovery: 'enabled'`, lenses present; (e) fixture with default answer: `prompts()` has length 1 after discovery, and after `didSave` on `passing.spec.ts` plus a second `workspace/codeLens/refresh` it still has length 1; (f) a config added to an enabled workspace later (write `packages/web/playwright.config.ts` plus a test, then `didSave` of that config) is discovered without a second prompt
- [X] T010 [P] [US2] Update `server/test/integration/detect.test.ts`: assert the fixture case shows exactly one `window/showMessageRequest` with the "Run discovery" and "Not now" actions and `discovery: 'enabled'` in status; keep every existing assertion; the plain-folder case asserts `prompts()` is empty; the two-root case asserts one prompt for the fixture and none for the plain folder

### Implementation for User Story 2

- [X] T011 [US2] In `server/src/server.ts` make `documents.onDidSave` re-discovery and the "config found later" path respect `discovery === 'enabled'` only (no prompt again), and ensure `enableDiscovery` triggered from the prompt callback refreshes lenses so Zed re-requests them

**Checkpoint**: Feature 001 suites (`detect`, `run`, `focus`) and consent cases (d) to (f) pass.

---

## Phase 5: User Story 3 - Declining keeps the extension idle, with a way back (Priority: P2)

**Goal**: "Not now", dismissal or an un-promptable client leave the workspace idle; the enable
action turns it on.

**Independent Test**: Fixture with `answer: 'Not now'`: no lenses, no runs, no second
prompt; `playwright.enableDiscovery` then enables everything.

### Tests for User Story 3

- [X] T012 [P] [US3] Extend `server/test/integration/consent.test.ts`: (g) fixture with `answer: 'Not now'`: status `declined`, `codeLens` `[]`, `runFile` yields a Warning containing "is disabled", then `didSave` on a test file produces no `workspace/codeLens/refresh` within 1000 ms and `prompts()` stays at 1; (h) after (g), `playwright.enableDiscovery` with the spec uri yields `workspace/codeLens/refresh`, status `enabled`, lenses present, and a `runAtCursor` passes; (i) dismissed prompt (`answer: null`) then `playwright.enableDiscovery` enables discovery and the marker file appears; (j) two roots with `answer: null` show two prompts, one per folder

### Implementation for User Story 3

- [X] T013 [US3] In `server/src/server.ts` confirm `enableDiscovery` works from every non-enabled state (`pending` with a still-open prompt, `declined`), that a late "Run discovery" click after `enableDiscovery` is a no-op, and that `removeWorkspace` discards any pending prompt callback safely (callback checks the workspace is still registered)

**Checkpoint**: All consent cases (a) to (j) pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add the `zed-only` row `Discovery consent (Workspace Trust substitute)` to `docs/parity.md` with primitive `lsp` and the note from `quickstart.md`, and update the note of the row `Playwright project detection and selection` to mention that discovery waits for consent
- [X] T015 [P] Document the question, the `Playwright: Enable test discovery` action and the per-session scope in `README.md` (new subsection "Before the first run: test discovery" under Usage, plus a line in "What it does today" and in the Manual testing table), and extend `specs/001-scaffold-run-at-cursor/quickstart.md` scenario 2 and `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md` (commands table, code actions table, notifications table, status request) with the additions from `contracts/discovery-consent.md`
- [X] T016 Run `cd server && npm run lint && npm test && npm run build`, then `cargo test` and `cargo build --release --target wasm32-wasip2` (unchanged Rust, still required by Constitution V), and record the commands with their final output lines in `specs/002-discovery-consent/verification.md`
- [X] T017 Run quickstart scenarios 1, 2, 4 to 10 as a dev extension in Zed (`npm run build` in `server/`, `PLAYWRIGHT_ZED_SERVER_ENTRY` exported, `editor: restart language server`), record each outcome in `specs/002-discovery-consent/verification.md`; this needs a developer at the editor

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 in parallel; nothing depends on earlier work.
- **Foundational (Phase 2)**: T003 after T002; T004 after T001, T002, T003; T005 after T004.
  Blocks all stories.
- **US1 (Phase 3)**: T006 may be written alongside T007 and T008; T007 before T008.
- **US2 (Phase 4)**: T009 and T010 in parallel after Phase 2; T011 after them.
- **US3 (Phase 5)**: T012 after Phase 2; T013 after T012.
- **Polish (Phase 6)**: T014 and T015 in parallel after all stories; T016 after them; T017 last.

### User Story Dependencies

- **US1** depends only on Phase 2.
- **US2** depends only on Phase 2; it mostly verifies that the gate is transparent once
  enabled.
- **US3** depends on T008 for the `playwright.enableDiscovery` dispatch.

### Parallel Opportunities

- Phase 1: T001 and T002.
- Phase 4: T009 and T010.
- Phase 6: T014 and T015.

---

## Implementation Strategy

### MVP First (Phase 2 plus User Story 1)

1. Complete Phase 1 and Phase 2: the gate exists and feature 001 tests still pass with the
   helper's default answer.
2. Complete Phase 3: proof that nothing executes before consent (SC-001).
3. **STOP and VALIDATE** with `consent.test.ts` cases (a) to (c).

### Incremental Delivery

1. US1: the security property.
2. US2: transparency once enabled.
3. US3: decline and the way back.
4. Polish: parity row, docs, verification record, manual scenarios.

---

## Notes

- The prompt may never be answered (Zed does not respond on dismissal); never await it on
  the discovery path. See research R1.
- `consent.test.ts` uses its own server per case because the decision is per session.
- Record every verification with the command and its output; skipped checks are stated as
  skipped.

## Status 2026-10-12

- T001 to T016: done; 88 server tests (9 files) and 7 Rust tests pass, WASM build green;
  see `verification.md`.
- T017: done on 2026-10-12, the owner ran quickstart scenarios 1, 2 and 4 to 10 in Zed
  1.23.2 and reported all passing. No open tasks remain for feature 002.
