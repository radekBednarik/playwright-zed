import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG, FAILING, FIXTURE, MessageType, PASSING, SPEC_SOURCE, TestClient, configSource, removeTempProjects, trackTempDir, uriOf } from './helpers';

const TOGGLE = 'playwright.toggleProject';
const SELECT_ALL = 'playwright.selectAllProjects';
const RUN_AT_CURSOR = 'playwright.runAtCursor';
const RUN_FILE = 'playwright.runFile';
const SELECT_ALL_TITLE = 'Playwright: Select all projects';
const L = { adds: 2 };

const SUMMARY = /(\d+) passed, (\d+) failed, (\d+) skipped/;

function projectTitles(actions: any[]): string[] {
    return actions.map((a) => a.title as string).filter((t) => (t.startsWith('Playwright: [') && !t.includes('Show trace viewer')) || t === SELECT_ALL_TITLE);
}

function runCommandLine(client: TestClient): string {
  const lines = client.messages('window/logMessage').map((m) => m.params.message as string);
  const line = lines.find((m) => /^playwright: run \d+ command: /.test(m));
  return line ?? '';
}

async function finishedSummary(client: TestClient): Promise<{ passed: number; failed: number; skipped: number }> {
  await client.waitFor('$/progress', (p) => p.value?.kind === 'end');
  const message = [...client.showMessages(MessageType.Info), ...client.showMessages(MessageType.Error)].find((m) => SUMMARY.test(m));
  const match = SUMMARY.exec(message ?? '');
  if (!match) throw new Error(`no summary in ${JSON.stringify(client.showMessages())}`);
  return { passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]) };
}

describe('project selection in the fixture (US1)', () => {
  let client: TestClient;

  beforeAll(async () => {
    client = await TestClient.start(FIXTURE);
    await client.waitForDiscovery();
  });
  afterAll(async () => {
    await client.stop();
  });
  beforeEach(() => client.clear());

  it('(a) lists the projects after the run actions, first project selected', async () => {
    const actions = await client.codeActions(PASSING, L.adds);
    const titles = actions.map((a) => a.title as string);
    expect(titles.slice(-3)).toEqual(['Playwright: [x] chromium', 'Playwright: [ ] mobile', SELECT_ALL_TITLE]);
    expect(titles.indexOf('Playwright: Run test at cursor')).toBeLessThan(titles.indexOf('Playwright: [x] chromium'));
    const mobile = actions.find((a) => a.title === 'Playwright: [ ] mobile');
    expect(mobile.command).toMatchObject({ command: TOGGLE, arguments: [{ uri: uriOf(PASSING), project: 'mobile' }] });
    const all = actions.find((a) => a.title === SELECT_ALL_TITLE);
    expect(all.command).toMatchObject({ command: SELECT_ALL, arguments: [{ uri: uriOf(PASSING) }] });
  });

  it('(b) toggling mobile on refreshes lenses and the menu', async () => {
    await client.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'mobile' }]);
    await client.waitFor('workspace/codeLens/refresh');
    const status = await client.status();
    expect(status[0].configs[0]).toMatchObject({ selectedProjects: ['chromium', 'mobile'], selectionSource: 'chosen' });
    // Zed caches the code action menu per cursor position, so the new state is also announced
    expect(client.showMessages(MessageType.Info)).toEqual(['Playwright: projects for playwright.config.ts: chromium, mobile']);
    const titles = projectTitles(await client.codeActions(PASSING, L.adds));
    expect(titles).toEqual(['Playwright: [x] chromium', 'Playwright: [x] mobile']);
  });

  it('(c) runs a test in both selected projects', async () => {
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    const begin = await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    expect(begin.value.message).toBe('Running 1 test(s) in tests/passing.spec.ts (chromium, mobile)');
    expect(await finishedSummary(client)).toEqual({ passed: 2, failed: 0, skipped: 0 });
    // both of the two projects are selected, so no filter is sent (FR-005)
    expect(runCommandLine(client)).not.toContain('--project');
  });

  it('(d) toggling chromium off leaves mobile alone', async () => {
    await client.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'chromium' }]);
    await client.waitFor('workspace/codeLens/refresh');
    client.clear();
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: L.adds }]);
    expect(await finishedSummary(client)).toEqual({ passed: 1, failed: 0, skipped: 0 });
    const line = runCommandLine(client);
    expect(line).toContain('--project mobile');
    expect(line).not.toContain('--project chromium');
  });

  it('(e) refuses to deselect the last project', async () => {
    await client.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'mobile' }]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toBe('Playwright: at least one project must stay selected');
    expect(client.showMessages(MessageType.Info)).toEqual([]);
    const status = await client.status();
    expect(status[0].configs[0]).toMatchObject({ selectedProjects: ['mobile'], selectionSource: 'chosen' });
  });

  it('(f) select all runs the file without a project filter', async () => {
    await client.execute(SELECT_ALL, [{ uri: uriOf(PASSING) }]);
    await client.waitFor('workspace/codeLens/refresh');
    expect(projectTitles(await client.codeActions(PASSING, L.adds))).toEqual(['Playwright: [x] chromium', 'Playwright: [x] mobile']);
    expect(client.showMessages(MessageType.Info)).toEqual(['Playwright: projects for playwright.config.ts: chromium, mobile']);
    client.clear();
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    const begin = await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
    expect(begin.value.message).toBe('Running 12 test(s) in tests/passing.spec.ts (chromium, mobile)');
    const counts = await finishedSummary(client);
    // 12 specs in each of two projects; TodoMVC on the mobile emulation is not asserted (research R8)
    expect(counts.passed + counts.failed + counts.skipped).toBe(24);
    expect(runCommandLine(client)).not.toContain('--project');
  });

  it('(g) refuses an unknown project name', async () => {
    await client.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'nope' }]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('nope is not a project of playwright.config.ts');
  });

  it('(i) names the project in each diagnostic and in the error notification', async () => {
    // both projects are still selected after (f)
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(FAILING), line: 2 }]);
    const error = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Error);
    expect(error.message).toContain('2 failed');
    expect(error.message).toContain('[chromium] fails on purpose: ');
    const published = client.messages('textDocument/publishDiagnostics').filter((m) => m.params.uri === uriOf(FAILING) && m.params.diagnostics.length > 0);
    const messages = published.flatMap((m) => m.params.diagnostics.map((d: any) => d.message as string)).sort();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatch(/^\[chromium\] fails on purpose: /);
    expect(messages[1]).toMatch(/^\[mobile\] fails on purpose: /);
    expect(published.flatMap((m) => m.params.diagnostics.map((d: any) => d.range.start.line))).toEqual([3, 3]);
  });

  it('(h) offers the picker from the config file but not outside the workspace', async () => {
    await client.open(CONFIG);
    const fromConfig = projectTitles(await client.codeActions(CONFIG, 0));
    expect(fromConfig).toEqual(['Playwright: [x] chromium', 'Playwright: [x] mobile']);
    const outside = await client.codeActions(path.join(os.tmpdir(), 'pw-zed-nowhere.spec.ts'), 0);
    expect(outside).toEqual([]);
  });
});

interface Scratch {
  dir: string;
  config: string;
  desktopSpec: string;
  mobileSpec: string;
}

const DESKTOP_PROJECT = "{ name: 'chromium', use: { browserName: 'chromium' }, testIgnore: /mobile-only/ }";
const MOBILE_PROJECT = (name = 'mobile') => `{ name: '${name}', use: { browserName: 'chromium', viewport: { width: 400, height: 800 } }, testMatch: /mobile-only/ }`;

function scratchConfig(projects: string[]): string {
  return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  projects: [
    ${projects.join(',\n    ')},
  ],
});
`;
}

/** Two Chromium projects that own different files, so lens filtering is observable. */
function twoProjectScratch(): Scratch {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-projects-'));
  trackTempDir(dir);
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.symlinkSync(path.join(FIXTURE, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  const config = path.join(dir, 'playwright.config.ts');
  fs.writeFileSync(config, scratchConfig([DESKTOP_PROJECT, MOBILE_PROJECT()]));
  const desktopSpec = path.join(dir, 'tests/one.spec.ts');
  const mobileSpec = path.join(dir, 'tests/mobile-only.spec.ts');
  fs.writeFileSync(desktopSpec, SPEC_SOURCE);
  fs.writeFileSync(mobileSpec, SPEC_SOURCE.replace("'one'", "'mobile one'"));
  return { dir, config, desktopSpec, mobileSpec };
}

function singleProjectScratch(): { dir: string; spec: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-single-'));
  trackTempDir(dir);
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.symlinkSync(path.join(FIXTURE, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), configSource(false));
  const spec = path.join(dir, 'tests/one.spec.ts');
  fs.writeFileSync(spec, SPEC_SOURCE);
  return { dir, spec };
}

describe('lenses and runs follow the selection (US1)', () => {
  afterAll(() => removeTempProjects());

  it('hides lenses of unselected-only files and refuses to run them', async () => {
    const scratch = twoProjectScratch();
    const client = await TestClient.start(scratch.dir);
    try {
      await client.waitForDiscovery();
      expect((await client.status())[0].configs[0]).toMatchObject({ projects: ['chromium', 'mobile'], selectedProjects: ['chromium'] });
      expect(await client.codeLenses(scratch.mobileSpec)).toEqual([]);
      expect((await client.codeLenses(scratch.desktopSpec)).length).toBe(1);
      const actions = (await client.codeActions(scratch.mobileSpec, 2)).map((a) => a.title as string);
      expect(actions).not.toContain('Playwright: Run test at cursor');
      client.clear();
      await client.execute(RUN_FILE, [{ uri: uriOf(scratch.mobileSpec) }]);
      const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
      expect(warning.message).toContain('no tests in tests/mobile-only.spec.ts run in the selected project(s) chromium');
      expect(client.messages('$/progress')).toEqual([]);

      client.clear();
      await client.execute(TOGGLE, [{ uri: uriOf(scratch.mobileSpec), project: 'mobile' }]);
      await client.waitFor('workspace/codeLens/refresh');
      expect((await client.codeLenses(scratch.mobileSpec)).length).toBe(1);
      expect((await client.codeActions(scratch.mobileSpec, 2)).map((a) => a.title)).toContain('Playwright: Run test at cursor');
    } finally {
      await client.stop();
    }
  });

  it('leaves single-project configs exactly as before (SC-004)', async () => {
    const scratch = singleProjectScratch();
    const client = await TestClient.start(scratch.dir);
    try {
      await client.waitForDiscovery();
      expect((await client.status())[0].configs[0]).toMatchObject({ projects: ['chromium'], selectedProjects: ['chromium'], selectionSource: 'single' });
      expect(projectTitles(await client.codeActions(scratch.spec, 2))).toEqual([]);
      client.clear();
      await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(scratch.spec), line: 2 }]);
      const begin = await client.waitFor('$/progress', (p) => p.value?.kind === 'begin');
      expect(begin.value.message).toBe('Running 1 test(s) in tests/one.spec.ts');
      expect(await finishedSummary(client)).toEqual({ passed: 1, failed: 0, skipped: 0 });
      expect(runCommandLine(client)).not.toContain('--project');
    } finally {
      await client.stop();
    }
  });
});

describe('the choice is remembered (US2)', () => {
  afterAll(() => removeTempProjects());

  it('(a) survives a server restart through the state directory', async () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-state-shared-'));
    trackTempDir(stateDir);
    const first = await TestClient.start(FIXTURE, { stateDir });
    try {
      await first.waitForDiscovery();
      await first.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'mobile' }]);
      await first.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'chromium' }]);
      expect((await first.status())[0].configs[0]).toMatchObject({ selectedProjects: ['mobile'], selectionSource: 'chosen' });
    } finally {
      await first.stop();
    }
    const stored = JSON.parse(fs.readFileSync(path.join(stateDir, 'project-selection.json'), 'utf8'));
    expect(stored.configs[CONFIG].projects).toEqual(['mobile']);

    const second = await TestClient.start(FIXTURE, { stateDir });
    try {
      await second.waitForDiscovery();
      expect((await second.status())[0].configs[0]).toMatchObject({ selectedProjects: ['mobile'], selectionSource: 'remembered' });
      expect(projectTitles(await second.codeActions(PASSING, L.adds))).toEqual(['Playwright: [ ] chromium', 'Playwright: [x] mobile', SELECT_ALL_TITLE]);
      expect(second.showMessages(MessageType.Info).filter((m) => m.includes('no longer exist'))).toEqual([]);
    } finally {
      await second.stop();
    }
  });

  it('(b) drops names the config no longer defines, once, and keeps new projects unselected', async () => {
    const scratch = twoProjectScratch();
    const client = await TestClient.start(scratch.dir);
    try {
      await client.waitForDiscovery();
      await client.execute(TOGGLE, [{ uri: uriOf(scratch.mobileSpec), project: 'mobile' }]);
      await client.execute(TOGGLE, [{ uri: uriOf(scratch.mobileSpec), project: 'chromium' }]);
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['mobile'], selectionSource: 'chosen' });

      // rename mobile -> tablet: the remembered choice names nothing that exists any more
      fs.writeFileSync(scratch.config, scratchConfig([DESKTOP_PROJECT, MOBILE_PROJECT('tablet')]));
      client.clear();
      await client.open(scratch.config, 1);
      await client.save(scratch.config);
      const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info && p.message.includes('no longer exist'));
      expect(info.message).toBe('Playwright: project(s) mobile no longer exist in playwright.config.ts; selection is now chromium');
      await client.waitFor('workspace/codeLens/refresh');
      expect((await client.status())[0].configs[0]).toMatchObject({ projects: ['chromium', 'tablet'], selectedProjects: ['chromium'], selectionSource: 'default' });

      // the same situation again does not nag
      client.clear();
      await client.save(scratch.config);
      await client.waitFor('workspace/codeLens/refresh');
      expect(client.showMessages(MessageType.Info).filter((m) => m.includes('no longer exist'))).toEqual([]);

      // (c) a chosen pair survives the arrival of a third project, which stays unselected
      await client.execute(TOGGLE, [{ uri: uriOf(scratch.mobileSpec), project: 'tablet' }]);
      fs.writeFileSync(scratch.config, scratchConfig([DESKTOP_PROJECT, MOBILE_PROJECT('tablet'), "{ name: 'wide', use: { browserName: 'chromium', viewport: { width: 1600, height: 900 } } }"]));
      client.clear();
      await client.save(scratch.config);
      await client.waitFor('workspace/codeLens/refresh');
      expect((await client.status())[0].configs[0]).toMatchObject({ projects: ['chromium', 'tablet', 'wide'], selectedProjects: ['chromium', 'tablet'], selectionSource: 'remembered' });
    } finally {
      await client.stop();
    }
  });
});

describe('a default from the editor settings (US3)', () => {
  it('(a) seeds the selection and warns once about unknown names', async () => {
    const client = await TestClient.start(FIXTURE, { settings: { projects: ['mobile', 'nope'] } });
    try {
      await client.waitForDiscovery();
      expect(client.requests.filter((r) => r.method === 'workspace/configuration')).toHaveLength(1);
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['mobile'], selectionSource: 'settings' });
      const warnings = client.showMessages(MessageType.Warning);
      expect(warnings).toEqual(['Playwright: setting "projects" names nope which playwright.config.ts does not define; available: chromium, mobile']);

      // (b) a live change applies without a restart and does not repeat the warning
      client.clear();
      await client.changeSettings({ projects: ['chromium', 'mobile'] });
      await client.waitFor('workspace/codeLens/refresh');
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['chromium', 'mobile'], selectionSource: 'settings' });
      expect(client.showMessages(MessageType.Warning)).toEqual([]);

      // (c) a chosen selection wins over a later settings change
      await client.execute(TOGGLE, [{ uri: uriOf(PASSING), project: 'mobile' }]);
      client.clear();
      await client.changeSettings({ projects: ['mobile'] });
      await new Promise((r) => setTimeout(r, 300));
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['chromium'], selectionSource: 'chosen' });
    } finally {
      await client.stop();
    }
  });

  it('(d) warns about a malformed value and keeps the default', async () => {
    const client = await TestClient.start(FIXTURE, { settings: { projects: 'chromium' } });
    try {
      await client.waitForDiscovery();
      expect(client.showMessages(MessageType.Warning)).toEqual(['Playwright: setting "projects" must be a list of project names']);
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['chromium'], selectionSource: 'default' });
    } finally {
      await client.stop();
    }
  });

  it('(e) asks nothing of a client without workspace/configuration', async () => {
    const client = await TestClient.start(FIXTURE, { settings: { projects: ['mobile'] }, noConfiguration: true });
    try {
      await client.waitForDiscovery();
      expect(client.requests.filter((r) => r.method === 'workspace/configuration')).toEqual([]);
      expect((await client.status())[0].configs[0]).toMatchObject({ selectedProjects: ['chromium'], selectionSource: 'default' });
    } finally {
      await client.stop();
    }
  });
});
