# Design decision: documentation site

**State**: chosen

Proposals (served with `python3 -m http.server --directory specs/010-user-docs-site/mocks 4321`,
then `http://localhost:4321/`):

| Id | Name | In one line |
|----|------|-------------|
| `a-terminal` | Terminal | dark-first, monospace display type, one bright accent, dense docs, landing led by a large editor screenshot |
| `b-editorial` | Editorial | light-first, serif display with a humanist sans body, warm neutrals, wide measure, text left and screenshot right |
| `c-cards` | Cards | neutral palette with a teal accent, rounded feature cards in a grid, standard Starlight density |

**Chosen**: `a-terminal` (Terminal)

**Date**: 2026-10-29

**Owner comments**: "design A Terminal it is." The owner asked whether the missing
screenshots in the mocks were intentional; they were (the spec compares design only, with
placeholder frames; the real pictures come from the capture session and replace the frames
on the built site).

**Requested changes**: none.

**Fate of the other proposals**: `b-editorial` and `c-cards` stay in `mocks/` as the record
of the choice and are never deployed.

**Design facts carried into the site** (from the mock `a-terminal/index.html` and
`docs.html`):

- Fonts: JetBrains Mono (400, 500, 700) for headings, navigation, sidebar, table headers,
  code and the terminal panels; Inter (400, 500, 600) for body text.
- Dark (default): background `#0b0e13`, panel `#11151c`, text `#d9e0e8`, muted `#95a1b1`,
  accent terminal green `#4ade80`, rules `#1f2630`.
- Light: background `#f6f7f5`, text `#1b222c`, muted `#54626e`, accent `#0f7a3c`.
- Terminal-styled panels (title bar with three dots) for the install block and code; the
  landing hero screenshot sits in an editor frame with a title bar and a file path.
- Headings carry a `#`/`##` prefix in the accent colour; sidebar groups are `## GROUP`
  labels; the current sidebar entry has a `▶` marker; "On this page" uses the same label
  style.
- Notices are accent-bordered boxes labelled `// status` and `// affiliation`.

**Overrides the chosen design needs beyond Starlight custom properties** (read by task
T033): the landing page needs the editor frame around the hero image, the terminal-styled
install panel and the two labelled notice boxes, which Starlight's hero cannot express; the
landing page is therefore a plain Astro page (`site/src/pages/index.astro`) that reuses the
site's CSS, while the docs pages stay Starlight with `theme.css` (fonts, colour scales,
heading prefixes through `::before`, sidebar and table styling). No Starlight component
override is needed.
