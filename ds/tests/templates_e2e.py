import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=Start from a template'); await pg.wait_for_timeout(400)
    R.append(('template gallery shows every template', await pg.evaluate("document.querySelectorAll('.pane .card').length==NRTemplates.all().length")))
    # every template applies and lands on a tab that renders without errors
    ok=await pg.evaluate("""(async()=>{const bad=[];for(const t of NRTemplates.all()){try{dirty=false;useTemplate(t.id,{title:'T '+t.id});await new Promise(r=>setTimeout(r,30));if(tab!==t.tab||!document.querySelector('#main *'))bad.push(t.id+' tab '+tab)}catch(e){bad.push(t.id+' '+e.message)}}return bad})()""")
    R.append(('all templates open their editor tab '+str(ok), ok==[]))
    # arcade: every mode plays and draws something
    res=await pg.evaluate("""(async()=>{const out={};for(const k of Object.keys(NRArcade.MODES).filter(k=>!['room','airhockey','claw','hoops'].includes(k))){useTemplate(k==='race'?'racing':(({sandbox3d:'platformer_3d',warfare3d:'military_shooter',store3d:'job_sim',rpg3d:'survival_rpg',craft:'crafting_sim',coloring:'coloring_book'})[k]||NRTemplates.all().find(t=>t.kind===k&&['arcade','skate','fps'].includes(t.engine)).id),{console:'pc'});if(k==='race'){tab='arcade';}await new Promise(r=>setTimeout(r,20));await playArcade();await new Promise(r=>setTimeout(r,400));const cv=document.querySelector('.modal canvas'),d=cv.getContext('2d').getImageData(0,0,320,240).data;let n=0,s=new Set();for(let i=0;i<d.length;i+=40){s.add(d[i]+','+d[i+1]+','+d[i+2])}out[k]=s.size;window.__arcade.stop();document.querySelector('.modal button').click()}return out})()""")
    R.append(('arcade modes draw (colours seen: '+str(res)+')', all(v>4 for v in res.values())))
    await pg.evaluate("useTemplate('racing',{title:'Road Rush',theme:'fire'})"); await pg.wait_for_timeout(200); await pg.evaluate("playArcade()"); 
    for kk in ['ArrowUp']: await pg.keyboard.down(kk)
    await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/arc_race.png'); await pg.keyboard.up('ArrowUp'); await pg.keyboard.press('Escape')
    for mode,t in [('fps','shooter_fps'),('shmup','shmup'),('brawler','beat_em_up'),('sim','city_builder')]:
        await pg.evaluate(f"useTemplate('{t}')"); await pg.wait_for_timeout(150); await pg.evaluate("playArcade()"); await pg.wait_for_timeout(700); await pg.screenshot(path=f'/tmp/arc_{mode}.png',clip={'x':350,'y':150,'width':800,'height':620}); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    html=await pg.evaluate("(()=>{dirty=false;useTemplate('breakout');return NRPc.arcadeHTML(P,{sources:KITSRC})})()")
    q=await b.new_page(viewport={'width':900,'height':700}); q.on('pageerror',lambda e:errs.append(str(e))); await q.bring_to_front(); await q.set_content(html); await q.wait_for_timeout(800)
    await q.keyboard.down('z'); await q.wait_for_timeout(250); await q.keyboard.up('z'); await q.wait_for_timeout(300)
    await q.wait_for_function('typeof __game==="object"&&__game.game.s.t>20',timeout=5000)
    R.append(('exported arcade page runs', True))
    await pg.evaluate("document.querySelectorAll('.modalbg').forEach(m=>m.remove())")
    # builder without AI
    await pg.evaluate("P=JSON.parse(JSON.stringify(EXAMPLE));dirty=false;tab='builder';renderAll()"); await pg.fill('textarea','a haunted castle platformer with 2 levels called "Boo Hall"'); await pg.click('text=Build it'); await pg.wait_for_timeout(2500)
    R.append(('Make me a game builds a checked platformer', await pg.evaluate("P.meta.title==='Boo Hall'&&P.levels.length===2&&P.levels.every((l,i)=>NRKit.checkLevel(P,i).ok)&&tab==='level'")))
    await pg.evaluate("document.querySelectorAll('.modalbg').forEach(m=>m.remove());P=JSON.parse(JSON.stringify(EXAMPLE));dirty=false;tab='builder';renderAll()"); await pg.fill('textarea','a farm game'); await pg.click('text=Build it'); await pg.wait_for_timeout(1500)
    R.append(('builder routes a farm game to the world engine', await pg.evaluate("tab==='world'&&P.world&&P.world.maps.length>0")))
    R.append(('no script errors '+str(errs[:3]), not errs))
    for n,o in R: print('PASS' if o else 'FAIL', n)
    await b.close()
asyncio.run(m())
