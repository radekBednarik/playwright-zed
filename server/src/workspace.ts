import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlaywrightConfig, Workspace } from './types';
import { isSupported, parseVersion } from './version';

const CONFIG_NAME = /^playwright\.config\.(ts|js|mts|mjs|cts|cjs)$/;
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'test-results', 'playwright-report', 'blob-report']);

/** True when the file name is one Playwright treats as a configuration file. */
export function isConfigFile(file: string): boolean {
  return CONFIG_NAME.test(path.basename(file));
}

/** Finds every Playwright config file under `root`, skipping dependency and output folders. */
export function findConfigs(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          stack.push(path.join(dir, entry.name));
        }
      } else if (entry.isFile() && CONFIG_NAME.test(entry.name)) {
        found.push(path.join(dir, entry.name));
      }
    }
  }
  return found.sort();
}

export interface ResolvedPlaywright {
  playwrightCli: string;
  playwrightVersion: { major: number; minor: number; patch: number };
  packageDir: string;
}

/** Walks upward from `configDir` to the nearest `node_modules/@playwright/test`. */
export function resolvePlaywright(configDir: string): ResolvedPlaywright | null {
  let dir = path.resolve(configDir);
  for (;;) {
    const packageDir = path.join(dir, 'node_modules', '@playwright', 'test');
    const packageJson = path.join(packageDir, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as { version?: string };
        const version = parseVersion(parsed.version ?? '');
        if (version) {
          return { playwrightCli: path.join(packageDir, 'cli.js'), playwrightVersion: version, packageDir };
        }
      } catch {
        // fall through and keep walking: a broken package.json should not hide a parent install
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Builds the config entity, or null when no `@playwright/test` package resolves for it. */
export function buildConfig(configPath: string): PlaywrightConfig | null {
  const configDir = path.dirname(configPath);
  const resolved = resolvePlaywright(configDir);
  if (!resolved) return null;
  return {
    configPath,
    configDir,
    playwrightCli: resolved.playwrightCli,
    playwrightVersion: resolved.playwrightVersion,
    supported: isSupported(resolved.playwrightVersion),
    rootDir: null,
    testDirs: [],
    tests: [],
    discoveryState: 'idle',
  };
}

function isWithin(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Nearest supported config: the one whose `configDir` is the longest prefix of `file`. */
export function configForFile(workspace: Workspace, file: string): PlaywrightConfig | null {
  let best: PlaywrightConfig | null = null;
  for (const config of workspace.configs) {
    if (!config.supported) continue;
    if (!isWithin(config.configDir, file)) continue;
    if (!best || config.configDir.length > best.configDir.length) best = config;
  }
  return best;
}

/** True when `file` lives under one of the config's discovered test directories. */
export function isUnderTestDirs(config: PlaywrightConfig, file: string): boolean {
  return config.testDirs.some((dir) => isWithin(dir, file));
}
