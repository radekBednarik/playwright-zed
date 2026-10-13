# Verification Record: Remember Discovery Consent per Folder

Recorded 2026-10-13 on WSL2 (Linux), Node 24.19, cargo 1.99, Chromium headless shell from
`npx playwright install chromium`.

## Automated verification (T016)

```text
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.40s

$ cd server && npm run lint
exit=0

$ cd server && npm run build
exit=0

$ cd server && npx vitest run
 Test Files  11 passed (11)
      Tests  108 passed (108)
   Duration  39.52s (tests 100%)
```

Vitest totals: 59 unit tests across 6 files and 49 integration tests across 5 files (feature
002 had 88; this feature adds `test/unit/trust.test.ts` and `test/integration/trust.test.ts`).
The Rust shell is unchanged by this feature; the Rust checks are repeated because
Constitution V requires them on every verification.

The integration tests spawn `server/dist`, so `npm run build` must run before `vitest`. The
first full run in this session ran the tests before the build and showed the 7 new-behaviour
cases failing against the stale build; after the build all 108 passed.

## Integration coverage mapped to spec scenarios

| Spec scenario | Test (`server/test/integration/trust.test.ts` unless noted) | Result |
|---------------|-------------------------------------------------------------|--------|
| US1-1 trusted folder discovers without a question | (a), (b) Zed Preview | pass |
| US1 every reported root folder discovers | (c) | pass |
| US1 the reason is logged | (d) | pass |
| US1 no enable action in a trusted folder | (e) | pass |
| US2 `rootUri` fallback keeps the question, nothing runs | (f): marker file absent | pass |
| US2 / FR-004 workspace settings cannot grant trust | (g), `test/unit/trust.test.ts` signature check | pass |
| US3 Zed before 0.218 asks, nothing runs | (h) | pass |
| US3 other editors ask | (i) | pass |
| `discoverySource: 'answer'` after "Run discovery" | (j) | pass |
| US3 the reason for asking is logged | (k) | pass |
| SC-002 config never loaded before trust or consent | (f), (g), (h): config writes a marker on load | pass |
| SC-005 feature 002 checks unchanged | `consent.test.ts` (only the helper move from T002) | pass |
| Gate rule (names, versions, suffixes) | `test/unit/trust.test.ts` | pass |

## Manual verification in Zed (T017)

2026-10-13: the owner tested the feature manually in Zed and reported that the worktree trust
gate works as intended (a trusted folder gets discovery without the Playwright question). The
report was given as an overall confirmation; individual outcomes for quickstart scenarios 2 to
6 and the SC-001 restart count were not recorded separately. Scenario 7 (another editor) was
not run; it is covered by the automated case (i).
