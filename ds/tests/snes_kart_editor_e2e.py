import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate("dirty=false;useTemplate('kart_racing',{title:'Moon Cup'});P.console='snes';P.race=Object.assign({laps:3,rivals:3,rivalPct:92,top:3},P.race||{});P.race.laps=4;P.race.rivals=2;P.race.top=3.75;P.race.rivalPct=105;window.__dl=null;download=async(n,b)=>{if(String(n).endsWith('.sfc'))window.__dl=[n,Array.from(b)]};"); await pg.wait_for_timeout(200)
    R.append(('kart template lists the SNES Mode 7 kart', await pg.evaluate("NRTemplates.all().find(t=>t.id==='kart_racing').runs.includes('Super Nintendo (Mode 7 kart)')")))
    R.append(('SNES kart ROM is embedded', await pg.evaluate("typeof ROMS.snes_kart==='string' && ROMS.snes_kart.length>10000")))
    await pg.evaluate("exportRom()"); await pg.wait_for_timeout(900)
    r=await pg.evaluate("window.__dl")
    R.append(('export produced a file', r is not None))
    if r:
        n,d=r
        R.append(('file named Moon_Cup.sfc', n=='Moon_Cup.sfc'))
        R.append(('512 KB ROM with 4 laps / class 3 / 2 rivals / skill 3', len(d)==524288 and d[0x8008]==4 and d[0x8009]==3 and d[0x800A]==2 and d[0x800B]==3))
        R.append(('title patched', bytes(d[0x8010:0x8018])==b'MOON CUP'))
        R.append(('the ROM still has its own NOTAREAL logo data', bytes(d[0x7FC0:0x7FD0]).startswith(b'NOTAREAL KART')))
    R.append(('no page errors '+str(errs), not errs))
    for k,v in R: print(('PASS ' if v else 'FAIL ')+k)
    await b.close(); raise SystemExit(0 if all(v for _,v in R) else 1)
asyncio.run(m())
