# Data Model: Project Scaffold and Run Test at Cursor

All entities live in the language server's memory, keyed by workspace folder. Nothing is
persisted. Paths are absolute, line numbers are 1-based as Playwright reports them.

## Workspace

One per workspace folder the client opens.

| Field | Type | Notes |
|-------|------|-------|
| rootUri | string | Folder URI from `initialize` / `workspaceFolders`. |
| configs | PlaywrightConfig[] | Zero or more; empty means "not a Playwright workspace". |
| lastRun | RunRequest or null | Source for "re-run last". |
| versionWarningShown | boolean | Ensures the v1.38 warning fires once per session. |

## PlaywrightConfig

One per config file found in a workspace (monorepos yield several). Named "config" and not
"project" because upstream uses "Playwright project" for a browser entry in `projects[]`,
which a later feature models separately.

| Field | Type | Notes |
|-------|------|-------|
| configPath | string | `playwright.config.{ts,js,mts,mjs,cts,cjs}`; search skips `node_modules`, `.git`, and any `testDir` output dirs. |
| configDir | string | cwd for every CLI invocation. |
| playwrightCli | string | Resolved `.../node_modules/@playwright/test/cli.js`. |
| playwrightVersion | Version | From the resolved package. |
| rootDir | string | `report.config.rootDir` from the last `--list`. |
| testDirs | string[] | Unique `report.config.projects[].testDir` values from the last `--list`; a save under any of them triggers rediscovery. |
| supported | boolean | `playwrightVersion >= 1.38.0`. |
| tests | DiscoveredTest[] | From the last successful `--list`. |
| discoveryState | `idle` / `running` / `error` | Error carries the CLI message for diagnostics. |

Validation: a file belongs to the config whose `configDir` is the longest prefix of the
file's path among supported configs (FR-014, nearest config wins).

## DiscoveredTest

Flattened from the JSON `--list` report's `suites[].specs[]` recursion.

| Field | Type | Notes |
|-------|------|-------|
| file | string | Absolute path. |
| line, column | number | Spec declaration position. |
| title | string | Spec title. |
| titlePath | string[] | Describe titles from outermost inward, then the spec title. |
| describeLines | number[] | Lines of each enclosing describe, for lens placement. |
| projects | string[] | Playwright project names the spec runs in. |

## TestLocation

What the user pointed at. Derived at command time, never stored long-term except inside a
RunRequest.

| Field | Type | Notes |
|-------|------|-------|
| kind | `test` / `describe` / `file` | Resolution rule below. |
| file | string | |
| line | number or null | Null for `file`. |

Resolution from a cursor position (FR-008):
1. If a DiscoveredTest in that file has `line` equal to the cursor line, or the cursor lies
   within that test's span, kind = `test`. A test's span starts at its title line and ends on
   the line before the next test or describe title line in the same file; the last test's
   span extends to the end of the file. Only title lines are known (from `--list`), so body
   ends are not computed.
2. Else if the cursor line equals one of any test's `describeLines`, kind = `describe`.
3. Else kind = `file`.

## RunRequest

| Field | Type | Notes |
|-------|------|-------|
| id | string | Monotonic per workspace; used as progress token. |
| location | TestLocation | |
| config | PlaywrightConfig | |
| trigger | `cursor` / `file` / `rerun` | |
| startedAt | ISO timestamp | |
| dirty | boolean | Whether the target document had unsaved changes. |

State machine: `queued` → `running` → (`passed` | `failed` | `cancelled` | `error`).
`error` means the process could not start or produced no report; `failed` means Playwright ran
and reported failures. Only one request may be `running` per workspace; a new request moves
the running one to `cancelled`.

## RunResult

| Field | Type | Notes |
|-------|------|-------|
| request | RunRequest | |
| status | RunRequest terminal state | |
| counts | { expected, unexpected, skipped, flaky } | From JSON report `stats`. |
| failures | Failure[] | |
| rawOutput | string | `list` reporter stdout plus stderr, for the LSP log. |
| command | string | Exact command line, for FR-013. |

## Failure

| Field | Type | Notes |
|-------|------|-------|
| file, line, column | | `error.location` when present, else the spec position. |
| title | string | Spec title. |
| message | string | ANSI-stripped first error line. |

Mapped 1:1 to an LSP Diagnostic (source `playwright`, severity Error).

## ParityRow (docs/parity.md)

| Field | Values |
|-------|--------|
| capability | one of the 12 upstream capabilities named in the constitution |
| status | `full` / `partial` / `blocked` / `not-started` / `zed-only` |
| primitive | tasks / dap / lsp / settings / playwright-ui / none |
| note | reason for `partial` or `blocked`, with a Zed source or issue link |
