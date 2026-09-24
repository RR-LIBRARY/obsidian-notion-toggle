/**
 * v1.7.8 — drawer guard for the distraction-free (focus) run.
 *
 * Bug (phone video 2026-09-24): during an autoscroll run a sideways swipe on
 * the note starts Obsidian's mobile sidebar gesture. The focus run hides
 * `.workspace-drawer` itself, but Obsidian still fades in the drawer's dim
 * backdrop, so the whole note turns a faded yellow ("eye comfort" look) with
 * no visible sidebar, and it only clears on the next tap.
 *
 * Fix: while a focus run is live, any drawer that opens is closed straight
 * away (via the `close` callback wired to Obsidian's split API in main.ts) and
 * the CSS keeps the backdrop invisible and click-through in between.
 *
 * Pure module: DOM only, no Obsidian imports.
 */

export const DRAWER_SELECTOR = ".workspace-drawer";
export const DRAWER_BACKDROP_SELECTOR = ".workspace-drawer-backdrop";

/** A drawer counts as open when it is in the DOM and not marked hidden. */
export function isDrawerOpen(el: Element): boolean {
  const c = el.classList;
  return !c.contains("is-hidden") && !c.contains("is-collapsed");
}

export function anyDrawerOpen(root: ParentNode): boolean {
  for (const el of Array.from(root.querySelectorAll(DRAWER_SELECTOR))) {
    if (isDrawerOpen(el)) return true;
  }
  return false;
}

export interface DrawerGuardCallbacks {
  /** Close any open mobile drawer; return true when one was actually open. */
  close: () => boolean;
}

export class DrawerGuard {
  private obs: MutationObserver | null = null;
  private pending = false;
  closes = 0;

  constructor(private cb: DrawerGuardCallbacks) {}

  get active(): boolean {
    return this.obs !== null;
  }

  start(doc: Document = document) {
    if (this.obs || typeof MutationObserver === "undefined") return;
    const body = doc.body;
    this.check(body);
    this.obs = new MutationObserver(() => this.schedule(body));
    this.obs.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
  }

  stop() {
    this.obs?.disconnect();
    this.obs = null;
    this.pending = false;
  }

  private schedule(body: HTMLElement) {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      if (this.obs) this.check(body);
    });
  }

  private check(body: HTMLElement) {
    // The split API (collapsed flag) is the source of truth; the DOM classes
    // only tell us *when* to look, so a renamed class cannot hide an open drawer.
    try {
      if (this.cb.close()) this.closes++;
    } catch {
      /* a missing split must never break the run */
    }
  }
}
