# Shared content for the design proposals

Every proposal uses exactly this text so the owner compares design, not words.

## Site name and description

- Name: Playwright Runner
- One sentence: Run and manage Playwright end-to-end tests from the Zed editor.
- Supporting line: A community Zed extension that mirrors the Playwright VS Code
  extension through the surfaces Zed gives extensions. Work in progress.

## Notices (both must appear on the landing page)

- Work in progress. Expect rough edges and gaps compared to the VS Code extension; bug
  reports and feedback are welcome in the issue tracker.
- Independent community extension. Not affiliated with, endorsed by, or maintained by
  Microsoft or the Playwright team. "Playwright" is a trademark of Microsoft Corporation;
  the name is used only to describe what this extension works with.

## Install (landing page)

1. In Zed, open `zed: extensions` and search for **Playwright Runner**.
2. Turn on code lenses in your Zed settings: `"code_lens": "on"`.
3. Open a project with `@playwright/test` 1.38 or newer, trust the folder, and click
   **▶ Run test** above any test.

Requirements line: Zed 1.23 or newer, Node.js 22 or newer, `@playwright/test` 1.38 or
newer with browsers installed.

## Capability list (landing page grid or list; six entries)

- Run tests: run the test, describe block or file under the cursor, re-run the last run.
- Projects: pick the Playwright projects (browsers) a run uses, remembered per config.
- Step labels and run output: see the executing step and per-step durations inline, open
  the full output in a tab.
- Trace viewer: record a trace for every run and open it in Playwright's trace viewer.
- Show browser: watch tests in a visible browser that stays open between runs.
- Discovery consent: nothing runs in a folder until you trust it.

## Links (landing footer or header)

- Documentation (the docs page of the same proposal)
- GitHub: https://github.com/radekBednarik/playwright-zed
- Issues: https://github.com/radekBednarik/playwright-zed/issues
- Zed: https://zed.dev
- Playwright: https://playwright.dev

## Docs page: "Run tests" (the one capability page every proposal shows)

Sidebar (Starlight-style groups and entries, the current page is "Run tests"):

- Getting started: Requirements, Install, First run
- Features: Run tests, Projects, Step labels and run output, Trace viewer, Show browser,
  Discovery consent
- Reference: Settings, Differences from the VS Code extension, State files, Parity
- Help

Page title: Run tests

Intro: Playwright Runner runs the Playwright installed in your workspace. Results arrive
as a progress indicator, a pass or fail notification, an error marker on each failing line,
and the full output in a tab.

Section "From the editor":

| Action | How |
| --- | --- |
| Run the test under the cursor | `ctrl-.` then **Playwright: Run test at cursor**, or click the **▶ Run test** lens |
| Run a whole describe | cursor on the `test.describe` line, same action, or **▶ Run describe** |
| Run the whole file | `ctrl-.` then **Playwright: Run file** |
| Repeat the last run | `ctrl-.` anywhere in the workspace, **Playwright: Re-run last** |

Screenshot placeholder 1 (16:10 frame, labelled "Screenshot: run lenses above a test"),
caption: "Lenses above each test and describe block (Zed 1.26.2, Playwright Runner 0.8.0,
Linux)".

Section "What you get back":

- A progress indicator while the run is in progress; starting another run cancels it.
- A notification such as "1 passed, 0 failed, 0 skipped (0.4s)"; the time is Playwright's
  own measurement.
- An error marker on the failing line until you edit the file or run again. With two or
  more projects, each failing project gets its own marker and the message starts with the
  project in brackets, for example `[mobile] adds numbers: ...`.

Screenshot placeholder 2 (labelled "Screenshot: failing run with the error marker").

Section "Good to know":

- Runs use the file on disk. With unsaved changes you get a warning and the saved version
  runs.
- With several configuration files, the one nearest to the test file is used.
- Playwright below 1.38 produces a single warning and disables running.

Code block (JSON) in "Good to know":

```json
{
  "code_lens": "on",
  "inlay_hints": { "enabled": true }
}
```

Right-hand table of contents: From the editor, What you get back, Good to know.

Footer: "Edit this page", "Last updated 29 October 2026", previous "First run", next
"Projects".
