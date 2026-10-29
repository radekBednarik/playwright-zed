# Research: Show Browser

Phase 0 of `plan.md`. Every finding below was checked on 2026-10-29 against the fixture's
Playwright 1.64.0 (`fixtures/sample-project/node_modules/playwright-core/lib/coreBundle.js`,
line numbers refer to that build), the server source on `main` at `5d58188`, and upstream
playwright-vscode `main` (extension 1.1.20: `src/reusedBrowser.ts`, `src/testModel.ts`,
`src/settingsModel.ts`, `src/settingsView.ts`, `src/extension.ts`, `package.json`,
`package.nls.json`, README). The probes ran in the fixture under WSLg; their scripts lived in
the session scratchpad and are not kept, the commands are quoted so they can be rerun.

## R1. How does upstream keep a browser alive between runs, and is it reachable from the CLI?

**Decision**: one `node <playwrightCli> run-server --path=/<random> --host 127.0.0.1` child
per Playwright configuration, started with `PW_EXTENSION_MODE=1` in its environment, kept
across runs; every run started while the option is on gets
`PW_TEST_CONNECT_WS_ENDPOINT=<endpoint>` and `PW_TEST_REUSE_CONTEXT=1` in its environment.
Deliverable: verified end to end with the fixture's own Playwright, no test-server protocol
needed.

**Rationale**: upstream's `ReusedBrowser` spawns exactly `[cli, 'run-server',
'--path=/<guid>', '--host', '127.0.0.1']` with `PW_EXTENSION_MODE: '1'` and passes the
endpoint into the run as `connectWsEndpoint` with `reuseContext: true`; its test server
turns those into the same two environment variables that Playwright's fixtures read
(`packages/playwright/src/index.ts`: `connectOptionsFromEnv()` reads
`PW_TEST_CONNECT_WS_ENDPOINT` and makes the `browser` fixture `connect()` instead of
`launch()`; `_reuseContext` reads `PW_TEST_REUSE_CONTEXT` and switches the `context`
fixture to `_newContextForReuse()`). On the server side (bundle 72066 to 72079)
`run-server` builds `new PlaywrightServer({ mode: extension ? "extension" : "default" })`
where `extension = options.mode === "extension" || !!process.env.PW_EXTENSION_MODE`
(75957), prints `Listening on <ws endpoint>` once it listens, and in extension mode routes
every plain client connection to `_initReuseBrowsersMode` (58368 to 58386, 58420 to 58457):
the first connection launches the browser with `headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS`
(so headed by default, whatever the client asked), later connections reuse a browser with
the same name and launch-option hash, and on disconnect only contexts without pages are
closed ("Connection terminated"), so the last page stays on screen. Probe in the fixture
(`PW_EXTENSION_MODE=1 node cli.js run-server --path=/probe --host 127.0.0.1`, then seven
`node cli.js test tests/passing.spec.ts:3 -c playwright.config.ts --reporter=list,json
--workers 1 [--headed] [--project chromium|mobile]` runs with the two variables set): one
Chromium process (one pid) served runs 1 to 6, including the `mobile` project (device
emulation is a context option, same browser) and a run without `--headed` (`headless` is in
`optionsThatAllowBrowserReuse`, 58543, so it never splits the browser); every run passed.

**Alternatives considered**: upstream's `test-server` protocol over WebSocket (would replace
the CLI runs of features 001 to 008, out of proportion for one option); launching the test
runner with `--headed` only (a new browser per run, nothing kept, not upstream's behaviour);
Playwright's `launchServer` API from server code (would bundle Playwright logic, principle
IV).

## R2. What does a run look like while the option is on?

**Decision**: `buildRunArgs` appends `--headed --workers 1 --trace off` and the run's
environment gains the two variables of R1. `RunRequest.trace` is forced to `false` for
such a run, so the trace viewer never follows it and nothing is recorded. Video cannot be
forced off from the command line; the project's own `video` setting stays in force.

**Rationale**: upstream sets `headed: true`, `workers: 1`, `reuseContext: true`,
`connectWsEndpoint`, `trace: 'off'` and `video: 'off'` for the run (`testModel.ts`). The
1.64.0 CLI has `--headed`, `--workers <n>` and `--trace <mode>` with `off` among the
choices (`cli.js test --help`), and no video option at all. `--headed` is cosmetic here (the
server launches headed anyway, R1) but it keeps the run's own browser launch headed should a
project opt out of the connection, and it matches upstream. `--workers 1` matches upstream's
"one worker" sublabel; two workers also passed in the probe (the server serialises reuse
connections with a semaphore, 58311) but would interleave two contexts in one window. Trace:
the probe recorded a trace three times in a row through the kept browser without the ENOENT
failure upstream cites (the `test-results` directory is recreated per run and the reused
context's tracing restarted fine on 1.64.0), so the rule is kept for parity and because the
spec (FR-005) asks for it, not because it still breaks. Video: when a project sets
`video: 'on'`, Playwright itself refuses context reuse (`_reuseContext` requires video off)
and creates a fresh context per test inside the kept browser; the browser is still shown
and kept, only the page state does not survive between tests. Recorded as a difference
from upstream in the parity note; the spec's "neither trace nor video" holds for trace and
for every project that does not ask for video.

**Alternatives considered**: a generated wrapper config that overrides `video` (parses or
re-exports the user's config, principle IV forbids reimplementing config handling);
`--output` tricks (do not affect video).

## R3. How is the browser server started, and when is it ready?

**Decision**: started lazily by the first run that needs it, from the configuration's
directory (`cwd` = `config.configDir`, like runs), with `stdio` piped, environment = the
server's environment plus `PW_EXTENSION_MODE=1` and `FORCE_COLOR=0`, not detached. Ready
when stdout contains `Listening on ws://...`; the endpoint is the rest of that line. The
run waits for readiness up to 15 s. When the process cannot be spawned, exits before the
line, or the line does not come in time, the run does not start: one Error message names
the command and the detail, the option stays on, and the run is reported as `error` in the
log (spec edge case "cannot start", resolved as "abort the run").

**Rationale**: upstream starts the backend in `onWillRunTests` before the run and fails the
run when it cannot; starting the server before the first run instead would open nothing
visible and waste a process while the option sits on. The `Listening on` line appeared within
one second in every probe. Aborting is the honest choice: running headless instead would
contradict the option the developer just turned on and hide the failure behind a passing
run.

**Alternatives considered**: eager start at toggle on (upstream does not; the spec says the
browser is replaced "at the next run, and never before"); run as if the option were off on
failure (rejected above); `--port` chosen by the server (an unused port is still racy, the
`Listening on` line is authoritative either way).

## R4. How is the browser server stopped, and what happens when the browser dies?

**Decision**: stop = `SIGINT`, then `SIGKILL` 5 s later if the process is still alive
(`child.kill()` on Windows, where it is a plain terminate). Stopped on: "Close all
browsers" (refused while a run is in progress), toggle off (at once, or at the end of the
current run when one is in progress), workspace removal (that workspace's servers),
`shutdown`, `exit` and a `process.on('exit')` fallback (every server, `SIGKILL`). A server
that exits on its own is forgotten; the next run starts a fresh one. A browser the developer
closes leaves the server alive; the next connection launches a fresh browser (upstream's
behaviour, "the next run opens a fresh window").

**Rationale**: probes on 1.64.0 with a browser launched: ending the server's stdin does
nothing (`run-server` installs `process.stdin.on('close')` but never reads stdin, so the
event never fires; the show-trace viewer differs because `--stdin` reads it); `SIGTERM`
closes the browser (Playwright's launcher installs a SIGTERM handler that runs
`gracefullyCloseAll`) but leaves the Node process alive with its WebSocket server;
`SIGHUP` the same; `SIGINT` closes the browser and exits with code 130 after about 50 ms
(`gracefullyCloseAll().then(exitWithCode130)`, bundle 9998 to 10001); `SIGKILL` ends the
process at once and the browser dies with its control pipe within a second. Before any run
(no browser yet) `SIGTERM` ends the process too, but `SIGINT` covers both cases. Upstream
sends `kill` over its debug-controller connection, which calls the same
`gracefullyProcessExitDoNotHang(0)`; a signal reaches it without speaking Playwright's
internal protocol. Killing the browser by hand during the probe left the server alive and
the next run launched a new browser (pid changed), which is exactly FR-003's "replaced at
the next run". Cancelling a run mid-way (SIGTERM to the test process group) left server
and browser alive and the next run reused them.

**Alternatives considered**: a debug-controller WebSocket client with `initialize` and
`kill` (Playwright's internal protocol, versioned per release, and Node's global
`WebSocket` would still need the message framing); stdin end (does not work, above);
tracking the page count to stop the server when the last page closes as upstream does
(needs the debug controller's `stateChanged` events; the spec is satisfied without it: a
closed browser is replaced at the next run, and the idle server costs one Node process).

## R5. Where does the choice live, and under which name?

**Decision**: a new per-user store file `<stateDir>/show-browser.json`
(`{ "version": 1, "showBrowser": true, "updatedAt": "<ISO>" }`, written like
`trace-viewer.json`: `0700` directory, `0600` file, temp file and rename) holds the
explicit choice. The settings object may carry `"reuseBrowser": true|false` (upstream's
setting name, title "Show browser"). Resolution: remembered choice, else settings value,
else off; a settings change re-resolves only when the source is `settings` or `default`.
No Rust change: the shell forwards the whole `lsp.playwright.settings` object.

**Rationale**: same scope as upstream's `playwright.reuseBrowser` (one boolean per user or
workspace) and the pattern features 005 and 008 established; the constitution names Zed
settings as the primitive for "show browser" (principle III item 4) and asks for upstream's
setting names.

**Alternatives considered**: one combined `options.json` for both booleans (would need a
migration of `trace-viewer.json`; separate files keep feature 008 untouched); the key
`showBrowser` in settings (not upstream's name).

## R6. How do "Show browser" and "Show trace viewer" interact?

**Decision**: turning "Show browser" on while "Show trace viewer" is on also turns the
trace viewer off as an explicit, remembered choice (`trace-viewer.json` written with
`false`), closes every viewer, and the confirmation reads `Playwright: show browser is on;
show trace viewer turned off (no traces while the browser is shown)`. Symmetrically (owner
decision 2026-10-29, after trying the one-directional rule in Zed), turning "Show trace
viewer" on while "Show browser" is on turns the browser option off as a remembered choice
(`show-browser.json` written with `false`), stops the kept browser servers of every
workspace without a run in progress, and the confirmation reads `Playwright: show trace
viewer is on; show browser turned off (browsers closed)`. Both on therefore remains
reachable only through a settings default (`reuseBrowser: true` with the viewer remembered
on, or the reverse); every run started while both are on carries `--trace off`, is not
followed by the viewer, logs `playwright: run <id> trace recording off (show browser is
on)` and, once per combination of the two preferences, shows the Warning `Playwright: show
browser is on, so runs record no trace; turn it off to use the trace viewer`. "Show trace"
at the cursor is offered only when the last run recorded traces (a run with the browser
shown records none, so it is absent).

**Rationale**: upstream `settingsModel.ts` turns `showTrace` off when `reuseBrowser` turns
on and the run options force `trace: 'off'` whenever `showBrowser` is on, with nothing
turning `showBrowser` off in the reverse direction; the owner found that asymmetry
surprising in use (a browser window left open after asking for traces) and chose mutual
exclusion, recorded as a difference in the parity note. Persisting the forced-off choice
matches upstream (VS Code writes the setting). The once-per-combination Warning keeps the
spec's "the run's messages say why" for the settings path without repeating it on every
run.

## R7. How is the feature tested without a window?

**Decision**: three layers. (1) Unit tests with an injected spawn function cover the server
manager (start on first need, `Listening on` parsing, readiness timeout, spawn error, early
exit, stop by SIGINT with the SIGKILL fallback, forget on exit), the preference resolution
and store, the run arguments (`--headed --workers 1 --trace off`), the run environment
(`RunManager.start` passing the endpoint variables) and the trace coupling helpers. (2)
Integration tests through `TestClient` start the language server with
`PW_DEBUG_CONTROLLER_HEADLESS=1` in its environment: the variable reaches `run-server`
through the inherited environment and makes the kept browser headless (bundle 58447,
verified in the probe: `chrome-headless-shell` under the server's pid), so the suite needs
no display and opens no window. They check: toggle on confirms, remembers and flips the
title; a run with the option on logs the endpoint, carries the three flags and no `--trace
on`, and `playwright/status` lists one browser server whose pid is alive; a second run
keeps the same pid; "Close all browsers" during a run is refused, after the run ends the
server (pid gone, option still on); toggle off ends it; the trace coupling (on, on, off,
messages); the settings default `reuseBrowser`; with the option off the command line is
byte-identical to today's. (3) The headed window is the owner's quickstart in Zed, recorded
in `verification.md`.

**Rationale**: the headless switch is Playwright's own, read by the very code path the
feature uses, so the tests exercise the real server and the real reuse without a desktop;
CI keeps `xvfb-run` for feature 008's viewer test only.

**Alternatives considered**: a display-gated test as in feature 008 (the headless path
already proves the mechanism; the window itself is the manual scenario); mocking the CLI
(no injection point in spawned-process integration tests).

## R8. Which editor surfaces carry the feature in Zed?

**Decision**: two code actions of kind `source.playwright`, command only, after the trace
viewer toggle and before the project picker: `Playwright: [x] Show browser` /
`Playwright: [ ] Show browser` from any served document of an enabled workspace with a
supported config, and `Playwright: Close all browsers` whenever the option is on or at
least one browser server is running for the workspace; `window/showMessage` Info for every
toggle and for a close, Warning for a refused close and for the trace coupling, Error when
the server cannot start; log lines for every start, endpoint, stop and exit. No code lens,
no inlay hint, no Rust change.

**Rationale**: constitution principle III primitives 3 and 5; the picker and the trace
toggle proved the pattern in Zed 1.24.2. "Close all browsers" is offered while the option is
on even before a server exists because Zed caches the menu per cursor position (feature
005 finding) and a run started from that very menu would otherwise leave the entry missing;
with nothing to close it answers `Playwright: no browsers to close`.

## R9. Version gates, platforms, parity wording and release

`run-server`, `PW_EXTENSION_MODE`, `PW_TEST_CONNECT_WS_ENDPOINT` and `PW_TEST_REUSE_CONTEXT`
are what upstream has relied on since its 1.25 gate; the project's minimum stays 1.38 and
no new version message is needed. `--trace off` and `--headed` predate 1.38. Windows:
`child.kill()` terminates the server without the graceful close; the browser dies with its
pipe (same as the SIGKILL probe); no owner verification planned there, as for earlier
features. Remote topologies stay out of scope. Parity: both rows move to `full`, primitive
`lsp, playwright-ui`; note the code-action toggle and close (no settings view), the kept
browser being Playwright's own `run-server` as upstream, the differences (video left to the
project config; no page-count stop, a closed browser is replaced at the next run; the
server starts with the first run rather than before it, which is the same moment). The
feature 008 row drops its deferred note. Release: server and extension 0.8.0 in lockstep
(MINOR, two upstream capabilities).
