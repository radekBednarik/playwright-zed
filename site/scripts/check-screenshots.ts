// Screenshot coverage check (feature 010, FR-012 and FR-013).
// Fails when a capability has no screenshot, a manifest entry has no file, a file has
// no manifest entry, or a manifest entry was taken with another extension version than
// extension.toml declares.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities, screenshots } from '../src/data/screenshots.ts';

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '..', 'src', 'assets', 'screenshots');
const manifest = resolve(here, '..', '..', 'extension.toml');

const versionMatch = readFileSync(manifest, 'utf8').match(/^version\s*=\s*"([^"]+)"/m);
if (!versionMatch) {
  console.error(`check-screenshots: no version in ${manifest}`);
  process.exit(1);
}
const extensionVersion = versionMatch[1];

const files = new Set(
  readdirSync(assets)
    .filter((name) => name.endsWith('.png'))
    .map((name) => name.slice(0, -4)),
);
const ids = new Set(screenshots.map((shot) => shot.id));
const problems: string[] = [];

for (const shot of screenshots) {
  if (!files.has(shot.id)) problems.push(`manifest entry "${shot.id}" has no file ${shot.id}.png`);
  if (shot.extensionVersion !== extensionVersion) {
    problems.push(
      `"${shot.id}" was taken with extension ${shot.extensionVersion}, extension.toml says ${extensionVersion}`,
    );
  }
  for (const capability of shot.capabilities) {
    if (!capabilities.includes(capability)) problems.push(`"${shot.id}" names unknown capability "${capability}"`);
  }
}
for (const file of files) {
  if (!ids.has(file)) problems.push(`file ${file}.png has no manifest entry`);
}
for (const capability of capabilities) {
  const count = screenshots.filter((shot) => shot.capabilities.includes(capability)).length;
  if (count === 0) problems.push(`capability "${capability}" has no screenshot`);
  else console.log(`${capability}: ${count} screenshot(s)`);
}

if (problems.length > 0) {
  console.error('check-screenshots: FAIL');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-screenshots: OK (${screenshots.length} screenshots, extension ${extensionVersion})`);
