# Feature Specification: Show Browser

**Feature Branch**: `009-show-browser`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Lets implement Show Browser feature from @docs/parity.md matrix"

## Upstream Reference

This feature mirrors the **Show browser** capability of the upstream extension
(https://github.com/microsoft/playwright-vscode), the `not-started` row of that name in
`docs/parity.md`, together with the **Close all browsers** row, which upstream presents as
the way to end what "Show browser" starts.

Upstream UX (verified against upstream `main`, extension 1.1.20, on 2026-10-29): the README
says "Check the 'show browsers' checkbox to run tests with the browser open so that you can
visually see what is happening while your test is running" and "Click on 'close all
browsers' to close the browsers." The checkbox sits in the Playwright settings view of
VS Code's Test Explorer, labelled "Show browser" with the sublabel "one worker", next to
"Show trace viewer"; it is backed by the setting `playwright.reuseBrowser` ("Show & reuse
browser between tests", default off) and by the command "Toggle Playwright browser reuse".
While the setting is on, every run started by the extension shows the browser window on
screen, runs with a single worker, and reuses one browser kept alive by the extension, so the
window stays open after the run with the last page still visible and the next run continues
in it instead of launching a new browser. Trace and video recording are turned off for those
runs, because a reused browser outlives the folder the recordings are written to, and
turning "Show browser" on turns "Show trace viewer" off. The extension starts the kept
browser before the first run that needs it and stops it when the option is turned off, when
the developer closes its last page, or when "Close all browsers" is chosen; that action
refuses with a warning while tests are running. The feature needs Playwright 1.25 or newer,
and refuses in a remote web UI without a display.

Zed UX: a developer turns "Show browser" on from inside the editor, in the same place the
Playwright project picker and "Show trace viewer" live, or sets a default for a folder in the
editor's settings under the upstream name. From then on, runs started from the editor open a
visible browser window, run one test at a time, and leave the window open after the run;
later runs reuse it. "Show trace viewer" is switched off when "Show browser" is turned on,
and runs record no trace while the browser is shown. "Close all browsers" is a
second action in the same place that closes the kept browser without changing the option,
and is refused with a message while a run is in progress. Turning the option off closes the
browser and makes runs as fast and quiet as before. Zed renders nothing of the browser; the
window is Playwright's own browser, launched through the workspace's Playwright.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch my test run in a visible browser (Priority: P1)

A developer writing or fixing a test wants to see what the browser does while the test runs,
rather than reading a report afterwards. They turn "Show browser" on, run the test from its
line, and a browser window appears on screen and plays the test through.

**Why this priority**: This is the capability itself and the whole value of the parity row: a
visible run without editing the Playwright configuration or passing flags by hand.

**Independent Test**: In the sample project, turn the option on from a spec file, run one
test at the cursor, and confirm a browser window opens, the test's actions are visible in it,
and the pass/fail result arrives as before.

**Acceptance Scenarios**:

1. **Given** "Show browser" is off and a spec file of the sample project is open, **When**
   the developer turns it on, **Then** the editor confirms the new state and the option reads
   as on the next time the developer looks at it.
2. **Given** "Show browser" is on, **When** the developer runs one test at the cursor,
   **Then** a browser window is visible while the test runs, and pass/fail reporting,
   diagnostics, step marks and run output behave as before.
3. **Given** "Show browser" is on, **When** the developer runs a whole file, **Then** the
   tests run one at a time in the visible browser and the results are reported as before.
4. **Given** "Show browser" is on and the test is selected in two projects, **When** the
   developer runs it at the cursor, **Then** each project's run is visible in turn and the
   run's messages name the project of each result as they do today.

---

### User Story 2 - Keep the browser between runs (Priority: P2)

After a run, the developer wants the browser window to stay where it is, showing the page the
test ended on, and wants the next run to continue in that same window instead of a new one
flashing up each time.

**Why this priority**: Reuse is what upstream's setting is named after ("reuse browser between
tests") and what makes the mode useful for iterating on a test: the developer keeps the page
state in view between edits and runs.

**Independent Test**: With the option on, run a test, confirm the browser window stays open
after the result arrives, run the test again, and confirm the same window is used and no
second window appears.

**Acceptance Scenarios**:

1. **Given** "Show browser" is on and a test just finished, **When** the developer looks at
   the screen, **Then** the browser window is still open with the last page of the test.
2. **Given** the browser window is open from a previous run, **When** the developer runs a
   test again, **Then** the run uses that window and no additional browser window opens.
3. **Given** the browser window is open from a previous run, **When** the developer closes
   the window by hand and runs a test, **Then** a fresh browser window opens for the run.
4. **Given** the browser window is open, **When** the editor session ends, **Then** the
   browser is closed with it and nothing is left running.

---

### User Story 3 - Close the browsers and turn the mode off (Priority: P3)

A developer who finished watching wants the browser gone, either for the moment (close the
browsers, keep the option on for the next run) or for good (turn the option off), and expects
the on/off state to be remembered the next day, on the same machine, like their project
selection and trace viewer choice are. A team can set a default for a folder.

**Why this priority**: It completes the upstream behaviour (the close action, the toggle,
persistence in editor state); a developer could live without it by closing the window by
hand.

**Independent Test**: With the browser open, choose "Close all browsers" and confirm the
window closes and the option stays on. Turn the option off and confirm the browser closes and
the next run is headless. Quit and restart the editor and confirm the option is still as
left. Set the folder default in the editor settings and confirm it applies in a fresh state.

**Acceptance Scenarios**:

1. **Given** "Show browser" is on and the browser window is open, **When** the developer
   chooses "Close all browsers", **Then** the window closes, the option stays on, and the
   next run opens a fresh window.
2. **Given** a run is in progress, **When** the developer chooses "Close all browsers",
   **Then** nothing closes and a message says browsers cannot be closed while tests run.
3. **Given** "Show browser" is on and the browser window is open, **When** the developer
   turns it off, **Then** the window closes, the editor confirms the change, and the next run
   runs without a visible browser, with the project's own worker count and recording
   configuration.
4. **Given** the developer turned the option on, **When** the editor is restarted on the same
   machine, **Then** the option is still on without any action.
5. **Given** the developer has never touched the option, **When** a folder default for it is
   present in the editor settings, **Then** the default applies, a notification says the
   option is on from the settings when that is the case, and a later explicit choice wins
   over the default.
6. **Given** the option is turned off while a run is in progress, **When** the run finishes,
   **Then** the run completes normally and the browser closes once it has ended.

---

### User Story 4 - Show browser and Show trace viewer do not fight (Priority: P3)

A developer who had one of the two options on turns the other on and expects the editor to
resolve the conflict, telling them what changed, rather than producing broken traces, a run
that fails, or a browser window left behind.

**Why this priority**: Both options exist in this extension already (feature 008 forces trace
recording on); without a rule, a developer with both on would get runs that fail or traces
that are useless, which is worse than either option alone.

**Independent Test**: Turn "Show trace viewer" on, then turn "Show browser" on, and confirm
the trace viewer option reads as off, its viewer window is closed, a message names the
change, and the next run records no trace.

**Acceptance Scenarios**:

1. **Given** "Show trace viewer" is on, **When** the developer turns "Show browser" on,
   **Then** "Show trace viewer" is turned off, its viewer closes, and the confirmation names
   both changes.
2. **Given** "Show browser" is on and its browser window is open, **When** the developer
   turns "Show trace viewer" on, **Then** "Show browser" is turned off, the kept browsers
   close, the confirmation names both changes, and the next run records a trace as feature
   008 says. When both options are on through a settings default, runs record no trace and
   the run's messages say why no trace is shown.
3. **Given** "Show browser" is on, **When** the developer runs a test, **Then** no trace is
   recorded for it even if the project's own configuration asks for one, and "Show trace"
   is not offered for that run's results.

---

### Edge Cases

- The workspace Playwright is older than the feature requires: the existing version message
  applies (the project's minimum of 1.38 already exceeds upstream's 1.25 gate), so no extra
  check is needed; this is recorded, not built.
- The kept browser cannot start (no browser installed, missing display, command fails): an
  error message quotes the command and the reason, the option stays on, and the run either
  does not start or runs as if the option were off, whichever the plan picks, with the
  message saying which happened.
- The kept browser exits on its own (crash, killed from outside): the extension forgets it
  and starts a fresh one at the next run; it never restarts it without a run to serve.
- A run is cancelled or fails before the browser opened: the kept browser stays as it was and
  the result is reported as today.
- Two Playwright configurations in one workspace: each configuration gets its own kept
  browser, started through its own Playwright, and "Close all browsers" closes all of them.
- The project's own configuration sets more than one worker or a trace: while the option is
  on, the run uses one worker and records no trace; while it is off, the project's
  configuration is left untouched. A configured video is recorded as usual (see FR-005).
- The option is turned on while a run is already in progress: that run is unaffected; the
  next run shows the browser.
- The developer closes the last page but not the browser process: the browser is treated as
  closed and the next run opens a fresh window, as upstream does.
- The test itself launches extra browsers or contexts: those behave as the test says; only
  the default browser of the run is the kept one.
- Test discovery is never affected: listing tests opens no browser whether the option is on
  or off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST offer a "Show browser" on/off choice, off by default,
  reachable from any served spec file inside the editor in the same place as the project
  picker and "Show trace viewer", and MUST accept a folder or user default from the editor
  settings under the upstream setting name.
- **FR-002**: While the option is on, every run started from the editor MUST show the
  browser window on screen and MUST run with a single worker, overriding the project's own
  worker configuration. While it is off, runs MUST NOT change the project's configuration in
  any way.
- **FR-003**: While the option is on, runs MUST reuse one browser kept open by the extension
  per Playwright configuration: the window MUST stay open after a run with the last page
  visible, and the next run MUST continue in it rather than opening another browser. A
  browser the developer closed MUST be replaced by a fresh one at the next run, and never
  before.
- **FR-004**: The kept browser MUST be Playwright's own browser, launched through the
  workspace's Playwright installation of the configuration that owns the test. The extension
  MUST NOT bundle, drive or reimplement any part of it.
- **FR-005**: While the option is on, runs MUST record no trace, overriding the project's own
  configuration and the "Show trace viewer" option; turning "Show browser" on MUST turn
  "Show trace viewer" off, close its viewer, and say so in the confirmation; turning "Show
  trace viewer" on MUST turn "Show browser" off, close the kept browsers, and say so (owner
  decision 2026-10-29: the two options exclude each other both ways, where upstream only
  has the first direction). When both end up on through a settings default, runs MUST
  record no trace and the run's messages MUST say why no trace is shown. Video
  stays as the project's configuration says (the command line cannot override it); a project
  that records video gets the visible, kept browser but Playwright then opens a fresh context
  per test, so page state does not carry between tests.
- **FR-006**: The extension MUST offer a "Close all browsers" action in the same place that
  closes every kept browser without changing the option, and MUST refuse it with a message
  while a run is in progress.
- **FR-007**: Turning the option off MUST close the kept browsers (after the current run
  ends, if one is in progress), and runs started afterwards MUST run without a visible
  browser with the project's own worker count and recording configuration.
- **FR-008**: Every change of the option MUST be confirmed with a notification naming the new
  state (the editor caches its action menu per cursor position, as recorded for the project
  picker).
- **FR-009**: The developer's explicit choice MUST be remembered per user across editor
  sessions on the same machine, in the same way and place as the project selection and the
  trace viewer choice; the settings default applies only until a choice is made. The source
  that applied MUST be written to the language server log at every resolution, and a
  notification MUST say so when a settings default turns the option on.
- **FR-010**: When the kept browser cannot start or exits unexpectedly, the extension MUST
  show one actionable message naming the command and the reason, and the run's pass/fail
  result, diagnostics, step marks and run output MUST be reported as today for whatever did
  run.
- **FR-011**: Every kept browser MUST be closed when the editor session ends, when the
  configuration's workspace is removed, and when the option is turned off, so nothing is left
  running behind the developer's back.
- **FR-012**: With the option off, the commands, arguments and results of runs MUST be
  identical to today's, so nothing changes for developers who never turn it on.
- **FR-013**: The feature MUST be verified end to end in the sample project, and the "Show
  browser" and "Close all browsers" rows of `docs/parity.md` MUST record the status, the
  primitive and every difference from upstream (at least: the toggle and the close action
  are actions at the cursor because Zed has no settings view; the "Show trace viewer"
  interaction now built; the deferred note on the "Show trace viewer" row resolved).

### Key Entities

- **Show browser preference**: the on/off state of "Show browser" for the developer, with
  its source (explicit choice, settings default, or built-in default) and the time of the
  last explicit change; remembered per user, like the project selection and the trace viewer
  preference, and coupled to the latter by the rule in FR-005.
- **Kept browser**: one browser per Playwright configuration that the extension starts for
  the first run that needs it and keeps across runs, with its state (starting, ready, in
  use by a run, gone); closed by "Close all browsers", by turning the option off, by the
  developer closing it, or when the session ends.
- **Run**: an execution started from the editor, which while the option is on is visible,
  single-worker and without trace, and otherwise is unchanged from today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from the option off, a developer reaches a visible browser running
  their test with two actions (turn on, run at cursor), and the window appears within 10
  seconds of starting the run in the sample project.
- **SC-002**: Across five consecutive single-test runs with the option on, exactly one
  browser window is open at any time and it is never closed by the extension between runs.
- **SC-003**: "Close all browsers" and turning the option off each close every kept browser
  within 5 seconds in 100% of attempts, and no browser started by the extension survives the
  end of the editor session.
- **SC-004**: With the option off, 100% of the run commands and results produced by the
  automated suite are unchanged from before this feature.
- **SC-005**: The on/off choice survives an editor restart in 100% of attempts on the same
  machine, and a folder default applies in a fresh state in 100% of attempts.
- **SC-006**: With both options involved, a developer never sees a failed run or a broken
  trace caused by their combination: every such case ends in exactly one message that names
  the rule.
- **SC-007**: Every failure path listed under Edge Cases ends in exactly one message that
  names the cause and the next step; no path fails silently.
- **SC-008**: The automated suite stays green, and the "Show browser" and "Close all
  browsers" rows move from `not-started` to `full` or `partial` with every difference from
  upstream written down.

## Assumptions

- The upstream behaviour above was read from upstream `main` (extension 1.1.20) on
  2026-10-29 (README, `package.json`, `package.nls.json`, `src/settingsModel.ts`,
  `src/settingsView.ts`, `src/testModel.ts`, `src/reusedBrowser.ts`, `src/extension.ts`).
  Upstream keeps the browser alive through Playwright's own long-running browser server and
  tells the test run to connect to it and reuse its context; the plan verifies that the
  same Playwright mechanism is reachable from the command line Playwright the extension
  already drives, and records a `blocked` verdict with evidence if it is not.
- "Close all browsers" is folded into this feature because upstream presents it as the
  counterpart of "Show browser" (the README names them together) and a kept browser with no
  way to close it short of turning the option off would be an incomplete parity. It is one
  action with one rule (refused while a run is in progress). The owner can split it out at
  `/speckit-clarify` if preferred.
- The on/off control follows the pattern features 005 and 008 established: an entry in the
  Playwright action menu, a per-user memory in the state directory, a settings default under
  the upstream name (`reuseBrowser`, shown as "Show browser"), and a confirmation
  notification. The constitution names editor settings as the primitive for "show browser";
  the menu entry is the in-editor toggle upstream's checkbox and command provide, since Zed
  has no settings view. The plan may refine the mechanics but not the behaviour.
- The conflict rule with "Show trace viewer" goes further than upstream (owner decision
  2026-10-29): turning either option on turns the other off (upstream only turns the trace
  viewer off), and while "Show browser" is on no trace is recorded whatever the other
  option says. Video cannot be forced off from the command line
  (upstream can, because it drives Playwright through its test server); it stays as the
  project configures it, recorded as a difference in the parity note. Upstream's reason (a reused browser outlives
  the artifact folder Playwright clears between runs, so an ongoing trace fails) applies
  here unchanged.
- The browser window is Playwright's browser on the developer's display (constitution,
  principle III item 5); the editor shows nothing of it. Remote topologies (editor on one
  machine, project on another) are out of scope, as for the earlier features; upstream
  refuses there without a display, and this feature inherits that message through the
  "cannot start" path.
- Playwright owns the browser process, its pages and its artifacts; the extension only asks
  for it to be started, reused, and stopped. "Pick locator", "Record new test" and "Record at
  cursor", which upstream also serve from the same kept browser, remain `not-started` and are
  not touched here.
- Debug runs do not exist yet; upstream always keeps a browser for them, which the future
  debugging feature will take up.
- The minimum Playwright version stays 1.38 (upstream's gate for this feature is 1.25), so no
  new version message is needed.
- The editor baseline is the current stable Zed on the owner's machine (1.24.2 on
  2026-10-20), with the Linux Zed and WSLg for the browser window during verification.
- Verification in the sample project uses tests that already exist there; the sample
  project has an installed browser.
