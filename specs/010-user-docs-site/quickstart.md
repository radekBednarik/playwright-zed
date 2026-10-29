# Quickstart: User Docs Site and README Restructure

Validation scenarios for the feature. Record each outcome in `verification.md` with the
command and its output. Prerequisites: this clone on the native Ubuntu machine, Node 24 or
newer, Zed 1.26.2 at `~/.local/bin/zed`, the fixture installed
(`cd fixtures/sample-project && npm install && npx playwright install chromium`), the
portal screenshot permission granted once (research R5; already granted on this machine on
2026-10-29).

## 1. README order and first screen (FR-001 to FR-004, SC-001, SC-002)

```sh
grep -n '^## ' README.md
```

Expected, in this order: Requirements, Install, What it does, Settings, Usage, Limitations
and differences from the VS Code extension, Getting help, Contributing and development,
License. Then:

```sh
sed -n '1,/^Contents/p' README.md | grep -nE '<[a-z]|!\[|shields.io' ; echo "exit $?"
```

Expected: no match (exit 1): the first screen is plain Markdown. Tick every row of the
section mapping in `contracts/readme-structure.md` with its new line number. Check that
"first slice" and "Node.js 20" no longer appear:

```sh
grep -nE 'first slice|Node\.js 20' README.md ; echo "exit $?"
```

## 2. Design proposals served locally (FR-007 to FR-009, SC-003)

```sh
python3 -m http.server --directory specs/010-user-docs-site/mocks 4321
```

Open `http://localhost:4321/`. Expected: a chooser with three proposals (Terminal,
Editorial, Cards), each with a landing and a docs link. Open each; resize to about 390 px
wide (no horizontal scrollbar); switch the system to dark mode and back (colours follow).
The owner picks one and comments; the pick is written to `design-decision.md` before any
site page is built.

## 3. Screenshot profile and one capture (FR-012, FR-013)

```sh
site/scripts/zed-screenshot-profile.sh            # launches Zed on fixtures/sample-project with its own profile
```

First launch only: `zed: install dev extension` on the repository root, then
`editor: restart language server` from `tests/passing.spec.ts`; `zed: extensions` must list
Playwright Runner 0.8.0 and the profile's work directory must hold server 0.8.0
(`<profile data>/zed/extensions/work/playwright-runner-lsp/package.json`). Trust the folder
when asked. Expected: One Dark theme, lenses above the tests, no vim mode, no tabs from
the owner's own Zed.

Stage scene `run-test-lens` (below), maximise the window, then:

```sh
python3 site/scripts/capture-screenshot.py run-test-lens --delay 3
```

Expected: `site/src/assets/screenshots/run-test-lens.png` written, 1920 px wide, top bar
cropped, Zed only; the script prints the file and size and refuses to overwrite without
`--force`. Add the manifest entry in `site/src/data/screenshots.ts`.

### Scenes

All on `fixtures/sample-project`, Zed maximised, `tests/passing.spec.ts` unless stated.

| Scene id | Capability | Stage | Capture when |
|----------|------------|-------|--------------|
| `landing-hero` | (landing) | `passing.spec.ts` open, cursor in `adds numbers`, after a passing run of the file | the pass notification is visible with lenses and duration labels |
| `run-test-lens` | run-test | file open, discovery done | lenses `▶ Run test` and `▶ Run describe` visible |
| `run-actions-menu` | run-test, run-describe, run-file, rerun-last | cursor on `test.describe('math'`, `ctrl-.` | the menu shows the Playwright entries |
| `run-result-pass` | run-result | run `adds numbers` | the "1 passed" notification is visible |
| `run-result-fail` | run-result | `failing.spec.ts`, run the first test | error notification and the red marker on the `expect` line |
| `discovery-consent` | discovery-consent | fresh profile, open the fixture before trusting | Zed's trust question is visible (Zed 0.218+); note in the caption that older Zed shows the Playwright question instead |
| `project-picker` | project-selection | `ctrl-.` in `playwright.config.ts` | `Playwright: [x] chromium` and `[ ] mobile` entries visible |
| `step-labels` | step-labels | `slow.spec.ts`, run `slow steps` | during the run, the `⌛ waiting…` label; a second capture `step-durations` after the run |
| `run-output` | run-output | `ctrl-.`, Show last run output | the output tab open next to the spec |
| `trace-viewer` | trace-viewer, show-trace | toggle Show trace viewer on, run `adds numbers` | the trace viewer window beside Zed (capture the whole screen, do not crop to Zed) |
| `show-browser` | show-browser | toggle Show browser on, run `shows the empty app` | the Chromium window beside Zed (whole screen) |
| `close-all-browsers` | close-all-browsers | `ctrl-.` after the shown run | `Playwright: Close all browsers` entry visible |

Check every picture by eye for FR-013 (no personal data, no private paths, no unrelated
windows).

## 4. Site builds and checks pass (FR-011, FR-014 to FR-016, SC-004, SC-005)

```sh
cd site && npm ci && npm run check && npm run build
```

Expected: `astro check` reports 0 errors; `check-screenshots` lists every capability with
its screenshot count and exits 0; `sync-parity` writes `reference/parity.md`; `astro build`
ends with the link validator reporting no invalid links and `dist/` present. Then:

```sh
npm run check-links
```

Expected: every outbound URL answers 2xx or 3xx (the script prints the list); any failure
is investigated and recorded.

## 5. Site content and layout (FR-010, FR-012, FR-014, SC-006)

```sh
cd site && npm run preview
```

Open `http://localhost:4321/playwright-zed/`. Expected: landing page with name,
one-sentence description, hero screenshot, Install and Read the docs actions, the two
notices, the capability grid, repository and issue links. Walk every sidebar entry;
each feature page shows at least one screenshot with a caption naming Zed 1.26.2 and
Playwright Runner 0.8.0. In the browser's device mode at 390 px: no horizontal scroll.
With the system in dark mode: colours switch. With JavaScript disabled: content,
navigation and images still render.

## 6. Nothing else changed (FR-018, SC-008)

```sh
git diff --stat main -- extension.toml Cargo.toml src/lib.rs server/ fixtures/ docs/parity.md
```

Expected: empty.

## 7. Pull request check (FR-016)

Open the PR. Expected: the "Docs site / build" job runs and passes; the existing CI jobs
run as before. Push a deliberate broken link on a scratch commit (optional, then revert):
the build job fails naming the link.

## 8. Publication (FR-017, SC-007), owner steps

1. Pages enabled with source "GitHub Actions": done by the owner on 2026-10-29
   (`gh api repos/radekBednarik/playwright-zed/pages` returns `build_type: workflow`).
2. Owner merges the PR. Expected: the `deploy` job runs on `main` and prints the page URL.
3. From a browser on another machine or a private window:
   `https://radekbednarik.github.io/playwright-zed/` shows the landing page; the README's
   site link on GitHub resolves to it.
4. Record the deployment date and the workflow run URL in `verification.md`; update the
   project memory (state `deployed`).
