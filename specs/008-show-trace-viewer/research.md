# Research: Show Trace Viewer

Phase 0 of `plan.md`. Every finding below was checked on 2026-10-20 against the fixture's
Playwright 1.64.0 (`fixtures/sample-project/node_modules/playwright-core/lib/coreBundle.js`,
`playwright/lib/program.js`), the server source on `main` at `f021a88`, and upstream
playwright-vscode `main` (extension 1.1.20: `src/testModel.ts`, `src/spawnTraceViewer.ts`,
`src/extension.ts`, `src/settingsView.ts`, `package.json`, `package.nls.json`). Line numbers
in the core bundle refer to the 1.64.0 build and move with every Playwright release.

## R1. Which Playwright command hosts the viewer, and how is it driven?

**Decision**: one `node <playwrightCli> show-trace --stdin` child per Playwright configuration,
started by the server with `cwd` = the workspace root, `stdio: ['pipe', 'pipe', 'pipe']`,
not detached. A trace is shown by writing its absolute path plus `\n` to the child's stdin.
The viewer is closed by ending stdin; the server sends SIGTERM if the process is still alive
five seconds later (same grace as `KILL_GRACE_MS` for runs).

**Rationale**: the command exists on the `@playwright/test` CLI entry the server already
resolves (`cli.js show-trace --help` lists `--stdin`, "Accept trace URLs over stdin to update
the viewer"; bundle line 75965). With `--stdin` the CLI sets `isServer: true` and installs a
`StdinServer` transport (57813, 57944 to 57973): each stdin chunk is trimmed, validated and
turned into a `loadTraceRequested` event for the viewer page; `process.stdin.on('close')`
exits the process gracefully (57973). Without `--host` or `--port` the trace opens in
Playwright's own Chromium app window (`runTraceViewerApp`, 57850; `openTraceViewerApp`,
57882, 1280 by 800, `headless: false`), and the process exits when that window is closed
(`page.on('close')`, 57856). Upstream does the same: `[cli, 'show-trace', '--stdin']`, one
process per config, path written to stdin, `stdin.end()` to close.

**Alternatives considered**: `--host 127.0.0.1 --port 0` (browser-tab mode) opens the system
browser through `open` and prints `Listening on <url>`; upstream uses it only for remote
hosts, which are out of scope here. Playwright's embedded trace viewer does not exist
upstream (only `SpawnTraceViewer`), and Zed has no webview anyway.

## R2. How does the viewer get the right trace, and when?

**Decision**: the step reporter that already rides along every run (feature 006) gains two
fields: on `testBegin` the predicted live trace path
`<project outputDir>/.playwright-artifacts-<workerIndex>/traces/<test.id>.json`, on
`testEnd` the path of the result attachment named `trace`. While the option is on and the
run targets a single test location (`location.kind === 'test'`), the server writes the live
path when the test begins and the final path when it ends, so the viewer follows the test as
upstream's does. At run end the server also parses every `trace` attachment out of the JSON
report into per-test records for "Show trace" at the cursor, and uses the last finished one
for the single-test case when the step reporter was unavailable.

**Rationale**, three facts of the `StdinServer`:

1. A path that does not exist kills the viewer: `validateTraceUrlOrPath` calls `statSync`
   and throws `Trace file <path> does not exist!` (57753 to 57760) inside the stdin `data`
   handler, where nothing catches it. The server must `stat` a `.zip` path before sending
   it. `.json` paths are exempt (57751) and are instead polled every 500 ms
   (`_pollLoadTrace`, 57990), which is the live mechanism.
2. A URL equal to the one already shown is ignored (`url3 === this._traceUrl`, 57966).
   Playwright writes the final trace of a test to the same `test-results/<slug>/trace.zip`
   on every run (verified with a probe run, attachments below), so sending only final paths
   would leave the viewer on the stale trace from the second run on. Alternating the live
   `.json` path and the final `.zip` path, as upstream does implicitly, makes every load
   distinct.
3. The JSON reporter carries the attachment: a probe run of `tests/passing.spec.ts` with
   `--trace on --reporter=json --project chromium` produced, for every non-skipped result,
   `{"name":"trace","contentType":"application/zip","path":"<abs>/test-results/<slug>/trace.zip"}`
   and `[]` for the skipped test; `config.projects[].outputDir` names
   `<fixture>/test-results`. The attachment is pushed by the worker with exactly that name
   (`playwright/lib/worker/workerProcessEntry.js:684`).

4. Each stdin chunk is one path: the `data` handler does `data.toString().trim()` with no
   line split (57965), and the reader is attached only once the bundle has loaded, so two
   paths written within a few milliseconds (the `testBegin` and `testEnd` of a 50 ms test
   arrive in the same poll tick) land in one read and fact 1 kills the process. Verified on
   2026-10-20 with the server log of the first integration run (`Trace file <json>\n<zip>
   does not exist!`). The session manager therefore writes the first path at once and
   spaces later writes (3 s after start, 250 ms apart), replacing a waiting path with a
   newer one, so a fast test loads only its final trace.

Upstream reference: `onTestBegin` predicts
`${fullProject.outputDir}/.playwright-artifacts-${result.workerIndex}/traces/${test.id}.json`
and `onTestEnd` uses `result.attachments.find(a => a.name === 'trace')?.path`; both are
available to a reporter (`test.id`, `test.parent.project().outputDir`, `result.workerIndex`,
`result.attachments`), which is where the server's step reporter runs.

**Alternatives considered**: showing only at run end from the JSON report (simplest) fails on
fact 2; restarting the viewer per run avoids fact 2 at the price of a new window every run;
inserting `/./` into the path to defeat the equality check works but is a trick on
Playwright's internals rather than its documented behaviour. Live `.json` polling needs no
such trick.

## R3. Where may the viewer read files from?

**Decision**: spawn the viewer with `cwd` = the workspace root (`ws.rootPath`), as upstream
spawns in the workspace folder, and warn once per run when a trace path lies outside it.

**Rationale**: with no trace argument, `traceFileRoots(undefined)` is `[process.cwd()]`
(57875) and the `/file` route answers 403 for anything outside the allowed roots
(57766 to 57773). Playwright's default `outputDir` is `test-results` next to the config, so a
config anywhere under the workspace root is covered; a config with an `outputDir` outside the
root would show an empty viewer, hence the warning.

## R4. Where does the on/off choice live, and how do settings reach it?

**Decision**: a new per-user store file `<stateDir>/trace-viewer.json`
(`{ "version": 1, "showTrace": true, "updatedAt": "<ISO>" }`, written like
`project-selection.json`: `0700` directory, `0600` file, temp file and rename) holds the
developer's explicit choice. The editor settings object the server already receives
(`workspace/configuration` and `didChangeConfiguration`, feature 005) may carry
`"showTrace": true|false`. Resolution: remembered choice, else settings value, else off.
The Rust shell needs no change: `forward_settings` passes the whole
`lsp.playwright.settings` object through.

**Rationale**: upstream's `playwright.showTrace` is one boolean per user or workspace, not
per config, so one file-level value is the faithful scope; the feature 005 precedence
(explicit choice beats the folder default) is already explained to users in the README.
The constitution names Zed settings as the primitive for this option (principle III, item 4)
and the code-action toggle is the in-editor equivalent of upstream's checkbox and command.

**Alternatives considered**: a key inside `project-selection.json` (mixes a global with
per-config entries and complicates the version field); settings only (no in-editor toggle,
fails the spec's two-action criterion); per-config choice (not upstream).

## R5. How is trace recording forced for a run?

**Decision**: `buildRunArgs` appends `--trace on` when the option is on, and nothing when it
is off.

**Rationale**: `playwright test` accepts `--trace <mode>` with modes `on, off,
on-first-retry, on-all-retries, retain-on-failure, retain-on-first-failure,
retain-on-failure-and-retries` (`playwright/lib/program.js:187, 221`); the probe run in R2
used it together with `--reporter`. Upstream sets `trace: 'on'` in its run options for the
same effect and leaves the project's own setting alone when the option is off, which is what
FR-011 asks for.

## R6. How is the feature tested without a human watching a window?

**Decision**: three layers. (1) Unit tests with an injected spawn function cover the viewer
session manager (start on first show, stdin writes, stat guard, dedupe of identical paths,
close by stdin end, SIGTERM fallback, exit and error handling), the preference resolution and
store, the `--trace on` argument, the report trace extraction and the step reporter's two new
fields. (2) Integration tests through `TestClient` check what needs no window: with the option
on the run command carries `--trace on`, `playwright/status` lists one trace record per
finished test with an existing file, toggling confirms with the Info message and writes the
store, the settings default applies, and with the option off nothing changes. (3) One
integration test starts the real viewer: it runs a single test with the option on and asserts
through `playwright/status` that a viewer session is running (pid alive) and shows the
test's final trace, then toggles off and asserts the process ended. This test needs a
display: WSLg provides one on the owner's machine (`DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`);
in CI the server job runs the suite under `xvfb-run -a` (`xvfb-run` is at `/usr/bin` on
the WSL host and is installed on GitHub's Ubuntu images; `apt-get install -y xvfb` if not);
when neither `DISPLAY` nor `WAYLAND_DISPLAY` is set the test skips itself and says why.

**Rationale**: the app window is the product; faking it everywhere would leave the one path
users see unverified, while running it in every test would make the suite depend on a
desktop. The window appears briefly on the developer's desktop during a local test run,
which is acceptable for a test that exists precisely to prove the window opens.

**Alternatives considered**: a server environment variable that switches the viewer to
browser-tab mode for tests (a test seam in product code, and `openTraceInBrowser` still
tries to open a browser unless Playwright detects a test or a coding agent); mocking the
Playwright CLI path (the server resolves it from the workspace, no injection point in the
spawned-process integration tests).

## R7. When is a viewer closed?

**Decision**: on toggle off (every session), on workspace removal (that workspace's
sessions), on `shutdown` and on server process exit (every session). A session whose process
exits on its own (window closed, crash) is forgotten; the next trace to show starts a fresh
one. The server never starts a viewer with nothing to show.

**Rationale**: FR-005 and FR-007; upstream closes in `updateTraceViewer` when the setting
goes off and in `reset`, and forgets the process on `exit`. Upstream additionally warms the
viewer up in `willRunTests`; the spec chose "never before a trace is to be shown", so no
warm-up.

## R8. Which editor surfaces carry the feature in Zed?

**Decision**: two code actions (kind `source.playwright`, command only, like feature 005),
`Playwright: [x] Show trace viewer` / `Playwright: [ ] Show trace viewer` from any served
document of an enabled workspace with a supported config, and `Playwright: Show trace` on a
test line when the option is on and the workspace has a finished run; `window/showMessage`
Info for every toggle (Zed's cached menu, feature 005 finding), Warning or Error for every
failure path with the command or test named; log lines for every viewer start, load, exit
and close. No code lens, no inlay hint, no Rust change.

**Rationale**: constitution principle III, primitives 3 and 5; the project picker already
proved the pattern in Zed 1.24.2.

## R9. Parity row wording after delivery

`full`, primitive `lsp` plus `playwright-ui`. Note: toggle and trace selection are code
actions (Zed has no settings view or Test Explorer tree); the viewer is Playwright's own
window fed over stdin exactly as upstream; the live trace follows a single-test run from
test start; differences: the viewer starts with the first trace rather than before the run,
and the "Show browser" interaction (upstream turns recording off while the browser is shown)
is deferred to that `not-started` row. Release: server and extension 0.7.0 in lockstep
(MINOR, new upstream capability).
