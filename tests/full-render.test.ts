/**
 * v1.5.4 — lazy rendering is why "No toggles match this selection" fired on a
 * note full of red toggles. These tests pin the override + restore contract.
 */
import { describe, expect, test } from "bun:test";
import { ensureFullRender, restoreFullRender } from "../src/full-render";

function view(showAll: boolean | undefined, calls: boolean[] = []) {
  return {
    previewMode: {
      renderer: {
        showAll,
        rerender: (full?: boolean) => calls.push(!!full),
      },
    },
  };
}

describe("ensureFullRender", () => {
  test("turns lazy rendering off and asks for a full rerender", () => {
    const calls: boolean[] = [];
    const v = view(false, calls);
    const handle = ensureFullRender(v);
    expect(handle.forced).toBe(true);
    expect(v.previewMode.renderer.showAll).toBe(true);
    expect(calls).toEqual([true]);
  });

  test("is a no-op when the note already renders in full", () => {
    const v = view(true);
    const handle = ensureFullRender(v);
    expect(handle.forced).toBe(false);
    expect(restoreFullRender(handle)).toBe(false);
    expect(v.previewMode.renderer.showAll).toBe(true);
  });

  test("restore puts lazy rendering back", () => {
    const v = view(false);
    const handle = ensureFullRender(v);
    expect(restoreFullRender(handle)).toBe(true);
    expect(v.previewMode.renderer.showAll).toBe(false);
  });

  test("survives a build without the internal flag", () => {
    expect(ensureFullRender(null).forced).toBe(false);
    expect(ensureFullRender({}).forced).toBe(false);
    expect(ensureFullRender({ previewMode: { renderer: {} } }).forced).toBe(false);
    expect(restoreFullRender(null)).toBe(false);
  });

  test("a renderer that throws never breaks a run", () => {
    const v = {
      previewMode: {
        renderer: {
          showAll: false,
          rerender: () => {
            throw new Error("internal changed");
          },
        },
      },
    };
    expect(ensureFullRender(v).forced).toBe(false);
  });
});
