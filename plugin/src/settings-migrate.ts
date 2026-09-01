/**
 * v1.6.2 — one home for data.json upgrades.
 *
 * Loading used to be a single shallow `Object.assign(DEFAULTS, loadData())`.
 * That copes with new top-level keys and nothing else: any shape change inside
 * `scrollMemory` / `scrollPerNote` / `srs` loaded straight through and blew up
 * later as an `undefined` field read. This module stamps a version and
 * validates the nested stores, so every future change has a place to live.
 */

export const SETTINGS_VERSION = 2;

export interface MigratableSettings {
  settingsVersion?: number;
  scrollMemory?: unknown;
  scrollPerNote?: unknown;
  srs?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Keep only note keys whose value is an array of card-shaped objects. */
export function sanitizeMemory(v: unknown): Record<string, Record<string, unknown>[]> {
  if (!isRecord(v)) return {};
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [path, cards] of Object.entries(v)) {
    if (!path || !Array.isArray(cards)) continue;
    const kept = cards.filter(isRecord);
    if (kept.length) out[path] = kept as Record<string, unknown>[];
  }
  return out;
}

export interface PerNoteEntry {
  speed: number;
  reverse: boolean;
  hold: number;
}

/** Per-note speed/direction/hold: drop anything that is not fully formed. */
export function sanitizePerNote(v: unknown): Record<string, PerNoteEntry> {
  if (!isRecord(v)) return {};
  const out: Record<string, PerNoteEntry> = {};
  for (const [path, entry] of Object.entries(v)) {
    if (!path || !isRecord(entry)) continue;
    const speed = Number(entry["speed"]);
    const hold = Number(entry["hold"]);
    if (!Number.isFinite(speed) || !Number.isFinite(hold)) continue;
    out[path] = { speed, reverse: !!entry["reverse"], hold };
  }
  return out;
}

export interface MigrationResult<T> {
  settings: T;
  /** Versions the data travelled through, oldest first (for the debug log). */
  from: number;
  changed: boolean;
}

/**
 * Bring a loaded settings object up to `SETTINGS_VERSION`.
 *
 * Migrations are additive and idempotent: running this twice is a no-op, and
 * an already-current file is returned untouched apart from the stamp.
 */
export function migrateSettings<T extends MigratableSettings>(raw: T): MigrationResult<T> {
  const from = Number(raw.settingsVersion) || 1;
  const settings = raw;
  let changed = false;
  if (from < 2) {
    // v1 → v2: nested stores were never validated on load.
    settings.scrollMemory = sanitizeMemory(settings.scrollMemory);
    settings.scrollPerNote = sanitizePerNote(settings.scrollPerNote);
    if (!isRecord(settings.srs)) settings.srs = {};
    changed = true;
  }
  if (settings.settingsVersion !== SETTINGS_VERSION) {
    settings.settingsVersion = SETTINGS_VERSION;
    changed = true;
  }
  return { settings, from, changed };
}
