#!/usr/bin/env bash
# Launch Zed on the sample project with a dedicated profile for documentation screenshots
# (feature 010). The profile lives outside the repository and never touches the owner's
# own Zed configuration or extensions.
#
#   site/scripts/zed-screenshot-profile.sh            # opens fixtures/sample-project
#   site/scripts/zed-screenshot-profile.sh --reset    # wipes the profile first
#
# First launch in a fresh profile:
#   1. trust the folder when Zed asks,
#   2. ctrl-shift-p, "zed: install dev extension", pick the repository root,
#   3. open tests/passing.spec.ts and run "editor: restart language server",
#   4. "zed: extensions" must list Playwright Runner with the released version; the server
#      is installed from npm because PLAYWRIGHT_ZED_SERVER_ENTRY is unset here.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
profile="${PLAYWRIGHT_ZED_SHOT_PROFILE:-$HOME/.cache/playwright-zed-screenshots}"
config="$profile/config"
data="$profile/data"

if [[ "${1:-}" == "--reset" ]]; then
  rm -rf "$profile"
  shift
fi

mkdir -p "$config/zed" "$data"
if [[ ! -f "$config/zed/settings.json" ]]; then
  cp "$repo/site/screenshots/zed-settings.json" "$config/zed/settings.json"
  echo "settings copied to $config/zed/settings.json"
fi

unset PLAYWRIGHT_ZED_SERVER_ENTRY
# The extension's own state (project selection, trace viewer, show browser, run output)
# stays inside the profile, so the owner's real choices are untouched.
export PLAYWRIGHT_ZED_STATE_DIR="$profile/state"
mkdir -p "$PLAYWRIGHT_ZED_STATE_DIR"

echo "profile config: $config/zed"
echo "profile data:   $data/zed"
echo "extension state: $PLAYWRIGHT_ZED_STATE_DIR"
echo "extension work dir after install: $data/zed/extensions/work/playwright-runner-lsp"
echo "opening $repo/fixtures/sample-project (Zed stays in the foreground, ctrl-c quits)"

exec env XDG_CONFIG_HOME="$config" XDG_DATA_HOME="$data" \
  zed --foreground -n "$repo/fixtures/sample-project" "$@"
