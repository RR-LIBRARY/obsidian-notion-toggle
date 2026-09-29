"""v1.8.22 — replay the user's corrected Enter/depth video in the plugin, 360px."""
import asyncio, sys, urllib.parse as up
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).parent))
URL = (Path(__file__).parent / "out" / "index.html").resolve().as_uri()
SHOTS = Path(__file__).parent / "out"; SHOTS.mkdir(exist_ok=True)
fails = 0
def check(n, ok, d=""):
    global fails
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"  -> {d!r}")); fails += 0 if ok else 1

async def ime(cdp, page, word):
    # Gboard style: text arrives as a composition, Enter is pressed before it is committed.
    for i in range(1, len(word) + 1):
        await cdp.send("Input.imeSetComposition", {"text": word[:i], "selectionStart": i, "selectionEnd": i})
    await cdp.send("Input.insertText", {"text": word})

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 360, "height": 800})).new_page()
        cdp = await page.context.new_cdp_session(page)
        await page.goto(URL + "?doc=" + up.quote("> [!question]- ")); await page.wait_for_function("window.wb")
        await page.evaluate("wb.set(15)")
        await ime(cdp, page, "what is my Name")
        grey = await page.evaluate("(() => { const l=document.querySelector('.cm-line'); return getComputedStyle(l.querySelector('.ntt-clean-placeholder')||l).color })()")
        check("typed title is real text (no grey hint span swallowing it)", await page.locator(".ntt-clean-placeholder").count() == 0, grey)
        await page.keyboard.press("Enter")
        t = await page.evaluate("wb.text()")
        check("Enter after a composed title makes a same-depth sibling", t.startswith("> [!question]- what is my Name\n\n> [!question]-"), t)
        for title in ["Where I am From", "how to know you", "What Kind of people you Are"]:
            await ime(cdp, page, title)
            await page.keyboard.press("Enter")
        t = await page.evaluate("wb.text()")
        lines = [line for line in t.split("\n") if "[!question]" in line]
        check("four video titles stay as top-level siblings", len(lines) == 5 and all(line.startswith("> [!question]-") for line in lines), t)
        await page.keyboard.type("last")
        await page.keyboard.press("Tab")
        t = await page.evaluate("wb.text()")
        check("only Tab changes depth", "> > [!question]- last" in t, t)
        await page.screenshot(path=str(SHOTS / "30_replay_notion_video.png"))
        await b.close()
    print(f"{fails} failed")
    sys.exit(1 if fails else 0)
asyncio.run(main())
