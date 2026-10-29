# Research: User Docs Site and README Restructure

**Feature**: `010-user-docs-site` | **Date**: 2026-10-29

Facts below were checked on this machine (native Ubuntu 26.04.1 LTS, GNOME Shell 50.1 on
Wayland, Node 26.13.0, npm 11.20.0, Zed 1.26.2) and against the npm registry, GitHub and
the Astro and Starlight documentation on 2026-10-29.

## R1. Site framework

**Decision**: Astro 7 with the Starlight documentation integration, configured and scripted
in TypeScript (`astro.config.ts`, build scripts as `.ts` run by Node directly), content in
Markdown and MDX, npm as the package manager (the repository already uses npm lockfiles in
`server/` and the fixture).

**Rationale**: the owner suggested Astro. Starlight supplies what the spec asks for without
custom code: a documentation layout with sidebar and on-page table of contents, light and
dark mode following the system preference, a responsive layout, built-in search, code
blocks with Expressive Code, a `splash` page template with a `hero` block (title, tagline,
image with light and dark variants, action buttons) for the landing page, theming through
CSS custom properties (`--sl-color-accent-*`, `--sl-color-gray-*`, `--sl-font`,
`--sl-content-width`) registered through `customCss`, component overrides (`components`
option, any default component can be wrapped or replaced, overrides read
`Astro.locals.starlightRoute`), and a plugin API with an internal-link validator. Every page
renders to static HTML, so text, navigation and images work with scripting off (only the
search box and the theme switch need it; the system preference still applies through CSS).

**Alternatives considered**: VitePress (Vue, good docs theme but a less flexible landing
page and no TypeScript-first page authoring); Docusaurus (React, heavier, MDX-only
customisation); plain Astro without Starlight (full freedom, but sidebar, search, theme
switch, accessibility and link validation would be rebuilt by hand). If the owner picks a
design whose landing page Starlight's hero cannot express, the landing page becomes a plain
Astro page (`src/pages/index.astro`) next to the Starlight routes; the docs pages stay in
Starlight.

## R2. Dependency versions and the TypeScript exception

**Decision**: exact pins (`npm install --save-exact`, `save-exact=true` in `site/.npmrc`),
latest stable on 2026-10-29:

| Package | Version | Note |
|---------|---------|------|
| `astro` | 7.4.4 | needs Node >= 22.23.4; `sharp` is an optional dependency, installed explicitly |
| `@astrojs/starlight` | 0.42.7 | peer `astro ^7.2.10`; bundles `astro-expressive-code`, `pagefind`, `@astrojs/mdx` |
| `starlight-links-validator` | 0.27.0 | peer `astro >= 7.2.10`, `@astrojs/starlight >= 0.42.0` |
| `@astrojs/check` | 0.9.12 | peer `typescript ^5.0.0 || ^6.0.0` |
| `typescript` | 6.0.3 | **exception**: 7.0.2 is `latest`, but `@astrojs/check` (through `@astrojs/language-server` 2.17.3) accepts only 5.x and 6.x; 6.0.3 is the newest release in range |
| `sharp` | 0.35.5 | image optimisation for the screenshots |
| `@fontsource-variable/*` | 5.x | only the fonts the chosen design needs |

Node for the site: 26 locally, 24 in CI (the current LTS line, within Astro's range, the
same as `withastro/action`'s default). Build scripts are plain `.ts` files executed by
`node` (type stripping is on by default since Node 23.6), so no extra runner.

**Alternatives considered**: `typescript` 7.0.2 with `astro check` dropped (loses type
checking of `.astro` files); keeping 7.0.2 and forcing the peer range (`--legacy-peer-deps`,
a hidden break waiting to happen). Both rejected; the pin is recorded as the single
exception FR-015 allows.

## R3. Hosting and deployment

**Decision**: GitHub Pages project site at `https://radekbednarik.github.io/playwright-zed/`
(`site: 'https://radekbednarik.github.io'`, `base: '/playwright-zed'` in the Astro config;
Starlight prefixes internal links with the base). One new workflow
`.github/workflows/docs-site.yml`, separate from `ci.yml`:

- `pull_request` and `push` to `main`, both filtered to `site/**`, `docs/parity.md` and the
  workflow file itself, plus `workflow_dispatch`.
- Job `build`: `actions/checkout@v7`, `actions/setup-node@v7` (Node 24, npm cache keyed on
  `site/package-lock.json`), `npm ci`, `npm run check`, `npm run build`
  (`site/dist`), then `actions/upload-pages-artifact@v5` with `path: site/dist`.
- Job `deploy`: only on `push` to `main` (and `workflow_dispatch`), `needs: build`,
  `environment: github-pages`, `actions/deploy-pages@v5`; permissions `pages: write`,
  `id-token: write`, `contents: read`.

The repository's Pages were not enabled at the start of planning (`has_pages: false`, the
Pages API returned 404). **The owner enabled them during planning on 2026-10-29** with
source "GitHub Actions": `gh api repos/radekBednarik/playwright-zed/pages` now returns
`build_type: workflow` and `html_url: https://radekbednarik.github.io/playwright-zed/`.
Nothing is published until the first run of the `deploy` job, which happens when the
feature PR merges to `main`; the merge is the owner's remaining outward-facing step. The "main" ruleset (pull request required, CodeQL and code-quality rules, no
required status checks) needs no change. The optional repository `homepage` field can
point at the site afterwards (owner's call).

**Alternatives considered**: `withastro/action@v6` (one step for install, build and
upload; rejected because the PR check and the deploy should share one explicit build so a
failing `astro check` or link validation is visible on the PR); publishing from a `gh-pages`
branch (legacy, needs a deploy token); Netlify or Vercel (an external account, no gain).

## R4. README restructure

**Decision**: new top-to-bottom order, user part first, one contributor part at the end:

1. Title, one-paragraph description, site link line, work-in-progress notice,
   non-affiliation and trademark notice, two-sentence AI-assistance disclosure with a link
   to the full note in the contributor part.
2. "Contents" list (short, manual; GitHub's generated outline is hidden behind a menu).
3. Requirements.
4. Install (registry listing status, then "from source" for users who want the unreleased
   version, with the reinstall caveat; the local-server override moves to the contributor
   part).
5. What it does (the capability list, current, "first slice" wording removed).
6. Settings (`code_lens`, `inlay_hints`, the `lsp.playwright.settings` defaults in one
   place).
7. Usage: test discovery and trust; the action table; notes; projects; step labels and run
   output; trace viewer; show browser and close all browsers; terminal output recipe.
8. Limitations and differences from the VS Code extension (the current "Differences"
   section plus the known Zed limitations: menu caching, restart after reinstall, no
   decoration API, no panel).
9. Getting help (issue tracker, the language server log, what to include).
10. Contributing and development (one heading, everything below it is for contributors):
    building, the local server override, manual testing, development commands, publishing
    pointer, the full AI-assistance note.
11. License.

Every current section maps to a new location; the mapping is the contract in
`contracts/readme-structure.md` and the check for SC-002. Stale statements to fix: "Only the
first slice is implemented" (the capability list is longer now), "Node.js 20 or newer"
(the server declares `engines: node >= 22`; Node 20 is end of life).

**Alternatives considered**: splitting the README into `README.md` plus `CONTRIBUTING.md`
(cleaner, but the owner asked for one restructured README; a later split stays possible);
removing the user material from the README in favour of the site (rejected by the spec:
the README stays complete without the site).

## R5. Screenshot capture on this machine

**Decision**: capture through the desktop portal (`org.freedesktop.portal.Screenshot`,
method `Screenshot`, `interactive: false`) from a small Python helper using the GLib
bindings already installed (`python3-gi`), with Zed running maximised in a dedicated
screenshot profile; the helper crops the GNOME top bar and writes the PNG into
`site/src/assets/screenshots/<scene>.png`.

Verified on 2026-10-29:

- GNOME Shell 50 refuses the direct `org.gnome.Shell.Screenshot` interface for ordinary
  callers (`AccessDenied: Screenshot is not allowed`); `grim` does not work on Mutter.
- The portal route asked once for permission (the owner approved the dialog during this
  session) and then answered a second call without any dialog, response code 0, file
  written; the permission store now holds `screenshot` = `yes` for this user. The portal
  always captures the whole screen (1920 x 1200, scale 1 on this display), so the helper
  crops to the Zed window: Zed maximised, top bar height measured once at implementation.
- Zed honours `XDG_CONFIG_HOME` and `XDG_DATA_HOME` (a run with scratch directories created
  `config/zed` and `data/zed` and touched nothing in the owner's profile), so a screenshot
  profile with its own settings (theme One Dark for both modes, `code_lens: "on"`,
  `inlay_hints.enabled: true`, default fonts and sizes, vim mode off, no restored tabs) and
  its own extension installation is a launcher script away. The profile installs the dev
  extension once from the repository root through the command palette; with no server
  override in the environment the extension installs server 0.8.0 from npm, which is the
  release the screenshots must show (FR-012).
- Fallback that needs no script: GNOME's own screenshot UI (Print key, window mode) saves to
  `~/Pictures/Screenshots`; the helper can import such a file under a scene id.

Staging is by hand at the keyboard (the owner, or the owner with the agent calling the
helper on request): Wayland offers no input injection without another portal grant, and the
scenes are few (about twelve). Each scene is listed in `quickstart.md` with the file to
open, the cursor position, the action to take and the moment to capture. One Zed theme only
(One Dark); light variants are a later option through Starlight's `image.light`/`dark`
hero fields and a `<picture>` in the `Shot` component.

**Alternatives considered**: `gnome-screenshot` 41 (installable from apt, allowlisted for
the Shell interface; an extra package for the same result); the RemoteDesktop portal for
scripted input (a second permission grant and a lot of code for twelve pictures); mock-ups
instead of real captures (rejected by the spec).

## R6. Parity table on the site

**Decision**: generated at build time, never edited by hand. `site/scripts/sync-parity.ts`
reads `docs/parity.md`, prepends Starlight frontmatter (title, description, a note naming
the source file and the commit) and writes
`site/src/content/docs/reference/parity.md` (gitignored). `npm run build` and `npm run dev`
run it first (`prebuild`, `predev`). The workflow's path filter includes `docs/parity.md`
so a parity change redeploys the site.

**Alternatives considered**: a symlink inside the content directory (fragile on Windows
checkouts, and the content loader's base cannot point outside `src/content`); linking to the
file on GitHub only (loses the table on the site); a hand-maintained copy (drifts).

## R7. Design proposals (mocks)

**Decision**: three self-contained static HTML prototypes under
`specs/010-user-docs-site/mocks/`, each a landing page and a documentation page, plus a
chooser `index.html`, served with one command and no dependencies:
`python3 -m http.server --directory specs/010-user-docs-site/mocks 4321`. The docs page of
every proposal keeps Starlight's skeleton (header with site title, search and theme
switch; left sidebar; content column; right table of contents) so that whatever the owner
picks is reproducible with `customCss` and at most a header or hero override; the landing
pages are free. All three use the same real content (name, description, notices, install
steps, the "Run tests" capability section with a placeholder screenshot frame), respond to
phone width and follow `prefers-color-scheme`. Proposals, visibly distinct:

- **A "Terminal"**: dark-first, monospace display type, one bright accent, dense docs,
  landing led by a large editor screenshot and a terminal-styled install block.
- **B "Editorial"**: light-first, serif display type with a humanist sans body, warm
  neutrals, wide measure, landing with text left and screenshot right.
- **C "Cards"**: neutral palette with a teal accent, rounded feature cards in a grid on the
  landing page, standard Starlight density in the docs.

None uses the Playwright or Zed logos (trademark notice). The owner's pick and comments go
to `specs/010-user-docs-site/design-decision.md`; the mocks stay in the feature directory
as the record and are not deployed.

**Alternatives considered**: three Astro themes inside the real site switched by a flag
(faithful, but three times the setup before anything is chosen); image mock-ups (cannot be
resized or switched to dark mode by the owner).

## R8. Link checking

**Decision**: internal links validated at build by `starlight-links-validator` (errors
fail `astro build`, so the PR check catches them); outbound links checked by
`site/scripts/check-external-links.ts` (reads `site/dist`, requests every external URL
once, reports status) run locally and recorded in the verification file, not in CI, so
third-party outages cannot block a merge.

## R9. Screenshot coverage check

**Decision**: a typed manifest `site/src/data/screenshots.ts` (scene id, capability,
alt text, caption, extension version, Zed version, platform, date) consumed by a
`<Shot id>` component that renders the optimised image with its alt text and a caption
naming the versions. `site/scripts/check-screenshots.ts` runs in `npm run check` and fails
when a capability in the fixed list of FR-012 has no manifest entry, when a manifest entry
has no file, or when a file has no manifest entry. This makes FR-012 and FR-013 mechanical.

## R10. Verification of the environment claims used above

| Claim | How verified |
|-------|--------------|
| Native Ubuntu, not WSL | `/proc/version` has no `microsoft`; `lsb_release` Ubuntu 26.04.1; GNOME session on Wayland |
| Zed 1.26.2 at `~/.local/bin/zed` | `zed --version` |
| Zed honours XDG overrides | launched with scratch `XDG_CONFIG_HOME`/`XDG_DATA_HOME`, both `zed/` subdirectories created, exit 0 |
| Portal screenshot works without a dialog after one approval | second call returned `(0, {'uri': 'file:///home/radek/Screenshot-1.png'})`; permission store `Lookup screenshot screenshot` returned `yes` |
| Display 1920 x 1200 at scale 1 | Mutter `DisplayConfig.GetCurrentState` |
| Pages enabled by the owner during planning | `gh api repos/radekBednarik/playwright-zed/pages` returned `build_type: workflow`, `html_url: https://radekbednarik.github.io/playwright-zed/` (earlier in the session it returned 404) |
| Ruleset has no required checks | `gh api .../rulesets/24972538`: deletion, non-fast-forward, pull request, CodeQL, code quality |
| Action versions | `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `actions/configure-pages` v6.0.0, `actions/upload-pages-artifact` v5.0.0, `actions/deploy-pages` v5.0.1, `withastro/action` v6.1.4 |
