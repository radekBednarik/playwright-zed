# Data Model: Attach to Already-Open Spec Files

No new persistent data. The feature records verdicts in documentation and adds one derived
value to the server's existing document tracking.

## StartupPath (documentation only)

Recorded in `research.md` (verdict table) and `verification.md`. Fields: path (one of
`first-install`, `update-or-reinstall`, `disable-enable`, `server-restart`,
`editor-restart`), verdict (`deliverable` | `blocked`), evidence (file and line in the Zed
sources at `fb69067`, tap timeline, Zed log line), editor version, date, demonstration
(quickstart scenario and outcome).

## OpenDocument (server memory, existing)

The server already keeps every document the client opened in `documents` (a
`TextDocuments` instance, `server/src/server.ts`). Feature 007 derives from it, when a
workspace's discovery finishes:

```
servedOpenFiles(ws): string[]   // absolute paths of open documents that belong to one of
                                // ws.configs (configForFile(ws, file) != null), sorted
```

Used only for the log line in `contracts/attach.md` section 2. Not stored.

## Workspace (existing)

Unchanged. The moment that triggers the log line is the end of `discoverEnabled(ws)`, the
same moment the server sends `workspace/codeLens/refresh`.

## State transitions

```
client opens document D (didOpen)            -> documents has D; lenses for D answer []
                                                 while ws.discovery != enabled or no tests yet
discovery for ws ends                        -> refresh sent; log line lists servedOpenFiles(ws)
client asks lenses for D again               -> lenses for D's selected tests
client closes D (didClose)                   -> documents drops D
```

Nothing in these transitions is new; the test in `contracts/attach.md` section 3 pins the
first three in the order the editor performs them on the working start-up paths.
