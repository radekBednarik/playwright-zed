# Quickstart: Remember Discovery Consent per Folder

Validation guide for feature 003. Contract: [contracts/editor-trust.md](./contracts/editor-trust.md);
states: [data-model.md](./data-model.md).

## Prerequisites

- Zed 0.218 or newer (owner's machine: Linux Zed 1.23.3 at `~/.local/bin/zed`, WSLg).
- Fresh clone bootstrapped per `.claude/memory/new-machine-setup.md`; `server` built with
  `npm run build`.
- Zed launched from a terminal that exports
  `PLAYWRIGHT_ZED_SERVER_ENTRY=<repo>/server/bin/playwright-zed-language-server.js`, so the
  local build runs instead of the npm 0.2.0 package; dev extension installed on the repo root.
- Warning: scenario 5 uses `workspace::ClearTrustedWorktrees`, which clears **every** trusted
  folder, including the repo root, and restarts Zed. Re-trust the repo root afterwards.

## 1. Automated suite

```sh
cd server && npm run lint && npm test && npm run build
```

Expected: all feature 001/002 tests pass unchanged (they send no `clientInfo`, so they run the
fallback path), plus the new unit tests for the gate rule and the new integration tests in
`test/integration/trust.test.ts` (Zed `1.23.3`: no question, discovery runs, status source
`editor-trust`; Zed `0.217.4`: question asked, marker absent before the answer; Zed `1.23.3`
with only `rootUri`: question asked).

## 2. Untrusted folder stays restricted (spec story 1 scenario 3, story 2, SC-003)

```sh
rm -rf /tmp/pwz-003 && mkdir /tmp/pwz-003
cp -r fixtures/sample-project/{tests,package.json,playwright.config.ts} /tmp/pwz-003/
ln -s "$PWD/fixtures/sample-project/node_modules" /tmp/pwz-003/node_modules
sed -i '1i import { writeFileSync } from "node:fs"; writeFileSync("/tmp/pwz-003.marker", "loaded");' /tmp/pwz-003/playwright.config.ts
mkdir /tmp/pwz-003/.zed && echo '{ "session": { "trust_all_worktrees": true } }' > /tmp/pwz-003/.zed/settings.json
rm -f /tmp/pwz-003.marker
~/.local/bin/zed --foreground /tmp/pwz-003
```

Open `tests/example.spec.ts`. Expected: Zed shows the restricted-mode icon in the title bar;
no Playwright question, no lenses; `/tmp/pwz-003.marker` does not exist; the Zed log has
"Waiting for worktree … to be trusted" for the Playwright server.

## 3. Trusting in Zed enables discovery without a second question (story 1 scenario 1)

Use `workspace: toggle worktree security` and trust `/tmp/pwz-003` (the folder only, not the
parent). Expected: no question from Playwright for Zed; within the feature 001 discovery time,
run lenses appear; `/tmp/pwz-003.marker` exists; the language server log contains
`playwright: Zed trusts /tmp/pwz-003; test discovery enabled without asking`.

## 4. Restart keeps it (story 1 scenario 2, SC-001)

`zed: quit`, then `rm /tmp/pwz-003.marker` and reopen `/tmp/pwz-003`. Expected: no question
from Zed or from the extension, lenses appear, marker recreated. Repeat the quit, `rm` and reopen cycle
until 10 consecutive sessions have shown no question (SC-001); record the count in
`verification.md`. A shell loop helps:
`for i in $(seq 10); do rm -f /tmp/pwz-003.marker; ~/.local/bin/zed --foreground /tmp/pwz-003; test -f /tmp/pwz-003.marker && echo "run $i ok"; done`
(quit Zed with `zed: quit` after lenses appear in each run).

## 5. Revoking in Zed brings the gate back (story 1 scenario 4)

Run `workspace: clear trusted worktrees` (Zed restarts). `rm -f /tmp/pwz-003.marker`, reopen
`/tmp/pwz-003`. Expected: restricted again, no lenses, marker absent until trusted again.
Afterwards re-trust the repo root `/home/radek/repos/personal/playwright-zed`.

## 6. Sample project in the repo (regression)

Open `fixtures/sample-project` (trusted through the repo root). Expected: no Playwright
question; lenses appear; quickstart scenarios 2, 5 and 11 from feature 001 pass.

## 7. Fallback still asks (story 3)

Covered by the automated suite (scenario 1). A manual check with an editor other than Zed is
not required; record it as skipped in `verification.md` if not done.

## Cleanup

```sh
rm -rf /tmp/pwz-003 /tmp/pwz-003.marker
```
