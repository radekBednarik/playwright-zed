import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMessageConnection, ProgressType, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const FIXTURE = path.join(REPO_ROOT, 'fixtures/sample-project');
export const PASSING = path.join(FIXTURE, 'tests/passing.spec.ts');
export const FAILING = path.join(FIXTURE, 'tests/failing.spec.ts');
export const CONFIG = path.join(FIXTURE, 'playwright.config.ts');
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
}

export class TestClient {
  readonly notifications: Message[] = [];
  readonly requests: Message[] = [];
  private constructor(private readonly child: ChildProcess, readonly conn: MessageConnection) {}

  static async start(folderOrFolders: string | string[], options: StartOptions = {}): Promise<TestClient> {
    const answer: DiscoveryAnswer = options.answer === undefined ? 'Run discovery' : options.answer;
    const folders = Array.isArray(folderOrFolders) ? folderOrFolders : [folderOrFolders];
    const folder = folders[0];
    if (!fs.existsSync(path.join(REPO_ROOT, 'server/dist/server.js'))) {
      throw new Error('server/dist is missing; run `npm run build` in server/ first');
    }
    const child = spawn(process.execPath, [BIN, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const conn = createMessageConnection(new StreamMessageReader(child.stdout!), new StreamMessageWriter(child.stdin!));
    const client = new TestClient(child, conn);
    child.stderr!.on('data', (chunk: Buffer) => process.stderr.write(`[server] ${chunk}`));
    conn.onNotification((method, params) => client.notifications.push({ method, params }));
    conn.onRequest((method, params) => {
      client.requests.push({ method, params });
      if (method === 'window/showMessageRequest') {
        if (answer === null) return new Promise(() => {}); // dismissed: Zed never answers
        const actions = ((params as { actions?: { title: string }[] }).actions ?? []);
        return actions.find((a) => a.title === answer) ?? null;
      }
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
      workspaceFolders: folders.map((f) => ({ uri: uriOf(f), name: path.basename(f) })),
      capabilities: {
        window: { workDoneProgress: true },
        workspace: { workspaceFolders: true, codeLens: { refreshSupport: true } },
        textDocument: { codeAction: {}, codeLens: {}, publishDiagnostics: {} },
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

  status() {
    return this.request<any[]>('playwright/status', {});
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
  }
}

export const MessageType = { Error: 1, Warning: 2, Info: 3, Log: 4 } as const;
