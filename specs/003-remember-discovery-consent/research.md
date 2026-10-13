# Research: Remember Discovery Consent per Folder

Verified on 2026-10-13 against zed-industries/zed `main` (`26363aa`, 2026-10-12), the tags
`v0.217.4`, `v0.218.5` and `v0.219.4`, the zed.dev docs page "Zed and trusted worktrees"
(`docs/src/worktree-trust.md`), and the owner's local Zed 1.23.3.

## R1. Does Zed have its own persistent per-folder trust?

- **Finding**: Yes. `crates/project/src/trusted_worktrees.rs` (zed PR #44887, "Introduce
  worktree trust mechanism", merged 2025-12-16) keeps a `TrustedWorktreesStore` that is
  persisted in Zed's database (table `trusted_worktrees` in `db/0-<channel>/db.sqlite`). Docs:
  "all worktrees start in Restricted Mode … Trusting a worktree persists that decision between
  restarts. You can clear all trusted worktrees with the `workspace::ClearTrustedWorktrees`
  command." The title bar shows a warning icon for untrusted worktrees, and
  `workspace::ToggleWorktreeSecurity` opens the trust modal. A parent folder can be trusted
  for all its subfolders. Trust is tracked per host for SSH and WSL remotes.
- **Local evidence**: the owner's `~/.local/share/zed/db/0-stable/db.sqlite` holds one row,
  `/home/radek/repos/personal/playwright-zed`. That parent-level trust covers
  `fixtures/sample-project`, which is why only the extension's own question showed up while
  feature 002 was being verified.
- **Consequence**: the premise of feature 002 ("Zed has no workspace-trust concept", 002
  research R1/R2 and spec Upstream Reference) is out of date. It was already wrong when 002
  was written; 002 did not check Zed's source for it.

## R2. Does Zed's trust gate cover this extension's language server?

- **Finding**: Yes. `LocalLspStore::start_language_server` (`crates/project/src/lsp_store.rs`)
  calls `TrustedWorktrees::can_trust(worktree_store, worktree_id)` for every server. If the
  worktree is not trusted, `get_language_server_binary` waits on a channel until a
  `TrustedWorktreesEvent::Trusted` for that worktree arrives. The wait applies on all three
  binary paths: user `binary.path` setting, fake servers, and the adapter path that extension
  servers use (`adapter.adapter.is_extension()` is not exempt). So
  `language_server_command` in our Rust shell, the npm install, and the Node server all run
  only after the folder is trusted. The docs list "Language servers from being installed and
  spawned" under "What is restricted"; only global servers such as Prettier and Copilot are
  exempt.
- **Per-folder isolation**: `LanguageServerSeed` contains `worktree_id`, so every visible
  directory worktree gets its own server instance, each with its own trust wait.
  `reuse_existing_language_server` returns `None` for visible worktrees; it reuses a running
  server only for invisible (single-file, internal) worktrees, and then sends no new workspace
  folder (`server_id_or_init` returns the existing id without running the closure that calls
  `add_workspace_folder`). Workspace folders are only ever directories inside the server's own
  worktree (`workspace_folder_uri` returns `None` for non-directories).
- **Single-file worktrees**: auto-trusted once any directory worktree on the host is trusted.
  Their server gets `workspaceFolders: []` (Zed passes `Some(pending_workspace_folders)`, which
  stays empty) and `rootUri` = the file's parent directory. Our server currently uses
  `rootUri` only when `workspaceFolders` is `null`/absent, so it discovers nothing there. The
  plan keeps that and adds a rule: a folder that comes from the `rootUri` fallback never counts
  as trusted (spec FR-003).
- **First release**: `v0.217.4` has no `trusted_worktrees.rs`; `v0.218.5` has it and gates
  `start_language_server` (variable `untrusted_worktree_task`); `v0.219.4` and later use
  `wait_until_worktree_trust`. The `v0.218.5` release notes say: "Introduced worktree trust
  mechanism, can be turned off with `"session": { "trust_all_worktrees": true }`." Zed's
  version line later moved to 1.x (owner runs 1.23.3).
- **Decision**: the gate is present on Zed **0.218.0 and newer**, any release channel.

## R3. Can a repository bypass Zed's trust?

- **Finding**: No, not through settings. `trust_all_worktrees` lives in
  `SessionSettingsContent`, reached through `SettingsContent.session`
  (`crates/settings_content/src/settings_content.rs`), not through `ProjectSettingsContent`.
  A project's `.zed/settings.json` therefore cannot set it, and Restricted Mode does not even
  parse project settings until the folder is trusted (docs, "What is restricted"). Copies and
  moves are new paths and are not trusted (`can_trust` compares absolute paths and trusted
  parents).
- **User opt-out**: `session.trust_all_worktrees: true` in user settings makes `can_trust`
  return `true` for everything. Auto-trust is not persisted. This is the equivalent of turning
  off `security.workspace.trust.enabled` in VS Code, where the upstream Playwright extension
  then runs everywhere too.
- **Decision**: rely on Zed's trust and document the opt-out in the README; no extra check.

## R4. How does the server know it was started by a Zed with the gate?

- **Finding**: Zed sends `initialize.params.clientInfo` (`crates/lsp/src/lsp.rs`):
  `name` = `ReleaseChannel::display_name()`, one of `Zed`, `Zed Preview`, `Zed Nightly`,
  `Zed Dev`; `version` = `AppVersion::global(cx).to_string()`, a semver string that may carry
  build metadata (`crates/release_channel/src/lib.rs` builds it with
  `semver::BuildMetadata`), e.g. `1.23.3` or `1.23.3+stable.<n>`.
- **Decision**: pure function `editorHasTrustGate(clientInfo)` in a new
  `server/src/trust.ts`: `true` exactly when `name` matches `^Zed( (Preview|Nightly|Dev))?$`
  and the leading `major.minor.patch` of `version` is `>= 0.218.0`. Missing `clientInfo`,
  missing or unparsable `version`, or any other name returns `false`. Computed once in
  `onInitialize`.
- **Rationale**: no extension API exposes worktree trust (`zed_extension_api` 0.7 has no trust
  or session settings accessor), and the server cannot query Zed. The server is only ever
  running if Zed decided to start it, so "started by Zed >= 0.218" implies "the folder is
  trusted, or the user trusts everything".
- **Alternatives**: the Rust shell passes a flag through `initialization_options` (rejected:
  the shell cannot read trust either, the WASM side sees the same facts, and a flag in user
  `lsp.playwright.initialization_options` could be confused with the real signal; clientInfo
  is set by Zed itself); reading Zed's database (rejected: outside the designated environment,
  constitution II); checking the version in the Rust shell with `zed::...` (no API for the
  host version in 0.7).

## R5. Spoofed or unusual clients

- **Finding**: Any process that starts our server can claim to be Zed. Such a process already
  controls what runs, so the claim grants nothing it did not have. The gate protects against
  repositories, not against the launching program.
- **Decision**: no extra hardening; the spec records this in Assumptions.

## R6. Fallback behaviour and tests

- **Decision**: the feature 002 code path stays untouched for `editorHasTrustGate === false`.
  The integration `TestClient` sends no `clientInfo` today, so all feature 002 tests keep
  exercising the fallback (SC-005). `StartOptions` gains an optional `clientInfo`; new
  integration tests start the server as `{ name: 'Zed', version: '1.23.3' }` and assert: no
  `window/showMessageRequest`, discovery runs, lenses appear, `playwright/status` reports
  `discoverySource: 'editor-trust'`; with `version: '0.217.4'` the question is asked. A test
  with `workspaceFolders` absent and only `rootUri` under a Zed `clientInfo` asserts that the
  question is still asked (FR-003).
- **Load-marker check**: the feature 002 marker project (config writes a file when loaded)
  is reused to prove SC-002 with an old-Zed `clientInfo`.

## R7. What Zed itself cannot be tested for here

- **Finding**: the real trust gate lives in Zed; the server's automated suite can only verify
  the server's reaction to `clientInfo`. That Zed holds the server back in an untrusted
  folder (spec story 1 scenario 3, story 2, SC-003) can only be verified manually in Zed.
- **Decision**: quickstart scenarios run in a fresh, never-trusted folder outside the repo
  (for example a copy of the sample project under `/tmp`), with a load-marker config and a
  `.zed/settings.json` that sets `session.trust_all_worktrees: true`, to observe Restricted
  Mode, then trust, then restart.

## R8. Dev containers and collaboration skip Zed's trust gate

- **Finding**: `crates/project/src/trusted_worktrees.rs` (module docs, line 9): "Docker and
  Collab remotes do not employ trust mechanism, as manage that themselves." In a dev
  container, Zed starts language servers inside the container without a trust prompt. Zed's
  docs (`docs/src/dev-containers.md`) show that a container is entered only after an explicit
  user action: the "Open in Container" prompt or "Connect Dev Container". Building the
  container already runs code that the repository defines (`devcontainer.json`, Dockerfile).
  Collab guests do not run language servers; the host's own trust applies.
- **Decision**: accept. Inside a dev container the server skips its question like any Zed
  0.218+ session. The user has already chosen to run the repository's container definition,
  and discovery runs inside that container, not on the host. The README states this.
- **Alternatives**: detecting a container (`/.dockerenv`, `REMOTE_CONTAINERS`) and keeping
  the question there (rejected: heuristic and easy to miss; it protects only code that already
  runs inside a container the user chose to start; can be added later if users ask).
