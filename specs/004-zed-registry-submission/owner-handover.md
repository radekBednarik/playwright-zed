# Owner hand-over: Zed registry submission of Playwright Runner 0.4.0

This document contains facts and a to-do list only. It contains no pull request title, no
pull request body and no reply text: under the registry's AI policy the owner writes every
registry-facing word personally. Every fact below was verified in this repository or in the
registry clone on 2026-10-13; sources are in `verification.md`.

## Part 1: Fact sheet

| Fact | Value | Source |
|------|-------|--------|
| Submission tag and commit | `v0.4.0` = `b4c1116c1680c69c0488662a0b02ea40543e5c80`, on `main` (re-pointed 2026-10-13 after the server pin bump; the earlier `8379546` was never submitted) | `git rev-parse v0.4.0`, `git branch --contains v0.4.0` |
| Extension id, display name, version | `playwright-runner-lsp`, "Playwright Runner", `0.4.0` | `extension.toml` at that commit |
| Pinned server package | `playwright-zed-language-server` 0.4.0, published 2026-10-13T16:20:01Z, dist-tag `latest` | `src/lib.rs` `PINNED_SERVER_VERSION`, `npm view playwright-zed-language-server time` |
| Licence | `LICENSE` at the root, MIT ("MIT License", "Copyright (c) 2026 Radek Bednarik"); recognised by the registry's licence matcher during `package-extensions` | verification.md "Registry rules checked by hand", "Registry clone and local validation" |
| Rust 1.90 build | `cargo +1.90 build --release --target wasm32-wasip2`: `Finished release profile [optimized] target(s) in 9.10s`, `playwright_zed.wasm` 248438 bytes | verification.md "Automated verification" |
| Registry packaging | `package-extensions playwright-runner-lsp`: `Packaging 'playwright-runner-lsp'. Version: 0.4.0`, exit 0; manifest name "Playwright Runner", version 0.4.0, schema_version 1, wasm_api_version 0.7.0, provides `["language-servers"]`; archive 97258 bytes | verification.md "Registry clone and local validation" |
| Sorted files | `sort-extensions` then `git diff --exit-code -- extensions.toml .gitmodules`: clean | same section |
| Registry clone | `../zed-extensions`, branch `playwright-runner-lsp`, commit `0aef1c49`, changed paths `.gitmodules`, `extensions.toml`, `extensions/playwright-runner-lsp` (gitlink `b4c1116`); remote `origin` only; entry sits after `[playdate]` and before `[po]` | `git show --stat HEAD` in the clone |
| Manual verification | Zed 1.23.3 (Linux, WSL2), 2026-10-13, at `8379546` (same code as `b4c1116` except the server pin): dev extension listed as "Playwright Runner 0.4.0", old `playwright` entry removed, feature 001 scenarios 2, 5, 6, 7, 11, 13 and feature 003 sections 2 to 5 passed per the owner; side-by-side old/new check skipped. Re-check at `b4c1116` on 2026-10-13: dev extension rebuilt, npm path PASS (verification.md "Re-verification at b4c1116") | verification.md "Manual verification in Zed at v0.4.0" |
| npm install path | at `8379546`: Zed started without `PLAYWRIGHT_ZED_SERVER_ENTRY` (process environ checked); the work directory held server 0.3.0 from npm; Zed.log showed the server started from that path. At `b4c1116`: Zed 77326 started without the override, work directory holds server 0.4.0 from npm, Zed.log 18:24:04 starts the server from that path | verification.md "Manual verification in Zed at v0.4.0" |
| Automated suite | `cargo test` 7 passed; server `tsc --noEmit` and `tsc` exit 0; vitest 108 passed in 11 files; project CI on PR #3 green on stable, Rust 1.90, Node 22 and Node 24 | verification.md "Automated verification", "Project PR" |
| Registry rules snapshot | 2026-10-13: registry README, `CONTRIBUTING.md`, `AI_POLICY.md`, PR template, `.github/workflows/ci.yml` (`ZED_EXTENSION_CLI_SHA` 9ee3c503), `src/lib/validation.js`, `dangerfile.ts`; Zed docs publishing overview, prerequisites, licence requirements, publishing guide, updating and maintenance, FAQ | spec.md "Registry Rules Found", research.md |
| Owner's open registry PRs | 0 (`gh pr list -R zed-industries/extensions --author radekBednarik --state open`); no fork `radekBednarik/extensions` exists yet | verification.md "Id free and PR slots" |
| Id availability | `extensions.toml` on registry `main` (1574 entries): no `playwright-runner-lsp`; only Playwright-related entry `mcp-server-playwright` | same section |
| Possible review questions | "Work in progress." at the start of the description; use of the "Playwright" trademark in the name (non-affiliation notice in the description and README); AI assistance disclosed in the README | research.md R9, spec.md Edge Cases |
| Server release | server 0.4.0 published by the owner on 2026-10-13 and pinned by the extension; the discovery question text matches the new name on every Zed release | verification.md "Server 0.4.0 and re-pointed tag" |

## Part 2: Owner to-do list

Actions only the owner performs, in order:

1. Read this hand-over and, in the registry, `AI_POLICY.md`, `CONTRIBUTING.md` and the
   publishing prerequisites (links in Part 3).
2. Done 2026-10-13: server 0.4.0 published and pinned.
3. Fork `zed-industries/extensions` to the personal account (not an organisation):
   `gh repo fork zed-industries/extensions --clone=false`.
4. In `../zed-extensions`: `git remote add fork https://github.com/radekBednarik/extensions.git`
   and `git push -u fork playwright-runner-lsp`. The local commit message
   "Add playwright-runner-lsp extension" may be amended first.
5. Open the PR from `radekBednarik:playwright-runner-lsp` to `zed-industries:main`. Write
   the title and the body personally, in your own words; tick the template checkbox. The
   registry's Danger check warns on a title that starts with a lowercase letter, ends with
   punctuation or uses a Conventional Commits prefix, and fails a PR that does not touch
   `extensions.toml` (this one does).
6. Record the PR number in `.claude/memory/playwright-zed-project.md` (state `pr-open`) or
   tell the agent, so memory and README are updated.
7. Watch the PR and answer every maintainer comment personally within three weeks. If AI
   output is quoted, put it in a quote block, label it as AI output, keep it short and add
   your own commentary. The agent may be used to look things up or verify a claim.
8. On merge: tell the agent, so README and memory move to `merged` and User Story 3 is
   verified from a machine without the dev extension. On close without feedback: re-read
   the prerequisites, fix the cause, open a fresh PR rather than reopening.

## Part 3: Rules in force (facts, snapshot 2026-10-13)

- One extension per PR; at most three open PRs per contributor; maintainer feedback must be
  answered within three weeks or the PR is closed; PRs that violate the rules are closed
  without feedback, repeat violations can lead to a ban.
  Source: https://github.com/zed-industries/extensions/blob/main/CONTRIBUTING.md
- Fork under a personal account so Zed staff can push fixes; submodule by HTTPS URL on a
  branch; `extensions.toml` version equal to the manifest at the submodule commit; files
  sorted with `pnpm sort-extensions`.
  Source: https://zed.dev/docs/extensions/publishing/publishing-guide
- Tested manually at the submitted commit; language servers not bundled; `-lsp` or
  `-language-server` suffix for language-server-only extensions; ids cannot change after
  publication, display names can.
  Source: https://zed.dev/docs/extensions/publishing/prerequisites
- Licence file at the extension root matching an accepted licence (MIT here).
  Source: https://zed.dev/docs/extensions/publishing/license-requirements
- AI policy: AI as a coding tool is welcome and the contributor stays responsible;
  autonomous agents must not contribute; PR body and comments are written by a human in
  their own words; AI-written responses must not be copied in; quoted AI context goes in a
  quote block, disclosed, short, with human commentary; AI may polish English if the
  author's voice is kept.
  Source: https://github.com/zed-industries/extensions/blob/main/AI_POLICY.md
- Danger run: fails without an `extensions.toml` change; warns on title style (lowercase
  start, trailing punctuation, Conventional Commits prefix).
  Source: `dangerfile.ts` in the registry repository
- First feedback usually within a few weeks, sometimes one to two months; a PR closed with
  little feedback nearly always violated a prerequisite.
  Source: https://zed.dev/docs/extensions/publishing/faq
- Updates: PR that moves the submodule and bumps `version`; version must never decrease.
  Source: https://zed.dev/docs/extensions/publishing/updating-and-maintenance
