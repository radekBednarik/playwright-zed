# Feature Specification: Attach to Already-Open Spec Files

**Feature Branch**: `007-attach-open-spec-files`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Currently, when user has open the Zed IDE and has already opened some spec file, when he installs the extension, the opened spec files will not be picked up by extension. User has to close the spec file and open it again. This is inconvenient. Is it possible to implement a feature, that would allow the already opened spec files to be picked up by the extension so user can use the extension right away, without closing and opening the spec file?"

## Upstream Reference

This feature does not add a new capability; it closes a gap in how the existing ones reach
the user. It touches the **Run tests with a single click** and **Playwright project
detection and selection** rows of `docs/parity.md`: both deliver their affordances (run
lenses, the project picker, run at cursor, failure markers, step marks) through the files the
developer has open, and today those affordances are missing from files that were open before
the extension started serving them.

Upstream UX (https://github.com/microsoft/playwright-vscode): when the extension is
installed, updated or enabled while test files are already open, VS Code activates it for the
open workspace, the extension enumerates the tests and every open editor gains the run
controls and decorations at once. A VS Code user never has to close and reopen a file to make
the extension notice it; the same holds after a window reload, where the restored editors are
served as soon as the extension activates.

Zed UX today: a developer opens a Playwright project, opens one or more spec files, then
installs the extension (from the registry or as a dev extension). The extension starts, finds
the project and discovers the tests, but the spec files that were open before the install
show no run lenses and offer no Playwright code actions; the developer has to close each such
file and open it again. Files opened after the install work immediately.

Zed UX wanted: the files that were already open behave exactly like files opened after the
install. Within a few seconds of the extension becoming ready for the workspace, every open
spec file shows its run lenses and offers the project picker and run at cursor, without the
developer touching the file. If the editor gives an extension no way to reach already-open
files, that is recorded as a blocked gap with evidence, and the user-facing documentation
tells the developer the one step that works, instead of leaving them to find it out.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use the extension right after installing it (Priority: P1)

A developer has a Playwright project open in Zed with a spec file in a tab. They install the
extension, wait for it to start, and expect to click a run lens in the file they are already
looking at.

**Why this priority**: It is the first impression of the extension. The install is the moment
a new user decides whether it works, and a file that stays blank looks like a broken install.
The request names exactly this flow.

**Independent Test**: In the sample project, open a spec file, install the extension (or
remove and reinstall it), wait for the "discovered N tests" state, and confirm the open file
shows run lenses and the Playwright code actions without being closed or reopened.

**Acceptance Scenarios**:

1. **Given** a spec file of a supported Playwright project is open in the editor and the
   extension is not installed, **When** the developer installs the extension and discovery
   for that project finishes, **Then** the open file shows its run lenses and offers the
   Playwright code actions within five seconds, with no action on the file by the developer.
2. **Given** several spec files of the same project are open in tabs, **When** the extension
   is installed and discovery finishes, **Then** every one of them is served, not only the
   focused one, as the developer switches between the tabs.
3. **Given** the open file is served this way, **When** the developer clicks a run lens or
   runs "run at cursor", **Then** the run starts and reports exactly as it does for a file
   opened after the install: progress, notification, failure markers, step marks and the run
   output.
4. **Given** the file was edited (unsaved changes) before the install, **When** the
   extension starts serving it, **Then** the editor's content is respected: the lenses match
   the discovered tests, and the unsaved state is neither lost nor reverted.

---

### User Story 2 - Other ways the extension starts serving a workspace (Priority: P2)

The same developer later updates the extension, disables and re-enables it, restarts the
language server from the editor, or starts the editor with tabs restored from the last
session. Spec files that are open at that moment should be served the same way.

**Why this priority**: These are the same gap through other doors. They happen far more often
than a first install over the life of the extension, but a developer who has seen it work
once knows the reopen workaround, so the cost of a miss is lower.

**Independent Test**: With a spec file open, perform each of: extension update (or dev
extension reinstall), disable then enable the extension, "restart language server", and a
full editor restart with the tab restored. After each, the open file is served without a
reopen, or the case is recorded as blocked with the reason.

**Acceptance Scenarios**:

1. **Given** a spec file is open and the extension is updated or reinstalled, **When** the
   new version has discovered the project, **Then** the open file is served within five
   seconds without a reopen.
2. **Given** a spec file is open and the language server is restarted from the editor,
   **When** discovery finishes, **Then** the open file is served without a reopen.
3. **Given** the editor starts with a spec file restored from the previous session, **When**
   the extension has discovered the project, **Then** the restored file is served without a
   reopen.
4. **Given** the extension was disabled while a spec file was open, **When** it is enabled
   again and discovery finishes, **Then** the open file is served without a reopen.

---

### User Story 3 - Know what to do when the editor cannot do it (Priority: P3)

The maintainer wants a definitive answer whether the editor lets an extension or language
server reach files that were open before it started, so that the behaviour is either fixed
or documented as an editor limitation, with the workaround stated where a new user reads
first.

**Why this priority**: The constitution forbids working around editor limits through
unsupported channels. If the gap is the editor's, the deliverable is the evidence, the
parity note and a one-line instruction in the install section; that is still worth having,
but it is the fallback, not the goal.

**Independent Test**: Read the feature's research record: each start-up path from the
stories above has a verdict, "deliverable" or "blocked", with evidence a reader can check
(editor version and the document, source reference or reproduction that proves it). For a
blocked path, the README install section and `docs/parity.md` name the limitation and the
reopen step.

**Acceptance Scenarios**:

1. **Given** the investigation is finished, **When** the research record is read, **Then**
   every start-up path (first install, update or reinstall, disable and enable, server
   restart, editor restart with restored tabs) has exactly one verdict with checkable
   evidence and the editor version it was checked against.
2. **Given** a path with a "blocked" verdict, **When** a new user reads the install section
   of the README, **Then** it states in one sentence the step that makes the open files
   served on that path (verified, not assumed), and `docs/parity.md` carries the reason and
   a link to the editor issue or document.
3. **Given** a path that could only be fixed by using the extension API in a way the
   constitution forbids, **When** the verdict is written, **Then** it is "blocked", not
   "deliverable", and says so.
4. **Given** all paths are delivered, **When** the README and parity matrix are read,
   **Then** they contain no reopen instruction.

---

### Edge Cases

- A spec file is open but belongs to no Playwright project (no configuration nearby, or a
  version below the supported minimum): nothing is offered in it, exactly as for a file
  opened after the install, and no error is shown.
- A spec file is open in a workspace whose discovery is still waiting for the consent
  question (older editors, other clients): the file is served as soon as the developer
  answers "Run discovery", without a reopen.
- A spec file is open in a workspace the editor does not trust: nothing happens until the
  developer trusts the folder; once trusted and discovered, the file is served without a
  reopen.
- Dozens of spec files are open at once: all of them are served; the time to serve the
  focused file does not grow noticeably with the number of open files.
- The open file is in a second workspace folder of a multi-folder window: it is served when
  its own folder is discovered, not before and not depending on another folder.
- A file is opened after the install but before discovery finishes: it is served when
  discovery finishes, same as a file that was open before the install (today's behaviour for
  this case must not regress).
- The extension is installed and uninstalled while files are open: after the uninstall the
  files show no stale lenses or code actions.
- The editor is a version that lacks whatever this feature relies on: runs and discovery
  work exactly as in release 0.5.1, the files need the documented step, and the README
  states the editor version the behaviour was verified on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every spec file that is open when the extension becomes ready for its
  workspace MUST receive the same affordances (run lenses, project picker and other code
  actions, run at cursor, failure markers, step marks, last run output) as a file opened
  afterwards, without the developer closing, reopening, editing, saving or switching the
  file.
- **FR-002**: FR-001 MUST hold for each of these start-up paths: first install of the
  extension, update or reinstall, disable and enable, language server restart from the
  editor, and editor start with files restored from the previous session.
- **FR-003**: Files open at start-up MUST be served within five seconds of discovery
  finishing for their workspace, and MUST NOT be served before the trust and consent gates
  of features 002 and 003 allow discovery.
- **FR-004**: Serving an already-open file MUST respect the editor's current content of that
  file, including unsaved changes, and MUST NOT modify, reload or reformat the file.
- **FR-005**: Runs started from an already-open file MUST issue the same command and produce
  the same reporting as runs started from a file opened after start-up; the automated
  suite's existing expectations on the command line MUST stay unchanged.
- **FR-006**: The investigation MUST record one verdict per start-up path of FR-002,
  "deliverable" or "blocked", with evidence, editor version and date, in the feature's
  research record. A path MAY be "deliverable" only when it rests on a surface the editor
  provides to extensions or language servers and the constitution allows; a path that would
  need a forbidden workaround MUST be "blocked".
- **FR-007**: For every "blocked" path, the README install section MUST tell the developer
  in one sentence what to do (the one step that is verified to work on that path, for
  example restarting the language server), and `docs/parity.md` MUST name the limitation
  with a link to the editor issue or document. When no path is blocked, neither document
  MUST carry such an instruction.
- **FR-008**: When the client lacks whatever a delivered path depends on, the existing
  behaviour (files served when opened after start-up) MUST be unchanged and one
  informational log line MUST say what was skipped and why.
- **FR-009**: Every delivered path MUST be verified end to end in the sample project and
  recorded in the feature's verification record, with the editor version.

### Key Entities

- **StartupPath**: one of the ways the extension begins serving a workspace while files are
  already open: first install, update or reinstall, disable and enable, language server
  restart, editor restart with restored files. Each has a verdict, evidence, editor version
  and date.
- **OpenFile**: a spec file open in the editor, with its current content and version, its
  workspace and the Playwright configuration it belongs to; served or not served.
- **Workspace** (existing): a workspace folder with its discovery state (pending, enabled,
  declined) and configurations; the moment it becomes "discovered" is the trigger for
  serving its open files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a first install over the sample project with three spec files open, all
  three show run lenses and code actions within five seconds of discovery finishing, with
  zero reopen actions, in every attempt of the verification session (at least three
  attempts).
- **SC-002**: A run started from an already-open file right after the install passes with
  the same progress, notification, markers and output as a run from a freshly opened file,
  in 100% of attempts.
- **SC-003**: 100% of the start-up paths in FR-002 have a recorded verdict with checkable
  evidence, and the README and parity matrix match the verdicts on the day the feature is
  merged.
- **SC-004**: With a blocked path, a new user reading the README install section finds the
  reopen instruction in the same section as the install steps, without scrolling to another
  section.
- **SC-005**: The automated suite stays green and no existing command, argument or setting
  changes.

## Assumptions

- "Spec file" means any file the extension already serves: a test file under a discovered
  configuration's test directories, in TypeScript, TSX or JavaScript. Helper files and page
  objects only carry step marks, and they are included in "served" for that purpose.
- "Installs the extension" is read broadly: the request names a first install, but update,
  reinstall, disable and enable, language server restart and editor restart with restored
  tabs are the same gap through other doors and cost little to check together. If some of
  them already work today, their verdict is "deliverable, already works" with the evidence.
- The constitution's workflow goes from spec to implementation, so the feature both
  investigates and delivers whatever the investigation allows, as feature 006 did. A
  "blocked" verdict backed by evidence is a complete outcome for a path; the required
  documentation (FR-007) is then the deliverable for it.
- The server today already asks the editor to refetch run lenses once discovery for a
  workspace finishes, and files opened after start-up are served correctly, so the gap is
  about files the editor had open before the server existed. The plan determines where the
  gap lies (whether the editor tells a newly started server about files that are already
  open, and if so when) using the editor's source at a stated version plus a reproduction
  in the sample project. Nothing in this spec presumes the answer.
- The editor baseline is the current stable Zed on the owner's machine (1.24.2 on
  2026-10-17). A path that only newer Zed can deliver is "deliverable" with a stated minimum
  version and the fallback of FR-008 for older versions.
- The feature changes no run semantics, no settings and no commands; it is about when the
  existing affordances appear. It is not a parity row of its own; the affected rows'
  notes are updated.
- Watch mode and debugging stay out of scope; when they arrive they inherit the behaviour.
