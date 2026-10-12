# Quickstart: Verify Discovery Consent

Manual verification as a dev extension. Prerequisites and install steps are those of
`specs/001-scaffold-run-at-cursor/quickstart.md`. Automated checks:

```sh
cd server && npm run lint && npm test && npm run build
```

Expected: all pass, including `test/integration/consent.test.ts`.

## Scenarios

| # | Spec ref | Steps | Expected |
|---|----------|-------|----------|
| 1 | US1-1 | Open `fixtures/sample-project` in Zed | One notification from the Playwright server naming `sample-project`, saying discovery executes the workspace's configuration and test files, with buttons "Run discovery" and "Not now" |
| 2 | US1-2 | Before answering, open `tests/passing.spec.ts` | No `▶ Run` lenses; ctrl-. shows only "Playwright: Enable test discovery" |
| 3 | US1-3 | Not reachable by hand: Zed only issues run commands through code actions, which are hidden while pending | Covered by `consent.test.ts` ("run command while pending" case): warning that discovery has not been enabled, no process started |
| 4 | US2-1 | Click "Run discovery" | Lenses appear within a few seconds; ctrl-. offers run actions; scenario 5 of feature 001 passes |
| 5 | US2-2 | Save a test file | Lenses refresh, no new question |
| 6 | US3-1 | Restart Zed, open the fixture, click "Not now", edit and save a test | No lenses, no runs, no further question |
| 7 | US3-3 | ctrl-. "Playwright: Enable test discovery" | Discovery runs, lenses appear |
| 8 | Edge: dismissed | Restart Zed, close the notification with its "x", then ctrl-. | "Playwright: Enable test discovery" is offered; using it enables discovery |
| 9 | Edge: several roots | Add a second folder with Playwright to the workspace | A second, separate question for that folder |
| 10 | US1-4 | Open a folder with a `.ts` file and no Playwright | No question, nothing offered |

## Parity matrix update

Add the row `Discovery consent (Workspace Trust substitute)` with status `zed-only`,
primitive `lsp`, note: "VS Code gates extension code execution with Workspace Trust; Zed has
no equivalent, so the server asks once per workspace per session before running
`playwright test --list`."
