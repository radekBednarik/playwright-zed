/**
 * Feature 009: the "Show browser" preference and the browser servers that keep one browser
 * alive per configuration between runs (specs/009-show-browser/data-model.md, research R1
 * to R6).
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import type { BrowserPreference, PlaywrightConfig, TracePreference } from './types';

// ---------------------------------------------------------------------------
// Preference
// ---------------------------------------------------------------------------

export interface StoredBrowserPreference {
  showBrowser: boolean;
  updatedAt: string;
}

/** Remembered choice, else the boolean setting, else off (data-model "Resolution"). */
export function resolveBrowserPreference(remembered: StoredBrowserPreference | null, settingsValue: boolean | null): BrowserPreference {
  if (remembered) return { enabled: remembered.showBrowser, source: 'remembered', updatedAt: remembered.updatedAt };
  if (settingsValue !== null) return { enabled: settingsValue, source: 'settings', updatedAt: null };
  return { enabled: false, source: 'default', updatedAt: null };
}

export interface ReuseBrowserSetting {
  /** The boolean, or null when absent or invalid. */
  value: boolean | null;
  /** True when a value was present but not `true` or `false`. */
  invalid: boolean;
}

/** Validates the `reuseBrowser` setting value (upstream's name for "Show browser"). */
export function parseReuseBrowserSetting(value: unknown): ReuseBrowserSetting {
  if (value === undefined || value === null) return { value: null, invalid: false };
  if (typeof value === 'boolean') return { value, invalid: false };
  return { value: null, invalid: true };
}

/** The endpoint of a `Listening on ws://...` line printed by `playwright run-server`, else null. */
export function parseListeningLine(line: string): string | null {
  const match = /^\s*Listening on\s+(wss?:\/\/\S+)\s*$/.exec(line);
  return match ? match[1] : null;
}

/**
 * Identity of the current combination of the two preferences, so the "runs record no trace
 * while the browser is shown" warning is shown once per combination (research R6).
 */
export function bothOnKey(browser: Pick<BrowserPreference, 'updatedAt'>, trace: Pick<TracePreference, 'updatedAt'>): string {
  return `${browser.updatedAt}|${trace.updatedAt}`;
}

// ---------------------------------------------------------------------------
// Browser servers
// ---------------------------------------------------------------------------

/** Structural subset of `ChildProcess`, so unit tests can substitute a fake. */
export interface BrowserChild {
  pid?: number;
  stdout: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown } | null;
  stderr: { on(event: 'data', listener: (chunk: Buffer | string) => void): unknown } | null;
  kill(signal?: NodeJS.Signals): boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

export type BrowserSpawnFn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: ['ignore', 'pipe', 'pipe'] }) => BrowserChild;

export interface BrowserServerHooks {
  onStarted(configName: string, pid: number, command: string): void;
  onListening(configName: string, wsEndpoint: string): void;
  onOutput(configName: string, line: string): void;
  onStopping(configName: string): void;
  /** `unexpected` is true when the process ended outside `stop()`. */
  onExit(configName: string, code: number | null, unexpected: boolean): void;
}

export type EnsureResult = { ok: true; wsEndpoint: string } | { ok: false; command: string; detail: string };

export type BrowserServerState = 'starting' | 'ready' | 'stopping';

export interface BrowserServerInfo {
  configPath: string;
  rootPath: string;
  pid: number;
  wsEndpoint: string | null;
  startedAt: string;
  state: BrowserServerState;
}

interface Entry extends BrowserServerInfo {
  configName: string;
  child: BrowserChild;
  command: string;
  ready: Promise<EnsureResult>;
  settle: (result: EnsureResult) => void;
  stderrHead: string[];
  readyTimer: NodeJS.Timeout | null;
  killTimer: NodeJS.Timeout | null;
}

/** How long the first run waits for the `Listening on` line before giving up (research R3). */
export const BROWSER_SERVER_READY_MS = 15000;
/** `SIGINT` closes the browser and exits (research R4); a lingering process gets `SIGKILL` after this. */
export const BROWSER_SERVER_KILL_GRACE_MS = 5000;

function quote(arg: string): string {
  return /[\s"']/.test(arg) ? JSON.stringify(arg) : arg;
}

/** Splits stream chunks into complete lines, keeping a partial trailing line for the next chunk. */
function lineSplitter(onLine: (line: string) => void): (chunk: Buffer | string) => void {
  let partial = '';
  return (chunk) => {
    partial += chunk.toString();
    const lines = partial.split('\n');
    partial = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) onLine(line.replace(/\r$/, ''));
  };
}

/**
 * One `run-server` process per configuration (research R1): started by the first run that
 * needs it, in extension mode (`PW_EXTENSION_MODE=1`), ready when it prints its endpoint,
 * kept until stopped. The browser inside it is Playwright's own: launched on the first
 * connection, reused by later ones, replaced by the server itself when the developer closes
 * it. Stopping sends `SIGINT` (the server closes the browser and exits) with a `SIGKILL`
 * fallback; a server that exits on its own is forgotten and started anew by the next run.
 */
export class BrowserServers {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly hooks: BrowserServerHooks,
    private readonly spawnFn: BrowserSpawnFn = nodeSpawn as unknown as BrowserSpawnFn,
    private readonly node: string = process.execPath,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  /** The endpoint of the configuration's server, starting it when needed; concurrent callers share one start. */
  ensure(config: Pick<PlaywrightConfig, 'configPath' | 'configDir' | 'playwrightCli'>, rootPath: string): Promise<EnsureResult> {
    const existing = this.entries.get(config.configPath);
    if (existing && existing.state !== 'stopping') return existing.ready;
    return this.start(config, rootPath);
  }

  private start(config: Pick<PlaywrightConfig, 'configPath' | 'configDir' | 'playwrightCli'>, rootPath: string): Promise<EnsureResult> {
    const configName = path.basename(config.configPath);
    const args = [config.playwrightCli, 'run-server', `--path=/${randomBytes(16).toString('hex')}`, '--host', '127.0.0.1'];
    const command = [this.node, ...args].map(quote).join(' ');
    let child: BrowserChild;
    try {
      child = this.spawnFn(this.node, args, {
        cwd: config.configDir,
        env: { ...process.env, PW_EXTENSION_MODE: '1', FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      return Promise.resolve({ ok: false, command, detail: (error as Error).message });
    }
    let settle: (result: EnsureResult) => void = () => {};
    const ready = new Promise<EnsureResult>((resolve) => {
      settle = resolve;
    });
    const entry: Entry = {
      configPath: config.configPath,
      configName,
      rootPath,
      pid: child.pid ?? 0,
      wsEndpoint: null,
      startedAt: new Date().toISOString(),
      state: 'starting',
      child,
      command,
      ready,
      settle,
      stderrHead: [],
      readyTimer: null,
      killTimer: null,
    };
    this.entries.set(config.configPath, entry);

    child.stdout?.on(
      'data',
      lineSplitter((line) => {
        this.hooks.onOutput(configName, line);
        const endpoint = parseListeningLine(line);
        if (endpoint && entry.state === 'starting') {
          entry.state = 'ready';
          entry.wsEndpoint = endpoint;
          this.clearReadyTimer(entry);
          this.hooks.onListening(configName, endpoint);
          entry.settle({ ok: true, wsEndpoint: endpoint });
        }
      }),
    );
    child.stderr?.on(
      'data',
      lineSplitter((line) => {
        this.hooks.onOutput(configName, line);
        if (entry.stderrHead.length < 5) entry.stderrHead.push(line);
      }),
    );
    child.on('error', (error: Error) => {
      const starting = entry.state === 'starting';
      this.forget(entry);
      if (starting) entry.settle({ ok: false, command, detail: error.message });
    });
    child.on('exit', (code: number | null) => {
      const state = entry.state;
      this.forget(entry);
      this.hooks.onExit(configName, code, state !== 'stopping');
      if (state === 'starting') entry.settle({ ok: false, command, detail: this.failureDetail(entry, code) });
    });
    entry.readyTimer = setTimeout(() => {
      if (entry.state !== 'starting') return;
      entry.readyTimer = null;
      this.forget(entry);
      child.kill('SIGKILL');
      entry.settle({ ok: false, command, detail: `no endpoint within ${BROWSER_SERVER_READY_MS / 1000} s` });
    }, BROWSER_SERVER_READY_MS);
    entry.readyTimer.unref?.();
    this.hooks.onStarted(configName, entry.pid, command);
    return ready;
  }

  private failureDetail(entry: Entry, code: number | null): string {
    return entry.stderrHead.find((line) => /^\s*[A-Za-z]*Error\b/.test(line)) ?? entry.stderrHead[0] ?? `exit code ${code}`;
  }

  private clearReadyTimer(entry: Entry): void {
    if (entry.readyTimer) clearTimeout(entry.readyTimer);
    entry.readyTimer = null;
  }

  private forget(entry: Entry): void {
    this.clearReadyTimer(entry);
    if (entry.killTimer) clearTimeout(entry.killTimer);
    entry.killTimer = null;
    if (this.entries.get(entry.configPath) === entry) this.entries.delete(entry.configPath);
  }

  /** `SIGINT` (a plain terminate on Windows), then `SIGKILL` after the grace if the process lingers. */
  stop(configPath: string, force = false): void {
    const entry = this.entries.get(configPath);
    if (!entry || entry.state === 'stopping') return;
    entry.state = 'stopping';
    this.clearReadyTimer(entry);
    if (entry.wsEndpoint === null) entry.settle({ ok: false, command: entry.command, detail: 'stopped before it was ready' });
    this.hooks.onStopping(entry.configName);
    if (force) {
      entry.child.kill('SIGKILL');
      return;
    }
    if (this.platform === 'win32') entry.child.kill();
    else entry.child.kill('SIGINT');
    entry.killTimer = setTimeout(() => entry.child.kill('SIGKILL'), BROWSER_SERVER_KILL_GRACE_MS);
    entry.killTimer.unref?.();
  }

  closeFor(rootPath: string): void {
    for (const entry of [...this.entries.values()]) {
      if (entry.rootPath === rootPath) this.stop(entry.configPath);
    }
  }

  closeAll(force = false): void {
    for (const configPath of [...this.entries.keys()]) this.stop(configPath, force);
  }

  /** True when a server of the workspace is starting or ready. */
  has(rootPath: string): boolean {
    return [...this.entries.values()].some((entry) => entry.rootPath === rootPath && entry.state !== 'stopping');
  }

  list(rootPath?: string): BrowserServerInfo[] {
    return [...this.entries.values()]
      .filter((entry) => rootPath === undefined || entry.rootPath === rootPath)
      .map(({ configPath, rootPath: root, pid, wsEndpoint, startedAt, state }) => ({ configPath, rootPath: root, pid, wsEndpoint, startedAt, state }));
  }
}
