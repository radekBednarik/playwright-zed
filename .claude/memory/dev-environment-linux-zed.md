Since 2026-10-29 Radek works on this repo on a native Ubuntu 26.04 LTS desktop (GNOME 50 on
Wayland, `DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`, display 1920 x 1200 at scale 1). Zed
1.26.2 is installed in `~/.local/zed.app` with the symlink `~/.local/bin/zed` and opens
windows directly. Node 26, cargo and the `wasm32-wasip2` target are on PATH; `gh` is
authenticated. The owner's own Zed uses Catppuccin Mocha, vim mode and a custom font, so
documentation screenshots come from a separate profile:
`site/scripts/zed-screenshot-profile.sh` launches Zed with `XDG_CONFIG_HOME` and
`XDG_DATA_HOME` under `~/.cache/playwright-zed-screenshots/` (verified: Zed honours both),
and `site/scripts/capture-screenshot.py` captures through the desktop portal
(`org.freedesktop.portal.Screenshot`, non-interactive; the owner granted the one-time
permission on 2026-10-29, the permission store remembers it; the direct GNOME Shell
screenshot interface is refused on GNOME 50; the 32 px top bar is cropped).

Earlier machine (2026-10-12 to 2026-10-28, kept for reference): WSL2 with a Linux Zed in
`~/.local/zed.app` under WSLg, Windows Zed only through remoting (cannot load a dev
extension from a WSL path), the dev override `PLAYWRIGHT_ZED_SERVER_ENTRY` exported in
`~/.bashrc` because Zed reads the project environment from the login shell, WSL2 clock
stepping that made step durations negative (the server clamps to 0).

**Why:** manual verification (`zed: install dev extension`) and the feature 010 screenshots
need a Zed that can see the repository and open windows; the WSL notes no longer apply to
this machine but explain older verification records.

**How to apply:** run `~/.local/bin/zed --foreground` for extension log output; keep the
dev override out of the screenshot profile (the pictures must show the npm-installed
release); after a Rust change rerun `zed: install dev extension` (the dev extension symlinks
the repo, `extension.toml` reads live but `extension.wasm` is only recompiled by that
command) and then `editor: restart language server`. See [[playwright-zed-project]].
