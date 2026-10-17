# Feature Specification: Single-Click Run Parity Gaps

**Feature Branch**: `006-single-click-run-parity`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Investigate, whether is it possible to achieve full parity of feature Run tests with a single click as stated in docs/parity.md. Currently it states: Missing: executing-line highlight, per-step durations, and terminal output from the extension"

## Upstream Reference

This feature targets the remaining gaps of the **Run tests with a single click** capability of
the upstream extension (https://github.com/microsoft/playwright-vscode). Features 001 and 005
delivered the click itself: run at cursor, run file, re-run last, project selection, progress,
pass/fail notification and diagnostics at failing lines. `docs/parity.md` keeps the row at
`partial` and names three missing pieces: executing-line highlight, per-step durations and
"terminal output from the extension".

Upstream UX (verified against upstream `src/extension.ts` on 2026-10-16): while a test runs,
the line of the step that is currently executing is highlighted across its whole width and
carries a trailing "waiting…" marker. When a step ends, its line keeps a trailing note with
the step's duration in milliseconds, with a "(ran N×)" suffix when the same line executed
several times. Durations stay visible after the test ends and disappear when the next run
starts or when the document is edited. These marks apply to any file the steps are located
in, so page objects and helpers show them too. Test output (everything the test process
prints to stdout and stderr) is appended to VS Code's Test Results panel of that run, and
failure messages appear there and in the Problems view. Upstream writes nothing to a
terminal; the parity note's "terminal output" means "the run's full output readable inside
the editor", which today reaches a Zed user only through the language server log or the
`zed-only` tasks recipe.

Zed UX: the deliverable has two halves. First, an investigation with a recorded verdict per
gap: either the gap can be closed with a native editor surface that an extension may use, or
it is blocked, with evidence (editor version, the document or source line that proves it, or
a working demonstration). Second, every gap with a positive verdict is delivered: the
executing step is visibly marked in the editor and the mark follows the run; finished steps
show their duration next to the line; and the full output of a run started by a click is
reachable from inside the editor without opening the language server log. Gaps with a
negative verdict stay listed in the parity matrix as blocked, with the reason and a link,
and the capability row is updated accordingly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know which gaps the editor can close (Priority: P1)

The maintainer wants a definitive answer, per gap, whether Zed lets an extension deliver it,
so that the parity matrix stops saying "missing" without saying why, and so that no work is
spent on a gap that the editor forbids.

**Why this priority**: This is the question the request asks. Every other story depends on
its answer, and the constitution requires a `blocked` entry with evidence rather than a
silent omission.

**Independent Test**: Read the feature's research record and `docs/parity.md`: each of the
three gaps has a verdict, the evidence behind it, and the editor version it was checked
against. A reader can reproduce the evidence without talking to the author.

**Acceptance Scenarios**:

1. **Given** the three named gaps, **When** the investigation is finished, **Then** each gap
   has exactly one verdict, "deliverable" or "blocked", with at least one piece of evidence
   that a reader can check (a document link, a source reference with the editor version, or
   a reproducible demonstration in the sample project).
2. **Given** a gap with a "blocked" verdict, **When** the parity matrix is read, **Then** the
   row names the gap as blocked, states the reason in one sentence and links the editor
   issue or document that proves it, and the row status stays `partial`.
3. **Given** all three gaps with a "deliverable" verdict and delivered, **When** the parity
   matrix is read, **Then** the row status is `full` and the note describes how each piece
   appears in Zed.
4. **Given** a gap that could only be closed by using the extension API in a way the
   constitution forbids, **When** the verdict is written, **Then** it is "blocked", not
   "deliverable", and says so.

---

### User Story 2 - Read the run's output inside the editor (Priority: P2)

A developer runs a test from a lens. The test prints debug lines and Playwright prints its
own report. The developer wants to read all of it from the editor, right after the run, the
way the VS Code user reads the Test Results panel, instead of digging through the language
server log or setting up the tasks recipe.

**Why this priority**: Failure diagnostics show one line per failure; the full output is
what a developer needs for anything beyond that, such as console logs, retries, worker
errors or a stack trace. It is the gap users notice first.

**Independent Test**: Run a test that prints a recognisable line in the sample project and
confirm the line, Playwright's own summary and any error text can be reached from the editor
in at most two interactions after the run ends.

**Acceptance Scenarios**:

1. **Given** a run started from a lens or a code action has ended, **When** the developer
   asks for its output, **Then** the complete output of that run (what the test process
   printed to stdout and stderr, plus the command that was run) is shown inside the editor,
   with the same lines the command-line run prints.
2. **Given** a run that failed, **When** the developer reaches the output, **Then** the
   failure text and the stack trace are present, and file references in the output can be
   followed to the file and line by the editor's usual means.
3. **Given** two runs in a row, **When** the developer reaches the output, **Then** it shows
   the latest run, and the previous run's output is not mixed into it.
4. **Given** a run that was cancelled by a newer run, **When** the developer reaches the
   output, **Then** they see the newer run only; the cancelled run's output stays in the
   language server log, marked as cancelled.
5. **Given** an editor that lacks the surface needed to show the output, **When** a run
   ends, **Then** the run still reports progress, notification and diagnostics as today, the
   output remains in the language server log, and no error is shown.

---

### User Story 3 - See which line the test is on (Priority: P3)

A developer runs a slow end-to-end test. While it runs, they want to see which step is
executing right now, so they know where a hang or a slow step is before the run ends.

**Why this priority**: It is the most visible upstream feature during a run, but it only
matters for runs long enough to watch, and a developer can get by with the final results.

**Independent Test**: Run a sample test whose steps take several seconds and watch the
mark move from step to step in the open file; when the run ends or is cancelled, the mark
is gone.

**Acceptance Scenarios**:

1. **Given** a test is running and its file is open, **When** a step with a location in that
   file starts, **Then** that line is visibly marked as executing within one second, and the
   mark names the state (for example "waiting…").
2. **Given** a step ends and the next one starts, **When** the editor is watched, **Then**
   the mark moves to the new line and the old line is no longer marked as executing.
3. **Given** the step's location is in another open file (a page object or helper),
   **When** that step runs, **Then** the mark appears in that file.
4. **Given** the run ends, fails or is cancelled, **When** the editor is watched, **Then** no
   line is marked as executing any more.
5. **Given** the installed Playwright does not report steps while running, or the editor
   cannot show the mark, **When** a test runs, **Then** the run behaves as today and nothing
   is shown, with no error.

---

### User Story 4 - See how long each step took (Priority: P3)

After a run, the developer wants to see, next to each step, how long it took, so that slow
steps stand out without reading a trace.

**Why this priority**: Same data stream as the executing mark, lower urgency; a trace viewer
or the report give the same numbers, just not in the editor.

**Independent Test**: Run a sample test with at least three steps; after the run every
step line in the open file shows its duration; edit the file and the durations disappear.

**Acceptance Scenarios**:

1. **Given** a run has ended, **When** the developer looks at a step line that executed,
   **Then** the line shows the step's duration in milliseconds next to it.
2. **Given** a line executed more than once in the run (a loop, or a test in two projects),
   **When** the developer looks at it, **Then** the line shows one duration and how many
   times it ran.
3. **Given** durations are shown, **When** a new run starts, **Then** the previous
   durations are removed before new ones appear.
4. **Given** durations are shown, **When** the developer edits the file, **Then** the
   durations in that file are removed, because their lines may no longer match.
5. **Given** durations are shown, **When** the developer closes and reopens the file without
   editing, **Then** the durations of the latest run are shown again.

---

### Edge Cases

- A step is located in a file that is not open in the editor: no mark is drawn and nothing
  is reported; opening the file during the run shows the current state.
- The file is edited while the test runs: executing marks keep following the lines that
  Playwright reports, which may be off by the edit; they clear at run end as usual.
- A test runs in several selected projects at once: executing marks may appear on more than
  one line at a time; the duration note counts both runs.
- A run with a very large output (many megabytes of logs): the full output is kept and
  shown, or a stated cap applies with a clear "output truncated" line at the end.
- The run fails before any test starts (config error, missing browser): the output surface
  shows the error text, no marks or durations are left behind.
- The language server is restarted or the editor is closed mid-run: nothing persists except
  the log; no stale marks reappear.
- The editor is not Zed, or an older Zed without the needed surface: runs work exactly as in
  release 0.5.1, with the new behaviors absent and one informational log line explaining
  why.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The investigation MUST produce one verdict per gap, "deliverable" or
  "blocked", and MUST record for each the evidence, the editor version checked and the date,
  in the feature's research record.
- **FR-002**: A gap MAY be marked "deliverable" only when it can be built on a surface the
  editor provides to extensions and language servers and that the constitution allows; a
  gap that needs a forbidden workaround MUST be marked "blocked".
- **FR-003**: `docs/parity.md` MUST reflect the verdicts: the row moves to `full` only when
  all three gaps are delivered; otherwise it stays `partial` and names each remaining gap
  with its reason and a link.
- **FR-004**: Step locations, step timings and run output MUST come from Playwright's own
  reporting of the run; the system MUST NOT infer steps from source code or time them
  itself.
- **FR-005**: While a run is in progress, the line of every step that is currently executing
  and whose location is in an open file MUST be visibly marked with a state label, and the
  mark MUST disappear when the step ends, when the run ends, or when the run is cancelled.
- **FR-006**: After a step ends, its line MUST show the step's duration in milliseconds;
  when a line executed several times in the same run it MUST show one duration and the
  count.
- **FR-007**: Durations MUST be removed from a file when that file is edited and from all
  files when a new run starts, and MUST reappear when an unedited file is reopened while the
  run that produced them is the latest.
- **FR-008**: The complete output of the latest run started by a click (stdout, stderr and
  the command line) MUST be reachable from inside the editor in at most two interactions
  after the run ends, without opening the language server log, and MUST state when the run
  failed to start.
- **FR-009**: Only the latest run's output MUST be presented; an earlier run's output MUST
  NOT be mixed into it.
- **FR-010**: When the client lacks a needed surface, or the installed Playwright version
  does not report steps during a run, each new behavior MUST be skipped on its own, the
  existing run flow (progress, notification, diagnostics, log) MUST be unchanged, and one
  informational log line MUST say what was skipped and why.
- **FR-011**: The new behaviors MUST NOT change what is executed: the same command, the same
  project selection, and no workspace code before the trust and consent gates of features
  002 and 003 allow it.
- **FR-012**: Every delivered gap MUST be verified end to end in the sample project and
  recorded in the feature's verification record, with the editor version.
- **FR-013**: The `zed-only` "Terminal output via tasks recipe" row MUST stay as the
  documented alternative and MUST be cross-referenced from the updated capability row.

### Key Entities

- **GapVerdict**: one of the three named gaps, its verdict ("deliverable" or "blocked"),
  the evidence, the editor version it was checked against and the date; recorded once per
  feature.
- **TestStep**: a step as Playwright reports it during a run: title, file and line of its
  location, the test and project it belongs to, start time and duration; nested steps belong
  to a parent step.
- **StepMarks**: for one file, the set of lines currently executing and the set of finished
  lines with their duration and run count; derived from TestSteps of the latest run and
  cleared by the rules in FR-005 and FR-007.
- **RunOutput**: the text a run produced (stdout and stderr in order), the command line, the
  final status (passed, failed, error, cancelled) and the run's identity; one per run, only
  the latest is presented.
- **RunRequest** and **RunResult** (existing): RunResult already carries the raw output and
  the command; this feature exposes them and adds TestSteps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the three gaps have a recorded verdict with checkable evidence, and
  the parity row and its note match the verdicts on the day the feature is merged.
- **SC-002**: For a delivered executing mark, in a sample test with steps of at least two
  seconds each, the mark is on the correct line within one second of each step starting and
  absent within one second of the run ending, in every run of the verification session (at
  least three runs).
- **SC-003**: For delivered durations, after a sample run every step line of the test shows
  a duration, the numbers agree with Playwright's own report for the same run, and one edit
  removes them, in every run of the verification session (at least three runs).
- **SC-004**: For delivered output, a developer reaches the complete output of the latest run
  in at most two interactions and under ten seconds after the run ends, and a line printed
  by the test is found in it, in every run of the verification session (at least three
  runs).
- **SC-005**: A run in an editor or client without the needed surfaces finishes with the
  same progress, notification and diagnostics as release 0.5.1, with zero error messages,
  in 100% of runs.
- **SC-006**: The automated suite stays green and no existing command or argument changes:
  runs issue the same command line as release 0.5.1 for the same request, except for one
  added reporter entry that prints nothing to the run's output.

## Assumptions

- Scope: the request asks whether full parity is possible; the feature answers it and also
  delivers each gap that the answer allows, because the constitution's workflow goes from
  spec to implementation and an investigation alone would leave the row unchanged. A
  "blocked" verdict is a valid, complete outcome for a gap.
- "Terminal output" in the parity note is read as "the run's full output readable inside
  the editor", because upstream itself shows it in the Test Results panel and never in a
  terminal. A terminal is therefore not required; an editor surface that shows the full
  output and lets file references be followed satisfies the gap. The tasks recipe row
  remains the `zed-only` way to get a real terminal.
- The investigation is done in the planning phase and recorded in the feature's research
  record; its evidence is the editor's documentation or source at a stated version, plus a
  demonstration in the sample project when a surface is believed to work.
- The editor baseline is the current stable Zed on the owner's machine (1.24.2 on
  2026-10-16); a surface that only newer Zed provides is "deliverable" with a stated minimum
  version and the fallback of FR-010 for older versions.
- Step data during a run requires Playwright to report steps while the run is in progress.
  Supported Playwright versions (1.38 and newer) can do this through their reporter
  interface; the JSON report alone, which today's run flow reads after the process ends, is
  enough for durations but not for the executing mark. The plan decides how the live data
  reaches the editor without reimplementing Playwright's reporting.
- The executing mark and the duration note are editor-side decorations in upstream. Zed has
  no decoration surface for extensions; the plan evaluates the surfaces Zed does render for
  language servers (for example inline hints next to a line, or informational diagnostics)
  and records which, if any, is an acceptable native fit. Emulating decorations through
  unsupported channels is out of the question by constitution.
- Debugging and watch mode are still out of scope; they will reuse the same marks and output
  when they arrive.
- Output of a run is held in memory for the latest run only; nothing is written into the
  workspace.
