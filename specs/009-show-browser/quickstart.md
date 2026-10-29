# Quickstart: Show Browser

Validation guide for feature 009. Automated gate first, then manual Zed scenarios. Record
every run in `verification.md` with the command, the editor version and the outcome.

## Prerequisites

- Bootstrap per `.claude/memory/new-machine-setup.md` (Rust target, `server` built,
  fixture installed with Chromium; the kept browser is that Chromium).
- A display for the manual scenarios: on the WSL host WSLg (`DISPLAY=:0`). The automated
  suite needs none for this feature (the kept browser runs headless under
  `PW_DEBUG_CONTROLLER_HEADLESS=1`, research R7); feature 008's viewer test still wants
  `xvfb-run -a` on a headless machine.
- Zed 1.24.2 or newer, dev extension installed from the repo root
  (`zed: install dev extension`), settings `"code_lens": "on"`.
- `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`
  exported in the terminal that launches Zed (dev server), per
  `.claude/memory/dev-environment-wsl-zed.md`. After every `zed: install dev extension`
  rerun, run `editor: restart language server` from a spec file (feature 007 gotcha).
- Clean preferences: remove `show-browser.json` and `trace-viewer.json` from
  `~/.local/state/playwright-zed-language-server/` (or point `PLAYWRIGHT_ZED_STATE_DIR` at
  an empty directory) before scenario 1.

## Automated gate

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm run build && npm test     # xvfb-run -a npm test without a display (feature 008's viewer test)
```

Expected: all green. New unit tests cover the browser server manager (fake spawn: start on
first need, `Listening on` parsing, readiness timeout, spawn error, early exit, SIGINT stop
with the SIGKILL fallback, forget on exit), the preference store and resolution, the run
arguments (`--headed --workers 1 --trace off`) and environment, and the trace coupling. New
integration tests (`server/test/integration/browser.test.ts`) cover the toggle and its
messages, the store file, the settings default, the logged command and endpoint, one
headless browser server per config in `playwright/status` kept across two runs, "Close all
browsers" refused during a run and effective after it, toggle off stopping the server, the
coupling with the trace viewer, and the off state leaving commands byte-identical.

## Manual scenarios (Zed, `fixtures/sample-project`)

1. **Turn on** (story 1, scenario 1): open `tests/passing.spec.ts`, `ctrl-.`, choose
   **Playwright: [ ] Show browser**. Expected: notification `Playwright: show browser is on`;
   move the cursor and reopen the menu: the entry reads `[x]` and **Playwright: Close all
   browsers** is listed; `show-browser.json` in the state directory holds
   `"showBrowser": true`.
2. **Visible run** (story 1, scenario 2; SC-001, repeat three times): click **▶ Run test**
   on `adds numbers`. Expected: a Chromium window appears within 10 seconds of the click,
   the page shows `3`, the pass notification, diagnostics, step marks and **Show last run
   output** behave as before; the language server log shows `browser server ... started`,
   `... listening on ws://127.0.0.1:...`, `run 1 browser server ws://...` and a run command
   ending in `--headed --workers 1 --trace off`.
3. **File run, one at a time** (story 1, scenario 3): **Run file** on `passing.spec.ts`.
   Expected: the tests run one after another in the same window (the page content changes
   per test), the summary reports 11 passed and 1 skipped as before.
4. **Two projects** (story 1, scenario 4): select `chromium` and `mobile` in the picker,
   run `adds numbers`. Expected: both results pass, each visible in turn in the window (the
   `mobile` one in a phone-sized viewport), messages name the project as today.
5. **Kept between runs** (story 2, scenarios 1 to 3; SC-002): after scenario 2 the window
   is still open showing the last page. Run `multiplies`: the same window is used, no second
   window appears, and the log shows no new `browser server ... started` line. Close the
   window by hand, run `adds numbers`: a fresh window opens (the log still shows no new
   `started` line: the server survived, the browser was relaunched).
6. **Close all browsers** (story 3, scenarios 1 and 2; SC-003): `ctrl-.`, **Playwright:
   Close all browsers**. Expected: the window closes within 5 seconds, notification
   `Playwright: browsers closed`, the entry **[x] Show browser** stays, the next run opens a
   fresh window (log: `started` again). Start the slow test (`tests/slow.spec.ts`), choose
   **Close all browsers** while it runs: warning `cannot close browsers while tests are
   running`, the window stays and the run finishes. Choose it with nothing running:
   `Playwright: no browsers to close`.
7. **Turn off** (story 3, scenarios 3 and 6): with the window open, `ctrl-.`, **Playwright:
   [x] Show browser**. Expected: notification `... is off`, the window closes within 5
   seconds, the next run opens no window and its command carries none of the three flags.
   Turn on, start the slow test, turn off while it runs: the run finishes normally in the
   window, then the window closes.
8. **Remembered across restart** (story 3, scenario 4; SC-005): turn on, `zed: quit`,
   relaunch, open the spec file, `ctrl-.`. Expected: `[x]`, and a run opens the window.
9. **Settings default** (story 3, scenario 5): remove `show-browser.json`, add
   `"lsp": { "playwright": { "settings": { "reuseBrowser": true } } }` to the fixture's
   `.zed/settings.json`, restart the language server. Expected: notification `... is on
   (from settings)`, a run opens the window. Toggle off, restart: off wins (remembered).
   Set `"reuseBrowser": "yes"`: warning `must be true or false`, state unchanged.
10. **Trace viewer coupling** (story 4; SC-006): turn **Show trace viewer** on, run a test
    (viewer opens), then turn **Show browser** on. Expected: notification `show browser is
    on; show trace viewer turned off (no traces while the browser is shown)`, the trace
    viewer window closes, the menu (after a cursor move) shows `[ ] Show trace viewer`. Run
    a test: no trace in `test-results/`, **Show trace** is not offered, the browser window
    is open. Turn **Show trace viewer** on again: notification `show trace viewer is on;
    show browser turned off (browsers closed)`, the browser window closes within 5 seconds,
    the menu (after a cursor move) shows `[ ] Show browser` and no **Close all browsers**;
    run a test: the trace viewer opens as in feature 008 and no browser window appears.
    Settings path (both on): with the viewer on, add `"reuseBrowser": true` to the fixture's
    `.zed/settings.json` and restart the language server; run a test: a one-time warning
    `show browser is on, so runs record no trace; ...`, the command carries `--trace off`,
    the browser window appears and no trace is recorded; remove the setting afterwards.
11. **Server cannot start** (edge case): after discovery, temporarily rename the fixture's
    `node_modules/@playwright/test/cli.js`, turn on, run a test. Expected: an Error
    notification `Playwright could not start the browser server.` with the command and the
    spawn error, the run does not start, the option stays on. Restore the file. (A missing
    Chromium does not hit this path: the server starts fine and launches the browser only on
    the run's first connection, so the run reports the missing browser as today.)
12. **Discovery untouched** (edge case): with the option on, edit and save a spec file.
    Expected: discovery reruns without opening a window or starting a server (log shows
    only `--list`).

## Parity and docs check

- `docs/parity.md` rows "Show browser" and "Close all browsers" read `full`, primitive
  `lsp, playwright-ui`, notes per research R9; the "Show trace viewer" row drops its
  deferred note and names the coupling.
- README (Usage table, "Show browser" section next to "Trace viewer", Settings, Differences
  from the VS Code extension) and `server/README.md` document the two actions, the
  `reuseBrowser` setting, the store file, the three run flags, the kept `run-server`
  process and the SIGINT stop.
