import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    bad=[]; n=0
    for con in ['ds','pc','snes','gba','psx']:
      for g in await pg.evaluate("GENRES.types.map(g=>g.id)"):
        r=await pg.evaluate("""([con,g])=>{try{createFromWizard({console:con,genre:g,style:'classic',hero:null,music:null,title:'T',author:'A'});
          const sup=NRFit.consolesFor(g);const exp=sup.includes(con)?con:(sup.includes('ds')?'ds':sup[0]);
          const has=P.arcade||P.puzzle||P.fight||(P.world&&P.world.maps&&P.world.maps.length)||(P.levels&&P.levels.length&&P.levels[0].objects.length)||P.genre==='music_maker';
          return {ok:P.console===exp&&!!has,con:P.console,exp,has:!!has}}catch(e){return {ok:false,err:String(e)}}}""",[con,g])
        n+=1
        if not r['ok']: bad.append((con,g,r))
    print('wizard builds',n,'combos, bad:',bad[:8],'errs',errs[:3])
    # PC console card clickable & wizard opens
    await pg.evaluate("wizard()"); await pg.wait_for_timeout(300)
    await pg.click('text=PC (Windows / Xbox controller)'); await pg.wait_for_timeout(200)
    soon=await pg.evaluate("document.querySelectorAll('.famrow .card.soon').length"); tot=await pg.evaluate("document.querySelectorAll('.famrow .card').length")
    print('PC selected: types not-ready',soon,'of',tot)
    await b.close()
asyncio.run(m())
