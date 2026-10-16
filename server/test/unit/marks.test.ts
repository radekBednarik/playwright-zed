import { describe, expect, it } from 'vitest';
import { LABEL_WAITING, applyEvent, clearFile, createMarks, endRun, hintsFor, startRun } from '../../src/marks';
import type { StepEvent } from '../../src/types';

const SPEC = '/w/tests/slow.spec.ts';
const HELPER = '/w/tests/helpers/steps.ts';
const testA = { file: SPEC, line: 5, column: 5, title: 'slow steps', project: 'chromium' };
const testB = { file: SPEC, line: 5, column: 5, title: 'slow steps', project: 'mobile' };

function step(id: number, line: number, file = SPEC) {
  return { id, title: `step ${id}`, category: 'test.step', file, line, column: 3 };
}
function begin(id: number, line: number, test = testA, file = SPEC): StepEvent {
  return { type: 'stepBegin', test, step: step(id, line, file), at: 1 };
}
function end(id: number, line: number, duration: number, test = testA, file = SPEC): StepEvent {
  return { type: 'stepEnd', test, step: step(id, line, file), duration, at: 2 };
}
const testEnd = (test = testA): StepEvent => ({ type: 'testEnd', test, status: 'passed', at: 3 });
const wholeRange = { start: { line: 0, character: 0 }, end: { line: 1000, character: 0 } };
const lengths = Array.from({ length: 20 }, (_, i) => 10 + i);

describe('marks store', () => {
  it('starts empty', () => {
    const m = createMarks();
    expect(m.runId).toBeNull();
    expect(m.active.size).toBe(0);
    expect(m.finished.size).toBe(0);
  });

  it('stepBegin increments active, stepEnd decrements and records the duration', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    expect(m.active.get(SPEC)?.get(7)).toBe(1);
    applyEvent(m, end(1, 7, 2001.4), '1');
    expect(m.active.has(SPEC)).toBe(false); // the file entry goes with its last line
    expect(m.finished.get(SPEC)?.get(7)).toEqual({ durationMs: 2001.4, count: 1 });
  });

  it('keeps the latest duration and counts repeats on one line', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, 100), '1');
    applyEvent(m, begin(2, 7, testB), '1');
    applyEvent(m, end(2, 7, 250, testB), '1');
    expect(m.finished.get(SPEC)?.get(7)).toEqual({ durationMs: 250, count: 2 });
  });

  it('testEnd clears the active steps of that test only', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, begin(2, 9, testB), '1');
    applyEvent(m, testEnd(testA), '1');
    expect(m.active.get(SPEC)?.has(7)).toBe(false);
    expect(m.active.get(SPEC)?.get(9)).toBe(1);
  });

  it('ignores events without a step other than testEnd and events of another run', () => {
    const m = createMarks();
    startRun(m, '2');
    applyEvent(m, { type: 'testBegin', test: testA, at: 1 }, '2');
    applyEvent(m, begin(1, 7), '1');
    expect(m.active.size).toBe(0);
    endRun(m, '1');
    applyEvent(m, begin(1, 7), '2');
    expect(m.active.get(SPEC)?.get(7)).toBe(1);
  });

  it('startRun clears both maps, endRun clears active only', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, 10), '1');
    applyEvent(m, begin(2, 9), '1');
    endRun(m, '1');
    expect(m.active.size).toBe(0);
    expect(m.finished.get(SPEC)?.get(7)).toEqual({ durationMs: 10, count: 1 });
    startRun(m, '2');
    expect(m.finished.size).toBe(0);
    expect(m.runId).toBe('2');
  });

  it('clamps a negative duration to zero', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, -448), '1');
    expect(m.finished.get(SPEC)?.get(7)).toEqual({ durationMs: 0, count: 1 });
  });

  it('clearFile removes one file and is a no-op for unknown files', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, 10), '1');
    applyEvent(m, begin(2, 4, testA, HELPER), '1');
    applyEvent(m, end(2, 4, 20, testA, HELPER), '1');
    clearFile(m, SPEC);
    clearFile(m, '/w/none.ts');
    expect(m.finished.has(SPEC)).toBe(false);
    expect(m.finished.get(HELPER)?.get(4)).toEqual({ durationMs: 20, count: 1 });
  });
});

describe('hintsFor', () => {
  it('labels active lines, finished lines and repeated lines at the line end', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, 2001.4), '1');
    applyEvent(m, begin(2, 9), '1');
    applyEvent(m, end(2, 9, 30, testA), '1');
    applyEvent(m, begin(3, 9, testB), '1');
    applyEvent(m, end(3, 9, 40, testB), '1');
    applyEvent(m, begin(4, 11), '1');
    const hints = hintsFor(m, SPEC, lengths, wholeRange);
    expect(hints).toEqual([
      { line: 6, character: lengths[6], label: '2001ms' },
      { line: 8, character: lengths[8], label: '40ms (ran 2×)' },
      { line: 10, character: lengths[10], label: LABEL_WAITING },
    ]);
  });

  it('prefers the waiting label on a line that is active and finished', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 7), '1');
    applyEvent(m, end(1, 7, 5), '1');
    applyEvent(m, begin(2, 7), '1');
    expect(hintsFor(m, SPEC, lengths, wholeRange).map((h) => h.label)).toEqual([LABEL_WAITING]);
  });

  it('respects the requested range and the document length', () => {
    const m = createMarks();
    startRun(m, '1');
    applyEvent(m, begin(1, 2), '1');
    applyEvent(m, begin(2, 7), '1');
    applyEvent(m, begin(3, 50), '1');
    const range = { start: { line: 5, character: 0 }, end: { line: 60, character: 0 } };
    expect(hintsFor(m, SPEC, lengths, range).map((h) => h.line)).toEqual([6]);
  });

  it('returns nothing for a file without marks', () => {
    expect(hintsFor(createMarks(), SPEC, lengths, wholeRange)).toEqual([]);
  });
});
