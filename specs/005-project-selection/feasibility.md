# Feasibility: Playwright Project Selection in Zed

Pre-planning analysis, 2026-10-14. Answers "can the rest of the parity row be built with the
Zed primitives the constitution allows?" The plan's `research.md` refines it.

**Verdict: yes, with the code action menu as the picker.** Every building block exists today
in Zed stable, in `zed_extension_api` 0.7.0 and in Playwright's CLI. No API workaround is
needed. The one open design decision is where the remembered choice lives (spec FR-008).

## What upstream does (source: `src/testModel.ts`, `src/playwrightTestServer.ts`, README)

| Aspect | Upstream behavior |
|--------|-------------------|
| Project list | From Playwright's own listing, every project, never from the config text. |
| Picker | Checkbox per project in the Playwright sidebar (webview). |
| Default | First project only. A config with fewer than two projects treats its project as enabled. |
| Persistence | VS Code `workspaceState`, per workspace, entry per config (`relativeConfigFile`, `projects: [{name, enabled}]`), survives restarts. |
| Runs | Request carries `projects: enabledProjectsFilter()`; empty list when all are enabled, so Playwright applies its default. |
| Listing | Always all projects; files with no enabled project are hidden from the tree. |
| Setting | None for the selection. |

## Zed building blocks (verified 2026-10-14)

| Need | Zed primitive | Evidence |
|------|---------------|----------|
| Show the project list and toggle entries | Code actions from the language server (constitution primitive 3, already used for run commands) | `server/src/server.ts` `onCodeAction`; Zed renders every returned action in the `ctrl-.` menu. |
| Refresh lenses after a toggle | `workspace/codeLens/refresh` request from the server | `crates/project/src/lsp_store.rs` registers `CodeLensRefresh` and calls `refresh_code_lens` (line 1175 on `main`). |
| Settings default per folder | `lsp.<server>.settings` in user or `.zed/settings.json`, delivered as `workspace/configuration` and pushed on change | `lsp_store.rs` sends `DidChangeConfiguration` to running servers when settings change (around line 9815); `zed_extension_api::settings::LspSettings::for_worktree` exposes the `settings` value; the shell implements `language_server_workspace_configuration` to forward it (small Rust change, so an extension release, which the lockstep rule requires anyway). |
| One-shot question with buttons (not chosen) | `window/showMessageRequest` | `crates/workspace/src/notifications.rs` draws one button per action with no cap; single choice per prompt, a dismissed prompt never answers (feature 002 note). Rejected as the picker: multi-select would need a prompt chain. |
| Sidebar, tree, status bar, webview | none | Not available to extensions; constitution III forbids emulation. |

## Playwright CLI facts (fixture, Playwright 1.64.0)

- `test --list --reporter=json` reports `config.projects[].name` and `spec.tests[].projectName`
  (the server already stores the per-spec names as `DiscoveredTest.projects`; the config-level
  list is one more field from the same report).
- `test --project <name...>` accepts several names and defaults to all projects; the
  contract from feature 001 (`contracts/playwright-cli.md`) gains this one flag.
- An unknown name fails fast: `Error: Project(s) "nope" not found. Available projects:
  "chromium"`. The server can reconcile before running, so users never hit this text.
- Dependencies (`setup` projects) are resolved by Playwright itself when a project is named;
  `--no-deps` is not used.

## Mapping proposal for the plan

1. **Discovery**: keep `--list` for all projects; record `projects: string[]` on the config.
2. **Picker**: code actions `Playwright: Project [x] chromium`, `Playwright: Project [ ]
   firefox`, ... plus `Playwright: Run in all projects`, offered in any served file under the
   config directory when the config has two or more projects. Each action runs a server
   command that toggles the name, reconciles, stores, and requests a lens refresh.
3. **Runs**: `buildRunArgs` appends `--project <name>` per selected project unless all are
   selected; the run log line and the progress title include the names.
4. **Lenses and cursor actions**: filter `DiscoveredTest.projects` against the selection.
5. **Default and storage**: owner decisions (spec FR-006, FR-008). Recommendation: first
   project by default (parity, and multi-browser repositories stop running everything on
   each click) and a per-user store outside the workspace keyed by config path (mirrors
   upstream's workspace state; nothing is written into the repository; the server already
   owns a private temp directory, a state directory under the user's home is the same
   pattern). Session-only would regress parity; writing `.zed/settings.json` from a
   language server would edit a user file and is rejected.
6. **Settings** (User Story 3): `lsp.playwright.settings.projects` style default, read through
   `workspace/configuration`; exact key confirmed in planning.
7. **Fixture**: add a second project that reuses Chromium (different viewport) so CI needs no
   extra browser.

## Risks

- Zed orders code actions as returned; a long project list makes the menu long. Acceptable;
  upstream lists them all too.
- The settings path adds a Rust change (`language_server_workspace_configuration`) and
  therefore an extension release; the server and extension ship in lockstep anyway.
- `codeLens/refresh` behavior on Zed older than the current stable is unverified; the lens
  also refreshes on the next edit or reopen, so the fallback is graceful.
- Registry PR #7975 stays pinned to `v0.4.0`; this feature ships as 0.5.0 after merge, or is
  pushed to the open PR as a bump if the owner decides so.
