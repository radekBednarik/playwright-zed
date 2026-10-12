# Verification Record: Ask Before Running Workspace Code on Open

Recorded 2026-10-12 on WSL2 (Linux), Node 24.18, cargo 1.99, Chromium headless shell from
`npx playwright install chromium`.

## Automated verification (T016)

```text
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.24s

$ cd server && npm run lint
exit=0

$ cd server && npm run build
exit=0

$ cd server && npx vitest run
 Test Files  9 passed (9)
      Tests  88 passed (88)
   Duration  37.34s
```

Vitest totals: 50 unit tests across 5 files and 38 integration tests across 4 files. The Rust
shell is unchanged by this feature; the Rust checks are repeated because Constitution V
requires them on every verification.

## Integration coverage mapped to spec scenarios

| Spec scenario | Test (`server/test/integration/consent.test.ts` unless noted) | Result |
|---------------|-------------------------------------------------------------|--------|
| US1-1 one question naming the folder and stating execution | (a) | pass |
| US1-2 no lenses or run actions before the answer | (a) | pass |
| US1-3 run command refused while pending, nothing started | (b): marker file absent, no `$/progress` | pass |
| US1-4 no question without Playwright | (c), `detect.test.ts` plain folder | pass |
| SC-001 nothing executes before consent | (a), (b), (i): config writes a marker on load; absent until consent | pass |
| US2-1 "Run discovery" starts discovery at once | (d) | pass |
| US2-2 re-discovery on save without a second question | (e) | pass |
| US2-3 config found later discovered without a question | (f) | pass |
| US2-4 asked again in a new session | every case starts its own server; (e) shows one prompt per session | pass |
| US3-1 "Not now" stays idle and quiet | (g): no refresh after save, no second prompt | pass |
| US3-2 run command refused with the disabled message | (g) | pass |
| US3-3 enable action turns discovery on | (h) | pass |
| US3-4 dismissed question still enables | (i) | pass |
| Edge: several roots, one question each | (j), `detect.test.ts` two-root case | pass |
| Edge: unsupported version warned without a question | `detect.test.ts` old-version case: warning shown, `prompts()` empty | pass |
| Feature 001 behaviour after consent unchanged | `run.test.ts` (21), `focus.test.ts` (3), `detect.test.ts` (4) | pass |

## Manual verification in Zed (T017)

Pending: quickstart scenarios 1, 2, 4 to 10 need a developer at the editor. Record outcomes
below.

| # | Scenario | Outcome |
|---|----------|---------|
| 1, 2, 4 to 10 | see quickstart.md | pending |
