---

description: "Task list for Remember Discovery Consent per Folder"
---

# Tasks: Remember Discovery Consent per Folder

**Input**: Design documents from `/specs/003-remember-discovery-consent/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/editor-trust.md,
quickstart.md

**Tests**: Included. Constitution Principle V requires tests for pure logic and fixture-backed
evidence, and SC-002 and SC-005 are stated as automated checks.

**Organization**: Tasks are grouped by user story. All code lives in the language server
(`server/`); the Rust shell is untouched (plan, Structure Decision).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 trust a project once, US2 a repository cannot trust itself, US3 editors
  without a trust gate keep the question
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; unit tests in `server/test/unit/`, integration tests in
  `server/test/integration/`
- Docs: `README.md`, `server/README.md`, `docs/parity.md`,
  `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness support for editor identification and the marker project.

- [X] T001 Extend `server/test/integration/helpers.ts`: add `clientInfo?: { name: string; version?: string }` and `rootUriOnly?: boolean` to `StartOptions`; in `TestClient.start`, include `clientInfo` in the `initialize` params only when given, and when `rootUriOnly` is `true` omit `workspaceFolders` from `initialize` (send only `rootUri`); keep every existing default so feature 001/002 tests send no `clientInfo` and still receive `workspaceFolders`
- [X] T002 Move the marker project helpers `configSource(withMarker)` and `tempProject(withMarker)` (with the `TempProject` type and the `PW_ZED_MARKER` handling) from `server/test/integration/consent.test.ts` into `server/test/integration/helpers.ts` as exports, and import them in `consent.test.ts`; no behaviour change, `npm test` stays green

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The gate rule and the workspace fields every story relies on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Write unit tests in `server/test/unit/trust.test.ts` for `editorHasTrustGate(clientInfo)` before implementing it: `true` for `{ name: 'Zed', version: '0.218.0' }`, `'0.218.5'`, `'0.219.4'`, `'1.23.3'`, `'1.23.3+stable.42'`, `'0.218.0-pre'`, and for the names `'Zed Preview'`, `'Zed Nightly'`, `'Zed Dev'` at `'1.23.3'`; `false` for `'0.217.4'`, `'0.9.0'`, missing `version`, unparsable `version` (`'abc'`, `''`), `undefined` clientInfo, and other names (`'Visual Studio Code'`, `'zed'`, `'Zed Something'`, `'Neovim'`) at `'1.23.3'`
- [X] T004 Create `server/src/trust.ts` exporting `MIN_TRUST_GATE_VERSION = '0.218.0'` and `editorHasTrustGate(clientInfo?: { name: string; version?: string }): boolean` per data-model.md: "`true` iff `name` is `Zed`, `Zed Preview`, `Zed Nightly` or `Zed Dev` and the leading `major.minor.patch` of `version` is `>= 0.218.0`"; parse with `/^(\d+)\.(\d+)\.(\d+)/` so build metadata and pre-release suffixes are ignored; return `false` when `clientInfo`, `version` or the match is missing; make T003 pass
- [X] T005 [P] Extend `Workspace` in `server/src/types.ts` with `discoverySource: DiscoverySource` (export `type DiscoverySource = 'editor-trust' | 'answer' | null`; doc comment: "`editor-trust` when created `enabled` because of the editor trust gate; `answer` after "Run discovery" or `playwright.enableDiscovery`; `null` while `pending` or `declined`") and `fromWorkspaceFolders: boolean` (doc comment: "`true` for folders from `initialize.workspaceFolders` or `didChangeWorkspaceFolders`, `false` for the `rootUri` fallback")
- [X] T006 Wire the fields in `server/src/server.ts`: add a module-level `let editorTrustGate = false` and `let clientLabel = 'the editor'`; in `onInitialize` set `editorTrustGate = editorHasTrustGate(params.clientInfo)` and `clientLabel` to `"<name> <version>"` when `clientInfo` is present; replace `pendingFolders: WorkspaceFolder[]` with entries carrying `fromWorkspaceFolders` (`true` for `params.workspaceFolders`, `false` for the `rootUri` fallback); give `addWorkspace(folder, fromWorkspaceFolders)` the flag (`true` for `onDidChangeWorkspaceFolders` additions) and initialise `discoverySource: null`, `fromWorkspaceFolders`; in `enableDiscovery` set `ws.discoverySource = 'answer'` together with `discovery = 'enabled'`; extend the `playwright/status` entries with `discoverySource` and `editorTrustGate`

**Checkpoint**: `npm run lint && npm test && npm run build` in `server/` pass with no behaviour
change yet (gate computed but not used).

---

## Phase 3: User Story 1 - Trust a project once (Priority: P1) 🎯 MVP

**Goal**: Started by Zed 0.218+, the server discovers every workspace folder without asking.

**Independent Test**: `TestClient.start(fixture, { clientInfo: { name: 'Zed', version: '1.23.3' } })`
sees no `window/showMessageRequest`, lenses appear, status reports `discoverySource:
'editor-trust'`; in Zed, quickstart scenarios 3, 4 and 6.

### Tests for User Story 1

- [X] T007 [P] [US1] Create `server/test/integration/trust.test.ts`, describe `'trusted by Zed (US1)'`: (a) with `clientInfo { name: 'Zed', version: '1.23.3' }` on a `tempProject(true)`, `waitForDiscovery()` resolves, `client.prompts()` is empty, the marker file exists, `textDocument/codeLens` on the spec file returns run lenses, and `playwright/status` reports `discovery: 'enabled'`, `discoverySource: 'editor-trust'`, `editorTrustGate: true`; (b) same with `name: 'Zed Preview'`; (c) two root folders both discover without any prompt; (d) a `window/logMessage` contains `playwright: Zed trusts <folder path>; test discovery enabled without asking`; (e) the code actions for the spec file do not include `Playwright: Enable test discovery`

### Implementation for User Story 1

- [X] T008 [US1] In `addWorkspace` in `server/src/server.ts`, when `editorTrustGate && fromWorkspaceFolders`, create the workspace with `discovery: 'enabled'` and `discoverySource: 'editor-trust'` and log via `reporter.info` exactly once per folder: `playwright: Zed trusts <rootPath>; test discovery enabled without asking (<clientLabel> starts language servers only in trusted folders)`; rely on the existing `discoverWorkspace` branch that calls `discoverEnabled` for `enabled` workspaces after config location and version gating, so no Playwright process starts for unsupported versions; make T007 pass

**Checkpoint**: US1 delivers the request on its own: with a Zed `clientInfo`, no question,
discovery runs.

---

## Phase 4: User Story 2 - A repository cannot trust itself (Priority: P1)

**Goal**: Nothing from the workspace decides trust; folders that only reach the server as a
fallback root keep the question.

**Independent Test**: integration tests below; quickstart scenario 2 (untrusted folder with a
`.zed/settings.json` that tries `trust_all_worktrees`) in Zed.

### Tests for User Story 2

- [X] T009 [P] [US2] In `server/test/integration/trust.test.ts`, describe `'the workspace cannot grant trust (US2)'`: (f) with Zed `1.23.3` `clientInfo` and `rootUriOnly: true`, the question is sent once, the marker file does not exist before the answer (start with `answer: null`), and status reports `discovery: 'pending'` and `discoverySource: null`, and a `window/logMessage` contains `the folder was not reported as a workspace folder`; (g) with `clientInfo { name: 'Zed', version: '0.217.4' }` (no gate), a temp project that also contains `.zed/settings.json` `{ "session": { "trust_all_worktrees": true } }` and `.vscode/settings.json` `{ "security.workspace.trust.enabled": false }` still gets exactly one question, the marker stays absent with `answer: null`, and status reports `editorTrustGate: false`; this guards against a future change that reads workspace settings, while the Zed-side behaviour of FR-004 is verified manually in quickstart scenario 2

### Implementation for User Story 2

- [X] T010 [US2] Confirm in `server/src/server.ts` that the gate depends only on `editorTrustGate` and `fromWorkspaceFolders` (no read of workspace files or settings), and that the `rootUri` fallback passes `fromWorkspaceFolders = false`; add a one-line comment at the gate check citing `specs/003-remember-discovery-consent/research.md` R2/R3 (Zed starts this server only in trusted folders); make T009 pass; also assert in `server/test/unit/trust.test.ts` that `editorHasTrustGate` takes only `clientInfo` (its signature has no path or settings parameter), so a workspace cannot influence it

**Checkpoint**: the fallback root never skips the question; workspace content cannot change
the outcome.

---

## Phase 5: User Story 3 - Editors without a trust gate keep the question (Priority: P2)

**Goal**: Feature 002 behaviour, unchanged, for every other client.

**Independent Test**: `npm test` passes `consent.test.ts` unchanged; the new old-Zed tests
below pass.

### Tests for User Story 3

- [X] T011 [P] [US3] In `server/test/integration/trust.test.ts`, describe `'no trust gate, feature 002 applies (US3)'`: (h) with `clientInfo { name: 'Zed', version: '0.217.4' }` and `answer: null`, one question is sent, the marker does not exist, lenses are `[]`, status reports `editorTrustGate: false`, `discoverySource: null`; (i) with `{ name: 'Visual Studio Code', version: '1.99.0' }` the question is sent; (j) after answering `'Run discovery'` with no `clientInfo`, status reports `discoverySource: 'answer'`; (k) a `window/logMessage` contains `playwright: asking before discovery in <folder path>;` and the client label

### Implementation for User Story 3

- [X] T012 [US3] In `askForDiscovery` in `server/src/server.ts`, before sending the question, log via `reporter.info` one of the two lines from `contracts/editor-trust.md`: when `editorTrustGate` is false, `playwright: asking before discovery in <rootPath>; <clientLabel> is not known to gate language servers on folder trust`; when `editorTrustGate` is true (fallback root), `playwright: asking before discovery in <rootPath>; the folder was not reported as a workspace folder, so Zed's trust cannot be assumed for it`; no other change to the feature 002 path; make T011 and T009(f) pass and keep `server/test/integration/consent.test.ts` green without edits beyond T002

**Checkpoint**: all three stories pass; feature 002 tests unchanged (SC-005).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Update the row `Discovery consent (Workspace Trust substitute)` in `docs/parity.md`: on Zed 0.218+ the gate is Zed worktree trust (Restricted Mode), like VS Code Workspace Trust upstream; the server's per-session question remains the fallback for older Zed and other clients; correct the statement that Zed has no equivalent; adjust the `Playwright project detection and selection` note accordingly
- [X] T014 [P] Update `README.md` (subsection "Before the first run: test discovery", "What it does today", Manual testing table) and `server/README.md`: on Zed 0.218+ trusting the folder in Zed is the only question; revoke with `workspace: clear trusted worktrees` (clears all trusted folders and restarts Zed); `session.trust_all_worktrees: true` in user settings makes discovery run in every folder without asking, as turning off Workspace Trust does in VS Code; older Zed and other editors still get the per-session question; state that inside a dev container Zed applies no worktree trust, so discovery runs without a question once the developer has chosen "Open in Container" (research R8)
- [X] T015 [P] Extend `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md` (initialize input, notifications table, status request) with the additions from `specs/003-remember-discovery-consent/contracts/editor-trust.md`
- [X] T016 Run `cd server && npm run lint && npm test && npm run build`, then `cargo test` and `cargo build --release --target wasm32-wasip2` (unchanged Rust, still required by Constitution V), and record the commands with their final output lines in `specs/003-remember-discovery-consent/verification.md`
- [X] T017 Run quickstart scenarios 2 to 6 from `specs/003-remember-discovery-consent/quickstart.md` in Zed as a dev extension with `PLAYWRIGHT_ZED_SERVER_ENTRY` exported, record each outcome (SC-001 needs 10 consecutive restarts without a question; record the count) in `specs/003-remember-discovery-consent/verification.md`, mark scenario 7 skipped if no other editor is used; this needs a developer at the editor
- [X] T018 Update `.claude/memory/playwright-zed-project.md`: feature 003 state, Zed worktree trust as the primary gate since 0.218, and that the next npm release carries it together with the Node 22 requirement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 touch the same helper file, so T001 before T002.
- **Foundational (Phase 2)**: T003 and T005 in parallel; T004 after T003; T006 after T004 and
  T005. Blocks all stories.
- **US1 (Phase 3)**: T007 after Phase 1 and 2; T008 after T007 (test first).
- **US2 (Phase 4)**: T009 after Phase 1 and 2; T010 after T008 and T009.
- **US3 (Phase 5)**: T011 after Phase 1 and 2; T012 after T011.
- **Polish (Phase 6)**: T013, T014, T015 in parallel after all stories; T016 after them; T017
  after T016; T018 last.

### User Story Dependencies

- **US1** depends only on Phase 2.
- **US2** reuses the gate check from T008; its tests can be written in parallel with US1.
- **US3** depends only on Phase 2; it adds one log line to the untouched feature 002 path.

### Within Each User Story

- Tests are written first and must fail before the implementation task.
- T007, T009 and T011 all edit `server/test/integration/trust.test.ts`; they are marked [P]
  relative to `server/src/*.ts` work but must be merged into the same file one after another.

### Parallel Opportunities

- Phase 2: T003 (unit test) and T005 (types).
- Story tests: T007, T009, T011 can be drafted while T008 is implemented.
- Phase 6: T013, T014, T015.

---

## Parallel Example: User Story 1

```text
Task: "T007 [US1] trust.test.ts describe 'trusted by Zed (US1)'"
Task (after T007 is red): "T008 [US1] gate in addWorkspace in server/src/server.ts"
Meanwhile: "T009 [US2] trust.test.ts fallback root tests" and "T011 [US3] old-Zed tests"
```

---

## Implementation Strategy

### MVP First (Phase 2 plus User Story 1)

1. Phase 1 (T001, T002) and Phase 2 (T003 to T006).
2. US1 (T007, T008): Zed 0.218+ no longer asks. This alone answers the request.
3. Stop and validate with `npm test` and quickstart scenarios 3 and 6.

### Incremental Delivery

1. US2 (T009, T010) hardens the fallback-root case; required before release because it is a
   security property.
2. US3 (T011, T012) adds the explanatory log line and proves the fallback.
3. Polish (T013 to T018): docs, verification record, memory.

Release (npm publish, pin bump, tag) is not part of these tasks and needs the owner's explicit
OK.
