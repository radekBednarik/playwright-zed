import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseListReport, runList } from '../../src/discovery';
import type { PlaywrightConfig } from '../../src/types';
import type { SpawnHandle, SpawnOptions } from '../../src/spawn';

const report = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/list-report.json'), 'utf8'));
const FIXTURE_ROOT = report.config.rootDir as string;

describe('parseListReport', () => {
  const parsed = parseListReport(report);

  it('reads rootDir and unique testDirs from the config block', () => {
    expect(parsed.rootDir).toBe(FIXTURE_ROOT);
    expect(parsed.testDirs).toEqual([FIXTURE_ROOT]);
  });

  it('flattens all ten fixture tests with absolute file paths', () => {
    expect(parsed.tests).toHaveLength(10);
    for (const t of parsed.tests) expect(path.isAbsolute(t.file)).toBe(true);
  });

  it('keeps 1-based lines and the describe chain', () => {
    const same = parsed.tests.filter((t) => t.title === 'same title');
    expect(same).toHaveLength(2);
    expect(same.map((t) => t.titlePath)).toEqual([
      ['math', 'same title'],
      ['strings', 'same title'],
    ]);
    expect(same[0].describeLines).toEqual([13]);
    expect(same[1].describeLines).toEqual([25]);
    expect(same[0].line).toBe(14);
  });

  it('gives top-level tests no describe lines and records projects', () => {
    const adds = parsed.tests.find((t) => t.title === 'adds numbers');
    expect(adds).toMatchObject({ line: 3, column: 5, describeLines: [], titlePath: ['adds numbers'], projects: ['chromium'] });
  });

  it('keeps loop-generated tests that share a line', () => {
    const loops = parsed.tests.filter((t) => t.title.startsWith('loop '));
    expect(loops.map((t) => t.line)).toEqual([37, 37]);
  });

  it('tolerates an empty or malformed report', () => {
    expect(parseListReport(null)).toEqual({ rootDir: '', testDirs: [], tests: [] });
    expect(parseListReport({ suites: [] }).tests).toEqual([]);
  });
});

function fakeConfig(): PlaywrightConfig {
  return {
    configPath: '/p/playwright.config.ts',
    configDir: '/p',
    playwrightCli: '/p/node_modules/@playwright/test/cli.js',
    playwrightVersion: { major: 1, minor: 64, patch: 0 },
    supported: true,
    rootDir: null,
    testDirs: [],
    tests: [],
    discoveryState: 'idle',
  };
}

function fakeSpawn(outcome: Partial<Awaited<SpawnHandle['promise']>>) {
  const calls: SpawnOptions[] = [];
  const fn = (options: SpawnOptions): SpawnHandle => {
    calls.push(options);
    return {
      promise: Promise.resolve({ code: 0, signal: null, stdout: '', stderr: '', report: null, cancelled: false, command: 'cmd', ...outcome }),
      cancel() {},
    };
  };
  return { fn, calls };
}

describe('runList', () => {
  it('invokes the CLI with --list and stores the parsed result', async () => {
    const config = fakeConfig();
    const spawn = fakeSpawn({ report });
    expect(await runList(config, spawn.fn)).toBeNull();
    expect(spawn.calls[0]).toMatchObject({
      cli: config.playwrightCli,
      args: ['test', '--list', '--reporter=json', '-c', config.configPath],
      cwd: '/p',
      env: { CI: '1' },
    });
    expect(spawn.calls[0].reportFile).toMatch(/playwright-zed-list-\d+\.json$/);
    expect(config.discoveryState).toBe('idle');
    expect(config.tests).toHaveLength(10);
    expect(config.rootDir).toBe(FIXTURE_ROOT);
    expect(config.testDirs).toEqual([FIXTURE_ROOT]);
  });

  it('records the CLI error when no report is produced', async () => {
    const config = fakeConfig();
    const spawn = fakeSpawn({ code: 1, stderr: 'Error: Cannot find module' });
    const error = await runList(config, spawn.fn);
    expect(error).toContain('Cannot find module');
    expect(error).toContain('cmd');
    expect(config.discoveryState).toBe('error');
    expect(config.tests).toEqual([]);
  });
});
