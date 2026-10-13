# Research: Zed Registry Submission

Date: 2026-10-13. Every external rule below was read from the live source on that date; the
constitution binds to the live documents, so re-check before opening the PR if days have
passed. Local verification was run on WSL2 with rustc 1.99 (default) and rustc 1.90
(installed for this feature), Node 24.19, corepack 0.35.

## R1. Does the extension build on the registry's toolchain?

- **Decision**: Yes. The registry CI (`.github/workflows/ci.yml` in `zed-industries/extensions`)
  pins Rust 1.90 with the `wasm32-wasip2` target and runs the `zed-extension` CLI at commit
  `9ee3c503a4bbbc6b4a0f8a789acca4871d773223`. Verified locally:

  ```text
  $ rustup toolchain install 1.90 --profile minimal --target wasm32-wasip2
  $ cargo +1.90 build --release --target wasm32-wasip2 --target-dir target/rust190
      Finished `release` profile [optimized] target(s) in 8.37s
  target/rust190/wasm32-wasip2/release/playwright_zed.wasm  248438 bytes
  ```

  The committed `Cargo.lock` resolves under 1.90 without changes.
- **Rationale**: a lock-file or dependency bump that needs a newer compiler would fail the
  registry pipeline while passing the project's own CI on `stable`. FR-015 therefore adds a
  Rust 1.90 job to the project CI next to `stable`.
- **Alternatives considered**: pinning the project to 1.90 only (rejected: the registry may
  move its pin and the project should keep building on current stable); `rust-toolchain.toml`
  (rejected: the registry sets `RUSTUP_TOOLCHAIN` itself, and a toolchain file would force
  every contributor onto an old compiler).

## R2. Can the registry's checks be run locally before the PR?

- **Decision**: Yes, in two layers.
  1. The packaging CLI alone, against this repository, reproduces the build and the manifest
     the registry validates. Verified today:

     ```text
     $ RUSTUP_TOOLCHAIN=1.90 ./zed-extension --source-dir <repo> --output-dir out --scratch-dir scratch
     ... finished compiling extension in 8.31s
     out/manifest.json: {"name":"Playwright for Zed","version":"0.3.0", ..., "provides":["language-servers"]}
     out/archive.tar.gz
     ```

     The CLI writes `extension.wasm` into the source directory; it is gitignored.
  2. The registry's own scripts, inside the prepared fork clone:
     `corepack pnpm@11 install`, `corepack pnpm@11 sort-extensions`, then
     `corepack pnpm@11 package-extensions playwright-runner-lsp` with `SHOULD_PUBLISH` unset.
     This runs `validateExtensionsToml`, `validateGitmodules`, `validateGitmodulesLocations`,
     the licence matcher, the id match between `extensions.toml` and `extension.toml`, the
     version match, and `validateManifest` (the display-name rules). It needs `origin/main`
     in the clone for the merge-base diff and the `zed-extension` binary at the repo root.
     The S3 client is constructed with empty credentials but never called unless
     `SHOULD_PUBLISH=true`.
- **Rationale**: SC-001 asks for a first-run green pipeline. The only way to know is to run
  the same code.
- **Alternatives considered**: trusting the documented rules (rejected: the display-name rule
  exists only in `src/lib/validation.js`, not in the docs); waiting for the PR pipeline
  (rejected: a failed PR costs one of three slots and review goodwill).

## R3. What exactly fails today, and what must be renamed?

- **Finding**: `validateManifest` rejects names that start with `Zed `, end with ` Zed`, or
  contain `extension` (case-insensitive). "Playwright for Zed" ends with " Zed". The id
  rules (`^[a-z0-9-]+$`, no `zed-` prefix, no `-zed` suffix, no `extension`) pass for both
  `playwright` and `playwright-runner-lsp`. The licence matcher recognises the root `LICENSE`
  as MIT. The description may contain the word "extension" (only `name` is checked).
- **Decision**: id `playwright-runner-lsp`, display name "Playwright Runner" (owner, 2026-10-13;
  the `-lsp` suffix follows the publishing prerequisite for language-server-only manifests and
  supersedes `playwright-runner`, chosen earlier the same day).
  Rename scope, found by grep on 2026-10-13:

  | Location | Change |
  |----------|--------|
  | `extension.toml` | `id`, `name`, `version` 0.4.0 |
  | `Cargo.toml` | `version` 0.4.0 (crate name `playwright-zed` stays; the CLI accepts any crate name) |
  | `README.md` | H1, project description, install section (registry first), dev-extension note about uninstalling the old `playwright` id, the "zed: extensions must list ..." line |
  | `CLAUDE.md` | H1 |
  | `docs/publishing.md` | submodule path, entry, id-fallback paragraph, self-check list (FR-014), work dir path `work/playwright-runner-lsp` |
  | `.claude/memory/*.md` | display name, id, `work/playwright-runner-lsp` path |
  | `server/package.json` `description`, `server/README.md` | name reference |
  | `server/src/reporting.ts` (discovery question text), `specs/002-discovery-consent/contracts/discovery-consent.md`, server tests asserting the text | "Playwright Runner found a Playwright configuration ..." |
  | `specs/001-scaffold-run-at-cursor/contracts/extension-manifest.md` | superseded note pointing at this feature's manifest contract |

  Untouched on purpose: `.specify/memory/constitution.md` title (project name in a governed
  document; an amendment is not needed for a display-name change and would cost a version
  bump), `language_servers.playwright` table key and the npm package name
  `playwright-zed-language-server` (internal identifiers, not validated, and renaming the
  npm package would require a new package).
- **Server republish**: the server text changes are committed but the npm package is not
  republished for this feature. The extension keeps pinning 0.3.0 (published
  2026-10-13 07:06 UTC). The only visible effect is the discovery question on Zed older
  than 0.218 still saying "Playwright for Zed" until the next server release. The owner may
  publish server 0.4.0 before the submission if they want the text consistent; the
  hand-over lists it as optional.
- **Alternatives considered**: "Playwright Test" (mirrors upstream's "Playwright Test for
  VSCode"; owner chose "Runner"); "Playwright" (owner chose the suffix for the id and the
  matching name).

## R4. How is the registry fork clone prepared without the fork existing?

- **Decision**: clone the upstream registry as a sibling directory of this repository,
  `../zed-extensions` (outside this repo so it never ends up in this repo's git), on a
  branch `playwright-runner-lsp` from `origin/main`, without `git submodule update` (the registry
  has 1574 submodules; the publishing guide's init-and-update step is not needed for a PR,
  and `package-extensions` checks out only the changed submodule). Then:

  ```sh
  git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright-runner-lsp
  cd extensions/playwright-runner-lsp && git checkout v0.4.0 && git switch main  # commit on a branch
  ```

  Add the `extensions.toml` entry, run `corepack pnpm@11 sort-extensions`, run the local
  checks from R2, commit on the branch. The owner then runs
  `gh repo fork zed-industries/extensions --clone=false`, adds the fork as a remote, pushes
  the branch, and opens the PR from the fork. Forking in advance by the agent is an
  outward-facing account action and stays with the owner (memory decision of 2026-10-12).
- **Rationale**: everything that is local can be reviewed before any public action; the
  owner's two remaining public actions (fork, push) are one command each.
- **Alternatives considered**: `gh repo fork` by the agent (rejected: owner's account, owner's
  call); a worktree inside this repo (rejected: the registry clone must not be nested in the
  extension repository the submodule points at).

## R5. Which commit does the submodule pin, and how is it released?

- **Decision**: the feature branch `004-zed-registry-submission` merges into `main` through
  a PR with green CI, as features 001 to 003 did. Then a release commit "release: 0.4.0"
  on `main` sets `extension.toml` and `Cargo.toml` to 0.4.0 and is tagged `v0.4.0`. The
  submodule pins that tagged commit, which is on `main` (the registry requires the commit
  to be on a branch). Version bump is MINOR because the id changes how users address the
  extension (constitution, Technical Constraints).
- **Rationale**: matches the 0.1.0 to 0.3.0 release pattern recorded in git history and
  `docs/publishing.md`.
- **Alternatives considered**: bumping to 0.4.0 inside the feature branch (rejected: the
  tagged commit should be the merge result on `main`, not a branch commit that the merge
  commit then supersedes).

## R6. What does the registry's Danger run check on the PR itself?

- **Finding** (`dangerfile.ts` and `danger-plugin-pr-hygiene` 0.7.1 sources):
  - Fails if `extensions.toml` is not modified (it will be).
  - Warns (not fails) on the PR title if it starts with a lowercase letter, ends with
    `. ! ? , : ;`, or uses a Conventional Commits prefix such as `feat:` or `chore:`.
    Imperative-mood checking is switched off by Zed.
  - The PR template is one checkbox: contribution guidelines read and followed.
- **Decision**: these are facts for the owner's to-do list, not text to draft. The owner
  writes the title and body themselves (AI policy).

## R7. How is the hand-over shaped so it respects the AI policy?

- **Decision**: one file, `specs/004-zed-registry-submission/owner-handover.md`, in two
  parts. Part 1 is a fact sheet: tag, commit, version, npm version and publish date, Zed
  release used for manual verification, the quickstart scenarios run and their outcomes,
  the local registry-check output, the registry rules in force on the date. Part 2 is a
  numbered to-do list of actions only the owner performs: fork, add remote, push, write
  title and body, tick the checkbox, open the PR, watch for review, answer within three
  weeks, report back so the memory can be updated. The file contains no PR title, no PR
  body, no reply drafts, and says so in its header. Structure is fixed in
  [contracts/owner-handover.md](contracts/owner-handover.md).
- **Rationale**: the policy requires the owner to explain the extension in their own words;
  a fact sheet supports that without supplying words. It also gives the owner material to
  answer "was this tested at the submitted commit".
- **Alternatives considered**: a draft PR body "for editing" (rejected: the policy forbids
  copying AI responses and the line between editing and copying is not one the owner should
  have to defend).

## R8. Users who installed the dev extension under the old id

- **Finding**: Zed keys installed and dev extensions by id. A dev extension `playwright`
  and a registry extension `playwright-runner-lsp` would both load and both start a
  language server named "Playwright" for the same files.
- **Decision**: the README install section tells dev-extension users to uninstall the old
  `playwright` entry in `zed: extensions` before installing from the registry; the owner's
  machine does the same during the quickstart (reinstall the dev extension under the new
  id, which also moves the work directory to `~/.local/share/zed/extensions/work/playwright-runner-lsp/`).

## R9. The "Work in progress." description prefix

- **Finding**: nothing in the rules forbids it. The prerequisites close "clearly untested"
  extensions; a work-in-progress label describes feature coverage, not testing.
- **Decision**: keep it; it is honest about parity status and was the owner's choice in
  feature 001. Recorded as a possible review question in the hand-over so the owner is not
  surprised.

## R10. Local tooling availability

- `pnpm` is not installed; `corepack pnpm@11 --version` returned 11.28.5 after a one-time
  download, so the registry's scripts run with `corepack pnpm@11 <script>`.
- The `zed-extension` CLI for the registry's pinned commit downloads from
  `https://zed-extension-cli.nyc3.digitaloceanspaces.com/<sha>/x86_64-unknown-linux-gnu/zed-extension`
  (167 MB). It is kept outside the repository (scratch directory) and is not committed.
- `gh pr list -R zed-industries/extensions --author radekBednarik --state open` returned
  an empty list: zero open PRs, three slots free. No fork `radekBednarik/extensions` exists
  yet.
- The registry's `extensions.toml` (downloaded 2026-10-13, 1574 entries) has no
  `playwright-runner-lsp` entry; the only Playwright-related entry is `mcp-server-playwright`.
