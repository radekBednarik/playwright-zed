# Quickstart: Single-Click Run Parity Gaps

Validation guide for feature 006. Automated gate first, then manual Zed scenarios. Record
every run in `verification.md` with the command, the editor version and the outcome.

## Prerequisites

- Bootstrap per `.claude/memory/new-machine-setup.md` (Rust target, `server` built,
  fixture installed with Chromium).
- Zed 1.24.2 or newer, dev extension installed from the repo root
  (`zed: install dev extension`), settings:

```json
{
  "code_lens": "on",
  "inlay_hints": { "enabled": true }
}
```

- `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`
  exported in the terminal that launches Zed (dev server), per
  `.claude/memory/dev-environment-wsl-zed.md`.

## Automated gate

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm run build && npm test
```

Expected: all green; new unit tests for the marks store, hint derivation, log formatting and
the reporter module; new integration tests that run a fixture test and assert, through
`playwright/status`, that marks appeared during the run and durations remain after it, that
`textDocument/inlayHint` returns the labels from `contracts/run-feedback.md`, that a document
change clears them, and that `playwright.showLastRunOutput` issues `window/showDocument` for a
file whose content matches the contract.

## Manual scenarios (Zed, `fixtures/sample-project`)

1. **Executing mark** (SC-002, repeat three times): open `tests/slow.spec.ts` (a fixture test with at least
   three steps of two seconds each, added by this feature). Click **▶ Run test**. Expected:
   `⌛ waiting…` appears at the end of the first step line within one second, moves to the
   next step as each finishes, and no `waiting…` label remains within one second of the
   pass notification.
2. **Durations** (SC-003, repeat three times): after scenario 1, every step line shows `<n>ms`; the numbers match
   the step durations in Playwright's output for the same run (open it with scenario 4).
   Type one character in the file: all duration labels disappear. Undo and save, run again:
   labels return for the new run.
3. **Durations across projects**: select both `chromium` and `mobile` (feature 005 picker),
   run the same test: the step lines show `(ran 2×)`; while running, the `waiting…` label
   can appear on two lines at once.
4. **Output** (SC-004, repeat three times): `ctrl-.` in the test file, choose **Playwright: Show last run
   output**. Expected: a buffer opens in a new tab within ten seconds of the run's end, with
   the header lines of the contract, the list reporter's lines and a line printed by the test
   (`console.log('hello from the test')` in the fixture). Place the cursor on a
   `tests/...:line:column` reference and use `editor: open selected filename`: the test file
   opens at that line.
5. **Cancelled run**: start the slow test, immediately run another test. Expected: the
   output buffer shows the second run (`status: running`, then its final status); the first
   run's lines are absent; no `waiting…` label remains; the language server log shows the
   first run as cancelled.
6. **Failure**: run `tests/failing.spec.ts` (existing fixture). Expected: diagnostics as
   before, output buffer shows the failure and stack, `status: failed`.
7. **Degradation** (SC-005): remove `inlay_hints` from settings, restart Zed, run a test.
   Expected: identical progress, notification and diagnostics; no labels; no error. Check the
   language server log shows the run and the `output written to` line.
8. **Page object**: run the fixture test that calls a helper in `tests/helpers/*.ts`; open
   the helper beside the test. Expected: the executing mark and later the duration appear on
   the helper's step line.
9. **Reopen**: close the test file after a run, reopen it without edits. Expected: durations
   are shown again.
10. **No reporter**: temporarily rename `server/dist/step-reporter.js`, run a test. Expected:
    the run passes, no marks, log line `step reporter unavailable`. Restore the file.

## Parity and docs check

- `docs/parity.md` row "Run tests with a single click" reads `full` with the note from
  research R6, and the tasks recipe row cross-references it.
- README documents `inlay_hints.enabled`, the new code action, the output file location and
  the visual differences from upstream.
