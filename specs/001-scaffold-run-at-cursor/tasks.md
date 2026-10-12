---

description: "Task list for Project Scaffold and Run Test at Cursor"
---

# Tasks: Project Scaffold and Run Test at Cursor

**Input**: Design documents from `/specs/001-scaffold-run-at-cursor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle V requires unit tests written before or alongside
pure logic and fixture-backed integration tests before any parity row moves to `partial`.

**Organization**: Tasks are grouped by user story so each story is an independently testable
increment. Two codebases: Rust shell at repository root, Node language server in `server/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1 install and recognise, US2 run at cursor, US3 run file,
  US4 re-run last)
- Every task names the exact file(s) it touches

## Path Conventions

- Rust shell: `extension.toml`, `Cargo.toml`, `src/lib.rs` at repository root
- Language server: `server/src/*.ts`, tests in `server/test/unit/` and `server/test/integration/`
- Fixture: `fixtures/sample-project/`
- Docs: `README.md`, `docs/parity.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create both codebases, the fixture, and the parity matrix so every later task has a
home and a verification target.

- [X] T001 Initialise the repository: `git init`, create `.gitignore` (target/, server/node_modules/, server/dist/, fixtures/sample-project/node_modules/, fixtures/sample-project/test-results/, fixtures/sample-project/playwright-report/), and add `LICENSE` (MIT, year 2026, author Radek Bednarik) at the repository root as Zed requires
- [X] T002 [P] Create the Zed manifest `extension.toml` exactly as specified in `specs/001-scaffold-run-at-cursor/contracts/extension-manifest.md` (id `playwright`, name `Playwright`, version `0.1.0`, schema_version 1, authors, description, repository, `[language_servers.playwright]` with languages TypeScript/TSX/JavaScript and `language_ids`, capabilities `npm:install` for `playwright-zed-language-server`) and `Cargo.toml` (package `playwright-zed`, `crate-type = ["cdylib"]`, `zed_extension_api = "0.7.0"`, license MIT)
- [X] T003 [P] Scaffold the language server package in `server/package.json` (name `playwright-zed-language-server`, version `0.1.0`, `bin` pointing to `bin/playwright-zed-language-server.js`, `files` limited to `bin/` and `dist/`, dependencies `vscode-languageserver@^9`, `vscode-languageserver-textdocument@^1`, devDependencies `typescript@^5`, `vitest@^3`, `@types/node@^20`, scripts `build` = `tsc -p tsconfig.json`, `test` = `vitest run`, `lint` = `tsc --noEmit`), `server/tsconfig.json` (target ES2022, module NodeNext, outDir `dist`, strict), `server/bin/playwright-zed-language-server.js` (requires `../dist/server.js`), and `server/.npmignore`
- [X] T004 [P] Create the fixture project per research R8: `fixtures/sample-project/package.json` (devDependency `@playwright/test`, script `test`), `fixtures/sample-project/playwright.config.ts` (`testDir: './tests'`, single `chromium` project, `reporter: 'list'`), `fixtures/sample-project/tests/passing.spec.ts` (tests `adds numbers`, `handles (parens) [brackets] "quotes"`, `test.describe('math')` containing `same title` and `multiplies`, `test.describe('strings')` containing `same title` and `concatenates`, a single-line `for (const n of [1, 2]) test(`loop ${n}`, ...)` generating two tests on one source line, and `test.skip('skipped on purpose', ...)`, all using `page.setContent` and offline assertions, 9 tests total), `fixtures/sample-project/tests/failing.spec.ts` (one test `fails on purpose` with `expect(1 + 1).toBe(3)`)
- [X] T005 [P] Create `docs/parity.md` with the table columns Capability, Status, Primitive, Note and one row per upstream capability listed in the constitution (install Playwright, project detection and selection, run tests with a single click, watch mode, show browser, close all browsers, show trace viewer, pick locator, breakpoint debugging with locator highlighting, tune locators while paused, record new test, record at cursor), all `not-started`, plus a final row `Terminal output via tasks recipe` with status `zed-only`
- [X] T006 Install toolchains and verify the empty scaffold builds: `rustup target add wasm32-wasip2`, `cargo build --release --target wasm32-wasip2` (with a placeholder `src/lib.rs` that only calls `register_extension!`), `cd server && npm install && npm run build`, `cd fixtures/sample-project && npm install && npx playwright install chromium && npx playwright test --list` (expect 11 tests; 10 before T045 added the fixme test)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Rust shell that launches the server, and the server's workspace, version,
discovery and reporting modules that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Write host unit tests in `src/lib.rs` under `#[cfg(test)]` for `version_differs(installed: Option<&str>, pinned: &str) -> bool` (None differs; equal does not; different does) and `server_entry(workdir: &str) -> String` (returns `<workdir>/node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js`); run `cargo test` and confirm they fail to compile or fail
- [X] T008 Implement the Rust shell in `src/lib.rs` per `contracts/extension-manifest.md`: `struct PlaywrightExtension { server_entry: Option<String>, checked_latest: bool }`, `const PINNED_SERVER_VERSION: &str = "0.1.0"`, `dev_server_entry(worktree)` reading `PLAYWRIGHT_ZED_SERVER_ENTRY` from `worktree.shell_env()`, `node_path(worktree)` using `zed::node_binary_path()` then `worktree.which("node")` with the error text `Node.js was not found on PATH; Playwright needs Node to run`, `language_server_command` that sets installation status (`CheckingForUpdate`, `Downloading`, `None`, `Failed(msg)`), installs via `zed::npm_install_package` only when `npm_package_installed_version` differs from the pin, checks `npm_package_latest_version` at most once per session via `checked_latest`, and returns `Command { command: node, args: [entry, "--stdio"], env: [] }`; never return `Err` for a non-Playwright workspace; `cargo test` and `cargo build --release --target wasm32-wasip2` must pass
- [X] T009 [P] Write `server/test/unit/version.test.ts` then implement `server/src/version.ts`: `parseVersion(s: string): Version | null` (major, minor, patch; prerelease and build metadata ignored), `isSupported(v: Version): boolean` (`>= 1.38.0`), `formatVersion`
- [X] T010 [P] Write `server/test/unit/workspace.test.ts` (temp directories) then implement `server/src/workspace.ts`: `findConfigs(root)` matching `playwright.config.{ts,js,mts,mjs,cts,cjs}` while skipping `node_modules`, `.git`, `test-results`, `playwright-report`; `resolvePlaywright(configDir)` walking upward to the nearest `node_modules/@playwright/test/package.json` and returning `{ playwrightCli: <dir>/cli.js, playwrightVersion }` or null; `buildConfig(configPath)` producing a `PlaywrightConfig` with fields `configPath, configDir, playwrightCli, playwrightVersion, supported, rootDir: null, testDirs: [], tests: [], discoveryState: 'idle'`; `configForFile(workspace, file)` choosing the supported config whose `configDir` is the longest prefix of the file path (FR-014)
- [X] T011 [P] Record a real `--list --reporter=json` output from the fixture into `server/test/fixtures/list-report.json`, write `server/test/unit/discovery.test.ts`, then implement `server/src/discovery.ts`: `runList(config, spawn)` executing `node <playwrightCli> test --list --reporter=json -c <configPath>` with cwd `configDir` and env `PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/playwright-zed-list-<id>.json`, `CI=1`; `parseListReport(json): { rootDir, testDirs, tests: DiscoveredTest[] }` reading `report.config.rootDir` and the unique `report.config.projects[].testDir` values, and flattening `suites[].suites[].specs[]` into `{ file, line, column, title, titlePath, describeLines, projects }` where file-level suites contribute no `describeLines`; cache per config (tests, rootDir, testDirs) with `discoveryState` transitions `idle → running → idle | error` and the CLI message kept on error; temp file deleted after parsing
- [X] T012 [P] Implement `server/src/reporting.ts` with helpers over the LSP connection: `progressBegin(token, n, file)` sending `$/progress` begin with title `Playwright` and message `Running <n> test(s) in <file>`, `progressEnd(token, summary)`, `showInfo/showWarning/showError(message)` via `window/showMessage`, `publishFailures(file, failures)` mapping each `Failure` to a Diagnostic with source `playwright`, severity Error, range at `line`/`column`, message `<title>: <message>`, `clearDiagnostics(files)` sending empty arrays, and `log(line)` via `window/logMessage`
- [X] T013 Implement the server skeleton in `server/src/server.ts`: create the stdio connection, parse `--stdio`, advertise exactly the capabilities in `contracts/lsp-protocol.md` (incremental sync with save, codeActionProvider kinds `source.playwright`, codeLensProvider without resolve, executeCommandProvider with the three command names, workspaceFolders supported), build one `Workspace { rootUri, configs, lastRun: null, versionWarningShown: false }` per folder on initialize and on folder change events, run `findConfigs` and `buildConfig` then `runList` for each supported config, track per-document dirty state (`didOpen`/`didSave` clear it, `didChange` sets it and publishes an empty `playwright` diagnostics array for that file), rediscover on save of a config file or any file under a config's `testDirs`, send `workspace/codeLens/refresh` after discovery, and dispatch `workspace/executeCommand` to a `commands` map returning `null` for unknown commands
- [X] T014 Add `server/test/integration/helpers.ts` that launches `server/bin/playwright-zed-language-server.js` over stdio with `vscode-jsonrpc`, performs `initialize`/`initialized` with a given workspace folder, and exposes `request`, `notify`, and `waitForNotification(method, predicate, timeoutMs)`; confirm `npm run build && npm test` passes with the skeleton

**Checkpoint**: Foundation ready. The server starts, detects the fixture, discovers 10 tests, and
answers code action and lens requests with empty arrays.

---

## Phase 3: User Story 1 - Install and recognise a Playwright workspace (Priority: P1) 🎯 MVP

**Goal**: The extension installs from source, appears in Zed, recognises the fixture as a
Playwright workspace, stays silent in non-Playwright folders, and warns once on Playwright
below v1.38.

**Independent Test**: `zed: install dev extension` on the repository root, open
`fixtures/sample-project`, see the Playwright server running; open a plain TypeScript folder,
see no Playwright affordances and no extension errors in the Zed log.

### Tests for User Story 1

- [X] T015 [P] [US1] Write `server/test/integration/detect.test.ts`: (a) initialize against `fixtures/sample-project`, assert one config with `supported === true`, `playwrightVersion >= 1.38`, `testDirs` containing the fixture `tests` folder, and 10 discovered tests after the first `workspace/codeLens/refresh`; (b) initialize against a temp folder containing only `index.ts`, assert zero projects and that `textDocument/codeAction` and `textDocument/codeLens` return empty arrays; (c) initialize against a temp copy of the fixture whose `node_modules/@playwright/test/package.json` reports version `1.37.1`, assert exactly one `window/showMessage` Warning containing `1.37.1` and `1.38` and that no code actions are returned

### Implementation for User Story 1

- [X] T016 [US1] In `server/src/server.ts`, gate every `textDocument/codeLens` handler and every run action in `textDocument/codeAction` on `configForFile` returning a supported config and on the file being present in that config's discovered `tests`; otherwise return `[]`. The only exception is `Playwright: Re-run last` (US4), which is returned for any document in a workspace whose `lastRun` is set
- [X] T017 [US1] In `server/src/server.ts` and `server/src/workspace.ts`, when a config resolves with `supported === false`, send one `showWarning` per workspace per session using `versionWarningShown` with the text `Playwright <v> found; v1.38 or newer is required. Test running is disabled.`; when no `@playwright/test` package resolves, treat the config as not a Playwright config and log it at info level
- [X] T018 [US1] Write `README.md`: what the extension does, install from the Zed registry (future) and as a dev extension (`zed: install dev extension` on the repo root), the `"code_lens": "on"` setting, the development-only `PLAYWRIGHT_ZED_SERVER_ENTRY` override, supported Playwright versions, and a link to `docs/parity.md`
- [ ] T019 [US1] Run quickstart scenarios 1 to 4 from `specs/001-scaffold-run-at-cursor/quickstart.md` in Zed, record each outcome with the command and observed result in `specs/001-scaffold-run-at-cursor/verification.md`, and set the `docs/parity.md` row `Playwright project detection and selection` to `partial`, primitive `lsp`, note `detects config and version; no project/browser picker yet`

**Checkpoint**: Extension installs, recognises the fixture, stays idle elsewhere, version gate
works.

---

## Phase 4: User Story 2 - Run the test under the cursor (Priority: P1)

**Goal**: One action runs exactly the test, describe, or file at the cursor through the
workspace's Playwright, with progress, a pass/fail notification, diagnostics at failing lines,
and the full output in the language-server log.

**Independent Test**: In `fixtures/sample-project/tests/passing.spec.ts`, place the cursor in
`adds numbers`, ctrl-., Enter; see "1 passed". Repeat in `failing.spec.ts`; see "1 failed" and a
`playwright` diagnostic on the `expect` line.

### Tests for User Story 2

- [X] T020 [P] [US2] Write `server/test/unit/commands.test.ts` covering `resolveTestLocation(tests, file, cursorLine)` with the data-model rules quoted verbatim: "1. If a DiscoveredTest in that file has `line` equal to the cursor line, or the cursor lies within that test's span, kind = `test`. A test's span starts at its title line and ends on the line before the next test or describe title line in the same file; the last test's span extends to the end of the file. 2. Else if the cursor line equals one of any test's `describeLines`, kind = `describe`. 3. Else kind = `file`." with boundary cases: cursor on the line before the first test (file), on a blank line between two tests (previous test), after the last test to EOF (last test), on the line right after a describe title but before its first test (file); plus an assertion that a 0-based lens line (`test.line - 1`) passed through `runAtCursor` resolves the same test; plus `buildRunArgs(location, config)` producing `test <relative file>[:<line>] -c <configPath> --reporter=list,json` with the file relative to `configDir`
- [X] T021 [P] [US2] Record a real failing and passing `--reporter=json` run output from the fixture into `server/test/fixtures/run-report-pass.json` and `server/test/fixtures/run-report-fail.json`, write `server/test/unit/runner.test.ts` for `parseRunReport` (stats `expected, unexpected, skipped, flaky`; one `Failure { file, line, column, title, message }` per spec with `ok === false`, using `error.location` when present else the spec position, message = ANSI-stripped first line of `error.message`, fullMessage = ANSI-stripped complete `error.message`) and `mapExitCode`; add a hand-written `server/test/fixtures/run-report-no-browser.json` whose error message spans several lines and ends with an `npx playwright install` hint, asserting `fullMessage` keeps every line (0 passed, 1 failed, other with no report = error)
- [X] T022 [P] [US2] Write `server/test/integration/run.test.ts` against the fixture: (a) `playwright.runAtCursor` on the `adds numbers` line yields `$/progress` begin then end and a `window/showMessage` Info containing `1 passed`; (b) on the failing test yields an Error message containing `1 failed` and a `publishDiagnostics` for `failing.spec.ts` with one diagnostic whose range starts on the `expect` line and whose message contains `toBe`; (c) on the `test.describe('math')` line runs exactly 2 tests; (d) on each `same title` test runs exactly 1 test; (e) on the parens/brackets/quotes title runs exactly 1 test; (f) issuing a second `runAtCursor` while one is running yields a Warning for the cancelled run and diagnostics that reflect only the second run; (g) on line 1 runs all 9 tests with summary `8 passed` and `1 skipped`; (h) a `didChange` without `didSave` before a run yields a Warning containing `unsaved changes`; (i) on the `for` line generating `loop 1` and `loop 2` runs exactly 2 tests; (j) on the `test.skip` line yields a summary with `1 skipped`, `0 failed` and no diagnostics; (k) a `didChange` on `failing.spec.ts` after a failed run publishes an empty diagnostics array for that file

### Implementation for User Story 2

- [X] T023 [US2] Implement `server/src/commands.ts`: `resolveTestLocation` and `buildRunArgs` as tested in T020; if T022 case (c) shows that `file:line` on a describe line does not select nested tests, add `buildGrepArgs` using a regex-escaped full `titlePath` joined by spaces and use it for kind `describe` only, then record the outcome in `docs/parity.md`
- [X] T024 [US2] Implement `server/src/runner.ts`: `startRun(request)` spawning `node <playwrightCli> <args>` with cwd `configDir`, env `PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/playwright-zed-run-<id>.json` and `FORCE_COLOR=0`, capturing stdout and stderr into `rawOutput`, recording the exact `command` string, enforcing one running request per workspace by moving the running one to `cancelled` with SIGTERM then SIGKILL after 5 s, parsing the JSON report on exit via `parseRunReport`, deleting the temp file, and resolving a `RunResult` with status `passed | failed | cancelled | error`
- [X] T025 [US2] Wire `playwright.runAtCursor` in `server/src/server.ts`: arguments `[{ uri, line }]` (0-based line converted to 1-based), resolve the project and location, warn `<file> has unsaved changes; running the saved version` when the document is dirty, set `workspace.lastRun`, call `clearDiagnostics` for the target file, `progressBegin`, `startRun`, then on completion `progressEnd` with `<expected> passed, <unexpected> failed, <skipped> skipped`, `showInfo` on `passed`, `showError` on `failed` with the summary followed by the first failure's `fullMessage` (all lines, so browser-install hints survive), `showError` on `error` with the attempted command line and the underlying error (FR-013), `showWarning` on `cancelled`, `publishFailures` per file, and `log` the command line, cwd and `rawOutput`; always return `null`
- [X] T026 [US2] Add code actions in `server/src/server.ts`: for kind `test` return `Playwright: Run test at cursor`, for kind `describe` return `Playwright: Run describe at cursor`, each with kind `source.playwright` and a `command` of `playwright.runAtCursor` carrying `{ uri, line }`, ordered most specific first
- [X] T027 [US2] Add code lenses in `server/src/server.ts`: one lens per `DiscoveredTest.line` titled `▶ Run test` and one per unique describe line titled `▶ Run describe`, each with a populated `playwright.runAtCursor` command whose `line` argument is 0-based (`test.line - 1`, `describeLine - 1`) because the command contract uses LSP line numbering while discovery stores Playwright's 1-based lines; confirm `workspace/codeLens/refresh` fires after every discovery
- [ ] T028 [US2] Run quickstart scenarios 5 to 10 and 15 to 19 in Zed, append outcomes to `specs/001-scaffold-run-at-cursor/verification.md`, and set the `docs/parity.md` row `Run tests with a single click` to `partial`, primitive `lsp`, note `run at cursor, describe, file, re-run; no line highlighting, no step durations, extension-driven runs cannot reach the terminal panel (extension LSP adapters cannot schedule Zed tasks)`

**Checkpoint**: Run at cursor works end to end with results visible in Zed.

---

## Phase 5: User Story 3 - Run the whole test file (Priority: P2)

**Goal**: A "Run file" action runs every test in the current test file; non-test files offer
nothing.

**Independent Test**: ctrl-. in `passing.spec.ts`, choose `Playwright: Run file`, see a summary
of 9 results (8 passed, 1 skipped); ctrl-. in `playwright.config.ts` shows no Playwright run
actions.

### Tests for User Story 3

- [X] T029 [P] [US3] Extend `server/test/integration/run.test.ts` with a `runFile` block: `playwright.runFile` on `passing.spec.ts` reports `8 passed` and `1 skipped`; `textDocument/codeAction` on `playwright.config.ts` returns no action whose title starts with `Playwright:`

### Implementation for User Story 3

- [X] T030 [US3] Implement `playwright.runFile` in `server/src/server.ts` and `server/src/commands.ts`: arguments `[{ uri }]`, location kind `file` (no `:line`), trigger `file`, same reporting path as T025; add the code action `Playwright: Run file` after the cursor-specific actions for every discovered test file
- [ ] T031 [US3] Run quickstart scenarios 11 and 12 in Zed and append outcomes to `specs/001-scaffold-run-at-cursor/verification.md`

**Checkpoint**: File-level runs work alongside cursor runs.

---

## Phase 6: User Story 4 - Re-run the last test run (Priority: P3)

**Goal**: A "Re-run last" action repeats the previous selection from anywhere; with no history
it says so.

**Independent Test**: Run a test at cursor, move to another file, ctrl-., `Playwright: Re-run
last`; the same test runs. In a fresh session the action is absent and the command reports
"Nothing to re-run yet".

### Tests for User Story 4

- [X] T032 [P] [US4] Extend `server/test/integration/run.test.ts` with a `rerunLast` block: after a cursor run, `playwright.rerunLast` runs the same single test (summary `1 passed`); on a fresh server `playwright.rerunLast` yields an Info message `Nothing to re-run yet` and `textDocument/codeAction` contains no `Playwright: Re-run last` action until a run has happened; after a run, `textDocument/codeAction` on `playwright.config.ts` (not a test file) contains `Playwright: Re-run last` and no other `Playwright:` action

### Implementation for User Story 4

- [X] T033 [US4] Implement `playwright.rerunLast` in `server/src/server.ts`: arguments `[]` or `[{ uri }]`, repeat `workspace.lastRun` with trigger `rerun` through the T025 path, else `showInfo('Nothing to re-run yet')`; add the code action `Playwright: Re-run last` for any document in the workspace whenever `workspace.lastRun` is set, bypassing the test-file gate from T016
- [ ] T034 [US4] Run quickstart scenarios 13 and 14 in Zed and append outcomes to `specs/001-scaffold-run-at-cursor/verification.md`

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, publishing readiness, and final verification across stories.

- [X] T035 [P] Add the terminal-output recipe from `quickstart.md` to `README.md` under "Terminal output (optional)" with the `~/.config/zed/tasks.json` snippet tagged `js-test`, `ts-test`, `tsx-test`, and mark the `docs/parity.md` row `Terminal output via tasks recipe` as `zed-only`, primitive `tasks`
- [X] T036 [P] Write `docs/publishing.md`: the `zed-industries/extensions` submodule steps, the `extensions.toml` entry (`[playwright] submodule = "extensions/playwright" version = "0.1.0"`), `pnpm sort-extensions`, the one-extension-per-PR and three-open-PRs rules, the three-week response rule, the npm publish step for `server/` that must precede the Zed PR because the pin in `src/lib.rs` must resolve, and the id fallback `playwright-lsp` from research R9
- [X] T037 [P] Audit every user-facing string in `server/src/*.ts` and `src/lib.rs` for English-only text and for the rule that every start failure names the attempted command; audit `extension.toml` against the Zed prerequisites checklist (id without `zed`/`extension`, required fields, license at root, no bundled binaries, no slash commands)
- [X] T038 Run the full automated verification from `quickstart.md`: `cargo test`, `cargo build --release --target wasm32-wasip2`, `cd server && npm run lint && npm test && npm run build`, `cd fixtures/sample-project && npx playwright test --list`; paste the commands and their final output lines into `specs/001-scaffold-run-at-cursor/verification.md`
- [X] T039 Simplification pass over `server/src/` and `src/lib.rs`: remove dead code, collapse duplicated spawn and parsing logic between `discovery.ts` and `runner.ts` into a shared `server/src/spawn.ts` if both still carry their own, and re-run `npm test` and `cargo test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (repository exists); T002 to T005 in parallel; T006 after all of them
- **Foundational (Phase 2)**: depends on Phase 1. T007 before T008. T009, T010, T011, T012 in parallel after T003. T013 after T009 to T012. T014 after T013. Blocks all stories.
- **User Story 1 (Phase 3)**: depends on Phase 2. T015 may be written in parallel with T016 and T017; T018 is independent; T019 last.
- **User Story 2 (Phase 4)**: depends on Phase 2. Does not depend on US1 tasks, but T016 (gating) must exist for T022 case assertions on non-test files; T020, T021, T022 in parallel; T023 and T024 after T020 and T021; T025 after T023, T024; T026, T027 after T025; T028 last.
- **User Story 3 (Phase 5)**: depends on T025 (shared reporting path). T029 then T030 then T031.
- **User Story 4 (Phase 6)**: depends on T025. T032 then T033 then T034.
- **Polish (Phase 7)**: depends on all desired stories. T035, T036, T037 in parallel; T038 then T039.

### User Story Dependencies

- **US1**: independent once Phase 2 is done.
- **US2**: independent of US1 except the gating handler T016, which is a Phase 3 task that US2 tests assume; if US2 is built first, do T016 first.
- **US3**: builds on the US2 run path (T025). Independently testable through `runFile`.
- **US4**: builds on the US2 run path (T025). Independently testable through `rerunLast`.

### Within Each User Story

- Unit and integration tests are written first and must fail before implementation
- Pure modules (`commands.ts`, `runner.ts`) before wiring in `server.ts`
- Wiring before code actions and lenses
- Manual quickstart scenarios and the parity matrix update close each story

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 (four different file sets)
- Phase 2: T009, T010, T011, T012 (four server modules with their own tests)
- Phase 3: T015, T018 alongside T016/T017
- Phase 4: T020, T021, T022 (three test files) before implementation
- Phase 7: T035, T036, T037
- US3 and US4 can be built by different people after T025 lands

---

## Parallel Example: User Story 2

```bash
# Write all US2 tests together (different files, all must fail first):
Task: "Write server/test/unit/commands.test.ts for resolveTestLocation and buildRunArgs"
Task: "Record run reports and write server/test/unit/runner.test.ts for parseRunReport and mapExitCode"
Task: "Write server/test/integration/run.test.ts cases (a) to (h) against the fixture"

# Then implement the two pure modules together:
Task: "Implement server/src/commands.ts"
Task: "Implement server/src/runner.ts"

# Then wire sequentially:
Task: "Wire playwright.runAtCursor in server/src/server.ts"
Task: "Add code actions" ; Task: "Add code lenses"
```

---

## Implementation Strategy

### MVP First (User Story 1, then User Story 2)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1): the extension exists, installs, detects
3. **STOP and VALIDATE** with quickstart scenarios 1 to 4
4. Complete Phase 4 (US2): run at cursor is the upstream core action
5. **STOP and VALIDATE** with quickstart scenarios 5 to 10 and 15 to 17; this is the demoable MVP

### Incremental Delivery

1. Setup + Foundational: server starts and discovers tests
2. US1: installable, recognising extension (parity row 2 to `partial`)
3. US2: run at cursor (parity row 3 to `partial`), MVP
4. US3: run file
5. US4: re-run last
6. Polish: docs, publishing readiness, full verification

### Parallel Team Strategy

1. Everyone: Phase 1 and Phase 2
2. Developer A: US1 (T015 to T019); Developer B: US2 tests and pure modules (T020 to T024)
3. After T025: Developer A takes US3, Developer B takes US4
4. Polish together

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks
- Integration tests need `npx playwright install chromium` in `fixtures/sample-project` once
- Manual Zed verification (T019, T028, T031, T034) needs a reachable Zed install; this WSL
  environment has none on PATH
- Never bundle the server into the extension; the pin in `src/lib.rs` must point at a published
  npm version before the registry PR (T036)
- Record every verification with the command and its output; skipped checks are stated as skipped

## Status 2026-10-12

- T001 to T018, T020 to T027, T029, T030, T032, T033, T035 to T039: done, see
  `verification.md`.
- T019, T028, T031, T034 (manual quickstart scenarios in Zed): **open**. Their non-manual
  parts are done: `docs/parity.md` rows updated, `README.md` written, `verification.md`
  created with the automated record. The Zed GUI scenarios need a developer at the editor.

## Phase 8: Convergence

**Purpose**: Gaps found by `/speckit-converge` on 2026-10-12 after the first implement pass.
Ordered by severity. Existing open tasks T019, T028, T031, T034 (manual Zed scenarios) remain
the record for manual verification and are not duplicated here.

- [X] T040 Remove the `fs::metadata` existence check on the `PLAYWRIGHT_ZED_SERVER_ENTRY` override in `src/lib.rs` (`resolve_server_entry`): Zed's WASI sandbox preopens only the extension work directory (`crates/extension_host/src/wasm_host.rs`, `build_wasi_ctx`), so any path outside it reports "does not exist" and the override never works. Pass the override path through unchanged and let Node's own "Cannot find module" error surface via Zed's language server status; keep the unit tests for `dev_server_entry_from_env`, re-run `cargo test` and the `wasm32-wasip2` build, and note the sandbox rule in `contracts/extension-manifest.md` per plan: research R4 / quickstart dev override (contradicts)
- [ ] T041 Publish `playwright-zed-language-server@0.1.0` to npm from `server/` following `docs/publishing.md` step 1 (`npm run lint && npm test && npm run build && npm publish --access public`), after explicit approval from the repository owner since this is an outward-facing release under their npm account; until it exists every TypeScript worktree without the dev override logs an npm install failure for the pinned version in `src/lib.rs` per plan: research R4 / Constitution II (missing)
- [X] T042 Add an integration test in `server/test/integration/detect.test.ts` that initialises the server with two workspace folders, `fixtures/sample-project` and a temp folder containing only `index.ts`, and asserts `playwright/status` reports one config for the fixture and none for the other, code lenses appear only in the fixture's test files, and no warning is shown; this covers the spec edge case "several root folders and only some contain Playwright" per spec: Edge Cases (partial)
- [X] T043 Make `notPlaywright` in `server/src/server.ts` distinguish an unsupported Playwright version from a missing one: when `configForFile` finds no supported config but a config with `supported === false` covers the file, show the version message (`Playwright <v> found; v1.38 or newer is required. Test running is disabled.`) instead of "Playwright was not found"; add an integration assertion in the old-version test that `playwright.runAtCursor` on the copied test file yields that warning per FR-005 / US1 scenario 4 (partial)
- [X] T044 Align the progress token with `contracts/lsp-protocol.md`, which says the `$/progress` token is the run request id: in `server/src/reporting.ts` create the token explicitly with `WorkDoneProgressCreateRequest` using `request.id` and send `$/progress` with `connection.sendProgress(WorkDoneProgress.type, token, ...)` instead of the library-generated UUID from `createWorkDoneProgress`, or, if Zed rejects reused string tokens, update the contract to say the token is server-generated; assert the token in `server/test/integration/run.test.ts` case (a) per contract: lsp-protocol notifications (partial)
- [X] T045 Cover the `test.fixme` / `test.only` edge case: add `test.fixme('fixme on purpose', ...)` to `fixtures/sample-project/tests/failing.spec.ts`, assert in `server/test/integration/run.test.ts` that running it at cursor reports `0 passed, 0 failed, 1 skipped` with no diagnostics, and update the counts that change (fixture `--list` total 10 to 11 in `quickstart.md`, `T006`, `detect.test.ts` discovery count and failing-file lens count, `data-model`/`research` R8 fixture description) per spec: Edge Cases (`test.skip`, `test.fixme`, `test.only`) (partial)

### Phase 8 status 2026-10-12

- T040, T042, T043, T044, T045: done, 72 server tests and 7 Rust tests pass.
- T041 (npm publish): **open, awaiting the repository owner's approval**. Outward-facing.
