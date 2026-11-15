import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
P=Path(__file__).parent
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  for w,h in [(390,844),(1280,1800)]:
   page=await b.new_page(viewport={'width':w,'height':h});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto((P/'index.html').as_uri());await page.wait_for_function('window.wb')
   assert await page.locator('.ntt-notion-callout').count()==8
   first=page.locator('.callout').first;title=first.locator(':scope > .callout-title')
   assert await first.evaluate('(el)=>el.classList.contains("is-collapsed")')
   await title.click();assert not await first.evaluate('(el)=>el.classList.contains("is-collapsed")')
   await title.click();assert await first.evaluate('(el)=>el.classList.contains("is-collapsed")')
   await page.get_by_role('button',name='Appearance',exact=True).click();assert await page.locator('.ntt-native-callout').count()==8
   assert await page.locator('.callout-icon').first.evaluate('(el)=>getComputedStyle(el).display')!='none'
   await title.click();assert not await first.evaluate('(el)=>el.classList.contains("is-collapsed")')
   await title.click();assert await first.evaluate('(el)=>el.classList.contains("is-collapsed")')
   await page.get_by_role('button',name='Format filter',exact=True).click()
   await page.get_by_role('button',name='All Notion',exact=True).click();assert await page.locator('.ntt-notion-callout').count()==8
   assert await page.evaluate('wb.settings.notionLook') is True
   await page.locator('.modal-container').evaluate('(el)=>el.style.display="none"');await page.evaluate('document.getElementById("notice").replaceChildren()')
   await page.screenshot(path=str(P/f'{w}_notion_cards.png'));await page.locator('.modal-container').evaluate('(el)=>el.style.display=""')
   await page.get_by_role('button',name='All callouts',exact=True).click();assert await page.locator('.ntt-native-callout').count()==8
   await page.locator('.modal-container').evaluate('(el)=>el.style.display="none"')
   await page.screenshot(path=str(P/f'{w}_callout_cards.png'))
   await page.locator('.modal-container').evaluate('(el)=>el.remove()')
   await page.get_by_role('button',name='Appearance',exact=True).click();assert await page.locator('.ntt-native-callout').count()==8
   await page.get_by_role('button',name='Appearance',exact=True).click();assert await page.locator('.ntt-notion-callout').count()==8
   await page.get_by_role('button',name='Numbers',exact=True).click();await page.get_by_placeholder('6-11, 13').fill('6-11');await page.get_by_role('button',name='Apply',exact=True).click()
   assert await page.locator('.ntt-native-callout').count()==6;assert await page.locator('.ntt-notion-callout').count()==2
   await page.evaluate('wb.late()');await page.wait_for_timeout(100);assert await page.locator('.ntt-native-callout').count()==7
   await page.screenshot(path=str(P/f'{w}_numbers.png'))
   await page.evaluate('wb.priorEdit()');await page.wait_for_timeout(500)
   await page.get_by_role('button',name='Review colours',exact=True).click();await page.get_by_placeholder('6-11, 13').fill('6-11');await page.get_by_role('button',name='Grade selected',exact=True).click();await page.wait_for_timeout(100)
   assert '[!recall-red]- Q6.' in await page.evaluate('wb.text()')
   await page.locator('.modal-container select').nth(1).select_option('red');await page.wait_for_timeout(100)
   assert await page.locator('.callout:visible').count()==6
   assert all(v>0 for v in await page.evaluate('wb.measure()'))
   assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   await page.screenshot(path=str(P/f'{w}_red.png'))
   await page.locator('.modal-container').evaluate('(el)=>el.remove()')
   mic=page.get_by_role('button',name='Voice mode — tap to speak');assert await mic.is_visible()
   await page.get_by_role('button',name='Autoscroll',exact=True).click();assert not await mic.is_visible();assert await page.locator('.callout:visible').count()==8
   await page.get_by_role('button',name='Autoscroll',exact=True).click();assert await mic.is_visible();assert await page.locator('.callout:visible').count()==6
   await page.evaluate('wb.undo()');assert '[!recall-red]' not in await page.evaluate('wb.text()');assert (await page.evaluate('wb.text()')).startswith('Prior edit')
   await page.evaluate('wb.undo()');assert not (await page.evaluate('wb.text()')).startswith('Prior edit')
   await page.evaluate('wb.switchNote()');assert await page.locator('.callout:visible').count()==8;assert await page.locator('.ntt-native-callout').count()==0
   await page.evaluate('''() => { wb.settings.toggleLookRules['B.md']={numbers:'6-11',look:'callout'}; wb.switchNote(); const root=document.getElementById('cards'); const parent=root.firstElementChild; parent.querySelector('.callout-content').style.display='block'; parent.querySelector('.callout-content').append(root.children[6]); }''')
   child=page.locator('.ntt-native-callout .ntt-notion-callout').first
   assert await child.locator('.callout-icon').evaluate('(el)=>getComputedStyle(el).display')=='none'
   assert await child.locator('.callout-fold svg').evaluate('(el)=>getComputedStyle(el).display')=='none'
   await page.screenshot(path=str(P/f'{w}_nested.png'))
   assert not errors,errors
   print(f'PASS {w}: appearance/ranges, late rendering, grading/readback, visible red, measurement heights, undo + prior undo, mic hide/restore, note isolation; no errors')
   await page.close()
  await b.close()
asyncio.run(main())
