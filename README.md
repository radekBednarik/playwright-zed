# Playwright for Zed

Run and manage [Playwright](https://playwright.dev) end-to-end tests from the
[Zed](https://zed.dev) editor. The goal is capability parity with the
[Playwright VS Code extension](https://github.com/microsoft/playwright-vscode), delivered
through the surfaces Zed gives extensions. Progress per upstream capability is tracked in
[docs/parity.md](docs/parity.md).

## What it does today

- Detects Playwright workspaces (any `playwright.config.{ts,js,mts,mjs,cts,cjs}` with
  `@playwright/test` v1.38 or newer resolvable next to it, monorepos included).
- Discovers tests through Playwright's own `--list` and shows **Run test** and
  **Run describe** code lenses above each test and group.
- **Run test at cursor**, **Run describe at cursor**, **Run file** and **Re-run last** as
  code actions (`ctrl-.` / `cmd-.`).
- Runs happen through the Playwright installed in your workspace, headless. Results arrive
  as a progress indicator, a pass/fail notification, an error marker on each failing line,
  and the full output in Zed's language server log (`debug: open language server logs`).

## Requirements

- Zed stable 1.23 or newer.
- Node.js 20 or newer on your `PATH` (Zed may also provide its own Node).
- `@playwright/test` v1.38 or newer installed in your project, with browsers installed
  (`npx playwright install`).

## Install

From the Zed extension registry: search for **Playwright** in `zed: extensions`.

From source (development):

1. `rustup target add wasm32-wasip2`
2. `cd server && npm install && npm run build`
3. In Zed, run `zed: install dev extension` and pick this repository's root.
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

## Usage

| Action | How |
|--------|-----|
| Run the test under the cursor | `ctrl-.` then **Playwright: Run test at cursor**, or click the **▶ Run test** lens |
| Run a whole describe | cursor on the `test.describe` line, same action, or **▶ Run describe** |
| Run the whole file | `ctrl-.` then **Playwright: Run file** |
| Repeat the last run | `ctrl-.` anywhere in the workspace, **Playwright: Re-run last** |

Notes:

- Runs use the file on disk. If the buffer has unsaved changes you get a warning and the
  saved version runs.
- Starting a run while one is in progress cancels the first one.
- A failing test leaves an error marker at the failing line until you edit the file or run
  again.
- With several configuration files, the one nearest to the test file is used.
- Playwright below v1.38 produces a single warning and disables running.

## Terminal output (optional)

Extensions cannot write to Zed's terminal panel. If you want the familiar terminal output,
add this task to `~/.config/zed/tasks.json`. Zed already recognises `test(` and
`test.describe(` calls in TypeScript and JavaScript files, so the gutter run button and the
`task: spawn` picker will offer it:

```json
[
  {
    "label": "Playwright: test at cursor",
    "command": "npx",
    "args": ["playwright", "test", "$ZED_FILE:$ZED_ROW"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "tags": ["js-test", "ts-test", "tsx-test"]
  }
]
```

## Development

```sh
cargo test                                    # Rust shell helpers
cargo build --release --target wasm32-wasip2  # the extension
cd server && npm run lint && npm test         # language server unit + integration tests
```

Integration tests run real Playwright against `fixtures/sample-project`; run
`npm install && npx playwright install chromium` in that folder once.

## License

MIT, see [LICENSE](LICENSE).
