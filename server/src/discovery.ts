import * as path from 'node:path';
import type { DiscoveredTest, PlaywrightConfig } from './types';
import { reportFilePath, runPlaywright, type SpawnFn } from './spawn';
export type { SpawnFn } from './spawn';

export interface ListReport {
  rootDir: string;
  testDirs: string[];
  /** Project names in config order (feature 005); Playwright's unnamed project is `''`. */
  projects: string[];
  tests: DiscoveredTest[];
}

interface JsonSuite {
  title: string;
  file: string;
  line: number;
  column: number;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

interface JsonSpec {
  title: string;
  file: string;
  line: number;
  column: number;
  tests?: { projectName?: string }[];
}

interface JsonReport {
  config?: { rootDir?: string; projects?: { name?: string; testDir?: string }[] };
  suites?: JsonSuite[];
}

/**
 * Flattens Playwright's `--list --reporter=json` output into discovered tests. The reporter
 * emits one spec entry per project for the same test (feature 005), so entries that share
 * file, position and title path are merged into one DiscoveredTest with the union of their
 * project names.
 */
export function parseListReport(json: unknown): ListReport {
  const report = (json ?? {}) as JsonReport;
  const rootDir = report.config?.rootDir ?? '';
  const testDirs = Array.from(
    new Set((report.config?.projects ?? []).map((p) => p.testDir).filter((d): d is string => !!d)),
  );
  const projects = (report.config?.projects ?? []).map((p) => p.name ?? '');
  const tests: DiscoveredTest[] = [];
  const byKey = new Map<string, DiscoveredTest>();

  const walk = (suite: JsonSuite, describeTitles: string[], describeLines: number[]) => {
    const isDescribe = suite.line > 0;
    const titles = isDescribe ? [...describeTitles, suite.title] : describeTitles;
    const lines = isDescribe ? [...describeLines, suite.line] : describeLines;
    for (const spec of suite.specs ?? []) {
      const file = path.resolve(rootDir, spec.file);
      const titlePath = [...titles, spec.title];
      const specProjects = (spec.tests ?? []).map((t) => t.projectName ?? '').filter((n) => n !== '');
      const key = [file, spec.line, spec.column, ...titlePath].join('\u0000');
      const existing = byKey.get(key);
      if (existing) {
        for (const name of specProjects) if (!existing.projects.includes(name)) existing.projects.push(name);
        continue;
      }
      const test: DiscoveredTest = { file, line: spec.line, column: spec.column, title: spec.title, titlePath, describeLines: lines, projects: specProjects };
      byKey.set(key, test);
      tests.push(test);
    }
    for (const child of suite.suites ?? []) walk(child, titles, lines);
  };
  for (const suite of report.suites ?? []) walk(suite, [], []);

  tests.sort((a, b) => (a.file === b.file ? a.line - b.line || a.column - b.column : a.file.localeCompare(b.file)));
  return { rootDir, testDirs, projects, tests };
}

let listCounter = 0;

/** Runs discovery for one config and stores the result on it. Returns the CLI error text, if any. */
export async function runList(config: PlaywrightConfig, spawnFn: SpawnFn = runPlaywright): Promise<string | null> {
  config.discoveryState = 'running';
  config.discoveryError = undefined;
  const id = String(++listCounter);
  const handle = spawnFn({
    cli: config.playwrightCli,
    args: ['test', '--list', '--reporter=json', '-c', config.configPath],
    cwd: config.configDir,
    env: { CI: '1' },
    reportFile: reportFilePath('list', id),
  });
  const outcome = await handle.promise;
  if (outcome.spawnError || outcome.report === null) {
    const detail = outcome.spawnError ?? (outcome.stderr.trim() || outcome.stdout.trim() || `exit code ${outcome.code}`);
    config.discoveryState = 'error';
    config.discoveryError = `${outcome.command}\n${detail}`;
    return config.discoveryError;
  }
  const parsed = parseListReport(outcome.report);
  config.rootDir = parsed.rootDir;
  config.testDirs = parsed.testDirs;
  config.projects = parsed.projects;
  config.tests = parsed.tests;
  config.discoveryState = 'idle';
  return null;
}
