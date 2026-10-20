import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { STATE_SUBDIR, STORE_FILE, TRACE_STORE_FILE, readSelections, readTracePreference, stateDir, writeSelection, writeTracePreference } from '../../src/store';

const temps: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-zed-store-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const CONFIG_A = '/repo/a/playwright.config.ts';
const CONFIG_B = '/repo/b/playwright.config.ts';

describe('stateDir', () => {
  it('prefers the override', () => {
    expect(stateDir({ PLAYWRIGHT_ZED_STATE_DIR: '/custom ' }, 'linux', '/home/u')).toBe('/custom');
    expect(stateDir({ PLAYWRIGHT_ZED_STATE_DIR: '/custom', XDG_STATE_HOME: '/xdg' }, 'win32', '/home/u')).toBe('/custom');
  });
  it('uses XDG_STATE_HOME or ~/.local/state on Linux', () => {
    expect(stateDir({ XDG_STATE_HOME: '/xdg' }, 'linux', '/home/u')).toBe(path.join('/xdg', STATE_SUBDIR));
    expect(stateDir({}, 'linux', '/home/u')).toBe(path.join('/home/u/.local/state', STATE_SUBDIR));
    expect(stateDir({ PLAYWRIGHT_ZED_STATE_DIR: '  ' }, 'linux', '/home/u')).toBe(path.join('/home/u/.local/state', STATE_SUBDIR));
  });
  it('uses Application Support on macOS and LOCALAPPDATA on Windows', () => {
    expect(stateDir({}, 'darwin', '/Users/u')).toBe(path.join('/Users/u/Library/Application Support', STATE_SUBDIR));
    expect(stateDir({ LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'win32', 'C:\\Users\\u')).toBe(path.join('C:\\Users\\u\\AppData\\Local', STATE_SUBDIR));
    expect(stateDir({}, 'win32', 'C:\\Users\\u')).toBe(path.join('C:\\Users\\u', 'AppData', 'Local', STATE_SUBDIR));
  });
});

describe('readSelections', () => {
  it('returns nothing for a missing, malformed or wrong-version file', () => {
    const dir = tempDir();
    expect(readSelections(dir)).toEqual({});
    expect(readSelections(path.join(dir, 'nope'))).toEqual({});
    fs.writeFileSync(path.join(dir, STORE_FILE), '{not json');
    expect(readSelections(dir)).toEqual({});
    fs.writeFileSync(path.join(dir, STORE_FILE), JSON.stringify({ version: 2, configs: { [CONFIG_A]: { projects: ['x'], updatedAt: 't' } } }));
    expect(readSelections(dir)).toEqual({});
    fs.writeFileSync(path.join(dir, STORE_FILE), JSON.stringify({ version: 1, configs: { [CONFIG_A]: { projects: [1], updatedAt: 't' }, [CONFIG_B]: { projects: ['ok'], updatedAt: 't' } } }));
    expect(readSelections(dir)).toEqual({ [CONFIG_B]: { projects: ['ok'], updatedAt: 't' } });
  });
  it('ignores a symlinked store file', () => {
    const dir = tempDir();
    const real = path.join(dir, 'elsewhere.json');
    fs.writeFileSync(real, JSON.stringify({ version: 1, configs: { [CONFIG_A]: { projects: ['x'], updatedAt: 't' } } }));
    fs.symlinkSync(real, path.join(dir, STORE_FILE));
    expect(readSelections(dir)).toEqual({});
  });
});

describe('writeSelection', () => {
  it('creates the directory and file with owner-only modes and keeps other entries', () => {
    const dir = path.join(tempDir(), 'nested', STATE_SUBDIR);
    const first = writeSelection(dir, CONFIG_A, ['chromium'], new Date('2026-10-14T10:00:00.000Z'));
    expect(first).toEqual({ projects: ['chromium'], updatedAt: '2026-10-14T10:00:00.000Z' });
    writeSelection(dir, CONFIG_B, ['mobile', 'chromium']);
    const stored = readSelections(dir);
    expect(stored[CONFIG_A]).toEqual(first);
    expect(stored[CONFIG_B].projects).toEqual(['mobile', 'chromium']);
    expect(Date.parse(stored[CONFIG_B].updatedAt)).not.toBeNaN();
    expect(fs.readdirSync(dir)).toEqual([STORE_FILE]);
    if (process.platform !== 'win32') {
      expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(path.join(dir, STORE_FILE)).mode & 0o777).toBe(0o600);
    }
    const file = JSON.parse(fs.readFileSync(path.join(dir, STORE_FILE), 'utf8'));
    expect(file.version).toBe(1);
  });
  it('replaces the entry of the same config and starts over from a corrupt file', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, STORE_FILE), 'garbage');
    writeSelection(dir, CONFIG_A, ['chromium']);
    writeSelection(dir, CONFIG_A, ['mobile']);
    expect(readSelections(dir)).toMatchObject({ [CONFIG_A]: { projects: ['mobile'] } });
  });
});

describe('trace preference store (feature 008)', () => {
  it('reads nothing for a missing, malformed, wrong-version, wrong-type or symlinked file', () => {
    const dir = tempDir();
    const file = path.join(dir, TRACE_STORE_FILE);
    expect(readTracePreference(dir)).toBeNull();
    fs.writeFileSync(file, '{not json');
    expect(readTracePreference(dir)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ version: 2, showTrace: true, updatedAt: 't' }));
    expect(readTracePreference(dir)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ version: 1, showTrace: 'yes', updatedAt: 't' }));
    expect(readTracePreference(dir)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ version: 1, showTrace: true }));
    expect(readTracePreference(dir)).toBeNull();
    fs.unlinkSync(file);
    const real = path.join(dir, 'elsewhere.json');
    fs.writeFileSync(real, JSON.stringify({ version: 1, showTrace: true, updatedAt: 't' }));
    fs.symlinkSync(real, file);
    expect(readTracePreference(dir)).toBeNull();
  });
  it('round-trips the choice with owner-only modes next to the selection store', () => {
    const dir = path.join(tempDir(), STATE_SUBDIR);
    const written = writeTracePreference(dir, true, new Date('2026-10-20T10:00:00.000Z'));
    expect(written).toEqual({ showTrace: true, updatedAt: '2026-10-20T10:00:00.000Z' });
    expect(readTracePreference(dir)).toEqual(written);
    writeSelection(dir, CONFIG_A, ['chromium']);
    expect(fs.readdirSync(dir).sort()).toEqual([STORE_FILE, TRACE_STORE_FILE].sort());
    if (process.platform !== 'win32') {
      expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(path.join(dir, TRACE_STORE_FILE)).mode & 0o777).toBe(0o600);
    }
    writeTracePreference(dir, false);
    expect(readTracePreference(dir)?.showTrace).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, TRACE_STORE_FILE), 'utf8')).version).toBe(1);
  });
});
