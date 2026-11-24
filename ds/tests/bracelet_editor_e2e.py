#!/usr/bin/env python3
"""Friendship Bracelets in the real editor: Crafting-sim template on the DS opens the Bracelets tab; Export ROM downloads an .nds carrying the BRDT data + the title."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def clr(pg): await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400); await clr(pg)
        r = await pg.evaluate("() => { const r = NRTemplates.apply('crafting_sim', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'ds', title: 'Bead Barn' }); P = r.project; P.console = 'ds'; tab = r.tab; renderAll(); return [r.engine, r.tab, !!P.bracelet]; }")
        rec('crafting sim on DS opens the Bracelets tab', r == ['bracelet', 'bracelet', True], str(r))
        rec('tab renders the panel', 'Friendship Bracelets' in await pg.inner_text('body') and 'Export DS ROM' in await pg.inner_text('body'))
        async with pg.expect_download() as d: await clr(pg); await pg.evaluate("() => exportRom()")
        dl = await d.value; path = '/tmp/e2e_br.nds'; await dl.save_as(path); rom = open(path, 'rb').read()
        rec('ROM downloads as .nds with BRDT data and the title', dl.suggested_filename.endswith('.nds') and b'BRDT' in rom and b'BEAD BARN' in rom and len(rom) > 200000, dl.suggested_filename)
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
    print('bracelet editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
