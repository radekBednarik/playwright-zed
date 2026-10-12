import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG, FIXTURE, MessageType, TestClient, uriOf } from './helpers';

// `test.only` lives in its own temp project: Playwright applies focus across every file of a
// run (`filterOnly` on the root suite), so a focused test in the shared fixture would hide
// every other fixture test from file-level runs.
const SPEC_SOURCE = `import { test, expect } from '@playwright/test';

test.only('focused', async ({ page }) => {
  await page.setContent('<p id="f">yes</p>');
  await expect(page.locator('#f')).toHaveText('yes');
});

test('not focused', async ({ page }) => {
  await page.setContent('<p id="n">no</p>');
  await expect(page.locator('#n')).toHaveText('no');
});
`;
// 0-based lines of the two test titles above
const L = { focused: 2, notFocused: 7 };

let dir: string;
let spec: string;
let client: TestClient;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-focus-'));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.copyFileSync(CONFIG, path.join(dir, 'playwright.config.ts'));
  fs.symlinkSync(path.join(FIXTURE, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  spec = path.join(dir, 'tests/focused.spec.ts');
  fs.writeFileSync(spec, SPEC_SOURCE);
  client = await TestClient.start(dir);
  await client.waitForDiscovery();
});
afterAll(async () => {
  await client.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => client.clear());

function summary(passed: number, failed: number, skipped: number): RegExp {
  return new RegExp(`^Playwright: ${passed} passed, ${failed} failed, ${skipped} skipped \\(\\d+\\.\\ds\\)$`);
}

function diagnostics() {
  return client.messages('textDocument/publishDiagnostics').filter((m) => m.params.uri === uriOf(spec) && m.params.diagnostics.length > 0);
}

describe('focused tests (test.only edge case)', () => {
  it('discovers both tests and offers a lens for each', async () => {
    const status = await client.status();
    expect(status[0].configs[0].testCount).toBe(2);
    const lenses = await client.codeLenses(spec);
    expect(lenses.map((l) => l.range.start.line).sort()).toEqual([L.focused, L.notFocused]);
  });

  it('runs only the focused test for a file run, as Playwright does', async () => {
    await client.execute('playwright.runFile', [{ uri: uriOf(spec) }]);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(1, 0, 0));
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toContain('› focused');
    expect(log).not.toContain('› not focused');
    expect(diagnostics()).toEqual([]);
  });

  it('runs the unfocused test when it is targeted by line, as Playwright does', async () => {
    await client.execute('playwright.runAtCursor', [{ uri: uriOf(spec), line: L.notFocused }]);
    const info = await client.waitFor('window/showMessage', (p) => p.type === MessageType.Info);
    expect(info.message).toMatch(summary(1, 0, 0));
    const log = client.messages('window/logMessage').map((m) => m.params.message).join('\n');
    expect(log).toContain('› not focused');
    expect(client.showMessages(MessageType.Error)).toEqual([]);
    expect(diagnostics()).toEqual([]);
  });
});
