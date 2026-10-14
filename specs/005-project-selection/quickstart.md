# Quickstart: Verify Playwright Project Selection

Validation guide for feature 005. Contract:
[contracts/project-selection.md](./contracts/project-selection.md); rules:
[data-model.md](./data-model.md). Record outcomes in `verification.md` with the commands run
(constitution V).

## Prerequisites

- Fresh clone bootstrapped per `.claude/memory/new-machine-setup.md`; Chromium installed
  for the fixture (`npx playwright install chromium` in `fixtures/sample-project`). The new
  `mobile` project also uses Chromium, so nothing else is downloaded.
- Zed 0.218 or newer; dev extension installed on the repo root and **reinstalled after the
  Rust change** (`zed: install dev extension`; the WASM is only rebuilt by that command).
- Zed launched from a terminal exporting
  `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js` after
  `npm run build` in `server/`.
- `"code_lens": "on"` in Zed settings.
- To start from a clean memory: `rm -f ~/.local/state/playwright-zed-language-server/project-selection.json`
  (Linux; see research R5 for other platforms), or export `PLAYWRIGHT_ZED_STATE_DIR` to a
  scratch directory in the terminal that launches Zed.

## 1. Automated suite

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm run build && npm test && cd ..
cd fixtures/sample-project && npx playwright test --list && cd ../..
```

Expected: Rust tests pass and the WASM build succeeds (the shell gained
`language_server_workspace_configuration`); all earlier vitest tests pass unchanged (default
selection is `chromium`, so counts and summaries are the same); new unit tests for
`selection.ts` and `store.ts` and the integration file `projects.test.ts` pass. `--list`
now prints 32 entries (16 specs in `chromium` and in `mobile`).

## 2. Picker and run in two projects (spec story 1, scenarios 1 to 4, 6; SC-001, SC-002)

1. Open `fixtures/sample-project` in Zed, open `tests/passing.spec.ts`, wait for lenses.
2. `ctrl-.` on line 3. Expected, after the run actions: `Playwright: [x] chromium`,
   `Playwright: [ ] mobile`, `Playwright: Select all projects`.
3. Choose `Playwright: [ ] mobile`. Expected: no notification; the language server log shows
   `playwright: projects for .../playwright.config.ts: chromium, mobile (chosen)`; reopening
   the menu shows both `[x]` and no "Select all" entry.
4. Run `adds numbers` at the cursor. Expected: progress `Running 1 test(s) in
   tests/passing.spec.ts (chromium, mobile)` (one spec, two projects); Info `2 passed, 0 failed, 0 skipped`; the log
   command line carries no `--project`, because both projects are selected.
5. Choose `Playwright: [x] chromium`. Run again. Expected: `1 passed`; command line carries
   `--project mobile` only.
6. Choose `Playwright: [x] mobile` (the last one). Expected: Warning `at least one project
   must stay selected`; menu unchanged.
7. `Playwright: Select all projects`, then `Playwright: Run file`. Expected: the command line
   carries no `--project`; the summary counts add up to 24 (11 passed and 1 skipped per
   project when the TodoMVC demo is reachable and renders on the mobile emulation).

## 3. Memory across restart (story 2, SC-003)

1. With `mobile` alone selected, `zed: quit`, relaunch from the same terminal, reopen the
   fixture, open the menu. Expected: `[ ] chromium`, `[x] mobile`, and the log line ends
   with `(remembered)`.
2. `cat ~/.local/state/playwright-zed-language-server/project-selection.json`. Expected:
   one entry keyed by the absolute config path with `"projects": ["mobile"]`; file mode
   `-rw-------`, directory `drwx------`.
3. Edit the fixture config: rename `mobile` to `tablet`, save. Expected: one Info
   `project(s) mobile no longer exist ...; selection is now chromium`; menu shows
   `[x] chromium`, `[ ] tablet`. Save again without changes: no second notification.
4. Restore the config name `mobile`, save. Expected: `mobile` listed, unselected (the store
   still says `mobile`, but the fallback happened; log shows `(default)`). Toggle it on, so
   the store is current again.

## 4. Settings default (story 3)

1. Clear the store entry (delete the file). Create `fixtures/sample-project/.zed/settings.json`
   (do not commit it):

   ```json
   { "lsp": { "playwright": { "settings": { "projects": ["mobile", "nope"] } } } }
   ```

2. Reopen the folder. Expected: one Warning `setting "projects" names nope, which ... does
   not define; available: chromium, mobile`; menu shows `[ ] chromium`, `[x] mobile`; log
   says `(settings)`.
3. With Zed running, change the setting to `["chromium", "mobile"]` and save. Expected: no
   restart; the menu shows both selected within a second or two; the Warning is not repeated.
4. Toggle `chromium` off, then change the setting again. Expected: the chosen selection wins
   (source `chosen`), the setting no longer applies to this config.
5. Remove the `.zed` folder afterwards.

## 5. Lenses follow the selection (edge cases)

1. In a scratch copy of the fixture, add a test file matched only by the `mobile` project
   (for example give `mobile` a `testMatch: /mobile-only/` and create `tests/mobile-only.spec.ts`).
2. With `chromium` alone selected, open the new file. Expected: no lenses, no run action at
   the cursor; `Playwright: Run file` refuses with the Warning naming the selection.
3. Toggle `mobile` on from that file's menu. Expected: lenses appear without reopening.

## 6. Single-project configs are unchanged (SC-004)

1. In a scratch copy of the fixture, keep only the `chromium` project. Open it.
2. Expected: no `[x]` entries in the menu, progress message without a project suffix, the
   command line identical to 0.4.0 (no `--project`).

## 7. Another LSP client (optional)

The integration tests already cover a plain client; no manual step.

## Parity matrix update

After the scenarios pass, change the row "Playwright project detection and selection" in
`docs/parity.md` to `full`, primitive `lsp`, with a note naming the code action picker, the
per-user memory, and the `zed-only` settings default.
