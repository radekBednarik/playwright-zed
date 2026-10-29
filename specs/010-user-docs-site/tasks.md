---

description: "Task list for User Docs Site and README Restructure"
---

# Tasks: User Docs Site and README Restructure

**Input**: Design documents from `/specs/010-user-docs-site/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/readme-structure.md, contracts/site.md, quickstart.md

**Tests**: No unit tests (no Rust or server code changes). Constitution Principle V is met
by the mechanical checks the plan defines (heading-order check, screenshot coverage check,
internal link validation at build, `astro check`, the PR build job, the unchanged-version
diff) and by the quickstart scenarios, all recorded in `verification.md`.

**Organization**: Tasks are grouped by user story. The README (US1) and the design
proposals (US2) are independent of each other; the site (US3) waits for the owner's design
decision; publication (US4) waits for the site and for the owner enabling Pages.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 README for users, US2 owner picks a design, US3 published site with
  screenshots, US4 site published from the repository
- Every task names the exact file(s) it touches

## Path Conventions

- README: `README.md` (repository root)
- Site: `site/` (new npm package), content under `site/src/content/docs/`, screenshots
  under `site/src/assets/screenshots/`, scripts under `site/scripts/`
- Workflow: `.github/workflows/docs-site.yml` (new; `ci.yml` unchanged)
- Feature record: `specs/010-user-docs-site/` (mocks, design decision, verification)
- Screenshot profile: `~/.cache/playwright-zed-screenshots/{config,data}` (outside the
  repository, created by the launcher script)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: feature record files and ignore rules, nothing user-visible yet

- [x] T001 Create `specs/010-user-docs-site/verification.md` with one heading per
      quickstart scenario (1 to 8), each with "Command", "Output" and "Result" placeholders,
      plus the section mapping table copied from `contracts/readme-structure.md` with an
      empty "New line" column
- [x] T002 [P] Create `specs/010-user-docs-site/design-decision.md` with state `pending`,
      the three proposal ids (`a-terminal`, `b-editorial`, `c-cards`), and empty fields for
      chosen id, date, owner comments, requested changes, fate of the other proposals
- [x] T003 [P] Add to `.gitignore`: `site/dist/`, `site/.astro/`,
      `site/src/content/docs/reference/parity.md` (generated), with a comment naming
      feature 010; `node_modules/` is already covered

---

## Phase 2: Foundational (Screenshot capture tooling and captures)

**Purpose**: the real Zed screenshots every feature page needs (FR-012, FR-013). They do
not depend on the design choice and take owner time at the keyboard, so they start early.

**⚠️ CRITICAL**: US3 cannot be completed without these files

- [x] T004 [P] Write `site/screenshots/zed-settings.json`: theme `One Dark` for light
      and dark (`"theme": {"mode": "system", "light": "One Dark", "dark": "One Dark"}`),
      `"code_lens": "on"`, `"inlay_hints": {"enabled": true}`, `"vim_mode": false`,
      `"telemetry": {"diagnostics": false, "metrics": false}`,
      `"restore_on_startup": "none"`, default fonts and sizes (no `buffer_font_family`),
      `"ui_font_size": 16`, `"buffer_font_size": 15`
- [x] T005 [P] Write `site/scripts/zed-screenshot-profile.sh` (bash, executable):
      creates `~/.cache/playwright-zed-screenshots/config/zed` and `.../data`, copies
      `site/screenshots/zed-settings.json` to `config/zed/settings.json` when absent,
      unsets `PLAYWRIGHT_ZED_SERVER_ENTRY`, and runs
      `XDG_CONFIG_HOME=... XDG_DATA_HOME=... zed --foreground -n <repo>/fixtures/sample-project`
      (path resolved from the script's location); prints the profile paths and a reminder
      of the first-launch steps (install dev extension, restart language server)
- [x] T006 [P] Write `site/scripts/capture-screenshot.py` (Python 3, GLib bindings):
      arguments `<scene-id>`, `--delay <s>` (default 3), `--full` (keep the whole screen,
      for the trace viewer and browser scenes), `--force`, `--import <png>` (file a GNOME
      screenshot taken by hand instead of calling the portal); calls
      `org.freedesktop.portal.Screenshot.Screenshot` with `interactive: false`, waits for
      the `Response` signal (20 s timeout, non-zero exit on a non-zero response code),
      crops the GNOME top bar (height from `--top <px>`, default from a constant set in
      T008) unless `--full`, writes `site/src/assets/screenshots/<scene-id>.png` (refuses
      to overwrite without `--force`), removes the portal's temporary file, prints path
      and pixel size; cropping through ImageMagick `magick` (present on this machine) or
      Pillow if available, documented at the top of the file
- [x] T007 Owner at the keyboard: run `site/scripts/zed-screenshot-profile.sh`, trust
      the folder, `zed: install dev extension` on the repository root,
      `editor: restart language server` from `tests/passing.spec.ts`; verify
      `zed: extensions` lists Playwright Runner 0.8.0 and
      `~/.cache/playwright-zed-screenshots/data/zed/extensions/work/playwright-runner-lsp/package.json`
      says 0.8.0; record the output in `verification.md` scenario 3
- [x] T008 Calibrate the crop: take one `--full` capture of the maximised Zed window,
      measure the top bar height with `magick identify` or by inspecting the image, set
      the default in `site/scripts/capture-screenshot.py`, recapture without `--full` and
      confirm only Zed remains; note the value in `verification.md` scenario 3
- [x] T009 Capture scenes `run-test-lens`, `run-actions-menu`, `run-result-pass`,
      `landing-hero` (quickstart scene table) into `site/src/assets/screenshots/`
- [x] T010 Capture scenes `run-result-fail` (`tests/failing.spec.ts`) and
      `discovery-consent` (fresh profile copy or `workspace: clear trusted worktrees`,
      then reopen the fixture) into `site/src/assets/screenshots/`
- [x] T011 Capture scenes `project-picker` (`playwright.config.ts`), `step-labels` (during
      `slow steps`), `step-durations` (after it) and `run-output` into
      `site/src/assets/screenshots/`
- [x] T012 Capture scenes `trace-viewer` (`--full`, viewer window beside Zed),
      `show-browser` (`--full`, Chromium beside Zed) and `close-all-browsers` into
      `site/src/assets/screenshots/`; afterwards toggle both options off in the profile
- [x] T013 Review every PNG in `site/src/assets/screenshots/` by eye for FR-013 (no
      personal data, no paths outside the sample project, no unrelated windows, nothing
      from the owner's own Zed profile); retake any that fail; list the files with sizes
      in `verification.md` scenario 3

- [x] T053 Write `site/scripts/zed-input.py` (Python 3, GLib bindings): keystrokes
      (`key ctrl+shift+p`, `type <text>`), pointer (`moveto x y`, `click`) and `sleep` through
      `org.freedesktop.portal.RemoteDesktop` with a persisted restore token next to the
      profile; `session` for the one-time approval (run by the owner, since the auto-mode
      classifier refused the agent's first attempt). Added during implementation after the
      owner asked the agent to stage the scenes (analysis finding I2, 2026-10-29); documented
      in `docs/publishing.md` section 5 and `verification.md` scenario 3
- [x] T054 Add `extension.toml` to the path filters of `.github/workflows/docs-site.yml`
      and to `contracts/site.md` and `docs/publishing.md`, so a version bump runs the
      screenshot coverage check (analysis finding C1, 2026-10-29)

**Checkpoint**: 13 PNG files exist, each matching a quickstart scene id

---

## Phase 3: User Story 1 - A Zed user reads the README and gets going (Priority: P1) 🎯 MVP

**Goal**: user material first in the fixed order of `contracts/readme-structure.md`, one
contributor part at the end, site link and notices on the first screen, no fact lost.

**Independent Test**: quickstart scenario 1 (heading order, plain first screen, stale
wording gone) and the section mapping table fully ticked.

### Implementation for User Story 1

- [x] T014 [US1] Rewrite the top of `README.md` (title to "Contents"): description
      paragraph (current lines 3 to 7, "goal is feature parity" kept), one line
      "Documentation and screenshots: https://radekbednarik.github.io/playwright-zed/"
      (plain link, no badge), the work-in-progress notice rewritten without "first slice"
      (name what ships: run at cursor, file, describe, re-run, projects, step labels, run
      output, trace viewer, show browser), the non-affiliation and trademark paragraph
      unchanged, a two-sentence AI-assistance disclosure linking to the full note
      (`#built-with-ai-assistance`), then a "Contents" list of the `##` headings
- [x] T015 [US1] Write `## Requirements` (Zed 1.23+, Node.js 22 or newer on PATH,
      `@playwright/test` 1.38+ with browsers), `## Install` (registry status with the PR
      link and `docs/publishing.md` pointer; "from source" steps 1 to 3 for users who want
      the unreleased version, keeping the reinstall caveat and the Zed issue link; step 4
      moved out), `## What it does` (the current capability list, reworded where it says
      "today"), `## Settings` (`code_lens`, `inlay_hints`, and one block listing the
      `lsp.playwright.settings` keys `projects`, `showTrace`, `reuseBrowser` with links to
      their usage sections) in `README.md`
- [x] T016 [US1] Write `## Usage` in `README.md` with subsections in this order: "Before
      the first run: test discovery" (current text), "Actions" (the table and the notes),
      "Projects", "Step labels and run output" (the step-label and run-output notes moved
      here from the notes list), "Trace viewer", "Show browser and close all browsers",
      "Terminal output (optional)"; content moved, not rewritten, except cross-references
- [x] T017 [US1] Write `## Limitations and differences from the VS Code extension`
      (current "Differences" section plus the Zed limitations now scattered: menu cached
      per cursor position, server kept stopped after reinstall until
      `editor: restart language server`, labels instead of a highlighted line, editor tab
      instead of a panel, both surfaces opt-in) and `## Getting help` (issue tracker URL,
      what to attach: `dev: open language server logs` for runs, `zed: open log` for the
      extension, Zed, extension and Playwright versions) in `README.md`
- [x] T018 [US1] Write `## Contributing and development` in `README.md` with `###`
      subsections: "Building from the repository" (the `rustup target add`, server build,
      `zed: install dev extension`, and the `PLAYWRIGHT_ZED_SERVER_ENTRY` override from
      current step 4), "Manual testing" (current section, 0.8.0 line kept), "Development
      commands" (current "Development" section), "Publishing" (one line to
      `docs/publishing.md`), "Built with AI assistance" (the current paragraph in full);
      keep `## License` last
- [x] T019 [US1] Run quickstart scenario 1 (`grep -n '^## ' README.md`, the first-screen
      grep, the stale-wording grep), fill the "New line" column of the section mapping
      table and the scenario 1 result in `specs/010-user-docs-site/verification.md`; fix
      the README until every check passes

**Checkpoint**: the README alone satisfies FR-001 to FR-006; the site link points at the
future address (live after US4)

---

## Phase 4: User Story 2 - The owner picks a site design from local mocks (Priority: P2)

**Goal**: three visibly distinct, complete proposals served locally; the owner's pick
recorded before the site is built.

**Independent Test**: quickstart scenario 2 (chooser lists three, each resizes to 390 px
and follows dark mode, the pick lands in `design-decision.md`).

### Implementation for User Story 2

- [x] T020 [P] [US2] Write `specs/010-user-docs-site/mocks/index.html`: chooser listing
      the three proposals with name, blurb, traits (type, palette, landing layout, docs
      density) and links to `<id>/index.html` and `<id>/docs.html`; inline CSS, light and
      dark via `prefers-color-scheme`, the serve command shown on the page
- [x] T021 [P] [US2] Write `specs/010-user-docs-site/mocks/a-terminal/index.html` and
      `docs.html` ("Terminal": dark-first, monospace display type, one bright accent,
      landing led by a large editor screenshot, `../../../../site/src/assets/screenshots/landing-hero.png`
      if captured, otherwise a labelled placeholder frame, terminal-styled install block;
      docs page with Starlight's skeleton: header with title, search box, theme switch;
      left sidebar with the route list from `contracts/site.md`; content of the "Run tests"
      capability section written from the README; right table of contents); real text:
      extension name, description, both notices, install steps; responsive at 390 px
- [x] T022 [P] [US2] Write `specs/010-user-docs-site/mocks/b-editorial/index.html` and
      `docs.html` ("Editorial": light-first, serif display with humanist sans body, warm
      neutrals, wide measure, landing text left and screenshot right; same skeleton and
      content rules as T021)
- [x] T023 [P] [US2] Write `specs/010-user-docs-site/mocks/c-cards/index.html` and
      `docs.html` ("Cards": neutral palette with teal accent, rounded feature cards in a
      grid on the landing page, standard Starlight density in the docs; same skeleton and
      content rules as T021)
- [x] T024 [US2] Serve with `python3 -m http.server --directory specs/010-user-docs-site/mocks 4321`,
      open each proposal at desktop and 390 px width and in both colour schemes, fix any
      horizontal scroll or unreadable contrast, then hand the address to the owner
- [x] T025 [US2] Owner reviews and picks; write chosen id, date, comments and requested
      changes into `specs/010-user-docs-site/design-decision.md` (state `chosen`), note
      that the other two stay in `mocks/` as the record and are not deployed; record
      scenario 2 in `verification.md`

**Checkpoint**: `design-decision.md` is `chosen`; US3 may start

---

## Phase 5: User Story 3 - A visitor reads the published site with screenshots (Priority: P3)

**Goal**: the Starlight site in `site/`, themed after the chosen proposal, one page per
README user topic, a screenshot for every capability, parity page generated, internal links
validated, external links checked, readable on a phone, in dark mode and without scripting.

**Independent Test**: quickstart scenarios 4 and 5 (`npm run check`, `npm run build`,
`npm run check-links`, preview walk-through at 390 px, dark mode, scripting off).

### Scaffold

- [x] T026 [US3] Create `site/package.json` (`"private": true`, `"type": "module"`,
      `engines.node >= 24`, scripts per `contracts/site.md`: `dev`, `build`, `preview`,
      `check`, `sync-parity`, `check-screenshots`, `check-links`, with `predev` and
      `prebuild` running `sync-parity`), `site/.npmrc` (`save-exact=true`), then install
      with exact versions: `astro@7.4.4`, `@astrojs/starlight@0.42.7`, `sharp@0.35.5`,
      `starlight-links-validator@0.27.0`, `@astrojs/check@0.9.12`, `typescript@6.0.3`;
      re-check `npm view <pkg> version` at execution time and use the newer stable
      release if one appeared, keeping the `typescript` 6.x exception; commit
      `site/package-lock.json`
- [x] T027 [US3] Write `site/tsconfig.json` (extends `astro/tsconfigs/strict`, includes
      `scripts/**/*.ts`), `site/astro.config.ts` (`site: 'https://radekbednarik.github.io'`,
      `base: '/playwright-zed'`, `starlight({ title: 'Playwright Runner', description,
      social: [{ icon: 'github', label: 'GitHub', href: repository }], editLink: { baseUrl:
      'https://github.com/radekBednarik/playwright-zed/edit/main/site/' }, lastUpdated:
      true, sidebar: groups "Getting started", "Features", "Reference" and the top-level
      "Help" per contracts/site.md, customCss: ['./src/styles/theme.css'], plugins:
      [starlightLinksValidator()] })`), `site/src/content.config.ts` (Starlight `docs`
      collection with `docsLoader()` and `docsSchema()`), `site/public/favicon.svg` (a
      simple play-triangle glyph, no Playwright or Zed branding)
- [x] T028 [P] [US3] Write `site/scripts/sync-parity.ts`: read `../docs/parity.md`
      (path relative to `site/`), drop its `# Parity Matrix` heading, prepend frontmatter
      (`title: Parity with the VS Code extension`, `description`, a `tableOfContents:
      false`), add a first paragraph naming the source file, the current commit
      (`git rev-parse --short HEAD`, "unknown" if git is unavailable) and the date, write
      `src/content/docs/reference/parity.md`; exit non-zero if the source is missing
- [x] T029 [P] [US3] Write `site/src/data/screenshots.ts`: `export const capabilities`
      (the fixed list from data-model.md: `run-test`, `run-describe`, `run-file`,
      `rerun-last`, `run-result`, `discovery-consent`, `project-selection`, `step-labels`,
      `run-output`, `trace-viewer`, `show-trace`, `show-browser`, `close-all-browsers`),
      `export type Screenshot = { id; capability; alt; caption; extensionVersion;
      zedVersion; platform; capturedOn; scene }` with the field rules of data-model.md as
      comments, and `export const screenshots: Screenshot[]` with one entry per PNG from
      Phase 2 (`extensionVersion: '0.8.0'`, `zedVersion: '1.26.2'`, `platform: 'Linux
      (Ubuntu 26.04, GNOME)'`, `capturedOn` ISO date, alt text that describes what is
      visible); `run-actions-menu` is listed once per capability it shows (`run-test`,
      `run-describe`, `run-file`, `rerun-last`) through a `capabilities` array if simpler,
      documented either way
- [x] T030 [P] [US3] Write `site/scripts/check-screenshots.ts`: import the manifest,
      list `src/assets/screenshots/*.png`, read `version` from `../extension.toml`; fail
      (exit 1, each problem on its own line) when a capability has no entry, an entry has
      no file, a file has no entry, or an entry's `extensionVersion` differs from
      `extension.toml`; otherwise print one line per capability with its screenshot count
- [x] T031 [P] [US3] Write `site/scripts/check-external-links.ts`: walk `dist/**/*.html`,
      collect `href` and `src` values starting with `http`, deduplicate, request each with
      `fetch` (HEAD, then GET on 405 or 404 from HEAD), print status per URL, exit 1 on any
      status outside 2xx and 3xx or on a network error; 10 s timeout per URL
- [x] T032 [P] [US3] Write `site/src/components/Shot.astro`: prop `id`, looks the entry
      up in the manifest (throws at build when missing), imports the PNG through
      `import.meta.glob('../assets/screenshots/*.png', { eager: true })`, renders
      `<figure>` with `<Image>` from `astro:assets` (`width` capped at 1920, `alt` from the
      manifest) and a `<figcaption>` "<caption> (Zed <zedVersion>, Playwright Runner
      <extensionVersion>, <platform>)"

### Theme (from the chosen proposal)

- [x] T033 [US3] Write `site/src/styles/theme.css` from `design-decision.md`: accent and
      gray scales (`--sl-color-accent-low/-/-high`, `--sl-color-gray-1..7` for both
      `:root` and `:root[data-theme='light']`), `--sl-font` and `--sl-font-mono`,
      `--sl-content-width`, heading styles; install the chosen `@fontsource-variable/*`
      packages (exact versions) and import them at the top of the file; add component
      overrides under `site/src/components/overrides/` and register them in
      `astro.config.ts` `components` only where the chosen mock needs them (named in
      `design-decision.md`)

### Content

- [x] T034 [US3] Write `site/src/content/docs/index.mdx`: `template: splash`, `hero`
      (title "Playwright Runner", tagline = the one-sentence description, `image.file`
      `../../assets/screenshots/landing-hero.png` with `alt`, actions "Install"
      (`/playwright-zed/getting-started/install/`, primary) and "Read the docs"
      (`/playwright-zed/getting-started/requirements/`)), then the work-in-progress and
      non-affiliation notices, a `<CardGrid>` of the six feature pages, and links to the
      repository and the issue tracker; if `design-decision.md` names a landing layout the
      hero cannot give, write `site/src/pages/index.astro` instead and keep `index.mdx`
      out (Starlight's `disable404Route` untouched)
- [x] T035 [P] [US3] Write `site/src/content/docs/getting-started/requirements.md`,
      `install.md` (registry status, from-source steps, the reinstall caveat with the Zed
      issue link, the restart command) and `first-run.md` (trust and discovery on Zed
      0.218+ and older, the two settings to turn on, with `<Shot id="discovery-consent" />`
      and `<Shot id="run-test-lens" />`; `.mdx` where a `Shot` is used) from the README
      user sections
- [x] T036 [P] [US3] Write `site/src/content/docs/features/run-tests.mdx` (run test,
      describe, file, re-run; the action table rows; unsaved-file warning; cancel on a
      second run; failure markers with the `[project]` prefix; shots `run-test-lens`,
      `run-actions-menu`, `run-result-pass`, `run-result-fail`) and
      `features/discovery-consent.mdx` (the question on older Zed and `rootUri` roots,
      "Enable test discovery", shot `discovery-consent`)
- [x] T037 [P] [US3] Write `site/src/content/docs/features/projects.mdx` (picker,
      first-project default, remembered per config, folder default `projects`, menu
      caching note, shot `project-picker`) and `features/step-labels-and-output.mdx`
      (executing label, durations, `ran N×`, cleared on edit or next run, run output tab
      and the `runs/` folder, jump to a `file:line`; shots `step-labels`,
      `step-durations`, `run-output`)
- [x] T038 [P] [US3] Write `site/src/content/docs/features/trace-viewer.mdx` (toggle,
      live follow of a single test, "Show trace" at the cursor, `--trace on`, `showTrace`
      default, viewer failure message; shot `trace-viewer`) and `features/show-browser.mdx`
      (toggle, headed single worker, kept browser, "Close all browsers", refusal during a
      run, mutual exclusion with the trace viewer, video note, `reuseBrowser` default;
      shots `show-browser`, `close-all-browsers`)
- [x] T039 [P] [US3] Write `site/src/content/docs/reference/settings.md` (`code_lens`,
      `inlay_hints`, the `lsp.playwright.settings` block with `projects`, `showTrace`,
      `reuseBrowser`, per-language placement, `PLAYWRIGHT_ZED_STATE_DIR`),
      `reference/differences.md` (the README's limitations and differences section, one
      bullet per item, with the Zed issue link) and `reference/state-files.md` (the state
      directory table per OS, `project-selection.json`, `trace-viewer.json`,
      `show-browser.json`, `runs/`), plus `help.md` (issue tracker, logs to attach,
      versions to state, the terminal task recipe as "if you want a real terminal")
- [x] T040 [US3] Add a short note to every feature page and the landing page that the
      screenshots show Zed 1.26.2 on Linux with Playwright Runner 0.8.0 and that the
      window chrome differs per platform (one sentence, same wording, in
      `site/src/content/docs/features/*.mdx` and `index.mdx`)

### Checks

- [x] T041 [US3] Run `cd site && npm ci && npm run check && npm run build`; fix every
      `astro check` error, coverage failure and invalid link until all pass; then
      `npm run check-links` and resolve or record every non-2xx/3xx; record scenario 4 in
      `specs/010-user-docs-site/verification.md` with the command output
- [x] T042 [US3] Run `npm run preview`, walk every sidebar entry, check the landing
      page content list (FR-010), the 390 px width, dark mode and scripting off, and that
      every feature page shows at least one captioned screenshot; record scenario 5 in
      `verification.md`; fix the theme or content until it passes

**Checkpoint**: the site builds clean and satisfies FR-010 to FR-016 locally

---

## Phase 6: User Story 4 - The site is published from the repository (Priority: P4)

**Goal**: `docs-site.yml` builds on PRs and deploys from `main`; the owner enables Pages;
the README link goes live.

**Independent Test**: quickstart scenarios 7 and 8 (PR build job green; after the owner's
steps, the address serves the site from another machine).

### Implementation for User Story 4

- [x] T043 [US4] Write `.github/workflows/docs-site.yml` per `contracts/site.md`:
      `pull_request` and `push` to `main` with `paths: [site/**, docs/parity.md,
      .github/workflows/docs-site.yml]`, `workflow_dispatch`; `permissions: contents:
      read, pages: write, id-token: write`; `concurrency: group: pages, cancel-in-progress:
      false`; job `build` (`actions/checkout@v7`, `actions/setup-node@v7` with
      `node-version: 24`, `cache: npm`, `cache-dependency-path: site/package-lock.json`,
      `npm ci`, `npm run check`, `npm run build` in `site/`,
      `actions/upload-pages-artifact@v5` with `path: site/dist`); job `deploy` (`if:
      github.event_name != 'pull_request'`, `needs: build`, `environment: { name:
      github-pages, url: ${{ steps.deployment.outputs.page_url }} }`,
      `actions/deploy-pages@v5` with `id: deployment`); re-check the latest action tags
      with `gh api repos/<owner>/<action>/releases/latest` at execution time
- [ ] T044 [US4] Commit the feature on `010-user-docs-site` (README, `site/`, workflow,
      `.gitignore`, feature record including mocks and screenshots) and push; open the PR
      against `main` with a description that lists the quickstart scenarios run, states
      "no extension, server or registry change", and ends with the attribution line;
      confirm the "Docs site / build" job and the existing CI jobs pass; record scenario 7
      in `specs/010-user-docs-site/verification.md`
- [x] T045 [US4] Owner enables GitHub Pages with source "GitHub Actions". Done by the
      owner on 2026-10-29 before task generation finished; confirmed with
      `gh api repos/radekBednarik/playwright-zed/pages` returning `build_type: workflow`,
      `html_url: https://radekbednarik.github.io/playwright-zed/`. Copy this evidence into
      `verification.md` scenario 8 when T001 creates the file
- [ ] T046 [US4] Owner merges the PR (`! gh pr merge <n> --squash --admin --delete-branch`);
      the agent watches the `deploy` job (`gh run list --workflow docs-site.yml`), opens
      `https://radekbednarik.github.io/playwright-zed/` in a private window, checks the
      README link on GitHub resolves, records the run URL and date in `verification.md`
      scenario 8, and sets the publication state to `deployed` in
      `.claude/memory/playwright-zed-project.md` (through the docs PR of T051)

**Checkpoint**: the site is live and republishes from `main`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: project records, unchanged-version proof, final analysis

- [x] T047 [P] Run quickstart scenario 6 (`git diff --stat main -- extension.toml
      Cargo.toml src/lib.rs server/ fixtures/ docs/parity.md`, expected empty) and record
      it in `specs/010-user-docs-site/verification.md`
- [x] T048 [P] Add the site commands to `CLAUDE.md` "Commands" (`cd site && npm run check
      && npm run build`) and one line under the workflow section that the site deploys
      from `main` through `docs-site.yml` and that Pages enablement and deploys are the
      owner's
- [x] T049 [P] Add a "Documentation site" section to `docs/publishing.md`: the address,
      the workflow, the path filters, how to retake screenshots when a release changes a
      capability (profile script, capture helper, manifest, coverage check against
      `extension.toml`)
- [x] T050 [P] Update `.claude/memory/dev-environment-wsl-zed.md`: rename to
      `.claude/memory/dev-environment-linux-zed.md`, describe the native Ubuntu 26.04
      machine (GNOME on Wayland, Zed 1.26.2 at `~/.local/zed.app`, portal screenshot
      permission granted, the screenshot profile under `~/.cache/playwright-zed-screenshots`),
      keep the WSL notes as a dated "earlier machine" paragraph, and fix the `@` import in
      `CLAUDE.md`
- [ ] T051 Record feature 010 in `.claude/memory/playwright-zed-project.md` (branch, PR
      number, merge commit, site address, publication state, the `typescript` 6.x
      exception, the screenshot procedure, "no version bump"); open it as a docs PR after
      the feature PR merges, as previous features did
- [x] T052 Run `/speckit-analyze` on the finished feature and fix any finding; make sure
      every scenario in `specs/010-user-docs-site/verification.md` has a result (run
      2026-10-29 before the merge: no critical or high finding; C1 and I2 applied as T053
      and T054, I1 resolved by amending FR-013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: T004 to T006 any time; T007 needs T004 and T005 and the owner
  at the keyboard; T008 needs T006 and T007; T009 to T012 need T008; T013 needs T009 to
  T012
- **US1 (Phase 3)**: needs nothing from Phase 2; can run first
- **US2 (Phase 4)**: needs nothing from Phase 2 (T021 uses `landing-hero.png` only if it
  already exists); T025 is the owner's decision
- **US3 (Phase 5)**: needs T025 (design chosen) and T013 (screenshots) for T029, T033 to
  T042; T026 to T028 and T030 to T032 can start right after T025
- **US4 (Phase 6)**: T043 needs T041; T044 needs T019, T025, T042, T043; T045 is already
  done (Pages enabled 2026-10-29); T046 needs T044
- **Polish (Phase 7)**: T047 to T050 any time after T044; T051 after T046; T052 last

### User Story Dependencies

- US1 and US2 are independent of each other and of the screenshots
- US3 depends on US2 (design) and on Phase 2 (screenshots)
- US4 depends on US3 and on the owner enabling Pages

### Parallel Opportunities

- T002, T003 with T001
- T004, T005, T006 together; then the capture tasks are sequential at the keyboard
- T014 to T018 are one file and run in order; US1 as a whole runs in parallel with US2
- T020 to T023 together (four files)
- After T025: T028, T029, T030, T031, T032 together; T035 to T039 together after T032
  and T033
- T047 to T050 together

## Parallel Example: after the design decision

```text
T028 site/scripts/sync-parity.ts
T029 site/src/data/screenshots.ts
T030 site/scripts/check-screenshots.ts
T031 site/scripts/check-external-links.ts
T032 site/src/components/Shot.astro
then T033 theme, then T035 to T039 content pages together
```

## Implementation Strategy

### MVP First (User Story 1)

1. T001 to T003, then T014 to T019: the README alone is a complete, reviewable
   improvement and carries the site link for later.

### Incremental Delivery

1. US2 next: the mocks need the owner's time, so serve them as early as possible and
   capture screenshots (Phase 2) while the owner compares.
2. US3 once the pick is recorded; build and check locally.
3. US4: workflow, PR, the owner's Pages enablement and merge, live check.
4. Polish: records, memory, analysis.

## Notes

- Nothing in this feature bumps a version or publishes a package; the registry PR stays at
  `v0.8.0`.
- The owner approves every outward-facing step: Pages enablement (done 2026-10-29), merge,
  first deploy (happens with the merge, since the `deploy` job runs on `main`).
- Version numbers in T026 and T043 were current on 2026-10-29; re-check at execution.
