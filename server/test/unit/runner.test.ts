import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RunManager, mapExitCode, parseRunReport, stripAnsi, summarize } from '../../src/runner';
import type { PlaywrightConfig, RunRequest } from '../../src/types';
import type { SpawnHandle, SpawnOptions, SpawnOutcome } from '../../src/spawn';

const load = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf8'));

describe('parseRunReport', () => {
  it('reads counts and no failures from a passing report', () => {
    const parsed = parseRunReport(load('run-report-pass.json'));
    expect(parsed.counts).toEqual({ expected: 1, unexpected: 0, skipped: 0, flaky: 0 });
    expect(parsed.failures).toEqual([]);
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
    expect(parseRunReport(null)).toEqual({ counts: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 }, failures: [] });
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
  });
});

const config = {
  configPath: '/w/playwright.config.ts',
  configDir: '/w',
  playwrightCli: '/w/node_modules/@playwright/test/cli.js',
  supported: true,
} as PlaywrightConfig;

function request(id: string): RunRequest {
  return { id, location: { kind: 'test', file: '/w/tests/a.spec.ts', line: 3 }, config, trigger: 'cursor', startedAt: new Date().toISOString(), dirty: false };
}

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
    expect(spawn.calls[0].options.reportFile).toMatch(/playwright-zed-run-1\.json$/);
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
