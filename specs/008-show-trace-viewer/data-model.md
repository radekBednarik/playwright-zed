# Data Model: Show Trace Viewer

Extends the feature 001, 005 and 006 data models (`server/src/types.ts`). Paths are
absolute; timestamps are ISO strings unless noted.

## TraceViewerPreference (server memory, one per server)

| Field | Type | Notes |
|-------|------|-------|
| enabled | boolean | The effective on/off state. |
| source | `remembered` / `settings` / `default` | Where `enabled` came from. |
| updatedAt | ISO string or null | Set for `remembered` (copied from the store). |

Resolution (`resolveTracePreference(remembered, settingsValue)`):

1. `remembered` not null: `enabled = remembered.showTrace`, source `remembered`.
2. else `settingsValue` is a boolean: `enabled = settingsValue`, source `settings`.
3. else `enabled = false`, source `default`.

A toggle produces `{ enabled: !enabled, source: 'remembered', updatedAt: now }` and writes
the store. A settings change re-resolves only when `source` is `settings` or `default`.

### Store file `<stateDir>/trace-viewer.json`

```json
{ "version": 1, "showTrace": true, "updatedAt": "2026-10-20T10:00:00.000Z" }
```

Missing, unreadable, malformed or symlinked file reads as "no remembered choice". Written
through a temp file in the same directory and a rename; directory `0700`, file `0600`.

### Settings value

`{ "showTrace": true }` inside the object Zed delivers for `lsp.playwright.settings`. Any
value that is not `true` or `false` is reported once as invalid
(`Playwright: setting "showTrace" must be true or false`) and treated as absent.

## StepEvent (reporter to server) additions

| Event | New field | Type | Notes |
|-------|-----------|------|-------|
| testBegin | traceLive | string, optional | `<project outputDir>/.playwright-artifacts-<workerIndex>/traces/<test.id>.json`; omitted when any part is unavailable. |
| testEnd | trace | string, optional | `path` of the result attachment named `trace`; omitted when there is none. |

The reporter never checks the file system and never throws (feature 006 contract).

## TraceRecord (server memory, per workspace, from the last run's report)

| Field | Type | Notes |
|-------|------|-------|
| file | string | Absolute test file (`rootDir` joined with the spec's `file`). |
| line | number | 1-based spec line, as discovery reports it. |
| column | number | |
| title | string | Spec title. |
| project | string or null | `projectName` when the config has two or more projects, else null (same rule as `Failure.project`). |
| path | string | The `trace` attachment path, `.zip`. |
| finishedAt | number | `startTime + duration` of the result, milliseconds since the epoch; ordering key. |

`Workspace.traces` = `{ runId: string, records: TraceRecord[] }` or null before the first
run. Replaced at the end of every run (empty `records` for cancelled, errored and trace-less
runs), guarded by the current run id like marks and the run log.

Lookup for "Show trace" at the cursor: records whose `file` equals the document and whose
`line` equals the resolved test line; when several (projects, or two tests on one line),
the greatest `finishedAt` wins.

## ViewerSession (server memory, keyed by config path)

| Field | Type | Notes |
|-------|------|-------|
| configPath | string | Owning config; `playwrightCli` of that config runs the viewer. |
| rootPath | string | Workspace root, the child's `cwd` (research R3). |
| child | ChildProcess | `show-trace --stdin`. |
| pid | number | For the status request and tests. |
| currentPath | string or null | Last path written to stdin. |
| startedAt | ISO string | |
| command | string | Human-readable command line for messages and the log. |

### State transitions

```
(none) --show(path)--> starting --'spawn'--> running --show(path)--> running
running --close()--> closing --'exit'--> (none)
running --'exit' (window closed, crash)--> (none)      next show starts anew
starting --'error' (cannot spawn)--> (none) + Error message naming the command
```

`show(path)`: when `path` ends with `.zip` and does not exist, nothing is written and the
caller reports "no trace"; when `path` equals `currentPath`, nothing is written (the viewer
would ignore it anyway); otherwise `path + '\n'` goes to stdin and `currentPath` is updated.
`close()`: end stdin, SIGTERM after 5 s if still alive, forget the session on `exit`.

## RunRequest (existing) additions

| Field | Type | Notes |
|-------|------|-------|
| trace | boolean | Copy of `preference.enabled` at start; `--trace on` is appended when true. |

## RunResult (existing) additions

| Field | Type | Notes |
|-------|------|-------|
| traces | TraceRecord[] | Extracted from the report; empty without a report. |

## Status request `playwright/status` additions (test hook)

Per workspace: `traces: { runId, records: [{ file, line, title, project, path }] } | null`,
`traceViewers: [{ configPath, pid, currentPath, startedAt }]`. Server-level (on every
workspace entry for simplicity): `traceViewer: { enabled, source }`.
