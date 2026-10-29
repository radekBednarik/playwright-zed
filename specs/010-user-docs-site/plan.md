# Implementation Plan: User Docs Site and README Restructure

**Branch**: `010-user-docs-site` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-user-docs-site/spec.md`

## Summary

A documentation feature with no extension or server change: restructure the README so a
Zed user finds requirements, install, capabilities, usage, settings, limitations and help
before any contributor material, and add a documentation and promotion site, published on
GitHub Pages from the repository, with a real screenshot of Zed for every capability the
extension offers today. The site is chosen from three locally served design proposals
before it is built.

Technical approach (research R1 to R9): Astro 7 with Starlight, written in TypeScript,
dependencies pinned at the latest stable releases (one recorded exception, `typescript`
6.0.3 for `@astrojs/check`), in a new `site/` directory; a landing page on Starlight's
splash template (or a plain Astro page if the chosen design needs it), one docs page per
topic of the README's user part, a parity page generated from `docs/parity.md` at build,
internal links validated at build, a screenshot manifest with a coverage check, and a
`docs-site.yml` workflow that builds on pull requests and deploys from `main` once the owner
enables Pages. Screenshots are captured through the desktop portal from a dedicated Zed
profile with the released extension 0.8.0 on the sample project. Three static HTML mocks
served by one command give the owner the design choice, recorded in
`design-decision.md`.

## Technical Context

**Language/Version**: TypeScript 6.0.3 for the site (Astro config, scripts, components);
Markdown and MDX content; two Python 3 helpers (`capture-screenshot.py` for the portal
screenshot call, `zed-input.py` for portal keystrokes and clicks, GLib bindings already
on the machine), outside the site build; Node 26
locally, Node 24 in CI; Rust and the language server untouched

**Primary Dependencies**: `astro` 7.4.4, `@astrojs/starlight` 0.42.7,
`starlight-links-validator` 0.27.0, `@astrojs/check` 0.9.12, `sharp` 0.35.5, the fonts of
the chosen design (`@fontsource-variable/*`); GitHub Actions `actions/checkout@v7`,
`actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`

**Storage**: none at runtime (static site); screenshots as PNG files under
`site/src/assets/screenshots/` with a typed manifest; the generated parity page is
gitignored build output

**Testing**: `npm run check` in `site/` (`astro check`, screenshot coverage check);
`npm run build` (internal link validation fails the build); an external link script run
locally; a README heading-order check (script in `quickstart.md`); manual browser checks at
phone width and in dark mode; the workflow's `build` job on every PR touching the site; all
recorded in `verification.md`

**Target Platform**: any modern browser, phone and desktop widths, light and dark, without
scripting for content; site built on Linux (local and CI); screenshots from Zed 1.26.2 on
Ubuntu 26.04 with extension 0.8.0

**Project Type**: static documentation site inside an existing Zed extension repository,
plus a README rewrite

**Performance Goals**: the landing page is readable within 2 seconds on a broadband
connection (static HTML, optimised images at most 1920 px wide, no client framework); the
site builds in under 2 minutes in CI

**Constraints**: no extension, server or registry change (FR-018; `extension.toml`,
`Cargo.toml`, `src/lib.rs`, `server/package.json` unchanged); nothing deployed before the
owner enables Pages and approves; no Playwright or Zed logos; no analytics; latest stable
dependencies pinned exactly with exceptions recorded (FR-015); the README stays complete
without the site

**Scale/Scope**: one README (about 450 lines today, similar after); a site of roughly 15
pages (landing, 3 getting-started pages, 6 capability pages, 4 reference pages, help); about
12 screenshots; 3 mocks; 1 workflow; 4 small scripts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| I. Reference-driven parity | Pass | No parity row changes. The spec's Upstream Reference describes how upstream documents itself (capability sections with editor screenshots, no maintainer material) and the README and site follow that order. The site documents only shipped capabilities and renders the parity matrix itself, so it cannot claim more than `docs/parity.md` does. |
| II. Zed extension rules | Pass | No change to the extension, its manifest, or the language server. The README keeps the non-affiliation and trademark notice and the license section; the site repeats the notice and uses no Playwright or Zed branding. Nothing outward-facing happens without the owner (Pages enablement, first deploy). |
| III. Native primitives | Pass (not applicable) | No capability mapping changes; the site is outside the extension. |
| IV. Playwright CLI is the runtime | Pass (not applicable) | Screenshots are taken of the released extension driving the sample project's Playwright; nothing is reimplemented or mocked. |
| V. Verified behaviour | Pass | Mechanical checks for the testable requirements: heading-order check (FR-002, FR-003), section mapping checklist (FR-004), screenshot coverage check (FR-012, FR-013), internal link validation at build (FR-014), external link script, `astro check`, PR build job (FR-016), unchanged-version check (FR-018); manual browser checks recorded in `verification.md`; the deployed address opened from another machine after the owner's go-ahead (SC-007). |

Workflow gates: the PR carries no parity diff (none changed) and no Rust or server output
beyond the unchanged CI jobs; the quickstart holds the verification steps. Simplicity rule:
Starlight is the smallest thing that gives docs chrome, dark mode, search and link
validation; a plain Astro landing page is added only if the chosen design needs it.

Post-design re-check (after Phase 1): unchanged, all pass. The Python capture helper is a
local developer tool, not part of the site, and does not touch the "site in TypeScript"
constraint; recorded in research R5.

## Project Structure

### Documentation (this feature)

```text
specs/010-user-docs-site/
├── spec.md
├── plan.md                  # this file
├── research.md              # R1 to R10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── readme-structure.md  # heading order and section mapping
│   └── site.md              # routes, navigation, screenshot manifest, workflow
├── checklists/requirements.md
├── mocks/                   # design proposals, served locally, not deployed
│   ├── index.html           # chooser
│   ├── a-terminal/{index,docs}.html
│   ├── b-editorial/{index,docs}.html
│   └── c-cards/{index,docs}.html
├── design-decision.md       # the owner's pick, date, comments (written at selection)
├── verification.md          # evidence per quickstart scenario
└── tasks.md                 # /speckit-tasks output
```

### Source Code (repository root)

```text
README.md                            # restructured per contracts/readme-structure.md
.github/workflows/docs-site.yml      # build on PR, deploy from main
site/
├── .npmrc                           # save-exact=true
├── package.json                     # scripts: dev, build, preview, check, sync-parity, check-screenshots, check-links
├── package-lock.json
├── tsconfig.json                    # extends astro/tsconfigs/strict
├── astro.config.ts                  # site, base, starlight(), plugins, customCss
├── public/favicon.svg
├── scripts/
│   ├── sync-parity.ts               # docs/parity.md -> src/content/docs/reference/parity.md (generated)
│   ├── check-screenshots.ts         # manifest vs files vs capability list
│   ├── check-external-links.ts      # outbound links in dist/, run locally
│   ├── capture-screenshot.py        # portal call, crop (top bar and dock), write PNG under a scene id
│   ├── zed-input.py                 # portal keystrokes and clicks to stage scenes (added during implementation)
│   └── zed-screenshot-profile.sh    # launches Zed with the dedicated profile and its own extension state
├── screenshots/
│   └── zed-settings.json            # settings copied into the screenshot profile
└── src/
    ├── content.config.ts            # Starlight docs collection
    ├── content/docs/
    │   ├── index.mdx                # landing (splash + hero), or src/pages/index.astro if the design needs it
    │   ├── getting-started/{requirements,install,first-run}.md
    │   ├── features/{run-tests,projects,step-labels-and-output,trace-viewer,show-browser,discovery-consent}.mdx
    │   ├── reference/{settings,differences,state-files,parity}.md   # parity.md generated, gitignored
    │   └── help.md
    ├── components/Shot.astro         # screenshot with alt, caption and versions from the manifest
    ├── data/screenshots.ts           # typed manifest
    ├── assets/screenshots/*.png
    └── styles/theme.css              # the chosen design as Starlight custom properties
```

**Structure Decision**: a single `site/` package next to `server/`, with its own lockfile
and scripts, keeps the site's dependencies and Node version independent of the language
server (which must keep supporting Node 22). The mocks live with the feature record, not
under `site/`, because they are a decision artifact and must not ship.

## Design Notes

- **README first screen**: plain Markdown only (no HTML, no badges), description, site
  link, notices, short AI disclosure, then a manual "Contents" list. Contract in
  `contracts/readme-structure.md`.
- **Landing page**: Starlight `template: splash` with `hero` (title, tagline, image with
  `alt`, actions "Install" and "Read the docs") followed by notices and a capability grid
  that links each capability page; a plain Astro page replaces it only if the chosen mock
  needs a layout the hero cannot give.
- **Capability pages**: one page per feature group, each with invocation ("`ctrl-.`, then
  ..."), expected result, one or more `<Shot>` blocks, related settings and limitations;
  content written from the README's user sections to limit drift.
- **Screenshots**: scene list in `quickstart.md`; manifest entry per file; captions carry
  "Zed 1.26.2, Playwright Runner 0.8.0, Linux"; the pages say the editor chrome differs per
  platform. The capture helper crops the top bar from the full-screen portal capture and
  refuses to overwrite without `--force`.
- **Parity page**: generated; the page header names `docs/parity.md` and the build commit as
  the source.
- **Theme**: the chosen mock's colours, fonts and spacing become custom properties in
  `theme.css`; a header or hero override only when the mock needs it.
- **Workflow**: `build` job on PR and push with path filters, `deploy` job on push to
  `main` only; Pages is already enabled with the workflow source (owner, 2026-10-29,
  research R3), so the first deploy happens at the merge.
- **Decision record**: `design-decision.md` is written when the owner picks; the task list
  blocks site construction on it.

## Complexity Tracking

No constitution violations to justify.
