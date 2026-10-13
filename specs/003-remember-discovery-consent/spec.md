# Feature Specification: Remember Discovery Consent per Folder

**Feature Branch**: `003-remember-discovery-consent`

**Created**: 2026-10-13

**Status**: Draft (revised 2026-10-13 after planning research, see "Revision" below)

**Input**: User description: "Currently, user of this extension must interact with discovery popup every time. Investigate, whether it is possible to enable it only once per repository with playwright config, so that user does not need to confirm everytime he opens Zed in given project"

## Revision

The first draft of this spec asked for the extension's own remembered choice: a third answer
in the question, a forget action, and per-user storage. Planning research (see
[research.md](./research.md), R1 to R3) found that Zed added the missing mechanism itself in
release 0.218 (January 2026). Zed's **worktree trust** (Restricted Mode) asks once per folder,
remembers the answer across restarts, lets the user revoke it, and does not start any
language server for a folder, this extension's included, until the folder is trusted. Feature
002 had assumed that Zed has no workspace trust; that is no longer true.

On 2026-10-13 the owner chose to rely on Zed's worktree trust instead of building a second,
parallel trust store. This revision describes that choice. The first draft's user stories 3
and 4 (forget action, enable and remember) are covered by Zed's own revoke and trust actions
and are dropped.

## Upstream Reference

This feature refines the `zed-only` discovery gate from feature 002, which stands in for the
**Playwright project detection** safeguard that upstream gets from VS Code. In VS Code, the
upstream Playwright extension (https://github.com/microsoft/playwright-vscode) relies on
Workspace Trust. The first time a folder opens, VS Code asks whether the user trusts its
authors. VS Code remembers the answer for that folder on that machine, so reopening it later,
even after a restart, does not ask again. The user can revoke trust at any time, and a user
who turns Workspace Trust off accepts every folder. The extension itself never asks.

Zed now offers the same thing. With this feature, the extension behaves as upstream does on
Zed releases that have worktree trust: the editor asks, the editor remembers, and the
extension does not ask a second question. On editors without such a gate, the feature 002
question stays in place.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust a project once (Priority: P1)

A developer works on the same Playwright repository every day. The first time they open it,
Zed asks whether to trust the folder, and they trust it. From then on, every time they open
the folder, even after a restart, test discovery runs without any question from the
extension, and run lenses appear as soon as discovery finishes.

**Why this priority**: This is the request. Today a developer who trusts a project answers
Zed's trust question once and then the extension's question at every start, which teaches
them to click without reading.

**Independent Test**: In Zed 0.218 or newer, open the sample project in a folder Zed already
trusts, quit Zed fully, reopen the folder, and confirm that the extension shows no question
and that run lenses show up.

**Acceptance Scenarios**:

1. **Given** a Zed release with worktree trust and a folder Zed trusts, **When** the developer
   opens the folder, **Then** the extension asks nothing and discovery starts on its own.
2. **Given** the same setup, **When** Zed is restarted and the folder reopened, **Then** the
   extension again asks nothing and run lenses appear.
3. **Given** a Zed release with worktree trust and a folder Zed does not trust yet, **When**
   the developer opens the folder, **Then** nothing from the extension runs and no Playwright
   affordance appears until the developer trusts the folder in Zed; after that, discovery
   starts without a question from the extension.
4. **Given** the developer revokes trust in Zed, **When** Zed restarts and the folder is
   reopened, **Then** Zed asks again and the extension runs nothing until the folder is
   trusted again.

---

### User Story 2 - A repository cannot trust itself (Priority: P1)

A developer clones an unfamiliar repository whose files try to mark the folder as trusted or
switch trust checks off. Opening it runs nothing from the folder until the developer trusts
it in Zed.

**Why this priority**: The gate from feature 002 exists to stop code from running on open.
Relying on the editor's trust must not open a way around it.

**Independent Test**: Commit to a test project a project settings file that tries to turn off
trust checks, open it in Zed 0.218 or newer without trusting it, and confirm that the
configuration's load marker stays absent and no Playwright affordance appears.

**Acceptance Scenarios**:

1. **Given** a never-trusted folder whose own content claims to be trusted or tries to turn
   trust checks off, **When** it is opened, **Then** nothing from the folder executes before
   the developer trusts it in Zed.
2. **Given** a trusted folder, **When** its contents are copied to a never-trusted location
   and opened there, **Then** nothing executes until the copy is trusted.

---

### User Story 3 - Editors without a trust gate keep the question (Priority: P2)

A developer uses a Zed release older than 0.218, or another editor that starts the language
server. The extension cannot rely on a trust gate there, so it keeps the feature 002 question,
per folder and per session, exactly as before.

**Why this priority**: The protection must not disappear for anyone whose editor does not
provide it. This matters less than story 1 because current Zed releases all have the gate.

**Independent Test**: Start the language server with editor information that names an older
Zed release, or no editor information at all, and confirm that the feature 002 question is
shown and nothing runs before an answer.

**Acceptance Scenarios**:

1. **Given** an editor that does not identify itself as Zed 0.218 or newer, **When** a folder
   with Playwright opens, **Then** the feature 002 question is shown and every feature 002
   behaviour applies unchanged.
2. **Given** the extension cannot tell which editor started it, **When** a folder with
   Playwright opens, **Then** it asks as in feature 002.

---

### Edge Cases

- **Trust checks turned off by the user.** A user can set Zed to trust every folder
  automatically. Zed then starts the extension everywhere, and the extension runs discovery
  without asking. This matches upstream, where turning Workspace Trust off has the same
  effect. It is the user's own decision in their user settings; a repository cannot make it.
  The README states this.
- **Folder reached through a different path.** The extension relies on Zed's notion of which
  folder is trusted, including Zed's option to trust a parent folder and everything below it.
- **A file opened on its own, outside any open folder.** Zed may auto-trust it, but it comes
  with no folder, so the extension discovers nothing for it.
- **The editor reports a folder only as a fallback root, not as a workspace folder.** The
  extension does not count such a folder as trusted and asks as in feature 002.
- **Remote and container projects.** On SSH and WSL remotes, Zed tracks trust per host and
  gates the language server the same way. Zed does not apply worktree trust inside dev
  containers; a container opens only after the developer chooses to open it, which already
  runs the repository's container definition. The extension treats it like any Zed 0.218+
  session, and discovery runs inside the container (research R8).
- **Unsupported Playwright version.** Unchanged from feature 002: the version warning is shown
  and no discovery runs, trusted or not.
- **Discovery fails in a trusted folder.** The discovery-failed warning from feature 001
  applies; the folder stays enabled for the session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the editor that started the extension identifies itself as a Zed release
  with worktree trust (0.218 or newer, any release channel), the extension MUST treat every
  workspace folder that the editor hands over as trusted and MUST run discovery for it
  without asking.
- **FR-002**: In every other case (older Zed, another editor, or no editor identification),
  the extension MUST keep the feature 002 behaviour unchanged: one question per folder per
  session, nothing executed before agreement, the enable action, and the refusal messages.
- **FR-003**: A folder that reaches the extension only as a fallback root, not as a workspace
  folder, MUST NOT be treated as trusted by FR-001; it gets the feature 002 question.
- **FR-004**: The extension MUST NOT read any file, setting, or other content from the
  workspace to decide whether a folder is trusted. Only the editor's identification counts.
- **FR-005**: When discovery starts because of the editor's trust, the extension MUST record
  that in its log, naming the folder and the reason, so a developer can tell why no question
  appeared.
- **FR-006**: The troubleshooting status MUST show, per folder, whether discovery was enabled
  by the editor's trust or by an answer in this session.
- **FR-007**: All text added by this feature MUST be in English.
- **FR-008**: The parity matrix row for the discovery gate MUST say that on Zed 0.218 and newer
  the gate is Zed's worktree trust, as with VS Code Workspace Trust upstream, and that the
  feature 002 question remains as the fallback. The README and quickstart MUST explain that
  Zed's trust decides, how to revoke it, and what turning on Zed's trust-all setting means.

### Key Entities

- **Workspace** (from feature 002): its discovery decision gains a source, either the editor's
  trust or an answer in this session.
- **Editor Trust Gate**: whether the editor that started the extension is known to start it
  only in trusted folders. Determined once per session from the editor's identification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In Zed 0.218 or newer, reopening a trusted folder in 10 consecutive fresh
  sessions shows the extension's question 0 times, and run lenses appear each time.
- **SC-002**: In an automated check, a configuration that records when it is loaded is never
  loaded before an answer when the editor does not identify itself as Zed 0.218 or newer
  (100% of runs).
- **SC-003**: In Zed 0.218 or newer, an untrusted folder whose own settings try to turn off
  trust checks produces zero executions of its configuration before the developer trusts it.
- **SC-004**: A developer who has trusted a folder in Zed reaches run lenses without any extra
  click from the extension.
- **SC-005**: All feature 002 automated checks pass unchanged for editors without a trust gate.

## Assumptions

- "Repository with Playwright config" from the request means a workspace root folder, as in
  feature 002. Zed's trust applies per folder (or per trusted parent folder).
- Zed's worktree trust is a documented, stable feature (zed.dev docs "Zed and trusted
  worktrees", release notes of 0.218.5). If Zed removes or weakens it, this feature is
  re-planned.
- The editor identification sent at startup is reliable enough to tell Zed from other
  editors. A tool that pretends to be Zed is launching the extension itself and could run
  anything anyway, so the identification is not a security boundary against such a tool.
- A setting that brings back the extension's own question on top of Zed's trust is out of
  scope; the owner chose to rely on Zed's trust alone. It can be added later if users ask.
- Remembering the extension's own decision across sessions (the first draft) is dropped,
  because Zed's trust already provides it without a second store.
