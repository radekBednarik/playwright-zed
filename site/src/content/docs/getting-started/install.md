---
title: Install
description: Install Playwright Runner from the Zed extension registry or from source.
---

## From the Zed extension registry

Open `zed: extensions` and search for **Playwright Runner**. The listing is under review in
the Zed extension registry
([zed-industries/extensions#7975](https://github.com/zed-industries/extensions/pull/7975)).
Until the review completes, install from source.

The extension installs the language server package `playwright-zed-language-server` from
npm on first use. Nothing is bundled.

## From source

For the unreleased version, or while the registry listing is under review:

1. `rustup target add wasm32-wasip2`
2. `cd server && npm install && npm run build` in a clone of
   [the repository](https://github.com/radekBednarik/playwright-zed)
3. In Zed, run `zed: install dev extension` and pick the repository's root.

If you installed a dev extension before 0.4.0, it is listed as "Playwright for Zed" with
the id `playwright`; uninstall it in `zed: extensions` first, otherwise two Playwright
language servers start on the same files.

## After an update or reinstall

Files that are already open when the extension is installed are picked up without closing
and reopening them. One exception: after an **update, a reinstall, or a rerun of
`zed: install dev extension` in the same Zed session**, Zed keeps the Playwright server
stopped. It marks the server as manually stopped when the old extension version unloads
and never clears the mark, so no file is served, open before or after. Run
`editor: restart language server` from any TypeScript or JavaScript file of the project,
or restart Zed; closing and reopening files does not help. Tracked in Zed as
[zed-industries/zed#60405](https://github.com/zed-industries/zed/issues/60405).

Next: [First run](/playwright-zed/getting-started/first-run/).
