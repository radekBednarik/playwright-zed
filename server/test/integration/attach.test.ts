import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG, FAILING, FIXTURE, PASSING, SLOW, TestClient } from './helpers';

/**
 * Feature 007: the editor sequence when files are already open before the server starts
 * (contracts/attach.md section 1). Zed sends `didOpen` for every open buffer right after
 * `initialize`, asks for lenses before discovery has finished, and asks again after the
 * server's `workspace/codeLens/refresh`. These tests open documents at exactly that moment.
 */

const clients: TestClient[] = [];

async function start(): Promise<TestClient> {
  const client = await TestClient.start(FIXTURE);
  clients.push(client);
  return client;
}

afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
});

const SERVED = /^playwright: (\d+) open file\(s\) served after discovery: (.*)$/;

function servedLines(client: TestClient): string[] {
  return client
    .messages('window/logMessage')
    .map((m) => m.params.message as string)
    .filter((message) => SERVED.test(message));
}

describe('files open before discovery are served after it (US1)', () => {
  it('(a) one document opened right after initialize gets lenses after the refresh and is logged', async () => {
    const client = await start();
    await client.open(PASSING);
    expect(await client.codeLenses(PASSING)).toEqual([]);
    await client.waitForDiscovery();
    const lenses = await client.codeLenses(PASSING);
    expect(lenses.some((lens: any) => lens.command.title === '▶ Run test')).toBe(true);
    expect(servedLines(client)).toEqual(['playwright: 1 open file(s) served after discovery: tests/passing.spec.ts']);
  });

  it('(b) three documents opened in one burst are all served and listed sorted', async () => {
    const client = await start();
    await Promise.all([client.open(PASSING), client.open(FAILING), client.open(SLOW)]);
    for (const file of [PASSING, FAILING, SLOW]) expect(await client.codeLenses(file)).toEqual([]);
    await client.waitForDiscovery();
    for (const file of [PASSING, FAILING, SLOW]) {
      const lenses = await client.codeLenses(file);
      expect(lenses.length, file).toBeGreaterThan(0);
    }
    expect(servedLines(client)).toEqual([
      'playwright: 3 open file(s) served after discovery: tests/failing.spec.ts, tests/passing.spec.ts, tests/slow.spec.ts',
    ]);
  });

  it('(c) a document outside the test directories is neither served nor listed', async () => {
    const client = await start();
    await client.open(CONFIG);
    expect(await client.codeLenses(CONFIG)).toEqual([]);
    await client.waitForDiscovery();
    expect(await client.codeLenses(CONFIG)).toEqual([]);
    expect(servedLines(client)).toEqual([]);
  });
});
