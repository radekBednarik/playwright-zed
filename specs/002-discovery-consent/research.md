# Research: Ask Before Running Workspace Code on Open

Verified on 2026-10-12 against zed-industries/zed `main` and `vscode-languageserver` 9.x.

## R1. How Zed renders `window/showMessageRequest` and what it returns

- **Finding**: `crates/project/src/lsp_store.rs` handles `ShowMessageRequest` by emitting a
  `LanguageServerPrompt` with the message, level and `params.actions`; it awaits a channel
  and returns `Ok(Some(action))` when the user clicks a button, or `Ok(None)` if the channel
  closes. `crates/workspace/src/notifications.rs` renders one large button per action and
  responds only from a button click. Closing the notification with the header "x" (or
  shift-click suppress) emits a dismiss event and **never responds**, so the server's request
  stays pending for the life of the session. The message is rendered as Markdown and may
  span lines. `MessageType.Warning` maps to `PromptLevel::Warning`.
- **Decision**: Send the question with `connection.window.showWarningMessage(message,
  { title: 'Run discovery' }, { title: 'Not now' })` and treat the returned promise as an
  event, not a gate: the workspace is `pending` until it resolves. A dismissed prompt leaves
  the workspace `pending`, which behaves exactly like `declined` (idle, enable action
  available). If the request rejects (client without `window.showMessage` support), mark
  the workspace `declined`, send a plain warning naming the enable action.
- **Alternatives**: `window/showDocument` to a consent file (rejected: no handler in Zed);
  a Zed setting as the only switch (rejected: not per-session, no prompt; may come later as an
  opt-out); blocking discovery on the promise with a timeout (rejected: a timeout would turn a
  forgotten notification into a silent decline, which is the same as `pending` anyway).

## R2. Decision state and where it lives

- **Decision**: `Workspace.discovery: 'pending' | 'enabled' | 'declined'`, initial
  `pending`, set per workspace folder when the first supported config is found. `pending` and
  `declined` are both idle; they differ only in the message wording ("has not been enabled"
  versus "is disabled"). `enabled` is terminal for the session. Transitions:
  `pending → enabled` (button "Run discovery" or `playwright.enableDiscovery`),
  `pending → declined` (button "Not now" or request failure),
  `declined → enabled` (`playwright.enableDiscovery`).
- **Rationale**: Mirrors the spec's entity; one field keeps `playwright/status` and the
  tests simple.
- **Alternatives**: Per-config decision (rejected: one folder is one trust boundary, spec
  assumption); persisted decision (rejected: out of scope, no designated storage).

## R3. Proving that nothing executes before consent

- **Decision**: A temp project in the integration suite copies the fixture config and
  prepends `require('node:fs').writeFileSync(process.env.PW_ZED_MARKER, 'loaded')` (via a
  `.ts` config that imports `node:fs`), symlinks the fixture's `node_modules`, and the test
  asserts the marker file does not exist until "Run discovery" is answered, then exists after.
  `playwright/status` exposes `discovery` so tests and troubleshooting can read the state.
- **Rationale**: SC-001 asks for an observable execution, not an inference from logs.
- **Alternatives**: Spying on `spawn` in-process (rejected: the server runs as a child
  process in integration tests).

## R4. Keeping feature 001 tests green

- **Decision**: `TestClient` answers `window/showMessageRequest` automatically with the
  first action whose title is "Run discovery" unless the test passes `{ answer: 'Not now' |
  null }`; `null` leaves the request unanswered to model dismissal. `waitForDiscovery()`
  keeps waiting for `workspace/codeLens/refresh`.
- **Rationale**: Existing tests describe post-consent behaviour; the default answer keeps
  them valid without edits beyond the helper.
