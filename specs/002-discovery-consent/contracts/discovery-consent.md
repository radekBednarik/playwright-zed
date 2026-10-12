# Contract: Discovery Consent

Delta on `specs/001-scaffold-run-at-cursor/contracts/lsp-protocol.md`. Everything not listed
here is unchanged.

## Question (server → client request)

`window/showMessageRequest`, type Warning, sent at most once per workspace folder per
session, after config location and version gating, before any Playwright process:

```text
Playwright for Zed found a Playwright configuration in <folder basename> (<absolute path>).
Run test discovery? Discovery executes this workspace's Playwright configuration and test
files with your user account. You can enable it later with "Playwright: Enable test
discovery" from the code actions menu.
```

`actions`: `[{ title: "Run discovery" }, { title: "Not now" }]`.

Response handling: `Run discovery` → workspace `enabled`, discovery starts, lenses refresh.
`Not now` → `declined`. Error (client cannot prompt) → `declined` plus a `window/showMessage`
Warning: `Playwright test discovery is off for <folder basename>; use "Playwright: Enable test
discovery" from the code actions menu to turn it on.` No response (dismissed) → stays
`pending`; the server never waits on it.

## Command

| Command | Arguments | Behaviour |
|---------|-----------|-----------|
| `playwright.enableDiscovery` | `[{ uri }]` | Resolve the workspace folder for `uri`; if `discovery !== 'enabled'`, set `enabled`, run discovery for every supported config, refresh lenses. Idempotent. Returns `null`. Without a resolvable workspace: Warning `Playwright was not found in the workspace for <file>`. |

`executeCommandProvider.commands` becomes `["playwright.runAtCursor", "playwright.runFile",
"playwright.rerunLast", "playwright.enableDiscovery"]`.

## Code action

| Title | Condition |
|-------|-----------|
| `Playwright: Enable test discovery` | document is inside a workspace folder that has at least one supported config and `discovery !== 'enabled'` |

Kind `source.playwright`, `command` `playwright.enableDiscovery` with `[{ uri }]`. It is the
only Playwright action returned in that state (no run actions, no re-run).

## Run commands while not enabled

`playwright.runAtCursor`, `playwright.runFile` and `playwright.rerunLast` targeting a folder
whose `discovery !== 'enabled'` start nothing and send a `window/showMessage` Warning:

- `pending`: `Playwright test discovery has not been enabled for <folder basename>; answer
  the discovery question or use "Playwright: Enable test discovery" from the code actions
  menu.`
- `declined`: `Playwright test discovery is disabled for <folder basename>; use "Playwright:
  Enable test discovery" from the code actions menu to turn it on.`

## Lenses and re-discovery

`textDocument/codeLens` returns `[]` for files in a folder that is not `enabled`. `didSave`
triggers re-discovery only in `enabled` folders. Configs found later in an `enabled` folder
are discovered without a new question.

## Status (debug request)

`playwright/status` entries gain `discovery: "pending" | "enabled" | "declined"` and
`discoveryAsked: boolean`.
