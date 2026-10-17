import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pollStepFile, stepFilePath } from '../../src/spawn';
import type { StepEvent } from '../../src/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function event(type: StepEvent['type'], extra: Partial<StepEvent> = {}): StepEvent {
  return { type, test: { file: '/w/t.spec.ts', line: 1, column: 1, title: 't', project: '' }, at: 1, ...extra };
}

describe('pollStepFile', () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-poll-'));
    file = path.join(dir, 'steps.jsonl');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('delivers appended lines in order as parsed events', async () => {
    const seen: StepEvent[] = [];
    const poller = pollStepFile(file, (e) => seen.push(e), 20);
    fs.appendFileSync(file, `${JSON.stringify(event('testBegin'))}\n`);
    await sleep(60);
    fs.appendFileSync(file, `${JSON.stringify(event('stepBegin'))}\n${JSON.stringify(event('stepEnd', { duration: 5 }))}\n`);
    await sleep(60);
    poller.stop();
    expect(seen.map((e) => e.type)).toEqual(['testBegin', 'stepBegin', 'stepEnd']);
    expect(seen[2].duration).toBe(5);
  });

  it('holds a partial trailing line until it is completed', async () => {
    const seen: StepEvent[] = [];
    const poller = pollStepFile(file, (e) => seen.push(e), 20);
    const text = JSON.stringify(event('testEnd', { status: 'passed' }));
    fs.appendFileSync(file, text.slice(0, 10));
    await sleep(60);
    expect(seen).toEqual([]);
    fs.appendFileSync(file, `${text.slice(10)}\n`);
    await sleep(60);
    poller.stop();
    expect(seen.map((e) => e.type)).toEqual(['testEnd']);
  });

  it('skips malformed lines', async () => {
    const seen: StepEvent[] = [];
    const poller = pollStepFile(file, (e) => seen.push(e), 20);
    fs.appendFileSync(file, `not json\n${JSON.stringify(event('testBegin'))}\n{"type":\n`);
    await sleep(60);
    poller.stop();
    expect(seen.map((e) => e.type)).toEqual(['testBegin']);
  });

  it('performs a final read on stop and then stays silent', async () => {
    const seen: StepEvent[] = [];
    const poller = pollStepFile(file, (e) => seen.push(e), 1000);
    fs.appendFileSync(file, `${JSON.stringify(event('testBegin'))}\n`);
    poller.stop();
    expect(seen.map((e) => e.type)).toEqual(['testBegin']);
    fs.appendFileSync(file, `${JSON.stringify(event('testEnd'))}\n`);
    await sleep(40);
    expect(seen).toHaveLength(1);
  });

  it('yields nothing and no error for a missing file', async () => {
    const seen: StepEvent[] = [];
    const poller = pollStepFile(path.join(dir, 'missing.jsonl'), (e) => seen.push(e), 20);
    await sleep(50);
    expect(() => poller.stop()).not.toThrow();
    expect(seen).toEqual([]);
  });
});

describe('stepFilePath', () => {
  it('lives next to the JSON report', () => {
    expect(stepFilePath('/tmp/playwright-zed-abc/run-7.json', '7')).toBe(path.join('/tmp/playwright-zed-abc', 'steps-7.jsonl'));
  });
});
