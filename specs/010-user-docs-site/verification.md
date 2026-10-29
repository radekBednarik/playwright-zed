# Verification: User Docs Site and README Restructure

**Feature**: `010-user-docs-site` | **Started**: 2026-10-29

One section per quickstart scenario. Each records the command run, its output (trimmed to
the relevant lines) and the result. Owner steps are marked as such.

## Scenario 1: README order and first screen

**Date**: 2026-10-29

**Command**:

```sh
grep -n '^## ' README.md
sed -n '1,/^Contents/p' README.md | grep -nE '<[a-z]|!\[|shields.io' ; echo "exit $?"
grep -nE 'first slice|Node\.js 20' README.md ; echo "exit $?"
```

**Output**:

```text
36:## Requirements
43:## Install
74:## What it does
101:## Settings
164:## Usage
351:## Limitations and differences from the VS Code extension
381:## Getting help
395:## Contributing and development
488:## License
exit 1        (first screen: no HTML, images or badges)
exit 1        (no stale wording)
```

Subheadings under Usage: discovery (166), Actions (198), Projects (230), Step labels and
run output (255), Trace viewer (269), Show browser and close all browsers (297), Terminal
output (331). Under Contributing and development: Building from the repository (399),
Manual testing (424), Development commands (459), Publishing (474), Built with AI
assistance (479).

**Result**: PASS. Every user heading precedes the contributor part; the first screen (lines
1 to 34) is plain Markdown with the description, the site link (line 9), the
work-in-progress notice, the non-affiliation notice and the two-sentence AI disclosure;
"first slice" and "Node.js 20" are gone (Requirements now says Node.js 22).

### Section mapping (SC-002)

| Current section (line) | New location | New line |
|------------------------|--------------|----------|
| Intro paragraphs (1 to 13) | Intro, unchanged facts, plus the site link line | 1 to 9 |
| Project status (15) | Intro notice, rewritten without "first slice" | 11 to 18 |
| Built with AI assistance (24) | Two sentences in the intro; full note under Contributing and development | 24 to 26, 479 |
| What it does today (33) | What it does | 74 |
| Requirements (60) | Requirements (Node 22) | 36 |
| Install (67): registry, from source steps 1 to 3, reinstall caveat | Install | 43 |
| Install step 4 (local server override) | Contributing and development, Building from the repository | 399 (step 2) |
| Settings (102) | Settings, plus the `lsp.playwright.settings` keys and the state directory table | 101 |
| Usage, test discovery (131) | Usage, Before the first run | 166 |
| Usage, action table and notes (163 to 200) | Usage, Actions and notes (step-label and output notes moved to 255) | 198 |
| Differences from the VS Code extension (202) | Limitations and differences | 351 |
| Projects (223) | Usage, Projects (state table and settings block now under Settings) | 230 |
| Trace viewer (274) | Usage, Trace viewer | 269 |
| Show browser (314) | Usage, Show browser and close all browsers | 297 |
| Terminal output (361) | Usage, Terminal output (optional) | 331 |
| Manual testing (381) | Contributing and development, Manual testing (prerequisites and build steps merged into Building from the repository) | 424 |
| Development (435) | Contributing and development, Development commands | 459 |
| (new) | Getting help | 381 |
| (new) | Contributing and development, Publishing | 474 |
| License (447) | License | 488 |

## Scenario 2: Design proposals served locally

**Date**: 2026-10-29 (agent part); owner's pick pending

**Command**:

```sh
python3 -m http.server --directory specs/010-user-docs-site/mocks --bind 127.0.0.1 4321
# render check with the fixture's Playwright (scratch script render-mocks.mjs):
# every page at 1280 x 900 and 390 x 844, light and dark, scrollWidth compared with the viewport
```

**Output**:

```text
chooser http 200, a-terminal/docs.html http 200
24 renders written; "no horizontal overflow" (12 page/width/scheme combinations at 390 px)
em dash count 0 in every mock file
```

Reviewed by eye at desktop width: all three show the same CONTENT.md text, both notices,
the install steps, the six capabilities, the Starlight skeleton on the docs page (header
with search and theme switch, left sidebar with the route list, content, right "On this
page", footer with edit link, last updated and previous/next). Two fixes applied after the
first render: proposal A's install steps wrapped per code chip and its 4-column grid left
two empty cells (now flowing text and 3 columns); proposal B's notices had no bottom
spacing before the footer rule (now 3 rem). Phone renders: sidebar behind a "Menu"
control, tables scroll inside their own box.

**Result**: PASS for the agent part (FR-007, FR-008). The owner's pick (FR-009) is recorded
in `design-decision.md`.

## Scenario 3: Screenshot profile and captures

**Date**: 2026-10-29. Staged by the agent through the desktop portals after the owner
granted the one-time screenshot and remote-control permissions (`zed-input.py session`,
run by the owner); the owner asked for this instead of staging by hand.

**Profile**: `site/scripts/zed-screenshot-profile.sh` (XDG config and data under
`~/.cache/playwright-zed-screenshots/`, extension state in `.../state` through
`PLAYWRIGHT_ZED_STATE_DIR`, added during the session because the first menu capture showed
the owner's own "Show trace viewer" choice). First launch: trust dialog accepted with
Enter, `zed: install dev extension` through the palette and the GTK folder chooser,
extension compiled in 0.77 s (cached target), server installed from npm:
`~/.cache/playwright-zed-screenshots/data/zed/extensions/work/playwright-runner-lsp/node_modules/playwright-zed-language-server/package.json`
says `"version": "0.8.0"`. Profile settings gained `show_type_hints: false`,
`show_parameter_hints: false` (TypeScript's own hints cluttered every line) and
`git.inline_blame.enabled: false` (the owner's handle on the cursor line).

**Crop calibration** (T008): GNOME top bar 32 px (rows 0 to 31 of a full capture are the
bar colour), Ubuntu dock 49 px at the bottom; cropped captures are 1920 x 1119.

**Captures** (`site/src/assets/screenshots/`, Zed 1.26.2, Playwright Runner 0.8.0,
One Dark, maximised window, 1920 x 1119 unless noted):

| File | Scene | Note |
|------|-------|------|
| `run-test-lens.png` | lenses after discovery | |
| `run-actions-menu.png` | `ctrl-.` on line 14 (test inside `math`) after a run | shows Run test at cursor, Run file, Re-run last, Show last run output, both option toggles, both projects |
| `run-result-pass.png` | Run test at cursor, captured 3 s after the menu choice | notification "1 passed, 0 failed, 0 skipped (0.4s)", durations on the step lines |
| `run-result-fail.png` | `failing.spec.ts`, first test | error notification with Expected 3 / Received 2, red marker under `toBe` |
| `landing-hero.png` | Run file on `passing.spec.ts`, captured when the run log reported `status: passed` | "11 passed, 0 failed, 1 skipped (1.8s)", durations on every step |
| `project-picker.png` | `ctrl-.` on line 12 of `playwright.config.ts` | `[x] chromium`, `[ ] mobile`, Select all projects |
| `step-labels.png` | `slow.spec.ts` during the run | `⌛ waiting…` on step two |
| `step-durations.png` | after the run | 2002, 2011, 2010 ms |
| `run-output.png` | Show last run output | log tab with command, status, list reporter output |
| `trace-viewer.png` | option on, Run test at cursor | viewer window over Zed with the trace; Chromium's translate prompt dismissed first |
| `show-browser.png` | option on, `shows the empty app` | Chromium window with TodoMVC over Zed, kept after the run |
| `close-all-browsers.png` | `ctrl-.` while the browser is kept | `[x] Show browser` and `Close all browsers` entries |
| `discovery-consent.png` | after `workspace: clear trusted worktrees`, Restricted Mode badge clicked | Zed's trust dialog over the maximised window |

**FR-013 review** (every file viewed): no unrelated window in any capture (two early
attempts that showed the owner's terminal behind a floating window were discarded and
retaken maximised); no personal data; the only paths outside the sample project are the
Node binary and the run log in `run-output.png`, both under the owner's home directory
whose name equals the public GitHub handle (accepted; FR-013 amended on 2026-10-29 after
`/speckit-analyze` finding I1 to say so). The fixture is unchanged on disk
after the session (`git status --short fixtures/` empty; one accidental newline during
staging was undone and the buffer saved back to the on-disk content).

**Result**: PASS. 13 files, one per scene; `check-screenshots` lists every capability
with at least one picture.

## Scenario 4: Site builds and checks pass

**Date**: 2026-10-29 (provisional, placeholder mode; final run after the captures)

**Command**:

```sh
cd site && npm run sync-parity && npx astro check
node scripts/check-screenshots.ts
SCREENSHOTS_PLACEHOLDER=1 npx astro build
node scripts/check-external-links.ts
```

**Output**:

```text
sync-parity: wrote .../reference/parity.md from .../docs/parity.md (b810192)
astro check: Result (9 files): 0 errors, 0 warnings, 0 hints
check-screenshots: FAIL, 13 manifest entries without a file (expected before the captures)
astro build: 16 page(s) built; "All internal links are valid."
check-external-links: 25 external URL(s), 0 failure(s)
```

**Result**: provisional PASS for `astro check`, the build (with placeholder frames), the
internal link validation and the outbound links; the coverage check fails as designed
until the screenshots exist. The `editUrl: false` frontmatter was added to the generated
parity page after the first link run showed an "Edit this page" link to the gitignored
file. Final run recorded below once the captures are in.

**Final run** (2026-10-29, after the captures):

```text
npm run check:  astro check Result (9 files): 0 errors, 0 warnings, 0 hints
                check-screenshots: OK (13 screenshots, extension 0.8.0), every capability >= 1
npm run build:  16 page(s) built; "All internal links are valid."; 13 optimised images; dist 2.6 MB
```

**Result**: PASS (FR-011, FR-012, FR-014, FR-015, FR-016, SC-004, SC-005).

## Scenario 5: Site content and layout

**Date**: 2026-10-29 (provisional, placeholder frames instead of screenshots)

**Command**:

```sh
cd site && npx astro preview --host 127.0.0.1 --port 4322
# scratch script render-site.mjs: landing, features/run-tests, reference/settings,
# reference/parity at 1280 x 900 and 390 x 844, dark and light; checks HTTP status,
# scrollWidth against the viewport and console errors
```

**Output**:

```text
preview http 200
site render: no overflow, no console errors, all 200
```

Reviewed by eye: landing page carries the name, the one-sentence description, the hero
frame (placeholder until the capture), Install and Read the docs actions, the terminal
install panel, the requirements, the six-capability grid, both notices and the footer
links (FR-010); docs pages show the Starlight skeleton in the Terminal theme (monospace
headings with `#` prefixes, `## GROUP` sidebar labels, `▶` current entry, panel tables)
in dark and light; at 390 px the sidebar is behind the menu button and nothing scrolls
sideways. One fix after the first render: a missing space before the "install from
source" link on the landing page.

**Result**: provisional PASS (FR-010, FR-014, SC-006); the screenshot items of FR-012 are
checked in the final run.

**Final run** (2026-10-29, real screenshots): `astro preview` rendered through the same
script: "site render: no overflow, no console errors, all 200" at 1280 and 390 px, dark
and light. Reviewed by eye: the landing hero shows the whole-file run with durations and
the "11 passed" notification inside the editor frame; every feature page shows its
captioned screenshots ("Zed 1.26.2, Playwright Runner 0.8.0, Linux (Ubuntu 26.04,
GNOME)"); the phone layout keeps the sidebar behind the menu button.

**Result**: PASS (FR-010, FR-012, FR-014, SC-004, SC-006).

## Scenario 6: Nothing else changed

**Date**: 2026-10-29 (re-run before the PR)

**Command**:

```sh
git diff --stat main -- extension.toml Cargo.toml src/lib.rs server/ fixtures/ docs/parity.md
```

**Output**: empty.

**Result**: PASS (FR-018, SC-008): the extension manifest, the Rust shell, the language
server, the fixture and the parity matrix are untouched.

## Scenario 7: Pull request check

**Command**: _pending_

**Output**: _pending_

**Result**: _pending_

## Scenario 8: Publication (owner steps)

**Pages enabled**: by the owner on 2026-10-29, before implementation started.
`gh api repos/radekBednarik/playwright-zed/pages` returned
`{"build_type":"workflow","html_url":"https://radekbednarik.github.io/playwright-zed/","source":{"branch":"main","path":"/"}}`.

**Merge and deploy**: _pending_

**Result**: _pending_
