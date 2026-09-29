"""v1.8.16 — Notion row layout: every toggle arrow shares one left edge, long
titles wrap under the title text, bodies align with the title. Renders the real
styles.css at phone (360px) and desktop (1280px) width."""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = (ROOT / "styles.css").read_text()
QS = ["Q1. Bt toxin kya hota hai?", "Q2. Bt toxin ke proteins ka nature kya hota hai?",
      "Q3. Cry1Ab kis pest ke against effective hota hai?",
      "Q5. Pest-resistant crops banane ke liye lecture me kaunsi do major techniques discuss hui thi?",
      "Q6. Bt crop ke liye cry gene ka selection kis par depend karta hai?",
      "Q7. NCERT example ke hisaab se nematode-resistant plant kaunsa tha?", "Q8. Tobacco plant"]
def details(depth=0):
    rows = "".join(f'<details {"open" if i==0 else ""}><summary>{q}</summary><p class="body">Answer: Bt toxin Bacillus thuringiensis se derived toxic protein hai.</p></details>' for i,q in enumerate(QS))
    return rows
def callouts():
    return "".join(f'<div class="callout is-collapsible{" is-collapsed" if i else ""}" data-callout="note"><div class="callout-title"><div class="callout-icon"></div><div class="callout-title-inner">{q}</div><div class="callout-fold">v</div></div><div class="callout-content"><p>Answer text</p></div></div>' for i,q in enumerate(QS))
def chain(n=12):
    s = "leaf"
    for d in range(n, 0, -1): s = f'<details open><summary>depth {d}</summary>{s}</details>'
    return s
HTML = f"""<html><head><style>{CSS}
body{{font:16px/1.5 sans-serif;margin:0;padding:12px}}.callout-title{{display:flex}}</style></head>
<body class="ntt-notion-look"><div class="markdown-preview-view markdown-rendered">
<div id="d">{details()}</div><div id="c">{callouts()}</div><div id="chain">{chain()}</div></div></body></html>"""
fails = 0
def check(name, ok, detail=""):
    global fails
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    fails += 0 if ok else 1
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for w in (360, 1280):
            pg = await (await b.new_context(viewport={"width": w, "height": 1800})).new_page()
            await pg.set_content(HTML)
            m = await pg.evaluate("""() => [...document.querySelectorAll('#d > details > summary')].map(s => {
              const a = getComputedStyle(s,'::before'); const r = s.getBoundingClientRect();
              const range = document.createRange(); range.selectNodeContents(s);
              const rects = [...range.getClientRects()];
              return {arrow: r.left + parseFloat(a.left), lines: rects.map(x=>Math.round(x.left)), h: r.height,
                      body: s.nextElementSibling.getBoundingClientRect().left}; })""")
            arrows = [round(x["arrow"],1) for x in m]
            check(f"{w}px details arrows share one edge", max(arrows)-min(arrows) <= 1, arrows)
            starts = [x["lines"][0] for x in m]
            check(f"{w}px titles start at one x", max(starts)-min(starts) <= 1, starts)
            hang = all(max(x["lines"])-min(x["lines"]) <= 1 for x in m)
            check(f"{w}px wrapped lines hang under title", hang, [x["lines"] for x in m if len(x["lines"])>1])
            check(f"{w}px open body aligns with title", abs(m[0]["body"]-starts[0]) <= 1, (m[0]["body"], starts[0]))
            if w == 360: check("360px long titles actually wrap", any(len(x["lines"])>1 for x in m))
            c = await pg.evaluate("""() => [...document.querySelectorAll('#c .callout-title')].map(t => ({
              fold: Math.round(t.querySelector('.callout-fold').getBoundingClientRect().left),
              foldTop: Math.round(t.querySelector('.callout-fold').getBoundingClientRect().top - t.getBoundingClientRect().top),
              inner: Math.round(t.querySelector('.callout-title-inner').getBoundingClientRect().left)}))""")
            check(f"{w}px callout arrows share one edge", len({x["fold"] for x in c}) == 1, [x["fold"] for x in c])
            check(f"{w}px callout titles start at one x", len({x["inner"] for x in c}) == 1)
            check(f"{w}px callout arrow pinned to first line", all(x["foldTop"] <= 6 for x in c), [x["foldTop"] for x in c])
            ch = await pg.evaluate("""() => [...document.querySelectorAll('#chain summary')].map(s=>s.getBoundingClientRect().left)""")
            steps = {round(ch[i+1]-ch[i],1) for i in range(len(ch)-1)}
            check(f"{w}px 12-level chain indents one even step", len(ch)==12 and len(steps)==1 and min(steps)>0, steps)
            # opening one toggle must not move siblings' arrows horizontally
            before = await pg.evaluate("() => [...document.querySelectorAll('#d > details > summary')].map(s=>s.getBoundingClientRect().left)")
            await pg.click("#d > details:nth-child(3) > summary")
            after = await pg.evaluate("() => [...document.querySelectorAll('#d > details > summary')].map(s=>s.getBoundingClientRect().left)")
            opened = await pg.evaluate("() => [...document.querySelectorAll('#d > details')].map(d=>d.open)")
            check(f"{w}px tapping a title opens only that toggle", opened == [True, False, True, False, False, False, False], opened)
            check(f"{w}px opening does not shift siblings", before == after)
            if w == 360: await pg.screenshot(path="/tmp/layout-360.png")
        await b.close()
    print(f"{fails} failed"); sys.exit(1 if fails else 0)
asyncio.run(main())
