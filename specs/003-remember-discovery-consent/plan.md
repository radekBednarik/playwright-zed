# Implementation Plan: Remember Discovery Consent per Folder

**Branch**: `003-remember-discovery-consent` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-remember-discovery-consent/spec.md`

## Summary

Developers must answer the extension's discovery question at every Zed start (feature 002).
Research found that Zed 0.218+ already has persistent per-folder **worktree trust**: it does
not start any language server, ours included, in an untrusted folder, remembers trust across
restarts, and lets the user revoke it (research R1 to R3). The owner chose to rely on it.

Technical approach: the server reads `initialize.params.clientInfo`. When it names a Zed
release channel at version `>= 0.218.0`, every workspace folder handed over as a workspace
folder starts `enabled` and discovers at once, without a question. Otherwise, including the
`rootUri` fallback, feature 002 behaviour is unchanged. `playwright/status` reports the
source. No Rust change, no storage, no new command.

## Technical Context

**Language/Version**: TypeScript 5 on Node >= 22 (server); Rust shell unchanged

**Primary Dependencies**: `vscode-languageserver` 9.x (existing); no new dependency

**Storage**: none in the extension; trust is persisted by Zed (`trusted_worktrees` table)

**Testing**: vitest 5 unit tests (`server/test/unit/trust.test.ts`) and integration tests
(`server/test/integration/trust.test.ts`) using the existing `TestClient`, extended with an
optional `clientInfo`; manual Zed checks in `quickstart.md`

**Target Platform**: Zed 0.218+ on Linux, macOS, Windows, SSH/WSL remotes; fallback for any
other LSP client

**Project Type**: Zed extension (Rust/WASM shell) plus Node language server

**Performance Goals**: none new; discovery time as in feature 001

**Constraints**: nothing from the workspace may decide trust (FR-004); feature 002 tests must
pass unchanged (SC-005)

**Scale/Scope**: about 40 lines of server code, one new module, two new test files, docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | Upstream relies solely on VS Code Workspace Trust; this feature relies on Zed's equivalent. The `zed-only` gate row in `docs/parity.md` is updated to name Zed worktree trust as the primary gate and the feature 002 question as fallback. |
| II. Zed extension rules | Pass | No Rust change, no bundled binary, no storage outside designated places. The server reads only what the client sends in `initialize`; it never reads Zed's database (research R4, alternative rejected). |
| III. Native primitives | Pass | Uses Zed's own trust primitive instead of emulating one; the extension stops duplicating it. |
| IV. Playwright CLI is the runtime | Pass | Discovery still runs `playwright test --list` unchanged. |
| V. Verified behaviour | Pass (planned) | Unit tests for the version rule, integration tests for both paths, `quickstart.md` scenarios 2 to 6 in Zed, recorded in `verification.md`. No Rust change, so the WASM build is run only as a regression check. |

Post-design re-check (after data-model, contract, quickstart): unchanged, all pass. No
Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/003-remember-discovery-consent/
├── plan.md              # This file
├── research.md          # Phase 0: Zed worktree trust findings (R1 to R7)
├── data-model.md        # Phase 1: gate flag, discoverySource, initial-state table
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── editor-trust.md  # Phase 1: delta on the feature 002 contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── trust.ts         # NEW: editorHasTrustGate(clientInfo) – pure, unit tested
│   ├── server.ts        # onInitialize stores the gate; addWorkspace picks initial state;
│   │                    # status gains discoverySource and editorTrustGate; log lines
│   └── types.ts         # Workspace gains discoverySource and fromWorkspaceFolders
└── test/
    ├── unit/trust.test.ts            # NEW: names, versions, build metadata, missing fields
    └── integration/
        ├── helpers.ts                # StartOptions.clientInfo, optional rootUri-only start
        └── trust.test.ts             # NEW: gate present / old Zed / rootUri fallback
docs/parity.md                        # gate row updated
README.md, server/README.md           # explain Zed trust, revoke, trust_all_worktrees
```

**Structure Decision**: server-only change in the existing `server/` package; the Rust shell in
`src/lib.rs` is untouched because the shell cannot see trust either (research R4).

## Design Notes

1. `trust.ts`: parse `version` with `/^(\d+)\.(\d+)\.(\d+)/`, compare to `[0, 218, 0]`; name
   must be in the fixed set of four. Export the minimum version as a constant for the log line
   and docs.
2. `onInitialize`: `editorTrustGate = editorHasTrustGate(params.clientInfo)`; mark folders from
   `params.workspaceFolders` as `fromWorkspaceFolders = true`, the `rootUri` fallback as
   `false`. `didChangeWorkspaceFolders` additions are `true`.
3. `addWorkspace`: if `editorTrustGate && fromWorkspaceFolders`, create the workspace with
   `discovery: 'enabled'`, `discoverySource: 'editor-trust'`, and log the contract line once
   per folder. `discoverWorkspace` already calls `discoverEnabled` for `enabled` workspaces
   after version gating, so no new branch is needed there.
4. `enableDiscovery` sets `discoverySource = 'answer'`.
5. Release: the change ships in the next npm server release (with the Node 22 requirement
   already on `main`) and a matching pin bump in the Rust shell; the release itself needs the
   owner's OK and is not part of this feature's tasks beyond preparing notes.

## Complexity Tracking

None.
