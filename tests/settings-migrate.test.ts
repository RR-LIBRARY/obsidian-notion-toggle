/**
 * v1.6.2 — data.json upgrades have a home now (audit finding: shallow merge,
 * no version stamp, no validation of the nested stores).
 */
import { describe, expect, test } from "bun:test";
import {
  SETTINGS_VERSION,
  migrateSettings,
  sanitizeMemory,
  sanitizePerNote,
} from "../src/settings-migrate";

describe("nested store validation", () => {
  test("memory keeps only note keys holding card objects", () => {
    expect(
      sanitizeMemory({
        "a.md": [{ due: 1 }, "junk", 4],
        "b.md": "not an array",
        "": [{ due: 2 }],
        "c.md": [],
      })
    ).toEqual({ "a.md": [{ due: 1 }] });
  });

  test("memory survives a non-object data.json entry", () => {
    expect(sanitizeMemory(null)).toEqual({});
    expect(sanitizeMemory([1, 2])).toEqual({});
  });

  test("per-note entries need finite speed and hold", () => {
    expect(
      sanitizePerNote({
        "a.md": { speed: 60, reverse: true, hold: 4 },
        "b.md": { speed: "fast", hold: 4 },
        "c.md": { speed: 30 },
        "d.md": { speed: 30, hold: 0 },
      })
    ).toEqual({
      "a.md": { speed: 60, reverse: true, hold: 4 },
      "d.md": { speed: 30, reverse: false, hold: 0 },
    });
  });
});

describe("migrateSettings", () => {
  test("a legacy file is stamped and cleaned", () => {
    const res = migrateSettings({ scrollMemory: { "a.md": "junk" }, scrollPerNote: 7 });
    expect(res.from).toBe(1);
    expect(res.changed).toBe(true);
    expect(res.settings.settingsVersion).toBe(SETTINGS_VERSION);
    expect(res.settings.scrollMemory).toEqual({});
    expect(res.settings.scrollPerNote).toEqual({});
    expect(res.settings.srs).toEqual({});
  });

  test("running twice changes nothing (idempotent)", () => {
    const once = migrateSettings({ scrollMemory: { "a.md": [{ due: 1 }] } }).settings;
    const twice = migrateSettings({ ...once });
    expect(twice.changed).toBe(false);
    expect(twice.settings.scrollMemory).toEqual({ "a.md": [{ due: 1 }] });
  });

  test("a current file keeps its data untouched", () => {
    const current = {
      settingsVersion: SETTINGS_VERSION,
      scrollMemory: { "a.md": [{ due: 5 }] },
      scrollPerNote: { "a.md": { speed: 90, reverse: false, hold: 3 } },
      srs: { "a.md": { ease: 2.5 } },
    };
    const res = migrateSettings({ ...current });
    expect(res.changed).toBe(false);
    expect(res.settings).toEqual(current);
  });
});
