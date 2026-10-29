---
title: Requirements
description: What you need before installing Playwright Runner for Zed.
---

- Zed stable 1.23 or newer.
- Node.js 22 or newer on your `PATH` (Zed may also provide its own Node).
- `@playwright/test` v1.38 or newer installed in your project, with browsers installed
  (`npx playwright install`).

The extension drives the Playwright installed in your own workspace through its public
command line. It bundles no Playwright and no browsers, and it contains no code from the
Playwright projects. Playwright below v1.38 produces a single warning and disables running.

Next: [Install](/playwright-zed/getting-started/install/).
