import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE, MessageType, PASSING, SLOW, TestClient, childPids, processAlive, uriOf, type BrowserServerStatus, type ShowBrowserStatus, type TracesStatus } from './helpers';

// Feature 009 (specs/009-show-browser): the "Show browser" option, runs through a kept browser
// server, "Close all browsers", persistence, settings and the coupling with the trace viewer.
// The kept browser runs headless through Playwright's own PW_DEBUG_CONTROLLER_HEADLESS (research R7).

const TOGGLE = 'playwright.toggleShowBrowser';
const CLOSE_ALL = 'playwright.closeAllBrowsers';
const TOGGLE_TRACE = 'playwright.toggleTraceViewer';
const RUN_AT_CURSOR = 'playwright.runAtCursor';
const RUN_FILE = 'playwright.runFile';
const ON_TITLE = 'Playwright: [x] Show browser';
const OFF_TITLE = 'Playwright: [ ] Show browser';
const CLOSE_TITLE = 'Playwright: Close all browsers';
const SHOW_TRACE_TITLE = 'Playwright: Show trace';
const STORE = 'show-browser.json';
const TRACE_STORE = 'trace-viewer.json';
const FLAGS = '--headed --workers 1 --trace off';
const HEADLESS_ENV = { PW_DEBUG_CONTROLLER_HEADLESS: '1' };
// 0-based lines of the fixtures
const L = { adds: 2, multiplies: 18, slow: 4 };

const titles = (actions: any[]) => actions.map((a) => a.title as string);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function runCommandLine(client: TestClient): string {
  const line = client.messages('window/logMessage').map((m) => m.params.message as string).find((m) => /^playwright: run \d+ command: /.test(m));
  if (!line) throw new Error('no run command line logged');
  return line.split('\n')[0].replace(/^playwright: run \d+ command: /, '');
}

function logLines(client: TestClient): string[] {
  return client.messages('window/logMessage').map((m) => m.params.message as string);
}

async function finished(client: TestClient): Promise<void> {
  await client.waitFor('$/progress', (p) => p.value?.kind === 'end');
}

async function toggle(client: TestClient, file = PASSING): Promise<void> {
  await client.execute(TOGGLE, [{ uri: uriOf(file) }]);
}

function servers(status: any[]): BrowserServerStatus[] {
  return status[0].browserServers as BrowserServerStatus[];
}

async function waitDead(pid: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (processAlive(pid)) {
    if (Date.now() > deadline) throw new Error(`process ${pid} still alive after ${timeoutMs} ms`);
    await sleep(200);
  }
}

/** A state directory the test owns across client restarts (the client removes only directories it created). */
function ownStateDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-browser-'));
}

async function runAndServer(client: TestClient, line = L.adds): Promise<BrowserServerStatus> {
  await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line }]);
  await finished(client);
  const list = servers(await client.status());
  expect(list).toHaveLength(1);
  return list[0];
}

/** Leaves the option off and no server behind. */
async function ensureOff(client: TestClient): Promise<void> {
  const status = await client.status();
  const pids = servers(status).map((s) => s.pid);
  if ((status[0].showBrowser as ShowBrowserStatus).enabled) await toggle(client);
  for (const pid of pids) await waitDead(pid);
}

describe('show browser toggle and visible runs (US1)', () => {
  let client: TestClient;
  let baselineCommand: string;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV });
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
  });
  beforeEach(() => client.clear());

  it('(a) starts off, offers the toggle after the trace toggle and before the picker, no close action', async () => {
    const status = await client.status();
    expect(status[0].showBrowser).toEqual({ enabled: false, source: 'default' });
    expect(status[0].browserServers).toEqual([]);
    const actions = await client.codeActions(PASSING, L.adds);
    const list = titles(actions);
    expect(list).toContain(OFF_TITLE);
    expect(list).not.toContain(CLOSE_TITLE);
    expect(list.indexOf(OFF_TITLE)).toBeGreaterThan(list.indexOf('Playwright: [ ] Show trace viewer'));
    expect(list.indexOf(OFF_TITLE)).toBeLessThan(list.indexOf('Playwright: [x] chromium'));
    expect(actions.find((a) => a.title === OFF_TITLE).command).toMatchObject({ command: TOGGLE, arguments: [{ uri: uriOf(PASSING) }] });
  });

  it('(b) a run with the option off carries no flags and starts no server', async () => {
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    await finished(client);
    baselineCommand = runCommandLine(client);
    expect(baselineCommand).not.toContain('--headed');
    expect(baselineCommand).not.toContain('--workers');
    expect(baselineCommand).not.toContain('--trace');
    expect(servers(await client.status())).toEqual([]);
    expect(logLines(client).some((m) => /browser server/.test(m))).toBe(false);
  });

  it('(c) toggling on confirms, remembers and flips the title', async () => {
    await toggle(client);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: show browser is on');
    expect(JSON.parse(fs.readFileSync(path.join(client.stateDir, STORE), 'utf8'))).toMatchObject({ version: 1, showBrowser: true });
    const status = await client.status();
    expect(status[0].showBrowser).toEqual({ enabled: true, source: 'remembered' });
    const list = titles(await client.codeActions(PASSING, L.adds));
    expect(list).toContain(ON_TITLE);
    expect(list).toContain(CLOSE_TITLE);
    expect(list.indexOf(CLOSE_TITLE)).toBe(list.indexOf(ON_TITLE) + 1);
  });

  it('(d) a single-test run with the option on goes through one headless kept browser', async () => {
    const server = await runAndServer(client);
    const command = runCommandLine(client);
    expect(command.endsWith(FLAGS)).toBe(true);
    expect(command).not.toContain('--trace on');
    expect(logLines(client).some((m) => /^playwright: run \d+ browser server ws:\/\/127\.0\.0\.1:\d+\//.test(m))).toBe(true);
    expect(logLines(client).some((m) => /browser server playwright\.config\.ts listening on ws:\/\//.test(m))).toBe(true);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed, 0 failed, 0 skipped/.test(m))).toBe(true);
    expect(server).toMatchObject({ configPath: path.join(FIXTURE, 'playwright.config.ts'), state: 'ready' });
    expect(server.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}$/);
    expect(processAlive(server.pid)).toBe(true);
    const browsers = childPids(server.pid);
    expect(browsers.length).toBeGreaterThan(0);
    const args = spawnSync('ps', ['-o', 'args=', '-p', String(browsers[0])], { encoding: 'utf8' }).stdout;
    expect(args).toMatch(/headless/);
  });

  it('(e) a file run passes every test through the same server', async () => {
    const before = servers(await client.status())[0];
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    await finished(client);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 11 passed, 0 failed, 1 skipped/.test(m))).toBe(true);
    expect(runCommandLine(client).endsWith(FLAGS)).toBe(true);
    const after = servers(await client.status());
    expect(after).toHaveLength(1);
    expect(after[0].pid).toBe(before.pid);
    expect(logLines(client).some((m) => /browser server .* started/.test(m))).toBe(false);
  });

  it('(f) toggling off confirms, stops the server and restores the exact command line', async () => {
    const pid = servers(await client.status())[0].pid;
    await toggle(client);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: show browser is off');
    await waitDead(pid, 5000);
    await client.waitForStatus((s) => (servers(s).length === 0 ? true : null), 5000);
    client.clear();
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    await finished(client);
    expect(runCommandLine(client)).toBe(baselineCommand);
    expect(servers(await client.status())).toEqual([]);
  });
});

describe('kept between runs (US2)', () => {
  let client: TestClient;
  const stateDir = ownStateDir();

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir });
    await client.waitForDiscovery();
    await toggle(client);
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
  beforeEach(() => client.clear());

  it('(g) two runs share one server and one browser', async () => {
    const first = await runAndServer(client);
    const browser = childPids(first.pid);
    expect(browser.length).toBeGreaterThan(0);
    client.clear();
    const second = await runAndServer(client, L.multiplies);
    expect(second.pid).toBe(first.pid);
    expect(childPids(second.pid)).toEqual(browser);
    expect(logLines(client).some((m) => /browser server .* started/.test(m))).toBe(false);
  });

  it('(h) a browser killed by hand is replaced at the next run by the same server', async () => {
    const server = servers(await client.status())[0];
    const browser = childPids(server.pid);
    process.kill(browser[0], 'SIGKILL');
    await waitDead(browser[0]);
    await sleep(500);
    expect(processAlive(server.pid)).toBe(true);
    client.clear();
    const after = await runAndServer(client);
    expect(after.pid).toBe(server.pid);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed/.test(m))).toBe(true);
    const fresh = childPids(after.pid);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh).not.toContain(browser[0]);
  });

  it('(i) a server killed from outside is reported and replaced by the next run', async () => {
    const server = servers(await client.status())[0];
    process.kill(server.pid, 'SIGKILL');
    await waitDead(server.pid);
    await client.waitForStatus((s) => (servers(s).length === 0 ? true : null), 5000);
    expect(logLines(client).some((m) => /browser server playwright\.config\.ts exited on its own/.test(m))).toBe(true);
    expect(client.showMessages(MessageType.Warning).some((m) => /^Playwright: the browser server for playwright\.config\.ts exited \(code .*\); a new one starts with the next run$/.test(m))).toBe(true);
    client.clear();
    const after = await runAndServer(client);
    expect(after.pid).not.toBe(server.pid);
    expect(logLines(client).some((m) => /browser server playwright\.config\.ts started/.test(m))).toBe(true);
  });

  it('(j) stopping the language server leaves no browser server behind', async () => {
    const server = servers(await client.status())[0];
    expect(processAlive(server.pid)).toBe(true);
    await client.stop();
    await waitDead(server.pid, 5000);
    // a fresh client for afterAll, with the option still remembered on
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir });
    await client.waitForDiscovery();
    expect((await client.status())[0].showBrowser).toEqual({ enabled: true, source: 'remembered' });
  });
});

describe('close all browsers, toggle off, persistence and settings (US3)', () => {
  let client: TestClient;
  const stateDir = ownStateDir();

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir });
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
  beforeEach(() => client.clear());

  it('(q) the close action follows the option or a running server', async () => {
    expect(titles(await client.codeActions(PASSING, L.adds))).not.toContain(CLOSE_TITLE);
    await toggle(client);
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(CLOSE_TITLE);
  });

  it('(k) closes the kept browser, keeps the option on, and the next run starts anew', async () => {
    const server = await runAndServer(client);
    client.clear();
    await client.execute(CLOSE_ALL, [{ uri: uriOf(PASSING) }]);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: browsers closed');
    await waitDead(server.pid, 5000);
    await client.waitForStatus((s) => (servers(s).length === 0 ? true : null), 5000);
    expect((await client.status())[0].showBrowser).toEqual({ enabled: true, source: 'remembered' });
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(ON_TITLE);
    client.clear();
    const after = await runAndServer(client);
    expect(after.pid).not.toBe(server.pid);
    expect(logLines(client).some((m) => /browser server playwright\.config\.ts started/.test(m))).toBe(true);
    await client.execute(CLOSE_ALL, [{ uri: uriOf(PASSING) }]);
    await waitDead(after.pid, 5000);
  });

  it('(l) with nothing running the close action says so', async () => {
    await client.waitForStatus((s) => (servers(s).length === 0 ? true : null), 5000);
    await client.execute(CLOSE_ALL, [{ uri: uriOf(PASSING) }]);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: no browsers to close');
  });

  it('(m) refuses to close while a run is in progress', async () => {
    // executeCommand answers only when the run ends, so the run is not awaited here
    const run = client.execute(RUN_AT_CURSOR, [{ uri: uriOf(SLOW), line: L.slow }]);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    await client.waitForStatus((s) => (servers(s).length === 1 && servers(s)[0].state === 'ready' ? servers(s)[0] : null), 20_000);
    await sleep(1000);
    await client.execute(CLOSE_ALL, [{ uri: uriOf(PASSING) }]);
    expect(client.showMessages(MessageType.Warning)).toContain('Playwright: cannot close browsers while tests are running');
    const server = servers(await client.status())[0];
    expect(processAlive(server.pid)).toBe(true);
    await run;
    await finished(client);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed/.test(m))).toBe(true);
    expect(processAlive(server.pid)).toBe(true);
  });

  it('(n) turning off mid-run lets the run finish, then stops the server', async () => {
    const server = servers(await client.status())[0];
    const run = client.execute(RUN_AT_CURSOR, [{ uri: uriOf(SLOW), line: L.slow }]);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    await sleep(1500);
    await toggle(client);
    expect(processAlive(server.pid)).toBe(true);
    await run;
    await finished(client);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed/.test(m))).toBe(true);
    expect(runCommandLine(client).endsWith(FLAGS)).toBe(true);
    await waitDead(server.pid, 5000);
    expect((await client.status())[0].showBrowser.enabled).toBe(false);
  });

  it('(o) the choice survives a server restart on the same state directory', async () => {
    await toggle(client);
    await client.stop();
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir });
    await client.waitForDiscovery();
    expect((await client.status())[0].showBrowser).toEqual({ enabled: true, source: 'remembered' });
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(ON_TITLE);
    await toggle(client);
    expect((await client.status())[0].showBrowser).toEqual({ enabled: false, source: 'remembered' });
  });

  it('(p) a settings default applies, warns once on an invalid value, and loses to a remembered choice', async () => {
    const fresh = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, settings: { reuseBrowser: true } });
    try {
      await fresh.waitForDiscovery();
      expect((await fresh.status())[0].showBrowser).toEqual({ enabled: true, source: 'settings' });
      expect(fresh.showMessages(MessageType.Info).filter((m) => m === 'Playwright: show browser is on (from settings)')).toHaveLength(1);
      await fresh.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
      await finished(fresh);
      expect(runCommandLine(fresh).endsWith(FLAGS)).toBe(true);
      const pid = servers(await fresh.status())[0].pid;
      fresh.clear();
      // a settings change to off stops the idle server
      await fresh.changeSettings({ reuseBrowser: false });
      await waitDead(pid, 5000);
      expect((await fresh.status())[0].showBrowser).toEqual({ enabled: false, source: 'settings' });
      await fresh.changeSettings({ reuseBrowser: true });
      await sleep(300);
      expect((await fresh.status())[0].showBrowser).toEqual({ enabled: true, source: 'settings' });
      // an invalid value warns once and counts as absent (data-model "Settings value")
      fresh.clear();
      await fresh.changeSettings({ reuseBrowser: 'yes' });
      await sleep(300);
      expect(fresh.showMessages(MessageType.Warning)).toEqual(['Playwright: setting "reuseBrowser" must be true or false']);
      expect((await fresh.status())[0].showBrowser).toEqual({ enabled: false, source: 'default' });
      await fresh.changeSettings({ reuseBrowser: 'yes' });
      await sleep(300);
      expect(fresh.showMessages(MessageType.Warning)).toHaveLength(1);
    } finally {
      await ensureOff(fresh);
      await fresh.stop();
    }
    // the client of this block remembered "off" in (o); a true setting does not override it
    const remembered = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir, settings: { reuseBrowser: true } });
    try {
      await remembered.waitForDiscovery();
      expect((await remembered.status())[0].showBrowser).toEqual({ enabled: false, source: 'remembered' });
      expect(remembered.showMessages(MessageType.Info)).not.toContain('Playwright: show browser is on (from settings)');
    } finally {
      await remembered.stop();
    }
  });
});

describe('coupling with the trace viewer (US4)', () => {
  let client: TestClient;
  const stateDir = ownStateDir();

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir });
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    const status = await client.status();
    if (status[0].traceViewer.enabled) await client.execute(TOGGLE_TRACE, [{ uri: uriOf(PASSING) }]);
    await ensureOff(client);
    await client.stop();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
  beforeEach(() => client.clear());

  it('(r) turning the browser on turns the trace viewer off and runs record no trace', async () => {
    await client.execute(TOGGLE_TRACE, [{ uri: uriOf(PASSING) }]);
    expect((await client.status())[0].traceViewer.enabled).toBe(true);
    client.clear();
    await toggle(client);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: show browser is on; show trace viewer turned off (no traces while the browser is shown)');
    expect(client.showMessages(MessageType.Info)).not.toContain('Playwright: show browser is on');
    const status = await client.status();
    expect(status[0].traceViewer).toEqual({ enabled: false, source: 'remembered' });
    expect(status[0].traceViewers).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(client.stateDir, TRACE_STORE), 'utf8'))).toMatchObject({ version: 1, showTrace: false });
    expect(JSON.parse(fs.readFileSync(path.join(client.stateDir, STORE), 'utf8'))).toMatchObject({ version: 1, showBrowser: true });
    client.clear();
    await runAndServer(client);
    const command = runCommandLine(client);
    expect(command).toContain('--trace off');
    expect(command).not.toContain('--trace on');
    expect(((await client.status())[0].traces as TracesStatus).records).toEqual([]);
    expect(titles(await client.codeActions(PASSING, L.adds))).not.toContain(SHOW_TRACE_TITLE);
  });

  it('(s) turning the trace viewer on while the browser is shown turns the browser off and closes it', async () => {
    const pid = servers(await client.status())[0].pid;
    await client.execute(TOGGLE_TRACE, [{ uri: uriOf(PASSING) }]);
    expect(client.showMessages(MessageType.Info)).toContain('Playwright: show trace viewer is on; show browser turned off (browsers closed)');
    expect(client.showMessages(MessageType.Info)).not.toContain('Playwright: show trace viewer is on');
    await waitDead(pid, 5000);
    const status = await client.status();
    expect(status[0].showBrowser).toEqual({ enabled: false, source: 'remembered' });
    expect(status[0].traceViewer).toEqual({ enabled: true, source: 'remembered' });
    expect(servers(status)).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(client.stateDir, STORE), 'utf8'))).toMatchObject({ version: 1, showBrowser: false });
    const list = titles(await client.codeActions(PASSING, L.adds));
    expect(list).toContain(OFF_TITLE);
    expect(list).toContain('Playwright: [x] Show trace viewer');
    expect(list).not.toContain(CLOSE_TITLE);
    client.clear();
    // a file run records traces without following them in the viewer (feature 008)
    await client.execute(RUN_FILE, [{ uri: uriOf(SLOW) }]);
    await finished(client);
    expect(runCommandLine(client)).toContain('--trace on');
    expect(runCommandLine(client)).not.toContain('--headed');
    expect(((await client.status())[0].traces as TracesStatus).records.length).toBeGreaterThan(0);
    expect(servers(await client.status())).toEqual([]);
    expect(client.showMessages(MessageType.Warning)).toEqual([]);
  });

  it('(t) both on through a settings default records no trace and warns once per combination', async () => {
    // only a remembered trace choice plus a folder default for the browser can leave both on
    const dir = ownStateDir();
    fs.writeFileSync(path.join(dir, TRACE_STORE), JSON.stringify({ version: 1, showTrace: true, updatedAt: new Date().toISOString() }));
    const both = await TestClient.start(FIXTURE, { env: HEADLESS_ENV, stateDir: dir, settings: { reuseBrowser: true } });
    try {
      await both.waitForDiscovery();
      const status = await both.status();
      expect(status[0].showBrowser).toEqual({ enabled: true, source: 'settings' });
      expect(status[0].traceViewer).toEqual({ enabled: true, source: 'remembered' });
      both.clear();
      await runAndServer(both);
      expect(logLines(both).some((m) => /^playwright: run \d+ trace recording off \(show browser is on\)$/.test(m))).toBe(true);
      expect(runCommandLine(both)).toContain('--trace off');
      expect(runCommandLine(both)).not.toContain('--trace on');
      const warning = 'Playwright: show browser is on, so runs record no trace; turn it off to use the trace viewer';
      expect(both.showMessages(MessageType.Warning).filter((m) => m === warning)).toHaveLength(1);
      expect(((await both.status())[0].traces as TracesStatus).records).toEqual([]);
      expect((await both.status())[0].traceViewers).toEqual([]);
      expect(titles(await both.codeActions(PASSING, L.adds))).not.toContain(SHOW_TRACE_TITLE);
      both.clear();
      await runAndServer(both, L.multiplies);
      expect(both.showMessages(MessageType.Warning).filter((m) => m === warning)).toEqual([]);
    } finally {
      await both.execute(TOGGLE_TRACE, [{ uri: uriOf(PASSING) }]);
      await ensureOff(both);
      await both.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
