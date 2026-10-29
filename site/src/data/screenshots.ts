// Screenshot manifest (feature 010). One entry per PNG in src/assets/screenshots/.
// Rules (specs/010-user-docs-site/data-model.md):
//   id               file name without extension, kebab-case
//   capabilities     one or more ids from `capabilities` below (a picture may show several)
//   alt              what is visible, for readers who cannot see the image
//   caption          one sentence tying the picture to the text
//   extensionVersion the released extension the picture shows; must equal extension.toml
//   zedVersion       the Zed release
//   platform         where it was taken (window chrome differs per platform)
//   capturedOn       ISO date
//   scene            scene id from specs/010-user-docs-site/quickstart.md
// `npm run check-screenshots` enforces the file/entry/capability/version rules.

export const capabilities = [
  'run-test',
  'run-describe',
  'run-file',
  'rerun-last',
  'run-result',
  'discovery-consent',
  'project-selection',
  'step-labels',
  'run-output',
  'trace-viewer',
  'show-trace',
  'show-browser',
  'close-all-browsers',
] as const;

export type Capability = (typeof capabilities)[number];

export interface Screenshot {
  id: string;
  capabilities: Capability[];
  alt: string;
  caption: string;
  extensionVersion: string;
  zedVersion: string;
  platform: string;
  capturedOn: string;
  scene: string;
}

const common = {
  extensionVersion: '0.8.0',
  zedVersion: '1.26.2',
  platform: 'Linux (Ubuntu 26.04, GNOME)',
  capturedOn: '2026-10-29',
};

export const screenshots: Screenshot[] = [
  {
    id: 'landing-hero',
    capabilities: ['run-test', 'step-labels'],
    alt: 'Zed with tests/passing.spec.ts open. Run test and Run describe lenses sit above each test, step duration labels follow the step lines, and a notification in the corner reports the passing run.',
    caption: 'Lenses above the tests, durations after the steps and the result of the last run, all inside the editor.',
    scene: 'landing-hero',
    ...common,
  },
  {
    id: 'run-test-lens',
    capabilities: ['run-test', 'run-describe'],
    alt: 'A Playwright spec file in Zed with a "Run test" code lens above every test and a "Run describe" lens above each describe block.',
    caption: 'Lenses above each test and describe block after discovery.',
    scene: 'run-test-lens',
    ...common,
  },
  {
    id: 'run-actions-menu',
    capabilities: ['run-test', 'run-describe', 'run-file', 'rerun-last'],
    alt: 'The code action menu opened with ctrl-. on a test line inside the math describe block, listing Playwright: Run test at cursor, Run file, Re-run last, Show last run output, the Show trace viewer and Show browser toggles, the chromium and mobile project toggles and Select all projects.',
    caption: 'The same actions from the code action menu, with the option and project toggles below them; on a describe line the first entry is Run describe at cursor.',
    scene: 'run-actions-menu',
    ...common,
  },
  {
    id: 'run-result-pass',
    capabilities: ['run-result'],
    alt: 'Zed after a single test run: a notification reads "1 passed, 0 failed, 0 skipped" with the time Playwright measured.',
    caption: 'A passing run ends with a notification.',
    scene: 'run-result-pass',
    ...common,
  },
  {
    id: 'run-result-fail',
    capabilities: ['run-result'],
    alt: 'tests/failing.spec.ts in Zed with a red error marker on the expect line, the failure message in the diagnostic popup, and an error notification.',
    caption: 'A failing run leaves an error marker on the failing line until the file is edited or run again.',
    scene: 'run-result-fail',
    ...common,
  },
  {
    id: 'discovery-consent',
    capabilities: ['discovery-consent'],
    alt: 'Zed asking whether to trust the sample-project folder before any language server starts.',
    caption: 'On Zed 0.218 or newer the worktree trust question is the only question; older Zed shows the Playwright notification instead.',
    scene: 'discovery-consent',
    ...common,
  },
  {
    id: 'project-picker',
    capabilities: ['project-selection'],
    alt: 'The code action menu in playwright.config.ts listing "Playwright: [x] chromium", "Playwright: [ ] mobile" and "Playwright: Select all projects".',
    caption: 'Each project of the configuration is a toggle; "Select all projects" selects every one.',
    scene: 'project-picker',
    ...common,
  },
  {
    id: 'step-labels',
    capabilities: ['step-labels'],
    alt: 'tests/slow.spec.ts during a run: the step that is executing carries a trailing "waiting" label.',
    caption: 'While the test runs, the executing step is marked at the end of its line.',
    scene: 'step-labels',
    ...common,
  },
  {
    id: 'step-durations',
    capabilities: ['step-labels'],
    alt: 'tests/slow.spec.ts after the run: every test.step line ends with its duration in milliseconds.',
    caption: 'After the run, every step line shows how long it took.',
    scene: 'step-durations',
    ...common,
  },
  {
    id: 'run-output',
    capabilities: ['run-output'],
    alt: 'Zed with the run output open in a second tab next to the spec file: the command line, the Playwright list reporter output and the summary.',
    caption: '"Show last run output" opens the complete output of the latest run in an editor tab.',
    scene: 'run-output',
    ...common,
  },
  {
    id: 'trace-viewer',
    capabilities: ['trace-viewer', 'show-trace'],
    alt: 'The Playwright trace viewer window next to Zed, showing the trace of the test that was just run.',
    caption: 'With "Show trace viewer" on, a single-test run opens Playwright\'s trace viewer with that test.',
    scene: 'trace-viewer',
    ...common,
  },
  {
    id: 'show-browser',
    capabilities: ['show-browser'],
    alt: 'A Chromium window next to Zed showing the page of the test that just ran; the window stays open after the run.',
    caption: 'With "Show browser" on, runs go through a visible browser that stays open between runs.',
    scene: 'show-browser',
    ...common,
  },
  {
    id: 'close-all-browsers',
    capabilities: ['close-all-browsers', 'show-browser'],
    alt: 'The code action menu listing "Playwright: [x] Show browser" and "Playwright: Close all browsers".',
    caption: '"Close all browsers" closes the kept browser without changing the option.',
    scene: 'close-all-browsers',
    ...common,
  },
];
