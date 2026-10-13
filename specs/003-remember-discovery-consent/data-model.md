# Data Model: Remember Discovery Consent per Folder

Delta on `specs/002-discovery-consent/data-model.md`. Nothing is persisted by the extension;
persistence belongs to Zed's worktree trust (research R1).

## Editor Trust Gate (new, per server session)

| Field | Type | Source | Rule |
|-------|------|--------|------|
| `editorTrustGate` | `boolean` | `initialize.params.clientInfo` | `true` iff `name` is `Zed`, `Zed Preview`, `Zed Nightly` or `Zed Dev` and the leading `major.minor.patch` of `version` is `>= 0.218.0` (research R2, R4). Otherwise `false`, including when `clientInfo` or `version` is missing or unparsable. Set once, never changes during the session. |

Validation: build metadata and pre-release suffixes (`1.23.3+stable.42`, `0.218.0-pre`) are
ignored for the comparison; only the three leading numbers count. `0.218.0-pre` counts as
`0.218.0` (gate present in previews of 0.218).

## Workspace (changed)

| Field | Type | Change |
|-------|------|--------|
| `discovery` | `'pending' \| 'enabled' \| 'declined'` | unchanged |
| `discoveryAsked` | `boolean` | unchanged |
| `discoverySource` | `'editor-trust' \| 'answer' \| null` | **new**. `editor-trust` when the workspace was created `enabled` because of the gate; `answer` when it became `enabled` through "Run discovery" or `playwright.enableDiscovery`; `null` while `pending` or `declined`. |
| `fromWorkspaceFolders` | `boolean` | **new, internal**. `true` when the folder came from `initialize.workspaceFolders` or `workspace/didChangeWorkspaceFolders`; `false` for the `rootUri` fallback. |

## Initial state when a folder is added

| `editorTrustGate` | `fromWorkspaceFolders` | Initial `discovery` | `discoverySource` | Question |
|-------------------|------------------------|---------------------|-------------------|----------|
| `true` | `true` | `enabled` | `editor-trust` | never |
| `true` | `false` | `pending` | `null` | feature 002 |
| `false` | any | `pending` | `null` | feature 002 |

## Transitions

Feature 002 transitions are unchanged and apply only to workspaces that start `pending`:
`pending → enabled` (sets `discoverySource = 'answer'`), `pending → declined`,
`declined → enabled` (sets `discoverySource = 'answer'`). A workspace that starts `enabled`
through `editor-trust` stays `enabled` for the session; `playwright.enableDiscovery` on it is
a no-op, as for any `enabled` workspace.

The unsupported-version rule from feature 002 runs before this table: a folder without a
supported config never discovers, whatever its source.
