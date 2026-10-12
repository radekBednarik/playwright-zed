# Verification Record: Project Scaffold and Run Test at Cursor

Recorded 2026-10-12 on WSL2 (Linux), Node 24.19, cargo 1.99, Zed stable 1.23.2 installed at
`~/.local/bin/zed`, Chromium headless shell from `npx playwright install chromium`.

## Automated verification (T038)

Commands run from the repository root, `server/` and `fixtures/sample-project/`. Last lines of
each command's output and its exit code:

```text
$ cargo test 2>&1

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

exit=0

$ cargo build --release --target wasm32-wasip2 2>&1 && ls -la target/wasm32-wasip2/release/playwright_zed.wasm
    Finished `release` profile [optimized] target(s) in 0.16s
-rw-r--r-- 2 radek radek 249511 Oct 12 14:35 target/wasm32-wasip2/release/playwright_zed.wasm
exit=0

$ npm run lint 2>&1

exit=0

$ npm run build 2>&1

exit=0

$ npx vitest run 2>&1

 Test Files  7 passed (7)
      Tests  70 passed (70)
   Start at  14:59:52
   Duration  14.46s (transform 80ms, setup 0ms, collect 140ms, tests 13.61s, environment 1ms, prepare 225ms)

exit=0

$ npx playwright test --list 2>&1
Total: 10 tests in 2 files
exit=0
```

Earlier in the same session `cargo test` listed its 7 unit tests individually (all `ok`); the
tail above shows only the final doc-test line. Vitest totals: 50 unit tests across 5 files and
20 integration tests across 2 files, all against the real fixture with Chromium.

## Integration coverage mapped to spec scenarios

| Spec scenario | Integration test | Result |
|---------------|------------------|--------|
| US1-2 recognise workspace, discover tests | detect: "recognises the fixture ... discovers all 10 tests" | pass |
| US1-3 folder without Playwright | detect: "stays silent in a TypeScript folder without Playwright" | pass |
| US1-4 version below 1.38 | detect: "warns once and offers nothing for Playwright older than 1.38" | pass |
| US2-1 single test | run (a) | pass |
| US2-2 failing test with location and message | run (b) | pass |
| US2-3 describe group | run (c), `file:line` on the describe line selects nested tests (R5 open point resolved, no `--grep` fallback needed) | pass |
| US2-4 outside any test runs the file | run (g) | pass |
| US2-5 identical titles | run (d) | pass |
| US2-6 second run replaces the first | run (f) | pass |
| Edge: special characters | run (e) | pass |
| Edge: unsaved buffer | run (h) | pass |
| Edge: loop-generated tests on one line | run (i) | pass |
| Edge: `test.skip` | run (j) | pass |
| Diagnostics cleared on edit | run (k) | pass |
| US3-1 run file | run file: "runs every test in the file" | pass |
| US3-2 no actions in config file | run file: "offers no run actions in a non-test file" | pass |
| US4-1 re-run from another document | re-run: "repeats the previous selection from any document" | pass |
| US4-2 nothing to re-run | re-run: "says so when there is nothing to re-run" | pass |

## Manual verification in Zed (T019, T028, T031, T034)

**Skipped in this session.** The quickstart scenarios 1 to 19 require installing the dev
extension through Zed's UI (`zed: install dev extension`) and clicking in the editor, which
cannot be driven from the agent session. A Linux Zed 1.23.2 is installed and WSLg is
available, so the developer can run them with:

```sh
cd server && npm run build
export PLAYWRIGHT_ZED_SERVER_ENTRY=$PWD/bin/playwright-zed-language-server.js   # or add to ~/.bashrc
~/.local/bin/zed --foreground ../fixtures/sample-project
```

Then follow `quickstart.md`. Record outcomes below.

| # | Scenario | Outcome |
|---|----------|---------|
| 1 to 23 | see quickstart.md | pass, reported by the repository owner on 2026-10-12 (see below) |

### Manual verification result (T019, T028, T031, T034)

Performed by the repository owner on 2026-10-12 in Zed stable 1.23.2 (Linux build under
WSL2 with WSLg), with the extension installed via `zed: install dev extension` from the
repository root at commit `d35d4ef` and the server loaded through the
`PLAYWRIGHT_ZED_SERVER_ENTRY` override. The owner reports every quickstart scenario, 1 to 23,
as passing. The per-scenario commands and observations were not transcribed into this file;
the owner's report is the record.

## Convergence pass (Phase 8, 2026-10-12)

Commands and final lines:

```text
$ cargo test                      -> test result: ok. 7 passed; 0 failed
$ cargo build --release --target wasm32-wasip2 -> Finished `release` profile
$ cd server && npm run lint       -> exit 0
$ cd server && npm run build      -> exit 0
$ cd server && npx vitest run     -> Test Files 7 passed (7); Tests 72 passed (72)
```

New coverage: two-root-folder detection (T042), version-aware refusal message on a direct run
command (T043), `$/progress` token equals the run request id (T044), `test.fixme` reported as
skipped (T045). The dev override path is no longer checked inside the WASI sandbox (T040).

Still open: T041 (publish the server to npm, needs owner approval) and the manual Zed
scenarios 1 to 20.


## Convergence pass (Phase 9, 2026-10-12)

Commands and final lines, run after T046, T047, T049 and T050 landed:

```text
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.23s

$ cd server && npm run lint
exit=0

$ cd server && npm run build
exit=0

$ cd server && npx vitest run
 Test Files  8 passed (8)
      Tests  78 passed (78)
   Duration  26.53s

$ cd fixtures/sample-project && npx playwright test --list
Total: 15 tests in 2 files
```

Vitest totals: 50 unit tests across 5 files and 28 integration tests across 3 files, all
against real Playwright with Chromium; the `todomvc` cases need network access.

New coverage: `test.only` in an isolated temp project (T046, `focus.test.ts`: a file run
executes only the focused test, a line-targeted unfocused test still runs, as Playwright itself
behaves); the "not a test file of <config>" warning for run commands issued from a non-test
file in a recognised workspace (T049). The Rust crate now matches the manifest contract
(`cdylib` only, unconditional `zed_extension_api`); `cargo test` on the host still passes
without a `cfg` gate (T047).

Still open: T041 (publish the server to npm, needs owner approval). The manual Zed scenarios
1 to 23 (T019, T028, T031, T034) passed on 2026-10-12, see the manual verification section
above.
