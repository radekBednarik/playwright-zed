# Verification Record: Show Trace Viewer

**Feature**: 008-show-trace-viewer | **Started**: 2026-10-20

**Baseline** (T001, branch `008-show-trace-viewer` at `f021a88` plus the feature documents,
2026-10-20): `cargo test` 8 passed; `cargo build --release --target wasm32-wasip2` finished
(release profile); `cd server && npm run lint && npm run build && npm test` green, 211 tests
in 20 files (100.8 s, Node 24, WSLg display available). Environment: WSL2, Playwright 1.64.0
in `fixtures/sample-project`, Chromium installed, `xvfb-run` at `/usr/bin/xvfb-run`.

## Automated gate after implementation (T024)

Branch `008-show-trace-viewer` on top of `f021a88`, working tree with the feature (not yet
committed), 2026-10-20:

- `cargo test`: 8 passed (no Rust change in this feature).
- `cargo build --release --target wasm32-wasip2`: finished (release profile).
- `cd server && npm run lint && npm run build`: clean.
- `cd server && npm test`: 22 files, 246 tests passed, 0 skipped, 145.6 s (WSLg display
  present, so the two real-viewer tests ran: the viewer window opened, followed two
  single-test runs in one process, switched traces on `playwright.showTrace`, and closed
  on toggle off). Baseline was 211 tests in 20 files; the feature adds 35 tests: unit
  `trace.test.ts` (14), store (2), commands (1), runner (1), step reporter (2), integration
  `trace.test.ts` (15).
- `git status`: no files under `fixtures/sample-project/` changed; `test-results/` and
  `.zed/` are gitignored and were not created by the suite's own runs beyond Playwright's
  usual output.

Findings fixed during implementation (recorded in research R2 fact 4 and the contract):
the viewer reads each stdin chunk as one path and attaches its reader only after loading,
so the live and final paths of a 50 ms test, written in one poll tick, crashed it; the
session manager now spaces writes and lets a newer path replace a waiting one. Also, a
`workspace/executeCommand` for a run answers only when the run ends, which the mid-run
toggle tests had to account for.

## Manual Zed scenarios (T025, owner)

2026-10-20: the owner ran quickstart scenarios 1 to 11 on the Linux Zed with the dev
extension against `fixtures/sample-project` and reported all of them passing (toggle and
confirmation, viewer opening for a single-test run and being reused, reopening after a
manual close, two projects, "Show trace" after a file run including the skipped-test
message, toggle off closing the window and restoring the command line, the choice
surviving a Zed restart, the settings default and the invalid value warning, the
viewer-cannot-start error, and the run without the step reporter). Zed version as installed
on the owner's machine (Linux Zed, 1.24.2 at the last recorded check).

## Convergence (T026)

2026-10-20: a missing final trace on the automatic path now shows the same Warning
(`Playwright: trace file not found: <path>`) as the cursor path, through the shared
`showOutcomeWarning` helper in `server/src/trace.ts` (unit tests added). After the change:
`npm run lint` and `npm run build` clean, unit suite 13 files / 150 tests, integration
`trace.test.ts` 15 tests, all green (WSLg display present).
