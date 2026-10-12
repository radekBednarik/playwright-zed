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

Performed by the repository owner on 2026-10-12 in Zed stable 1.23.2 (Linux build under
WSL2 with WSLg), dev extension installed from the repository root, server loaded from the
local build through `PLAYWRIGHT_ZED_SERVER_ENTRY` at commit `785ed0f`. The owner reports
quickstart scenarios 1, 2 and 4 to 10 as passing (scenario 3 is automated only). The
per-scenario observations were not transcribed; the owner's report is the record.

| # | Scenario | Outcome |
|---|----------|---------|
| 1, 2, 4 to 10 | see quickstart.md | pass, reported by the owner on 2026-10-12 |
| 3 | run command while pending | automated, `consent.test.ts` (b) |

## Release 0.2.0 (2026-10-12)

Published by the repository owner from `server/` at commit `d1aa0a2` (`release: 0.2.0`);
the registry accepted the tarball with HTTP 202 and listed it about three minutes later.
The Rust shell pins 0.2.0; `extension.toml` and `Cargo.toml` are 0.2.0; tag `v0.2.0`.

```text
$ npm view playwright-zed-language-server versions dist-tags dist.shasum dist.fileCount
versions   = ['0.0.0-stage', '0.1.0', '0.2.0']
dist-tags  = { latest: '0.2.0' }
dist.shasum = a7b17aff181f52aa8da2cec2334888837a0e596d
dist.fileCount = 22

$ npm install playwright-zed-language-server@0.2.0        (scratch folder)
added 6 packages

$ node smoke.js   (LSP initialize against the installed bin)
commands: playwright.runAtCursor, playwright.runFile, playwright.rerunLast, playwright.enableDiscovery
```

### Install path from npm (2026-10-12, 18:53 local)

After `zed: install dev extension` recompiled the shell with the 0.2.0 pin (Zed log:
`compiled Rust extension ... in 0.27s` at 18:52:32), the owner quit Zed and started it from a
terminal without `PLAYWRIGHT_ZED_SERVER_ENTRY`. Checks from the agent session:

```text
$ tr '\0' '\n' < /proc/<zed pid>/environ | grep PLAYWRIGHT_ZED_SERVER_ENTRY
(not set)

$ cat ~/.local/share/zed/extensions/work/playwright/package.json
{ "dependencies": { "playwright-zed-language-server": "0.2.0" } }

$ grep -c enableDiscovery ~/.local/share/zed/extensions/work/playwright/node_modules/playwright-zed-language-server/dist/server.js
3

$ ps -eo pid,lstart,args | grep playwright-zed-language-server
105780 18:53:02 node .../extensions/work/playwright/node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js --stdio
```

The shell upgraded the work directory from 0.1.0 to 0.2.0 on its own and started the new
server. Two earlier attempts were invalid and are recorded here for the next release: one
Zed process still carried the dev override from its launching terminal, and one ran a
stale `extension.wasm` compiled before the pin bump (the dev extension symlinks the repo, so
`extension.toml` reads live but the Rust code only recompiles on `zed: install dev
extension`).
