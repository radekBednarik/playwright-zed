import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface SpawnOptions {
  /** Node binary; defaults to the one running this server. */
  node?: string;
  cli: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  /** Where Playwright's JSON reporter writes; read and deleted after exit. */
  reportFile: string;
}

export interface SpawnOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  report: unknown | null;
  cancelled: boolean;
  /** Human-readable command line for logs and error messages. */
  command: string;
  /** Set when the process could not be started. */
  spawnError?: string;
}

export interface SpawnHandle {
  promise: Promise<SpawnOutcome>;
  cancel(): void;
}

export const KILL_GRACE_MS = 5000;

/** Injectable spawner so unit tests can replace the real child process. */
export type SpawnFn = (options: SpawnOptions) => SpawnHandle;

/**
 * Allocates the JSON report path inside a fresh, owner-only temp directory so another user on
 * a shared machine cannot pre-plant a symlink or a crafted report at a predictable path.
 * The whole directory is removed after the run by `runPlaywright`.
 */
export function reportFilePath(prefix: string, id: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-zed-'));
  fs.chmodSync(dir, 0o700);
  return path.join(dir, `${prefix}-${id}.json`);
}

function readReport(file: string): unknown | null {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function removeReportDir(file: string): void {
  try {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function quote(arg: string): string {
  return /[\s"']/.test(arg) ? JSON.stringify(arg) : arg;
}

/** Runs the Playwright CLI as a child process with cancellation and JSON report capture. */
export function runPlaywright(options: SpawnOptions): SpawnHandle {
  const node = options.node ?? process.execPath;
  const argv = [options.cli, ...options.args];
  const command = [node, ...argv].map(quote).join(' ');
  const env = { ...process.env, ...(options.env ?? {}), PLAYWRIGHT_JSON_OUTPUT_FILE: options.reportFile };

  let cancelled = false;
  let killTimer: NodeJS.Timeout | null = null;
  const child = spawn(node, argv, {
    cwd: options.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));

  const signalGroup = (signal: NodeJS.Signals) => {
    if (child.pid === undefined) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      // already gone
    }
  };

  const promise = new Promise<SpawnOutcome>((resolve) => {
    let spawnError: string | undefined;
    child.on('error', (error) => {
      spawnError = error.message;
    });
    child.on('close', (code, signal) => {
      if (killTimer) clearTimeout(killTimer);
      const report = readReport(options.reportFile);
      removeReportDir(options.reportFile);
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        report,
        cancelled,
        command,
        spawnError,
      });
    });
  });

  return {
    promise,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      signalGroup('SIGTERM');
      killTimer = setTimeout(() => signalGroup('SIGKILL'), KILL_GRACE_MS);
    },
  };
}
