---
title: Help
description: Where to report problems, what to attach, and a tasks recipe for a real terminal.
---

## Getting help

Open an issue at
[github.com/radekBednarik/playwright-zed/issues](https://github.com/radekBednarik/playwright-zed/issues).
Helpful in a report:

- Your Zed version (`zed: about`), the extension version (`zed: extensions`), your
  operating system, and the `@playwright/test` version of the project.
- For problems with runs or discovery: the Playwright server log from
  `dev: open language server logs` (pick **Playwright**).
- For problems with the extension itself (installation, the server not starting):
  `zed: open log`.
- The `playwright.config.*` and a minimal test that shows the problem, if you can share
  them.

The extension is a work in progress; expect rough edges, breaking changes between minor
versions, and gaps compared to the VS Code extension. It is an independent community
extension, not affiliated with, endorsed by, or maintained by Microsoft or the Playwright
team. "Playwright" is a trademark of Microsoft Corporation; the name is used only to
describe what this extension works with.

## Terminal output (optional)

Extensions cannot write to Zed's terminal panel. **Playwright: Show last run output**
gives you the same text in an editor tab; if you want a real terminal, add this task to
`~/.config/zed/tasks.json`. Zed already recognises `test(` and `test.describe(` calls in
TypeScript and JavaScript files, so the gutter run button and the `task: spawn` picker
will offer it:

```json
[
  {
    "label": "Playwright: Run test at cursor with CLI output",
    "command": "npx",
    "args": ["playwright", "test", "$ZED_FILE:$ZED_ROW"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "tags": ["js-test", "ts-test", "tsx-test"]
  }
]
```

## Built with AI assistance

This extension is developed with AI assistance throughout: specification, planning, code,
tests and documentation. The workflow is
[GitHub Spec Kit](https://github.com/github/spec-kit) driven by
[Claude Code](https://claude.com/claude-code) with the Claude models Fable and Opus. Every
change is reviewed by the maintainer, and automated and manual verification is recorded
per feature in the repository, but treat the code with the care you would give any young
AI-assisted project.
