/**
 * v1.7.4 — Obsidian shell for the top-padding diagnostic. Collects the DOM /
 * CSSOM facts, attributes each rule to Obsidian / plugin / theme / snippet and
 * shows the pure report from `padding-diagnose.ts` in a modal with Copy.
 */
import { MarkdownRenderer, MarkdownView, Modal, Notice, type App, type Plugin } from "obsidian";
import {
  analyzeTopGap,
  declaresTopGap,
  formatGapReport,
  px,
  topGapDeclarations,
  type ChainEntry,
  type GapInput,
  type RuleHit,
} from "./padding-diagnose";

interface CustomCss {
  theme?: string;
  enabledSnippets?: Set<string> | string[];
}

function label(el: Element): string {
  const cls = Array.from(el.classList).slice(0, 3).map((c) => "." + c).join("");
  return el.tagName.toLowerCase() + cls;
}

async function readSafe(app: App, path: string): Promise<string> {
  try {
    return (await app.vault.adapter.exists(path)) ? await app.vault.adapter.read(path) : "";
  } catch {
    return "";
  }
}

function sourceOf(sheet: CSSStyleSheet, selector: string, theme: string, snippets: string): RuleHit["source"] {
  const node = sheet.ownerNode as HTMLElement | null;
  if (sheet.href && /app\.css/.test(sheet.href)) return "app";
  if (node?.tagName === "LINK") return "app";
  if (snippets && snippets.includes(selector.split(",")[0].trim())) return "snippet";
  if (theme && theme.includes(selector.split(",")[0].trim())) return "theme";
  if (/ntt-|notion-toggle/.test(selector) || /notion-toggle/.test(node?.id ?? "")) return "plugin";
  if (node?.id?.startsWith("plugin") || node?.getAttribute?.("data-plugin")) return "plugin";
  return "unknown";
}

function rulesFor(el: Element, theme: string, snippets: string): RuleHit[] {
  const hits: RuleHit[] = [];
  const style = el.getAttribute("style") ?? "";
  if (declaresTopGap(style)) {
    for (const d of topGapDeclarations(style)) hits.push({ selector: "(inline)", declaration: d, source: "inline" });
  }
  for (const sheet of Array.from(el.ownerDocument.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const r = rule as CSSStyleRule;
      if (!r.selectorText || !r.style || !declaresTopGap(r.style.cssText)) continue;
      let hit = false;
      try {
        hit = el.matches(r.selectorText);
      } catch {
        hit = false;
      }
      if (!hit) continue;
      for (const d of topGapDeclarations(r.style.cssText)) {
        hits.push({ selector: r.selectorText, declaration: d, source: sourceOf(sheet, r.selectorText, theme, snippets) });
      }
    }
  }
  return hits;
}

export async function collectTopGap(app: App): Promise<GapInput | null> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return null;
  const root = view.containerEl;
  const scroller =
    root.querySelector<HTMLElement>(".markdown-preview-view:not([style*='display: none'])") ??
    root.querySelector<HTMLElement>(".cm-scroller") ??
    root;
  const css = (app as unknown as { customCss?: CustomCss }).customCss ?? {};
  const theme = css.theme ?? "";
  const snippetNames = css.enabledSnippets ? Array.from(css.enabledSnippets) : [];
  const cfg = app.vault.configDir;
  const themeText = theme ? await readSafe(app, `${cfg}/themes/${theme}/theme.css`) : "";
  const snippetText = (await Promise.all(snippetNames.map((s) => readSafe(app, `${cfg}/snippets/${s}.css`)))).join("\n");
  const doc = root.ownerDocument;
  const chain: ChainEntry[] = [];
  for (let el: HTMLElement | null = scroller; el; el = el.parentElement) {
    const cs = doc.defaultView!.getComputedStyle(el);
    const entry: ChainEntry = {
      label: label(el),
      paddingTop: px(cs.paddingTop),
      marginTop: px(cs.marginTop),
      borderTop: px(cs.borderTopWidth),
    };
    if (entry.paddingTop || entry.marginTop || entry.borderTop) entry.rules = rulesFor(el, themeText, snippetText);
    chain.push(entry);
  }
  const bodyCs = doc.defaultView!.getComputedStyle(doc.body);
  return {
    chain,
    safeAreaTop: px(bodyCs.getPropertyValue("--safe-area-inset-top")),
    contentTop: Math.round(scroller.getBoundingClientRect().top),
    isMobile: doc.body.classList.contains("is-mobile"),
    focusRun: doc.body.classList.contains("ntt-focus-run"),
    theme,
    snippets: snippetNames,
  };
}

class TopGapModal extends Modal {
  constructor(app: App, private md: string, private owner: Plugin) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText("Top padding diagnostic");
    const body = this.contentEl.createDiv({ cls: "ntt-gap-report" });
    void MarkdownRenderer.render(this.app, this.md, body, "", this.owner);
    const btn = this.contentEl.createEl("button", { text: "Copy report", cls: "mod-cta" });
    btn.onclick = async () => {
      await navigator.clipboard.writeText(this.md);
      new Notice("Report copied.");
    };
  }
  onClose() {
    this.contentEl.empty();
  }
}

export function registerPaddingDiagnostic(plugin: Plugin): void {
  plugin.addCommand({
    id: "diagnose-top-padding",
    icon: "ruler",
    name: "Diagnose top padding (theme / snippets)",
    callback: async () => {
      const input = await collectTopGap(plugin.app);
      if (!input) {
        new Notice("Open a note first.");
        return;
      }
      new TopGapModal(plugin.app, formatGapReport(input, analyzeTopGap(input)), plugin).open();
    },
  });
}
