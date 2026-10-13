import { describe, expect, it } from 'vitest';
import { editorHasTrustGate, MIN_TRUST_GATE_VERSION } from '../../src/trust';

describe('editorHasTrustGate', () => {
  it('is true for Zed at and after the first release with worktree trust', () => {
    for (const version of ['0.218.0', '0.218.5', '0.219.4', '1.23.3']) {
      expect(editorHasTrustGate({ name: 'Zed', version }), version).toBe(true);
    }
  });

  it('ignores build metadata and prerelease suffixes', () => {
    expect(editorHasTrustGate({ name: 'Zed', version: '1.23.3+stable.42' })).toBe(true);
    expect(editorHasTrustGate({ name: 'Zed', version: '0.218.0-pre' })).toBe(true);
  });

  it('accepts every Zed release channel', () => {
    for (const name of ['Zed Preview', 'Zed Nightly', 'Zed Dev']) {
      expect(editorHasTrustGate({ name, version: '1.23.3' }), name).toBe(true);
    }
  });

  it('is false for Zed releases before worktree trust', () => {
    expect(editorHasTrustGate({ name: 'Zed', version: '0.217.4' })).toBe(false);
    expect(editorHasTrustGate({ name: 'Zed', version: '0.9.0' })).toBe(false);
  });

  it('is false when the version is missing or unparsable', () => {
    expect(editorHasTrustGate({ name: 'Zed' })).toBe(false);
    expect(editorHasTrustGate({ name: 'Zed', version: 'abc' })).toBe(false);
    expect(editorHasTrustGate({ name: 'Zed', version: '' })).toBe(false);
  });

  it('is false without client information', () => {
    expect(editorHasTrustGate(undefined)).toBe(false);
  });

  it('is false for other editors and look-alike names', () => {
    for (const name of ['Visual Studio Code', 'zed', 'Zed Something', 'Neovim']) {
      expect(editorHasTrustGate({ name, version: '1.23.3' }), name).toBe(false);
    }
  });

  it('decides from client information alone, so workspace content cannot influence it', () => {
    expect(editorHasTrustGate.length).toBe(1);
  });

  it('names 0.218.0 as the minimum version', () => {
    expect(MIN_TRUST_GATE_VERSION).toBe('0.218.0');
  });
});
