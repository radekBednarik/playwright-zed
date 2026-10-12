# Parity Matrix

Reference: https://github.com/microsoft/playwright-vscode. One row per upstream capability
named in the constitution. Status values: `full`, `partial`, `blocked`, `not-started`,
`zed-only`. Primitive values: `tasks`, `dap`, `lsp`, `settings`, `playwright-ui`, `none`.

| Capability | Status | Primitive | Note |
|------------|--------|-----------|------|
| Install Playwright | not-started | none | |
| Playwright project detection and selection | partial | lsp | Detects every `playwright.config.*` with a resolvable `@playwright/test` (v1.38 gate, nearest config wins, monorepos). Test discovery waits for the per-workspace consent question (see the last row). No project (browser) picker yet; runs use the config's default projects. |
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
| Discovery consent (Workspace Trust substitute) | zed-only | lsp | VS Code gates extension code execution with Workspace Trust; Zed has no equivalent, so the server asks once per workspace per session before running `playwright test --list` (which executes the workspace's config and test files). Until "Run discovery" is chosen, or "Playwright: Enable test discovery" is used, nothing runs and nothing is offered. |
