# Quickstart: Show Trace Viewer

Validation guide for feature 008. Automated gate first, then manual Zed scenarios. Record
every run in `verification.md` with the command, the editor version and the outcome.

## Prerequisites

- Bootstrap per `.claude/memory/new-machine-setup.md` (Rust target, `server` built,
  fixture installed with Chromium; the trace viewer window uses that Chromium).
- A display: on the WSL host WSLg (`DISPLAY=:0`); on a headless machine `xvfb-run -a` in
  front of `npm test`.
- Zed 1.24.2 or newer, dev extension installed from the repo root
  (`zed: install dev extension`), settings `"code_lens": "on"` (inlay hints optional).
- `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`
  exported in the terminal that launches Zed (dev server), per
  `.claude/memory/dev-environment-wsl-zed.md`. After every `zed: install dev extension`
  rerun, run `editor: restart language server` from a spec file (feature 007 gotcha).
- A clean preference: remove `~/.local/state/playwright-zed-language-server/trace-viewer.json`
  (or point `PLAYWRIGHT_ZED_STATE_DIR` at an empty directory) before scenario 1.

## Automated gate

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm run build && npm test     # xvfb-run -a npm test without a display
```

Expected: all green. New unit tests cover the viewer session manager (fake spawn), the
preference store and resolution, `--trace on` in the run arguments, trace extraction from the
report and the reporter's new fields. New integration tests (`server/test/integration/trace.test.ts`)
cover the toggle and its messages, the store file, the settings default, `--trace on` in the
logged command, trace records in `playwright/status`, the off state leaving commands
byte-identical, and one test that starts the real viewer, shows a trace and closes it on
toggle off (skipped with a logged reason when no display is available).

## Manual scenarios (Zed, `fixtures/sample-project`)

1. **Turn on** (story 1, scenario 1): open `tests/passing.spec.ts`, `ctrl-.`, choose
   **Playwright: [ ] Show trace viewer**. Expected: notification `Playwright: show trace
   viewer is on`; move the cursor and reopen the menu: the entry reads `[x]`;
   `trace-viewer.json` in the state directory holds `"showTrace": true`.
2. **Single test opens the viewer** (story 1, scenario 2; SC-001, repeat three times):
   click **▶ Run test** on `adds numbers`. Expected: the Playwright trace viewer window
   opens during or right after the run and shows the `adds numbers` trace within 10 seconds
   of the pass notification; pass notification, diagnostics, step marks and
   **Show last run output** behave as before; the language server log shows the run command
   ending in `--trace on` and the lines `trace viewer ... started` and `... showing`.
3. **Same window, next trace** (story 1, scenario 3): run `multiplies`. Expected: the
   existing window now shows `multiplies`; no second window. Run `adds numbers` again:
   the window shows the new run (step timestamps differ from scenario 2).
4. **Closed by hand** (story 1, scenario 4): close the viewer window, run a test. Expected:
   a new window opens with that test's trace; the log shows `exited` then `started`.
5. **Two projects** (story 1, scenario 5): select `chromium` and `mobile` in the picker,
   run `adds numbers`. Expected: the viewer ends on the result that finished last
   (its project is visible in the viewer's metadata); **Playwright: Show trace** on that
   line shows the same.
6. **Show trace after a file run** (story 2, scenarios 1 and 2; SC-002): **Run file** on
   `passing.spec.ts`. Put the cursor inside `concatenates`, `ctrl-.`, **Playwright: Show
   trace**. Expected: the viewer shows `concatenates`. Repeat for `shows the empty app`:
   the viewer switches. Put the cursor inside `skipped on purpose`: the action reports
   `Playwright: no trace for skipped on purpose in the last run` and the viewer is unchanged.
7. **Turn off** (story 3, scenarios 1 and 4): `ctrl-.`, **Playwright: [x] Show trace
   viewer**. Expected: notification `... is off`, the viewer window closes within a few
   seconds, **Playwright: Show trace** is no longer offered. Run a test: the command has no
   `--trace`, no window opens, `test-results/` holds no `trace.zip` for it. Start the slow
   test, toggle off while it runs: the run finishes normally, no window opens.
8. **Remembered across restart** (story 3, scenario 2; SC-004): turn on, `zed: quit`,
   relaunch, open the spec file, `ctrl-.`. Expected: `[x]`, and a run opens the viewer.
9. **Settings default** (story 3, scenario 3): remove `trace-viewer.json`, add
   `"lsp": { "playwright": { "settings": { "showTrace": true } } }` to the fixture's
   `.zed/settings.json`, restart the language server. Expected: notification `... is on
   (from settings)`, a run opens the viewer. Toggle off, restart: off wins (remembered).
   Set `"showTrace": "yes"`: warning `must be true or false`, state unchanged.
10. **Viewer cannot start** (edge case): temporarily rename the fixture's Chromium
    directory under `~/.cache/ms-playwright`, turn on, run a test. Expected: the run passes
    as usual; an Error notification quotes the `show-trace` command and the browser error;
    the option stays on. Restore the directory.
11. **No reporter** (degradation): rename `server/dist/step-reporter.js`, run a single test
    with the option on. Expected: the viewer still shows the final trace at run end; a
    second run of the same test keeps the window on the previous load (documented limit:
    without the step reporter the live path is missing, and the viewer ignores an identical
    path); restore the file.

## Parity and docs check

- `docs/parity.md` row "Show trace viewer" reads `full`, primitive `lsp, playwright-ui`,
  note per research R9; the "Show browser" row gains the deferred interaction note.
- README (Usage, Settings, Differences from the VS Code extension) and `server/README.md`
  document the toggle, `Show trace`, `showTrace`, the store file and the display
  requirement for the automated suite; `.github/workflows/ci.yml` runs the server tests
  under `xvfb-run -a`.
