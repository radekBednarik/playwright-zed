// Transparent LSP tap for verification (quickstart scenario 5). Forwards stdin and stdout
// between Zed and the real server and appends every chunk, with direction and timestamp, to
// PLAYWRIGHT_ZED_TAP_FILE. Point PLAYWRIGHT_ZED_SERVER_ENTRY at this file and
// PLAYWRIGHT_ZED_TAP_TARGET at the real entry (default: the repo's server/bin script).
// Evidence tool only; never shipped, never loaded by the extension in normal use.
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const target =
  process.env.PLAYWRIGHT_ZED_TAP_TARGET ||
  path.resolve(__dirname, '../../../server/bin/playwright-zed-language-server.js');
const tapFile = process.env.PLAYWRIGHT_ZED_TAP_FILE || path.join(require('node:os').tmpdir(), 'playwright-zed-tap.log');
const log = fs.createWriteStream(tapFile, { flags: 'a' });
const stamp = () => new Date().toISOString();
log.write(`## ${stamp()} tap start pid=${process.pid} target=${target} argv=${JSON.stringify(process.argv.slice(2))} cwd=${process.cwd()}\n`);

const child = spawn(process.execPath, [target, ...process.argv.slice(2)], { stdio: ['pipe', 'pipe', 'inherit'] });
process.stdin.on('data', (chunk) => {
  log.write(`>> ${stamp()} ${chunk}\n`);
  child.stdin.write(chunk);
});
process.stdin.on('end', () => child.stdin.end());
child.stdout.on('data', (chunk) => {
  log.write(`<< ${stamp()} ${chunk}\n`);
  process.stdout.write(chunk);
});
child.on('exit', (code) => {
  log.write(`## ${stamp()} server exit ${code}\n`);
  log.end(() => process.exit(code ?? 0));
});
