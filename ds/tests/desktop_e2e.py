# Runs the standalone launcher binary, opens the studio in a browser against it and scans a ROM folder from the Research Lab tab.
import asyncio, subprocess, os, shutil, time, json
from playwright.async_api import async_playwright
BIN=os.environ.get('NR_BIN','/home/claude/notareal-kit/ds/dist/notareal-studio-linux'); W='/tmp/dt'; shutil.rmtree(W,ignore_errors=True); os.makedirs(W+'/roms/sub')
for src,dst in [('lakewood_run_ds.nds','roms/'),('moonlight-holler.gb','roms/sub/'),('super-moonlight-holler.sfc','roms/sub/')]: shutil.copy('/home/claude/out/'+src,W+'/'+dst)
shutil.copy(BIN,W+'/nrstudio'); env=dict(os.environ,NR_NO_BROWSER='1',NR_PORT='8911')
srv=subprocess.Popen([W+'/nrstudio'],cwd=W,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(2.5)
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]; R=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://127.0.0.1:8911/'); await pg.wait_for_timeout(800)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn:has-text("Research")'); await pg.wait_for_timeout(500)
    R.append(('desktop mode detected', await pg.evaluate("DESK.ok===true")))
    await pg.fill('input[placeholder^="Folder with your ROMs"]', W+'/roms'); await pg.click('text=Scan this folder'); 
    for _ in range(60):
        await pg.wait_for_timeout(500)
        if await pg.evaluate("DESK.lib.length>=3"): break
    R.append(('folder scan added 3 ROMs to the library', await pg.evaluate("DESK.lib.length===3")))
    R.append(('records carry graphics data', await pg.evaluate("DESK.lib.every(r=>r.gfx&&r.gfx.platform)")))
    R.append(('records carry graphics reverse-engineering numbers', await pg.evaluate("DESK.lib.every(r=>r.re&&r.re.platform&&Array.isArray(r.re.lines))")))
    R.append(('graphics_techniques.json written', os.path.exists(W+'/Notareal_Data/graphics_techniques.json')))
    # the explorer in the Research Lab: load a ROM, analyze, look at a region, save
    async with pg.expect_file_chooser() as fc: await pg.click('button:has-text("Load a ROM")')
    await (await fc.value).set_files('/home/claude/out/super-moonlight-holler.sfc'); await pg.wait_for_timeout(600)
    await pg.click('button:has-text("Analyze this ROM")')
    for _ in range(80):
        await pg.wait_for_timeout(500)
        if await pg.evaluate("!!RES.A"): break
    R.append(('explorer analyzed the ROM', await pg.evaluate("RES.A&&RES.A.assets.length>0")))
    await pg.wait_for_selector('summary:has-text("Graphic regions")'); await pg.evaluate("document.querySelector('details').open=true;[...document.querySelectorAll('summary')].find(s=>/Graphic regions/.test(s.textContent)).parentElement.open=true"); await pg.click('.songchip >> nth=0'); await pg.wait_for_timeout(600)
    R.append(('explorer canvas drew a region', await pg.evaluate("(()=>{const c=document.querySelector('.gfxpanel canvas');return !!c&&c.width>=8})()")))
    await pg.click('button:has-text("Save measurements")'); await pg.wait_for_timeout(800)
    R.append(('graphics style offered for the Graphics tab', await pg.evaluate("Object.keys(NRGfx.STYLES).some(k=>k.startsWith('lib_'))")))
    await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/desk.png')
    R.append(('results saved on disk', os.path.exists(W+'/Notareal_Data/research_library.json') and os.path.exists(W+'/Notareal_Data/graphics_report.md')))
    # restart: data persists
    await b.close(); return R, errs
R,errs=asyncio.run(m()); srv.terminate()
srv2=subprocess.Popen([W+'/nrstudio'],cwd=W,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(2)
import urllib.request
rq=urllib.request.Request('http://127.0.0.1:8911/api/library',headers={'X-Notareal':'1'}); n=len(json.load(urllib.request.urlopen(rq))); srv2.terminate()
R.append(('library survives a restart',n==3)); R.append(('no script errors',not errs))
for a,o in R: print('PASS' if o else 'FAIL',a)
print(errs)
