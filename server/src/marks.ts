import type { StepEvent, StepMarks } from './types';

/** Label of a line whose step is executing (upstream: "waiting…" after-text). */
export const LABEL_WAITING = '⌛ waiting…';

export interface HintSpec {
  /** 0-based line. */
  line: number;
  /** Character offset of the line end. */
  character: number;
  label: string;
}

interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export function createMarks(): StepMarks {
  return { runId: null, active: new Map(), finished: new Map(), activeSteps: new Map() };
}

/** A new run drops every mark of the previous one (data-model.md "run start"). */
export function startRun(marks: StepMarks, runId: string): void {
  marks.runId = runId;
  marks.active.clear();
  marks.finished.clear();
  marks.activeSteps.clear();
}

/** Run end, error or cancel: executing marks go, durations stay. Ignored for a superseded run. */
export function endRun(marks: StepMarks, runId: string): void {
  if (marks.runId !== runId) return;
  marks.active.clear();
  marks.activeSteps.clear();
}

function testKey(test: StepEvent['test']): string {
  return `${test.file}:${test.line}:${test.title}:${test.project}`;
}

function increment(marks: StepMarks, file: string, line: number): void {
  const lines = marks.active.get(file) ?? new Map<number, number>();
  lines.set(line, (lines.get(line) ?? 0) + 1);
  marks.active.set(file, lines);
}

function decrement(marks: StepMarks, file: string, line: number): void {
  const lines = marks.active.get(file);
  if (!lines) return;
  const count = (lines.get(line) ?? 0) - 1;
  if (count > 0) lines.set(line, count);
  else lines.delete(line);
  if (lines.size === 0) marks.active.delete(file);
}

/** Applies one reporter event (data-model.md rules); events of another run are ignored. */
export function applyEvent(marks: StepMarks, event: StepEvent, runId: string): void {
  if (marks.runId !== runId) return;
  if (event.type === 'testEnd') {
    const key = testKey(event.test);
    for (const [id, owner] of marks.activeSteps) {
      if (owner.test !== key) continue;
      decrement(marks, owner.file, owner.line);
      marks.activeSteps.delete(id);
    }
    return;
  }
  const step = event.step;
  if (!step) return;
  if (event.type === 'stepBegin') {
    increment(marks, step.file, step.line);
    marks.activeSteps.set(step.id, { test: testKey(event.test), file: step.file, line: step.line });
    return;
  }
  if (event.type === 'stepEnd') {
    if (marks.activeSteps.delete(step.id)) decrement(marks, step.file, step.line);
    const lines = marks.finished.get(step.file) ?? new Map();
    const previous = lines.get(step.line);
    // Playwright stamps begin and end with the worker's wall clock; a clock correction between
    // the two (seen on WSL2) yields a negative duration, shown as 0ms rather than nonsense.
    lines.set(step.line, { durationMs: Math.max(0, event.duration ?? 0), count: (previous?.count ?? 0) + 1 });
    marks.finished.set(step.file, lines);
  }
}

/** First edit of a file: its lines may have moved, so its marks go (data-model.md "didChange"). */
export function clearFile(marks: StepMarks, file: string): void {
  marks.active.delete(file);
  marks.finished.delete(file);
  for (const [id, owner] of marks.activeSteps) {
    if (owner.file === file) marks.activeSteps.delete(id);
  }
}

export function durationLabel(durationMs: number, count: number): string {
  const base = `${Math.round(durationMs)}ms`;
  return count > 1 ? `${base} (ran ${count}×)` : base;
}

/**
 * Inlay hint positions and labels for one document: one hint per marked line inside `range`,
 * at the line end; an executing line shows the waiting label even when it also finished.
 */
export function hintsFor(marks: StepMarks, file: string, lineLengths: number[], range: LspRange): HintSpec[] {
  const active = marks.active.get(file);
  const finished = marks.finished.get(file);
  if (!active && !finished) return [];
  const lines = new Set<number>([...(active?.keys() ?? []), ...(finished?.keys() ?? [])]);
  const hints: HintSpec[] = [];
  for (const line of Array.from(lines).sort((a, b) => a - b)) {
    const line0 = line - 1;
    if (line0 < range.start.line || line0 > range.end.line) continue;
    if (line0 < 0 || line0 >= lineLengths.length) continue;
    const mark = finished?.get(line);
    const label = active?.has(line) ? LABEL_WAITING : mark ? durationLabel(mark.durationMs, mark.count) : null;
    if (label === null) continue;
    hints.push({ line: line0, character: lineLengths[line0], label });
  }
  return hints;
}
