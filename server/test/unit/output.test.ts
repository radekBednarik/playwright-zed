import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OUTPUT_CAP_BYTES, formatRunLog, outputFilePath, writeRunLog } from '../../src/output';
import type { PlaywrightConfig, RunRequest, RunResult } from '../../src/types';

const config = { configPath: '/w/playwright.config.ts', configDir: '/w', projects: ['chromium', 'mobile'] } as unknown as PlaywrightConfig;
const request: RunRequest = {
  id: '3',
  location: { kind: 'test', file: '/w/tests/slow.spec.ts', line: 5 },
  config,
  trigger: 'cursor',
  startedAt: '2026-10-16T10:00:00.000Z',
  dirty: false,
  projects: ['chromium', 'mobile'],
};
function result(over: Partial<RunResult> = {}): RunResult {
  return {
    request,
    status: 'passed',
    counts: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
    failures: [],
    rawOutput: 'Running 1 test\n  ok 1 slow steps\n',
    command: 'node cli.js test tests/slow.spec.ts:5 -c /w/playwright.config.ts --reporter=list,json',
    durationMs: 6700,
    ...over,
  };
}

describe('outputFilePath', () => {
  it('hashes the workspace root into runs/<16 hex>.log', () => {
    const key = crypto.createHash('sha1').update('/w').digest('hex').slice(0, 16);
    expect(outputFilePath('/state', '/w')).toBe(path.join('/state', 'runs', `${key}.log`));
    expect(outputFilePath('/state', '/other')).not.toBe(outputFilePath('/state', '/w'));
  });
});

describe('formatRunLog', () => {
  it('writes the running header before the run', () => {
    const text = formatRunLog(request, null, null);
    expect(text.split('\n').slice(0, 6)).toEqual([
      '# Playwright run 3 (cursor, tests/slow.spec.ts:5)',
      '# projects: chromium, mobile',
      '# command: -',
      '# cwd: /w',
      '# status: running',
      '# started: 2026-10-16T10:00:00.000Z   finished: -',
    ]);
    expect(text.endsWith('\n\n')).toBe(true);
  });

  it('writes the final header, stdout and stderr after the run', () => {
    const text = formatRunLog(request, result({ rawOutput: 'out line\n\nerr line' }), '2026-10-16T10:00:07.000Z');
    expect(text).toContain('# status: passed');
    expect(text).toContain('# command: node cli.js test tests/slow.spec.ts:5 -c /w/playwright.config.ts --reporter=list,json');
    expect(text).toContain('# started: 2026-10-16T10:00:00.000Z   finished: 2026-10-16T10:00:07.000Z');
    expect(text.endsWith('\n\nout line\n\nerr line\n')).toBe(true);
  });

  it('names a run that failed to start', () => {
    const text = formatRunLog(request, result({ status: 'error', errorMessage: 'spawn ENOENT', rawOutput: '' }), '2026-10-16T10:00:01.000Z');
    expect(text).toContain('# status: error');
    expect(text).toContain('# error: spawn ENOENT');
  });

  it('cuts the body at the cap and says so', () => {
    const body = 'x'.repeat(OUTPUT_CAP_BYTES + 100);
    const text = formatRunLog(request, result({ rawOutput: body }), '2026-10-16T10:00:07.000Z');
    expect(text.endsWith('\n[output truncated]\n')).toBe(true);
    expect(Buffer.byteLength(text)).toBeLessThan(OUTPUT_CAP_BYTES + 1000);
  });
});

describe('writeRunLog', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-output-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('creates the runs directory, writes atomically with owner-only modes and overwrites', () => {
    const file = outputFilePath(dir, '/w');
    writeRunLog(file, 'first\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('first\n');
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
    writeRunLog(file, 'second\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('second\n');
    expect(fs.readdirSync(path.dirname(file))).toEqual([path.basename(file)]);
  });
});
