# Research: Single-Click Run Parity Gaps

**Feature**: 006-single-click-run-parity | **Date**: 2026-10-16

Evidence baseline: Zed 1.24.2 (commit `fb69067729cb16a7f6135e2c1600c26a28c59659`, tag
`v1.24.2`, the owner's installed stable; sparse clone inspected locally), Playwright 1.64.0
(installed in `fixtures/sample-project`), upstream playwright-vscode `src/extension.ts` on
`main` (2026-10-16). File references below are paths inside those repositories.

## Verdicts (spec FR-001)

| Gap | Verdict | Surface | Evidence |
|-----|---------|---------|----------|
| Executing-line highlight | deliverable (as a text marker, not a line background) | LSP inlay hints + `workspace/inlayHint/refresh` | R1, R2 |
| Per-step durations | deliverable | LSP inlay hints, same stream | R1, R2, R3 |
| Run output inside the editor | deliverable | `window/showDocument` on a log file written by the server, reached through a code action | R4 |

All three are deliverable with native LSP surfaces that Zed renders, so no row is `blocked`.
Two differences from upstream remain and are recorded in the parity note: Zed has no
decoration API, so the executing mark is trailing text instead of a line background; both
Zed surfaces are opt-in (`inlay_hints.enabled`, like `code_lens` today), and the output opens
as an editor buffer rather than a panel.

## R1. How can a language server mark a line in Zed 1.24.2?

**Decision**: inlay hints. The server declares `inlayHintProvider`, answers
`textDocument/inlayHint` for the requested range with one hint per marked line, positioned at
the end of the line, `paddingLeft: true`, no `kind`, and sends `workspace/inlayHint/refresh`
whenever marks change.

**Rationale** (Zed source):
- Zed requests inlay hints from every server that reports `inlayHintProvider` for the buffer,
  not only the primary one: `crates/project/src/lsp_store.rs` `inlay_hints()` (line 8713)
  builds `current_servers` from `language_server_ids_for_request` and queries each; hints from
  TypeScript's server and this server coexist.
- `workspace/inlayHint/refresh` is handled (`lsp_store.rs` line 1135) and reaches the editor
  as `InlayHintRefreshReason::RefreshRequested { server_id }`
  (`crates/editor/src/editor.rs` line 2109), which invalidates only that server's cached hints
  (`crates/editor/src/inlays/inlay_hints.rs` line 603,
  `InvalidationStrategy::RefreshRequested`) and refetches the visible ranges.
- Hints without a `kind` are "other hints", shown when `show_other_hints` is true, which is
  the default (`crates/language/src/language_settings.rs` line 482,
  `enabled_inlay_hint_kinds`; `crates/settings_content/src/language.rs` lines 918 to 921).
- Inlay hints are off by default: `InlayHintSettingsContent.enabled` "Default: false"
  (`crates/settings_content/src/language.rs` line 902). Documented in
  `docs/src/configuring-languages.md` "Inlay Hints". The README must add
  `"inlay_hints": { "enabled": true }` next to the existing `"code_lens": "on"` note.
- Zed has no decoration or line-background API for language servers or extensions; the
  closest upstream element, the trailing `after.contentText`, maps one to one onto an inlay
  hint label at the end of the line.

**Alternatives considered**:
- *Semantic tokens*: supported in 1.24.2 (`crates/project/src/lsp_store/semantic_tokens.rs`,
  `crates/editor/src/semantic_tokens.rs`) but off by default
  (`semantic_tokens: "off"`, `crates/settings_content/src/language.rs` line 666) and they
  recolor existing text through syntax styles; they cannot add a marker or a background.
  Using them to "highlight" a line would be a misuse of a highlighting channel. Rejected.
- *Code lens*: already used for run buttons; Zed renders lenses as a block above the line
  (`crates/editor/src/code_lens.rs`, `BlockPlacement`), so a lens per executing or finished
  step would insert a line above every step and shift the text while the run is watched.
  Rejected for marks; the run lenses stay.
- *Hint-severity diagnostics*: rendered (`crates/editor/src/display_map.rs` line 2513) but
  every diagnostic is counted in the status bar and listed in the diagnostics view, and a
  squiggle on a span is not an end-of-line marker. Rejected.
- *Document highlight*: only on the cursor position. Rejected.

## R2. How do step events reach the server while the run is in progress?

**Decision**: a step reporter shipped with the server (`server/src/step-reporter.ts`, built
to `server/dist/step-reporter.js`, CommonJS, no dependencies) is appended to the existing
reporter list: `--reporter=list,json,<absolute path to step-reporter.js>`. The reporter
writes one JSON object per line to the file named by the environment variable
`PLAYWRIGHT_ZED_STEP_FILE`, which the server places in the same owner-only temporary
directory it already creates for the JSON report. The server polls that file every 200 ms
while the process runs, parses complete lines, reads the remainder on exit and removes the
directory as today.

**Rationale**:
- Playwright resolves a non-builtin `--reporter` entry as a path: `resolveReporter` in
  `lib/cli/testActions.js` line 204 returns `path.resolve(process.cwd(), id)` when it exists,
  and `loadReporter` (`lib/runner/index.js` line 2727) resolves against `rootDir`; an
  absolute path is unaffected by both. The reporter runs in Playwright's main process, so
  file appends are ordered.
- `onStepBegin` and `onStepEnd` receive `TestStep` with `location`, `duration`, `category`,
  `title`, `parent` (`types/testReporter.d.ts`); `onTestEnd` gives the test's final status.
  All exist in every version the extension supports (1.38 and newer).
- This is upstream's own mechanism (upstream attaches its reporter listener to the same
  events); it reads Playwright's reporting and reimplements nothing (constitution IV).
- A file plus polling was chosen over an extra pipe on file descriptor 3 because the pipe
  approach depends on Node's inheritance of extra stdio handles, which is not uniform on
  Windows, and over stdout prefixes because stdout is the user-visible output (R4) and must
  stay untouched. 200 ms polling keeps the mark within the one-second budget of SC-002.
- `--add-reporter` (present in 1.64) would keep the user's configured reporters, but the run
  already replaces them with `list,json`; `--add-reporter` is newer than 1.38 and is not used.

**Edge rules**: the reporter file path must not contain a comma (Playwright splits the
option on commas); when it does, or when the reporter cannot be found or fails to load, the
run proceeds without step events and the server logs one line (FR-010). The reporter never
throws: every write is wrapped and a failure disables it for the rest of the run.

**Event schema**: see `contracts/run-feedback.md`.

## R3. Which steps are marked, and when are marks cleared?

**Decision**: mirror upstream. Only steps with a `location` are tracked, any category.
`stepBegin` adds the line to the active set of its file; `stepEnd` removes it and records the
duration; `testEnd` clears the test's remaining active lines; run end or cancel clears every
active line. Durations accumulate per file and line (`count`, last `duration`), survive the
run's end, and are dropped for a file on its first content change after the run and for all
files when the next run starts. They are kept in server memory, so closing and reopening an
unedited file shows them again (Zed asks for inlay hints on open).

**Rationale**: upstream `_activeSteps` / `_completedSteps`, cleared in `onTestEnd`, at run
start and in `onDidChangeTextDocument`. The server already tracks `didChange` per document
for the dirty flag, so the clearing hook exists.

**Label text**: executing `⌛ waiting…`; finished `<n>ms`, `<n>ms (ran <k>×)` when the line
ran more than once. Labels contain no dash so they read the same in every font.

## R4. How does the run output get into the editor?

**Decision**: the server writes the complete output of each run started by a click to
`<stateDir>/runs/<workspace key>.log` (header: run id, command, cwd, projects, status,
started and finished times; body: stdout then stderr exactly as captured, ANSI already
disabled by `FORCE_COLOR=0`; a final line when the run was cancelled or truncated). The code
action **Playwright: Show last run output** sends `window/showDocument` with that file's URI
and `takeFocus: true`. Zed opens the file as a non-project item.

**Rationale** (Zed source):
- Zed advertises `window.showDocument.support: true` (`crates/lsp/src/lsp.rs` line 1147),
  handles the request (`crates/project/src/lsp_store.rs` line 1256) and opens the path with
  `workspace.open_abs_path(..., OpenVisible::None, focus: take_focus)`
  (`crates/editor/src/items.rs` `handle_lsp_show_document`, line 2522), honoring an optional
  `selection`. A path outside every worktree is allowed; `OpenVisible::None` keeps it out of
  the project panel.
- The buffer tracks the file on disk, so a subsequent run that rewrites the file updates an
  already open tab.
- The state directory is the server's own, per-user data location already used by feature
  005 (`server/src/store.ts`); nothing is written into the workspace.
- Following references: Zed resolves file paths under the pointer in any buffer
  (`crates/editor/src/hover_links.rs` `find_file`) and offers `editor::OpenSelectedFilename`;
  Playwright's list reporter prints `file:line:column` references, which these accept.
- Two interactions: `ctrl-.` then the action (SC-004). The action is offered only while the
  client reports `showDocument` support and a last run exists for the workspace; otherwise
  the file is still written and its path is logged once per run.

**Alternatives considered**:
- *Zed terminal or task*: not reachable from a language server (parity note, feature 001).
  The `zed-only` tasks recipe stays the terminal path.
- *Language server log*: status quo; mixes runs and server chatter and needs the log command.
- *Virtual document (`untitled:` or custom scheme)*: `handle_lsp_show_document` rejects
  non-file URIs. Rejected.
- *Streaming the output into the file during the run*: deferred; the header is written at
  run start and the body at run end, which already satisfies the spec. Live append is a
  possible later increment and needs only an output callback in `runPlaywright`.
- *A button on the failure notification*: would be one interaction but upstream has no such
  button; the code action matches the existing command surface.

## R5. Degradation matrix (FR-010)

| Condition | Behavior |
|-----------|----------|
| Client without `inlayHintProvider` use (never requests hints) | Marks are computed but never shown; no cost beyond memory. |
| Zed with `inlay_hints.enabled` false (default) | Same as above; README documents the setting. |
| Reporter cannot be attached (comma in path, load error, file missing) | Run proceeds; no marks; one log line `playwright: step reporter unavailable (<reason>)`. |
| Client without `window.showDocument` support | Output file still written; action not offered; one log line per run with the path. |
| Output over 10 MB | File holds the first 10 MB and a final `[output truncated]` line; the log keeps everything as today. |
| Server or editor restarted mid-run | Marks live in memory and vanish; the log file holds the header only. |
| Client that does not advertise `textDocument.inlayHint` | Marks are computed but never requested; one log line at startup `playwright: client does not request inlay hints; step marks will not be shown`. Zed advertises the capability even with `inlay_hints.enabled` false, so that case is covered by the README only. |
| Run superseded by a newer run during its kill grace | Its late events, `endRun` and final log rewrite are ignored (current run id guard); the log line records `superseded`. |

## R6. Parity row wording after delivery

"Run tests with a single click" moves to `full`, primitive `lsp`, with the note: executing
step and durations as inlay hints (`inlay_hints.enabled` required; text marker instead of
upstream's line background, Zed has no decoration API); run output in an editor buffer opened
by `window/showDocument` from **Playwright: Show last run output** (upstream: Test Results
panel); the tasks recipe row remains the terminal alternative. The status is the plan's
proposal; the owner confirms it when the verification record is complete.
