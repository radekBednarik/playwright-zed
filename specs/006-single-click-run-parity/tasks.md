---

description: "Task list for Single-Click Run Parity Gaps"
---

# Tasks: Single-Click Run Parity Gaps

**Input**: Design documents from `/specs/006-single-click-run-parity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/run-feedback.md, quickstart.md

**Tests**: Included. Constitution Principle V requires unit tests for pure logic and
fixture-backed evidence; SC-002 to SC-006 are checked by integration tests plus the
quickstart scenarios in Zed.

**Organization**: Tasks are grouped by user story. All code lives in `server/`; the Rust
shell is untouched (plan: capabilities come from the server's initialize result).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 know which gaps the editor can close, US2 read the run's output inside
  the editor, US3 see which line the test is on, US4 see how long each step took
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; unit tests `server/test/unit/`, integration tests
  `server/test/integration/`
- Sample project: `fixtures/sample-project/`
- Docs: `README.md`, `server/README.md`, `docs/parity.md`
- Feature record: `specs/006-single-click-run-parity/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixture tests that exercise steps, helpers and printed output, and test-client
support for inlay hints, `window/showDocument` and the extended status request.

- [X] T001 [P] Add `fixtures/sample-project/tests/helpers/steps.ts` exporting `async function openSum(page: Page)` that wraps `page.setContent('<p id="sum">3</p>')` in `test.step('open sum', ...)` so a step is located in a helper file; add `fixtures/sample-project/tests/slow.spec.ts` with one test `'slow steps'` that calls `console.log('hello from the test')`, then runs three `test.step` calls named `'step one'`, `'step two'`, `'step three'` of about 2000 ms each (`page.waitForTimeout(2000)` inside each) and finally `await openSum(page)` with an `expect(...).toHaveText('3')`; keep the file under `testDir`, use `@playwright/test` imports only
- [X] T002 Extend `server/test/integration/helpers.ts`: add `SLOW = path.join(FIXTURE, 'tests/slow.spec.ts')` and `HELPER = path.join(FIXTURE, 'tests/helpers/steps.ts')`; advertise `textDocument.inlayHint: {}` and `workspace.inlayHint: { refreshSupport: true }` and `window.showDocument: { support: true }` in `initialize` unless `options.noShowDocument` or `options.noInlayHints` (new `StartOptions` booleans) is set; answer `workspace/inlayHint/refresh` with `null` and `window/showDocument` with `{ success: true }` while recording both in `client.requests`; add `async inlayHints(file: string): Promise<any[]>` that sends `textDocument/inlayHint` for the whole document (`range` lines 0 to 100000) and `async status(folder?: string)` that sends `playwright/status`
- [X] T003 [P] Update the discovery expectations that count fixture tests (search `server/test/integration/*.test.ts` and `server/test/unit/discovery.test.ts` for the current total of discovered specs and lens counts for `passing.spec.ts`) so the new `slow.spec.ts` test (1 spec, 2 projects) does not break them; run `cd server && npm run build && npm test -- --run integration/detect` to confirm

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the step reporter, the step-event channel from the Playwright process to the
server, the pure marks store, the run arguments and the new reporter helpers. After this
phase a run emits step events into memory and nothing is visible yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Extend `server/src/types.ts` per data-model.md: `export type StepEventType = 'testBegin' | 'stepBegin' | 'stepEnd' | 'testEnd'`; `export interface StepEvent { type: StepEventType; test: { file: string; line: number; column: number; title: string; project: string }; step?: { id: number; title: string; category: string; file: string; line: number; column: number }; duration?: number; status?: string; at: number }` (doc: "`step` absent for test events; only steps with a location are emitted; `duration` on `stepEnd` only; `status` on `testEnd` only"); `export interface FinishedMark { durationMs: number; count: number }`; `export interface StepMarks { runId: string | null; active: Map<string, Map<number, number>>; finished: Map<string, Map<number, FinishedMark>> }`; add `marks: StepMarks` and `outputFile: string | null` to `Workspace`
- [X] T005 [P] Write unit tests in `server/test/unit/step-reporter.test.ts` before implementing: with `PLAYWRIGHT_ZED_STEP_FILE` pointing into a temp dir, `new StepReporter()` called with fake `TestCase` (`location`, `title`, `parent.project()` returning `{ name: 'chromium' }`) and fake `TestStep` objects writes one JSON line per `onTestBegin`, `onStepBegin`, `onStepEnd` (with `duration`) and `onTestEnd` (with `result.status`); a step without `location` writes nothing; `printsToStdio()` returns `false`; with the variable unset nothing is written and no error is thrown; a write failure (file path is a directory) disables further writes silently; step ids increase per reporter instance and `stepEnd` reuses the id of its `stepBegin` (keyed by the `TestStep` object)
- [X] T006 Create `server/src/step-reporter.ts`: a dependency-free CommonJS reporter class (`module.exports = class StepReporter`, also `exports.default`) implementing `onTestBegin`, `onStepBegin`, `onStepEnd`, `onTestEnd`, `printsToStdio() { return false; }`, appending `StepEvent` lines with `fs.appendFileSync` to `process.env.PLAYWRIGHT_ZED_STEP_FILE`, `at: Date.now()`, project from `test.parent?.project?.()?.name ?? ''`, every call wrapped in try/catch that sets a `disabled` flag; no imports from other server modules; make T005 pass; confirm `npm run build` emits `server/dist/step-reporter.js` and that `server/package.json` `files` already covers `dist/`
- [X] T007 [P] Write unit tests in `server/test/unit/spawn.test.ts` (new) for `pollStepFile(file, onEvent, intervalMs)` from `server/src/spawn.ts`: lines appended to a temp file arrive in order as parsed `StepEvent` objects; a partial trailing line is held until completed; malformed lines are skipped; `stop()` performs a final read and then no further callbacks happen; a missing file yields no events and no error
- [X] T008 Extend `server/src/spawn.ts`: export `pollStepFile(file: string, onEvent: (event: StepEvent) => void, intervalMs = 200): { stop(): void }` per T007; add `stepFile?: string` and `onStepEvent?: (event: StepEvent) => void` to `SpawnOptions`; in `runPlaywright`, when both are set, add `PLAYWRIGHT_ZED_STEP_FILE: options.stepFile` to the child env and start the poller, stopping it (final read) in the `close` handler before `removeReportDir`; export `stepFilePath(reportFile: string, id: string)` returning `path.join(path.dirname(reportFile), \`steps-${id}.jsonl\`)`; make T007 pass
- [X] T009 [P] Write unit tests in `server/test/unit/commands.test.ts` for `buildRunArgs` with a `reporterPath` argument: `['test', target, '-c', configPath, '--reporter=list,json,/abs/step-reporter.js', ...projectArgs]` when given; `--reporter=list,json` unchanged when `reporterPath` is `null`; and for the new `resolveStepReporterPath(dir: string): { path: string | null; reason: string | null }`: returns the path when `step-reporter.js` exists in `dir`, `reason: 'file not found'` when missing, `reason: 'path contains a comma'` when the directory name has a comma
- [X] T010 Extend `server/src/commands.ts`: `buildRunArgs(location, config, projects = [], reporterPath: string | null = null)` appends `,${reporterPath}` to the `--reporter` value when given; add `resolveStepReporterPath(dir = __dirname)` per T009; add `COMMAND_SHOW_LAST_RUN_OUTPUT = 'playwright.showLastRunOutput'` to `ALL_COMMANDS`; make T009 pass
- [X] T011 [P] Write unit tests in `server/test/unit/marks.test.ts` before implementing `server/src/marks.ts`: `createMarks()` returns empty maps and `runId: null`; `applyEvent(marks, event)` follows data-model.md rules verbatim: "`stepBegin` increments `active[file][line]`", "`stepEnd` decrements it (deletes at 0) and sets `finished[file][line] = { durationMs, count + 1 }`, keeping the latest duration", "`testEnd` deletes every `active` entry whose step belongs to that test" (track step-to-test ownership by `test.file + line + title + project`), events without `step` other than `testEnd` are ignored; `applyEvent(marks, event, runId)` and `endRun(marks, runId)` are no-ops when `runId !== marks.runId` (current run id guard); `startRun(marks, runId)` clears both maps; `endRun(marks)` clears `active` only; `clearFile(marks, file)` removes both maps' entries for that file; `hintsFor(marks, file, lineLengths: number[], range)` returns `{ line, character: lineLengths[line], label }` 0-based entries only inside `range`, label `⌛ waiting…` for active lines (also when the line is finished too), `<n>ms` for finished lines with `count === 1` (duration rounded with `Math.round`), `<n>ms (ran <k>×)` for `count > 1`, and skips lines beyond `lineLengths.length`
- [X] T012 Create `server/src/marks.ts` with the pure functions of T011, typed with `StepMarks`, `StepEvent`, `FinishedMark` from `types.ts`; export `LABEL_WAITING = '⌛ waiting…'`; make T011 pass
- [X] T013 Extend `server/src/reporting.ts`: add `refreshInlayHints(): void` that coalesces calls into one `workspace/inlayHint/refresh` request per 100 ms (`setTimeout`, errors ignored like `refreshCodeLenses`); add `async showDocument(uri: string): Promise<boolean>` sending `window/showDocument` with `{ uri, takeFocus: true }` and returning `result.success`, `false` on error; export both from the `Reporter` class
- [X] T014 Extend `server/src/runner.ts`: `RunManager.start(request, options?: { reporterPath: string | null; onStepEvent?: (event: StepEvent) => void })` passes `buildRunArgs(..., options.reporterPath)`, computes `stepFile = stepFilePath(reportFile, request.id)` and forwards `stepFile` and `onStepEvent` to the spawner only when `reporterPath` is set; extend `server/test/unit/runner.test.ts` to assert the spawner receives the reporter in `args` and the `stepFile` under the report's directory when a path is given, and neither when it is `null`

**Checkpoint**: `cd server && npm run lint && npm run build && npm test` green; a manual run
of `node node_modules/@playwright/test/cli.js test tests/slow.spec.ts --reporter=list,json,$PWD/../../server/dist/step-reporter.js` from `fixtures/sample-project` with `PLAYWRIGHT_ZED_STEP_FILE=/tmp/steps.jsonl` set produces step lines for the four steps, including the helper file's step

---

## Phase 3: User Story 1 - Know which gaps the editor can close (Priority: P1) 🎯 MVP

**Goal**: a definitive, checkable verdict per gap with evidence and editor version (FR-001,
FR-002), ready to be confirmed by demonstrations in later phases.

**Independent Test**: `research.md` has one verdict per gap with source references at a
stated Zed and Playwright version; `verification.md` has a verdict table whose
"Demonstration" cells will be filled by quickstart scenarios 1, 2 and 4.

- [X] T015 [US1] Create `specs/006-single-click-run-parity/verification.md` with a "Gap verdicts" table (columns: gap, verdict, surface, source evidence (copied from research.md "Verdicts"), demonstration (quickstart scenario number, result, date), editor version) and empty sections "Automated gate" and "Manual scenarios" for later phases
- [X] T016 [US1] Re-run the two evidence checks in a throwaway shell and record their outcomes in `verification.md`: (a) the Playwright reporter path resolution (`grep -n "function resolveReporter" -A7 fixtures/sample-project/node_modules/playwright/lib/cli/testActions.js`), (b) the Phase 2 checkpoint command with `PLAYWRIGHT_ZED_STEP_FILE`; cite the Playwright version from `fixtures/sample-project/node_modules/@playwright/test/package.json`

**Checkpoint**: verdicts recorded with reproducible evidence; a reader can confirm them
without the author

---

## Phase 4: User Story 2 - Read the run's output inside the editor (Priority: P2)

**Goal**: the full output of the latest click-started run opens in an editor buffer from
**Playwright: Show last run output** (FR-008, FR-009, FR-010).

**Independent Test**: integration test runs `passing.spec.ts`, invokes the action's command,
observes a `window/showDocument` request whose file matches the contract (header, list
reporter lines); quickstart scenario 4 in Zed.

- [X] T017 [P] [US2] Write unit tests in `server/test/unit/output.test.ts` before implementing `server/src/output.ts`: `outputFilePath(stateDir, rootPath)` is `<stateDir>/runs/<first 16 hex of sha1(rootPath)>.log`; `formatRunLog(request, result | null, finishedAt | null)` produces the contract's header lines in order (`# Playwright run <id> (<trigger>, <target>)`, `# projects: ...`, `# command: ...`, `# cwd: ...`, `# status: running|passed|failed|error|cancelled`, `# started: <ISO>   finished: <ISO or ->`), a blank line, stdout, then a blank line and stderr when non-empty; a body over `OUTPUT_CAP_BYTES = 10 * 1024 * 1024` is cut at the cap and ends with `[output truncated]`; `writeRunLog(file, text)` creates `runs/` with mode 0o700, writes atomically (temp file plus rename) with mode 0o600 and overwrites an existing file
- [X] T018 [US2] Create `server/src/output.ts` with `outputFilePath`, `formatRunLog`, `writeRunLog`, `OUTPUT_CAP_BYTES` per T017, using `stateDir()` from `server/src/store.ts` in a convenience `runLogFor(rootPath)`; make T017 pass
- [X] T019 [US2] Extend `server/src/server.ts`: read `params.capabilities.window?.showDocument?.support === true` in `onInitialize` into `clientShowsDocuments`; in `startRun`, before `manager.start`, set `ws.outputFile = runLogFor(ws.rootPath)` and write the header log with `status: running` (log and continue on write errors); after the run, rewrite the log with the final status and body and rewrite the log only when `ws.lastRun?.id === request.id` and log `playwright: run <id> output written to <path>`, otherwise log `playwright: run <id> superseded, output not written`; or `playwright: run <id> output not offered (client has no showDocument support)` when `clientShowsDocuments` is false; initialise `outputFile: null` in `addWorkspace`
- [X] T020 [US2] Extend `server/src/server.ts`: in `onCodeAction`, after the re-run action, when `ws?.lastRun && ws.outputFile && clientShowsDocuments` add `action('Playwright: Show last run output', COMMAND_SHOW_LAST_RUN_OUTPUT, [{ uri }])`; in `onExecuteCommand` handle it by resolving the workspace (same rule as `rerunLast`: the given uri's workspace, else the workspace with the most recent `lastRun`), calling `reporter.showDocument(pathToFileURL(ws.outputFile).toString())`, and on `false` showing a Warning `Playwright: could not open the run output; it is at <path>`; add `outputFile` to the `playwright/status` reply
- [X] T021 [US2] Write `server/test/integration/feedback.test.ts` (new) scenarios for US2 using `TestClient` on `FIXTURE`: (a) after running `passing.spec.ts` at the cursor, code actions include `Playwright: Show last run output`, executing it produces a `window/showDocument` request whose `uri` is a file under `client.stateDir/runs/` and `takeFocus` is true, and that file contains `# status: passed`, the `# command:` line and the list reporter line for `adds numbers`; (b) a cancelled run (start `slow.spec.ts`, then `passing.spec.ts`) leaves the file for the second run only, with `# status: passed` and no `slow steps` lines, and the file is not overwritten by the first run's late exit (re-read it after the first run's cancellation Warning arrives and assert `# status: passed` is still there); (c) with `noShowDocument: true` the action is absent, the file still exists and the log contains `output not offered`; (d) a failing run's file contains the failure message text; (e) status reply carries `outputFile`

**Checkpoint**: US2 complete; quickstart scenarios 4, 5, 6 pass in Zed (record in
`verification.md`)

---

## Phase 5: User Story 3 - See which line the test is on (Priority: P3)

**Goal**: while a run is in progress, each executing step's line in any open file shows
`⌛ waiting…` as an inlay hint and the mark clears when the step, test or run ends
(FR-004, FR-005, FR-010, FR-011).

**Independent Test**: integration test polls `playwright/status` and `textDocument/inlayHint`
during a `slow.spec.ts` run and sees the active line move and vanish; quickstart scenarios
1, 7, 8, 10 in Zed.

- [X] T022 [US3] Extend `server/src/server.ts`: declare `inlayHintProvider: { resolveProvider: false }` in `onInitialize`; initialise `marks: createMarks()` in `addWorkspace`; read `params.capabilities.textDocument?.inlayHint !== undefined` in `onInitialize` into `clientRequestsInlayHints` and when false log once `playwright: client does not request inlay hints; step marks will not be shown`; the `onStepEvent` callback and the post-run `endRun` pass `request.id` so a superseded run changes nothing; compute `stepReporter = resolveStepReporterPath()` once at startup and log `playwright: step reporter unavailable (<reason>)` when `path` is null; in `startRun` call `startRun(ws.marks, request.id)` and `reporter.refreshInlayHints()` before the run, pass `{ reporterPath: stepReporter.path, onStepEvent: (e) => { applyEvent(ws.marks, e); reporter.refreshInlayHints(); } }` to `manager.start`, and after the run (every status, including cancelled and error) call `endRun(ws.marks)` and refresh once more
- [X] T023 [US3] Add `connection.languages.inlayHint.on(...)` in `server/src/server.ts`: resolve the document's workspace with `workspaceForFile`, return `[]` when none or when `documents.get(uri)` is undefined, else build `lineLengths` from the document text and return `hintsFor(ws.marks, file, lineLengths, params.range)` mapped to `InlayHint { position: { line, character }, label, paddingLeft: true }`; never throw
- [X] T024 [US3] Extend the `playwright/status` reply in `server/src/server.ts` with `marks: { active: [{ file, line, count }], finished: [{ file, line, durationMs, count }] }` for the workspace, as `contracts/run-feedback.md` section 7
- [X] T025 [US3] Add US3 scenarios to `server/test/integration/feedback.test.ts`: (a) start `slow.spec.ts` at its test line without awaiting completion, open `SLOW` and `HELPER`, poll `client.status()` every 250 ms until `marks.active` contains the `step one` line of `slow.spec.ts` (timeout 60 s), then `client.inlayHints(SLOW)` contains a hint with label `⌛ waiting…` at that line's end, and at least one `workspace/inlayHint/refresh` request was recorded; starting `passing.spec.ts` while `slow.spec.ts` runs leaves `status().marks` with the newer run's id and no `slow.spec.ts` active line after the cancellation Warning; later the active line becomes the helper's step line in `HELPER`; after the run's Info notification `marks.active` is empty and no hint has the waiting label; (b) `inlayHints` for a file with no marks returns `[]`; (c) with `noInlayHints: true` the run still ends with the usual Info notification and no error
- [X] T026 [US3] Add the command line assertion to `server/test/integration/run.test.ts`: the `playwright: run <id> command:` log line of a run ends with `--reporter=list,json,<path ending in step-reporter.js>` followed by the project arguments, and nothing else changed versus the previous expectation

**Checkpoint**: US3 complete; quickstart scenarios 1, 7, 8, 10 pass in Zed (record in
`verification.md`)

---

## Phase 6: User Story 4 - See how long each step took (Priority: P3)

**Goal**: after a run, step lines show `<n>ms` or `<n>ms (ran <k>×)`; marks go away on the
next run start and on the first edit of the file, and come back when an unedited file is
reopened (FR-006, FR-007).

**Independent Test**: integration test checks hints after a `slow.spec.ts` run in one and in
two projects, after a `didChange`, and after close plus reopen; quickstart scenarios 2, 3, 9.

- [X] T027 [US4] Extend `documents.onDidChangeContent` in `server/src/server.ts`: in the branch that marks the document dirty (first change after open or save), call `clearFile(ws.marks, file)` for the file's workspace and `reporter.refreshInlayHints()`; leave `onDidClose` and `onDidOpen` unchanged so marks survive a reopen
- [X] T028 [US4] Add US4 scenarios to `server/test/integration/feedback.test.ts`: (a) after a completed `slow.spec.ts` run with the default single project, `inlayHints(SLOW)` has `<n>ms` labels (regex `^\d+ms$`) at the three step lines and `inlayHints(HELPER)` has one at the helper's step line, and `status().marks.finished` lists them with `count: 1`; (b) toggle `mobile` on (feature 005 command) and run again: the labels match `^\d+ms \(ran 2×\)$`; (c) `client.change(SLOW, 2)` empties `inlayHints(SLOW)` while `HELPER` keeps its label; (d) close and reopen `HELPER` without changes: label still returned; (e) starting a new run empties `marks.finished` before the first `stepEnd` arrives (assert through `status()` right after the `$/progress` begin notification)
- [X] T029 [P] [US4] Add unit coverage in `server/test/unit/marks.test.ts` for the duration edge rules: two `stepEnd` events on one line keep the latest duration and `count: 2`; a line that is active and finished yields the waiting label; `clearFile` on an unknown file is a no-op

**Checkpoint**: all four stories complete; full vitest suite green

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: docs, parity row, evidence record, gate.

- [X] T030 [P] Update `README.md`: next to the `"code_lens": "on"` paragraph add an "Inlay hints" paragraph with the settings snippet `"inlay_hints": { "enabled": true }` and what appears (`⌛ waiting…` while a step runs, `<n>ms` afterwards, cleared on edit or next run); add **Playwright: Show last run output** to the command table with the output file location (`<state dir>/runs/`); add a short "Differences from the VS Code extension" note (text marker instead of a line background, buffer instead of the Test Results panel, both opt-in); keep the tasks recipe section as the terminal alternative
- [X] T031 [P] Update `server/README.md`: document the `step-reporter.js` entry (what it is, that Playwright loads it from the server package, `PLAYWRIGHT_ZED_STEP_FILE`), the new capability `inlayHintProvider`, the `window/showDocument` use, the `runs/` directory under the state directory and the 10 MB cap
- [X] T032 [P] Update `docs/parity.md`: move "Run tests with a single click" to `full` with the research R6 note (inlay hints need `inlay_hints.enabled`; text marker instead of upstream's line background because Zed has no decoration API; output as an editor buffer via `window/showDocument` from the new action; upstream shows it in the Test Results panel); cross-reference the "Terminal output via tasks recipe" row from the note and vice versa
- [X] T033 [P] Append a "Feature 006 delta" section to `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md` pointing to `specs/006-single-click-run-parity/contracts/run-feedback.md` for the new capability, request, refresh, action and command
- [X] T034 Run the automated gate from `quickstart.md` (`cargo test && cargo build --release --target wasm32-wasip2`; `cd server && npm run lint && npm run build && npm test`) and record commands, counts and outcomes in `specs/006-single-click-run-parity/verification.md` "Automated gate"
- [X] T035 Run quickstart scenarios 1 to 10 in Zed with the dev extension and `PLAYWRIGHT_ZED_SERVER_ENTRY` set, scenarios 1, 2 and 4 three times each with the counts recorded; record each with the Zed version and outcome in `verification.md` "Manual scenarios", and fill the "Demonstration" cells of the gap verdict table (scenario 1 for the executing mark, 2 for durations, 4 for output)
- [X] T036 Update `.claude/memory/playwright-zed-project.md`: feature 006 state (implemented, verified, awaiting PR), the parity row change, the new opt-in setting and the release note (next lockstep version 0.6.0, MINOR, owner publishes the server first)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001 and T003 parallel, T002 independent of both
- **Foundational (Phase 2)**: needs Phase 1 (T003 keeps the suite green with the new
  fixture); T004 first (types), then T005/T007/T009/T011 (tests, parallel), then
  T006/T008/T010/T012 (implementations, parallel per module), then T013 and T014
- **US1 (Phase 3)**: needs the Phase 2 checkpoint for T016's demonstration
- **US2 (Phase 4)**: needs Phase 2 (runner, reporting, commands); independent of US3/US4
- **US3 (Phase 5)**: needs Phase 2 (marks, step channel); independent of US2
- **US4 (Phase 6)**: needs US3's T022/T023 (hint provider and lifecycle)
- **Polish (Phase 7)**: T030 to T033 parallel after all stories; T034 before T035; T036 last

### User Story Dependencies

- US1 has no code dependency; its demonstration cells are completed by T035
- US2 and US3 are independent and may be built in either order or in parallel (different
  files except `server.ts`, where each touches separate functions)
- US4 builds on US3

### Parallel Opportunities

- Phase 1: T001 and T003 together, T002 in parallel on the helpers file
- Phase 2: T005, T007, T009, T011 (four test files) together; then T006, T008, T010, T012
  together
- Phase 4 and Phase 5: T017 with T022/T023 in parallel; T021 and T025 extend the same
  integration file and are sequential
- Phase 7: T030, T031, T032, T033 together

---

## Implementation Strategy

### MVP First (User Story 1 and the Phase 2 checkpoint)

1. Phase 1 and Phase 2: the fixture, the reporter and the step channel are built and proven
   by the checkpoint command.
2. Phase 3: the verdict record exists with reproducible evidence. This alone answers the
   request.

### Incremental Delivery

3. Phase 4 (output): most useful day to day, no dependency on inlay hints.
4. Phase 5 (executing mark) then Phase 6 (durations): share the hint provider.
5. Phase 7: docs, parity row, gate, Zed verification, memory. The release (0.6.0, lockstep,
   server first) is a separate owner decision after merge.

---

## Phase 8: Convergence

- [X] T037 Add the per-run log line `playwright: run <id> step reporter unavailable (<reason>)` in `startRun` of `server/src/server.ts` when `stepReporter.path` is null (keep the one-time startup line), and assert it in a `feedback.test.ts` scenario that starts a client with a missing `dist/step-reporter.js` (copy `server/dist` to a temp dir without the file and point the client's `BIN` there, or skip with a note if the harness cannot) per contracts/run-feedback.md section 8 (partial)
- [X] T038 Document the two additions the implementation made beyond the contract in `specs/006-single-click-run-parity/contracts/run-feedback.md`: the `# error: <first line>` header line of the run log for runs that failed to start (section 6, serves FR-008) and the `marks.runId` field of the `playwright/status` reply (section 7, used by the current run id guard tests) per contracts/run-feedback.md sections 6 and 7 (unrequested)
