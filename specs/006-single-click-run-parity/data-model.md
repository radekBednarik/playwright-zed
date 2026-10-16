# Data Model: Single-Click Run Parity Gaps

Extends the feature 001 and 005 models in `server/src/types.ts`. All paths are absolute,
lines are 1-based unless stated.

## GapVerdict (documentation only)

Recorded in `research.md`, not in code. Fields: gap, verdict (`deliverable` | `blocked`),
surface, evidence (file and line in the inspected sources), editor version, date.

## StepEvent (reporter to server, one JSON object per line)

| Field | Type | Notes |
|-------|------|-------|
| `type` | `'testBegin' \| 'stepBegin' \| 'stepEnd' \| 'testEnd'` | |
| `test` | `{ file, line, column, title, project }` | the owning test; `project` may be `''` |
| `step` | `{ id, title, category, file, line, column }` | absent for test events; only steps with a location are emitted |
| `duration` | number (ms) | `stepEnd` only |
| `status` | string | `testEnd` only (`passed`, `failed`, `timedOut`, `skipped`, `interrupted`) |
| `at` | number | ms since epoch, for ordering and the log |

`step.id` is the reporter's counter per run; it links `stepEnd` to `stepBegin` when titles
repeat.

## StepMarks (server memory, per workspace)

```
StepMarks {
  runId: string                      // run that produced the marks
  active: Map<file, Map<line, count>> // lines executing now; count > 0
  finished: Map<file, Map<line, { durationMs: number; count: number }>>
}
```

Rules:
- `stepBegin` increments `active[file][line]`.
- `stepEnd` decrements it (deletes at 0) and sets `finished[file][line] = { durationMs,
  count + 1 }`, keeping the latest duration as upstream does. A negative duration (Playwright
  subtracts two worker wall-clock stamps; a clock correction between them, seen on WSL2,
  makes it negative) is stored as 0.
- `testEnd` deletes every `active` entry whose step belongs to that test.
- Run end, error or cancel clears `active` entirely.
- Next run start clears `finished` for all files (and `active`).
- `didChange` of a document (first change after save, the existing dirty transition)
  deletes `finished[file]` and `active[file]`.
- Every mutation schedules one `workspace/inlayHint/refresh` (debounced 100 ms).
- Current run id guard: events, `endRun` and the final log rewrite of a run are applied
  only while that run is the workspace's current run (`marks.runId === request.id`, which
  equals `ws.lastRun.id`). A run superseded during its kill grace changes nothing.

## InlayHint (server to editor, derived)

For a requested document and range, one hint per marked line inside the range:
- position: end of the line (from the open document's text; a line beyond the document end
  is skipped);
- label: `⌛ waiting…` for active lines; `<n>ms` or `<n>ms (ran <k>×)` for finished lines; a
  line that is both active and finished shows the active label;
- `paddingLeft: true`, no `kind`, no `tooltip`.

## RunOutput (server to file)

| Field | Source |
|-------|--------|
| run id, trigger, target, projects | `RunRequest` |
| command, cwd | `RunResult.command`, `config.configDir` |
| status, started, finished | `RunResult.status`, `RunRequest.startedAt`, end time |
| body | `RunResult.rawOutput` (stdout then stderr), capped at 10 MB with `[output truncated]` |

Written only by the workspace's current run (current run id guard above).

File: `<stateDir>/runs/<key>.log`, where `key` is the first 16 hex characters of the SHA-1
of the workspace root path (one file per workspace, latest run only). Written with the header
and `status: running` at run start, rewritten in full at run end, mode 0600.

## Workspace (existing) additions

- `marks: StepMarks` (see above).
- `outputFile: string | null`, the path of the last written log for the workspace.

## State transitions

```
run start  : finished := {}, active := {}, write header (running), refresh hints
stepBegin  : active[file][line]++                                  -> refresh
stepEnd    : active[file][line]--, finished[file][line] updated     -> refresh
testEnd    : active entries of that test removed                    -> refresh
run end    : active := {}, rewrite log (final status)               -> refresh
cancel     : as run end, log status cancelled
didChange  : active[file], finished[file] removed                   -> refresh
```
