# Contract: Show Trace Viewer (delta on the feature 001, 005 and 006 contracts)

Applies on top of `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md`,
`contracts/playwright-cli.md`, `specs/005-project-selection/contracts/project-selection.md`
and `specs/006-single-click-run-parity/contracts/run-feedback.md`.

## 1. Server capabilities (initialize result)

`executeCommandProvider.commands` adds `playwright.toggleTraceViewer` and
`playwright.showTrace`. Nothing else changes.

## 2. Commands (`workspace/executeCommand`)

| Command | Arguments | Behaviour |
|---------|-----------|-----------|
| `playwright.toggleTraceViewer` | `[{ uri: string }]` | Flips the preference, writes `trace-viewer.json`, logs the new state, shows the Info message of section 5. When the new state is off, closes every viewer session. Refused like the project commands when the workspace is gated or has no supported config. Returns `null`. |
| `playwright.showTrace` | `[{ uri: string, line: number }]` (0-based line, as the run commands) | Resolves the test at the cursor from the discovered tests of the file; looks up the last run's trace records for that file and line; shows the latest one in the config's viewer (starting it if needed). Warning when the option is off, when the cursor is not inside a test, or when no record exists. Returns `null`. |

Run commands: unchanged signatures; `RunRequest.trace` copies the preference at start.

## 3. Code actions (`textDocument/codeAction`)

Kind `source.playwright`, `command` only, appended after the project picker entries:

| Title | Command | Arguments | Offered when |
|-------|---------|-----------|--------------|
| `Playwright: [x] Show trace viewer` or `Playwright: [ ] Show trace viewer` | `playwright.toggleTraceViewer` | `[{ uri }]` | the document belongs to an enabled workspace with a supported config (same rule as the picker, independent of the project count) |
| `Playwright: Show trace` | `playwright.showTrace` | `[{ uri, line }]` | the option is on, the cursor resolves to a test (`kind === 'test'`) of a served test file, and the workspace has a finished run (`Workspace.traces` not null) |

## 4. Playwright CLI

Run: `node <playwrightCli> test <target> -c <configPath> --reporter=list,json[,<stepReporter>]
[--project <name>]... [--trace on]`; `--trace on` is present exactly when the preference is
on at run start. Discovery is unchanged.

Viewer: `node <playwrightCli> show-trace --stdin`, `cwd` = workspace root, environment =
the server's environment plus `FORCE_COLOR=0`, `stdio` piped, not detached. Input protocol:
one absolute path per line. `.zip` paths are checked with `stat` before they are written;
`.json` paths are written as given (live trace, polled by the viewer). Writes are spaced:
the first path goes out at once, any later path waits until the viewer has been up for
3000 ms and at least 250 ms have passed since the previous write, and a newer path replaces
a waiting one (the viewer reads each stdin chunk as one path and attaches its reader only
after loading, so two paths in one read kill it; research R2 fact 4). A waiting `.zip` that
disappeared before its turn is dropped with a log line. Closing: end stdin,
then SIGTERM after 5000 ms if the process is still alive. The child's stdout and stderr go
to the language server log prefixed `playwright: trace viewer <configName>:`.

## 5. Notifications sent by the server (additions)

| Notification | When | Payload |
|--------------|------|---------|
| `window/showMessage` Info | toggle applied | `Playwright: show trace viewer is on` or `Playwright: show trace viewer is off` |
| `window/showMessage` Info | settings default applied at startup or on change (source `settings`) | `Playwright: show trace viewer is on (from settings)` (only for `true`; an `off` default is silent) |
| `window/showMessage` Warning | settings value not a boolean | `Playwright: setting "showTrace" must be true or false` (once per invalid value) |
| `window/showMessage` Warning | `playwright.showTrace` with the option off | `Playwright: turn on "Show trace viewer" first; the last run recorded no traces` |
| `window/showMessage` Warning | `playwright.showTrace` with no record for the test | `Playwright: no trace for <title> in the last run` (`[<project>] <title>` with several projects); when the cursor is not inside a test: `Playwright: put the cursor inside a test to show its trace` |
| `window/showMessage` Warning | a trace record's file is missing at show time | `Playwright: trace file not found: <path>` |
| `window/showMessage` Warning | a single-test run with the option on ends with no trace record (skipped, failed before the browser opened, cancelled) | `Playwright: no trace recorded for <target> in this run` (`<target>` as in the run log, `file:line`); the run's own pass, fail or cancel message is unchanged |
| `window/showMessage` Warning | a trace path lies outside the workspace root | `Playwright: the trace <path> is outside <rootPath>; the viewer cannot read it (set outputDir inside the workspace)` (once per run) |
| `window/showMessage` Error | the viewer cannot be started or exits before its first load with a non-zero code | `Playwright could not start the trace viewer.\nCommand: <command>\n<first line of stderr or the spawn error>` |
| `window/logMessage` | every toggle and resolution | `playwright: show trace viewer: on|off (<source>)` |
| `window/logMessage` | viewer lifecycle | `playwright: trace viewer <configName> started (pid <n>): <command>`, `... showing <path>`, `... exited (code <n>)`, `... closed` |
| `window/logMessage` | run start with the option on | the existing command line now ends with `--trace on` |

Run results (progress, pass/fail messages, diagnostics, step marks, run log) are unchanged.

## 6. Step reporter (Playwright side) additions

`testBegin` lines gain `traceLive` (predicted live trace path, see `data-model.md`),
`testEnd` lines gain `trace` (final attachment path). Both optional; the reporter still never
reads the file system or throws. Existing fields and ordering are unchanged.

## 7. Settings (Zed)

```json
{ "lsp": { "playwright": { "settings": { "showTrace": true } } } }
```

Delivered as before through `workspace/configuration` and `didChangeConfiguration`; no shell
change. A remembered choice (store) wins over the setting, as for `projects`.

## 8. Store

`<stateDir>/trace-viewer.json`, shape in `data-model.md`; same directory, permissions and
write procedure as `project-selection.json`.

## 9. Status request `playwright/status` (test hook)

Each workspace entry gains `traceViewer: { enabled, source }`, `traces: { runId, records[] } | null`
and `traceViewers: [{ configPath, pid, currentPath, startedAt }]` (see `data-model.md`).

## 10. Unchanged

Discovery, consent, project selection, lenses, inlay hints, the run log file, the
`show-trace` window itself (Playwright renders it), and every message of earlier contracts.
