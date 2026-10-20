import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RunManager, mapExitCode, parseRunReport, stripAnsi, summarize } from '../../src/runner';
import type { PlaywrightConfig, RunRequest } from '../../src/types';
import type { SpawnHandle, SpawnOptions, SpawnOutcome } from '../../src/spawn';

const load = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8'));

describe('parseRunReport', () => {
  it('reads counts and no failures from a passing report', () => {
    const parsed = parseRunReport(load('run-report-pass.json'));
    expect(parsed.counts).toEqual({ expected: 1, unexpected: 0, skipped: 0, flaky: 0 });
    expect(parsed.failures).toEqual([]);
    expect(parsed.durationMs).toBeCloseTo(445.1, 0);
  });

  it('maps a failing spec to a failure at error.location with ANSI stripped', () => {
    const parsed = parseRunReport(load('run-report-fail.json'));
    expect(parsed.counts.unexpected).toBe(1);
    expect(parsed.failures).toHaveLength(1);
    const f = parsed.failures[0];
    expect(f.title).toBe('fails on purpose');
    expect(f.file).toMatch(/failing\.spec\.ts$/);
    expect(path.isAbsolute(f.file)).toBe(true);
    expect(f.line).toBe(4);
    expect(f.column).toBe(17);
    expect(f.message).toBe('Error: expect(received).toBe(expected) // Object.is equality');
    expect(f.message).not.toMatch(/\u001b/);
    expect(f.fullMessage).toContain('Expected: 3');
    expect(f.fullMessage).toContain('Received: 2');
  });

  it('reports one failure per failing project and names it only for multi-project configs (feature 005)', () => {
    const result = (status: string, message?: string) => ({ status, ...(message ? { error: { message, location: { file: '/r/tests/a.spec.ts', line: 4, column: 17 } } } : {}) });
    const spec = (projectEntries: unknown[]) => ({ title: 'fails', file: 'tests/a.spec.ts', line: 3, column: 5, ok: false, tests: projectEntries });
    const two = {
      config: { rootDir: '/r', projects: [{ name: 'chromium' }, { name: 'mobile' }] },
      stats: { expected: 0, unexpected: 2, skipped: 0, flaky: 0, duration: 10 },
      suites: [{ specs: [spec([
        { projectName: 'chromium', status: 'unexpected', results: [result('failed', 'Error: desktop broke')] },
        { projectName: 'mobile', status: 'unexpected', results: [result('failed', 'Error: mobile broke')] },
      ])] }],
    };
    const parsed = parseRunReport(two);
    expect(parsed.failures.map((f) => [f.project, f.message])).toEqual([
      ['chromium', 'Error: desktop broke'],
      ['mobile', 'Error: mobile broke'],
    ]);

    const onlyMobileFailed = { ...two, suites: [{ specs: [spec([
      { projectName: 'chromium', status: 'expected', results: [result('passed')] },
      { projectName: 'mobile', status: 'unexpected', results: [result('failed', 'Error: mobile broke')] },
    ])] }] };
    expect(parseRunReport(onlyMobileFailed).failures.map((f) => f.project)).toEqual(['mobile']);

    const single = { ...two, config: { rootDir: '/r', projects: [{ name: 'chromium' }] }, suites: [{ specs: [spec([
      { projectName: 'chromium', status: 'unexpected', results: [result('failed', 'Error: broke')] },
    ])] }] };
    expect(parseRunReport(single).failures.map((f) => f.project)).toEqual([null]);
    expect(parseRunReport(load('run-report-fail.json')).failures[0].project).toBeNull();
  });

  it('keeps every line of a multi-line error in fullMessage', () => {
    const parsed = parseRunReport(load('run-report-no-browser.json'));
    const f = parsed.failures[0];
    expect(f.message).toMatch(/^Error: browserType\.launch: Executable doesn't exist/);
    expect(f.fullMessage).toContain('npx playwright install');
    expect(f.fullMessage.split('\n').length).toBeGreaterThan(5);
    expect(f.fullMessage).not.toMatch(/\u001b/);
    // no error.location: falls back to the spec position, resolved against rootDir
    expect(f).toMatchObject({ file: '/tmp/sample/tests/passing.spec.ts', line: 3, column: 5 });
  });

  it('tolerates empty input', () => {
    expect(parseRunReport(null)).toEqual({ counts: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 }, failures: [], durationMs: null, traces: [] });
  });

  it('extracts trace records from the attachments, one per result (feature 008)', () => {
    const attachment = (p: string) => ({ name: 'trace', contentType: 'application/zip', path: p });
    const report = {
      config: { rootDir: '/r/tests', projects: [{ name: 'chromium' }, { name: 'mobile' }] },
      stats: { expected: 2, unexpected: 0, skipped: 1, flaky: 0, duration: 10 },
      suites: [{ specs: [
        { title: 'adds', file: 'a.spec.ts', line: 3, column: 5, ok: true, tests: [
          { projectName: 'chromium', status: 'expected', results: [{ status: 'passed', startTime: '2026-10-20T10:00:00.000Z', duration: 100, attachments: [attachment('/r/test-results/a-chromium/trace.zip')] }] },
          { projectName: 'mobile', status: 'expected', results: [{ status: 'passed', startTime: '2026-10-20T10:00:00.500Z', duration: 100, attachments: [attachment('/r/test-results/a-mobile/trace.zip')] }] },
        ] },
        { title: 'skipped', file: 'a.spec.ts', line: 9, column: 5, ok: true, tests: [{ projectName: 'chromium', status: 'skipped', results: [{ status: 'skipped', attachments: [] }] }] },
      ] }],
    };
    const parsed = parseRunReport(report);
    expect(parsed.traces.map((t) => [t.title, t.project, t.path])).toEqual([
      ['adds', 'chromium', '/r/test-results/a-chromium/trace.zip'],
      ['adds', 'mobile', '/r/test-results/a-mobile/trace.zip'],
    ]);
    expect(parsed.traces[1].finishedAt).toBeGreaterThan(parsed.traces[0].finishedAt);
    expect(parseRunReport(load('run-report-pass.json')).traces).toEqual([]);
  });
});

describe('mapExitCode and helpers', () => {
  it('maps 0 to passed, 1 with report to failed, otherwise error', () => {
    expect(mapExitCode(0, true)).toBe('passed');
    expect(mapExitCode(1, true)).toBe('failed');
    expect(mapExitCode(1, false)).toBe('error');
    expect(mapExitCode(2, true)).toBe('error');
    expect(mapExitCode(null, false)).toBe('error');
  });
  it('strips ANSI and formats summaries', () => {
    expect(stripAnsi('\u001b[31mred\u001b[39m')).toBe('red');
    expect(summarize({ expected: 8, unexpected: 0, skipped: 1, flaky: 0 })).toBe('8 passed, 0 failed, 1 skipped');
    expect(summarize({ expected: 8, unexpected: 0, skipped: 1, flaky: 0 }, 1234)).toBe('8 passed, 0 failed, 1 skipped (1.2s)');
  });
});

const config = {
  configPath: '/w/playwright.config.ts',
  configDir: '/w',
  playwrightCli: '/w/node_modules/@playwright/test/cli.js',
  supported: true,
  projects: ['chromium'],
} as PlaywrightConfig;

function request(id: string): RunRequest {
  return { id, location: { kind: 'test', file: '/w/tests/a.spec.ts', line: 3 }, config, trigger: 'cursor', startedAt: new Date().toISOString(), dirty: false, projects: ['chromium'] };
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function controllableSpawn() {
  const calls: { options: SpawnOptions; resolve: (o: Partial<SpawnOutcome>) => void; cancelled: boolean }[] = [];
  const fn = (options: SpawnOptions): SpawnHandle => {
    let resolveFn!: (o: SpawnOutcome) => void;
    const promise = new Promise<SpawnOutcome>((r) => (resolveFn = r));
    const entry = {
      options,
      cancelled: false,
      resolve(o: Partial<SpawnOutcome>) {
        resolveFn({ code: 0, signal: null, stdout: '', stderr: '', report: null, cancelled: entry.cancelled, command: 'cmd', ...o });
      },
    };
    calls.push(entry);
    tempDirs.push(path.dirname(options.reportFile));
    return {
      promise,
      cancel() {
        entry.cancelled = true;
        entry.resolve({ code: null, signal: 'SIGTERM' });
      },
    };
  };
  return { fn, calls };
}

describe('RunManager', () => {
  it('spawns the CLI with run args, cwd and FORCE_COLOR=0 and parses the report', async () => {
    const spawn = controllableSpawn();
    const manager = new RunManager(spawn.fn);
    const pending = manager.start(request('1'));
    expect(spawn.calls[0].options).toMatchObject({
      cli: config.playwrightCli,
      args: ['test', 'tests/a.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json'],
      cwd: '/w',
      env: { FORCE_COLOR: '0' },
    });
    expect(spawn.calls[0].options.reportFile).toMatch(/playwright-zed-[^/\\]+[/\\]run-1\.json$/);
    spawn.calls[0].resolve({ code: 0, report: load('run-report-pass.json'), stdout: '1 passed' });
    const result = await pending;
    expect(result.status).toBe('passed');
    expect(result.counts.expected).toBe(1);
    expect(result.rawOutput).toContain('1 passed');
    expect(manager.running).toBeNull();
  });

  it('cancels the active run when a new one starts', async () => {
    const spawn = controllableSpawn();
    const manager = new RunManager(spawn.fn);
    const first = manager.start(request('1'));
    const second = manager.start(request('2'));
    expect(spawn.calls[0].cancelled).toBe(true);
    expect((await first).status).toBe('cancelled');
    spawn.calls[1].resolve({ code: 1, report: load('run-report-fail.json') });
    const result = await second;
    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
  });

  it('reports error with the command when the process cannot start or yields no report', async () => {
    const spawn = controllableSpawn();
    const manager = new RunManager(spawn.fn);
    const p1 = manager.start(request('1'));
    spawn.calls[0].resolve({ spawnError: 'spawn node ENOENT' });
    expect(await p1).toMatchObject({ status: 'error', errorMessage: 'spawn node ENOENT', command: 'cmd' });
    const p2 = manager.start(request('2'));
    spawn.calls[1].resolve({ code: 1, report: null, stderr: 'Error: No tests found' });
    expect(await p2).toMatchObject({ status: 'error', errorMessage: 'Error: No tests found' });
  });
});

describe('RunManager with a step reporter (feature 006)', () => {
  it('passes the reporter and a step file next to the report when a path is given', async () => {
    const spawn = controllableSpawn();
    const manager = new RunManager(spawn.fn);
    const onStepEvent = () => {};
    const pending = manager.start(request('1'), { reporterPath: '/abs/step-reporter.js', onStepEvent });
    const options = spawn.calls[0].options;
    expect(options.args).toEqual(['test', 'tests/a.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json,/abs/step-reporter.js']);
    expect(options.stepFile).toBe(path.join(path.dirname(options.reportFile), 'steps-1.jsonl'));
    expect(options.onStepEvent).toBe(onStepEvent);
    spawn.calls[0].resolve({ code: 0, report: load('run-report-pass.json') });
    await pending;
  });

  it('passes neither when the reporter path is null', async () => {
    const spawn = controllableSpawn();
    const manager = new RunManager(spawn.fn);
    const pending = manager.start(request('1'), { reporterPath: null, onStepEvent: () => {} });
    const options = spawn.calls[0].options;
    expect(options.args).toEqual(['test', 'tests/a.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json']);
    expect(options.stepFile).toBeUndefined();
    expect(options.onStepEvent).toBeUndefined();
    spawn.calls[0].resolve({ code: 0, report: load('run-report-pass.json') });
    await pending;
  });
});
