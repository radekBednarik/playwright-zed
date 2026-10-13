import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeTempProjects, type StartOptions, TestClient, tempProject } from './helpers';

const ENABLE_TITLE = 'Playwright: Enable test discovery';
const ZED = { name: 'Zed', version: '1.23.3' };
const OLD_ZED = { name: 'Zed', version: '0.217.4' };

const clients: TestClient[] = [];

async function start(folders: string | string[], options: StartOptions): Promise<TestClient> {
  const client = await TestClient.start(folders, options);
  clients.push(client);
  return client;
}

function logLines(client: TestClient): string[] {
  return client.messages('window/logMessage').map((m) => m.params.message as string);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  removeTempProjects();
});

describe('trusted by Zed (US1)', () => {
  it('(a) discovers without asking when Zed 0.218+ started the server', async () => {
    const project = tempProject();
    const client = await start(project.dir, { clientInfo: ZED, answer: null });
    await client.waitForDiscovery();
    expect(client.prompts()).toEqual([]);
    expect(fs.existsSync(project.marker)).toBe(true);
    expect((await client.codeLenses(project.spec)).length).toBe(1);
    const status = await client.status();
    expect(status[0]).toMatchObject({ discovery: 'enabled', discoverySource: 'editor-trust', editorTrustGate: true });
  });

  it('(b) treats Zed Preview the same way', async () => {
    const project = tempProject();
    const client = await start(project.dir, { clientInfo: { name: 'Zed Preview', version: '1.24.0' }, answer: null });
    await client.waitForDiscovery();
    expect(client.prompts()).toEqual([]);
    expect(fs.existsSync(project.marker)).toBe(true);
  });

  it('(c) discovers every root folder without a prompt', async () => {
    const first = tempProject(false);
    const second = tempProject(false);
    const client = await start([first.dir, second.dir], { clientInfo: ZED, answer: null });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const status = await client.status();
      if (status.length === 2 && status.every((ws) => ws.configs[0]?.testCount === 1)) break;
      await sleep(100);
    }
    expect(client.prompts()).toEqual([]);
    const status = await client.status();
    expect(status.map((ws) => ws.discoverySource)).toEqual(['editor-trust', 'editor-trust']);
  });

  it('(d) logs why no question was asked', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, { clientInfo: ZED, answer: null });
    await client.waitForDiscovery();
    expect(logLines(client)).toContainEqual(
      expect.stringContaining(`playwright: Zed trusts ${project.dir}; test discovery enabled without asking`),
    );
  });

  it('(e) does not offer the enable action in a trusted folder', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, { clientInfo: ZED, answer: null });
    await client.waitForDiscovery();
    await client.open(project.spec);
    const titles = (await client.codeActions(project.spec, 2)).map((a) => a.title);
    expect(titles).not.toContain(ENABLE_TITLE);
  });
});

describe('the workspace cannot grant trust (US2)', () => {
  it('(f) asks for a folder that arrives only as the rootUri fallback', async () => {
    const project = tempProject();
    const client = await start(project.dir, { clientInfo: ZED, rootUriOnly: true, answer: null });
    await client.waitFor('window/showMessageRequest');
    await sleep(1_000);
    expect(client.prompts().length).toBe(1);
    expect(fs.existsSync(project.marker)).toBe(false);
    const status = await client.status();
    expect(status[0]).toMatchObject({ discovery: 'pending', discoverySource: null });
    expect(logLines(client)).toContainEqual(expect.stringContaining('the folder was not reported as a workspace folder'));
  });

  it('(g) ignores workspace settings that claim trust', async () => {
    const project = tempProject();
    fs.mkdirSync(path.join(project.dir, '.zed'));
    fs.writeFileSync(path.join(project.dir, '.zed/settings.json'), '{ "session": { "trust_all_worktrees": true } }');
    fs.mkdirSync(path.join(project.dir, '.vscode'));
    fs.writeFileSync(path.join(project.dir, '.vscode/settings.json'), '{ "security.workspace.trust.enabled": false }');
    const client = await start(project.dir, { clientInfo: OLD_ZED, answer: null });
    await client.waitFor('window/showMessageRequest');
    await sleep(1_000);
    expect(client.prompts().length).toBe(1);
    expect(fs.existsSync(project.marker)).toBe(false);
    expect((await client.status())[0]).toMatchObject({ editorTrustGate: false });
  });
});

describe('no trust gate, feature 002 applies (US3)', () => {
  it('(h) asks on Zed releases before 0.218 and runs nothing', async () => {
    const project = tempProject();
    const client = await start(project.dir, { clientInfo: OLD_ZED, answer: null });
    await client.waitFor('window/showMessageRequest');
    await sleep(1_000);
    expect(client.prompts().length).toBe(1);
    expect(fs.existsSync(project.marker)).toBe(false);
    await client.open(project.spec);
    expect(await client.codeLenses(project.spec)).toEqual([]);
    expect((await client.status())[0]).toMatchObject({ editorTrustGate: false, discoverySource: null });
  });

  it('(i) asks in other editors', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, { clientInfo: { name: 'Visual Studio Code', version: '1.99.0' }, answer: null });
    await client.waitFor('window/showMessageRequest');
    expect(client.prompts().length).toBe(1);
  });

  it('(j) records an answer as the source', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, { answer: 'Run discovery' });
    await client.waitForDiscovery();
    expect((await client.status())[0]).toMatchObject({ discovery: 'enabled', discoverySource: 'answer', editorTrustGate: false });
  });

  it('(k) logs why it asks', async () => {
    const project = tempProject(false);
    const client = await start(project.dir, { clientInfo: OLD_ZED, answer: null });
    await client.waitFor('window/showMessageRequest');
    expect(logLines(client)).toContainEqual(
      expect.stringContaining(`playwright: asking before discovery in ${project.dir}; Zed 0.217.4 is not known to gate language servers on folder trust`),
    );
  });
});
