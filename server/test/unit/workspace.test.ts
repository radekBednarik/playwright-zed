import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildConfig, configForFile, findConfigs, isUnderTestDirs, resolvePlaywright } from '../../src/workspace';
import type { PlaywrightConfig, Workspace } from '../../src/types';

let root: string;

function write(rel: string, content = '') {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function fakePlaywright(dirRel: string, version: string) {
  write(path.join(dirRel, 'node_modules/@playwright/test/package.json'), JSON.stringify({ name: '@playwright/test', version }));
  write(path.join(dirRel, 'node_modules/@playwright/test/cli.js'), '');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-ws-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('findConfigs', () => {
  it('finds every config extension and skips dependency and output folders', () => {
    const a = write('playwright.config.ts');
    const b = write('packages/web/playwright.config.mjs');
    write('node_modules/dep/playwright.config.ts');
    write('test-results/playwright.config.js');
    write('.hidden/playwright.config.js');
    write('packages/web/playwright.config.ts.bak');
    expect(findConfigs(root)).toEqual([a, b].sort());
  });
  it('returns an empty list for a folder without Playwright', () => {
    write('index.ts', 'export {}');
    expect(findConfigs(root)).toEqual([]);
  });
});

describe('resolvePlaywright', () => {
  it('walks upward to the nearest installation', () => {
    fakePlaywright('', '1.64.0');
    const configDir = path.join(root, 'packages/web');
    fs.mkdirSync(configDir, { recursive: true });
    const resolved = resolvePlaywright(configDir);
    expect(resolved?.playwrightVersion).toEqual({ major: 1, minor: 64, patch: 0 });
    expect(resolved?.playwrightCli).toBe(path.join(root, 'node_modules/@playwright/test/cli.js'));
  });
  it('prefers the closest installation', () => {
    fakePlaywright('', '1.64.0');
    fakePlaywright('packages/web', '1.40.0');
    expect(resolvePlaywright(path.join(root, 'packages/web'))?.playwrightVersion.minor).toBe(40);
  });
  it('returns null when nothing is installed', () => {
    expect(resolvePlaywright(root)).toBeNull();
  });
});

describe('buildConfig', () => {
  it('produces a supported config for 1.38+', () => {
    fakePlaywright('', '1.38.0');
    const config = buildConfig(write('playwright.config.ts'));
    expect(config).toMatchObject({
      configDir: root,
      supported: true,
      rootDir: null,
      testDirs: [],
      tests: [],
      discoveryState: 'idle',
    });
  });
  it('marks old versions unsupported', () => {
    fakePlaywright('', '1.37.1');
    expect(buildConfig(write('playwright.config.ts'))?.supported).toBe(false);
  });
  it('returns null without an installation', () => {
    expect(buildConfig(write('playwright.config.ts'))).toBeNull();
  });
});

describe('configForFile', () => {
  function cfg(dirRel: string, supported = true): PlaywrightConfig {
    const configDir = path.join(root, dirRel);
    return {
      configPath: path.join(configDir, 'playwright.config.ts'),
      configDir,
      playwrightCli: '',
      playwrightVersion: { major: 1, minor: 64, patch: 0 },
      supported,
      rootDir: null,
      testDirs: [path.join(configDir, 'tests')],
      tests: [],
      discoveryState: 'idle',
    };
  }
  it('chooses the nearest config (longest configDir prefix)', () => {
    const ws: Workspace = { rootUri: '', rootPath: root, configs: [cfg(''), cfg('packages/web')], lastRun: null, versionWarningShown: false };
    expect(configForFile(ws, path.join(root, 'packages/web/tests/a.spec.ts'))?.configDir).toBe(path.join(root, 'packages/web'));
    expect(configForFile(ws, path.join(root, 'tests/b.spec.ts'))?.configDir).toBe(root);
  });
  it('ignores unsupported configs and files outside every config', () => {
    const ws: Workspace = { rootUri: '', rootPath: root, configs: [cfg('packages/web', false)], lastRun: null, versionWarningShown: false };
    expect(configForFile(ws, path.join(root, 'packages/web/tests/a.spec.ts'))).toBeNull();
    expect(configForFile({ ...ws, configs: [cfg('packages/web')] }, path.join(root, 'other/a.spec.ts'))).toBeNull();
  });
  it('does not treat a sibling folder with a shared prefix as inside', () => {
    const ws: Workspace = { rootUri: '', rootPath: root, configs: [cfg('packages/web')], lastRun: null, versionWarningShown: false };
    expect(configForFile(ws, path.join(root, 'packages/webapp/tests/a.spec.ts'))).toBeNull();
  });
  it('isUnderTestDirs checks discovered test directories', () => {
    const c = cfg('');
    expect(isUnderTestDirs(c, path.join(root, 'tests/x.spec.ts'))).toBe(true);
    expect(isUnderTestDirs(c, path.join(root, 'src/x.ts'))).toBe(false);
  });
});
