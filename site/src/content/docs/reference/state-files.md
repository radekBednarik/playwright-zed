---
title: State files
description: Where the extension remembers your choices and keeps the last run output.
---

The extension remembers your in-editor choices in small JSON files owned by your user,
outside the repository:

| OS | Location |
| --- | --- |
| Linux | `$XDG_STATE_HOME` or `~/.local/state/playwright-zed-language-server/` |
| macOS | `~/Library/Application Support/playwright-zed-language-server/` |
| Windows | `%LOCALAPPDATA%\playwright-zed-language-server\` |

Set `PLAYWRIGHT_ZED_STATE_DIR` in the environment Zed starts from to move it.

| File | Holds |
| --- | --- |
| `project-selection.json` | The selected [projects](/playwright-zed/features/projects/) per configuration file |
| `trace-viewer.json` | Whether the [trace viewer](/playwright-zed/features/trace-viewer/) option is on |
| `show-browser.json` | Whether the [show browser](/playwright-zed/features/show-browser/) option is on |
| `runs/` | The [output of the latest run](/playwright-zed/features/step-labels-and-output/), one file per workspace |

Traces (`trace.zip`) and other test artifacts are Playwright's own files under your
project's `test-results/`; the extension never deletes them.
