/**
 * v1.0.8 — schedule maintenance helpers.
 *
 * The SM-2 cards from v1.0.7 are stored in `data.json` keyed by note path.
 * A note path is not stable: renaming or moving a note in Obsidian used to
 * orphan its recall schedule. These pure helpers keep the store in sync and
 * are unit tested without touching the Obsidian API.
 */

export type CardStore<T> = Record<string, T>;

/** Follow a rename/move: the card travels with the note. */
export function renameCardKey<T>(
  store: CardStore<T>,
  oldPath: string,
  newPath: string
): { store: CardStore<T>; moved: boolean } {
  if (oldPath === newPath) return { store, moved: false };
  if (!Object.prototype.hasOwnProperty.call(store, oldPath)) {
    return { store, moved: false };
  }
  const next: CardStore<T> = {};
  for (const [key, value] of Object.entries(store)) {
    if (key === oldPath) continue;
    next[key] = value;
  }
  // An existing card at the destination is kept only if the source is absent,
  // which cannot happen here — the moved note wins.
  next[newPath] = store[oldPath];
  return { store: next, moved: true };
}

/** Drop the card of a deleted note. */
export function removeCardKey<T>(
  store: CardStore<T>,
  path: string
): { store: CardStore<T>; removed: boolean } {
  if (!Object.prototype.hasOwnProperty.call(store, path)) {
    return { store, removed: false };
  }
  const next: CardStore<T> = {};
  for (const [key, value] of Object.entries(store)) {
    if (key !== path) next[key] = value;
  }
  return { store: next, removed: true };
}

/**
 * Remove cards whose note no longer exists (deleted outside Obsidian, or
 * before the delete hook existed). Keeps `data.json` from growing forever.
 */
export function pruneCards<T>(
  store: CardStore<T>,
  existingPaths: Iterable<string>
): { store: CardStore<T>; removed: string[] } {
  const alive = new Set(existingPaths);
  const next: CardStore<T> = {};
  const removed: string[] = [];
  for (const [key, value] of Object.entries(store)) {
    if (alive.has(key)) next[key] = value;
    else removed.push(key);
  }
  return { store: next, removed: removed.sort() };
}

/** Human summary for the settings screen. */
export function scheduleStoreSummary(count: number): string {
  if (count <= 0) return "No notes scheduled yet.";
  if (count === 1) return "1 note scheduled.";
  return `${count} notes scheduled.`;
}
