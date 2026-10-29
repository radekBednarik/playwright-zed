---

description: "Task list for Show Browser"
---

# Tasks: Show Browser

**Input**: Design documents from `/specs/009-show-browser/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/show-browser.md, quickstart.md

**Tests**: Included. Constitution Principle V requires unit tests for pure logic and
fixture-backed evidence; SC-001 to SC-008 are checked by unit and integration tests plus the
quickstart scenarios in Zed.

**Organization**: Tasks are grouped by user story. All code lives in `server/`; the Rust
shell is untouched (plan: the settings path is generic since feature 005).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 watch my test run in a visible browser, US2 keep the browser between
  runs, US3 close the browsers and turn the mode off, US4 show browser and show trace
  viewer do not fight
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; unit tests `server/test/unit/`, integration tests
  `server/test/integration/`
- Sample project: `fixtures/sample-project/` (unchanged by this feature)
- Docs: `README.md`, `server/README.md`, `docs/parity.md`; CI `.github/workflows/ci.yml`
  (unchanged: the browser suite needs no display, research R7)
- Feature record: `specs/009-show-browser/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline evidence and test-client support for the new status fields and the
headless browser environment.

- [X] T001 Record the baseline in `specs/009-show-browser/verification.md` (new file,
      same header layout as `specs/008-show-trace-viewer/verification.md`): run
      `cargo test && cargo build --release --target wasm32-wasip2` and
      `cd server && npm run lint && npm run build && npm test` (under `xvfb-run -a` when
      no display) on the branch and note the commands, the counts (expected 8 Rust, 248
      vitest in 22 files) and the date.
- [X] T002 [P] Extend `server/test/integration/helpers.ts`: type the `playwright/status`
      answer with `showBrowser: { enabled: boolean; source: 'remembered' | 'settings' | 'default' }`
      and `browserServers: { configPath: string; pid: number; wsEndpoint: string | null; startedAt: string; state: 'starting' | 'ready' | 'stopping' }[]`
      per contract section 8; add an `env?: Record<string, string>` field to
      `StartOptions` that `TestClient.start` merges into the spawned server's environment
      (so a suite can pass `PW_DEBUG_CONTROLLER_HEADLESS: '1'`, research R7); export a
      `childPids(pid): number[]` helper (`pgrep -P` on Linux and macOS, empty on Windows)
      for the "same browser" assertions.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, the preference store and resolution, the browser server manager, the
run arguments and environment, and the preference wiring. No user story works without them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add to `server/src/types.ts`: `BrowserPreference { enabled: boolean; source: 'remembered' | 'settings' | 'default'; updatedAt: string | null }`
      (`updatedAt` set only for `remembered`), `RunRequest.showBrowser: boolean` (copy of
      the preference at start) and `RunRequest.browserEndpoint: string | null` (set only
      when `showBrowser` is true); document in the comment that `RunRequest.trace` is
      forced `false` when `showBrowser` is true (data-model "RunRequest").
- [X] T004 [P] In `server/src/store.ts` add `BROWSER_STORE_FILE = 'show-browser.json'`,
      `readBrowserPreference(dir): { showBrowser: boolean; updatedAt: string } | null`
      (missing, unreadable, malformed, symlinked, `version !== 1`, non-boolean
      `showBrowser` or non-string `updatedAt` all read as `null`) and
      `writeBrowserPreference(dir, showBrowser, now = new Date())` writing
      `{ "version": 1, "showBrowser": <bool>, "updatedAt": "<ISO>" }` through a temp file
      in the same directory and a rename, directory `0700`, file `0600`; share the
      read/write helpers with the trace store rather than copying them; unit tests in
      `server/test/unit/store.test.ts` (temp dir: round trip, each invalid shape, symlink,
      the two files independent of each other).
- [X] T005 [P] Create `server/src/browser.ts` with the pure parts and unit tests in
      `server/test/unit/browser.test.ts`: `resolveBrowserPreference(remembered, settingsValue)`
      per data-model (remembered wins, else boolean setting, else `{ enabled: false, source: 'default', updatedAt: null }`);
      `parseReuseBrowserSetting(value): { value: boolean | null; invalid: boolean }`
      (`undefined`/`null` absent, `true`/`false` valid, anything else invalid);
      `parseListeningLine(line): string | null` returning the endpoint of a
      `Listening on <endpoint>` line (trimmed, `ws://` or `wss://` only) and null otherwise;
      `bothOnKey(browser, trace): string` = `${browser.updatedAt}|${trace.updatedAt}` for
      the once-per-combination Warning of research R6.
- [X] T006 In `server/src/browser.ts` add `BrowserServers` (injectable spawn function,
      default `node:child_process.spawn`, injectable `node` path and clock):
      `ensure(config, rootPath): Promise<{ ok: true; wsEndpoint: string } | { ok: false; command: string; detail: string }>`
      starts `node <config.playwrightCli> run-server --path=/<crypto.randomBytes(16).toString('hex')> --host 127.0.0.1`
      on first use with `cwd: config.configDir`,
      `env: { ...process.env, PW_EXTENSION_MODE: '1', FORCE_COLOR: '0' }`,
      `stdio: ['pipe', 'pipe', 'pipe']`, not detached; scans stdout line by line with
      `parseListeningLine`, resolves on the first endpoint, rejects on `error`, on `exit`
      before the endpoint (detail = first stderr line matching `/^\s*[A-Za-z]*Error\b/`,
      else first stderr line, else `exit code <n>`) or after 15000 ms without one
      (`no endpoint within 15 s`, process killed); concurrent callers while `starting`
      share one promise; a ready entry returns its endpoint at once; every stdout and
      stderr line goes to `hooks.onOutput(configName, line)`; `hooks.onStarted(configName,
      pid, command)`, `onListening(configName, endpoint)`, `onStopping(configName)`,
      `onExit(configName, code)`; `stop(configPath)` sends `SIGINT` and arms a 5000 ms
      `SIGKILL` (`child.kill()` when `process.platform === 'win32'`); `closeFor(rootPath)`,
      `closeAll(force = false)` (force = `SIGKILL` at once); `exit` forgets the entry;
      `list(rootPath?)` returns `{ configPath, rootPath, pid, wsEndpoint, startedAt, state }[]`;
      `has(rootPath)` for the code action rule. Unit tests in
      `server/test/unit/browser.test.ts` with a fake child (EventEmitter with writable
      stdout/stderr emitters and a recorded `kill`): start once and share the promise,
      endpoint parsed from a chunk split across two `data` events, timeout with fake
      timers, spawn error, early exit with the stderr detail, `stop` sends `SIGINT` then
      `SIGKILL` after the grace, `exit` forgets so the next `ensure` spawns again,
      `closeFor` only touches the matching root.
- [X] T007 [P] In `server/src/commands.ts` add `COMMAND_TOGGLE_SHOW_BROWSER = 'playwright.toggleShowBrowser'`
      and `COMMAND_CLOSE_ALL_BROWSERS = 'playwright.closeAllBrowsers'` to `ALL_COMMANDS`,
      and give `buildRunArgs` a trailing `showBrowser = false` parameter that appends
      `'--headed', '--workers', '1', '--trace', 'off'` when true (contract section 4;
      `--trace on` and the three flags never appear together: `trace` is ignored when
      `showBrowser` is true); extend `server/test/unit/commands.test.ts` so the argument
      list with `showBrowser: false` is identical to today's, with `true` ends in the three
      flags, and with both `trace: true` and `showBrowser: true` carries `--trace off` only.
- [X] T008 [P] In `server/src/runner.ts` make `RunManager.start` pass `request.showBrowser`
      to `buildRunArgs` and, when `request.browserEndpoint` is set, add
      `PW_TEST_CONNECT_WS_ENDPOINT: request.browserEndpoint` and
      `PW_TEST_REUSE_CONTEXT: '1'` to the spawn `env` next to `FORCE_COLOR`; extend
      `server/test/unit/runner.test.ts` with a fake spawn asserting the two variables are
      present exactly when the endpoint is set and absent otherwise (the `env` object is
      otherwise unchanged).
- [X] T009 In `server/src/server.ts` wire the preference: module state
      `browserPreference: BrowserPreference`, `browserSettingValue: boolean | null`,
      `invalidReuseBrowserWarned`; at `initialized` read `readBrowserPreference(stateDir())`
      next to the trace preference; `applySettings` parses `reuseBrowser` with
      `parseReuseBrowserSetting` (Warning `Playwright: setting "reuseBrowser" must be true
      or false` once per invalid value, reset on a valid one) and re-resolves only when the
      current source is `settings` or `default`, showing Info `Playwright: show browser is
      on (from settings)` when the result is on and came from settings, and stopping servers
      when the result is off with the same per-workspace guard as the toggle (T010:
      workspaces with a run in progress are stopped at run end by T015); log
      `playwright: show browser: on|off
      (<source>)` on every resolution; one `BrowserServers` instance `browsers` with hooks
      logging `playwright: browser server <configName> started (pid <n>): <command>`,
      `... listening on <endpoint>`, `... stopping`, `... exited (code <n>)` and
      `playwright: browser server <configName>: <line>` for output; add
      `showBrowser: { enabled, source }` and `browserServers: browsers.list(ws.rootPath)`
      (without `rootPath`) to every workspace entry of `playwright/status`; `closeAll()`
      on `shutdown`, `closeAll(true)` on `exit` and in the `process.on('exit')` handler next
      to the viewers.

**Checkpoint**: `npm run build && npm test` green with the new unit tests; no user-facing
change yet (the preference is still off everywhere and nothing starts a server).

---

## Phase 3: User Story 1 - Watch my test run in a visible browser (Priority: P1) 🎯 MVP

**Goal**: toggle "Show browser" on from the code action menu; every run then opens a
visible browser through a server kept per configuration, with one worker and no trace.

**Independent Test**: in the sample project, toggle on from a spec file, run one test at the
cursor, and confirm a browser window opens, the test's actions are visible and the result
arrives as before (quickstart scenarios 1 to 4).

### Implementation for User Story 1

- [X] T010 [US1] In `server/src/server.ts` add the toggle: code action
      `Playwright: [x] Show browser` / `Playwright: [ ] Show browser` (kind
      `source.playwright`, command `playwright.toggleShowBrowser`, `[{ uri }]`) right after
      the trace viewer toggle for any document with `configForDocument(uri)`;
      `toggleShowBrowserCommand(uri)` with the same refusals as `toggleTraceViewerCommand`,
      flips to `{ enabled, source: 'remembered', updatedAt: now }`, writes
      `writeBrowserPreference(stateDir(), enabled, now)` (log on failure), logs the
      resolution, shows Info `Playwright: show browser is on|off`, and when the new state is
      off stops the servers of every workspace that has no run in progress
      (`browsers.closeFor(ws.rootPath)` for each workspace where `managerFor(ws).running` is
      null); a workspace with a run in progress is stopped by T015 at that run's end; dispatch in `onExecuteCommand`
      (`Playwright: toggle show browser needs a document` on a bad argument). The trace
      coupling is T017; leave a `// Feature 009 US4` marker where it goes.
- [X] T011 [US1] In `server/src/server.ts` `startRun`: set `request.showBrowser =
      browserPreference.enabled` and `request.trace = tracePreference.enabled && !request.showBrowser`,
      `request.browserEndpoint = null`; when `showBrowser`, after the dirty-file warning
      and before `progressBegin`, `await browsers.ensure(config, ws.rootPath)`; on failure
      show Error `Playwright could not start the browser server.\nCommand: <command>\n<detail>`,
      write the run log with status `error` and the message (`writeLog` with a synthetic
      `RunResult` of status `error`, empty counts, `command` = the server command), log
      `playwright: run <id> browser server failed: <detail>` and return without a progress
      token; on success set `request.browserEndpoint`, log `playwright: run <id> browser
      server <endpoint>` and continue; a run superseded while waiting (`ws.lastRun.id !==
      request.id` after the await) returns silently. `followTrace` stays
      `request.trace && location.kind === 'test'` (false for shown runs).
- [X] T012 [US1] Create `server/test/integration/browser.test.ts`: start a `TestClient`
      on `FIXTURE` with `env: { PW_DEBUG_CONTROLLER_HEADLESS: '1' }` and
      `afterAll` that toggles off if needed and stops the client (no server may outlive the
      suite: assert `browserServers` is empty after the stop by checking the recorded pids
      are dead). Tests: (a) starts off, `showBrowser` is `{ enabled: false, source: 'default' }`,
      `browserServers` empty, the code actions carry `[ ] Show browser` after
      `[ ] Show trace viewer` and before `[x] chromium`, with command and `[{ uri }]`;
      (b) a run with the option off logs a command without `--headed`, `--workers` or
      `--trace` and starts no server (baseline command saved for (f)); (c) toggling on
      shows Info `Playwright: show browser is on`, writes `show-browser.json` with
      `showBrowser: true` and flips the title; (d) a single-test run with the option on
      logs `run <id> browser server ws://127.0.0.1:` and a command ending in
      `--headed --workers 1 --trace off`, passes with `1 passed`, and `browserServers` has
      one entry for the fixture config with `state: 'ready'`, a `ws://` endpoint and a pid
      that is alive, whose child (via `childPids`) is a headless Chromium (`ps -o args=`
      contains `headless`); (e) a file run passes 11 tests through the same server pid;
      (f) toggling off shows `... is off`, the server pid dies within 5 s, and the next
      run's command equals the baseline byte for byte.

**Checkpoint**: quickstart scenarios 1 to 4 pass in Zed; US1 is the MVP.

---

## Phase 4: User Story 2 - Keep the browser between runs (Priority: P2)

**Goal**: the kept browser survives between runs, a browser closed by hand is replaced at
the next run, nothing outlives the editor session.

**Independent Test**: with the option on, run a test twice and confirm the same window is
used; close it by hand and run again, confirm a fresh window; quit the editor, confirm no
browser remains (quickstart scenario 5).

### Implementation for User Story 2

- [X] T013 [US2] In `server/src/server.ts` own the server lifecycle: `closeFor(ws.rootPath)`
      in the workspace-removal path (next to `viewers.closeFor`); a server whose `exit`
      hook fires outside `stop()` is already forgotten by the manager (T006), so the next
      `ensure` starts anew: add the log line `playwright: browser server <configName>
      exited on its own, a new one starts with the next run` in the `onExit` hook when the
      state was not `stopping`, and in that case also show Warning `Playwright: the browser
      server for <configName> exited (code <n>); a new one starts with the next run`
      (FR-010, one message per unexpected exit); confirm `shutdown`, `exit` and `process.on('exit')` from
      T009 cover every entry (FR-011).
- [X] T014 [US2] In `server/test/integration/browser.test.ts` add: (g) two consecutive
      single-test runs share one server pid and one browser child pid (`childPids` before
      and after, both alive, equal); (h) killing the browser child with `SIGKILL` leaves
      the server pid alive, the next run passes and `childPids` shows a new browser pid;
      (i) killing the server pid with `SIGKILL` logs `exited on its own`, `browserServers`
      is empty, and the next run starts a new server (new pid, `started` logged again);
      (j) `client.stop()` (LSP `shutdown` then `exit`) with a server running leaves its
      pid dead within 5 s; start a fresh client for the following describe blocks.

**Checkpoint**: quickstart scenario 5 passes in Zed.

---

## Phase 5: User Story 3 - Close the browsers and turn the mode off (Priority: P3)

**Goal**: "Close all browsers" on demand (refused while a run is in progress), toggle off
closes and restores plain runs, the choice survives a restart, a folder default applies.

**Independent Test**: close with the action and confirm the option stays on; toggle off and
confirm the window closes and the next run is headless; restart the editor and confirm the
state; set the folder default (quickstart scenarios 6 to 9).

### Implementation for User Story 3

- [X] T015 [US3] In `server/src/server.ts` add `Playwright: Close all browsers` (command
      `playwright.closeAllBrowsers`, `[{ uri }]`) offered right after the show browser
      toggle when `browserPreference.enabled || browsers.has(ws.rootPath)`;
      `closeAllBrowsersCommand(uri)` with the toggle's refusals: when
      `managerFor(ws).running` is set show Warning `Playwright: cannot close browsers while
      tests are running` and do nothing; else when `browsers.has(ws.rootPath)` call
      `browsers.closeFor(ws.rootPath)` and show Info `Playwright: browsers closed`; else
      Info `Playwright: no browsers to close`; dispatch in `onExecuteCommand`. At the end of
      `startRun` (after the result, before the status switch) when `request.showBrowser &&
      !browserPreference.enabled` call `browsers.closeFor(ws.rootPath)` (toggle off during
      the run, FR-007).
- [X] T016 [US3] In `server/test/integration/browser.test.ts` add: (k) with the option on
      and a server running, `playwright.closeAllBrowsers` shows `browsers closed`, the pid
      dies within 5 s, `showBrowser.enabled` stays true, the title stays `[x]`, and the
      next run starts a new server; (l) with nothing running the command shows `no browsers
      to close`; (m) during a run of `SLOW` (do not await the run; the feature 008 gotcha)
      the command shows `cannot close browsers while tests are running` and the server pid
      stays alive until the run ends; (n) toggling off during a `SLOW` run: the run passes
      and the server pid dies within 5 s after the run's progress `end`; (o) the choice
      survives a server restart on the same `stateDir` (`[x]` and `source: 'remembered'`);
      (p) on a fresh `stateDir` the settings `{ reuseBrowser: true }` give
      `source: 'settings'` and the Info `... is on (from settings)` once, a run carries the
      three flags, `{ reuseBrowser: 'yes' }` warns `must be true or false` once and leaves
      the state, and a remembered off wins over a `true` setting; (q) the code action
      `Close all browsers` is absent with the option off and no server, present with the
      option on.

**Checkpoint**: quickstart scenarios 6 to 9 pass in Zed.

---

## Phase 6: User Story 4 - Show browser and Show trace viewer do not fight (Priority: P3)

**Goal**: upstream's rule: turning the browser on turns the trace viewer off; while the
browser is shown no run records a trace and the messages say why.

**Independent Test**: with the trace viewer on, turn the browser on; confirm the viewer
option reads off, its window closes and a run records no trace (quickstart scenario 10).

### Implementation for User Story 4

- [X] T017 [US4] In `server/src/server.ts`: in `toggleShowBrowserCommand`, when the new
      state is on and `tracePreference.enabled`, set `tracePreference = { enabled: false,
      source: 'remembered', updatedAt: now }`, `writeTracePreference(stateDir(), false, now)`
      (log on failure), `viewers.closeAll()`, log both resolutions, and use the Info
      `Playwright: show browser is on; show trace viewer turned off (no traces while the
      browser is shown)` instead of the plain one; in `toggleTraceViewerCommand`, when the
      new state is on and `browserPreference.enabled`, set `browserPreference = { enabled:
      false, source: 'remembered', updatedAt: now }`, `writeBrowserPreference(stateDir(),
      false, now)`, `stopIdleBrowsers()` and use the Info `Playwright: show trace viewer is
      on; show browser turned off (browsers closed)` (owner decision 2026-10-29, both
      directions exclude each other); in `startRun`, when
      `request.showBrowser && tracePreference.enabled`, log `playwright: run <id> trace
      recording off (show browser is on)` and, when `bothOnKey(browserPreference,
      tracePreference)` differs from the last warned key, show Warning `Playwright: show
      browser is on, so runs record no trace; turn it off to use the trace viewer` and
      remember the key; `Playwright: Show trace` stays governed by `ws.traces` as today.
- [X] T018 [US4] In `server/test/integration/browser.test.ts` add a describe block
      (fresh client, headless env): (r) trace viewer on, then show browser on: the Info is
      the combined message, `traceViewer` reads `{ enabled: false, source: 'remembered' }`,
      `trace-viewer.json` holds `showTrace: false`, `traceViewers` is empty, the next run's
      command carries `--trace off` and no `--trace on`, and `traces.records` is empty;
      (s) show browser on with a server running, then trace viewer on: the Info is
      `show trace viewer is on; show browser turned off (browsers closed)`, the server pid
      dies, `showBrowser` reads `{ enabled: false, source: 'remembered' }`,
      `show-browser.json` holds `showBrowser: false`, the close action is gone, and a file
      run records traces with `--trace on`; (t) both on through a settings default
      (`reuseBrowser: true` with the viewer remembered on): a run logs `trace recording off
      (show browser is on)`, carries `--trace off`, shows the Warning once, a second run
      does not repeat it, and `Playwright: Show trace` is not offered.

**Checkpoint**: quickstart scenario 10 passes in Zed.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentation, parity record, full gate, owner verification.

- [X] T019 [P] Update `README.md`: two rows in the Usage table (**Playwright: [ ] Show
      browser**, **Playwright: Close all browsers**), a "Show browser" subsection next to
      "Trace viewer" (what a run does while it is on: visible window, one worker, kept
      between runs, no trace or video, the window may be closed at will and comes back
      with the next run; the close action and its refusal during a run; the toggle turning
      the trace viewer off and the one-time warning when both are on; the `--headed
      --workers 1 --trace off` flags and the two environment variables so a reader can
      reproduce a run by hand), the `reuseBrowser` key in Settings next to `showTrace`,
      `show-browser.json` in the state directory list, and under "Differences from the VS
      Code extension" the code-action placement, video left to the project configuration
      (Playwright then skips context reuse on its own) and no stop on the last page closing.
- [X] T020 [P] Update `server/README.md`: the two commands with their arguments, the
      `reuseBrowser` settings key, the store file, the run flags and environment, the
      `run-server` process per configuration (extension mode, `Listening on` line, SIGINT
      stop), and that the browser suite runs headless through `PW_DEBUG_CONTROLLER_HEADLESS`.
- [X] T021 [P] Update `docs/parity.md`: "Show browser" and "Close all browsers" rows to
      `full`, primitive `lsp, playwright-ui`, notes per research R9 (upstream's
      `run-server` and environment hooks mirrored, code-action toggle and close, one worker,
      headed, trace off, trace viewer turned off on toggle on; differences: video not
      forced off, no page-count stop, server started by the first run); in the "Show trace
      viewer" row replace the deferred sentence with the built coupling.
- [X] T022 Run the full gate (`cargo test && cargo build --release --target wasm32-wasip2`;
      `cd server && npm run lint && npm run build && npm test`, with `xvfb-run -a` when no
      display) and record the commands, counts and outcome in
      `specs/009-show-browser/verification.md`; confirm `git status` shows nothing left in
      `fixtures/sample-project/` and `pgrep -f run-server` finds no leftover server.
- [X] T023 Owner runs quickstart scenarios 1 to 12 in Zed (dev extension, Linux Zed with
      WSLg) and records each outcome, the Zed version and the date in
      `specs/009-show-browser/verification.md`; any failure reopens the matching task.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (baseline before any change); T002 in parallel with it.
- **Foundational (Phase 2)**: T003 first (types); then T004, T005, T007, T008 in parallel;
  T006 after T005 (same file); T009 after T004, T005 and T006.
- **US1 (Phase 3)**: T010, T011 in sequence (both `server.ts`); T012 after T011 and T002.
- **US2 (Phase 4)**: T013 after T011; T014 after T012 (same test file).
- **US3 (Phase 5)**: T015 after T013; T016 after T014.
- **US4 (Phase 6)**: T017 after T015; T018 after T016.
- **Polish (Phase 7)**: T019, T020, T021 in parallel after Phase 6; T022 after them; T023
  after T022.

### User Story Dependencies

- US1 depends only on the foundation and is the MVP.
- US2 needs US1's run integration (T011) and adds lifecycle evidence.
- US3 needs US2's lifecycle (T013) for the close action.
- US4 needs US3's toggle paths (T015 touches `startRun`'s end) and feature 008's viewer
  code, which is on `main`.

### Parallel Opportunities

- Phase 1: T001 and T002.
- Phase 2: T004, T005, T007, T008 (four different files) once T003 is done.
- Phase 7: T019, T020, T021.

## Parallel Example: Phase 2

```text
After T003 (types):
  T004 server/src/store.ts + test/unit/store.test.ts
  T005 server/src/browser.ts + test/unit/browser.test.ts (pure parts)
  T007 server/src/commands.ts + test/unit/commands.test.ts
  T008 server/src/runner.ts + test/unit/runner.test.ts
Then T006 (BrowserServers in browser.ts), then T009 (server.ts wiring).
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1 and 2: baseline, types, store, pure logic, server manager, arguments,
   environment, preference wiring.
2. Phase 3: toggle, run integration, the first integration tests.
3. Stop and validate: quickstart scenarios 1 to 4 in Zed. This alone closes the core of
   the "Show browser" row (a visible run from one toggle).

### Incremental Delivery

- Add US2 (lifecycle) and validate scenario 5.
- Add US3 (close action, toggle off, persistence, settings) and validate scenarios 6 to 9.
- Add US4 (trace coupling) and validate scenario 10.
- Polish: docs, parity rows, full gate, owner verification (scenarios 11 and 12 included).
- Release 0.8.0 in lockstep after the PR merges, on the owner's explicit OK, following
  the recorded procedure (server to npm first, then the pin and manifests); the registry
  PR bump is the owner's decision.

## Notes

- Nothing in this feature changes the Rust shell; `cargo test` and the WASM build still
  run in T001 and T022 as the constitution requires.
- The integration suite keeps the browser headless through Playwright's own
  `PW_DEBUG_CONTROLLER_HEADLESS` and so needs no display; the headed window is the owner's
  scenario in Zed. CI is unchanged (`xvfb-run` stays for feature 008's viewer test).
- The browser, its contexts and pages are Playwright's: the server starts and stops
  `run-server`, never drives the browser; `--trace off` is the only override of the
  project configuration besides `--headed` and `--workers 1`.
- Test-writing gotcha from feature 008: `workspace/executeCommand` for a run answers only
  when the run ends, so the mid-run tests (m, n) must not await the run.
