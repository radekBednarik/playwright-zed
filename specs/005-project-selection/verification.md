# Verification Record: Playwright Project Selection

Recorded 2026-10-14 on WSL2 (Linux), Node 24.18.1, cargo 1.99.0, Playwright 1.64.0 with the
Chromium headless shell from `npx playwright install chromium`. The fixture
`fixtures/sample-project` now defines two projects, `chromium` and `mobile` (Pixel 7
emulation, also Chromium).

## Automated verification (T039)

```text
$ cargo test
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.02s

$ cd server && npm run lint
exit=0

$ cd server && npm run build
exit=0

$ cd server && npx vitest run
 Test Files  14 passed (14)
      Tests  152 passed (152)
   Duration  54.66s (tests 100%)

$ cd fixtures/sample-project && npx playwright test --list
Total: 32 tests in 2 files
```

Vitest totals: 88 unit tests across 8 files (feature 003 had 59; this feature adds
`test/unit/selection.test.ts` with 19 and `test/unit/store.test.ts` with 7, and extends the
discovery, commands and runner tests) and 64 integration tests across 6 files (49 before;
`test/integration/projects.test.ts` adds 15: picker, toggles, filtered runs, select all,
unknown names, picker from the config file, lens filtering on a two-project scratch
project, single-project parity, persistence across a server restart, dropped and added
projects, settings seed, live settings change, chosen beats settings, malformed setting,
client without `workspace/configuration`). The Rust shell gained
`language_server_workspace_configuration` and the `forward_settings` helper with one test.

Finding recorded during T012: the JSON `--list` report repeats every spec once per project.
`parseListReport` now merges those entries (same file, line, column and title path) into one
DiscoveredTest with the union of project names, so test counts stay per spec and the
existing 16-test assertions hold.

Pre-existing tests touched: three code action assertions in `run.test.ts` now ignore the
picker entries, which the fixture's second project adds to every menu. No other test changed
its expectations.

## Rust shell and release preparation (T031, T038)

`src/lib.rs` forwards `LspSettings::for_worktree("playwright", worktree).settings` as the
workspace configuration (objects only). `extension.toml`, `Cargo.toml` (and `Cargo.lock`)
and `server/package.json` are at 0.5.0. `PINNED_SERVER_VERSION` in `src/lib.rs` is still
0.4.0 on purpose: the owner's lockstep rule publishes the server first and bumps the pin
afterwards (`docs/publishing.md` sections 1 and 4). Until the pin is bumped, a Zed without
the `PLAYWRIGHT_ZED_SERVER_ENTRY` override runs server 0.4.0, which has no project
commands; manual verification therefore uses the override. Steps left to the owner: `npm
publish` 0.5.0, set the pin to 0.5.0, tag `v0.5.0`, then the registry update when wanted.

## Owner finding during manual use (T040)

Reopening the code action menu at the same cursor right after a toggle shows the check marks
from before the toggle; moving to another test and back shows the new state. Cause, from
Zed `main` on 2026-10-14: `crates/editor/src/code_actions.rs` reuses
`code_actions_for_selection` when it is `Ready`; it is refetched only on selection change
(`crates/editor/src/selection.rs`), on a buffer `Edited` event and on
`LanguageServerBufferRegistered` (`crates/editor/src/editor.rs`), never after a command-only
code action has run. Chosen remedy (option 1, owner 2026-10-14): the server confirms every
selection change with an Info notification; no API workaround. Facts for a Zed issue, for the
owner to write up: "code action menu is not refetched after a code action with a `command`
and no `edit` was executed; language servers whose actions change server-side state (toggle
settings, pick targets) show stale titles until the cursor moves; expected: invalidate
`code_actions_for_selection` after `confirm_code_action`, or refetch on
`workspace/codeLens/refresh`".

Re-run after the change:

```text
$ cd server && npx vitest run
Test Files  14 passed (14)
      Tests  152 passed (152)
```

## Owner finding during manual use (T041)

A test failing in both projects showed two identical diagnostics. The JSON run report lists
one `tests[]` entry per project (and repeats the spec per project), and the parser took one
failure per spec. Now every failing project entry yields a Failure with its `project`, and
diagnostics and the error notification carry a `[<project>]` prefix when the config defines
two or more projects; single-project configs are unchanged (SC-004).

```text
$ cd server && npx vitest run
Test Files  14 passed (14)
      Tests  154 passed (154)
```

## Manual verification in Zed (T032, T037): passed, owner, 2026-10-14

The owner ran quickstart sections 2, 3, 4, 5 and 6 (`quickstart.md`) in Zed on 2026-10-14
with the dev extension reinstalled after the Rust change (`zed: install dev extension`), Zed
launched from a terminal exporting
`PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`, the
server built at commit `f49d354`, and `"code_lens": "on"`. All scenarios passed, including
the two findings fixed along the way (T040 notification after each toggle, T041 project
prefix in diagnostics). The parity row's `full` status rests on this record.

| Section | Scenario | Outcome | Notes |
|---------|----------|---------|-------|
| 2 | Picker and run in two projects | PASS | menu check marks at an unchanged cursor refresh on the next cursor move (Zed cache, T040); the notification names the selection at once |
| 3 | Memory across restart, dropped and restored project | PASS | |
| 4 | Settings default, unknown name warning, live change, chosen wins | PASS | exercised the shell's `language_server_workspace_configuration` |
| 5 | Lenses follow the selection on a scratch project | PASS | |
| 6 | Single-project config unchanged | PASS | |
