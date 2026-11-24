import asyncio, zipfile, shutil
from playwright.async_api import async_playwright
FAKE="window.__pad={connected:true,mapping:'standard',id:'x',index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};navigator.getGamepads=()=>[window.__pad];window.__btn=(i,v)=>{window.__pad.buttons[i]={pressed:!!v,value:v?1:0}};"
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True,viewport={'width':1500,'height':950}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.evaluate('setProject(JSON.parse(JSON.stringify(EXAMPLE)))'); await pg.wait_for_timeout(800)
    async with pg.expect_download() as dl: 
        await pg.evaluate("exportPC()"); await pg.wait_for_timeout(400); await pg.click('.modal button.go')
    await (await dl.value).save_as('/tmp/plat.zip'); z=zipfile.ZipFile('/tmp/plat.zip'); shutil.rmtree('/tmp/platpkg',ignore_errors=True); z.extractall('/tmp/platpkg')
    root='/tmp/platpkg/'+z.namelist()[0].split('/')[0]
    g=await ctx.new_page(); g.on('pageerror',lambda e:errs.append(str(e))); await g.add_init_script(FAKE); await g.goto('file://'+root+'/index.html'); await g.wait_for_timeout(500)
    await g.evaluate("__btn(0,1)"); await g.wait_for_timeout(150); await g.evaluate("__btn(0,0)"); await g.wait_for_timeout(200)
    await g.evaluate("__btn(0,1)"); await g.wait_for_timeout(150); await g.evaluate("__btn(0,0)"); await g.wait_for_timeout(500)
    ok0=await g.evaluate("__nr.scene==='play'"); p0=await g.evaluate("__nr.game.pos()")
    await g.evaluate("__pad.axes[0]=1"); await g.wait_for_timeout(1200); await g.evaluate("__pad.axes[0]=0"); p1=await g.evaluate("__nr.game.pos()")
    await g.evaluate("__btn(0,1)"); await g.wait_for_timeout(200); await g.evaluate("__btn(0,0)"); await g.wait_for_timeout(300)
    p2=await g.evaluate("__nr.game.pos()"); await g.screenshot(path='/tmp/plat.png')
    print('PASS' if ok0 else 'FAIL','platformer exported and started'); print('PASS' if p1['x']>p0['x']+20 else 'FAIL','runs right',p0['x'],p1['x']); print('PASS' if p2['y']<p1['y'] or p2['y']!=p1['y'] else 'FAIL','A jumps',p1['y'],p2['y']); print('PASS' if not errs else 'FAIL','no errors',errs[:2])
    await b.close()
asyncio.run(m())
