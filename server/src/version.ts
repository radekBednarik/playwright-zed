import type { Version } from './types';

export const MINIMUM_SUPPORTED: Version = { major: 1, minor: 38, patch: 0 };

/** Parses `major.minor.patch`, ignoring prerelease and build metadata. */
export function parseVersion(input: string): Version | null {
  const match = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(input);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function isSupported(version: Version): boolean {
  return compareVersions(version, MINIMUM_SUPPORTED) >= 0;
}

export function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}
