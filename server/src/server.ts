import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CodeAction,
  CodeActionKind,
  CodeLens,
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ALL_COMMANDS, COMMAND_ENABLE_DISCOVERY, COMMAND_RERUN_LAST, COMMAND_RUN_AT_CURSOR, COMMAND_RUN_FILE, countSelectedTests, resolveTestLocation } from './commands';
import { runList } from './discovery';
import { DISCOVERY_NOT_NOW, DISCOVERY_RUN, Reporter } from './reporting';
import { RunManager, summarize } from './runner';
import { editorHasTrustGate } from './trust';
import type { PlaywrightConfig, RunRequest, RunTrigger, TestLocation, Workspace } from './types';
import { formatVersion } from './version';
import { buildConfig, configForFile, findConfigs, isConfigFile, isUnderTestDirs } from './workspace';

const CODE_ACTION_KIND = 'source.playwright';
const STATUS_REQUEST = 'playwright/status';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const reporter = new Reporter(connection);

const workspaces = new Map<string, Workspace>();
const runManagers = new Map<string, RunManager>();
/** Files that currently carry `playwright` diagnostics, per workspace root. */
const publishedFiles = new Map<string, Set<string>>();
/** Document version at last open or save; used for the dirty flag. */
const savedVersion = new Map<string, number>();
const dirtyUris = new Set<string>();
/** Folders received in `initialize`, discovered after `initialized`. */
const pendingFolders: { folder: WorkspaceFolder; fromWorkspaceFolders: boolean }[] = [];
/** Feature 003: the client is a Zed release that starts this server only in trusted folders. */
let editorTrustGate = false;
/** Client name and version for log lines, from `initialize.params.clientInfo`. */
let clientLabel = 'the editor';

function toPath(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

function isWithin(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function workspaceForFile(file: string): Workspace | null {
  let best: Workspace | null = null;
  for (const ws of workspaces.values()) {
    if (isWithin(ws.rootPath, file) && (!best || ws.rootPath.length > best.rootPath.length)) best = ws;
  }
  return best;
}

function managerFor(ws: Workspace): RunManager {
  let manager = runManagers.get(ws.rootPath);
  if (!manager) {
    manager = new RunManager();
    runManagers.set(ws.rootPath, manager);
  }
  return manager;
}

async function discoverConfig(config: PlaywrightConfig): Promise<void> {
  const error = await runList(config);
  if (error) {
    reporter.log(`playwright: test discovery failed for ${config.configPath}\n${error}`);
    reporter.showWarning(`Playwright: test discovery failed for ${path.basename(config.configPath)}; see the language server log for the command and error.`);
  } else {
    reporter.info(`playwright: discovered ${config.tests.length} test(s) via ${config.configPath}`);
  }
}

async function discoverWorkspace(ws: Workspace): Promise<void> {
  ws.configs = [];
  for (const configPath of findConfigs(ws.rootPath)) {
    const config = buildConfig(configPath);
    if (!config) {
      reporter.info(`playwright: ${configPath} has no @playwright/test package nearby; ignoring it`);
      continue;
    }
    ws.configs.push(config);
  }
  if (ws.configs.length === 0) {
    reporter.info(`playwright: no Playwright configuration found in ${ws.rootPath}`);
  }
  warnUnsupported(ws);
  if (!hasSupportedConfig(ws)) return;
  if (ws.discovery === 'enabled') {
    await discoverEnabled(ws);
    return;
  }
  // Feature 002: nothing from the workspace runs until the developer agrees. The prompt may
  // never be answered (Zed does not respond to a dismissed notification), so it is not awaited.
  if (ws.discovery === 'pending' && !ws.discoveryAsked) {
    ws.discoveryAsked = true;
    void askForDiscovery(ws);
  }
}

/** Shows the unsupported-version warning once per workspace; reading the version runs no code. */
function warnUnsupported(ws: Workspace): void {
  const unsupported = ws.configs.find((c) => !c.supported);
  if (unsupported && !ws.versionWarningShown) {
    ws.versionWarningShown = true;
    reporter.showWarning(
      `Playwright ${formatVersion(unsupported.playwrightVersion)} found; v1.38 or newer is required. Test running is disabled.`,
    );
  }
}

function hasSupportedConfig(ws: Workspace): boolean {
  return ws.configs.some((c) => c.supported);
}

function isCurrent(ws: Workspace): boolean {
  return workspaces.get(ws.rootPath) === ws;
}

/** Runs `--list` for every supported config of an enabled workspace, then refreshes lenses. */
async function discoverEnabled(ws: Workspace): Promise<void> {
  for (const config of ws.configs) {
    if (config.supported) await discoverConfig(config);
  }
  await reporter.refreshCodeLenses();
}

/** Idempotent: marks the workspace enabled and runs discovery once. */
async function enableDiscovery(ws: Workspace): Promise<void> {
  if (ws.discovery === 'enabled') return;
  ws.discovery = 'enabled';
  ws.discoverySource = 'answer';
  reporter.info(`playwright: test discovery enabled for ${ws.rootPath}`);
  await discoverEnabled(ws);
}

async function askForDiscovery(ws: Workspace): Promise<void> {
  const folderName = path.basename(ws.rootPath);
  reporter.info(
    editorTrustGate
      ? `playwright: asking before discovery in ${ws.rootPath}; the folder was not reported as a workspace folder, so Zed's trust cannot be assumed for it`
      : `playwright: asking before discovery in ${ws.rootPath}; ${clientLabel} is not known to gate language servers on folder trust`,
  );
  let answer: string | null;
  try {
    answer = await reporter.askDiscovery(folderName, ws.rootPath);
  } catch (error) {
    if (!isCurrent(ws) || ws.discovery !== 'pending') return;
    ws.discovery = 'declined';
    reporter.info(`playwright: discovery question could not be shown for ${ws.rootPath}: ${(error as Error).message}`);
    reporter.showWarning(discoveryOffMessage(folderName));
    return;
  }
  if (!isCurrent(ws)) return;
  if (answer === DISCOVERY_RUN) {
    await enableDiscovery(ws);
  } else if (answer === DISCOVERY_NOT_NOW || answer === null) {
    if (ws.discovery === 'pending') ws.discovery = 'declined';
  }
}

function discoveryOffMessage(folderName: string): string {
  return `Playwright test discovery is off for ${folderName}; use "Playwright: Enable test discovery" from the code actions menu to turn it on.`;
}

/** The workspace for `uri` when it has Playwright but discovery is not enabled, else null. */
function gatedWorkspace(uri: string): Workspace | null {
  const file = toPath(uri);
  const ws = file ? workspaceForFile(file) : null;
  if (!ws || ws.discovery === 'enabled' || !hasSupportedConfig(ws)) return null;
  return ws;
}

function refuseNotEnabled(ws: Workspace): void {
  const folderName = path.basename(ws.rootPath);
  if (ws.discovery === 'declined') {
    reporter.showWarning(`Playwright test discovery is disabled for ${folderName}; use "Playwright: Enable test discovery" from the code actions menu to turn it on.`);
  } else {
    reporter.showWarning(`Playwright test discovery has not been enabled for ${folderName}; answer the discovery question or use "Playwright: Enable test discovery" from the code actions menu.`);
  }
}

async function addWorkspace(folder: WorkspaceFolder, fromWorkspaceFolders: boolean): Promise<void> {
  const rootPath = toPath(folder.uri);
  if (!rootPath) return;
  const ws: Workspace = {
    rootUri: folder.uri,
    rootPath,
    configs: [],
    lastRun: null,
    versionWarningShown: false,
    discovery: 'pending',
    discoveryAsked: false,
    discoverySource: null,
    fromWorkspaceFolders,
  };
  // Zed 0.218+ starts this server only in trusted worktrees, so its trust stands in for the
  // question; a rootUri fallback was never reported as a worktree (research R2, R3). Only
  // clientInfo and the folder's origin decide, never anything inside the workspace.
  if (editorTrustGate && fromWorkspaceFolders) {
    ws.discovery = 'enabled';
    ws.discoverySource = 'editor-trust';
    reporter.info(
      `playwright: Zed trusts ${rootPath}; test discovery enabled without asking (${clientLabel} starts language servers only in trusted folders)`,
    );
  }
  workspaces.set(rootPath, ws);
  await discoverWorkspace(ws);
}

function removeWorkspace(folder: WorkspaceFolder): void {
  const rootPath = toPath(folder.uri);
  if (!rootPath) return;
  runManagers.get(rootPath)?.cancelActive();
  workspaces.delete(rootPath);
  runManagers.delete(rootPath);
  publishedFiles.delete(rootPath);
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  editorTrustGate = editorHasTrustGate(params.clientInfo);
  if (params.clientInfo) clientLabel = `${params.clientInfo.name} ${params.clientInfo.version ?? ''}`.trim();
  if (params.workspaceFolders) {
    pendingFolders.push(...params.workspaceFolders.map((folder) => ({ folder, fromWorkspaceFolders: true })));
  } else if (params.rootUri) {
    pendingFolders.push({ folder: { uri: params.rootUri, name: 'root' }, fromWorkspaceFolders: false });
  }
  return {
    capabilities: {
      textDocumentSync: { openClose: true, change: TextDocumentSyncKind.Incremental, save: { includeText: false } },
      codeActionProvider: { codeActionKinds: [CODE_ACTION_KIND] },
      codeLensProvider: { resolveProvider: false },
      executeCommandProvider: { commands: ALL_COMMANDS },
      workspace: { workspaceFolders: { supported: true, changeNotifications: true } },
    },
  };
});

connection.onInitialized(() => {
  void (async () => {
    for (const { folder, fromWorkspaceFolders } of pendingFolders.splice(0)) await addWorkspace(folder, fromWorkspaceFolders);
  })();
  try {
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const folder of event.removed) removeWorkspace(folder);
      void (async () => {
        for (const folder of event.added) await addWorkspace(folder, true);
      })();
    });
  } catch {
    // client does not support workspace folder notifications
  }
});

// ---------------------------------------------------------------------------
// Document tracking: dirty flag and diagnostics clearing on edit
// ---------------------------------------------------------------------------

documents.onDidOpen((event) => {
  savedVersion.set(event.document.uri, event.document.version);
  dirtyUris.delete(event.document.uri);
});

documents.onDidChangeContent((event) => {
  const uri = event.document.uri;
  const saved = savedVersion.get(uri);
  if (saved === undefined || event.document.version === saved) return;
  dirtyUris.add(uri);
  const file = toPath(uri);
  if (!file) return;
  for (const [root, files] of publishedFiles) {
    if (files.delete(file)) {
      reporter.clearDiagnosticsForUri(uri);
      if (files.size === 0) publishedFiles.delete(root);
    }
  }
});

documents.onDidSave((event) => {
  const uri = event.document.uri;
  savedVersion.set(uri, event.document.version);
  dirtyUris.delete(uri);
  const file = toPath(uri);
  if (!file) return;
  const ws = workspaceForFile(file);
  if (!ws) return;
  void (async () => {
    let changed = false;
    if (isConfigFile(file) && !ws.configs.some((c) => c.configPath === file)) {
      const added = buildConfig(file);
      if (added) {
        ws.configs.push(added);
        warnUnsupported(ws);
        if (added.supported && ws.discovery === 'enabled') {
          await discoverConfig(added);
          changed = true;
        }
      }
    }
    if (ws.discovery !== 'enabled') return;
    for (const config of ws.configs) {
      if (!config.supported) continue;
      if (file === config.configPath || isUnderTestDirs(config, file)) {
        await discoverConfig(config);
        changed = true;
      }
    }
    if (changed) await reporter.refreshCodeLenses();
  })();
});

documents.onDidClose((event) => {
  savedVersion.delete(event.document.uri);
  dirtyUris.delete(event.document.uri);
});

// ---------------------------------------------------------------------------
// Affordances: code actions and code lenses
// ---------------------------------------------------------------------------

interface TestFileContext {
  ws: Workspace;
  config: PlaywrightConfig;
  file: string;
}

function testFileContext(uri: string): { ws: Workspace | null; ctx: TestFileContext | null } {
  const file = toPath(uri);
  if (!file) return { ws: null, ctx: null };
  const ws = workspaceForFile(file);
  if (!ws) return { ws: null, ctx: null };
  if (ws.discovery !== 'enabled') return { ws, ctx: null };
  const config = configForFile(ws, file);
  if (!config || !config.tests.some((t) => t.file === file)) return { ws, ctx: null };
  return { ws, ctx: { ws, config, file } };
}

function action(title: string, command: string, args: unknown[]): CodeAction {
  return { title, kind: CODE_ACTION_KIND as CodeActionKind, command: { title, command, arguments: args } };
}

connection.onCodeAction((params) => {
  const uri = params.textDocument.uri;
  const gated = gatedWorkspace(uri);
  if (gated) return [action('Playwright: Enable test discovery', COMMAND_ENABLE_DISCOVERY, [{ uri }])];
  const { ws, ctx } = testFileContext(uri);
  const actions: CodeAction[] = [];
  if (ctx) {
    const line0 = params.range.start.line;
    const location = resolveTestLocation(ctx.config.tests, ctx.file, line0 + 1);
    if (location.kind === 'test') actions.push(action('Playwright: Run test at cursor', COMMAND_RUN_AT_CURSOR, [{ uri, line: line0 }]));
    else if (location.kind === 'describe') actions.push(action('Playwright: Run describe at cursor', COMMAND_RUN_AT_CURSOR, [{ uri, line: line0 }]));
    actions.push(action('Playwright: Run file', COMMAND_RUN_FILE, [{ uri }]));
  }
  if (ws?.lastRun) actions.push(action('Playwright: Re-run last', COMMAND_RERUN_LAST, [{ uri }]));
  return actions;
});

connection.onCodeLens((params) => {
  const uri = params.textDocument.uri;
  const { ctx } = testFileContext(uri);
  if (!ctx) return [];
  const lenses: CodeLens[] = [];
  const testLines = new Set<number>();
  const describeLines = new Set<number>();
  for (const test of ctx.config.tests) {
    if (test.file !== ctx.file) continue;
    testLines.add(test.line);
    for (const d of test.describeLines) describeLines.add(d);
  }
  const lens = (line: number, title: string): CodeLens => ({
    range: { start: { line: line - 1, character: 0 }, end: { line: line - 1, character: 0 } },
    command: { title, command: COMMAND_RUN_AT_CURSOR, arguments: [{ uri, line: line - 1 }] },
  });
  for (const line of describeLines) lenses.push(lens(line, '▶ Run describe'));
  for (const line of testLines) lenses.push(lens(line, '▶ Run test'));
  lenses.sort((a, b) => a.range.start.line - b.range.start.line);
  return lenses;
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function startRun(ws: Workspace, location: TestLocation, config: PlaywrightConfig, trigger: RunTrigger): Promise<void> {
  const manager = managerFor(ws);
  const uri = pathToFileURL(location.file).toString();
  const dirty = dirtyUris.has(uri);
  const request: RunRequest = { id: manager.nextId(), location, config, trigger, startedAt: new Date().toISOString(), dirty };
  ws.lastRun = request;

  const displayFile = path.relative(config.configDir, location.file);
  if (dirty) reporter.showWarning(`${displayFile} has unsaved changes; running the saved version`);

  const previouslyPublished = publishedFiles.get(ws.rootPath) ?? new Set<string>();
  reporter.clearDiagnostics(new Set([location.file, ...previouslyPublished]));
  publishedFiles.delete(ws.rootPath);

  const count = countSelectedTests(config.tests, location);
  const progress = await reporter.progressBegin(request.id, count, displayFile);
  const target = location.line === null ? displayFile : `${displayFile}:${location.line}`;
  reporter.log(`playwright: run ${request.id} (${trigger}, ${location.kind}) ${target}`);

  const result = await manager.start(request);
  reporter.log(`playwright: run ${request.id} command: ${result.command}\nplaywright: run ${request.id} cwd: ${config.configDir}\n${result.rawOutput.trimEnd()}`);

  switch (result.status) {
    case 'cancelled':
      reporter.progressEnd(request.id, progress, 'cancelled');
      reporter.showWarning(`Playwright run of ${target} was cancelled by a newer run`);
      return;
    case 'error':
      reporter.progressEnd(request.id, progress, 'error');
      reporter.showError(`Playwright could not run ${target}.\nCommand: ${result.command}\n${result.errorMessage ?? 'unknown error'}`);
      return;
    case 'passed':
      reporter.progressEnd(request.id, progress, summarize(result.counts, result.durationMs));
      reporter.showInfo(`Playwright: ${summarize(result.counts, result.durationMs)}`);
      return;
    case 'failed': {
      reporter.progressEnd(request.id, progress, summarize(result.counts, result.durationMs));
      const first = result.failures[0];
      reporter.showError(`Playwright: ${summarize(result.counts, result.durationMs)}${first ? `\n${first.title}: ${first.fullMessage}` : ''}`);
      const files = reporter.publishFailures(result.failures);
      if (files.length > 0) publishedFiles.set(ws.rootPath, new Set(files));
      return;
    }
    default:
      return;
  }
}

/**
 * Explains why a run cannot happen: the file is not a discovered test file of a supported config,
 * the config's Playwright is below v1.38, or no Playwright exists for the file at all.
 */
function notPlaywright(uri: string): void {
  const file = toPath(uri) ?? uri;
  const ws = toPath(uri) ? workspaceForFile(file) : null;
  const supported = ws ? configForFile(ws, file) : null;
  if (supported) {
    reporter.showWarning(
      `Playwright: ${path.basename(file)} is not a test file of ${path.basename(supported.configPath)}; run from a file that Playwright lists for that configuration.`,
    );
    return;
  }
  const unsupported = ws?.configs.find((c) => !c.supported && isWithin(c.configDir, file));
  if (unsupported) {
    reporter.showWarning(
      `Playwright ${formatVersion(unsupported.playwrightVersion)} found; v1.38 or newer is required. Test running is disabled.`,
    );
    return;
  }
  reporter.showWarning(`Playwright was not found in the workspace for ${path.basename(file)}; install @playwright/test (v1.38 or newer) and add a playwright.config file.`);
}

async function runAtCursor(uri: string, line0: number): Promise<void> {
  const gated = gatedWorkspace(uri);
  if (gated) return refuseNotEnabled(gated);
  const { ctx } = testFileContext(uri);
  if (!ctx) return notPlaywright(uri);
  const location = resolveTestLocation(ctx.config.tests, ctx.file, line0 + 1);
  await startRun(ctx.ws, location, ctx.config, 'cursor');
}

async function runFile(uri: string): Promise<void> {
  const gated = gatedWorkspace(uri);
  if (gated) return refuseNotEnabled(gated);
  const { ctx } = testFileContext(uri);
  if (!ctx) return notPlaywright(uri);
  await startRun(ctx.ws, { kind: 'file', file: ctx.file, line: null }, ctx.config, 'file');
}

async function rerunLast(uri?: string): Promise<void> {
  const gated = uri ? gatedWorkspace(uri) : null;
  if (gated) return refuseNotEnabled(gated);
  let ws: Workspace | null = null;
  const file = uri ? toPath(uri) : null;
  if (file) ws = workspaceForFile(file);
  if (!ws?.lastRun) {
    ws = null;
    for (const candidate of workspaces.values()) {
      if (candidate.lastRun && (!ws || candidate.lastRun.startedAt > (ws.lastRun as RunRequest).startedAt)) ws = candidate;
    }
  }
  if (!ws?.lastRun) {
    reporter.showInfo('Nothing to re-run yet');
    return;
  }
  const { location, config } = ws.lastRun;
  await startRun(ws, location, config, 'rerun');
}

connection.onExecuteCommand(async (params) => {
  const arg = (params.arguments?.[0] ?? {}) as { uri?: string; line?: number };
  try {
    switch (params.command) {
      case COMMAND_RUN_AT_CURSOR:
        if (typeof arg.uri === 'string' && typeof arg.line === 'number') await runAtCursor(arg.uri, arg.line);
        else reporter.showError('Playwright: run at cursor needs a document and a line');
        break;
      case COMMAND_RUN_FILE:
        if (typeof arg.uri === 'string') await runFile(arg.uri);
        else reporter.showError('Playwright: run file needs a document');
        break;
      case COMMAND_RERUN_LAST:
        await rerunLast(arg.uri);
        break;
      case COMMAND_ENABLE_DISCOVERY: {
        const file = typeof arg.uri === 'string' ? toPath(arg.uri) : null;
        const ws = file ? workspaceForFile(file) : null;
        if (!ws) reporter.showWarning(`Playwright was not found in the workspace for ${file ? path.basename(file) : 'this document'}`);
        else await enableDiscovery(ws);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    reporter.showError(`Playwright command ${params.command} failed: ${(error as Error).message}`);
  }
  return null;
});

/** Debug request used by tests and troubleshooting: a snapshot of detected workspaces. */
connection.onRequest(STATUS_REQUEST, () =>
  Array.from(workspaces.values()).map((ws) => ({
    rootPath: ws.rootPath,
    discovery: ws.discovery,
    discoveryAsked: ws.discoveryAsked,
    discoverySource: ws.discoverySource,
    editorTrustGate,
    lastRun: ws.lastRun ? { id: ws.lastRun.id, location: ws.lastRun.location, trigger: ws.lastRun.trigger } : null,
    configs: ws.configs.map((c) => ({
      configPath: c.configPath,
      playwrightVersion: formatVersion(c.playwrightVersion),
      supported: c.supported,
      rootDir: c.rootDir,
      testDirs: c.testDirs,
      discoveryState: c.discoveryState,
      testCount: c.tests.length,
    })),
  })),
);

documents.listen(connection);
connection.listen();
