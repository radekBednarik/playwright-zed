import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildRunArgs, countSelectedTests, resolveStepReporterPath, resolveTestLocation } from '../../src/commands';
import type { DiscoveredTest, PlaywrightConfig } from '../../src/types';

const FILE = '/w/tests/passing.spec.ts';
const OTHER = '/w/tests/other.spec.ts';

function t(line: number, title: string, describeLines: number[] = [], file = FILE): DiscoveredTest {
  return { file, line, column: 5, title, titlePath: [...describeLines.map(String), title], describeLines, projects: ['chromium'] };
}

// Mirrors the fixture layout: tests at 3 and 8, describe at 13 with tests 14 and 19,
// describe at 25 with tests 26 and 31, loop tests at 37, skip at 39.
const tests: DiscoveredTest[] = [
  t(3, 'adds numbers'),
  t(8, 'handles'),
  t(14, 'same title', [13]),
  t(19, 'multiplies', [13]),
  t(26, 'same title', [25]),
  t(31, 'concatenates', [25]),
  t(37, 'loop 1'),
  t(37, 'loop 2'),
  t(39, 'skipped on purpose'),
  t(5, 'elsewhere', [], OTHER),
];

describe('resolveTestLocation', () => {
  it('returns the test on its title line', () => {
    expect(resolveTestLocation(tests, FILE, 3)).toEqual({ kind: 'test', file: FILE, line: 3 });
  });
  it('returns the enclosing test for a line inside its span', () => {
    expect(resolveTestLocation(tests, FILE, 5)).toEqual({ kind: 'test', file: FILE, line: 3 });
  });
  it('returns the previous test for a blank line between two tests', () => {
    expect(resolveTestLocation(tests, FILE, 7)).toEqual({ kind: 'test', file: FILE, line: 3 });
  });
  it('returns the file for the line before the first test', () => {
    expect(resolveTestLocation(tests, FILE, 1)).toEqual({ kind: 'file', file: FILE, line: null });
  });
  it('returns the last test for lines after it to end of file', () => {
    expect(resolveTestLocation(tests, FILE, 120)).toEqual({ kind: 'test', file: FILE, line: 39 });
  });
  it('returns describe on the describe title line', () => {
    expect(resolveTestLocation(tests, FILE, 13)).toEqual({ kind: 'describe', file: FILE, line: 13 });
    expect(resolveTestLocation(tests, FILE, 25)).toEqual({ kind: 'describe', file: FILE, line: 25 });
  });
  it('returns the file for a line right after a describe title but before its first test', () => {
    const spaced = [t(3, 'top'), t(22, 'inner', [20])];
    expect(resolveTestLocation(spaced, FILE, 21)).toEqual({ kind: 'file', file: FILE, line: null });
    expect(resolveTestLocation(spaced, FILE, 20)).toEqual({ kind: 'describe', file: FILE, line: 20 });
    expect(resolveTestLocation(spaced, FILE, 23)).toEqual({ kind: 'test', file: FILE, line: 22 });
  });
  it('picks the test at the cursor when titles are duplicated', () => {
    expect(resolveTestLocation(tests, FILE, 14).line).toBe(14);
    expect(resolveTestLocation(tests, FILE, 26).line).toBe(26);
  });
  it('resolves a 0-based lens line converted back to 1-based to the same test', () => {
    const lensLine = tests[2].line - 1;
    expect(resolveTestLocation(tests, FILE, lensLine + 1)).toEqual({ kind: 'test', file: FILE, line: 14 });
  });
  it('ignores tests from other files', () => {
    expect(resolveTestLocation(tests, OTHER, 6)).toEqual({ kind: 'test', file: OTHER, line: 5 });
    expect(resolveTestLocation(tests, '/w/tests/none.spec.ts', 6)).toEqual({ kind: 'file', file: '/w/tests/none.spec.ts', line: null });
  });
});

const config = {
  configPath: '/w/playwright.config.ts',
  configDir: '/w',
  playwrightCli: '/w/node_modules/@playwright/test/cli.js',
} as PlaywrightConfig;

describe('buildRunArgs', () => {
  it('uses file:line relative to configDir for tests and describes', () => {
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, config)).toEqual(['test', 'tests/passing.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json']);
    expect(buildRunArgs({ kind: 'describe', file: FILE, line: 13 }, config)[1]).toBe('tests/passing.spec.ts:13');
  });
  it('omits the line for whole-file runs', () => {
    expect(buildRunArgs({ kind: 'file', file: FILE, line: null }, config)[1]).toBe('tests/passing.spec.ts');
  });
  it('appends --project per selected project unless all are selected (feature 005)', () => {
    const two = { ...config, projects: ['chromium', 'mobile'] };
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, two, ['chromium']).slice(-2)).toEqual(['--project', 'chromium']);
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, two, ['chromium', 'mobile'])).not.toContain('--project');
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, { ...config, projects: ['chromium'] }, ['chromium'])).not.toContain('--project');
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, two, ['Mobile Safari']).slice(-2)).toEqual(['--project', 'Mobile Safari']);
  });
});

describe('countSelectedTests', () => {
  it('counts tests, describe members, loop siblings and files', () => {
    expect(countSelectedTests(tests, { kind: 'test', file: FILE, line: 3 })).toBe(1);
    expect(countSelectedTests(tests, { kind: 'test', file: FILE, line: 37 })).toBe(2);
    expect(countSelectedTests(tests, { kind: 'describe', file: FILE, line: 13 })).toBe(2);
    expect(countSelectedTests(tests, { kind: 'file', file: FILE, line: null })).toBe(9);
  });
  it('counts only specs that run in a selected project (feature 005)', () => {
    const mixed: DiscoveredTest[] = [
      { ...t(3, 'both'), projects: ['chromium', 'mobile'] },
      { ...t(8, 'desktop only'), projects: ['chromium'] },
      { ...t(14, 'mobile only', [13]), projects: ['mobile'] },
    ];
    const mobile = { projects: ['mobile'], source: 'chosen' as const, updatedAt: null };
    expect(countSelectedTests(mixed, { kind: 'file', file: FILE, line: null }, mobile)).toBe(2);
    expect(countSelectedTests(mixed, { kind: 'test', file: FILE, line: 8 }, mobile)).toBe(0);
    expect(countSelectedTests(mixed, { kind: 'describe', file: FILE, line: 13 }, mobile)).toBe(1);
    expect(countSelectedTests(mixed, { kind: 'file', file: FILE, line: null }, { projects: [''], source: 'single', updatedAt: null })).toBe(3);
  });
});

describe('buildRunArgs with a step reporter (feature 006)', () => {
  const config = { configDir: '/w', configPath: '/w/playwright.config.ts', projects: ['chromium'] } as unknown as PlaywrightConfig;
  it('appends the reporter path to the reporter list', () => {
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, config, [], '/abs/step-reporter.js')).toEqual([
      'test', 'tests/passing.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json,/abs/step-reporter.js',
    ]);
  });
  it('keeps the 0.5.1 arguments when no reporter is given', () => {
    expect(buildRunArgs({ kind: 'test', file: FILE, line: 3 }, config, [], null)).toEqual([
      'test', 'tests/passing.spec.ts:3', '-c', '/w/playwright.config.ts', '--reporter=list,json',
    ]);
  });
  it('puts the reporter before the project arguments', () => {
    const two = { ...config, projects: ['chromium', 'mobile'] } as unknown as PlaywrightConfig;
    expect(buildRunArgs({ kind: 'file', file: FILE, line: null }, two, ['mobile'], '/abs/step-reporter.js')).toEqual([
      'test', 'tests/passing.spec.ts', '-c', '/w/playwright.config.ts', '--reporter=list,json,/abs/step-reporter.js', '--project', 'mobile',
    ]);
  });
});

describe('resolveStepReporterPath', () => {
  it('returns the path when step-reporter.js exists in the directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-dist-'));
    fs.writeFileSync(path.join(dir, 'step-reporter.js'), '');
    expect(resolveStepReporterPath(dir)).toEqual({ path: path.join(dir, 'step-reporter.js'), reason: null });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('reports a missing file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-dist-'));
    expect(resolveStepReporterPath(dir)).toEqual({ path: null, reason: 'file not found' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('refuses a path with a comma', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-dist-'));
    const dir = path.join(base, 'a,b');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'step-reporter.js'), '');
    expect(resolveStepReporterPath(dir)).toEqual({ path: null, reason: 'path contains a comma' });
    fs.rmSync(base, { recursive: true, force: true });
  });
});
