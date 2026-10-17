# Implementation Plan: Attach to Already-Open Spec Files

**Branch**: `007-attach-open-spec-files` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-attach-open-spec-files/spec.md`

## Summary

Answer, per start-up path, whether a spec file that was open before the extension started
serving its workspace is picked up without a reopen, and deliver what the answer allows.
Research (R1 to R7, evidence from Zed 1.24.2 sources at `fb69067` and a message-level
reproduction with the Linux Zed on 2026-10-17) finds that the server needs no change: Zed
sends `didOpen` for every already-open buffer when a matching server starts, and three of
the five paths (first install in a session, server restart, editor restart with restored
tabs) already work, in about half a second after discovery. The remaining path, an update,
reinstall or rerun of `zed: install dev extension` in the same session, is blocked inside
Zed: unloading an extension marks its language server as manually stopped and reloading it
never clears the mark, so no file, open before or after, is served until
`editor: restart language server` or a new Zed session; closing and reopening a file does not
help. The deliverables are a server integration test that replays the editor's sequence for
the working paths, one log line naming the open files served after discovery, the README
instruction and parity notes for the blocked path (with Zed issue #60405), the research and
verification records, and the facts the owner can add to the Zed issue. No Rust change, no
command, argument or setting change.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server test and one log line); Rust shell
untouched; documentation in Markdown

**Primary Dependencies**: `vscode-languageserver` 9.x (`TextDocuments` already tracks open
documents); vitest 5 and the existing `TestClient` for the integration test; no new
dependency

**Storage**: none; the served-files list is derived at discovery end and only logged

**Testing**: new `server/test/integration/attach.test.ts` (open before discovery, empty
lenses, refresh, lenses, log line; three documents; a non-test document); existing suite
unchanged; `cargo test` and the WASM build remain the gate for the untouched shell; manual
Zed scenarios in `quickstart.md` recorded in `verification.md` with the Zed version;
optional message-level evidence through `tools/lsp-tap.js`

**Target Platform**: Zed 1.24.2 (verified) and every release since 1.20.2 that carries the
same re-registration code (R2); any LSP client that sends `didOpen` for pre-open documents
when a server starts gets the same result

**Project Type**: Zed extension (Rust/WASM shell) plus Node language server; this feature
changes the server's tests and one log line, and documentation

**Performance Goals**: served within five seconds of discovery end (SC-001); measured 0.2 s
between the refresh and the lens answer in the reproduction, dominated by Zed's 30 ms lens
debounce and the server's `--list` run

**Constraints**: no change to the run command, project selection, trust and consent gates
(FR-003, FR-005, SC-005); no API workaround for the blocked path (constitution II, III);
registry PR #7975 unaffected until the next lockstep release

**Scale/Scope**: about 15 lines of server code (log line and helper), about 80 lines of
test, README and parity edits, five specification artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | The spec cites the upstream behaviour (VS Code activates the extension for open editors on install, update and reload; no reopen). No new capability; the affected rows ("Run tests with a single click", "Playwright project detection and selection") get a note, their status is unchanged. Nothing beyond upstream is added. |
| II. Zed extension rules | Pass | No Rust change, no bundling, no new filesystem access. The blocked path is recorded as a Zed limitation with source evidence and a linked issue; no attempt to clear Zed's stopped-server mark from the extension (impossible and forbidden). |
| III. Native primitives | Pass | Everything rides on standard LSP: `didOpen`, `textDocument/codeLens`, `workspace/codeLens/refresh`, `window/logMessage` (primitive 3). The reopen workaround is removed from the docs because it does not work; the documented step is Zed's own restart command. |
| IV. Playwright CLI is the runtime | Pass | Discovery and lenses still come from `playwright test --list`; the log line reports which open files map to discovered configs, nothing is parsed from source. |
| V. Verified behaviour | Pass (planned) | Research R5 holds the message-level reproduction with timestamps; the integration test pins the sequence; quickstart scenarios 1 to 6 are the owner's Zed verification, recorded in `verification.md` with the version; the README and parity note change only after the record exists. |

Post-design re-check (after data model, contract, quickstart): unchanged, all pass. No
Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/007-attach-open-spec-files/
├── plan.md              # This file
├── research.md          # Phase 0: verdict table, R1 to R7, reproduction timelines
├── data-model.md        # Phase 1: StartupPath, OpenDocument, transitions
├── quickstart.md        # Phase 1: validation guide (gate, six Zed scenarios)
├── contracts/
│   └── attach.md        # Phase 1: editor sequence, log line, test, documentation
├── tools/
│   └── lsp-tap.js       # evidence tool used in R5 and quickstart scenario 5
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   └── server.ts         # servedOpenFiles(ws) helper; log line after discoverEnabled sends the refresh
└── test/
    └── integration/
        └── attach.test.ts   # NEW: open before discovery, empty lenses, refresh, lenses, log line; three docs; non-test doc
README.md                 # Install section: update/reinstall caveat, restart command, Zed #60405; no reopen advice
docs/parity.md            # two rows: pre-open files served, update caveat, link
.claude/memory/playwright-zed-project.md   # feature state, the reinstall gotcha for the owner's dev loop
```

**Structure Decision**: server tests plus one log line. The `TextDocuments` store already
knows every open document, so the helper is a filter over it and the log line sits next to
the existing "discovered N test(s)" line. The integration test needs no helper change: the
existing `TestClient.start` returns after `initialized`, before discovery, so a test can
open documents at exactly the moment Zed does.

## Design Notes

1. **Log line placement**: in `discoverEnabled(ws)` (or wherever the refresh is sent after
   discovery), compute `servedOpenFiles(ws)` from `documents.all()` through `toPath` and
   `configForFile(ws, file)`, format paths relative to `ws.rootPath`, sort, and log
   `playwright: <n> open file(s) served after discovery: a, b` when `n > 0`. One line per
   discovery run, including re-discovery after a save.
2. **Test timing**: `attach.test.ts` calls `client.open(...)` immediately after
   `TestClient.start(...)` and asserts `codeLenses()` is `[]` before `waitForDiscovery()`.
   Discovery takes seconds (`--list` spawns Playwright), so the race is comfortably on the
   test's side; if it ever flakes, assert "no lens before the refresh notification was
   seen" instead of a fixed `[]`.
3. **Blocked path documentation**: the README sentence must say what to run and that
   reopening does not help; the quickstart scenario 2 re-checks the behaviour on each new
   Zed version so the caveat can be dropped when Zed fixes it. The parity rows keep `full`.
4. **Owner facts for Zed**: research R3 is written so the owner can quote file and line
   references at `fb69067` in a comment on issue #60405 (local variant: any extension
   reload or reinstall, reproduction steps in R5). The agent writes no issue text.
5. **Memory**: record the reinstall gotcha prominently, because the owner's dev loop reruns
   `zed: install dev extension` after every Rust change and then needs
   `editor: restart language server`; this also explains earlier observations.

## Phase 0 and Phase 1 outputs

- `research.md`: verdicts and evidence (R1 to R7), reproduction timelines.
- `data-model.md`: StartupPath (documentation), OpenDocument (derived), transitions.
- `contracts/attach.md`: editor sequence, log line, integration test, documentation.
- `quickstart.md`: automated gate and six manual scenarios.
- `tools/lsp-tap.js`: the tap used for the evidence, reusable by the owner.
