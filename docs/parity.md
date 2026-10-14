# Parity Matrix

Reference: https://github.com/microsoft/playwright-vscode. One row per upstream capability
named in the constitution. Status values: `full`, `partial`, `blocked`, `not-started`,
`zed-only`. Primitive values: `tasks`, `dap`, `lsp`, `settings`, `playwright-ui`, `none`.

| Capability | Status | Primitive | Note |
|------------|--------|-----------|------|
| Install Playwright | not-started | none | |
| Playwright project detection and selection | full | lsp | Detects every `playwright.config.*` with a resolvable `@playwright/test` (v1.38 gate, nearest config wins, monorepos). Test discovery waits for Zed's worktree trust on Zed 0.218+, otherwise for the per-workspace consent question (see the last row). Project (browser) picker as code actions, one `[x]`/`[ ]` entry per project plus "Select all projects" (feature 005): first project selected by default as upstream, single-project configs unchanged, runs pass `--project` per selected project, lenses follow the selection, the choice is remembered per config in the user's state directory (upstream: VS Code workspace state). `zed-only` addition: a folder default via `lsp.playwright.settings.projects`, forwarded by the shell's `language_server_workspace_configuration`. Zed limitation: the code action menu is cached per cursor position (`crates/editor/src/code_actions.rs`) and is not refetched after a command-only code action runs, so the check marks at an unchanged cursor lag one toggle behind; the server confirms every change in a notification instead (no API workaround, Zed issue to be filed by the owner). |
| Run tests with a single click | partial | lsp | Run test, describe (`file:line` selects the whole group, verified), file and re-run via code actions and code lenses, executed by the workspace Playwright CLI. Results: progress, pass/fail notification, diagnostics at failing lines, full output in the language server log. Missing: executing-line highlight, per-step durations, and terminal output from the extension (extension LSP adapters cannot schedule Zed tasks; `crates/language_extension/src/extension_lsp_adapter.rs` has no `client_command`). |
| Watch mode | not-started | none | |
| Show browser | not-started | none | |
| Close all browsers | not-started | none | |
| Show trace viewer | not-started | none | |
| Pick locator | not-started | none | |
| Breakpoint debugging with locator highlighting | not-started | none | |
| Tune locators while paused | not-started | none | |
| Record new test | not-started | none | |
| Record at cursor | not-started | none | |
| Terminal output via tasks recipe | zed-only | tasks | User-level `tasks.json` template tagged `js-test` binds Zed's bundled TypeScript runnables to `playwright test $ZED_FILE:$ZED_ROW`; extensions cannot add tasks to bundled languages. |
| Discovery consent (Workspace Trust substitute) | partial | lsp | VS Code gates extension code execution with Workspace Trust. Zed 0.218+ has the equivalent, worktree trust (Restricted Mode): it starts language servers only in folders the user trusted and remembers that across restarts, so the server discovers at once in every reported workspace folder (feature 003). For older Zed, other clients and folders that reach the server only as the `rootUri` fallback, the server asks once per workspace per session before running `playwright test --list` (which executes the workspace's config and test files); until "Run discovery" is chosen, or "Playwright: Enable test discovery" is used, nothing runs and nothing is offered. |
