<!--
Sync Impact Report
==================
Version change: (unfilled template) -> 1.0.0
Modified principles: none (initial ratification; all five template slots filled)
Added sections:
  - Core Principles: I. Reference-Driven Parity With playwright-vscode
  - Core Principles: II. Zed Extension Rules Compliance (NON-NEGOTIABLE)
  - Core Principles: III. Native Zed Primitives Over Workarounds
  - Core Principles: IV. Playwright CLI Is the Runtime, Never Reimplemented
  - Core Principles: V. Verified Behavior Before Completion
  - Technical Constraints
  - Development Workflow and Quality Gates
  - Governance
Removed sections: none
Templates requiring updates: none checked (constitution command does not modify
  dependent templates; plan/spec/tasks templates read this file at runtime)
Follow-up TODOs: none
Sources consulted on 2026-10-12:
  - https://zed.dev/docs/extensions/developing-extensions
  - https://zed.dev/docs/extensions/publishing/overview (+ prerequisites,
    license-requirements, publishing-guide, updating-and-maintenance)
  - https://zed.dev/docs/extensions/debugger-extensions
  - https://zed.dev/docs/extensions/languages
  - https://zed.dev/docs/tasks
  - https://docs.rs/zed_extension_api/0.7.0
  - https://github.com/microsoft/playwright-vscode (README)
-->

# Playwright for Zed Constitution

## Core Principles

### I. Reference-Driven Parity With playwright-vscode

The upstream project https://github.com/microsoft/playwright-vscode is the single functional
reference. Every feature, setting, and user flow MUST trace back to a named upstream capability.
The upstream capability set in scope is: install Playwright, Playwright project (browser)
detection and selection, run a single test or a group with one click, watch mode, show
browser, close all browsers, show trace viewer, pick locator, breakpoint debugging with
locator highlighting, tune locators while paused, record new test, and record at cursor.

- A feature spec MUST cite the upstream feature it mirrors and describe the upstream UX in
  one paragraph before describing the Zed UX.
- The project MUST maintain a parity matrix (`docs/parity.md`) with one row per upstream
  capability and a status of `full`, `partial`, `blocked`, or `not-started`, plus the Zed
  primitive used and the reason for any `partial` or `blocked` entry.
- Behavior that the upstream extension does not have MUST NOT be added unless it is required
  to reach parity on a Zed-specific path (for example a task template that replaces a
  VS Code tree view). Such additions MUST be marked `zed-only` in the parity matrix.
- Naming of settings and commands MUST follow upstream names where Zed allows it, so a user
  migrating from VS Code recognizes them.

Rationale: "1:1 rewrite" is only testable when the reference is explicit. The parity matrix
turns an aspirational goal into a checkable artifact and keeps scope from drifting.

### II. Zed Extension Rules Compliance (NON-NEGOTIABLE)

The extension MUST satisfy the Zed extension development and publishing rules at
https://zed.dev/docs/extensions/developing-extensions and
https://zed.dev/docs/extensions/publishing/overview at all times, not only at release.

- Code MUST be Rust compiled to the `wasm32-wasip2` target through the `zed_extension_api`
  crate, with `crate-type = ["cdylib"]` and `register_extension!`. No other runtime.
- `extension.toml` MUST declare `id`, `name`, `version`, `schema_version`, `authors`,
  `description`, and `repository`. The `id` MUST be unique, kebab-case, and MUST NOT contain
  the words `zed` or `extension`.
- The extension MUST NOT bundle a language server, debug adapter, or MCP server binary. It
  MUST locate or download such tools at runtime through the API (`node_binary_path`,
  `npm_install_package`, `download_file`, GitHub release helpers) and MUST rate-limit update
  checks.
- The extension MUST NOT read or modify anything outside the environment Zed designates for
  it, except through API-provided `Worktree` and `Project` accessors.
- The extension MUST NOT "misuse the extension API to work around its current limitations".
  When a limitation blocks parity, the capability is recorded as `blocked` in the parity
  matrix with a link to the relevant Zed issue or doc, and the work stops there.
- All user-facing text MUST be English. The license MUST be one Zed accepts (Apache 2.0,
  BSD 2/3-Clause, CC BY 4.0, GPLv3, LGPLv3, MIT, Unlicense, zlib) and MUST sit at the
  extension root.
- Slash-command and agent-server features MUST NOT be built; Zed no longer accepts them in
  the registry.
- Publishing MUST follow the extensions-repository process: public HTTPS submodule on a
  branch, `extensions.toml` entry whose `version` matches `extension.toml` at that commit,
  `pnpm sort-extensions`, one extension per PR, at most three open PRs, maintainer feedback
  answered within three weeks.

Rationale: a Zed extension that cannot be published or that gets rejected in review is not a
deliverable. The rules are external and change over time, so this principle binds to the
linked documents rather than copying them wholesale.

### III. Native Zed Primitives Over Workarounds

Each upstream capability MUST be mapped onto the Zed primitive that fits it best, in this
order of preference, and the chosen mapping MUST be recorded in the parity matrix.

1. Tasks and runnables (`tasks.json` templates, `runnables.scm`, `ZED_FILE`, `ZED_ROW`,
   `ZED_SYMBOL`, `ZED_CUSTOM_*` variables) for running, watching, and re-running tests.
2. Debug adapters (`[debug_adapters.*]`, `[debug_locators.*]`, `get_dap_binary`,
   `dap_config_to_scenario`, `dap_locator_create_scenario`) for breakpoint debugging.
3. Language server integration (`language_server_command`, initialization and workspace
   configuration, `CodeLabel`) for diagnostics, code actions, and editor-side affordances
   such as locator picking and recording triggers.
4. Zed settings (`zed_extension_api::settings`) for user-facing options such as show
   browser, show trace viewer, and default project.
5. Playwright's own UI (trace viewer, codegen browser, inspector) for anything Zed has no
   surface for. The extension launches it; it does not re-render it.

- A VS Code-only surface (Test Explorer tree, webview, status bar item, CodeLens provided by
  the extension host) MUST NOT be emulated through unsupported channels. The mapping either
  uses one of the five primitives above or is `blocked`.
- Mapping decisions MUST be made per capability, not per extension; one capability MAY use
  several primitives.
- When the Zed API gains a primitive that unblocks a `blocked` row, the row MUST be
  re-planned in the next feature cycle.

Rationale: Zed exposes a narrow, well-defined extension surface. Working with it yields an
extension that feels native and passes review; working around it yields fragile code and a
rejected PR.

### IV. Playwright CLI Is the Runtime, Never Reimplemented

The extension orchestrates the user's installed Playwright; it MUST NOT reimplement test
discovery, execution, reporting, tracing, recording, or locator logic.

- All test operations MUST go through the project-local Playwright package (`npx playwright`
  or the resolved `node_modules/.bin/playwright`) of the open worktree. The extension MUST
  NOT bundle or pin its own Playwright.
- Supported Playwright versions MUST match upstream: v1.38 or newer. Older versions MUST
  produce a clear, actionable message, not a silent failure.
- Project and config discovery MUST read `playwright.config.*` through Playwright's own
  `--list` and reporter output, never by parsing config files with custom logic.
- Machine-readable output (JSON reporter, `--reporter=json`, trace archives) MUST be preferred
  over scraping human-readable output.
- Interactive upstream features (show browser, record, pick locator, trace viewer) MUST be
  delivered by launching the corresponding Playwright command (`codegen`, `show-trace`,
  `--ui`, `--headed`, `--debug`) with the right flags, and MUST degrade with an explicit
  message when the Zed side cannot host the interaction.

Rationale: Playwright evolves fast and its CLI is the stable contract. Delegating keeps the
extension small, correct across versions, and auditable in review.

### V. Verified Behavior Before Completion

No capability is reported as done, and no parity row moves to `full` or `partial`, without
evidence.

- Pure Rust logic (argument construction, config resolution, version checks, output parsing)
  MUST have unit tests that are written before or alongside the implementation and MUST pass
  with `cargo test` on the host target.
- Every feature MUST be exercised end to end at least once as a dev extension
  (`zed: install dev extension`) against the sample Playwright project in `fixtures/`, and
  the checked behavior MUST be recorded in the feature's `quickstart.md` as reproducible
  steps.
- The WASM build (`cargo build --target wasm32-wasip2`) MUST succeed on every change that
  touches Rust code. A green host build alone is not sufficient.
- Claims of completion MUST quote the command run and its outcome. A skipped verification
  MUST be stated as skipped, with the reason.
- Regressions found in review reopen the parity row; they are not deferred silently.

Rationale: Zed extension bugs surface only inside Zed, often as silent failures in the log.
Evidence-based completion is the only way to keep the parity matrix honest.

## Technical Constraints

- Language and toolchain: Rust stable, `wasm32-wasip2` target, latest compatible
  `zed_extension_api` (0.7.x at ratification) chosen from the crate's Zed-compatibility table.
  `cfg` directives and `std::env::var` MUST NOT be used for platform or environment detection;
  use `current_platform()` and `Worktree` methods instead.
- Repository layout: `extension.toml` and `LICENSE` at the repository root, `Cargo.toml` with
  `[lib] crate-type = ["cdylib"]`, `src/lib.rs` as the single `register_extension!` site,
  `debug_adapter_schemas/` when a debug adapter is declared, `fixtures/` holding a minimal
  Playwright project for manual verification, `docs/parity.md` as the parity matrix.
- Dependencies: only crates that compile to WASI. Network access only through
  `zed_extension_api::http_client` and the download helpers. No filesystem access outside the
  extension working directory and the worktree.
- Languages and grammars: the extension MUST NOT redefine TypeScript or JavaScript. It
  attaches to Zed's bundled languages and MUST NOT ship a competing grammar.
- Logging: use `println!`/`eprintln!` sparingly; output lands in the Zed log. Every error
  returned to Zed MUST include the failing command and a hint for the user.
- Versioning of the extension: semantic versioning in `extension.toml`. A `blocked` to
  `full` parity change or a new upstream capability is MINOR; a mapping change that alters
  user-facing commands or settings names is MAJOR; fixes are PATCH.

## Development Workflow and Quality Gates

- Work flows through Spec Kit: `/speckit-specify` for each upstream capability or coherent
  group, `/speckit-plan` to pick the Zed primitive mapping and record it in the parity matrix,
  `/speckit-tasks` and `/speckit-implement` to build it, `/speckit-analyze` before merge.
- Every plan MUST contain a "Constitution Check" that answers, per principle, how the feature
  complies or why an exception is justified. Unjustified exceptions block the plan.
- Pull requests MUST include: the parity matrix diff, `cargo test` and WASM build output,
  dev-extension verification steps from `quickstart.md`, and a license and prerequisite
  self-check against the Zed publishing rules.
- Code review MUST reject: API workarounds, bundled binaries, custom reimplementations of
  Playwright behavior, non-English user text, and features without an upstream reference.
- Releases MUST bump `extension.toml`, tag the repository, and open or update the
  `zed-industries/extensions` PR per the publishing guide. The release is complete only when
  the registry entry is merged.
- Simplicity rule: start with the smallest primitive that reaches parity; add a language
  server or debug adapter only when a parity row needs it and the plan records why.

## Governance

This constitution supersedes any other practice, template default, or habit in this project.
When a Zed publishing rule and this document disagree, the Zed rule wins and this document
MUST be amended to match in the same change.

- Amendment procedure: open a PR that edits this file, states the version bump type and
  reason in the Sync Impact Report comment, and updates any dependent template, plan, or
  parity row affected. The author of the amendment is responsible for propagation.
- Versioning policy: MAJOR for removing or redefining a principle in a backward-incompatible
  way; MINOR for adding a principle or section or materially expanding guidance; PATCH for
  clarifications, wording, and typo fixes.
- Compliance review: every `/speckit-plan` run performs the Constitution Check; every PR
  review verifies the gates in "Development Workflow and Quality Gates"; complexity beyond
  the simplest compliant mapping MUST be justified in the plan's Complexity Tracking table.
- Runtime development guidance for agents lives in `CLAUDE.md` and MUST NOT contradict this
  file.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
