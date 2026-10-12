/** Shared data model for the Playwright language server (see specs/.../data-model.md). */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface DiscoveredTest {
  /** Absolute path. */
  file: string;
  /** 1-based line of the test title, as Playwright reports it. */
  line: number;
  column: number;
  title: string;
  /** Describe titles from outermost inward, then the spec title. */
  titlePath: string[];
  /** 1-based lines of each enclosing describe, outermost first. */
  describeLines: number[];
  /** Playwright project (browser) names the spec runs in. */
  projects: string[];
}

export type DiscoveryState = 'idle' | 'running' | 'error';

export interface PlaywrightConfig {
  configPath: string;
  configDir: string;
  /** Resolved `.../node_modules/@playwright/test/cli.js`. */
  playwrightCli: string;
  playwrightVersion: Version;
  supported: boolean;
  rootDir: string | null;
  testDirs: string[];
  tests: DiscoveredTest[];
  discoveryState: DiscoveryState;
  discoveryError?: string;
}

export type LocationKind = 'test' | 'describe' | 'file';

export interface TestLocation {
  kind: LocationKind;
  file: string;
  /** 1-based; null for kind `file`. */
  line: number | null;
}

export type RunTrigger = 'cursor' | 'file' | 'rerun';

export interface RunRequest {
  id: string;
  location: TestLocation;
  config: PlaywrightConfig;
  trigger: RunTrigger;
  startedAt: string;
  dirty: boolean;
}

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';

export interface RunCounts {
  expected: number;
  unexpected: number;
  skipped: number;
  flaky: number;
}

export interface Failure {
  file: string;
  line: number;
  column: number;
  title: string;
  /** ANSI-stripped first line of the error. */
  message: string;
  /** ANSI-stripped complete error text. */
  fullMessage: string;
}

export interface RunResult {
  request: RunRequest;
  status: RunStatus;
  counts: RunCounts;
  failures: Failure[];
  rawOutput: string;
  command: string;
  /** Wall-clock duration reported by Playwright, when a report exists. */
  durationMs: number | null;
  /** Set when status is `error`. */
  errorMessage?: string;
}

export interface Workspace {
  rootUri: string;
  rootPath: string;
  configs: PlaywrightConfig[];
  lastRun: RunRequest | null;
  versionWarningShown: boolean;
}
