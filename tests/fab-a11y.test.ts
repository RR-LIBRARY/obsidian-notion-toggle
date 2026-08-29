/**
 * v1.2.4 — floating autoscroll button: accessibility + running state.
 *
 * Verifies against the real ScrollFab class (happy-dom):
 *  - accessible name, aria-pressed, title and a polite live region
 *  - keyboard parity (Enter = tap, Shift+Enter = settings sheet)
 *  - running state flips to the blue circle class + pause icon
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

let ScrollFab: typeof import("../src/scroll-fab").ScrollFab;

let registeredHere = false;

beforeAll(async () => {
  if (typeof globalThis.document === "undefined") {
    GlobalRegistrator.register();
    registeredHere = true;
  }
  ({ ScrollFab } = await import("../src/scroll-fab"));
});
afterAll(() => {
  if (registeredHere) GlobalRegistrator.unregister();
});

function mount() {
  let taps = 0;
  let holds = 0;
  const fab = new ScrollFab({ onTap: () => taps++, onLongPress: () => holds++ });
  const btn = document.querySelector(".ntt-fab") as HTMLButtonElement;
  return { fab, btn, counts: () => ({ taps, holds }) };
}

describe("ScrollFab accessibility (v1.2.4)", () => {
  it("exposes a real button with a name, pressed state and title", () => {
    const { fab, btn } = mount();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("aria-label")).toContain("Autoscroll");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.title).toContain("Autoscroll");
    fab.destroy();
  });

  it("announces state changes through a polite live region", () => {
    const { fab, btn } = mount();
    const sr = btn.querySelector(".ntt-fab-sr") as HTMLElement;
    expect(sr.getAttribute("aria-live")).toBe("polite");
    expect(sr.textContent).toBe("Autoscroll stopped");
    fab.setRunning(true);
    expect(sr.textContent).toBe("Autoscroll running");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toContain("pause");
    fab.destroy();
  });

  it("running state uses the solid blue circle class and the pause icon", () => {
    const { fab, btn } = mount();
    expect(btn.classList.contains("is-running")).toBe(false);
    fab.setRunning(true);
    expect(btn.classList.contains("is-running")).toBe(true);
    expect(btn.innerHTML).toContain("<rect"); // pause bars
    fab.setRunning(false);
    expect(btn.classList.contains("is-running")).toBe(false);
    expect(btn.innerHTML).toContain("<path"); // chevrons
    fab.destroy();
  });

  it("keyboard: Enter starts/pauses, Shift+Enter opens the sheet", () => {
    const { fab, btn, counts } = mount();
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(counts().taps).toBe(1);
    btn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true })
    );
    expect(counts().holds).toBe(1);
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(counts().taps).toBe(2);
    fab.destroy();
  });

  it("destroy removes the button from the document", () => {
    const { fab } = mount();
    fab.destroy();
    expect(document.querySelector(".ntt-fab")).toBeNull();
  });
});
