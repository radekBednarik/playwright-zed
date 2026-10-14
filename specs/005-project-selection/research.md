# Research: Playwright Project Selection

Date: 2026-10-14. Extends [feasibility.md](./feasibility.md). Sources are Zed `main` as of
today (`crates/project/src/lsp_store.rs`, `crates/language_extension/src/extension_lsp_adapter.rs`,
`crates/workspace/src/notifications.rs`), `zed_extension_api` 0.7.0 docs, upstream
`playwright-vscode` `src/testModel.ts` and `src/playwrightTestServer.ts`, and Playwright
1.64.0 on the sample fixture.

## R1. Where do project names come from?

**Decision**: `report.config.projects[].name` from the `--list --reporter=json` run the server
already performs, in report order.

**Rationale**: constitution IV forbids parsing the config; the JSON reporter's `config`
block lists every project with `name` and `testDir` (the server already reads `testDir`
from it). Per-spec `tests[].projectName` is already stored as `DiscoveredTest.projects`.
Verified on the fixture: `projects: [{name: "chromium", ...}]`, spec `tests` carry
`projectName: "chromium"`.

**Alternatives**: `playwright test --list-files --reporter=json` (upstream's `listFiles`)
also reports projects, but it is a second process per discovery for no gain here.

## R2. Which Zed surface is the picker?

**Decision**: code actions, one per project with a textual `[x]` / `[ ]` state, plus a
"select all" action, offered from any served document under the config directory when the
config has two or more projects.

**Rationale**: constitution III ranks LSP affordances third and forbids emulating VS Code's
tree. Zed renders every action the server returns, in server order, in the `ctrl-.` menu.
Code actions already carry the run commands, so users find the picker where they run tests.

**Alternatives**: `window/showMessageRequest` with one button per project. Zed draws a
button per action with no cap (`notifications.rs` maps `request.actions` to `Button`s), but
one prompt yields one choice, a dismissed prompt never answers (feature 002), and a
multi-select would need a chain of prompts. Rejected. Zed tasks or a settings-only picker
were rejected because toggling would mean editing JSON.

## R3. How do lenses follow a toggle?

**Decision**: send `workspace/codeLens/refresh` after each selection change, exactly as after
discovery.

**Rationale**: `lsp_store.rs` registers `CodeLensRefresh` and calls `refresh_code_lens`;
the server's `Reporter.refreshCodeLenses` already uses it and feature 001 verified it in
Zed. Code actions are requested fresh each time the menu opens, so they need no refresh.

## R4. How does a Zed setting reach the server?

**Decision**: the Rust shell implements `Extension::language_server_workspace_configuration`
and returns `LspSettings::for_worktree("playwright", worktree)?.settings`. The server reads it
through `workspace/configuration` (no section, whole object) once after `initialized`, and
through `workspace/didChangeConfiguration` afterwards. Users write:

```json
{ "lsp": { "playwright": { "settings": { "projects": ["chromium", "firefox"] } } } }
```

in user settings or in the repository's `.zed/settings.json`.

**Rationale**: `ExtensionLspAdapter::workspace_configuration` calls the extension's method
and returns `{}` when it yields `None`; Zed does not forward `lsp.<name>.settings` to
extension servers by itself. The key under `lsp` is the adapter name, which for extensions
is the `[language_servers.<key>]` key of `extension.toml`, here `playwright`. Zed answers
`workspace/configuration` from `workspace_configuration_for_adapter` (section lookup when a
section is given, whole object otherwise) and pushes `DidChangeConfiguration` with the same
object to every running server when settings change (`lsp_store.rs`, settings observer),
so no restart is needed (spec User Story 3, scenario 3).

**Alternatives**: `initialization_options` (requires restart, rejected by Zed docs for
dynamic values); reading `.zed/settings.json` from the server (parses an editor file,
duplicates Zed's merge rules, rejected).

**Consequence**: a Rust change, so the extension ships a new version together with the
server (lockstep rule). Setting shape stays flat because the section is already the server;
a per-config map is deferred until a monorepo user asks (unknown names are ignored per
config with one warning, see data model).

## R5. Where is the choice remembered?

**Decision** (owner, 2026-10-14): a per-user JSON file outside the workspace, keyed by
absolute config path. Directory: `$PLAYWRIGHT_ZED_STATE_DIR` if set (tests, power users),
else the platform state directory: Linux `$XDG_STATE_HOME` or `~/.local/state`, macOS
`~/Library/Application Support`, Windows `%LOCALAPPDATA%`, each with the subdirectory
`playwright-zed-language-server`. File `project-selection.json`.

**Rationale**: mirrors upstream's VS Code `workspaceState` (per workspace, per config, by
project name, survives restarts) without writing into the repository. Zed offers extensions
no key-value store that a language server could reach, and the server already owns private
temp directories, so a state file is the same pattern. Absolute config path is unique
across workspaces and monorepos; moving a repository forgets the choice, which is
acceptable and matches what VS Code does when a folder moves.

**Concurrency**: Zed may run several server instances (one per window or worktree). Writes
read the file first, replace only the current config's entry, write a temp file next to it
and rename. Reads happen at each reconcile, so a choice made in another window is picked up
at the next discovery. Permissions: directory `0700`, file `0600`; the file is read only if
`lstat` says regular file (same rule as the report reader).

**Alternatives**: session only (parity regression, rejected by owner); writing
`.zed/settings.json` from the server (edits a user file, rejected); the Zed `KeyValueStore`
(only available to `index_docs` in the extension API, not to the server).

## R6. Default selection and reconciliation

**Decision** (owner, 2026-10-14): first reported project when nothing is remembered and no
setting applies; single-project configs always use their project and show no picker.
Reconciliation order: remembered, then settings, then default. Unknown names are dropped
with one notice per distinct change; new projects stay unselected.

**Rationale**: upstream `_loadModelIfNeeded`: stored `enabled` per name, first project when
nothing is stored, `isProjectEnabled` returns true for configs with fewer than two projects.
Upstream also ends with an empty filter when nothing is enabled, which runs everything;
the spec instead refuses to deselect the last project, which is clearer.

## R7. CLI arguments

**Decision**: append `--project <name>` once per selected project, as separate argv entries,
unless every reported project is selected (then no flag, Playwright's default). Order:
after `--reporter=list,json`, so the positional file target stays in front of `-c`.

**Rationale**: `playwright test --help`: `--project <project-name...>` "Only run tests from
the specified list of projects, supports '*' wildcard (default: run all projects)".
Repeating the flag avoids the variadic form swallowing later arguments. Unknown names make
Playwright exit with `Error: Project(s) "x" not found. Available projects: ...`; the
reconcile step prevents that, and if it ever happens the existing error path shows the
message. Dependencies: Playwright adds dependency projects on its own; `--no-deps` is not
used.

## R8. Fixture and tests

**Decision**: add a second project `mobile` to `fixtures/sample-project/playwright.config.ts`
using `devices['Pixel 7']` (Chromium, so CI installs no extra browser). Default selection is
`chromium` (first), so existing integration tests keep their counts: discovery still yields
16 specs, and runs pass `--project chromium`, which runs the same tests as before. Tests
that need the second project toggle it explicitly. Integration tests set
`PLAYWRIGHT_ZED_STATE_DIR` to a fresh temp directory per `TestClient` so the developer's
real store is never touched, and the persistence test restarts a client on the same
directory. The `TestClient` gains a `workspace/configuration` responder and advertises
`workspace.configuration: true` plus `workspace.didChangeConfiguration`.

**Risk**: the TodoMVC specs run on a mobile viewport when `mobile` is selected; they are
only run in the mobile project by tests that select it, and those assert on `--project`
arguments and counts, not on TodoMVC success. Keep the mobile-project runs on
`passing.spec.ts` lines that use `page.setContent`.
