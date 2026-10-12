# Research: Project Scaffold and Run Test at Cursor

All findings verified on 2026-10-12 against zed-industries/zed `main`, Zed stable v1.23.2
(released 2026-10-07), `zed_extension_api` 0.7.0 on crates.io, Zed docs, and Playwright docs.

## R1. Extension API version and toolchain

- **Decision**: `zed_extension_api = "0.7.0"`, target `wasm32-wasip2`, `schema_version = 1`.
- **Rationale**: `crates/extension_host/src/wasm_host/wit.rs` caps Stable and Preview builds at
  `since_v0_6_0::MAX_VERSION`, which is `0.7.0`. Version `0.8.0` exists on `main` but only
  Dev and Nightly accept it. The README compatibility table on `main` is stale (stops at
  0.6.0 / Zed 0.192) and must not be used.
- **Alternatives considered**: 0.8.0 (rejected: stable users cannot load it); 0.6.0
  (rejected: no reason to forgo 0.7.0 fixes, same host range).
- **Local gaps**: `rustup target add wasm32-wasip2` needed; Zed not on PATH in this WSL
  environment, manual verification happens in a Zed install the developer can reach.

## R2. How "run test at cursor" can surface in Zed

Mapping of the upstream capability onto constitution Principle III primitives, in preference
order:

| Primitive | Verdict | Evidence |
|-----------|---------|----------|
| 1. Tasks / runnables | **blocked for extension-driven runs**, usable as a user recipe | `ExtensionManifest` has no task field. Extension languages may ship `tasks.json` (`extension_host.rs` loads `TaskTemplates::FILE_NAME` per language dir), but `register_extension_language` refuses any name already registered by a bundled language ("not registering extension language ... already registered outside of extensions"), and TypeScript, TSX and JavaScript are bundled. Bundled `typescript/runnables.scm` already tags `test(...)`, `test.describe(...)`, `.only`, `.skip` calls with `js-test`, so a user-level task template tagged `js-test` using `$ZED_FILE:$ZED_ROW` binds to the gutter run button today. |
| 2. Debug adapter / locator | not applicable here | Locators convert existing tasks into debug scenarios; no tasks exist. Deferred to the debugging feature. |
| 3. Language server | **chosen** | `[language_servers.<id>]` with `languages = ["TypeScript", "TSX", "JavaScript"]` attaches a server to bundled languages (same pattern as published tool extensions). `language_server_command` is the one hook Zed calls for TypeScript files. The server is a normal Node process and can spawn Playwright. Zed supports code actions with commands (`workspace/executeCommand`, `lsp_store.rs`), code lenses rendered as block lines above code or in the code-action menu (`editor/src/code_lens.rs`, setting `code_lens`: `off` by default, `on`, `menu`), `window/showMessage` rendered as a language-server prompt notification, `$/progress` and `publishDiagnostics`. |
| 4. Settings | later | Not needed for this feature. |
| 5. Playwright's own UI | later | `--ui`, `--headed`, trace viewer are separate upstream rows. |

- **Decision**: language server (primitive 3) for detection, affordances, execution and
  reporting. Document the `tasks.json` recipe (primitive 1) in README as `zed-only`, because it
  is the only way to get terminal-panel output and it costs nothing.
- **Known limit recorded in parity matrix**: `ClientCommand::ScheduleTask` (an LSP command that
  becomes a Zed task) is implemented only by Zed's bundled Go and Rust adapters;
  `crates/language_extension/src/extension_lsp_adapter.rs` does not override `client_command`,
  so extension servers cannot spawn Zed tasks. Terminal output for extension-driven runs is
  therefore `blocked`.

## R3. Where detection lives and what happens in non-Playwright workspaces

- **Decision**: the Rust shell always starts the server for every TypeScript, TSX or JavaScript
  worktree. The server performs detection and, when no Playwright config or package is found,
  advertises no code actions or lenses and stays idle. The Rust shell does not inspect the
  worktree.
- **Rationale**: returning `Err` from `language_server_command` makes Zed show a failed
  "Playwright" server in every ordinary TypeScript project, which is worse than an idle
  process. `Worktree::read_text_file` could read the root `package.json`, but monorepos keep
  Playwright in nested packages, so a root check would produce false negatives.
- **Alternatives considered**: root `package.json` pre-check in Rust (rejected: false
  negatives); `playwright.config.*` glob in Rust (rejected: WASM has no directory listing API).

## R4. Server distribution

- **Decision**: publish the server as the npm package `playwright-zed-language-server`
  (name verified free on 2026-10-12). The Rust shell installs it with
  `zed::npm_install_package` into the extension work dir, pins the version it was built
  against, checks `npm_package_installed_version` on each start, and consults
  `npm_package_latest_version` at most once per Zed session. Launch:
  `node <workdir>/node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js --stdio`.
  `node` resolves via `zed::node_binary_path()` with `worktree.which("node")` as fallback.
- **Rationale**: Zed prerequisites forbid bundling a language server; runtime npm install is
  the pattern Zed's own TypeScript extensions use. Capability
  `{ kind = "npm:install", package = "playwright-zed-language-server" }` is the only one needed.
- **Alternatives considered**: GitHub release tarball via `download_file` (rejected: more
  moving parts, same result); running the server from the user's `node_modules` (rejected: it
  is not a user dependency).

## R5. Test discovery and selection

- **Decision**: discover with `playwright test --list --reporter=json -c <config>` (env
  `PLAYWRIGHT_JSON_OUTPUT_FILE` pointing at a temp file so stdout stays clean), cache the
  result per config, and refresh on `didSave` of a `.spec`/`.test` file, any file under the
  config's `testDir`, or the config itself. Select tests by **`<file>:<line>`** where line is
  the 1-based line of the enclosing test or describe title as reported by `--list`.
- **Rationale**: `file:line` is Playwright's own "run tests at a specific line" filter. It
  disambiguates identical titles and is immune to regex-special characters in titles, which
  satisfies spec scenarios 5 and the special-characters edge case. Using `--list` instead of
  tree-sitter keeps discovery inside Playwright (Principle IV).
- **Open point for implementation**: confirm with the fixture that a `test.describe` line
  selects all nested tests. If it does not, fall back to `--grep` with a regex-escaped full
  title path for describe runs only. Record the outcome in `docs/parity.md`.
- **Alternatives considered**: `-g <title>` (rejected: regex escaping, duplicate titles);
  tree-sitter positions from the client (rejected: Zed does not pass symbol context to LSP
  commands).

## R6. Executing a run and reporting inside Zed

- **Decision**: `node <resolved @playwright/test>/cli.js test <file>[:<line>] -c <config>
  --reporter=list,json` with cwd = config directory and `PLAYWRIGHT_JSON_OUTPUT_FILE` = temp
  file. One run at a time per workspace; a new request while one is running cancels the
  running process (SIGTERM, then SIGKILL after 5 s) and starts the new one (spec scenario 6,
  "replaces"). Reporting:
  - `$/progress` begin "Playwright: running <n> test(s)" and end with the summary.
  - `window/showMessage` Info on all pass, Error on any failure, Warning on unsaved-buffer
    notice and on cancellations.
  - `textDocument/publishDiagnostics` with source `playwright` at each failure's
    `error.location` (or the test's own line when absent), severity Error, message = first
    line of the stripped error message plus the test title. Diagnostics for a file are
    cleared at the start of the next run touching that file.
  - `window/logMessage` carries the full `list` reporter output and the exact command line.
- **Rationale**: these are the only LSP channels Zed renders; diagnostics at the failing line
  are the closest analogue to the upstream inline failure decoration.
- **Alternatives considered**: `window/showDocument` to open a results buffer (rejected: no
  `ShowDocument` handler found in `crates/project`); writing a results file into the workspace
  (rejected: FR-015 forbids side effects).

## R7. Playwright resolution and version gate

- **Decision**: from each config file's directory walk upward to the nearest
  `node_modules/@playwright/test/package.json`, read its `version`, and compare against
  `1.38.0` with a minimal semver compare (major, minor, patch, ignore prerelease tags).
  Below the gate: one `window/showMessage` Warning per workspace per session, no actions
  offered for that config. Missing package: treated as "not a Playwright workspace".
- **Rationale**: this is how Node itself resolves the package the config will load; the
  upstream extension supports v1.38+.
- **Alternatives considered**: `playwright --version` subprocess (rejected: slower, same
  answer).

## R8. Fixture project

- **Decision**: `fixtures/sample-project` with `@playwright/test` as devDependency, Chromium
  only, `testDir: tests`, two files: `passing.spec.ts` (two top-level tests, one
  `test.describe` with two tests, two tests titled identically in different describes, one
  title with `(parens) [brackets] "quotes"`), `failing.spec.ts` (one failing expectation and, since convergence task T045, one `test.fixme`).
  No real site: tests use `page.setContent` so they run offline.
- **Rationale**: covers every acceptance scenario and edge case in the spec in under 10 s of
  runtime.

## R9. Extension identity and publishing fit

- **Decision**: id `playwright`, name "Playwright", MIT license at repo root, repository URL
  of this project. The only registry entry containing "playwright" today is
  `mcp-server-playwright`, so the id is free.
- **Risk**: Zed prerequisites ask language-server extensions to suffix `-language-server` or
  `-lsp`. Tool-integration extensions published under plain tool names exist, and this
  extension will add debugger and task capabilities later, so a plain id is proposed. If
  maintainers object during review, rename to `playwright-lsp` before first publication; ids
  cannot change after.

## R10. Unsaved buffers

- **Decision**: the server tracks `didChange` after the last `didSave`/`didOpen` per document.
  When a run targets a dirty document it proceeds on disk content and sends a Warning
  "`<file>` has unsaved changes; running the saved version".
- **Rationale**: the spec allows either behaviour but requires consistency; Zed does not
  auto-save on LSP command execution.

## R11. Code lens visibility

- **Decision**: provide code lenses ("▶ Run test", "▶ Run describe") at every discovered test
  and describe location, and the same operations as code actions at the cursor. README tells
  users to set `"code_lens": "on"` (or `"menu"`) because Zed defaults to `off`.
- **Rationale**: code actions work with zero configuration (ctrl-. then Enter); lenses give
  the one-click upstream feel when enabled.
