# Implementation Plan: Show Trace Viewer

**Branch**: `008-show-trace-viewer` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-show-trace-viewer/spec.md`

## Summary

Close the "Show trace viewer" parity row: an in-editor on/off choice (code action, remembered
per user, with a Zed settings default under upstream's name `showTrace`), `--trace on` on
every run while it is on, Playwright's own trace viewer window fed over stdin with the trace
of a single-test run as it starts and as it ends, a "Show trace" action at the cursor after
any run, and a close on toggle off.

Technical approach (research R1 to R9): the language server spawns one
`<playwrightCli> show-trace --stdin` process per configuration and writes trace paths to
its stdin (upstream's mechanism, verified in Playwright 1.64.0); the step reporter already
attached to runs gains the predicted live trace path on `testBegin` and the final attachment
path on `testEnd`, which keeps every load distinct (the viewer ignores a repeated path and
crashes on a missing one, so `.zip` paths are stat-checked first); the JSON report's `trace`
attachments become per-test records for the cursor action; the preference lives in a new
`trace-viewer.json` next to `project-selection.json` and resolves remembered, then
settings, then off. Server-only change; no Rust. Server and extension ship together as
0.7.0.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server); Rust untouched (the shell
already forwards the whole `lsp.playwright.settings` object)

**Primary Dependencies**: `vscode-languageserver` 9.x (existing); no new npm dependency;
`@playwright/test` >= 1.38 in the user's workspace (`show-trace --stdin` and `--trace`
predate 1.38; upstream gates the feature at 1.35)

**Storage**: `trace-viewer.json` in the user's state directory (same resolution,
permissions and write procedure as feature 005's store); trace files stay where Playwright
writes them (`outputDir`, `test-results` by default) and are never touched by the server

**Testing**: vitest 5 unit tests with an injected spawn for the viewer session manager, the
store, the preference resolution, the run arguments, the report extraction and the reporter
fields; integration tests through `TestClient` against `fixtures/sample-project`, one of
them starting the real viewer under a display (WSLg locally, `xvfb-run -a` in CI, self-skip
without a display); manual Zed scenarios in `quickstart.md`, recorded in `verification.md`

**Target Platform**: Zed stable 1.24.2+ on Linux (owner's verification), macOS and Windows
(the viewer command and the store are platform-neutral); any other LSP client with code
actions keeps everything but the settings default

**Project Type**: Zed extension (Rust/WASM shell, untouched) plus Node language server

**Performance Goals**: the viewer starts once and is reused; a trace appears within
10 seconds of the test finishing (SC-001); no extra process while the option is off

**Constraints**: with the option off, run commands and results are byte-identical to 0.6.0
(FR-011, SC-003); nothing new runs workspace code except the viewer, which is the
workspace's own Playwright started on the developer's explicit action; the existing 8 Rust
and 208 vitest tests keep passing; registry PR #7975 stays at `v0.6.0` until the owner
decides to push the bump

**Scale/Scope**: about 350 lines of server code in two new modules (`trace.ts` for the
preference, records and viewer sessions; `trace-store` inside `store.ts`) plus edits to
`commands.ts`, `runner.ts`, `step-reporter.ts`, `spawn.ts`, `types.ts`, `server.ts`,
`reporting.ts`; one CI edit (`xvfb-run`); docs and the parity row

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | Spec cites upstream's `playwright.showTrace` setting, checkbox, toggle command, `trace: 'on'` per run, one `show-trace --stdin` process per config, show on test begin and end for a single test, tree selection for the rest, close on toggle off (read 2026-10-20). Names follow upstream: setting `showTrace`, title "Show trace viewer". The cursor action replaces the Test Explorer tree on a Zed-specific path and is recorded as such in the parity note. |
| II. Zed extension rules | Pass | No Rust change; nothing bundled; the viewer is the workspace's own Playwright; the store is the server's own data in the user's state directory; no Zed API workaround (the "Show trace" action and the toggle are ordinary code actions). |
| III. Native primitives | Pass | Toggle and trace selection are LSP code actions and commands (primitive 3); the default is a Zed setting (primitive 4, named for "show trace viewer" in the constitution); the viewer is Playwright's own UI launched by the extension (primitive 5), not re-rendered. |
| IV. Playwright CLI is the runtime | Pass | Recording is `playwright test --trace on`; the viewer is `playwright show-trace --stdin`; trace locations come from the reporter API and the JSON report; nothing about traces is reimplemented or parsed from config files. |
| V. Verified behaviour | Pass (planned) | Unit tests (fake spawn) for the session manager, store, resolution, arguments, extraction and reporter fields; integration tests for the toggle, store, settings, `--trace on`, records and one real viewer start under a display; `cargo test` and the WASM build still run (no Rust change, recorded); quickstart scenarios in Zed recorded in `verification.md` with the commands run. |

Post-design re-check (after research, data model, contract, quickstart): unchanged, all
pass. No Complexity Tracking entries. One deliberate deviation from upstream is recorded in
research R7: the viewer is not warmed up before a run, because the spec asks that it never
starts without a trace to show.

## Project Structure

### Documentation (this feature)

```text
specs/008-show-trace-viewer/
├── plan.md              # This file
├── research.md          # Phase 0: R1 to R9
├── data-model.md        # Phase 1: preference, store, StepEvent additions, TraceRecord, ViewerSession
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── trace-viewer.md  # Phase 1: delta on the feature 001, 005 and 006 contracts
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── trace.ts          # NEW: resolveTracePreference, extractTraces (report), latestTraceFor, ViewerSessions (start, show with stat guard and dedupe, close, exit handling; injectable spawn)
│   ├── store.ts          # TRACE_STORE_FILE 'trace-viewer.json', readTracePreference, writeTracePreference
│   ├── commands.ts       # COMMAND_TOGGLE_TRACE_VIEWER, COMMAND_SHOW_TRACE; buildRunArgs(..., trace) appends --trace on
│   ├── runner.ts         # RunManager.start passes trace; parseRunReport returns traces (TraceRecord[])
│   ├── step-reporter.ts  # testBegin.traceLive, testEnd.trace
│   ├── spawn.ts          # unchanged for runs; the viewer uses its own small spawn in trace.ts
│   ├── types.ts          # TracePreference, TraceRecord, RunRequest.trace, RunResult.traces, Workspace.traces, StepEvent fields
│   ├── reporting.ts      # no new channel; message helpers reused
│   └── server.ts         # preference load (store + settings), toggle and show-trace commands and code actions, live/final show on step events for single-test runs, records at run end, viewer close on toggle off, workspace removal, shutdown and exit; status fields
└── test/
    ├── unit/trace.test.ts            # NEW: sessions with fake spawn, resolution, extraction, latest record
    ├── unit/store.test.ts            # trace-viewer.json read and write
    ├── unit/commands.test.ts         # --trace on only when on
    ├── unit/runner.test.ts           # traces from a report with attachments
    ├── unit/step-reporter.test.ts    # traceLive and trace fields
    ├── integration/helpers.ts        # status typing; display detection helper
    └── integration/trace.test.ts     # NEW: toggle, store, settings, --trace on, records, off unchanged, real viewer under a display
.github/workflows/ci.yml              # server tests under xvfb-run -a
docs/parity.md                        # row -> full (lsp, playwright-ui), "Show browser" row note
README.md, server/README.md           # toggle, Show trace, showTrace setting, store file, display note
```

**Structure Decision**: server-first in the existing `server/` package, with one new module
`trace.ts` holding the pure parts (resolution, extraction, lookup) and the session manager
with an injectable spawn, so everything but the real window is unit-testable without a
Playwright process. The shell needs nothing: the settings path is generic since feature 005.

## Design Notes

1. **Preference**: loaded once at `initialized` from the store, then combined with the
   settings object (`showTrace`) per `data-model.md`; `applySettings` re-resolves only when
   the source is `settings` or `default`. Every change is logged and, for a toggle,
   confirmed with the Info message of the contract (Zed's cached menu).
2. **Run arguments**: `RunRequest.trace` is captured at `startRun`; `buildRunArgs` appends
   `--trace on` when true. Nothing else about runs changes, so single-click behaviour and
   the run log keep their shape (the log's `command` line simply shows the flag).
3. **Live and final trace for a single-test run**: in the `onStepEvent` callback of
   `startRun`, when `request.trace` is true and `location.kind === 'test'`, a `testBegin`
   with `traceLive` shows that path (no stat; the viewer polls) and a `testEnd` with `trace`
   shows that path (stat first). Both go through `ViewerSessions.show(config, ws, path)`,
   which starts the session on first use. The current run id guard applies.
4. **Records at run end**: `parseRunReport` extracts `TraceRecord[]`; `startRun` stores
   `ws.traces = { runId, records }` when the run is still current. For a single-test run
   without a step reporter, the record with the greatest `finishedAt` is shown here.
5. **Show trace at the cursor**: resolves the test line from the file's discovered tests
   (all projects, so an unselected test with a trace from an earlier selection still
   works), picks the latest record for that file and line, stats the file, shows it. The
   messages of contract section 5 cover the off state, no test, no record, missing file.
6. **Viewer sessions**: keyed by config path; `cwd` is the workspace root (R3), the
   command is the config's `playwrightCli`; stdout and stderr are logged line by line; an
   `error` or an early non-zero `exit` before the first load produces the Error message
   with the command; a later exit is logged and forgotten. `close()` ends stdin and arms a
   5-second SIGTERM. `closeAll()` runs on toggle off, `shutdown`, `exit` and a
   `process.on('exit')` fallback; `closeFor(ws)` on workspace removal.
7. **Outside the root**: before showing, if the path is not within `ws.rootPath`, warn once
   per run (R3) and still send it, so a viewer started in a wider root (monorepo) can work.
8. **CI**: the server job wraps `npm test` in `xvfb-run -a`; the real-viewer test checks
   `DISPLAY` or `WAYLAND_DISPLAY` and skips with a reason otherwise.
9. **Release**: server 0.7.0 first, then the pin and manifests (lockstep, owner's OK), per
   the procedure in the project memory; registry PR bump is the owner's decision.

## Complexity Tracking

None.
