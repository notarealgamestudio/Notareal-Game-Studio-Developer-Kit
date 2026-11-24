import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=fight]'); await pg.wait_for_timeout(300)
    R.append(('Fighting tab shows two fighters', await pg.evaluate("P.fight.fighters.length===2")))
    await pg.click('text=Play a match'); await pg.wait_for_timeout(500)
    await pg.evaluate("__fight.state.f[1].x=__fight.state.f[0].x+22")
    for _ in range(6):
        await pg.keyboard.down('z'); await pg.wait_for_timeout(80); await pg.keyboard.up('z'); await pg.wait_for_timeout(400)
    R.append(('keyboard strikes hurt the rival in the live match', await pg.evaluate("__fight.state.f[1].hp<100")))
    await pg.screenshot(path='/tmp/fight.png')
    R.append(('no script errors', not errs))
    for n,o in R: print('PASS' if o else 'FAIL', n)
    await b.close()
asyncio.run(m())
