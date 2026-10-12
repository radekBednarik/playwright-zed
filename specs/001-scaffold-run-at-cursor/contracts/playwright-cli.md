# Contract: Playwright CLI Invocations

The server never imports Playwright. Every interaction is a child process of the resolved
`@playwright/test/cli.js`, run with the user's `node`, cwd = `configDir`.

## Resolution

```
<configDir>/node_modules/@playwright/test/package.json   (walk upward until found)
<same dir>/cli.js                                          → playwrightCli
```

Version gate: `version >= 1.38.0`.

## Discovery

```sh
node <playwrightCli> test --list --reporter=json -c <configPath>
# env: PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/playwright-zed-list-<id>.json, CI=1
```

Parsed fields from the JSON report (recursive):

```
report.config.rootDir
report.config.projects[].testDir   -> PlaywrightConfig.testDirs (unique)
report.suites[]            -> suite.title, suite.file, suite.line, suite.column
  suite.suites[]           -> nested describes (same shape)
  suite.specs[]            -> spec.title, spec.file, spec.line, spec.column,
                              spec.tests[].projectName
```

File-level suites (title == file name, no describe) contribute no `describeLines`.

## Run

```sh
node <playwrightCli> test <relative file>[:<line>] -c <configPath> --reporter=list,json
# env: PLAYWRIGHT_JSON_OUTPUT_FILE=<tmp>/playwright-zed-run-<id>.json, FORCE_COLOR=0
```

`<relative file>` is relative to `configDir`. `<line>` is the 1-based spec or describe line.
Kind `file` omits `:<line>`.

Parsed fields:

```
report.stats.expected / unexpected / skipped / flaky
report.suites[...].specs[]:
  spec.ok (boolean), spec.title, spec.file, spec.line
  spec.tests[].results[] -> result.status, result.error?.message, result.error?.location?{file,line,column}
```

Exit codes: 0 all passed, 1 failures, anything else with no JSON report = `error`.

## Cancellation

SIGTERM to the process group; SIGKILL after 5 s. Temp report files are deleted after parsing
or on cancel.

## Out of scope for this feature (recorded for later rows)

`--headed`, `--debug`, `--ui`, `--project`, `--trace`, `show-trace`, `codegen`,
`--last-failed`.
