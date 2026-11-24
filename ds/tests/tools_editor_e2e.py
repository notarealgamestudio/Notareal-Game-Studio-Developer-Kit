import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate("dirty=false;useTemplate('kart_racing',{title:'Moon Cup',console:'pc'})"); await pg.wait_for_timeout(300)
    await pg.evaluate("tab='builder';renderAll()"); await pg.wait_for_timeout(200)
    R.append(('assistant box shown', await pg.evaluate("document.body.textContent.includes('Assistant (uses the same tools')")))
    await pg.fill("input[placeholder^='Tell the assistant']","4 player kart game with 3 rivals and 6 laps"); await pg.click("text=Do it"); await pg.wait_for_timeout(400)
    R.append(('assistant changed the game', await pg.evaluate("P.arcade&&P.arcade.cfg.players===4&&P.arcade.cfg.laps===6&&P.arcade.cfg.cpus===3")))
    await pg.fill("input[placeholder^='Tell the assistant']","late game long blade"); await pg.click("text=Do it"); await pg.wait_for_timeout(300)
    R.append(('weapon advice uses bundled data', await pg.evaluate("document.body.textContent.includes('damage per second')")))
    R.append(('no page errors', not errs))
    for n,o in R: print('PASS' if o else 'FAIL',n)
    if errs: print(errs)
    await b.close()
asyncio.run(m())
