# Implementation Plan: Ask Before Running Workspace Code on Open

**Branch**: `002-discovery-consent` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-discovery-consent/spec.md`

## Summary

Feature 001 runs `playwright test --list` as soon as a folder with a Playwright configuration
is opened, which executes the folder's `playwright.config` and test files. Zed has no
Workspace Trust, so this feature inserts a per-workspace, per-session gate in the existing
language server: before the first Playwright process for a folder, the server sends one
`window/showMessageRequest` with the actions "Run discovery" and "Not now". Zed renders it
as a notification with buttons (research R1). Until "Run discovery" is chosen, or the new
`playwright.enableDiscovery` command runs, the workspace stays idle: no process, no lenses, no
run actions, and run commands answer with a pending-discovery message. The Rust shell is
untouched; config location and the version gate stay consent-free because they only read
file names and a package manifest.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 20+ (server only; no Rust change).

**Primary Dependencies**: `vscode-languageserver` 9.x (`connection.window.showWarningMessage`
with `MessageActionItem`s sends `window/showMessageRequest`); no new dependencies.

**Storage**: N/A. The decision lives in the in-memory `Workspace` for the server's lifetime.

**Testing**: vitest integration tests against `fixtures/sample-project` and a temp project
whose config writes a marker file when loaded (proves nothing executes before consent);
helper gains a configurable auto-answer for the prompt so feature 001 tests keep passing.

**Target Platform**: Zed stable 1.23.x; language server on the user's Node.

**Project Type**: Editor extension, language-server component.

**Performance Goals**: Unchanged from feature 001; the gate adds one round trip before the
first discovery and nothing afterwards.

**Constraints**: No process may start before consent (FR-001). The prompt request may never
be answered (Zed does not respond on dismissal, R1), so the server MUST NOT await it on the
critical path. Session-scoped only. English text. No Zed API workaround.

**Scale/Scope**: One decision per workspace folder; tens of folders at most.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|-----------|--------|-----------------------|
| I. Reference-driven parity | PASS | Spec cites the upstream capability (project detection) and the VS Code mechanism (Workspace Trust) this substitutes for. Recorded as a `zed-only` row "Discovery consent (Workspace Trust substitute)" in `docs/parity.md`. |
| II. Zed extension rules | PASS | No change to the Rust shell, manifest, or capabilities. Uses a standard LSP request Zed already renders. |
| III. Native primitives | PASS | Primitive 3 (language server): `window/showMessageRequest`, a code action and an `executeCommand`. No emulation of a VS Code trust dialog beyond what Zed's prompt offers. |
| IV. Playwright CLI is the runtime | PASS | The gate only delays the same `--list` invocation; version and config location keep reading files, never loading the config. |
| V. Verified behaviour | PASS | Integration tests with a side-effect config for FR-001, prompt flow tests, quickstart scenarios run as a dev extension. |
| Simplicity rule | PASS | Three states on the existing `Workspace`, one request, one command, one code action. |

**Post-design re-check (after Phase 1)**: unchanged. The contract adds one command and one
code action to the feature 001 LSP surface and no new capability.

## Project Structure

### Documentation (this feature)

```text
specs/002-discovery-consent/
├── plan.md
├── research.md          # R1 Zed prompt behaviour, R2 state model, R3 test strategy
├── data-model.md        # Workspace.discovery states and transitions
├── quickstart.md        # manual scenarios 1 to 8
├── contracts/
│   └── discovery-consent.md   # prompt, command, code action, messages, status field
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
server/src/
├── types.ts             # DiscoveryDecision type, Workspace.discovery field
├── reporting.ts         # askDiscovery(folder): sends the message request, resolves to the choice or null
└── server.ts            # gate in discoverWorkspace, enableDiscovery command, code action, status
server/test/integration/
├── helpers.ts           # auto-answer option for window/showMessageRequest, request log
├── consent.test.ts      # new: side-effect config, prompt flow, decline, enable, dismiss, multi-root
├── detect.test.ts       # adjusted for the prompt (auto-answer "Run discovery")
└── run.test.ts, focus.test.ts   # unchanged behaviour, helper auto-answers
docs/parity.md           # new zed-only row
README.md                # question, enable action, per-session scope
specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md   # extended with the new command and action
specs/001-scaffold-run-at-cursor/quickstart.md               # scenario 2 now includes the question
```

**Structure Decision**: The gate is a small state machine on the existing `Workspace` entity
inside `server.ts`; the prompt helper joins the other LSP wrappers in `reporting.ts`. No new
module is warranted.

## Complexity Tracking

No constitution violations; table not needed.
