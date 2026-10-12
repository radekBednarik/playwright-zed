---
name: dev-environment-wsl-zed
description: WSL2-specific notes for this machine only (Linux Zed in ~/.local/zed.app, WSLg); User works in WSL2 (Linux) from Zed on Windows; Linux Zed 1.23.2 installed at ~/.local/bin/zed with WSLg display; wasm32-wasip2 target installed
metadata:
  type: user
---

Radek works on this repo inside WSL2 and normally edits with Zed installed on Windows. On
2026-10-12 a Linux Zed (stable 1.23.2) was installed into `~/.local/zed.app` with the symlink
`~/.local/bin/zed`, and WSLg is available (`DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`), so the
Linux Zed can open windows for dev-extension testing. The Rust target `wasm32-wasip2` is
installed via rustup. Node 24 and cargo 1.99 are on PATH; `gh` is authenticated.

**Why:** manual verification of the Zed extension (`zed: install dev extension`) needs a Zed
that can see the Linux filesystem; the Windows Zed sees WSL files only through remoting.

**How to apply:** run `~/.local/bin/zed --foreground` from WSL for extension log output; do not
assume Zed on Windows can load the dev extension from the WSL path. The dev override
`PLAYWRIGHT_ZED_SERVER_ENTRY` (now commented out in `~/.zshrc`, login shell is zsh) reaches
the extension through Zed's own process environment, so testing the npm install path needs
a fresh terminal and a full `zed: quit`; check `/proc/<zed pid>/environ` to be sure. After a Rust change (for example a pin bump)
`zed: install dev extension` must be rerun: the dev extension symlinks the repo, so
`extension.toml` reads live but `extension.wasm` is only recompiled by that command. See [[playwright-zed-project]].
