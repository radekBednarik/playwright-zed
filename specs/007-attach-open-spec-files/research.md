# Research: Attach to Already-Open Spec Files

**Feature**: 007-attach-open-spec-files | **Date**: 2026-10-17

Evidence baseline: Zed 1.24.2 (commit `fb69067729cb16a7f6135e2c1600c26a28c59659`, tag
`v1.24.2`, the owner's installed Linux stable; sparse clone of `crates/project`,
`crates/editor`, `crates/extension_host`, `crates/extension`, `crates/language`,
`crates/language_extension`, `crates/lsp`, `crates/remote_server` inspected locally), server
build of this repository at `3d8e362` (feature 006 merged), `fixtures/sample-project`.
Line numbers below are in that Zed commit. The reproduction used the Linux Zed on the owner's
WSL2 machine (WSLg, X11 fallback) with the language server wrapped by
`tools/lsp-tap.js`, which records every LSP message with a timestamp; the decoded timelines
are in R5 and the raw log stayed in the session scratchpad.

## Verdicts (spec FR-006)

| Start-up path (FR-002) | Verdict | Evidence | What the developer sees |
|------------------------|---------|----------|-------------------------|
| First install in a session where the extension was never loaded | deliverable, already works | R2 (source), R5 session 1 (tap) | the open file is served about half a second after discovery, no reopen |
| Update, reinstall, uninstall then install (includes every rerun of `zed: install dev extension`) | **blocked** by Zed | R3 (source), R5 reinstall (tap and Zed log), Zed issue #60405 | no Playwright affordances in any file, open before or after, until `editor: restart language server` or a new Zed session; closing and reopening a file does not help |
| Disable then enable | same as the row above | Zed 1.24.2 has no per-extension disable; `zed: extensions` offers uninstall and install only | see above |
| Language server restart (`editor: restart language server`) | deliverable, already works | R4 (source) | every open file of the worktree is re-sent to the new server |
| Editor restart with files restored from the previous session | deliverable, already works | R2 (source), R5 session 2 (tap) | all restored files are served after discovery, no reopen |

Consequence for the feature: no path can be fixed in this repository, because every path
that works already works, and the blocked path is decided inside Zed before the extension's
`language_server_command` is ever called. The deliverables are therefore (a) a server-side
regression test that replays the editor's sequence for the working paths, (b) a log line
that names the open files the server serves once discovery ends, so a user can verify the
working paths without a tap, (c) the README and parity note for the blocked path, and
(d) facts for the owner to add to Zed issue #60405, which describes the same mechanism on the
remote path.

## R1. Where does the gap lie: editor or server?

**Decision**: the editor. The server needs no change to serve a file that was open before it
started, because Zed sends `textDocument/didOpen` for every already-open buffer of the
worktree as soon as a matching server reaches the running state, and asks for lenses again
after the server's `workspace/codeLens/refresh`.

**Rationale**:

- `crates/project/src/lsp_store.rs:13458` `insert_newly_running_language_server`;
  line 13575 "Tell the language server about every open buffer in the worktree that matches
  the language": iterates `buffer_store.buffers()`, filters by worktree and adapter name, and
  calls `language_server.register_buffer(uri, language_id, version, text)` (the `didOpen`)
  for each registered buffer, then emits `RegisteredForBuffer` per buffer.
- `crates/editor/src/editor.rs:2151` handles `LanguageServerBufferRegistered` with
  `update_lsp_data(Some(buffer_id))`, which calls `refresh_code_lenses` (`editor.rs:11376`),
  so the first lens request follows the `didOpen` immediately.
- `crates/project/src/lsp_store/code_lens.rs:92` `refresh_code_lens` evicts the per-buffer
  lens cache for the server and emits `RefreshCodeLens`; `editor.rs:2092` refetches. The
  server already sends the refresh when discovery ends (`server/src/server.ts`,
  `discoverEnabled`), verified since feature 001.
- Tap evidence R5: in both working sessions the `didOpen` for the pre-open file arrived
  within 70 ms of `initialize`, a lens request followed within 200 ms (empty, discovery not
  done), and the lens request after the refresh returned the lenses.

**Alternatives considered**: a server-side change that asks the client for open documents.
LSP has no such request; a server only learns about documents through `didOpen`. Rejected
as impossible, not merely as a workaround.

## R2. Does an extension installed mid-session reach already-open buffers?

**Decision**: yes, on a first load in the session. Verdict "deliverable, already works".

**Rationale**:

- `crates/language/src/language_registry.rs:280` `register_lsp_adapter` (called by the
  extension host through `crates/language_extension/src/extension_lsp_adapter.rs`
  `register_language_server`) bumps the registry version and pokes the subscription.
- `crates/project/src/lsp_store.rs:5433` `maintain_buffer_languages` wakes on that
  subscription; line 5523 "Also register buffers that already have a language with any
  newly-available language servers (e.g., from extensions that finished loading after
  buffers were restored)" calls `register_buffer_with_language_servers` for every registered
  buffer that already has a language.
- `crates/project/src/manifest_tree/server_tree.rs:152` `walk` and `:235`
  `adapters_for_language` recompute the adapter list from `languages.lsp_adapters` on every
  call, so a repeated walk for the same path sees the new adapter, inserts a node for it and
  `server_id_or_init` starts the server (`lsp_store.rs:3138`).
- The block at line 5523 exists in every release tag checked:
  v1.20.2, v1.21.0, v1.22.0, v1.23.1, v1.23.2, v1.23.3, v1.24.2, v1.24.3
  (`raw.githubusercontent.com/zed-industries/zed/<tag>/crates/project/src/lsp_store.rs`,
  2026-10-17). The owner's Linux Zed versions since 2026-10-12 (1.23.2, 1.23.3, 1.24.2) all
  carry it.
- Tap evidence R5 session 1: extension symlink created at 06:50:53 UTC, server started at
  06:50:53.751, `didOpen passing.spec.ts` at 06:50:53.808, 14 lenses answered after the
  refresh at 06:50:54.239.

## R3. Why does a reinstall or update leave every file without the server?

**Decision**: blocked by Zed. Unloading an extension marks its language server as manually
stopped, and nothing clears that mark when the extension is loaded again.

**Rationale** (all in `fb69067`):

1. `crates/extension_host/src/extension_host.rs:1263` `extensions_updated`: an extension
   whose manifest changed, or that was explicitly modified (a dev extension rerun), is put
   in both `extensions_to_unload` and `extensions_to_load` ("reloading"); a removed one is
   only unloaded. For every extension to unload, line 1406 calls
   `proxy.remove_language_server(language, name)` per declared language.
2. `crates/language_extension/src/extension_lsp_adapter.rs:71` `remove_language_server`
   removes the adapter from the registry and, at line 84, calls the public
   `LspStore::stop_language_servers_for_buffers(Vec::new(), {Name(name)})`.
3. `crates/project/src/lsp_store.rs:13108` `stop_language_servers_for_buffers` stops the
   servers and, at line 13151, `local.stopped_language_servers.extend(stopped_names)`. This
   is the same set the `editor: stop language server` command fills.
4. `crates/project/src/lsp_store.rs:3218`, inside `register_buffer_with_language_servers`:
   a tree node whose name is in `stopped_language_servers` is skipped, for buffers that were
   open before and for buffers opened later alike, so the server is never started again.
5. The set is cleared only in `restart_language_servers_for_buffers` with
   `clear_stopped = true` (line 13081), which is what the `editor: restart language server`
   action passes (`crates/editor/src/editor.rs:8648`), or by a new Zed process.
   `register_lsp_adapter` (`language_registry.rs:280`) does not touch the set.

Empirical confirmation (R5): uninstall at 06:52:42 UTC, Zed log "stopping language server
playwright" and the tap shows `shutdown` and `exit`; reinstall at 06:52:50, Zed log
"extensions updated. loading 1, reloading 0, unloading 0"; no server start in the following
two minutes, and none when a real spec file (`failing.spec.ts`) was opened at 06:54:51.
A rerun of `zed: install dev extension` takes the "reloading" branch of step 1 and ends in
the same state; this is the flow the owner uses after every Rust change.

Known Zed report: https://github.com/zed-industries/zed/issues/60405 "Remote dev extension
upload stops language server after startup" (open, 2026-07-05; a commenter on 2026-08-10
confirms with another dev extension and notes that the restart action usually recovers). It
describes the remote path of the same mechanism. The local path reproduced here is not
reported there yet; the facts in this section are what the owner can add (AI policy: the
owner writes the comment).

**Alternatives considered**:

- Clearing the mark from the extension: impossible, the Rust shell is not called while the
  node is skipped, and no extension API touches the stopped set. Any attempt would be the
  kind of workaround the constitution forbids.
- Telling the user to close and reopen the file: does not work on this path (step 4 applies
  to a reopened buffer too) and is therefore removed from the documentation; the
  instruction is `editor: restart language server` from any TypeScript or JavaScript file
  in the project (it restarts the TypeScript servers too) or a Zed restart.
- Waiting for a Zed fix: the right long-term answer; the parity note links #60405 and the
  row keeps its status because the capability itself is unaffected.

## R4. Server restart and editor restart paths

**Decision**: both deliverable, already working.

**Rationale**:

- Server restart: `lsp_store.rs:13029` stops the servers of the editor's buffers, clears
  the stopped set, and re-registers those buffers with `ignore_refcounts = true`; the new
  server then goes through R1's `insert_newly_running_language_server`, which re-sends
  `didOpen` for every registered buffer of the worktree, not only the restarted editor's.
- Editor restart: restored buffers are registered on open; the first registration starts
  the server; R1 applies. Tap evidence R5 session 2: three restored files, three `didOpen`
  within 70 ms of `initialize`, lenses after the refresh.

## R5. Reproduction timelines (2026-10-17, Zed 1.24.2, UTC)

Setup: Linux Zed `~/.local/bin/zed --foreground` under WSLg with `WAYLAND_DISPLAY` unset;
dev extension "installed" and "uninstalled" by creating and removing the symlink
`~/.local/share/zed/extensions/installed/playwright-runner-lsp` that
`zed: install dev extension` creates (Zed watches that directory,
`extension_host.rs:519`, and reloads within 300 ms); server entry pointed at the tap through
the login shell export, which Zed reads for the project environment.

Session 1, workspace `fixtures/sample-project` with `tests/passing.spec.ts` open, extension
absent, then installed:

```
06:50:53.751  tap start (server spawned by Zed, cwd fixtures/sample-project)
06:50:53.755  >> initialize   clientInfo Zed 1.24.2+stable.373, workspaceFolders [sample-project]
06:50:53.808  >> initialized, workspace/didChangeConfiguration, textDocument/didOpen passing.spec.ts
06:50:53.813  << logMessage   "Zed trusts .../sample-project; test discovery enabled without asking"
06:50:53.860  >> textDocument/inlayHint passing.spec.ts        << []
06:50:53.892  >> textDocument/codeLens passing.spec.ts         << []   (discovery running)
06:50:54.060  >> textDocument/codeAction passing.spec.ts       << []
06:50:54.239  << logMessage   "discovered 17 test(s)"; << workspace/codeLens/refresh  >> null
   (next)     >> textDocument/codeLens passing.spec.ts         << 14 lenses
06:52:22.690  >> didOpen tests/todomvc.spec.ts (a path that does not exist: empty new buffer)
06:52:22.786  >> codeLens todomvc.spec.ts << []; codeAction << 3 (project picker)
06:52:42.960  >> shutdown << null; >> exit            (symlink removed: "stopping language server playwright")
06:52:50      symlink recreated: Zed log "extensions updated. loading 1"; no server start
06:54:51      zed --add tests/failing.spec.ts; still no server start by 06:56:18
```

The lens request after the refresh carries a timestamp earlier than the refresh in the raw
log (06:50:51.847); WSL2 stepped the wall clock during the run, a known artifact already
recorded in feature 006. Message order in the file is authoritative.

Session 2, Zed restarted on the folder only, three tabs restored, extension installed:

```
06:56:19.806  tap start
06:56:19.810  >> initialize
06:56:19.874  >> didOpen passing.spec.ts, didOpen failing.spec.ts, didOpen todomvc.spec.ts
06:56:19.977  >> codeLens x3                          << [] x3
06:56:20.326  << "discovered 17 test(s)"; << workspace/codeLens/refresh
06:56:20.458  >> codeLens passing.spec.ts << 14; todomvc.spec.ts << 0; failing.spec.ts << 5
```

Zed log lines for the same minutes (`~/.local/share/zed/logs/Zed.log`, local time +02:00):
08:50:53 "rebuilt extension index", "extensions updated. loading 1, reloading 0, unloading
0", "starting language server process ... playwright-zed-language-server.js --stdio";
08:52:42 "extensions updated. loading 0, reloading 0, unloading 1", "stopping language
server playwright"; 08:52:50 "extensions updated. loading 1, reloading 0, unloading 0" and
nothing after it; 08:56:19 four "starting language server process" lines (TypeScript,
ESLint, Playwright, one more) for the restored session.

## R6. The owner's Windows Zed with WSL remoting

`~/.local/share/zed/remote_extensions/` on the WSL side holds only `html`; the remote
server log (`~/.local/share/zed/logs/server-workspace-2.log`) shows "Loaded language
server: vscode-html-language-server" and never a Playwright server. The Windows Zed session
that was running during this research therefore never loaded this extension, and every
observation behind the feature request comes from the Linux Zed. Remote (SSH or WSL) use of
the extension stays out of scope for this feature; Zed issue #60405 covers the dev
extension case there.

## R7. Server-side regression guard and observability

**Decision**: add an integration test that replays the editor's sequence for the working
paths (open before discovery ends, empty lenses, refresh, lenses present; three documents
at once), and one log line after discovery that lists the open documents the server now
serves. No run or command changes.

**Rationale**: the working paths rest on the server answering `textDocument/codeLens` for a
document it learned about before discovery and refreshing afterwards. Existing tests cover
the refresh (`consent.test.ts`, `projects.test.ts`) but every `TestClient` waits for
discovery before opening documents, so the install sequence itself is untested. The log line
gives the owner's quickstart and any user a check that needs no tap: the language server
log names the files that were open when discovery finished.

**Alternatives considered**: a `playwright/status` field with the served documents. The
status request exists for tests; the log line is what a user sees, and the test can read
`window/logMessage` too. Both would do; the log line is the smaller change.
