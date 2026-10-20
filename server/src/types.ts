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

/**
 * How the current project selection came about (feature 005): `single` for configs with fewer
 * than two projects, `default` for the first project, `settings` from the editor settings,
 * `remembered` from the per-user store, `chosen` after a toggle in this session.
 */
export type SelectionSource = 'single' | 'default' | 'settings' | 'remembered' | 'chosen';

export interface ProjectSelection {
  /** Selected project names in config order; never empty when the config has projects. */
  projects: string[];
  source: SelectionSource;
  /** Set for `chosen` and `remembered`, else null. */
  updatedAt: string | null;
}

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
  /** Project names from the last successful `--list`, in config order; empty until discovery ran. */
  projects: string[];
  /** Reconciled after every discovery and after every toggle (feature 005). */
  selection: ProjectSelection;
  /** Key of the last reconcile notice shown for this config, so a repeat is not shown again. */
  noticeKey: string | null;
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
  /** Copy of `config.selection.projects` at start (feature 005). */
  projects: string[];
  /** Feature 008: copy of the trace preference at start; `--trace on` is appended when true. */
  trace: boolean;
}

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';

// ---------------------------------------------------------------------------
// Feature 008: the "Show trace viewer" preference and the traces of the last run
// ---------------------------------------------------------------------------

/** Where the on/off state came from: the per-user store, the editor settings, or the built-in default (off). */
export type TracePreferenceSource = 'remembered' | 'settings' | 'default';

export interface TracePreference {
  enabled: boolean;
  source: TracePreferenceSource;
  /** Set for `remembered` (copied from the store), else null. */
  updatedAt: string | null;
}

/** One trace attachment of one test result, from the run's JSON report (data-model.md "TraceRecord"). */
export interface TraceRecord {
  /** Absolute test file. */
  file: string;
  /** 1-based spec line, as discovery reports it. */
  line: number;
  column: number;
  title: string;
  /** Project of the result; null when the config has fewer than two projects. */
  project: string | null;
  /** The `trace` attachment path (`.zip`). */
  path: string;
  /** `startTime + duration` of the result in epoch milliseconds; the ordering key for "latest". */
  finishedAt: number;
}

// ---------------------------------------------------------------------------
// Feature 006: step events from the run and the marks derived from them
// ---------------------------------------------------------------------------

export type StepEventType = 'testBegin' | 'stepBegin' | 'stepEnd' | 'testEnd';

/**
 * One line of the step reporter's output. `step` is absent for test events; only steps with
 * a location are emitted; `duration` is set on `stepEnd` only; `status` on `testEnd` only.
 */
export interface StepEvent {
  type: StepEventType;
  test: { file: string; line: number; column: number; title: string; project: string };
  step?: { id: number; title: string; category: string; file: string; line: number; column: number };
  duration?: number;
  status?: string;
  /** Feature 008: predicted live trace path on `testBegin`, when the reporter could build it. */
  traceLive?: string;
  /** Feature 008: path of the result attachment named `trace` on `testEnd`, when there is one. */
  trace?: string;
  /** Milliseconds since the epoch, for ordering and the log. */
  at: number;
}

export interface FinishedMark {
  durationMs: number;
  count: number;
}

/** Executing and finished step lines per file (data-model.md "StepMarks"). */
export interface StepMarks {
  /** Run that produced the marks; events from any other run are ignored. */
  runId: string | null;
  /** file -> line (1-based) -> number of steps executing on that line. */
  active: Map<string, Map<number, number>>;
  /** file -> line (1-based) -> latest duration and how many times the line finished. */
  finished: Map<string, Map<number, FinishedMark>>;
  /** step id -> owner, so `testEnd` can clear the test's remaining active lines. */
  activeSteps: Map<number, { test: string; file: string; line: number }>;
}

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
  /** Project the failing attempt ran in; null when the config has fewer than two projects (feature 005). */
  project: string | null;
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
  /** Feature 008: one record per result with a `trace` attachment; empty without a report. */
  traces: TraceRecord[];
  /** Set when status is `error`. */
  errorMessage?: string;
}

/** Per-workspace, per-session answer to "run test discovery?" (feature 002). */
export type DiscoveryDecision = 'pending' | 'enabled' | 'declined';

/**
 * Why a workspace is `enabled` (feature 003): `editor-trust` when created `enabled` because of
 * the editor trust gate; `answer` after "Run discovery" or `playwright.enableDiscovery`; `null`
 * while `pending` or `declined`.
 */
export type DiscoverySource = 'editor-trust' | 'answer' | null;

export interface Workspace {
  rootUri: string;
  rootPath: string;
  configs: PlaywrightConfig[];
  lastRun: RunRequest | null;
  versionWarningShown: boolean;
  /** `pending` until the developer answers; `pending` and `declined` are both idle. */
  discovery: DiscoveryDecision;
  /** True once the question was sent, so it is asked at most once per session. */
  discoveryAsked: boolean;
  discoverySource: DiscoverySource;
  /**
   * `true` for folders from `initialize.workspaceFolders` or `didChangeWorkspaceFolders`,
   * `false` for the `rootUri` fallback.
   */
  fromWorkspaceFolders: boolean;
  /** Feature 006: step marks of the latest run. */
  marks: StepMarks;
  /** Feature 006: path of the last written run log, null before the first run. */
  outputFile: string | null;
  /** Feature 008: trace records of the latest finished run, null before the first run ends. */
  traces: { runId: string; records: TraceRecord[] } | null;
}
