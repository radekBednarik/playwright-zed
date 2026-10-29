# Contract: Show Browser (delta on the feature 001, 005, 006 and 008 contracts)

Applies on top of `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md`,
`contracts/playwright-cli.md`, `specs/005-project-selection/contracts/project-selection.md`,
`specs/006-single-click-run-parity/contracts/run-feedback.md` and
`specs/008-show-trace-viewer/contracts/trace-viewer.md`.

## 1. Server capabilities (initialize result)

`executeCommandProvider.commands` adds `playwright.toggleShowBrowser` and
`playwright.closeAllBrowsers`. Nothing else changes.

## 2. Commands (`workspace/executeCommand`)

| Command | Arguments | Behaviour |
|---------|-----------|-----------|
| `playwright.toggleShowBrowser` | `[{ uri: string }]` | Flips the preference, writes `show-browser.json`, logs the new state, shows the Info message of section 5. When the new state is on and the trace viewer is on: turns the trace viewer off (remembered, `trace-viewer.json` written), closes every viewer session, and the Info message says so. When the new state is off: stops every browser server at once, or at the end of the run in progress. Refused like the project commands when the workspace is gated or has no supported config. Returns `null`. |
| `playwright.closeAllBrowsers` | `[{ uri: string }]` | Stops every browser server of the document's workspace without changing the preference. Warning when a run is in progress (nothing is stopped); Info when there is nothing to stop. Same refusals as above. Returns `null`. |

Run commands: unchanged signatures. `RunRequest.showBrowser` copies the preference at
start; when true the run first ensures the config's browser server (section 4) and does
not start when that fails (Error of section 5, run logged as `error`).

## 3. Code actions (`textDocument/codeAction`)

Kind `source.playwright`, `command` only, appended after `Playwright: [ ] Show trace viewer`
and `Playwright: Show trace`, before the project picker entries:

| Title | Command | Arguments | Offered when |
|-------|---------|-----------|--------------|
| `Playwright: [x] Show browser` or `Playwright: [ ] Show browser` | `playwright.toggleShowBrowser` | `[{ uri }]` | the document belongs to an enabled workspace with a supported config (same rule as the trace toggle) |
| `Playwright: Close all browsers` | `playwright.closeAllBrowsers` | `[{ uri }]` | the same rule, and the option is on or at least one browser server of the workspace is running |

## 4. Playwright CLI

Run with the option on: `node <playwrightCli> test <target> -c <configPath>
--reporter=list,json[,<stepReporter>] [--project <name>]... --headed --workers 1 --trace off`,
environment = today's run environment plus `PW_TEST_CONNECT_WS_ENDPOINT=<endpoint>` and
`PW_TEST_REUSE_CONTEXT=1`. `--trace on` is never present on such a run. With the option
off the command line and environment are byte-identical to today's. Discovery is unchanged.

Browser server: `node <playwrightCli> run-server --path=/<32 hex chars> --host 127.0.0.1`,
`cwd` = the config's directory, environment = the server's environment plus
`PW_EXTENSION_MODE=1` and `FORCE_COLOR=0`, `stdio` piped, not detached. Ready when stdout
carries a line `Listening on <endpoint>`; 15 s readiness timeout. One per configuration,
started by the first run that needs it, kept until stopped. Stop: `SIGINT`, then `SIGKILL`
after 5000 ms if still alive (`child.kill()` on Windows). The child's stdout and stderr go to
the language server log prefixed `playwright: browser server <configName>:`.

## 5. Notifications sent by the server (additions)

| Notification | When | Payload |
|--------------|------|---------|
| `window/showMessage` Info | toggle applied | `Playwright: show browser is on` or `Playwright: show browser is off`; when the toggle to on also turned the trace viewer off: `Playwright: show browser is on; show trace viewer turned off (no traces while the browser is shown)` |
| `window/showMessage` Info | trace viewer toggled on while show browser is on | `Playwright: show trace viewer is on; show browser turned off (browsers closed)` (replaces the feature 008 message for that case; `show-browser.json` is written with `false` and the idle browser servers are stopped) |
| `window/showMessage` Info | settings default applied at startup or on change (source `settings`) | `Playwright: show browser is on (from settings)` (only for `true`; an `off` default is silent) |
| `window/showMessage` Info | `playwright.closeAllBrowsers` stopped at least one server | `Playwright: browsers closed` |
| `window/showMessage` Info | `playwright.closeAllBrowsers` with nothing running | `Playwright: no browsers to close` |
| `window/showMessage` Warning | `playwright.closeAllBrowsers` while a run is in progress | `Playwright: cannot close browsers while tests are running` |
| `window/showMessage` Warning | settings value not a boolean | `Playwright: setting "reuseBrowser" must be true or false` (once per invalid value) |
| `window/showMessage` Warning | a run starts while both options are on (reachable only through a settings default) | `Playwright: show browser is on, so runs record no trace; turn it off to use the trace viewer` (once per combination of the two preferences) |
| `window/showMessage` Warning | a browser server exits outside `stop()` | `Playwright: the browser server for <configName> exited (code <n>); a new one starts with the next run` |
| `window/showMessage` Error | the browser server cannot be started, exits before its endpoint line, or the line does not arrive within 15 s | `Playwright could not start the browser server.\nCommand: <command>\n<first useful line of stderr, the spawn error, or "no endpoint within 15 s">`; the run does not start |
| `window/logMessage` | every toggle and resolution | `playwright: show browser: on|off (<source>)` |
| `window/logMessage` | server lifecycle | `playwright: browser server <configName> started (pid <n>): <command>`, `... listening on <endpoint>`, `... stopping`, `... exited (code <n>)` |
| `window/logMessage` | run start with the option on | `playwright: run <id> browser server <endpoint>`; with both options on also `playwright: run <id> trace recording off (show browser is on)` |

Run results (progress, pass/fail messages, diagnostics, step marks, run log) are unchanged;
the run log's `command` line shows the three flags.

## 6. Settings (Zed)

```json
{ "lsp": { "playwright": { "settings": { "reuseBrowser": true } } } }
```

Delivered as before through `workspace/configuration` and `didChangeConfiguration`; no shell
change. A remembered choice (store) wins over the setting, as for `projects` and `showTrace`.

## 7. Store

`<stateDir>/show-browser.json`, shape in `data-model.md`; same directory, permissions and
write procedure as `trace-viewer.json`. The coupling of research R6 may also write
`trace-viewer.json` with `showTrace: false` (browser toggled on), and `playwright.toggleTraceViewer`
may write `show-browser.json` with `showBrowser: false` (viewer toggled on).

## 8. Status request `playwright/status` (test hook)

Each workspace entry gains `showBrowser: { enabled, source }` and
`browserServers: [{ configPath, pid, wsEndpoint, startedAt, state }]` (see `data-model.md`).

## 9. Unchanged

Discovery, consent, project selection, lenses, inlay hints, the run log file, the trace
viewer mechanics while show browser is off, the step reporter, and every message of earlier
contracts not listed above.
