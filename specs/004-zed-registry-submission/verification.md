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

Filled in below once the PR is open.
