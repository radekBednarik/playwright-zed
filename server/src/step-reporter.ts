/**
 * Playwright reporter shipped with the language server (feature 006, research R2). Playwright
 * loads it from `--reporter=list,json,<this file>` inside the user's test run and it appends
 * one JSON line per event to the file named by `PLAYWRIGHT_ZED_STEP_FILE`. It has no
 * dependency on the rest of the server and never throws into Playwright.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const STEP_FILE_VAR = 'PLAYWRIGHT_ZED_STEP_FILE';

/** Structural subsets of Playwright's reporter types, so this file needs no Playwright import. */
interface Location {
  file: string;
  line: number;
  column: number;
}
interface TestCaseLike {
  id?: string;
  title: string;
  location: Location;
  parent?: { project?: () => { name?: string; outputDir?: string } | undefined };
}
interface TestResultLike {
  status?: string;
  workerIndex?: number;
  attachments?: { name?: string; path?: string }[];
}
interface TestStepLike {
  title: string;
  category: string;
  duration: number;
  location?: Location;
}

interface StepEventLine {
  type: 'testBegin' | 'stepBegin' | 'stepEnd' | 'testEnd';
  test: { file: string; line: number; column: number; title: string; project: string };
  step?: { id: number; title: string; category: string; file: string; line: number; column: number };
  duration?: number;
  status?: string;
  /** Feature 008: predicted live trace path (`testBegin`) and final trace attachment (`testEnd`). */
  traceLive?: string;
  trace?: string;
  at: number;
}

class StepReporter {
  private readonly file: string | undefined;
  private disabled: boolean;
  private nextId = 1;
  private readonly ids = new WeakMap<object, number>();

  constructor() {
    this.file = process.env[STEP_FILE_VAR];
    this.disabled = !this.file;
  }

  printsToStdio(): boolean {
    return false;
  }

  onTestBegin(test: TestCaseLike, result?: TestResultLike): void {
    const traceLive = liveTracePath(test, result);
    this.write({ type: 'testBegin', test: testInfo(test), ...(traceLive ? { traceLive } : {}), at: Date.now() });
  }

  onStepBegin(test: TestCaseLike, _result: TestResultLike, step: TestStepLike): void {
    if (!step.location) return;
    const id = this.nextId++;
    this.ids.set(step, id);
    this.write({ type: 'stepBegin', test: testInfo(test), step: stepInfo(step, id, step.location), at: Date.now() });
  }

  onStepEnd(test: TestCaseLike, _result: TestResultLike, step: TestStepLike): void {
    if (!step.location) return;
    const id = this.ids.get(step) ?? this.nextId++;
    this.write({ type: 'stepEnd', test: testInfo(test), step: stepInfo(step, id, step.location), duration: step.duration, at: Date.now() });
  }

  onTestEnd(test: TestCaseLike, result: TestResultLike): void {
    const trace = finalTracePath(result);
    this.write({ type: 'testEnd', test: testInfo(test), status: result?.status ?? 'unknown', ...(trace ? { trace } : {}), at: Date.now() });
  }

  private write(event: StepEventLine): void {
    if (this.disabled || !this.file) return;
    try {
      fs.appendFileSync(this.file, `${JSON.stringify(event)}\n`);
    } catch {
      this.disabled = true;
    }
  }
}

function testInfo(test: TestCaseLike): StepEventLine['test'] {
  let project = '';
  try {
    project = test.parent?.project?.()?.name ?? '';
  } catch {
    project = '';
  }
  const loc = test.location ?? { file: '', line: 0, column: 0 };
  return { file: loc.file, line: loc.line, column: loc.column, title: test.title, project };
}

/**
 * Feature 008 (research R2): where Playwright writes the live trace of a running test, as
 * upstream predicts it: `<outputDir>/.playwright-artifacts-<workerIndex>/traces/<test.id>.json`.
 * Undefined when any part is unavailable; nothing on the file system is checked.
 */
function liveTracePath(test: TestCaseLike, result: TestResultLike | undefined): string | undefined {
  try {
    const outputDir = test.parent?.project?.()?.outputDir;
    const workerIndex = result?.workerIndex;
    if (typeof outputDir !== 'string' || !outputDir || typeof workerIndex !== 'number' || workerIndex < 0 || typeof test.id !== 'string' || !test.id) return undefined;
    return path.join(outputDir, `.playwright-artifacts-${workerIndex}`, 'traces', `${test.id}.json`);
  } catch {
    return undefined;
  }
}

/** Feature 008: the path of the result attachment named `trace`, when there is one. */
function finalTracePath(result: TestResultLike | undefined): string | undefined {
  const attachment = result?.attachments?.find((a) => a?.name === 'trace' && typeof a.path === 'string' && a.path !== '');
  return attachment?.path;
}

function stepInfo(step: TestStepLike, id: number, loc: Location): NonNullable<StepEventLine['step']> {
  return { id, title: step.title, category: step.category, file: loc.file, line: loc.line, column: loc.column };
}

export = StepReporter;
