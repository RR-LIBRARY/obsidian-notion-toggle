import { describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof document === "undefined") GlobalRegistrator.register();
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, undo } from "@codemirror/commands";
import { planTypedLinks, typedLinkExtension } from "../src/typed-links";
const notes = [{ basename: "Physics", path: "Physics.md" }, { basename: "Organic Chemistry", path: "Organic Chemistry.md" }, { basename: "Chemistry", path: "Chemistry.md" }, { basename: "भौतिकी", path: "भौतिकी.md" }];
const plan = (s: string, source = "Today.md") => planTypedLinks(s, [{ from: 0, to: s.length }], notes, source, (n) => n.basename);
function apply(s: string) { return EditorState.create({ doc: s }).update({ changes: plan(s) }).state.doc.toString(); }
describe("typed page-name linking", () => {
  test("same page names as voice link automatically, including Hindi and multiword names", () => {
    expect(apply("physics Organic Chemistry भौतिकी")).toBe("[[Physics|physics]] [[Organic Chemistry]] [[भौतिकी]]");
  });
  test("only full words and existing pages link", () => { expect(apply("astrophysics Biology")).toBe("astrophysics Biology"); });
  test("current page does not link to itself", () => { expect(plan("Physics", "Physics.md")).toEqual([]); });
  test("existing links, code, URLs, frontmatter and markdown links stay unchanged", () => {
    const s = "---\ntitle: Physics\n---\n[[Physics]] `Physics` https://x/Physics [Physics](Physics.md)\n```\nPhysics\n```\n";
    expect(apply(s)).toBe(s);
    expect(apply("```\nPhysics")).toBe("```\nPhysics");
    expect(apply("[[Physics")).toBe("[[Physics");
  });
  test("old prose remains unchanged when editing elsewhere", () => { expect(planTypedLinks("Physics old\nnew", [{ from: 12, to: 15 }], notes, "Today.md", (n) => n.basename)).toEqual([]); });
  test("duplicate page titles never choose a wrong page", () => { expect(planTypedLinks("Physics", [{ from: 0, to: 7 }], [...notes, { basename: "Physics", path: "Other/Physics.md" }], "Today.md", (n) => n.path)).toEqual([]); });
  test("real editor: typing writes link at cursor, toggle stops it, voice/programmatic insertion stays untouched, undo works", async () => {
    let enabled = true;
    const view = new EditorView({ state: EditorState.create({ doc: "Start. ", selection: { anchor: 7 }, extensions: [history(), typedLinkExtension({ enabled: () => enabled, notes: () => notes, currentPath: () => "Today.md", target: (n) => n.basename })] }), parent: document.body });
    view.dispatch({ changes: { from: 7, insert: "Physics " }, selection: { anchor: 15 }, userEvent: "input.type" });
    await Bun.sleep(650);
    expect(view.state.doc.toString()).toBe("Start. [[Physics]] ");
    expect(view.state.selection.main.head).toBe(19);
    undo(view);
    await Bun.sleep(650);
    expect(view.state.doc.toString()).not.toContain("[[");
    enabled = false;
    view.dispatch({ changes: { from: view.state.doc.length, insert: "Physics " }, userEvent: "input.type" });
    await Bun.sleep(650);
    expect(view.state.doc.toString()).not.toContain("[[");
    enabled = true;
    view.dispatch({ changes: { from: view.state.doc.length, insert: "Physics " } });
    await Bun.sleep(650);
    expect(view.state.doc.toString()).not.toContain("[[");
    view.destroy();
  });
});