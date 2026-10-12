# Data Model: Ask Before Running Workspace Code on Open

Extends the feature 001 data model. All state is in memory in the language server.

## Workspace (extended)

| Field | Type | Notes |
|-------|------|-------|
| discovery | `pending` / `enabled` / `declined` | New. Initial `pending`. Set per workspace folder, covers every config in it. |
| discoveryAsked | boolean | New. True once the question was sent, so it is never sent twice per session. |

State machine:

```text
pending --"Run discovery" button--> enabled
pending --playwright.enableDiscovery--> enabled
pending --"Not now" button--> declined
pending --request failed / client cannot prompt--> declined
declined --playwright.enableDiscovery--> enabled
enabled  (terminal for the session)
```

Rules:

- `discoverWorkspace` finds configs and reads versions in every state. It runs `--list` only
  when `discovery === 'enabled'`.
- Code lenses, run actions, re-discovery on save, and run commands require `enabled`.
- The unsupported-version warning does not depend on `discovery`.
- The question is sent at most once per workspace per session, only when at least one
  supported config exists and `discovery === 'pending'`.
- A folder without a supported config never asks and stays `pending` with no effect.

## PlaywrightConfig

Unchanged. `discoveryState` keeps describing the last `--list` run; a config in a workspace
that is not `enabled` stays `idle` with zero tests.

## playwright/status (debug request)

Each workspace entry gains `discovery` and `discoveryAsked`.
