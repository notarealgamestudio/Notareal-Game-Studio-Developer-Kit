import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1400,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.evaluate("() => { tab = 'fix'; renderAll(); }"); await pg.wait_for_timeout(300)
    ok1=await pg.is_visible('text=Console help and known fixes')
    await pg.fill('input[placeholder^="Search known"]','touch not responding'); await pg.select_option('select >> nth=1','gbc') if False else None
    await pg.click('button:text-is("Search")'); await pg.wait_for_timeout(300)
    ok2=await pg.is_visible('b:has-text("Nintendo DS")') and await pg.is_visible('text=Touch input does nothing')
    await pg.evaluate("() => { tab = 'arcade'; renderAll(); }"); await pg.click('text=Start >> nth=0'); await pg.wait_for_timeout(300)
    ok3=await pg.is_visible('text=Music while playing') and await pg.is_visible('text=Export Nintendo DS ROM')
    n=await pg.evaluate("(()=>{const r=NRKit.buildDSArcade(P);return r.block.length})()")
    print('fix tab help',ok1,'search',ok2,'arcade song pickers',ok3,'block',n,'errors',errs)
    assert ok1 and ok2 and ok3 and n>1000 and not errs
asyncio.run(m())
