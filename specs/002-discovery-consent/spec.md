# Feature Specification: Ask Before Running Workspace Code on Open

**Feature Branch**: `002-discovery-consent`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Ask before running workspace code on open: when the extension finds a Playwright configuration in a workspace folder, it must ask the developer once per workspace per session whether to run Playwright test discovery, because discovery executes the workspace's playwright.config and test files. Until the developer agrees, no Playwright process is started, no code lenses or run actions are offered, and any run command explains that discovery is pending. Agreeing runs discovery immediately and enables everything as today; declining keeps the extension idle for that workspace for the rest of the session, with a way to trigger discovery later. This mirrors the protection VS Code Workspace Trust gives the upstream extension, which Zed does not provide."

## Upstream Reference

This feature hardens the **Playwright project detection** capability delivered in feature 001.
In VS Code, the upstream Playwright extension (https://github.com/microsoft/playwright-vscode)
discovers tests as soon as a workspace is opened, and that discovery loads the workspace's
Playwright configuration and test files, which is arbitrary code from the opened folder. VS
Code protects users from this through Workspace Trust: an untrusted folder opens in restricted
mode and extensions do not execute its code until the user trusts the folder.

Zed has no workspace-trust concept, so feature 001 currently runs discovery the moment a
folder with a Playwright configuration is opened. This feature adds the missing gate on the
Zed side: a per-workspace, per-session question before any workspace code runs. It has no
direct upstream counterpart and is recorded in the parity matrix as a `zed-only` row.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nothing runs until I say so (Priority: P1)

A developer clones a repository they do not fully trust and opens it in Zed. The extension
notices a Playwright configuration but, instead of running anything, asks whether it may run
test discovery and says plainly that discovery executes the workspace's configuration and test
files. Until the developer answers, nothing from the folder is executed and no Playwright run
affordances appear.

**Why this priority**: This is the security property the feature exists for. Without it,
opening a hostile repository executes its code with the developer's privileges.

**Independent Test**: Open a workspace whose Playwright configuration performs an observable
side effect when loaded (for example, it writes a marker file). Confirm the marker does not
appear and no run lenses or actions are offered until the question is answered with "yes".

**Acceptance Scenarios**:

1. **Given** a folder containing a Playwright configuration, **When** the developer opens it,
   **Then** one question is shown for that folder naming the folder and stating that
   discovery executes the workspace's configuration and test files, with a choice to run
   discovery or not now.
2. **Given** the question has not been answered, **When** the developer opens a test file,
   **Then** no run lenses and no run actions are offered.
3. **Given** the question has not been answered, **When** the developer triggers any run
   command, **Then** no Playwright process starts and a message explains that test discovery
   has not been enabled for this workspace and how to enable it.
4. **Given** a folder with no Playwright configuration, **When** the developer opens it,
   **Then** no question is shown and the extension stays silent as before.

---

### User Story 2 - Agreeing enables everything as before (Priority: P1)

A developer who trusts the project answers "yes". Discovery runs immediately, the run lenses
and actions appear, and every behaviour from feature 001 (runs, re-discovery on save,
re-run last) works without any further question during that editing session.

**Why this priority**: The feature must not degrade the daily workflow for trusted projects;
one answer per session is the whole cost.

**Independent Test**: Open the sample project, answer "yes", and run quickstart scenarios 2,
5 and 11 from feature 001; all pass with no additional prompt.

**Acceptance Scenarios**:

1. **Given** the question is shown, **When** the developer chooses to run discovery, **Then**
   discovery starts at once and run lenses and actions appear in test files as in feature 001.
2. **Given** discovery was enabled for a workspace, **When** the developer saves a test file
   or a configuration file, **Then** re-discovery runs without asking again.
3. **Given** discovery was enabled for a workspace, **When** a second configuration file is
   found in that workspace later in the session, **Then** it is discovered without asking
   again.
4. **Given** a developer enabled discovery in one editing session, **When** Zed is restarted
   and the folder reopened, **Then** the question is asked again.

---

### User Story 3 - Declining keeps the extension idle, with a way back (Priority: P2)

A developer answers "not now" or dismisses the question. The extension stays idle for that
workspace for the rest of the session: nothing executes, nothing is offered, and no further
questions appear on their own. If the developer changes their mind, an action in the editor
enables discovery for that workspace.

**Why this priority**: Declining must be safe and quiet, but the developer should not have to
restart Zed to change their mind.

**Independent Test**: Open the sample project, answer "not now", confirm no lenses or runs
are available and no further prompts appear while editing and saving; then use the enable
action and confirm discovery runs and lenses appear.

**Acceptance Scenarios**:

1. **Given** the developer declined, **When** they edit and save test files, **Then** nothing
   is executed and no question is shown again on its own.
2. **Given** the developer declined, **When** they trigger a run command, **Then** a message
   explains that discovery is disabled for this workspace and names the action that enables
   it.
3. **Given** the developer declined, **When** they use the enable action from a file in that
   workspace, **Then** discovery runs and the workspace behaves as if they had agreed.
4. **Given** the question was dismissed without a choice, **When** the developer looks for
   the enable action, **Then** it is available exactly as after declining.

---

### Edge Cases

- The workspace has several root folders with Playwright. One question per folder; each
  folder's answer is independent.
- One root folder contains several Playwright configurations (monorepo). One question covers
  the whole folder.
- The installed Playwright is older than the supported version. The version warning from
  feature 001 is still shown, because reading the installed version executes no workspace
  code; no discovery question is asked for that configuration.
- The editor cannot present a question with choices. The extension stays idle, shows a plain
  message that explains the enable action, and offers that action.
- The question is dismissed without a choice. Treated as "not now".
- A run command arrives while the question is still open. The command is refused with the
  pending-discovery message; it does not count as an answer.
- Discovery was enabled and later fails (broken configuration). The existing discovery-failed
  warning applies; the answer stays "enabled" for the session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST NOT start any Playwright process for a workspace folder
  before the developer has explicitly agreed to test discovery for that folder in the current
  editing session.
- **FR-002**: When a Playwright configuration with a supported Playwright version is found in
  a workspace folder, the extension MUST ask the developer exactly once per folder per
  session whether to run test discovery. The question MUST name the folder and MUST state
  that discovery executes the workspace's Playwright configuration and test files. It MUST
  offer at least the choices "run discovery" and "not now".
- **FR-003**: Until the developer agrees, the extension MUST offer no run lenses and no run
  actions for files in that folder, and every run command targeting that folder MUST be
  refused with a message that says discovery is not enabled and names the enable action.
- **FR-004**: When the developer agrees, discovery MUST start immediately and all feature 001
  behaviour for that folder MUST be available for the rest of the session without further
  questions, including re-discovery on save and discovery of configurations found later.
- **FR-005**: When the developer declines or dismisses the question, the extension MUST stay
  idle for that folder for the rest of the session and MUST NOT ask again on its own.
- **FR-006**: The extension MUST offer an "enable test discovery" action from the editor for
  any file inside a folder whose question was declined, dismissed, or could not be shown. Using
  it MUST have the same effect as agreeing.
- **FR-007**: The decision MUST be scoped to the editing session; reopening Zed MUST ask again.
- **FR-008**: Reading the installed Playwright version and locating configuration files MUST
  NOT execute workspace code, so the unsupported-version warning of feature 001 remains
  available before any agreement.
- **FR-009**: All text shown by this feature MUST be in English and MUST avoid implying that
  the workspace is malicious; it informs, it does not accuse.
- **FR-010**: The parity matrix MUST gain a `zed-only` row for this gate that names VS Code
  Workspace Trust as the upstream mechanism it substitutes for.
- **FR-011**: The feature 001 README and quickstart MUST describe the question, the enable
  action, and the per-session scope.

### Key Entities

- **Workspace** (from feature 001): gains a discovery decision with the states `pending`
  (not yet answered), `enabled` (agreed, or enabled later through the action), and
  `declined` (declined, dismissed, or could not be asked).
- **Discovery Question**: the one-time prompt per workspace folder per session, carrying the
  folder name and the explanation; answered by a choice or by dismissal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In an automated check with a configuration that records when it is loaded,
  opening the workspace produces zero executions before agreement in 100% of runs.
- **SC-002**: After agreeing, the sample project shows run lenses and completes a run with the
  same outcomes as feature 001 scenarios 2, 5 and 11, with no additional prompt.
- **SC-003**: A developer sees at most one question per workspace folder per session; saving
  files, declining, or dismissing produces no further questions.
- **SC-004**: A developer who declined can enable discovery with a single editor action, and
  lenses appear within the same time discovery took in feature 001.
- **SC-005**: Opening a folder without Playwright still produces no question, no run
  affordances, and no errors attributable to the extension.

## Assumptions

- "Session" means the lifetime of the extension's language server for that workspace; closing
  the folder or restarting Zed starts a new session. Persisting the decision across sessions
  is deliberately out of scope because the extension has no designated durable storage and
  the workspace must not be written to.
- A single question per workspace folder is enough; per-configuration questions would add
  noise in monorepos without adding safety, since one folder is one trust boundary.
- A user-level setting to skip the question for every workspace is out of scope here and may
  be added later as a Zed settings feature; it would be a conscious opt-out.
- The enable action is offered through the same editor surface as the run actions of
  feature 001, so it is discoverable where developers already look.
- Locating configuration files and reading the installed version remain safe because they
  only read file names and a package manifest; they never load the configuration.
