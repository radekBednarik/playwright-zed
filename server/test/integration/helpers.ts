import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMessageConnection, ProgressType, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const FIXTURE = path.join(REPO_ROOT, 'fixtures/sample-project');
export const PASSING = path.join(FIXTURE, 'tests/passing.spec.ts');
export const FAILING = path.join(FIXTURE, 'tests/failing.spec.ts');
export const CONFIG = path.join(FIXTURE, 'playwright.config.ts');
export const SLOW = path.join(FIXTURE, 'tests/slow.spec.ts');
export const HELPER = path.join(FIXTURE, 'tests/helpers/steps.ts');
const BIN = path.join(REPO_ROOT, 'server/bin/playwright-zed-language-server.js');

export interface Message {
  method: string;
  params: any;
}

export const uriOf = (file: string) => pathToFileURL(file).toString();

/** How the client answers the discovery question; `null` models a dismissed prompt. */
export type DiscoveryAnswer = 'Run discovery' | 'Not now' | null;

export interface StartOptions {
  answer?: DiscoveryAnswer;
  /** Sent as `initialize.params.clientInfo` (feature 003); omitted by default. */
  clientInfo?: { name: string; version?: string };
  /** Sends only `rootUri`, no `workspaceFolders`, in `initialize` (feature 003 fallback root). */
  rootUriOnly?: boolean;
  /**
   * Directory passed to the server as `PLAYWRIGHT_ZED_STATE_DIR` (feature 005). A fresh temp
   * directory is created (and removed in `stop`) when omitted; a directory given here is never
   * removed by the client.
   */
  stateDir?: string;
  /** Object answered to `workspace/configuration` and sent by `changeSettings` (feature 005). */
  settings?: unknown;
  /** Do not advertise `workspace.configuration` (feature 005: client without settings). */
  noConfiguration?: boolean;
  /** Do not advertise `window.showDocument` (feature 006: client without an output surface). */
  noShowDocument?: boolean;
  /** Do not advertise `textDocument.inlayHint` (feature 006: client without step marks). */
  noInlayHints?: boolean;
  /** Server entry script to spawn instead of `server/bin` (feature 006: a dist copy without the step reporter). */
  serverEntry?: string;
}

export class TestClient {
  readonly notifications: Message[] = [];
  readonly requests: Message[] = [];
  private settings: unknown = {};
  private constructor(
    private readonly child: ChildProcess,
    readonly conn: MessageConnection,
    readonly stateDir: string,
    private readonly ownsStateDir: boolean,
  ) {}

  static async start(folderOrFolders: string | string[], options: StartOptions = {}): Promise<TestClient> {
    const answer: DiscoveryAnswer = options.answer === undefined ? 'Run discovery' : options.answer;
    const folders = Array.isArray(folderOrFolders) ? folderOrFolders : [folderOrFolders];
    const folder = folders[0];
    if (!fs.existsSync(path.join(REPO_ROOT, 'server/dist/server.js'))) {
      throw new Error('server/dist is missing; run `npm run build` in server/ first');
    }
    const ownsStateDir = options.stateDir === undefined;
    const stateDir = options.stateDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-state-'));
    const child = spawn(process.execPath, [options.serverEntry ?? BIN, '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_ZED_STATE_DIR: stateDir },
    });
    const conn = createMessageConnection(new StreamMessageReader(child.stdout!), new StreamMessageWriter(child.stdin!));
    const client = new TestClient(child, conn, stateDir, ownsStateDir);
    client.settings = options.settings ?? {};
    child.stderr!.on('data', (chunk: Buffer) => process.stderr.write(`[server] ${chunk}`));
    conn.onNotification((method, params) => client.notifications.push({ method, params }));
    conn.onRequest((method, params) => {
      client.requests.push({ method, params });
      if (method === 'window/showMessageRequest') {
        if (answer === null) return new Promise(() => {}); // dismissed: Zed never answers
        const actions = ((params as { actions?: { title: string }[] }).actions ?? []);
        return actions.find((a) => a.title === answer) ?? null;
      }
      if (method === 'workspace/configuration') {
        const items = ((params as { items?: unknown[] }).items ?? []);
        return items.map(() => client.settings);
      }
      if (method === 'workspace/inlayHint/refresh') return null;
      if (method === 'window/showDocument') return { success: true };
      if (method === 'window/workDoneProgress/create') {
        // vscode-jsonrpc routes `$/progress` to per-token handlers, not to the star handler.
        const token = (params as { token: string | number }).token;
        conn.onProgress(new ProgressType<unknown>(), token, (value) => {
          client.notifications.push({ method: '$/progress', params: { token, value } });
        });
      }
      return null;
    });
    conn.listen();
    await conn.sendRequest('initialize', {
      processId: process.pid,
      rootUri: uriOf(folder),
      ...(options.rootUriOnly ? {} : { workspaceFolders: folders.map((f) => ({ uri: uriOf(f), name: path.basename(f) })) }),
      ...(options.clientInfo ? { clientInfo: options.clientInfo } : {}),
      capabilities: {
        window: { workDoneProgress: true, ...(options.noShowDocument ? {} : { showDocument: { support: true } }) },
        workspace: {
          workspaceFolders: true,
          codeLens: { refreshSupport: true },
          ...(options.noInlayHints ? {} : { inlayHint: { refreshSupport: true } }),
          ...(options.noConfiguration ? {} : { configuration: true, didChangeConfiguration: { dynamicRegistration: false } }),
        },
        textDocument: { codeAction: {}, codeLens: {}, publishDiagnostics: {}, ...(options.noInlayHints ? {} : { inlayHint: {} }) },
      },
    });
    await conn.sendNotification('initialized', {});
    return client;
  }

  request<T = any>(method: string, params: unknown): Promise<T> {
    return this.conn.sendRequest(method, params) as Promise<T>;
  }

  notify(method: string, params: unknown): Promise<void> {
    return this.conn.sendNotification(method, params);
  }

  clear(): void {
    this.notifications.length = 0;
    this.requests.length = 0;
  }

  /** Resolves with the first matching message (notification or server request). */
  async waitFor(method: string, predicate: (params: any) => boolean = () => true, timeoutMs = 60_000): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = [...this.notifications, ...this.requests].find((m) => m.method === method && predicate(m.params));
      if (hit) return hit.params;
      if (Date.now() > deadline) {
        const seen = this.notifications.map((m) => `${m.method} ${JSON.stringify(m.params).slice(0, 160)}`).join('\n');
        throw new Error(`timed out waiting for ${method}\nseen:\n${seen}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async waitForDiscovery(): Promise<void> {
    await this.waitFor('workspace/codeLens/refresh');
  }

  /** Every discovery question the server has sent so far. */
  prompts(): any[] {
    return this.requests.filter((m) => m.method === 'window/showMessageRequest').map((m) => m.params);
  }

  messages(method: string): Message[] {
    return this.notifications.filter((m) => m.method === method);
  }

  showMessages(type?: number): string[] {
    return this.messages('window/showMessage')
      .filter((m) => type === undefined || m.params.type === type)
      .map((m) => m.params.message as string);
  }

  async open(file: string, version = 1): Promise<void> {
    await this.notify('textDocument/didOpen', {
      textDocument: { uri: uriOf(file), languageId: 'typescript', version, text: fs.readFileSync(file, 'utf8') },
    });
  }

  async change(file: string, version: number, text = '// edited\n'): Promise<void> {
    await this.notify('textDocument/didChange', {
      textDocument: { uri: uriOf(file), version },
      contentChanges: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text }],
    });
  }

  async save(file: string): Promise<void> {
    await this.notify('textDocument/didSave', { textDocument: { uri: uriOf(file) } });
  }

  async execute(command: string, args: unknown[]): Promise<void> {
    await this.request('workspace/executeCommand', { command, arguments: args });
  }

  codeActions(file: string, line0: number) {
    return this.request<any[]>('textDocument/codeAction', {
      textDocument: { uri: uriOf(file) },
      range: { start: { line: line0, character: 0 }, end: { line: line0, character: 0 } },
      context: { diagnostics: [] },
    });
  }

  codeLenses(file: string) {
    return this.request<any[]>('textDocument/codeLens', { textDocument: { uri: uriOf(file) } });
  }

  /** Inlay hints for the whole document (feature 006). */
  inlayHints(file: string) {
    return this.request<any[]>('textDocument/inlayHint', {
      textDocument: { uri: uriOf(file) },
      range: { start: { line: 0, character: 0 }, end: { line: 100000, character: 0 } },
    });
  }

  status() {
    return this.request<any[]>('playwright/status', {});
  }

  /** Feature 008: polls `playwright/status` until the predicate accepts it. */
  async waitForStatus<T>(probe: (status: any[]) => T | null, timeoutMs = 60_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = probe(await this.status());
      if (value !== null) return value;
      if (Date.now() > deadline) throw new Error(`timed out waiting for a status condition; last status: ${JSON.stringify(await this.status()).slice(0, 400)}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  /** Replaces the settings object and sends `workspace/didChangeConfiguration` (feature 005). */
  async changeSettings(settings: unknown): Promise<void> {
    this.settings = settings;
    await this.notify('workspace/didChangeConfiguration', { settings });
  }

  async stop(): Promise<void> {
    try {
      await this.request('shutdown', null);
      await this.notify('exit', null);
    } catch {
      // ignore
    }
    this.conn.dispose();
    this.child.kill('SIGKILL');
    if (this.ownsStateDir) fs.rmSync(this.stateDir, { recursive: true, force: true });
  }
}

export const MessageType = { Error: 1, Warning: 2, Info: 3, Log: 4 } as const;

// Feature 008: the shape of the trace viewer fields in `playwright/status` (contract section 9).
export interface TraceViewerStatus {
  enabled: boolean;
  source: 'remembered' | 'settings' | 'default';
}
export interface TraceRecordStatus {
  file: string;
  line: number;
  title: string;
  project: string | null;
  path: string;
}
export interface TracesStatus {
  runId: string;
  records: TraceRecordStatus[];
}
export interface ViewerSessionStatus {
  configPath: string;
  pid: number;
  currentPath: string | null;
  startedAt: string;
}

/** Feature 008: the real trace viewer opens a Chromium window; tests that start it skip without a display. */
export function hasDisplay(): boolean {
  return Boolean(process.env.DISPLAY?.trim() || process.env.WAYLAND_DISPLAY?.trim());
}

export const SPEC_SOURCE = `import { test, expect } from '@playwright/test';

test('one', async ({ page }) => {
  await page.setContent('<p id="o">one</p>');
  await expect(page.locator('#o')).toHaveText('one');
});
`;

/** A config that leaves evidence when Playwright loads it (feature 002 SC-001). */
export function configSource(withMarker: boolean): string {
  const marker = withMarker ? `writeFileSync(process.env.PW_ZED_MARKER as string, 'loaded');\n` : '';
  return `import { writeFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

${marker}export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
`;
}

export interface TempProject {
  dir: string;
  spec: string;
  marker: string;
}

const tempDirs: string[] = [];

/** Registers a temp directory for removal by `removeTempProjects`. */
export function trackTempDir(dir: string): void {
  tempDirs.push(dir);
}

/** Temp project sharing the fixture's node_modules; sets PW_ZED_MARKER for the server to inherit. */
export function tempProject(withMarker = true): TempProject {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-consent-'));
  trackTempDir(dir);
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.symlinkSync(path.join(FIXTURE, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), configSource(withMarker));
  const spec = path.join(dir, 'tests/one.spec.ts');
  fs.writeFileSync(spec, SPEC_SOURCE);
  const marker = path.join(dir, 'config-loaded.marker');
  process.env.PW_ZED_MARKER = marker;
  return { dir, spec, marker };
}

/** Removes every tracked temp directory and the marker variable; call from `afterEach`. */
export function removeTempProjects(): void {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PW_ZED_MARKER;
}
