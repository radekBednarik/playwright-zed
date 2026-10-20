/**
 * Feature 008: the "Show trace viewer" preference, the traces of a run and the trace viewer
 * sessions (specs/008-show-trace-viewer/data-model.md, research R1 to R3).
 */
import { spawn as nodeSpawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlaywrightConfig, TracePreference, TraceRecord } from './types';

// ---------------------------------------------------------------------------
// Preference
// ---------------------------------------------------------------------------

export interface StoredTracePreference {
  showTrace: boolean;
  updatedAt: string;
}

/** Remembered choice, else the boolean setting, else off (data-model "Resolution"). */
export function resolveTracePreference(remembered: StoredTracePreference | null, settingsValue: boolean | null): TracePreference {
  if (remembered) return { enabled: remembered.showTrace, source: 'remembered', updatedAt: remembered.updatedAt };
  if (settingsValue !== null) return { enabled: settingsValue, source: 'settings', updatedAt: null };
  return { enabled: false, source: 'default', updatedAt: null };
}

export interface ShowTraceSetting {
  /** The boolean, or null when absent or invalid. */
  value: boolean | null;
  /** True when a value was present but not `true` or `false`. */
  invalid: boolean;
}

/** Validates the `showTrace` setting value (data-model "Settings value"). */
export function parseShowTraceSetting(value: unknown): ShowTraceSetting {
  if (value === undefined || value === null) return { value: null, invalid: false };
  if (typeof value === 'boolean') return { value, invalid: false };
  return { value: null, invalid: true };
}

// ---------------------------------------------------------------------------
// Trace records from the JSON report
// ---------------------------------------------------------------------------

interface JsonAttachment {
  name?: string;
  path?: string;
}
interface JsonResult {
  startTime?: string;
  duration?: number;
  attachments?: JsonAttachment[];
}
interface JsonSpec {
  title: string;
  file: string;
  line: number;
  column: number;
  tests?: { projectName?: string; results?: JsonResult[] }[];
}
interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
interface JsonReport {
  config?: { rootDir?: string; projects?: { name?: string }[] };
  suites?: JsonSuite[];
}

/**
 * One record per result that carries an attachment named `trace` with a path. `finishedAt`
 * is the result's `startTime` plus `duration` (0 when the report lacks them), the ordering
 * key for "latest". `project` is kept only when the config defines two or more projects,
 * the same rule as `Failure.project`.
 */
export function extractTraces(json: unknown): TraceRecord[] {
  const report = (json ?? {}) as JsonReport;
  const rootDir = report.config?.rootDir ?? '';
  const multiProject = (report.config?.projects?.length ?? 0) > 1;
  const records: TraceRecord[] = [];
  const walk = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      for (const entry of spec.tests ?? []) {
        for (const result of entry.results ?? []) {
          const attachment = (result.attachments ?? []).find((a) => a?.name === 'trace' && typeof a.path === 'string');
          if (!attachment?.path) continue;
          const started = typeof result.startTime === 'string' ? Date.parse(result.startTime) : NaN;
          const duration = typeof result.duration === 'number' ? result.duration : 0;
          records.push({
            file: path.resolve(rootDir, spec.file),
            line: spec.line,
            column: spec.column,
            title: spec.title,
            project: multiProject && entry.projectName ? entry.projectName : null,
            path: attachment.path,
            finishedAt: Number.isNaN(started) ? 0 : started + duration,
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return records;
}

/** The record for `file` and `line` that finished last, or null. */
export function latestTraceFor(records: TraceRecord[], file: string, line: number): TraceRecord | null {
  let best: TraceRecord | null = null;
  for (const record of records) {
    if (record.file !== file || record.line !== line) continue;
    if (!best || record.finishedAt >= best.finishedAt) best = record;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Viewer sessions
// ---------------------------------------------------------------------------

/** Structural subset of `ChildProcess`, so unit tests can substitute a fake. */
export interface ViewerChild {
  pid?: number;
  stdin: { write(chunk: string): unknown; end(): void } | null;
  stdout: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown } | null;
  stderr: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown } | null;
  kill(signal?: NodeJS.Signals): boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

export type ViewerSpawnFn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: ['pipe', 'pipe', 'pipe'] }) => ViewerChild;

export interface ViewerHooks {
  onStarted(configName: string, pid: number, command: string): void;
  /** A path was written to the viewer. */
  onShowing(configName: string, tracePath: string): void;
  /** A waiting `.zip` path disappeared before its turn (a new run cleaned the output directory). */
  onDropped(configName: string, tracePath: string): void;
  onOutput(configName: string, line: string): void;
  onExit(configName: string, code: number | null): void;
  onClosed(configName: string): void;
  /** A spawn error or an exit with a non-zero code: the command and the first useful detail. */
  onFailure(configName: string, command: string, detail: string): void;
}

/** `shown` means accepted: written at once or queued behind the spacing rule below. */
export type ShowOutcome = 'shown' | 'same' | 'missing' | 'failed';

/**
 * The warning a show outcome deserves, on both the automatic and the cursor path (FR-010,
 * contract section 5): a final trace that is not on disk. `failed` is reported by the
 * session's failure hook with the command, and `shown` and `same` need nothing.
 */
export function showOutcomeWarning(outcome: ShowOutcome, tracePath: string): string | null {
  return outcome === 'missing' ? `Playwright: trace file not found: ${tracePath}` : null;
}

export interface ViewerSessionInfo {
  configPath: string;
  rootPath: string;
  pid: number;
  /** The last path written to the viewer (a queued path is not yet reported here). */
  currentPath: string | null;
  startedAt: string;
}

interface Session extends ViewerSessionInfo {
  configName: string;
  child: ViewerChild;
  command: string;
  startedAtMs: number;
  closing: boolean;
  stderrHead: string[];
  killTimer: NodeJS.Timeout | null;
  /** The newest path waiting for its turn; a newer request replaces it. */
  pending: string | null;
  lastWriteAt: number;
  flushTimer: NodeJS.Timeout | null;
}

export const VIEWER_KILL_GRACE_MS = 5000;
/**
 * The viewer reads each stdin chunk as one path (`data.toString().trim()`, no line split) and
 * attaches its stdin reader only after loading its bundle, so a second path written soon
 * after the first lands in the same read and kills the process. The first path goes out at
 * once (the pipe buffers it); any later path waits until the viewer has been up this long.
 */
export const VIEWER_FIRST_WRITE_GRACE_MS = 3000;
/** Minimum spacing between two writes to a running viewer, so each lands in its own read. */
export const VIEWER_WRITE_GAP_MS = 250;

function quote(arg: string): string {
  return /[\s"']/.test(arg) ? JSON.stringify(arg) : arg;
}

/** Live traces end in `.json`; the viewer polls them and never checks that they exist. */
function isLiveTrace(tracePath: string): boolean {
  return tracePath.endsWith('.json');
}

/**
 * One `show-trace --stdin` process per configuration (research R1): started on the first
 * trace to show, fed one absolute path per write, closed by ending stdin. A `.zip` path is
 * checked with `stat` first because the viewer dies on a path that does not exist; a path
 * equal to the current or waiting one is skipped because the viewer ignores it (research R2).
 * Writes are spaced (see the constants above) and a newer path replaces a waiting one, so a
 * test that ends within the grace loads only its final trace.
 */
export class ViewerSessions {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly hooks: ViewerHooks,
    private readonly spawnFn: ViewerSpawnFn = nodeSpawn as unknown as ViewerSpawnFn,
    private readonly node: string = process.execPath,
  ) {}

  show(config: Pick<PlaywrightConfig, 'configPath' | 'playwrightCli'>, rootPath: string, tracePath: string): ShowOutcome {
    if (!isLiveTrace(tracePath) && !fileExists(tracePath)) return 'missing';
    const session = this.sessions.get(config.configPath) ?? this.start(config, rootPath);
    if (!session) return 'failed';
    if (session.pending === tracePath || (session.pending === null && session.currentPath === tracePath)) return 'same';
    session.pending = tracePath;
    return this.flush(session) ? 'shown' : 'failed';
  }

  /** Writes the waiting path now or arms a timer for the earliest allowed moment; false on a write error. */
  private flush(session: Session): boolean {
    if (session.flushTimer || session.pending === null || session.closing) return true;
    const now = Date.now();
    const earliest = session.lastWriteAt === 0 ? 0 : Math.max(session.startedAtMs + VIEWER_FIRST_WRITE_GRACE_MS, session.lastWriteAt + VIEWER_WRITE_GAP_MS);
    if (now < earliest) {
      session.flushTimer = setTimeout(() => {
        session.flushTimer = null;
        this.flush(session);
      }, earliest - now);
      session.flushTimer.unref?.();
      return true;
    }
    const tracePath = session.pending;
    session.pending = null;
    if (!isLiveTrace(tracePath) && !fileExists(tracePath)) {
      this.hooks.onDropped(session.configName, tracePath);
      return true;
    }
    try {
      session.child.stdin?.write(`${tracePath}\n`);
    } catch (error) {
      this.hooks.onFailure(session.configName, session.command, (error as Error).message);
      return false;
    }
    session.currentPath = tracePath;
    session.lastWriteAt = now;
    this.hooks.onShowing(session.configName, tracePath);
    return true;
  }

  private start(config: Pick<PlaywrightConfig, 'configPath' | 'playwrightCli'>, rootPath: string): Session | null {
    const configName = path.basename(config.configPath);
    const args = [config.playwrightCli, 'show-trace', '--stdin'];
    const command = [this.node, ...args].map(quote).join(' ');
    let child: ViewerChild;
    try {
      child = this.spawnFn(this.node, args, { cwd: rootPath, env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      this.hooks.onFailure(configName, command, (error as Error).message);
      return null;
    }
    const now = Date.now();
    const session: Session = {
      configPath: config.configPath,
      configName,
      rootPath,
      child,
      pid: child.pid ?? 0,
      currentPath: null,
      startedAt: new Date(now).toISOString(),
      startedAtMs: now,
      command,
      closing: false,
      stderrHead: [],
      killTimer: null,
      pending: null,
      lastWriteAt: 0,
      flushTimer: null,
    };
    this.sessions.set(config.configPath, session);
    const onLines = (keepHead: boolean) => (chunk: Buffer | string) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        this.hooks.onOutput(configName, line);
        if (keepHead && session.stderrHead.length < 5) session.stderrHead.push(line);
      }
    };
    child.stdout?.on('data', onLines(false));
    child.stderr?.on('data', onLines(true));
    child.on('error', (error: Error) => {
      this.forget(session);
      this.hooks.onFailure(configName, command, error.message);
    });
    child.on('exit', (code: number | null) => {
      this.forget(session);
      if (code !== 0 && code !== null && !session.closing) {
        const detail = session.stderrHead.find((line) => /^\s*[A-Za-z]*Error\b/.test(line)) ?? session.stderrHead[0] ?? `exit code ${code}`;
        this.hooks.onFailure(configName, command, detail);
      } else {
        this.hooks.onExit(configName, code);
      }
    });
    this.hooks.onStarted(configName, session.pid, command);
    return session;
  }

  private forget(session: Session): void {
    if (session.killTimer) clearTimeout(session.killTimer);
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.killTimer = null;
    session.flushTimer = null;
    session.pending = null;
    if (this.sessions.get(session.configPath) === session) this.sessions.delete(session.configPath);
  }

  /** Ends stdin (the viewer exits on its own) and arms a SIGTERM for a process that lingers. */
  close(configPath: string, force = false): void {
    const session = this.sessions.get(configPath);
    if (!session) return;
    session.closing = true;
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = null;
    session.pending = null;
    try {
      session.child.stdin?.end();
    } catch {
      // already gone
    }
    if (force) {
      session.child.kill('SIGTERM');
    } else {
      session.killTimer = setTimeout(() => session.child.kill('SIGTERM'), VIEWER_KILL_GRACE_MS);
      session.killTimer.unref?.();
    }
    this.hooks.onClosed(session.configName);
  }

  closeFor(rootPath: string): void {
    for (const session of [...this.sessions.values()]) {
      if (session.rootPath === rootPath) this.close(session.configPath);
    }
  }

  closeAll(force = false): void {
    for (const configPath of [...this.sessions.keys()]) this.close(configPath, force);
  }

  list(rootPath?: string): ViewerSessionInfo[] {
    return [...this.sessions.values()]
      .filter((s) => rootPath === undefined || s.rootPath === rootPath)
      .map(({ configPath, rootPath: root, pid, currentPath, startedAt }) => ({ configPath, rootPath: root, pid, currentPath, startedAt }));
  }
}

function fileExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
