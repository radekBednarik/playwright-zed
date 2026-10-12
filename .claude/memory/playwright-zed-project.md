---
name: playwright-zed-project
description: State of the Playwright-for-Zed extension as of 2026-10-12 evening; what is released, what is deliberately on hold, open decisions, where the spec-kit artifacts live
metadata:
  type: project
---

Public repo https://github.com/radekBednarik/playwright-zed (made public 2026-10-12). All
work is merged: `main` at `ee66cc4` carries feature 001 (`specs/001-scaffold-run-at-cursor/`,
run at cursor, run file, re-run last) and feature 002 (`specs/002-discovery-consent/`, per
workspace per session consent prompt before `playwright test --list` runs workspace code).
Feature branches `001-scaffold-run-at-cursor` and `002-discovery-consent` are merged and
can be deleted. `.specify/feature.json` points at `specs/002-discovery-consent`; a new
feature starts with `/speckit-specify`, which creates `specs/003-<name>/` and a branch.

Released: npm `playwright-zed-language-server` 0.1.0 and 0.2.0 (0.2.0 is `latest`; a public
`0.0.0-stage` placeholder from npm staged publishing also exists, harmless, removable with
`npm unpublish playwright-zed-language-server@0.0.0-stage --otp=<code>` within 72 h of
2026-10-12 16:07 UTC). Rust shell pins 0.2.0; `extension.toml` and `Cargo.toml` are 0.2.0;
tags `v0.1.0`, `v0.2.0`. Zed installing 0.2.0 from npm on its own is verified. Display name
is "Playwright for Zed", id `playwright`, description starts with "Work in progress." and
carries a non-affiliation notice (Playwright is a Microsoft trademark); READMEs disclose
AI-assisted development (GitHub Spec Kit, Claude Code, models Fable and Opus).

No open tasks in either feature. Automated suite: 7 Rust tests, 88 vitest tests in 9 files
(needs Chromium and network for the TodoMVC fixture tests). Every verification is recorded
in the feature's `verification.md`.

**On hold by the owner's decision (2026-10-12):** the Zed registry PR. Not to be prepared
until asked. When asked: Zed's `AI_POLICY.md` forbids autonomous-agent contributions, so the
owner forks `zed-industries/extensions`, opens the PR and writes every comment personally;
the agent may only prepare the submodule and `extensions.toml` entry locally for review.
Open decision before that PR, irreversible afterwards: keep id `playwright` or rename to
`playwright-lsp` (Zed prerequisites suggest the suffix for language-server-only extensions;
research R9 argued for the plain id because debugger and task capabilities will follow).

**Why:** the next session on another machine must not re-derive the state, re-ask about
publishing, or prepare the registry PR unasked.

**How to apply:** continue on `main` or a new `/speckit-specify` feature; ask before any
`npm publish` or registry action; see [[dev-environment-wsl-zed]] for the environment and
[[new-machine-setup]] for bootstrapping a fresh clone.
