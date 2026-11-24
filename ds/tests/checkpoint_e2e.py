import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate('setProject(JSON.parse(JSON.stringify(EXAMPLE)))'); await pg.wait_for_timeout(800)
    r=await pg.evaluate("""(()=>{
      const Q=JSON.parse(JSON.stringify(P)); const L=Q.levels[0]; const s=L.objects.find(o=>o.type==='start'); L.objects.push({type:'check',x:s.x+6,y:s.y});
      const W=NRWorld.fromPlatformer(Q,true); const cv=document.createElement('canvas'); cv.width=384; cv.height=216;
      const imgs={}; const g=NRWorld.play(cv,W.project||Q,{keys:{},images:imgs,manual:true,sound:()=>{}});
      const map=g.pos().map; const out={};
      g.warp(map,s.x+6,s.y); g.step(3); out.cp=g.state.cp;
      g.warp(map,s.x+12,s.y); g.step(1);
      g.warp(map,s.x+12,40); g.step(4);
      out.over=g.state.over; out.hp=g.state.hp; out.max=g.state.maxhp; out.pos=g.pos(); out.sx=s.x; return out; })()""")
    print(r)
    ok=r['cp'] is not None and not r['over'] and r['hp']==r['max'] and abs(r['pos']['x']/16-(r['sx']+6))<2
    print('PASS' if ok else 'FAIL','falling after touching a checkpoint respawns there instead of game over')
    print('PASS' if not errs else 'FAIL','no script errors',errs); await b.close()
asyncio.run(m())
