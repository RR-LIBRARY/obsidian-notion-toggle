/**
 * v1.7.0 — tiny TTL + LRU cache for research responses.
 *
 * Mirrors the bridge's 15-minute server cache so a repeated search from the
 * same phone never leaves the device. Pure: injectable clock, no Obsidian.
 */

export const RESEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
export const RESEARCH_CACHE_MAX = 60;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Stable key for an operation + its JSON body (key order independent). */
export function cacheKey(op: string, body: unknown): string {
  return `${op}:${stableStringify(body)}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export class ResearchCache {
  private readonly entries = new Map<string, Entry<unknown>>();

  constructor(
    private readonly ttlMs = RESEARCH_CACHE_TTL_MS,
    private readonly max = RESEARCH_CACHE_MAX,
    private readonly now: () => number = () => Date.now()
  ) {}

  get<T>(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU: re-insert so the most recently read entry is the newest.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value as T;
  }

  set<T>(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
