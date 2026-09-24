/**
 * v1.7.0 — tiny DOM helpers for the research panel.
 *
 * Plain `document.createElement` instead of Obsidian's `createEl` family so
 * the panel renders under happy-dom in tests exactly as it does in the app.
 * No Obsidian imports.
 */

export interface ElOptions {
  cls?: string | string[];
  text?: string;
  title?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement | null,
  tag: K,
  opts: ElOptions = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.cls) {
    const classes = Array.isArray(opts.cls) ? opts.cls : opts.cls.split(/\s+/);
    for (const c of classes) if (c) node.classList.add(c);
  }
  if (opts.text != null) node.textContent = opts.text;
  if (opts.title) node.title = opts.title;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export interface ButtonOptions {
  cls?: string | string[];
  /** Accessible name; defaults to the label. */
  label?: string;
  cta?: boolean;
  disabled?: boolean;
  title?: string;
}

export function button(parent: HTMLElement, text: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const b = el(parent, "button", { cls: opts.cls, text, title: opts.title });
  b.type = "button";
  b.setAttribute("aria-label", opts.label ?? text);
  if (opts.cta) b.classList.add("mod-cta");
  if (opts.disabled) b.disabled = true;
  b.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onClick();
  });
  return b;
}

/** "3 s", "2 min", "1 h", "3 d" — for run rows and result meta. */
export function ago(iso: string | number, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export function latencyLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}
