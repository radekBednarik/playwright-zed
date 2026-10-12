import * as path from 'node:path';
import type { DiscoveredTest, PlaywrightConfig, TestLocation } from './types';

export const COMMAND_RUN_AT_CURSOR = 'playwright.runAtCursor';
export const COMMAND_RUN_FILE = 'playwright.runFile';
export const COMMAND_RERUN_LAST = 'playwright.rerunLast';
export const ALL_COMMANDS = [COMMAND_RUN_AT_CURSOR, COMMAND_RUN_FILE, COMMAND_RERUN_LAST];

/**
 * Resolves what the cursor points at (data-model "TestLocation").
 *
 * 1. A test's span starts at its title line and ends on the line before the next test or
 *    describe title line in the same file; the last test's span extends to end of file.
 *    Cursor inside a span, or on the title line, means kind `test`.
 * 2. Else, cursor exactly on a describe title line means kind `describe`.
 * 3. Else kind `file`.
 *
 * `cursorLine` is 1-based.
 */
export function resolveTestLocation(tests: DiscoveredTest[], file: string, cursorLine: number): TestLocation {
  const inFile = tests.filter((t) => t.file === file);
  const testLines = Array.from(new Set(inFile.map((t) => t.line))).sort((a, b) => a - b);
  const describeLines = new Set(inFile.flatMap((t) => t.describeLines));

  let enclosingTestLine: number | null = null;
  for (const line of testLines) {
    if (line <= cursorLine) enclosingTestLine = line;
    else break;
  }

  if (enclosingTestLine !== null) {
    // A describe title strictly between the test line and the cursor ends the test's span.
    let boundaryCrossed = false;
    for (const d of describeLines) {
      if (d > enclosingTestLine && d <= cursorLine) {
        boundaryCrossed = true;
        break;
      }
    }
    if (!boundaryCrossed) return { kind: 'test', file, line: enclosingTestLine };
  }

  if (describeLines.has(cursorLine)) return { kind: 'describe', file, line: cursorLine };
  return { kind: 'file', file, line: null };
}

/** CLI arguments for a run, per contracts/playwright-cli.md. */
export function buildRunArgs(location: TestLocation, config: PlaywrightConfig): string[] {
  let target = path.relative(config.configDir, location.file);
  if (location.kind !== 'file' && location.line !== null) target = `${target}:${location.line}`;
  return ['test', target, '-c', config.configPath, '--reporter=list,json'];
}

/** Number of discovered tests a location selects, used for progress messages. */
export function countSelectedTests(tests: DiscoveredTest[], location: TestLocation): number {
  const inFile = tests.filter((t) => t.file === location.file);
  if (location.kind === 'file') return inFile.length;
  if (location.kind === 'test') return inFile.filter((t) => t.line === location.line).length;
  return inFile.filter((t) => t.describeLines.includes(location.line as number)).length;
}
