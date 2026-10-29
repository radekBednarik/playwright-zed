import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSER_SERVER_KILL_GRACE_MS,
  BROWSER_SERVER_READY_MS,
  BrowserServers,
  bothOnKey,
  parseListeningLine,
  parseReuseBrowserSetting,
  resolveBrowserPreference,
  type BrowserChild,
  type BrowserServerHooks,
} from '../../src/browser';

describe('resolveBrowserPreference', () => {
  it('prefers the remembered choice, then the setting, then off', () => {
    expect(resolveBrowserPreference({ showBrowser: false, updatedAt: 't' }, true)).toEqual({ enabled: false, source: 'remembered', updatedAt: 't' });
    expect(resolveBrowserPreference(null, true)).toEqual({ enabled: true, source: 'settings', updatedAt: null });
    expect(resolveBrowserPreference(null, false)).toEqual({ enabled: false, source: 'settings', updatedAt: null });
    expect(resolveBrowserPreference(null, null)).toEqual({ enabled: false, source: 'default', updatedAt: null });
  });
});

describe('parseReuseBrowserSetting', () => {
  it('accepts booleans, treats absence as absent and anything else as invalid', () => {
    expect(parseReuseBrowserSetting(undefined)).toEqual({ value: null, invalid: false });
    expect(parseReuseBrowserSetting(null)).toEqual({ value: null, invalid: false });
    expect(parseReuseBrowserSetting(true)).toEqual({ value: true, invalid: false });
    expect(parseReuseBrowserSetting(false)).toEqual({ value: false, invalid: false });
    expect(parseReuseBrowserSetting('yes')).toEqual({ value: null, invalid: true });
    expect(parseReuseBrowserSetting(1)).toEqual({ value: null, invalid: true });
  });
});

describe('parseListeningLine and bothOnKey', () => {
  it('extracts the endpoint of the run-server line only', () => {
    expect(parseListeningLine('Listening on ws://127.0.0.1:40105/abc')).toBe('ws://127.0.0.1:40105/abc');
    expect(parseListeningLine('  Listening on wss://host/p \r')).toBe('wss://host/p');
    expect(parseListeningLine('Listening on http://x')).toBeNull();
    expect(parseListeningLine('something else')).toBeNull();
    expect(parseListeningLine('')).toBeNull();
  });

  it('keys the both-on warning by the two timestamps', () => {
    expect(bothOnKey({ updatedAt: 'a' }, { updatedAt: null })).toBe('a|null');
    expect(bothOnKey({ updatedAt: 'a' }, { updatedAt: 'b' })).not.toBe(bothOnKey({ updatedAt: 'a' }, { updatedAt: 'c' }));
  });
});

class FakeChild extends EventEmitter implements BrowserChild {
  pid = 5151;
  signals: string[] = [];
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill(signal?: NodeJS.Signals): boolean {
    this.signals.push(signal ?? 'default');
    return true;
  }
}

function hooks(): BrowserServerHooks & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onStarted: (name, pid, command) => calls.push(`started ${name} ${pid} ${command}`),
    onListening: (name, endpoint) => calls.push(`listening ${name} ${endpoint}`),
    onOutput: (name, line) => calls.push(`output ${name} ${line}`),
    onStopping: (name) => calls.push(`stopping ${name}`),
    onExit: (name, code, unexpected) => calls.push(`exit ${name} ${code} ${unexpected ? 'unexpected' : 'stopped'}`),
  };
}

const config = { configPath: '/w/playwright.config.ts', configDir: '/w', playwrightCli: '/w/node_modules/@playwright/test/cli.js' };
const other = { configPath: '/v/playwright.config.ts', configDir: '/v', playwrightCli: '/v/node_modules/@playwright/test/cli.js' };

function servers(h = hooks(), platform: NodeJS.Platform = 'linux') {
  const spawned: { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv; child: FakeChild }[] = [];
  const manager = new BrowserServers(
    h,
    (command, args, options) => {
      const child = new FakeChild();
      spawned.push({ command, args, cwd: options.cwd, env: options.env, child });
      expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
      return child;
    },
    '/usr/bin/node',
    platform,
  );
  return { manager, spawned, h };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('BrowserServers', () => {
  it('starts one run-server per config in extension mode and resolves on the Listening line', async () => {
    const { manager, spawned, h } = servers();
    const pending = manager.ensure(config, '/w');
    expect(spawned).toHaveLength(1);
    expect(spawned[0].command).toBe('/usr/bin/node');
    expect(spawned[0].args.slice(0, 2)).toEqual([config.playwrightCli, 'run-server']);
    expect(spawned[0].args[2]).toMatch(/^--path=\/[0-9a-f]{32}$/);
    expect(spawned[0].args.slice(3)).toEqual(['--host', '127.0.0.1']);
    expect(spawned[0].cwd).toBe('/w');
    expect(spawned[0].env.PW_EXTENSION_MODE).toBe('1');
    expect(spawned[0].env.FORCE_COLOR).toBe('0');
    expect(manager.list('/w')[0]).toMatchObject({ configPath: config.configPath, pid: 5151, wsEndpoint: null, state: 'starting' });
    // a second caller while starting shares the promise, no second process
    const second = manager.ensure(config, '/w');
    expect(spawned).toHaveLength(1);
    spawned[0].child.stdout.emit('data', Buffer.from('Listening on ws://127.0.0.1:1234/ab'));
    spawned[0].child.stdout.emit('data', Buffer.from('cd\n'));
    expect(await pending).toEqual({ ok: true, wsEndpoint: 'ws://127.0.0.1:1234/abcd' });
    expect(await second).toEqual({ ok: true, wsEndpoint: 'ws://127.0.0.1:1234/abcd' });
    expect(manager.list()[0]).toMatchObject({ wsEndpoint: 'ws://127.0.0.1:1234/abcd', state: 'ready' });
    expect(manager.has('/w')).toBe(true);
    expect(manager.has('/v')).toBe(false);
    // a ready server answers at once without a new process
    expect(await manager.ensure(config, '/w')).toEqual({ ok: true, wsEndpoint: 'ws://127.0.0.1:1234/abcd' });
    expect(spawned).toHaveLength(1);
    expect(h.calls).toEqual([
      `started playwright.config.ts 5151 /usr/bin/node ${config.playwrightCli} run-server ${spawned[0].args[2]} --host 127.0.0.1`,
      'output playwright.config.ts Listening on ws://127.0.0.1:1234/abcd',
      'listening playwright.config.ts ws://127.0.0.1:1234/abcd',
    ]);
  });

  it('gives up after the readiness timeout, kills the process and forgets it', async () => {
    vi.useFakeTimers();
    const { manager, spawned } = servers();
    const pending = manager.ensure(config, '/w');
    spawned[0].child.stderr.emit('data', 'some warning\n');
    vi.advanceTimersByTime(BROWSER_SERVER_READY_MS);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, detail: 'no endpoint within 15 s' });
    expect((result as { command: string }).command).toContain('run-server');
    expect(spawned[0].child.signals).toEqual(['SIGKILL']);
    expect(manager.list()).toEqual([]);
    // the next ensure starts a fresh process
    void manager.ensure(config, '/w');
    expect(spawned).toHaveLength(2);
  });

  it('reports a spawn error and an early exit with the first stderr error line', async () => {
    const h = hooks();
    const failing = new BrowserServers(
      h,
      () => {
        throw new Error('spawn ENOENT');
      },
      '/usr/bin/node',
      'linux',
    );
    expect(await failing.ensure(config, '/w')).toMatchObject({ ok: false, detail: 'spawn ENOENT' });
    expect(failing.list()).toEqual([]);

    const { manager, spawned, h: h2 } = servers();
    const pending = manager.ensure(config, '/w');
    spawned[0].child.stderr.emit('data', 'node: warning\nError: Cannot find module x\n');
    spawned[0].child.emit('exit', 1);
    expect(await pending).toMatchObject({ ok: false, detail: 'Error: Cannot find module x' });
    expect(manager.list()).toEqual([]);
    expect(h2.calls.at(-1)).toBe('exit playwright.config.ts 1 unexpected');

    const third = servers();
    const p3 = third.manager.ensure(config, '/w');
    third.spawned[0].child.emit('error', new Error('EACCES'));
    expect(await p3).toMatchObject({ ok: false, detail: 'EACCES' });
  });

  it('stops with SIGINT then SIGKILL after the grace, and reports a stopped exit as expected', async () => {
    vi.useFakeTimers();
    const { manager, spawned, h } = servers();
    const pending = manager.ensure(config, '/w');
    spawned[0].child.stdout.emit('data', 'Listening on ws://127.0.0.1:1/x\n');
    await pending;
    manager.stop(config.configPath);
    expect(spawned[0].child.signals).toEqual(['SIGINT']);
    expect(manager.list()[0].state).toBe('stopping');
    expect(manager.has('/w')).toBe(false);
    manager.stop(config.configPath); // idempotent
    expect(spawned[0].child.signals).toEqual(['SIGINT']);
    vi.advanceTimersByTime(BROWSER_SERVER_KILL_GRACE_MS);
    expect(spawned[0].child.signals).toEqual(['SIGINT', 'SIGKILL']);
    spawned[0].child.emit('exit', null);
    expect(manager.list()).toEqual([]);
    expect(h.calls.at(-1)).toBe('exit playwright.config.ts null stopped');
    expect(h.calls).toContain('stopping playwright.config.ts');
  });

  it('uses a plain terminate on Windows and SIGKILL when forced', async () => {
    const win = servers(hooks(), 'win32');
    const p = win.manager.ensure(config, '/w');
    win.spawned[0].child.stdout.emit('data', 'Listening on ws://127.0.0.1:1/x\n');
    await p;
    win.manager.stop(config.configPath);
    expect(win.spawned[0].child.signals).toEqual(['default']);

    const { manager, spawned } = servers();
    const pending = manager.ensure(config, '/w');
    spawned[0].child.stdout.emit('data', 'Listening on ws://127.0.0.1:1/x\n');
    await pending;
    manager.closeAll(true);
    expect(spawned[0].child.signals).toEqual(['SIGKILL']);
  });

  it('forgets a server that exits on its own and starts anew on the next ensure', async () => {
    const { manager, spawned, h } = servers();
    const pending = manager.ensure(config, '/w');
    spawned[0].child.stdout.emit('data', 'Listening on ws://127.0.0.1:1/x\n');
    await pending;
    spawned[0].child.emit('exit', 0);
    expect(h.calls.at(-1)).toBe('exit playwright.config.ts 0 unexpected');
    expect(manager.list()).toEqual([]);
    void manager.ensure(config, '/w');
    expect(spawned).toHaveLength(2);
    expect(spawned[1].args[2]).not.toBe(spawned[0].args[2]);
  });

  it('closeFor stops only the servers of the matching root', async () => {
    const { manager, spawned } = servers();
    const a = manager.ensure(config, '/w');
    const b = manager.ensure(other, '/v');
    spawned[0].child.stdout.emit('data', 'Listening on ws://127.0.0.1:1/x\n');
    spawned[1].child.stdout.emit('data', 'Listening on ws://127.0.0.1:2/y\n');
    await Promise.all([a, b]);
    manager.closeFor('/w');
    expect(spawned[0].child.signals).toEqual(['SIGINT']);
    expect(spawned[1].child.signals).toEqual([]);
    expect(manager.list('/v')[0].state).toBe('ready');
    manager.closeAll();
    expect(spawned[1].child.signals).toEqual(['SIGINT']);
  });

  it('a stop while starting settles the waiting run as a failure', async () => {
    const { manager, spawned } = servers();
    const pending = manager.ensure(config, '/w');
    manager.stop(config.configPath);
    expect(await pending).toMatchObject({ ok: false, detail: 'stopped before it was ready' });
    expect(spawned[0].child.signals).toEqual(['SIGINT']);
  });
});
