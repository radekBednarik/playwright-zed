// Generate src/content/docs/reference/parity.md from ../docs/parity.md (feature 010).
// Runs before dev and build; the output is gitignored and never edited by hand.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const source = join(repoRoot, 'docs', 'parity.md');
const target = join(here, '..', 'src', 'content', 'docs', 'reference', 'parity.md');

let markdown: string;
try {
  markdown = readFileSync(source, 'utf8');
} catch {
  console.error(`sync-parity: cannot read ${source}`);
  process.exit(1);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
} catch {
  // git unavailable (for example in a tarball checkout): keep "unknown"
}

const body = markdown.replace(/^# Parity Matrix\s*\n/, '');
const date = new Date().toISOString().slice(0, 10);
const frontmatter = [
  '---',
  'title: Parity with the VS Code extension',
  'description: One row per capability of the upstream Playwright VS Code extension, with the status and the Zed primitive used.',
  'tableOfContents: false',
  'editUrl: false',
  '---',
  '',
  `This page is generated at build time from [\`docs/parity.md\`](https://github.com/radekBednarik/playwright-zed/blob/main/docs/parity.md) in the repository (commit \`${commit}\`, built ${date}). Edit the source file, not this page.`,
  '',
].join('\n');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, frontmatter + body);
console.log(`sync-parity: wrote ${target} from ${source} (${commit})`);
