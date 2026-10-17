# Quickstart: Attach to Already-Open Spec Files

Validation guide for feature 007. Automated gate first, then manual Zed scenarios. Record
every run in `verification.md` with the command, the editor version and the outcome.

## Prerequisites

- Bootstrap per `.claude/memory/new-machine-setup.md` (server built, fixture installed with
  Chromium).
- Linux Zed 1.24.2 or newer. Settings: `"code_lens": "on"`.
- `PLAYWRIGHT_ZED_SERVER_ENTRY` exported in the login shell (`~/.bashrc`), pointing at
  `server/bin/playwright-zed-language-server.js`, so the dev server is used. Zed reads the
  project environment from the login shell, not from the terminal that launches it.
- `dev: open language server logs` is the observation surface: pick **Playwright**; the
  lines `playwright: discovered N test(s)` and
  `playwright: <n> open file(s) served after discovery: ...` (contract section 2) are the
  checks.

## Automated gate

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm run build && npm test
```

Expected: all green; the new `attach.test.ts` opens documents before discovery and asserts
empty lenses, the refresh, lenses afterwards and the log line (contract section 3).

## Manual scenarios (Zed, `fixtures/sample-project`)

Terminology: "served" means the file shows `▶ Run test` lenses and `ctrl-.` offers the
`Playwright:` project picker.

1. **First install in a fresh session** (US1, SC-001; repeat three times). With Zed
   closed, uninstall the dev extension (`zed: extensions`, Playwright Runner, Uninstall) or
   remove `~/.local/share/zed/extensions/installed/playwright-runner-lsp`. Quit Zed
   (`zed: quit`). Start Zed, open `fixtures/sample-project`, open `tests/passing.spec.ts`,
   `tests/failing.spec.ts` and `tests/slow.spec.ts` in tabs. Wait ten seconds (no lenses,
   expected). Run `zed: install dev extension` on the repo root. Expected: within five
   seconds of the `discovered 17 test(s)` log line, all three tabs are served without any
   click in them, and the log line `3 open file(s) served after discovery` lists them.
   Click a lens in `passing.spec.ts`: the run behaves as in release 0.5.1 (progress,
   notification, markers, step marks, output action).
2. **Reinstall in the same session** (blocked path, FR-007 wording check). Keep the three
   tabs open. Run `zed: install dev extension` again (or uninstall and install). Expected
   on Zed 1.24.2: the Playwright log shows the server stopping and no new discovery; no tab
   is served; opening a fourth spec file is not served either; closing and reopening
   `passing.spec.ts` does not help. Then run `editor: restart language server` from a spec
   file. Expected: a new server starts, discovery runs, every open tab is served. Record the
   Zed version; if a newer Zed serves the tabs right after the reinstall, the README caveat
   becomes version-bound.
3. **Editor restart with restored tabs** (US2). With the three tabs open and served, `zed:
   quit`, start Zed again on the same folder. Expected: tabs restored and served within five
   seconds of the discovery line, log line lists all three.
4. **Language server restart** (US2). With the tabs served, run `editor: restart language
   server` from `failing.spec.ts`. Expected: all tabs served again after discovery, not only
   the one the command ran in.
5. **Optional message-level evidence** (what research R5 used). Point the login shell's
   `PLAYWRIGHT_ZED_SERVER_ENTRY` at `specs/007-attach-open-spec-files/tools/lsp-tap.js` and
   set `PLAYWRIGHT_ZED_TAP_FILE=/tmp/playwright-zed-tap.log`; open a new login shell and
   start Zed from it (or `zed: quit` first). Run scenario 1. Expected in the tap file: one
   `textDocument/didOpen` per open tab within 100 ms of `initialize`, `textDocument/codeLens`
   answered `[]`, then `workspace/codeLens/refresh` and a second `codeLens` with lenses. Restore
   the export afterwards.
6. **Documentation** (FR-007). Read README "Install": the restart instruction is present in
   the same section; `docs/parity.md` rows name the behaviour and link Zed #60405.

Zed quirk to keep in mind while judging scenario 1: the `ctrl-.` menu is cached per cursor
position (feature 005); move the cursor before judging the project picker.
