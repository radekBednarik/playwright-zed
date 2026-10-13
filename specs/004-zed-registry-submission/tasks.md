---

description: "Task list for the Zed registry submission (feature 004)"
---

# Tasks: Zed Registry Submission

**Input**: Design documents from `/specs/004-zed-registry-submission/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No new automated tests are requested. The feature changes metadata, docs and one
user-facing string; existing suites must stay green and the registry's own validation is run
locally as the acceptance check.

**Organization**: Tasks are grouped by user story. User Story 2 (automated checks pass)
comes before User Story 1 (owner opens the PR) because the PR material is built from the
release that passes the checks. Both are P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 owner opens a compliant PR; US2 automated registry checks pass; US3 user
  installs from the registry; US4 AI policy respected
- Paths are relative to the repository root unless they start with `../`

## Path Conventions

- Extension shell: `extension.toml`, `Cargo.toml`, `src/lib.rs`, `.github/workflows/ci.yml`
- Server: `server/`
- Docs and memory: `README.md`, `CLAUDE.md`, `docs/`, `.claude/memory/`
- Registry clone: `../zed-extensions` (sibling directory, never inside this repository)
- Feature records: `specs/004-zed-registry-submission/`

---

## Phase 1: Setup

**Purpose**: tooling the registry pipeline uses, available locally

- [ ] T001 Install the registry's pinned toolchain: `rustup toolchain install 1.90 --profile minimal --target wasm32-wasip2`; confirm `cargo +1.90 --version` prints 1.90.x (already done on the WSL2 machine on 2026-10-13; repeat on any other machine)
- [ ] T002 [P] Confirm `corepack pnpm@11 --version` works (prints 11.x) and `gh auth status` shows the owner's account; record both in `specs/004-zed-registry-submission/verification.md` under "Environment"
- [ ] T003 [P] Download the registry's packaging CLI to a scratch directory outside the repository: `wget -q https://zed-extension-cli.nyc3.digitaloceanspaces.com/9ee3c503a4bbbc6b4a0f8a789acca4871d773223/x86_64-unknown-linux-gnu/zed-extension && chmod +x zed-extension`; first re-read `env.ZED_EXTENSION_CLI_SHA` in https://raw.githubusercontent.com/zed-industries/extensions/main/.github/workflows/ci.yml and use that SHA if it moved; note the SHA used in `verification.md`

---

## Phase 2: Foundational (rename and CI, blocks every story)

**Purpose**: the id and display name the owner chose on 2026-10-13 applied everywhere, and
the project CI proving the registry toolchain build. All on branch `004-zed-registry-submission`,
version stays `0.3.0` on the branch (release happens on `main` in Phase 4).

- [ ] T004 Set `id = "playwright-runner-lsp"` and `name = "Playwright Runner"` in `extension.toml`; leave `version`, `description`, `capabilities` and `language_servers.playwright` unchanged (contract: `specs/004-zed-registry-submission/contracts/extension-manifest.md`)
- [ ] T005 [P] Add a second Rust job to `.github/workflows/ci.yml` named "Rust extension (registry toolchain 1.90)" using `dtolnay/rust-toolchain@stable` with inputs `toolchain: "1.90"` and `targets: wasm32-wasip2` (the action's ref tags are full versions or channels, so the version goes in the `toolchain` input), running `cargo build --release --target wasm32-wasip2`; keep the existing `stable` job as is
- [ ] T006 [P] Change the discovery question prefix in `server/src/reporting.ts` line 55 from "Playwright for Zed found a Playwright configuration" to "Playwright Runner found a Playwright configuration"; update the same text in `specs/002-discovery-consent/contracts/discovery-consent.md`; add an assertion on the new prefix to the existing discovery-consent test in `server/test/` (the test that exercises the `window/showMessageRequest` question; no test asserts the text today), so the rename is verified automatically because Zed 0.218+ never shows the question manually
- [ ] T007 [P] Update `server/package.json` `description` to "Language server for the Playwright Runner Zed extension: discovers and runs Playwright tests in your workspace (community project, not affiliated with Microsoft)" and `server/README.md` line 3 to name "Playwright Runner"; do not change `version` and do not publish
- [ ] T008 [P] Rename in `README.md`: H1 to "Playwright Runner", first paragraph to say it is a Zed extension (the words "for Zed" may appear in prose, not in the manifest name), line 180 to "**Playwright Runner 0.3.0**" (the release commit sets it to 0.4.0, see T019); add to the "From source" install steps a note: a dev extension installed before 0.4.0 appears as "Playwright for Zed" with id `playwright` and must be uninstalled in `zed: extensions`, otherwise two Playwright language servers start
- [ ] T009 [P] Rename the H1 of `CLAUDE.md` to "Playwright Runner" and keep the rest unchanged
- [ ] T010 [P] Rewrite `docs/publishing.md` sections 2 to 4 and the self-check: submodule path `extensions/playwright-runner-lsp`, entry `[playwright-runner-lsp]`, work directory `~/.local/share/zed/extensions/work/playwright-runner-lsp/package.json`, replace the "Identity fallback" paragraph with the decided id and the reason (the `playwright-runner` stem describes what the extension provides; the `-lsp` suffix follows the publishing prerequisite for extensions whose manifest declares only a language server); extend the self-check with: display name not starting "Zed ", not ending " Zed", not containing "extension"; `cargo +1.90 build --release --target wasm32-wasip2` passes; registry `package-extensions` run locally passes; no Git LFS; fewer than three open registry PRs; AI policy items (owner writes PR and comments, quoted AI output in labelled quote blocks); respond within three weeks; `extensions.toml` and `.gitmodules` sorted with `corepack pnpm@11 sort-extensions`
- [ ] T011 [P] Add a "Superseded by feature 004" note at the top of `specs/001-scaffold-run-at-cursor/contracts/extension-manifest.md` pointing at `specs/004-zed-registry-submission/contracts/extension-manifest.md` for `id` and `name`
- [ ] T012 [P] Update `.claude/memory/playwright-zed-project.md` (display name, id, feature 004 state "in progress"), `.claude/memory/new-machine-setup.md` (work directory path `work/playwright-runner-lsp`) and the user memory pointer file at `/home/radek/.claude/projects/-home-radek-projects-personal-playwright-zed/memory/playwright-zed-session-2026-10-12.md (the Claude Code auto-memory pointer for this repo)` only if it carries content beyond the pointer
- [ ] T013 Run the repository checks from quickstart step 1: `cargo test` (7 passed), `cargo build --release --target wasm32-wasip2`, `cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190`, `cd server && npm run lint && npm run build && npm test` (108 passed), and the grep for "Playwright for Zed" excluding `specs/00[123]`, `specs/004`, `.specify/memory/constitution.md` (must print nothing); paste outputs into `specs/004-zed-registry-submission/verification.md` section "Automated verification"

**Checkpoint**: the branch builds on both toolchains, suites green, every live mention renamed.

---

## Phase 3: User Story 2 - The extension passes every automated registry check (Priority: P1)

**Goal**: prove, with the registry's own tooling, that the manifest, licence, id, name and
build are accepted before anything is pushed.

**Independent Test**: quickstart step 2; the CLI manifest shows the new name, the licence is
recognised, no validation rule from `validation.js` is violated.

- [ ] T014 [US2] Run the registry CLI from T003 against the repository: `RUSTUP_TOOLCHAIN=1.90 ./zed-extension --source-dir <repo> --output-dir out --scratch-dir scratch`; confirm `out/manifest.json` has `"name":"Playwright Runner"`, `"version":"0.3.0"` (branch) and `"provides":["language-servers"]`; record the manifest and the "finished compiling" line in `verification.md` section "Registry CLI build"; confirm `git status` shows only the gitignored `extension.wasm`
- [ ] T015 [US2] Check the validator rules by hand against `extension.toml` and `LICENSE` and record the result table in `verification.md`: id matches `^[a-z0-9-]+$`, no `zed-` prefix, no `-zed` suffix, no `extension`; name no `Zed ` prefix, no ` Zed` suffix, no `extension`; version plain semver; `LICENSE` first line "MIT License" with copyright line; `schema_version = 1`; no `.gitattributes` with `filter=lfs`
- [ ] T016 [US2] Confirm the id is free and the PR slots are open: download https://raw.githubusercontent.com/zed-industries/extensions/main/extensions.toml and `grep -c '^\[playwright-runner-lsp\]'` (expect 0 before our PR); `gh pr list -R zed-industries/extensions --author radekBednarik --state open --json number` (expect fewer than 3); record both in `verification.md`
- [ ] T017 [US2] Commit the Phase 2 work (including the README, disclosure and AI-policy edits from T031, T033, T034, which must be done before this commit) on `004-zed-registry-submission` with a message in the project style ("feat: rename to playwright-runner-lsp for the Zed registry" plus body naming the registry name rule), push, open the PR to `main` with `gh pr create`; the PR body MUST carry what the constitution's workflow gates require: rename reason and registry rules found, "Parity matrix: no change" (FR-016), the `cargo test` and both WASM build output lines from T013, the server lint, build and vitest counts, the quickstart steps that apply on the branch (steps 1 to 3), and the licence and prerequisite self-check copied from `docs/publishing.md` with each item ticked or marked "at release"; this is the project's own PR, not the registry PR; wait for CI; record the PR number and CI result in `verification.md`
- [ ] T018 [US2] After the owner's OK and green CI, merge the PR into `main` (`gh pr merge --squash --delete-branch` or the owner's preferred mode) and `git switch main && git pull`

**Checkpoint**: `main` carries the rename and the 1.90 CI job; registry rules verified locally.

---

## Phase 4: User Story 1 - The owner opens a compliant registry PR (Priority: P1)

**Goal**: a tagged 0.4.0 release verified in Zed, a registry clone with the exact change
set, the registry's validation run locally on it, and the hand-over document.

**Independent Test**: quickstart steps 4 to 7; the registry clone commit contains only the
three expected paths, `package-extensions playwright-runner-lsp` succeeds, the hand-over
matches its contract.

### Release

- [ ] T019 [US1] On `main`: set `version = "0.4.0"` in `extension.toml` and `Cargo.toml`, change the `README.md` dev-extension listing line to "**Playwright Runner 0.4.0**", run `cargo test && cargo build --release --target wasm32-wasip2`, commit "release: 0.4.0", tag `v0.4.0`, `git push && git push --tags`; record `git rev-parse v0.4.0` in `verification.md` section "Release"
- [ ] T020 [US1] Confirm the tag is reachable from `main` (`git branch --contains v0.4.0` lists `main`) and that `src/lib.rs` still pins `PINNED_SERVER_VERSION = "0.3.0"`, which exists on npm (`npm view playwright-zed-language-server@0.3.0 version`); record both

### Manual verification in Zed at v0.4.0

- [ ] T021 [US1] In Zed (`~/.local/bin/zed --foreground`): `zed: extensions`, uninstall the old dev extension "Playwright for Zed" (id `playwright`); `zed: install dev extension` on the repository root at `v0.4.0`; confirm the listing shows "Playwright Runner 0.4.0" with the non-affiliation description and no "Playwright for Zed" entry; record quickstart step 5 scenario 2 in `verification.md`
- [ ] T022 [US1] Run feature 001 quickstart scenarios 2 (listing and discovery: server running, lenses shown), 5 (run at cursor, passing), 6 (run at cursor, failing with diagnostic), 7 (run describe), 11 (run file), 13 (re-run last) and feature 003 quickstart sections 2 to 5 (trust gate: untrusted folder restricted, trusting enables discovery, restart keeps it, revoking restores the gate) against `fixtures/sample-project`, which together cover every capability FR-008 names; record each with outcome in the `verification.md` manual table (quickstart step 5 scenario 3), including `zed --version` and the date; record feature 002's question scenarios as "skipped: Zed 0.218+ never shows the question; renamed text covered by the server test from T006" (constitution V requires skipped checks stated with the reason)
- [ ] T023 [US1] Verify the npm install path (quickstart step 5 scenario 4): `zed: quit`, start Zed from a shell where `PLAYWRIGHT_ZED_SERVER_ENTRY` is not exported (check `/proc/<pid>/environ`), open the fixture, confirm `~/.local/share/zed/extensions/work/playwright-runner-lsp/package.json` says `"version": "0.3.0"` and lenses appear; record
- [ ] T024 [US1] Run quickstart step 5 scenario 5 (old and new dev extension side by side) once, record the observed duplicate language servers, uninstall the old one, record the final state

### Registry clone

- [ ] T025 [US1] Prepare `../zed-extensions` exactly as in `specs/004-zed-registry-submission/contracts/registry-entry.md` "Preparation commands": clone `https://github.com/zed-industries/extensions.git`, branch `playwright-runner-lsp` from `origin/main`, `git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright-runner-lsp`, check out the submodule at `v0.4.0` on `main`, append the `[playwright-runner-lsp]` entry with `version = "0.4.0"`, `corepack pnpm@11 install --frozen-lockfile`, `corepack pnpm@11 sort-extensions`; do not run `git submodule update` for other submodules
- [ ] T026 [US1] Run the local registry validation in `../zed-extensions` per the contract: copy the `zed-extension` binary from T003 to the clone root, `RUSTUP_TOOLCHAIN=1.90 REF_NAME=playwright-runner-lsp corepack pnpm@11 package-extensions playwright-runner-lsp`; expect "Packaging 'playwright-runner-lsp'. Version: 0.4.0" and no thrown error; then `git diff --exit-code -- extensions.toml .gitmodules` (clean); delete `zed-extension`, `build/`, `output/`, `scratch/` if present; `git status --short` must show only `extensions.toml`, `.gitmodules`, `extensions/playwright-runner-lsp`; record every output in `verification.md` section "Registry local validation"
- [ ] T027 [US1] Commit in `../zed-extensions` on branch `playwright-runner-lsp` with message "Add playwright-runner-lsp extension"; record the commit SHA and `git show --stat HEAD` in `verification.md`; do not add any remote other than `origin` and do not push

### Hand-over

- [ ] T028 [US1] Write `specs/004-zed-registry-submission/owner-handover.md` following `contracts/owner-handover.md` exactly: header sentence stating it contains no PR title, body or reply text; Part 1 fact table with every row filled from `verification.md` and the commands listed in the contract; Part 2 owner to-do list items 1 to 8; Part 3 rules in force with source URLs and the snapshot date
- [ ] T029 [US1] Self-check the hand-over per quickstart step 7: grep the file for "title:" and "body:" and read every paragraph to confirm none is addressed to maintainers or phrased as text to paste; fix and record the check in `verification.md`; then copy the full self-check list from `docs/publishing.md` into `verification.md` section "Publishing self-check" and tick every item with a one-line evidence reference (command output line, file, or scenario number), leaving no item unticked (SC-002)
- [ ] T030 [US1] Commit `verification.md` and `owner-handover.md` on `main` ("docs: feature 004 verification and owner hand-over") and push

**Checkpoint**: the owner can fork, push and open the PR with nothing else to prepare (SC-003).

---

## Phase 5: User Story 3 - A Zed user installs the extension from the registry (Priority: P2)

**Goal**: the README guides a registry user, and the post-merge verification is defined.

**Independent Test**: README install section reads registry-first once merged; from a clean
machine the install works within 5 minutes (SC-005, verified after merge).

- [ ] T031 [US3] Rewrite the "Install" section of `README.md` (same file as T008, so do it right after T008 and before T013 and T017): first paragraph "From the Zed extension registry" describing search for "Playwright Runner" in `zed: extensions`, stating that the listing is under review in the Zed extension registry and linking to `docs/publishing.md`; no placeholder text and no PR link, since the PR does not exist at the tagged commit (T032 rewrites the sentence after merge); second "From source" paragraph unchanged except the old-id uninstall note from T008; keep the Node and Playwright requirements
- [ ] T032 [US3] After the owner reports the merge: on a machine or profile without the dev extension, install "Playwright Runner" from `zed: extensions`, open `fixtures/sample-project`, run feature 001 quickstart scenario 5; record time from install to passing run in `verification.md` section "Post-merge"; remove the "pending review" wording from `README.md` and commit "docs: registry listing live"

---

## Phase 6: User Story 4 - The AI policy is respected end to end (Priority: P2)

**Goal**: disclosure accurate, boundary between agent and owner visible, process documented.

**Independent Test**: spec US4 acceptance scenarios 1 to 3 checked by reading the README,
the hand-over and the publishing doc.

- [ ] T033 [US4] Review the "Built with AI assistance" section of `README.md` against how the project is built at the submission commit (Spec Kit, Claude Code, models named) and correct any outdated model or tool name; keep the sentence that the maintainer reviews every change; do this before T013 and T017 so the submitted commit carries it (same file as T008 and T031, run after them)
- [ ] T034 [P] [US4] Before T013 and T017 (same commit as T010, different section): add an "AI policy" subsection to `docs/publishing.md` section 3 stating: the owner writes the PR title, body and every comment; the agent prepares and verifies locally only; quoted AI output on the registry goes in a labelled quote block with the owner's commentary; link https://github.com/zed-industries/extensions/blob/main/AI_POLICY.md
- [ ] T035 [US4] Confirm the hand-over from T028 contains the policy summary in Part 3 and the to-do item 7 about replies; confirm no registry-facing text exists anywhere under `specs/004-zed-registry-submission/`; record in `verification.md`

---

## Phase 7: Polish and cross-cutting

- [ ] T036 [P] Update `.claude/memory/playwright-zed-project.md`: feature 004 state "prepared, awaiting owner" with the registry clone path, branch, submodule SHA, tag `v0.4.0`, and the owner's remaining steps; add the state machine (prepared, pr-open, merged, closed) so later sessions record transitions
- [ ] T037 [P] Update `docs/parity.md` only if any note references the old display name (grep); otherwise record "no change" in `verification.md` (FR-016: no new row)
- [ ] T038 Run quickstart step 1 grep once more on `main` at the final commit and confirm it prints nothing; run `cargo test` and `cargo +1.90 build --release --target wasm32-wasip2` once more; append final outputs to `verification.md`
- [ ] T039 Tell the owner, in the session summary, exactly which commands remain for them (fork, remote, push, PR), where the hand-over is, and that no PR text has been drafted

---

## Dependencies and execution order

- **Phase 1** (T001 to T003): no dependencies; T002 and T003 parallel.
- **Phase 2** (T004 to T013): T004 first (manifest), then T005 to T012 in parallel, then
  the pulled-forward tasks T031 (README install section, after T008), T033 (README AI
  disclosure, after T031) and T034 (publishing AI policy, after T010), then T013 last. These
  three are listed under their stories for traceability but MUST be complete before T013
  and T017 so the submitted commit carries them.
- **Phase 3, US2** (T014 to T018): after Phase 2 including T031, T033, T034. T014 to T016 parallel, T017 after them, T018 after owner OK.
- **Phase 4, US1** (T019 to T030): after T018 (needs `main` merged). T019 then T020; T021 to T024 sequential in Zed; T025 after T019 (tag must exist on GitHub); T026 after T025; T027 after T026; T028 after T020 to T027; T029, T030 after T028.
- **Phase 5, US3**: T031 is executed inside Phase 2 (see above); T032 only after the owner reports the merge.
- **Phase 6, US4**: T033 and T034 are executed inside Phase 2 (see above); T035 after T028.
- **Phase 7**: T036, T037 after T030; T038, T039 last.

### Story dependencies

- US2 before US1 (release must pass the checks first).
- US3 and US4 are independent of each other; both partly overlap Phase 2 files and are
  ordered after T008 and T010 to avoid editing the same files concurrently.

## Parallel examples

```text
# Phase 2 after T004:
T005 ci.yml | T006 reporting.ts + 002 contract | T007 server metadata | T008 README | T009 CLAUDE.md | T010 publishing.md | T011 001 contract | T012 memory

# Phase 3:
T014 CLI build | T015 rule table | T016 id free and PR slots

# Phase 4, while Zed scenarios run (T021 to T024) the clone can be prepared (T025 to T027) in another terminal.
```

## Implementation strategy

- **MVP**: Phases 1 to 4 (US2 then US1). That alone lets the owner open the PR.
- **Increment 2**: T031, T033 and T034 are part of the Phase 2 commit (binding, see Dependencies), so the submitted commit's README and publishing doc are final; T035 follows the hand-over.
- **Follow-up outside "done"**: T032 after merge, memory transitions in T036 as the owner reports.

## Notes

- Outward-facing actions reserved for the owner: fork, push to the fork, open the registry PR, every comment, any `npm publish`. Project-own PR open and merge (T017, T018) follow the project's existing practice but wait for the owner's OK before merging.
- The registry rules were snapshotted 2026-10-13; T003 and T016 re-read the live sources so a moved CLI SHA or a new entry is caught.
- Version on the feature branch stays 0.3.0; only the release commit on `main` sets 0.4.0.
