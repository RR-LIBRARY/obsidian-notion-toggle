import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.connect_over_cdp('http://localhost:9222'); page=b.contexts[0].pages[0]; await page.set_viewport_size({'width':1280,'height':1800})
  await page.evaluate("async()=>{await app.plugins.disablePlugin('notion-toggle');await app.plugins.enablePlugin('notion-toggle');}")
  await page.evaluate("()=>{window.pl=app.plugins.plugins['notion-toggle'];window.reveals=[]; const old=pl.parkOnToggle.bind(pl);pl.parkOnToggle=(n,...args)=>{const ok=old(n,...args);if(ok && !args[2]) reveals.push(pl.scrollOpenEl?.querySelector('.callout-title-inner')?.textContent);return ok}}")
  for name,mode,seq,advance,expected in [('start35','all',[],'toggles',[35,36]),('list','all',[35,40,48],'toggles',[35,40,48]),('odd','odd',[],'toggles',[35,37]),('even','even',[],'toggles',[36,38]),('list-screens','all',[35,40,48],'screens',[35,40,48])]:
   await page.evaluate("async([mode,seq,advance])=>{pl.stopAutoScroll(false);await app.workspace.openLinkText('Practice','',false);pl.settings.scrollStartNumber=35;pl.settings.scrollStartSequence=seq;pl.settings.scrollMode=mode;pl.settings.scrollAdvanceBy=advance;pl.settings.scrollThinkSeconds=1;pl.settings.scrollHold=1;pl.settings.scrollReadWps=0;pl.settings.scrollSpeed=1200;pl.settings.scrollFocusChrome=false;await pl.saveSettings();reveals=[];pl.startAutoScroll();}",[mode,seq,advance])
   for i in range(90):
    await page.wait_for_timeout(300)
    vals=await page.evaluate('reveals')
    if len(vals)>=len(expected):break
   print(name,json.dumps(await page.evaluate("({reveals, running:pl.scrollRunning,last:pl.scrollLastEvent,settings:pl.settings.scrollStartSequence,plan:pl.scrollPlan.slice(0,3).map(q=>q.ordinal)})")))
   nums=[int(v.split('Q')[1].split('.')[0]) for v in vals if v]
   assert nums[:len(expected)]==expected,(name,nums,expected)
   await page.screenshot(path=f'/tmp/browser/think-number/{name}.png')
  await page.evaluate('pl.stopAutoScroll(false)')
asyncio.run(main())
