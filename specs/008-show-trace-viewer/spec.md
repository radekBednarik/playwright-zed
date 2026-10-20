# Feature Specification: Show Trace Viewer

**Feature Branch**: `008-show-trace-viewer`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Let's implement feature Show trace viewer from parity table @docs/parity.md"

## Upstream Reference

This feature mirrors the **Show trace viewer** capability of the upstream extension
(https://github.com/microsoft/playwright-vscode), the `not-started` row of that name in
`docs/parity.md`.

Upstream UX (verified against upstream `main`, extension 1.1.20, on 2026-10-20): the README
says "Check the 'show trace viewer' checkbox to see a full trace of your test." The checkbox
sits in the Playwright settings view of VS Code's Test Explorer, next to "Show browser"; it is
backed by the setting `playwright.showTrace` ("Show Trace Viewer", default off) and by the
command "Toggle Playwright Trace Viewer". While the setting is on, every run started by the
extension records a full trace for each test, overriding the project's own trace
configuration (debug runs never record; "Show browser" wins and turns recording off). Before
the tests start, the extension launches Playwright's own trace viewer application, one
long-lived window per configuration, and keeps it open across runs. When a single test was
run, the viewer shows that test's trace as soon as the test starts and replaces it with the
final trace when the test ends; after a run of several tests, the developer selects a test in
the Test Explorer tree and the viewer shows that test's trace. Turning the setting off closes
the viewer. The feature needs Playwright 1.35 or newer; an older Playwright gets a warning
naming the required version.

Zed UX: a developer turns "Show trace viewer" on from inside the editor, in the same place
the Playwright project picker lives, or sets a default for a folder in the editor's settings
under the upstream name. From then on, runs started from the editor record traces. Running a
single test opens Playwright's trace viewer window with that test's trace: the viewer may
follow the test while it runs, and shows the final trace once the test finishes; later
single-test runs replace the trace in the same window. After running a
whole file, the developer puts the cursor on a test and asks for its trace, which is Zed's
substitute for selecting a test in the Test Explorer tree. Turning the option off closes the
viewer and leaves the project's own trace configuration alone again. Zed renders nothing of
the trace itself; the viewer is Playwright's application, launched by the extension.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the trace of the test I just ran (Priority: P1)

A developer debugging a failing test wants to see what the browser did, step by step, with
screenshots, network and console. They turn "Show trace viewer" on, run the test from its
line, and the trace viewer opens showing that run.

**Why this priority**: This is the capability itself and the whole value of the parity row: a
single click to a full trace, without editing the Playwright configuration or finding the
trace file by hand.

**Independent Test**: In the sample project, turn the option on from a spec file, run one test
at the cursor, and confirm the trace viewer window opens with that test's trace within a few
seconds of the test finishing. Run a second test and confirm the same window now shows the
second trace.

**Acceptance Scenarios**:

1. **Given** "Show trace viewer" is off and a spec file of the sample project is open,
   **When** the developer turns it on, **Then** the editor confirms the new state and the
   option reads as on the next time the developer looks at it.
2. **Given** "Show trace viewer" is on, **When** the developer runs one test at the cursor,
   **Then** the run records a trace for that test and, once the test finishes, Playwright's
   trace viewer shows it, while pass/fail reporting, diagnostics, step marks and run output
   behave as before.
3. **Given** the trace viewer is open from a previous run, **When** the developer runs
   another single test, **Then** the same viewer window shows the new trace instead of a
   second window appearing.
4. **Given** "Show trace viewer" is on and the developer closed the viewer window by hand,
   **When** the developer runs a single test, **Then** the viewer opens again with the new
   trace.
5. **Given** "Show trace viewer" is on and the test is selected in two projects, **When** the
   developer runs it at the cursor, **Then** both results carry a trace, the viewer shows
   the trace of the result that finished last, and the run's messages name the project of
   each result as they do today.

---

### User Story 2 - Open the trace of one test after running several (Priority: P2)

After running a whole file, a developer wants to inspect the trace of one particular test,
typically the one that failed. They put the cursor on it and ask for its trace.

**Why this priority**: Upstream reaches this through the Test Explorer tree, which Zed does
not have. Without a substitute, the feature would only cover single-test runs and file runs
would record traces nobody can reach from the editor.

**Independent Test**: With the option on, run the sample spec file, place the cursor inside a
test that ran, choose the trace action, and confirm the viewer shows that test's trace.
Repeat for a second test and confirm the viewer switches.

**Acceptance Scenarios**:

1. **Given** "Show trace viewer" is on and the file was just run, **When** the developer puts
   the cursor inside a test that ran and chooses "Show trace", **Then** the viewer shows
   the trace of that test from that run.
2. **Given** the cursor is inside a test that was not part of the last run, or the last run
   produced no trace for it (for example it was skipped), **When** the developer chooses
   "Show trace", **Then** a message names the test and says no trace is available for it,
   and the viewer is left as it was.
3. **Given** "Show trace viewer" is off, **When** the developer looks for "Show trace",
   **Then** it is not offered, so the menu stays as it is today.

---

### User Story 3 - Turn it off, and keep my choice (Priority: P3)

A developer who finished investigating turns the option off, expects the viewer to go away
and runs to be as fast as before, and expects the on/off state to be remembered the next day,
on the same machine, like their project selection is. A team can set a default for a folder.

**Why this priority**: It completes the upstream behaviour (the toggle, the close, persistence
in editor state) but a developer could live without it for a while by leaving the option on.

**Independent Test**: Turn the option on, quit and restart the editor, confirm it is still on.
Turn it off, confirm the viewer closes and the next run uses the project's own trace
configuration. Set the folder default in the editor settings and confirm it applies in a
fresh state.

**Acceptance Scenarios**:

1. **Given** "Show trace viewer" is on and the viewer is open, **When** the developer turns
   it off, **Then** the viewer closes, the editor confirms the change, and the next run
   records traces only as the project's own configuration says.
2. **Given** the developer turned the option on, **When** the editor is restarted on the same
   machine, **Then** the option is still on without any action.
3. **Given** the developer has never touched the option, **When** a folder default for it is
   present in the editor settings, **Then** the default applies, a notification says the option is on from the settings
   when that is the case, and a later explicit choice wins over the default.
4. **Given** the option is turned off while a run is in progress, **When** the run finishes,
   **Then** the run completes normally and no viewer opens.

---

### Edge Cases

- The workspace Playwright is older than the trace viewer feature requires: the existing
  version message applies (the project's minimum of 1.38 already exceeds upstream's 1.35
  gate), so no extra check is needed; this is recorded, not built.
- The trace viewer cannot start (no browser installed for it, missing display, command
  fails): an error message quotes the command and the reason, the option stays on, and the
  run's results are unaffected.
- The viewer exits on its own (crash, closed by the developer): the extension forgets it and
  starts a fresh one at the next moment a trace is to be shown; it never restarts it on its
  own without a trace to show.
- The run is cancelled or the test fails before the browser opened: whatever trace Playwright
  attached to the result is shown; when there is none, the "no trace available" message is
  used.
- Two Playwright configurations in one workspace: traces are shown through a viewer started
  with the Playwright of the configuration that owns the test.
- The project's own configuration already records traces: while the option is on, recording
  is forced on for every test; while it is off, the project's configuration is left untouched
  and existing trace files are not opened automatically.
- The option is turned on while a run is already in progress: that run is unaffected; the
  next run records traces.
- Trace files are written where Playwright writes its artifacts and are managed by Playwright;
  the extension never deletes, moves or copies them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST offer a "Show trace viewer" on/off choice, off by default,
  reachable from any served spec file inside the editor in the same place as the project
  picker, and MUST accept a folder or user default from the editor settings under the
  upstream setting name.
- **FR-002**: While the option is on, every run started from the editor MUST record a full
  trace for every test it runs, overriding the project's own trace configuration. While it is
  off, runs MUST NOT change the project's trace configuration in any way.
- **FR-003**: While the option is on, a run of a single test MUST show that test's trace in
  Playwright's trace viewer once the test finishes, and MAY follow the test in the viewer
  while it is still running, as upstream does; an already open viewer MUST show the new
  trace in place instead of a second window opening.
- **FR-004**: The viewer MUST be Playwright's own trace viewer, launched through the
  workspace's Playwright installation of the configuration that owns the test. The extension
  MUST NOT bundle, re-render or reimplement any part of it.
- **FR-005**: One viewer per configuration MUST be kept open across runs for as long as the
  option is on; a viewer the developer closed MUST be reopened the next time a trace is to
  be shown, and never before.
- **FR-006**: While the option is on, the developer MUST be able to open the trace of the
  test under the cursor from the most recent run that included it, in one action from the
  test's location. When that run has no trace for the test, a message MUST name the test and
  the reason, and the viewer MUST be left unchanged.
- **FR-007**: Turning the option off MUST close the viewer, and runs started afterwards MUST
  record traces only as the project's own configuration says.
- **FR-008**: Every change of the option MUST be confirmed with a notification naming the new
  state (the editor caches its action menu per cursor position, as recorded for the project
  picker).
- **FR-009**: The developer's explicit choice MUST be remembered per user across editor
  sessions on the same machine, in the same way and place as the project selection; the
  settings default applies only until a choice is made. The source that applied MUST be
  written to the language server log at every resolution, and a notification MUST say so
  when a settings default turns the option on.
- **FR-010**: When a trace cannot be shown (viewer fails to start, exits early, no trace for
  the test), the extension MUST show one actionable message naming the command or test and
  the reason, both after a single-test run that was expected to show a trace automatically
  and after an explicit request from the cursor; the run's pass/fail result, diagnostics,
  step marks and run output MUST be unaffected.
- **FR-011**: With the option off, the commands, arguments and results of runs MUST be
  identical to today's, so nothing changes for developers who never turn it on.
- **FR-012**: The feature MUST be verified end to end in the sample project, and the "Show
  trace viewer" row of `docs/parity.md` MUST record the status, the primitive and every
  difference from upstream (at least: no Test Explorer tree, so trace selection is an action
  at the cursor; "Show browser" interaction deferred to that feature).

### Key Entities

- **Trace viewer preference**: the on/off state of "Show trace viewer" for the developer,
  with its source (explicit choice, settings default, or built-in default) and the time of
  the last explicit change; remembered per user, like the project selection.
- **Trace**: the recording Playwright produces for one test result (one per project the test
  ran in), located where Playwright writes its artifacts and attached to the result; owned
  and cleaned up by Playwright.
- **Viewer session**: one running trace viewer per Playwright configuration, with the trace
  it currently shows; opened when a trace is to be shown, replaced in place, closed when the
  option is turned off or the session ends.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from the option off, a developer reaches a visible trace of a test
  with two actions (turn on, run at cursor), and the trace appears within 10 seconds of the
  test finishing in the sample project.
- **SC-002**: After a file run, the trace of any test that ran is reachable with one action
  from the test's line, and switching to another test's trace takes one more action.
- **SC-003**: With the option off, 100% of the run commands and results produced by the
  automated suite are unchanged from before this feature.
- **SC-004**: The on/off choice survives an editor restart in 100% of attempts on the same
  machine, and a folder default applies in a fresh state in 100% of attempts.
- **SC-005**: Every failure path listed under Edge Cases ends in exactly one message that
  names the cause and the next step; no path fails silently.
- **SC-006**: The automated suite stays green, and the parity row moves from `not-started` to
  `full` or `partial` with every difference from upstream written down.

## Assumptions

- The upstream behaviour above was read from upstream `main` on 2026-10-20 (README,
  `package.json`, `package.nls.json`, `src/testModel.ts`, `src/spawnTraceViewer.ts`,
  `src/extension.ts`, `src/settingsView.ts`). Upstream has only the spawned viewer; no
  embedded variant exists, so Zed loses nothing by launching the application.
- The on/off control follows the pattern feature 005 established for project selection: an
  entry in the Playwright action menu, a per-user memory in the state directory, a settings
  default under the upstream name, and a confirmation notification. The constitution names
  editor settings as the primitive for "show trace viewer"; the menu entry is the in-editor
  toggle upstream's checkbox and command provide, since Zed has no settings view. The plan
  may refine the mechanics but not the behaviour.
- Playwright's trace viewer is the display surface (constitution, principle III item 5).
  It opens as its own window on the developer's display; the editor shows nothing of the
  trace. Remote topologies (editor on one machine, project on another) are out of scope,
  as for the earlier features.
- "Show browser" and "Close all browsers" are `not-started`; upstream turns trace recording
  off while "Show browser" is on. That rule is written into the parity note for the future
  feature and not built here. Debug runs do not exist yet; upstream never records traces for
  them.
- Trace files, their location, retention and clean-up belong to Playwright and its
  configuration. The extension reads the location of a trace from the run's report and
  never manages the files.
- The minimum Playwright version stays 1.38 (upstream's trace viewer gate is 1.35), so no
  new version message is needed.
- The editor baseline is the current stable Zed on the owner's machine (1.24.2 on
  2026-10-17), with the Linux Zed and WSLg for the viewer window during verification.
- Verification in the sample project uses tests that already exist there; the trace viewer
  needs an installed browser, which the sample project has.
