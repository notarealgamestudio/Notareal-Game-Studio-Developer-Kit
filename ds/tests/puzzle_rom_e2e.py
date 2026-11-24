# Exports a puzzle DS ROM from the studio, boots it in DeSmuME (needs xvfb-run) and checks the bracelet screen drew.
import asyncio, subprocess
from playwright.async_api import async_playwright
from PIL import Image
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True,viewport={'width':1500,'height':1000}); pg=await ctx.new_page()
    await pg.goto('file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'); await pg.wait_for_timeout(500)
    await pg.click('text=New game'); await pg.wait_for_timeout(300); await pg.click('.modal button.go'); await pg.wait_for_timeout(800)
    await pg.click('.tabbtn[data-tab=puzzle]'); await pg.wait_for_timeout(300)
    async with pg.expect_download() as dl: await pg.click('text=Export DS ROM')
    await (await dl.value).save_as('/tmp/t_pz.nds'); await b.close()
asyncio.run(m())
subprocess.run('xvfb-run -a python3 tools/dsrun.py /tmp/t_pz.nds /tmp/tpz 460 --shots 450 --keys "300-304:Y,330-334:B"',shell=True,capture_output=True)
im=Image.open('/tmp/tpz_00450.png').convert('RGB').crop((0,192,256,384)); cols=len(set(im.getdata()))
print('PASS' if cols>=6 else 'FAIL','puzzle ROM boots and draws the bracelet screen (colours:',cols,')')
