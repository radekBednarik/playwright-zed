import { compareVersions, parseVersion } from './version';

/**
 * First Zed release with worktree trust (feature 003, research R2): Zed starts a language
 * server only after the user trusted the worktree, and remembers that across restarts.
 */
export const MIN_TRUST_GATE_VERSION = '0.218.0';

/** `ReleaseChannel::display_name()` values Zed sends as `clientInfo.name`. */
const ZED_CLIENT_NAMES = new Set(['Zed', 'Zed Preview', 'Zed Nightly', 'Zed Dev']);

/**
 * True when the client is a Zed release that starts this server only in trusted folders.
 * Decides from `initialize.params.clientInfo` alone; nothing from the workspace counts.
 */
export function editorHasTrustGate(clientInfo: { name: string; version?: string } | undefined): boolean {
  if (!clientInfo || !ZED_CLIENT_NAMES.has(clientInfo.name) || !clientInfo.version) return false;
  const version = parseVersion(clientInfo.version);
  const minimum = parseVersion(MIN_TRUST_GATE_VERSION);
  return version !== null && minimum !== null && compareVersions(version, minimum) >= 0;
}
