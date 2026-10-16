import type { ProjectSelection } from './types';

/** Names a reconcile had to drop (remembered) or could not find (settings). */
export interface SelectionNotice {
  dropped: string[];
  unknown: string[];
}

function inReportedOrder(reported: string[], names: string[]): string[] {
  const wanted = new Set(names);
  return reported.filter((name) => wanted.has(name));
}

function missing(names: string[], reported: string[]): string[] {
  const known = new Set(reported);
  return names.filter((name) => !known.has(name));
}

/**
 * Reconciles a config's selection after discovery (data-model.md "Reconciliation"):
 * single project, else remembered, else settings default, else the first project.
 */
export function resolveSelection(
  reported: string[],
  remembered: string[] | null,
  settingsDefault: string[] | null,
  rememberedUpdatedAt: string | null = null,
): { selection: ProjectSelection; notice: SelectionNotice } {
  const notice: SelectionNotice = { dropped: [], unknown: [] };
  if (reported.length < 2) {
    return { selection: { projects: [...reported], source: 'single', updatedAt: null }, notice };
  }
  if (remembered !== null) {
    const keep = inReportedOrder(reported, remembered);
    notice.dropped = missing(remembered, reported);
    if (keep.length > 0) {
      return { selection: { projects: keep, source: 'remembered', updatedAt: rememberedUpdatedAt }, notice };
    }
  }
  if (settingsDefault !== null) {
    const keep = inReportedOrder(reported, settingsDefault);
    notice.unknown = missing(settingsDefault, reported);
    if (keep.length > 0) {
      return { selection: { projects: keep, source: 'settings', updatedAt: null }, notice };
    }
  }
  return { selection: { projects: [reported[0]], source: 'default', updatedAt: null }, notice };
}

export type ToggleResult = { ok: true; selection: ProjectSelection } | { ok: false; refusal: 'last' | 'unknown' };

/** Flips one project; refuses unknown names and the last selected project. */
export function toggleProject(selection: ProjectSelection, reported: string[], name: string): ToggleResult {
  if (!reported.includes(name)) return { ok: false, refusal: 'unknown' };
  const current = new Set(selection.projects);
  if (current.has(name)) {
    if (current.size <= 1) return { ok: false, refusal: 'last' };
    current.delete(name);
  } else {
    current.add(name);
  }
  return { ok: true, selection: { projects: inReportedOrder(reported, [...current]), source: 'chosen', updatedAt: new Date().toISOString() } };
}

/** Selects every reported project, stored as the explicit full list. */
export function selectAll(reported: string[]): ProjectSelection {
  return { projects: [...reported], source: 'chosen', updatedAt: new Date().toISOString() };
}

/** True when the test runs in at least one selected project; single-project configs select everything. */
export function isTestSelected(test: { projects: string[] }, selection: ProjectSelection): boolean {
  if (selection.source === 'single' || test.projects.length === 0) return true;
  return test.projects.some((name) => selection.projects.includes(name));
}

export function allSelected(selection: ProjectSelection, reported: string[]): boolean {
  return reported.every((name) => selection.projects.includes(name));
}

/** `--project <name>` pairs for a run; nothing when every reported project is selected. */
export function projectArgs(selected: string[], reported: string[]): string[] {
  if (reported.length < 2 || selected.length === 0) return [];
  if (reported.every((name) => selected.includes(name))) return [];
  return selected.flatMap((name) => ['--project', name]);
}

export interface ProjectsSetting {
  /** The de-duplicated names, or null when absent or invalid. */
  projects: string[] | null;
  /** True when a value was present but not a list of non-empty strings. */
  invalid: boolean;
}

/** Validates the `projects` setting value (data-model.md "Settings value"). */
export function parseProjectsSetting(value: unknown): ProjectsSetting {
  if (value === undefined || value === null) return { projects: null, invalid: false };
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v === '')) return { projects: null, invalid: true };
  return { projects: Array.from(new Set(value as string[])), invalid: false };
}
