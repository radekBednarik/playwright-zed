# Data Model: Show Browser

Extends the feature 001, 005, 006 and 008 data models (`server/src/types.ts`). Paths are
absolute; timestamps are ISO strings unless noted.

## ShowBrowserPreference (server memory, one per server)

| Field | Type | Notes |
|-------|------|-------|
| enabled | boolean | The effective on/off state. |
| source | `remembered` / `settings` / `default` | Where `enabled` came from. |
| updatedAt | ISO string or null | Set for `remembered` (copied from the store). |

Resolution (`resolveBrowserPreference(remembered, settingsValue)`), identical to the trace
preference:

1. `remembered` not null: `enabled = remembered.showBrowser`, source `remembered`.
2. else `settingsValue` is a boolean: `enabled = settingsValue`, source `settings`.
3. else `enabled = false`, source `default`.

A toggle produces `{ enabled: !enabled, source: 'remembered', updatedAt: now }` and writes
the store. A settings change re-resolves only when `source` is `settings` or `default`.

Coupling (research R6, both ways): a toggle to `enabled = true` while the trace preference
is on sets the trace preference to `{ enabled: false, source: 'remembered', updatedAt: now }`,
writes `trace-viewer.json` and closes every viewer session; a trace viewer toggle to on
while this preference is on sets it to `{ enabled: false, source: 'remembered', updatedAt: now }`,
writes `show-browser.json` and stops the idle browser servers.

### Store file `<stateDir>/show-browser.json`

```json
{ "version": 1, "showBrowser": true, "updatedAt": "2026-10-29T10:00:00.000Z" }
```

Missing, unreadable, malformed or symlinked file reads as "no remembered choice". Written
through a temp file in the same directory and a rename; directory `0700`, file `0600`.

### Settings value

`{ "reuseBrowser": true }` inside the object Zed delivers for `lsp.playwright.settings`.
Any value that is not `true` or `false` is reported once as invalid
(`Playwright: setting "reuseBrowser" must be true or false`) and treated as absent.

## BrowserServer (server memory, keyed by config path)

| Field | Type | Notes |
|-------|------|-------|
| configPath | string | Owning config; `playwrightCli` of that config runs the server. |
| rootPath | string | Workspace root, for `closeFor` and the status request. |
| child | ChildProcess | `run-server --path=/<random> --host 127.0.0.1`, `cwd` = config dir. |
| pid | number | For the status request and tests. |
| wsEndpoint | string or null | Parsed from `Listening on <endpoint>`; null while starting. |
| startedAt | ISO string | |
| command | string | Human-readable command line for messages and the log. |
| state | `starting` / `ready` / `stopping` | `starting` until the endpoint line; `stopping` after `stop()`. |

### State transitions

```
(none) --ensure()--> starting --'Listening on'--> ready --ensure()--> ready (same endpoint)
starting --timeout 15 s / 'error' / 'exit'--> (none) + failure (the run does not start)
ready --stop()--> stopping --'exit'--> (none)          SIGINT, SIGKILL after 5 s
ready --'exit' (crash, killed from outside)--> (none)  next ensure() starts anew
```

`ensure(config, rootPath)` returns a promise of the endpoint (or a failure with the
command and the detail); concurrent callers while `starting` share the same promise. The
browser inside the server is Playwright's: launched on the first connection, reused by
later ones, replaced by the server itself when the developer closes it (research R1, R4).

## RunRequest (existing) additions

| Field | Type | Notes |
|-------|------|-------|
| showBrowser | boolean | Copy of the browser preference at start. |
| browserEndpoint | string or null | The server's endpoint for this run; set only when `showBrowser`. |
| trace | boolean | Existing field; forced `false` when `showBrowser` is true (research R6). |

Run arguments and environment for `showBrowser = true` (research R2): `--headed --workers 1
--trace off` appended; `PW_TEST_CONNECT_WS_ENDPOINT=<browserEndpoint>` and
`PW_TEST_REUSE_CONTEXT=1` added to the child's environment. Everything else unchanged.

## Workspace (existing) additions

None; servers are keyed by config path in the manager, as viewer sessions are. `closeFor(rootPath)`
stops the servers of the configs under that root.

## Status request `playwright/status` additions (test hook)

Per workspace: `browserServers: [{ configPath, pid, wsEndpoint, startedAt, state }]`.
Server-level (on every workspace entry for simplicity): `showBrowser: { enabled, source }`.
