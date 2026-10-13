# Contract: Extension Manifest at 0.4.0

Supersedes the manifest contract of feature 001 for `id`, `name` and `version`. Everything
else is unchanged.

```toml
id = "playwright-runner-lsp"
name = "Playwright Runner"
version = "0.4.0"
schema_version = 1
authors = ["Radek Bednarik <radek.bednarik@tesena.com>"]
description = "Work in progress. Run Playwright end-to-end tests from Zed: run at cursor, run file, re-run last, with results in the editor. Community extension, not affiliated with or endorsed by Microsoft."
repository = "https://github.com/radekBednarik/playwright-zed"

capabilities = [
  { kind = "npm:install", package = "playwright-zed-language-server" },
]

[language_servers.playwright]
name = "Playwright"
languages = ["TypeScript", "TSX", "JavaScript"]

[language_servers.playwright.language_ids]
"TypeScript" = "typescript"
"TSX" = "typescriptreact"
"JavaScript" = "javascript"
```

Rules this satisfies (registry `validateExtensionsToml` and `validateManifest`, publishing
prerequisites):

- id: lowercase, digits, hyphens; no `zed-` prefix, no `-zed` suffix, no `extension`.
- name: no `Zed ` prefix, no ` Zed` suffix, no `extension` in any case.
- version: plain semver, equal to `Cargo.toml` and to the registry entry.
- no bundled server; the only capability is the npm install of the pinned server package.

Side effects of the id change on the owner's machine: Zed's dev-extension work directory
moves from `~/.local/share/zed/extensions/work/playwright/` to
`~/.local/share/zed/extensions/work/playwright-runner-lsp/`; the old dev extension `playwright`
must be uninstalled in `zed: extensions` to avoid two language servers on the same files.

The version `0.4.0` is set by the release commit on `main`, not on the feature branch; the
feature branch leaves `version = "0.3.0"` so CI on the branch tests exactly what merges.
