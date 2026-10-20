---

description: "Task list for Show Trace Viewer"
---

# Tasks: Show Trace Viewer

**Input**: Design documents from `/specs/008-show-trace-viewer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/trace-viewer.md, quickstart.md

**Tests**: Included. Constitution Principle V requires unit tests for pure logic and
fixture-backed evidence; SC-001 to SC-006 are checked by unit and integration tests plus the
quickstart scenarios in Zed.

**Organization**: Tasks are grouped by user story. All code lives in `server/`; the Rust
shell is untouched (plan: the settings path is generic since feature 005).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 see the trace of the test I just ran, US2 open the trace of one test
  after running several, US3 turn it off and keep my choice
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; unit tests `server/test/unit/`, integration tests
  `server/test/integration/`
- Sample project: `fixtures/sample-project/` (unchanged by this feature)
- Docs: `README.md`, `server/README.md`, `docs/parity.md`; CI `.github/workflows/ci.yml`
- Feature record: `specs/008-show-trace-viewer/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline evidence, test-client support for the new status fields and the
display requirement, CI able to open the viewer window.

- [X] T001 Record the baseline in `specs/008-show-trace-viewer/verification.md` (new file,
      same header layout as `specs/007-attach-open-spec-files/verification.md`): run
      `cargo test && cargo build --release --target wasm32-wasip2` and
      `cd server && npm run lint && npm run build && npm test` on the branch and note the
      commands, the counts (expected 8 Rust, 208 vitest in 19 files) and the date.
- [X] T002 [P] Extend `server/test/integration/helpers.ts`: type the `playwright/status`
      answer with `traceViewer: { enabled: boolean; source: 'remembered' | 'settings' | 'default' }`,
      `traces: { runId: string; records: { file: string; line: number; title: string; project: string | null; path: string }[] } | null`
      and `traceViewers: { configPath: string; pid: number; currentPath: string | null; startedAt: string }[]`
      per contract section 9; add `export function hasDisplay(): boolean` (true when
      `DISPLAY` or `WAYLAND_DISPLAY` is set and non-empty) and a `waitForStatus(predicate,
      timeoutMs)` poller if none exists yet.
- [X] T003 [P] In `.github/workflows/ci.yml`, run the server test step under
      `xvfb-run -a npm test` and add `sudo apt-get install -y xvfb` guarded by
      `command -v xvfb-run || ...` before it, so the real-viewer integration test has a
      display on the Ubuntu runners (research R6).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, the preference store and resolution, the viewer session manager, the
run argument, report extraction and the reporter fields. No user story works without them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add to `server/src/types.ts`: `TracePreference { enabled: boolean; source: 'remembered' | 'settings' | 'default'; updatedAt: string | null }`
      (`updatedAt` set only for `remembered`), `TraceRecord { file: string; line: number; column: number; title: string; project: string | null; path: string; finishedAt: number }`
      (`project` null when the config has fewer than two projects, `finishedAt` =
      `startTime + duration` in epoch milliseconds), `StepEvent.traceLive?: string` (on
      `testBegin`) and `StepEvent.trace?: string` (on `testEnd`), `RunRequest.trace: boolean`,
      `RunResult.traces: TraceRecord[]`, `Workspace.traces: { runId: string; records: TraceRecord[] } | null`.
- [X] T005 [P] In `server/src/store.ts` add `TRACE_STORE_FILE = 'trace-viewer.json'`,
      `readTracePreference(dir): { showTrace: boolean; updatedAt: string } | null`
      (missing, unreadable, malformed, symlinked, `version !== 1`, non-boolean `showTrace`
      or non-string `updatedAt` all read as `null`) and
      `writeTracePreference(dir, showTrace, now = new Date())` writing
      `{ "version": 1, "showTrace": <bool>, "updatedAt": "<ISO>" }` through a temp file in
      the same directory and a rename, directory `0700`, file `0600`; unit tests in
      `server/test/unit/store.test.ts` (temp dir: round trip, each invalid shape, symlink).
- [X] T006 [P] Create `server/src/trace.ts` with the pure parts and unit tests in
      `server/test/unit/trace.test.ts`: `resolveTracePreference(remembered, settingsValue)`
      per data-model (remembered wins, else boolean setting, else `{ enabled: false, source: 'default' }`);
      `parseShowTraceSetting(value): { value: boolean | null; invalid: boolean }`
      (`undefined`/`null` absent, `true`/`false` valid, anything else invalid);
      `extractTraces(report, multiProject): TraceRecord[]` walking `suites[].specs[].tests[].results[].attachments`
      for `name === 'trace'` with a string `path`, `file` = `rootDir` joined with the spec
      file, `project` only when `multiProject`; `latestTraceFor(records, file, line)` returning
      the record with the greatest `finishedAt` or null.
- [X] T007 In `server/src/trace.ts` add `ViewerSessions` (injectable spawn function, default
      `node:child_process.spawn`): `show(config, rootPath, path, hooks)` starts
      `node <config.playwrightCli> show-trace --stdin` on first use with `cwd: rootPath`,
      `env: { ...process.env, FORCE_COLOR: '0' }`, `stdio: ['pipe', 'pipe', 'pipe']`, not
      detached; refuses a `.zip` path that fails `fs.statSync` (returns `'missing'`); skips a
      path equal to `currentPath` (returns `'same'`); otherwise writes `path + '\n'` and sets
      `currentPath`; `close(configPath)`, `closeFor(rootPath)`, `closeAll()` end stdin and
      arm a 5000 ms SIGTERM; `exit` forgets the session and calls `hooks.onExit(code)`;
      `error` or a non-zero exit before the first successful write calls
      `hooks.onStartFailure(command, detail)`; stdout and stderr lines go to `hooks.onLog`;
      `list()` returns `{ configPath, pid, currentPath, startedAt }[]`. Unit tests in
      `server/test/unit/trace.test.ts` with a fake child (EventEmitter with a writable
      `stdin` buffer): start once, write order, missing-file refusal, dedupe, close ends
      stdin, SIGTERM after the grace (fake timers), exit forgets, error reports the command.
- [X] T008 [P] In `server/src/commands.ts` add `COMMAND_TOGGLE_TRACE_VIEWER = 'playwright.toggleTraceViewer'`
      and `COMMAND_SHOW_TRACE = 'playwright.showTrace'` to `ALL_COMMANDS`, and give
      `buildRunArgs` a trailing `trace = false` parameter that appends `'--trace', 'on'`
      when true; extend `server/test/unit/commands.test.ts` so the argument list with
      `trace: false` is identical to today's and with `true` ends in `--trace on`.
- [X] T009 [P] In `server/src/runner.ts` make `parseRunReport` return `traces` via
      `extractTraces` (the existing `multiProject` flag), add `traces` to every `RunResult`
      branch (empty for cancelled, spawn error and run error), and pass `request.trace` to
      `buildRunArgs` in `RunManager.start`; extend `server/test/unit/runner.test.ts` with a
      report fixture containing a `trace` attachment, a skipped result without one and two
      project entries for one spec (two records, distinct `finishedAt`).
- [X] T010 [P] In `server/src/step-reporter.ts` emit `traceLive` on `testBegin` as
      `<test.parent.project().outputDir>/.playwright-artifacts-<result.workerIndex>/traces/<test.id>.json`
      (omitted when `outputDir`, `workerIndex` or `id` is unavailable; `onTestBegin` now
      receives the result as its second argument) and `trace` on `testEnd` from
      `result.attachments.find(a => a.name === 'trace')?.path` (omitted when absent); never
      touch the file system; extend `server/test/unit/step-reporter.test.ts` for both fields
      and both omissions.
- [X] T011 In `server/src/server.ts` wire the preference: module state
      `tracePreference: TracePreference`; at `initialized` read `readTracePreference(stateDir())`
      before `loadSettings`; `applySettings` parses `showTrace` with `parseShowTraceSetting`
      (Warning `Playwright: setting "showTrace" must be true or false` once per invalid
      value, reset on a valid one) and re-resolves only when the current source is
      `settings` or `default`, showing Info `Playwright: show trace viewer is on (from settings)`
      when the result is on and came from settings; log
      `playwright: show trace viewer: on|off (<source>)` on every resolution; add
      `traceViewer: { enabled, source }` to every workspace entry of `playwright/status`.

**Checkpoint**: `npm run build && npm test` green with the new unit tests; no user-facing
change yet (the preference is still off everywhere).

---

## Phase 3: User Story 1 - See the trace of the test I just ran (Priority: P1) 🎯 MVP

**Goal**: toggle "Show trace viewer" on from the code action menu; a single-test run records
a trace and Playwright's trace viewer shows it live and final; the window is reused.

**Independent Test**: quickstart scenarios 1 to 5; integration tests T015 and T016.

### Implementation for User Story 1

- [X] T012 [US1] In `server/src/server.ts` add the toggle: code action
      `Playwright: [x] Show trace viewer` / `Playwright: [ ] Show trace viewer`
      (`COMMAND_TOGGLE_TRACE_VIEWER`, `[{ uri }]`) offered for any served document of an
      enabled workspace with a supported config, appended after the picker entries;
      `toggleTraceViewerCommand(uri)` refuses gated workspaces (`refuseNotEnabled`) and
      non-Playwright documents (`notPlaywright`), flips to
      `{ enabled: !enabled, source: 'remembered', updatedAt: now }`, writes the store
      (`writeTracePreference`, log instead of fail), logs, shows Info
      `Playwright: show trace viewer is on|off`, and on off calls `viewers.closeAll()`.
- [X] T013 [US1] In `server/src/server.ts` integrate runs: `startRun` sets
      `request.trace = tracePreference.enabled`; in the `onStepEvent` callback, when
      `request.trace` and `location.kind === 'test'` and the run is still current, a
      `testBegin` with `traceLive` calls `viewers.show(config, ws.rootPath, traceLive)` and a
      `testEnd` with `trace` calls `viewers.show(config, ws.rootPath, trace)`; at run end set
      `ws.traces = { runId: request.id, records: result.traces }` when the run is current;
      when the run was a single-test run with `trace` on and no `testEnd` trace was shown,
      show `latestTraceFor`-style last-finished record from `result.traces`, and when such a
      run ends with zero records show Warning `Playwright: no trace recorded for <target> in this run`
      (contract section 5); warn once per run `Playwright: the trace <path> is outside <rootPath>; ...` when a shown path is not
      within `ws.rootPath` (research R3); log `playwright: trace viewer <configName> showing <path>`
      per show and `... trace file not found` when `show` returns `'missing'`.
- [X] T014 [US1] In `server/src/server.ts` own the viewer lifecycle: one `ViewerSessions`
      instance with hooks that log `playwright: trace viewer <configName> started (pid <n>): <command>`,
      `... exited (code <n>)`, `... closed`, forward child output lines as
      `playwright: trace viewer <configName>: <line>`, and show Error
      `Playwright could not start the trace viewer.\nCommand: <command>\n<detail>` on start
      failure; call `viewers.closeFor(rootPath)` in `removeWorkspace`, `viewers.closeAll()`
      in `connection.onShutdown`, `connection.onExit` and `process.on('exit')`; add
      `traceViewers: viewers.list()` filtered to the workspace in `playwright/status`.
- [X] T015 [US1] Create `server/test/integration/trace.test.ts` (window-free part): start a
      client on the fixture; the code action list of `tests/passing.spec.ts` contains
      `Playwright: [ ] Show trace viewer`; run `adds numbers` and keep the logged command
      line; execute `playwright.toggleTraceViewer` and assert the Info message, the
      `[x]` title on a fresh code action request, `trace-viewer.json` in the client's state
      dir with `showTrace: true`; run `adds numbers` again and assert the command line equals
      the earlier one plus ` --trace on`, that `playwright/status` reports
      `traces.records` with one entry whose `path` ends in `trace.zip` and exists, and that
      the run's pass notification, diagnostics and marks are as before; run the `skipped on
      purpose` line as a single test and assert the Warning
      `Playwright: no trace recorded for tests/passing.spec.ts:39 in this run` next to the
      usual summary; toggle off and assert
      the next command line equals the first one byte for byte (SC-003).
- [X] T016 [US1] In `server/test/integration/trace.test.ts` add the real-viewer test:
      `test.skipIf(!hasDisplay())` with a logged reason; toggle on, run `adds numbers`, poll
      `playwright/status` until `traceViewers` has one session whose `currentPath` ends in
      `trace.zip` and whose `pid` answers `process.kill(pid, 0)` (within 30 s); run
      `multiplies` and assert the same pid with the new path (window reused); toggle off and
      assert the session list is empty and `process.kill(pid, 0)` throws within 10 s;
      `afterEach` toggles off and stops the client so no window outlives the test.

**Checkpoint**: User Story 1 works end to end: scenario 2 of the quickstart shows the
trace viewer window with the test's trace.

---

## Phase 4: User Story 2 - Open the trace of one test after running several (Priority: P2)

**Goal**: after a file run, "Playwright: Show trace" at the cursor shows that test's trace;
clear messages when there is none.

**Independent Test**: quickstart scenario 6; integration test T018.

### Implementation for User Story 2

- [X] T017 [US2] In `server/src/server.ts` add `Playwright: Show trace`
      (`COMMAND_SHOW_TRACE`, `[{ uri, line }]`, 0-based line) to the code actions when the
      preference is on, `resolveTestLocation` over all discovered tests of the file yields
      `kind === 'test'`, and `ws.traces` is not null; implement `showTraceCommand(uri, line)`:
      Warning `Playwright: turn on "Show trace viewer" first; the last run recorded no traces`
      when off, `Playwright: put the cursor inside a test to show its trace` when the cursor
      is not in a test, `Playwright: no trace for <title> in the last run` (title via
      `failureLabel`-style `[<project>] <title>` when projects exist) when `latestTraceFor`
      returns null, `Playwright: trace file not found: <path>` when `show` returns
      `'missing'`; otherwise `viewers.show(config, ws.rootPath, record.path)`; register the
      command in `onExecuteCommand` with the argument check used by run at cursor.
- [X] T018 [US2] In `server/test/integration/trace.test.ts` cover the cursor action: with
      the preference off, `Playwright: Show trace` is absent and the command answers the
      "turn on" Warning; toggle on and run the file; the action is present on a test line and
      absent on a describe line; `playwright.showTrace` on the `skipped on purpose` line
      yields `Playwright: no trace for skipped on purpose in the last run`; under
      `hasDisplay()`, `playwright.showTrace` on the `concatenates` line makes
      `traceViewers[0].currentPath` equal that test's record path, and on
      `shows the empty app` switches it (window reused, same pid).

**Checkpoint**: User Stories 1 and 2 work together; a file run followed by "Show trace" at
any test line opens that test's trace.

---

## Phase 5: User Story 3 - Turn it off, and keep my choice (Priority: P3)

**Goal**: the choice persists across restarts, a folder default applies until a choice is
made, turning off closes the viewer and stops forcing traces, mid-run toggles are safe.

**Independent Test**: quickstart scenarios 7 to 9; integration tests T019 and T020.

### Implementation for User Story 3

- [X] T019 [US3] In `server/test/integration/trace.test.ts` cover persistence and settings:
      toggle on, stop the client, start a new one with the same `stateDir` and assert
      `traceViewer` is `{ enabled: true, source: 'remembered' }` and the action reads `[x]`;
      a fresh state dir with `settings: { showTrace: true }` reports source `settings`, the
      Info `... is on (from settings)` and `--trace on` on a run; a state dir holding
      `showTrace: false` plus `settings: { showTrace: true }` stays off (remembered wins);
      `changeSettings({ showTrace: 'yes' })` yields the "must be true or false" Warning once
      and leaves the state unchanged; a client with `noConfiguration` has source `default`.
- [X] T020 [US3] In `server/test/integration/trace.test.ts` cover the mid-run toggles:
      with the preference on start `tests/slow.spec.ts`, toggle off while it runs, and
      assert the run still ends with its pass notification, its command line carried
      `--trace on` (captured at start), `traces.records` is filled and `traceViewers` is
      empty afterwards; with the preference off start the slow test, toggle on during the
      run, and assert that run's command line has no `--trace` while the next run's does.

**Checkpoint**: all three stories pass their integration tests; the suite is green with
and without a display (the real-viewer tests skip without one).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: documentation, parity record, full gate, owner verification.

- [X] T021 [P] Update `README.md`: a "Trace viewer" subsection under Usage (the toggle
      entry, what a single-test run does, **Playwright: Show trace** after a file run, the
      window is Playwright's own and may be closed at will, the `--trace on` effect on run
      time and `test-results/`), the `showTrace` key in Settings next to `projects`, the
      `trace-viewer.json` file in the state directory list, and under "Differences from
      the VS Code extension" the toggle and trace selection as code actions (no settings
      view, no Test Explorer tree) and that the viewer starts with the first trace rather
      than before the run.
- [X] T022 [P] Update `server/README.md`: the two commands with their arguments, the
      `showTrace` settings key, the store file, the step reporter's two new fields, and
      the display requirement (`xvfb-run -a npm test`) for the full suite.
- [X] T023 [P] Update `docs/parity.md`: "Show trace viewer" row to `full`, primitive
      `lsp, playwright-ui`, note per research R9 (upstream mechanism mirrored, code-action
      toggle and cursor selection, live trace for single-test runs, no pre-start, the
      "Show browser" interaction deferred); add to the "Show browser" row note that upstream
      turns trace recording off while the browser is shown and this must be honoured when
      that row is built.
- [X] T024 Run the full gate (`cargo test && cargo build --release --target wasm32-wasip2`;
      `cd server && npm run lint && npm run build && npm test`, with `xvfb-run -a` when no
      display) and record the commands, counts and outcome in
      `specs/008-show-trace-viewer/verification.md`; confirm `git status` shows no
      `test-results/` or trace files left in `fixtures/sample-project/`.
- [X] T025 Owner runs quickstart scenarios 1 to 11 in Zed (dev extension, Linux Zed with
      WSLg) and records each outcome, the Zed version and the date in
      `specs/008-show-trace-viewer/verification.md`; any failure reopens the matching task.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (baseline before any change); T002 and T003 in parallel.
- **Foundational (Phase 2)**: T004 first (types); then T005, T006, T008, T009, T010 in
  parallel; T007 after T006 (same file); T011 after T005, T006 and T007.
- **US1 (Phase 3)**: T012, T013, T014 in sequence (all `server.ts`); T015 after T014;
  T016 after T015 (same test file).
- **US2 (Phase 4)**: T017 after T014; T018 after T016.
- **US3 (Phase 5)**: T019 and T020 after T018 (same test file; the implementation they
  test is in T011 and T012).
- **Polish (Phase 6)**: T021, T022, T023 in parallel after Phase 5; T024 after them; T025
  after T024.

### User Story Dependencies

- US1 depends only on the foundation and is the MVP.
- US2 depends on US1's viewer lifecycle (T014) and run records (T013).
- US3's behaviour is built in T011 and T012; its tasks are evidence and can run as soon as
  T012 exists, but share the test file with US1 and US2.

### Parallel Opportunities

- Phase 1: T002 and T003.
- Phase 2: T005, T006, T008, T009, T010 (five different files) once T004 is done.
- Phase 6: T021, T022, T023.

## Parallel Example: Phase 2

```text
After T004 (types):
  T005 server/src/store.ts + test/unit/store.test.ts
  T006 server/src/trace.ts + test/unit/trace.test.ts (pure parts)
  T008 server/src/commands.ts + test/unit/commands.test.ts
  T009 server/src/runner.ts + test/unit/runner.test.ts
  T010 server/src/step-reporter.ts + test/unit/step-reporter.test.ts
Then T007 (ViewerSessions in trace.ts), then T011 (server.ts wiring).
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1 and 2: baseline, types, store, pure logic, session manager, arguments, report
   extraction, reporter fields, preference wiring.
2. Phase 3: toggle, run integration, lifecycle, both integration tests.
3. Stop and validate: quickstart scenarios 1 to 5 in Zed. This alone closes the core of
   the parity row (single-click to a full trace).

### Incremental Delivery

- Add US2 (cursor action) and validate scenario 6.
- Add US3 evidence and validate scenarios 7 to 9.
- Polish: docs, parity row, full gate, owner verification (scenarios 10 and 11 included).
- Release 0.7.0 in lockstep after the PR merges, on the owner's explicit OK, following
  the recorded procedure (server to npm first, then the pin and manifests); the registry
  PR bump is the owner's decision.

## Notes

- Nothing in this feature changes the Rust shell; `cargo test` and the WASM build still
  run in T001 and T024 as the constitution requires.
- The real-viewer tests open a Chromium window briefly on a desktop; they skip themselves
  without a display and CI provides one through `xvfb-run` (T003).
- Trace files are Playwright's: the server reads paths from the reporter and the report
  and never deletes or moves anything under `test-results/`.

## Phase 7: Convergence

- [X] T026 In `server/src/server.ts` `startRun`, when the automatic show of a final `.zip`
      trace (the `showTrace` helper, `testEnd` path or the run-end fallback) returns
      `'missing'`, show Warning `Playwright: trace file not found: <path>` in addition to
      the log line, as `showTraceCommand` already does; live `.json` paths stay exempt.
      Extend `server/test/integration/trace.test.ts` or a unit test so the Warning is
      asserted for a record whose file was removed before the show, per FR-010 and
      contract section 5 (partial)
