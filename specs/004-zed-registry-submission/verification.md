# Verification: Zed Registry Submission

Record of every check run for feature 004, in the order of `tasks.md`. Commands are quoted
with their outcome (constitution V). Skipped checks are stated as skipped with the reason.

## Environment (T001, T002, T003)

Machine: WSL2, 2026-10-13.

| Tool | Command | Result |
|------|---------|--------|
| Rust stable | `rustc --version` | `rustc 1.99.0 (b940084d7 2026-09-28)` |
| Rust registry pin | `cargo +1.90 --version` | `cargo 1.90.0 (840b83a10 2025-07-30)`; `rustup +1.90 target list --installed` lists `wasm32-wasip2` (target added with `rustup target add wasm32-wasip2 --toolchain 1.90`) |
| Node | `node --version` | `v24.18.1` |
| pnpm via corepack | `corepack pnpm@11 --version` | `11.28.5` (corepack 0.35.0) |
| gh | `gh auth status` | logged in to github.com as `radekBednarik`, active |
| Zed | `zed --version` | `Zed 1.23.3 96a1b1b5389efff473fc2306f7f8c690f2e1a417` (Linux, `~/.local/zed.app`) |
| Registry CLI | `ZED_EXTENSION_CLI_SHA` in `zed-industries/extensions/.github/workflows/ci.yml` on 2026-10-13 | `9ee3c503a4bbbc6b4a0f8a789acca4871d773223` (unchanged since research); binary downloaded to the session scratch directory, not kept in the repository |

## Automated verification (T013, on branch `004-zed-registry-submission`)

```text
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.32s

$ cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190
   Compiling playwright-zed v0.3.0 (/home/radek/projects/personal/playwright-zed)
    Finished `release` profile [optimized] target(s) in 9.10s
target/rust190/wasm32-wasip2/release/playwright_zed.wasm  248438 bytes

$ cd server && npm run lint && npm run build && npm test
> tsc --noEmit -p tsconfig.json      (exit 0)
> tsc -p tsconfig.json               (exit 0)
 Test Files  11 passed (11)
      Tests  108 passed (108)
   Duration  43.58s
```

Pre-existing failure found and fixed on the way (not part of the rename): the owner's
commit `11e68ae` ("test: Add test.fail() to sample project fixture", 2026-10-13 17:27,
CI on `main` red) inserted a `test.fail` case at lines 11 to 13 of
`fixtures/sample-project/tests/failing.spec.ts`. The first full run therefore failed
`detect.test.ts` ("expected 16 to be 15", lens count 4 instead of 3) and `run.test.ts (n)`
(cursor line 11 no longer hit the todomvc test; 120 s timeout). Fixed in a separate commit
by updating the expectations: test count 16, four "Run test" lenses in the failing file,
`failingTodomvc` line 15, diagnostic line 18; README now says `discovered 16 test(s)`.
After the fix: 108 passed (the trust test gained one assertion inside an existing case,
so the count is unchanged).

Old display name grep (quickstart step 1), run from the repository root:

```text
$ grep -rn "Playwright for Zed" --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git --exclude-dir=dist . \
    | grep -vE '^(\./)?(specs/00[123]|specs/004|\.specify/memory/constitution\.md)'
README.md:66:   If you installed a dev extension before 0.4.0, it is listed as "Playwright for Zed" with
```

The single remaining match is the uninstall note T008 asks for (users must recognise the
old entry in `zed: extensions`); every other live mention is renamed. The manifest, CI,
server text, server metadata, CLAUDE.md, publishing doc, memory files and the superseded
feature 001 contract carry the new name.

T033 review of the README "Built with AI assistance" section: Spec Kit, Claude Code, models
Fable and Opus. Accurate on 2026-10-13 (this feature was implemented with Claude Fable 5.1);
no change needed.

## Registry CLI build (T014)

```text
$ RUSTUP_TOOLCHAIN=1.90 ./zed-extension --source-dir <repo> --output-dir out --scratch-dir scratch
exit 0 (the CLI prints nothing on success); out/ contains archive.tar.gz and manifest.json

$ cat out/manifest.json
{"name":"Playwright Runner","version":"0.3.0","description":"Work in progress. Run Playwright end-to-end tests from Zed: run at cursor, run file, re-run last, with results in the editor. Community extension, not affiliated with or endorsed by Microsoft.","authors":["Radek Bednarik <radek.bednarik@tesena.com>"],"repository":"https://github.com/radekBednarik/playwright-zed","schema_version":1,"wasm_api_version":"0.7.0","provides":["language-servers"]}

$ git status --short --ignored | grep wasm
!! extension.wasm          (written by the CLI into the source dir, gitignored)
```

Version 0.3.0 is expected on the branch; the release commit on `main` sets 0.4.0 (T019).

## Registry rules checked by hand (T015)

| Rule (registry `validation.js` / prerequisites) | Value | Result |
|---|---|---|
| id `^[a-z0-9-]+$` | `playwright-runner-lsp` | pass |
| id no `zed-` prefix, no `-zed` suffix, no `extension` | `playwright-runner-lsp` | pass |
| name no `Zed ` prefix, no ` Zed` suffix, no `extension` (any case) | `Playwright Runner` | pass |
| version plain `major.minor.patch`, equal in `Cargo.toml` | `0.3.0` / `0.3.0` | pass (0.4.0 at release) |
| `schema_version` 1 | `1` | pass |
| licence file at root, recognised text | `LICENSE`: "MIT License", "Copyright (c) 2026 Radek Bednarik" | pass (MIT) |
| no Git LFS | no `.gitattributes`; `git lfs ls-files` empty | pass |
| no bundled server | `capabilities` only `npm:install playwright-zed-language-server` | pass |
| language-server-only id suffix | `-lsp` | pass |

## Id free and PR slots (T016, 2026-10-13)

```text
$ curl -fsSL https://raw.githubusercontent.com/zed-industries/extensions/main/extensions.toml -o extensions.toml
$ grep -c '^\[playwright-runner-lsp\]' extensions.toml
0
$ grep -n '^\[.*playwright' extensions.toml
3383:[mcp-server-playwright]
$ grep -c '^\[' extensions.toml
1574
$ gh pr list -R zed-industries/extensions --author radekBednarik --state open --json number --jq length
0
$ gh repo view radekBednarik/extensions
Could not resolve to a Repository (no fork yet; the owner creates it)
```

## Project PR (T017, T018)

PR #3 https://github.com/radekBednarik/playwright-zed/pull/3, branch
`004-zed-registry-submission` at `b47cf66`, opened 2026-10-13 with the verification body the
constitution's workflow gates require. CI on the PR, all pass:

```text
Rust extension                               pass  41s
Rust extension (registry toolchain 1.90)     pass  41s
Language server (Node 22)                    pass  1m44s
Language server (Node 24)                    pass  1m28s
CodeQL (actions, javascript-typescript, rust) pass
```

T018 (merge) waits for the owner's OK.

## Release (T019, T020)

PR #3 was squash-merged by the owner on 2026-10-13 as `7dd3a65` (the repository ruleset
"main" requires a review a PR author cannot give themselves; the owner used the admin bypass).

```text
$ git switch main && git pull
$ # version = "0.4.0" in extension.toml and Cargo.toml; README listing line 0.4.0
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
$ cargo build --release --target wasm32-wasip2
    Finished `release` profile [optimized] target(s) in 0.23s
$ git commit -m "release: 0.4.0" && git tag v0.4.0 && git push origin main && git push origin v0.4.0
$ git rev-parse v0.4.0
8379546a32c3d7dd8a3df6c19ae4f74876b8cfdd
$ git branch --contains v0.4.0
* main
$ grep PINNED_SERVER_VERSION src/lib.rs
pub const PINNED_SERVER_VERSION: &str = "0.3.0";
$ npm view playwright-zed-language-server@0.3.0 version
0.3.0                                    (published 2026-10-13T07:06:28.176Z; dist-tag latest = 0.3.0)
```

## Registry clone and local validation (T025, T026, T027)

Clone `../zed-extensions` (sibling of this repository), 2026-10-13, remote `origin` only
(`https://github.com/zed-industries/extensions.git`), no push.

```text
$ git switch -c playwright-runner-lsp origin/main
$ git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright-runner-lsp
$ git -C extensions/playwright-runner-lsp checkout main && git -C extensions/playwright-runner-lsp reset --hard v0.4.0
8379546a32c3d7dd8a3df6c19ae4f74876b8cfdd
$ # appended [playwright-runner-lsp] submodule = "extensions/playwright-runner-lsp" version = "0.4.0"
$ corepack pnpm@11 install --frozen-lockfile        Done in 5.7s using pnpm v11.28.5
$ corepack pnpm@11 sort-extensions                   entry placed after [playdate], before [po] in both files
$ git commit -m "Add playwright-runner-lsp extension"
7466aac69aa29e49a558519329b0faeac3016fda
 .gitmodules                      | 4 ++++
 extensions.toml                  | 4 ++++
 extensions/playwright-runner-lsp | 1 +

$ corepack pnpm@11 sort-extensions && git diff --exit-code -- extensions.toml .gitmodules
sort idempotent: clean
$ RUSTUP_TOOLCHAIN=1.90 REF_NAME=playwright-runner-lsp corepack pnpm@11 package-extensions playwright-runner-lsp
Extensions changed from main: playwright-runner-lsp
Packaging 'playwright-runner-lsp'. Version: 0.4.0
Checking out Git submodule at 'extensions/playwright-runner-lsp'
(exit 0; validateExtensionsToml, validateGitmodules, licence match, id and version match, validateManifest all passed silently)
$ cat output/manifest.json
{"name":"Playwright Runner","version":"0.4.0","description":"Work in progress. Run Playwright end-to-end tests from Zed: run at cursor, run file, re-run last, with results in the editor. Community extension, not affiliated with or endorsed by Microsoft.","authors":["Radek Bednarik <radek.bednarik@tesena.com>"],"repository":"https://github.com/radekBednarik/playwright-zed","schema_version":1,"wasm_api_version":"0.7.0","provides":["language-servers"]}
output/archive.tar.gz  97258 bytes
$ rm -rf zed-extension build output scratch && git status --short
(clean)
```

## Parity matrix (T037)

`grep -n "Playwright for Zed" docs/parity.md` prints nothing; no row added, no change (FR-016).

## Manual verification in Zed at v0.4.0 (T021 to T024)

Run by the owner on 2026-10-13 in Zed 1.23.3 (`96a1b1b5389efff473fc2306f7f8c690f2e1a417`,
Linux build in `~/.local/zed.app`, WSL2) at `v0.4.0` (`8379546`). Owner's report: the
`PLAYWRIGHT_ZED_SERVER_ENTRY` override disabled, the 0.3.0 dev extension uninstalled, the 0.4.0
dev extension installed, "All functionalities work. PASS". Evidence collected from the machine
afterwards by the agent:

| # | Spec ref | Check | Outcome |
|---|----------|-------|---------|
| 1 | US2-4 | `git describe --tags` at the verified commit | `v0.4.0` |
| 2 | US3-2 prep | `~/.local/share/zed/extensions/index.json` | `playwright-runner-lsp` "Playwright Runner" 0.4.0, flagged dev; no `playwright` entry; `installed/` has `playwright-runner-lsp` and no `playwright`; Zed.log 18:05:32 "finished compiling extension .../playwright-runner-lsp" |
| 3 | FR-008 | feature 001 scenarios 2, 5, 6, 7, 11, 13 and feature 003 sections 2 to 5 | PASS per the owner's report ("all functionalities work"); per-scenario notes were not taken, the owner's statement covers the set |
| 4 | FR-009 | npm install path | Zed process 61925 environ contains no `PLAYWRIGHT_ZED_SERVER_ENTRY`; `work/playwright-runner-lsp/package.json` and `.../node_modules/playwright-zed-language-server/package.json` say 0.3.0; Zed.log 18:05:56 starts the server from `work/playwright-runner-lsp/node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js`; no `work/playwright/` directory exists |
| 5 | Edge: old id | old and new dev extension side by side | skipped: the owner uninstalled the old extension before installing the new one, so the duplicate-server state was not observed; the README note rests on research R8 (Zed keys extensions by id and both would start a "Playwright" server) |

Feature 002 question scenarios: skipped, Zed 0.218+ never shows the question; the renamed
text is covered by the trust test assertion added in T006.

## Hand-over self-check (T029, T035)

`owner-handover.md` written from `contracts/owner-handover.md`. Checks:

```text
$ grep -nE "title:|body:" specs/004-zed-registry-submission/owner-handover.md
(nothing)
$ grep -rniE "dear maintainer|hi zed|hello zed|please merge|@zed-industries" specs/004-zed-registry-submission/
(nothing)
```

Every paragraph re-read: none is addressed to maintainers or phrased as text to paste. Part 3
carries the AI policy summary and item 7 of Part 2 covers replies. No registry-facing text
exists under `specs/004-zed-registry-submission/`.

## Publishing self-check (SC-002, copied from `docs/publishing.md`)

- [x] id `playwright-runner-lsp`: lowercase letters, digits and hyphens only; no `zed-` prefix, no `-zed` suffix, no `extension` (T015 table)
- [x] display name "Playwright Runner": no "Zed " prefix, no " Zed" suffix, no "extension" (T015 table; registry `validateManifest` passed in T026)
- [x] `extension.toml` has id, name, version, schema_version (1), authors, description, repository (`extension.toml` at `8379546`)
- [x] version plain `major.minor.patch`, equal in `extension.toml`, `Cargo.toml` and the registry entry at the submodule commit, higher than any previous registry version (0.4.0 everywhere; first registry version)
- [x] `LICENSE` (MIT) at the extension root (T015; licence matcher in T026)
- [x] no bundled language server, debug adapter or MCP server; only `npm:install` for `playwright-zed-language-server` (`extension.toml` capabilities)
- [x] no slash commands or agent servers (`extension.toml` declares only `language_servers.playwright`)
- [x] all user-facing text in English (README, description, server messages)
- [x] no Git LFS (T015: no `.gitattributes`, `git lfs ls-files` empty)
- [x] `cargo +1.90 build --release --target wasm32-wasip2` passes (T013, T038; CI job "Rust extension (registry toolchain 1.90)" on PR #3)
- [x] registry `package-extensions` run locally passes (T026: "Packaging 'playwright-runner-lsp'. Version: 0.4.0", exit 0)
- [x] `extensions.toml` and `.gitmodules` sorted with `corepack pnpm@11 sort-extensions` (T026: re-sort leaves no diff)
- [x] submodule URL HTTPS, repository public, submodule commit tagged `v0.4.0` and on `main` (T025, T020)
- [x] tested manually in Zed as a dev extension at the submitted commit; npm install path verified (T021 to T023, owner's report plus on-disk evidence)
- [x] non-affiliation notice in the description and READMEs, no Playwright or Microsoft logo (`extension.toml` description, README, server README)
- [x] fork under the personal account; fewer than three open registry PRs (0 open; fork is the owner's to-do item 3)
- [x] AI policy: the owner writes the PR title, body and every comment; quoted AI output in a labelled quote block with the owner's commentary (hand-over Part 2 item 5 and 7, Part 3; `docs/publishing.md` "AI policy")
- [x] respond to maintainer feedback within three weeks (hand-over Part 2 item 7)

## Final checks on `main` (T038, at `3d90d87`, 2026-10-13)

```text
$ grep -rn "Playwright for Zed" ... | grep -vE '^(\./)?(specs/00[123]|specs/004|\.specify/memory/constitution\.md)'
README.md:66:   If you installed a dev extension before 0.4.0, it is listed as "Playwright for Zed" with
(the deliberate uninstall note only)
$ cargo test
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
$ cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190
    Finished `release` profile [optimized] target(s) in 0.23s
```

## State

Feature 004 state: **prepared, awaiting owner** (fork, push, PR). Follow-up states and who
records them: `pr-open` (owner reports the PR number), `merged` (owner reports; T032 then
verifies User Story 3 from a clean machine), `closed` (owner reports; fix and fresh PR).
