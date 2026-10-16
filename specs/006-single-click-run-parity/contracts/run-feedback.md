# Contract: Run Feedback (steps, durations, output)

Delta on the feature 001 LSP contract and the feature 005 project-selection contract.

## 1. Server capabilities (initialize result)

```
inlayHintProvider: { resolveProvider: false }
```
added next to the existing `codeActionProvider`, `codeLensProvider` and
`executeCommandProvider`. The server reads `capabilities.window.showDocument.support` from
the client's initialize params and remembers it as `clientShowsDocuments`.

## 2. `textDocument/inlayHint`

Request: standard params (`textDocument.uri`, `range`).
Response: `InlayHint[]`, one per marked line of that document inside `range`, each
`{ position: { line, character: <line length> }, label: string, paddingLeft: true }`.
Documents without marks, documents outside every workspace, and closed documents answer `[]`.
Never an error.

Labels (exact):
- `⌛ waiting…` while any step on the line is executing;
- `<n>ms` after the last step on the line finished, `n` = that step's duration rounded to an
  integer;
- `<n>ms (ran <k>×)` when the line finished `k > 1` times in the latest run.

## 3. `workspace/inlayHint/refresh`

Sent by the server, debounced to at most one per 100 ms, after any change of marks (run
start, step begin or end, test end, run end, cancel, document change). Failure of the request
(client without support) is ignored.

## 4. Step reporter (Playwright side)

CLI change in `buildRunArgs`: `--reporter=list,json,<reporterPath>` where `reporterPath` is
the absolute path of `step-reporter.js` next to the server's built files; the entry is
omitted when the path contains a comma or the file does not exist.

Environment for the child process: `PLAYWRIGHT_ZED_STEP_FILE=<temp dir>/steps-<run id>.jsonl`
in the same owner-only directory as `PLAYWRIGHT_JSON_OUTPUT_FILE`.

Reporter behavior: implements `onTestBegin`, `onStepBegin`, `onStepEnd`, `onTestEnd`;
appends one JSON line per event (schema in `data-model.md`, StepEvent); emits step events
only for steps with a `location`; swallows every error and stops writing after the first
failure; `printsToStdio()` returns `false` so Playwright keeps the list reporter's output.

Server side: polls the file every 200 ms while the child runs, applies complete lines in
order, applies the remainder after exit, then removes the temp directory (existing cleanup).

## 5. Code action `Playwright: Show last run output`

Offered in `textDocument/codeAction` for any served document of a workspace that has a last
run and an output file, only when `clientShowsDocuments` is true. Command
`playwright.showLastRunOutput`, arguments `[{ uri }]`.

Effect: `window/showDocument` request `{ uri: file URI of the log, takeFocus: true }`. A
`success: false` reply produces one Warning message naming the path.

## 6. Run output file

Path: `<stateDir>/runs/<key>.log` (`key` per `data-model.md`). Format:

```
# Playwright run <id> (<trigger>, <target>)
# projects: <a>, <b>
# command: <command line>
# cwd: <configDir>
# status: <running|passed|failed|error|cancelled>
# started: <ISO>   finished: <ISO or ->
# error: <first line of the error>        (only when the run failed to start, FR-008)

<stdout>
<stderr, when non-empty, preceded by a blank line>
[output truncated]        (only when the 10 MB cap applied)
```

Written at run start (header, `status: running`, empty body) and rewritten at run end.
Permissions 0600; the `runs` directory is created with 0700.

## 7. Status request `playwright/status` (test hook, existing)

Gains `marks: { runId, active: [{ file, line, count }], finished: [{ file, line, durationMs, count }] }`
for the workspace (`runId` is the run the marks belong to, null before the first run; the
current run id guard tests read it) and `outputFile: string | null`, so integration tests can
assert marks without an inlay hint round trip.

## 8. Log lines (existing `window/logMessage` channel)

- `playwright: step reporter unavailable (<reason>); step marks and durations are disabled`
  once at startup, and `playwright: run <id> step reporter unavailable (<reason>)` per run,
  when the reporter is skipped;
- `playwright: client does not request inlay hints; step marks will not be shown` once at
  startup when the client advertises no `textDocument.inlayHint` capability;
- `playwright: run <id> superseded, output not written` when a newer run replaced the run
  before it ended (current run id guard);
- `playwright: run <id> output written to <path>` at run end;
- `playwright: run <id> output not offered (client has no showDocument support)` once per run
  when applicable.

## 9. Unchanged

Run commands, `--project` handling, progress, notifications, failure diagnostics, discovery
and trust gates, the project picker. For a client that never requests inlay hints and never
calls the new action, the only visible difference is the extra reporter argument on the
command line, which produces no stdout.
