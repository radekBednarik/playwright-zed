import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG, FAILING, FIXTURE, MessageType, PASSING, TestClient, uriOf } from './helpers';

const RUN_AT_CURSOR = 'playwright.runAtCursor';
const RUN_FILE = 'playwright.runFile';
const RERUN_LAST = 'playwright.rerunLast';

// 0-based lines of the fixture (1-based minus one)
const L = { adds: 2, parens: 7, mathDescribe: 12, mathSame: 13, stringsSame: 25, loop: 36, skip: 38, todomvc: 43, failing: 2, fixme: 6, failingTodomvc: 15, imports: 0 };

let client: TestClient;

/** Feature 005 appends the project picker after the run actions; projects.test.ts covers it. */
const notPicker = (title: string) => !title.startsWith('Playwright: [') && title !== 'Playwright: Select all projects';

beforeAll(async () => {
  client = await TestClient.start(FIXTURE);
  await client.waitForDiscovery();
});
afterAll(async () => {
  await client.stop();
});
beforeEach(() => client.clear());

async function runAtCursor(file: string, line0: number) {
  await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(file), line: line0 }]);
}

/** Matches `Playwright: <p> passed, <f> failed, <s> skipped (<n>s)`. */
function summary(passed: number, failed: number, skipped: number): RegExp {
  return new RegExp(`^Playwright: ${passed} passed, ${failed} failed, ${skipped} skipped \\(\\d+\\.\\ds\\)$`);
}

function diagnosticsFor(file: string) {
  return client.messages('textDocument/publishDiagnostics').filter((m) => m.params.uri === uriOf(file));
}

describe('run at cursor (US2)', () => {
  it('(a) runs a single passing test with progress and an info summary', async () => {
    await runAtCursor(PASSING, L.adds);
    const begin = await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    expect(begin.value.title).toBe('Playwright');
    expect(begin.value.message).toContain('Running 1 test(s)');
    await client.waitFor('$/progress', (p) => p.value?.kind === 'end');
    // the token is the run request id, which the log line names
    expect(typeof begin.token).toBe('string');
    const runLine = client.messages('window/logMessage').map((m) => m.params.message).find((m) => /^playwright: run \d+ \(cursor/.test(m));
    expect(runLine).toContain(`run ${begin.token} (`);
    const info = client.showMessages(MessageType.Info);
    expect(info).toHaveLength(1);
    expect(info[0]).toMatch(summary(1, 0, 0));
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toContain('tests/passing.spec.ts:3');
    expect(log).toContain('--reporter=list,json');
    // Feature 006: the step reporter is the only addition to the 0.5.1 command line.
    expect(log).toMatch(/--reporter=list,json,\S*step-reporter\.js(\s|$)/);
  });

  it('(b) reports a failing test with a diagnostic on the expect line', async () => {
    await runAtCursor(FAILING, L.failing);
    const error = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Error);
    expect(error.message).toContain('1 failed');
    expect(error.message).toContain('fails on purpose');
    expect(error.message).toContain('Expected: 3');
    const published = diagnosticsFor(FAILING).filter((m) => m.params.diagnostics.length > 0);
    expect(published).toHaveLength(1);
    const diag = published[0].params.diagnostics[0];
    expect(diag.range.start.line).toBe(3);
    expect(diag.source).toBe('playwright');
    expect(diag.message).toContain('toBe');
  });

  it('(c) runs every test inside a describe from its title line', async () => {
    await runAtCursor(PASSING, L.mathDescribe);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(2, 0, 0));
  });

  it('(d) disambiguates duplicate titles by position', async () => {
    for (const line of [L.mathSame, L.stringsSame]) {
      client.clear();
      await runAtCursor(PASSING, line);
      const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
      expect(info.message).toMatch(summary(1, 0, 0));
    }
  });

  it('(e) runs a title with regex-special characters', async () => {
    await runAtCursor(PASSING, L.parens);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(1, 0, 0));
  });

  it('(f) a newer run cancels the running one and only its results remain', async () => {
    const first = runAtCursor(FAILING, L.failing);
    await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    const second = runAtCursor(PASSING, L.adds);
    await Promise.all([first, second]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('cancelled');
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(1, 0, 0));
    expect(client.showMessages(MessageType.Error)).toEqual([]);
    expect(diagnosticsFor(FAILING).filter((m) => m.params.diagnostics.length > 0)).toEqual([]);
  });

  it('(g) runs the whole file from a line outside any test', async () => {
    await runAtCursor(PASSING, L.imports);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(11, 0, 1));
  });

  it('(h) warns about unsaved changes and still runs the saved file', async () => {
    await client.open(PASSING, 1);
    await client.change(PASSING, 2);
    await runAtCursor(PASSING, L.adds);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('unsaved changes');
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toContain('1 passed');
    await client.save(PASSING);
    await client.waitFor('workspace/codeLens/refresh');
  });

  it('(i) runs both loop-generated tests that share a line', async () => {
    await runAtCursor(PASSING, L.loop);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(2, 0, 0));
  });

  it('(j) reports a skipped test as skipped without diagnostics', async () => {
    await runAtCursor(PASSING, L.skip);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(0, 0, 1));
    expect(diagnosticsFor(PASSING).filter((m) => m.params.diagnostics.length > 0)).toEqual([]);
  });

  it('(l) reports a fixme test as skipped without diagnostics', async () => {
    await runAtCursor(FAILING, L.fixme);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(0, 0, 1));
    expect(diagnosticsFor(FAILING).filter((m) => m.params.diagnostics.length > 0)).toEqual([]);
  });

  it('(m) runs real browser tests against the TodoMVC demo from the describe line', async () => {
    await runAtCursor(PASSING, L.todomvc);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info, 120_000);
    expect(info.message).toMatch(summary(3, 0, 0));
  });

  it('(n) reports a real browser assertion failure with the received text', async () => {
    await runAtCursor(FAILING, L.failingTodomvc);
    const error = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Error, 120_000);
    expect(error.message).toContain('1 failed');
    expect(error.message).toContain('Expected: "tasks"');
    expect(error.message).toContain('Received: "todos"');
    const published = diagnosticsFor(FAILING).filter((m) => m.params.diagnostics.length > 0);
    expect(published).toHaveLength(1);
    expect(published[0].params.diagnostics[0].range.start.line).toBe(18);
  });

  it('(k) clears failure diagnostics as soon as the file is edited', async () => {
    await runAtCursor(FAILING, L.failing);
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Error);
    expect(diagnosticsFor(FAILING).some((m) => m.params.diagnostics.length > 0)).toBe(true);
    client.clear();
    await client.open(FAILING, 1);
    await client.change(FAILING, 2);
    const cleared = await client.waitFor('textDocument/publishDiagnostics', (p) => p.uri === uriOf(FAILING) && p.diagnostics.length === 0);
    expect(cleared.diagnostics).toEqual([]);
    await client.save(FAILING);
  });

  it('offers the right code actions at each position', async () => {
    const atTest = await client.codeActions(PASSING, L.adds);
    expect(atTest[0].title).toBe('Playwright: Run test at cursor');
    expect(atTest[0].command.arguments[0]).toEqual({ uri: uriOf(PASSING), line: L.adds });
    const atDescribe = await client.codeActions(PASSING, L.mathDescribe);
    expect(atDescribe[0].title).toBe('Playwright: Run describe at cursor');
    const atTop = await client.codeActions(PASSING, L.imports);
    // feature 005 appends the project picker entries after the run actions; they are tested in projects.test.ts
    expect(atTop.map((a: any) => a.title).filter(notPicker)).toEqual(['Playwright: Run file', 'Playwright: Re-run last', 'Playwright: Show last run output']);
    for (const a of [...atTest, ...atDescribe, ...atTop]) expect(a.kind).toBe('source.playwright');
  });

  it('code lenses carry 0-based lines', async () => {
    const lenses = await client.codeLenses(PASSING);
    const adds = lenses.find((l) => l.range.start.line === L.adds);
    expect(adds.command).toMatchObject({ title: '▶ Run test', command: RUN_AT_CURSOR, arguments: [{ uri: uriOf(PASSING), line: L.adds }] });
    const math = lenses.find((l) => l.range.start.line === L.mathDescribe);
    expect(math.command.title).toBe('▶ Run describe');
  });
});

describe('run file (US3)', () => {
  it('runs every test in the file', async () => {
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(11, 0, 1));
  });

  it('offers no run actions in a non-test file such as the config', async () => {
    const actions = await client.codeActions(CONFIG, 0);
    expect(actions.filter((a: any) => a.title.startsWith('Playwright: Run'))).toEqual([]);
    expect(await client.codeLenses(CONFIG)).toEqual([]);
  });

  it('explains that a non-test file is not a test file rather than claiming Playwright is missing', async () => {
    await client.execute(RUN_FILE, [{ uri: uriOf(CONFIG) }]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('playwright.config.ts is not a test file of playwright.config.ts');
    expect(warning.message).not.toContain('not found');
    expect(client.messages('$/progress')).toEqual([]);
  });
});

describe('re-run last (US4)', () => {
  it('repeats the previous selection from any document', async () => {
    await runAtCursor(PASSING, L.adds);
    await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    client.clear();
    const actions = await client.codeActions(CONFIG, 0);
    expect(actions.map((a: any) => a.title).filter(notPicker)).toEqual(['Playwright: Re-run last', 'Playwright: Show last run output']);
    await client.execute(RERUN_LAST, [{ uri: uriOf(CONFIG) }]);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(1, 0, 0));
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toContain('(rerun, test) tests/passing.spec.ts:3');
  });

  it('says so when there is nothing to re-run on a fresh server', async () => {
    const fresh = await TestClient.start(FIXTURE);
    try {
      await fresh.waitForDiscovery();
      expect((await fresh.codeActions(CONFIG, 0)).map((a: any) => a.title).filter(notPicker)).toEqual([]);
      await fresh.execute(RERUN_LAST, []);
      const info = await fresh.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
      expect(info.message).toBe('Nothing to re-run yet');
    } finally {
      await fresh.stop();
    }
  });
});
