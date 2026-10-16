# Feature Specification: Playwright Project Selection

**Feature Branch**: `005-project-selection`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Playwright project detection and selection with full parity to the VS Code extension: pick the browser (Playwright project) used by the runner, and pick one or multiple projects from the resolved playwright.config. Today docs/parity.md lists this capability as partial: configs are detected, but there is no project picker and runs use the config's default projects."

## Upstream Reference

This feature completes the **Playwright project detection and selection** capability of the
upstream extension (https://github.com/microsoft/playwright-vscode). In Playwright, a
"project" is an entry of the `projects` array in `playwright.config.*`; most projects name a
browser (`chromium`, `firefox`, `webkit`, a mobile emulation), which is why upstream calls the
feature "selecting browsers".

Upstream UX: when a config is loaded, its projects appear as a list of checkboxes in the
Playwright sidebar (the settings view of the Test Explorer). Only the first project is checked
by default; a config with a single project treats that project as always checked. The user
checks or unchecks any number of projects, and the choice is remembered per workspace and
per config, by project name, across restarts of the editor. Running or debugging tests sends
only the checked projects to Playwright; when every project is checked, no project filter is
sent, so Playwright's own defaults apply. Test discovery always covers every project, but
files whose tests belong to no checked project are hidden from the tree. There is no
dedicated setting for the choice. Upstream also lets the user pick which config is active
when a workspace has several; that part is not in this feature (see Assumptions).

Decisions 2026-10-14 (owner): the default selection is the first project, as upstream; the
remembered choice is kept in a per-user store outside the workspace, keyed by config path.

Zed UX: Zed has no sidebar, tree or status bar that an extension can draw into. The picker
therefore lives where this extension already puts its commands, the code action menu
(`ctrl-.` / `cmd-.`). From any file that belongs to a config with two or more projects, the
menu lists one entry per project with a check mark showing its state; choosing an entry
toggles that project. A further entry selects every project at once. Runs started from the
cursor, the file or "re-run last" use the selected projects, the run lenses follow the
selection, and the progress message and run log name the projects used. The choice is
remembered per user and per config across restarts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a test in the browsers I choose (Priority: P1)

A developer's config defines `chromium`, `firefox` and `webkit`. They open a test file, open
the code action menu, see the three projects with `chromium` checked, check `firefox` as well,
and run the test at the cursor. The test runs in Chromium and Firefox only, and the progress
message says so.

**Why this priority**: This is the request and the missing half of the parity row. Without
it a developer cannot reproduce a browser-specific failure from Zed, and multi-browser
configs run every project on every click, which is slow.

**Independent Test**: In the sample project with at least two projects, toggle a second
project through the code action menu and run one test; the run report shows one result per
selected project and none for the others.

**Acceptance Scenarios**:

1. **Given** a config with projects `chromium`, `firefox` and `webkit` and no earlier choice,
   **When** the developer opens the code action menu in a test file of that config, **Then**
   the menu lists the three projects, marks `chromium` as selected and the other two as not
   selected, and offers "run in all projects".
2. **Given** that menu, **When** the developer chooses `firefox`, **Then** `firefox` becomes
   selected, `chromium` stays selected, and the menu reflects both the next time it opens.
3. **Given** `chromium` and `firefox` selected, **When** the developer runs the test at the
   cursor, **Then** Playwright runs the test in exactly those two projects and the progress
   message names them.
4. **Given** `chromium` and `firefox` selected, **When** the developer chooses `chromium` in
   the menu, **Then** only `firefox` remains selected and the next run uses `firefox` alone.
5. **Given** only `firefox` selected, **When** the developer chooses `firefox` in the menu,
   **Then** the selection is left unchanged and the developer is told that at least one
   project must stay selected.
6. **Given** every project selected, **When** the developer runs a file, **Then** Playwright
   receives no project filter and runs its own default set, as it does today.

---

### User Story 2 - My choice survives a restart (Priority: P1)

The developer picks `firefox` and `webkit` on Monday, quits Zed, and on Tuesday opens the
same repository. The code action menu still shows `firefox` and `webkit` selected, and the
first run of the day uses them without any further click.

**Why this priority**: Upstream remembers the choice; a selection that resets at every start
would make the feature a chore in exactly the multi-browser repositories it exists for.

**Independent Test**: Select a non-default set of projects, fully quit the editor, reopen the
folder, open the menu, and confirm the same set is selected and used by a run.

**Acceptance Scenarios**:

1. **Given** a remembered choice for a config, **When** the editor restarts and discovery
   finishes, **Then** the remembered projects are selected without a question.
2. **Given** a remembered choice that names a project the config no longer defines, **When**
   discovery finishes, **Then** that name is dropped, the remaining remembered projects stay
   selected, and the developer sees one notice naming the dropped project.
3. **Given** a remembered choice whose projects were all removed from the config, **When**
   discovery finishes, **Then** the default selection applies and the developer sees one
   notice.
4. **Given** a config that gains a new project, **When** discovery finishes, **Then** the new
   project is listed but not selected, unless no choice was ever made and it is now the
   first project.

---

### User Story 3 - A team default in project settings (Priority: P3)

A team keeps `.zed/settings.json` in the repository and wants every member's first run to
use `chromium` and `firefox`, not just the first project. They write the project names into
the extension's settings for the folder. Members who never touched the picker get that set;
a member who picks something else keeps their own choice.

**Why this priority**: Zed settings are the native, shareable place for a default, and the
constitution names "default project" as a settings use. Upstream has no such setting, so this
is a Zed-only addition and must not block the P1 stories.

**Independent Test**: Put two project names into the folder settings, remove any remembered
choice, reopen the folder, and confirm the menu shows those two selected; then edit the
setting while the editor runs and confirm the menu follows without a restart.

**Acceptance Scenarios**:

1. **Given** folder settings naming `chromium` and `firefox` and no remembered choice,
   **When** discovery finishes, **Then** those two projects are selected.
2. **Given** folder settings naming a project that does not exist, **When** discovery
   finishes, **Then** the developer sees one warning listing the available project names,
   and the unknown name is ignored.
3. **Given** the settings change while the editor runs, **When** the developer opens the
   menu, **Then** it reflects the new default for configs without a remembered choice.

---

### Edge Cases

- A config with exactly one project: that project is always used, the menu offers no project
  entries, and nothing changes compared to the current release (no new prompt, no new
  wording in messages).
- A monorepo with several configs: each config has its own list and its own selection; the
  menu shows the projects of the config that owns the current file (nearest config wins, as
  today).
- A test that exists only in unselected projects: it gets no run lens and no "run test at
  cursor" action; running the whole file still works and runs the tests that are in selected
  projects. Changing the selection updates the lenses of open files without reopening them.
- A selection that leaves nothing to run for the chosen target (for example a file whose
  tests are all in unselected projects): the run is refused with a message naming the
  selected projects, nothing is started.
- Playwright project dependencies (setup projects): Playwright decides what else runs when a
  project is selected; the extension passes the selected names and does not second-guess the
  dependency graph.
- Project names containing spaces or shell characters: passed to Playwright exactly, never
  through a shell.
- Discovery fails after a successful run: the last known project list and selection stay in
  place until discovery succeeds again.
- Re-run last: uses the selection current at the time of the re-run, not the one from the
  original run.
- Folder not yet trusted (feature 003) or discovery declined (feature 002): the picker is
  not offered, because the project list comes from discovery and nothing runs before consent.
- The editor is not Zed: the picker is still plain code actions, so any LSP client with a
  code action menu works; remembered choices are keyed by config path, not by editor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST take each config's project names from Playwright's own
  discovery output and MUST NOT read or parse the config file for them.
- **FR-002**: From any served file that belongs to a config with two or more projects, the
  developer MUST be able to see every project of that config and whether it is selected.
- **FR-003**: The developer MUST be able to toggle any single project, and any number of
  projects MAY be selected at once; a toggle that would leave no project selected MUST be
  refused with a message.
- **FR-004**: The developer MUST be able to select every project of a config with one action.
- **FR-005**: Run at cursor, run file and re-run last MUST run only in the selected projects
  of the target's config; when every project is selected, no project filter MUST be sent.
- **FR-006**: When no choice exists for a config and no settings default applies, the
  selection MUST default to the first project in the order Playwright reports them, as
  upstream does (owner decision 2026-10-14).
- **FR-007**: A config with a single project MUST behave as if that project is selected and
  MUST NOT offer project entries in the menu.
- **FR-008**: The system MUST remember the developer's choice per config by project name
  in a per-user store outside the workspace, keyed by the config's path, so that it survives
  editor restarts and never writes into the repository (owner decision 2026-10-14, mirrors
  upstream's workspace state).
- **FR-009**: After every discovery, the system MUST reconcile a remembered choice with the
  new project list: unknown names are dropped, new names stay unselected, an empty result
  falls back to the default, and the developer is told once per change.
- **FR-010**: Run lenses and the cursor-level run actions MUST be offered only for tests that
  run in at least one selected project, and MUST follow a change of selection without the
  developer reopening the file.
- **FR-011**: The progress message and the run log MUST name the projects a run used when
  the config has two or more projects; the pass/fail summary keeps its upstream-like
  wording, and a single-project config keeps today's messages unchanged.
- **FR-012**: The system MUST accept a default selection per folder from the editor's
  settings; it applies when no remembered choice exists and replaces the FR-006 default,
  takes effect without a restart,
  and unknown names produce one warning that lists the available projects.
- **FR-013**: Selection MUST never cause workspace code to run before the consent and
  trust gates of features 002 and 003 allow it.
- **FR-014**: The parity matrix row "Playwright project detection and selection" MUST move
  to `full`, with the settings default recorded as a `zed-only` note.
- **FR-015**: All user-facing text MUST use Playwright's word "project" first and may add
  "browser" in parentheses where upstream does.

### Key Entities

- **PlaywrightProject**: a named entry of a config's project list as Playwright reports it;
  belongs to exactly one PlaywrightConfig; may run in a named browser.
- **ProjectSelection**: the set of selected project names for one PlaywrightConfig, with its
  origin (default, remembered, settings, or chosen in this session) and the time of the last
  change.
- **PlaywrightConfig** (existing): gains its list of PlaywrightProjects and one
  ProjectSelection.
- **RunRequest** (existing): gains the project names the run was started with, for messages
  and the log.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a config with three projects, a developer goes from "one browser selected"
  to "test running in two browsers" in at most four interactions (open menu, toggle, run,
  confirm nothing else) and under 30 seconds, not counting Playwright's own run time.
- **SC-002**: A run started with a partial selection produces one result per selected
  project and zero results for unselected projects, in 100% of runs.
- **SC-003**: After a full editor restart, the remembered selection is applied to the first
  run without any click, in 100% of restarts.
- **SC-004**: Repositories with a single-project config see no behavior change: the same
  commands, no new message, and identical run arguments to release 0.4.0.
- **SC-005**: `docs/parity.md` shows the capability as `full`, and the verification record
  contains a reproducible run in at least two projects of the sample project.

## Assumptions

- "Pick the browser" means picking a Playwright project. The extension does not inspect
  which browser a project uses; it shows project names, exactly as upstream does. Owner
  decision 2026-10-14: no separate browser picker. Playwright rejects `--browser` when a
  config defines projects, upstream offers none, and real-world configs always define
  projects. A config without a `projects` array is reported by Playwright as one unnamed
  project and is treated as a single-project config (no picker, unchanged arguments).
- Config selection (upstream's "select config" dropdown and per-config enable switch) stays
  out of scope. The extension keeps "nearest config wins" per file, which already gives each
  config of a monorepo its own run target, so the user need is covered differently.
- Debugging and watch mode are not implemented yet; this feature defines the selection and
  applies it to runs. Later features that start Playwright reuse the same selection.
- The code action menu is the picker. Zed offers no checkbox list, sidebar or status bar to
  extensions, and the constitution forbids emulating them. A menu entry per project with a
  textual check mark is the closest native fit and works in other LSP clients too.
- The project list is read from the JSON output of Playwright's `--list`, which already
  drives discovery today, so no new workspace code runs because of this feature.
- The sample project gains a second project that reuses Chromium (for example a mobile
  viewport), so automated and manual verification need no extra browser download.
- The settings default (User Story 3) is `zed-only`; the upstream extension has no setting
  for project selection.
- The per-user store holds only config paths, project names and timestamps; it is not part
  of the repository and is never read before the trust and consent gates allow discovery.
