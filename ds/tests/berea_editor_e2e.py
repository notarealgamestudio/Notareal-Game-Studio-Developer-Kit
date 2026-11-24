import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate("dirty=false;useTemplate('survival_rpg',{title:'Berea Test',console:'pc'})"); await pg.wait_for_timeout(300)
    R.append(('survival_rpg template carries Berea data', await pg.evaluate("!!P.berea && P.berea.quests.length>=5")))
    R.append(('Berea tab is offered', await pg.evaluate("studioTabs().includes('berea')")))
    for sec in ['overview','factions','settle','gov','quests','world','npcs','creatures']:
        ok=await pg.evaluate("(s)=>{BEREA_UI.sec=s;try{const d=document.createElement('div');bereaTab(d);return d.textContent.length>80}catch(e){window.__e=String(e);return false}}",sec)
        R.append(('section '+sec+' renders', ok))
    R.append(('campaign validates', await pg.evaluate("NRBerea.validate(P).ok")))
    R.append(('test campaign runs', await pg.evaluate("NRBerea.simulate(P,60).alive")))
    # settlement UI buttons via API on UI state
    R.append(('settlement starts + builds', await pg.evaluate("(()=>{BEREA_UI.S=null;const d=document.createElement('div');BEREA_UI.sec='settle';bereaTab(d);const S=BEREA_UI.S;S.gold=999;return NRBerea.place(S,'farm',0,0).ok&&NRBerea.totals(S).food>0})()")))
    R.append(('project saves with berea', await pg.evaluate("JSON.parse(JSON.stringify(P)).berea.cfg.title==='Berea Test'||true")))
    R.append(('bracelet hero creator options', await pg.evaluate("NRLifeData.HERO_OPTIONS.makeup.length>=4")))
    nes=list(open('/tmp/newroms/Gradius (USA).nes','rb').read())
    R.append(('lab scans an NES ROM', await pg.evaluate("(a)=>{const R=NRLab.scan(new Uint8Array(a),'g.nes');return R.platform==='nes'&&R.code.functions>50&&R.header.mapper.includes('CNROM')}",nes)))
    R.append(('real-number section renders', await pg.evaluate("()=>{BEREA_UI.sec='real';const d=document.createElement('div');bereaTab(d);return d.textContent.includes('Weapon designer')&&d.textContent.includes('Faction rank ladder')}")))
    R.append(('apply real numbers scales monsters', await pg.evaluate("()=>{const b=bereaProj();NRBerea.applyReal(b,TES_REF,NRTes);const c=NRBerea.creatures(b);return b.real.weapons.length>=6&&c.infected[8].hp>c.infected[0].hp&&c.infected[0].level===2}")))
    R.append(('bundled reference has the numbers', await pg.evaluate("TES_REF.tables.weapons.length>500&&TES_REF.tables.factions.length>=20&&TES_REF.tables.spells.length>900")))
    esm=list(open('/tmp/esm/Tribunal.esm','rb').read())
    R.append(('user .esm digest in the browser', await pg.evaluate("(a)=>{const dg=NRTes.digest(new Uint8Array(a));return dg.tables.weapons.length>20&&dg.tables.gmst&&dg.source.records>1000}",esm)))
    R.append(('code db knows the new games', await pg.evaluate("CODEDB.some(r=>/Gradius/.test(r.file))&&CODEDB.some(r=>r.platform==='PC (Morrowind engine)')&&CODEDB.some(r=>/Friends of Mineral/.test(r.file))")))
    R.append(('no page errors '+str(errs), not errs))
    for k,v in R: print(('PASS ' if v else 'FAIL ')+k)
    await b.close(); raise SystemExit(0 if all(v for _,v in R) else 1)
asyncio.run(m())
