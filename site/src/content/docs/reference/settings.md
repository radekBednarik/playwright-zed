---
title: Settings
description: The two Zed settings the extension's labels need, and the extension's own folder defaults.
---

## Zed settings

Code lenses are off by default in Zed. To see the run buttons above tests:

```json
{
  "code_lens": "on"
}
```

Use `"menu"` instead to list lenses inside the code action menu.

Inlay hints are off by default as well. The executing-step label and the per-step
durations are inlay hints, so they appear only with:

```json
{
  "inlay_hints": {
    "enabled": true
  }
}
```

Both settings can live under `"languages": { "TypeScript": { ... } }` if you prefer them
per language. Without them the extension runs tests exactly the same; only the labels are
absent.

## Extension defaults

Folder or team defaults for the extension's own options live in one settings block, in
`.zed/settings.json` of the repository or in your user settings. Each key applies until
you toggle the option yourself in the editor; changes take effect without a restart:

```json
{
  "lsp": {
    "playwright": {
      "settings": {
        "projects": ["chromium", "firefox"],
        "showTrace": false,
        "reuseBrowser": false
      }
    }
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `projects` | first project | The projects selected until you pick some yourself; see [Projects](/playwright-zed/features/projects/). Zed-only, upstream has no equivalent. |
| `showTrace` | `false` | Record and show traces by default; see [Trace viewer](/playwright-zed/features/trace-viewer/). Upstream setting name. |
| `reuseBrowser` | `false` | Show the browser by default; see [Show browser](/playwright-zed/features/show-browser/). Upstream setting name. |

A remembered in-editor choice wins over the default. Where the choices are stored is on
the [State files](/playwright-zed/reference/state-files/) page.

## Environment

- `PLAYWRIGHT_ZED_STATE_DIR` moves the state directory. Set it in the environment Zed
  starts from.
- `PLAYWRIGHT_ZED_SERVER_ENTRY` points the extension at a locally built language server
  instead of the npm package (for contributors; see the repository README).
