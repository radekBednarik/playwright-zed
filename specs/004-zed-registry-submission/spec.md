# Feature Specification: Zed Registry Submission

**Feature Branch**: `004-zed-registry-submission`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "let's prepare everything that is needed to create PR for registering the extension in Zed. Check all required rules the Zed repo has, including licences and AI authorship."

## Upstream Reference

The upstream Playwright VS Code extension (https://github.com/microsoft/playwright-vscode)
reaches its users through the Visual Studio Marketplace: a user searches for "Playwright",
clicks install, and the extension updates itself from then on. This feature is the Zed
counterpart of that distribution channel. Zed has no self-service marketplace; every
extension is listed by a pull request against the registry repository
`zed-industries/extensions`, reviewed by Zed staff, and only then becomes searchable in
`zed: extensions`. The feature is a release milestone rather than an editor capability, so it
adds no row to the parity matrix. It does unblock the "Install" section of the README, which
today says the registry listing is pending.

## Registry Rules Found (2026-10-13)

The rules below were read from the live sources on the date above and drive the
requirements. Sources: the registry README, `CONTRIBUTING.md`, `AI_POLICY.md`, the pull
request template, the registry's own continuous integration workflow and validation
scripts, and the Zed docs pages for publishing (overview, prerequisites, licence
requirements, publishing guide, updating and maintenance, FAQ).

**Submission process**

- Fork the registry to a personal account (not an organisation), so Zed staff can push
  fixes to the PR branch. Clone it and initialise submodules.
- Add the extension repository as a git submodule at `extensions/<extension-id>` using an
  HTTPS URL. The repository must be public and the submodule commit must be on a branch.
- Add an entry to the registry's `extensions.toml` keyed by the extension id, with
  `submodule` and `version`. The `version` must equal the version in the extension's own
  manifest at that commit.
- Sort `extensions.toml` and `.gitmodules` with the registry's sort script before opening
  the PR; the pipeline fails when they are unsorted.
- One extension per PR, at most three open PRs per contributor, maintainer feedback
  answered within three weeks or the PR is closed. PRs that violate the rules are closed
  without feedback; repeat violations can lead to a ban.
- The PR template has a single checkbox confirming that the contribution guidelines were
  read and followed. An automated check fails any PR that does not touch `extensions.toml`
  and applies general PR hygiene rules (non-empty title and description).
- First feedback usually arrives within a few weeks, sometimes one to two months. A PR
  closed with little feedback nearly always violated a prerequisite.

**Automated checks the registry runs on every PR**

- Extension id: lowercase letters, digits and hyphens only; must not start with `zed-`, end
  with `-zed`, or contain `extension`.
- Display name: must not start with `Zed `, must not end with ` Zed`, must not contain the
  word `extension` in any casing. **The current display name "Playwright for Zed" fails this
  check and must change before submission.**
- The id in the registry entry must equal the id in the extension manifest, and the
  submodule must be named and located at `extensions/<id>`.
- The version must be plain semantic `major.minor.patch` with no prefix or suffix, must
  match the manifest at the submodule commit, and must never decrease on updates.
- A licence file whose name starts with `LICENSE` or `LICENCE` must sit at the extension
  root and its text must match one of: Apache 2.0, BSD 2-Clause, BSD 3-Clause, CC BY 4.0,
  GPLv3, LGPLv3, MIT, Unlicense, zlib. Only the extension code needs this licence; tools the
  extension downloads (the language server) are out of scope. The repository's MIT file
  matches the registry's MIT pattern.
- The extension is compiled by the registry pipeline with Rust 1.90 for the
  `wasm32-wasip2` target through Zed's own packaging tool. The build must succeed there,
  not only on the developer's newer toolchain.
- No Git LFS in the submodule.
- The old `extension.json` manifest format is rejected; `schema_version` must be 1 if set.

**Prerequisites enforced by human review**

- Tested manually in Zed as a dev extension at the exact commit submitted. Clearly untested
  extensions are closed without feedback.
- Provide only functionality not already in the registry; the only Playwright-related entry
  today is `mcp-server-playwright`, which is an MCP server, not a test runner.
- An extension that only provides a language server should carry the id suffix
  `-language-server` or `-lsp`. The extension declares a language server and nothing else
  in its manifest, so the suffix applies. The owner settled the id as
  `playwright-runner-lsp` on 2026-10-13 (superseding `playwright-runner`, chosen earlier
  the same day): the `playwright-runner` stem states what the extension provides, as the
  prerequisites ask, and the `-lsp` suffix follows the publishing prerequisites to the
  letter. The registry has no entry with that id.
- Language servers must not be bundled; they are downloaded or detected at runtime (this
  extension installs its server from npm, which complies).
- Do not misuse the extension API to work around limitations.
- All user-facing text in English. Include only the resources the extension needs.
- Agent-server and slash-command extensions are no longer accepted (not relevant here).
- Ids cannot change after publication; display names can.

**AI policy (binding for the PR)**

- Using AI as a coding tool is welcome; the contributor remains responsible for the
  extension and is held to a high bar.
- Autonomous agents must not contribute to the registry. PRs that appear to violate this are
  closed, possibly without notice.
- Comments to maintainers, the PR body included, must be written by a human in their own
  words. AI-written responses must not be copied into replies. Comments believed to be
  AI-written may be hidden.
- AI context may be quoted only inside a quote block, disclosed as AI output, kept short,
  and accompanied by human commentary on its relevance.
- Using AI to polish English as a non-native speaker is allowed as long as the result keeps
  the author's own voice and ideas.

**Maintenance after listing**

- Updates are PRs that move the submodule and bump `version`; same rules as a new
  submission. A community GitHub Action can automate update PRs.
- No obligation to maintain, but bug reports should be answered in reasonable time. An
  owner can transfer or ask for removal. After six weeks without reply, others may fork and
  replace the extension.

## Clarifications

### Session 2026-10-13

- Q: Which extension id is submitted to the registry, given that the Zed publishing
  prerequisites ask language-server extensions to carry an `-lsp` or `-language-server`
  suffix? → A: `playwright-runner-lsp` (replaces the earlier decision `playwright-runner`;
  display name stays "Playwright Runner").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The owner opens a compliant registry PR (Priority: P1)

The extension owner wants to list the extension in Zed's registry. Everything that can be
prepared locally is ready for review: the registry fork clone with the submodule and entry
in place and sorted, a release of the extension whose metadata passes every automated
registry check, and a fact sheet listing what was verified and at which commit. The owner
reviews the prepared material, creates the fork, pushes, and opens the PR with a title and
body written in their own words.

**Why this priority**: This is the request. Without a compliant, human-authored PR the
extension never reaches Zed users.

**Independent Test**: Run the registry's own validation and packaging locally against the
prepared fork clone; every check passes. Then confirm that no PR text was drafted by the
agent and that the fact sheet contains only verifiable facts (commit, version, commands run,
outcomes).

**Acceptance Scenarios**:

1. **Given** the registry fork clone prepared on the owner's machine, **When** the owner
   inspects it, **Then** it contains exactly one new submodule at the id's path with an
   HTTPS URL pointing at the public repository, one new `extensions.toml` entry whose
   version equals the manifest at the submodule commit, and sorted `extensions.toml` and
   `.gitmodules`, with no other changes.
2. **Given** the prepared clone, **When** the registry's sort and packaging steps are run
   locally, **Then** they finish without error and report the extension's id and version.
3. **Given** the prepared material, **When** the owner opens the PR, **Then** the only
   actions left to them are: create the fork under their personal account, push the branch,
   write the PR title and body themselves, tick the template checkbox, and open the PR.
4. **Given** the owner is writing the PR body, **When** they look for supporting facts,
   **Then** the fact sheet gives them the submodule commit, the version, the Zed release
   the dev extension was tested in, the manual scenarios exercised, and the automated test
   results, each phrased as a fact and not as prose to paste.

---

### User Story 2 - The extension passes every automated registry check (Priority: P1)

Before the PR is opened, the extension's own repository is in a state that the registry
pipeline accepts: a display name that passes the name rules, an id that passes the id rules,
a licence the pipeline recognises, a version that matches the registry entry, and a build
that succeeds on the toolchain the registry uses.

**Why this priority**: The registry closes non-compliant PRs without explanation, and a
failed automated check is the most likely cause. Fixing this first avoids burning one of
the owner's limited review slots.

**Independent Test**: Run the registry's validation and packaging on the submission commit
and observe success; run the manual publishing self-check in `docs/publishing.md` and tick
every item.

**Acceptance Scenarios**:

1. **Given** the display name "Playwright for Zed", **When** the registry name rules are
   applied, **Then** the name is rejected; **and Given** the replacement display name,
   **When** the rules are applied again, **Then** it is accepted.
2. **Given** the submission commit, **When** the extension is built with the toolchain
   version the registry pipeline pins, **Then** the build succeeds and produces a manifest
   whose version and id equal the registry entry.
3. **Given** the licence file at the repository root, **When** the registry licence
   matcher is run, **Then** it is recognised as MIT.
4. **Given** the submission commit, **When** the owner checks the tag, **Then** a version tag
   points at it and the commit is on `main`.
5. **Given** the registry's `extensions.toml`, **When** the chosen id is looked up, **Then**
   no existing entry uses it.

---

### User Story 3 - A Zed user installs the extension from the registry (Priority: P2)

After the PR is merged, a Zed user opens `zed: extensions`, searches for "Playwright",
finds the extension with an accurate description, installs it, and on opening a trusted
Playwright project sees the run lenses without any manual setup beyond what the README
states.

**Why this priority**: This is the outcome the submission exists for, but it can only be
verified after the maintainers merge, which is outside the owner's control.

**Independent Test**: On a machine without the dev extension, install from the registry
and run the quickstart scenarios of feature 001.

**Acceptance Scenarios**:

1. **Given** the listing is merged, **When** a user searches the registry inside Zed,
   **Then** the extension appears under the chosen display name with the non-affiliation
   notice in its description.
2. **Given** the extension is installed from the registry, **When** a trusted Playwright
   workspace is opened, **Then** the language server is installed from npm at the pinned
   version and run lenses appear, matching the dev-extension behaviour.
3. **Given** the listing is merged, **When** the README is read, **Then** the install
   section describes the registry path first and the from-source path second.

---

### User Story 4 - The AI policy is respected end to end (Priority: P2)

The owner can show, if asked by a maintainer, that a human who understands the work is in
the loop: the repository discloses AI assistance, every registry-facing message is the
owner's own writing, and the agent's contribution stopped at local preparation and
verification.

**Why this priority**: A policy violation closes the PR, possibly silently, and repeat
violations can ban the owner from the registry. The cost of getting this wrong is higher
than any delay from being careful.

**Independent Test**: Review the PR, its comments and the repository: no text originates
from an agent except quoted, disclosed, short excerpts with human commentary; the fork,
push and PR actions were done by the owner.

**Acceptance Scenarios**:

1. **Given** the agent has finished preparation, **When** the owner reviews the hand-over,
   **Then** it contains no PR title, no PR body and no reply drafts, only a fact sheet and
   a checklist of what the owner must do personally.
2. **Given** a maintainer asks a question on the PR, **When** the owner replies, **Then**
   the reply is written by the owner; the agent may be used to look things up or verify a
   claim, and any quoted agent output is in a quote block and labelled as such.
3. **Given** the README's AI disclosure section, **When** it is compared with how the
   project is actually built, **Then** it is accurate at the submission commit.

---

### Edge Cases

- Maintainers ask for a different id, for example the longer `-language-server` suffix
  or a shorter stem. The id is renamed before merge, which also renames the submodule path
  and the registry entry; the npm package name of the language server does not change.
- A Zed user who installed the dev extension under the old id `playwright` later installs
  `playwright-runner-lsp` from the registry. Both can coexist under different ids; the README
  tells dev-extension users to uninstall the old one.
- Maintainers ask for a different display name or object to using the Playwright trademark
  in the name. The display name can change at any time; the description already carries
  the non-affiliation notice.
- The PR is closed without feedback. The owner re-reads the prerequisites, fixes the cause,
  and opens a fresh PR rather than reopening the old one, as the FAQ recommends.
- The owner cannot answer within three weeks. The PR is closed as stale; a new PR can be
  opened at any time.
- The registry toolchain (Rust 1.90) is older than the developer's and the lock file or a
  dependency does not build there. The dependency set is adjusted until the pinned
  toolchain builds; the local CI should build with the same version from then on.
- The npm package pinned by the extension is unpublished or changes between the tested
  commit and the review. The version is pinned in the extension, so review sees the same
  server; the fact sheet records the npm version and its publish date.
- The owner already has three open PRs on the registry. The submission waits.
- The fork is created under an organisation. Zed staff cannot push to it; the fork must be
  under the personal account.
- The version in the registry entry and the manifest drift because a later commit on
  `main` bumps the version. The submodule pins a commit, so the entry must be checked
  against that commit, not against `main` at the time of review.
- Git LFS is enabled in the extension repository. It is not today; the check stays in the
  self-check list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension repository MUST, at the submission commit, satisfy every
  automated registry check listed under "Registry Rules Found": id pattern, display name
  rules, licence match, manifest version equal to the registry entry, plain semantic
  version, no Git LFS, and a successful build with the registry's pinned toolchain.
- **FR-002**: The display name MUST be changed from "Playwright for Zed" to
  "Playwright Runner" (owner's decision, 2026-10-13). It passes the registry name rules,
  keeps "Playwright" recognisable to users migrating from VS Code, describes the test
  runner role, and does not imply affiliation with Microsoft.
- **FR-003**: The extension id MUST be `playwright-runner-lsp` (owner's decision,
  2026-10-13, superseding `playwright-runner`), final before the PR is opened because ids
  cannot change after publication. The stem describes what the extension provides, as the
  prerequisites ask, and the `-lsp` suffix complies with the publishing prerequisite for
  extensions whose manifest declares only a language server. It passes the automated id
  rules (lowercase letters and hyphens, no `zed-` prefix, no `-zed` suffix, no
  `extension`). Later debugger and task capabilities ship under the same id, since ids
  cannot change.
- **FR-004**: The submission MUST be a tagged release on `main` whose version is bumped
  from 0.3.0, because the display name and id changes alter the manifest and the registry
  needs a commit on a branch with matching version.
- **FR-005**: All project documents and metadata that mention the display name or id
  (manifest, crate metadata, READMEs, publishing doc, parity doc, project memory, language
  server package description) MUST be updated to the final values in the same release.
- **FR-006**: A local clone of the registry MUST be prepared, on a branch the owner later
  pushes to their fork, containing exactly: the submodule at `extensions/<id>` with the
  HTTPS URL of the public repository pinned to the release commit, the `extensions.toml`
  entry with the matching version, and sorted `extensions.toml` and `.gitmodules`. No other
  file may change. The fork itself is created by the owner.
- **FR-007**: The registry's own sort and package steps MUST be run locally against the
  prepared clone and MUST succeed before the material is handed to the owner.
- **FR-008**: The extension MUST be tested manually in Zed as a dev extension at the exact
  submission commit, covering representative quickstart scenarios of features 001 and 003
  (listing, discovery, run at cursor, run describe, run file, re-run last, trust gate), and
  the outcome MUST be recorded in this feature's verification record with the Zed release
  used. Feature 002's question cannot be shown on Zed 0.218 or newer; its renamed text is
  covered by an automated server test and the manual skip is recorded with that reason.
- **FR-009**: The npm install path MUST be verified at the submission commit: a Zed started
  without the local server override installs the pinned language server version from npm
  and the run lenses work.
- **FR-010**: The hand-over to the owner MUST consist of a fact sheet and a personal to-do
  checklist. The fact sheet MUST contain only verifiable facts (commit, tag, version, npm
  version, Zed release, commands run, outcomes). It MUST NOT contain a PR title, PR body,
  or reply text.
- **FR-011**: The owner, not the agent, MUST create the fork, push the branch, write the PR
  title and body, tick the PR template checkbox, open the PR, and write every subsequent
  comment. The agent's role ends at local preparation, verification and lookups.
- **FR-012**: Any AI output the owner chooses to quote on the registry MUST be short, inside
  a quote block, labelled as AI output, and followed by the owner's own commentary.
- **FR-013**: The README's AI disclosure and the non-affiliation notice MUST be accurate at
  the submission commit, and the README install section MUST describe the registry path
  as the primary route once the listing is merged.
- **FR-014**: `docs/publishing.md` MUST be updated so that its self-check list covers every
  automated and human-review rule found in this feature, including the display name
  rules, the pinned toolchain build, the AI policy, and the three-week response deadline.
- **FR-015**: The project's own CI MUST build the extension with the same Rust version the
  registry pins, so a future dependency bump cannot silently break the next registry
  update.
- **FR-016**: The parity matrix MUST NOT gain a row for this feature; the README and the
  project memory MUST record the submission state (prepared, PR open, merged) so the next
  session does not redo or re-ask the work.
- **FR-017**: Before the PR is opened the id `playwright-runner-lsp` MUST be confirmed absent
  from the registry's `extensions.toml`, and the owner MUST have fewer than three open PRs
  there.

### Key Entities

- **Registry entry**: the id-keyed record in the registry's `extensions.toml` with the
  submodule path and the version; paired with a `.gitmodules` record carrying the HTTPS URL.
- **Submission commit**: the tagged commit on `main` of this repository that the submodule
  pins; its manifest version, id, display name and licence are what the registry validates.
- **Fact sheet**: the owner-facing record of verified facts about the submission commit,
  stored in this feature's directory, used by the owner to write the PR in their own words.
- **Owner to-do checklist**: the ordered list of actions only the owner may perform under the
  AI policy, from forking to answering review.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The registry's automated checks pass on the first run of the PR, with zero
  pipeline failures attributable to the extension's metadata, licence, version or build.
- **SC-002**: Every item of the updated publishing self-check list is ticked with evidence
  before the owner opens the PR; no item is skipped.
- **SC-003**: The owner can open the PR within 30 minutes of receiving the hand-over, with no
  further local preparation needed beyond fork, push and writing the PR text.
- **SC-004**: Zero registry-facing messages (PR body, comments) originate from the agent;
  any quoted AI output is disclosed as such. Verified by the owner's review of the PR.
- **SC-005**: Once merged, a user can install the extension from `zed: extensions` and see
  run lenses in a trusted Playwright project within 5 minutes on a machine with Node and
  Chromium installed, following only the README.
- **SC-006**: The next session, on any machine, can tell from the project memory and README
  whether the PR is prepared, open or merged without re-deriving it.

## Assumptions

- The owner's decision of 2026-10-12 stands: the agent prepares the submodule and registry
  entry locally for review; the owner forks, pushes, opens the PR and writes every message.
- The fork of `zed-industries/extensions` does not exist yet under the owner's account; the
  owner creates it when ready. The agent can prepare a local clone of the upstream
  registry on a branch and the owner points it at their fork before pushing.
- The release carrying the id and display name changes is a minor bump to 0.4.0, since the
  id is part of how users address the extension. The language server's npm package name
  and pinned version are unaffected.
- The language server id inside the manifest (`language_servers.playwright`) and the
  server's npm package name are internal identifiers, not the extension id, and are out of
  scope for the rename.
- The language server package on npm stays at the version pinned by the extension; no new
  npm publish is needed for this feature unless the server's package description must
  change with the display name, in which case the owner publishes it.
- The non-affiliation notice and the absence of Playwright or Microsoft logos are kept as
  decided in feature 001; no trademark review beyond that is in scope.
- Zed stable 1.23 or newer on the owner's WSL2 machine is the environment for the manual
  verification at the submission commit.
- The registry's review timeline (weeks to months) is outside the project's control;
  "done" for this feature means the PR is open and the owner has what they need to answer
  review, not that the PR is merged. Merge is tracked as a follow-up state in the memory.
  In the constitution's terms the 0.4.0 release itself is complete only once the registry
  entry is merged; the feature's done state is the hand-over, not the release.
