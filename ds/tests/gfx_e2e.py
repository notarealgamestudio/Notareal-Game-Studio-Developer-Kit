import asyncio, json, os
from playwright.async_api import async_playwright
R=[]
def rec(n, ok, note=''): R.append([n, bool(ok), note]); print('PASS' if ok else 'FAIL', n, note)
UP='/mnt/user-data/uploads/'
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1500,'height':1000}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=gfx]'); await pg.wait_for_timeout(900)
    rec('Graphics tab opens with before/after canvases', await pg.evaluate("document.querySelectorAll('.gfxpanel canvas').length>=3"))
    txt = await pg.inner_text('.gfxstats >> nth=0')
    rec('measured table shows blockiness etc', 'Blockiness' in txt and 'Shade steps' in txt, txt[:60].replace('\n',' '))
    await pg.screenshot(path='/tmp/gfx_tab.png')
    b0 = await pg.evaluate("NRGfx.profile(gfxS.src).blockiness"); b1 = await pg.evaluate("gfxS.out.after.blockiness")
    rec('upgrade lowers blockiness on the hero sprite', b1 < b0, f'{b0} -> {b1}')
    await pg.select_option('#g_style', 'wrestler'); await pg.wait_for_timeout(300)
    rec('style change re-runs the upgrade', await pg.evaluate("gfxS.out.style.ramp===5 && gfxS.out.style.rim===true"))
    await pg.select_option('#g_con', 'gb'); await pg.wait_for_timeout(300)
    rec('console budget Game Boy -> 4 grey shades', await pg.evaluate("gfxS.out.palette.length<=4 && gfxS.out.palette.every(c=>c[0]===c[1])"))
    await pg.select_option('#g_con', 'snes'); await pg.wait_for_timeout(200)
    before = await pg.evaluate("P.sprites.hero.image.length")
    await pg.click('text=Apply to this sprite'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(200)
    rec('Apply writes the upgraded art into the project sprite', await pg.evaluate("P.sprites.hero.image.startsWith('data:image/png') && P.sprites.hero.w>0 && dirty"))
    await pg.click('text=Upgrade every sprite in this style'); await pg.wait_for_timeout(1500)
    rec('batch upgrade restyles every sprite', await pg.evaluate("Object.values(P.sprites).every(s=>s.image.startsWith('data:image/png'))"), await pg.inner_text('.modal') if await pg.query_selector('.modal') else '')
    if await pg.query_selector('.modal button.go'): await pg.click('.modal button.go')
    # textures
    await pg.select_option('.gfxpanel:has-text("Textures") select >> nth=0', 'wood'); await pg.wait_for_timeout(300)
    rec('texture panel renders and checks the console', 'Fits' in await pg.inner_text('.gfxpanel:has-text("Textures")') or 'PlayStation' in await pg.inner_text('.gfxpanel:has-text("Textures")'))
    await pg.select_option('.gfxpanel:has-text("Textures") select >> nth=3', 'n64'); await pg.select_option('.gfxpanel:has-text("Textures") select >> nth=1', '64'); await pg.select_option('.gfxpanel:has-text("Textures") select >> nth=2', '256'); await pg.wait_for_timeout(300)
    rec('N64 texture over 4 KB gets a warning', '4096' in await pg.inner_text('.gfxpanel:has-text("Textures")'))
    rec('database panel lists the pre-scanned consoles and wrestling games', 'Super Nintendo' in await pg.inner_text('.gfxpanel:has-text("What real games do")') and 'wrestling' in (await pg.inner_text('.gfxpanel:has-text("What real games do")')).lower())
    # lab scan
    await pg.click('.tabbtn[data-tab=lab]'); await pg.wait_for_timeout(300)
    f = [x for x in os.listdir(UP) if x.endswith('WWF_WrestleMania_-_The_Arcade_Game_USA.sfc')][0]
    async with pg.expect_file_chooser() as fc: await pg.click('text=Scan a ROM')
    await (await fc.value).set_files(UP+f); await pg.wait_for_timeout(3500)
    rep = await pg.inner_text('.labreport')
    rec('Research Lab report has Graphic design findings', 'graphic design findings' in rep.lower() and 'Tile art' in rep, rep[:50].replace('\n',' '))
    await pg.click('.labgfx summary'); await pg.wait_for_timeout(200)
    rec('contact sheet previews drawn on this computer', await pg.evaluate("document.querySelectorAll('.labgfx canvas').length>=1"))
    await pg.screenshot(path='/tmp/gfx_lab.png')
    rec('lab section for graphics exists (database summary)', 'Graphic' in await pg.inner_text('.labreport'))
    # technique library
    await pg.click('.tabbtn[data-tab=tech]'); await pg.wait_for_timeout(300); await pg.click('button:has-text("Graphic design")'); await pg.wait_for_timeout(300)
    n = await pg.evaluate("document.querySelectorAll('.tech').length"); txt = await pg.inner_text('#main')
    rec('Technique Library: Graphic design filter shows craft rules + measured rows', n>=14 and 'Hue shifting' in txt and 'measured from' in txt, str(n))
    rec('no script errors', not errs, str(errs[:3]))
    await b.close()
  json.dump(R, open('/home/claude/notareal-kit/ds/tests/gfx_results.json','w')); print(sum(1 for r in R if r[1]),'passed',sum(1 for r in R if not r[1]),'failed')
asyncio.run(m())
