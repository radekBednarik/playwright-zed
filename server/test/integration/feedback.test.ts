import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FAILING, FIXTURE, HELPER, MessageType, PASSING, REPO_ROOT, SLOW, TestClient, uriOf } from './helpers';

const RUN_AT_CURSOR = 'playwright.runAtCursor';
const SHOW_OUTPUT = 'playwright.showLastRunOutput';
const TOGGLE = 'playwright.toggleProject';
const WAITING = '⌛ waiting…';

// 0-based lines of the fixtures
const L = { adds: 2, failing: 2, slow: 4, stepOne: 6, stepTwo: 9, stepThree: 12, helperStep: 4 };

let client: TestClient;

beforeAll(async () => {
  client = await TestClient.start(FIXTURE);
  await client.waitForDiscovery();
});
afterAll(async () => {
  await client.stop();
});
beforeEach(() => client.clear());

const runAtCursor = (file: string, line0: number) => client.execute(RUN_AT_CURSOR, [{ uri: uriOf(file), line: line0 }]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function marks() {
  const status = await client.status();
  return status[0].marks as { runId: string | null; active: { file: string; line: number; count: number }[]; finished: { file: string; line: number; durationMs: number; count: number }[] };
}

async function pollUntil<T>(probe: () => Promise<T | null>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error('timed out');
    await sleep(250);
  }
}

function outputFileOf(showDocument: { uri: string }): string {
  return fileURLToPath(showDocument.uri);
}

describe('run output in the editor (US2)', () => {
  it('(a) offers "Show last run output" and opens the log through window/showDocument', async () => {
    await runAtCursor(PASSING, L.adds);
    const actions = await client.codeActions(PASSING, L.adds);
    expect(actions.map((a) => a.title)).toContain('Playwright: Show last run output');
    await client.execute(SHOW_OUTPUT, [{ uri: uriOf(PASSING) }]);
    const request = await client.waitFor('window/showDocument');
    expect(request.takeFocus).toBe(true);
    const file = outputFileOf(request);
    expect(path.dirname(file)).toBe(path.join(client.stateDir, 'runs'));
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain('# status: passed');
    expect(text).toMatch(/^# command: .*--reporter=list,json/m);
    expect(text).toContain('adds numbers');
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toMatch(/output written to .*runs/);
  });

  it('(b) a cancelled run is replaced by the newer run and never overwrites its log', async () => {
    const first = runAtCursor(SLOW, L.slow);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    const second = runAtCursor(PASSING, L.adds);
    await Promise.all([first, second]);
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning && /cancelled/.test(p.message));
    const status = await client.status();
    const file = status[0].outputFile as string;
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain('# status: passed');
    expect(text).not.toContain('slow steps');
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toContain('superseded, output not written');
    await sleep(500);
    expect(fs.readFileSync(file, 'utf8')).toContain('# status: passed');
  });

  it('(d) a failing run writes the failure text', async () => {
    await runAtCursor(FAILING, L.failing);
    const status = await client.status();
    const text = fs.readFileSync(status[0].outputFile, 'utf8');
    expect(text).toContain('# status: failed');
    expect(text).toContain('fails on purpose');
    expect(text).toContain('toBe');
  });

  it('(e) the status reply carries the output file', async () => {
    const status = await client.status();
    expect(typeof status[0].outputFile).toBe('string');
    expect(status[0].outputFile.startsWith(client.stateDir)).toBe(true);
  });
});

describe('executing mark (US3)', () => {
  it('(a) marks the executing step line, follows the run into the helper and clears at the end', async () => {
    await client.open(SLOW);
    await client.open(HELPER);
    const pending = runAtCursor(SLOW, L.slow);
    const begin = await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    const active = await pollUntil(async () => {
      const m = await marks();
      const hit = m.active.find((a) => a.file === SLOW);
      return hit ?? null;
    });
    expect([L.stepOne, L.stepOne + 1, L.stepTwo, L.stepTwo + 1, L.stepThree, L.stepThree + 1]).toContain(active.line - 1);
    const hints = await client.inlayHints(SLOW);
    const waiting = hints.filter((h) => h.label === WAITING);
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting[0].paddingLeft).toBe(true);
    expect(waiting[0].position.line).toBe(active.line - 1);
    expect(client.requests.some((r) => r.method === 'workspace/inlayHint/refresh')).toBe(true);
    await pollUntil(async () => ((await marks()).active.some((a) => a.file === HELPER) ? true : null));
    const helperHints = await client.inlayHints(HELPER);
    expect(helperHints.some((h) => h.label === WAITING && h.position.line === L.helperStep)).toBe(true);
    await pending;
    const m = await marks();
    expect(m.runId).toBe(begin.token);
    expect(m.active).toEqual([]);
    expect((await client.inlayHints(SLOW)).filter((h) => h.label === WAITING)).toEqual([]);
    expect((await client.inlayHints(HELPER)).filter((h) => h.label === WAITING)).toEqual([]);
  });

  it('(a2) a newer run owns the marks and the cancelled run leaves no active line', async () => {
    const first = runAtCursor(SLOW, L.slow);
    await pollUntil(async () => ((await marks()).active.some((a) => a.file === SLOW) ? true : null));
    const second = runAtCursor(PASSING, L.adds);
    const begins = [] as string[];
    await Promise.all([first, second]);
    for (const m of client.messages('$/progress')) if (m.params.value?.kind === 'begin') begins.push(String(m.params.token));
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning && /cancelled/.test(p.message));
    const m = await marks();
    expect(m.runId).toBe(begins[begins.length - 1]);
    expect(m.active.filter((a) => a.file === SLOW)).toEqual([]);
    expect(m.finished.filter((a) => a.file === SLOW)).toEqual([]);
  });

  it('(b) a file without marks has no hints', async () => {
    await client.open(FAILING);
    expect(await client.inlayHints(FAILING)).toEqual([]);
  });
});

describe('durations (US4)', () => {
  it('(a) shows a duration on every step line after the run, in the spec and the helper', async () => {
    await runAtCursor(SLOW, L.slow);
    const hints = await client.inlayHints(SLOW);
    const byLine = new Map(hints.map((h) => [h.position.line, h.label as string]));
    for (const line of [L.stepOne, L.stepTwo, L.stepThree]) expect(byLine.get(line)).toMatch(/^\d+ms$/);
    // Playwright subtracts two worker wall-clock stamps; WSL2 steps its clock now and then
    // (a -2480 ms step was measured during verification), which can shorten one step, so only
    // the longest of the three two-second steps is checked.
    const longest = Math.max(...[L.stepOne, L.stepTwo, L.stepThree].map((line) => Number((byLine.get(line) as string).replace('ms', ''))));
    expect(longest).toBeGreaterThanOrEqual(1900);
    const helperHints = await client.inlayHints(HELPER);
    expect(helperHints.find((h) => h.position.line === L.helperStep)?.label).toMatch(/^\d+ms$/);
    const m = await marks();
    expect(m.active).toEqual([]);
    expect(m.finished.filter((f) => f.file === SLOW).every((f) => f.count === 1)).toBe(true);
  });

  it('(c) an edit clears the file\'s durations and leaves other files alone', async () => {
    await client.change(SLOW, 2);
    await sleep(300); // the refresh request is debounced by 100 ms
    expect(await client.inlayHints(SLOW)).toEqual([]);
    expect((await client.inlayHints(HELPER)).length).toBeGreaterThan(0);
    expect(client.requests.some((r) => r.method === 'workspace/inlayHint/refresh')).toBe(true);
  });

  it('(d) durations come back when an unedited file is reopened', async () => {
    await client.notify('textDocument/didClose', { textDocument: { uri: uriOf(HELPER) } });
    expect(await client.inlayHints(HELPER)).toEqual([]);
    await client.open(HELPER, 2);
    expect((await client.inlayHints(HELPER)).find((h) => h.position.line === L.helperStep)?.label).toMatch(/^\d+ms$/);
  });

  it('(e) a new run drops the previous durations before its first step ends', async () => {
    await client.open(SLOW, 3);
    const pending = runAtCursor(SLOW, L.slow);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    const m = await marks();
    expect(m.finished.filter((f) => f.file === HELPER)).toEqual([]);
    await pending;
    expect((await client.inlayHints(HELPER)).length).toBeGreaterThan(0);
  });

  it('(b) a test run in two projects counts the repeats', async () => {
    await client.execute(TOGGLE, [{ uri: uriOf(SLOW), project: 'mobile' }]);
    await runAtCursor(SLOW, L.slow);
    const hints = await client.inlayHints(SLOW);
    const label = hints.find((h) => h.position.line === L.stepOne)?.label as string;
    expect(label).toMatch(/^\d+ms \(ran 2×\)$/);
    expect((await marks()).finished.find((f) => f.file === SLOW && f.line === L.stepOne + 1)?.count).toBe(2);
  });
});

describe('clients without the surfaces', () => {
  it('(US2 c) no showDocument support: file written, action absent, log line present', async () => {
    const other = await TestClient.start(FIXTURE, { noShowDocument: true });
    try {
      await other.waitForDiscovery();
      await other.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
      const actions = await other.codeActions(PASSING, L.adds);
      expect(actions.map((a) => a.title)).not.toContain('Playwright: Show last run output');
      const status = await other.status();
      expect(fs.existsSync(status[0].outputFile)).toBe(true);
      const log = other.messages('window/logMessage').map((m) => m.params.message).join('\n');
      expect(log).toContain('output not offered (client has no showDocument support)');
      expect(other.showMessages(MessageType.Error)).toEqual([]);
    } finally {
      await other.stop();
    }
  });

  it('(US3 scenario 5) missing step reporter: the run passes, no marks, one log line per run', async () => {
    // A copy of dist/ without step-reporter.js, inside server/ so node_modules resolve.
    const dist = path.join(REPO_ROOT, 'server/dist');
    const copy = fs.mkdtempSync(path.join(REPO_ROOT, 'server', '.dist-nostep-'));
    for (const name of fs.readdirSync(dist)) {
      if (name.startsWith('step-reporter')) continue;
      fs.copyFileSync(path.join(dist, name), path.join(copy, name));
    }
    const other = await TestClient.start(FIXTURE, { serverEntry: path.join(copy, 'server.js') });
    try {
      await other.waitForDiscovery();
      await other.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
      const info = other.showMessages(MessageType.Info);
      expect(info.some((m) => /^Playwright: 1 passed, 0 failed, 0 skipped/.test(m))).toBe(true);
      expect(other.showMessages(MessageType.Error)).toEqual([]);
      const status = await other.status();
      expect(status[0].marks.active).toEqual([]);
      expect(status[0].marks.finished).toEqual([]);
      const log = other.messages('window/logMessage').map((m) => m.params.message);
      expect(log.some((m) => /^playwright: step reporter unavailable \(file not found\)/.test(m))).toBe(true);
      expect(log.some((m) => /^playwright: run \d+ step reporter unavailable \(file not found\)$/.test(m))).toBe(true);
      expect(log.find((m) => /^playwright: run \d+ command:/.test(m))).toMatch(/--reporter=list,json(\s|$)/);
    } finally {
      await other.stop();
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  it('(US3 c) no inlay hint support: the run ends as before, with one log line', async () => {
    const other = await TestClient.start(FIXTURE, { noInlayHints: true });
    try {
      await other.waitForDiscovery();
      await other.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
      const info = other.showMessages(MessageType.Info);
      expect(info.some((m) => /^Playwright: 1 passed, 0 failed, 0 skipped/.test(m))).toBe(true);
      expect(other.showMessages(MessageType.Error)).toEqual([]);
      const log = other.messages('window/logMessage').map((m) => m.params.message).join('\n');
      expect(log).toContain('client does not request inlay hints');
    } finally {
      await other.stop();
    }
  });
});
