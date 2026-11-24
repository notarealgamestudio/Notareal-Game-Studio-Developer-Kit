#!/usr/bin/env python3
"""Frontier in the real editor: third-person-shooter template on N64 opens the Frontier tab; Export ROM downloads a .z64 carrying FRNT + W3DW and the title."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def clr(pg): await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400); await clr(pg)
        r = await pg.evaluate("() => { const r = NRTemplates.apply('shooter_tps', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'n64', title: 'Dust Town' }); P = r.project; P.console = 'n64'; tab = r.tab; renderAll(); return [r.engine, r.tab, (P.arcade && P.arcade.mode == 'frontier3d')]; }")
        rec('crafting sim on DS opens the Frontier tab', r == ["arcade", "frontier", True], str(r))
        rec('tab renders the panel', 'Frontier' in await pg.inner_text('body') and 'Export Nintendo 64' in await pg.inner_text('body'))
        async with pg.expect_download() as d: await clr(pg); await pg.evaluate("() => exportRom()")
        dl = await d.value; path = '/tmp/e2e_fr.z64'; await dl.save_as(path); rom = open(path, 'rb').read()
        rec('ROM downloads as .nds with FRNT data and the title', dl.suggested_filename.endswith(".z64") and b'FRNT' in rom and b'DUST TOWN' in rom and len(rom) > 1000000, dl.suggested_filename)
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
    print('frontier editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
