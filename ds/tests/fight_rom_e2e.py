# Exports a fighting DS ROM from the studio, boots it in DeSmuME (xvfb-run) and checks that fighters drew.
import asyncio, subprocess
from playwright.async_api import async_playwright
from PIL import Image
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True,viewport={'width':1500,'height':1000}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=fight]'); await pg.wait_for_timeout(300)
    async with pg.expect_download() as dl: await pg.click('text=Export DS ROM')
    await (await dl.value).save_as('/tmp/t_fight.nds'); await b.close(); return errs
errs=asyncio.run(m())
keys=",".join(f"{300+i*40}-{304+i*40}:A" for i in range(10))+",260-290:RIGHT"
subprocess.run(f'xvfb-run -a python3 tools/dsrun.py /tmp/t_fight.nds /tmp/tfight 900 --shots 850 --keys "{keys}"',shell=True,capture_output=True)
im=Image.open('/tmp/tfight_00850.png').convert('RGB').crop((0,0,256,192)); cols=len(set(im.getdata()))
print('PASS' if cols>=10 and not errs else 'FAIL','fight ROM boots and draws fighters (colours:',cols,')',errs)
