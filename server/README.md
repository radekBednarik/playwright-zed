# playwright-zed-language-server

Language server behind the [Playwright Runner](https://github.com/radekBednarik/playwright-zed) Zed
extension. The Zed extension installs this package from npm at runtime; you do not need to
install it yourself.

It detects Playwright workspaces, discovers tests through `playwright test --list`, and runs
tests with the `@playwright/test` package installed in your project, reporting results back to
the editor over the Language Server Protocol.

Usage: `playwright-zed-language-server --stdio`.

Test discovery executes the workspace's Playwright configuration and test files. Started by
Zed 0.218 or newer (identified by `clientInfo`), the server relies on Zed's worktree trust:
Zed starts it only in folders the user trusted, so discovery runs without a further question
(revoke with `workspace: clear trusted worktrees`). With older Zed releases and other editors
it asks once per workspace folder and session before running anything.

This is an independent community project, not affiliated with, endorsed by, or maintained by
Microsoft or the Playwright team. "Playwright" is a trademark of Microsoft Corporation. The
package contains no Playwright code and does not bundle Playwright.

Project selection: in a configuration with two or more projects the server offers one code
action per project (`Playwright: [x] chromium`, `Playwright: [ ] firefox`, ...) backed by the
command `playwright.toggleProject` (`[{ uri, project }]`), plus `Playwright: Select all
projects` (`playwright.selectAllProjects`, `[{ uri }]`). Runs pass `--project <name>` per
selected project unless every project is selected. The choice is stored per configuration
file in `project-selection.json` under the user's state directory (`$XDG_STATE_HOME` or
`~/.local/state`, `~/Library/Application Support`, `%LOCALAPPDATA%`, subdirectory
`playwright-zed-language-server`; override with `PLAYWRIGHT_ZED_STATE_DIR`). Clients that
support `workspace/configuration` may answer with `{ "projects": ["chromium", "firefox"] }`
as a default for configurations without a stored choice; `workspace/didChangeConfiguration`
with the same shape applies live.

Step marks and run output (feature 006): the server declares `inlayHintProvider` and answers
`textDocument/inlayHint` with one hint per marked line, `⌛ waiting…` while a step executes
and `<n>ms` (or `<n>ms (ran <k>×)`) once it finished, refreshed through
`workspace/inlayHint/refresh`. The data comes from a small Playwright reporter shipped in this
package, `dist/step-reporter.js`, which the server appends to the run as
`--reporter=list,json,<path>`; Playwright loads it inside the user's test run and it appends
one JSON line per step event to the file named by `PLAYWRIGHT_ZED_STEP_FILE` (a temporary,
owner-only file the server polls every 200 ms). The complete output of the latest run is
written to `runs/<workspace key>.log` under the state directory (10 MB cap, one file per
workspace) and the code action `Playwright: Show last run output` (command
`playwright.showLastRunOutput`, `[{ uri }]`) opens it with `window/showDocument`. Clients
without inlay hints or `showDocument` support get the same runs without these extras and one
log line saying so.

Trace viewer (feature 008): the code action `Playwright: [x] Show trace viewer` /
`Playwright: [ ] Show trace viewer` (command `playwright.toggleTraceViewer`, `[{ uri }]`)
flips a per-user preference stored in `trace-viewer.json` under the state directory; a client
may also answer `workspace/configuration` with `{ "showTrace": true }` as a default. While it
is on, runs carry `--trace on`, the step reporter adds the predicted live trace path to
`testBegin` and the `trace` attachment path to `testEnd`, and a single-test run feeds both to
one `playwright show-trace --stdin` process per configuration (started in the workspace
root on the first trace, kept across runs, closed when the option is turned off or the server
exits). `Playwright: Show trace` (`playwright.showTrace`, `[{ uri, line }]`) shows the trace
of the test at the cursor from the last run, taken from the JSON report's attachments. Paths
are written one per line, spaced so the viewer never reads two in one chunk. The full
automated suite starts that window once, so it needs a display (`xvfb-run -a npm test` on a
headless machine; the test skips itself without one).

**Work in progress.** This is the first slice of the extension (detection, run at cursor,
run file, re-run last, project selection, step marks, run output and the trace viewer). Expect breaking changes between minor versions; the extension pins the
exact server version it was built against.

**Built with AI assistance.** The server, like the rest of the extension, is developed with
AI assistance throughout, using GitHub Spec Kit driven by Claude Code with the Claude models
Fable and Opus, with maintainer review and recorded verification for every feature.

License: MIT.
