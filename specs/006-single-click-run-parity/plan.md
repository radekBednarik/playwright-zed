# Implementation Plan: Single-Click Run Parity Gaps

**Branch**: `006-single-click-run-parity` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-single-click-run-parity/spec.md`

## Summary

Answer whether the three remaining gaps of the "Run tests with a single click" parity row can
be closed in Zed, and close the ones that can. Research (R1 to R4, evidence from Zed 1.24.2
sources and Playwright 1.64) finds all three deliverable with native LSP surfaces: the
executing step and the per-step durations become inlay hints fed by a step reporter that the
server attaches to the Playwright run and reads live from a file; the run's full output is
written to a log file in the server's state directory and opened in an editor buffer through
`window/showDocument` from a new code action. The row moves to `full` with two recorded
differences (text marker instead of a line background, opt-in settings and a buffer instead
of a panel). No Rust change is needed.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server, all changes); Rust shell unchanged
(no new trait method; capabilities come from the server's initialize result)

**Primary Dependencies**: `vscode-languageserver` 9.x (inlay hints, `window/showDocument`,
`workspace/inlayHint/refresh` are in the library); `@playwright/test` >= 1.38 in the user's
workspace (reporter API: `onStepBegin`, `onStepEnd`, `onTestEnd`, `--reporter <path>`); no
new npm dependency; the step reporter is a dependency-free CommonJS file in `server/dist`

**Storage**: one log file per workspace under `<stateDir>/runs/` (feature 005's state
directory, never the workspace); one short-lived JSON-lines file per run in the existing
owner-only temp directory next to the JSON report; step marks in server memory only

**Testing**: vitest 5 unit tests for the marks store, hint derivation, log formatting and
the reporter (invoked directly with fake `TestStep` objects); integration tests through the
existing `TestClient` against `fixtures/sample-project` (gains a slow multi-step test, a
console-printing test and a helper-file step); `cargo test` and the WASM build stay the
gate for the untouched shell; manual Zed scenarios in `quickstart.md`, recorded in
`verification.md` with the Zed version

**Target Platform**: Zed 1.24.2 or newer (Linux, macOS, Windows); any LSP client with inlay
hints and `showDocument` gets the same behavior; clients without them get release 0.5.1
behavior plus log lines

**Project Type**: Zed extension (Rust/WASM shell) plus Node language server; server-only
change

**Performance Goals**: executing mark visible within one second of the step start (SC-002):
200 ms file polling plus a 100 ms refresh debounce plus Zed's hint fetch; no extra process;
output file write once at start and once at end

**Constraints**: same command line as 0.5.1 apart from the appended reporter entry, which
prints nothing (SC-006); a superseded run never touches the newer run's marks or log (current
run id guard, data-model.md); nothing new runs before the
trust and consent gates; 10 MB cap on the output file; registry PR #7975 unaffected until
the next lockstep release

**Scale/Scope**: about 350 lines of server code (two new modules `marks.ts` and
`step-reporter.ts`, one new `output.ts`, edits to `commands.ts`, `spawn.ts`, `runner.ts`,
`reporting.ts`, `server.ts`, `types.ts`), three fixture tests, docs and parity row

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | Spec cites upstream `src/extension.ts` (`_activeStepDecorationType`, `_completedStepDecorationType`, `onStepBegin`/`onStepEnd`, `testRun.appendOutput`); labels and clearing rules mirror upstream; the output action is the Zed path for the Test Results panel. Nothing beyond upstream is added; the parity row and note are updated (R6). |
| II. Zed extension rules | Pass | No Rust change, no bundling, no new filesystem access by the extension; the server (a user-installed npm package) writes only to its own state directory and to an owner-only temp directory. Inlay hints and `window/showDocument` are standard LSP features Zed supports; no API workaround (R1, R4 evidence). |
| III. Native primitives | Pass | Marks and durations: LSP inlay hints (primitive 3). Output: LSP `window/showDocument` plus code action (primitive 3). Semantic tokens, code lens blocks and Hint diagnostics evaluated and rejected with reasons (R1). Terminal stays `zed-only` through the tasks recipe. |
| IV. Playwright CLI is the runtime | Pass | Step data comes from Playwright's reporter interface through a reporter module, as upstream does; the run command is unchanged apart from the added reporter; output is Playwright's list reporter text. Nothing is parsed from source or timed by the server. |
| V. Verified behaviour | Pass (planned) | Unit tests for every pure rule in `data-model.md`; integration tests through `playwright/status`, `textDocument/inlayHint` and the `showDocument` request; quickstart scenarios 1 to 10 in Zed recorded in `verification.md`; parity row changes only after the record exists. |

Post-design re-check (after data model, contract, quickstart): unchanged, all pass. No
Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/006-single-click-run-parity/
├── plan.md              # This file
├── research.md          # Phase 0: verdicts, R1 to R6
├── data-model.md        # Phase 1: StepEvent, StepMarks, InlayHint, RunOutput, transitions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── run-feedback.md  # Phase 1: capabilities, inlay hints, reporter, action, log file, status hook
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── step-reporter.ts  # NEW: Playwright reporter class, appends StepEvent lines to $PLAYWRIGHT_ZED_STEP_FILE; no imports from the server
│   ├── marks.ts          # NEW, pure: StepMarks store (apply event, clear rules), inlay hint derivation for a document range
│   ├── output.ts         # NEW: run log formatting, path under stateDir()/runs, 10 MB cap, atomic write 0600
│   ├── spawn.ts          # stepFile option, 200 ms poll of the step file, onEvent callback
│   ├── runner.ts         # passes the step file, forwards events, exposes rawOutput as today
│   ├── commands.ts       # buildRunArgs appends the reporter path; COMMAND_SHOW_LAST_RUN_OUTPUT
│   ├── reporting.ts      # refreshInlayHints (debounced), showDocument(uri)
│   ├── types.ts          # StepEvent, StepMarks, Workspace.marks, Workspace.outputFile
│   └── server.ts         # inlayHintProvider, onInlayHint, clientShowsDocuments, marks lifecycle in startRun, didChange clearing, the action and command, status fields
└── test/
    ├── unit/marks.test.ts          # NEW
    ├── unit/output.test.ts         # NEW (temp state dir)
    ├── unit/step-reporter.test.ts  # NEW (fake TestCase/TestStep, temp file)
    ├── unit/commands.test.ts       # reporter argument
    ├── integration/helpers.ts      # inlayHint request, showDocument handler, status marks
    └── integration/feedback.test.ts # NEW: marks during and after a run, hints, clearing on change, output action and file
fixtures/sample-project/tests/
├── slow.spec.ts          # NEW: three test.step calls of ~2 s each, console.log line, uses helpers/steps.ts
├── helpers/steps.ts      # NEW: helper with its own test.step (page-object case)
docs/parity.md            # row -> full with R6 note; tasks recipe row cross-reference
README.md, server/README.md   # inlay_hints setting, action, output file, differences from upstream
```

**Structure Decision**: server-only. The reporter is a separate entry file so Playwright can
load it without pulling the language server's dependencies into the test process, and the
marks logic is pure so every clearing rule is unit-tested without Playwright. The Rust shell
needs nothing: Zed learns about inlay hints from the initialize result, and `showDocument`
is a client capability Zed already advertises.

## Design Notes

1. **Reporter path**: `path.join(__dirname, 'step-reporter.js')` resolved in `commands.ts`
   at module load (`server/dist`), checked with `fs.existsSync`, and skipped with a log line
   when missing or containing a comma. `buildRunArgs` keeps its signature plus an optional
   `reporterPath` so unit tests stay deterministic.
2. **Step file polling**: `runPlaywright` gains `stepFile` and `onStepEvent`; a 200 ms
   interval reads from the last offset, splits on newlines, parses each complete line and
   calls back; the interval stops on `close`, after a final read. Malformed lines are
   dropped silently (the reporter is ours; a partial final line is the only expected case).
3. **Marks lifecycle in `startRun`**: clear marks, write the log header, start the run with
   an event callback that applies events to `ws.marks` and schedules a refresh; at the end
   clear active lines, rewrite the log, refresh once more. Cancelled runs follow the same
   path with `status: cancelled`.
4. **Inlay hints**: `onInlayHint` resolves the document's workspace, reads
   `ws.marks` for the file, and uses `documents.get(uri)` to find each line's length. Lines
   outside the requested range are skipped. Zed asks per visible chunk; the answer is cheap.
5. **Clearing on edit**: the existing `documents.onDidChangeContent` branch that flips the
   dirty flag also drops the file's marks and refreshes. Save does not restore them (upstream
   does not either).
6. **Show output**: the action is offered when `ws.lastRun`, `ws.outputFile` and
   `clientShowsDocuments` are all set. The command sends `window/showDocument`; on
   `success: false` a Warning names the path so the user can open it by hand.
7. **Docs**: README gains an "Inlay hints" setting paragraph beside the code lens one, the
   new action in the command table, and a short "differences from VS Code" note; the parity
   row gets the R6 text; `docs/publishing.md` is untouched (next lockstep release follows the
   existing procedure).
8. **Release**: not part of this feature's tasks. After merge the owner decides the version
   (0.6.0, MINOR: a parity row moves to `full`), publishes the server first and bumps the pin,
   per the recorded lockstep preference.
