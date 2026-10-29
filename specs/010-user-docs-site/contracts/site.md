# Contract: documentation site

## Address and base

- Production: `https://radekbednarik.github.io/playwright-zed/`
- Astro: `site: 'https://radekbednarik.github.io'`, `base: '/playwright-zed'`
- Local: `npm run dev` in `site/` serves `http://localhost:4321/playwright-zed/`

## Routes and navigation

| Route (under the base) | Source | Sidebar group |
|------------------------|--------|---------------|
| `/` | `content/docs/index.mdx` (splash + hero) or `pages/index.astro` | hidden |
| `/getting-started/requirements/` | `getting-started/requirements.md` | Getting started |
| `/getting-started/install/` | `getting-started/install.md` | Getting started |
| `/getting-started/first-run/` | `getting-started/first-run.md` (trust, discovery, settings to turn on) | Getting started |
| `/features/run-tests/` | `features/run-tests.mdx` | Features |
| `/features/projects/` | `features/projects.mdx` | Features |
| `/features/step-labels-and-output/` | `features/step-labels-and-output.mdx` | Features |
| `/features/trace-viewer/` | `features/trace-viewer.mdx` | Features |
| `/features/show-browser/` | `features/show-browser.mdx` | Features |
| `/features/discovery-consent/` | `features/discovery-consent.mdx` | Features |
| `/reference/settings/` | `reference/settings.md` | Reference |
| `/reference/differences/` | `reference/differences.md` (limitations and differences from the VS Code extension) | Reference |
| `/reference/state-files/` | `reference/state-files.md` | Reference |
| `/reference/parity/` | generated from `docs/parity.md` | Reference |
| `/help/` | `help.md` | (top level) |

Header: site title, search, theme switch, GitHub link (`social`). Footer: "Edit this page"
(`editLink.baseUrl` on the repository's `main`), last-updated date.

Landing page content (FR-010): name, one-sentence description, hero screenshot with alt
text, actions "Install" and "Read the docs", the work-in-progress and non-affiliation
notices, a capability grid linking the feature pages, links to the repository and the
issue tracker.

## Screenshot manifest and component

`src/data/screenshots.ts` exports `screenshots: Screenshot[]` and `capabilities` (the fixed
id list from `data-model.md`). `<Shot id="run-test-lens" />` renders the optimised image
(`astro:assets`, width capped at 1920), the alt text, and a caption
"<caption> (Zed <zedVersion>, Playwright Runner <extensionVersion>, <platform>)".

`scripts/check-screenshots.ts` exits non-zero when: a capability has no entry; an entry has
no file; a file has no entry; an entry's `extensionVersion` differs from the version in
`extension.toml` (so a release without new screenshots fails the site check and the stale
pictures are retaken or the check is consciously updated).

## Scripts (`site/package.json`)

| Script | Does |
|--------|------|
| `dev` | `sync-parity` then `astro dev` |
| `build` | `sync-parity` then `astro build` (internal links validated, errors fail) |
| `preview` | `astro preview` |
| `check` | `astro check` and `check-screenshots` |
| `sync-parity` | `node scripts/sync-parity.ts` |
| `check-screenshots` | `node scripts/check-screenshots.ts` |
| `check-links` | `node scripts/check-external-links.ts` (local, after `build`) |

## Workflow `.github/workflows/docs-site.yml`

```yaml
on:
  pull_request:
    paths: [site/**, docs/parity.md, .github/workflows/docs-site.yml]
  push:
    branches: [main]
    paths: [site/**, docs/parity.md, .github/workflows/docs-site.yml]
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:   # always: checkout@v7, setup-node@v7 (24, npm cache on site/package-lock.json), npm ci, npm run check, npm run build, upload-pages-artifact@v5 (site/dist)
  deploy:  # if: github.event_name != 'pull_request'; needs: build; environment: github-pages; deploy-pages@v5
```

The `deploy` job needs Pages enabled with source "GitHub Actions" (owner). A PR that does
not touch the listed paths triggers nothing from this workflow (spec story 4, scenario 2).

## Mocks (`specs/010-user-docs-site/mocks/`)

Served by `python3 -m http.server --directory specs/010-user-docs-site/mocks 4321`;
`http://localhost:4321/` lists the proposals with name, blurb, traits and links to
`<id>/index.html` and `<id>/docs.html`. Each mock is one HTML file per page with inline
CSS, no build, no external requests except Google Fonts if the design uses a web font.
