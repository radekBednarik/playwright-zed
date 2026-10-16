# Data Model: Playwright Project Selection

Extends the feature 001 data model (`specs/001-scaffold-run-at-cursor/data-model.md`). Paths
are absolute; project names are Playwright's exact strings; order follows the `--list` report.

## PlaywrightProject

Not a separate record: a config's projects are the ordered list of names Playwright reports.

| Field | Type | Notes |
|-------|------|-------|
| name | string | `report.config.projects[].name`; unique within a config (Playwright rejects duplicates). |

Implementation note (found during T012): the JSON reporter lists one spec entry per project
for the same test, so `parseListReport` merges entries that share file, line, column and
title path into one DiscoveredTest whose `projects` is the union. Test counts therefore stay
per spec.

## PlaywrightConfig (changed)

| Field | Type | Notes |
|-------|------|-------|
| projects | string[] | From the last successful `--list`; empty until discovery ran. |
| selection | ProjectSelection | Reconciled after every discovery and after every toggle. |
| noticeKey | string or null | Last reconcile notice shown (joined dropped or unknown names), so a repeat is not shown again. |

## ProjectSelection

| Field | Type | Notes |
|-------|------|-------|
| projects | string[] | Selected names, in config order; never empty when `PlaywrightConfig.projects` is non-empty. |
| source | `single` / `default` / `settings` / `remembered` / `chosen` | How the current value came about. |
| updatedAt | ISO timestamp or null | Set for `chosen` and `remembered` (copied from the store). |

Invariants:

- `projects` is a subset of `PlaywrightConfig.projects`, same order.
- If `PlaywrightConfig.projects.length < 2`, `projects` equals it and `source` is `single`.
- `projects.length >= 1` whenever `PlaywrightConfig.projects.length >= 1`.
- `allSelected` (derived) is `projects.length === PlaywrightConfig.projects.length`; when true,
  runs pass no `--project` flag.

### Reconciliation (`resolveSelection(reported, remembered, settingsDefault)`)

Inputs: `reported: string[]` (from discovery), `remembered: string[] | null` (store entry
for this config path), `settingsDefault: string[] | null` (from the editor settings).

1. If `reported.length < 2`: result `reported`, source `single`, no notice.
2. If `remembered` is not null: `keep = reported ∩ remembered` (reported order),
   `dropped = remembered − reported`. If `keep` is non-empty: result `keep`, source
   `remembered`, notice "dropped" when `dropped` is non-empty. If `keep` is empty: notice
   "dropped, falling back", continue.
3. If `settingsDefault` is not null: `keep = reported ∩ settingsDefault`,
   `unknown = settingsDefault − reported`. Warning "unknown names, available: ..." when
   `unknown` is non-empty. If `keep` is non-empty: result `keep`, source `settings`.
4. Otherwise result `[reported[0]]`, source `default`.

Notices are `window/showMessage` Info (dropped) or Warning (unknown setting names), shown once
per distinct `noticeKey` per config; the log always gets a line.

### Toggle (`toggleProject(selection, reported, name)`)

- `name` not in `reported`: no change, Warning "not a project of this config".
- `name` selected and it is the only selected project: no change, Warning "at least one
  project must stay selected".
- Otherwise flip membership; result in `reported` order; source `chosen`; `updatedAt` now;
  store write; `codeLens/refresh`.

### Select all (`selectAll(reported)`)

Result `reported`, source `chosen`, store write, refresh. Stored as the explicit full list,
so a project added later stays unselected (upstream rule).

## Store file (`project-selection.json`)

Location: see research R5. Shape:

```json
{
  "version": 1,
  "configs": {
    "/abs/path/to/repo/playwright.config.ts": {
      "projects": ["chromium", "firefox"],
      "updatedAt": "2026-10-14T10:00:00.000Z"
    }
  }
}
```

Rules: unknown `version` or unparsable content is treated as empty (and overwritten on the
next write, with a log line); entries for other config paths are preserved on write;
`projects` arrays are stored as given (reconciliation happens on read); a write happens only
on `chosen` changes, never on reconcile, so a temporarily missing project is not forgotten
when it returns.

## Settings value

`workspace/configuration` (whole object) and `workspace/didChangeConfiguration.settings`
deliver the same object:

```json
{ "projects": ["chromium", "firefox"] }
```

Validation (`parseProjectsSetting(value)`): missing or `null` means "no default" (`null`);
an array of non-empty strings is accepted (duplicates removed, order kept); anything else
yields `null` and one Warning naming the expected shape. The value applies to every config
of the worktree; names a config does not have are "unknown" for that config only.

## RunRequest (changed)

| Field | Type | Notes |
|-------|------|-------|
| projects | string[] | Copy of `config.selection.projects` at start; used for the log line, the progress message and `--project` flags. |

Re-run last builds a new RunRequest from the stored location and the *current* selection.

The test count in the progress message (`Running <n> test(s) ...`) is the number of
discovered specs the target selects that run in at least one selected project; it does not
multiply by the number of projects, so one spec in two projects reads `Running 1 test(s)`
and ends with `2 passed`.

## Workspace (unchanged) and status (`playwright/status`)

Each `configs[]` entry gains `projects`, `selectedProjects` and `selectionSource`.

## State transitions

```text
discovery ok ──► resolveSelection ──► source ∈ {single, default, settings, remembered}
toggle / select all ──► source = chosen ──► store write ──► refresh lenses
settings change ──► configs with source default|settings re-resolved (remembered and chosen keep)
discovery error ──► projects and selection unchanged
```
