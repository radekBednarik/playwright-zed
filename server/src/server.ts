import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CodeAction,
  CodeActionKind,
  CodeLens,
  createConnection,
  InitializeParams,
  InitializeResult,
  InlayHint,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  ALL_COMMANDS,
  COMMAND_ENABLE_DISCOVERY,
  COMMAND_RERUN_LAST,
  COMMAND_RUN_AT_CURSOR,
  COMMAND_RUN_FILE,
  COMMAND_SELECT_ALL_PROJECTS,
  COMMAND_SHOW_LAST_RUN_OUTPUT,
  COMMAND_TOGGLE_PROJECT,
  countSelectedTests,
  resolveStepReporterPath,
  resolveTestLocation,
} from './commands';
import { runList } from './discovery';
import { allSelected, isTestSelected, parseProjectsSetting, resolveSelection, selectAll, toggleProject } from './selection';
import { readSelections, stateDir, writeSelection } from './store';
import { DISCOVERY_NOT_NOW, DISCOVERY_RUN, Reporter, failureLabel } from './reporting';
import { RunManager, summarize } from './runner';
import { applyEvent, clearFile, createMarks, endRun, hintsFor, startRun as beginMarks } from './marks';
import { formatRunLog, runLogFor, writeRunLog } from './output';
import { editorHasTrustGate } from './trust';
import type { DiscoveredTest, PlaywrightConfig, ProjectSelection, RunRequest, RunResult, RunTrigger, TestLocation, Workspace } from './types';
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
/** Feature 005: the `projects` default from the editor settings, null when absent. */
let settingsDefault: string[] | null = null;
/** True when the client answers `workspace/configuration` (feature 005 settings default). */
let clientSupportsConfiguration = false;
/** Avoids repeating the malformed-setting warning for the same value. */
let invalidSettingWarned = false;
/** Feature 006: the client opens files on `window/showDocument` (Zed does). */
let clientShowsDocuments = false;
/** Feature 006: the client requests `textDocument/inlayHint`; marks are pointless otherwise. */
let clientRequestsInlayHints = false;
/** Feature 006: the step reporter next to the built server files, or why it is unavailable. */
const stepReporter = resolveStepReporterPath();

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
    reconcileSelection(config);
  }
}

/**
 * Feature 005: reconciles the project selection with the reported project list after
 * discovery (data-model.md "Reconciliation"): the remembered choice from the per-user store,
 * else the settings default, else the first project. Notices are shown once per distinct
 * change; the store is never written here.
 */
function reconcileSelection(config: PlaywrightConfig): void {
  const stored = readStoredSelection(config.configPath);
  const { selection, notice } = resolveSelection(config.projects, stored?.projects ?? null, settingsDefault, stored?.updatedAt ?? null);
  config.selection = selection;
  logSelection(config);
  const key = `${notice.dropped.join(',')}|${notice.unknown.join(',')}`;
  const changed = key !== config.noticeKey;
  config.noticeKey = key;
  if (!changed) return;
  const name = path.basename(config.configPath);
  const names = selection.projects.join(', ');
  if (notice.dropped.length > 0) {
    reporter.showInfo(`Playwright: project(s) ${notice.dropped.join(', ')} no longer exist in ${name}; selection is now ${names}`);
  }
  if (notice.unknown.length > 0) {
    reporter.showWarning(
      `Playwright: setting "projects" names ${notice.unknown.join(', ')} which ${name} does not define; available: ${config.projects.join(', ')}`,
    );
  }
}

function readStoredSelection(configPath: string): { projects: string[]; updatedAt: string } | null {
  try {
    return readSelections(stateDir())[configPath] ?? null;
  } catch (error) {
    reporter.log(`playwright: could not read ${stateDir()}: ${(error as Error).message}`);
    return null;
  }
}

function persistSelection(config: PlaywrightConfig): void {
  try {
    writeSelection(stateDir(), config.configPath, config.selection.projects);
  } catch (error) {
    reporter.log(`playwright: could not remember the project selection in ${stateDir()}: ${(error as Error).message}`);
  }
}

function logSelection(config: PlaywrightConfig): void {
  reporter.info(`playwright: projects for ${config.configPath}: ${config.selection.projects.join(', ')} (${config.selection.source})`);
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
    marks: createMarks(),
    outputFile: null,
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
  clientSupportsConfiguration = params.capabilities.workspace?.configuration === true;
  clientShowsDocuments = params.capabilities.window?.showDocument?.support === true;
  clientRequestsInlayHints = params.capabilities.textDocument?.inlayHint !== undefined;
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
      inlayHintProvider: { resolveProvider: false },
      executeCommandProvider: { commands: ALL_COMMANDS },
      workspace: { workspaceFolders: { supported: true, changeNotifications: true } },
    },
  };
});

connection.onInitialized(() => {
  if (stepReporter.path === null) reporter.log(`playwright: step reporter unavailable (${stepReporter.reason}); step marks and durations are disabled`);
  if (!clientRequestsInlayHints) reporter.log('playwright: client does not request inlay hints; step marks will not be shown');
  void (async () => {
    await loadSettings();
    for (const { folder, fromWorkspaceFolders } of pendingFolders.splice(0)) await addWorkspace(folder, fromWorkspaceFolders);
  })();
  connection.onDidChangeConfiguration((change) => {
    void applySettings(change.settings);
  });
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
// Editor settings (feature 005): the `projects` default
// ---------------------------------------------------------------------------

/** Asks the client for the whole settings object once; clients without support have no default. */
async function loadSettings(): Promise<void> {
  if (!clientSupportsConfiguration) return;
  try {
    const value = (await connection.workspace.getConfiguration()) as unknown;
    await applySettings(value);
  } catch (error) {
    reporter.log(`playwright: could not read the editor settings: ${(error as Error).message}`);
  }
}

/**
 * Applies `{ projects: [...] }` from `workspace/configuration` or `didChangeConfiguration`.
 * Configs whose selection came from the default or from settings are re-resolved; remembered
 * and chosen selections keep.
 */
async function applySettings(value: unknown): Promise<void> {
  const raw = value && typeof value === 'object' ? (value as { projects?: unknown }).projects : undefined;
  const parsed = parseProjectsSetting(raw);
  if (parsed.invalid) {
    if (!invalidSettingWarned) reporter.showWarning('Playwright: setting "projects" must be a list of project names');
    invalidSettingWarned = true;
  } else {
    invalidSettingWarned = false;
  }
  const before = JSON.stringify(settingsDefault);
  settingsDefault = parsed.projects;
  if (before === JSON.stringify(settingsDefault)) return;
  reporter.info(`playwright: settings default projects: ${settingsDefault ? settingsDefault.join(', ') : 'none'}`);
  let changed = false;
  for (const ws of workspaces.values()) {
    if (ws.discovery !== 'enabled') continue;
    for (const config of ws.configs) {
      if (!config.supported || config.projects.length === 0) continue;
      if (config.selection.source !== 'default' && config.selection.source !== 'settings') continue;
      const previous = JSON.stringify(config.selection.projects);
      reconcileSelection(config);
      if (previous !== JSON.stringify(config.selection.projects)) changed = true;
    }
  }
  if (changed) await reporter.refreshCodeLenses();
}

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
  // Feature 006: the lines may have moved, so the file's step marks go.
  const marked = workspaceForFile(file);
  if (marked && (marked.marks.active.has(file) || marked.marks.finished.has(file))) {
    clearFile(marked.marks, file);
    reporter.refreshInlayHints();
  }
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

/** Tests of `config` in `file` that run in at least one selected project (feature 005). */
function selectedTests(config: PlaywrightConfig, file: string): DiscoveredTest[] {
  return config.tests.filter((t) => t.file === file && isTestSelected(t, config.selection));
}

/**
 * The config that owns any served document under its directory, when the workspace's discovery
 * is enabled. Used for the project picker, which need not be opened from a test file.
 */
function configForDocument(uri: string): { ws: Workspace; config: PlaywrightConfig } | null {
  const file = toPath(uri);
  if (!file) return null;
  const ws = workspaceForFile(file);
  if (!ws || ws.discovery !== 'enabled') return null;
  const config = configForFile(ws, file);
  return config ? { ws, config } : null;
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
    const location = resolveTestLocation(selectedTests(ctx.config, ctx.file), ctx.file, line0 + 1);
    if (location.kind === 'test') actions.push(action('Playwright: Run test at cursor', COMMAND_RUN_AT_CURSOR, [{ uri, line: line0 }]));
    else if (location.kind === 'describe') actions.push(action('Playwright: Run describe at cursor', COMMAND_RUN_AT_CURSOR, [{ uri, line: line0 }]));
    actions.push(action('Playwright: Run file', COMMAND_RUN_FILE, [{ uri }]));
  }
  if (ws?.lastRun) actions.push(action('Playwright: Re-run last', COMMAND_RERUN_LAST, [{ uri }]));
  // Feature 006: the run log, opened through window/showDocument.
  if (ws?.lastRun && ws.outputFile && clientShowsDocuments) actions.push(action('Playwright: Show last run output', COMMAND_SHOW_LAST_RUN_OUTPUT, [{ uri }]));
  // Feature 005: the project picker, one entry per project, from any served file of the config.
  const owner = configForDocument(uri);
  if (owner && owner.config.projects.length >= 2) {
    for (const name of owner.config.projects) {
      const on = owner.config.selection.projects.includes(name);
      actions.push(action(`Playwright: [${on ? 'x' : ' '}] ${name}`, COMMAND_TOGGLE_PROJECT, [{ uri, project: name }]));
    }
    if (!allSelected(owner.config.selection, owner.config.projects)) {
      actions.push(action('Playwright: Select all projects', COMMAND_SELECT_ALL_PROJECTS, [{ uri }]));
    }
  }
  return actions;
});

connection.onCodeLens((params) => {
  const uri = params.textDocument.uri;
  const { ctx } = testFileContext(uri);
  if (!ctx) return [];
  const lenses: CodeLens[] = [];
  const testLines = new Set<number>();
  const describeLines = new Set<number>();
  for (const test of selectedTests(ctx.config, ctx.file)) {
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

/**
 * Feature 006: one inlay hint per marked line of the document (contracts/run-feedback.md
 * section 2). Documents outside every workspace, closed documents and files without marks
 * answer an empty list.
 */
connection.languages.inlayHint.on((params): InlayHint[] => {
  const uri = params.textDocument.uri;
  const file = toPath(uri);
  const doc = documents.get(uri);
  if (!file || !doc) return [];
  const ws = workspaceForFile(file);
  if (!ws) return [];
  const lineLengths = doc.getText().split('\n').map((line) => line.replace(/\r$/, '').length);
  return hintsFor(ws.marks, file, lineLengths, params.range).map((hint) => ({
    position: { line: hint.line, character: hint.character },
    label: hint.label,
    paddingLeft: true,
  }));
});

/** Writes the run log, logging instead of failing when the state directory is unusable. */
function writeLog(ws: Workspace, request: RunRequest, result: RunResult | null, finishedAt: string | null): void {
  if (!ws.outputFile) return;
  try {
    writeRunLog(ws.outputFile, formatRunLog(request, result, finishedAt));
  } catch (error) {
    reporter.log(`playwright: run ${request.id} could not write the run log ${ws.outputFile}: ${(error as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function startRun(ws: Workspace, location: TestLocation, config: PlaywrightConfig, trigger: RunTrigger): Promise<void> {
  const displayFile = path.relative(config.configDir, location.file);
  const target = location.line === null ? displayFile : `${displayFile}:${location.line}`;
  const multiProject = config.projects.length >= 2;
  // Count of discovered specs in the target that run in a selected project (feature 005).
  const count = countSelectedTests(config.tests, location, config.selection);
  if (count === 0 && multiProject) {
    reporter.showWarning(
      `Playwright: no tests in ${target} run in the selected project(s) ${config.selection.projects.join(', ')}; change the selection from the code actions menu.`,
    );
    return;
  }

  const manager = managerFor(ws);
  const uri = pathToFileURL(location.file).toString();
  const dirty = dirtyUris.has(uri);
  const request: RunRequest = { id: manager.nextId(), location, config, trigger, startedAt: new Date().toISOString(), dirty, projects: [...config.selection.projects] };
  ws.lastRun = request;
  // Feature 006: marks and the run log belong to the newest run only (current run id guard).
  beginMarks(ws.marks, request.id);
  reporter.refreshInlayHints();
  ws.outputFile = runLogFor(ws.rootPath);
  writeLog(ws, request, null, null);

  if (dirty) reporter.showWarning(`${displayFile} has unsaved changes; running the saved version`);

  const previouslyPublished = publishedFiles.get(ws.rootPath) ?? new Set<string>();
  reporter.clearDiagnostics(new Set([location.file, ...previouslyPublished]));
  publishedFiles.delete(ws.rootPath);

  const progress = await reporter.progressBegin(request.id, count, displayFile, multiProject ? request.projects : []);
  reporter.log(`playwright: run ${request.id} (${trigger}, ${location.kind}) ${target} projects: ${request.projects.join(', ')}`);
  if (stepReporter.path === null) reporter.log(`playwright: run ${request.id} step reporter unavailable (${stepReporter.reason})`);

  const result = await manager.start(request, {
    reporterPath: stepReporter.path,
    onStepEvent: (event) => {
      applyEvent(ws.marks, event, request.id);
      reporter.refreshInlayHints();
    },
  });
  reporter.log(`playwright: run ${request.id} command: ${result.command}\nplaywright: run ${request.id} cwd: ${config.configDir}\n${result.rawOutput.trimEnd()}`);
  endRun(ws.marks, request.id);
  reporter.refreshInlayHints();
  if (ws.lastRun?.id === request.id) {
    writeLog(ws, request, result, new Date().toISOString());
    reporter.log(`playwright: run ${request.id} output written to ${ws.outputFile}`);
    if (!clientShowsDocuments) reporter.log(`playwright: run ${request.id} output not offered (client has no showDocument support)`);
  } else {
    reporter.log(`playwright: run ${request.id} superseded, output not written`);
  }

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
      reporter.showError(`Playwright: ${summarize(result.counts, result.durationMs)}${first ? `\n${failureLabel(first)}: ${first.fullMessage}` : ''}`);
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
  const location = resolveTestLocation(selectedTests(ctx.config, ctx.file), ctx.file, line0 + 1);
  await startRun(ctx.ws, location, ctx.config, 'cursor');
}

async function runFile(uri: string): Promise<void> {
  const gated = gatedWorkspace(uri);
  if (gated) return refuseNotEnabled(gated);
  const { ctx } = testFileContext(uri);
  if (!ctx) return notPlaywright(uri);
  await startRun(ctx.ws, { kind: 'file', file: ctx.file, line: null }, ctx.config, 'file');
}

/** The document's workspace when it has a run, else the workspace with the most recent run. */
function workspaceWithLatestRun(uri?: string): Workspace | null {
  let ws: Workspace | null = null;
  const file = uri ? toPath(uri) : null;
  if (file) ws = workspaceForFile(file);
  if (!ws?.lastRun) {
    ws = null;
    for (const candidate of workspaces.values()) {
      if (candidate.lastRun && (!ws || candidate.lastRun.startedAt > (ws.lastRun as RunRequest).startedAt)) ws = candidate;
    }
  }
  return ws;
}

/** Feature 006: opens the latest run's log through `window/showDocument`. */
async function showLastRunOutput(uri?: string): Promise<void> {
  const ws = workspaceWithLatestRun(uri);
  if (!ws?.lastRun || !ws.outputFile) {
    reporter.showInfo('Playwright: no run output yet');
    return;
  }
  const opened = await reporter.showDocument(pathToFileURL(ws.outputFile).toString());
  if (!opened) reporter.showWarning(`Playwright: could not open the run output; it is at ${ws.outputFile}`);
}

async function rerunLast(uri?: string): Promise<void> {
  const gated = uri ? gatedWorkspace(uri) : null;
  if (gated) return refuseNotEnabled(gated);
  const ws = workspaceWithLatestRun(uri);
  if (!ws?.lastRun) {
    reporter.showInfo('Nothing to re-run yet');
    return;
  }
  const { location, config } = ws.lastRun;
  await startRun(ws, location, config, 'rerun');
}

/**
 * Feature 005: applies a new selection, logs it, remembers it, refreshes lenses and confirms
 * the new state in a notification. The notification matters in Zed: its code action menu is
 * cached per cursor position and refetched only when the cursor moves or the buffer changes
 * (`crates/editor/src/code_actions.rs`), so reopening the menu at the same spot still shows
 * the check marks from before the toggle.
 */
async function applySelectionChange(config: PlaywrightConfig, selection: ProjectSelection): Promise<void> {
  config.selection = selection;
  logSelection(config);
  persistSelection(config);
  reporter.showInfo(`Playwright: projects for ${path.basename(config.configPath)}: ${selection.projects.join(', ')}`);
  await reporter.refreshCodeLenses();
}

async function toggleProjectCommand(uri: string, project: string): Promise<void> {
  const gated = gatedWorkspace(uri);
  if (gated) return refuseNotEnabled(gated);
  const owner = configForDocument(uri);
  if (!owner) return notPlaywright(uri);
  const result = toggleProject(owner.config.selection, owner.config.projects, project);
  if (!result.ok) {
    reporter.showWarning(
      result.refusal === 'last'
        ? 'Playwright: at least one project must stay selected'
        : `Playwright: ${project} is not a project of ${path.basename(owner.config.configPath)}`,
    );
    return;
  }
  await applySelectionChange(owner.config, result.selection);
}

async function selectAllProjectsCommand(uri: string): Promise<void> {
  const gated = gatedWorkspace(uri);
  if (gated) return refuseNotEnabled(gated);
  const owner = configForDocument(uri);
  if (!owner) return notPlaywright(uri);
  await applySelectionChange(owner.config, selectAll(owner.config.projects));
}

connection.onExecuteCommand(async (params) => {
  const arg = (params.arguments?.[0] ?? {}) as { uri?: string; line?: number; project?: string };
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
      case COMMAND_SHOW_LAST_RUN_OUTPUT:
        await showLastRunOutput(arg.uri);
        break;
      case COMMAND_TOGGLE_PROJECT:
        if (typeof arg.uri === 'string' && typeof arg.project === 'string') await toggleProjectCommand(arg.uri, arg.project);
        else reporter.showError('Playwright: toggle project needs a document and a project name');
        break;
      case COMMAND_SELECT_ALL_PROJECTS:
        if (typeof arg.uri === 'string') await selectAllProjectsCommand(arg.uri);
        else reporter.showError('Playwright: select all projects needs a document');
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
    outputFile: ws.outputFile,
    marks: {
      runId: ws.marks.runId,
      active: Array.from(ws.marks.active, ([file, lines]) => Array.from(lines, ([line, count]) => ({ file, line, count }))).flat(),
      finished: Array.from(ws.marks.finished, ([file, lines]) => Array.from(lines, ([line, mark]) => ({ file, line, ...mark }))).flat(),
    },
    configs: ws.configs.map((c) => ({
      configPath: c.configPath,
      playwrightVersion: formatVersion(c.playwrightVersion),
      supported: c.supported,
      rootDir: c.rootDir,
      testDirs: c.testDirs,
      discoveryState: c.discoveryState,
      testCount: c.tests.length,
      projects: c.projects,
      selectedProjects: c.selection.projects,
      selectionSource: c.selection.source,
    })),
  })),
);

documents.listen(connection);
connection.listen();
