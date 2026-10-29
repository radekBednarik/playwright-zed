# Contract: README structure

The README after this feature has exactly this top-level order. Headings are `##`; the
nesting under "Usage" and "Contributing and development" is `###`.

```text
# Playwright Runner
  (description paragraph; site link line; work-in-progress notice; non-affiliation and
   trademark notice; two-sentence AI-assistance disclosure linking to the full note)
  Contents (manual list of the ## headings)
## Requirements
## Install
## What it does
## Settings
## Usage
### Before the first run: test discovery
### Actions (the table) and notes
### Projects
### Step labels and run output
### Trace viewer
### Show browser and close all browsers
### Terminal output (optional)
## Limitations and differences from the VS Code extension
## Getting help
## Contributing and development
### Building from the repository
### Manual testing
### Development commands
### Publishing
### Built with AI assistance (full note)
## License
```

Checks:

- Heading-order check (quickstart scenario 1): the sequence of `##` headings equals the
  list above; the first `##` heading of the contributor part comes after every user heading.
- First screen: everything before "Contents" is plain Markdown paragraphs and links; no
  HTML, images or badges.
- Stale wording removed: "Only the first slice is implemented", "Node.js 20 or newer"
  (becomes Node.js 22 or newer, matching the server's `engines`).

## Section mapping (current README to new location)

| Current section (line) | New location |
|------------------------|--------------|
| Intro paragraphs (1 to 13) | Intro, unchanged facts, plus the site link line |
| Project status (15) | Intro notice, rewritten without "first slice" |
| Built with AI assistance (24) | Two sentences in the intro; full note under Contributing and development |
| What it does today (33) | What it does |
| Requirements (60) | Requirements (Node 22) |
| Install (67): registry, from source steps 1 to 3, reinstall caveat | Install |
| Install step 4 (local server override) | Contributing and development, Building from the repository |
| Settings (102) | Settings, plus the `lsp.playwright.settings` keys (`projects`, `showTrace`, `reuseBrowser`) summarised in one block with links to their usage sections |
| Usage, test discovery (131) | Usage, Before the first run |
| Usage, action table and notes (163 to 200) | Usage, Actions and notes |
| Differences from the VS Code extension (202) | Limitations and differences |
| Projects (223) | Usage, Projects |
| Trace viewer (274) | Usage, Trace viewer |
| Show browser (314) | Usage, Show browser and close all browsers |
| Terminal output (361) | Usage, Terminal output (optional) |
| Manual testing (381) | Contributing and development, Manual testing |
| Development (435) | Contributing and development, Development commands |
| (new) | Getting help: issue tracker link, which log to attach (`dev: open language server logs`, `zed: open log`), versions to state |
| (new) | Contributing and development, Publishing: one line pointing at `docs/publishing.md` |
| License (447) | License |

Every row is ticked in `verification.md` with the new line number (SC-002).
