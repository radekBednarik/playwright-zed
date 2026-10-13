# Quickstart: Verify the Zed Registry Submission

Validation guide for this feature. Outcomes are recorded in `verification.md` (same format
as feature 003) and summarised in `owner-handover.md`. Steps 1 to 3 run on the feature
branch; steps 4 to 7 run at the tagged release commit on `main`.

## Prerequisites

- Everything in `.claude/memory/new-machine-setup.md` (Rust stable with `wasm32-wasip2`,
  Node 22+, server and fixture dependencies, Chromium).
- Rust 1.90: `rustup toolchain install 1.90 --profile minimal --target wasm32-wasip2`.
- `corepack` (ships with Node); `gh` authenticated as the owner.
- Linux Zed stable 1.23 or newer, started from a terminal where
  `PLAYWRIGHT_ZED_SERVER_ENTRY` is not exported (see `.claude/memory/dev-environment-wsl-zed.md`).
- About 200 MB of disk for the `zed-extension` CLI and the registry clone.

## 1. Repository checks on the feature branch

```sh
cargo test
cargo build --release --target wasm32-wasip2
cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190
cd server && npm run lint && npm run build && npm test && cd ..
grep -rn "Playwright for Zed" --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git --exclude-dir=dist . | grep -v '^./specs/00[123]' | grep -v '^./.specify/memory/constitution.md' | grep -v '^./specs/004'
```

Expected: `cargo test` 7 passed; both builds finish; server lint and build exit 0; vitest
108 passed (the discovery-question assertions updated to the new text); the grep prints
nothing (every live mention renamed; historical specs and the constitution title are
allowed to keep the old name).

## 2. Manifest and licence checks against the registry's rules

```sh
grep -E '^(id|name|version)' extension.toml
# id = "playwright-runner"   name = "Playwright Runner"   version = <current>
grep '^version' Cargo.toml   # same version
head -3 LICENSE              # MIT License, copyright line
```

Then the registry CLI build (binary kept outside the repo):

```sh
mkdir -p /tmp/zedcli && cd /tmp/zedcli
wget -q https://zed-extension-cli.nyc3.digitaloceanspaces.com/9ee3c503a4bbbc6b4a0f8a789acca4871d773223/x86_64-unknown-linux-gnu/zed-extension
chmod +x zed-extension
RUSTUP_TOOLCHAIN=1.90 ./zed-extension --source-dir <repo> --output-dir out --scratch-dir scratch
cat out/manifest.json
```

Expected: `"name":"Playwright Runner"`, `"version"` matching, `"provides":["language-servers"]`.
`extension.wasm` appears in the repo root and is gitignored.

## 3. Project CI

Push the feature branch and open its PR. Expected: the Rust job on `stable` and the new
Rust 1.90 job both green, server jobs on Node 22 and 24 green.

## 4. Release (after the feature PR merges)

```sh
git switch main && git pull
# set version = "0.4.0" in extension.toml and Cargo.toml
cargo test && cargo build --release --target wasm32-wasip2
git commit -am "release: 0.4.0" && git tag v0.4.0 && git push && git push --tags
git rev-parse v0.4.0
```

Expected: tag on `main`, SHA recorded for the fact sheet.

## 5. Manual verification in Zed at `v0.4.0`

| # | Spec ref | Steps | Expected |
|---|----------|-------|----------|
| 1 | US2-4 | `git describe --tags` in the repo | `v0.4.0` exactly |
| 2 | US3-2 prep | In Zed, `zed: extensions`, uninstall the dev extension "Playwright for Zed" (id `playwright`) if present; `zed: install dev extension` on the repo root | "Playwright Runner 0.4.0" listed, marked dev, description carries the non-affiliation notice; no "Playwright for Zed" entry remains |
| 3 | FR-008 | Run feature 001 quickstart scenarios 2, 5, 6, 7, 11, 13 and feature 003 quickstart scenarios 1 to 4 | Same outcomes as recorded in those features' verification records |
| 4 | FR-009 | `zed: quit`; start Zed from a terminal without `PLAYWRIGHT_ZED_SERVER_ENTRY`; open `fixtures/sample-project`; `cat ~/.local/share/zed/extensions/work/playwright-runner/package.json` | version `0.3.0` of `playwright-zed-language-server` installed from npm; run lenses appear; no `work/playwright/` directory in use |
| 5 | Edge: old id | With the old `playwright` dev extension still installed, open a test file | Two "Playwright" language servers appear; uninstall the old one; one remains. Record this as the reason for the README note |

Record the Zed release (`zed --version`) and date in `verification.md`.

## 6. Registry clone and local registry validation

Follow [contracts/registry-entry.md](contracts/registry-entry.md) "Preparation commands" and
"Local validation". Expected output lines to record:

```text
Packaging 'playwright-runner'. Version: 0.4.0
... finished compiling extension ...
```

followed by no thrown error, `git diff --exit-code -- extensions.toml .gitmodules` clean,
and `git status --short` showing only `extensions.toml`, `.gitmodules` and
`extensions/playwright-runner` in the commit.

Also confirm:

```sh
grep -c '^\[playwright-runner\]' extensions.toml      # 1
gh pr list -R zed-industries/extensions --author radekBednarik --state open   # fewer than 3
```

## 7. Hand-over review

Open `owner-handover.md` and check against
[contracts/owner-handover.md](contracts/owner-handover.md): header states the
prohibition; Part 1 has every fact row filled with a value and a source; Part 2 lists the
owner's actions in order; no PR title, body or reply text anywhere in the file (search for
the words "title:" and "body:" and for any paragraph addressed to maintainers).

## 8. After the owner acts (follow-up, outside this feature's "done")

- PR open: owner reports the PR number; memory and README updated to "pr-open".
- Merged: on a machine without the dev extension, install "Playwright Runner" from
  `zed: extensions`, open the fixture, run feature 001 scenario 5. Expected: lenses and a
  passing run within 5 minutes of install (SC-005). Update README install section to
  registry-first and memory to "merged".
