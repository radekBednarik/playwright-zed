# Implementation Plan: Project Scaffold and Run Test at Cursor

**Branch**: `001-scaffold-run-at-cursor` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-scaffold-run-at-cursor/spec.md`

## Summary

Deliver the first installable "Playwright for Zed" extension and the upstream "run tests with a
single click" capability. Zed exposes extension code only through language-server, debug-adapter
and context-server hooks, and it refuses extension languages that shadow bundled TypeScript, so
the extension is a thin Rust/WASM shell that attaches a Playwright language server to Zed's
bundled TypeScript, TSX and JavaScript languages. The server is a separate Node package
(published to npm, installed at runtime, never bundled) that detects Playwright per workspace,
discovers tests with `playwright test --list --reporter=json`, offers "Run test at cursor",
"Run file" and "Re-run last" as code actions and code lenses, executes runs through the
workspace's own Playwright CLI, and reports results inside Zed via progress, notifications,
diagnostics at failing lines, and the language-server log. A documented `tasks.json` recipe
gives terminal-panel output through Zed's native runnables as a complementary `zed-only` path.

## Technical Context

**Language/Version**: Rust stable (1.99 locally) for the extension; TypeScript 5.x on Node 20+
(24.19 locally) for the language server.

**Primary Dependencies**: `zed_extension_api` 0.7.0 (newest accepted by Zed stable, see
research R1); `vscode-languageserver` 9.x and `vscode-languageserver-textdocument` for the
server; `@playwright/test` is a peer tool resolved from the user's workspace, never a dependency.

**Storage**: N/A. In-memory per-workspace caches in the server (discovered tests, last run,
diagnostics). One temp file per run for the JSON report.

**Testing**: `cargo test` (host) for Rust helpers; `vitest` for server unit tests; server
integration tests spawn real Playwright against `fixtures/sample-project`; manual dev-extension
verification in Zed per `quickstart.md`.

**Target Platform**: Extension compiles to `wasm32-wasip2` and runs in Zed stable 1.23.x on
Linux, macOS and Windows. Server runs on the user's Node.

**Project Type**: Editor extension (two components in one repo: Rust WASM shell + Node LSP).

**Performance Goals**: Non-binding targets, not verified by tasks in this feature: code
actions and lenses answer from cache (no CLI call on request), discovery for the fixture
completes within a few seconds of open or save, and a run starts as soon as the command is
received. Binding targets will be set when a parity row depends on them.

**Constraints**: No bundled binaries. No filesystem access from WASM outside the extension
work dir and worktree accessors. Extension capabilities limited to `npm:install` for the server
package. Playwright v1.38+ only. English-only user text. No Zed API workarounds.

**Scale/Scope**: Single-user editor workloads: tens of config files, thousands of tests per
workspace, one run at a time per workspace.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|-----------|--------|-----------------------|
| I. Reference-driven parity | PASS | Spec cites "project detection" and "run tests with a single click". `docs/parity.md` is created with all 12 upstream rows; these two move to `partial` (no line highlighting, no step durations, no test tree) with reasons. The `tasks.json` recipe is recorded as `zed-only`. |
| II. Zed extension rules | PASS | Rust, `wasm32-wasip2`, `zed_extension_api` 0.7.0. `extension.toml` carries all required fields; id `playwright` (fallback `playwright-lsp` if maintainers require, R9). Server installed at runtime via `npm_install_package`, never bundled. Capability declared: `npm:install` for the one package. No slash commands. MIT license at root. |
| III. Native primitives | PASS with recorded block | Mapping per capability in research R2: run at cursor uses primitive 3 (language server: code actions, code lenses, `workspace/executeCommand`, diagnostics, progress, showMessage). Primitive 1 (tasks/runnables) is `blocked` for extension-driven runs: extensions cannot add task templates to bundled languages and extension LSP adapters cannot schedule tasks. It is offered as a documented user recipe instead. |
| IV. Playwright CLI is the runtime | PASS | Discovery via `playwright test --list --reporter=json`; runs via `playwright test <file>:<line> --reporter=list,json`; version from the resolved `@playwright/test` package; config resolution by Playwright's own `-c`. No custom parsing of config files or test source. |
| V. Verified behaviour | PASS | `cargo test`, `cargo build --target wasm32-wasip2`, `vitest` unit and fixture integration tests, and `quickstart.md` manual scenarios mapped 1:1 to spec acceptance scenarios. |
| Simplicity rule | JUSTIFIED | A language server is the smallest primitive that gives the extension any entry point on TypeScript files (R2). Justification recorded in Complexity Tracking. |

**Post-design re-check (after Phase 1)**: all rows unchanged. The server contract
(`contracts/lsp-protocol.md`) adds no capability beyond LSP standard requests. No new
violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-scaffold-run-at-cursor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── extension-manifest.md   # extension.toml, capabilities, Rust surface
│   ├── lsp-protocol.md         # server capabilities, commands, lenses, diagnostics
│   └── playwright-cli.md       # exact CLI invocations and parsed JSON fields
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
extension.toml                 # Zed manifest (id, name, version, language server, capabilities)
Cargo.toml                     # cdylib, zed_extension_api = "0.7.0"
LICENSE                        # MIT, at extension root as Zed requires
README.md                      # install, settings (code_lens), tasks.json recipe
src/
└── lib.rs                     # register_extension!, language_server_command, server install
docs/
└── parity.md                  # parity matrix (constitution Principle I)
server/                        # Node language server, published as playwright-zed-language-server
├── package.json
├── tsconfig.json
├── bin/playwright-zed-language-server.js
├── src/
│   ├── server.ts              # LSP wiring: capabilities, handlers, lifecycle
│   ├── workspace.ts           # config discovery, Playwright resolution, version gate
│   ├── discovery.ts           # `--list --reporter=json` runner and cache
│   ├── commands.ts            # runAtCursor / runFile / rerunLast resolution
│   ├── runner.ts              # process spawn, serialization, JSON report parsing
│   ├── reporting.ts           # progress, showMessage, diagnostics, log output
│   └── version.ts             # semver compare for the v1.38 gate
└── test/
    ├── unit/                  # vitest: version gate, location resolution, report parsing
    └── integration/           # vitest: real Playwright against fixtures/sample-project
fixtures/
└── sample-project/            # minimal Playwright project (chromium only)
    ├── package.json
    ├── playwright.config.ts
    └── tests/
        ├── passing.spec.ts    # passing test, nested describe, duplicate titles
        └── failing.spec.ts    # one failing test with assertion message
```

**Structure Decision**: The Zed extension lives at the repository root so `zed: install dev
extension` points at the clone and the publishing submodule needs no `path`. The language server
and fixtures are sibling directories that Zed's packager ignores (only `extension.toml`, the
compiled WASM and declared asset directories are packaged). Two toolchains in one repo keeps the
server and the shell versioned together; the server's npm version is pinned by the Rust shell.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Second codebase: a Node language server published to npm | Zed invokes extension code only through language-server, debug-adapter or context-server hooks. A language server is the only one that fires for TypeScript files, runs outside the WASM sandbox, and can both offer editor affordances (code actions, lenses) and spawn the Playwright CLI. | Tasks-only (`tasks.json` recipe) needs no code but produces no installable extension, no detection, no version gate, and no `partial` parity rows; constitution Principle I and spec FR-001/FR-004/FR-005 are unmet. Defining a "Playwright" language to ship `tasks.json` is refused by Zed for bundled language names and would violate the no-workaround rule. |
