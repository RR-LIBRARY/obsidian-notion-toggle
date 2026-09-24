/**
 * Test preload: stub the Obsidian + CodeMirror modules so main.ts can be
 * imported and its pure planner/builder functions tested directly.
 *
 * v1.7.0 — the stubs grew enough surface for the research panel (ItemView,
 * MarkdownRenderer, Notice, TFile, setIcon, requestUrl) to render and act
 * under happy-dom without a network or an Obsidian runtime.
 */
import { mock } from "bun:test";

class Stub {
  app: unknown;
  constructor(app?: unknown) {
    this.app = app;
  }
}

/** Minimal Component: children + load/unload hooks, like the real one. */
class Component {
  private children: Component[] = [];
  load(): void {}
  unload(): void {
    for (const c of this.children) c.unload();
    this.children = [];
  }
  addChild<T extends Component>(c: T): T {
    this.children.push(c);
    return c;
  }
  register(_cb: () => void): void {}
  registerEvent(_ref: unknown): void {}
  registerDomEvent(el: EventTarget, type: string, cb: EventListener): void {
    el.addEventListener(type, cb);
  }
  registerInterval(id: number): number {
    return id;
  }
}

/** A leaf-backed view whose containerEl/contentEl are real DOM nodes. */
class ItemView extends Component {
  app: unknown;
  leaf: unknown;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  constructor(leaf: { app?: unknown } | undefined) {
    super();
    this.leaf = leaf;
    this.app = leaf?.app;
    const doc = globalThis.document;
    this.containerEl = doc.createElement("div");
    const header = doc.createElement("div");
    header.className = "view-header";
    this.contentEl = doc.createElement("div");
    this.contentEl.className = "view-content";
    this.containerEl.append(header, this.contentEl);
  }
  getViewType(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  getIcon(): string {
    return "";
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

/** Notices are collected so tests can assert what the reader was told. */
export const notices: string[] = [];
class Notice {
  noticeEl: HTMLElement;
  constructor(message: string | DocumentFragment, _timeout?: number) {
    const doc = globalThis.document;
    this.noticeEl = doc.createElement("div");
    const text = typeof message === "string" ? message : (message.textContent ?? "");
    this.noticeEl.textContent = text;
    // Obsidian's createDiv / createEl helpers are used by the finished-run notice.
    (this.noticeEl as unknown as { createDiv: (o?: { cls?: string }) => HTMLElement }).createDiv = (o) => {
      const d = doc.createElement("div");
      if (o?.cls) d.className = o.cls;
      this.noticeEl.appendChild(d);
      (d as unknown as { createEl: (tag: string, o?: { text?: string; cls?: string }) => HTMLElement }).createEl = (tag, o2) => {
        const e = doc.createElement(tag);
        if (o2?.text) e.textContent = o2.text;
        if (o2?.cls) e.className = o2.cls;
        d.appendChild(e);
        return e;
      };
      return d;
    };
    notices.push(text);
  }
  setMessage(m: string): this {
    this.noticeEl.textContent = m;
    return this;
  }
  hide(): void {}
}

class TFile {
  path = "";
  basename = "";
  extension = "md";
  constructor(path = "") {
    this.path = path;
    this.basename = path.replace(/^.*\//, "").replace(/\.md$/, "");
  }
}

class MarkdownView extends Stub {
  editor: unknown;
  file: TFile | null = null;
}

class Modal extends Stub {
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  modalEl: HTMLElement;
  constructor(app?: unknown) {
    super(app);
    const doc = globalThis.document;
    this.modalEl = doc.createElement("div");
    this.titleEl = doc.createElement("div");
    this.contentEl = doc.createElement("div");
    this.modalEl.append(this.titleEl, this.contentEl);
  }
  open(): void {
    (this as unknown as { onOpen?: () => void }).onOpen?.();
  }
  close(): void {
    (this as unknown as { onClose?: () => void }).onClose?.();
  }
  setTitle(t: string): this {
    this.titleEl.textContent = t;
    return this;
  }
}

/** Setting builder — enough of the fluent API for the research settings tab. */
class Setting {
  settingEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    const doc = globalThis.document;
    this.settingEl = doc.createElement("div");
    this.settingEl.className = "setting-item";
    this.nameEl = doc.createElement("div");
    this.descEl = doc.createElement("div");
    this.controlEl = doc.createElement("div");
    this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }
  setName(n: string): this {
    this.nameEl.textContent = n;
    return this;
  }
  setDesc(d: string | DocumentFragment): this {
    this.descEl.textContent = typeof d === "string" ? d : (d.textContent ?? "");
    return this;
  }
  setHeading(): this {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }
  setClass(c: string): this {
    this.settingEl.classList.add(c);
    return this;
  }
  addText(cb: (t: TextComponent) => unknown): this {
    cb(new TextComponent(this.controlEl, "input"));
    return this;
  }
  addTextArea(cb: (t: TextComponent) => unknown): this {
    cb(new TextComponent(this.controlEl, "textarea"));
    return this;
  }
  addToggle(cb: (t: ToggleComponent) => unknown): this {
    cb(new ToggleComponent(this.controlEl));
    return this;
  }
  addDropdown(cb: (d: DropdownComponent) => unknown): this {
    cb(new DropdownComponent(this.controlEl));
    return this;
  }
  addSlider(cb: (s: SliderComponent) => unknown): this {
    cb(new SliderComponent(this.controlEl));
    return this;
  }
  addButton(cb: (b: ButtonComponent) => unknown): this {
    cb(new ButtonComponent(this.controlEl));
    return this;
  }
  addExtraButton(cb: (b: ButtonComponent) => unknown): this {
    cb(new ButtonComponent(this.controlEl));
    return this;
  }
}

class TextComponent {
  inputEl: HTMLInputElement | HTMLTextAreaElement;
  private onChangeCb: ((v: string) => unknown) | null = null;
  constructor(parent: HTMLElement, tag: "input" | "textarea") {
    this.inputEl = globalThis.document.createElement(tag) as HTMLInputElement;
    parent.appendChild(this.inputEl);
    this.inputEl.addEventListener("input", () => void this.onChangeCb?.(this.inputEl.value));
  }
  setValue(v: string): this {
    this.inputEl.value = v;
    return this;
  }
  getValue(): string {
    return this.inputEl.value;
  }
  setPlaceholder(p: string): this {
    this.inputEl.placeholder = p;
    return this;
  }
  setDisabled(d: boolean): this {
    this.inputEl.disabled = d;
    return this;
  }
  onChange(cb: (v: string) => unknown): this {
    this.onChangeCb = cb;
    return this;
  }
}

class ToggleComponent {
  toggleEl: HTMLElement;
  private value = false;
  private onChangeCb: ((v: boolean) => unknown) | null = null;
  constructor(parent: HTMLElement) {
    this.toggleEl = globalThis.document.createElement("div");
    this.toggleEl.className = "checkbox-container";
    parent.appendChild(this.toggleEl);
    this.toggleEl.addEventListener("click", () => {
      this.setValue(!this.value);
      void this.onChangeCb?.(this.value);
    });
  }
  setValue(v: boolean): this {
    this.value = v;
    this.toggleEl.classList.toggle("is-enabled", v);
    return this;
  }
  getValue(): boolean {
    return this.value;
  }
  setTooltip(): this {
    return this;
  }
  setDisabled(): this {
    return this;
  }
  onChange(cb: (v: boolean) => unknown): this {
    this.onChangeCb = cb;
    return this;
  }
}

class DropdownComponent {
  selectEl: HTMLSelectElement;
  private onChangeCb: ((v: string) => unknown) | null = null;
  constructor(parent: HTMLElement) {
    this.selectEl = globalThis.document.createElement("select");
    parent.appendChild(this.selectEl);
    this.selectEl.addEventListener("change", () => void this.onChangeCb?.(this.selectEl.value));
  }
  addOption(value: string, label: string): this {
    const o = globalThis.document.createElement("option");
    o.value = value;
    o.textContent = label;
    this.selectEl.appendChild(o);
    return this;
  }
  addOptions(opts: Record<string, string>): this {
    for (const [v, l] of Object.entries(opts)) this.addOption(v, l);
    return this;
  }
  setValue(v: string): this {
    this.selectEl.value = v;
    return this;
  }
  getValue(): string {
    return this.selectEl.value;
  }
  setDisabled(d: boolean): this {
    this.selectEl.disabled = d;
    return this;
  }
  onChange(cb: (v: string) => unknown): this {
    this.onChangeCb = cb;
    return this;
  }
}

class SliderComponent {
  sliderEl: HTMLInputElement;
  private onChangeCb: ((v: number) => unknown) | null = null;
  constructor(parent: HTMLElement) {
    this.sliderEl = globalThis.document.createElement("input");
    this.sliderEl.type = "range";
    parent.appendChild(this.sliderEl);
    this.sliderEl.addEventListener("input", () => void this.onChangeCb?.(Number(this.sliderEl.value)));
  }
  setLimits(min: number, max: number, step: number): this {
    this.sliderEl.min = String(min);
    this.sliderEl.max = String(max);
    this.sliderEl.step = String(step);
    return this;
  }
  setValue(v: number): this {
    this.sliderEl.value = String(v);
    return this;
  }
  getValue(): number {
    return Number(this.sliderEl.value);
  }
  setDynamicTooltip(): this {
    return this;
  }
  setInstant(): this {
    return this;
  }
  onChange(cb: (v: number) => unknown): this {
    this.onChangeCb = cb;
    return this;
  }
}

class ButtonComponent {
  buttonEl: HTMLButtonElement;
  private onClickCb: ((ev: MouseEvent) => unknown) | null = null;
  constructor(parent: HTMLElement) {
    this.buttonEl = globalThis.document.createElement("button");
    parent.appendChild(this.buttonEl);
    this.buttonEl.addEventListener("click", (ev) => void this.onClickCb?.(ev as MouseEvent));
  }
  setButtonText(t: string): this {
    this.buttonEl.textContent = t;
    return this;
  }
  setIcon(i: string): this {
    this.buttonEl.dataset["icon"] = i;
    return this;
  }
  setTooltip(t: string): this {
    this.buttonEl.title = t;
    return this;
  }
  setCta(): this {
    this.buttonEl.classList.add("mod-cta");
    return this;
  }
  setWarning(): this {
    this.buttonEl.classList.add("mod-warning");
    return this;
  }
  setDisabled(d: boolean): this {
    this.buttonEl.disabled = d;
    return this;
  }
  setClass(c: string): this {
    this.buttonEl.classList.add(c);
    return this;
  }
  onClick(cb: (ev: MouseEvent) => unknown): this {
    this.onClickCb = cb;
    return this;
  }
}

class Menu {
  items: Array<{ title: string; onClick?: () => void }> = [];
  addItem(cb: (item: MenuItem) => unknown): this {
    const item = new MenuItem();
    cb(item);
    this.items.push({ title: item.title, onClick: item.click ?? undefined });
    return this;
  }
  addSeparator(): this {
    return this;
  }
  showAtMouseEvent(): void {}
  showAtPosition(): void {}
}
class MenuItem {
  title = "";
  click: (() => void) | null = null;
  setTitle(t: string): this {
    this.title = t;
    return this;
  }
  setIcon(): this {
    return this;
  }
  setSection(): this {
    return this;
  }
  onClick(cb: () => void): this {
    this.click = cb;
    return this;
  }
}

/** Replaceable HTTP stub for requestUrl; tests set `requestUrlImpl`. */
export const requestUrlState: {
  impl: ((req: { url: string; method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; text: string }>) | null;
} = { impl: null };

async function requestUrl(req: { url: string; method?: string; headers?: Record<string, string>; body?: string }) {
  if (!requestUrlState.impl) throw new Error(`requestUrl stub not configured for ${req.url}`);
  return requestUrlState.impl(req);
}

function setIcon(el: HTMLElement, icon: string): void {
  el.dataset["icon"] = icon;
  const svg = globalThis.document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("data-icon", icon);
  el.appendChild(svg);
}

mock.module("obsidian", () => ({
  App: Stub,
  ButtonComponent,
  Component,
  DropdownComponent,
  Editor: Stub,
  ItemView,
  MarkdownRenderer: {
    render: async (_app: unknown, md: string, el: HTMLElement) => {
      el.textContent = md;
    },
    renderMarkdown: async (md: string, el: HTMLElement) => {
      el.textContent = md;
    },
  },
  MarkdownView,
  Menu,
  MenuItem,
  Modal,
  Notice,
  Plugin: Stub,
  PluginSettingTab: Stub,
  Setting,
  SliderComponent,
  TFile,
  TextComponent,
  ToggleComponent,
  WorkspaceLeaf: Stub,
  requestUrl,
  setIcon,
  setTooltip: (el: HTMLElement, t: string) => {
    el.title = t;
  },
  Platform: { isMobile: false, isDesktop: true },
}));

mock.module("@codemirror/state", () => ({
  Prec: { highest: (x: unknown) => x },
}));

mock.module("@codemirror/view", () => ({
  keymap: { of: (x: unknown) => x },
}));
