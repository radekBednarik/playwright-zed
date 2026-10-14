import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Subdirectory of the platform state directory that holds this server's files. */
export const STATE_SUBDIR = 'playwright-zed-language-server';
/** Per-user memory of project selections (feature 005, research R5). */
export const STORE_FILE = 'project-selection.json';
/** Environment override for the state directory (tests, power users). */
export const STATE_DIR_VAR = 'PLAYWRIGHT_ZED_STATE_DIR';

export interface StoredSelection {
  projects: string[];
  updatedAt: string;
}

interface StoreFile {
  version: 1;
  configs: Record<string, StoredSelection>;
}

/**
 * Where the server keeps per-user state: the override, else `$XDG_STATE_HOME` or
 * `~/.local/state` on Linux, `~/Library/Application Support` on macOS, `%LOCALAPPDATA%` on
 * Windows, each with the `playwright-zed-language-server` subdirectory.
 */
export function stateDir(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, home: string = os.homedir()): string {
  const override = env[STATE_DIR_VAR]?.trim();
  if (override) return override;
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), STATE_SUBDIR);
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', STATE_SUBDIR);
  const xdg = env.XDG_STATE_HOME?.trim();
  return path.join(xdg || path.join(home, '.local', 'state'), STATE_SUBDIR);
}

function isStoredSelection(value: unknown): value is StoredSelection {
  if (!value || typeof value !== 'object') return false;
  const entry = value as { projects?: unknown; updatedAt?: unknown };
  return Array.isArray(entry.projects) && entry.projects.every((p) => typeof p === 'string') && typeof entry.updatedAt === 'string';
}

/**
 * Reads every stored selection, keyed by absolute config path. A missing, unreadable,
 * malformed or symlinked file yields `{}`; the caller decides whether to log.
 */
export function readSelections(dir: string): Record<string, StoredSelection> {
  const file = path.join(dir, STORE_FILE);
  let raw: string;
  try {
    if (!fs.lstatSync(file).isFile()) return {};
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const store = parsed as Partial<StoreFile> | null;
  if (!store || store.version !== 1 || !store.configs || typeof store.configs !== 'object') return {};
  const result: Record<string, StoredSelection> = {};
  for (const [configPath, entry] of Object.entries(store.configs)) {
    if (isStoredSelection(entry)) result[configPath] = { projects: [...entry.projects], updatedAt: entry.updatedAt };
  }
  return result;
}

/**
 * Stores the selection for one config, keeping every other entry: read, merge, write to a
 * temp file in the same directory, rename. Directory `0700`, file `0600`. Throws on failure.
 */
export function writeSelection(dir: string, configPath: string, projects: string[], now: Date = new Date()): StoredSelection {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const entry: StoredSelection = { projects: [...projects], updatedAt: now.toISOString() };
  const store: StoreFile = { version: 1, configs: { ...readSelections(dir), [configPath]: entry } };
  const file = path.join(dir, STORE_FILE);
  const temp = path.join(dir, `${STORE_FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
  try {
    fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
  return entry;
}
