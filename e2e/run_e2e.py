#!/usr/bin/env python3
"""Real-browser E2E for clean editing (Chromium, phone-size viewport).
Usage: node e2e/build-workbench.mjs && python3 e2e/run_e2e.py
Exits non-zero on any failure; screenshots go to e2e/out/shots/."""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

OUT = pathlib.Path(__file__).parent / "out"
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
URL = (OUT / "index.html").resolve().as_uri()
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


async def fresh(page, chip=False):
    await page.goto(URL + ("?chip=1" if chip else ""))
    await page.wait_for_function("window.wb")


async def put_on_title_end(page, line=2):
    # caret onto the header line (redirect parks it on the visible title)
    await page.evaluate(f"wb.set(wb.lineFrom({line}) + 20)")
    await page.keyboard.press("End")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 480, "height": 900})).new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1 no raw markers visible on a touched bold toggle
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(2) + 25)")
        await page.wait_for_timeout(50)
        header = page.locator(".cm-line.ntt-clean-header").first
        txt = await header.inner_text()
        check("bold title shows no ** / [!question] / >", "**" not in txt and "[!" not in txt and not txt.startswith(">"), txt)
        check("arrow widget rendered", await page.locator(".ntt-clean-arrow").count() >= 1)
        check("header has bold class", "ntt-clean-bold" in (await header.get_attribute("class")))
        await page.screenshot(path=str(SHOTS / "1_bold_title.png"))

        # 2 End then type W lands at visible title end; file keeps **…**
        await put_on_title_end(page)
        await page.keyboard.type("W")
        line2 = await page.evaluate("wb.lineText(2)")
        check("End + W lands at title end", line2.endswith("resistant?W**"), line2)

        # 3 closed body is hidden, no chip by default
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(2) + 25)")
        body_vis = await page.locator(".cm-content").inner_text()
        check("closed toggle body hidden", "Tobacco" not in body_vis)
        check("no … chip by default", await page.locator(".ntt-clean-more").count() == 0)

        # 4 Ctrl+Enter opens, body shown without '> '
        await page.keyboard.press("Control+Enter")
        await page.wait_for_timeout(30)
        body_vis = await page.locator(".cm-content").inner_text()
        check("Ctrl+Enter opens toggle", "Tobacco" in body_vis)
        bodies = await page.locator(".cm-line.ntt-clean-body").all_inner_texts()
        check("body lines have no visible '> '", bodies and all(not t.startswith(">") for t in bodies), str(bodies))

        # 4b Notion look: small triangle, body text starts under title text, no guide line
        svg = await page.locator(".ntt-clean-arrow svg").first.bounding_box()
        check("triangle is small (Notion size)", svg and svg["width"] <= 13, str(svg))
        title_x = await page.evaluate("wb.view.coordsAtPos(wb.lineFrom(2) + wb.lineText(2).indexOf('Q1')).left")
        body_x = await page.evaluate("wb.view.coordsAtPos(wb.lineFrom(3) + 2).left")
        check("body text aligned under title text", abs(title_x - body_x) <= 3, f"{title_x} vs {body_x}")
        c = await page.evaluate("(() => { const a=document.querySelector('.ntt-clean-arrow svg').getBoundingClientRect(); const t=wb.view.coordsAtPos(wb.lineFrom(2) + wb.lineText(2).indexOf('Q1')); return [(a.top+a.bottom)/2, (t.top+t.bottom)/2] })()")
        check("triangle centred on title text", abs(c[0] - c[1]) <= 2.5, str(c))
        border = await page.locator(".cm-line.ntt-clean-body").first.evaluate("e => getComputedStyle(e).borderLeftStyle")
        check("no body guide line", border == "none", border)
        await page.screenshot(path=str(SHOTS / "4_open.png"))

        # 5 Right from title end goes to first body char (after hidden '> ')
        await put_on_title_end(page)
        await page.keyboard.press("ArrowRight")
        head = await page.evaluate("wb.head()")
        exp = await page.evaluate("wb.lineFrom(3) + 2")
        check("Right from title end → first body char", head == exp, f"{head} vs {exp}")

        # 6 Ctrl+Enter closes; caret parks on the title
        await page.keyboard.press("Control+Enter")
        await page.wait_for_timeout(30)
        head = await page.evaluate("wb.head()")
        l2 = await page.evaluate("[wb.lineFrom(2), wb.lineFrom(3)]")
        check("Ctrl+Enter closes, caret on title", l2[0] <= head < l2[1], str(head))

        # 7 closed: Right from title end skips to the line after the toggle
        await put_on_title_end(page)
        await page.keyboard.press("ArrowRight")
        head = await page.evaluate("wb.head()")
        check("closed: Right skips folded body", head == await page.evaluate("wb.lineFrom(5)"), str(head))

        # 8 Home never enters hidden prefix
        await put_on_title_end(page)
        await page.keyboard.press("Home")
        await page.keyboard.type("Z")
        l = await page.evaluate("wb.lineText(2)")
        check("Home + type stays in title", l.startswith("> [!question]- **ZQ1."), l)

        # 9 Delete at title end of bold title is no-op
        await fresh(page)
        await put_on_title_end(page)
        before = await page.evaluate("wb.text()")
        await page.keyboard.press("Delete")
        check("Delete at bold title end keeps **", before == await page.evaluate("wb.text()"))

        # 10 Backspace at title start removes prefix and both ** pairs
        await page.keyboard.press("Home")
        await page.keyboard.press("Backspace")
        l = await page.evaluate("wb.lineText(2)")
        check("Backspace at title start → plain text", l == "Q1. Which plant was made nematode-resistant?", l)

        # 11 clicking the arrow toggles open
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(2) + 25)")
        await page.locator(".ntt-clean-arrow").first.click()
        await page.wait_for_timeout(30)
        check("arrow click opens", "Tobacco" in await page.locator(".cm-content").inner_text())
        check("arrow has aria-expanded=true", await page.locator(".ntt-clean-arrow").first.get_attribute("aria-expanded") == "true")

        # 12 wrapped long title: hanging indent (2nd line starts right of arrow)
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(9) + 25)")
        await page.wait_for_timeout(30)
        long_h = page.locator(".cm-line.ntt-clean-header").last
        box = await long_h.bounding_box()
        check("long title wraps", box and box["height"] > 30, str(box))
        pad = await long_h.evaluate("e => parseFloat(getComputedStyle(e).paddingLeft) + parseFloat(getComputedStyle(e).marginLeft)")
        check("hanging indent present", pad > 10, str(pad))
        await page.screenshot(path=str(SHOTS / "12_wrap.png"))

        # 13 chip setting on
        await fresh(page, chip=True)
        await page.evaluate("wb.set(wb.lineFrom(2) + 25)")
        check("chip appears when setting on", await page.locator(".ntt-clean-more").count() == 1)

        # 14 '>' + space starts a toggle
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(8))")
        await page.keyboard.type("> ")
        check("'>' + space starts a toggle", (await page.evaluate("wb.lineText(8)")).startswith("> [!question]-"))

        # 15 untouched toggles left as raw text (Obsidian renders them)
        await fresh(page)
        await page.evaluate("wb.set(0)")
        check("untouched blocks undecorated", await page.locator(".ntt-clean-header").count() == 0)

        # 16 Notion Enter: closed title -> next closed toggle after the body
        await fresh(page)
        await put_on_title_end(page)
        await page.keyboard.press("Enter")
        await page.keyboard.type("Q2 next")
        check("blank line keeps toggles separate", (await page.evaluate("wb.lineText(5)")) == "")
        l5 = await page.evaluate("wb.lineText(6)")
        check("Enter on closed title makes next toggle", l5.startswith("> [!question]-") and "Q2 next" in l5, l5)
        check("old body untouched", (await page.evaluate("wb.lineText(3)")).startswith("> **Answer"))
        # 17 v1.8.22: another Enter stays at the same top-level depth; bold-ready caret stays correct
        await page.keyboard.press("End")
        await page.keyboard.press("Enter")
        l8 = await page.evaluate("wb.lineText(8)")
        check("Enter on a bold title makes a same-depth sibling", l8 == "> [!question]- ****", l8)
        check("caret sits between the ** pair", (await page.evaluate("wb.head()")) == (await page.evaluate("wb.lineFrom(8) + 17")), await page.evaluate("wb.text()"))
        # 17a video rule: Enter makes siblings. Tab alone nests; Enter inside that level makes a sibling,
        #     and Shift+Tab returns the whole toggle to the top level.
        import urllib.parse as up
        FLOW = "> [!question]- what is my name\n\n> [!question]- Where I am From\n\n> [!question]- how to know you"
        await page.goto(URL + "?doc=" + up.quote(FLOW)); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.lineFrom(3) + 25)")
        await page.keyboard.press("End")
        await page.keyboard.press("Enter")
        check("Enter keeps the next toggle at the same level", (await page.evaluate("wb.lineText(5)")) == "> [!question]- ", await page.evaluate("wb.text()"))
        ph = page.locator(".cm-line.ntt-clean-empty-title")
        ph_txt = await page.evaluate("(() => { const l = document.querySelector('.cm-line.ntt-clean-empty-title'); return l ? getComputedStyle(l, '::after').content : ''; })()")
        check("empty sibling shows the grey 'Toggle' hint (IME-safe, no editable span)", await ph.count() == 1 and "Toggle" in ph_txt and await page.locator(".ntt-clean-placeholder").count() == 0, ph_txt)
        await page.keyboard.type("Mumbai")
        await page.keyboard.press("Tab")
        check("Tab is the action that nests the toggle", (await page.evaluate("wb.lineText(4)")) == "> > [!question]- Mumbai", await page.evaluate("wb.text()"))
        await page.keyboard.press("End")
        await page.keyboard.press("Enter")
        check("Enter inside a parent makes a same-depth nested sibling", (await page.evaluate("wb.lineText(6)")) == "> > [!question]- ", await page.evaluate("wb.text()"))
        await page.screenshot(path=str(SHOTS / "17_enter_nested.png"))
        await page.keyboard.type("Location")
        check("typing removes the hint", await page.locator(".cm-line.ntt-clean-empty-title").count() == 0)
        await page.keyboard.press("Shift+Tab")
        top_location = await page.evaluate("wb.text().split('\\n').some(line => line === '> [!question]- Location')")
        check("Shift+Tab moves the toggle one level out", top_location, await page.evaluate("wb.text()"))
        check("no page errors so far", not errors, "; ".join(errors))
        # 17b production order: a body line with text still gets the older handler's `> ` continuation
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(7) + 11)")
        await page.keyboard.press("Enter")
        check("body line Enter continues with '> '", (await page.evaluate("wb.lineText(8)")) == "> ", await page.evaluate("wb.text()"))

        # 18 v1.8.9 Tab shoves a line into the toggle above; Shift+Tab takes it out
        import urllib.parse as up
        NOTE = "> [!question]- Toggle List\n\n> [!question]- Oka\n> body\n\nPhir enter\nok"
        await page.goto(URL + "?doc=" + up.quote(NOTE)); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.lineFrom(6) + 3)")
        await page.keyboard.press("Tab")
        check("Tab shoves line into toggle", (await page.evaluate("wb.lineText(5)")) == "> Phir enter", await page.evaluate("wb.text()"))
        check("caret stays on moved text", (await page.evaluate("wb.head()")) == (await page.evaluate("wb.lineFrom(5) + 5")))
        vis = await page.locator(".cm-content").inner_text()
        check("shoved toggle is open and clean", "Phir enter" in vis and "> Phir" not in vis, vis)
        await page.screenshot(path=str(SHOTS / "18_tab.png"))
        await page.keyboard.press("Shift+Tab")
        check("Shift+Tab restores", (await page.evaluate("wb.text()")) == NOTE, await page.evaluate("wb.text()"))
        # 19 Ctrl+Shift+Up swaps toggles, keeping them separate
        await page.evaluate("wb.set(wb.lineFrom(3) + 16)")
        await page.keyboard.press("Control+Shift+ArrowUp")
        t = await page.evaluate("wb.text()")
        check("Ctrl+Shift+Up moves toggle up", t.startswith("> [!question]- Oka\n> body\n\n> [!question]- Toggle List"), t)
        # 20 drag the arrow of 'Oka' into 'Toggle List' (blue box, shove inside)
        await page.goto(URL + "?doc=" + up.quote(NOTE)); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.lineFrom(3) + 18)")
        await page.wait_for_timeout(50)
        a = await page.locator(".ntt-clean-arrow").first.bounding_box()
        tgt = await page.evaluate("(() => { const c = wb.view.coordsAtPos(wb.lineFrom(1) + 18); return [c.left, (c.top + c.bottom) / 2]; })()")
        await page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
        await page.mouse.down()
        await page.mouse.move(a["x"] + 20, a["y"] - 10, steps=4)
        await page.mouse.move(tgt[0], tgt[1], steps=6)
        check("drop box shows while dragging", await page.locator(".ntt-drop-marker.is-into").count() == 1)
        await page.screenshot(path=str(SHOTS / "20_drag.png"))
        await page.mouse.up()
        t = await page.evaluate("wb.text()")
        check("drag onto toggle shoves it inside", t.startswith("> [!question]- Toggle List\n> > [!question]- Oka\n> > body"), t)
        # 21 long-press drag of a plain line below another (blue line)
        await page.goto(URL + "?doc=" + up.quote(NOTE)); await page.wait_for_function("window.wb")
        p1 = await page.evaluate("(() => { const c = wb.view.coordsAtPos(wb.lineFrom(6) + 2); return [c.left, (c.top + c.bottom) / 2, c.bottom - c.top]; })()")
        p2 = await page.evaluate("(() => { const c = wb.view.coordsAtPos(wb.lineFrom(7) + 1); return [c.left, c.bottom - 3]; })()")
        await page.mouse.move(p1[0], p1[1]); await page.mouse.down()
        await page.wait_for_timeout(550)
        await page.mouse.move(p2[0], p2[1], steps=5)
        check("drop line shows", await page.locator(".ntt-drop-marker:not(.is-into)").count() == 1)
        await page.mouse.up()
        t = await page.evaluate("wb.text()")
        check("long-press drag moves line below", t.endswith("ok\nPhir enter"), t)
        # 22 nested toggle renders clean with a deeper indent
        NEST = "> [!question]+ Outer\n> > [!question]+ Inner\n> > inner body\n> outer body"
        await page.goto(URL + "?doc=" + up.quote(NEST)); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.lineFrom(3) + 6)")
        await page.wait_for_timeout(50)
        vis = await page.locator(".cm-content").inner_text()
        check("nested: no raw markers", ">" not in vis and "[!" not in vis, vis)
        xo = await page.evaluate("wb.view.coordsAtPos(wb.lineFrom(1) + 15).left")
        xi = await page.evaluate("wb.view.coordsAtPos(wb.lineFrom(2) + 17).left")
        xb = await page.evaluate("wb.view.coordsAtPos(wb.lineFrom(3) + 4).left")
        check("nested title steps in, its body under it", xi - xo > 15 and abs(xb - xi) <= 3, f"{xo} {xi} {xb}")
        await page.screenshot(path=str(SHOTS / "22_nested.png"))

        # 23 v1.8.10 rendered callout arrow: ▶ closed, ▼ open, even when Obsidian rotates the fold itself
        html = '<div class="callout is-collapsible is-collapsed" data-callout="question"><div class="callout-title"><div class="callout-fold is-collapsed" style="transform:rotate(-90deg)"><svg></svg></div><div class="callout-title-inner">Q</div></div></div><div class="callout is-collapsible" data-callout="question"><div class="callout-title"><div class="callout-fold"><svg></svg></div><div class="callout-title-inner">Q</div></div></div>'
        await page.evaluate("h => document.body.insertAdjacentHTML('beforeend', h)", html)
        rots = await page.evaluate("[...document.querySelectorAll('.callout-fold')].map(f => [getComputedStyle(f).transform, getComputedStyle(f, '::before').transform])")
        check("closed callout arrow points right", rots[0][0] == "none" and rots[0][1] in ("none", "matrix(1, 0, 0, 1, 0, 0)"), str(rots))
        check("open callout arrow points down", rots[1][0] == "none" and rots[1][1].startswith("matrix(0") or "6.12" in rots[1][1], str(rots))

        # 24 v1.8.11 audit: Shift+Tab / Tab on a nested list item inside a toggle is a list outdent / indent,
        #    not a block move — the item must stay inside the toggle.
        LIST = "> [!question]+ Q\n> - item\n>   - sub\n> last"
        await page.goto(URL + "?doc=" + up.quote(LIST)); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.lineFrom(3) + 8)")
        await page.keyboard.press("Shift+Tab")
        check("Shift+Tab keeps nested list item inside toggle", (await page.evaluate("wb.text()")) == LIST, await page.evaluate("wb.text()"))
        await page.keyboard.press("Tab")
        check("Tab on indented text is not a block move", (await page.evaluate("wb.text()")) == LIST, await page.evaluate("wb.text()"))
        # plain body line still moves out with Shift+Tab (Notion behaviour kept)
        await page.evaluate("wb.set(wb.lineFrom(4) + 4)")
        await page.keyboard.press("Shift+Tab")
        t = await page.evaluate("wb.text()")
        check("Shift+Tab still moves a plain body line out", t.startswith("> [!question]+ Q\n> - item\n>   - sub\n") and t.rstrip().endswith("last") and not t.rstrip().endswith("> last"), t)

        # 25 v1.8.12 mobile: finger tap on the arrow (with ~9px jitter, no synthetic click) opens / closes
        await fresh(page)
        await page.evaluate("wb.set(wb.lineFrom(2) + 25)")
        TAP = """(dx) => { const a = document.querySelector('.ntt-clean-arrow'); const r = a.getBoundingClientRect();
          const x = r.left + r.width/2, y = r.top + r.height/2;
          const o = (t, xx) => new PointerEvent(t, {bubbles:true, cancelable:true, pointerType:'touch', pointerId:7, isPrimary:true, button:0, clientX:xx, clientY:y});
          a.dispatchEvent(o('pointerdown', x)); window.dispatchEvent(o('pointermove', x+dx)); a.dispatchEvent(o('pointerup', x+dx)); }"""
        await page.evaluate(TAP, 9); await page.wait_for_timeout(40)
        check("touch tap with jitter opens toggle", "Tobacco" in await page.locator(".cm-content").inner_text())
        await page.evaluate(TAP, 0); await page.wait_for_timeout(40)
        check("second touch tap closes toggle", "Tobacco" not in await page.locator(".cm-content").inner_text())
        await page.locator(".ntt-clean-arrow").first.click(); await page.wait_for_timeout(40)
        check("mouse click still toggles once", "Tobacco" in await page.locator(".cm-content").inner_text())
        us = await page.evaluate("getComputedStyle(document.querySelector('.ntt-clean-arrow')).userSelect")
        check("arrow is not selectable", us == "none", us)
        # 26 touch long-press drag: no text selection while dragging, cleared after
        await page.goto(URL + "?doc=" + up.quote(NOTE)); await page.wait_for_function("window.wb")
        sel0 = await page.evaluate("wb.view.state.selection.main.head")
        pt = await page.evaluate("(() => { const c = wb.view.coordsAtPos(wb.lineFrom(6) + 2); return [c.left, (c.top + c.bottom) / 2]; })()")
        TD = "([t, x, y]) => { const el = document.elementFromPoint(x, y); (t==='pointerdown' ? el : window).dispatchEvent(new PointerEvent(t, {bubbles:true, cancelable:true, pointerType:'touch', pointerId:9, isPrimary:true, button:0, clientX:x, clientY:y})); }"
        await page.evaluate(TD, ["pointerdown", pt[0], pt[1]])
        await page.evaluate("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.cm-content')); getSelection().removeAllRanges(); getSelection().addRange(r); })()")
        await page.wait_for_timeout(480)
        await page.evaluate(TD, ["pointermove", pt[0], pt[1] + 20])
        st = await page.evaluate("[document.body.classList.contains('ntt-no-select'), String(getSelection()).length, getComputedStyle(document.querySelector('.cm-content')).userSelect]")
        check("touch drag: selection cleared + text unselectable", st[0] and st[1] == 0 and st[2] == "none", str(st))
        prevented = await page.evaluate("(() => { const e = new Event('selectstart', {bubbles:true, cancelable:true}); document.querySelector('.cm-content').dispatchEvent(e); return e.defaultPrevented; })()")
        check("touch drag: new selection blocked", prevented)
        await page.evaluate(TD, ["pointerup", pt[0], pt[1] + 20])
        check("after drag: selection allowed again", not await page.evaluate("document.body.classList.contains('ntt-no-select')"))
        await page.screenshot(path=str(SHOTS / "26_touch_drag.png"))

        # 27 v1.8.14 paste from Notion: nested toggles appear straight away
        await page.goto(URL + "?doc=" + up.quote("start")); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(wb.text().length)")
        NOTION = "<details>\n<summary>Outer</summary>\n\t<details>\n\t<summary>Inner</summary>\n\t\tdeep\n\t</details>\n</details>"
        await page.evaluate("""(t) => { const dt = new DataTransfer(); dt.setData('text/plain', t);
          document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", NOTION)
        await page.wait_for_timeout(60)
        txt = await page.evaluate("wb.text()")
        check("notion paste: nested callouts in the note", "> > [!question]- Inner" in txt, txt)
        check("notion paste: starts on its own line after text", txt.startswith("start\n> [!question]- Outer"), txt)
        check("notion paste: toggles render at once", await page.locator(".ntt-clean-arrow").count() >= 1)
        await page.screenshot(path=str(SHOTS / "27_notion_paste.png"))

        check("no page errors", not errors, "; ".join(errors))
        await b.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
