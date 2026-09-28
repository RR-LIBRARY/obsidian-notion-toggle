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

        check("no page errors", not errors, "; ".join(errors))
        await b.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
