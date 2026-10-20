import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StepReporter from '../../src/step-reporter';

const VAR = 'PLAYWRIGHT_ZED_STEP_FILE';

function fakeTest(title = 'slow steps', project = 'chromium') {
  return {
    title,
    location: { file: '/w/tests/slow.spec.ts', line: 5, column: 5 },
    parent: { project: () => ({ name: project }) },
  };
}

function fakeStep(title: string, withLocation = true, file = '/w/tests/slow.spec.ts', line = 7) {
  return {
    title,
    category: 'test.step',
    duration: 2001,
    ...(withLocation ? { location: { file, line, column: 9 } } : {}),
  };
}

const result = { status: 'passed' };

describe('StepReporter', () => {
  let dir: string;
  let file: string;
  const saved = process.env[VAR];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-reporter-'));
    file = path.join(dir, 'steps.jsonl');
    process.env[VAR] = file;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[VAR];
    else process.env[VAR] = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const lines = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);

  it('writes one JSON line per test and step event with the contract fields', () => {
    const reporter = new StepReporter();
    const test = fakeTest();
    const step = fakeStep('step one');
    reporter.onTestBegin(test as never);
    reporter.onStepBegin(test as never, result as never, step as never);
    reporter.onStepEnd(test as never, result as never, step as never);
    reporter.onTestEnd(test as never, result as never);
    const events = lines();
    expect(events.map((e) => e.type)).toEqual(['testBegin', 'stepBegin', 'stepEnd', 'testEnd']);
    expect(events[0].test).toEqual({ file: '/w/tests/slow.spec.ts', line: 5, column: 5, title: 'slow steps', project: 'chromium' });
    expect(events[1].step).toEqual({ id: 1, title: 'step one', category: 'test.step', file: '/w/tests/slow.spec.ts', line: 7, column: 9 });
    expect(events[1].duration).toBeUndefined();
    expect(events[2].step.id).toBe(1);
    expect(events[2].duration).toBe(2001);
    expect(events[3].status).toBe('passed');
    for (const e of events) expect(typeof e.at).toBe('number');
  });

  it('skips steps without a location', () => {
    const reporter = new StepReporter();
    const test = fakeTest();
    const step = fakeStep('no location', false);
    reporter.onStepBegin(test as never, result as never, step as never);
    reporter.onStepEnd(test as never, result as never, step as never);
    expect(lines()).toEqual([]);
  });

  it('does not print to stdio', () => {
    expect(new StepReporter().printsToStdio()).toBe(false);
  });

  it('writes nothing and throws nothing when the variable is unset', () => {
    delete process.env[VAR];
    const reporter = new StepReporter();
    expect(() => reporter.onTestBegin(fakeTest() as never)).not.toThrow();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('disables itself silently after a write failure', () => {
    process.env[VAR] = dir; // a directory: appendFileSync fails
    const reporter = new StepReporter();
    expect(() => reporter.onTestBegin(fakeTest() as never)).not.toThrow();
    expect(() => reporter.onTestEnd(fakeTest() as never, result as never)).not.toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('numbers steps per instance and reuses the id on stepEnd, keyed by the step object', () => {
    const reporter = new StepReporter();
    const test = fakeTest();
    const a = fakeStep('a');
    const b = fakeStep('a'); // same title, different object
    reporter.onStepBegin(test as never, result as never, a as never);
    reporter.onStepBegin(test as never, result as never, b as never);
    reporter.onStepEnd(test as never, result as never, b as never);
    reporter.onStepEnd(test as never, result as never, a as never);
    const ids = lines().map((e) => [e.type, e.step.id]);
    expect(ids).toEqual([['stepBegin', 1], ['stepBegin', 2], ['stepEnd', 2], ['stepEnd', 1]]);
  });

    it('emits the predicted live trace path on testBegin and the trace attachment on testEnd (feature 008)', () => {
    const reporter = new StepReporter();
    const test = { ...fakeTest(), id: 'abc-123', parent: { project: () => ({ name: 'chromium', outputDir: '/w/test-results' }) } };
    const begun = { status: 'passed', workerIndex: 2 };
    const ended = { status: 'passed', workerIndex: 2, attachments: [{ name: 'screenshot', path: '/w/s.png' }, { name: 'trace', contentType: 'application/zip', path: '/w/test-results/slow-chromium/trace.zip' }] };
    reporter.onTestBegin(test as never, begun as never);
    reporter.onTestEnd(test as never, ended as never);
    const [begin, end] = lines();
    expect(begin.traceLive).toBe(path.join('/w/test-results', '.playwright-artifacts-2', 'traces', 'abc-123.json'));
    expect(begin.trace).toBeUndefined();
    expect(end.trace).toBe('/w/test-results/slow-chromium/trace.zip');
    expect(end.traceLive).toBeUndefined();
  });

  it('omits the trace fields when the reporter cannot build them', () => {
    const reporter = new StepReporter();
    reporter.onTestBegin(fakeTest() as never); // no id, no result
    reporter.onTestBegin({ ...fakeTest(), id: 'x' } as never, { workerIndex: -1 } as never); // skipped before a worker ran it
    reporter.onTestEnd(fakeTest() as never, { status: 'skipped', attachments: [] } as never);
    reporter.onTestEnd(fakeTest() as never, { status: 'passed' } as never);
    for (const e of lines()) {
      expect(e.traceLive).toBeUndefined();
      expect(e.trace).toBeUndefined();
    }
  });

  it('reports an empty project name when the suite has none', () => {
    const reporter = new StepReporter();
    const test = { ...fakeTest(), parent: {} };
    reporter.onTestBegin(test as never);
    expect(lines()[0].test.project).toBe('');
  });
});
