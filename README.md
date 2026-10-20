# Playwright Runner

A [Zed](https://zed.dev) extension that runs and manages [Playwright](https://playwright.dev)
end-to-end tests from the editor. The goal is feature parity with the
[Playwright VS Code extension](https://github.com/microsoft/playwright-vscode), delivered
through the surfaces Zed gives extensions. Progress per upstream capability is tracked in
[docs/parity.md](docs/parity.md).

This is an independent community extension. It is not affiliated with, endorsed by, or
maintained by Microsoft or the Playwright team. "Playwright" is a trademark of Microsoft
Corporation; the name is used only to describe what this extension works with. The extension
contains no code from the Playwright projects and drives the Playwright installed in your
own workspace through its public command line.

## Project status

**Work in progress.** Only the first slice is implemented: workspace detection, running a
test, a `describe` group, or a file from the editor, and picking the Playwright projects
(browsers) a run uses. The remaining upstream capabilities are
listed with their status in [docs/parity.md](docs/parity.md). Expect rough edges, breaking
changes between minor versions, and gaps compared to the VS Code extension. Bug reports and
feedback are welcome in the issue tracker.

## Built with AI assistance

This extension is developed with AI assistance throughout: specification, planning, code,
tests and documentation. The workflow is [GitHub Spec Kit](https://github.com/github/spec-kit)
driven by [Claude Code](https://claude.com/claude-code) with the Claude models Fable and Opus.
Every change is reviewed by the maintainer, and automated and manual verification is recorded
per feature under `specs/`, but treat the code with the care you would give any young
AI-assisted project.

## What it does today

- Detects Playwright workspaces (any `playwright.config.{ts,js,mts,mjs,cts,cjs}` with
  `@playwright/test` v1.38 or newer resolvable next to it, monorepos included).
- Runs nothing from a folder until it is trusted, because test discovery executes the
  workspace's Playwright configuration and test files. On Zed 0.218 or newer, trusting the
  folder in Zed is enough; older Zed releases get a question once per workspace and session.
- Discovers tests through Playwright's own `--list` and shows **Run test** and
  **Run describe** code lenses above each test and group.
- **Run test at cursor**, **Run describe at cursor**, **Run file** and **Re-run last** as
  code actions (`ctrl-.` / `cmd-.`).
- Picks the Playwright projects (browsers) to run in, one, several or all, from the same
  menu; the choice is remembered per config across restarts, and a folder default can be
  set in Zed settings (see "Projects" below).
- Runs happen through the Playwright installed in your workspace, headless. Results arrive
  as a progress indicator, a pass/fail notification, an error marker on each failing line,
  and the full output in Zed's language server log (`dev: open language server logs`).
- While a test runs, the step that is executing right now carries a `⌛ waiting…` label at
  the end of its line; afterwards every step line shows how long it took (`2003ms`, or
  `2003ms (ran 2×)` when the line ran in two projects). The labels are inlay hints, see
  "Settings" below.
- **Show last run output** opens the complete output of the latest run (the command line,
  Playwright's own report, everything the test printed) in an editor tab.

## Requirements

- Zed stable 1.23 or newer.
- Node.js 20 or newer on your `PATH` (Zed may also provide its own Node).
- `@playwright/test` v1.38 or newer installed in your project, with browsers installed
  (`npx playwright install`).

## Install

**From the Zed extension registry.** Open `zed: extensions` and search for
**Playwright Runner**. The listing is under review in the Zed extension registry
([zed-industries/extensions#7975](https://github.com/zed-industries/extensions/pull/7975));
the submission process is described in
[docs/publishing.md](docs/publishing.md). Until the review completes, install from source.

**From source.**

1. `rustup target add wasm32-wasip2`
2. `cd server && npm install && npm run build`
3. In Zed, run `zed: install dev extension` and pick this repository's root.
   If you installed a dev extension before 0.4.0, it is listed as "Playwright for Zed" with
   the id `playwright`; uninstall it in `zed: extensions` first, otherwise two Playwright
   language servers start on the same files.

   Files that are already open when the extension is installed are picked up without
   closing and reopening them (verified on Zed 1.24.2). One exception: after an **update, a
   reinstall, or a rerun of `zed: install dev extension` in the same Zed session**, Zed keeps
   the Playwright server stopped. It marks the server as manually stopped when the old
   extension version unloads and never clears the mark, so no file is served, open before
   or after. Run `editor: restart language server` from any TypeScript or JavaScript file of
   the project, or restart Zed; closing and reopening files does not help. Tracked in Zed as
   [zed-industries/zed#60405](https://github.com/zed-industries/zed/issues/60405) (the
   remote variant of the same mechanism).
4. Optional, to use the local server build instead of the published npm package, set
   `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`. The
   extension reads it from the shell environment Zed loads for the project, so either export
   it in your shell profile (`~/.bashrc`, `~/.profile`) or start `zed` from a shell where it
   is exported.

The extension installs the language server package `playwright-zed-language-server`
from npm on first use. Nothing is bundled.

## Settings

Code lenses are off by default in Zed. To see the run buttons above tests, add to your Zed
settings:

```json
{
  "code_lens": "on"
}
```

Use `"menu"` instead to list lenses inside the code action menu.

Inlay hints are off by default in Zed as well. The executing-step label and the per-step
durations are inlay hints, so they appear only with:

```json
{
  "inlay_hints": {
    "enabled": true
  }
}
```

Both settings can live under `"languages": { "TypeScript": { ... } }` if you prefer them per
language. Without them the extension runs tests exactly the same; only the labels are absent.

## Usage

### Before the first run: test discovery

Test discovery executes the workspace's Playwright configuration and test files, so it
only runs in folders you trust.

**Zed 0.218 or newer.** Zed asks whether you trust a folder (Restricted Mode) and starts
language servers only after you do. That answer is the only question: the Playwright server
discovers tests at once and Zed remembers the trust across restarts, much like Workspace
Trust protects the upstream VS Code extension.

- To revoke trust, run `workspace: clear trusted worktrees` (it clears every trusted folder
  and restarts Zed).
- `"session": { "trust_all_worktrees": true }` in your user settings makes discovery run in
  every folder without asking, as turning off Workspace Trust does in VS Code.
- Inside a dev container Zed applies no worktree trust, so discovery runs without a question
  once you have chosen **Open in Container**.

**Older Zed releases and other editors.** The Playwright server shows one notification: it
names the folder, explains that discovery executes the workspace's Playwright configuration
and test files, and offers **Run discovery** and **Not now**. The same question appears on
any Zed release when a folder reaches the server only as a root URI rather than as a
workspace folder.

- **Run discovery** starts discovery at once; lenses and run actions appear and nothing
  asks again until Zed is restarted or the folder is closed.
- **Not now**, or closing the notification, keeps the extension idle for that folder:
  nothing from it is executed and no run actions are offered. To change your mind, open any
  file in the folder, press `ctrl-.` and choose **Playwright: Enable test discovery**.
- The answer is remembered for the editing session only; each root folder is asked
  separately. Reading the installed Playwright version never executes workspace code, so
  the "version too old" warning can appear before you answer.

| Action                           | How                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Run the test under the cursor    | `ctrl-.` then **Playwright: Run test at cursor**, or click the **▶ Run test** lens |
| Run a whole describe             | cursor on the `test.describe` line, same action, or **▶ Run describe**             |
| Run the whole file               | `ctrl-.` then **Playwright: Run file**                                             |
| Repeat the last run              | `ctrl-.` anywhere in the workspace, **Playwright: Re-run last**                    |
| Enable discovery after "Not now" | `ctrl-.` in any file of that folder, **Playwright: Enable test discovery**         |
| Choose the projects (browsers)   | `ctrl-.` in any file of the config, toggle **Playwright: [ ] <project>**            |
| Run in every project             | `ctrl-.`, **Playwright: Select all projects**                                      |
| Read the full output of a run    | `ctrl-.` after a run, **Playwright: Show last run output**                         |
| Record and show traces           | `ctrl-.` in any file of the config, **Playwright: [ ] Show trace viewer**          |
| Open the trace of one test       | cursor in the test after a run, `ctrl-.`, **Playwright: Show trace**               |

Notes:

- After toggling a project or selecting all, a notification names the projects now
  selected. Zed keeps the `ctrl-.` menu cached per cursor position, so reopening it at the
  very same spot still shows the old `[x]` marks; move the cursor (another line is enough)
  and the menu is refetched with the current state. See "Projects" below.

- Runs use the file on disk. If the buffer has unsaved changes you get a warning and the
  saved version runs.
- Starting a run while one is in progress cancels the first one.
- A failing test leaves an error marker at the failing line until you edit the file or run
  again. With two or more projects, each failing project gets its own marker and the
  message starts with the project in brackets, for example `[mobile] adds numbers: ...`.
- With several configuration files, the one nearest to the test file is used.
- Playwright below v1.38 produces a single warning and disables running.
- Step labels follow the file: an edit removes the durations of that file (their lines may
  have moved), the next run removes all of them, and closing and reopening an unedited file
  brings them back. Steps inside helper files and page objects are labelled there.
- The run output is written to a `runs/` folder under the state directory listed in
  "Projects" below, one file per workspace, latest run only, and opened as a normal buffer.
  Zed keeps the tab in sync with the file, so the next run updates it in place. Put the
  cursor on a `tests/foo.spec.ts:12:7` reference and use `editor: open selected filename`
  to jump there.

### Differences from the VS Code extension

- The executing step is marked with a trailing label, not a highlighted line: Zed has no
  decoration API for extensions, inlay hints are the closest native surface.
- The run output opens as an editor tab, not in a Test Results panel, because Zed has no
  panel an extension could fill. The tasks recipe under "Terminal output" is the way to a
  real terminal.
- Both surfaces are opt-in through Zed settings (`code_lens`, `inlay_hints`).
- "Show trace viewer" is an entry in the `ctrl-.` menu rather than a checkbox in a settings
  view, and the trace of a particular test is chosen with the cursor rather than in a Test
  Explorer tree, because Zed has neither. The viewer window starts with the first trace to
  show instead of before the run.

### Projects

Playwright runs each test once per project of your `playwright.config.*`, and most projects
name a browser. Like the VS Code extension, the runner starts with the **first project**
selected; a configuration with a single project behaves exactly as before and shows no
picker. In any file that belongs to a configuration with two or more projects, `ctrl-.`
lists them as `Playwright: [x] chromium`, `Playwright: [ ] firefox`, and so on. Choosing an
entry toggles that project; at least one stays selected. **Playwright: Select all projects**
selects every one. Runs pass the selected projects to Playwright (no filter when all are
selected), the run lenses show only tests that run in a selected project, and the progress
message names the projects used.

The choice is remembered per configuration file, outside the repository, in a small JSON
file owned by your user:

| OS      | Location                                                           |
| ------- | ------------------------------------------------------------------ |
| Linux   | `$XDG_STATE_HOME` or `~/.local/state/playwright-zed-language-server/` |
| macOS   | `~/Library/Application Support/playwright-zed-language-server/`     |
| Windows | `%LOCALAPPDATA%\playwright-zed-language-server\`                    |

Set `PLAYWRIGHT_ZED_STATE_DIR` in the environment Zed starts from to move it. A project that
disappears from the configuration is dropped from the selection with one notice; a new
project stays unselected until you pick it.

A team default for a folder can live in Zed settings (`.zed/settings.json` in the
repository, or your user settings); it applies when you have not picked anything yet and
changes take effect without a restart:

```json
{
  "lsp": {
    "playwright": {
      "settings": {
        "projects": ["chromium", "firefox"]
      }
    }
  }
}
```

Names the configuration does not define produce one warning listing the available projects.
This setting is specific to the Zed extension; the upstream VS Code extension has no
equivalent.

Every toggle is confirmed by a notification naming the projects now selected. Zed caches
the code action menu per cursor position and refetches it only when the cursor moves or the
file changes, so reopening the menu at the very same spot right after a toggle still shows
the old check marks; the notification shows the real state, and the next cursor move
refreshes the menu.

### Trace viewer

Like the VS Code extension's **Show trace viewer** checkbox, **Playwright: [ ] Show trace
viewer** (in the `ctrl-.` menu of any file that belongs to a Playwright configuration) makes
every run record a full [trace](https://playwright.dev/docs/trace-viewer) and opens
Playwright's own trace viewer window for it:

- Run a single test (**▶ Run test** or **Run test at cursor**) and the viewer opens with that
  test, following it while it runs and showing the final trace when it ends. Later single-test
  runs reuse the same window. If you close the window, the next trace opens a new one.
- After **Run file**, **Run describe** or **Re-run last**, put the cursor inside a test and
  choose **Playwright: Show trace** to see that test's trace from the last run. A test that
  recorded none (skipped, or not part of the run) gets a message instead.
- Choose **Playwright: [x] Show trace viewer** again to turn it off: the window closes and
  runs go back to your configuration's own `trace` setting. Every toggle is confirmed by a
  notification, for the same menu-caching reason as the project picker.

While it is on, runs pass `--trace on` to Playwright, so they take a little longer and
`test-results/` holds a `trace.zip` per test; Playwright manages those files, the extension
never deletes them. The viewer is started from your project's own Playwright
(`playwright show-trace`), so it needs the Chromium that `npx playwright install` provides;
if it cannot start, you get one error notification with the command, and the run itself is
unaffected.

The choice is remembered per user in `trace-viewer.json` next to `project-selection.json`
(locations in "Projects" above). A folder or team default lives in the same settings block as
the projects default and applies until you toggle the option yourself:

```json
{
  "lsp": {
    "playwright": {
      "settings": {
        "showTrace": true
      }
    }
  }
}
```

## Terminal output (optional)

Extensions cannot write to Zed's terminal panel. **Playwright: Show last run output** gives
you the same text in an editor tab; if you want a real terminal, add this task to
`~/.config/zed/tasks.json`. Zed already recognises `test(` and
`test.describe(` calls in TypeScript and JavaScript files, so the gutter run button and the
`task: spawn` picker will offer it:

```json
[
  {
    "label": "Playwright: Run test at cursor with CLI output",
    "command": "npx",
    "args": ["playwright", "test", "$ZED_FILE:$ZED_ROW"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "tags": ["js-test", "ts-test", "tsx-test"]
  }
]
```

## Manual testing

Prerequisites: Rust with the `wasm32-wasip2` target, Node 22.12+, Zed 1.23+ on the same
machine as this clone (on WSL use a Linux Zed, the Windows one cannot load a dev extension
from a WSL path).

1. Build the server and the browser for the sample project:
   ```sh
   (cd server && npm install && npm run build)
   (cd fixtures/sample-project && npm install && npx playwright install chromium)
   ```
2. Point the extension at the local server. Add to `~/.bashrc` (Zed reads the shell
   environment, a one-off `export` is not enough), then open a new shell:
   ```sh
   export PLAYWRIGHT_ZED_SERVER_ENTRY=/absolute/path/to/playwright-zed/server/bin/playwright-zed-language-server.js
   ```
3. Start Zed on the sample project with logs attached:
   ```sh
   cd fixtures/sample-project && zed --foreground .
   ```
4. `ctrl-shift-p`, run `zed: install dev extension`, choose the repository root. Zed
   compiles the Rust crate; the first build takes about a minute.
5. `zed: extensions` must list **Playwright Runner 0.7.0**.
6. `zed: open settings`, add `"code_lens": "on"`.
7. Zed 0.218+ asks whether you trust the folder; trust it. (Older Zed instead shows the
   Playwright notification for `sample-project`; click **Run discovery**.) Open `tests/passing.spec.ts`. Expect `▶ Run test` above each test and
   `▶ Run describe` above each group. Click the lightning bolt in the status bar, or run
   `dev: open language server logs`, pick **Playwright**: the log shows
   `discovered 16 test(s)`.
8. Run checks (`ctrl-.` opens the actions):

   | Check              | Steps                                                                                  | Expected                                                                                          |
   | ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
   | Single test        | cursor in `adds numbers`, **Run test at cursor**                                       | progress, then "1 passed, 0 failed, 0 skipped (0.4s)"; the time is Playwright's own measurement   |
   | Failure            | `tests/failing.spec.ts`, run first test                                                | error notification with "Expected: 3", red marker on the `expect` line                            |
   | Describe           | cursor on `test.describe('math'`, **Run describe at cursor**                           | "2 passed"                                                                                        |
   | Duplicate titles   | run each `same title`                                                                  | "1 passed" each                                                                                   |
   | Real browser       | cursor on `test.describe('todomvc'` in `passing.spec.ts`, **Run describe at cursor**   | Chromium visits demo.playwright.dev, "3 passed"                                                   |
   | Real failure       | `failing.spec.ts`, run `expects a wrong heading`                                       | error notification with `Expected: "tasks"` and `Received: "todos"`                               |
   | File               | **Run file** in `passing.spec.ts`                                                      | "11 passed, 0 failed, 1 skipped"                                                                  |
   | Re-run             | in `playwright.config.ts`, **Re-run last**                                             | previous selection runs again                                                                     |
   | Cancel             | start two runs back to back                                                            | "cancelled" warning, then the second result                                                       |
   | Unsaved            | edit without saving, run                                                               | "unsaved changes" warning, saved file runs                                                        |
   | Trust remembered   | restart Zed, open the fixture                                                          | no question; lenses appear; the log shows `Zed trusts <path>; test discovery enabled without asking` |
   | Declined discovery | Zed before 0.218: restart Zed, open the fixture, click **Not now**                     | no lenses; `ctrl-.` offers only **Playwright: Enable test discovery**; using it brings the lenses |
   | No Playwright      | open a folder with a `.ts` file and no Playwright                                      | no question, no lenses, no actions, no warnings                                                   |
   | Old version        | copy the sample, set `@playwright/test` version to `1.37.1` in `node_modules`, open it | one warning naming 1.37.1 and 1.38, no actions                                                    |

After a Rust change run `zed: install dev extension` again, then
`editor: restart language server` (Zed keeps the server stopped after a reinstall, see
Install). After a server change run
`npm run build` and `editor: restart language server`. Problems with the extension itself
appear in `zed: open log`; problems with runs appear in the Playwright server log.

## Development

```sh
cargo test                                    # Rust shell helpers
cargo build --release --target wasm32-wasip2  # the extension
cd server && npm run lint && npm test         # language server unit + integration tests
```

Integration tests run real Playwright against `fixtures/sample-project`; run
`npm install && npx playwright install chromium` in that folder once. The `todomvc` tests
visit https://demo.playwright.dev/todomvc/ and need network access.

## License

MIT, see [LICENSE](LICENSE). Playwright itself is licensed separately by Microsoft under
Apache 2.0 and is not distributed with this extension.
