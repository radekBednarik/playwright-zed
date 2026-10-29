# Data Model: User Docs Site and README Restructure

**Feature**: `010-user-docs-site` | **Date**: 2026-10-29

No runtime data. The entities below are files and records the feature produces; their
rules come from the spec's functional requirements.

## README user part

The ordered list of user sections (requirements, install, what it does, settings, usage,
limitations and differences, getting help). Rules: every heading precedes the first
contributor heading (FR-002, FR-003); the first screen holds description, site link,
notices and the short AI disclosure in plain Markdown (FR-001); every user-facing fact of
the current README has a new location (FR-004, tracked by the mapping table in
`contracts/readme-structure.md`).

## README contributor part

One top-level heading ("Contributing and development") and its subsections (building and
the local server override, manual testing, development commands, publishing, the full
AI-assistance note), after the user part and before the license (FR-003, FR-006).

## Design proposal

| Field | Meaning |
|-------|---------|
| id | `a-terminal`, `b-editorial`, `c-cards` |
| name, blurb | shown on the chooser page |
| traits | the visible differences (type, palette, landing layout, docs density) |
| pages | `index.html` (landing) and `docs.html` (one capability page) |

Rules: same real content in all three (FR-007); phone and desktop widths, light and dark
(FR-008); not deployed (FR-009). Lives in `specs/010-user-docs-site/mocks/`.

## Design decision record

`specs/010-user-docs-site/design-decision.md`: chosen proposal id, date, the owner's
comments, requested changes, and what happens to the other proposals. Written before any
site page is built (FR-009). State: `pending` until the owner picks, then `chosen`.

## Capability page

One Starlight page per capability group. Fields: title, description, invocation in Zed,
expected result, one or more screenshot references, related settings, known limitations,
links to the README section it was written from. Rule: every capability in the FR-012 list
has at least one screenshot reference (checked by `check-screenshots.ts`).

Capability list (fixed, from FR-012):

| Capability id | Page |
|---------------|------|
| `run-test`, `run-describe`, `run-file`, `rerun-last`, `run-result` | `features/run-tests` |
| `discovery-consent` | `features/discovery-consent` |
| `project-selection` | `features/projects` |
| `step-labels`, `run-output` | `features/step-labels-and-output` |
| `trace-viewer`, `show-trace` | `features/trace-viewer` |
| `show-browser`, `close-all-browsers` | `features/show-browser` |

## Screenshot (manifest entry)

`site/src/data/screenshots.ts`, one entry per PNG under `site/src/assets/screenshots/`:

| Field | Type | Rule |
|-------|------|------|
| id | string | file name without extension, kebab-case |
| capability | capability id | from the fixed list |
| alt | string | describes what is visible, for readers who cannot see it (FR-012) |
| caption | string | one sentence tying the picture to the text |
| extensionVersion | string | `0.8.0` (FR-012: current release) |
| zedVersion | string | `1.26.2` |
| platform | string | `Linux (Ubuntu 26.04, GNOME)` |
| capturedOn | date | ISO date |
| scene | string | the quickstart scene id it was taken from |

Rules: no personal data, private paths outside the sample project or unrelated windows
(FR-013, reviewed by eye at capture); every entry has a file and every file an entry
(`check-screenshots.ts`); a stale screenshot is found by `extensionVersion` and `scene`.

## Site publication

Address `https://radekbednarik.github.io/playwright-zed/`; built from `main` by
`docs-site.yml`; states: `not-enabled`, `enabled` (owner turned Pages on, reached
2026-10-29 during planning), `deployed` (first successful deploy, README link live). Transitions are the owner's
(FR-017); the agent records them in `verification.md` and the project memory.

## Generated parity page

`site/src/content/docs/reference/parity.md`, produced by `sync-parity.ts` from
`docs/parity.md` at every build; gitignored; header names the source and the commit
(FR-011).
