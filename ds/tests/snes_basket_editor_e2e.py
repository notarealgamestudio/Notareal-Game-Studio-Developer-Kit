import asyncio, base64
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate("dirty=false;useTemplate('basketball',{title:'Moon Court'});P.arcade.cfg.seconds=45;P.arcade.cfg.skill=2;window.__dl=null;download=async(n,b)=>{if(String(n).endsWith('.sfc'))window.__dl=[n,Array.from(b)]};"); await pg.wait_for_timeout(200)
    R.append(('basketball template lists SNES', await pg.evaluate("NRTemplates.all().find(t=>t.id==='basketball').runs.includes('Super Nintendo (SNES ROM)')")))
    R.append(('SNES export button shown', await pg.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('SNES ROM'))")))
    await pg.evaluate("exportBasketSnes()"); await pg.wait_for_timeout(800)
    n,d=await pg.evaluate("window.__dl")
    R.append(('file named Moon_Court.sfc', n=='Moon_Court.sfc'))
    R.append(('512 KB ROM with sound and the patched settings', len(d)==524288 and d[0x8008]==45 and d[0x800A]==2 and bytes(d[0x8010:0x8020]).startswith(b'MOON COURT')))
    R.append(('no page errors '+str(errs), not errs))
    for k,v in R: print(('PASS ' if v else 'FAIL ')+k)
    await b.close(); raise SystemExit(0 if all(v for _,v in R) else 1)
asyncio.run(m())
