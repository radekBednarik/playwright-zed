# Implementation Plan: Playwright Project Selection

**Branch**: `005-project-selection` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-project-selection/spec.md`

## Summary

Complete the "Playwright project detection and selection" parity row: let the developer see
and toggle the projects (browsers) of each `playwright.config.*`, run tests only in the
selected projects, remember the choice per user across restarts, and accept a folder-level
default from Zed settings.

Technical approach (research R1 to R8): the language server records each config's project
names from the `--list` JSON report it already parses; the picker is a set of code actions
(`[x]` / `[ ]` per project, plus "select all") backed by two new commands; runs append
`--project <name>` per selected project unless all are selected; lenses and cursor actions
filter on `DiscoveredTest.projects`; the choice is written to a small JSON store in the
user's state directory, keyed by absolute config path, with read-merge-write and atomic
rename; the Rust shell gains `language_server_workspace_configuration` so Zed's
`lsp.playwright.settings` reaches the server as `workspace/configuration` and
`workspace/didChangeConfiguration`. Server and extension ship together as 0.5.0.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server); Rust stable on `wasm32-wasip2`
with `zed_extension_api` 0.7.0 (shell, one new trait method)

**Primary Dependencies**: `vscode-languageserver` 9.x (existing); no new npm or crate
dependency; `@playwright/test` >= 1.38 in the user's workspace (`--project` exists since
long before 1.38)

**Storage**: one JSON file, `project-selection.json`, in the user's state directory
(`$PLAYWRIGHT_ZED_STATE_DIR` override, else `$XDG_STATE_HOME/playwright-zed-language-server`,
`~/.local/state/...` on Linux, `~/Library/Application Support/...` on macOS,
`%LOCALAPPDATA%\...` on Windows); owner-only permissions; never inside a workspace

**Testing**: vitest 5 unit tests for the pure selection, argument and store logic;
integration tests through the existing `TestClient` against `fixtures/sample-project`
(gains a second Chromium-based project); `cargo test` for the shell; manual Zed scenarios in
`quickstart.md`, recorded in `verification.md`

**Target Platform**: Zed stable with worktree trust (0.218+) on Linux, macOS, Windows;
any other LSP client with code actions keeps the picker, minus the settings default

**Project Type**: Zed extension (Rust/WASM shell) plus Node language server

**Performance Goals**: no new process per toggle; toggling updates lenses within one
`codeLens/refresh` round trip; store writes are a few hundred bytes

**Constraints**: nothing new runs workspace code (FR-013); single-project configs produce the
same CLI arguments as 0.4.0 (SC-004); existing 108 vitest tests and 7 Rust tests keep
passing with the fixture change; registry PR #7975 stays at `v0.4.0`

**Scale/Scope**: about 250 lines of server code in two new modules plus edits to
`commands.ts`, `discovery.ts`, `server.ts`, `types.ts`, `reporting.ts`; about 15 lines of
Rust; one fixture edit; docs and parity row

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | Spec cites upstream `testModel.ts` behaviour (first project default, per-config memory by name, runs filtered, listing unfiltered). The settings default is a Zed-only addition on a Zed-specific path (no sidebar) and is marked `zed-only` in the parity note. Wording uses Playwright's "project". |
| II. Zed extension rules | Pass | Rust change is a documented `Extension` trait method that reads `LspSettings::for_worktree`; no bundling, no filesystem access outside the extension's own API. The server's store lives in the user's state directory, which is the server's own data, not the workspace. No API workaround. |
| III. Native primitives | Pass | Picker = LSP code actions and commands (primitive 3); default = Zed settings (primitive 4, named for "default project" in the constitution); lens refresh = `workspace/codeLens/refresh`, which the server already uses. No emulated tree or status bar; `showMessageRequest` chains rejected (R2). |
| IV. Playwright CLI is the runtime | Pass | Project names come from `playwright test --list --reporter=json`; filtering is `--project <name>` per selected project; dependencies are left to Playwright; the config file is never parsed. |
| V. Verified behaviour | Pass (planned) | Unit tests for `resolveSelection`, `toggleProject`, `buildRunArgs` with projects, lens filtering, store merge; integration tests for the menu, runs with `--project`, persistence across a server restart with a temp state dir, settings via `workspace/configuration`; `cargo test` and WASM build for the shell; quickstart scenarios in Zed recorded in `verification.md` with the commands run. |

Post-design re-check (after data model, contract, quickstart): unchanged, all pass. No
Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/005-project-selection/
├── plan.md              # This file
├── feasibility.md       # Pre-planning analysis (2026-10-14)
├── research.md          # Phase 0: R1 to R8
├── data-model.md        # Phase 1: PlaywrightProject, ProjectSelection, store file, state transitions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── project-selection.md   # Phase 1: delta on the feature 001 LSP and CLI contracts, settings, store
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib.rs                             # language_server_workspace_configuration -> LspSettings("playwright").settings
extension.toml, Cargo.toml             # 0.5.0; PINNED_SERVER_VERSION 0.5.0 (release task, owner's OK)

server/
├── src/
│   ├── selection.ts     # NEW, pure: resolveSelection, toggleProject, selectAll, isTestSelected, projectArgs, parseProjectsSetting
│   ├── store.ts         # NEW: state dir resolution, read/merge/write of project-selection.json (atomic, 0600)
│   ├── commands.ts      # COMMAND_TOGGLE_PROJECT, COMMAND_SELECT_ALL_PROJECTS; buildRunArgs(location, config, projects); countSelectedTests honours the selection
│   ├── discovery.ts     # parseListReport also returns config.projects[].name
│   ├── types.ts         # PlaywrightConfig.projects, .selection; RunRequest.projects; SelectionSource
│   ├── reporting.ts     # progressBegin message with project names
│   └── server.ts        # project code actions, commands, reconcile after discovery, settings (workspace/configuration, didChangeConfiguration), status fields, lens and cursor-action filtering
└── test/
    ├── unit/selection.test.ts         # NEW
    ├── unit/store.test.ts             # NEW (temp dir)
    ├── unit/commands.test.ts          # buildRunArgs with projects
    ├── unit/discovery.test.ts         # project names from the list report
    ├── integration/helpers.ts         # PLAYWRIGHT_ZED_STATE_DIR per client, workspace/configuration handler, codeActions helper
    └── integration/projects.test.ts   # NEW: menu, toggle, run with --project, persistence, select all, settings, single-project unchanged
fixtures/sample-project/playwright.config.ts   # second project "mobile" (Chromium, Pixel 7 emulation)
docs/parity.md                                  # row -> full, zed-only settings note
README.md, server/README.md                     # picker, settings, state file location
```

**Structure Decision**: the feature is server-first in the existing `server/` package, with
two new pure modules so the selection rules and the store are unit-testable without a
Playwright process. The shell change is the minimum needed for Zed to forward settings
(R4); everything else stays in the server, which also serves non-Zed clients.

## Design Notes

1. **Project list**: `parseListReport` returns `projects: string[]` from
   `report.config.projects[].name` in report order (Playwright's config order). Stored on
   `PlaywrightConfig.projects`. The sample fixture already reports `["chromium"]`; after the
   fixture change `["chromium", "mobile"]`.
2. **Reconcile after every discovery**: `resolveSelection(reported, remembered, settings)`
   per data-model rules; result and notices applied in `discoverConfig` before
   `refreshCodeLenses`. Notices are deduplicated per config by a key built from the dropped
   or unknown names, so repeated rediscovery does not nag.
3. **Picker**: in `onCodeAction`, after the run actions, when `configForFile` (or the config
   whose `configDir` contains the document, for non-test files) has two or more projects:
   one action per project titled `Playwright: [x] <name>` or `Playwright: [ ] <name>` with
   command `playwright.toggleProject` `[{ uri, project }]`, then `Playwright: Select all
   projects` with `playwright.selectAllProjects` `[{ uri }]`. Toggle refusal (last project)
   is a `window/showMessage` Warning. After any change: store write, lens refresh, Info log
   line with the new selection.
4. **Runs**: `RunRequest.projects` = the selection at start time; `buildRunArgs` appends
   `--project <name>` pairs unless the selection covers every reported project.
   `countSelectedTests` counts only tests whose `projects` intersect the selection; a count
   of zero refuses the run with a Warning naming the selection (no process spawned).
   Progress message gains ` (chromium, firefox)` when the config has two or more projects;
   the run log line names them always.
5. **Lenses and cursor actions**: `testFileContext` and `onCodeLens` use
   `isTestSelected(test, selection)`; `resolveTestLocation` receives the filtered test list so
   a cursor inside an unselected-only test resolves to `file`.
6. **Settings**: after `initialized`, if the client advertises `workspace.configuration`, the
   server requests the configuration once (`connection.workspace.getConfiguration()` with no
   section; Zed answers with the whole object, R4) and listens to
   `workspace/didChangeConfiguration`, whose `settings` carries the same object. Expected
   shape `{ "projects": ["chromium", "firefox"] }` (data-model). On change, reconcile every
   config whose selection source is `default` or `settings` and refresh lenses.
7. **Store**: `store.ts` resolves the directory (env override first), reads the file
   defensively (missing or corrupt file = empty), merges only the current config's entry on
   write, writes to a temp file in the same directory and renames. Permissions `0700` dir,
   `0600` file; symlinked file is not followed (`lstat`, same rule as the report reader).
8. **Shell**: `language_server_workspace_configuration` returns
   `LspSettings::for_worktree("playwright", worktree)?.settings`; `cargo test` keeps the host
   build green; the WASM build is run and recorded.
9. **Release**: ships as server 0.5.0 then extension 0.5.0 (lockstep, npm first, owner's OK);
   `v0.4.0` and registry PR #7975 are untouched unless the owner decides to push the bump to
   the open PR.

## Complexity Tracking

None.
