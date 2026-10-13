# Contract: Owner Hand-over Document

File: `specs/004-zed-registry-submission/owner-handover.md`, written by the implementation
once everything local is verified. It is the only interface between the agent's work and
the owner's registry actions.

## Prohibited content

- No PR title, no PR body, no draft of any comment or reply, no "suggested wording".
- No instruction to paste anything into the registry.
- No claim that has not been verified in this repository or the registry clone.

The header states this in one sentence so the owner and any reviewer can see the boundary.

## Part 1: Fact sheet

Each fact is one line or one short block, phrased as data.

| Fact | Source |
|------|--------|
| Submission tag and commit SHA | `git rev-parse v0.4.0` |
| Extension id, display name, version | `extension.toml` at that commit |
| Pinned server package and version, npm publish timestamp | `src/lib.rs`, `npm view playwright-zed-language-server time` |
| Licence | `LICENSE` (MIT), registry matcher result |
| Rust 1.90 build result | `cargo +1.90 build --release --target wasm32-wasip2` output line |
| Registry packaging result | `package-extensions playwright-runner` output: version line and manifest fields |
| Sorted-files check | `git diff --exit-code -- extensions.toml .gitmodules` outcome |
| Registry clone state | path, branch, the three changed paths, submodule gitlink SHA |
| Manual verification | Zed release, date, scenario numbers run from quickstart tables with outcomes, link to `verification.md` |
| npm install path | work directory `package.json` version observed, Zed started without the dev override |
| Automated suite | `cargo test`, server lint, build, vitest counts |
| Registry rules snapshot date | 2026-10-13, with the URLs read |
| Owner's open registry PRs at hand-over | `gh pr list` count |
| Possible review questions | id without `-lsp` suffix, "Work in progress." in the description, trademark use of "Playwright", AI assistance disclosed in README |

## Part 2: Owner to-do list

Numbered, in order, each item an action only the owner performs under the AI policy:

1. Read the hand-over and the registry's `AI_POLICY.md`, `CONTRIBUTING.md`, prerequisites.
2. Optional: publish server 0.4.0 so the discovery question text matches (not required).
3. Fork `zed-industries/extensions` to the personal account.
4. Add the fork remote to `../zed-extensions` and push the `playwright-runner` branch.
5. Open the PR; write the title and body personally; tick the template checkbox.
6. Record the PR number here and tell the agent, so memory and README move to "pr-open".
7. Watch the PR; answer every maintainer comment personally within three weeks. If AI
   output is quoted, put it in a quote block, label it, add own commentary, keep it short.
8. On merge: tell the agent, so README and memory move to "merged" and User Story 3 is
   verified from a clean machine. On close: re-read the prerequisites, fix, open a fresh PR.

## Part 3: Rules in force (copied facts, not advice)

The bullet list of registry rules from spec "Registry Rules Found", trimmed to the ones the
owner acts on (PR limits, deadline, hygiene warnings, AI policy), each with its source URL.
