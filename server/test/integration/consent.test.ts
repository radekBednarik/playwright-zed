import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG, configSource, FIXTURE, MessageType, PASSING, removeTempProjects, SPEC_SOURCE, TestClient, tempProject, trackTempDir, uriOf } from './helpers';

const RUN_AT_CURSOR = 'playwright.runAtCursor';
const RUN_FILE = 'playwright.runFile';
const ENABLE = 'playwright.enableDiscovery';
const ENABLE_TITLE = 'Playwright: Enable test discovery';

const clients: TestClient[] = [];

async function start(folders: string | string[], answer: 'Run discovery' | 'Not now' | null): Promise<TestClient> {
  const client = await TestClient.start(folders, { answer });
  clients.push(client);
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  removeTempProjects();
});

describe('nothing runs until the developer agrees (US1)', () => {
  it('(a) asks once, executes nothing and offers only the enable action while pending', async () => {
    const project = tempProject();
    const client = await start(project.dir, null);
    await sleep(1500);
    expect(fs.existsSync(project.marker)).toBe(false);
    const status = await client.status();
    expect(status[0]).toMatchObject({ discovery: 'pending', discoveryAsked: true });
    expect(status[0].configs[0].testCount).toBe(0);
    const prompts = client.prompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].message).toContain(path.basename(project.dir));
    expect(prompts[0].message).toContain('executes');
    expect(prompts[0].actions.map((a: any) => a.title)).toEqual(['Run discovery', 'Not now']);
    expect(await client.codeLenses(project.spec)).toEqual([]);
    const actions = await client.codeActions(project.spec, 2);
    expect(actions.map((a: any) => a.title)).toEqual([ENABLE_TITLE]);
    expect(actions[0].command).toMatchObject({ command: ENABLE, arguments: [{ uri: uriOf(project.spec) }] });
  });

  it('(b) refuses run commands while pending without starting anything', async () => {
    const project = tempProject();
    const client = await start(project.dir, null);
    await sleep(500);
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(project.spec), line: 2 }]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('has not been enabled');
    expect(warning.message).toContain(ENABLE_TITLE);
    expect(client.messages('$/progress')).toEqual([]);
    expect(fs.existsSync(project.marker)).toBe(false);
  });

  it('(c) never asks in a folder without Playwright', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-plain-'));
    trackTempDir(dir);
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export const x = 1;\n');
    const client = await start(dir, null);
    await sleep(500);
    expect(client.prompts()).toEqual([]);
    expect(client.showMessages()).toEqual([]);
    expect(await client.codeActions(path.join(dir, 'index.ts'), 0)).toEqual([]);
  });
});

describe('agreeing enables everything as before (US2)', () => {
  it('(d) runs discovery immediately after "Run discovery"', async () => {
    const project = tempProject();
    const client = await start(project.dir, 'Run discovery');
    await client.waitForDiscovery();
    expect(fs.existsSync(project.marker)).toBe(true);
    const status = await client.status();
    expect(status[0]).toMatchObject({ discovery: 'enabled', discoveryAsked: true });
    expect(status[0].configs[0].testCount).toBe(1);
    expect((await client.codeLenses(project.spec)).length).toBe(1);
  });

  it('(e) asks exactly once per session, even across re-discovery on save', async () => {
    const client = await start(FIXTURE, 'Run discovery');
    await client.waitForDiscovery();
    expect(client.prompts()).toHaveLength(1);
    client.clear();
    await client.open(PASSING, 1);
    await client.save(PASSING);
    await client.waitFor('workspace/codeLens/refresh');
    expect(client.prompts()).toEqual([]);
  });

  it('(f) discovers a configuration added later without asking again', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, 'Run discovery');
    await client.waitForDiscovery();
    const webDir = path.join(project.dir, 'packages/web');
    fs.mkdirSync(path.join(webDir, 'tests'), { recursive: true });
    const webConfig = path.join(webDir, 'playwright.config.ts');
    fs.writeFileSync(webConfig, configSource(false));
    const webSpec = path.join(webDir, 'tests/web.spec.ts');
    fs.writeFileSync(webSpec, SPEC_SOURCE);
    client.clear();
    await client.open(webConfig, 1);
    await client.save(webConfig);
    await client.waitFor('workspace/codeLens/refresh');
    expect(client.prompts()).toEqual([]);
    const status = await client.status();
    expect(status[0].configs).toHaveLength(2);
    expect(status[0].configs.find((c: any) => c.configPath === webConfig).testCount).toBe(1);
    expect((await client.codeLenses(webSpec)).length).toBe(1);
  });
});

describe('declining keeps the extension idle, with a way back (US3)', () => {
  it('(g) "Not now" leaves the workspace idle and quiet', async () => {
    const client = await start(FIXTURE, 'Not now');
    await sleep(800);
    expect((await client.status())[0]).toMatchObject({ discovery: 'declined', discoveryAsked: true });
    expect(await client.codeLenses(PASSING)).toEqual([]);
    await client.execute(RUN_FILE, [{ uri: uriOf(PASSING) }]);
    const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
    expect(warning.message).toContain('is disabled');
    expect(client.messages('$/progress')).toEqual([]);
    client.clear();
    await client.open(PASSING, 1);
    await client.save(PASSING);
    await expect(client.waitFor('workspace/codeLens/refresh', () => true, 1000)).rejects.toThrow(/timed out/);
    expect(client.prompts()).toEqual([]);
  });

  it('(h) the enable command turns a declined workspace on', async () => {
    const client = await start(FIXTURE, 'Not now');
    await sleep(500);
    await client.execute(ENABLE, [{ uri: uriOf(CONFIG) }]);
    await client.waitFor('workspace/codeLens/refresh');
    expect((await client.status())[0].discovery).toBe('enabled');
    expect((await client.codeLenses(PASSING)).length).toBeGreaterThan(0);
    const actions = await client.codeActions(PASSING, 2);
    expect(actions[0].title).toBe('Playwright: Run test at cursor');
    client.clear();
    await client.execute(RUN_AT_CURSOR, [{ uri: uriOf(PASSING), line: 2 }]);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toContain('1 passed');
  });

  it('(i) a dismissed question can still be enabled from the editor', async () => {
    const project = tempProject();
    const client = await start(project.dir, null);
    await sleep(500);
    expect(fs.existsSync(project.marker)).toBe(false);
    await client.execute(ENABLE, [{ uri: uriOf(project.spec) }]);
    await client.waitFor('workspace/codeLens/refresh');
    expect(fs.existsSync(project.marker)).toBe(true);
    expect((await client.status())[0].discovery).toBe('enabled');
    expect(client.prompts()).toHaveLength(1);
  });

  it('(j) asks separately for each root folder', async () => {
    const project = tempProject(false);
    const client = await start([FIXTURE, project.dir], null);
    await sleep(1000);
    const prompts = client.prompts();
    expect(prompts).toHaveLength(2);
    const named = prompts.map((p) => p.message).join('\n');
    expect(named).toContain(path.basename(FIXTURE));
    expect(named).toContain(path.basename(project.dir));
    const status = await client.status();
    expect(status.map((w: any) => w.discovery)).toEqual(['pending', 'pending']);
  });
});
