import * as path from 'node:path';
import type { Failure, PlaywrightConfig, RunCounts, RunRequest, RunResult, RunStatus } from './types';
import { reportFilePath, runPlaywright, type SpawnFn } from './spawn';
import { buildRunArgs } from './commands';

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

interface JsonResult {
  status?: string;
  error?: { message?: string; location?: { file?: string; line?: number; column?: number } };
}
interface JsonSpec {
  title: string;
  file: string;
  line: number;
  column: number;
  ok?: boolean;
  tests?: { results?: JsonResult[] }[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
interface JsonRunReport {
  config?: { rootDir?: string };
  stats?: Partial<RunCounts> & { duration?: number };
  suites?: JsonSuite[];
}

export interface ParsedRun {
  counts: RunCounts;
  failures: Failure[];
  durationMs: number | null;
}

/** Extracts counts and failures from a `--reporter=json` run report. */
export function parseRunReport(json: unknown): ParsedRun {
  const report = (json ?? {}) as JsonRunReport;
  const rootDir = report.config?.rootDir ?? '';
  const counts: RunCounts = {
    expected: report.stats?.expected ?? 0,
    unexpected: report.stats?.unexpected ?? 0,
    skipped: report.stats?.skipped ?? 0,
    flaky: report.stats?.flaky ?? 0,
  };
  const failures: Failure[] = [];

  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok !== false) continue;
      const result = (spec.tests ?? [])
        .flatMap((t) => t.results ?? [])
        .find((r) => r.error) ?? (spec.tests ?? []).flatMap((t) => t.results ?? []).at(-1);
      const rawMessage = result?.error?.message ?? 'Test failed without an error message';
      const fullMessage = stripAnsi(rawMessage).trim();
      const loc = result?.error?.location;
      failures.push({
        file: loc?.file ?? path.resolve(rootDir, spec.file),
        line: loc?.line ?? spec.line,
        column: loc?.column ?? spec.column,
        title: spec.title,
        message: fullMessage.split('\n')[0] ?? fullMessage,
        fullMessage,
      });
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  const durationMs = typeof report.stats?.duration === 'number' ? report.stats.duration : null;
  return { counts, failures, durationMs };
}

/** 0 passed, 1 with a report failed, anything else is a run error. */
export function mapExitCode(code: number | null, hasReport: boolean): Exclude<RunStatus, 'queued' | 'running' | 'cancelled'> {
  if (code === 0) return 'passed';
  if (code === 1 && hasReport) return 'failed';
  return 'error';
}

/** `3 passed, 0 failed, 1 skipped (1.2s)`; the duration is Playwright's own measurement. */
export function summarize(counts: RunCounts, durationMs: number | null = null): string {
  const base = `${counts.expected} passed, ${counts.unexpected} failed, ${counts.skipped} skipped`;
  return durationMs === null ? base : `${base} (${(durationMs / 1000).toFixed(1)}s)`;
}

export function emptyCounts(): RunCounts {
  return { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
}

interface Active {
  request: RunRequest;
  handle: ReturnType<SpawnFn>;
}

/** One running Playwright process per workspace; a new request cancels the running one. */
export class RunManager {
  private active: Active | null = null;
  private counter = 0;

  constructor(private readonly spawnFn: SpawnFn = runPlaywright) {}

  nextId(): string {
    return String(++this.counter);
  }

  get running(): RunRequest | null {
    return this.active?.request ?? null;
  }

  /** Cancels the active run, if any, and returns its request. */
  cancelActive(): RunRequest | null {
    if (!this.active) return null;
    const { request, handle } = this.active;
    handle.cancel();
    return request;
  }

  async start(request: RunRequest): Promise<RunResult> {
    this.cancelActive();
    const config: PlaywrightConfig = request.config;
    const handle = this.spawnFn({
      cli: config.playwrightCli,
      args: buildRunArgs(request.location, config, request.projects),
      cwd: config.configDir,
      env: { FORCE_COLOR: '0' },
      reportFile: reportFilePath('run', request.id),
    });
    const entry: Active = { request, handle };
    this.active = entry;
    const outcome = await handle.promise;
    if (this.active === entry) this.active = null;

    const rawOutput = `${outcome.stdout}${outcome.stderr ? `\n${outcome.stderr}` : ''}`;
    const base = { request, rawOutput, command: outcome.command, failures: [] as Failure[], counts: emptyCounts(), durationMs: null as number | null };

    if (outcome.cancelled) return { ...base, status: 'cancelled' };
    if (outcome.spawnError) return { ...base, status: 'error', errorMessage: outcome.spawnError };

    const status = mapExitCode(outcome.code, outcome.report !== null);
    if (status === 'error') {
      const detail = outcome.stderr.trim() || outcome.stdout.trim() || `exit code ${outcome.code}`;
      return { ...base, status, errorMessage: stripAnsi(detail) };
    }
    const parsed = parseRunReport(outcome.report);
    return { ...base, status, counts: parsed.counts, failures: parsed.failures, durationMs: parsed.durationMs };
  }
}
