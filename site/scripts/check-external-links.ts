// Outbound link check over the built site (feature 010, SC-005). Run after `npm run build`.
// Not part of CI: third-party outages must not block a merge.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const timeoutMs = 10_000;

function* htmlFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith('.html')) yield path;
  }
}

const urls = new Set<string>();
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="(https?:\/\/[^"]+)"/g)) {
    const url = match[1].replace(/&amp;/g, '&');
    if (url.startsWith('https://radekbednarik.github.io/playwright-zed')) continue;
    urls.add(url);
  }
}

async function probe(url: string, method: 'HEAD' | 'GET'): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, redirect: 'follow', signal: controller.signal });
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

let failures = 0;
for (const url of [...urls].sort()) {
  let status: number | string;
  try {
    status = await probe(url, 'HEAD');
    if (status === 405 || status === 404 || status === 403) status = await probe(url, 'GET');
  } catch (error) {
    status = error instanceof Error ? error.name : String(error);
  }
  const ok = typeof status === 'number' && status >= 200 && status < 400;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${status} ${url}`);
}
console.log(`${urls.size} external URL(s), ${failures} failure(s)`);
process.exit(failures > 0 ? 1 : 0);
