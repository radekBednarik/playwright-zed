# Contract: Playwright Language Server Protocol Surface

Transport: stdio, LSP 3.17. Package `playwright-zed-language-server`, bin of the same name,
flag `--stdio`.

## Initialize

`initializationOptions`: none required. The server reads `workspaceFolders` (falls back to
`rootUri`).

Advertised `ServerCapabilities`:

| Capability | Value |
|------------|-------|
| textDocumentSync | Incremental, with `save: { includeText: false }` |
| codeActionProvider | `{ codeActionKinds: ["source.playwright"] }` |
| codeLensProvider | `{ resolveProvider: false }` |
| executeCommandProvider | `{ commands: ["playwright.runAtCursor", "playwright.runFile", "playwright.rerunLast"] }` |
| workspace.workspaceFolders | `{ supported: true, changeNotifications: true }` |

Nothing else is advertised (no hover, completion, formatting), so vtsls keeps owning those.

## Commands (`workspace/executeCommand`)

| Command | Arguments | Behaviour |
|---------|-----------|-----------|
| `playwright.runAtCursor` | `[{ uri: string, line: number }]` (line 0-based as LSP) | Resolve TestLocation per data model; start a RunRequest with trigger `cursor`. |
| `playwright.runFile` | `[{ uri: string }]` | TestLocation kind `file`; trigger `file`. |
| `playwright.rerunLast` | `[]` or `[{ uri }]` | Repeat `Workspace.lastRun`; if none, `window/showMessage` Info "Nothing to re-run yet". |

All commands return `null`. Errors in starting the process are reported through
`window/showMessage` Error with the attempted command line and the underlying error (FR-013),
never as a JSON-RPC error, so Zed does not show a generic failure.

## Code actions (`textDocument/codeAction`)

Run actions are returned only when the document belongs to a supported PlaywrightConfig and
is a discovered test file. `Playwright: Re-run last` is the exception: it is returned for any
document in a workspace whose `lastRun` is set, so the developer can re-run from wherever the
cursor is. Each action has `kind: "source.playwright"` and a `command` (no `edit`):

| Title | Condition |
|-------|-----------|
| `Playwright: Run test at cursor` | TestLocation kind `test` |
| `Playwright: Run describe at cursor` | kind `describe` |
| `Playwright: Run file` | always |
| `Playwright: Re-run last` | `Workspace.lastRun` is set (any document in that workspace) |

Order: the most specific run first, so Enter on the code-action menu runs the test.

## Code lenses (`textDocument/codeLens`)

One lens per DiscoveredTest line and per unique describe line, each with a `command` already
populated (no resolve round-trip):

| Range | Title | Command |
|-------|-------|---------|
| test line | `▶ Run test` | `playwright.runAtCursor` with that line |
| describe line | `▶ Run describe` | `playwright.runAtCursor` with that line |

Lenses are refreshed via `workspace/codeLens/refresh` after each discovery completes.

## Notifications sent by the server

| Notification | When | Payload |
|--------------|------|---------|
| `$/progress` (begin) | RunRequest enters `running` | token = request id, title `Playwright`, message `Running <n> test(s) in <file>` |
| `$/progress` (end) | terminal state | message = `<expected> passed, <unexpected> failed, <skipped> skipped (<duration>s)` or the error; the duration is Playwright's own `stats.duration` |
| `window/showMessage` | terminal state | Info on pass; Error on fail with the summary followed by the first failure's full error text (all lines, ANSI stripped) so multi-line hints such as Playwright's browser-install instructions survive; Error on process error with the attempted command and the underlying error; Warning on cancel |
| `window/showMessage` | dirty target | Warning `<file> has unsaved changes; running the saved version` |
| `window/showMessage` | first unsupported-version detection per workspace | Warning `Playwright <v> found; v1.38 or newer is required. Test running is disabled.` |
| `textDocument/publishDiagnostics` | run failed | one Diagnostic per Failure, source `playwright`, severity Error, message = title plus first error line; cleared (empty array) for every file touched by the next run and for a file as soon as it receives `didChange` |
| `window/logMessage` | run start and end | exact command line, cwd, then full raw output |

## Document tracking

`didOpen`, `didChange`, `didSave`, `didClose` maintain the dirty flag per document. `didChange`
also clears that file's `playwright` diagnostics. `didSave` of a config file or of any file under
a config's `testDirs` triggers rediscovery.

## Debug request (additive, not used by Zed)

`playwright/status` with no parameters returns one entry per workspace:
`{ rootPath, lastRun: { id, location, trigger } | null, configs: [{ configPath, playwrightVersion,
supported, rootDir, testDirs, discoveryState, testCount }] }`. Used by integration tests and for
troubleshooting; it never changes server state.

## Implementation notes

- `window/showMessage` is sent explicitly as a notification. The `vscode-languageserver`
  convenience helpers send `window/showMessageRequest` instead, which Zed also renders but
  which waits for a reply.
- Clients that want `$/progress` must handle `window/workDoneProgress/create` and register a
  progress listener for the token it carries; Zed does this natively.
