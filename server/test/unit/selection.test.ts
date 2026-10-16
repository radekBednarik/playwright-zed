import { describe, expect, it } from 'vitest';
import { allSelected, isTestSelected, parseProjectsSetting, projectArgs, resolveSelection, selectAll, toggleProject } from '../../src/selection';
import type { ProjectSelection } from '../../src/types';

const TWO = ['chromium', 'mobile'];
const THREE = ['chromium', 'firefox', 'webkit'];

describe('resolveSelection', () => {
  it('treats fewer than two projects as single, whatever is remembered or set', () => {
    for (const reported of [[], [''], ['chromium']]) {
      const { selection, notice } = resolveSelection(reported, ['x'], ['y']);
      expect(selection).toEqual({ projects: reported, source: 'single', updatedAt: null });
      expect(notice).toEqual({ dropped: [], unknown: [] });
    }
  });
  it('defaults to the first project', () => {
    expect(resolveSelection(TWO, null, null).selection).toEqual({ projects: ['chromium'], source: 'default', updatedAt: null });
  });
  it('applies a remembered choice in reported order', () => {
    const { selection, notice } = resolveSelection(TWO, ['mobile', 'chromium'], null, '2026-10-14T00:00:00.000Z');
    expect(selection).toEqual({ projects: ['chromium', 'mobile'], source: 'remembered', updatedAt: '2026-10-14T00:00:00.000Z' });
    expect(notice).toEqual({ dropped: [], unknown: [] });
  });
  it('drops remembered names that no longer exist and reports them', () => {
    const { selection, notice } = resolveSelection(TWO, ['mobile', 'tablet'], null);
    expect(selection.projects).toEqual(['mobile']);
    expect(selection.source).toBe('remembered');
    expect(notice.dropped).toEqual(['tablet']);
  });
  it('falls back to settings, then default, when nothing remembered remains', () => {
    const viaSettings = resolveSelection(THREE, ['gone'], ['webkit']);
    expect(viaSettings.selection).toEqual({ projects: ['webkit'], source: 'settings', updatedAt: null });
    expect(viaSettings.notice).toEqual({ dropped: ['gone'], unknown: [] });
    const viaDefault = resolveSelection(THREE, ['gone'], null);
    expect(viaDefault.selection.source).toBe('default');
    expect(viaDefault.notice.dropped).toEqual(['gone']);
  });
  it('intersects the settings default and reports unknown names', () => {
    const { selection, notice } = resolveSelection(THREE, null, ['webkit', 'nope', 'chromium']);
    expect(selection).toEqual({ projects: ['chromium', 'webkit'], source: 'settings', updatedAt: null });
    expect(notice.unknown).toEqual(['nope']);
  });
  it('uses the default when the settings name nothing known', () => {
    const { selection, notice } = resolveSelection(THREE, null, ['nope']);
    expect(selection).toEqual({ projects: ['chromium'], source: 'default', updatedAt: null });
    expect(notice.unknown).toEqual(['nope']);
  });
});

describe('toggleProject', () => {
  const one: ProjectSelection = { projects: ['chromium'], source: 'default', updatedAt: null };
  it('adds a project keeping reported order', () => {
    const result = toggleProject({ projects: ['webkit'], source: 'chosen', updatedAt: null }, THREE, 'chromium');
    expect(result.ok && result.selection.projects).toEqual(['chromium', 'webkit']);
    expect(result.ok && result.selection.source).toBe('chosen');
    expect(result.ok && typeof result.selection.updatedAt).toBe('string');
  });
  it('removes a selected project', () => {
    const result = toggleProject({ projects: ['chromium', 'mobile'], source: 'chosen', updatedAt: null }, TWO, 'chromium');
    expect(result.ok && result.selection.projects).toEqual(['mobile']);
  });
  it('refuses to remove the last selected project', () => {
    expect(toggleProject(one, TWO, 'chromium')).toEqual({ ok: false, refusal: 'last' });
  });
  it('refuses unknown names', () => {
    expect(toggleProject(one, TWO, 'nope')).toEqual({ ok: false, refusal: 'unknown' });
  });
});

describe('selectAll, allSelected, isTestSelected', () => {
  it('selects every project as chosen', () => {
    const all = selectAll(THREE);
    expect(all.projects).toEqual(THREE);
    expect(all.source).toBe('chosen');
    expect(allSelected(all, THREE)).toBe(true);
    expect(allSelected({ projects: ['webkit'], source: 'chosen', updatedAt: null }, THREE)).toBe(false);
  });
  it('selects a test when its projects intersect the selection', () => {
    const sel: ProjectSelection = { projects: ['mobile'], source: 'chosen', updatedAt: null };
    expect(isTestSelected({ projects: ['chromium', 'mobile'] }, sel)).toBe(true);
    expect(isTestSelected({ projects: ['chromium'] }, sel)).toBe(false);
    expect(isTestSelected({ projects: [] }, sel)).toBe(true);
    expect(isTestSelected({ projects: ['chromium'] }, { projects: [''], source: 'single', updatedAt: null })).toBe(true);
  });
});

describe('projectArgs', () => {
  it('is empty when everything is selected or the config has one project', () => {
    expect(projectArgs(THREE, THREE)).toEqual([]);
    expect(projectArgs(['chromium'], ['chromium'])).toEqual([]);
    expect(projectArgs([''], [''])).toEqual([]);
  });
  it('repeats --project per selected name', () => {
    expect(projectArgs(['mobile'], TWO)).toEqual(['--project', 'mobile']);
    expect(projectArgs(['chromium', 'webkit'], THREE)).toEqual(['--project', 'chromium', '--project', 'webkit']);
    expect(projectArgs(['Mobile Safari'], ['Desktop Chrome', 'Mobile Safari'])).toEqual(['--project', 'Mobile Safari']);
  });
});

describe('parseProjectsSetting', () => {
  it('returns no default for an absent value', () => {
    expect(parseProjectsSetting(undefined)).toEqual({ projects: null, invalid: false });
    expect(parseProjectsSetting(null)).toEqual({ projects: null, invalid: false });
  });
  it('flags malformed values', () => {
    for (const bad of ['chromium', { projects: [] }, ['chromium', 1], ['']]) {
      expect(parseProjectsSetting(bad)).toEqual({ projects: null, invalid: true });
    }
  });
  it('de-duplicates and keeps order', () => {
    expect(parseProjectsSetting(['mobile', 'chromium', 'mobile'])).toEqual({ projects: ['mobile', 'chromium'], invalid: false });
  });
});
