# Feature Specification: User Docs Site and README Restructure

**Feature Branch**: `010-user-docs-site`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "This will be a chore/docs feature. No publishing new extensions. The feature is: 1) Prepare the README.md for usage by users. So restructure it, so that user of the plugin can find all relevant information - installation, functionalities, limitations etc at the top. Development related information to be at the bottom 2) Design a github page, that would serve as promo/documentation page for the user. The repo will have a webpage set up, after it is deployed. The link to the page will be at the top of the README. The framework for the site could be for example Astro.js with suitable plugins. All deps are to be latest stable version, unless there would be dependency problems. The docs site will be written in typescript. You will create design mocks that will be served locally, so I can choose, comment and pick the one i want. Also, the page should have screenshots of zed and plugin usage for functionalities it offers."

## Upstream Reference

This is a documentation feature, not a new upstream capability; no row of `docs/parity.md`
changes. The reference for the documentation itself is how the upstream extension
(https://github.com/microsoft/playwright-vscode) presents itself to its users: a README that
opens with what the extension does, requirements and installation, then one short section per
capability (run tests, show browser, show trace viewer, pick locator, record new test, and
so on), each with a screenshot of the editor while the capability is in use, and nothing
about building or testing the extension itself. The marketplace listing repeats that
material with the same screenshots. A user of the upstream extension sees pictures of the
feature before reading how to use it.

The Zed extension today has a single README that mixes the user material (requirements,
install, settings, usage, differences from the VS Code extension) with the maintainer's
material (manual testing procedure, development commands, publishing notes), has no
screenshots, and no web presence beyond the repository. This feature gives the user the
upstream-style reading order in the README and a dedicated documentation and promotion site
with screenshots of Zed running the extension, one per offered capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Zed user reads the README and gets going (Priority: P1)

A Zed user who found the extension (in the Zed extension listing, on GitHub, or through a
link) opens the README. In the first screen they learn what the extension does, that it is
a work in progress and independent of Microsoft, and where the documentation site is. The
sections that follow, in this order, tell them what they need before installing, how to
install, what the extension can do today, how to use each capability, which Zed settings
to turn on, what the known limitations and differences from the VS Code extension are, and
how to ask for help. Everything a maintainer or contributor needs (building, manual
testing, development commands, publishing, AI-assistance disclosure details) sits after the
user material, under one clearly named part of the document, so a user can stop reading
when the user part ends.

**Why this priority**: the README is the one document every user sees, on GitHub and in any
tool that renders it; the site builds on its content. It is the smallest change with the
largest effect and it is independent of the site.

**Independent Test**: open the README on GitHub as a first-time user, note the headings in
order, and check that every user topic (requirements, install, capabilities, usage,
settings, limitations, support) appears before the first maintainer topic; check the first
screen for the site link.

**Acceptance Scenarios**:

1. **Given** the README on the default branch, **When** a reader looks at the first screen
   (the title and the first paragraphs, before scrolling), **Then** they see a one-paragraph
   description of the extension, the work-in-progress and non-affiliation notices, and a
   link to the documentation site.
2. **Given** the README's table of contents or heading order, **When** the reader lists the
   headings, **Then** every user heading (requirements, install, what it does, usage of each
   capability, settings, limitations and differences from the VS Code extension, getting
   help) comes before every maintainer heading (manual testing, development, publishing),
   and the maintainer headings are grouped under one part whose name makes clear it is for
   contributors.
3. **Given** the existing README content, **When** the restructured README is compared with
   it, **Then** no user-facing fact is lost: every capability, setting, state-file location,
   caveat and recipe present today is still present, possibly shortened, moved or reworded,
   and nothing stale (such as "only the first slice is implemented") remains.
4. **Given** the README is read without network access to the site, **When** the user
   follows the install and usage sections, **Then** they can install and use every capability
   from the README alone; the site adds pictures and navigation, not required facts.

---

### User Story 2 - The owner picks a site design from local mocks (Priority: P2)

Before the site is built, the owner is shown several complete design proposals for the site
(a landing page and a documentation page of each), served on their own machine, so they can
open them in a browser, compare, comment, and pick one. Each proposal differs in visible
ways (layout, typography, colour, how the landing and the docs relate) rather than in
details. The owner's choice, and any comments, are recorded with the feature so the site
is built to that design and later changes can be traced to the decision.

**Why this priority**: the owner asked to choose the design before anything is built; a site
built on an unapproved design would be redone. It depends on nothing else and can be done
in parallel with the README.

**Independent Test**: run one documented command, open the local address it prints, see a
chooser that lists the proposals, open each, and record a pick.

**Acceptance Scenarios**:

1. **Given** the feature branch checked out and the documented setup done, **When** the
   owner runs the documented command, **Then** a local address opens that lists every
   proposal by name with a short description and a link to its landing page and its docs
   page.
2. **Given** a proposal is open, **When** the owner resizes the window from desktop to phone
   width, **Then** the layout stays readable with no horizontal scrolling, and the page
   follows the system light or dark preference.
3. **Given** at least three proposals, **When** the owner compares them, **Then** each uses
   the same real content (the extension's name, description, one capability section with a
   placeholder screenshot frame, the install steps) so the comparison is about design only.
4. **Given** the owner has picked a proposal and left comments, **When** the decision is
   recorded in the feature directory, **Then** it names the chosen proposal, the date and
   the requested changes, and the other proposals are removed or kept only as a record, not
   deployed.

---

### User Story 3 - A visitor reads the published site with screenshots (Priority: P3)

A visitor opens the site from the README link or a search result. The landing page says in
one sentence what the extension is, shows one screenshot of Zed with the extension in use,
and offers the install steps and a way into the documentation. The documentation covers the
same topics as the README's user part, each capability on its own page or section with a
screenshot of Zed showing that capability (the run lenses above a test, the code action menu
with the Playwright entries, a run result notification with a failing-line marker, the step
duration labels, the run output tab, the project picker, the trace viewer window, the shown
browser window), plus the settings, the limitations and differences from the VS Code
extension, the parity table, and how to get help. The site is legible on a phone and in
light and dark mode, and every internal link works.

**Why this priority**: the site is the promotional and reference surface the owner asked
for; it depends on the chosen design (story 2) and reuses the README content (story 1).

**Independent Test**: build the site locally, open it, walk every navigation entry, and check
that every capability named in the README's "what it does" section has a page or section
with at least one screenshot of Zed, and that the screenshots show the current version of
the extension.

**Acceptance Scenarios**:

1. **Given** the site is built, **When** the landing page opens, **Then** it shows the
   extension name, a one-sentence description, a screenshot of Zed with the extension in
   use, the install steps (or a prominent link to them), the work-in-progress and
   non-affiliation notices, and links to the documentation, the repository and the issue
   tracker.
2. **Given** the documentation navigation, **When** a visitor opens the page for any
   capability the extension offers today (run a test, describe or file, re-run, project
   selection, step labels, run output, trace viewer, show browser, close all browsers,
   discovery consent), **Then** the page explains how to invoke it in Zed, what to expect,
   and shows at least one screenshot of Zed taken with the extension's current release on
   the sample project, with the image described in text for readers who cannot see it.
3. **Given** a screenshot on any page, **When** compared with the current README's
   description of that capability, **Then** the picture shows what the text describes (for
   example, the step duration label after a run, not a mock-up) and shows no personal data,
   private paths or unrelated windows.
4. **Given** the site's pages, **When** every link is followed, **Then** none is broken, and
   every outbound link (Zed docs, Playwright docs, upstream extension, repository, issues,
   parity table) points at the intended target.
5. **Given** the site, **When** opened at phone width or with the system set to dark mode,
   **Then** the content stays readable without horizontal scrolling and the colours follow
   the preference.

---

### User Story 4 - The site is published from the repository (Priority: P4)

Once the owner approves the built site, it is published at a stable address under the
repository's own web hosting, and the README's first screen links to that address. Later
changes to the site's source on the default branch republish it without manual steps, and a
change that breaks the site build is reported before it is merged.

**Why this priority**: without publication the site serves nobody; it comes last because it
depends on the finished site and on the owner's go-ahead for the outward-facing step.

**Independent Test**: after the owner enables hosting and the first publication, open the
address from a machine without the repository, see the site; open a change to the site
source and see the build check run on it.

**Acceptance Scenarios**:

1. **Given** the site source merged to the default branch and hosting enabled by the owner,
   **When** the publication finishes, **Then** the site is reachable at the repository's
   stable web address and the README link resolves to it.
2. **Given** a proposed change that breaks the site build, **When** it is checked before
   merge, **Then** the check fails and names the error; a change that does not touch the
   site or the README leaves the existing checks unchanged.
3. **Given** the owner has not yet approved publication, **When** the feature's other work is
   complete, **Then** nothing is deployed and the README's link is present but marked as
   pending, or the link is added only in the publication step.

---

### Edge Cases

- A capability changes after the screenshots are taken (new menu entry, renamed action):
  each screenshot records which extension version and sample project state it shows, and the
  documentation lists which screenshots belong to which capability, so the stale ones can be
  found and retaken.
- A screenshot shows the Zed window on Linux; the Zed window chrome and theme differ from
  macOS or Windows. The screenshots are taken with a default Zed theme and the pages say the
  editor looks different per platform.
- The README is rendered by tools that do not support HTML or badges; the first-screen
  content (notices, site link) must be plain Markdown that renders everywhere.
- The site is visited before hosting is enabled, or the hosting address changes: the README
  link is the only place that hard-codes the address, and the site's own internal links are
  relative.
- The visitor has scripting disabled: every page's text, navigation and images are readable
  without it.
- The site build pulls dependencies that are not the latest stable at the time of a later
  rebuild: the build pins exact versions so a rebuild reproduces the same site.
- The parity table on the site drifts from `docs/parity.md`: the site reads or links to the
  repository's table rather than keeping a copy.
- The proposals are served locally while the owner reviews: no proposal is reachable from
  outside the owner's machine and none is deployed.

## Requirements *(mandatory)*

### Functional Requirements

README

- **FR-001**: The README MUST open with the extension name, a one-paragraph description,
  the work-in-progress notice, the non-affiliation and trademark notice, and a link to the
  documentation site, all within the first screen and in plain Markdown.
- **FR-002**: The README MUST present the user material in this order before any maintainer
  material: requirements, install, what it does, usage per capability, settings, limitations
  and differences from the VS Code extension, getting help (issue tracker).
- **FR-003**: The README MUST group every maintainer topic (building from source for
  development, manual testing, development commands, publishing, release notes about AI
  assistance beyond the short disclosure) under one part whose heading identifies it as
  contributor or maintainer material, placed after the user material.
- **FR-004**: The restructured README MUST keep every user-facing fact of the current README
  (capabilities, settings, state-file locations, caveats such as the restart after reinstall,
  the discovery consent flow, the terminal task recipe, the project, trace and browser
  sections) and MUST remove or correct statements that no longer hold.
- **FR-005**: The README MUST keep the short AI-assistance disclosure visible to users (the
  owner's standing decision) and MUST keep the license section.
- **FR-006**: The README's "from source" install steps MUST be aimed at users who want the
  unreleased version, and the developer variant (local server entry override) MUST move to
  the maintainer part.

Design selection

- **FR-007**: The feature MUST provide at least three visibly distinct site design proposals,
  each with a landing page and a documentation page built from the same real content, served
  on the owner's machine by one documented command, with a chooser page listing them.
- **FR-008**: Each proposal MUST render at phone and desktop widths without horizontal
  scrolling and MUST follow the system light or dark preference.
- **FR-009**: The owner's choice, the date and their comments MUST be recorded in the feature
  directory before the site is built, and the proposals not chosen MUST NOT be deployed.

Site

- **FR-010**: The site MUST have a landing page with the extension name, a one-sentence
  description, a screenshot of Zed with the extension in use, the install steps or a
  prominent link to them, the work-in-progress and non-affiliation notices, and links to the
  documentation, the repository and the issue tracker.
- **FR-011**: The site's documentation MUST cover every topic of the README's user part:
  requirements, install, each offered capability, settings, limitations and differences from
  the VS Code extension, the parity table (rendered from or linked to `docs/parity.md`, not a
  copy maintained by hand), and getting help.
- **FR-012**: Every offered capability (run test, run describe, run file, re-run last,
  discovery consent, project selection, executing-step and duration labels, show last run
  output, show trace viewer and show trace, show browser, close all browsers) MUST have at
  least one screenshot of Zed showing that capability in use with the extension's current
  release on the sample project, with a text description of the image.
- **FR-013**: Screenshots MUST show no personal data and no unrelated windows; paths
  outside the sample project are acceptable only under the owner's home directory, whose
  name is already public as the GitHub handle (for example the Node binary in the run
  output), and each screenshot MUST record the extension version and Zed version it was
  taken with.
- **FR-014**: The site MUST be readable on a phone, in light and dark mode, and without
  scripting; every internal link MUST resolve and every outbound link MUST point at its
  intended target.
- **FR-015**: The site's source MUST live in the repository and its dependencies MUST be the
  latest stable releases at the time of writing, pinned exactly, with any exception (an
  older version kept because of a conflict) recorded with its reason.
- **FR-016**: The site MUST build with one documented command and the build MUST be checked
  on every proposed change that touches the site, failing the check on a build error.

Publication

- **FR-017**: The site MUST be published at a stable address under the repository's own web
  hosting after the owner's explicit approval, and republished automatically from the
  default branch afterwards; the README link MUST point at that address.
- **FR-018**: The feature MUST NOT release a new extension or language server version; the
  extension version and the registry submission stay as they are.

### Key Entities

- **README user part**: the ordered set of sections a Zed user needs; mirrors the site's
  documentation topics.
- **README maintainer part**: the sections for contributors (manual testing, development,
  publishing); placed after the user part.
- **Design proposal**: a named, self-contained landing page plus documentation page sharing
  the real content; attributes: name, short description, distinguishing traits, local
  address; one becomes the chosen design.
- **Design decision record**: the chosen proposal, date, owner comments and requested
  changes.
- **Capability page**: one documentation page or section per offered capability; attributes:
  invocation in Zed, expected result, screenshots, related settings, known limitations.
- **Screenshot**: an image of Zed with the extension in use; attributes: capability shown,
  extension version, Zed version, platform, text description, sample project state.
- **Site publication**: the stable address, the branch it is built from, the build check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time reader finds the install steps and the site link within the first
  two screens of the README, and every user heading precedes every maintainer heading
  (verified by listing the headings in order).
- **SC-002**: Every user-facing fact of the current README is present in the restructured one
  (verified by a checklist of the current sections and their facts, each ticked with its new
  location).
- **SC-003**: The owner can open, compare and pick from at least three design proposals on
  their machine after one documented command, and the pick is recorded with the feature.
- **SC-004**: Every offered capability has a documentation page or section with at least one
  real screenshot of Zed, taken with the current extension release; a reviewer can match each
  screenshot to the behaviour the text describes.
- **SC-005**: The site has zero broken internal links and every outbound link reaches its
  intended target, checked on the built site.
- **SC-006**: The landing and every documentation page are readable at phone width and in
  dark mode without horizontal scrolling, checked in a browser at both widths and both
  preferences.
- **SC-007**: After the owner's approval, the site is reachable at the repository's stable
  web address within one working day, and a change to the site source on the default branch
  is live without manual steps.
- **SC-008**: The extension and language server versions are unchanged by this feature.

## Assumptions

- The site is hosted under the repository's own GitHub web hosting (the project page address
  derived from the owner and repository names); enabling that hosting and the first
  publication are outward-facing steps the owner approves explicitly, as the project rules
  require for anything outward-facing.
- Three design proposals are enough for the choice; more are added only if the owner asks
  after seeing them. The proposals are complete pages, not sketches, and are served from the
  feature branch on the owner's machine.
- Screenshots are taken with the Zed installed on this machine (native Ubuntu 26.04 LTS,
  Wayland session, Zed 1.26.2), on the sample project in `fixtures/sample-project`, with a
  default Zed theme, at the current extension release (0.8.0). Whether the capture is scripted or by hand is a planning decision; the result is
  the same set of images. The pages note that the editor looks different per platform.
- The README stays complete for users without the site (the site adds screenshots and
  navigation). To limit drift, the site's capability pages are written from the README's
  user sections and the parity table is rendered from or linked to `docs/parity.md`.
- The owner suggested a static site framework written in TypeScript with current stable
  dependencies; the choice of framework, plugins and theme is a planning decision made for
  the chosen design, within the constraints of FR-015.
- The site does not collect analytics or any visitor data.
- The feature is a chore/docs change: no extension or server version bump, no npm publish,
  no registry update. The README changes reach the default branch through the normal pull
  request flow; the registry submission keeps referencing the existing tag.
- The existing "Manual testing" procedure and the "Development" commands keep their content
  and only move; the per-feature verification records under `specs/` are unchanged.
