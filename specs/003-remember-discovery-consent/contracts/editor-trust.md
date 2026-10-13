# Contract: Editor Trust Gate

Delta on `specs/002-discovery-consent/contracts/discovery-consent.md`. Everything not listed
here is unchanged.

## Input (client → server)

`initialize.params.clientInfo` (LSP 3.15+), optional:

```json
{ "name": "Zed", "version": "1.23.3" }
```

Accepted names: `Zed`, `Zed Preview`, `Zed Nightly`, `Zed Dev`. Gate present iff the version's
leading `major.minor.patch` is `>= 0.218.0`. See `data-model.md` for the full rule.

## Behaviour with the gate present

For each folder from `initialize.workspaceFolders` or `workspace/didChangeWorkspaceFolders`
`added`, after config location and version gating (unchanged):

- no `window/showMessageRequest` is sent;
- the workspace starts `enabled`, discovery (`playwright test --list`) runs at once, then
  `workspace/codeLens/refresh` as in feature 001;
- one log line through `window/logMessage` (Info):

  ```text
  playwright: Zed trusts <absolute path>; test discovery enabled without asking (Zed <version> starts language servers only in trusted folders)
  ```

- run lenses, run actions, re-run and re-discovery on save behave as in feature 001;
- the code action `Playwright: Enable test discovery` is not offered (the folder is `enabled`).

A folder taken from the `rootUri` fallback (no `workspaceFolders` in `initialize`) follows the
feature 002 contract even with the gate present.

## Behaviour without the gate, and for fallback roots

Identical to `specs/002-discovery-consent/contracts/discovery-consent.md`. Additionally, one
log line at the first question, worded by cause:

```text
playwright: asking before discovery in <absolute path>; <client name and version, or "the editor"> is not known to gate language servers on folder trust
```

When the gate is present but the folder came only from the `rootUri` fallback:

```text
playwright: asking before discovery in <absolute path>; the folder was not reported as a workspace folder, so Zed's trust cannot be assumed for it
```

## Status (debug request)

`playwright/status` entries gain:

| Field | Type | Meaning |
|-------|------|---------|
| `discoverySource` | `"editor-trust" \| "answer" \| null` | why the workspace is `enabled`; `null` while `pending` or `declined` |
| `editorTrustGate` | `boolean` | the session-wide gate flag, repeated on every entry for troubleshooting |
