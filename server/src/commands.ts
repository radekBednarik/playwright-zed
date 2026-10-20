import * as fs from 'node:fs';
import * as path from 'node:path';
import { isTestSelected, projectArgs } from './selection';
import type { DiscoveredTest, PlaywrightConfig, ProjectSelection, TestLocation } from './types';

export const COMMAND_RUN_AT_CURSOR = 'playwright.runAtCursor';
export const COMMAND_RUN_FILE = 'playwright.runFile';
export const COMMAND_RERUN_LAST = 'playwright.rerunLast';
export const COMMAND_ENABLE_DISCOVERY = 'playwright.enableDiscovery';
export const COMMAND_TOGGLE_PROJECT = 'playwright.toggleProject';
export const COMMAND_SELECT_ALL_PROJECTS = 'playwright.selectAllProjects';
export const COMMAND_SHOW_LAST_RUN_OUTPUT = 'playwright.showLastRunOutput';
export const COMMAND_TOGGLE_TRACE_VIEWER = 'playwright.toggleTraceViewer';
export const COMMAND_SHOW_TRACE = 'playwright.showTrace';
export const ALL_COMMANDS = [
  COMMAND_RUN_AT_CURSOR,
  COMMAND_RUN_FILE,
  COMMAND_RERUN_LAST,
  COMMAND_ENABLE_DISCOVERY,
  COMMAND_TOGGLE_PROJECT,
  COMMAND_SELECT_ALL_PROJECTS,
    COMMAND_SHOW_LAST_RUN_OUTPUT,
  COMMAND_TOGGLE_TRACE_VIEWER,
  COMMAND_SHOW_TRACE,
];

export const STEP_REPORTER_FILE = 'step-reporter.js';

/**
 * Feature 006 (research R2): the step reporter next to the built server files. Playwright splits
 * `--reporter` on commas, so a path with a comma cannot be passed and the run goes without
 * step events.
 */
export function resolveStepReporterPath(dir: string = __dirname): { path: string | null; reason: string | null } {
  const file = path.join(dir, STEP_REPORTER_FILE);
  if (file.includes(',')) return { path: null, reason: 'path contains a comma' };
  if (!fs.existsSync(file)) return { path: null, reason: 'file not found' };
  return { path: file, reason: null };
}

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

/**
 * CLI arguments for a run, per contracts/playwright-cli.md and feature 005's
 * contracts/project-selection.md: `--project <name>` per selected project unless every
 * project of the config is selected. Feature 008: `--trace on` when the trace viewer is on.
 */
export function buildRunArgs(location: TestLocation, config: PlaywrightConfig, projects: string[] = [], reporterPath: string | null = null, trace = false): string[] {
  let target = path.relative(config.configDir, location.file);
  if (location.kind !== 'file' && location.line !== null) target = `${target}:${location.line}`;
  const reporters = reporterPath ? `list,json,${reporterPath}` : 'list,json';
  return ['test', target, '-c', config.configPath, `--reporter=${reporters}`, ...projectArgs(projects, config.projects ?? []), ...(trace ? ['--trace', 'on'] : [])];
}

/**
 * Number of discovered specs a location selects, used for progress messages. With a selection,
 * only specs that run in at least one selected project count; the count never multiplies by
 * the number of projects.
 */
export function countSelectedTests(tests: DiscoveredTest[], location: TestLocation, selection?: ProjectSelection): number {
  const inFile = tests.filter((t) => t.file === location.file && (!selection || isTestSelected(t, selection)));
  if (location.kind === 'file') return inFile.length;
  if (location.kind === 'test') return inFile.filter((t) => t.line === location.line).length;
  return inFile.filter((t) => t.describeLines.includes(location.line as number)).length;
}
