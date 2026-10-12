# Feature Specification: Project Scaffold and Run Test at Cursor

**Feature Branch**: `001-scaffold-run-at-cursor`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "project scaffold and run test at cursor"

## Upstream Reference

This feature mirrors two upstream capabilities of the Playwright VS Code extension
(https://github.com/microsoft/playwright-vscode):

- **Playwright project detection**: on opening a workspace, the upstream extension detects the
  Playwright installation and its configuration, and activates only for workspaces that have
  Playwright. Workspaces without it are offered an install action (out of scope here).
- **Run tests with a single click**: a green triangle appears beside each test in the editor.
  Clicking it runs that single test. While the test runs the executing line is highlighted,
  and afterward each step shows its duration. The upstream extension supports Playwright
  v1.38 or newer.

In Zed, the same outcome is delivered by: the extension installing and activating in a
Playwright workspace, a run affordance available from the test's location in the editor, and
the run result visible inside the editor window. Line highlighting and per-step durations are
not part of this feature and are tracked separately in the parity matrix.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and recognise a Playwright workspace (Priority: P1)

A developer who uses Zed installs the extension, opens a folder that contains a Playwright
test project, and sees that the extension is active and has recognised the project. If the
folder has no Playwright, or an unsupported version, the developer gets a clear message and
nothing else happens.

**Why this priority**: Nothing else can work until the extension exists, installs cleanly, and
can tell a Playwright workspace from any other folder. This is the foundation for every later
parity feature.

**Independent Test**: Install the extension from source into Zed, open the bundled sample
project, and confirm the extension reports the workspace as a Playwright project with its
version. Open a folder without Playwright and confirm the extension reports that no
Playwright was found and offers no run affordances.

**Acceptance Scenarios**:

1. **Given** Zed with the extension installed from source, **When** the developer opens the
   extensions list, **Then** the extension appears with its name, version, and description.
2. **Given** a folder containing a Playwright project (v1.38 or newer) with a configuration
   file, **When** the developer opens it in Zed, **Then** the extension recognises it as a
   Playwright workspace and makes the run affordance available in test files.
3. **Given** a folder with no Playwright installed, **When** the developer opens it, **Then**
   no run affordance is shown and, on any attempt to run, a message explains that Playwright
   was not found in the workspace.
4. **Given** a folder with Playwright older than v1.38, **When** the developer opens it,
   **Then** a message states the installed version, the minimum supported version, and that
   test running is disabled.

---

### User Story 2 - Run the test under the cursor (Priority: P1)

A developer opens a Playwright test file, places the cursor inside a test, and triggers "run
test at cursor" from the editor. The single test runs using the workspace's own Playwright,
the output appears inside Zed, and the developer can see whether it passed or failed without
leaving the editor.

**Why this priority**: This is the core daily action of the upstream extension and the
smallest slice that proves the whole pipeline (detection, invocation, result display). It is
the minimum viable product on its own.

**Independent Test**: Open the sample project's test file, put the cursor inside a known
passing test, trigger the run, and confirm that only that test ran and that its result is
visible. Repeat with a known failing test and confirm the failure and its message are visible.

**Acceptance Scenarios**:

1. **Given** a test file with several tests and the cursor inside one of them, **When** the
   developer triggers run at cursor, **Then** exactly that test runs and its result is shown.
2. **Given** the cursor inside a test that fails, **When** the developer triggers run at
   cursor, **Then** the output shows the failure, the assertion message, and the file and
   line where it failed.
3. **Given** the cursor inside a nested group (`describe`) of tests, **When** the developer
   triggers run at cursor on the group's own line, **Then** every test inside that group runs
   and no test outside it runs.
4. **Given** the cursor on a line outside any test or group, **When** the developer triggers
   run at cursor, **Then** every test in the file runs.
5. **Given** two tests in the same file share the same title inside different groups,
   **When** the developer runs one of them at cursor, **Then** only the test at the cursor
   position runs.
6. **Given** a test is running, **When** the developer triggers run at cursor again on the
   same test, **Then** a second run starts after, or replaces, the first; the output of the
   latest run is what the developer sees.

---

### User Story 3 - Run the whole test file (Priority: P2)

A developer opens a Playwright test file and triggers "run file". All tests in that file
run and the results appear inside Zed.

**Why this priority**: Upstream exposes file-level runs through the test explorer. It is a
cheap extension of story 2 and a common workflow, but story 2 already delivers the MVP.

**Independent Test**: Open the sample project's test file, trigger run file, and confirm
the number of tests reported equals the number of tests in the file, including skipped ones.

**Acceptance Scenarios**:

1. **Given** an open test file with N tests, **When** the developer triggers run file,
   **Then** N tests run and the summary shows N results.
2. **Given** an open file that is not a Playwright test file, **When** the developer looks
   for the run affordance, **Then** it is not offered.

---

### User Story 4 - Re-run the last test run (Priority: P3)

A developer who has just run a test edits the file and wants to run the same test again
without moving the cursor back to it.

**Why this priority**: Convenience. Upstream covers this through the test explorer's re-run
button. It is small but not required for the MVP.

**Independent Test**: Run a test at cursor, move the cursor elsewhere, trigger re-run, and
confirm the same test ran again.

**Acceptance Scenarios**:

1. **Given** a previous run at cursor, **When** the developer triggers re-run last, **Then**
   the same test selection runs again with the same settings.
2. **Given** no previous run in this session, **When** the developer triggers re-run last,
   **Then** a message states there is nothing to re-run.

---

### Edge Cases

- The workspace contains more than one Playwright configuration file (monorepo). The run
  uses the configuration nearest to the test file, searching upward from the file's folder.
- The workspace has several root folders and only some contain Playwright. Detection and run
  are evaluated per root folder.
- Playwright is present but browsers are not installed. The run output surfaces Playwright's
  own install instructions unchanged.
- The test file has unsaved changes. The run uses the on-disk content and the developer is
  told the file was not saved, or the file is saved first; either behaviour is acceptable but
  it MUST be consistent and documented.
- The test title contains characters that are special in pattern matching (parentheses,
  brackets, dots, quotes). The correct single test still runs.
- The test is parameterised or generated in a loop so several tests share one source line.
  All tests originating from that line run.
- The cursor is inside a `test.skip`, `test.fixme`, or `test.only` block. The run respects
  Playwright's own semantics and shows the skipped or focused outcome.
- The Playwright executable cannot be started (missing Node, broken install). The developer
  sees the exact command attempted and the underlying error, not a generic failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST be installable into Zed from its source folder and MUST
  appear in Zed's extensions list with a name, version, and description.
- **FR-002**: The extension MUST include a bundled sample Playwright project used for manual
  verification, containing at least one passing test, one failing test, one nested group,
  two tests with identical titles in different groups, two tests generated on a single source
  line, and one skipped test.
- **FR-003**: The extension MUST maintain a parity matrix document listing every upstream
  capability with its status and, for this feature, mark "project detection" and "run tests
  with a single click" with their achieved status.
- **FR-004**: On opening a root folder, the extension MUST determine whether a Playwright
  installation and at least one Playwright configuration file exist in that folder.
- **FR-005**: The extension MUST determine the installed Playwright version and MUST disable
  test running, with an explanatory message, when the version is below v1.38.
- **FR-006**: The extension MUST use the Playwright installed in the workspace for all runs
  and MUST NOT ship or download its own copy of Playwright.
- **FR-007**: In a recognised workspace, the extension MUST offer a "run test at cursor"
  action in files that Playwright would treat as test files.
- **FR-008**: "Run test at cursor" MUST run exactly the test enclosing the cursor; when the
  cursor is on a group, all tests in that group; when outside any test or group, all tests in
  the file.
- **FR-009**: When several tests share a title, the extension MUST disambiguate by source
  position so that only the test at the cursor runs.
- **FR-010**: The extension MUST offer a "run file" action in recognised test files.
- **FR-011**: The extension MUST offer a "re-run last" action that repeats the most recent run
  selection, and MUST state when there is nothing to re-run.
- **FR-012**: Run output MUST be displayed inside Zed and MUST include per-test pass or fail
  status, failure messages with file and line, and the total summary that Playwright reports.
- **FR-013**: Every failure to start a run MUST show the command that was attempted and the
  underlying error text.
- **FR-014**: The run MUST use the Playwright configuration nearest to the test file when more
  than one configuration exists in the workspace.
- **FR-015**: The extension MUST NOT alter the developer's test files, configuration, or
  installed packages as a side effect of detection or running.
- **FR-016**: All user-facing text MUST be in English.

### Key Entities

- **Workspace**: A root folder opened in Zed. Attributes: whether Playwright is present, the
  detected Playwright version, the set of configuration files found.
- **Test Location**: A file path plus a line number that identifies a test, a group, or a
  whole file. Derived from the cursor position at the moment the run is triggered.
- **Run Request**: The selection to run (a Test Location), the configuration file to use, and
  the moment it was triggered. The most recent Run Request is what "re-run last" repeats.
- **Run Result**: The output of a run: per-test status, failure details, and summary counts,
  as reported by Playwright.
- **Parity Matrix Row**: An upstream capability name, its status (`full`, `partial`,
  `blocked`, `not-started`, `zed-only`), the approach used, and a note.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with Zed and the extension source can install the extension and see
  it active in a Playwright workspace in under 5 minutes following the written steps.
- **SC-002**: From an open test file, a developer can start the test under the cursor with
  one action and see its result inside Zed without opening a separate terminal.
- **SC-003**: In the sample project, run at cursor selects the correct single test in 100% of
  the cases enumerated in the acceptance scenarios, including identical titles and special
  characters.
- **SC-004**: A failing test's file, line, and assertion message are visible in the run output
  in 100% of runs of the sample failing test.
- **SC-005**: Opening a folder without Playwright produces no run affordances and no errors in
  the Zed log attributable to the extension.
- **SC-006**: The parity matrix shows "project detection" and "run tests with a single click"
  with a status and approach filled in, and every other upstream capability at
  `not-started` or better.

## Assumptions

- Developers already have Node.js and Playwright installed in their project; installing
  Playwright from the editor is a separate upstream capability and out of scope.
- "Run" means headless execution with the project's default settings. Showing the browser,
  trace viewer, watch mode, debugging, and Playwright project (browser) selection are separate
  upstream capabilities and out of scope.
- When no Playwright project (browser) is selected, the run uses whatever the workspace
  configuration runs by default. Matching the upstream "first project is the default profile"
  behaviour is deferred to the project-selection feature.
- Test files are TypeScript or JavaScript files matched by the workspace's Playwright
  configuration; the extension does not define its own notion of what a test file is.
- Run output reaches the developer through the surfaces Zed renders for editor tooling:
  a progress indicator while running, a pass/fail notification with the summary, a marker at
  each failing line carrying the assertion message, and the full textual output in Zed's
  language-server log. A dedicated results panel and terminal output from the extension are
  not available to extensions; terminal output is offered through a documented, optional
  user-level task recipe.
- The sample project is small (one or two test files) and uses only the Chromium browser to
  keep manual verification fast.
- The extension targets the current stable Zed release at the time of implementation and the
  latest extension API version compatible with it.
- Unsaved buffers: the chosen behaviour is to run the on-disk content and show a notice when
  the file has unsaved changes.
