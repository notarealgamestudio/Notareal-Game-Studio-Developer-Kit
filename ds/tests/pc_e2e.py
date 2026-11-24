import asyncio, json, os, zipfile, io, sys
from playwright.async_api import async_playwright
R=[]
def rec(n, ok, note=''): R.append([n, bool(ok), note]); print('PASS' if ok else 'FAIL', n, note)
FAKEPAD = """
window.__pad = {connected:true, mapping:'standard', id:'Xbox Wireless Controller', index:0, buttons:Array.from({length:17},()=>({pressed:false,value:0})), axes:[0,0,0,0], vibrationActuator:{playEffect(){window.__rumbleCalls=(window.__rumbleCalls||0)+1;return Promise.resolve();}}};
navigator.getGamepads = () => [window.__pad];
window.__btn = (i,v)=>{window.__pad.buttons[i]={pressed:!!v,value:v?1:0};};
"""
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True, viewport={'width':1500,'height':950}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=world]'); await pg.click('text=Start from the Town starter'); await pg.wait_for_timeout(800)
    # export through the UI
    await pg.click('button:has-text("PC / Xbox package")'); await pg.wait_for_timeout(300)
    txt = await pg.inner_text('.modal')
    rec('package dialog shows readiness checks and the honest Xbox note', '✔' in txt and 'ID@Xbox' in txt and 'GDK' in txt, txt[:80])
    async with pg.expect_download() as dl:
        await pg.click('.modal button.go'); 
    d = await dl.value; path='/tmp/pc_pkg.zip'; await d.save_as(path)
    z = zipfile.ZipFile(path); names = z.namelist()
    rec('zip is valid and complete', z.testzip() is None and any(n.endswith('/index.html') for n in names) and any(n.endswith('game.nrpack.json') for n in names) and any(n.endswith('XBOX_PORT_GUIDE.md') for n in names) and any(n.endswith('play_edge.bat') for n in names), f'{len(names)} files')
    rec('assets are real PNG and WAV files', sum(1 for n in names if n.endswith('.png'))>=10 and sum(1 for n in names if n.endswith('.wav'))>=1 and z.read([n for n in names if n.endswith('.png')][0])[:4]==b'\x89PNG' and z.read([n for n in names if n.endswith('.wav')][0])[:4]==b'RIFF', f"{sum(1 for n in names if n.endswith('.png'))} png, {sum(1 for n in names if n.endswith('.wav'))} wav")
    pack = json.loads(z.read([n for n in names if n.endswith('game.nrpack.json')][0]))
    rec('portable data: world, input map, resolution, rules reference', pack['format']=='notareal-pack' and pack['resolution']==[384,216] and len(pack['world']['maps'])>=3 and any(i['pad']=='A' for i in pack['input']) and pack['sprites']['hero']['sheet'], pack['title'])
    import shutil; shutil.rmtree('/tmp/pcpkg', ignore_errors=True); z.extractall('/tmp/pcpkg')
    root = '/tmp/pcpkg/' + [n for n in names if n.endswith('/index.html')][0].split('/')[0]
    # ---- play the exported page with a fake Xbox controller
    pg2 = await ctx.new_page(); errs2=[]; pg2.on('pageerror',lambda e:errs2.append(str(e))); pg2.on('console', lambda m: errs2.append(m.text) if m.type=='error' else None)
    await pg2.add_init_script(FAKEPAD)
    await pg2.goto('file://'+root+'/index.html'); await pg2.wait_for_timeout(600)
    rec('starts on the logo screen', await pg2.evaluate("__nr.scene==='logo'"))
    await pg2.wait_for_timeout(500); await pg2.screenshot(path='/tmp/pc_logo.png')
    await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(200)
    sc = await pg2.evaluate("__nr.scene"); rec('controller A skips the logo', sc in ('title','open'), sc)
    if sc=='open': await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(200)
    await pg2.screenshot(path='/tmp/pc_title.png')
    rec('title screen reached', await pg2.evaluate("__nr.scene==='title'"))
    await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(400)
    rec('A on New game starts the game', await pg2.evaluate("__nr.scene==='play' && !!__nr.game"))
    p0 = await pg2.evaluate("__nr.game.pos()")
    await pg2.evaluate("__pad.axes[0]=1"); await pg2.wait_for_timeout(700); await pg2.evaluate("__pad.axes[0]=0")
    p1 = await pg2.evaluate("__nr.game.pos()")
    rec('left stick walks the hero right', p1['x']>p0['x']+8, f"{p0['x']:.0f} -> {p1['x']:.0f}")
    await pg2.evaluate("__btn(13,1)"); await pg2.wait_for_timeout(500); await pg2.evaluate("__btn(13,0)")
    p2 = await pg2.evaluate("__nr.game.pos()"); rec('D-pad also walks', p2['y']>p1['y']+4, f"{p1['y']:.0f} -> {p2['y']:.0f}")
    await pg2.screenshot(path='/tmp/pc_play.png')
    await pg2.evaluate("__btn(3,1)"); await pg2.wait_for_timeout(150); await pg2.evaluate("__btn(3,0)"); await pg2.wait_for_timeout(200)
    rec('Y opens the bag', await pg2.evaluate("__nr.game.busy() && __nr.game.busy().kind==='bag'"))
    await pg2.evaluate("__btn(1,1)"); await pg2.wait_for_timeout(150); await pg2.evaluate("__btn(1,0)"); await pg2.wait_for_timeout(200)
    rec('B closes the bag', await pg2.evaluate("!__nr.game.busy()"))
    # pause menu
    await pg2.evaluate("__btn(9,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(9,0)"); await pg2.wait_for_timeout(200)
    rec('Menu button pauses', await pg2.evaluate("__nr.scene==='pause'"))
    await pg2.screenshot(path='/tmp/pc_pause.png')
    saved = await pg2.evaluate("Object.keys(localStorage).some(k=>k.startsWith('nr_pc_save_'))")
    rec('pausing saves the game (console suspend behaviour)', saved)
    for _ in range(4):
        await pg2.evaluate("__btn(13,1)"); await pg2.wait_for_timeout(100); await pg2.evaluate("__btn(13,0)"); await pg2.wait_for_timeout(100)
    await pg2.evaluate("__btn(15,1)"); await pg2.wait_for_timeout(100); await pg2.evaluate("__btn(15,0)"); await pg2.wait_for_timeout(100)
    await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(100); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(200)
    rec('menu: down x4, A toggles safe area', await pg2.evaluate("__nr.safe()===true"))
    await pg2.screenshot(path='/tmp/pc_safe.png')
    await pg2.evaluate("__btn(9,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(9,0)"); await pg2.wait_for_timeout(200)
    rec('Menu again resumes', await pg2.evaluate("__nr.scene==='play'"))
    # keyboard still works
    k0 = await pg2.evaluate("__nr.game.pos()"); await pg2.keyboard.down('ArrowLeft'); await pg2.wait_for_timeout(600); await pg2.keyboard.up('ArrowLeft'); k1 = await pg2.evaluate("__nr.game.pos()")
    rec('keyboard also works as a backup', k1['x']<k0['x']-4, f"{k0['x']:.0f} -> {k1['x']:.0f}")
    # hurt -> rumble
    await pg2.evaluate("__nr.game.state.hp = Math.max(1, __nr.game.state.hp-1)"); await pg2.wait_for_timeout(200)
    rec('damage triggers controller rumble', await pg2.evaluate("(window.__rumbleCalls||0)>=1"))
    # quit to title, then Continue is offered
    await pg2.evaluate("__btn(9,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(9,0)"); await pg2.wait_for_timeout(200)
    for _ in range(7):
        await pg2.evaluate("__btn(13,1)"); await pg2.wait_for_timeout(100); await pg2.evaluate("__btn(13,0)"); await pg2.wait_for_timeout(100)
    await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(100); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(300)
    rec('Quit to title works', await pg2.evaluate("__nr.scene==='title'"))
    await pg2.evaluate("__btn(0,1)"); await pg2.wait_for_timeout(120); await pg2.evaluate("__btn(0,0)"); await pg2.wait_for_timeout(400)
    rec('Continue loads the save', await pg2.evaluate("__nr.scene==='play' && __nr.game.state.hp>=1"))
    rec('no script errors in the studio or the exported page', not errs and not errs2, str((errs+errs2)[:3]))
    await b.close()
  json.dump(R, open('/home/claude/notareal-kit/ds/tests/pc_results.json','w'))
  print(sum(1 for r in R if r[1]), 'passed', sum(1 for r in R if not r[1]), 'failed')
asyncio.run(m())
