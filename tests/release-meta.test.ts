/**
 * Release-metadata guard.
 *
 * v1.3.2 audit loose end: versions.json mapped 1.3.0–1.3.2 to minAppVersion
 * "0.15.0" while manifest.json declared "1.4.0", so Obsidian's compatibility
 * check could mis-resolve. This test fails the build if the two files ever
 * disagree again or if the current version is missing from versions.json.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
  version: string;
  minAppVersion: string;
};
const versions = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;

describe("release metadata", () => {
  test("current version is listed in versions.json", () => {
    expect(Object.keys(versions)).toContain(manifest.version);
  });

  test("every versions.json entry matches manifest.minAppVersion", () => {
    for (const [pluginVersion, minApp] of Object.entries(versions)) {
      expect({ pluginVersion, minApp }).toEqual({
        pluginVersion,
        minApp: manifest.minAppVersion,
      });
    }
  });
});
