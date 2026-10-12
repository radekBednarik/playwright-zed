# Quickstart: Verify Project Scaffold and Run Test at Cursor

Manual verification guide. Each scenario maps to an acceptance scenario in [spec.md](spec.md).
Record outcomes in the PR description per constitution Principle V.

## Prerequisites

- Rust stable with `wasm32-wasip2`: `rustup target add wasm32-wasip2`
- Node.js 20+ and npm
- Zed stable 1.23 or newer, installed where you can run `zed: install dev extension`
- Chromium for Playwright: run `npx playwright install chromium` inside `fixtures/sample-project`

## Build and automated checks

```sh
# Rust shell
cargo test
cargo build --release --target wasm32-wasip2

# Language server
cd server && npm ci && npm test && npm run build && cd ..

# Fixture sanity (Playwright itself, no extension involved)
cd fixtures/sample-project && npm ci && npx playwright test --list && cd ../..
```

Expected: all commands exit 0; `--list` prints 15 tests (12 in passing.spec.ts including two
loop-generated, one skipped and three real TodoMVC browser tests; 3 in failing.spec.ts: one
failing, one fixme, one real TodoMVC failure). The TodoMVC tests need network access.

## Install as dev extension

1. During development, point the shell at the local server build instead of npm: set
   `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`
   (the `bin` script loads the compiled `server/dist/` output, so run `npm run build` first)
   in the shell environment Zed loads for the project: export it in `~/.bashrc` or start
   `zed` from a shell where it is exported (the shell reads it through `worktree.shell_env()`,
   development-only).
2. In Zed run `zed: install dev extension`, choose the repository root.
3. In Zed settings add `"code_lens": "on"` to see run lenses (code actions work without it).
4. Run `zed: open log` to watch for extension errors, and `dev: open language server logs`
   (or the lightning bolt in the status bar) for the Playwright server log.

## Scenarios

| # | Spec ref | Steps | Expected |
|---|----------|-------|----------|
| 1 | US1-1 | Open Zed extensions page | "Playwright" listed with version and description, marked as dev extension |
| 2 | US1-2 | Open `fixtures/sample-project` in Zed, open `tests/passing.spec.ts` | Language server "Playwright" shows running in the status bar; lenses "▶ Run test" above each test; ctrl-. shows "Playwright: Run test at cursor" |
| 3 | US1-3 | Open a folder with a `.ts` file and no Playwright | No Playwright lenses or actions; no errors in Zed log from the extension |
| 4 | US1-4 | In a scratch copy of the fixture, install `@playwright/test@1.37.1`, reopen | One warning notification naming 1.37.1 and the 1.38 minimum; no run actions |
| 5 | US2-1 | Cursor inside `test('adds numbers')`, ctrl-., Enter | Progress "Running 1 test(s)"; Info notification "1 passed"; Playwright server log (`dev: open language server logs`) shows the command and list output |
| 6 | US2-2 | Cursor inside the failing test in `failing.spec.ts`, run at cursor | Error notification "0 passed, 1 failed"; a `playwright` diagnostic on the failing `expect` line with the assertion message |
| 7 | US2-3 | Cursor on the `test.describe('math')` line, run | Only the 2 tests inside the describe run (summary shows 2) |
| 8 | US2-4 | Cursor on line 1 (imports), run at cursor | All 12 tests in the file run; summary 11 passed, 1 skipped |
| 9 | US2-5 | Run each of the two tests titled `same title` | Exactly 1 test runs each time, from the matching describe |
| 10 | US2-6 | Start a run, immediately run again on the same test | First run cancelled (warning), second completes; diagnostics reflect the second only |
| 11 | US3-1 | ctrl-. "Playwright: Run file" in passing.spec.ts | Summary shows 12 results: 11 passed, 1 skipped |
| 12 | US3-2 | Open `playwright.config.ts`, ctrl-. | No Playwright run actions |
| 13 | US4-1 | After scenario 5, move cursor to another file, ctrl-. "Re-run last" | Same single test runs again |
| 14 | US4-2 | Fresh Zed session, "Re-run last" | Info "Nothing to re-run yet" |
| 15 | Edge: unsaved | Edit a test without saving, run at cursor | Warning about unsaved changes; run uses saved content |
| 16 | Edge: special chars | Run the test titled with parens, brackets and quotes | Exactly 1 test runs |
| 17 | Edge: broken Node | Temporarily break `node` on PATH, open the fixture | Language server fails with a message naming Node; Zed log shows the error |
| 18 | Edge: loop tests | Cursor on the `for` line that generates `loop 1` and `loop 2`, run at cursor | Exactly 2 tests run |
| 19 | Edge: skipped test | Cursor in `test.skip('skipped on purpose')`, run at cursor | Summary reports 1 skipped, 0 failed; no diagnostic |
| 20 | Edge: fixme test | Cursor in `test.fixme('fixme on purpose')` in failing.spec.ts, run at cursor | Summary reports 1 skipped, 0 failed; no diagnostic |
| 21 | Real browser | Cursor on `test.describe('todomvc'` in passing.spec.ts, run describe | Chromium opens demo.playwright.dev; summary 3 passed |
| 22 | Real failure | Run `expects a wrong heading` in failing.spec.ts | Error notification with `Expected: "tasks"`, `Received: "todos"`; diagnostic on the `toHaveText` line |
| 23 | Edge: focused test | In a scratch copy of the fixture (not the fixture itself: `test.only` focuses the whole run) add a file with `test.only('focused')` and `test('not focused')`; **Run file**, then run `not focused` at cursor | File run: summary 1 passed, 0 skipped, only `focused` in the log. Cursor run: `not focused` runs and passes; Playwright applies focus only among the tests the line filter selected |

## Terminal-output path (zed-only recipe)

Add to `~/.config/zed/tasks.json` and use the gutter run button on any `test(` line:

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

Expected: output appears in Zed's terminal panel. Record this row as `zed-only` in
`docs/parity.md`.

## Parity matrix update

After all scenarios pass, set in `docs/parity.md`:

- Playwright project detection: `partial` (detects config and version; no project/browser
  picker yet)
- Run tests with a single click: `partial` (run at cursor, describe, file, re-run; no line
  highlighting, no step durations, no terminal output from the extension)
- Terminal output via tasks recipe: `zed-only`
