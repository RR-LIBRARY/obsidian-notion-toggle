import { Window } from "happy-dom";
const win = new Window();
const g = globalThis as unknown as Record<string, unknown>;
if (!g.document) { g.document = win.document; g.window = win; g.Event = win.Event; g.HTMLElement = win.HTMLElement; }
const P = (win.HTMLElement.prototype as unknown) as Record<string, unknown>;
type O = { cls?: string; text?: string; attr?: Record<string, string> } | string | undefined;
function mk(this: HTMLElement, tag: string, o?: O) {
  const el = this.ownerDocument.createElement(tag);
  const opt = typeof o === "string" ? { cls: o } : o ?? {};
  if (opt.cls) el.className = opt.cls;
  if (opt.text !== undefined) el.textContent = opt.text;
  for (const [k, v] of Object.entries(opt.attr ?? {})) el.setAttribute(k, String(v));
  this.appendChild(el);
  return el;
}
P.createEl ??= mk;
P.createDiv ??= function (this: HTMLElement, o?: O) { return mk.call(this, "div", o); };
P.createSpan ??= function (this: HTMLElement, o?: O) { return mk.call(this, "span", o); };
P.addClass ??= function (this: HTMLElement, ...c: string[]) { this.classList.add(...c); };
P.removeClass ??= function (this: HTMLElement, ...c: string[]) { this.classList.remove(...c); };
P.toggleClass ??= function (this: HTMLElement, c: string, v: boolean) { this.classList.toggle(c, v); };
P.empty ??= function (this: HTMLElement) { this.innerHTML = ""; };
P.setText ??= function (this: HTMLElement, t: string) { this.textContent = t; };
P.setAttr ??= function (this: HTMLElement, k: string, v: string) { this.setAttribute(k, v); };
