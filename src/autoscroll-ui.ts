/**
 * v1.0.9 — floating auto-scroll control bar (plain DOM, no Obsidian imports).
 * Slower / faster, reverse, pause, colour filter, close.
 */
export interface ScrollBarCallbacks {
  onToggleRun: () => void;
  onSlower: () => void;
  onFaster: () => void;
  onReverse: () => void;
  onFilter: () => void;
  onClose: () => void;
}

export interface ScrollBarData {
  running: boolean;
  speed: number;
  reverse: boolean;
  filterLabel: string;
  progress: string;
}

export class ScrollBar {
  private root: HTMLElement;
  private runBtn: HTMLButtonElement;
  private revBtn: HTMLButtonElement;
  private filterBtn: HTMLButtonElement;
  private infoEl: HTMLElement;

  constructor(private cb: ScrollBarCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "ntt-scroll-bar";

    const row = document.createElement("div");
    row.className = "ntt-scroll-row";
    this.root.appendChild(row);

    const btn = (text: string, cls: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = `ntt-btn ntt-scroll-btn ${cls}`;
      b.textContent = text;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      row.appendChild(b);
      return b;
    };

    this.runBtn = btn("⏸", "is-run", () => this.cb.onToggleRun());
    btn("−", "is-slower", () => this.cb.onSlower());
    btn("+", "is-faster", () => this.cb.onFaster());
    this.revBtn = btn("↓", "is-reverse", () => this.cb.onReverse());
    this.filterBtn = btn("🔴", "is-filter", () => this.cb.onFilter());
    btn("✕", "is-close", () => this.cb.onClose());

    this.infoEl = document.createElement("div");
    this.infoEl.className = "ntt-scroll-info";
    this.root.appendChild(this.infoEl);

    document.body.appendChild(this.root);
  }

  render(d: ScrollBarData) {
    this.runBtn.textContent = d.running ? "⏸" : "▶";
    this.revBtn.textContent = d.reverse ? "↑" : "↓";
    this.revBtn.setAttribute("aria-label", d.reverse ? "Reverse (up)" : "Forward (down)");
    this.filterBtn.textContent = d.filterLabel === "all toggles" ? "⚪" : d.filterLabel;
    this.infoEl.textContent = `${Math.round(d.speed)} px/s · ${d.progress}`;
    this.root.classList.toggle("is-running", d.running);
  }

  destroy() {
    this.root.remove();
  }
}
