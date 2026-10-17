# Contract: Already-Open Documents

Delta on the feature 001 LSP contract. Nothing changes in capabilities, commands, arguments
or settings (spec FR-005, SC-005).

## 1. Editor sequence the server must serve (working start-up paths)

Observed from Zed 1.24.2 (research R5) and replayed by the integration test in section 3:

```
initialize                                  (workspaceFolders present)
initialized
textDocument/didOpen D1 [, D2, D3 ...]      (every file that was already open, before any discovery output)
textDocument/codeLens D1 ...                -> []   (discovery not finished: no tests known yet)
... discovery ends ...
<- workspace/codeLens/refresh
textDocument/codeLens D1 ...                -> lenses for the selected tests of D1
```

Requirements on the server, all already met by the feature 001 to 006 implementation and
now pinned by tests:

- A `textDocument/codeLens` request for a document whose workspace has not finished
  discovery answers `[]`, never an error, and never blocks until discovery ends.
- `workspace/codeLens/refresh` is sent exactly once per discovery completion of a workspace.
- After the refresh, `textDocument/codeLens` for every open document under a discovered
  config returns one lens per selected test and describe line (feature 001 and 005 rules).
- `textDocument/codeAction` before discovery answers `[]`; after discovery the project
  picker is offered for any document under the config (feature 005).

## 2. Log line after discovery (new)

After discovery of a workspace ends and the refresh has been sent, the server logs through
`window/logMessage` (type Log), once per discovery run:

```
playwright: <n> open file(s) served after discovery: <relative path>, <relative path>
```

where `<n>` counts the open documents that belong to a discovered config of that workspace
(`configForFile(ws, file) != null`), the paths are relative to the workspace root, sorted,
and the line is omitted when `<n>` is 0. The line follows the existing
`playwright: discovered <k> test(s) via <config>` line.

## 3. Integration test (new, `server/test/integration/attach.test.ts`)

Through the existing `TestClient` against `fixtures/sample-project`, without waiting for
discovery first:

1. Start the client (initialize, initialized), immediately `didOpen` `tests/passing.spec.ts`,
   request `textDocument/codeLens`: expect `[]`. Then `waitForDiscovery()`; request lenses
   again: expect at least one `▶ Run test` lens. Expect the log line of section 2 naming
   `tests/passing.spec.ts`.
2. Same with three documents opened in one burst (`passing.spec.ts`, `failing.spec.ts`,
   `slow.spec.ts`) before discovery: all three answer `[]` first and lenses after the
   refresh; the log line lists all three.
3. A document opened before discovery that is outside the config's test directories
   (`playwright.config.ts` itself is under the root but is not a test file) answers `[]`
   both times and is not listed.

The `TestClient` gains a `start` option `openBeforeDiscovery?: string[]` or the tests call
`open()` right after `start()` (the existing `start` returns after `initialized`, before
discovery; both work, the second needs no helper change).

## 4. Documentation (blocked path, spec FR-007)

- README "Install" section, after the dev extension step: one sentence stating that after
  an update, a reinstall or a rerun of `zed: install dev extension`, Zed keeps the
  Playwright server stopped in that session; run `editor: restart language server` from any
  TypeScript or JavaScript file of the project (or restart Zed), and that closing and
  reopening files does not help. A link to Zed issue #60405.
- `docs/parity.md`: the "Run tests with a single click" and "Playwright project detection
  and selection" rows gain a sentence that files open before the extension starts are served
  without a reopen (verified on Zed 1.24.2), with the same update caveat and link. Row
  status unchanged.
