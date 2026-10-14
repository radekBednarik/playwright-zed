# Contract: Project Selection (delta on feature 001 contracts)

Applies on top of `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md` and
`contracts/playwright-cli.md`.

## Initialize

`ServerCapabilities.executeCommandProvider.commands` adds `playwright.toggleProject` and
`playwright.selectAllProjects`. After `initialized`, when the client capability
`workspace.configuration` is true, the server sends `workspace/configuration` with
`items: [{}]` (whole object) once; it registers for `workspace/didChangeConfiguration` when
`workspace.didChangeConfiguration` is advertised. Clients without either simply have no
settings default.

## Commands (`workspace/executeCommand`)

| Command | Arguments | Behaviour |
|---------|-----------|-----------|
| `playwright.toggleProject` | `[{ uri: string, project: string }]` | Flip the project in the selection of the config that owns `uri` (nearest config whose `configDir` contains the file). Refuses the last selected project and unknown names with a Warning. Writes the store, refreshes lenses, logs the new selection. Returns `null`. |
| `playwright.selectAllProjects` | `[{ uri: string }]` | Selects every project of that config; same side effects. |

Run commands (`playwright.runAtCursor`, `playwright.runFile`, `playwright.rerunLast`) now
refuse with a Warning, before spawning, when no test of the target runs in a selected
project: `Playwright: no tests in <target> run in the selected project(s) <names>; change
the selection from the code actions menu.`

## Code actions (`textDocument/codeAction`)

Returned after the existing run actions, only when the document's config reports two or more
projects and discovery is enabled. Kind `source.playwright`, `command` only:

| Title | Command | Arguments |
|-------|---------|-----------|
| `Playwright: [x] <name>` (selected) or `Playwright: [ ] <name>` | `playwright.toggleProject` | `[{ uri, project: <name> }]` |
| `Playwright: Select all projects` | `playwright.selectAllProjects` | `[{ uri }]` (omitted when every project is selected) |

The document need not be a test file: any served document under `configDir` works, so the
picker is reachable from the config file itself. Run actions and `Playwright: Run test at
cursor` / `Run describe at cursor` consider only tests that run in a selected project.

## Code lenses (`textDocument/codeLens`)

Lenses are emitted only for tests whose `projects` intersect the selection, and for describe
lines that contain at least one such test. `workspace/codeLens/refresh` is sent after every
selection change, in addition to after discovery.

## Notifications sent by the server (additions)

| Notification | When | Payload |
|--------------|------|---------|
| `$/progress` (begin) | run start, config with two or more projects | message `Running <n> test(s) in <file> (<project>, <project>)` |
| `window/showMessage` Info | reconcile dropped remembered names | `Playwright: project(s) <names> no longer exist in <config>; selection is now <names>` (once per distinct change) |
| `window/showMessage` Warning | settings name unknown names | `Playwright: setting "projects" names <names>, which <config> does not define; available: <names>` (once per distinct change) |
| `window/showMessage` Warning | toggle refused | `Playwright: at least one project must stay selected` or `Playwright: <name> is not a project of <config>` |
| `window/showMessage` Info | toggle or select all applied | `Playwright: projects for <config>: <names>` (Zed caches the code action menu per cursor position, so this is the immediate feedback) |
| `textDocument/publishDiagnostics` | run failed, config with two or more projects | one Diagnostic per failing project entry of a spec, message `[<project>] <title>: <first error line>`; the Error notification's first failure carries the same prefix; single-project configs keep the unprefixed message |
| `window/logMessage` | every selection change and reconcile | `playwright: projects for <config>: <names> (<source>)` |
| `window/logMessage` | run start | the existing command line now shows `--project` flags |

## Settings (Zed)

```json
{ "lsp": { "playwright": { "settings": { "projects": ["chromium", "firefox"] } } } }
```

Delivered by Zed as the `workspace/configuration` answer and as
`workspace/didChangeConfiguration.settings`. The shell forwards it through
`Extension::language_server_workspace_configuration`; without the shell change the server
receives `{}` and behaves as if no setting existed.

## Store

`<state dir>/playwright-zed-language-server/project-selection.json`, shape in
`data-model.md`. State dir: `$PLAYWRIGHT_ZED_STATE_DIR`, else `$XDG_STATE_HOME` or
`~/.local/state` (Linux), `~/Library/Application Support` (macOS), `%LOCALAPPDATA%`
(Windows). Directory `0700`, file `0600`, atomic rename, read-merge-write.

## Playwright CLI

Run: `node <playwrightCli> test <target> -c <configPath> --reporter=list,json [--project <name>]...`
with one `--project <name>` pair per selected project, omitted when every project of the
config is selected. Discovery is unchanged (all projects).

## Debug request (`playwright/status`)

`configs[]` entries gain `projects: string[]`, `selectedProjects: string[]`,
`selectionSource: "single" | "default" | "settings" | "remembered" | "chosen"`.
