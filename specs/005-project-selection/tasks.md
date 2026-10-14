---

description: "Task list for Playwright Project Selection"
---

# Tasks: Playwright Project Selection

**Input**: Design documents from `/specs/005-project-selection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/project-selection.md, quickstart.md

**Tests**: Included. Constitution Principle V requires unit tests for pure logic and
fixture-backed evidence; SC-002 and SC-004 are automated checks.

**Organization**: Tasks are grouped by user story. Server work lives in `server/`; the Rust
shell changes only in User Story 3 (settings forwarding, research R4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 run in the projects I choose, US2 my choice survives a restart, US3 a team
  default in project settings
- Every task names the exact file(s) it touches

## Path Conventions

- Language server: `server/src/*.ts`; unit tests `server/test/unit/`, integration tests
  `server/test/integration/`, report fixtures `server/test/fixtures/`
- Rust shell: `src/lib.rs`, `extension.toml`, `Cargo.toml`
- Sample project: `fixtures/sample-project/`
- Docs: `README.md`, `server/README.md`, `docs/parity.md`,
  `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness support for the state directory and for editor settings, so every
later phase can be tested without touching the developer's real store.

- [X] T001 Extend `server/test/integration/helpers.ts`: in `TestClient.start`, create a fresh `fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-state-'))` directory per client unless `options.stateDir` is given, pass it to the child as `PLAYWRIGHT_ZED_STATE_DIR` (spread over `process.env`), expose it as `client.stateDir`, and remove it in `stop()` only when the client created it (a directory passed in through `options.stateDir` is never removed by the client); add `stateDir?: string` to `StartOptions`
- [X] T002 Extend `server/test/integration/helpers.ts`: add `settings?: unknown` to `StartOptions` (default `{}`), advertise `workspace: { configuration: true, didChangeConfiguration: { dynamicRegistration: false } }` in the `initialize` capabilities, answer `workspace/configuration` requests with one copy of the current settings object per requested item, record them in `client.requests`, and add `async changeSettings(settings: unknown)` that updates the stored object and sends `workspace/didChangeConfiguration` with `{ settings }`
- [X] T003 [P] Add `.gitignore` entry `fixtures/sample-project/.zed/` so the quickstart's scratch settings file is never committed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Project names from discovery, the pure selection rules, the run arguments and
the default selection. After this phase the fixture has two projects and every existing
test still passes because the default is the first project.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Extend `server/src/types.ts` per data-model.md: `export type SelectionSource = 'single' | 'default' | 'settings' | 'remembered' | 'chosen'`; `export interface ProjectSelection { projects: string[]; source: SelectionSource; updatedAt: string | null }`; add to `PlaywrightConfig` the fields `projects: string[]` (doc: "From the last successful `--list`; empty until discovery ran"), `selection: ProjectSelection`, `noticeKey: string | null`; add `projects: string[]` to `RunRequest` (doc: "Copy of `config.selection.projects` at start")
- [X] T005 [P] Write unit tests in `server/test/unit/discovery.test.ts` for the new `projects` field of `parseListReport`: the `list-report.json` fixture yields `['chromium']`; a synthetic report with `config.projects` named `chromium`, `mobile` yields `['chromium', 'mobile']` in report order; a report without `config` yields `[]`; a project with empty `name` is kept as `''` (Playwright's unnamed project)
- [X] T006 Extend `server/src/discovery.ts`: add `projects: string[]` to `ListReport`, fill it from `report.config.projects[].name` (`?? ''`) in report order in `parseListReport`, and assign `config.projects = parsed.projects` in `runList`; initialise `projects: []`, `selection: { projects: [], source: 'single', updatedAt: null }`, `noticeKey: null` in `buildConfig` in `server/src/workspace.ts`; make T005 pass
- [X] T007 [P] Write unit tests in `server/test/unit/selection.test.ts` before implementing `server/src/selection.ts`: `resolveSelection(reported, remembered, settingsDefault)` returns `{ projects: reported, source: 'single' }` with no notice for `[]`, `['']` and `['chromium']`; first project with source `default` for `['chromium', 'mobile']` and both inputs `null`; remembered subset in reported order (`remembered ['mobile', 'chromium']` gives `['chromium', 'mobile']`), source `remembered`; dropped names produce `notice.dropped` and when nothing remains the result falls back to settings then default with `notice.dropped` set; settings default intersected, unknown names reported in `notice.unknown`, source `settings`; settings with no known name falls to default; `toggleProject(selection, reported, name)` flips membership keeping reported order, refuses the last selected project with `refusal: 'last'`, refuses unknown names with `refusal: 'unknown'`; `selectAll(reported)` returns every name with source `chosen`; `isTestSelected(test, projects)` is true iff `test.projects` intersects; `allSelected(selection, reported)`; `projectArgs(selection, reported)` is `[]` when all selected and `['--project', 'mobile']` for a single selection, pairs repeated per project; `parseProjectsSetting(value)` returns `null` for `undefined`, `null`, a string, an object, an array containing a non-string or empty string, and returns a de-duplicated string array otherwise
- [X] T008 Create `server/src/selection.ts` with the pure functions named in T007 and typed per data-model.md: `resolveSelection(reported: string[], remembered: string[] | null, settingsDefault: string[] | null): { selection: ProjectSelection; notice: { dropped: string[]; unknown: string[] } }` implementing steps 1 to 4 of the data model ("If `reported.length < 2`: result `reported`, source `single`"; "`keep = reported ∩ remembered` (reported order)"; "Otherwise result `[reported[0]]`, source `default`"), `toggleProject`, `selectAll`, `isTestSelected`, `allSelected`, `projectArgs`, `parseProjectsSetting`; `updatedAt` is `new Date().toISOString()` for `chosen`, otherwise the value passed in or `null`; make T007 pass
- [X] T009 Extend unit tests in `server/test/unit/commands.test.ts`: `buildRunArgs(location, config, ['chromium'])` on a config reporting `['chromium', 'mobile']` ends with `'--project', 'chromium'`; passing both names appends nothing; a config reporting `['chromium']` appends nothing for `['chromium']`; `countSelectedTests(tests, location, ['mobile'])` counts only tests whose `projects` include `mobile`
- [X] T010 Extend `server/src/commands.ts`: `buildRunArgs(location: TestLocation, config: PlaywrightConfig, projects: string[])` appends `projectArgs` from `selection.ts` after `--reporter=list,json`; `countSelectedTests(tests, location, projects: string[])` filters with `isTestSelected` first; update the call sites in `server/src/runner.ts` (`buildRunArgs(request.location, config, request.projects)`) and `server/src/server.ts`; make T009 pass
- [X] T011 Wire the default selection in `server/src/server.ts`: after a successful `runList` in `discoverConfig`, call `resolveSelection(config.projects, null, null)` (remembered and settings arrive in US2 and US3), assign `config.selection`, and log `playwright: projects for <configPath>: <names> (<source>)`; in `startRun` set `request.projects = [...config.selection.projects]`; extend the `playwright/status` config entries with `projects`, `selectedProjects: c.selection.projects`, `selectionSource: c.selection.source`
- [X] T012 Add the second project to `fixtures/sample-project/playwright.config.ts`: import `devices` and set `projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }]`; confirm `npx playwright test --list` in the fixture prints 32 entries and `cd server && npm run build && npm test` stays green (default `chromium`, runs carry `--project chromium`); add an assertion in `server/test/integration/detect.test.ts` that `status[0].configs[0].projects` equals `['chromium', 'mobile']`, `selectedProjects` equals `['chromium']` and `selectionSource` is `'default'`

**Checkpoint**: `npm run lint && npm test && npm run build` pass in `server/`; the fixture
has two projects; no picker exists yet.

---

## Phase 3: User Story 1 - Run a test in the browsers I choose (Priority: P1) 🎯 MVP

**Goal**: The code action menu lists the projects of the config with `[x]` / `[ ]` state and
a "select all" entry; toggles take effect at once; runs, lenses, cursor actions and messages
follow the selection.

**Independent Test**: In the fixture, toggle `mobile` on through `textDocument/codeAction`
plus `workspace/executeCommand`, run `adds numbers` at the cursor, and see `--project
chromium --project mobile` in the log and `2 passed` in the summary.

### Tests for User Story 1

- [X] T013 [P] [US1] Create `server/test/integration/projects.test.ts` (one `TestClient` on `FIXTURE`, `waitForDiscovery`, `beforeEach(clear)`) with these cases, written before the implementation: (a) code actions on `PASSING` line 2 contain, after the run actions, titles `Playwright: [x] chromium`, `Playwright: [ ] mobile`, `Playwright: Select all projects` with commands `playwright.toggleProject` (`arguments[0]` = `{ uri, project }`) and `playwright.selectAllProjects`; (b) executing toggle for `mobile` sends `workspace/codeLens/refresh`, the status shows `selectedProjects ['chromium', 'mobile']` and `selectionSource 'chosen'`, and the menu now shows both `[x]` and no "Select all" entry; (c) run at cursor on `adds numbers` yields a `$/progress` begin message `Running 1 test(s) in tests/passing.spec.ts (chromium, mobile)` and an Info summary `2 passed, 0 failed, 0 skipped`, and the run log command line carries no `--project` because both of the fixture's two projects are selected (FR-005; a partial selection is covered by (d)); (d) toggling `chromium` off then running yields `--project mobile` and `1 passed`; (e) toggling `mobile` off while it is the only one selected produces a Warning `Playwright: at least one project must stay selected` and leaves the status unchanged; (f) `playwright.selectAllProjects` then `playwright.runFile` on `PASSING` gives a command line without `--project` and a summary whose passed, failed and skipped counts add up to 24 (12 specs in each of the two projects; do not assert that every TodoMVC test passes on the mobile emulation, research R8); (g) toggling an unknown name `nope` produces a Warning containing `nope is not a project of`; (h) code actions on `CONFIG` (the config file, opened via `client.open`) contain the project entries, and code actions on a file outside the fixture contain none
- [X] T014 [P] [US1] Add to `server/test/integration/projects.test.ts` a lens-filtering case using a `tempProject`-style scratch copy (reuse `configSource` from `helpers.ts` extended with a second project `mobile` whose `testMatch` is `/mobile-only/`, and a `tests/mobile-only.spec.ts` with one test): with the default `chromium` the scratch file has no `▶ Run test` lens and `playwright.runFile` on it yields a Warning containing `no tests in` and `selected project`, no `$/progress`; after toggling `mobile` on, `workspace/codeLens/refresh` arrives and the lens exists; add a single-project case (SC-004, FR-007) on a scratch project built from the unchanged `configSource` (one project `chromium`): the status shows `projects ['chromium']`, `selectedProjects ['chromium']`, `selectionSource 'single'`, the code actions contain no title starting with `Playwright: [`, a run at cursor on its test produces a `$/progress` begin message without a parenthesised project list and a run log command line without `--project`

### Implementation for User Story 1

- [X] T015 [US1] Add to `server/src/commands.ts` the constants `COMMAND_TOGGLE_PROJECT = 'playwright.toggleProject'` and `COMMAND_SELECT_ALL_PROJECTS = 'playwright.selectAllProjects'` and include both in `ALL_COMMANDS`
- [X] T016 [US1] Add the picker to `onCodeAction` in `server/src/server.ts`: resolve the config for the document (`configForFile` on any served file under a `configDir`, discovery enabled, not only test files); when `config.projects.length >= 2` append, after the run actions, one action per reported project titled `Playwright: [x] <name>` or `Playwright: [ ] <name>` with command `playwright.toggleProject` and `[{ uri, project: name }]`, then `Playwright: Select all projects` with `playwright.selectAllProjects` and `[{ uri }]` unless `allSelected`
- [X] T017 [US1] Implement the two commands in `onExecuteCommand` in `server/src/server.ts`: `toggleProject(uri, project)` finds the config, calls `toggleProject` from `selection.ts`, shows Warning `Playwright: at least one project must stay selected` or `Playwright: <name> is not a project of <basename(configPath)>` on refusal, otherwise assigns `config.selection`, logs `playwright: projects for <configPath>: <names> (chosen)` and awaits `reporter.refreshCodeLenses()`; `selectAllProjects(uri)` does the same with `selectAll`; both report "not a Playwright workspace" via the existing `notPlaywright` path when no config owns the document
- [X] T018 [US1] Filter affordances in `server/src/server.ts`: in `testFileContext` and `onCodeLens` consider only tests with `isTestSelected(test, config.selection.projects)`; pass the filtered list to `resolveTestLocation` in `runAtCursor` so a cursor in an unselected-only test resolves to `file`; emit describe lenses only for describes that contain at least one selected test
- [X] T019 [US1] Refuse empty runs in `startRun` in `server/src/server.ts`: when `countSelectedTests(config.tests, location, config.selection.projects)` (a count of discovered specs, independent of how many projects they run in) is `0` and `config.projects.length >= 2`, show Warning `Playwright: no tests in <target> run in the selected project(s) <names>; change the selection from the code actions menu.` and return before `progressBegin`
- [X] T020 [US1] Project names in messages: extend `Reporter.progressBegin(token, testCount, file, projects?: string[])` in `server/src/reporting.ts` to append ` (<names joined by ", ">)` when `projects` has at least one entry (the `testCount` stays the number of discovered specs, so `Running 1 test(s) in tests/passing.spec.ts (chromium, mobile)` is followed by `2 passed`); in `startRun` pass `request.projects` only when `config.projects.length >= 2`; add the names to the run start log line (`playwright: run <id> (<trigger>, <kind>) <target> projects: <names>`)
- [X] T021 [US1] Run `cd server && npm run lint && npm run build && npm test`; make T013 and T014 pass; confirm every pre-existing test is unchanged and green

**Checkpoint**: User Story 1 is complete; the selection is session-only.

---

## Phase 4: User Story 2 - My choice survives a restart (Priority: P1)

**Goal**: Chosen selections are written to the per-user store and applied after the next
discovery, reconciled against the current project list with one notice per change.

**Independent Test**: Start a client with a temp state dir, toggle `mobile` only, stop the
client, start another on the same dir, and see `selectedProjects ['mobile']` with source
`remembered` without any command.

### Tests for User Story 2

- [X] T022 [P] [US2] Write unit tests in `server/test/unit/store.test.ts` before implementing `server/src/store.ts`, using a temp dir via `PLAYWRIGHT_ZED_STATE_DIR` passed as an option (not `process.env`): `stateDir(env, platform, home)` returns the override when set, else `$XDG_STATE_HOME/playwright-zed-language-server` or `~/.local/state/playwright-zed-language-server` on linux, `~/Library/Application Support/playwright-zed-language-server` on darwin, `%LOCALAPPDATA%\playwright-zed-language-server` on win32; `readSelections(dir)` returns `{}` for a missing file, for invalid JSON, for `version !== 1`, and for a file that is a symlink; `writeSelection(dir, configPath, projects)` creates the directory with mode `0o700`, writes `project-selection.json` with mode `0o600` (skip the mode assertions on win32), keeps entries for other config paths, stores `updatedAt` as an ISO string, and leaves no temp file behind; two sequential writes for different configs both survive
- [X] T023 [P] [US2] Add to `server/test/integration/projects.test.ts`: (a) persistence: the test creates its own temp directory with `fs.mkdtempSync` (removed in `afterAll`) and passes it as `stateDir` to both clients; client A on `FIXTURE`, toggle `mobile` and `chromium` so only `mobile` stays, stop; client B with the same `stateDir` shows `selectedProjects ['mobile']`, `selectionSource 'remembered'` after discovery, and the store file contains the fixture config path with `["mobile"]`; (b) dropped names: a scratch project (`configSource` variant with projects `chromium` and `mobile`) where the client selects `mobile` only, then the test rewrites the config renaming `mobile` to `tablet` and calls `client.save(config)`: one Info message containing `mobile no longer exist` and `selection is now chromium`, status shows `selectedProjects ['chromium']` and `selectionSource 'default'`; saving again without changes yields no second Info; (c) new project stays unselected: the scratch config gains a third project and after save `selectedProjects` is unchanged

### Implementation for User Story 2

- [X] T024 [US2] Create `server/src/store.ts`: `stateDir(env = process.env, platform = process.platform, home = os.homedir())`, `readSelections(dir): Record<string, { projects: string[]; updatedAt: string }>` (`lstat` must report a regular file; parse errors and wrong `version` return `{}` and are logged by the caller), `writeSelection(dir, configPath, projects)` doing read-merge-write to `project-selection.json` via a temp file in the same directory and `fs.renameSync`; file shape per data-model.md (`{ "version": 1, "configs": { "<abs config path>": { "projects": [...], "updatedAt": "<ISO>" } } }`); make T022 pass
- [X] T025 [US2] Wire the store in `server/src/server.ts`: in `discoverConfig`, read `readSelections(stateDir())[config.configPath]?.projects ?? null` and pass it as `remembered` to `resolveSelection`; copy the entry's `updatedAt` for source `remembered`; in `toggleProject` and `selectAllProjects` call `writeSelection(stateDir(), config.configPath, selection.projects)` after assigning the selection (errors are logged, never shown as Error); never write on reconcile
- [X] T026 [US2] Notices in `server/src/server.ts`: after `resolveSelection`, build `noticeKey` from `notice.dropped.join(',')` (and later `unknown`), and when it differs from `config.noticeKey` show Info `Playwright: project(s) <dropped> no longer exist in <basename(configPath)>; selection is now <names>` and store the key; always log the line; make T023 pass with `cd server && npm run lint && npm run build && npm test`

**Checkpoint**: User Stories 1 and 2 give full upstream parity for runs; the settings story
is additive.

---

## Phase 5: User Story 3 - A team default in project settings (Priority: P3)

**Goal**: `lsp.playwright.settings.projects` in Zed settings seeds the selection for configs
without a remembered choice, updates without a restart, and warns once about unknown names.

**Independent Test**: Start a client with `settings: { projects: ['mobile', 'nope'] }` and
no store entry; the status shows `['mobile']` with source `settings` and one Warning
listing `chromium, mobile`; `changeSettings({ projects: ['chromium', 'mobile'] })` updates
the status without a restart.

### Tests for User Story 3

- [X] T027 [P] [US3] Add to `server/test/integration/projects.test.ts`: (a) settings seed: client with `settings: { projects: ['mobile', 'nope'] }` and a fresh `stateDir` shows `selectedProjects ['mobile']`, `selectionSource 'settings'`, exactly one Warning containing `names nope` and `available: chromium, mobile`, and the server sent a `workspace/configuration` request after `initialized`; (b) live change: `changeSettings({ projects: ['chromium', 'mobile'] })` leads to `selectedProjects ['chromium', 'mobile']` and a `workspace/codeLens/refresh`, with no new Warning; (c) a chosen selection wins: after toggling, `changeSettings({ projects: ['chromium'] })` leaves `selectionSource 'chosen'` and the projects unchanged; (d) invalid shape `settings: { projects: 'chromium' }` yields one Warning naming the expected shape and the default selection; (e) a client without the `workspace.configuration` capability (new `StartOptions.noConfiguration: true` in `helpers.ts`) receives no `workspace/configuration` request and uses the default
- [X] T028 [P] [US3] Add a Rust unit test in `src/lib.rs` for a pure helper `projects_setting_json(settings: Option<serde_json::Value>) -> Option<String>` (or equivalent) that returns `None` for `None` and the serialised JSON string otherwise, so `cargo test` covers the forwarding path on the host

### Implementation for User Story 3

- [X] T029 [US3] Settings intake in `server/src/server.ts`: store `clientSupportsConfiguration = !!params.capabilities.workspace?.configuration` in `onInitialize`; in `onInitialized`, when supported, `await connection.workspace.getConfiguration()` (no section) and call `applySettings(value)`; register `connection.onDidChangeConfiguration((change) => applySettings(change.settings))`; `applySettings` runs `parseProjectsSetting` (a `null` result for a present-but-invalid value shows one Warning `Playwright: setting "projects" must be a list of project names`), stores `settingsDefault`, and re-resolves every config whose `selection.source` is `default` or `settings` (remembered and chosen keep), then refreshes lenses when anything changed
- [X] T030 [US3] Pass `settingsDefault` as the third argument of `resolveSelection` in `discoverConfig`; extend the notice logic from T026 so `notice.unknown` shows Warning `Playwright: setting "projects" names <unknown> which <basename(configPath)> does not define; available: <reported names>` once per distinct key; make T027 pass with `cd server && npm run lint && npm run build && npm test`
- [X] T031 [US3] Implement `language_server_workspace_configuration` in `src/lib.rs` inside `impl zed::Extension for PlaywrightExtension`: `let settings = zed::settings::LspSettings::for_worktree("playwright", worktree)?; Ok(settings.settings)` (wrapped through the helper from T028); run `cargo test` and `cargo build --release --target wasm32-wasip2` and record both outputs in `specs/005-project-selection/verification.md`
- [ ] T032 [US3] Verify the settings path in Zed per quickstart section 4 (reinstall the dev extension first so the WASM is rebuilt): `.zed/settings.json` in the fixture with `lsp.playwright.settings.projects`, warning for an unknown name, live change without restart; record the outcome in `specs/005-project-selection/verification.md`

**Checkpoint**: All three stories complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, parity record, manual verification and release preparation.

- [X] T033 [P] Update `README.md`: in "What it does today" add project selection; in the Usage table add rows "Choose the projects (browsers) to run in: `ctrl-.`, toggle **Playwright: [ ] <project>**, or **Playwright: Select all projects**"; add a "Projects" subsection explaining the first-project default, that single-project configs show no picker, where the choice is remembered (state file path per platform, `PLAYWRIGHT_ZED_STATE_DIR` override), and the `lsp.playwright.settings.projects` example from contracts/project-selection.md
- [X] T034 [P] Update `server/README.md` with the two new commands, the code action titles, the `workspace/configuration` shape, and the state file location
- [X] T035 [P] Update `docs/parity.md`: row "Playwright project detection and selection" to `full`, primitive `lsp`, note naming the code action picker, first-project default, per-user memory keyed by config path, and the `zed-only` settings default; keep the discovery wording
- [X] T036 [P] Append a pointer in `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md` and `contracts/playwright-cli.md` to `specs/005-project-selection/contracts/project-selection.md` for the new commands, actions, notifications and the `--project` flag
- [ ] T037 Run the manual scenarios in `specs/005-project-selection/quickstart.md` sections 2, 3, 5 and 6 in Zed with the local server build and the reinstalled dev extension; record each outcome with the commands run in `specs/005-project-selection/verification.md`
- [X] T038 Release preparation (owner's OK required before any publish): bump `server/package.json` to `0.5.0`, `extension.toml` and `Cargo.toml` to `0.5.0`, `PINNED_SERVER_VERSION` in `src/lib.rs` to `0.5.0`, update `Cargo.lock`; note in `verification.md` that the npm publish, the tag `v0.5.0` and any registry update follow `docs/publishing.md` sections 1 and 4 and are the owner's steps
- [X] T040 Owner finding 2026-10-14 (Zed caches the code action menu per cursor position; the `[x]` marks lag one toggle behind at an unchanged cursor): confirm every selection change with `window/showMessage` Info `Playwright: projects for <config>: <names>` in `server/src/server.ts` `applySelectionChange`, assert it in `server/test/integration/projects.test.ts` (b), (e), (f), document the quirk in `README.md` "Projects", `docs/parity.md` and `contracts/project-selection.md`; the Zed issue is the owner's to file
- [X] T039 Run the full gate: `cargo test && cargo build --release --target wasm32-wasip2` and `cd server && npm run lint && npm test && npm run build`; paste the outcomes into `specs/005-project-selection/verification.md`; run `/speckit-analyze` before opening the PR

---

## Dependencies & Execution Order

- **Phase 1 (T001 to T003)**: no dependencies; T003 is parallel to T001 and T002.
- **Phase 2 (T004 to T012)**: T004, T005, T007 can start at once; T006 needs T004 and T005;
  T008 needs T004 and T007; T009 and T010 need T008; T011 needs T006, T008 and T010; T012 is
  last because the second fixture project only stays green once T011 applies the default.
- **Phase 3 (US1, T013 to T021)**: needs Phase 2 and T001. T013 and T014 are written first
  and in parallel; T015 to T020 follow in order (T018 and T020 can run in parallel after
  T017); T021 closes the phase.
- **Phase 4 (US2, T022 to T026)**: needs Phase 3 (the toggle commands write the store).
  T022 and T023 in parallel; T024 then T025 then T026.
- **Phase 5 (US3, T027 to T032)**: needs Phase 4 (remembered beats settings) and T002.
  T027 and T028 in parallel; T029, T030 in order; T031 after T028; T032 after T030 and T031.
- **Phase 6 (T033 to T039)**: T033 to T036 in parallel after Phase 5; T037 after T036; T038
  after T037; T039 last.

## Parallel Execution Examples

- Phase 2: `T004` (types), `T005` (discovery tests), `T007` (selection tests) together.
- US1: `T013` and `T014` (test files) together, then `T018` and `T020` together after `T017`.
- US2: `T022` (store unit tests) and `T023` (integration cases) together.
- US3: `T027` (server tests) and `T028` (Rust test) together; `T031` (Rust) alongside `T029`
  and `T030` (server), since they touch different packages.
- Polish: `T033`, `T034`, `T035`, `T036` together.

## Implementation Strategy

- **MVP**: Phases 1 to 3. After T021 the developer can pick one, several or all projects and
  runs honour it; the choice is session-only. This already covers spec SC-001, SC-002 and
  SC-004.
- **Increment 2**: Phase 4 adds the per-user memory (SC-003) and completes upstream parity.
- **Increment 3**: Phase 5 adds the Zed settings default and is the only part that touches
  the Rust shell; it can ship later if the extension release needs to wait.
- Every phase ends with `npm run lint && npm test && npm run build` in `server/`; Phase 5
  and the final gate also run `cargo test` and the WASM build.
