# Verification Record: Attach to Already-Open Spec Files

**Feature**: 007-attach-open-spec-files | **Started**: 2026-10-17

**Baseline** (T001, branch `007-attach-open-spec-files` at `3d8e362` plus the feature
documents, 2026-10-17): `cargo test` 8 passed; `cargo build --release --target
wasm32-wasip2` finished; `cd server && npm run lint && npm run build && npm test` green,
208 tests in 19 files.

## Start-up path verdicts

Evidence baseline Zed 1.24.2 (`fb69067`), 2026-10-17; source references are research R2 to
R4, demonstrations are the tap timelines in research R5 or the owner's quickstart scenarios.

| Path (FR-002) | Verdict | Source evidence (Zed `fb69067`) | Demonstration | Quickstart | Editor version | Date |
|---------------|---------|----------------------------------|---------------|------------|----------------|------|
| First install in a fresh session | deliverable, already works | R2: `language_registry.rs:280`, `lsp_store.rs:5523` and `:13575`, `server_tree.rs:152` | R5 session 1: `didOpen` 57 ms after `initialize`, 14 lenses after the refresh | scenario 1 (owner, PASS 2026-10-17) | Zed 1.24.2 (`fb69067`) | 2026-10-17 |
| Update, reinstall, `zed: install dev extension` rerun | blocked by Zed | R3: `extension_host.rs:1406`, `extension_lsp_adapter.rs:84`, `lsp_store.rs:13151`, `:3218`, `:13081`; Zed #60405 | R5: no server start for two minutes after the reinstall, none for a file opened afterwards | scenario 2 (owner, PASS 2026-10-17) | Zed 1.24.2 (`fb69067`) | 2026-10-17 |
| Disable then enable | same as the row above | Zed 1.24.2 has no per-extension disable; `zed: extensions` offers uninstall and install only | as above | scenario 2 | Zed 1.24.2 (`fb69067`) | 2026-10-17 |
| `editor: restart language server` | deliverable, already works | R4: `editor.rs:8648` (`clear_stopped = true`), `lsp_store.rs:13029`, `:13575` | source only; owner scenario 4 | scenario 4 (owner, PASS 2026-10-17) | Zed 1.24.2 (`fb69067`) | 2026-10-17 |
| Editor restart with restored tabs | deliverable, already works | R2, R1: `lsp_store.rs:13575`, `editor.rs:2151` | R5 session 2: three `didOpen` 64 ms after `initialize`, lenses 14, 0, 5 after the refresh | scenario 3 (owner, PASS 2026-10-17) | Zed 1.24.2 (`fb69067`) | 2026-10-17 |

Out of scope: the remote topology (Windows Zed with the WSL remote server) never loaded this
extension (research R6). The server-side half of the working paths is pinned by
`server/test/integration/attach.test.ts` (T002, T003): a document opened before discovery
answers `[]`, the refresh follows discovery, the next lens request answers lenses, and the
log line `playwright: <n> open file(s) served after discovery: ...` names the files.

## Automated gate

2026-10-17 (T008, after T002 to T007):

```
cargo test                                        -> test result: ok. 8 passed; 0 failed
cargo build --release --target wasm32-wasip2      -> Finished `release` profile
cd server && npm run lint                         -> tsc --noEmit, no output
npm run build                                     -> tsc, no output
npm test                                          -> Test Files 20 passed (20); Tests 211 passed (211)
```

Three tests are new (`server/test/integration/attach.test.ts`); before T003 the two that
expect the log line failed only on that line and the sequence assertions passed, which is
the evidence that the server needed no behaviour change (research R1).

## Manual scenarios (Zed)

Owner, 2026-10-17, Zed 1.24.2 (`fb69067`), dev extension with
`PLAYWRIGHT_ZED_SERVER_ENTRY` from `~/.bashrc`, `fixtures/sample-project`:

| Scenario (quickstart.md) | Outcome |
|--------------------------|---------|
| 1. First install in a fresh session, three tabs open (three attempts, SC-001) | PASS |
| 2. Reinstall in the same session: nothing served until `editor: restart language server` (blocked path, README wording) | PASS |
| 3. Editor restart with restored tabs | PASS |
| 4. `editor: restart language server` serves every open tab | PASS |
| 5. Message-level tap | not run (optional; research R5 holds the agent's run) |
| 6. README Install and parity rows carry the caveat and the link | PASS |

The verdict table's "Demonstration" and "Quickstart" columns are confirmed by these
outcomes (scenario 1 for the first install, 2 for the blocked path, 3 for the editor
restart, 4 for the server restart).
