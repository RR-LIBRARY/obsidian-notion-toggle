/**
 * v1.7.0 — happy-dom page + the handful of Obsidian DOM helpers
 * (`createEl`, `createDiv`, `empty`, `addClass`, …) that the research
 * settings and notices call on plain elements.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

export function installObsidianDom(): void {
  if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();
  const proto = (globalThis as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype;
  if (proto["createEl"]) return;

  type CreateOpts = { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; placeholder?: string; title?: string };
  const create = function (this: HTMLElement, tag: string, opts?: CreateOpts | string) {
    const node = document.createElement(tag);
    const o = typeof opts === "string" ? { cls: opts } : (opts ?? {});
    if (o.cls) node.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
    if (o.text != null) node.textContent = o.text;
    if (o.title) node.title = o.title;
    if (o.type) (node as HTMLInputElement).type = o.type;
    if (o.placeholder) (node as HTMLInputElement).placeholder = o.placeholder;
    if (o.attr) for (const [k, v] of Object.entries(o.attr)) node.setAttribute(k, v);
    this.appendChild(node);
    return node;
  };
  Object.assign(proto, {
    createEl: create,
    createDiv(this: HTMLElement, opts?: CreateOpts | string) {
      return create.call(this, "div", opts);
    },
    createSpan(this: HTMLElement, opts?: CreateOpts | string) {
      return create.call(this, "span", opts);
    },
    empty(this: HTMLElement) {
      while (this.firstChild) this.removeChild(this.firstChild);
    },
    addClass(this: HTMLElement, ...cls: string[]) {
      this.classList.add(...cls);
    },
    removeClass(this: HTMLElement, ...cls: string[]) {
      this.classList.remove(...cls);
    },
    toggleClass(this: HTMLElement, cls: string, on: boolean) {
      this.classList.toggle(cls, on);
    },
    hasClass(this: HTMLElement, cls: string) {
      return this.classList.contains(cls);
    },
    setText(this: HTMLElement, t: string) {
      this.textContent = t;
    },
    setAttr(this: HTMLElement, k: string, v: string) {
      this.setAttribute(k, v);
    },
  });
}

/** Click a button by its accessible name (aria-label, then text). */
export function clickButton(root: HTMLElement, name: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll("button")) as HTMLButtonElement[];
  const b = buttons.find((x) => x.getAttribute("aria-label") === name) ?? buttons.find((x) => x.textContent?.trim() === name);
  if (!b) throw new Error(`no button named "${name}" (have: ${buttons.map((x) => x.getAttribute("aria-label") ?? x.textContent).join(", ")})`);
  b.click();
  return b;
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
