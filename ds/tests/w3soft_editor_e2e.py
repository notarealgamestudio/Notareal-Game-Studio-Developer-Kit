#!/usr/bin/env python3
"""N64 / PlayStation 3D export in the real editor: pick the 3D template for the console, Export ROM, check the downloaded file carries the world."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def clr(pg): await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400); await clr(pg)
        for con, ext, mid in (('n64', 'z64', 'military_shooter'), ('psx', 'exe', 'open_world_3d'), ('n64', 'z64', 'survival_rpg'), ('n64', 'z64', 'job_sim'), ('psx', 'exe', 'job_sim')):
            await pg.evaluate("([id, con]) => { const r = NRTemplates.apply(id, JSON.parse(JSON.stringify(EXAMPLE)), { console: con }); P = r.project; P.console = con; P.arcade.cfg.title = 'E2E WORLD'; if (id === 'job_sim' && P.arcade.mode !== 'store3d') throw new Error('job_sim did not become store3d on ' + con); tab = r.tab; renderAll(); }", [mid, con])
            async with pg.expect_download() as d: await clr(pg); await pg.evaluate("() => exportRom()")
            dl = await d.value; path = f'/tmp/e2e_w3.{ext}'; await dl.save_as(path); rom = open(path, 'rb').read()
            rec(f'{con} {mid}: ROM downloads as .{ext} with the world inside', dl.suggested_filename.endswith('.' + ext) and b'W3DW' in rom and b'E2E WORLD' in rom and (mid != 'job_sim' or b'E2E WORLD' in rom) and len(rom) > 200000, dl.suggested_filename)
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
    print('w3soft editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
