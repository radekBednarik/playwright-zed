import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE, MessageType, PASSING, SLOW, TestClient, hasDisplay, uriOf, type TracesStatus, type ViewerSessionStatus } from './helpers';

// Feature 008 (specs/008-show-trace-viewer): the "Show trace viewer" option, trace recording,
// the trace viewer process and "Show trace" at the cursor.

const TOGGLE = 'playwright.toggleTraceViewer';
const SHOW_TRACE = 'playwright.showTrace';
const RUN_AT_CURSOR = 'playwright.runAtCursor';
const RUN_FILE = 'playwright.runFile';
const ON_TITLE = 'Playwright: [x] Show trace viewer';
const OFF_TITLE = 'Playwright: [ ] Show trace viewer';
const SHOW_TITLE = 'Playwright: Show trace';
const STORE = 'trace-viewer.json';
// 0-based lines of the fixtures
const L = { adds: 2, describeMath: 12, multiplies: 18, concatenates: 30, skipped: 38, emptyApp: 46, slow: 4 };

const titles = (actions: any[]) => actions.map((a) => a.title as string);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function runCommandLine(client: TestClient): string {
    const line = client.messages('window/logMessage').map((m) => m.params.message as string).find((m) => /^playwright: run \d+ command: /.test(m));
  if (!line) throw new Error('no run command line logged');
  // the message carries the cwd and the output on further lines
  return line.split('\n')[0].replace(/^playwright: run \d+ command: /, '');
}

async function finished(client: TestClient): Promise<void> {
  await client.waitFor('$/progress', (p) => p.value?.kind === 'end');
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function toggle(client: TestClient, file = PASSING): Promise<void> {
  await client.execute(TOGGLE, [{ uri: uriOf(file) }]);
}

/** Leaves the preference off so no viewer outlives the suite. */
async function ensureOff(client: TestClient): Promise<void> {
  const status = await client.status();
  if (status[0]?.traceViewer?.enabled) await toggle(client);
}

describe('trace viewer toggle and recording (US1)', () => {
  let client: TestClient;
  let baselineCommand: string;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE);
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
  });
  beforeEach(() => client.clear());

  it('(a) starts off, offers the toggle before the picker and no "Show trace"', async () => {
    const status = await client.status();
    expect(status[0].traceViewer).toEqual({ enabled: false, source: 'default' });
    expect(status[0].traces).toBeNull();
    expect(status[0].traceViewers).toEqual([]);
    const actions = await client.codeActions(PASSING, L.adds);
    const list = titles(actions);
    expect(list).toContain(OFF_TITLE);
    expect(list).not.toContain(SHOW_TITLE);
    expect(list.indexOf(OFF_TITLE)).toBeLessThan(list.indexOf('Playwright: [x] chromium'));
    expect(actions.find((a) => a.title === OFF_TITLE).command).toMatchObject({ command: TOGGLE, arguments: [{ uri: uriOf(PASSING) }] });
  });

  it('(b) a run with the option off carries no --trace and records no traces', async () => {
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    await finished(client);
    baselineCommand = runCommandLine(client);
    expect(baselineCommand).not.toContain('--trace');
    const status = await client.status();
    expect(status[0].traces).toEqual({ runId: expect.any(String), records: [] });
    expect(titles(await client.codeActions(PASSING, L.adds))).not.toContain(SHOW_TITLE);
  });

  it('(c) toggling on confirms, remembers and flips the title', async () => {
    await toggle(client);
    expect(client.showMessages(MessageType.Info)).toEqual(['Playwright: show trace viewer is on']);
    const stored = JSON.parse(fs.readFileSync(path.join(client.stateDir, STORE), 'utf8'));
    expect(stored).toMatchObject({ version: 1, showTrace: true });
    expect(Date.parse(stored.updatedAt)).not.toBeNaN();
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(ON_TITLE);
    expect((await client.status())[0].traceViewer).toEqual({ enabled: true, source: 'remembered' });
    expect(client.messages('window/logMessage').map((m) => m.params.message)).toContain('playwright: show trace viewer: on (remembered)');
  });

  it('(d) a single-test run with the option on records a trace and keeps its results', async () => {
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    await finished(client);
    expect(runCommandLine(client)).toBe(`${baselineCommand} --trace on`);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed, 0 failed, 0 skipped/.test(m))).toBe(true);
    const status = await client.status();
    const traces = status[0].traces as TracesStatus;
    expect(traces.records).toHaveLength(1);
    expect(traces.records[0]).toMatchObject({ file: PASSING, line: 3, title: 'adds numbers', project: 'chromium' });
    expect(traces.records[0].path).toMatch(/trace\.zip$/);
    expect(fs.existsSync(traces.records[0].path)).toBe(true);
    expect(status[0].marks.runId).toBe(traces.runId);
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(SHOW_TITLE);
  });

  it('(e) a single-test run that records no trace says so', async () => {
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.skipped }]);
    await finished(client);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning && /no trace recorded/.test(p.message));
    expect(warning.message).toBe('Playwright: no trace recorded for tests/passing.spec.ts:39 in this run');
    expect((await client.status())[0].traces.records).toEqual([]);
  });

  it('(f) toggling off restores the exact command line', async () => {
    await toggle(client);
    expect(client.showMessages(MessageType.Info)).toEqual(['Playwright: show trace viewer is off']);
    expect(JSON.parse(fs.readFileSync(path.join(client.stateDir, STORE), 'utf8')).showTrace).toBe(false);
    client.clear();
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    await finished(client);
    expect(runCommandLine(client)).toBe(baselineCommand);
    expect((await client.status())[0].traceViewers).toEqual([]);
  });
});

describe.skipIf(!hasDisplay())('the trace viewer window (US1, needs a display)', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE);
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
  });
  beforeEach(() => client.clear());

  it('(g) opens once, follows single-test runs live and final, is reused, and closes on toggle off', async () => {
    await toggle(client);
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    const session = await client.waitForStatus<ViewerSessionStatus>((s) => {
      const v = (s[0].traceViewers as ViewerSessionStatus[])[0];
      return v && v.currentPath?.endsWith('trace.zip') ? v : null;
    }, 90_000);
    expect(session.configPath).toBe(path.join(FIXTURE, 'playwright.config.ts'));
    expect(alive(session.pid)).toBe(true);
    expect(session.currentPath).toMatch(/passing-adds-numbers-chromium[\\/]trace\.zip$/);
    await finished(client);
    const log = client.messages('window/logMessage').map((m) => m.params.message as string);
    expect(log.some((m) => /^playwright: trace viewer playwright\.config\.ts started \(pid \d+\): .*show-trace --stdin$/.test(m))).toBe(true);
    // the live path alternates with the final one, which is what keeps every load distinct (research R2)
    expect(log.some((m) => /^playwright: trace viewer playwright\.config\.ts showing .*\.playwright-artifacts-\d+[\\/]traces[\\/].*\.json$/.test(m))).toBe(true);
    expect(client.showMessages(MessageType.Error)).toEqual([]);

    client.clear();
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.multiplies }]);
    const next = await client.waitForStatus<ViewerSessionStatus>((s) => {
      const v = (s[0].traceViewers as ViewerSessionStatus[])[0];
      return v && /multiplies.*trace\.zip$/.test(v.currentPath ?? '') ? v : null;
    }, 90_000);
    expect(next.pid).toBe(session.pid);
    await finished(client);

    await toggle(client);
    await client.waitForStatus((s) => ((s[0].traceViewers as unknown[]).length === 0 ? true : null), 10_000);
    const deadline = Date.now() + 10_000;
    while (alive(session.pid) && Date.now() < deadline) await sleep(200);
    expect(alive(session.pid)).toBe(false);
    expect(client.messages('window/logMessage').map((m) => m.params.message)).toContain('playwright: trace viewer playwright.config.ts closed');
  });
});

describe('show trace at the cursor (US2)', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE);
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
  });
  beforeEach(() => client.clear());

  it('(h) with the option off the action is absent and the command explains', async () => {
    expect(titles(await client.codeActions(PASSING, L.adds))).not.toContain(SHOW_TITLE);
    await client.execute(SHOW_TRACE, [{ uri: uriOf(PASSING), line: L.adds }]);
    expect(client.showMessages(MessageType.Warning)).toEqual(['Playwright: turn on "Show trace viewer" first; the last run recorded no traces']);
  });

  it('(i) after a file run the action sits on test lines only and names a test without a trace', async () => {
    await toggle(client);
    client.clear();
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    await finished(client);
    expect(runCommandLine(client)).toContain('--trace on');
    expect(client.showMessages(MessageType.Warning).filter((m) => /no trace recorded/.test(m))).toEqual([]);
    const onTest = await client.codeActions(PASSING, L.concatenates);
    expect(onTest.find((a) => a.title === SHOW_TITLE).command).toMatchObject({ command: SHOW_TRACE, arguments: [{ uri: uriOf(PASSING), line: L.concatenates }] });
    expect(titles(await client.codeActions(PASSING, L.describeMath))).not.toContain(SHOW_TITLE);
    const records = ((await client.status())[0].traces as TracesStatus).records;
    expect(records.length).toBeGreaterThanOrEqual(11);
    expect(records.find((r) => r.title === 'skipped on purpose')).toBeUndefined();
    client.clear();
    await client.execute(SHOW_TRACE, [{ uri: uriOf(PASSING), line: L.skipped }]);
    expect(client.showMessages(MessageType.Warning)).toEqual(['Playwright: no trace for skipped on purpose in the last run']);
    client.clear();
    await client.execute(SHOW_TRACE, [{ uri: uriOf(PASSING), line: L.describeMath }]);
    expect(client.showMessages(MessageType.Warning)).toEqual(['Playwright: put the cursor inside a test to show its trace']);
  });

  it.skipIf(!hasDisplay())('(j) shows the chosen test and switches in the same window', async () => {
    await client.execute(SHOW_TRACE, [{ uri: uriOf(PASSING), line: L.concatenates }]);
    const first = await client.waitForStatus<ViewerSessionStatus>((s) => {
      const v = (s[0].traceViewers as ViewerSessionStatus[])[0];
      return v && /concatenates.*trace\.zip$/.test(v.currentPath ?? '') ? v : null;
    }, 60_000);
    expect(alive(first.pid)).toBe(true);
    await client.execute(SHOW_TRACE, [{ uri: uriOf(PASSING), line: L.emptyApp }]);
    const second = await client.waitForStatus<ViewerSessionStatus>((s) => {
      const v = (s[0].traceViewers as ViewerSessionStatus[])[0];
      return v && /shows-the-empty-app.*trace\.zip$/.test(v.currentPath ?? '') ? v : null;
    }, 60_000);
    expect(second.pid).toBe(first.pid);
    expect(client.showMessages(MessageType.Warning)).toEqual([]);
    expect(client.showMessages(MessageType.Error)).toEqual([]);
  });
});

describe('persistence and settings (US3)', () => {
  const dirs: string[] = [];
  const ownDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-trace-state-'));
    dirs.push(dir);
    return dir;
  };
  afterAll(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('(k) the choice survives a server restart on the same state directory', async () => {
    const stateDir = ownDir();
    const first = await TestClient.start(FIXTURE, { stateDir });
    await first.waitForDiscovery();
    await toggle(first);
    await first.stop();
    const second = await TestClient.start(FIXTURE, { stateDir });
    await second.waitForDiscovery();
    expect((await second.status())[0].traceViewer).toEqual({ enabled: true, source: 'remembered' });
    expect(titles(await second.codeActions(PASSING, L.adds))).toContain(ON_TITLE);
    expect(second.showMessages(MessageType.Info).filter((m) => /trace viewer/.test(m))).toEqual([]);
    await toggle(second);
    await second.stop();
  });

  it('(l) a settings default turns the option on, says so once and applies to runs', async () => {
    const client = await TestClient.start(FIXTURE, { stateDir: ownDir(), settings: { showTrace: true } });
    await client.waitForDiscovery();
    expect((await client.status())[0].traceViewer).toEqual({ enabled: true, source: 'settings' });
    expect(client.showMessages(MessageType.Info).filter((m) => /trace viewer/.test(m))).toEqual(['Playwright: show trace viewer is on (from settings)']);
    expect(titles(await client.codeActions(PASSING, L.adds))).toContain(ON_TITLE);
    client.clear();
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    await finished(client);
    expect(runCommandLine(client)).toContain('--trace on');
    await client.changeSettings({ showTrace: false });
    await client.waitForStatus((s) => (s[0].traceViewer.enabled === false ? true : null), 10_000);
    expect((await client.status())[0].traceViewer).toEqual({ enabled: false, source: 'settings' });
    await client.stop();
  });

  it('(m) a remembered choice wins over the setting, invalid values warn once, no settings means default', async () => {
    const stateDir = ownDir();
    fs.writeFileSync(path.join(stateDir, STORE), JSON.stringify({ version: 1, showTrace: false, updatedAt: '2026-10-20T00:00:00.000Z' }));
    const client = await TestClient.start(FIXTURE, { stateDir, settings: { showTrace: true } });
    await client.waitForDiscovery();
    expect((await client.status())[0].traceViewer).toEqual({ enabled: false, source: 'remembered' });
    expect(client.showMessages(MessageType.Info).filter((m) => /trace viewer/.test(m))).toEqual([]);
    client.clear();
    await client.changeSettings({ showTrace: 'yes' });
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    await client.changeSettings({ showTrace: 'no' });
    await sleep(300);
    expect(client.showMessages(MessageType.Warning)).toEqual(['Playwright: setting "showTrace" must be true or false']);
    expect((await client.status())[0].traceViewer).toEqual({ enabled: false, source: 'remembered' });
    await client.changeSettings({ showTrace: true });
    await client.changeSettings({ showTrace: 1 });
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning && client.showMessages(MessageType.Warning).length === 2);
    await client.stop();

    const plain = await TestClient.start(FIXTURE, { stateDir: ownDir(), noConfiguration: true });
    await plain.waitForDiscovery();
    expect((await plain.status())[0].traceViewer).toEqual({ enabled: false, source: 'default' });
    await plain.stop();
  });
});

describe('toggles during a run (US3)', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE);
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await ensureOff(client);
    await client.stop();
  });
  beforeEach(() => client.clear());

    it('(p) turning off mid-run keeps that run tracing but leaves no viewer behind', async () => {
    await toggle(client);
    client.clear();
    // executeCommand answers only when the run ends, so the run is not awaited here
    const run = client.execute(RUN_AT_CURSOR, [{ uri: uriOf(SLOW), line: L.slow }]);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    await sleep(1500); // the test is running; its live trace may already be in the viewer
    await toggle(client);
    await run;
    await finished(client);
    expect(client.showMessages(MessageType.Info).some((m) => /^Playwright: 1 passed/.test(m))).toBe(true);
    expect(runCommandLine(client)).toContain('--trace on');
    const status = await client.status();
    expect(status[0].traceViewer.enabled).toBe(false);
        expect((status[0].traces as TracesStatus).records).toHaveLength(1);
    // the viewer that followed the test was closed by the toggle; its exit may land a moment later
    await client.waitForStatus((s) => ((s[0].traceViewers as unknown[]).length === 0 ? true : null), 10_000);
    expect(client.showMessages(MessageType.Warning).filter((m) => /no trace recorded/.test(m))).toEqual([]);
    expect(client.messages('window/logMessage').map((m) => m.params.message)).not.toContain(expect.stringMatching(/showing .*slow-slow-steps.*trace\.zip$/));
  });

    it('(q) turning on mid-run leaves that run alone and applies to the next one', async () => {
    const run = client.execute(RUN_AT_CURSOR, [{ uri: uriOf(SLOW), line: L.slow }]);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    await toggle(client);
    await run;
    await finished(client);
    expect(runCommandLine(client)).not.toContain('--trace');
    expect((await client.status())[0].traceViewers).toEqual([]);
    client.clear();
    await client.execute(RUN_FILE, [{ uri: uriOf(SLOW) }]);
    await finished(client);
    expect(runCommandLine(client)).toContain('--trace on');
  });
});
