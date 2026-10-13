# Contract: Registry Entry

The complete change set of the registry PR. Nothing else may differ from `origin/main` of
`zed-industries/extensions`.

## `extensions.toml` addition (position decided by `pnpm sort-extensions`)

```toml
[playwright-runner-lsp]
submodule = "extensions/playwright-runner-lsp"
version = "0.4.0"
```

## `.gitmodules` addition (position decided by `pnpm sort-extensions`)

```gitconfig
[submodule "extensions/playwright-runner-lsp"]
	path = extensions/playwright-runner-lsp
	url = https://github.com/radekBednarik/playwright-zed.git
```

## Submodule gitlink

`extensions/playwright-runner-lsp` at the commit tagged `v0.4.0` of
https://github.com/radekBednarik/playwright-zed, which is on `main`.

## Preparation commands (agent, local, in `../zed-extensions`)

```sh
git clone https://github.com/zed-industries/extensions.git ../zed-extensions
cd ../zed-extensions
git switch -c playwright-runner-lsp origin/main
git submodule add https://github.com/radekBednarik/playwright-zed.git extensions/playwright-runner-lsp
git -C extensions/playwright-runner-lsp checkout main && git -C extensions/playwright-runner-lsp reset --hard v0.4.0
# append the extensions.toml entry (see above)
corepack pnpm@11 install --frozen-lockfile
corepack pnpm@11 sort-extensions
git add extensions.toml .gitmodules extensions/playwright-runner-lsp
git commit -m "Add playwright-runner-lsp extension"
```

The commit message above is a local placeholder; the owner may amend it before pushing.
No submodule other than ours is initialised.

## Local validation (agent, same directory, before hand-over)

```sh
wget -q https://zed-extension-cli.nyc3.digitaloceanspaces.com/9ee3c503a4bbbc6b4a0f8a789acca4871d773223/x86_64-unknown-linux-gnu/zed-extension
chmod +x zed-extension
RUSTUP_TOOLCHAIN=1.90 REF_NAME=playwright-runner-lsp corepack pnpm@11 package-extensions playwright-runner-lsp
git diff --exit-code -- extensions.toml .gitmodules     # sorted check, must be clean
git status --short                                      # only the three expected paths
```

Expected: `Packaging 'playwright-runner-lsp'. Version: 0.4.0`, a successful build log, no
thrown validation error, and a clean diff after the sort. The `zed-extension` binary,
`build/`, `output/` and `scratch/` are registry-ignored or deleted before commit; verify
with `git status`.

## Owner actions (not performed by the agent)

```sh
gh repo fork zed-industries/extensions --clone=false      # personal account
cd ../zed-extensions && git remote add fork https://github.com/radekBednarik/extensions.git
git push -u fork playwright-runner-lsp
# open the PR on GitHub from radekBednarik:playwright-runner-lsp to zed-industries:main,
# write title and body personally, tick the template checkbox
```

PR constraints the owner meets by hand: one extension per PR; title in sentence case with no
trailing punctuation and no Conventional Commits prefix (warnings otherwise); body in the
owner's own words; reply to review within three weeks.
