---
title: Differences from the VS Code extension
description: Where Zed's extension surface shapes the experience differently from the upstream extension, and what is not implemented yet.
---

The extension mirrors the
[Playwright VS Code extension](https://github.com/microsoft/playwright-vscode) through
the surfaces Zed gives extensions. These are the differences you will notice, each with
its reason.

- The executing step is marked with a trailing label, not a highlighted line: Zed has no
  decoration API for extensions, inlay hints are the closest native surface.
- The run output opens as an editor tab, not in a Test Results panel, because Zed has no
  panel an extension could fill. The tasks recipe on the [Help](/playwright-zed/help/)
  page is the way to a real terminal.
- Both surfaces are opt-in through Zed settings (`code_lens`, `inlay_hints`).
- "Show trace viewer" is an entry in the `ctrl-.` menu rather than a checkbox in a
  settings view, and the trace of a particular test is chosen with the cursor rather than
  in a Test Explorer tree, because Zed has neither. The viewer window starts with the
  first trace to show instead of before the run.
- "Show browser" and "Close all browsers" are `ctrl-.` entries for the same reason.
  Turning "Show trace viewer" on also turns "Show browser" off here, where the VS Code
  extension only has the opposite direction. While the browser is shown, the VS Code
  extension also turns video recording off; the command line has no switch for that, so
  a project that records video keeps doing so and Playwright then opens a fresh context
  per test instead of reusing one. The kept browser is closed by the action or by turning
  the option off; closing its last page by hand does not stop it (the next run simply
  opens a new page in it).
- Zed caches the `ctrl-.` menu per cursor position, so the `[x]` marks of the project,
  trace viewer and browser toggles lag one toggle behind at an unchanged cursor; the
  confirmation notification shows the real state.
- After an update or reinstall of the extension in the same Zed session, Zed keeps the
  Playwright server stopped until you run `editor: restart language server` (see
  [Install](/playwright-zed/getting-started/install/)).
- A folder default for the selected projects (`projects`) exists only here; the VS Code
  extension has no equivalent.
- Watch mode, pick locator, debugging, locator tuning and test recording are not
  implemented yet. The [Parity](/playwright-zed/reference/parity/) page lists the status
  of every upstream capability.
