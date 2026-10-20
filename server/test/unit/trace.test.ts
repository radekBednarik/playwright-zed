import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VIEWER_FIRST_WRITE_GRACE_MS,
  VIEWER_KILL_GRACE_MS,
  VIEWER_WRITE_GAP_MS,
  ViewerSessions,
  extractTraces,
  latestTraceFor,
  parseShowTraceSetting,
  resolveTracePreference,
  showOutcomeWarning,
  type ViewerChild,
  type ViewerHooks,
} from '../../src/trace';
import type { TraceRecord } from '../../src/types';

describe('resolveTracePreference', () => {
  it('prefers the remembered choice, then the setting, then off', () => {
    expect(resolveTracePreference({ showTrace: false, updatedAt: 't' }, true)).toEqual({ enabled: false, source: 'remembered', updatedAt: 't' });
    expect(resolveTracePreference(null, true)).toEqual({ enabled: true, source: 'settings', updatedAt: null });
    expect(resolveTracePreference(null, false)).toEqual({ enabled: false, source: 'settings', updatedAt: null });
    expect(resolveTracePreference(null, null)).toEqual({ enabled: false, source: 'default', updatedAt: null });
  });
});

describe('parseShowTraceSetting', () => {
  it('accepts booleans, treats absence as absent and anything else as invalid', () => {
    expect(parseShowTraceSetting(undefined)).toEqual({ value: null, invalid: false });
    expect(parseShowTraceSetting(null)).toEqual({ value: null, invalid: false });
    expect(parseShowTraceSetting(true)).toEqual({ value: true, invalid: false });
    expect(parseShowTraceSetting(false)).toEqual({ value: false, invalid: false });
    expect(parseShowTraceSetting('yes')).toEqual({ value: null, invalid: true });
    expect(parseShowTraceSetting(1)).toEqual({ value: null, invalid: true });
  });
});

describe('extractTraces and latestTraceFor', () => {
  const report = {
    config: { rootDir: '/r/tests', projects: [{ name: 'chromium' }, { name: 'mobile' }] },
    suites: [{ specs: [
      { title: 'adds', file: 'a.spec.ts', line: 3, column: 5, tests: [
        { projectName: 'chromium', results: [{ startTime: '2026-10-20T10:00:00.000Z', duration: 100, attachments: [{ name: 'trace', contentType: 'application/zip', path: '/r/test-results/a-chromium/trace.zip' }] }] },
        { projectName: 'mobile', results: [{ startTime: '2026-10-20T10:00:00.000Z', duration: 250, attachments: [{ name: 'screenshot', path: '/x.png' }, { name: 'trace', path: '/r/test-results/a-mobile/trace.zip' }] }] },
      ] },
      { title: 'skipped', file: 'a.spec.ts', line: 9, column: 5, tests: [{ projectName: 'chromium', results: [{ attachments: [] }] }] },
    ], suites: [{ specs: [{ title: 'nested', file: 'b.spec.ts', line: 2, column: 1, tests: [{ projectName: 'chromium', results: [{ attachments: [{ name: 'trace', path: '/r/test-results/b/trace.zip' }] }] }] }] }] }],
  };

  it('returns one record per result with a trace attachment, resolved against rootDir', () => {
    const records = extractTraces(report);
    expect(records.map((r) => [r.file, r.line, r.project, r.path])).toEqual([
      ['/r/tests/a.spec.ts', 3, 'chromium', '/r/test-results/a-chromium/trace.zip'],
      ['/r/tests/a.spec.ts', 3, 'mobile', '/r/test-results/a-mobile/trace.zip'],
      ['/r/tests/b.spec.ts', 2, 'chromium', '/r/test-results/b/trace.zip'],
    ]);
    expect(records[0].finishedAt).toBe(Date.parse('2026-10-20T10:00:00.000Z') + 100);
    expect(records[1].finishedAt).toBe(Date.parse('2026-10-20T10:00:00.000Z') + 250);
    expect(records[2].finishedAt).toBe(0);
  });

  it('drops the project name for single-project configs and tolerates empty input', () => {
    const single = { ...report, config: { rootDir: '/r/tests', projects: [{ name: 'chromium' }] } };
    expect(extractTraces(single).every((r) => r.project === null)).toBe(true);
    expect(extractTraces(null)).toEqual([]);
    expect(extractTraces({})).toEqual([]);
  });

  it('picks the record that finished last for a file and line', () => {
    const records = extractTraces(report);
    expect(latestTraceFor(records, '/r/tests/a.spec.ts', 3)?.project).toBe('mobile');
    expect(latestTraceFor(records, '/r/tests/a.spec.ts', 9)).toBeNull();
    expect(latestTraceFor(records, '/r/tests/b.spec.ts', 2)?.path).toBe('/r/test-results/b/trace.zip');
    expect(latestTraceFor([], '/r/tests/a.spec.ts', 3)).toBeNull();
  });
});

class FakeChild extends EventEmitter implements ViewerChild {
  pid = 4242;
  written: string[] = [];
  ended = false;
  signals: string[] = [];
  stdinThrows = false;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: (chunk: string) => {
      if (this.stdinThrows) throw new Error('write EPIPE');
      this.written.push(chunk);
      return true;
    },
    end: () => {
      this.ended = true;
    },
  };
  kill(signal?: NodeJS.Signals): boolean {
    this.signals.push(signal ?? 'SIGTERM');
    return true;
  }
}

function hooks(): ViewerHooks & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onStarted: (name, pid, command) => calls.push(`started ${name} ${pid} ${command}`),
    onShowing: (name, p) => calls.push(`showing ${name} ${p}`),
    onDropped: (name, p) => calls.push(`dropped ${name} ${p}`),
    onOutput: (name, line) => calls.push(`output ${name} ${line}`),
    onExit: (name, code) => calls.push(`exit ${name} ${code}`),
    onClosed: (name) => calls.push(`closed ${name}`),
    onFailure: (name, command, detail) => calls.push(`failure ${name} ${command} ${detail}`),
  };
}

const config = { configPath: '/w/playwright.config.ts', playwrightCli: '/w/node_modules/@playwright/test/cli.js' };
const temps: string[] = [];
function traceFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-trace-'));
  temps.push(dir);
  const file = path.join(dir, 'trace.zip');
  fs.writeFileSync(file, 'zip');
  return file;
}
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('ViewerSessions', () => {
  it('starts one show-trace --stdin process per config in the workspace root and writes the first path at once', () => {
    const spawned: { command: string; args: string[]; cwd: string; child: FakeChild }[] = [];
    const h = hooks();
    const sessions = new ViewerSessions(h, (command, args, options) => {
      const child = new FakeChild();
      spawned.push({ command, args, cwd: options.cwd, child });
      expect(options.env.FORCE_COLOR).toBe('0');
      expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
      return child;
    }, '/usr/bin/node');
    const zip = traceFile();
    expect(sessions.show(config, '/w', zip)).toBe('shown');
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({ command: '/usr/bin/node', args: [config.playwrightCli, 'show-trace', '--stdin'], cwd: '/w' });
    expect(spawned[0].child.written).toEqual([`${zip}\n`]);
    expect(h.calls[0]).toBe(`started playwright.config.ts 4242 /usr/bin/node ${config.playwrightCli} show-trace --stdin`);
    expect(h.calls[1]).toBe(`showing playwright.config.ts ${zip}`);
    expect(sessions.list('/w')).toEqual([expect.objectContaining({ configPath: config.configPath, pid: 4242, currentPath: zip })]);
    expect(sessions.list('/elsewhere')).toEqual([]);
  });

  it('spaces a second path behind the start grace and lets a newer request replace a waiting one', () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const h = hooks();
    const sessions = new ViewerSessions(h, () => child);
    const live = '/w/test-results/.playwright-artifacts-0/traces/abc.json';
    const zip = traceFile();
    const later = traceFile();
    expect(sessions.show(config, '/w', live)).toBe('shown');
    expect(child.written).toEqual([`${live}\n`]);
    vi.advanceTimersByTime(50);
    expect(sessions.show(config, '/w', zip)).toBe('shown');
    expect(sessions.show(config, '/w', zip)).toBe('same'); // already waiting
    expect(sessions.show(config, '/w', later)).toBe('shown'); // replaces the waiting one
    vi.advanceTimersByTime(VIEWER_FIRST_WRITE_GRACE_MS - 100);
    expect(child.written).toHaveLength(1);
    expect(sessions.list()[0].currentPath).toBe(live);
    vi.advanceTimersByTime(100);
    expect(child.written).toEqual([`${live}\n`, `${later}\n`]);
    expect(h.calls.filter((c) => c.startsWith('showing'))).toEqual([`showing playwright.config.ts ${live}`, `showing playwright.config.ts ${later}`]);
    // a running viewer: writes at least the gap apart
    expect(sessions.show(config, '/w', zip)).toBe('shown');
    expect(child.written).toHaveLength(2);
    vi.advanceTimersByTime(VIEWER_WRITE_GAP_MS);
    expect(child.written).toHaveLength(3);
    expect(sessions.show(config, '/w', zip)).toBe('same');
  });

  it('refuses a missing .zip without starting anything and drops a waiting .zip that disappeared', () => {
    vi.useFakeTimers();
    const spawn = vi.fn(() => new FakeChild());
    const h = hooks();
    const sessions = new ViewerSessions(h, spawn);
    expect(sessions.show(config, '/w', '/nope/trace.zip')).toBe('missing');
    expect(spawn).not.toHaveBeenCalled();
    const first = traceFile();
    const second = traceFile();
    expect(sessions.show(config, '/w', first)).toBe('shown');
    expect(sessions.show(config, '/w', second)).toBe('shown');
    fs.unlinkSync(second);
    vi.advanceTimersByTime(VIEWER_FIRST_WRITE_GRACE_MS);
    expect((spawn.mock.results[0].value as FakeChild).written).toEqual([`${first}\n`]);
    expect(h.calls.at(-1)).toBe(`dropped playwright.config.ts ${second}`);
  });

  it('close ends stdin, forgets a waiting path, sends SIGTERM after the grace and forgets the session on exit', () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const h = hooks();
    const sessions = new ViewerSessions(h, () => child);
    sessions.show(config, '/w', traceFile());
    sessions.show(config, '/w', traceFile());
    sessions.close(config.configPath);
    expect(child.ended).toBe(true);
    expect(child.signals).toEqual([]);
    vi.advanceTimersByTime(VIEWER_KILL_GRACE_MS);
    expect(child.written).toHaveLength(1);
    expect(child.signals).toEqual(['SIGTERM']);
    child.emit('exit', 0);
    expect(sessions.list()).toEqual([]);
    expect(h.calls.at(-2)).toBe('closed playwright.config.ts');
    expect(h.calls.at(-1)).toBe('exit playwright.config.ts 0');
  });

  it('a graceful exit on its own is forgotten and the next show starts a fresh process', () => {
    const children: FakeChild[] = [];
    const h = hooks();
    const sessions = new ViewerSessions(h, () => {
      const child = new FakeChild();
      children.push(child);
      return child;
    });
    const zip = traceFile();
    sessions.show(config, '/w', zip);
    children[0].emit('exit', 0);
    expect(sessions.list()).toEqual([]);
    expect(h.calls).toContain('exit playwright.config.ts 0');
    expect(sessions.show(config, '/w', zip)).toBe('shown');
    expect(children).toHaveLength(2);
  });

  it('reports a spawn error and a non-zero exit with the command and the first error line', () => {
    const h = hooks();
    const failing = new ViewerSessions(h, () => {
      throw new Error('spawn ENOENT');
    });
    expect(failing.show(config, '/w', traceFile())).toBe('failed');
    expect(h.calls[0]).toMatch(/^failure playwright\.config\.ts .*show-trace --stdin spawn ENOENT$/);

    const child = new FakeChild();
    const h2 = hooks();
    const sessions = new ViewerSessions(h2, () => child);
    sessions.show(config, '/w', traceFile());
    child.stderr.emit('data', Buffer.from('/x/coreBundle.js:57759\n    throw new Error(`Trace file ${traceFileOrUrl} does not exist!`);\n    ^\nError: Trace file /a does not exist!\n    at x\n'));
    child.emit('exit', 1);
    expect(h2.calls).toContain('output playwright.config.ts Error: Trace file /a does not exist!');
    expect(h2.calls.at(-1)).toMatch(/^failure playwright\.config\.ts .* Error: Trace file \/a does not exist!$/);
    expect(sessions.list()).toEqual([]);
  });

  it('closeFor closes the sessions of one workspace and closeAll with force kills at once', () => {
    const children = new Map<string, FakeChild>();
    const sessions = new ViewerSessions(hooks(), (_c, args) => {
      const child = new FakeChild();
      children.set(args[0], child);
      return child;
    });
    const other = { configPath: '/v/playwright.config.ts', playwrightCli: '/v/cli.js' };
    sessions.show(config, '/w', traceFile());
    sessions.show(other, '/v', traceFile());
    sessions.closeFor('/w');
    expect(children.get(config.playwrightCli)!.ended).toBe(true);
    expect(children.get(other.playwrightCli)!.ended).toBe(false);
    sessions.closeAll(true);
    expect(children.get(other.playwrightCli)!.ended).toBe(true);
    expect(children.get(other.playwrightCli)!.signals).toEqual(['SIGTERM']);
  });

  it('a stdin write failure is reported as a failure', () => {
    const child = new FakeChild();
    const h = hooks();
    const sessions = new ViewerSessions(h, () => child);
    child.stdinThrows = true;
    expect(sessions.show(config, '/w', traceFile())).toBe('failed');
    expect(h.calls.at(-1)).toMatch(/write EPIPE$/);
  });
});

describe('showOutcomeWarning', () => {
  it('warns only for a missing final trace, with the path, on every path that shows a trace', () => {
    expect(showOutcomeWarning('missing', '/r/test-results/a/trace.zip')).toBe('Playwright: trace file not found: /r/test-results/a/trace.zip');
    expect(showOutcomeWarning('shown', '/r/trace.zip')).toBeNull();
    expect(showOutcomeWarning('same', '/r/trace.zip')).toBeNull();
    expect(showOutcomeWarning('failed', '/r/trace.zip')).toBeNull();
  });

  it('a missing final trace on the automatic path yields the warning through the same helper', () => {
    const sessions = new ViewerSessions(hooks(), () => new FakeChild());
    const outcome = sessions.show(config, '/w', '/w/test-results/gone/trace.zip');
    expect(outcome).toBe('missing');
    expect(showOutcomeWarning(outcome, '/w/test-results/gone/trace.zip')).toMatch(/^Playwright: trace file not found: /);
  });
});

describe('TraceRecord typing', () => {
  it('matches the data model fields', () => {
    const record: TraceRecord = { file: '/a', line: 1, column: 1, title: 't', project: null, path: '/p.zip', finishedAt: 0 };
    expect(Object.keys(record).sort()).toEqual(['column', 'file', 'finishedAt', 'line', 'path', 'project', 'title']);
  });
});
