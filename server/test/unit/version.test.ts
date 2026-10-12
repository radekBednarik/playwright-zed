import { describe, expect, it } from 'vitest';
import { compareVersions, formatVersion, isSupported, parseVersion } from '../../src/version';

describe('parseVersion', () => {
  it('parses plain semver', () => {
    expect(parseVersion('1.64.0')).toEqual({ major: 1, minor: 64, patch: 0 });
  });
  it('ignores prerelease and build metadata', () => {
    expect(parseVersion('1.38.0-beta.1+build')).toEqual({ major: 1, minor: 38, patch: 0 });
  });
  it('accepts a leading v', () => {
    expect(parseVersion('v1.40.2')).toEqual({ major: 1, minor: 40, patch: 2 });
  });
  it('returns null for garbage', () => {
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('isSupported', () => {
  it('accepts 1.38.0 and newer', () => {
    expect(isSupported({ major: 1, minor: 38, patch: 0 })).toBe(true);
    expect(isSupported({ major: 1, minor: 64, patch: 0 })).toBe(true);
    expect(isSupported({ major: 2, minor: 0, patch: 0 })).toBe(true);
  });
  it('rejects anything below 1.38.0', () => {
    expect(isSupported({ major: 1, minor: 37, patch: 9 })).toBe(false);
    expect(isSupported({ major: 0, minor: 99, patch: 0 })).toBe(false);
  });
});

describe('compareVersions and formatVersion', () => {
  it('orders by major, minor, patch', () => {
    expect(compareVersions({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 4 })).toBeLessThan(0);
    expect(compareVersions({ major: 1, minor: 3, patch: 0 }, { major: 1, minor: 2, patch: 9 })).toBeGreaterThan(0);
  });
  it('formats back to a dotted string', () => {
    expect(formatVersion({ major: 1, minor: 38, patch: 0 })).toBe('1.38.0');
  });
});
