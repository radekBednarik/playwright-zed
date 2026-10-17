# Verification Record: Single-Click Run Parity Gaps

**Feature**: 006-single-click-run-parity | **Started**: 2026-10-16

## Gap verdicts (US1, FR-001)

| Gap | Verdict | Surface | Source evidence (research.md) | Demonstration | Editor version |
|-----|---------|---------|-------------------------------|---------------|----------------|
| Executing-line highlight | deliverable (trailing text marker, no line background) | LSP inlay hints + `workspace/inlayHint/refresh` | R1: `crates/project/src/lsp_store.rs` 1135 and 8713, `crates/editor/src/inlays/inlay_hints.rs` 603, `crates/settings_content/src/language.rs` 902 | quickstart scenario 1: PASS (owner, 2026-10-16) | Zed 1.24.2 (`fb69067`) |
| Per-step durations | deliverable | LSP inlay hints, same stream | R1, R3; reporter evidence below | quickstart scenario 2: PASS (owner, 2026-10-16) | Zed 1.24.2 (`fb69067`) |
| Run output inside the editor | deliverable | `window/showDocument` on a log file, code action | R4: `crates/lsp/src/lsp.rs` 1147, `crates/project/src/lsp_store.rs` 1256, `crates/editor/src/items.rs` 2522 | quickstart scenario 4: PASS (owner, 2026-10-16) | Zed 1.24.2 (`fb69067`) |

### Evidence checks re-run on 2026-10-16 (T016)

Playwright 1.64.0 (`fixtures/sample-project/node_modules/@playwright/test/package.json`).

(a) Reporter path resolution, `fixtures/sample-project/node_modules/playwright/lib/cli/testActions.js`:

```
function resolveReporter(id) {
  if (import_common.builtInReporters.includes(id))
    return id;
  const localPath = import_path.default.resolve(process.cwd(), id);
  if (import_fs.default.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [process.cwd()] });
}
```

An absolute path that exists is returned unchanged; `loadReporter` in `lib/runner/index.js`
resolves it against `rootDir`, which leaves an absolute path unchanged.

(b) Phase 2 checkpoint, run from `fixtures/sample-project` after `npm run build` in `server/`:

```
PLAYWRIGHT_ZED_STEP_FILE=<scratch>/steps.jsonl FORCE_COLOR=0 \
  node node_modules/@playwright/test/cli.js test tests/slow.spec.ts --project=chromium \
  --reporter=list,json,$PWD/../../server/dist/step-reporter.js
```

Outcome: 1 passed (6.7 s). The step file holds 20 events: `testBegin`, nine
`stepBegin`/`stepEnd` pairs (`test.step` lines 7, 10, 13 of `slow.spec.ts` with their
`pw:api` children at 8, 11, 14; `open sum` at `tests/helpers/steps.ts:5` with its child at
line 6; the `expect` step at line 17), then `testEnd` with `status: passed`. Durations of the
2 s steps were 2030, 2076 and 2008 ms. Every event carries `test.project: "chromium"`.

## Automated gate

Run on 2026-10-16 (T034), Linux WSL2, Node 24, Playwright 1.64.0 in the fixture:

| Command | Outcome |
|---------|---------|
| `cargo test` | 8 passed, 0 failed |
| `cargo build --release --target wasm32-wasip2` | Finished `release` |
| `cd server && npm run lint` | clean (`tsc --noEmit`) |
| `cd server && npm run build` | `dist/` incl. `step-reporter.js` |
| `cd server && npm test` | 19 files, 208 tests passed (133 unit, 75 integration incl. 15 in `feedback.test.ts`); needs Chromium and network. Rerun after the convergence tasks T037 and T038 on 2026-10-16 |

Finding on the way: Playwright computes `step.duration` from two worker wall-clock stamps
(`lib/worker/workerProcessEntry.js`: `wallTime: Date.now()` at begin, `endWallTime = Date.now()`
at end; `lib/runner/index.js` line 6019 subtracts them). A clock sampler
(`Date.now() - performance.now()` every 20 ms) measured a -2480 ms wall-clock step on this
WSL2 machine during three CLI runs of `slow.spec.ts`, and the run that contained the step
reported `step three` as -421 ms while the other two runs reported 2005 and 2058 ms. The marks
store therefore clamps negative durations to 0 (`server/src/marks.ts`, data-model.md), and the
integration test checks the longest of the three two-second steps rather than each one.

## Manual scenarios

Run by the owner on 2026-10-16 in Zed 1.24.2 (Linux, dev extension, `inlay_hints.enabled`
on, local server through `PLAYWRIGHT_ZED_SERVER_ENTRY`) against `fixtures/sample-project`.
Owner's report: all quickstart scenarios 1 to 10 pass (executing mark, durations, durations
across two projects, run output via **Show last run output**, cancelled run, failure,
degradation without inlay hints, helper file, reopen, missing reporter). This satisfies
FR-012 and SC-002 to SC-005 as far as a manual session can; the gap verdict table above
carries the demonstrations.
