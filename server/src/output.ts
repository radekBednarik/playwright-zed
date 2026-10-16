import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stateDir } from './store';
import type { RunRequest, RunResult } from './types';

/** Feature 006 (research R4): the run log is cut here; the language server log keeps everything. */
export const OUTPUT_CAP_BYTES = 10 * 1024 * 1024;
export const RUNS_SUBDIR = 'runs';

/** `<stateDir>/runs/<first 16 hex of sha1(rootPath)>.log`: one file per workspace, latest run only. */
export function outputFilePath(dir: string, rootPath: string): string {
  const key = crypto.createHash('sha1').update(rootPath).digest('hex').slice(0, 16);
  return path.join(dir, RUNS_SUBDIR, `${key}.log`);
}

export function runLogFor(rootPath: string): string {
  return outputFilePath(stateDir(), rootPath);
}

/**
 * The log text per contracts/run-feedback.md section 6: a header, then stdout and stderr as
 * captured. With `result` null the header says `running` and the body is empty.
 */
export function formatRunLog(request: RunRequest, result: RunResult | null, finishedAt: string | null): string {
  const config = request.config;
  const displayFile = path.relative(config.configDir, request.location.file);
  const target = request.location.line === null ? displayFile : `${displayFile}:${request.location.line}`;
  const lines = [
    `# Playwright run ${request.id} (${request.trigger}, ${target})`,
    `# projects: ${request.projects.length > 0 ? request.projects.join(', ') : '-'}`,
    `# command: ${result?.command ?? '-'}`,
    `# cwd: ${config.configDir}`,
    `# status: ${result?.status ?? 'running'}`,
    `# started: ${request.startedAt}   finished: ${finishedAt ?? '-'}`,
  ];
  if (result?.errorMessage) lines.push(`# error: ${result.errorMessage.split('\n')[0]}`);
  let text = `${lines.join('\n')}\n\n`;
  if (!result) return text;
  let body = result.rawOutput;
  let truncated = false;
  if (Buffer.byteLength(body) > OUTPUT_CAP_BYTES) {
    body = Buffer.from(body).subarray(0, OUTPUT_CAP_BYTES).toString('utf8');
    truncated = true;
  }
  text += body;
  if (!text.endsWith('\n')) text += '\n';
  if (truncated) text += '[output truncated]\n';
  return text;
}

/** Creates `runs/` (0700), writes to a temp file (0600) and renames over the target. */
export function writeRunLog(file: string, text: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, text, { mode: 0o600 });
  fs.renameSync(temp, file);
}
