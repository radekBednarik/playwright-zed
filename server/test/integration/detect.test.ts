import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG, FAILING, FIXTURE, MessageType, PASSING, TestClient, uriOf } from './helpers';

const temps: string[] = [];
function tempDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-zed-${name}-`));
  temps.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

describe('workspace detection (US1)', () => {
  it('recognises the fixture, gates on version and discovers all 16 tests', async () => {
    const client = await TestClient.start(FIXTURE);
    try {
      await client.waitForDiscovery();
      const status = await client.status();
      expect(status).toHaveLength(1);
      expect(status[0].configs).toHaveLength(1);
      const config = status[0].configs[0];
      expect(config.configPath).toBe(CONFIG);
      expect(config.supported).toBe(true);
      expect(config.playwrightVersion).toMatch(/^1\.(3[8-9]|[4-9]\d)\./);
      expect(config.testDirs).toEqual([path.join(FIXTURE, 'tests')]);
      expect(config.discoveryState).toBe('idle');
      expect(config.testCount).toBe(16);
      // feature 005: two projects, first one selected by default
      expect(config.projects).toEqual(['chromium', 'mobile']);
      expect(config.selectedProjects).toEqual(['chromium']);
      expect(config.selectionSource).toBe('default');
      expect(status[0]).toMatchObject({ discovery: 'enabled', discoveryAsked: true });
      const prompts = client.prompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].actions.map((a: any) => a.title)).toEqual(['Run discovery', 'Not now']);

      const passingLenses = await client.codeLenses(PASSING);
      const failingLenses = await client.codeLenses(FAILING);
      expect(passingLenses.filter((l) => l.command.title === '▶ Run test')).toHaveLength(11);
      expect(passingLenses.filter((l) => l.command.title === '▶ Run describe')).toHaveLength(3);
      expect(failingLenses.filter((l) => l.command.title === '▶ Run test')).toHaveLength(4);
      expect(failingLenses.filter((l) => l.command.title === '▶ Run describe')).toHaveLength(1);
      expect(client.showMessages(MessageType.Warning)).toEqual([]);
      expect(client.showMessages(MessageType.Error)).toEqual([]);
    } finally {
      await client.stop();
    }
  });

  it('stays silent in a TypeScript folder without Playwright', async () => {
    const dir = tempDir('plain');
    const file = path.join(dir, 'index.ts');
    fs.writeFileSync(file, 'export const x = 1;\n');
    const client = await TestClient.start(dir);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const status = await client.status();
      expect(status[0].configs).toEqual([]);
      expect(await client.codeActions(file, 0)).toEqual([]);
      expect(await client.codeLenses(file)).toEqual([]);
      expect(client.showMessages()).toEqual([]);
      expect(client.prompts()).toEqual([]);
    } finally {
      await client.stop();
    }
  });

  it('evaluates each root folder on its own when several are open', async () => {
    const plain = tempDir('multi');
    const plainFile = path.join(plain, 'index.ts');
    fs.writeFileSync(plainFile, 'export const y = 2;\n');
    const client = await TestClient.start([FIXTURE, plain]);
    try {
      await client.waitForDiscovery();
      const status = await client.status();
      expect(status.map((w: any) => [w.rootPath, w.configs.length]).sort()).toEqual([[FIXTURE, 1], [plain, 0]].sort());
      expect((await client.codeLenses(PASSING)).length).toBeGreaterThan(0);
      expect(await client.codeLenses(plainFile)).toEqual([]);
      expect(await client.codeActions(plainFile, 0)).toEqual([]);
      expect(client.showMessages(MessageType.Warning)).toEqual([]);
      const prompts = client.prompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).toContain(path.basename(FIXTURE));
    } finally {
      await client.stop();
    }
  });

  it('warns once and offers nothing for Playwright older than 1.38', async () => {
    const dir = tempDir('old');
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.copyFileSync(CONFIG, path.join(dir, 'playwright.config.ts'));
    fs.copyFileSync(PASSING, path.join(dir, 'tests/passing.spec.ts'));
    const pkg = path.join(dir, 'node_modules/@playwright/test');
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@playwright/test', version: '1.37.1' }));
    fs.writeFileSync(path.join(pkg, 'cli.js'), '');
    const client = await TestClient.start(dir);
    try {
      const warning = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
      expect(warning.message).toContain('1.37.1');
      expect(warning.message).toContain('1.38');
      expect(warning.message).toContain('disabled');
      await new Promise((r) => setTimeout(r, 300));
      expect(client.showMessages(MessageType.Warning)).toHaveLength(1);
      const status = await client.status();
      expect(status[0].configs[0].supported).toBe(false);
      expect(client.prompts()).toEqual([]);
      expect(await client.codeActions(path.join(dir, 'tests/passing.spec.ts'), 2)).toEqual([]);
      expect(await client.codeLenses(path.join(dir, 'tests/passing.spec.ts'))).toEqual([]);
      client.clear();
      await client.execute('playwright.runAtCursor', [{ uri: uriOf(path.join(dir, 'tests/passing.spec.ts')), line: 2 }]);
      const attempt = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Warning);
      expect(attempt.message).toContain('1.37.1');
      expect(attempt.message).toContain('disabled');
      expect(client.messages('$/progress')).toEqual([]);
    } finally {
      await client.stop();
    }
  });
});
