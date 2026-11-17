import asyncio,json,re
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.connect_over_cdp('http://localhost:9222');page=b.contexts[0].pages[0];await page.set_viewport_size({'width':393,'height':629})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate("()=>{document.body.classList.add('is-mobile');app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse()}")
  await page.evaluate("async()=>{await app.plugins.disablePlugin('notion-toggle');await app.plugins.enablePlugin('notion-toggle');window.pl=app.plugins.plugins['notion-toggle'];app.commands.executeCommandById('notion-toggle:autoscroll-sheet')}")
  row=page.locator('.setting-item').filter(has=page.locator('.setting-item-name',has_text='Start from question number'))
  await row.locator('input').fill('35,40,48');await page.get_by_role('button',name='Even',exact=True).click()
  print('typed',await page.evaluate('({n:pl.settings.scrollStartNumber,list:pl.settings.scrollStartSequence,mode:pl.settings.scrollMode,route:pl.modeConfig().route})'))
  await row.scroll_into_view_if_needed()
  await page.screenshot(path='/tmp/browser/think-number/phone-controls.png')
  assert await page.evaluate('pl.settings.scrollStartSequence.join(",")')=='35,40,48'
  assert await page.evaluate('pl.settings.scrollMode')=='even'
  await row.locator('input').fill('35,');assert await row.locator('input').get_attribute('aria-invalid')=='true'
  assert await page.evaluate('pl.settings.scrollStartSequence.join(",")')=='35,40,48'
  await row.locator('input').fill('35');await page.get_by_role('button',name='All',exact=True).click()
  await page.keyboard.press('Escape')
  await page.evaluate("()=>{pl.settings.scrollThinkSeconds=3;pl.settings.scrollAdvanceBy='toggles';pl.settings.scrollHold=2;pl.settings.scrollReadWps=0;pl.settings.scrollFocusChrome=false;pl.startAutoScroll()}")
  await page.wait_for_function("pl.scrollOpenEl && pl.scrollOpenEl.querySelector('.ntt-think-badge')")
  print('countdown',await page.evaluate("({title:pl.scrollOpenEl.querySelector('.callout-title-inner').textContent,closed:pl.scrollOpenEl.classList.contains('is-collapsed')})"))
  assert await page.evaluate("pl.scrollOpenEl.classList.contains('is-collapsed')")
  assert await page.evaluate("pl.scrollOpenEl.querySelector('.callout-title-inner').textContent.startsWith('Q35.')")
  await page.screenshot(path='/tmp/browser/think-number/phone-countdown.png')
  await page.evaluate('pl.toggleAutoScroll()');await page.wait_for_timeout(1800)
  assert await page.evaluate("pl.scrollOpenEl.classList.contains('is-collapsed')")
  await page.evaluate('pl.toggleAutoScroll()')
  await page.wait_for_function("pl.scrollOpenEl && !pl.scrollOpenEl.classList.contains('is-collapsed')",timeout=6000)
  print('revealed',await page.evaluate("pl.scrollOpenEl.querySelector('.callout-title-inner').textContent"))
  await page.screenshot(path='/tmp/browser/think-number/phone-reveal.png')
  await page.evaluate('pl.stopAutoScroll(false)');print('pageerrors',errors);assert not errors
asyncio.run(main())
