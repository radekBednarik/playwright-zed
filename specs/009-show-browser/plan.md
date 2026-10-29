# Implementation Plan: Show Browser

**Branch**: `009-show-browser` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-show-browser/spec.md`

## Summary

Close the "Show browser" and "Close all browsers" parity rows: an in-editor on/off choice
(code action, remembered per user, with a Zed settings default under upstream's name
`reuseBrowser`), runs that connect to one browser kept alive per configuration and reuse
its context, so the window stays open between runs with the last page visible, a "Close
all browsers" action, upstream's coupling rule with "Show trace viewer" (no trace while the
browser is shown), and a stop on toggle off, workspace removal and server exit.

Technical approach (research R1 to R9): the language server spawns one
`<playwrightCli> run-server --path=/<random> --host 127.0.0.1` process per configuration
with `PW_EXTENSION_MODE=1` (upstream's mechanism, verified on Playwright 1.64.0 in the
fixture), starts it from the first run that needs it, reads its endpoint from the
`Listening on` line, and gives every run `PW_TEST_CONNECT_WS_ENDPOINT` and
`PW_TEST_REUSE_CONTEXT=1` in its environment plus `--headed --workers 1 --trace off` on
the command line; the server is stopped with `SIGINT` (SIGKILL fallback); the preference
lives in `show-browser.json` next to `trace-viewer.json` and resolves remembered, then
settings, then off. Server-only change; no Rust. Server and extension ship together as
0.8.0.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server); Rust untouched (the shell
already forwards the whole `lsp.playwright.settings` object)

**Primary Dependencies**: `vscode-languageserver` 9.x (existing); no new npm dependency;
`@playwright/test` >= 1.38 in the user's workspace (`run-server`, `PW_EXTENSION_MODE`,
`PW_TEST_CONNECT_WS_ENDPOINT`, `PW_TEST_REUSE_CONTEXT`, `--headed`, `--workers`, `--trace off`
all predate 1.38; upstream gates the feature at 1.25)

**Storage**: `show-browser.json` in the user's state directory (same resolution,
permissions and write procedure as `trace-viewer.json`); the coupling rule may write
`trace-viewer.json`; the browser and its artifacts belong to Playwright

**Testing**: vitest 5 unit tests with an injected spawn for the browser server manager, the
store, the preference resolution, the run arguments and environment, and the coupling
helpers; integration tests through `TestClient` against `fixtures/sample-project` with
`PW_DEBUG_CONTROLLER_HEADLESS=1` in the server's environment so the kept browser is
headless and no display is needed; manual Zed scenarios in `quickstart.md`, recorded in
`verification.md`

**Target Platform**: Zed stable 1.24.2+ on Linux (owner's verification), macOS and Windows
(the server command and the store are platform-neutral; on Windows the stop is a plain
terminate, research R9); any other LSP client with code actions keeps everything but the
settings default

**Project Type**: Zed extension (Rust/WASM shell, untouched) plus Node language server

**Performance Goals**: the browser server starts once per configuration and is reused; the
window appears within 10 seconds of the first run (SC-001, the endpoint line arrives within
a second and the browser launches on the run's first connection); a stop completes within
5 seconds (SC-003); no extra process while the option is off

**Constraints**: with the option off, run commands, environment and results are
byte-identical to 0.7.0 (FR-012, SC-004); nothing new runs workspace code except the
browser server, which is the workspace's own Playwright started on the developer's explicit
action; the existing 8 Rust and 248 vitest tests keep passing; registry PR #7975 stays at
`v0.7.0` until the owner decides to push the bump

**Scale/Scope**: about 400 lines of server code in one new module (`browser.ts` for the
preference, the coupling helpers and the server manager) plus edits to `store.ts`,
`commands.ts`, `runner.ts`, `spawn.ts`, `types.ts`, `server.ts`; docs and two parity rows;
no CI change

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | Spec cites upstream's `playwright.reuseBrowser` setting, the "Show browser" checkbox with its "one worker" sublabel, the toggle command, the "Close all browsers" action, the `run-server` backend, headed single-worker runs with context reuse, `trace: 'off'` while shown and the `showTrace` reset (read 2026-10-29). Names follow upstream: setting `reuseBrowser`, titles "Show browser" and "Close all browsers". The code-action placement replaces the settings view on a Zed-specific path and is recorded in the parity note. |
| II. Zed extension rules | Pass | No Rust change; nothing bundled; the browser server is the workspace's own Playwright; the store is the server's own data in the user's state directory; no Zed API workaround (two ordinary code actions). |
| III. Native primitives | Pass | Toggle and close are LSP code actions and commands (primitive 3); the default is a Zed setting (primitive 4, named for "show browser" in the constitution); the browser is Playwright's own window launched by Playwright's own server (primitive 5), not re-rendered. |
| IV. Playwright CLI is the runtime | Pass | The kept browser is `playwright run-server`; runs are `playwright test --headed --workers 1 --trace off` connected through Playwright's own environment hooks; nothing about browsers, contexts or reuse is reimplemented; no config file is parsed. The one thing the CLI cannot express (`video: 'off'`) is left to the project's configuration and recorded (research R2). |
| V. Verified behaviour | Pass (planned) | Unit tests (fake spawn) for the manager, store, resolution, arguments, environment and coupling; integration tests for the toggle, store, settings, flags, endpoint, one headless server kept across runs, close during and after a run, toggle off, coupling, and the off state; `cargo test` and the WASM build still run (no Rust change, recorded); quickstart scenarios in Zed recorded in `verification.md` with the commands run. |

Post-design re-check (after research, data model, contract, quickstart): unchanged, all
pass. No Complexity Tracking entries. Two deliberate differences from upstream are recorded
in research R2 and R4: video is not forced off (no CLI switch; Playwright then skips context
reuse on its own for such projects), and the server is not stopped when the browser's last
page closes (no debug-controller protocol; a closed browser is replaced at the next run,
which the spec asks for).

## Project Structure

### Documentation (this feature)

```text
specs/009-show-browser/
├── plan.md              # This file
├── research.md          # Phase 0: R1 to R9
├── data-model.md        # Phase 1: preference, store, BrowserServer, RunRequest additions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── show-browser.md  # Phase 1: delta on the feature 001, 005, 006 and 008 contracts
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── browser.ts        # NEW: resolveBrowserPreference, parseReuseBrowserSetting, BrowserServers (ensure with endpoint parsing and 15 s timeout, stop with SIGINT then SIGKILL, closeFor, closeAll, list, exit handling; injectable spawn)
│   ├── store.ts          # BROWSER_STORE_FILE 'show-browser.json', readBrowserPreference, writeBrowserPreference
│   ├── commands.ts       # COMMAND_TOGGLE_SHOW_BROWSER, COMMAND_CLOSE_ALL_BROWSERS; buildRunArgs(..., trace, showBrowser) appends --headed --workers 1 --trace off
│   ├── runner.ts         # RunManager.start passes showBrowser and the endpoint environment
│   ├── spawn.ts          # unchanged (env option already exists)
│   ├── types.ts          # BrowserPreference, RunRequest.showBrowser and browserEndpoint
│   └── server.ts         # preference load (store + settings), toggle and close commands and code actions, ensure before a run, trace coupling, stop at run end when off, closeFor on workspace removal, closeAll on shutdown and exit; status fields
└── test/
    ├── unit/browser.test.ts          # NEW: manager with fake spawn, resolution, setting parsing
    ├── unit/store.test.ts            # show-browser.json read and write
    ├── unit/commands.test.ts         # the three flags only when on; --trace on never together with them
    ├── unit/runner.test.ts           # endpoint environment on the spawn options
    ├── integration/helpers.ts        # status typing; env option for TestClient.start (PW_DEBUG_CONTROLLER_HEADLESS)
    └── integration/browser.test.ts   # NEW: toggle, store, settings, flags, endpoint, kept server, close, off unchanged, coupling
docs/parity.md                        # two rows -> full (lsp, playwright-ui); feature 008 row note updated
README.md, server/README.md           # toggle, Close all browsers, reuseBrowser setting, store file, run flags, server process
```

**Structure Decision**: server-first in the existing `server/` package, with one new module
`browser.ts` holding the pure parts (resolution, setting parsing, coupling helpers) and the
server manager with an injectable spawn, mirroring `trace.ts`, so everything but the real
browser is unit-testable without a Playwright process. The shell needs nothing: the settings
path is generic since feature 005.

## Design Notes

1. **Preference**: loaded once at `initialized` from the store, then combined with the
   settings object (`reuseBrowser`) per `data-model.md`; `applySettings` re-resolves only
   when the source is `settings` or `default`. Every change is logged and, for a toggle,
   confirmed with the Info message of the contract (Zed's cached menu).
2. **Coupling** (research R6): `toggleShowBrowserCommand` to on checks `tracePreference`;
   when on it writes `trace-viewer.json` with `false`, sets the trace preference to
   remembered off, calls `viewers.closeAll()` and uses the combined message.
   `toggleTraceViewerCommand` to on while the browser is shown appends the parenthetical.
   A run with both on logs the reason and shows the Warning once per combination
   (`bothOnWarnedFor` = `${showBrowser.updatedAt}|${trace.updatedAt}`).
3. **Run start**: `startRun` copies `browserPreference.enabled` into `request.showBrowser`,
   forces `request.trace = false` when true, then awaits `browsers.ensure(config, ws.rootPath)`
   before `manager.start`. On failure: the Error of contract section 5, the run log written
   with status `error`, progress not begun (nothing ran), return. On success:
   `request.browserEndpoint`, the log line, then the run as today; `buildRunArgs` gets
   `showBrowser` and `RunManager.start` adds the two variables to `env`.
4. **Run end**: when `!browserPreference.enabled` and the run was started with
   `showBrowser` (toggle off happened mid-run), `browsers.closeFor(ws.rootPath)` (FR-007).
5. **Browser servers**: keyed by config path; `cwd` is `config.configDir`; the command is
   the config's `playwrightCli`; stdout is scanned line by line for `Listening on `, every
   line of stdout and stderr goes to the log; `ensure` shares one promise while starting;
   an `error`, an `exit` before the endpoint or 15 s without it reject with the command and
   the detail (first stderr line that looks like an error, the spawn error, or "no endpoint
   within 15 s"); a later exit is logged and the entry forgotten. `stop()` sends `SIGINT`
   and arms a 5-second `SIGKILL`. `closeAll(force)` on `shutdown`, `exit` and
   `process.on('exit')` (force); `closeFor(rootPath)` on workspace removal and on toggle
   off; the close command refuses while `managerFor(ws).running` is set.
6. **Code actions**: `Playwright: [x|_] Show browser` right after the trace toggle;
   `Playwright: Close all browsers` when the option is on or `browsers.list(ws.rootPath)`
   is non-empty (research R8).
7. **Tests**: `TestClient.start` gains an `env` option; the browser suite passes
   `PW_DEBUG_CONTROLLER_HEADLESS: '1'`; `playwright/status` exposes the server pids, and
   the tests check liveness with `process.kill(pid, 0)` as the trace suite does. The
   suite leaves the option off and no server behind (`afterAll`).
8. **Docs**: README gains a "Show browser" section mirroring the "Trace viewer" one, the
   Usage table two rows, the Settings block `reuseBrowser`; `server/README.md` one
   paragraph; `docs/parity.md` two rows plus the feature 008 note.
9. **Release**: server 0.8.0 first, then the pin and manifests (lockstep, owner's OK), per
   the procedure in the project memory; registry PR bump is the owner's decision.

## Complexity Tracking

None.
