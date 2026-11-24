import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=puzzle]'); await pg.wait_for_timeout(300)
    R.append(('Puzzle tab opens with bracelet settings', await pg.evaluate("P.puzzle.mode==='bracelet'")))
    await pg.click('.pane >> text=▶ Play'); await pg.wait_for_timeout(400)
    # paint row via keyboard: hint (c) then check (x)
    for kk in 'cx':
        await pg.keyboard.down(kk); await pg.wait_for_timeout(80); await pg.keyboard.up(kk); await pg.wait_for_timeout(120)
    R.append(('hint + check advances a bracelet row', await pg.evaluate("__puzzle.state.row===1")))
    await pg.screenshot(path='/tmp/puz1.png')
    html=await pg.evaluate("(()=>{P.puzzle.mode='match3';return NRPc.puzzleHTML(P)})()")
    q=await b.new_page(viewport={'width':1280,'height':720}); q.on('pageerror',lambda e:errs.append(str(e))); await q.set_content(html); await q.wait_for_timeout(500)
    await q.keyboard.down('z'); await q.wait_for_timeout(80); await q.keyboard.up('z'); await q.wait_for_timeout(120); await q.screenshot(path='/tmp/puz2.png')
    R.append(('exported match-3 page runs', await q.evaluate("__game.state.moves===20")))
    R.append(('no script errors', not errs))
    for n,o in R: print('PASS' if o else 'FAIL', n)
    print(errs); await b.close()
asyncio.run(m())
