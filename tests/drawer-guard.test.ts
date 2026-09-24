import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { DrawerGuard, anyDrawerOpen, isDrawerOpen } from "../src/drawer-guard";

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  document.body.innerHTML = `<div class="workspace-drawer mod-left is-hidden"></div><div class="workspace-drawer mod-right is-hidden"></div>`;
  const state = { left: true, right: true };
  const calls: string[] = [];
  const guard = new DrawerGuard({
    close: () => {
      let any = false;
      for (const k of ["left", "right"] as const) if (!state[k]) { state[k] = true; any = true; calls.push(k); }
      return any;
    },
  });
  return { state, calls, guard };
}

describe("v1.7.8 drawer guard (yellow fade on swipe)", () => {
  test("isDrawerOpen / anyDrawerOpen read hidden classes", () => {
    const el = document.createElement("div");
    el.className = "workspace-drawer is-hidden";
    expect(isDrawerOpen(el)).toBe(false);
    el.classList.remove("is-hidden");
    expect(isDrawerOpen(el)).toBe(true);
    document.body.innerHTML = "";
    document.body.appendChild(el);
    expect(anyDrawerOpen(document.body)).toBe(true);
  });

  test("swipe opens left drawer during run -> closed at once", async () => {
    const { state, calls, guard } = setup();
    guard.start(document);
    state.left = false;
    document.querySelector(".mod-left")!.classList.remove("is-hidden");
    await tick();
    expect(state.left).toBe(true);
    expect(calls).toEqual(["left"]);
    expect(guard.closes).toBe(1);
    guard.stop();
  });

  test("right drawer, backdrop insert and repeated swipes all closed", async () => {
    const { state, guard } = setup();
    guard.start(document);
    for (let i = 0; i < 5; i++) {
      state.right = false;
      const b = document.createElement("div");
      b.className = "workspace-drawer-backdrop";
      document.body.appendChild(b);
      await tick();
      expect(state.right).toBe(true);
    }
    expect(guard.closes).toBe(5);
    guard.stop();
  });

  test("drawer already open when run starts is closed on start", () => {
    const { state, guard } = setup();
    state.left = false;
    guard.start(document);
    expect(state.left).toBe(true);
    guard.stop();
  });

  test("after stop, drawers work normally again", async () => {
    const { state, guard } = setup();
    guard.start(document);
    guard.stop();
    expect(guard.active).toBe(false);
    state.left = false;
    document.querySelector(".mod-left")!.classList.remove("is-hidden");
    await tick();
    expect(state.left).toBe(false);
  });

  test("close throwing never breaks the run; start is idempotent", async () => {
    const g = new DrawerGuard({ close: () => { throw new Error("no split"); } });
    g.start(document); g.start(document);
    document.body.appendChild(document.createElement("div"));
    await tick();
    expect(g.active).toBe(true);
    g.stop();
  });

  test("CSS hides the backdrop only during a focus run; main.ts wires guard", () => {
    const css = readFileSync("styles.css", "utf8");
    expect(css).toMatch(/body\.ntt-focus-run \.workspace-drawer-backdrop\s*\{[^}]*display: none !important;[^}]*pointer-events: none !important;/);
    const main = readFileSync("main.ts", "utf8");
    expect(main).toContain("this.drawerGuard.start()");
    expect(main).toContain("this.drawerGuard.stop()");
    expect(main.split("\n").length).toBeLessThan(3500);
  });
});
