# Implementation Plan: Zed Registry Submission

**Branch**: `004-zed-registry-submission` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-zed-registry-submission/spec.md`

## Summary

List the extension in `zed-industries/extensions` without tripping any of the registry's
automated or human-review rules and without violating its AI policy. Concretely: rename the
extension to id `playwright-runner-lsp` and display name "Playwright Runner" (the current name
fails the registry's manifest check), release 0.4.0 on `main` with a tag, prove the build on
the registry's pinned Rust 1.90, prepare a registry fork clone with the submodule and entry
and run the registry's own validation on it locally, verify the dev extension and the npm
install path at the tagged commit, and hand the owner a fact sheet plus a to-do list. The
owner forks, pushes, writes the PR in their own words, and handles review.

## Technical Context

**Language/Version**: Rust stable (1.99 locally) and Rust 1.90 (registry pin) for the shell;
TypeScript on Node 22/24 for the server (text changes only)

**Primary Dependencies**: `zed_extension_api` 0.7.0 (unchanged); registry tooling:
`zed-extension` CLI at `9ee3c503a4bbbc6b4a0f8a789acca4871d773223`, registry scripts run with
`corepack pnpm@11`; `gh` for fork and PR status

**Storage**: files only. This repository (manifest, docs, memory), the sibling registry clone
`../zed-extensions`, the hand-over file in this feature directory

**Testing**: `cargo test`; `cargo +1.90 build --release --target wasm32-wasip2`; server
`npm run lint && npm test && npm run build` (text assertions updated); registry
`package-extensions` run locally; manual quickstart in Zed at the tagged commit

**Target Platform**: `wasm32-wasip2` extension; Zed stable 1.23+ on Linux (WSL2) for manual
verification; registry pipeline on Ubuntu 24.04

**Project Type**: Zed extension (Rust/WASM shell + Node language server); this feature is
release and distribution work, no new runtime behaviour

**Performance Goals**: not applicable (no runtime change)

**Constraints**: registry rules as snapshotted in spec "Registry Rules Found"; AI policy:
no agent-authored registry-facing text, owner performs fork, push, PR, comments; at most
three open registry PRs (currently zero); ids immutable after publication

**Scale/Scope**: about 12 files renamed or edited in this repo, one CI job added, one
release commit and tag, one registry branch with two file changes plus one submodule, one
hand-over document, one verification record

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the feature complies |
|-----------|--------|--------------------------|
| I. Reference-driven parity | PASS (justified exception) | The spec's Upstream Reference maps this to the VS Code Marketplace distribution of upstream. No parity row is added because it is a channel, not a capability (FR-016). Names follow upstream intent ("Playwright Test for VSCode" becomes "Playwright Runner", the "for Zed" suffix being forbidden). |
| II. Zed extension rules compliance | PASS | The whole feature is this principle applied: id and name rules, licence match, no bundled server, version match, sorted registry files, one extension per PR, three-week response window. Research R1 to R3 verify them with the registry's own tooling. |
| III. Native primitives over workarounds | PASS (not applicable) | No runtime change. |
| IV. Playwright CLI is the runtime | PASS (not applicable) | No runtime change. |
| V. Verified behaviour before completion | PASS | quickstart.md defines the checks: Rust 1.90 build, registry packaging run, manual dev-extension scenarios at the tagged commit, npm install path. Outcomes go to `verification.md` and into the hand-over fact sheet. |
| Development workflow gates | PASS | Feature PR carries test output and WASM build; `docs/publishing.md` self-check is updated and ticked (FR-014). Release bumps `extension.toml`, tags, and the registry PR follows the guide. |
| Governance: Zed rule wins | PASS | The display-name rule found only in the registry's validation script is adopted; the constitution text needs no amendment since it already binds to the live rules. |

Post-design re-check (after Phase 1): unchanged, all PASS. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/004-zed-registry-submission/
├── spec.md                      # feature specification (done)
├── plan.md                      # this file
├── research.md                  # Phase 0: R1 to R10
├── data-model.md                # Phase 1: entities and validation rules
├── quickstart.md                # Phase 1: verification guide
├── contracts/
│   ├── extension-manifest.md    # the 0.4.0 extension.toml, supersedes feature 001's
│   ├── registry-entry.md        # exact extensions.toml and .gitmodules additions
│   └── owner-handover.md        # structure and prohibitions for owner-handover.md
├── checklists/requirements.md   # spec quality checklist (done)
├── owner-handover.md            # produced by implementation, consumed by the owner
├── verification.md              # produced by implementation
└── tasks.md                     # /speckit-tasks output (not created here)
```

### Source Code (repository root)

```text
extension.toml                   # id playwright-runner-lsp, name Playwright Runner, 0.4.0 at release
Cargo.toml                       # version 0.4.0 at release
src/lib.rs                       # unchanged (pin 0.3.0 stays)
.github/workflows/ci.yml         # add Rust 1.90 job next to stable
README.md                        # H1, install section, old-id uninstall note, listing line
CLAUDE.md                        # H1
docs/publishing.md               # new id, work dir, self-check list with all rules found
.claude/memory/*.md              # display name, id, work dir, submission state
server/package.json              # description text (no publish)
server/README.md                 # name reference
server/src/reporting.ts          # discovery question text
server/test/**                   # assertions on that text
specs/001-scaffold-run-at-cursor/contracts/extension-manifest.md   # superseded note
specs/002-discovery-consent/contracts/discovery-consent.md         # question text

../zed-extensions/               # sibling clone of zed-industries/extensions (not in this repo)
├── extensions.toml              # + [playwright-runner-lsp] entry, sorted
├── .gitmodules                  # + submodule, sorted
└── extensions/playwright-runner-lsp # submodule pinned to v0.4.0 on main
```

**Structure Decision**: no new source directories. The registry clone lives beside the
repository, never inside it, because the submodule it contains points back at this
repository. Verification artefacts stay in the feature directory per the project's
pattern (feature 003 `verification.md`).

## Delivery order (input for /speckit-tasks)

1. Rename in this repository (manifest, crate, docs, server text and tests), add the Rust 1.90
   CI job, update `docs/publishing.md`. Run `cargo test`, both Rust builds, server lint,
   build and tests. Open the feature PR, merge after green CI.
2. Release commit on `main`: 0.4.0 in `extension.toml` and `Cargo.toml`, tag `v0.4.0`, push.
3. Manual verification at `v0.4.0`: reinstall the dev extension under the new id, run the
   quickstart scenarios, verify the npm install path. Record in `verification.md`.
4. Prepare `../zed-extensions`: clone, branch, submodule at `v0.4.0`, entry, sort, run the
   registry's packaging and validation locally. Record output.
5. Write `owner-handover.md` from the contract. Update memory to "prepared, awaiting owner".
6. Owner: fork, push, PR, review. After merge, README and memory move to "merged" and
   User Story 3 is verified from a clean machine.

## Complexity Tracking

No constitution violations; table not needed.
